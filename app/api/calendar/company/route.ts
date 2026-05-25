import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface CompanyCalendarEvent {
  id:         string
  title:      string
  event_type: string
  date:       string   // YYYY-MM-DD
  time?:      string   // HH:MM
  color:      string
  link?:      string
  source:     'l10' | 'work_order' | 'permit' | 'quote' | 'manual'
  isCompany:  true
}

// Generate all Fridays in a given month/year as L10 events
function generateL10Events(year: number, month: number): CompanyCalendarEvent[] {
  const events: CompanyCalendarEvent[] = []
  const daysInMonth = new Date(year, month, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d)
    if (date.getDay() === 5) { // Friday
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      events.push({
        id:         `l10-${dateStr}`,
        title:      'L10 Weekly Meeting',
        event_type: 'l10',
        date:       dateStr,
        time:       '06:00',
        color:      '#6B7EFF',
        link:       '/eos',
        source:     'l10',
        isCompany:  true,
      })
    }
  }
  return events
}

// GET /api/calendar/company?year=2026&month=5
export async function GET(req: NextRequest) {
  try {
    await getCurrentUser()

    const { searchParams } = new URL(req.url)
    const year  = parseInt(searchParams.get('year')  ?? String(new Date().getFullYear()), 10)
    const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1), 10)

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay   = new Date(year, month, 0).getDate()
    const endDate   = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    const events: CompanyCalendarEvent[] = []

    // 1. L10 meetings — every Friday, generated programmatically
    events.push(...generateL10Events(year, month))

    // 2. Manual + auto-generated company calendar events from DB
    const { data: manualEvents } = await supabase
      .from('company_calendar_events')
      .select('id, title, event_type, date, time, notes, link')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })

    for (const ev of manualEvents ?? []) {
      const dateStr = typeof ev.date === 'string' ? ev.date.split('T')[0] : String(ev.date)
      events.push({
        id:         ev.id,
        title:      ev.title,
        event_type: ev.event_type,
        date:       dateStr,
        time:       ev.time ? String(ev.time).substring(0, 5) : undefined,
        color:      '#6B7EFF',
        link:       ev.link ?? undefined,
        source:     'manual',
        isCompany:  true,
      })
    }

    // 3. Work orders scheduled this month
    const { data: wos } = await supabase
      .from('work_orders')
      .select('id, title, scheduled_date, scheduled_time, status')
      .not('scheduled_date', 'is', null)
      .gte('scheduled_date', startDate)
      .lte('scheduled_date', endDate)
      .order('scheduled_date', { ascending: true })

    for (const wo of wos ?? []) {
      events.push({
        id:         `wo-${wo.id}`,
        title:      wo.title ?? 'Work Order',
        event_type: 'work_order',
        date:       wo.scheduled_date,
        time:       wo.scheduled_time ? String(wo.scheduled_time).substring(0, 5) : undefined,
        color:      '#F59E0B',
        link:       `/maintenance/${wo.id}`,
        source:     'work_order',
        isCompany:  true,
      })
    }

    // 4. Permits expiring this month
    const { data: permits } = await supabase
      .from('permits')
      .select('id, permit_type, site_id, expiry_date')
      .not('expiry_date', 'is', null)
      .gte('expiry_date', startDate)
      .lte('expiry_date', endDate)

    for (const p of permits ?? []) {
      const dateStr = typeof p.expiry_date === 'string' ? p.expiry_date.split('T')[0] : String(p.expiry_date)
      events.push({
        id:         `permit-${p.id}`,
        title:      `Permit Expiry: ${p.permit_type ?? 'Permit'}`,
        event_type: 'permit_renewal',
        date:       dateStr,
        color:      '#EF4444',
        link:       '/compliance',
        source:     'permit',
        isCompany:  true,
      })
    }

    // 5. Quotes expiring this month
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
        id:         `quote-${q.id}`,
        title:      `Quote Expiry: ${q.title ?? 'Quote'}`,
        event_type: 'quote_expiry',
        date:       dateStr,
        color:      '#EF4444',
        link:       `/quotes/${q.id}`,
        source:     'quote',
        isCompany:  true,
      })
    }

    // Sort by date then time
    events.sort((a, b) => {
      const dc = a.date.localeCompare(b.date)
      if (dc !== 0) return dc
      return (a.time ?? '').localeCompare(b.time ?? '')
    })

    return NextResponse.json({ events, year, month })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg, events: [] }, { status: 500 })
  }
}

// POST /api/calendar/company
// Body: { title, event_type, date, time?, notes?, link? }
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    const body = await req.json() as {
      title:       string
      event_type:  string
      date:        string
      time?:       string
      notes?:      string
      link?:       string
    }

    if (!body.title || !body.event_type || !body.date) {
      return NextResponse.json({ error: 'title, event_type, and date are required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('company_calendar_events')
      .insert({
        title:      body.title,
        event_type: body.event_type,
        date:       body.date,
        time:       body.time ?? null,
        all_day:    !body.time,
        notes:      body.notes ?? null,
        link:       body.link ?? null,
        org_id:     user.org_id ?? null,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ event: data }, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
