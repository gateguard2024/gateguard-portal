/**
 * GateGuard Email Utility — lib/email.ts
 *
 * Uses Resend (https://resend.com) for transactional email.
 * Add RESEND_API_KEY to your Vercel environment variables.
 * Add RESEND_FROM_EMAIL (default: notifications@gateguard.co)
 *
 * WO notification events:
 *   created    — new work order opened for this property
 *   updated    — details changed
 *   scheduled  — tech scheduled, date confirmed
 *   in_route   — tech is on the way (ETA included if set)
 *   on_site    — tech has arrived and is working
 *   completed  — work order marked complete
 */

export type WOEvent = 'created' | 'updated' | 'scheduled' | 'in_route' | 'on_site' | 'completed'

export interface WOEmailPayload {
  event:           WOEvent
  wo_number:       string
  title:           string
  customer_name:   string
  assignee_name?:  string
  scheduled_date?: string
  due_date?:       string
  tech_eta?:       string
  notes?:          string
  portal_url?:     string   // deep link back to WO (for future client portal)
}

const FROM = process.env.RESEND_FROM_EMAIL ?? 'GateGuard <notifications@gateguard.co>'
const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'https://portal.gateguard.co'

// ── Subject lines per event ───────────────────────────────────────────────────

function subject(event: WOEvent, wo_number: string, title: string): string {
  switch (event) {
    case 'created':   return `[${wo_number}] New Service Request: ${title}`
    case 'updated':   return `[${wo_number}] Work Order Updated: ${title}`
    case 'scheduled': return `[${wo_number}] Appointment Scheduled: ${title}`
    case 'in_route':  return `[${wo_number}] Technician En Route: ${title}`
    case 'on_site':   return `[${wo_number}] Technician On Site: ${title}`
    case 'completed': return `[${wo_number}] Work Complete: ${title}`
  }
}

// ── Body copy per event ───────────────────────────────────────────────────────

