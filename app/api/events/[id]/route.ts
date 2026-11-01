/**
 * /api/events/[id] — one event.
 *   GET    → { event, checklist, supplies, campaign, guests, ops, site, deal }
 *   PATCH  → edit fields (whitelisted)
 *   DELETE → event + its child rows
 * Access: lib/events-access.ts.
 */
import { NextRequest, NextResponse } from 'next/server'
import { checkEventLinks, eventsDb as supabase, guardEvent } from '@/lib/events-access'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guardEvent(params.id); if ('error' in g) return NextResponse.json({ error: g.error }, { status: g.status })
  const event = g.event
  const [checklist, supplies, campaign, guests, ops, site, deal] = await Promise.all([
    supabase.from('event_checklist_items').select('*').eq('event_id', params.id).order('due_date', { ascending: true, nullsFirst: false }),
    supabase.from('event_supplies').select('*').eq('event_id', params.id).order('created_at', { ascending: true }),
    supabase.from('event_campaign_steps').select('*').eq('event_id', params.id).order('sort_order', { ascending: true }),
    supabase.from('event_guests').select('*').eq('event_id', params.id).order('created_at', { ascending: true }),
    supabase.from('event_ops_links').select('*').eq('event_id', params.id),
    event.site_id ? supabase.from('sites').select('id, name, city, state').eq('id', String(event.site_id)).maybeSingle() : Promise.resolve({ data: null }),
    event.opportunity_id ? supabase.from('opportunities').select('id, name, stage').eq('id', String(event.opportunity_id)).maybeSingle() : Promise.resolve({ data: null }),
  ])
  return NextResponse.json({
    event,
    checklist: checklist.data ?? [], supplies: supplies.data ?? [], campaign: campaign.data ?? [],
    guests: guests.data ?? [], ops: ops.data ?? [],
    site: site.data ?? null, deal: deal.data ?? null,
  })
}

const ALLOWED = ['title', 'event_type', 'status', 'event_date', 'start_time', 'end_time', 'venue', 'goal', 'expected_attendance', 'actual_attendance', 'budget', 'actual_cost', 'outcome_notes', 'property_name', 'site_id', 'opportunity_id', 'host_user_id', 'host_name', 'run_of_show', 'venue_address', 'venue_contact', 'venue_phone', 'booth_number']
const NUMS = new Set(['expected_attendance', 'actual_attendance', 'budget', 'actual_cost'])

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guardEvent(params.id); if ('error' in g) return NextResponse.json({ error: g.error }, { status: g.status })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const patch: Record<string, unknown> = {}
  for (const k of ALLOWED) if (k in body) patch[k] = NUMS.has(k) ? (body[k] === '' || body[k] == null ? null : Number(body[k])) : (body[k] === '' ? null : body[k])
  if ('run_of_show' in patch) {
    const ros = Array.isArray(patch.run_of_show) ? patch.run_of_show : []
    patch.run_of_show = ros.slice(0, 60).map((r: { offset_min?: unknown; item?: unknown; owner?: unknown }) => ({ offset_min: Number(r?.offset_min) || 0, item: String(r?.item ?? '').slice(0, 200), owner: r?.owner ? String(r.owner).slice(0, 60) : '' })).filter((r: { item: string }) => r.item)
  }
  if ('event_date' in patch && patch.event_date != null && !/^\d{4}-\d{2}-\d{2}$/.test(String(patch.event_date))) return NextResponse.json({ error: 'That date isn’t valid.' }, { status: 400 })
  if ('site_id' in patch || 'opportunity_id' in patch) {
    const linkErr = await checkEventLinks(g.user, { site_id: patch.site_id, opportunity_id: patch.opportunity_id })
    if (linkErr) return NextResponse.json({ error: linkErr }, { status: 400 })
  }
  if (!Object.keys(patch).length && !body.shift_dates) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  // Rescheduled with "move the plan too": the date and every open dated step move
  // together in one database transaction (migration 208) — never half-moved.
  let shifted = 0
  const oldDate = g.event.event_date as string | null
  if (body.shift_dates && 'event_date' in patch && patch.event_date && patch.event_date !== oldDate) {
    const { data: n, error: sErr } = await supabase.rpc('shift_event_dates', { p_event: params.id, p_new_date: patch.event_date })
    if (sErr) return NextResponse.json({ error: `Couldn’t move the plan (run migration 208): ${sErr.message}` }, { status: 500 })
    shifted = Number(n) || 0
    delete patch.event_date
  }
  let event: Record<string, unknown> | null = null
  if (Object.keys(patch).length) {
    const { data, error } = await supabase.from('property_events').update(patch).eq('id', params.id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    event = data
  } else {
    const { data, error } = await supabase.from('property_events').select('*').eq('id', params.id).single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    event = data
  }
  return NextResponse.json({ event, ...(shifted ? { shifted } : {}) })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guardEvent(params.id); if ('error' in g) return NextResponse.json({ error: g.error }, { status: g.status })
  // Children first (FKs may not cascade), then the event.
  for (const t of ['event_checklist_items', 'event_supplies', 'event_campaign_steps', 'event_guests', 'event_ops_links']) {
    const { error } = await supabase.from(t).delete().eq('event_id', params.id)
    if (error) return NextResponse.json({ error: `Couldn’t remove ${t}: ${error.message}` }, { status: 500 })
  }
  const { error } = await supabase.from('property_events').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
