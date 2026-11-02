/**
 * /api/sites/[id]/gates — Gate Watch (AI that alerts when a gate is left open).
 *
 * GET                       → { gates } for the property (live state, no pictures except the last close-up)
 * GET ?gate=<id>            → { gate, refs, checks } — taught pictures + recent checks (setup screen)
 * POST { action, … }
 *   snapshot   { camera_key }                    → { image } current full frame (to draw the outline)
 *   save       { id?, camera_key, camera_name, label, gate_type, region, threshold_min,
 *                brivo_door_id, hold_open_hours, notify_phones, notes, enabled }   → { gate }
 *   delete     { id }
 *   teach      { id, state: open|closed }        → saves the gate's CURRENT picture as an example
 *   delete_ref { ref_id }
 *   test       { id }                            → { verdict, … } a dry run — nothing changes
 *   check_now  { id }                            → runs a real check (may raise / clear an alert)
 *   feedback   { id, correct: open|closed }      → "that was wrong": saves the last close-up as an
 *                                                  example of the right state and fixes the gate's state
 * Seeing gates and giving feedback = the 'cameras' permission. Setting gates up = Gate Guard
 * corporate or the dealer's admin (and cameras permission).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { getCurrentUser } from '@/lib/current-user'
import { canOperate } from '@/lib/system-access'
import { normalizeRole } from '@/lib/permissions'
import { cropGate, signature, judgeGate } from '@/lib/gate-ai'
import { checkAndApply, gateInfo, grabFrame, loadRefs } from '@/lib/gate-watch'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const LIVE_COLS = 'id, site_id, camera_key, camera_name, label, gate_type, region, threshold_sec, enabled, brivo_door_id, hold_open_hours, notify_phones, notes, state, state_since, open_since, pending_state, pending_count, unclear_count, last_checked_at, last_verdict, last_confidence, last_method, last_reason, last_frame, incident_id, alerted_at, updated_at'
const TYPES = ['swing', 'slide', 'barrier_arm', 'vertical_lift', 'other']
const bad = (m: string, s = 400) => NextResponse.json({ error: m }, { status: s })

async function access(siteId: string) {
  const user = await getCurrentUser()
  const view = await canOperate(user, siteId, 'cameras')
  const setup = view && (user.isCorporate || normalizeRole(user.role) === 'admin')
  return { user, view, setup }
}

async function getGate(siteId: string, id: unknown) {
  if (typeof id !== 'string' || !id) return null
  const { data } = await db().from('gate_watches').select('*').eq('id', id).eq('site_id', siteId).maybeSingle()
  return data
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const a = await access(params.id)
  if (!a.view) return bad('No camera access at this property.', 403)
  const gateId = req.nextUrl.searchParams.get('gate')
  if (gateId) {
    const g = await getGate(params.id, gateId)
    if (!g) return bad('Gate not found.', 404)
    const [refs, checks] = await Promise.all([
      db().from('gate_watch_refs').select('id, state, image, source, created_by, created_at').eq('gate_id', g.id).order('created_at', { ascending: false }).limit(24),
      db().from('gate_watch_checks').select('checked_at, method, verdict, confidence, vehicle, reason, ms, state_after').eq('gate_id', g.id).order('checked_at', { ascending: false }).limit(40),
    ])
    if (refs.error) return bad(refs.error.message, 500)
    return NextResponse.json({ gate: g, refs: refs.data ?? [], checks: checks.data ?? [], can_setup: a.setup })
  }
  const { data, error } = await db().from('gate_watches').select(LIVE_COLS).eq('site_id', params.id).order('label')
  if (error) return bad(/does not exist/i.test(error.message) ? 'Gate Watch needs migration 210.' : error.message, 500)
  const ids = (data ?? []).map(g => g.id)
  const counts: Record<string, { open: number; closed: number }> = {}
  if (ids.length) {
    const { data: r } = await db().from('gate_watch_refs').select('gate_id, state').in('gate_id', ids)
    for (const x of r ?? []) { counts[x.gate_id] ??= { open: 0, closed: 0 }; counts[x.gate_id][x.state as 'open' | 'closed']++ }
  }
  return NextResponse.json({ gates: (data ?? []).map(g => ({ ...g, taught: counts[g.id] ?? { open: 0, closed: 0 } })), can_setup: a.setup })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const siteId = params.id
  const a = await access(siteId)
  if (!a.view) return bad('No camera access at this property.', 403)
  let b: Record<string, unknown>
  try { b = await req.json() } catch { return bad('Bad request') }
  const action = String(b.action ?? '')
  const needSetup = ['snapshot', 'save', 'delete', 'teach', 'delete_ref'].includes(action)
  if (needSetup && !a.setup) return bad('Only Gate Guard or your company admin can set up gates.', 403)
  const sbx = db()

  try {
    if (action === 'snapshot') {
      const key = String(b.camera_key ?? '')
      if (!/^(een|edge):.{1,200}$/.test(key)) return bad('Pick a camera.')
      const { frame, error } = await grabFrame(siteId, key)
      if (!frame) return bad(error ?? 'No picture from that camera.', 502)
      const img = await sharp(frame).rotate().resize({ width: 1280, height: 1280, fit: 'inside' }).jpeg({ quality: 80 }).toBuffer()
      return NextResponse.json({ image: img.toString('base64') })
    }

    if (action === 'save') {
      const key = String(b.camera_key ?? '')
      const label = String(b.label ?? '').trim().slice(0, 60)
      if (!/^(een|edge):.{1,200}$/.test(key)) return bad('Pick a camera.')
      if (!label) return bad('Give the gate a name.')
      const region = Array.isArray(b.region) ? (b.region as { x: number; y: number }[]).map(p => ({ x: Math.min(1, Math.max(0, Number(p?.x))), y: Math.min(1, Math.max(0, Number(p?.y))) })).filter(p => isFinite(p.x) && isFinite(p.y)) : []
      if (region.length < 3 || region.length > 16) return bad('Outline the gate with at least 3 points.')
      const type = TYPES.includes(String(b.gate_type)) ? String(b.gate_type) : 'swing'
      const thresholdMin = Math.round(Number(b.threshold_min ?? 5))
      if (!(thresholdMin >= 1 && thresholdMin <= 1440)) return bad('Time limit must be 1–1440 minutes.')
      const phones = (Array.isArray(b.notify_phones) ? b.notify_phones : String(b.notify_phones ?? '').split(/[,;\n]/)).map(x => String(x).trim()).filter(Boolean).slice(0, 5)
      if (phones.some(p => p.replace(/\D/g, '').length < 10)) return bad('A text number doesn’t look right.')
      const hours = Array.isArray(b.hold_open_hours) ? (b.hold_open_hours as { days?: unknown; start?: unknown; end?: unknown }[]).slice(0, 7).map(h => ({ days: (Array.isArray(h.days) ? h.days : []).map(Number).filter(d => d >= 0 && d <= 6), start: String(h.start ?? ''), end: String(h.end ?? '') })).filter(h => h.days.length && /^\d{2}:\d{2}$/.test(h.start) && /^\d{2}:\d{2}$/.test(h.end)) : []
      const row = {
        site_id: siteId, camera_key: key, camera_name: String(b.camera_name ?? '').slice(0, 120) || null, label, gate_type: type, region,
        threshold_sec: thresholdMin * 60, brivo_door_id: String(b.brivo_door_id ?? '').trim() || null, hold_open_hours: hours, notify_phones: phones,
        notes: String(b.notes ?? '').trim().slice(0, 300) || null, enabled: b.enabled !== false, updated_at: new Date().toISOString(),
      }
      if (b.id) {
        const g = await getGate(siteId, b.id)
        if (!g) return bad('Gate not found.', 404)
        // A new camera or outline makes the old example pictures meaningless.
        const moved = g.camera_key !== key || JSON.stringify(g.region) !== JSON.stringify(region)
        if (moved) { const { error } = await sbx.from('gate_watch_refs').delete().eq('gate_id', g.id); if (error) return bad(error.message, 500) }
        const { data, error } = await sbx.from('gate_watches').update({ ...row, ...(moved ? { state: 'unknown', pending_state: null, pending_count: 0, next_check_at: new Date().toISOString() } : {}) }).eq('id', g.id).select('*').single()
        if (error) return bad(error.message, 500)
        return NextResponse.json({ gate: data, refs_cleared: moved })
      }
      const { data, error } = await sbx.from('gate_watches').insert({ ...row, created_by: a.user.name }).select('*').single()
      if (error) return bad(/does not exist/i.test(error.message) ? 'Gate Watch needs migration 210.' : error.message, 500)
      return NextResponse.json({ gate: data })
    }

    if (action === 'delete') {
      const g = await getGate(siteId, b.id); if (!g) return bad('Gate not found.', 404)
      const { error } = await sbx.from('gate_watches').delete().eq('id', g.id)
      if (error) return bad(error.message, 500)
      return NextResponse.json({ ok: true })
    }

    if (action === 'teach') {
      const g = await getGate(siteId, b.id); if (!g) return bad('Gate not found.', 404)
      const state = b.state === 'open' ? 'open' : b.state === 'closed' ? 'closed' : null
      if (!state) return bad('Say whether the gate is open or closed.')
      const { frame, error: fErr } = await grabFrame(siteId, g.camera_key)
      if (!frame) return bad(fErr ?? 'No picture from the camera.', 502)
      const crop = await cropGate(frame, gateInfo(g).region)
      const image = (await sharp(crop).jpeg({ quality: 80 }).toBuffer()).toString('base64')
      const { data, error } = await sbx.from('gate_watch_refs').insert({ gate_id: g.id, state, image, sig: await signature(crop, gateInfo(g).region), source: 'setup', created_by: a.user.name }).select('id, state, image, source, created_at').single()
      if (error) return bad(error.message, 500)
      // Keep the newest 8 per state.
      const { data: extra } = await sbx.from('gate_watch_refs').select('id').eq('gate_id', g.id).eq('state', state).order('created_at', { ascending: false }).range(8, 100)
      if (extra?.length) { const { error: dErr } = await sbx.from('gate_watch_refs').delete().in('id', extra.map(x => x.id)); if (dErr) console.error('[gates] prune refs:', dErr.message) }
      const { error: uErr } = await sbx.from('gate_watches').update({ next_check_at: new Date().toISOString() }).eq('id', g.id)
      if (uErr) console.error('[gates] reschedule:', uErr.message)
      return NextResponse.json({ ref: data })
    }

    if (action === 'delete_ref') {
      const id = String(b.ref_id ?? '')
      const { data: r } = await sbx.from('gate_watch_refs').select('id, gate_id').eq('id', id).maybeSingle()
      if (!r || !(await getGate(siteId, r.gate_id))) return bad('Picture not found.', 404)
      const { error } = await sbx.from('gate_watch_refs').delete().eq('id', id)
      if (error) return bad(error.message, 500)
      return NextResponse.json({ ok: true })
    }

    if (action === 'test' || action === 'check_now') {
      const g = await getGate(siteId, b.id); if (!g) return bad('Gate not found.', 404)
      const { frame, error: fErr } = await grabFrame(siteId, g.camera_key)
      if (!frame) return bad(fErr ?? 'No picture from the camera.', 502)
      if (action === 'check_now') {
        const r = await checkAndApply(g, frame)
        const { crop, sig, ...rest } = r.result; void sig
        return NextResponse.json({ ...rest, state: r.state, alerted: r.alerted, cleared: r.cleared, image: crop.toString('base64') })
      }
      const settled = g.state === 'open' || g.state === 'left_open' ? 'open' : g.state === 'closed' ? 'closed' : null
      const r = await judgeGate(frame, gateInfo(g), await loadRefs(g.id), settled, { allowQuick: b.ai !== true })
      const { crop, sig, ...rest } = r; void sig
      return NextResponse.json({ ...rest, image: crop.toString('base64') })
    }

    if (action === 'feedback') {
      const g = await getGate(siteId, b.id); if (!g) return bad('Gate not found.', 404)
      const correct = b.correct === 'open' ? 'open' : b.correct === 'closed' ? 'closed' : null
      if (!correct) return bad('Say whether the gate was open or closed.')
      if (!g.last_frame) return bad('No recent picture to learn from — run a check first.')
      const buf = Buffer.from(g.last_frame, 'base64')
      const { error } = await sbx.from('gate_watch_refs').insert({ gate_id: g.id, state: correct, image: g.last_frame, sig: await signature(buf, gateInfo(g).region), source: 'feedback', created_by: a.user.name })
      if (error) return bad(error.message, 500)
      const now = new Date().toISOString()
      const patch: Record<string, unknown> = { pending_state: null, pending_count: 0, pending_since: null, unclear_count: 0, next_check_at: now }
      if (correct === 'closed' && g.state !== 'closed') {
        patch.state = 'closed'; patch.state_since = now; patch.open_since = null; patch.alerted_at = null
        if (g.incident_id) {
          const { error: iErr } = await sbx.from('incidents').update({ status: 'resolved', resolved_at: now, updated_at: now, description: `Closed by ${a.user.name}: the Gate AI was wrong (gate was closed). Saved as a lesson.` }).eq('id', g.incident_id)
          if (iErr) return bad(`Couldn’t close the Fault: ${iErr.message}`, 500)
          patch.incident_id = null
        }
      } else if (correct === 'open' && g.state !== 'open' && g.state !== 'left_open') {
        patch.state = 'open'; patch.state_since = now; patch.open_since = now
      }
      const { error: uErr } = await sbx.from('gate_watches').update(patch).eq('id', g.id)
      if (uErr) return bad(uErr.message, 500)
      return NextResponse.json({ ok: true, state: patch.state ?? g.state })
    }

    return bad('Unknown action')
  } catch (e) {
    return bad(e instanceof Error ? e.message : 'Gate Watch failed', 502)
  }
}
