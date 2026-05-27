import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Helper: get a fresh access token using the stored refresh token ──────────
async function getAccessToken(refreshToken: string): Promise<{ token: string | null; error?: string }> {
  const clientId     = process.env.GOOGLE_CALENDAR_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return { token: null, error: 'GOOGLE_CALENDAR_CLIENT_ID or GOOGLE_CALENDAR_CLIENT_SECRET env vars not set' }
  }

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

    if (!res.ok) {
      const text = await res.text()
      return { token: null, error: `Google token refresh failed (${res.status}): ${text}` }
    }
    const data = await res.json() as { access_token?: string; error?: string; error_description?: string }
    if (data.error) {
      return { token: null, error: `Google OAuth error: ${data.error} — ${data.error_description ?? ''}` }
    }
    return { token: data.access_token ?? null }
  } catch (e) {
    return { token: null, error: String(e) }
  }
}

// POST /api/calendar/google/sync — bidirectional sync
export async function POST() {
  const diagnostics: string[] = []

  try {
    const user = await getCurrentUser()

    // ── Read refresh token from structured user_settings row ─────────────────
    const { data: settingsRow, error: settingsErr } = await supabase
      .from('user_settings')
      .select('gcal_refresh_token')
      .eq('user_id', user.id)
      .maybeSingle()

    if (settingsErr) {
      return NextResponse.json({
        error: `user_settings read failed: ${settingsErr.message}`,
        diagnostics,
      }, { status: 500 })
    }

    if (!settingsRow?.gcal_refresh_token) {
      return NextResponse.json({ error: 'Google Calendar not connected — no refresh token stored' }, { status: 400 })
    }
    diagnostics.push('refresh_token: present')

    // ── Get access token ─────────────────────────────────────────────────────
    const { token: accessToken, error: tokenErr } = await getAccessToken(settingsRow.gcal_refresh_token)
    if (!accessToken) {
      return NextResponse.json({
        error: `Failed to get access token: ${tokenErr}`,
        diagnostics,
      }, { status: 401 })
    }
    diagnostics.push('access_token: ok')

    const now    = new Date()
    const future = new Date()
    future.setDate(future.getDate() + 30)

    const timeMin = now.toISOString()
    const timeMax = future.toISOString()

    // ── PULL: fetch events from Google Calendar ──────────────────────────────
    const gcalRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      new URLSearchParams({
        timeMin,
        timeMax,
        singleEvents: 'true',
        orderBy:      'startTime',
        maxResults:   '250',
      }).toString(),
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    if (!gcalRes.ok) {
      const errText = await gcalRes.text()
      diagnostics.push(`gcal_api: failed (${gcalRes.status}) — ${errText}`)
      return NextResponse.json({
        error: `Google Calendar API error (${gcalRes.status})`,
        diagnostics,
      }, { status: 502 })
    }

    const gcalData = await gcalRes.json() as {
      items?: Array<{
        id: string
        summary?: string
        description?: string
        location?: string
        start?: { dateTime?: string; date?: string }
        end?:   { dateTime?: string; date?: string }
        status?: string
        htmlLink?: string
        organizer?: { email?: string }
        attendees?: Array<{ email: string; displayName?: string; responseStatus?: string }>
      }>
    }

    const items = gcalData.items ?? []
    diagnostics.push(`gcal_api: ok — ${items.length} events returned`)

    let pulledCount = 0
    let pullErrors  = 0

    for (const item of items) {
      const isAllDay = !!item.start?.date && !item.start?.dateTime
      const startIso = item.start?.dateTime ?? (item.start?.date ? `${item.start.date}T00:00:00Z` : null)
      const endIso   = item.end?.dateTime   ?? (item.end?.date   ? `${item.end.date}T00:00:00Z`   : null)

      if (!startIso || !endIso) continue

      const { error: upsertErr } = await supabase
        .from('gcal_events')
        .upsert(
          {
            user_id:          user.id,
            gcal_event_id:    item.id,
            gcal_calendar_id: 'primary',
            title:            item.summary ?? '(No title)',
            description:      item.description ?? null,
            location:         item.location ?? null,
            start_time:       startIso,
            end_time:         endIso,
            is_all_day:       isAllDay,
            status:           item.status ?? 'confirmed',
            html_link:        item.htmlLink ?? null,
            organizer_email:  item.organizer?.email ?? null,
            attendees:        item.attendees ?? null,
            synced_at:        new Date().toISOString(),
          },
          { onConflict: 'user_id,gcal_event_id' }
        )

      if (upsertErr) {
        pullErrors++
        if (pullErrors === 1) diagnostics.push(`gcal_events upsert error: ${upsertErr.message}`)
      } else {
        pulledCount++
      }
    }

    diagnostics.push(`pull: ${pulledCount} stored, ${pullErrors} errors`)

    // ── PUSH: to-dos and WOs → Google Calendar ───────────────────────────────
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
        .in('status', ['open', 'in_progress'])
        .or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`),
      supabase
        .from('work_orders')
        .select('id, title, scheduled_date, scheduled_time, status')
        .not('scheduled_date', 'is', null)
        .gte('scheduled_date', nowDate)
        .lte('scheduled_date', futureDate)
        .in('status', ['open', 'assigned', 'in_progress']),
    ])

    diagnostics.push(`push_query: ${todos?.length ?? 0} todos, ${wos?.length ?? 0} WOs in window`)

    let pushErrors = 0

    // Push todos
    for (const todo of todos ?? []) {
      try {
        const { data: existing } = await supabase
          .from('gcal_events')
          .select('gcal_event_id')
          .eq('user_id', user.id)
          .eq('source_type', 'todo')
          .eq('source_id', todo.id)
          .maybeSingle()

        const endDateExclusive = new Date(new Date(todo.due_date).getTime() + 86400000)
          .toISOString().split('T')[0]

        const eventBody = {
          summary:     `[TODO] ${todo.title}`,
          description: `GateGuard To-Do | Priority: ${todo.priority ?? 'medium'} | Status: ${todo.status}`,
          start:       { date: todo.due_date },
          end:         { date: endDateExclusive },
        }

        if (existing?.gcal_event_id) {
          const putRes = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/primary/events/${existing.gcal_event_id}`,
            {
              method:  'PUT',
              headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
              body:    JSON.stringify(eventBody),
            }
          )
          if (putRes.ok) {
            pushedCount++
          } else {
            const errText = await putRes.text()
            diagnostics.push(`todo PUT failed (${putRes.status}): ${errText.slice(0, 120)}`)
            pushErrors++
          }
        } else {
          const createRes = await fetch(
            'https://www.googleapis.com/calendar/v3/calendars/primary/events',
            {
              method:  'POST',
              headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
              body:    JSON.stringify(eventBody),
            }
          )
          if (createRes.ok) {
            const created = await createRes.json() as { id?: string }
            if (created.id) {
              await supabase.from('gcal_events').insert({
                user_id:          user.id,
                gcal_event_id:    created.id,
                gcal_calendar_id: 'primary',
                title:            `[TODO] ${todo.title}`,
                start_time:       `${todo.due_date}T00:00:00Z`,
                end_time:         `${endDateExclusive}T00:00:00Z`,
                is_all_day:       true,
                status:           'confirmed',
                source_type:      'todo',
                source_id:        todo.id,
                synced_at:        new Date().toISOString(),
              })
              pushedCount++
            }
          } else {
            const errText = await createRes.text()
            diagnostics.push(`todo POST failed (${createRes.status}): ${errText.slice(0, 120)}`)
            pushErrors++
          }
        }
      } catch (e) {
        diagnostics.push(`todo push exception: ${String(e).slice(0, 80)}`)
        pushErrors++
      }
    }

    // Push work orders
    for (const wo of wos ?? []) {
      try {
        const { data: existingWo } = await supabase
          .from('gcal_events')
          .select('gcal_event_id')
          .eq('user_id', user.id)
          .eq('source_type', 'work_order')
          .eq('source_id', wo.id)
          .maybeSingle()

        const isAllDay = !wo.scheduled_time
        // For timed events: startDateTime, endDateTime = start + 1 hour
        const startDateTime = wo.scheduled_time
          ? `${wo.scheduled_date}T${wo.scheduled_time}:00`
          : wo.scheduled_date
        const endDateExclusive = new Date(new Date(wo.scheduled_date).getTime() + 86400000)
          .toISOString().split('T')[0]
        const endDateTime = wo.scheduled_time
          ? new Date(new Date(`${wo.scheduled_date}T${wo.scheduled_time}:00`).getTime() + 3600000).toISOString()
          : null

        const eventBody = isAllDay
          ? {
              summary:     `[WO] ${wo.title}`,
              description: `GateGuard Work Order | Status: ${wo.status}`,
              start:       { date: wo.scheduled_date },
              end:         { date: endDateExclusive },
            }
          : {
              summary:     `[WO] ${wo.title}`,
              description: `GateGuard Work Order | Status: ${wo.status}`,
              start:       { dateTime: new Date(startDateTime).toISOString(), timeZone: 'America/New_York' },
              end:         { dateTime: endDateTime!, timeZone: 'America/New_York' },
            }

        if (existingWo?.gcal_event_id) {
          const putRes = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/primary/events/${existingWo.gcal_event_id}`,
            {
              method:  'PUT',
              headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
              body:    JSON.stringify(eventBody),
            }
          )
          if (putRes.ok) {
            pushedCount++
          } else {
            const errText = await putRes.text()
            diagnostics.push(`wo PUT failed (${putRes.status}): ${errText.slice(0, 120)}`)
            pushErrors++
          }
        } else {
          const createRes = await fetch(
            'https://www.googleapis.com/calendar/v3/calendars/primary/events',
            {
              method:  'POST',
              headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
              body:    JSON.stringify(eventBody),
            }
          )
          if (createRes.ok) {
            const created = await createRes.json() as { id?: string }
            if (created.id) {
              const startIso = isAllDay ? `${wo.scheduled_date}T00:00:00Z` : new Date(startDateTime).toISOString()
              const endIso   = isAllDay ? `${endDateExclusive}T00:00:00Z` : endDateTime!
              await supabase.from('gcal_events').insert({
                user_id:          user.id,
                gcal_event_id:    created.id,
                gcal_calendar_id: 'primary',
                title:            `[WO] ${wo.title}`,
                start_time:       startIso,
                end_time:         endIso,
                is_all_day:       isAllDay,
                status:           'confirmed',
                source_type:      'work_order',
                source_id:        wo.id,
                synced_at:        new Date().toISOString(),
              })
              pushedCount++
            }
          } else {
            const errText = await createRes.text()
            diagnostics.push(`wo POST failed (${createRes.status}): ${errText.slice(0, 120)}`)
            pushErrors++
          }
        }
      } catch (e) {
        diagnostics.push(`wo push exception: ${String(e).slice(0, 80)}`)
        pushErrors++
      }
    }

    diagnostics.push(`push: ${pushedCount} succeeded, ${pushErrors} errors`)

    // ── Update gcal_last_synced_at ────────────────────────────────────────────
    await supabase
      .from('user_settings')
      .upsert(
        { user_id: user.id, gcal_last_synced_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )

    return NextResponse.json({
      success:     true,
      pulled:      pulledCount,
      pull_errors: pullErrors,
      pushed:      pushedCount,
      push_errors: pushErrors,
      synced_at:   new Date().toISOString(),
      diagnostics,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg, diagnostics }, { status: 500 })
  }
}
