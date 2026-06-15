import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope } from '@/lib/org-scope'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const NO_MATCH = '00000000-0000-0000-0000-000000000000'

// POST /api/calendar/events — create a LOCAL Nexus event (source of truth).
// Body: { title, start, end?, all_day?, location?, related_type?, related_id? }
// Google/Microsoft push is a follow-up (#58); this persists locally first.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const title = String(body.title ?? '').trim()
  const start = body.start as string | undefined
  if (!title || !start) {
    return NextResponse.json({ error: 'title and start are required' }, { status: 400 })
  }
  const { data, error } = await supabase
    .from('calendar_events')
    .insert({
      org_id: user.org_id,
      user_id: user.id,
      created_by: user.id,
      title,
      start_time: start,
      end_time: (body.end as string) ?? start,
      is_all_day: Boolean(body.all_day),
      location: (body.location as string) ?? null,
      related_type: (body.related_type as string) ?? null,
      related_id: (body.related_id as string) ?? null,
      source: 'nexus',
      status: 'confirmed',
      sync_status: 'not_synced',
    })
    .select('id, title, start_time, end_time, is_all_day, location')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({
    event: {
      id: data.id,
      title: data.title,
      start: data.start_time,
      end: data.end_time,
      all_day: data.is_all_day,
      category: 'jobs',
      location: data.location,
    },
  })
}

export interface CalendarEvent {
  id: string
  type: 'nexus_event' | 'todo' | 'work_order' | 'work_order_phase' | 'pm_schedule' | 'gcal' | 'crm_activity' | 'tracker_task'
  title: string
  date: string       // YYYY-MM-DD
  time?: string      // HH:MM if has time
  status: string
  priority?: string
  color: string      // hex
  link?: string      // portal deep link
  gcal_event_id?: string
  opportunity_name?: string
  owner_name?: string
}

