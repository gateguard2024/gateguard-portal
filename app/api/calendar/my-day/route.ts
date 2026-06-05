import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type CalendarSummaryEvent = {
  id: string
  type: 'google' | 'todo' | 'work_order' | 'crm_activity' | 'tracker_task'
  title: string
  starts_at?: string | null
  ends_at?: string | null
  date?: string | null
  time?: string | null
  status?: string | null
  link?: string | null
  duration_minutes?: number | null
}

function ymd(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function endOfDayIso(date: Date): string {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d.toISOString()
}

function startOfDayIso(date: Date): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function minutesBetween(start?: string | null, end?: string | null): number | null {
  if (!start || !end) return null
  const diff = new Date(end).getTime() - new Date(start).getTime()
  if (!Number.isFinite(diff) || diff <= 0) return null
  return Math.round(diff / 60000)
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
    const future = new Date(now)
    future.setDate(future.getDate() + 45)

    const settingsRow = await safe(
      supabase
        .from('user_settings')
        .select('gcal_refresh_token, gcal_last_synced_at')
        .eq('user_id', user.id)
        .maybeSingle(),
      null as { gcal_refresh_token?: string | null; gcal_last_synced_at?: string | null } | null
    )

    const googleConnected = !!settingsRow?.gcal_refresh_token

    const [gcalRows, todayTodos, weekTodos, todayWos, weekWos, todayCrm, weekCrm, todayTracker, weekTracker] = await Promise.all([
      googleConnected
        ? safe(
            supabase
              .from('gcal_events')
              .select('gcal_event_id, title, start_time, end_time, is_all_day, status, html_link')
              .eq('user_id', user.id)
              .gte('start_time', startOfDayIso(now))
              .lte('start_time', future.toISOString())
              .order('start_time', { ascending: true })
              .limit(100),
            [] as Array<Record<string, any>>
          )
        : Promise.resolve([] as Array<Record<string, any>>),
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
          .from('todos')
          .select('id, title, due_date, status, priority')
          .gte('due_date', today)
          .lte('due_date', weekEndDate)
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
          .from('work_orders')
          .select('id, title, scheduled_date, scheduled_time, status, priority, org_id')
          .gte('scheduled_date', today)
          .lte('scheduled_date', weekEndDate)
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
          .from('crm_activities')
          .select('id, subject, due_at, completed_at, opportunity_id')
          .gte('due_at', startOfDayIso(now))
          .lte('due_at', `${weekEndDate}T23:59:59`)
          .is('completed_at', null),
        [] as Array<Record<string, any>>
      ),
      safe(
        supabase
          .from('tracker_items')
          .select('id, title, due_date, status, owner_user_id, org_id')
          .eq('due_date', today)
          .neq('status', 'done')
          .neq('status', 'wont_fix'),
        [] as Array<Record<string, any>>
      ),
      safe(
        supabase
          .from('tracker_items')
          .select('id, title, due_date, status, owner_user_id, org_id')
          .gte('due_date', today)
          .lte('due_date', weekEndDate)
          .neq('status', 'done')
          .neq('status', 'wont_fix'),
        [] as Array<Record<string, any>>
      ),
    ])

    const scopedTodayWos = user.isCorporate ? todayWos : todayWos.filter(row => row.org_id === user.org_id)
    const scopedWeekWos = user.isCorporate ? weekWos : weekWos.filter(row => row.org_id === user.org_id)
    const scopedTodayTracker = user.isCorporate
      ? todayTracker
      : todayTracker.filter(row => row.owner_user_id === user.id || row.org_id === user.org_id)
    const scopedWeekTracker = user.isCorporate
      ? weekTracker
      : weekTracker.filter(row => row.owner_user_id === user.id || row.org_id === user.org_id)

    const googleEvents: CalendarSummaryEvent[] = gcalRows.map(row => ({
      id: String(row.gcal_event_id),
      type: 'google',
      title: row.title ?? '(No title)',
      starts_at: row.start_time ?? null,
      ends_at: row.end_time ?? null,
      date: row.start_time ? String(row.start_time).split('T')[0] : null,
      time: row.is_all_day ? null : String(row.start_time ?? '').split('T')[1]?.slice(0, 5) ?? null,
      status: row.status ?? 'confirmed',
      link: row.html_link ?? null,
      duration_minutes: minutesBetween(row.start_time, row.end_time),
    }))

    const portalEvents: CalendarSummaryEvent[] = [
      ...todayTodos.map(row => ({
        id: String(row.id), type: 'todo' as const, title: row.title ?? 'To-Do', date: row.due_date, status: row.status, link: '/todos', duration_minutes: null,
      })),
      ...scopedTodayWos.map(row => ({
        id: String(row.id), type: 'work_order' as const, title: row.title ?? 'Work Order', date: row.scheduled_date, time: row.scheduled_time ?? null, status: row.status, link: `/maintenance/${row.id}`, duration_minutes: null,
      })),
      ...todayCrm.map(row => ({
        id: String(row.id), type: 'crm_activity' as const, title: row.subject ?? 'CRM Activity', starts_at: row.due_at, date: row.due_at ? String(row.due_at).split('T')[0] : null, time: row.due_at ? String(row.due_at).split('T')[1]?.slice(0, 5) : null, status: 'open', link: row.opportunity_id ? `/crm/opportunities/${row.opportunity_id}` : '/crm', duration_minutes: null,
      })),
      ...scopedTodayTracker.map(row => ({
        id: String(row.id), type: 'tracker_task' as const, title: row.title ?? 'Tracker Task', date: row.due_date, status: row.status, link: '/tracker', duration_minutes: null,
      })),
    ]

    const todayGoogle = googleEvents.filter(event => event.date === today)
    const upcoming = [...googleEvents, ...portalEvents]
      .filter(event => {
        const eventDate = event.starts_at ? new Date(event.starts_at) : event.date ? new Date(`${event.date}T00:00:00`) : null
        return eventDate ? eventDate.getTime() >= startOfDayIso(now) as unknown as number : false
      })
      .sort((a, b) => (a.starts_at ?? `${a.date ?? ''}T${a.time ?? '00:00'}`).localeCompare(b.starts_at ?? `${b.date ?? ''}T${b.time ?? '00:00'}`))
      .slice(0, 12)

    const nextFourHourAppointment = googleEvents.find(event => {
      if (!event.starts_at || !event.duration_minutes) return false
      return new Date(event.starts_at).getTime() >= now.getTime() && event.duration_minutes >= 240
    }) ?? null

    return NextResponse.json({
      success: true,
      date: today,
      week_end: weekEndDate,
      google_calendar: {
        available: true,
        connected: googleConnected,
        last_synced_at: settingsRow?.gcal_last_synced_at ?? null,
        connect_url: '/api/calendar/google/connect',
        sync_url: '/api/calendar/google/sync',
      },
      connectors: {
        google_calendar: 'available',
        microsoft_outlook: 'future',
        gmail_mailbox: 'future',
        other_mail_servers: 'future',
      },
      counts: {
        today_total: todayGoogle.length + portalEvents.length,
        today_google: todayGoogle.length,
        today_todos: todayTodos.length,
        today_work_orders: scopedTodayWos.length,
        today_crm_activities: todayCrm.length,
        today_tracker_tasks: scopedTodayTracker.length,
        week_total: weekTodos.length + scopedWeekWos.length + weekCrm.length + scopedWeekTracker.length + googleEvents.filter(e => e.date && e.date >= today && e.date <= weekEndDate).length,
      },
      today: {
        events: [...todayGoogle, ...portalEvents]
          .sort((a, b) => (a.starts_at ?? `${a.date ?? ''}T${a.time ?? '00:00'}`).localeCompare(b.starts_at ?? `${b.date ?? ''}T${b.time ?? '00:00'}`)),
      },
      upcoming,
      next_four_hour_appointment: nextFourHourAppointment,
      next_best_actions: [
        googleConnected ? 'Sync Google Calendar before planning the day.' : 'Connect Google Calendar so Nexus can see your appointments.',
        'Use Day view to work today.',
        'Use Week view to plan installs, follow-ups, and long appointments.',
      ],
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Could not load My Day.',
    }, { status: 500 })
  }
}