function bodyText(p: WOEmailPayload): string {
  const tech = p.assignee_name ?? 'a GateGuard technician'
  const date = p.scheduled_date
    ? new Date(p.scheduled_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    : null

  switch (p.event) {
    case 'created':
      return `A new service request has been opened for ${p.customer_name}.\n\nWork Order: ${p.wo_number}\nTitle: ${p.title}${p.notes ? `\n\nDetails:\n${p.notes}` : ''}\n\nWe will follow up with scheduling shortly.`

    case 'updated':
      return `Your work order has been updated.\n\nWork Order: ${p.wo_number}\nTitle: ${p.title}\n\nPlease contact us if you have any questions.`

    case 'scheduled':
      return `Your appointment has been scheduled.\n\nWork Order: ${p.wo_number}\nTitle: ${p.title}\nTechnician: ${tech}${date ? `\nScheduled: ${date}` : ''}\n\nWe'll send a reminder when the technician is en route.`

    case 'in_route':
      return `Your GateGuard technician is on the way.\n\nWork Order: ${p.wo_number}\nTitle: ${p.title}\nTechnician: ${tech}${p.tech_eta ? `\nEstimated Arrival: ${p.tech_eta}` : ''}\n\nWe'll notify you when they arrive on site.`

    case 'on_site':
      return `Your GateGuard technician has arrived.\n\nWork Order: ${p.wo_number}\nTitle: ${p.title}\nTechnician: ${tech}\n\nWork has begun. We'll notify you when the job is complete.`

    case 'completed':
      return `Your service request has been completed.\n\nWork Order: ${p.wo_number}\nTitle: ${p.title}\nTechnician: ${tech}\n\nThank you for choosing GateGuard. If you have any concerns about the work performed, please don't hesitate to reach out.`
  }
}

// ── HTML template ─────────────────────────────────────────────────────────────

function buildHtml(p: WOEmailPayload): string {
  const headline: Record<WOEvent, string> = {
    created:   '📋 New Service Request',
    updated:   '✏️ Work Order Updated',
    scheduled: '📅 Appointment Confirmed',
    in_route:  '🚗 Technician En Route',
    on_site:   '🔧 Technician On Site',
    completed: '✅ Work Complete',
  }

  const badgeColor: Record<WOEvent, string> = {
    created:   '#6B7EFF',
    updated:   '#64748b',
    scheduled: '#8b5cf6',
    in_route:  '#f59e0b',
    on_site:   '#f97316',
    completed: '#10b981',
  }

  const tech = p.assignee_name ?? 'GateGuard Tech'
  const date = p.scheduled_date
    ? new Date(p.scheduled_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    : null

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:32px 16px">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
        <!-- Header -->
        <tr><td style="background:#0C111D;padding:24px 32px">
          <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.5px">Gate<span style="color:#6B7EFF">Guard</span></span>
        </td></tr>
        <!-- Badge -->
        <tr><td style="padding:28px 32px 0">
          <span style="display:inline-block;background:${badgeColor[p.event]}22;color:${badgeColor[p.event]};font-size:13px;font-weight:600;padding:6px 14px;border-radius:100px;border:1px solid ${badgeColor[p.event]}44">
            ${headline[p.event]}
          </span>
        </td></tr>
        <!-- Title -->
        <tr><td style="padding:16px 32px 0">
          <h1 style="margin:0;font-size:22px;font-weight:700;color:#0f172a;line-height:1.3">${p.title}</h1>
          <p style="margin:6px 0 0;font-size:14px;color:#64748b">${p.customer_name}</p>
        </td></tr>
        <!-- Details -->
        <tr><td style="padding:24px 32px">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0">
            <tr><td style="padding:16px 20px">
              <table width="100%" cellpadding="4" cellspacing="0">
                <tr>
                  <td style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;width:110px">Work Order</td>
                  <td style="font-size:13px;color:#0f172a;font-family:monospace;font-weight:600">${p.wo_number}</td>
                </tr>
                <tr>
                  <td style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px">Technician</td>
                  <td style="font-size:13px;color:#0f172a">${tech}</td>
                </tr>
                ${date ? `<tr><td style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px">Scheduled</td><td style="font-size:13px;color:#0f172a">${date}</td></tr>` : ''}
                ${p.tech_eta ? `<tr><td style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px">ETA</td><td style="font-size:13px;color:#f59e0b;font-weight:600">${p.tech_eta}</td></tr>` : ''}
              </table>
            </td></tr>
          </table>
        </td></tr>
        ${p.notes ? `<tr><td style="padding:0 32px 24px"><p style="margin:0;font-size:14px;color:#475569;line-height:1.6">${p.notes.replace(/\n/g, '<br>')}</p></td></tr>` : ''}
        <!-- Footer -->
        <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 32px">
          <p style="margin:0;font-size:12px;color:#94a3b8">Questions? Reply to this email or contact your GateGuard dealer. This is an automated notification from GateGuard.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ── Main send function ────────────────────────────────────────────────────────

export async function sendWOEmail(to: string, payload: WOEmailPayload): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    // Not configured — log and skip gracefully
    console.log(`[email] RESEND_API_KEY not set. Would have sent "${subject(payload.event, payload.wo_number, payload.title)}" to ${to}`)
    return false
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:    FROM,
        to:      [to],
        subject: subject(payload.event, payload.wo_number, payload.title),
        text:    bodyText(payload),
        html:    buildHtml(payload),
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error(`[email] Resend error ${res.status}:`, err)
      return false
    }

    return true
  } catch (err) {
    console.error('[email] Failed to send:', err)
    return false
  }
}

// ── Convenience: send WO notification + log it ────────────────────────────────

import { createClient } from '@supabase/supabase-js'

export async function notifyWOEvent(opts: {
  work_order_id:   string
  wo_number:       string
  title:           string
  customer_name:   string
  event:           WOEvent
  recipient_email: string
  assignee_name?:  string
  scheduled_date?: string
  tech_eta?:       string
  notes?:          string
}): Promise<void> {
  const { work_order_id, recipient_email, event, ...rest } = opts

  const sent = await sendWOEmail(recipient_email, { event, ...rest })

  if (sent) {
    try {
      const db = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      await db.from('wo_notification_log').insert({
        work_order_id,
        event_type:     event,
        recipient_email,
      })
    } catch (_) {
      // non-blocking — log failure silently
    }
  }
}
