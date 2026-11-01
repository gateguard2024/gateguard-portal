/**
 * /api/events — property events (lunch & learns, launch parties, trade shows…).
 *   GET  → { events: [...each with stats: checklist done/total/late, RSVPs, check-ins, spent] }
 *   POST { title, event_type, event_date, start_time, end_time, venue, property_name,
 *          site_id, opportunity_id, template_id, budget, expected_attendance, goal } → { event }
 * Access: lib/events-access.ts (corporate = all; others = their companies' events).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { eventOrgIds, eventsDb as supabase, signedIn } from '@/lib/events-access'

export const dynamic = 'force-dynamic'

function addDays(dateStr: string | null | undefined, days: number): string | null {
  if (!dateStr) return null
  const d = new Date(`${dateStr}T00:00:00`)
  if (isNaN(d.getTime())) return null
  d.setDate(d.getDate() + (days || 0))
  return d.toISOString().slice(0, 10)
}
const today = () => new Date().toISOString().slice(0, 10)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

export async function GET() {
  const user = await getCurrentUser()
  if (!signedIn(user)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgIds = await eventOrgIds(user)
  let q = supabase.from('property_events').select('*').order('event_date', { ascending: true, nullsFirst: false }).limit(500)
  if (orgIds) q = q.in('org_id', orgIds)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const events = (data ?? []) as Row[]
  const ids = events.map(e => e.id)
  // Roll-ups for the board / list (one query per child table, not per event).
  const stats: Record<string, { done: number; total: number; late: number; yes: number; invited: number; checkedIn: number; spent: number }> = {}
  for (const id of ids) stats[id] = { done: 0, total: 0, late: 0, yes: 0, invited: 0, checkedIn: 0, spent: 0 }
  if (ids.length) {
    const [cl, gu, su] = await Promise.all([
      supabase.from('event_checklist_items').select('event_id, status, due_date').in('event_id', ids),
      supabase.from('event_guests').select('event_id, rsvp, checked_in_at').in('event_id', ids),
      supabase.from('event_supplies').select('event_id, cost, qty').in('event_id', ids),
    ])
    for (const c of (cl.data ?? []) as Row[]) { const s = stats[c.event_id]; if (!s) continue; s.total++; if (c.status === 'done') s.done++; else if (c.due_date && c.due_date < today()) s.late++ }
    for (const g of (gu.data ?? []) as Row[]) { const s = stats[g.event_id]; if (!s) continue; s.invited++; if (g.rsvp === 'yes' || g.rsvp === 'attended') s.yes++; if (g.checked_in_at || g.rsvp === 'attended') s.checkedIn++ }
    for (const x of (su.data ?? []) as Row[]) { const s = stats[x.event_id]; if (!s) continue; s.spent += (Number(x.cost) || 0) * (Number(x.qty) || 1) }
  }
  return NextResponse.json({ events: events.map(e => ({ ...e, stats: stats[e.id] })) })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!signedIn(user)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!body.title?.trim()) return NextResponse.json({ error: 'title is required' }, { status: 400 })
  const num = (v: unknown) => (v === '' || v == null || !isFinite(Number(v)) ? null : Number(v))

  const { data: evt, error } = await supabase.from('property_events').insert({
    org_id: user.org_id ?? null,
    created_by: user.id,
    host_user_id: body.host_user_id ?? user.id,
    host_name: body.host_name ?? user.name ?? null,
    title: String(body.title).trim(),
    event_type: body.event_type ?? 'lunch_learn',
    site_id: body.site_id || null,
    opportunity_id: body.opportunity_id || null,
    aria_property_id: body.aria_property_id || null,
    property_name: body.property_name || null,
    status: 'planning',
    event_date: body.event_date || null,
    start_time: body.start_time || null,
    end_time: body.end_time || null,
    venue: body.venue || null,
    booth_number: body.booth_number || null,
    goal: body.goal || null,
    expected_attendance: num(body.expected_attendance),
    budget: num(body.budget),
    template_id: body.template_id || null,
  }).select().single()
  if (error || !evt) return NextResponse.json({ error: error?.message ?? 'Create failed' }, { status: 500 })

  if (body.template_id) {
    const { data: tpl } = await supabase.from('event_templates').select('run_of_show, default_budget').eq('id', body.template_id).maybeSingle()
    const fill: Row = {}
    if (Array.isArray(tpl?.run_of_show) && tpl.run_of_show.length) fill.run_of_show = tpl.run_of_show
    if (evt.budget == null && tpl?.default_budget != null) fill.budget = tpl.default_budget
    if (Object.keys(fill).length) {
      const { data: upd, error: fErr } = await supabase.from('property_events').update(fill).eq('id', evt.id).select().single()
      if (!fErr && upd) Object.assign(evt, upd)
    }
  }

  // Clone the template's checklist / supplies / campaign with dates relative to the event.
  const warnings: string[] = []
  if (body.template_id) {
    const [{ data: tTasks }, { data: tSupplies }, { data: tCampaign }] = await Promise.all([
      supabase.from('event_template_tasks').select('*').eq('template_id', body.template_id),
      supabase.from('event_template_supplies').select('*').eq('template_id', body.template_id),
      supabase.from('event_template_campaign').select('*').eq('template_id', body.template_id),
    ])
    if (tTasks?.length) {
      const roleName = (r: unknown) => !r || r === 'host' ? (evt.host_name ?? null) : String(r).charAt(0).toUpperCase() + String(r).slice(1)
      const { error: e1 } = await supabase.from('event_checklist_items').insert((tTasks as Row[]).map(t => ({ event_id: evt.id, category: t.category, title: t.title, owner_name: roleName(t.owner_role), due_date: addDays(evt.event_date, t.offset_days), status: 'open' })))
      if (e1) warnings.push(`checklist: ${e1.message}`)
    }
    if (tSupplies?.length) {
      const { error: e2 } = await supabase.from('event_supplies').insert((tSupplies as Row[]).map(sp => ({ event_id: evt.id, category: sp.category ?? 'other', item: sp.item, qty: sp.qty, vendor: sp.vendor, cost: sp.unit_cost ?? null, needed_by: sp.offset_days == null ? null : addDays(evt.event_date, sp.offset_days), status: 'needed' })))
      if (e2) warnings.push(`supplies: ${e2.message}`)
    }
    if (tCampaign?.length) {
      const { error: e3 } = await supabase.from('event_campaign_steps').insert((tCampaign as Row[]).map(c => ({ event_id: evt.id, step: c.step, send_at: addDays(evt.event_date, c.offset_days), email_subject: c.email_subject, email_html: c.email_html, status: 'draft', sort_order: c.sort_order })))
      if (e3) warnings.push(`campaign: ${e3.message}`)
    }
  }
  return NextResponse.json({ event: evt, ...(warnings.length ? { warnings } : {}) })
}
