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
  type: 'todo' | 'work_order' | 'gcal' | 'company' | 'meeting'
  title: string
  date: string       // YYYY-MM-DD
  time?: string      // HH:MM if has time
  status: string
  priority?: string
  color: string      // hex
  link?: string      // portal deep link
  gcal_event_id?: string
  source: string     // calendar source id: my_todos | my_workorders | all_installs | all_service | company | sales_meetings | permit | quote
  isCompany?: boolean
  assignee?: string
  site_name?: string
}

// Generate L10 Friday events for a given month
function generateL10Events(year: number, month: number, startDate: string, endDate: string): CalendarEvent[] {
  const events: CalendarEvent[] = []
  const daysInMonth = new Date(year, month, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d)
    if (date.getDay() === 5) {
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
          source:    'company',
          isCompany: true,
        })
      }
    }
  }
  return events
}

// GET /api/calendar/events?year=2026&month=5&sources=my_todos,my_workorders,all_installs,all_service,company,sales_meetings
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    const { searchParams } = new URL(req.url)
    const year  = parseInt(searchParams.get('year')  ?? String(new Date().getFullYear()), 10)
    const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1), 10)
    const sourcesParam = searchParams.get('sources')

    const activeSources = sourcesParam
      ? new Set(sourcesParam.split(',').map((s) => s.trim()))
      : new Set(['my_todos', 'my_workorders', 'all_installs', 'all_service', 'company', 'sales_meetings'])

    const show = (src: string) => activeSources.has(src)

    // Date range
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay   = new Date(year, month, 0).getDate()
    const endDate   = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    const events: CalendarEvent[] = []

    // ── My To-Dos ─────────────────────────────────────────────────────────────
    if (show('my_todos')) {
      const { data: todos } = await supabase
        .from('todos')
        .select('id, title, due_date, status, priority')
        .not('due_date', 'is', null)
        .gte('due_date', startDate)
        .lte('due_date', endDate)
        .order('due_date', { ascending: true })

      for (const t of todos ?? []) {
        events.push({
          id:       t.id,
          type:     'todo',
          title:    t.title ?? 'Untitled To-Do',
          date:     t.due_date,
          status:   t.status ?? 'open',
          priority: t.priority ?? 'medium',
          color:    '#6B7EFF',
          link:     '/todos',
          source:   'my_todos',
        })
      }
    }

    // ── My Work Orders (assigned to current user) ─────────────────────────────
    if (show('my_workorders')) {
      let q = supabase
        .from('work_orders')
        .select('id, title, scheduled_date, scheduled_time, status, priority, job_type, assignee_name')
        .not('scheduled_date', 'is', null)
        .gte('scheduled_date', startDate)
        .lte('scheduled_date', endDate)
        .order('scheduled_date', { ascending: true })

      // scope to current user's name / org
      if (user.name) {
        q = q.ilike('assignee_name', `%${user.name}%`)
      } else if (user.org_id) {
        q = q.eq('org_id', user.org_id)
      }

      const { data: wos } = await q
      for (const wo of wos ?? []) {
        const jt = (wo.job_type ?? '').toLowerCase()
        const isInstall = jt.includes('install') || jt.includes('commission')
        events.push({
          id:       wo.id,
          type:     'work_order',
          title:    wo.title ?? 'Work Order',
          date:     wo.scheduled_date,
          time:     wo.scheduled_time ?? undefined,
          status:   wo.status ?? 'open',
          color:    isInstall ? '#8B5CF6' : '#F59E0B',
          link:     `/maintenance/${wo.id}`,
          source:   'my_workorders',
          assignee: wo.assignee_name ?? undefined,
        })
      }
    }

    // ── All Installs (org-wide, admin/corporate) ──────────────────────────────
    if (show('all_installs')) {
      let q = supabase
        .from('work_orders')
        .select('id, title, scheduled_date, scheduled_time, status, priority, job_type, assignee_name, customer_name')
        .not('scheduled_date', 'is', null)
        .gte('scheduled_date', startDate)
        .lte('scheduled_date', endDate)
        .order('scheduled_date', { ascending: true })

      if (!user.isCorporate && user.org_id) {
        q = q.eq('org_id', user.org_id)
      }

      const { data: wos } = await q
      for (const wo of wos ?? []) {
        const jt = (wo.job_type ?? '').toLowerCase()
        if (!jt.includes('install') && !jt.includes('commission') && !jt.includes('new install')) continue
        events.push({
          id:       `install-${wo.id}`,
          type:     'work_order',
          title:    wo.title ?? 'Installation',
          date:     wo.scheduled_date,
          time:     wo.scheduled_time ?? undefined,
          status:   wo.status ?? 'open',
          color:    '#8B5CF6',
          link:     `/maintenance/${wo.id}`,
          source:   'all_installs',
          assignee: wo.assignee_name ?? undefined,
        })
      }
    }

    // ── All Service Calls (org-wide, admin/corporate) ─────────────────────────
    if (show('all_service')) {
      let q = supabase
        .from('work_orders')
        .select('id, title, scheduled_date, scheduled_time, status, priority, job_type, assignee_name, customer_name')
        .not('scheduled_date', 'is', null)
        .gte('scheduled_date', startDate)
        .lte('scheduled_date', endDate)
        .order('scheduled_date', { ascending: true })

      if (!user.isCorporate && user.org_id) {
        q = q.eq('org_id', user.org_id)
      }

      const { data: wos } = await q
      for (const wo of wos ?? []) {
        const jt = (wo.job_type ?? '').toLowerCase()
        if (jt.includes('install') || jt.includes('commission')) continue // skip installs
        events.push({
          id:       `svc-${wo.id}`,
          type:     'work_order',
          title:    wo.title ?? 'Service Call',
          date:     wo.scheduled_date,
          time:     wo.scheduled_time ?? undefined,
          status:   wo.status ?? 'open',
          color:    '#F59E0B',
          link:     `/maintenance/${wo.id}`,
          source:   'all_service',
          assignee: wo.assignee_name ?? undefined,
        })
      }
    }

    // ── Sales Meetings ────────────────────────────────────────────────────────
    if (show('sales_meetings')) {
      try {
        const { data: meetings } = await supabase
          .from('crm_activities')
          .select('id, title, activity_type, activity_date, notes, contact_name')
          .eq('activity_type', 'meeting')
          .not('activity_date', 'is', null)
          .gte('activity_date', startDate)
          .lte('activity_date', endDate)
          .order('activity_date', { ascending: true })

        for (const m of meetings ?? []) {
          const dateStr = typeof m.activity_date === 'string'
            ? m.activity_date.split('T')[0]
            : String(m.activity_date)
          events.push({
            id:       `meeting-${m.id}`,
            type:     'meeting',
            title:    m.title ?? (m.contact_name ? `Meeting: ${m.contact_name}` : 'Sales Meeting'),
            date:     dateStr,
            status:   'scheduled',
            color:    '#10B981',
            link:     '/crm',
            source:   'sales_meetings',
          })
        }
      } catch { /* table may not exist yet */ }
    }

    // ── Company / GateGuard Events ────────────────────────────────────────────
    if (show('company')) {
      // L10 meetings every Friday
      events.push(...generateL10Events(year, month, startDate, endDate))

      // Manual company events
      try {
        const { data: ces } = await supabase
          .from('company_calendar_events')
          .select('id, title, event_type, date, time, link')
          .gte('date', startDate)
          .lte('date', endDate)

        for (const ce of ces ?? []) {
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
            source:    'company',
            isCompany: true,
          })
        }
      } catch { /* table may not exist yet */ }

      // Permit expiries
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
            source:    'company',
            isCompany: true,
          })
        }
      } catch { /* non-blocking */ }

      // Quote expiries
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
            source:    'company',
            isCompany: true,
          })
        }
      } catch { /* non-blocking */ }
    }

    // ── Google Calendar events ────────────────────────────────────────────────
    if (show('google_calendar')) {
      try {
        const startTs = new Date(startDate).toISOString()
        const endTs   = new Date(`${endDate}T23:59:59`).toISOString()

        const { data: gcalRows } = await supabase
          .from('gcal_events')
          .select('id, gcal_event_id, title, start_time, end_time, is_all_day, status, description, location, html_link')
          .eq('user_id', user.id)
          .gte('start_time', startTs)
          .lte('start_time', endTs)
          .order('start_time', { ascending: true })

        for (const ev of gcalRows ?? []) {
          const startDt  = new Date(ev.start_time)
          const dateStr  = startDt.toISOString().split('T')[0]
          // Convert UTC time to local time string for display
          const timeStr  = ev.is_all_day
            ? undefined
            : `${String(startDt.getHours()).padStart(2, '0')}:${String(startDt.getMinutes()).padStart(2, '0')}`
          events.push({
            id:           `gcal-${ev.gcal_event_id ?? ev.id}`,
            type:         'gcal',
            title:        ev.title ?? '(No title)',
            date:         dateStr,
            time:         timeStr,
            status:       ev.status ?? 'confirmed',
            color:        '#4285F4',
            link:         ev.html_link ?? undefined,
            source:       'google_calendar',
            gcal_event_id: ev.gcal_event_id ?? undefined,
          })
        }
      } catch { /* gcal_events table may not exist yet */ }
    }

    // Deduplicate by id (my_workorders + all_installs/all_service can overlap)
    const seen = new Set<string>()
    const deduped = events.filter((e) => {
      const key = e.id
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    deduped.sort((a, b) => {
      const dc = a.date.localeCompare(b.date)
      if (dc !== 0) return dc
      return (a.time ?? '').localeCompare(b.time ?? '')
    })

    return NextResponse.json({ events: deduped, year, month })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg, events: [] }, { status: 500 })
  }
}
