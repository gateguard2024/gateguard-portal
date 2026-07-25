import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, isInScope } from '@/lib/org-scope'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// A local calendar event is editable if it's yours, in your org subtree, or you're corporate.
async function guard(id: string): Promise<boolean> {
  if (!id) return false
  const user = await getCurrentUser()
  const scope = await resolveOrgScope(user)
  const { data } = await supabase.from('calendar_events').select('org_id, user_id').eq('id', id).maybeSingle()
  if (!data) return false
  const row = data as { org_id?: string | null; user_id?: string | null }
  if (row.user_id && row.user_id === user.id) return true
  if (scope.all) return true
  return isInScope(scope, row.org_id)
}

// PATCH /api/calendar/events/[id] — edit a local Nexus calendar event.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await guard(params.id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const body = await req.json().catch(() => ({}))
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.title === 'string') patch.title = body.title.trim()
  if (body.start) patch.start_time = body.start
  if (body.end !== undefined) patch.end_time = body.end ?? body.start
  if (body.all_day !== undefined) patch.is_all_day = Boolean(body.all_day)
  if (body.location !== undefined) patch.location = body.location ?? null
  const { data, error } = await supabase
    .from('calendar_events')
    .update(patch)
    .eq('id', params.id)
    .select('id, title, start_time, end_time, is_all_day, location')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({
    event: { id: data.id, title: data.title, start: data.start_time, end: data.end_time, all_day: data.is_all_day, category: 'jobs', location: data.location },
  })
}

// DELETE /api/calendar/events/[id] — remove a local Nexus calendar event.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await guard(params.id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { error } = await supabase.from('calendar_events').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
