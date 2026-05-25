import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { sendEmail } from '@/lib/email-sender'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Helper: send SMS via Twilio REST API ──────────────────────────────────────
async function sendSMS(to: string, body: string): Promise<{ success: boolean; error?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken  = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_FROM_NUMBER

  if (!accountSid || !authToken || !fromNumber) {
    return { success: false, error: 'Twilio env vars not configured' }
  }

  // Normalize phone: strip non-digits, add +1 if no country code
  let phone = to.replace(/\D/g, '')
  if (phone.length === 10) phone = `1${phone}`
  if (!phone.startsWith('+')) phone = `+${phone}`

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        },
        body: new URLSearchParams({
          From: fromNumber,
          To:   phone,
          Body: body,
        }).toString(),
      }
    )

    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { message?: string }
      return { success: false, error: data.message ?? `Twilio HTTP ${res.status}` }
    }

    return { success: true }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'SMS send failed' }
  }
}

// ── Work order notification email HTML ────────────────────────────────────────
function buildWOEmailHTML(opts: {
  subName:      string
  woTitle:      string
  property:     string
  scheduledDate?: string
  message?:     string
}): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://portal.gateguard.co'
  const portalUrl = `${appUrl}/subcontractors/portal`

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
        <!-- Header -->
        <tr><td style="background:#0B1728;padding:20px 32px;">
          <span style="font-family:Arial,sans-serif;font-size:18px;font-weight:700;color:#ffffff;">
            Gate<span style="color:#6B7EFF;">Guard</span>
          </span>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">
          <p style="font-family:Arial,sans-serif;font-size:16px;font-weight:600;color:#1e293b;margin:0 0 8px;">
            Hi ${opts.subName},
          </p>
          <p style="font-family:Arial,sans-serif;font-size:14px;color:#475569;margin:0 0 24px;line-height:1.6;">
            A new work order has been assigned to you. Please log in to the subcontractor portal to review the details and confirm your availability.
          </p>
          <!-- Info table -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:8px;padding:16px;margin-bottom:24px;">
            <tr>
              <td style="font-family:Arial,sans-serif;font-size:12px;color:#94a3b8;padding:6px 0;border-bottom:1px solid #f1f5f9;width:140px;">Work Order</td>
              <td style="font-family:Arial,sans-serif;font-size:13px;color:#1e293b;font-weight:600;padding:6px 0;border-bottom:1px solid #f1f5f9;">${opts.woTitle}</td>
            </tr>
            <tr>
              <td style="font-family:Arial,sans-serif;font-size:12px;color:#94a3b8;padding:6px 0;border-bottom:1px solid #f1f5f9;">Property</td>
              <td style="font-family:Arial,sans-serif;font-size:13px;color:#1e293b;font-weight:600;padding:6px 0;border-bottom:1px solid #f1f5f9;">${opts.property}</td>
            </tr>
            ${opts.scheduledDate ? `
            <tr>
              <td style="font-family:Arial,sans-serif;font-size:12px;color:#94a3b8;padding:6px 0;">Scheduled Date</td>
              <td style="font-family:Arial,sans-serif;font-size:13px;color:#1e293b;font-weight:600;padding:6px 0;">${opts.scheduledDate}</td>
            </tr>` : ''}
          </table>
          ${opts.message ? `<p style="font-family:Arial,sans-serif;font-size:13px;color:#475569;margin:0 0 24px;line-height:1.6;padding:12px 16px;background:#fefce8;border-left:3px solid #eab308;border-radius:6px;">${opts.message}</p>` : ''}
          <!-- CTA -->
          <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
            <tr><td style="border-radius:8px;background:#6B7EFF;">
              <a href="${portalUrl}" style="display:inline-block;font-family:Arial,sans-serif;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;">
                View in Subcontractor Portal
              </a>
            </td></tr>
          </table>
        </td></tr>
        <!-- Footer -->
        <tr><td style="border-top:1px solid #e2e8f0;padding:20px 32px;text-align:center;">
          <p style="font-family:Arial,sans-serif;font-size:12px;color:#94a3b8;margin:0;">
            GateGuard &nbsp;&middot;&nbsp;
            <a href="${appUrl}" style="color:#6B7EFF;text-decoration:none;">portal.gateguard.co</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// POST /api/subcontractors/[id]/notify
// Body: { work_order_id, message? }
// Sends SMS + email to the subcontractor with WO details.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await getCurrentUser()

    const body = await req.json() as { work_order_id?: string; message?: string }
    const { work_order_id, message } = body

    // Fetch subcontractor
    const { data: sub, error: subErr } = await supabase
      .from('subcontractors')
      .select('id, name, email, phone')
      .eq('id', params.id)
      .single()

    if (subErr || !sub) {
      return NextResponse.json({ error: 'Subcontractor not found' }, { status: 404 })
    }

    // Fetch work order (optional — notification can be sent without a WO)
    let woTitle      = 'New Assignment'
    let property     = 'See portal for details'
    let scheduledDate: string | undefined

    if (work_order_id) {
      const { data: wo } = await supabase
        .from('work_orders')
        .select('id, title, scheduled_date, site_id, sites(name)')
        .eq('id', work_order_id)
        .single()

      if (wo) {
        woTitle = wo.title ?? woTitle
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const siteData = wo.sites as any
        property = siteData?.name ?? property
        scheduledDate = wo.scheduled_date ?? undefined
      }
    }

    const smsBody = `[GateGuard] New job assigned: ${woTitle} at ${property}. Login: portal.gateguard.co/subcontractors/portal`

    const results = {
      sms:   { sent: false, error: undefined as string | undefined },
      email: { sent: false, error: undefined as string | undefined },
    }

    // Send SMS
    if (sub.phone) {
      const smsResult = await sendSMS(sub.phone, smsBody)
      results.sms.sent  = smsResult.success
      results.sms.error = smsResult.error
    }

    // Send email
    if (sub.email) {
      const html = buildWOEmailHTML({
        subName:       sub.name,
        woTitle,
        property,
        scheduledDate,
        message,
      })
      const emailResult = await sendEmail({
        to:      sub.email,
        subject: `New Work Order Assigned — ${woTitle}`,
        html,
      })
      results.email.sent  = emailResult.success
      results.email.error = emailResult.error
    }

    return NextResponse.json({
      success:        results.sms.sent || results.email.sent,
      subcontractor:  sub.name,
      work_order:     woTitle,
      notifications:  results,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
