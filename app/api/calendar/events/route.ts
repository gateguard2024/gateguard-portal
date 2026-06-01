import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface CalendarEvent {
  id: string
  type: 'todo' | 'work_order' | 'work_order_phase' | 'pm_schedule' | 'gcal' | 'crm_activity' | 'tracker_task'
  title: string
  date: string       // YYYY-MM-DD
  time?: string      // HH:MM if has time
  status: string
  priority?: string
  color: string      // hex
  link?: string      // portal deep link
  gcal_event_id?: string
  opportunity_name?: string
}

// GET /api/calendar/events?year=2026&month=5
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    const { searchParams } = new URL(req.url)
    const year  = parseInt(searchParams.get('year')  ?? String(new Date().getFullYear()), 10)
    const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1), 10)

    // Build date range: first and last day of the month
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay   = new Date(year, month, 0).getDate()
    const endDate   = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    const events: CalendarEvent[] = []

    // ── To-Dos ────────────────────────────────────────────────────────────────
    const { data: todos } = await supabase
      .from('todos')
      .select('id, title, due_date, status, priority')
      .not('due_date', 'is', null)
      .gte('due_date', startDate)
      .lte('due_date', endDate)
      .order('due_date', { ascending: true })

    for (const todo of todos ?? []) {
      events.push({
        id:       todo.id,
        type:     'todo',
        title:    todo.title ?? 'Untitled To-Do',
        date:     todo.due_date,
        status:   todo.status ?? 'open',
        priority: todo.priority ?? 'medium',
        color:    '#6B7EFF',
        link:     '/todos',
      })
    }

    // ── Work Orders ───────────────────────────────────────────────────────────
    let woQuery = supabase
      .from('work_orders')
      .select('id, title, scheduled_date, scheduled_time, status, priority, site_id')
      .not('scheduled_date', 'is', null)
      .gte('scheduled_date', startDate)
      .lte('scheduled_date', endDate)
      .order('scheduled_date', { ascending: true })

    // Scope: non-corporate users only see their own org's WOs
    if (!user.isCorporate && user.org_id) {
      woQuery = woQuery.eq('org_id', user.org_id)
    }

    const { data: wos } = await woQuery

    for (const wo of wos ?? []) {
      events.push({
        id:     wo.id,
        type:   'work_order',
        title:  wo.title ?? 'Work Order',
        date:   wo.scheduled_date,
        time:   wo.scheduled_time ?? undefined,
        status: wo.status ?? 'open',
        color:  '#F59E0B',
        link:   `/maintenance/${wo.id}`,
      })
    }

    // ── Work Order Phases ─────────────────────────────────────────────────────
    const { data: woPhases } = await supabase
      .from('work_order_phases')
      .select('id, name, scheduled_date, work_order_id, work_orders(title)')
      .not('scheduled_date', 'is', null)
      .gte('scheduled_date', startDate)
      .lte('scheduled_date', endDate)
      .order('scheduled_date', { ascending: true })

    for (const phase of woPhases ?? []) {
      events.push({
        id:     phase.id,
        type:   'work_order_phase',
        title:  phase.name ?? 'Work Order Phase',
        date:   phase.scheduled_date,
        status: 'scheduled',
        color:  '#C2410C',   // orange-700 — distinct from WO orange-600
        link:   phase.work_order_id ? `/maintenance/${phase.work_order_id}` : '/maintenance',
      })
    }

    // ── PM Schedules ──────────────────────────────────────────────────────────
    const { data: pmRows } = await supabase
      .from('pm_schedules')
      .select('id, schedule_type, next_due_at, site_id, sites(name)')
      .eq('is_active', true)
      .not('next_due_at', 'is', null)
      .gte('next_due_at', `${startDate}T00:00:00`)
      .lte('next_due_at', `${endDate}T23:59:59`)
      .order('next_due_at', { ascending: true })

    for (const pm of pmRows ?? []) {
      const dueIso  = pm.next_due_at as string
      const dateStr = dueIso.split('T')[0]
      const siteName = (pm as any).sites?.name ?? null

      events.push({
        id:     pm.id,
        type:   'pm_schedule',
        title:  siteName ? `PM: ${siteName}` : `PM: ${pm.schedule_type ?? 'Maintenance'}`,
        date:   dateStr,
        status: 'scheduled',
        color:  '#0B7285',   // teal
        link:   pm.site_id ? `/sites/${pm.site_id}` : '/dispatch',
      })
    }

    // ── CRM Activities ────────────────────────────────────────────────────────
    // due_at is a timestamptz — filter by the month range
    const { data: activities } = await supabase
      .from('crm_activities')
      .select('id, type, subject, due_at, completed_at, opportunity_id, opportunities(name)')
      .not('due_at', 'is', null)
      .gte('due_at', `${startDate}T00:00:00`)
      .lte('due_at', `${endDate}T23:59:59`)
      .is('completed_at', null)          // only incomplete activities
      .order('due_at', { ascending: true })

    // Activity type → colour mapping
    const ACTIVITY_COLORS: Record<string, string> = {
      call:    '#0B7285',
      email:   '#6B7EFF',
      meeting: '#7C3AED',
      task:    '#F59E0B',
      note:    '#64748B',
    }

    for (const act of activities ?? []) {
      const dueIso  = act.due_at as string
      const dateStr = dueIso.split('T')[0]
      const timePart = dueIso.includes('T') ? dueIso.split('T')[1]?.substring(0, 5) : undefined
      const oppName  = (act as any).opportunities?.name ?? null

      events.push({
        id:               act.id,
        type:             'crm_activity',
        title:            act.subject ?? 'CRM Activity',
        date:             dateStr,
        time:             timePart,
        status:           'open',
        color:            ACTIVITY_COLORS[act.type] ?? '#7C3AED',
        link:             act.opportunity_id ? `/crm/opportunities/${act.opportunity_id}` : '/crm',
        opportunity_name: oppName,
      })
    }

    // ── Tracker Tasks (items with due dates) ─────────────────────────────────
    // Pull tracker items assigned to the current user OR in their org
    const trackerQuery = supabase
      .from('tracker_items')
      .select('id, title, type, status, priority, due_date, owner_user_id, owner_name, group_id, org_id')
      .not('due_date', 'is', null)
      .gte('due_date', startDate)
      .lte('due_date', endDate)
      .neq('status', 'done')
      .neq('status', 'wont_fix')
      .order('due_date', { ascending: true })

    const { data: trackerItems } = await trackerQuery

    for (const task of trackerItems ?? []) {
      // Show if assigned to current user OR if org_id matches (for org-scoped boards)
      const isAssignedToMe = task.owner_user_id === user.id
      const isInMyOrg      = !user.isCorporate ? task.org_id === user.org_id : true

      if (!isAssignedToMe && !isInMyOrg) continue

      events.push({
        id:     task.id,
        type:   'tracker_task',
        title:  task.title ?? 'Tracker Task',
        date:   task.due_date,
        status: task.status ?? 'new',
        color:  '#8B5CF6',   // violet — distinct from other event types
        link:   '/tracker',
      })
    }

    // ── Google Calendar events (pulled from gcal_events cache) ───────────────
    // Check connection via the structured user_settings row (not KV)
    const { data: settingsRow } = await supabase
      .from('user_settings')
      .select('gcal_refresh_token')
      .eq('user_id', user.id)
      .maybeSingle()

    if (settingsRow?.gcal_refresh_token) {
      // gcal_events uses start_time as a timestamptz column — filter by day range
      const { data: gcalRows } = await supabase
        .from('gcal_events')
        .select('gcal_event_id, title, start_time, end_time, is_all_day, status')
        .eq('user_id', user.id)
        .gte('start_time', `${startDate}T00:00:00`)
        .lte('start_time', `${endDate}T23:59:59`)
        .order('start_time', { ascending: true })

      for (const ge of gcalRows ?? []) {
        // Extract YYYY-MM-DD and HH:MM from the timestamptz
        const startIso  = ge.start_time as string
        const dateStr   = startIso.split('T')[0]
        const timePart  = ge.is_all_day ? undefined : startIso.split('T')[1]?.substring(0, 5)

        events.push({
          id:            ge.gcal_event_id,
          type:          'gcal',
          title:         ge.title ?? '(No title)',
          date:          dateStr,
          time:          timePart,
          status:        ge.status ?? 'confirmed',
          color:         '#10B981',
          gcal_event_id: ge.gcal_event_id,
        })
      }
    }

    // Sort all events by date then time
    events.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date)
      if (dateCompare !== 0) return dateCompare
      return (a.time ?? '').localeCompare(b.time ?? '')
    })

    return NextResponse.json({ events, year, month })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg, events: [] }, { status: 500 })
  }
}
