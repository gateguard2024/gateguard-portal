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
  type: 'todo' | 'work_order' | 'gcal'
  title: string
  date: string       // YYYY-MM-DD
  time?: string      // HH:MM if has time
  status: string
  priority?: string
  color: string      // hex
  link?: string      // portal deep link
  gcal_event_id?: string
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
