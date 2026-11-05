import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { addDaysISO, etDateOf, etMidnight, etTimeOf, todayET } from '@/lib/tz'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type TopItem = {
  id: string
  type: 'todo' | 'work_order' | 'crm_activity' | 'tracker_task'
  title: string
  reason: string
  urgency: 'high' | 'medium' | 'low'
  score: number
  date?: string | null
  time?: string | null
  link?: string | null
}

type DayEvent = {
  id: string
  type: string
  title: string
  date?: string | null
  time?: string | null
  starts_at?: string | null
  link?: string | null
  overdue?: boolean
  reason?: string | null
}

function scorePriority(priority?: string | null): number {
  const value = String(priority ?? '').toLowerCase()
  if (value === 'urgent') return 25
  if (value === 'high') return 18
  if (value === 'medium') return 8
  return 0
}

function urgency(score: number): 'high' | 'medium' | 'low' {
  if (score >= 85) return 'high'
  if (score >= 55) return 'medium'
  return 'low'
}

async function safe<T>(promise: PromiseLike<{ data: T | null; error: unknown }>, fallback: T): Promise<T> {
  try {
    const { data, error } = await promise
    if (error || !data) return fallback
    return data
  } catch {
    return fallback
  }
}

export async function GET() {
  try {
    const user = await getCurrentUser()
    // "Today" is the Eastern-time day (the server runs in UTC — after 7–8pm ET that used to be tomorrow).
    const today = todayET()
    const weekEndDate = addDaysISO(today, 7)
    const dayStart = etMidnight(today).toISOString()
    const dayEnd = etMidnight(addDaysISO(today, 1)).toISOString()

    const [calendarRows, overdueTodos, todayTodos, todayWos, todayCrm, todayTracker, settingsRow] = await Promise.all([
      safe(
        supabase
          .from('calendar_events')
          .select('id, title, start_time, end_time, status, org_id')
          .gte('start_time', dayStart)
          .lt('start_time', dayEnd)
          .neq('status', 'cancelled')
          .order('start_time', { ascending: true }),
        [] as Array<Record<string, any>>
      ),
      safe(
        supabase
          .from('todos')
          .select('id, title, due_date, status, priority, created_by, assigned_to')
          .lt('due_date', today)
          .in('status', ['open', 'in_progress'])
          .or(`created_by.eq.${user.id},assigned_to.eq.${user.id}`)
          .limit(20),
        [] as Array<Record<string, any>>
      ),
      safe(
        supabase
          .from('todos')
          .select('id, title, due_date, status, priority, created_by, assigned_to')
          .eq('due_date', today)
          .in('status', ['open', 'in_progress'])
          .or(`created_by.eq.${user.id},assigned_to.eq.${user.id}`),
        [] as Array<Record<string, any>>
      ),
      safe(
        supabase
          .from('work_orders')
          .select('id, title, scheduled_date, scheduled_time, status, priority, org_id')
          .eq('scheduled_date', today)
          .in('status', ['open', 'assigned', 'scheduled', 'in_progress']),
        [] as Array<Record<string, any>>
      ),
      safe(
        supabase
          .from('crm_activities')
          .select('id, subject, due_at, completed_at, opportunity_id, dealer_org_id')
          .gte('due_at', dayStart)
          .lt('due_at', dayEnd)
          .is('completed_at', null),
        [] as Array<Record<string, any>>
      ),
      safe(
        supabase
          .from('tracker_items')
          .select('id, title, due_date, status, priority, owner_user_id, org_id')
          .eq('due_date', today)
          .neq('status', 'done')
          .neq('status', 'wont_fix'),
        [] as Array<Record<string, any>>
      ),
      safe(
        supabase
          .from('user_settings')
          .select('gcal_refresh_token')
          .eq('user_id', user.id)
          .maybeSingle(),
        null as { gcal_refresh_token?: string | null } | null
      ),
    ])

    const scopedEvents = user.isCorporate ? calendarRows : calendarRows.filter(row => !row.org_id || row.org_id === user.org_id)
    const scopedWos = user.isCorporate ? todayWos : todayWos.filter(row => row.org_id === user.org_id)
    const scopedTracker = user.isCorporate
      ? todayTracker
      : todayTracker.filter(row => row.owner_user_id === user.id || row.org_id === user.org_id)

    // To-dos are personal for everyone — corporate included (it used to show the whole company's
    // overdue to-dos here). CRM follow-ups by dealer org (service-role bypasses RLS).
    const scopeTodo = (rows: Array<Record<string, any>>) => rows.filter(r => r.created_by === user.id || r.assigned_to === user.id)
    const scopedOverdue = scopeTodo(overdueTodos)
    const scopedTodayTodos = scopeTodo(todayTodos)
    const scopedCrm = user.isCorporate ? todayCrm : todayCrm.filter(r => r.dealer_org_id === user.org_id)

    const events: DayEvent[] = [
      ...scopedEvents.map(row => ({
        id: String(row.id),
        type: 'nexus_event',
        title: row.title ?? 'Nexus Event',
        starts_at: row.start_time ?? null,
        date: row.start_time ? etDateOf(row.start_time) : today,
        time: row.start_time ? etTimeOf(row.start_time) : null,
      })),
      ...scopedWos.map(row => ({
        id: String(row.id),
        type: 'work_order',
        title: row.title ?? 'Work Order',
        date: row.scheduled_date ?? today,
        time: row.scheduled_time ?? null,
        link: `/maintenance/${row.id}`,
      })),
      ...scopedCrm.map(row => ({
        id: String(row.id),
        type: 'crm_activity',
        title: row.subject ?? 'CRM Follow-Up',
        starts_at: row.due_at ?? null,
        date: row.due_at ? etDateOf(row.due_at) : today,
        time: row.due_at ? etTimeOf(row.due_at) : null,
        link: row.opportunity_id ? `/crm/opportunities/${row.opportunity_id}` : '/crm',
      })),
      // Overdue to-dos are NOT on today's schedule (the calendar doesn't show them either) —
      // they stay in Top 10 and the Tasks card ("Now").
    ].sort((a, b) => `${a.date ?? ''}T${a.time ?? '00:00'}`.localeCompare(`${b.date ?? ''}T${b.time ?? '00:00'}`))

    const topPool: TopItem[] = [
      ...scopedOverdue.map(row => {
        const score = 100 + scorePriority(row.priority)
        return { id: String(row.id), type: 'todo' as const, title: row.title ?? 'Overdue To-Do', reason: 'Overdue', urgency: urgency(score), score, date: row.due_date ?? null, link: '/todos' }
      }),
      ...scopedTodayTodos.map(row => {
        const score = 80 + scorePriority(row.priority)
        return { id: String(row.id), type: 'todo' as const, title: row.title ?? 'To-Do due today', reason: 'Due today', urgency: urgency(score), score, date: row.due_date ?? null, link: '/todos' }
      }),
      ...scopedWos.map(row => {
        const score = 75 + scorePriority(row.priority)
        return { id: String(row.id), type: 'work_order' as const, title: row.title ?? 'Work Order', reason: 'Scheduled today', urgency: urgency(score), score, date: row.scheduled_date ?? null, time: row.scheduled_time ?? null, link: `/maintenance/${row.id}` }
      }),
      ...scopedCrm.map(row => {
        const score = 70
        return { id: String(row.id), type: 'crm_activity' as const, title: row.subject ?? 'CRM follow-up', reason: 'Follow-up due today', urgency: urgency(score), score, date: row.due_at ? etDateOf(row.due_at) : null, time: row.due_at ? etTimeOf(row.due_at) : null, link: row.opportunity_id ? `/crm/opportunities/${row.opportunity_id}` : '/crm' }
      }),
      ...scopedTracker.map(row => {
        const score = 65 + scorePriority(row.priority)
        return { id: String(row.id), type: 'tracker_task' as const, title: row.title ?? 'Tracker task', reason: 'Task due today', urgency: urgency(score), score, date: row.due_date ?? null, link: '/tracker' }
      }),
    ]

    const top10 = topPool.sort((a, b) => b.score - a.score).slice(0, 10)

    return NextResponse.json({
      success: true,
      date: today,
      week_end: weekEndDate,
      google_calendar: {
        available: true,
        connected: !!settingsRow?.gcal_refresh_token,
      },
      counts: {
        today_total: events.length + scopedTodayTodos.length + scopedTracker.length,
        today_todos: scopedTodayTodos.length,
        today_work_orders: scopedWos.length,
        today_crm_activities: scopedCrm.length,
        today_tracker_tasks: scopedTracker.length,
        week_total: top10.length,
      },
      today: { events },
      top_10: top10,
      next_best_actions: top10.length > 0 ? [`Start with: ${top10[0].title}`] : ['Add one thing to handle today.'],
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Could not load My Day.',
    }, { status: 500 })
  }
}
