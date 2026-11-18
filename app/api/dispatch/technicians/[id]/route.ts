import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { recordInScope } from '@/lib/ops-scope'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// PATCH /api/dispatch/technicians/[id] — update status or current job
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await recordInScope('technicians', params.id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const body = await req.json()

  // Reactivate a removed tech (they'll need a new field-app code).
  if (body.active === true) {
    const { data, error } = await supabase.from('technicians').update({ active: true, removed_at: null, removed_by: null }).eq('id', params.id).select().single()
    if (error) return NextResponse.json({ error: /active|removed_/.test(error.message) ? 'Run migration 232 first.' : error.message }, { status: 500 })
    return NextResponse.json({ technician: data })
  }
  delete body.active; delete body.removed_at; delete body.removed_by

  // Drift-resilient: if a column doesn't exist yet (e.g. level/skills before
  // migration 123 is applied), strip the offending field and retry rather than
  // failing the whole save.
  let attempt: Record<string, unknown> = { ...body }
  for (let i = 0; i < 4; i++) {
    const { data, error } = await supabase.from('technicians').update(attempt).eq('id', params.id).select().single()
    if (!error) {
      if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json({ technician: data })
    }
    const m = /Could not find the '(\w+)' column|column "?(\w+)"? .* does not exist/.exec(error.message)
    const bad = m?.[1] || m?.[2]
    if ((error.code === 'PGRST204' || error.code === '42703') && bad && bad in attempt) {
      delete attempt[bad]; continue
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ error: 'Could not update' }, { status: 500 })
}

// DELETE /api/dispatch/technicians/[id] — "Remove" a tech.
// Has job history → deactivate (keeps every job, time entry and stat; off the
// dispatch/assignment lists; field-app code cleared so they can't sign in).
// No jobs at all → delete for real. ?hard=1 is refused when they have history.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await recordInScope('technicians', params.id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const me = await getCurrentUser().catch(() => null)
  const [{ count: woCount, error: e1 }, { count: timeCount, error: e2 }] = await Promise.all([
    supabase.from('work_orders').select('id', { count: 'exact', head: true }).eq('assignee_id', params.id),
    supabase.from('work_order_time_entries').select('id', { count: 'exact', head: true }).eq('technician_id', params.id),
  ])
  if (e1 || e2) return NextResponse.json({ error: (e1 ?? e2)!.message }, { status: 500 })
  const hasHistory = (woCount ?? 0) + (timeCount ?? 0) > 0

  if (!hasHistory) {
    const { error } = await supabase.from('technicians').delete().eq('id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, removed: 'deleted' })
  }

  // Their open jobs go back to unassigned so nothing is stuck on someone who left.
  const { data: open, error: oErr } = await supabase.from('work_orders').select('id')
    .eq('assignee_id', params.id).not('status', 'in', '(completed,complete,done,closed,cancelled,canceled,deleted)')
  if (oErr) return NextResponse.json({ error: oErr.message }, { status: 500 })
  const { error: dErr } = await supabase.from('technicians')
    .update({ active: false, removed_at: new Date().toISOString(), removed_by: me?.name ?? me?.email ?? null, tech_code: null, status: 'offline', current_job_id: null })
    .eq('id', params.id)
  if (dErr) return NextResponse.json({ error: /active|removed_/.test(dErr.message) ? 'Run migration 232 first — then a tech with job history can be removed.' : dErr.message }, { status: 500 })
  const openIds = (open ?? []).map((w: { id: string }) => w.id)
  if (openIds.length) {
    const { error: uErr } = await supabase.from('work_orders').update({ assignee_id: null, assignee_name: null }).in('id', openIds)
    if (uErr) return NextResponse.json({ error: `Removed, but couldn’t unassign their open jobs: ${uErr.message}` }, { status: 500 })
  }
  return NextResponse.json({ success: true, removed: 'deactivated', jobs_kept: woCount ?? 0, unassigned: openIds.length })
}