// GET /api/calendar/events?year=2026&month=5&scope=me|team
//   scope=me   → the caller's own org calendar (default)
//   scope=team → the caller's full downward org subtree (their org + everything
//                below: downstream dealers' jobs, sales events, etc.)
// Corporate always sees everything.
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    const { searchParams } = new URL(req.url)
    const year  = parseInt(searchParams.get('year')  ?? String(new Date().getFullYear()), 10)
    const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1), 10)
    const scopeParam = searchParams.get('scope') === 'team' ? 'team' : 'me'

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay   = new Date(year, month, 0).getDate()
    const endDate   = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    // ── Resolve which org IDs this request covers ─────────────────────────────
    // corporate → null (no org filter). me → own org. team → full subtree.
    const orgScope = await resolveOrgScope(user)
    let orgIds: string[] | null
    if (user.isCorporate) orgIds = null
    else if (scopeParam === 'team') orgIds = orgScope.ids.length ? orgScope.ids : (user.org_id ? [user.org_id] : [NO_MATCH])
    else orgIds = user.org_id ? [user.org_id] : [NO_MATCH]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const byOrg = <T extends { in: (c: string, v: string[]) => T }>(q: T, col = 'org_id'): T =>
      orgIds ? q.in(col, orgIds) : q

    const events: CalendarEvent[] = []

    // ── Hosted Nexus Calendar Events ──────────────────────────────────────────
    try {
      let nexusQ = supabase
        .from('calendar_events')
        .select('id, title, start_time, end_time, status, location, org_id')
        .gte('start_time', `${startDate}T00:00:00`)
        .lte('start_time', `${endDate}T23:59:59`)
        .neq('status', 'cancelled')
        .order('start_time', { ascending: true })
      nexusQ = byOrg(nexusQ as any)
      const { data: nexusRows } = await nexusQ
      for (const ev of nexusRows ?? []) {
        const startIso = ev.start_time as string
        events.push({
          id: ev.id, type: 'nexus_event', title: ev.title ?? 'Nexus Event',
          date: startIso.split('T')[0],
          time: startIso.includes('T') ? startIso.split('T')[1]?.substring(0, 5) : undefined,
          status: ev.status ?? 'confirmed', color: '#007CFF',
        })
      }
    } catch { /* table may not exist until migration 096 */ }

    // ── To-Dos (scoped by org) ────────────────────────────────────────────────
    let todosQ = supabase
      .from('todos')
      .select('id, title, due_date, status, priority, assigned_to_name')
      .not('due_date', 'is', null)
      .gte('due_date', startDate)
      .lte('due_date', endDate)
      .order('due_date', { ascending: true })
    todosQ = byOrg(todosQ as any)
    const { data: todos } = await todosQ
    for (const todo of todos ?? []) {
      events.push({
        id: todo.id, type: 'todo', title: todo.title ?? 'Untitled To-Do', date: todo.due_date,
        status: todo.status ?? 'open', priority: todo.priority ?? 'medium', color: '#6B7EFF', link: '/todos',
        owner_name: (todo as any).assigned_to_name ?? undefined,
      })
    }

    // ── Work Orders (jobs — scoped downstream) ────────────────────────────────
    let woQuery = supabase
      .from('work_orders')
      .select('id, title, scheduled_date, scheduled_time, status, priority, site_id, assignee_name')
      .not('scheduled_date', 'is', null)
      .gte('scheduled_date', startDate)
      .lte('scheduled_date', endDate)
      .order('scheduled_date', { ascending: true })
    woQuery = byOrg(woQuery as any)
    const { data: wos } = await woQuery
    const scopedWoIds: string[] = []
    for (const wo of wos ?? []) {
      scopedWoIds.push(wo.id)
      events.push({
        id: wo.id, type: 'work_order', title: wo.title ?? 'Work Order', date: wo.scheduled_date,
        time: wo.scheduled_time ?? undefined, status: wo.status ?? 'open', color: '#F59E0B',
        link: `/maintenance/${wo.id}`, owner_name: (wo as any).assignee_name ?? undefined,
      })
    }

    // ── Work Order Phases (scoped to the work orders we can see) ───────────────
    {
      let phaseQ = supabase
        .from('work_order_phases')
        .select('id, name, scheduled_date, work_order_id')
        .not('scheduled_date', 'is', null)
        .gte('scheduled_date', startDate)
        .lte('scheduled_date', endDate)
        .order('scheduled_date', { ascending: true })
      if (orgIds) phaseQ = phaseQ.in('work_order_id', scopedWoIds.length ? scopedWoIds : [NO_MATCH])
      const { data: woPhases } = await phaseQ
      for (const phase of woPhases ?? []) {
        events.push({
          id: phase.id, type: 'work_order_phase', title: phase.name ?? 'Work Order Phase',
          date: phase.scheduled_date, status: 'scheduled', color: '#C2410C',
          link: phase.work_order_id ? `/maintenance/${phase.work_order_id}` : '/maintenance',
        })
      }
    }

    // ── PM Schedules (scoped by org) ──────────────────────────────────────────
    let pmQ = supabase
      .from('pm_schedules')
      .select('id, schedule_type, next_due_at, site_id, sites(name)')
      .eq('is_active', true)
      .not('next_due_at', 'is', null)
      .gte('next_due_at', `${startDate}T00:00:00`)
      .lte('next_due_at', `${endDate}T23:59:59`)
      .order('next_due_at', { ascending: true })
    pmQ = byOrg(pmQ as any)
    const { data: pmRows } = await pmQ
    for (const pm of pmRows ?? []) {
      const dueIso = pm.next_due_at as string
      const siteName = (pm as any).sites?.name ?? null
      events.push({
        id: pm.id, type: 'pm_schedule',
        title: siteName ? `PM: ${siteName}` : `PM: ${pm.schedule_type ?? 'Maintenance'}`,
        date: dueIso.split('T')[0], status: 'scheduled', color: '#0B7285',
        link: pm.site_id ? `/sites/${pm.site_id}` : '/dispatch',
      })
    }

    // ── CRM / Sales Activities (scoped via their opportunity's org) ────────────
    let scopedOppIds: string[] | null = null
    if (orgIds) {
      const { data: opps } = await supabase.from('opportunities').select('id').in('dealer_org_id', orgIds)
      scopedOppIds = (opps ?? []).map(o => o.id)
    }
    let actQ = supabase
      .from('crm_activities')
      .select('id, type, subject, due_at, completed_at, opportunity_id, opportunities(name)')
      .not('due_at', 'is', null)
      .gte('due_at', `${startDate}T00:00:00`)
      .lte('due_at', `${endDate}T23:59:59`)
      .is('completed_at', null)
      .order('due_at', { ascending: true })
    if (scopedOppIds) actQ = actQ.in('opportunity_id', scopedOppIds.length ? scopedOppIds : [NO_MATCH])
    const { data: activities } = await actQ
    const ACTIVITY_COLORS: Record<string, string> = { call: '#0B7285', email: '#6B7EFF', meeting: '#7C3AED', task: '#F59E0B', note: '#64748B' }
    for (const act of activities ?? []) {
      const dueIso = act.due_at as string
      events.push({
        id: act.id, type: 'crm_activity', title: act.subject ?? 'CRM Activity',
        date: dueIso.split('T')[0],
        time: dueIso.includes('T') ? dueIso.split('T')[1]?.substring(0, 5) : undefined,
        status: 'open', color: ACTIVITY_COLORS[act.type] ?? '#7C3AED',
        link: act.opportunity_id ? `/crm/opportunities/${act.opportunity_id}` : '/crm',
        opportunity_name: (act as any).opportunities?.name ?? undefined,
      })
    }

    // ── Tracker Tasks (scoped by org) ─────────────────────────────────────────
    let trackerQ = supabase
      .from('tracker_items')
      .select('id, title, type, status, priority, due_date, owner_name, org_id')
      .not('due_date', 'is', null)
      .gte('due_date', startDate)
      .lte('due_date', endDate)
      .neq('status', 'done')
      .neq('status', 'wont_fix')
      .order('due_date', { ascending: true })
    trackerQ = byOrg(trackerQ as any)
    const { data: trackerItems } = await trackerQ
    for (const task of trackerItems ?? []) {
      events.push({
        id: task.id, type: 'tracker_task', title: task.title ?? 'Tracker Task',
        date: task.due_date, status: task.status ?? 'new', color: '#8B5CF6', link: '/tracker',
        owner_name: (task as any).owner_name ?? undefined,
      })
    }

    // ── Google Calendar (personal — always the caller's own) ──────────────────
    const { data: settingsRow } = await supabase
      .from('user_settings').select('gcal_refresh_token').eq('user_id', user.id).maybeSingle()
    if (settingsRow?.gcal_refresh_token) {
      const { data: gcalRows } = await supabase
        .from('gcal_events')
        .select('gcal_event_id, title, start_time, end_time, is_all_day, status')
        .eq('user_id', user.id)
        .gte('start_time', `${startDate}T00:00:00`)
        .lte('start_time', `${endDate}T23:59:59`)
        .order('start_time', { ascending: true })
      for (const ge of gcalRows ?? []) {
        const startIso = ge.start_time as string
        events.push({
          id: ge.gcal_event_id, type: 'gcal', title: ge.title ?? '(No title)',
          date: startIso.split('T')[0],
          time: ge.is_all_day ? undefined : startIso.split('T')[1]?.substring(0, 5),
          status: ge.status ?? 'confirmed', color: '#10B981', gcal_event_id: ge.gcal_event_id,
        })
      }
    }

    events.sort((a, b) => {
      const d = a.date.localeCompare(b.date)
      return d !== 0 ? d : (a.time ?? '').localeCompare(b.time ?? '')
    })

    return NextResponse.json({ events, year, month, scope: scopeParam })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg, events: [] }, { status: 500 })
  }
}
