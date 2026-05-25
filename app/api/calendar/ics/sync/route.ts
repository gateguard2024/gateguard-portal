import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Lightweight ICS parser ─────────────────────────────────────────────────────
interface IcsEvent {
  uid: string
  summary: string
  dtstart: Date | null
  dtend:   Date | null
  allDay:  boolean
  description?: string
  location?: string
  status?: string
}

function parseIcsDate(raw: string): { date: Date | null; allDay: boolean } {
  if (!raw) return { date: null, allDay: false }
  // All-day: VALUE=DATE or plain YYYYMMDD
  if (/^\d{8}$/.test(raw)) {
    const y = +raw.slice(0,4), m = +raw.slice(4,6)-1, d = +raw.slice(6,8)
    return { date: new Date(y, m, d), allDay: true }
  }
  // Date-time: YYYYMMDDTHHmmssZ or YYYYMMDDTHHmmss
  const m = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)/)
  if (m) {
    const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${m[7] === 'Z' ? 'Z' : ''}`
    return { date: new Date(iso), allDay: false }
  }
  return { date: null, allDay: false }
}

function parseIcs(raw: string): IcsEvent[] {
  const events: IcsEvent[] = []
  const lines = raw.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n')

  let current: Record<string, string> | null = null
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { current = {}; continue }
    if (line === 'END:VEVENT' && current) {
      const uid     = current['UID'] ?? `ics_${Math.random().toString(36).slice(2)}`
      const summary = current['SUMMARY'] ?? '(No title)'
      // DTSTART may have params: DTSTART;TZID=...:value or DTSTART;VALUE=DATE:value
      const rawStart = (Object.entries(current).find(([k]) => k.startsWith('DTSTART'))?.[1]) ?? ''
      const rawEnd   = (Object.entries(current).find(([k]) => k.startsWith('DTEND'))?.[1]) ?? ''
      const { date: dtstart, allDay } = parseIcsDate(rawStart)
      const { date: dtend } = parseIcsDate(rawEnd)
      events.push({
        uid, summary, dtstart, dtend: dtend ?? dtstart, allDay,
        description: current['DESCRIPTION'],
        location:    current['LOCATION'],
        status:      (current['STATUS'] ?? 'confirmed').toLowerCase(),
      })
      current = null
      continue
    }
    if (!current) continue
    const colonIdx = line.indexOf(':')
    if (colonIdx < 0) continue
    const key = line.slice(0, colonIdx)
    const val = line.slice(colonIdx + 1)
    current[key] = val
  }
  return events
}

// POST /api/calendar/ics/sync?id=<connectionId> — sync one ICS feed
// POST /api/calendar/ics/sync — sync ALL of the user's ICS feeds
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    const id   = new URL(req.url).searchParams.get('id')

    let query = supabase
      .from('calendar_connections')
      .select('id,name,color,ics_url')
      .eq('user_id', user.id)
      .eq('provider', 'ics')
      .eq('is_active', true)

    if (id) query = (query as any).eq('id', id)

    const { data: connections, error } = await query
    if (error) throw error
    if (!connections?.length) {
      return NextResponse.json({ synced: 0, events: 0 })
    }

    let totalEvents = 0
    const results: Array<{ id: string; name: string; events: number; error?: string }> = []

    for (const conn of connections) {
      if (!conn.ics_url) continue

      try {
        const res = await fetch(conn.ics_url, { signal: AbortSignal.timeout(15000) })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)

        const text   = await res.text()
        const events = parseIcs(text)

        for (const ev of events) {
          if (!ev.dtstart) continue
          void (async () => {
            try {
              await supabase.from('gcal_events').upsert(
                {
                  user_id:          user.id,
                  gcal_event_id:    `ics_${conn.id}_${ev.uid}`,
                  gcal_calendar_id: conn.id,
                  source:           'ics',
                  title:            ev.summary,
                  description:      ev.description ?? null,
                  location:         ev.location    ?? null,
                  start_time:       ev.dtstart.toISOString(),
                  end_time:         (ev.dtend ?? ev.dtstart).toISOString(),
                  is_all_day:       ev.allDay,
                  status:           ev.status ?? 'confirmed',
                  synced_at:        new Date().toISOString(),
                },
                { onConflict: 'user_id,gcal_event_id' }
              )
            } catch (_) { /* non-blocking */ }
          })()
        }

        // Update last_synced_at
        void supabase.from('calendar_connections')
          .update({ last_synced_at: new Date().toISOString() })
          .eq('id', conn.id)

        results.push({ id: conn.id, name: conn.name, events: events.length })
        totalEvents += events.length
      } catch (err: unknown) {
        results.push({ id: conn.id, name: conn.name, events: 0, error: (err as Error).message })
      }
    }

    return NextResponse.json({ synced: connections.length, events: totalEvents, results })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
