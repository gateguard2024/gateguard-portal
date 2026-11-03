/**
 * lib/gate-watch.ts — SERVER ONLY. Gate Watch: runs gate checks on a schedule,
 * keeps each gate's state, and raises / clears "gate left open" alerts.
 *
 * Schedule (driven by gate_watches.next_check_at, picked up every minute) — decided Nov 3 2026:
 *   closed                       → every 30 min (30 min after its last check, so gates stay spread out)
 *   a check sees it OPEN         → ONE recheck at (alert limit + 1 min), e.g. 6 min for a 5-min limit
 *        recheck closed          → just a car passing: back to every 30 min, no alert
 *        recheck open            → it's been open past the limit: alert (Fault + text + email + service request)
 *        recheck open + vehicle  → look again in 1 min before alerting (busy gate)
 *   left open (alerted/ticketed) → every 30 min until it closes (closing is confirmed 1 min later)
 *   unsure reading               → retry in 5 min (or keep the open recheck time)
 *   Check now                    → settles on one confident reading (≥80%); closed → back to every 30 min
 *
 * State rules:
 *   • A change of state needs TWO agreeing readings in a row (or one very sure
 *     strong-AI reading). One odd frame never flips a gate or clears an alert.
 *   • "unclear" never changes anything; 10 in a row → "Can't see the gate".
 *   • Open for ≥ the gate's time limit → LEFT OPEN: a Fault (incidents), a line in
 *     the property's activity, and a text to the gate's numbers. Lexi already
 *     surfaces open Faults.
 *     Not alerted during the gate's hold-open hours or a manager's "hold open"
 *     from the property portal; if a vehicle is in the opening it waits (up to
 *     twice the limit).
 *   • Closing again resolves the Fault and texts "closed" to the same numbers.
 */
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { getSiteEagleEyeAccess, eagleEyeFullFrame, eagleEyeLiveFrame } from '@/lib/eagle-eye'
import { getSiteEdge, edgeImage } from '@/lib/edge'
import { judgeGate, type CheckResult, type GateInfo, type Pt, type Ref } from '@/lib/gate-ai'
import { sendEmail } from '@/lib/email-sender'

const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Gate = Record<string, any>
const TZ = process.env.GATE_WATCH_TZ || 'America/New_York'
const APP_URL = () => (process.env.NEXT_PUBLIC_APP_URL || 'https://portal.gateguard.co').replace(/\/+$/, '')
const mins = (ms: number) => Math.max(1, Math.round(ms / 60000))

// ── Frames ───────────────────────────────────────────────────────────────────
/** One CURRENT still for a camera key ('een:…' | 'edge:…').
 * Eagle Eye: Eagle Eye's liveImage.jpeg is the last still it stored (can be hours old
 * when nobody is watching), so read a frame off the live feed instead — the main
 * (full-resolution) feed first, then the preview feed — and only fall back to the
 * stored still if both fail (`stale: true`). */
export async function grabFrame(siteId: string, cameraKey: string): Promise<{ frame: Buffer | null; error?: string; stale?: boolean }> {
  try {
    if (cameraKey.startsWith('een:')) {
      const a = await getSiteEagleEyeAccess(siteId)
      const id = cameraKey.slice(4)
      const main = await eagleEyeLiveFrame(a.token, a.baseHost, id, [], 5000, 'main')
      if (main) return { frame: main }
      const prev = await eagleEyeLiveFrame(a.token, a.baseHost, id, [], 7000, 'preview')
      if (prev) return { frame: prev }
      const f = await eagleEyeFullFrame(a.token, a.baseHost, id)
      return f ? { frame: f, stale: true } : { frame: null, error: 'Eagle Eye returned no picture for this camera.' }
    }
    if (cameraKey.startsWith('edge:')) {
      const e = await getSiteEdge(siteId)
      if (!e) return { frame: null, error: 'No Gate Guard Edge device at this property.' }
      const f = await edgeImage(e, siteId, cameraKey.slice(5))
      return f ? { frame: f } : { frame: null, error: 'The Edge device returned no picture for this camera.' }
    }
    return { frame: null, error: 'Unknown camera.' }
  } catch (e) { return { frame: null, error: e instanceof Error ? e.message : 'Couldn’t get a picture.' } }
}

