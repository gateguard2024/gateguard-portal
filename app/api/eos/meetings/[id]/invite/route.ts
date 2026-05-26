import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { sendEmail } from '@/lib/email-sender'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── ICS helpers ──────────────────────────────────────────────────────────────

function toIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function escapeSummary(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function buildIcs(meeting: {
  id: string
  name: string
  meeting_type: string
  duration_minutes: number
  agenda: { label: string; duration: number; description: string }[]
  attendees: { name: string; email?: string }[]
  next_meeting_at: string | null
  time_of_day: string | null
}): string {
  // Resolve the meeting start time
  let startDate: Date
  if (meeting.next_meeting_at) {
    startDate = new Date(meeting.next_meeting_at)
  } else if (meeting.time_of_day) {
    // Parse "HH:MM" or "6:00 AM" style
    const today = new Date()
    const [timePart, ampm] = meeting.time_of_day.split(' ')
    const [hStr, mStr] = timePart.split(':')
    let hour = parseInt(hStr, 10)
    const minute = parseInt(mStr ?? '0', 10)
    if (ampm === 'PM' && hour !== 12) hour += 12
    if (ampm === 'AM' && hour === 12) hour = 0
    today.setHours(hour, minute, 0, 0)
    // If already past today, push to tomorrow
    if (today < new Date()) today.setDate(today.getDate() + 1)
    startDate = today
  } else {
    // Default: tomorrow at 9am UTC
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setUTCHours(9, 0, 0, 0)
    startDate = tomorrow
  }

  const endDate = new Date(startDate.getTime() + meeting.duration_minutes * 60 * 1000)
  const now = new Date()

  const agendaDescription = meeting.agenda
    .map((item, i) => `${i + 1}. ${item.label} (${item.duration} min)${item.description ? ' - ' + item.description : ''}`)
    .join('\\n')

  const attendeeLines = meeting.attendees
    .filter(a => a.email)
    .map(a => `ATTENDEE;RSVP=TRUE;CN=${escapeSummary(a.name)}:mailto:${a.email}`)
    .join('\r\n')

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GateGuard//NEXUS//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${meeting.id}@gateguard.co`,
    `DTSTAMP:${toIcsDate(now)}`,
    `DTSTART:${toIcsDate(startDate)}`,
    `DTEND:${toIcsDate(endDate)}`,
    `SUMMARY:${escapeSummary(meeting.name)}`,
    `DESCRIPTION:${agendaDescription || 'No agenda items.'}`,
    'ORGANIZER;CN=GateGuard NEXUS:mailto:noreply@gateguard.co',
    ...(attendeeLines ? [attendeeLines] : []),
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'END:VEVENT',
    'END:VCALENDAR',
  ]

  return lines.join('\r\n')
}

// ─── Email HTML builder ───────────────────────────────────────────────────────

