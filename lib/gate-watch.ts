/**
 * lib/gate-watch.ts — SERVER ONLY. Gate Watch: runs gate checks on a schedule,
 * keeps each gate's state, and raises / clears "gate left open" alerts.
 *
 * Schedule (driven by gate_watches.next_check_at, picked up every minute):
 *   open (or about to change)  → every 1 min   (so the time limit is accurate)
 *   closed                     → every 2 min   (mostly free quick checks)
 *   can't see the gate         → every 5 min
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
import { getSiteEagleEyeAccess, eagleEyeFullFrame } from '@/lib/eagle-eye'
import { getSiteEdge, edgeImage } from '@/lib/edge'
import { judgeGate, type CheckResult, type GateInfo, type Pt, type Ref } from '@/lib/gate-ai'

const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Gate = Record<string, any>
const TZ = process.env.GATE_WATCH_TZ || 'America/New_York'
const APP_URL = () => (process.env.NEXT_PUBLIC_APP_URL || 'https://portal.gateguard.co').replace(/\/+$/, '')
const mins = (ms: number) => Math.max(1, Math.round(ms / 60000))

// ── Frames ───────────────────────────────────────────────────────────────────
/** One full-resolution still for a camera key ('een:…' | 'edge:…'). */
export async function grabFrame(siteId: string, cameraKey: string): Promise<{ frame: Buffer | null; error?: string }> {
  try {
    if (cameraKey.startsWith('een:')) {
      const a = await getSiteEagleEyeAccess(siteId)
      const f = await eagleEyeFullFrame(a.token, a.baseHost, cameraKey.slice(4))
      return f ? { frame: f } : { frame: null, error: 'Eagle Eye returned no picture for this camera.' }
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

// ── One check, applied ───────────────────────────────────────────────────────
const NEXT = { open: 60, pending: 60, closed: 120, unknown: 60, blind: 300 }

/** Decide the new state from one reading. Pure — exported for tests. */
export function decide(g: Gate, r: Pick<CheckResult, 'verdict' | 'confidence' | 'method' | 'vehicle'>, now: Date) {
  const patch: Gate = { last_checked_at: now.toISOString(), last_verdict: r.verdict, last_confidence: r.confidence, last_method: r.method }
  const settled: 'open' | 'closed' | null = g.state === 'open' || g.state === 'left_open' ? 'open' : g.state === 'closed' ? 'closed' : null
  let event: 'opened' | 'closed' | 'blind' | null = null

  if (r.verdict === 'unclear' || r.confidence < 50) {
    const n = (g.unclear_count ?? 0) + 1
    patch.unclear_count = n
    if (n >= 10 && g.state !== 'blind' && g.state !== 'left_open') { patch.state = 'blind'; patch.state_since = now.toISOString(); event = 'blind' }
    patch.next_check_at = new Date(now.getTime() + (n >= 10 ? NEXT.blind : NEXT.unknown) * 1000).toISOString()
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
    if (count >= 2 || sure || (settled === null && r.confidence >= 80)) {
      patch.state = seen; patch.state_since = since; patch.pending_state = null; patch.pending_count = 0; patch.pending_since = null
      if (seen === 'open') { patch.open_since = since; event = 'opened' } else { patch.open_since = null; event = settled === 'open' ? 'closed' : null }
    } else { patch.pending_state = seen; patch.pending_count = count; patch.pending_since = since }
  }
  const nowOpen = (patch.state ?? g.state) === 'open' || (patch.state ?? g.state) === 'left_open'
  patch.next_check_at = new Date(now.getTime() + (nowOpen || patch.pending_state ? NEXT.open : NEXT.closed) * 1000).toISOString()
  return { patch, event }
}

/** Run one check on one gate (frame given), save it, raise/clear alerts. */
export async function checkAndApply(g: Gate, frame: Buffer, now = new Date()): Promise<{ result: CheckResult; state: string; alerted: boolean; cleared: boolean }> {
  const db = sb()
  const refs = await loadRefs(g.id)
  const settled = g.state === 'open' || g.state === 'left_open' ? 'open' : g.state === 'closed' ? 'closed' : null
  const result = await judgeGate(frame, gateInfo(g), refs, settled)
  const { patch, event } = decide(g, result, now)
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
    if (openMs >= limit && !waitForVehicle && !inHoldHours(g.hold_open_hours, now) && !(await managerHold(g, now))) {
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
      alerted = true
    }
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
    cleared = true
  }

  const { error } = await db.from('gate_watches').update(patch).eq('id', g.id)
  if (error) throw new Error(`Couldn’t save the gate state: ${error.message}`)
  const { error: logErr } = await db.from('gate_watch_checks').insert({ gate_id: g.id, checked_at: now.toISOString(), method: result.method, verdict: result.verdict, confidence: result.confidence, vehicle: result.vehicle, reason: result.reason, ms: result.ms, state_after: patch.state ?? g.state })
  if (logErr) console.error('[gate-watch] check log failed:', logErr.message)
  return { result, state: patch.state ?? g.state, alerted, cleared }
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
      const { frame, error: fErr } = await grabFrame(gates[0].site_id, gates[0].camera_key)
      for (const g of gates) {
        try {
          if (!frame) {
            const n = (g.unclear_count ?? 0) + 1
            const { error: uErr } = await db.from('gate_watches').update({ last_checked_at: now.toISOString(), last_verdict: 'error', last_reason: fErr ?? 'No picture', unclear_count: n, ...(n >= 10 && g.state !== 'left_open' ? { state: 'blind' } : {}), next_check_at: new Date(now.getTime() + (n >= 10 ? 300e3 : 60e3)).toISOString() }).eq('id', g.id)
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