export const gateInfo = (g: Gate): GateInfo => ({ label: g.label, gate_type: g.gate_type, region: Array.isArray(g.region) ? g.region as Pt[] : null, notes: g.notes })

export async function loadRefs(gateId: string): Promise<(Ref & { source: string; created_at: string; id: string })[]> {
  const { data, error } = await sb().from('gate_watch_refs').select('id, state, image, sig, source, created_at').eq('gate_id', gateId).order('created_at', { ascending: false }).limit(24)
  if (error) throw new Error(error.message)
  return (data ?? []).map(r => ({ ...r, sig: (r.sig ?? []).map(Number) }))
}

// ── Hold-open windows ────────────────────────────────────────────────────────
function localParts(d: Date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d).map(x => [x.type, x.value]))
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(String(p.weekday))
  return { day, hm: `${String(p.hour).replace('24', '00')}:${p.minute}` }
}
export function inHoldHours(rules: unknown, at = new Date()): boolean {
  if (!Array.isArray(rules)) return false
  const { day, hm } = localParts(at)
  return rules.some((r: { days?: number[]; start?: string; end?: string }) => Array.isArray(r?.days) && r.days.includes(day) && !!r.start && !!r.end && (r.start <= r.end ? hm >= r.start && hm < r.end : hm >= r.start || hm < r.end))
}
async function managerHold(g: Gate, at: Date): Promise<boolean> {
  if (!g.brivo_door_id) return false
  const { data } = await sb().from('site_events').select('created_at, metadata').eq('site_id', g.site_id).eq('event_type', 'gate_hold_open').gte('created_at', new Date(at.getTime() - 4 * 3600e3).toISOString()).order('created_at', { ascending: false }).limit(20)
  return (data ?? []).some(e => String(e.metadata?.door_id ?? '') === String(g.brivo_door_id) && Date.parse(e.created_at) + (Number(e.metadata?.minutes) || 60) * 60e3 > at.getTime())
}