function buildInviteHtml(meeting: {
  name: string
  meeting_type: string
  duration_minutes: number
  next_meeting_at: string | null
  time_of_day: string | null
  day_of_week: string | null
  recurrence: string
  agenda: { label: string; duration: number; description: string }[]
  notes: string | null
}, organizerName: string): string {
  const typeLabels: Record<string, string> = {
    l10: 'L10 Meeting',
    quarterly: 'Quarterly Review',
    annual: 'Annual Planning',
    department: 'Department Meeting',
    custom: 'Custom Meeting',
  }
  const typeLabel = typeLabels[meeting.meeting_type] ?? meeting.meeting_type

  // Format date/time display
  let dateDisplay = 'See calendar invite for date'
  if (meeting.next_meeting_at) {
    const d = new Date(meeting.next_meeting_at)
    dateDisplay = d.toLocaleString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
    })
  } else {
    const parts: string[] = []
    if (meeting.recurrence && meeting.recurrence !== 'once') {
      parts.push(meeting.recurrence.charAt(0).toUpperCase() + meeting.recurrence.slice(1))
    }
    if (meeting.day_of_week) parts.push(meeting.day_of_week)
    if (meeting.time_of_day) parts.push(`at ${meeting.time_of_day}`)
    if (parts.length) dateDisplay = parts.join(' ')
  }

  const agendaRows = meeting.agenda.map((item, i) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-family:Arial,sans-serif;font-size:13px;color:#64748b;width:28px;vertical-align:top;font-weight:700;">${i + 1}.</td>
      <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-family:Arial,sans-serif;font-size:13px;color:#1e293b;">
        <strong>${item.label}</strong> &nbsp;<span style="color:#94a3b8;font-size:12px;">${item.duration} min</span>
        ${item.description ? `<br/><span style="color:#64748b;font-size:12px;">${item.description}</span>` : ''}
      </td>
    </tr>
  `).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:#0B1728;padding:20px 32px;">
              <span style="font-family:Arial,sans-serif;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">
                Gate<span style="color:#6B7EFF;">Guard</span>
              </span>
            </td>
          </tr>
          <!-- Hero -->
          <tr>
            <td style="padding:32px 32px 0;">
              <p style="font-family:Arial,sans-serif;font-size:13px;font-weight:600;color:#6B7EFF;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.5px;">Meeting Invitation</p>
              <h1 style="font-family:Arial,sans-serif;font-size:22px;font-weight:700;color:#0f172a;margin:0 0 4px;">${meeting.name}</h1>
              <p style="font-family:Arial,sans-serif;font-size:13px;color:#64748b;margin:0;">${typeLabel}</p>
            </td>
          </tr>
          <!-- Details table -->
          <tr>
            <td style="padding:24px 32px 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-family:Arial,sans-serif;font-size:13px;color:#94a3b8;width:130px;vertical-align:top;">Date &amp; Time</td>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-family:Arial,sans-serif;font-size:13px;color:#1e293b;font-weight:600;">${dateDisplay}</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-family:Arial,sans-serif;font-size:13px;color:#94a3b8;vertical-align:top;">Duration</td>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-family:Arial,sans-serif;font-size:13px;color:#1e293b;font-weight:600;">${meeting.duration_minutes} minutes</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-family:Arial,sans-serif;font-size:13px;color:#94a3b8;vertical-align:top;">Organizer</td>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-family:Arial,sans-serif;font-size:13px;color:#1e293b;font-weight:600;">${organizerName}</td>
                </tr>
              </table>
            </td>
          </tr>
          ${meeting.agenda.length > 0 ? `
          <!-- Agenda -->
          <tr>
            <td style="padding:24px 32px 0;">
              <p style="font-family:Arial,sans-serif;font-size:12px;font-weight:600;color:#64748b;margin:0 0 12px;text-transform:uppercase;letter-spacing:0.5px;">Agenda</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${agendaRows}
              </table>
            </td>
          </tr>` : ''}
          ${meeting.notes ? `
          <!-- Notes -->
          <tr>
            <td style="padding:20px 32px 0;">
              <div style="background:#f8fafc;border-radius:8px;padding:16px;border-left:3px solid #6B7EFF;">
                <p style="font-family:Arial,sans-serif;font-size:12px;font-weight:600;color:#64748b;margin:0 0 6px;text-transform:uppercase;letter-spacing:0.5px;">Notes</p>
                <p style="font-family:Arial,sans-serif;font-size:13px;color:#1e293b;margin:0;line-height:1.6;">${meeting.notes}</p>
              </div>
            </td>
          </tr>` : ''}
          <!-- ICS note -->
          <tr>
            <td style="padding:24px 32px 0;">
              <div style="background:#eff6ff;border-radius:8px;padding:14px 16px;">
                <p style="font-family:Arial,sans-serif;font-size:13px;color:#1e40af;margin:0;">
                  A calendar invite (.ics) is attached. Open it to add this meeting to your calendar.
                </p>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:32px;border-top:1px solid #e2e8f0;margin-top:32px;">
              <p style="font-family:Arial,sans-serif;font-size:12px;color:#94a3b8;margin:0;text-align:center;line-height:1.6;">
                GateGuard &nbsp;&middot;&nbsp; rfeldman@gateguard.co &nbsp;&middot;&nbsp;
                <a href="https://portal.gateguard.co" style="color:#6B7EFF;text-decoration:none;">portal.gateguard.co</a>
              </p>
              <p style="font-family:Arial,sans-serif;font-size:11px;color:#cbd5e1;margin:8px 0 0;text-align:center;">
                This invitation was sent via GateGuard NEXUS
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser()

    // Load the meeting
    const { data: meeting, error: meetingError } = await supabase
      .from('eos_meetings')
      .select('*')
      .eq('id', params.id)
      .maybeSingle()

    if (meetingError || !meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    const attendees: { name: string; email?: string }[] = Array.isArray(meeting.attendees)
      ? meeting.attendees
      : []

    const withEmail = attendees.filter(a => a.email)

    if (withEmail.length === 0) {
      return NextResponse.json({
        sent: 0,
        failed: 0,
        skipped: attendees.length,
        results: [],
      })
    }

    // Build the .ics content
    const icsContent = buildIcs({
      id: meeting.id,
      name: meeting.name,
      meeting_type: meeting.meeting_type,
      duration_minutes: meeting.duration_minutes ?? 90,
      agenda: Array.isArray(meeting.agenda) ? meeting.agenda : [],
      attendees,
      next_meeting_at: meeting.next_meeting_at ?? null,
      time_of_day: meeting.time_of_day ?? null,
    })

    const icsBase64 = Buffer.from(icsContent, 'utf-8').toString('base64')

    // Build the email HTML
    const organizerName = user.name || 'GateGuard NEXUS'

    const html = buildInviteHtml({
      name: meeting.name,
      meeting_type: meeting.meeting_type,
      duration_minutes: meeting.duration_minutes ?? 90,
      next_meeting_at: meeting.next_meeting_at ?? null,
      time_of_day: meeting.time_of_day ?? null,
      day_of_week: meeting.day_of_week ?? null,
      recurrence: meeting.recurrence ?? 'weekly',
      agenda: Array.isArray(meeting.agenda) ? meeting.agenda : [],
      notes: meeting.notes ?? null,
    }, organizerName)

    // Format subject date
    let subjectDate = ''
    if (meeting.next_meeting_at) {
      const d = new Date(meeting.next_meeting_at)
      subjectDate = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    } else {
      const parts: string[] = []
      if (meeting.day_of_week) parts.push(meeting.day_of_week)
      if (meeting.time_of_day) parts.push(meeting.time_of_day)
      subjectDate = parts.join(' ') || 'TBD'
    }

    const subject = `[Meeting Invite] ${meeting.name} — ${subjectDate}`

    // Send one email per attendee (with per-attendee ATTENDEE line in the .ics)
    const results: { email: string; success: boolean; error?: string }[] = []
    let sent = 0
    let failed = 0

    for (const attendee of withEmail) {
      const result = await sendEmail({
        to: attendee.email!,
        subject,
        html,
        attachments: [
          {
            filename: 'meeting-invite.ics',
            content: icsBase64,
          },
        ],
      })
      results.push({ email: attendee.email!, success: result.success, error: result.error })
      if (result.success) {
        sent++
      } else {
        failed++
      }
    }

    // Store invited_at on the meeting
    void (async () => {
      try {
        await supabase
          .from('eos_meetings')
          .update({ invited_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', params.id)
      } catch (_) { /* non-blocking */ }
    })()

    return NextResponse.json({ sent, failed, skipped: attendees.length - withEmail.length, results })
  } catch (err) {
    console.error('[/api/eos/meetings/[id]/invite]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
