import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

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
}

function ymd(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function startOfDayIso(date: Date): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function endOfDayIso(date: Date): string {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d.toISOString()
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
    const now = new Date()
    const today = ymd(now)
    const weekEnd = new Date(now)
    weekEnd.setDate(weekEnd.getDate() + 7)
    const weekEndDate = ymd(weekEnd)

    const [calendarRows, overdueTodos, todayTodos, todayWos, todayCrm, todayTracker, settingsRow] = await Promise.all([
      safe(
        supabase
          .from('calendar_events')
          .select('id, title, start_time, end_time, status, org_id')
          .gte('start_time', startOfDayIso(now))
          .lte('start_time', endOfDayIso(now))
          .neq('status', 'cancelled')
          .order('start_time', { ascending: true }),
        [] as Array<Record<string, any>>
      ),
      safe(
        supabase
          .from('todos')
          .select('id, title, due_date, status, priority')
          .lt('due_date', today)
          .in('status', ['open', 'in_progress'])
          .limit(20),
        [] as Array<Record<string, any>>
      ),
      safe(
        supabase
          .from('todos')
          .select('id, title, due_date, status, priority')
          .eq('due_date', today)
          .in('status', ['open', 'in_progress']),
        [] as Array<Record<string, any>>
      ),
      safe(
        supabase
          .from('work_orders')
          .select('id, title, scheduled_date, scheduled_time, status, priority, org_id')
          .eq('scheduled_date', today)
          .in('status', ['open', 'assigned', 'in_progress']),
        [] as Array<Record<string, any>>
      ),
      safe(
        supabase
          .from('crm_activities')
          .select('id, subject, due_at, completed_at, opportunity_id')
          .gte('due_at', startOfDayIso(now))
          .lte('due_at', endOfDayIso(now))
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

    const events: DayEvent[] = [
      ...scopedEvents.map(row => ({
        id: String(row.id),
        type: 'nexus_event',
        title: row.title ?? 'Nexus Event',
        starts_at: row.start_time ?? null,
        date: row.start_time ? String(row.start_time).split('T')[0] : today,
        time: row.start_time ? String(row.start_time).split('T')[1]?.slice(0, 5) : null,
      })),
      ...scopedWos.map(row => ({
        id: String(row.id),
        type: 'work_order',
        title: row.title ?? 'Work Order',
        date: row.scheduled_date ?? today,
        time: row.scheduled_time ?? null,
        link: `/maintenance/${row.id}`,
      })),
      ...todayCrm.map(row => ({
        id: String(row.id),
        type: 'crm_activity',
        title: row.subject ?? 'CRM Follow-Up',
        starts_at: row.due_at ?? null,
        date: row.due_at ? String(row.due_at).split('T')[0] : today,
        time: row.due_at ? String(row.due_at).split('T')[1]?.slice(0, 5) : null,
        link: row.opportunity_id ? `/crm/opportunities/${row.opportunity_id}` : '/crm',
      })),
    ].sort((a, b) => `${a.date ?? ''}T${a.time ?? '00:00'}`.localeCompare(`${b.date ?? ''}T${b.time ?? '00:00'}`))

    const topPool: TopItem[] = [
      ...overdueTodos.map(row => {
        const score = 100 + scorePriority(row.priority)
        return { id: String(row.id), type: 'todo' as const, title: row.title ?? 'Overdue To-Do', reason: 'Overdue', urgency: urgency(score), score, date: row.due_date ?? null, link: '/todos' }
      }),
      ...todayTodos.map(row => {
        const score = 80 + scorePriority(row.priority)
        return { id: String(row.id), type: 'todo' as const, title: row.title ?? 'To-Do due today', reason: 'Due today', urgency: urgency(score), score, date: row.due_date ?? null, link: '/todos' }
      }),
      ...scopedWos.map(row => {
        const score = 75 + scorePriority(row.priority)
        return { id: String(row.id), type: 'work_order' as const, title: row.title ?? 'Work Order', reason: 'Scheduled today', urgency: urgency(score), score, date: row.scheduled_date ?? null, time: row.scheduled_time ?? null, link: `/maintenance/${row.id}` }
      }),
      ...todayCrm.map(row => {
        const score = 70
        return { id: String(row.id), type: 'crm_activity' as const, title: row.subject ?? 'CRM follow-up', reason: 'Follow-up due today', urgency: urgency(score), score, date: row.due_at ? String(row.due_at).split('T')[0] : null, time: row.due_at ? String(row.due_at).split('T')[1]?.slice(0, 5) : null, link: row.opportunity_id ? `/crm/opportunities/${row.opportunity_id}` : '/crm' }
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
        today_total: events.length + todayTodos.length + scopedTracker.length,
        today_todos: todayTodos.length,
        today_work_orders: scopedWos.length,
        today_crm_activities: todayCrm.length,
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
