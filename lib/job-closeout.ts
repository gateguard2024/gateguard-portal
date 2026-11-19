/**
 * Job close-out rules (migration 232). A job can't be completed until it has:
 *   1. TIME ON SITE — at least one finished arrive/leave entry in
 *      work_order_time_entries, and no clock still running.
 *   2. PARTS — at least one part used/replaced on work_order_parts, or the
 *      "No parts used" answer (work_orders.parts_none).
 *   3. WHICH OPENING (migration 233) — only at properties that have openings set
 *      up: the gate/door the job was for (work_orders.opening_id), or
 *      "Whole property / other" (opening_property). Return trips count per opening.
 *   4. WHAT IT WAS (migration 235, lib/service-taxonomy.ts) — visit type, what was
 *      worked on, the fix; the cause on repair-type visits. A REMOTE RESET needs remote
 *      minutes instead of time on site (and no arrive/leave). Bill the property → the job
 *      is marked ready_to_bill_at when it completes.
 * Corporate may close without them by giving a reason (logged on the job).
 *
 * Every path that completes a job calls `checkCloseout` first: the job drawer /
 * field app (PATCH /api/maintenance/[id]), the job window, My Day and Lexi.
 */
import { createClient } from '@supabase/supabase-js'
import { DETAIL_KEYS, cleanDetails, detailsMissing, guessVisitType, isRemote, type ServiceDetails } from '@/lib/service-taxonomy'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export type CloseoutStatus = {
  ok: boolean
  missing: ('time' | 'clock_running' | 'parts' | 'opening' | 'details')[]
  message: string               // plain-English "what's missing", '' when ok
  time: { entries: number; minutes: number; running: number }
  parts: { count: number; none: boolean }
  /** required = the property has openings set up. */
  opening: { required: boolean; id: string | null; property: boolean; name: string | null; options: { id: string; name: string; kind: string }[] }
  /** required = migration 235 has run. suggested = a starting visit type (not saved). */
  details: { required: boolean; values: Partial<ServiceDetails>; missing: string[]; suggested: { visit_type: string | null } }
  needsMigration?: boolean
}

