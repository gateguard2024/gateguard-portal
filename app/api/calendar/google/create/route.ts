import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type CreateEventPayload = {
  title?: string
  date?: string
  start_time?: string
  end_time?: string
  location?: string
  notes?: string
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function isoFromLocal(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString()
}

async function getAccessToken(refreshToken: string): Promise<{ token: string | null; error?: string }> {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return { token: null, error: 'Google Calendar is not configured.' }
  }

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
    })

    if (!res.ok) {
      const text = await res.text()
      return { token: null, error: `Google token refresh failed (${res.status}): ${text}` }
    }

    const data = await res.json() as { access_token?: string; error?: string; error_description?: string }
    if (data.error) return { token: null, error: `${data.error}: ${data.error_description ?? ''}` }
    return { token: data.access_token ?? null }
  } catch (error) {
    return { token: null, error: error instanceof Error ? error.message : 'Could not refresh Google token.' }
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    const body = await req.json().catch(() => ({})) as CreateEventPayload

    const title = clean(body.title)
    const date = clean(body.date)
    const startTime = clean(body.start_time)
    const endTime = clean(body.end_time)
    const location = clean(body.location)
    const notes = clean(body.notes)

    if (!title) return NextResponse.json({ success: false, message: 'Title is required.' }, { status: 400 })
    if (!date) return NextResponse.json({ success: false, message: 'Date is required.' }, { status: 400 })
    if (!startTime) return NextResponse.json({ success: false, message: 'Start time is required.' }, { status: 400 })
    if (!endTime) return NextResponse.json({ success: false, message: 'End time is required.' }, { status: 400 })

    const startIso = isoFromLocal(date, startTime)
    const endIso = isoFromLocal(date, endTime)

    if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
      return NextResponse.json({ success: false, message: 'End time must be after start time.' }, { status: 400 })
    }

    const { data: settingsRow, error: settingsError } = await supabase
      .from('user_settings')
      .select('gcal_refresh_token, gcal_calendar_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (settingsError) {
      return NextResponse.json({ success: false, message: settingsError.message }, { status: 500 })
    }

    if (!settingsRow?.gcal_refresh_token) {
      return NextResponse.json({
        success: false,
        needs_connection: true,
        message: 'Connect Google Calendar before adding events from Nexus.',
        connect_url: '/api/calendar/google/connect',
      }, { status: 400 })
    }

    const { token, error: tokenError } = await getAccessToken(settingsRow.gcal_refresh_token)
    if (!token) {
      return NextResponse.json({ success: false, message: tokenError ?? 'Could not access Google Calendar.' }, { status: 401 })
    }

    const calendarId = settingsRow.gcal_calendar_id || 'primary'
    const eventBody = {
      summary: title,
      description: notes || undefined,
      location: location || undefined,
      start: { dateTime: startIso },
      end: { dateTime: endIso },
    }

    const createRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventBody),
    })

    if (!createRes.ok) {
      const text = await createRes.text()
      return NextResponse.json({ success: false, message: `Google Calendar create failed (${createRes.status}): ${text}` }, { status: 502 })
    }

    const created = await createRes.json() as {
      id?: string
      summary?: string
      description?: string
      location?: string
      start?: { dateTime?: string }
      end?: { dateTime?: string }
      status?: string
      htmlLink?: string
      organizer?: { email?: string }
      attendees?: unknown[]
    }

    if (!created.id) {
      return NextResponse.json({ success: false, message: 'Google Calendar did not return an event id.' }, { status: 502 })
    }

    const { error: upsertError } = await supabase
      .from('gcal_events')
      .upsert(
        {
          user_id: user.id,
          org_id: user.org_id || null,
          gcal_event_id: created.id,
          gcal_calendar_id: calendarId,
          title: created.summary ?? title,
          description: created.description ?? notes || null,
          location: created.location ?? location || null,
          start_time: created.start?.dateTime ?? startIso,
          end_time: created.end?.dateTime ?? endIso,
          is_all_day: false,
          status: created.status ?? 'confirmed',
          html_link: created.htmlLink ?? null,
          organizer_email: created.organizer?.email ?? null,
          attendees: created.attendees ?? null,
          source_type: 'manual',
          synced_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,gcal_event_id' }
      )

    if (upsertError) {
      return NextResponse.json({ success: false, message: upsertError.message }, { status: 500 })
    }

    await supabase
      .from('user_settings')
      .update({ gcal_last_synced_at: new Date().toISOString() })
      .eq('user_id', user.id)

    return NextResponse.json({
      success: true,
      message: 'Event added to Google Calendar.',
      event: {
        id: created.id,
        title: created.summary ?? title,
        start_time: created.start?.dateTime ?? startIso,
        end_time: created.end?.dateTime ?? endIso,
        html_link: created.htmlLink ?? null,
      },
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Could not create calendar event.',
    }, { status: 500 })
  }
}
