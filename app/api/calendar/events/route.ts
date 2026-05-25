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
  type: 'todo' | 'work_order' | 'gcal' | 'company'
  title: string
  date: string       // YYYY-MM-DD
  time?: string      // HH:MM if has time
  status: string
  priority?: string
  color: string      // hex
  link?: string      // portal deep link
  gcal_event_id?: string
  // Company-event markers
  source?: string
  isCompany?: boolean
}

// Generate L10 Friday events for a given month (inline, avoids internal fetch)
function generateL10Events(year: number, month: number, startDate: string, endDate: string): CalendarEvent[] {
  const events: CalendarEvent[] = []
  const daysInMonth = new Date(year, month, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d)
    if (date.getDay() === 5) { // Friday
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      if (dateStr >= startDate && dateStr <= endDate) {
        events.push({
          id:        `l10-${dateStr}`,
          type:      'company',
          title:     'L10 Weekly Meeting',
          date:      dateStr,
          time:      '06:00',
          status:    'scheduled',
          color:     '#6B7EFF',
          link:      '/eos',
          source:    'l10',
          isCompany: true,
        })
      }
    }
  }
  return events
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

    // ── Google Calendar events (if token stored) ──────────────────────────────
    const hasGCal = !!(process.env.GOOGLE_CALENDAR_CLIENT_ID && process.env.GOOGLE_CALENDAR_CLIENT_SECRET)
    if (hasGCal) {
      const { data: tokenRow } = await supabase
        .from('user_settings')
        .select('value')
        .eq('user_id', user.id)
        .eq('key', 'google_calendar_refresh_token')
        .single()

      if (tokenRow?.value) {
        // Fetch cached gcal events for this month
        const { data: gcalRows } = await supabase
          .from('gcal_events')
          .select('gcal_event_id, title, start_date, start_time, end_date, status')
          .eq('user_id', user.id)
          .gte('start_date', startDate)
          .lte('start_date', endDate)

        for (const ge of gcalRows ?? []) {
          events.push({
            id:            ge.gcal_event_id,
            type:          'gcal',
            title:         ge.title ?? '(No title)',
            date:          ge.start_date,
            time:          ge.start_time ?? undefined,
            status:        ge.status ?? 'confirmed',
            color:         '#10B981',
            gcal_event_id: ge.gcal_event_id,
          })
        }
      }
    }

    // ── Company / GateGuard events ────────────────────────────────────────────
    // L10 meetings (every Friday)
    events.push(...generateL10Events(year, month, startDate, endDate))

    // Manual company calendar events from DB (table created in migration 082)
    try {
      const { data: companyEvents } = await supabase
        .from('company_calendar_events')
        .select('id, title, event_type, date, time, link')
        .gte('date', startDate)
        .lte('date', endDate)

      for (const ce of companyEvents ?? []) {
        const dateStr = typeof ce.date === 'string' ? ce.date.split('T')[0] : String(ce.date)
        events.push({
          id:        ce.id,
          type:      'company',
          title:     ce.title,
          date:      dateStr,
          time:      ce.time ? String(ce.time).substring(0, 5) : undefined,
          status:    'scheduled',
          color:     '#6B7EFF',
          link:      ce.link ?? undefined,
          source:    ce.event_type,
          isCompany: true,
        })
      }
    } catch {
      // table may not exist yet on older Supabase projects — fail silently
    }

    // Permits expiring this month
    try {
      const { data: permits } = await supabase
        .from('permits')
        .select('id, permit_type, expiry_date')
        .not('expiry_date', 'is', null)
        .gte('expiry_date', startDate)
        .lte('expiry_date', endDate)

      for (const p of permits ?? []) {
        const dateStr = typeof p.expiry_date === 'string' ? p.expiry_date.split('T')[0] : String(p.expiry_date)
        events.push({
          id:        `permit-${p.id}`,
          type:      'company',
          title:     `Permit Expiry: ${p.permit_type ?? 'Permit'}`,
          date:      dateStr,
          status:    'expiring',
          color:     '#EF4444',
          link:      '/compliance',
          source:    'permit',
          isCompany: true,
        })
      }
    } catch { /* non-blocking */ }

    // Quotes expiring this month
    try {
      const { data: quotes } = await supabase
        .from('quotes')
        .select('id, title, expiry_date, status')
        .not('expiry_date', 'is', null)
        .gte('expiry_date', startDate)
        .lte('expiry_date', endDate)
        .in('status', ['sent', 'viewed'])

      for (const q of quotes ?? []) {
        const dateStr = typeof q.expiry_date === 'string' ? q.expiry_date.split('T')[0] : String(q.expiry_date)
        events.push({
          id:        `quote-${q.id}`,
          type:      'company',
          title:     `Quote Expiry: ${q.title ?? 'Quote'}`,
          date:      dateStr,
          status:    'expiring',
          color:     '#EF4444',
          link:      `/quotes/${q.id}`,
          source:    'quote',
          isCompany: true,
        })
      }
    } catch { /* non-blocking */ }

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