export async function closeoutStatus(woId: string): Promise<CloseoutStatus> {
  const [t, p, w] = await Promise.all([
    supabase.from('work_order_time_entries').select('id, clock_in, clock_out, duration_mins').eq('work_order_id', woId),
    supabase.from('work_order_parts').select('id, action').eq('work_order_id', woId),
    supabase.from('work_orders').select('parts_none').eq('id', woId).maybeSingle(),
  ])
  const needsMigration = !!w.error && /parts_none/.test(w.error.message ?? '')
  // Openings (233): which gate/door this job was for. Drift-safe — before 233 runs it's simply not asked.
  const opening: CloseoutStatus['opening'] = { required: false, id: null, property: false, name: null, options: [] }
  const wo = await supabase.from('work_orders').select('site_id, opening_id, opening_property').eq('id', woId).maybeSingle()
  if (!wo.error && wo.data) {
    const j = wo.data as { site_id: string | null; opening_id: string | null; opening_property: boolean | null }
    opening.id = j.opening_id; opening.property = !!j.opening_property
    if (j.site_id) {
      const { data: ops } = await supabase.from('site_openings').select('id, name, kind, active').eq('site_id', j.site_id).order('sort').order('name')
      const list = (ops ?? []) as { id: string; name: string; kind: string; active: boolean }[]
      opening.options = list.filter((o) => o.active || o.id === j.opening_id).map(({ id, name, kind }) => ({ id, name, kind }))
      opening.required = list.some((o) => o.active)
      opening.name = list.find((o) => o.id === j.opening_id)?.name ?? null
    }
  }
  // What it was (235). Drift-safe — before 235 runs it isn't asked.
  const details: CloseoutStatus['details'] = { required: false, values: {}, missing: [], suggested: { visit_type: null } }
  const dq = await supabase.from('work_orders').select(`job_type, title, ${DETAIL_KEYS.join(', ')}`).eq('id', woId).maybeSingle()
  if (!dq.error && dq.data) {
    const row = dq.data as unknown as Record<string, unknown>
    details.required = true
    details.values = Object.fromEntries(DETAIL_KEYS.map((k) => [k, row[k] ?? null])) as Partial<ServiceDetails>
    details.missing = detailsMissing(details.values)
    details.suggested.visit_type = details.values.visit_type ? null : guessVisitType(row as { job_type?: string; title?: string })
  }
  const remote = details.required && isRemote(details.values)
  const entries = (t.data ?? []) as { clock_out: string | null; duration_mins: number | null }[]
  const done = entries.filter((e) => e.clock_out)
  const running = entries.length - done.length
  const minutes = done.reduce((a, e) => a + (e.duration_mins ?? 0), 0)
  // A part sent back unused doesn't count as "used or replaced".
  const parts = ((p.data ?? []) as { action: string | null }[]).filter((x) => x.action !== 'returned').length
  const none = !!(w.data as { parts_none?: boolean } | null)?.parts_none

  const missing: CloseoutStatus['missing'] = []
  if (!done.length && !remote) missing.push('time')   // a remote reset logs remote minutes instead
  if (running) missing.push('clock_running')
  if (!parts && !none) missing.push('parts')
  if (opening.required && !opening.id && !opening.property) missing.push('opening')
  if (details.missing.length) missing.push('details')
  const needs: string[] = []
  if (details.missing.length) {
    const say: Record<string, string> = { visit_type: 'the visit type', system: 'what you worked on', cause: 'the cause', resolution: 'the fix', remote_minutes: 'the minutes spent remotely' }
    const w = details.missing.map((k) => say[k] ?? k)
    needs.push(`say what it was (${w.length > 1 ? w.slice(0, -1).join(', ') + ' and ' + w[w.length - 1] : w[0]})`)
  }
  if (running) needs.push(running === 1 ? 'stop the clock that’s still running' : `stop the ${running} clocks still running`)
  if (!done.length && !remote) needs.push('add time on site (arrive and leave)')
  if (!parts && !none) needs.push('add the parts used or replaced (or tick “No parts used”)')
  if (missing.includes('opening')) needs.push('pick which gate or door it was for')
  const message = needs.length ? `Before completing, ${needs.length > 1 ? needs.slice(0, -1).join(', ') + ' and ' + needs[needs.length - 1] : needs[0]}.` : ''
  return { ok: !missing.length, missing, message, time: { entries: done.length, minutes, running }, parts: { count: parts, none }, opening, details, needsMigration }
}

/**
 * Gate for a status change. Returns null when the job may complete, or an error
 * body + status for the API to return. `override` = corporate closing without the
 * close-out, with a reason — that is saved on the job.
 */
export async function checkCloseout(
  woId: string,
  user: { isCorporate?: boolean; name?: string | null; email?: string | null; id?: string } | null,
  override?: string | null,
): Promise<{ status: number; body: Record<string, unknown> } | null> {
  const st = await closeoutStatus(woId)
  if (st.ok) { await markReadyToBill(woId, st); return null }
  const reason = String(override ?? '').trim()
  if (reason) {
    if (!user?.isCorporate) return { status: 403, body: { error: 'Only Gate Guard corporate can close a job without time and parts.', code: 'closeout_required', closeout: st } }
    if (reason.length < 5) return { status: 400, body: { error: 'Give a reason (a few words) for closing without time and parts.', code: 'closeout_required', closeout: st } }
    const { error } = await supabase.from('work_orders').update({
      closeout_override_reason: reason.slice(0, 500), closeout_override_by: user.name || user.email || user.id || 'corporate', closeout_override_at: new Date().toISOString(),
    }).eq('id', woId)
    if (error && !/closeout_override/.test(error.message)) return { status: 500, body: { error: error.message } }
    await markReadyToBill(woId, st)
    return null
  }
  return { status: 409, body: { error: st.message, code: 'closeout_required', closeout: st } }
}

