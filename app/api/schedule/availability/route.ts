/**
 * POST /api/schedule/availability — public booking availability.
 * Returns open time slots for a date + meeting type, computed from the host rep's
 * Google Calendar free/busy via the PORTAL's per-user OAuth (user_settings.gcal_refresh_token).
 * No service account: a rep connects their own Gmail in the portal.
 */
import { NextResponse } from 'next/server'
import { getScheduleHost, getBusy } from '@/lib/schedule-calendar'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const formatLocal = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(date)
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]))
  const h = p.hour === '24' ? '00' : p.hour
  return `${p.year}-${p.month}-${p.day} ${h}:${p.minute}`
}

export async function POST(request: Request) {
  try {
    const { date, meetingType, timezone = 'America/New_York', zip, state } = await request.json()
    if (!date) return NextResponse.json({ success: false, error: 'date required' }, { status: 400 })

    const host = await getScheduleHost({ zip, state })
    if ('error' in host) return NextResponse.json({ success: false, error: host.error }, { status: 503 })

    const mt = typeof meetingType === 'string' ? meetingType : meetingType?.id
    const cleanDate = String(date).split('T')[0]
    const [year, month, day] = cleanDate.split('-').map(Number)
    const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay()

    let validDays = [1, 2, 3, 4, 5], durationMinutes = 30, bufferBefore = 0, bufferAfter = 0, startHour = 9, endHour = 17
    let fixedSlots: number[] = []
    if (mt === 'intro') { durationMinutes = 30; bufferBefore = 15 }
    else if (mt === 'lunch') { durationMinutes = 60; bufferBefore = 15; bufferAfter = 15; validDays = [2, 4]; startHour = 11; endHour = 13 }
    else if (mt === 'onsite') { durationMinutes = 120; validDays = [1, 3, 5]; fixedSlots = [10, 14] }

    if (!validDays.includes(dayOfWeek)) return NextResponse.json({ success: true, availableSlots: [] })

    const queryStart = new Date(Date.UTC(year, month - 1, day - 1))
    const queryEnd = new Date(Date.UTC(year, month - 1, day + 2))
    const busySlots = await getBusy(host.token, queryStart.toISOString(), queryEnd.toISOString(), timezone)

    const busyBlocks = busySlots.map(b => {
      const toMins = (localStr: string) => {
        const [dPart, tPart] = localStr.split(' ')
        if (dPart < cleanDate) return 0
        if (dPart > cleanDate) return 24 * 60
        const [h, m] = tPart.split(':').map(Number)
        return h * 60 + m
      }
      return { startMins: toMins(formatLocal(new Date(b.start), timezone)), endMins: toMins(formatLocal(new Date(b.end), timezone)) }
    }).filter(b => b.startMins < b.endMins)

    const slotsToCheck: number[] = []
    if (fixedSlots.length) fixedSlots.forEach(h => slotsToCheck.push(h * 60))
    else { let c = startHour * 60; const e = endHour * 60; while (c + durationMinutes <= e) { slotsToCheck.push(c); c += 30 } }

    const nowLocal = formatLocal(new Date(), timezone)
    const [nowDate, nowTime] = nowLocal.split(' ')
    let nowMins = 0
    if (nowDate === cleanDate) { const [nh, nm] = nowTime.split(':').map(Number); nowMins = nh * 60 + nm }
    else if (nowDate > cleanDate) nowMins = 24 * 60

    const availableSlots: string[] = []
    for (const s of slotsToCheck) {
      if (s < nowMins) continue
      const checkStart = s - bufferBefore, checkEnd = s + durationMinutes + bufferAfter
      if (busyBlocks.some(b => checkStart < b.endMins && checkEnd > b.startMins)) continue
      const h = Math.floor(s / 60), m = s % 60, ampm = h >= 12 ? 'PM' : 'AM', h12 = h % 12 === 0 ? 12 : h % 12
      availableSlots.push(`${h12.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`)
    }

    return NextResponse.json({ success: true, availableSlots })
  } catch (e) {
    console.error('schedule availability error:', e)
    return NextResponse.json({ success: false, error: 'Failed to fetch slots' }, { status: 500 })
  }
}
