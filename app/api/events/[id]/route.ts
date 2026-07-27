import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: event } = await supabase.from('property_events').select('*').eq('id', params.id).maybeSingle()
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  if (!user.isCorporate && event.org_id && event.org_id !== user.org_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const [checklist, supplies, campaign, guests, ops] = await Promise.all([
    supabase.from('event_checklist_items').select('*').eq('event_id', params.id).order('due_date', { ascending: true, nullsFirst: false }),
    supabase.from('event_supplies').select('*').eq('event_id', params.id),
    supabase.from('event_campaign_steps').select('*').eq('event_id', params.id).order('sort_order', { ascending: true }),
    supabase.from('event_guests').select('*').eq('event_id', params.id),
    supabase.from('event_ops_links').select('*').eq('event_id', params.id),
  ])
  return NextResponse.json({
    event,
    checklist: checklist.data ?? [],
    supplies: supplies.data ?? [],
    campaign: campaign.data ?? [],
    guests: guests.data ?? [],
    ops: ops.data ?? [],
  })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  // Scope guard — non-corporate may only edit events in their own org.
  const { data: existing } = await supabase.from('property_events').select('org_id').eq('id', params.id).maybeSingle()
  if (!existing) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  if (!user.isCorporate && existing.org_id && existing.org_id !== user.org_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const allowed = ['title','event_type','status','event_date','start_time','end_time','venue','goal','expected_attendance','actual_attendance','budget','actual_cost','outcome_notes','property_name','site_id','host_user_id','host_name']
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patch: any = {}
  for (const k of allowed) if (k in body) patch[k] = body[k]
  const { data, error } = await supabase.from('property_events').update(patch).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ event: data })
}

// DELETE /api/events/[id] — remove an event and its child rows. Org-scoped.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (user.id === 'anonymous') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: existing } = await supabase.from('property_events').select('org_id').eq('id', params.id).maybeSingle()
  if (!existing) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  if (!user.isCorporate && existing.org_id && existing.org_id !== user.org_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  // Clear children first (in case the FKs don't cascade), then the event itself.
  for (const t of ['event_checklist_items', 'event_supplies', 'event_campaign_steps', 'event_guests', 'event_ops_links']) {
    await supabase.from(t).delete().eq('event_id', params.id)
  }
  const { error } = await supabase.from('property_events').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
