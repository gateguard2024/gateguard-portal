/**
 * POST /api/schedule/book — public booking. Creates the meeting on the host rep's
 * Google Calendar (per-user OAuth, REST) AND mirrors it into the portal's
 * calendar_events table so it shows in the Nexus calendar.
 *
 * Step 1 of 2: books the corporate sales rep. Step 2 (later): route to nearest dealer.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getScheduleHost, insertEvent } from '@/lib/schedule-calendar'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DURATION: Record<string, number> = { intro: 30, lunch: 60, onsite: 120 }

export async function POST(request: Request) {
  try {
    const { meetingType, selectedDate, selectedTime, formData, timezone = 'America/New_York' } = await request.json()
    if (!selectedDate || !selectedTime || !formData?.email) {
      return NextResponse.json({ success: false, error: 'Missing date, time, or contact info.' }, { status: 400 })
    }

    const host = await getScheduleHost({ zip: formData?.zip, state: formData?.state })
    if ('error' in host) return NextResponse.json({ success: false, error: host.error }, { status: 503 })

    const cleanDate = String(selectedDate).split('T')[0]
    const m = String(selectedTime).match(/(\d+):(\d+)\s+(AM|PM)/i)
    if (!m) return NextResponse.json({ success: false, error: 'Bad time format.' }, { status: 400 })
    let sh = parseInt(m[1]); const sm = parseInt(m[2])
    if (m[3].toUpperCase() === 'PM' && sh < 12) sh += 12
    if (m[3].toUpperCase() === 'AM' && sh === 12) sh = 0
    const shStr = sh.toString().padStart(2, '0'), smStr = sm.toString().padStart(2, '0')
    const startStr = `${cleanDate}T${shStr}:${smStr}:00`

    const mt = typeof meetingType === 'string' ? meetingType : meetingType?.id
    const title = typeof meetingType === 'string' ? 'Meeting' : (meetingType?.title || 'Meeting')
    const dur = DURATION[mt] || 30
    const endObj = new Date(`2000-01-01T${shStr}:${smStr}:00`); endObj.setMinutes(endObj.getMinutes() + dur)
    const endStr = `${cleanDate}T${endObj.getHours().toString().padStart(2, '0')}:${endObj.getMinutes().toString().padStart(2, '0')}:00`
    const summary = `GateGuard ${title}: ${formData.name || ''} (${formData.company || ''})`.trim()

    // 1) Google Calendar event on the host rep's calendar (REST, per-user OAuth).
    const gEvent = await insertEvent(host.token, {
      summary,
      description: `Booked via gateguard.co schedule.\n\nName: ${formData.name || ''}\nEmail: ${formData.email}\nCompany: ${formData.company || ''}`,
      start: { dateTime: startStr, timeZone: timezone },
      end: { dateTime: endStr, timeZone: timezone },
      attendees: [{ email: formData.email }],
    })

    // 2) Mirror into the portal calendar under the host user (best-effort).
    try {
      const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
      await db.from('calendar_events').insert({
        user_id: host.userId,
        created_by: 'schedule',
        title: summary,
        description: `Lead: ${formData.name || ''} · ${formData.email} · ${formData.company || ''}`,
        location: mt === 'onsite' ? 'On-site' : 'Virtual / Phone',
        start_time: new Date(startStr).toISOString(),
        end_time: new Date(endStr).toISOString(),
        status: 'confirmed',
        source: 'schedule',
      })
    } catch (e) { console.error('calendar_events mirror failed (non-blocking):', e) }

    return NextResponse.json({ success: true, eventLink: gEvent.htmlLink, host: host.hostName, routedToDealer: host.routedToDealer })
  } catch (e: unknown) {
    console.error('schedule book error:', e)
    return NextResponse.json({ success: false, error: (e as { message?: string })?.message || 'Booking failed' }, { status: 500 })
  }
}
