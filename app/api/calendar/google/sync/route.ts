import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Helper: get a fresh access token using the stored refresh token ────────────
async function getAccessToken(refreshToken: string): Promise<string | null> {
  const clientId     = process.env.GOOGLE_CALENDAR_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET

  if (!clientId || !clientSecret) return null

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type:    'refresh_token',
      }).toString(),
    })

    if (!res.ok) return null
    const data = await res.json() as { access_token?: string }
    return data.access_token ?? null
  } catch {
    return null
  }
}

// ── Helper: format a date as YYYY-MM-DD ───────────────────────────────────────
function toDateStr(isoString: string): string {
  return isoString.split('T')[0]
}

function toTimeStr(isoString: string): string | null {
  const parts = isoString.split('T')
  if (parts.length < 2) return null
  return parts[1].substring(0, 5) // HH:MM
}

// POST /api/calendar/google/sync — bidirectional sync
export async function POST() {
  try {
    const user = await getCurrentUser()

    // Get stored refresh token
    const { data: tokenRow } = await supabase
      .from('user_settings')
      .select('value')
      .eq('user_id', user.id)
      .eq('key', 'google_calendar_refresh_token')
      .single()

    if (!tokenRow?.value) {
      return NextResponse.json({ error: 'Google Calendar not connected' }, { status: 400 })
    }

    const accessToken = await getAccessToken(tokenRow.value)
    if (!accessToken) {
      return NextResponse.json({ error: 'Failed to refresh Google access token' }, { status: 401 })
    }

    const now    = new Date()
    const future = new Date()
    future.setDate(future.getDate() + 30)

    const timeMin = now.toISOString()
    const timeMax = future.toISOString()

    // ── PULL: fetch events from Google Calendar ────────────────────────────────
    const gcalRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      new URLSearchParams({
        timeMin,
        timeMax,
        singleEvents: 'true',
        orderBy:      'startTime',
        maxResults:   '250',
      }).toString(),
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    )

    let pulledCount = 0
    if (gcalRes.ok) {
      const gcalData = await gcalRes.json() as {
        items?: Array<{
          id: string
          summary?: string
          start?: { dateTime?: string; date?: string }
          end?:   { dateTime?: string; date?: string }
          status?: string
        }>
      }

      for (const item of gcalData.items ?? []) {
        const startRaw  = item.start?.dateTime ?? item.start?.date ?? ''
        const startDate = toDateStr(startRaw)
        const startTime = item.start?.dateTime ? toTimeStr(item.start.dateTime) : null

        void (async () => {
          try {
            await supabase
              .from('gcal_events')
              .upsert(
                {
                  user_id:       user.id,
                  gcal_event_id: item.id,
                  title:         item.summary ?? '(No title)',
                  start_date:    startDate,
                  start_time:    startTime,
                  end_date:      item.end?.dateTime
                    ? toDateStr(item.end.dateTime)
                    : (item.end?.date ?? startDate),
                  status:        item.status ?? 'confirmed',
                  synced_at:     new Date().toISOString(),
                },
                { onConflict: 'user_id,gcal_event_id' }
              )
          } catch (_) { /* non-blocking */ }
        })()
        pulledCount++
      }
    }

    // ── PUSH: to-dos and WOs → Google Calendar ─────────────────────────────────
    let pushedCount = 0

    const nowDate    = now.toISOString().split('T')[0]
    const futureDate = future.toISOString().split('T')[0]

    const [{ data: todos }, { data: wos }] = await Promise.all([
      supabase
        .from('todos')
        .select('id, title, due_date, status, priority')
        .not('due_date', 'is', null)
        .gte('due_date', nowDate)
        .lte('due_date', futureDate)
        .in('status', ['open', 'in_progress']),
      supabase
        .from('work_orders')
        .select('id, title, scheduled_date, scheduled_time, status')
        .not('scheduled_date', 'is', null)
        .gte('scheduled_date', nowDate)
        .lte('scheduled_date', futureDate)
        .in('status', ['open', 'assigned', 'in_progress']),
    ])

    // Push todos to GCal
    for (const todo of todos ?? []) {
      // Check if we already have a gcal event id stored for this todo
      const { data: existing } = await supabase
        .from('user_settings')
        .select('value')
        .eq('user_id', user.id)
        .eq('key', `gcal_todo_${todo.id}`)
        .single()

      const eventBody = {
        summary:     `[TODO] ${todo.title}`,
        description: `GateGuard To-Do | Priority: ${todo.priority ?? 'medium'} | Status: ${todo.status}`,
        start:       { date: todo.due_date },
        end:         { date: todo.due_date },
      }

      if (existing?.value) {
        // Update existing event
        await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${existing.value}`,
          {
            method:  'PUT',
            headers: {
              Authorization:  `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(eventBody),
          }
        )
      } else {
        // Create new event
        const createRes = await fetch(
          'https://www.googleapis.com/calendar/v3/calendars/primary/events',
          {
            method:  'POST',
            headers: {
              Authorization:  `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(eventBody),
          }
        )
        if (createRes.ok) {
          const created = await createRes.json() as { id?: string }
          if (created.id) {
            void (async () => {
              try {
                await supabase
                  .from('user_settings')
                  .upsert(
                    { user_id: user.id, key: `gcal_todo_${todo.id}`, value: created.id },
                    { onConflict: 'user_id,key' }
                  )
              } catch (_) { /* non-blocking */ }
            })()
          }
        }
      }
      pushedCount++
    }

    // Push work orders to GCal
    for (const wo of wos ?? []) {
      const { data: existingWo } = await supabase
        .from('user_settings')
        .select('value')
        .eq('user_id', user.id)
        .eq('key', `gcal_wo_${wo.id}`)
        .single()

      const startDateTime = wo.scheduled_time
        ? `${wo.scheduled_date}T${wo.scheduled_time}:00`
        : wo.scheduled_date
      const isAllDay = !wo.scheduled_time

      const eventBody = isAllDay
        ? {
            summary:     `[WO] ${wo.title}`,
            description: `GateGuard Work Order | Status: ${wo.status}`,
            start:       { date: wo.scheduled_date },
            end:         { date: wo.scheduled_date },
          }
        : {
            summary:     `[WO] ${wo.title}`,
            description: `GateGuard Work Order | Status: ${wo.status}`,
            start:       { dateTime: startDateTime, timeZone: 'America/New_York' },
            end:         { dateTime: startDateTime, timeZone: 'America/New_York' },
          }

      if (existingWo?.value) {
        await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${existingWo.value}`,
          {
            method:  'PUT',
            headers: {
              Authorization:  `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(eventBody),
          }
        )
      } else {
        const createRes = await fetch(
          'https://www.googleapis.com/calendar/v3/calendars/primary/events',
          {
            method:  'POST',
            headers: {
              Authorization:  `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(eventBody),
          }
        )
        if (createRes.ok) {
          const created = await createRes.json() as { id?: string }
          if (created.id) {
            void (async () => {
              try {
                await supabase
                  .from('user_settings')
                  .upsert(
                    { user_id: user.id, key: `gcal_wo_${wo.id}`, value: created.id },
                    { onConflict: 'user_id,key' }
                  )
              } catch (_) { /* non-blocking */ }
            })()
          }
        }
      }
      pushedCount++
    }

    // Update last_synced_at
    void (async () => {
      try {
        await supabase
          .from('user_settings')
          .upsert(
            { user_id: user.id, key: 'google_calendar_last_synced', value: new Date().toISOString() },
            { onConflict: 'user_id,key' }
          )
      } catch (_) { /* non-blocking */ }
    })()

    return NextResponse.json({
      success: true,
      pulled:  pulledCount,
      pushed:  pushedCount,
      synced_at: new Date().toISOString(),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
