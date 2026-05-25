import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getMSAccessToken(refreshToken: string): Promise<string | null> {
  const clientId     = process.env.MICROSOFT_CALENDAR_CLIENT_ID
  const clientSecret = process.env.MICROSOFT_CALENDAR_CLIENT_SECRET
  if (!clientId || !clientSecret) return null
  try {
    const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId, client_secret: clientSecret,
        refresh_token: refreshToken, grant_type: 'refresh_token',
        scope: 'https://graph.microsoft.com/Calendars.ReadWrite offline_access',
      }).toString(),
    })
    if (!res.ok) return null
    const data = await res.json() as { access_token?: string }
    return data.access_token ?? null
  } catch { return null }
}

// POST /api/calendar/microsoft/sync
export async function POST() {
  try {
    const user = await getCurrentUser()

    const { data: row } = await supabase
      .from('user_settings')
      .select('ms_refresh_token, ms_selected_calendar_ids, ms_push_map')
      .eq('user_id', user.id)
      .single()

    if (!row?.ms_refresh_token) {
      return NextResponse.json({ error: 'Microsoft 365 Calendar not connected' }, { status: 400 })
    }

    const accessToken = await getMSAccessToken(row.ms_refresh_token)
    if (!accessToken) {
      return NextResponse.json({ error: 'Failed to refresh Microsoft access token' }, { status: 401 })
    }

    const now    = new Date()
    const future = new Date()
    future.setDate(future.getDate() + 30)

    // PULL — fetch events from Graph API calendarView
    const calViewRes = await fetch(
      `https://graph.microsoft.com/v1.0/me/calendarView?` +
      new URLSearchParams({
        startDateTime: now.toISOString(),
        endDateTime:   future.toISOString(),
        '$top':        '250',
        '$select':     'id,subject,start,end,isAllDay,bodyPreview,location,showAs',
      }).toString(),
      { headers: { Authorization: `Bearer ${accessToken}`, Prefer: 'outlook.timezone="UTC"' } }
    )

    let pulledCount = 0
    if (calViewRes.ok) {
      const calData = await calViewRes.json() as { value?: Array<{
        id: string; subject?: string; start?: { dateTime: string }; end?: { dateTime: string };
        isAllDay?: boolean; bodyPreview?: string; location?: { displayName?: string }; showAs?: string
      }> }

      for (const ev of calData.value ?? []) {
        const startTime = ev.start?.dateTime ? new Date(ev.start.dateTime + (ev.start.dateTime.endsWith('Z') ? '' : 'Z')).toISOString() : null
        const endTime   = ev.end?.dateTime   ? new Date(ev.end.dateTime   + (ev.end.dateTime.endsWith('Z')   ? '' : 'Z')).toISOString() : startTime
        if (!startTime) continue

        void (async () => {
          try {
            await supabase.from('gcal_events').upsert(
              {
                user_id:          user.id,
                gcal_event_id:    `ms_${ev.id}`,
                gcal_calendar_id: 'microsoft',
                source:           'microsoft',
                title:            ev.subject ?? '(No title)',
                description:      ev.bodyPreview ?? null,
                location:         ev.location?.displayName ?? null,
                start_time:       startTime,
                end_time:         endTime ?? startTime,
                is_all_day:       ev.isAllDay ?? false,
                status:           ev.showAs === 'free' ? 'tentative' : 'confirmed',
                synced_at:        new Date().toISOString(),
              },
              { onConflict: 'user_id,gcal_event_id' }
            )
          } catch (_) { /* non-blocking */ }
        })()
        pulledCount++
      }
    }

    // PUSH — GateGuard Work Orders → M365 calendar
    let pushedCount = 0
    const nowDate    = now.toISOString().split('T')[0]
    const futureDate = future.toISOString().split('T')[0]
    const msPushMap: Record<string, string> = (row.ms_push_map as Record<string, string>) ?? {}

    const { data: wos } = await supabase
      .from('work_orders').select('id,title,scheduled_date,scheduled_time,status')
      .not('scheduled_date','is',null).gte('scheduled_date',nowDate).lte('scheduled_date',futureDate)
      .in('status',['open','assigned','in_progress'])

    for (const wo of wos ?? []) {
      const key     = `wo_${wo.id}`
      const dtStr   = wo.scheduled_time ? `${wo.scheduled_date}T${wo.scheduled_time}:00` : `${wo.scheduled_date}T09:00:00`
      const endDt   = wo.scheduled_time ? `${wo.scheduled_date}T${wo.scheduled_time}:00` : `${wo.scheduled_date}T10:00:00`
      const eventBody = {
        subject:     `[WO] ${wo.title}`,
        body:        { contentType: 'text', content: `GateGuard Work Order | Status: ${wo.status}` },
        start:       { dateTime: dtStr,  timeZone: 'Eastern Standard Time' },
        end:         { dateTime: endDt,  timeZone: 'Eastern Standard Time' },
        categories:  ['GateGuard'],
      }

      if (msPushMap[key]) {
        await fetch(`https://graph.microsoft.com/v1.0/me/events/${msPushMap[key]}`,
          { method: 'PATCH', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(eventBody) })
      } else {
        const r = await fetch('https://graph.microsoft.com/v1.0/me/events',
          { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(eventBody) })
        if (r.ok) { const d = await r.json() as { id?: string }; if (d.id) msPushMap[key] = d.id }
      }
      pushedCount++
    }

    // Save push map + last synced
    void (async () => {
      try {
        await supabase.from('user_settings').upsert(
          { user_id: user.id, ms_last_synced_at: new Date().toISOString(), ms_push_map: msPushMap },
          { onConflict: 'user_id' }
        )
      } catch (_) { /* non-blocking */ }
    })()

    return NextResponse.json({ success: true, pulled: pulledCount, pushed: pushedCount, synced_at: new Date().toISOString() })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