/** "Bill the property" → mark the job ready for billing as it completes (billing/admin section works from this later). */
async function markReadyToBill(woId: string, st: CloseoutStatus) {
  if (st.details.values.bill_to !== 'property') return
  const { error } = await supabase.from('work_orders').update({ ready_to_bill_at: new Date().toISOString() }).eq('id', woId).is('ready_to_bill_at', null)
  if (error) console.error('[closeout] ready_to_bill_at:', error.message)
}

/** Save the close-out: an arrive/leave entry (optional) and the parts answer. */
export async function saveCloseout(woId: string, input: {
  arrive?: string | null; leave?: string | null; technician_name?: string | null; technician_id?: string | null; org_id?: string | null
  parts_none?: boolean | null; who?: string | null; notes?: string | null
  /** an opening id, or 'property' = Whole property / other, or null = leave as is */
  opening?: string | null
  /** What it was (235) — any of visit_type, system, system_2, cause, resolution, bill_to, remote_minutes. */
  details?: Record<string, unknown> | null
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (input.arrive || input.leave) {
    const a = input.arrive ? new Date(input.arrive) : null
    const l = input.leave ? new Date(input.leave) : null
    if (!a || !l || isNaN(a.getTime()) || isNaN(l.getTime())) return { ok: false, status: 400, error: 'Enter both the arrive and leave times.' }
    const mins = Math.round((l.getTime() - a.getTime()) / 60000)
    if (mins <= 0) return { ok: false, status: 400, error: 'Leave time must be after arrive time.' }
    if (mins > 24 * 60) return { ok: false, status: 400, error: 'That’s over 24 hours on site — check the dates.' }
    if (l.getTime() > Date.now() + 15 * 60000) return { ok: false, status: 400, error: 'Leave time can’t be in the future.' }
    const { error } = await supabase.from('work_order_time_entries').insert({
      work_order_id: woId, org_id: input.org_id ?? null, technician_id: input.technician_id ?? null,
      technician_name: input.technician_name || 'Technician', clock_in: a.toISOString(), clock_out: l.toISOString(),
      duration_mins: mins, notes: input.notes ?? 'Time on site (close-out)',
    })
    if (error) return { ok: false, status: 500, error: error.message }
  }
  if (input.parts_none != null) {
    const { error } = await supabase.from('work_orders').update(input.parts_none
      ? { parts_none: true, parts_none_at: new Date().toISOString(), parts_none_by: input.who ?? null }
      : { parts_none: false, parts_none_at: null, parts_none_by: null }).eq('id', woId)
    if (error) return { ok: false, status: /parts_none/.test(error.message) ? 409 : 500, error: /parts_none/.test(error.message) ? 'Run migration 232 to record “No parts used”.' : error.message }
  }
  if (input.opening) {
    let upd: Record<string, unknown>
    if (input.opening === 'property') upd = { opening_id: null, opening_property: true }
    else {
      const { data: job } = await supabase.from('work_orders').select('site_id').eq('id', woId).maybeSingle()
      const siteId = (job as { site_id?: string | null } | null)?.site_id
      const { data: op } = siteId ? await supabase.from('site_openings').select('id').eq('id', input.opening).eq('site_id', siteId).eq('active', true).maybeSingle() : { data: null }
      if (!op) return { ok: false, status: 400, error: 'That gate or door isn’t at this job’s property.' }
      upd = { opening_id: input.opening, opening_property: false }
    }
    const { error } = await supabase.from('work_orders').update(upd).eq('id', woId)
    if (error) return { ok: false, status: /opening_/.test(error.message) ? 409 : 500, error: /opening_/.test(error.message) ? 'Run migration 233 to record the opening.' : error.message }
  }
  if (input.details) {
    const upd = cleanDetails(input.details)
    if (Object.keys(upd).length) {
      const { error } = await supabase.from('work_orders').update(upd).eq('id', woId)
      if (error) return { ok: false, status: /visit_type|system|cause|resolution|bill_to|remote_minutes/.test(error.message) ? 409 : 500, error: /visit_type|system|cause|resolution|bill_to|remote_minutes/.test(error.message) ? 'Run migration 235 to record what the job was.' : error.message }
    }
  }
  return { ok: true }
}
