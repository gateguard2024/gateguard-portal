import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getAccessToken(refreshToken: string): Promise<string | null> {
  const clientId     = process.env.GOOGLE_CALENDAR_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET
  if (!clientId || !clientSecret) return null
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId, client_secret: clientSecret,
        refresh_token: refreshToken, grant_type: 'refresh_token',
      }).toString(),
    })
    if (!res.ok) return null
    const data = await res.json() as { access_token?: string }
    return data.access_token ?? null
  } catch { return null }
}

interface GCalItem {
  id: string
  summary?: string
  start?: { dateTime?: string; date?: string }
  end?:   { dateTime?: string; date?: string }
  status?: string
  description?: string
  location?: string
}

async function fetchCalendarEvents(
  calendarId: string, accessToken: string, timeMin: string, timeMax: string
): Promise<GCalItem[]> {
  const encodedId = encodeURIComponent(calendarId)
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodedId}/events?` +
    new URLSearchParams({ timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime', maxResults: '250' }).toString(),
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!res.ok) return []
  const data = await res.json() as { items?: GCalItem[] }
  return data.items ?? []
}

// POST /api/calendar/google/sync
export async function POST() {
  try {
    const user = await getCurrentUser()

    // Read from dedicated columns (migration 053 schema)
    const { data: row } = await supabase
      .from('user_settings')
      .select('gcal_refresh_token, gcal_selected_calendar_ids')
      .eq('user_id', user.id)
      .single()

    if (!row?.gcal_refresh_token) {
      return NextResponse.json({ error: 'Google Calendar not connected' }, { status: 400 })
    }

    const accessToken = await getAccessToken(row.gcal_refresh_token)
    if (!accessToken) {
      return NextResponse.json({ error: 'Failed to refresh Google access token' }, { status: 401 })
    }

    // Selected calendar IDs
    let selectedIds: string[] = ['primary']
    if (row.gcal_selected_calendar_ids) {
      try {
        const parsed = row.gcal_selected_calendar_ids as string[]
        if (Array.isArray(parsed) && parsed.length > 0) selectedIds = parsed
      } catch { /* keep default */ }
    }

    const now    = new Date()
    const future = new Date()
    future.setDate(future.getDate() + 30)
    const timeMin = now.toISOString()
    const timeMax = future.toISOString()

    // PULL — fetch from all selected calendars in parallel
    const allFetches = await Promise.all(
      selectedIds.map((calId) => fetchCalendarEvents(calId, accessToken, timeMin, timeMax))
    )

    const seenIds = new Set<string>()
    const allItems: GCalItem[] = []
    for (const items of allFetches) {
      for (const item of items) {
        if (!seenIds.has(item.id)) { seenIds.add(item.id); allItems.push(item) }
      }
    }

    let pulledCount = 0
    for (const item of allItems) {
      const startRaw  = item.start?.dateTime ?? item.start?.date
      const endRaw    = item.end?.dateTime   ?? item.end?.date
      if (!startRaw) continue

      const startTime  = new Date(startRaw).toISOString()
      const endTime    = endRaw ? new Date(endRaw).toISOString() : startTime
      const isAllDay   = !item.start?.dateTime

      void (async () => {
        try {
          await supabase.from('gcal_events').upsert(
            {
              user_id:        user.id,
              gcal_event_id:  item.id,
              gcal_calendar_id: 'primary',
              source:         'google',
              title:          item.summary ?? '(No title)',
              description:    item.description ?? null,
              location:       item.location ?? null,
              start_time:     startTime,
              end_time:       endTime,
              is_all_day:     isAllDay,
              status:         item.status ?? 'confirmed',
              synced_at:      new Date().toISOString(),
            },
            { onConflict: 'user_id,gcal_event_id' }
          )
        } catch (_) { /* non-blocking */ }
      })()
      pulledCount++
    }

    // PUSH — GateGuard To-Dos + Work Orders → primary calendar
    let pushedCount = 0
    const nowDate    = now.toISOString().split('T')[0]
    const futureDate = future.toISOString().split('T')[0]

    const [{ data: todos }, { data: wos }] = await Promise.all([
      supabase.from('todos').select('id,title,due_date,status,priority')
        .not('due_date','is',null).gte('due_date',nowDate).lte('due_date',futureDate)
        .in('status',['open','in_progress']),
      supabase.from('work_orders').select('id,title,scheduled_date,scheduled_time,status')
        .not('scheduled_date','is',null).gte('scheduled_date',nowDate).lte('scheduled_date',futureDate)
        .in('status',['open','assigned','in_progress']),
    ])

    // Track pushed events in user_settings JSONB to avoid duplicates
    const { data: pushMap } = await supabase
      .from('user_settings').select('gcal_push_map').eq('user_id', user.id).single()
    const gcalPushMap: Record<string, string> = (pushMap as any)?.gcal_push_map ?? {}

    for (const todo of todos ?? []) {
      const key      = `todo_${todo.id}`
      const eventBody = {
        summary:     `[TODO] ${todo.title}`,
        description: `GateGuard To-Do | Priority: ${todo.priority ?? 'medium'} | Status: ${todo.status}`,
        start: { date: todo.due_date }, end: { date: todo.due_date },
      }
      if (gcalPushMap[key]) {
        await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${gcalPushMap[key]}`,
          { method: 'PUT', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(eventBody) })
      } else {
        const r = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events',
          { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(eventBody) })
        if (r.ok) { const d = await r.json() as { id?: string }; if (d.id) gcalPushMap[key] = d.id }
      }
      pushedCount++
    }

    for (const wo of wos ?? []) {
      const key     = `wo_${wo.id}`
      const isAllDay = !wo.scheduled_time
      const dtStr    = wo.scheduled_time ? `${wo.scheduled_date}T${wo.scheduled_time}:00` : wo.scheduled_date
      const eventBody = isAllDay
        ? { summary: `[WO] ${wo.title}`, description: `GateGuard Work Order | Status: ${wo.status}`, start: { date: wo.scheduled_date }, end: { date: wo.scheduled_date } }
        : { summary: `[WO] ${wo.title}`, description: `GateGuard Work Order | Status: ${wo.status}`, start: { dateTime: dtStr, timeZone: 'America/New_York' }, end: { dateTime: dtStr, timeZone: 'America/New_York' } }

      if (gcalPushMap[key]) {
        await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${gcalPushMap[key]}`,
          { method: 'PUT', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(eventBody) })
      } else {
        const r = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events',
          { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(eventBody) })
        if (r.ok) { const d = await r.json() as { id?: string }; if (d.id) gcalPushMap[key] = d.id }
      }
      pushedCount++
    }

    // Save updated push map + last synced timestamp
    void (async () => {
      try {
        await supabase.from('user_settings').upsert(
          { user_id: user.id, gcal_last_synced_at: new Date().toISOString(), gcal_push_map: gcalPushMap },
          { onConflict: 'user_id' }
        )
      } catch (_) { /* non-blocking */ }
    })()

    return NextResponse.json({ success: true, pulled: pulledCount, pushed: pushedCount, calendars: selectedIds.length, synced_at: new Date().toISOString() })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