// ── Texts ────────────────────────────────────────────────────────────────────
async function textAll(phones: string[], body: string): Promise<number> {
  const SID = process.env.TWILIO_ACCOUNT_SID, TOKEN = process.env.TWILIO_AUTH_TOKEN, FROM = process.env.TWILIO_FROM_NUMBER
  if (!SID || !TOKEN || !FROM || !phones?.length) return 0
  let sent = 0
  for (const raw of phones.slice(0, 5)) {
    const d = String(raw).replace(/\D/g, ''); const to = d.length === 10 ? `+1${d}` : d.length === 11 && d.startsWith('1') ? `+${d}` : null
    if (!to) continue
    try {
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`, { method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${SID}:${TOKEN}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ From: FROM, To: to, Body: body }).toString(), signal: AbortSignal.timeout(10000) })
      if (res.ok) sent++; else console.error('[gate-watch] text failed', res.status, (await res.text()).slice(0, 160))
    } catch (e) { console.error('[gate-watch] text failed', e) }
  }
  return sent
}

// ── Emails ───────────────────────────────────────────────────────────────────
/** Gate Guard's inbox gets every gate alert at every property; notify_emails adds people per gate. */
export const GATE_ALWAYS_EMAIL = 'info@gateguard.co'
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
async function emailAll(extra: string[] | null | undefined, subject: string, lines: string[], link: string): Promise<{ ok: boolean; to: string[]; error?: string }> {
  const to = [...new Set([GATE_ALWAYS_EMAIL, ...(extra ?? []).map(e => String(e).trim().toLowerCase()).filter(e => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))])].slice(0, 6)
  const html = `<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;font-size:15px;color:#1D1D1F;line-height:1.5">${lines.map(l => `<p style="margin:0 0 10px">${esc(l)}</p>`).join('')}<p style="margin:16px 0 0"><a href="${esc(link)}" style="display:inline-block;background:#0071E3;color:#fff;text-decoration:none;padding:9px 16px;border-radius:8px;font-weight:600">Open the property</a></p><p style="margin:18px 0 0;font-size:12px;color:#6E6E73">Gate Watch · Gate Guard</p></div>`
  const r = await sendEmail({ to, subject, html })
  if (!r.success) console.error('[gate-watch] email failed:', r.error)
  return { ok: r.success, to, error: r.error }
}

/** "Send test alert" in gate setup: a real email to the same people a left-open alert goes to. Writes nothing. */
export async function sendGateTestEmail(g: Gate, siteName: string | null, who: string) {
  return emailAll(g.notify_emails, `[Test] Gate Watch alert — ${siteName ?? 'Property'}: ${g.label}`, [
    `This is a test from Gate Watch, sent by ${who}.`,
    `If ${g.label} at ${siteName ?? 'the property'} is left open past its limit (${mins((g.threshold_sec ?? 300) * 1000)} min), this is who gets the alert email. A Fault and a service request are created at the same time.`,
  ], `${APP_URL()}/?tab=systems&site=${g.site_id}`)
}

// ── Up / down time (gate_downtime, migration 216) ──────────────────────────
/** DOWN = stuck open (alerted, or quietly left open while ticketed) until it reads closed.
 * BLIND = Gate Watch can't see the gate — tracked separately, never counted as down.
 * Never throws: a missing table (216 not run) or a failed write only logs. */
async function openPeriod(g: Gate, kind: 'down' | 'blind', at: Date, extra: { incident_id?: string | null; ticketed?: boolean } = {}) {
  const { error } = await sb().from('gate_downtime').insert({ gate_id: g.id, site_id: g.site_id, kind, started_at: at.toISOString(), incident_id: extra.incident_id ?? null, ticketed: !!extra.ticketed })
  if (error && error.code !== '23505') console.error(`[gate-watch] ${kind} log failed:`, error.message)
}
async function closePeriod(g: Gate, kind: 'down' | 'blind', at: Date) {
  const { error } = await sb().from('gate_downtime').update({ ended_at: at.toISOString() }).eq('gate_id', g.id).eq('kind', kind).is('ended_at', null)
  if (error) console.error(`[gate-watch] ${kind} log close failed:`, error.message)
}
/** Record a state change. Call with the state before and after. */
export async function recordDowntime(g: Gate, prev: string | null | undefined, next: string | null | undefined, at: Date, extra: { incident_id?: string | null; ticketed?: boolean } = {}) {
  if (next === 'left_open' && prev !== 'left_open') await openPeriod(g, 'down', at, extra)
  if (prev === 'left_open' && next === 'closed') await closePeriod(g, 'down', at)
  if (next === 'blind' && prev !== 'blind') await openPeriod(g, 'blind', at)
  if (prev === 'blind' && next !== 'blind') await closePeriod(g, 'blind', at)
}

export type GateUptime = { up_pct: number | null; down_count: number; down_ms: number; avg_down_ms: number | null; blind_ms: number; down_now: boolean; since: string }
/** Up / down for each gate over the last `days` (from when the gate was added, if later). */
export async function gateUptime(gates: Gate[], days = 30, now = new Date()): Promise<{ byGate: Record<string, GateUptime>; error?: string }> {
  const byGate: Record<string, GateUptime> = {}
  if (!gates.length) return { byGate }
  const from = now.getTime() - days * 864e5
  const { data, error } = await sb().from('gate_downtime').select('gate_id, kind, started_at, ended_at').in('gate_id', gates.map(g => g.id)).or(`ended_at.is.null,ended_at.gte.${new Date(from).toISOString()}`).limit(5000)
  if (error) return { byGate, error: /gate_downtime/.test(error.message) ? 'needs migration 216' : error.message }
  for (const g of gates) {
    const start = Math.max(from, Date.parse(String(g.created_at ?? new Date(from).toISOString())))
    const span = Math.max(0, now.getTime() - start)
    let down = 0, blind = 0, count = 0, downNow = false
    const durations: number[] = []
    for (const r of (data ?? []).filter(x => x.gate_id === g.id)) {
      const a = Math.max(start, Date.parse(r.started_at)), b = r.ended_at ? Date.parse(r.ended_at) : now.getTime()
      if (b <= a) continue
      if (r.kind === 'down') { down += b - a; count++; if (!r.ended_at) downNow = true; else durations.push(Date.parse(r.ended_at) - Date.parse(r.started_at)) }
      else blind += b - a
    }
    const watched = span - blind
    byGate[String(g.id)] = {
      up_pct: watched > 60_000 ? Math.max(0, Math.min(100, Math.round((1 - down / watched) * 1000) / 10)) : null,
      down_count: count, down_ms: down, blind_ms: blind, down_now: downNow,
      avg_down_ms: durations.length ? Math.round(durations.reduce((x, y) => x + y, 0) / durations.length) : null,
      since: new Date(start).toISOString(),
    }
  }
  return { byGate }
}

// ── Service request ─────────────────────────────────────────────────────────
/** Open ≥ 5 minutes → ONE service request for that site + gate (Operations → Requests).
 * While that ticket is open — the request is new/acknowledged, or it became a work order that
 * isn't finished — this gate makes no new ticket and sends no new left-open alerts (no Fault,
 * text or email). Finishing the work order (or closing the request) re-arms it.
 * Decided Nov 2 2026. Never throws. */
export const SERVICE_REQUEST_AFTER_MS = 5 * 60_000
const WO_DONE = ['completed', 'complete', 'closed', 'done', 'cancelled', 'canceled', 'invoiced']

/** The gate's open ticket, if any: { request_id, work_order_id } or null. Lookup errors → null (alerts still go out). */
export async function openGateTicket(g: Gate): Promise<{ request_id: string; work_order_id: string | null } | null> {
  const db = sb()
  const { data, error } = await db.from('wo_requests').select('id, status, converted_wo_id').eq('site_id', g.site_id).eq('area', g.label).in('status', ['new', 'acknowledged', 'converted']).order('created_at', { ascending: false }).limit(5)
  if (error) { console.error('[gate-watch] ticket lookup failed:', error.message); return null }
  for (const r of data ?? []) {
    if (r.status !== 'converted') return { request_id: r.id, work_order_id: null }
    if (!r.converted_wo_id) continue
    const { data: wo, error: wErr } = await db.from('work_orders').select('id, status').eq('id', r.converted_wo_id).maybeSingle()
    if (wErr) { console.error('[gate-watch] work order lookup failed:', wErr.message); return null }
    if (wo && !WO_DONE.includes(String(wo.status ?? '').toLowerCase())) return { request_id: r.id, work_order_id: wo.id }
  }
  return null
}

export async function ensureServiceRequest(g: Gate, siteName: string | null, openMs: number, reason: string): Promise<void> {
  if (await openGateTicket(g)) return   // already ticketed — nothing new until that work is finished
  const stamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  const { error } = await sb().from('wo_requests').insert({
    site_id: g.site_id, area: g.label, priority_requested: 'high', status: 'new',
    title: `Gate left open — ${g.label}`,
    description: `Gate Watch saw ${g.label}${siteName ? ` at ${siteName}` : ''} open for ${mins(openMs)} minutes (${stamp}). Check the gate operator, loops, photo eyes and close limit. What the AI saw: ${reason}. Gate Watch won't alert again for this gate until this work is finished.`,
    contact_name: 'Gate Watch (AI)', contact_email: GATE_ALWAYS_EMAIL,
  })
  if (error) console.error('[gate-watch] service request failed:', error.message)
}

// ── One check, applied ───────────────────────────────────────────────────────
// Cost (decided Nov 2 2026): a closed gate is checked every 30 minutes. As soon as a reading
// says it's open, it's checked every minute until it closes, so the time limit, alerts and the
// 5-minute service request run from when it was SEEN open. An unsure reading retries in 5 min.
const NEXT = { closed: 1800, unknown: 300, blind: 1800, leftOpen: 1800, confirm: 60 }
/** When to look next: open-ish gates get ONE recheck at limit + 1 min (from when first seen open). */
export function nextCheckAt(g: Gate, patch: Gate, now: Date): string {
  const thr = Math.max(60, Number(g.threshold_sec ?? 300)) * 1000
  const st = (patch.state ?? g.state) as string
  const pend = (patch.pending_state !== undefined ? patch.pending_state : g.pending_state) as string | null
  const at = (ms: number) => new Date(Math.max(now.getTime() + 60_000, ms)).toISOString()
  if (st === 'left_open') return pend === 'closed' ? at(now.getTime() + NEXT.confirm * 1000) : at(now.getTime() + NEXT.leftOpen * 1000)
  if (st === 'open') return pend === 'closed' ? at(now.getTime() + NEXT.confirm * 1000) : at(Date.parse(String(patch.open_since ?? g.open_since ?? now.toISOString())) + thr + 60_000)
  if (pend === 'open') return at(Date.parse(String(patch.pending_since ?? g.pending_since ?? now.toISOString())) + thr + 60_000)
  if (pend === 'closed') return at(now.getTime() + NEXT.confirm * 1000)
  return at(now.getTime() + NEXT.closed * 1000)
}

/** Decide the new state from one reading. Pure — exported for tests. */
export function decide(g: Gate, r: Pick<CheckResult, 'verdict' | 'confidence' | 'method' | 'vehicle'>, now: Date, opts: { manual?: boolean } = {}) {
  const patch: Gate = { last_checked_at: now.toISOString(), last_verdict: r.verdict, last_confidence: r.confidence, last_method: r.method }
  const settled: 'open' | 'closed' | null = g.state === 'open' || g.state === 'left_open' ? 'open' : g.state === 'closed' ? 'closed' : null
  let event: 'opened' | 'closed' | 'blind' | null = null

  if (r.verdict === 'unclear' || r.confidence < 50) {
    const n = (g.unclear_count ?? 0) + 1
    patch.unclear_count = n
    if (n >= 10 && g.state !== 'blind' && g.state !== 'left_open') { patch.state = 'blind'; patch.state_since = now.toISOString(); event = 'blind' }
    const openish = g.state === 'open' || g.state === 'left_open' || g.pending_state === 'open'
    patch.next_check_at = n >= 10 ? new Date(now.getTime() + NEXT.blind * 1000).toISOString() : openish ? nextCheckAt(g, patch, now) : new Date(now.getTime() + NEXT.unknown * 1000).toISOString()
    return { patch, event }
  }
  patch.unclear_count = 0
  const seen: 'open' | 'closed' = r.verdict === 'closed' ? 'closed' : 'open'   // partial counts as open
  const sure = r.method === 'strong_ai' && r.confidence >= 90 && r.verdict !== 'partial'

  if (seen === settled) {
    patch.pending_state = null; patch.pending_count = 0; patch.pending_since = null
    if (g.state === 'blind') patch.state = seen
  } else {
    const count = g.pending_state === seen ? (g.pending_count ?? 0) + 1 : 1
    const since = g.pending_state === seen && g.pending_since ? g.pending_since : now.toISOString()
    // First reading after setup (state unknown) settles on one confident answer.
    // Check now (a person asked) settles on one confident reading, so a repair resets right away.
    if (count >= 2 || sure || (settled === null && r.confidence >= 80) || (opts.manual && r.confidence >= 80)) {
      patch.state = seen; patch.state_since = since; patch.pending_state = null; patch.pending_count = 0; patch.pending_since = null
      if (seen === 'open') { patch.open_since = since; event = 'opened' } else { patch.open_since = null; event = settled === 'open' ? 'closed' : null }
    } else { patch.pending_state = seen; patch.pending_count = count; patch.pending_since = since }
  }
  patch.next_check_at = nextCheckAt(g, patch, now)
  return { patch, event }
}

/** Run one check on one gate (frame given), save it, raise/clear alerts. */
export async function checkAndApply(g: Gate, frame: Buffer, now = new Date(), opts: { manual?: boolean } = {}): Promise<{ result: CheckResult; state: string; alerted: boolean; cleared: boolean; why?: string }> {
  const db = sb()
  const refs = await loadRefs(g.id)
  const settled = g.state === 'open' || g.state === 'left_open' ? 'open' : g.state === 'closed' ? 'closed' : null
  const result = await judgeGate(frame, gateInfo(g), refs, settled)
  const { patch, event } = decide(g, result, now, opts)
  let why: string | undefined
  patch.last_reason = result.reason
  patch.last_frame = (await sharp(result.crop).resize({ width: 360, height: 360, fit: 'inside' }).jpeg({ quality: 70 }).toBuffer()).toString('base64')
  let alerted = false, cleared = false
  const state = patch.state ?? g.state
  const openSince = patch.open_since !== undefined ? patch.open_since : g.open_since

  // Left open?
  if (state === 'open' && openSince) {
    const openMs = now.getTime() - Date.parse(openSince)
    const limit = (g.threshold_sec ?? 300) * 1000
    const waitForVehicle = result.vehicle && openMs < limit * 2
    const held = openMs >= limit && !waitForVehicle && (inHoldHours(g.hold_open_hours, now) || await managerHold(g, now))
    const due = openMs >= limit && !waitForVehicle && !held
    const ticket = due ? await openGateTicket(g) : null
    if (openMs >= limit && waitForVehicle) { why = 'vehicle in the gate — looking again in 1 min'; patch.next_check_at = new Date(now.getTime() + 60e3).toISOString() }
    else if (held) { why = 'meant to be open right now (hold-open)'; patch.next_check_at = new Date(now.getTime() + NEXT.closed * 1000).toISOString() }
    else if (openMs < limit) why = `open ${mins(openMs)} of ${mins(limit)} min — recheck at the limit`
    if (due && ticket) {
      // Already ticketed: mark it left open quietly — no Fault, text, email or new request — and
      // look again in 30 min instead of every minute.
      patch.state = 'left_open'; patch.alerted_at = now.toISOString()
      patch.next_check_at = new Date(now.getTime() + 1800e3).toISOString()
      why = 'a service ticket is already open — no new alert until that work order is done'
    } else if (due) {
      const title = `Gate left open — ${g.label}`
      const description = `${g.label} has been open ${mins(openMs)} min (limit ${mins(limit)} min). Seen by Gate AI: ${result.reason}`
      const { data: site } = await db.from('sites').select('name, org_id').eq('id', g.site_id).maybeSingle()
      const { data: inc, error: incErr } = await db.from('incidents').insert({
        org_id: site?.org_id ?? null, site_id: g.site_id, title, description, severity: 'high', status: 'open',
        category: 'gate', cause: 'stuck_open', source: 'ai', started_at: openSince, reported_by: 'Gate AI',
      }).select('id').single()
      if (incErr) throw new Error(`Couldn’t open the Fault: ${incErr.message}`)
      patch.state = 'left_open'; patch.incident_id = inc.id; patch.alerted_at = now.toISOString()
      const { error: evErr } = await db.from('site_events').insert({ site_id: g.site_id, event_type: 'gate_left_open', event_source: 'gate_ai', title, description, summary: title, severity: 'critical', metadata: { gate_id: g.id, minutes: mins(openMs), incident_id: inc.id } })
      if (evErr) console.error('[gate-watch] site_events insert failed:', evErr.message)
      await textAll(g.notify_phones ?? [], `🚨 ${site?.name ?? 'Property'}: ${g.label} has been open ${mins(openMs)} min. ${APP_URL()}/?tab=systems&site=${g.site_id}`)
      await emailAll(g.notify_emails, `🚨 Gate left open — ${site?.name ?? 'Property'}: ${g.label}`, [
        `${g.label} at ${site?.name ?? 'the property'} has been open ${mins(openMs)} minutes (limit ${mins(limit)} min).`,
        `What Gate AI saw: ${result.reason}`,
        `A Fault was opened${openMs >= SERVICE_REQUEST_AFTER_MS ? ' and a service request was added (Operations → Requests)' : ''}. You’ll get another email when it closes.`,
        'Was the AI right? Open the property → Doors & gates → Gate Watch and tap Yes or No. It learns from your answer.',
      ], `${APP_URL()}/?tab=systems&site=${g.site_id}`)
      if (openMs >= SERVICE_REQUEST_AFTER_MS) await ensureServiceRequest(g, site?.name ?? null, openMs, result.reason)
      // Limit under 5 min: come back at 5 min (+1) for the service request; otherwise every 30 min.
      patch.next_check_at = new Date(openMs < SERVICE_REQUEST_AFTER_MS ? Date.parse(openSince) + SERVICE_REQUEST_AFTER_MS + 60e3 : now.getTime() + NEXT.leftOpen * 1000).toISOString()
      alerted = true; why = 'alert sent'
    }
  }
  // Alert limit under 5 min: the request goes in once it reaches 5 min (checks run ~every minute).
  if (state === 'left_open' && openSince && g.incident_id && (g.threshold_sec ?? 300) * 1000 < SERVICE_REQUEST_AFTER_MS) {
    const openMs = now.getTime() - Date.parse(openSince)
    if (openMs >= SERVICE_REQUEST_AFTER_MS) {   // ensureServiceRequest never makes a second one
      const { data: site } = await db.from('sites').select('name').eq('id', g.site_id).maybeSingle()
      await ensureServiceRequest(g, site?.name ?? null, openMs, result.reason)
    }
  }
  // Left open but already ticketed (no Fault): only look every 30 min until it closes or the work is done.
  if ((patch.state ?? g.state) === 'left_open' && !(patch.incident_id ?? g.incident_id)) {
    patch.next_check_at = new Date(now.getTime() + 1800e3).toISOString()
    // The ticket's work is finished but the gate is still open → re-arm: the next check alerts as normal.
    if (g.state === 'left_open' && !(await openGateTicket(g))) { patch.state = 'open'; patch.alerted_at = null; patch.next_check_at = new Date(now.getTime() + 60e3).toISOString() }
  }
  // Closed again after an alert → resolve.
  if (event === 'closed' && g.incident_id) {
    const { error } = await db.from('incidents').update({ status: 'resolved', resolved_at: now.toISOString(), updated_at: now.toISOString() }).eq('id', g.incident_id)
    if (error) throw new Error(`Couldn’t close the Fault: ${error.message}`)
    patch.incident_id = null; patch.alerted_at = null
    const openMin = g.open_since ? mins(now.getTime() - Date.parse(g.open_since)) : null
    const title = `Gate closed — ${g.label}`
    const { error: evErr } = await db.from('site_events').insert({ site_id: g.site_id, event_type: 'gate_closed', event_source: 'gate_ai', title, description: `${g.label} closed${openMin ? ` after ${openMin} min` : ''}. Fault resolved.`, summary: title, severity: 'info', metadata: { gate_id: g.id, incident_id: g.incident_id } })
    if (evErr) console.error('[gate-watch] site_events insert failed:', evErr.message)
    const { data: site } = await db.from('sites').select('name').eq('id', g.site_id).maybeSingle()
    await textAll(g.notify_phones ?? [], `✅ ${site?.name ?? 'Property'}: ${g.label} is closed${openMin ? ` (was open ${openMin} min)` : ''}.`)
    await emailAll(g.notify_emails, `✅ Gate closed — ${site?.name ?? 'Property'}: ${g.label}`, [
      `${g.label} at ${site?.name ?? 'the property'} is closed${openMin ? ` (it was open ${openMin} minutes)` : ''}.`,
      'The Fault was resolved.',
    ], `${APP_URL()}/?tab=systems&site=${g.site_id}`)
    cleared = true
  }

  const { error } = await db.from('gate_watches').update(patch).eq('id', g.id)
  if (error) throw new Error(`Couldn’t save the gate state: ${error.message}`)
  await recordDowntime(g, g.state, (patch.state ?? g.state) as string, now, { incident_id: (patch.incident_id ?? g.incident_id) as string | null, ticketed: !(patch.incident_id ?? g.incident_id) })
  const { error: logErr } = await db.from('gate_watch_checks').insert({ gate_id: g.id, checked_at: now.toISOString(), method: result.method, verdict: result.verdict, confidence: result.confidence, vehicle: result.vehicle, reason: result.reason, ms: result.ms, state_after: patch.state ?? g.state })
  if (logErr) console.error('[gate-watch] check log failed:', logErr.message)
  if (!why && (patch.state ?? g.state) === 'closed') why = 'closed — next look in 30 min'
  return { result, state: patch.state ?? g.state, alerted, cleared, why }
}

/** The every-minute job: claim due gates, one picture per camera, check each gate. */
export async function runDueGates(limit = 40): Promise<{ checked: number; alerts: number; cleared: number; errors: string[] }> {
  const db = sb()
  const now = new Date()
  // Claim: push next_check_at out 3 min so an overlapping run can't double-check.
  const { data: due, error } = await db.from('gate_watches').update({ next_check_at: new Date(now.getTime() + 180e3).toISOString() })
    .eq('enabled', true).lte('next_check_at', now.toISOString()).select('*')
  if (error) throw new Error(error.message)
  const errors: string[] = []
  let checked = 0, alerts = 0, cleared = 0
  const byCam = new Map<string, Gate[]>()
  for (const g of (due ?? []).slice(0, limit)) { const k = `${g.site_id}|${g.camera_key}`; byCam.set(k, [...(byCam.get(k) ?? []), g]) }
  const jobs = [...byCam.values()]
  let i = 0
  await Promise.all(Array.from({ length: Math.min(4, jobs.length) }, async () => {
    while (i < jobs.length) {
      const gates = jobs[i++]
      // Never judge Eagle Eye's old stored still — treat it as "can't see" this round.
      const got = await grabFrame(gates[0].site_id, gates[0].camera_key)
      const frame = got.stale ? null : got.frame
      const fErr = got.stale ? 'Eagle Eye only had an old stored picture (no live frame)' : got.error
      for (const g of gates) {
        try {
          if (!frame) {
            const n = (g.unclear_count ?? 0) + 1
            if (n >= 10 && g.state !== 'left_open' && g.state !== 'blind') await recordDowntime(g, g.state, 'blind', now)
            const { error: uErr } = await db.from('gate_watches').update({ last_checked_at: now.toISOString(), last_verdict: 'error', last_reason: fErr ?? 'No picture', unclear_count: n, ...(n >= 10 && g.state !== 'left_open' ? { state: 'blind' } : {}), next_check_at: new Date(now.getTime() + (n < 10 && (g.state === 'open' || g.state === 'left_open') ? 60e3 : n >= 10 ? 1800e3 : 300e3)).toISOString() }).eq('id', g.id)
            if (uErr) errors.push(uErr.message)
            continue
          }
          const r = await checkAndApply(g, frame, now)
          checked++; if (r.alerted) alerts++; if (r.cleared) cleared++
        } catch (e) {
          errors.push(`${g.label}: ${e instanceof Error ? e.message : e}`)
          await db.from('gate_watches').update({ next_check_at: new Date(Date.now() + 60e3).toISOString() }).eq('id', g.id)
        }
      }
    }
  }))
  // Keep the log small.
  const { error: pErr } = await db.from('gate_watch_checks').delete().lt('checked_at', new Date(now.getTime() - 14 * 864e5).toISOString())
  if (pErr) errors.push(`prune: ${pErr.message}`)
  return { checked, alerts, cleared, errors }
}
