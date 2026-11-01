/**
 * /api/events/templates — reusable event plans.
 *   GET                                   → { templates: [...each with counts {tasks, supplies, emails}] }
 *   POST { name, event_type, description, default_budget }        → blank template
 *   POST { from_event_id, name? }          → save an event's plan as a template (dates → days before/after)
 *   PATCH { id, name?, event_type?, description?, default_budget? }
 *   DELETE ?id=                            → remove one of your company's templates
 * Starters (org_id null) are visible to all and edited by Gate Guard corporate only.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, type PortalUser } from '@/lib/current-user'
import { canUseEvents, eventOrgIds, eventsDb as supabase, EVENTS_DENIED, guardEvent, signedIn } from '@/lib/events-access'

export const dynamic = 'force-dynamic'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>
const EDITABLE = ['name', 'event_type', 'description', 'default_budget'] as const
const NONE = '00000000-0000-0000-0000-000000000000'

export async function GET() {
  const user = await getCurrentUser()
  if (!signedIn(user)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canUseEvents(user)) return NextResponse.json({ error: EVENTS_DENIED }, { status: 403 })
  // Corporate starters (org_id NULL) + this company's own templates (corporate sees all).
  // Starters + plans owned by any of the caller's companies (master dealers see their dealers' plans).
  const orgIds = await eventOrgIds(user)
  let q = supabase.from('event_templates').select('*')
  if (orgIds) q = q.or(`org_id.is.null,org_id.in.(${orgIds.join(',') || NONE})`)
  const { data, error } = await q.order('is_starter', { ascending: false }).order('name', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const rows = (data ?? []) as Row[]
  const ids = rows.map(t => t.id)
  const counts: Record<string, { tasks: number; supplies: number; emails: number }> = {}
  for (const id of ids) counts[id] = { tasks: 0, supplies: 0, emails: 0 }
  if (ids.length) {
    const [a, b, c] = await Promise.all([
      supabase.from('event_template_tasks').select('template_id').in('template_id', ids),
      supabase.from('event_template_supplies').select('template_id').in('template_id', ids),
      supabase.from('event_template_campaign').select('template_id').in('template_id', ids),
    ])
    for (const r of (a.data ?? []) as Row[]) if (counts[r.template_id]) counts[r.template_id].tasks++
    for (const r of (b.data ?? []) as Row[]) if (counts[r.template_id]) counts[r.template_id].supplies++
    for (const r of (c.data ?? []) as Row[]) if (counts[r.template_id]) counts[r.template_id].emails++
  }
  // canEdit tells the page whether to offer Edit / Delete.
  return NextResponse.json({ templates: rows.map(t => ({ ...t, counts: counts[t.id], canEdit: user.isCorporate || (t.org_id != null && !!orgIds?.includes(t.org_id)) })) })
}

// Days from the event to a step; null when either is undated (an undated step stays undated).
const days = (from: string | null | undefined, to: string | null | undefined) =>
  from && to ? Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) : null

async function saveFromEvent(user: PortalUser, eventId: string, name?: string) {
  const g = await guardEvent(eventId); if ('error' in g) return NextResponse.json({ error: g.error }, { status: g.status })
  const evt = g.event as Row
  const [cl, su, ca] = await Promise.all([
    supabase.from('event_checklist_items').select('*').eq('event_id', eventId),
    supabase.from('event_supplies').select('*').eq('event_id', eventId),
    supabase.from('event_campaign_steps').select('*').eq('event_id', eventId).order('sort_order'),
  ])
  const err = cl.error || su.error || ca.error
  if (err) return NextResponse.json({ error: err.message }, { status: 500 })
  const ownerOrg = evt.org_id ?? user.org_id ?? null
  const { data: tpl, error } = await supabase.from('event_templates').insert({
    org_id: ownerOrg,
    // A plan with no company is visible to every dealer — say so honestly.
    is_starter: ownerOrg == null,
    name: (name ?? '').trim() || `${evt.title} (plan)`,
    event_type: evt.event_type ?? 'other',
    description: evt.goal ?? null,
    default_budget: evt.budget ?? null,
    run_of_show: Array.isArray(evt.run_of_show) ? evt.run_of_show : [],
  }).select().single()
  if (error || !tpl) return NextResponse.json({ error: error?.message ?? 'Save failed' }, { status: 500 })
  const steps = [
    (cl.data ?? []).length ? supabase.from('event_template_tasks').insert(((cl.data ?? []) as Row[]).map(t => ({ template_id: tpl.id, category: t.category, title: t.title, owner_role: null, offset_days: days(evt.event_date, t.due_date) }))) : null,
    (su.data ?? []).length ? supabase.from('event_template_supplies').insert(((su.data ?? []) as Row[]).map(s => ({ template_id: tpl.id, category: s.category ?? 'other', item: s.item, qty: s.qty, vendor: s.vendor, unit_cost: s.cost, offset_days: s.needed_by ? days(evt.event_date, s.needed_by) : null }))) : null,
    (ca.data ?? []).length ? supabase.from('event_template_campaign').insert(((ca.data ?? []) as Row[]).map((c, i) => ({ template_id: tpl.id, step: c.step, offset_days: days(evt.event_date, c.send_at), email_subject: c.email_subject, email_html: c.email_html, sort_order: c.sort_order ?? i, audience: c.audience ?? null }))) : null,
  ].filter(Boolean)
  const results = await Promise.all(steps)
  const bad = results.find(r => r && (r as { error: unknown }).error) as { error: { message: string } } | undefined
  if (bad) {
    // Don't leave a half-saved template behind.
    await supabase.from('event_template_tasks').delete().eq('template_id', tpl.id)
    await supabase.from('event_template_supplies').delete().eq('template_id', tpl.id)
    await supabase.from('event_template_campaign').delete().eq('template_id', tpl.id)
    await supabase.from('event_templates').delete().eq('id', tpl.id)
    return NextResponse.json({ error: bad.error.message }, { status: 500 })
  }
  return NextResponse.json({ template: tpl })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!signedIn(user)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canUseEvents(user)) return NextResponse.json({ error: EVENTS_DENIED }, { status: 403 })
  const body = await req.json().catch(() => ({} as Row))
  if (body.from_event_id) return saveFromEvent(user, String(body.from_event_id), body.name ? String(body.name) : undefined)
  if (!String(body.name ?? '').trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  const { data, error } = await supabase.from('event_templates').insert({
    org_id: user.org_id ?? null,
    is_starter: false,
    name: String(body.name).trim(),
    event_type: String(body.event_type ?? 'launch_party'),
    description: body.description ? String(body.description) : null,
    default_budget: body.default_budget != null && body.default_budget !== '' ? Number(body.default_budget) : null,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ template: data })
}

async function ownTemplate(user: PortalUser, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  const { data: tpl, error } = await supabase.from('event_templates').select('org_id, is_starter').eq('id', id).maybeSingle()
  if (error) return { error: NextResponse.json({ error: error.message }, { status: 500 }) }
  const row = tpl as { org_id?: string | null; is_starter?: boolean } | null
  if (!row) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  const isStarter = row.org_id == null
  if (user.isCorporate) return { row }
  const orgIds = await eventOrgIds(user)
  if (isStarter || !row.org_id || !orgIds?.includes(row.org_id)) return { error: NextResponse.json({ error: isStarter ? 'Starter templates are edited by Gate Guard corporate.' : 'Not your template.' }, { status: 403 }) }
  return { row }
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser()
  if (!signedIn(user)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canUseEvents(user)) return NextResponse.json({ error: EVENTS_DENIED }, { status: 403 })
  const body = await req.json().catch(() => ({} as Row))
  const o = await ownTemplate(user, String(body.id ?? '')); if (o.error) return o.error
  const patch: Row = {}
  for (const k of EDITABLE) if (k in body) patch[k] = k === 'default_budget' ? (body[k] != null && body[k] !== '' ? Number(body[k]) : null) : body[k]
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'No editable fields' }, { status: 400 })
  const { data, error } = await supabase.from('event_templates').update(patch).eq('id', String(body.id)).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ template: data })
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser()
  if (!signedIn(user)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canUseEvents(user)) return NextResponse.json({ error: EVENTS_DENIED }, { status: 403 })
  const id = req.nextUrl.searchParams.get('id') ?? ''
  const o = await ownTemplate(user, id); if (o.error) return o.error
  // The built-in Gate Guard plans (migrations 162 + 204) stay; other plans can go.
  if (/^a([1-9])\1{6}-0000-4000-8000-0{11}\1$/.test(id)) return NextResponse.json({ error: 'The built-in Gate Guard plans can’t be deleted. Edit them instead.' }, { status: 400 })
  for (const t of ['event_template_tasks', 'event_template_supplies', 'event_template_campaign']) {
    const { error } = await supabase.from(t).delete().eq('template_id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  const { error } = await supabase.from('event_templates').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
