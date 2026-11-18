/**
 * Job close-out rules (migration 232). A job can't be completed until it has:
 *   1. TIME ON SITE — at least one finished arrive/leave entry in
 *      work_order_time_entries, and no clock still running.
 *   2. PARTS — at least one part used/replaced on work_order_parts, or the
 *      "No parts used" answer (work_orders.parts_none).
 * Corporate may close without them by giving a reason (logged on the job).
 *
 * Every path that completes a job calls `checkCloseout` first: the job drawer /
 * field app (PATCH /api/maintenance/[id]), the job window, My Day and Lexi.
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export type CloseoutStatus = {
  ok: boolean
  missing: ('time' | 'clock_running' | 'parts')[]
  message: string               // plain-English "what's missing", '' when ok
  time: { entries: number; minutes: number; running: number }
  parts: { count: number; none: boolean }
  needsMigration?: boolean
}

export async function closeoutStatus(woId: string): Promise<CloseoutStatus> {
  const [t, p, w] = await Promise.all([
    supabase.from('work_order_time_entries').select('id, clock_in, clock_out, duration_mins').eq('work_order_id', woId),
    supabase.from('work_order_parts').select('id, action').eq('work_order_id', woId),
    supabase.from('work_orders').select('parts_none').eq('id', woId).maybeSingle(),
  ])
  const needsMigration = !!w.error && /parts_none/.test(w.error.message ?? '')
  const entries = (t.data ?? []) as { clock_out: string | null; duration_mins: number | null }[]
  const done = entries.filter((e) => e.clock_out)
  const running = entries.length - done.length
  const minutes = done.reduce((a, e) => a + (e.duration_mins ?? 0), 0)
  // A part sent back unused doesn't count as "used or replaced".
  const parts = ((p.data ?? []) as { action: string | null }[]).filter((x) => x.action !== 'returned').length
  const none = !!(w.data as { parts_none?: boolean } | null)?.parts_none

  const missing: CloseoutStatus['missing'] = []
  if (!done.length) missing.push('time')
  if (running) missing.push('clock_running')
  if (!parts && !none) missing.push('parts')
  const needs: string[] = []
  if (running) needs.push(running === 1 ? 'stop the clock that’s still running' : `stop the ${running} clocks still running`)
  if (!done.length) needs.push('add time on site (arrive and leave)')
  if (!parts && !none) needs.push('add the parts used or replaced (or tick “No parts used”)')
  const message = needs.length ? `Before completing, ${needs.length > 1 ? needs.slice(0, -1).join(', ') + ' and ' + needs[needs.length - 1] : needs[0]}.` : ''
  return { ok: !missing.length, missing, message, time: { entries: done.length, minutes, running }, parts: { count: parts, none }, needsMigration }
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
  if (st.ok) return null
  const reason = String(override ?? '').trim()
  if (reason) {
    if (!user?.isCorporate) return { status: 403, body: { error: 'Only Gate Guard corporate can close a job without time and parts.', code: 'closeout_required', closeout: st } }
    if (reason.length < 5) return { status: 400, body: { error: 'Give a reason (a few words) for closing without time and parts.', code: 'closeout_required', closeout: st } }
    const { error } = await supabase.from('work_orders').update({
      closeout_override_reason: reason.slice(0, 500), closeout_override_by: user.name || user.email || user.id || 'corporate', closeout_override_at: new Date().toISOString(),
    }).eq('id', woId)
    if (error && !/closeout_override/.test(error.message)) return { status: 500, body: { error: error.message } }
    return null
  }
  return { status: 409, body: { error: st.message, code: 'closeout_required', closeout: st } }
}

/** Save the close-out: an arrive/leave entry (optional) and the parts answer. */
export async function saveCloseout(woId: string, input: {
  arrive?: string | null; leave?: string | null; technician_name?: string | null; technician_id?: string | null; org_id?: string | null
  parts_none?: boolean | null; who?: string | null; notes?: string | null
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
  return { ok: true }
}
