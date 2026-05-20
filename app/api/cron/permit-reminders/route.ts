/**
 * GET /api/cron/permit-reminders
 * Vercel cron — runs daily at 9am UTC.
 * Finds permits expiring in exactly 60, 30, or 7 days and sends email reminders via Resend.
 * Guards against duplicate sends using reminder_sent_at column.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

const REMINDER_DAYS = [60, 30, 7]

export async function GET(req: NextRequest) {
  // Protect from unauthorized calls
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const results: { permit_id: string; days: number; sent: boolean; reason?: string }[] = []

  for (const days of REMINDER_DAYS) {
    const targetDate = new Date(today)
    targetDate.setDate(targetDate.getDate() + days)
    const targetIso = targetDate.toISOString().split('T')[0]

    // Find permits expiring on exactly this date, not yet reminded today, not compliant
    const { data: permits, error } = await supabase
      .from('permits_with_status')
      .select('id, type, label, site_name, expiry_date, status, org_id, issued_by, permit_number, reminder_sent_at')
      .eq('expiry_date', targetIso)
      .neq('status', 'compliant')
      .neq('status', 'no_expiry')

    if (error) {
      console.error('permit-reminders query error:', error.message)
      continue
    }

    for (const permit of (permits ?? [])) {
      // Check if already reminded today
      if (permit.reminder_sent_at) {
        const sentDate = new Date(permit.reminder_sent_at)
        sentDate.setHours(0, 0, 0, 0)
        if (sentDate.getTime() === today.getTime()) {
          results.push({ permit_id: permit.id, days, sent: false, reason: 'already_sent_today' })
          continue
        }
      }

      // Look up org admin email
      const { data: org } = await supabase
        .from('organizations')
        .select('name, contact_email')
        .eq('id', permit.org_id)
        .single()

      const adminEmail = org?.contact_email
      if (!adminEmail) {
        results.push({ permit_id: permit.id, days, sent: false, reason: 'no_org_email' })
        continue
      }

      const permitType = permit.label ?? permit.type?.replace(/_/g, ' ')
      const siteName   = permit.site_name ?? 'Unknown Property'

      // Send via Resend
      let emailSent = false
      if (process.env.RESEND_API_KEY) {
        try {
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'GateGuard Compliance <compliance@gateguard.co>',
              to: [adminEmail],
              subject: `Action Required: Permit expiring in ${days} days — ${permitType} at ${siteName}`,
              html: `
                <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:24px">
                  <div style="background:#6B7EFF;border-radius:8px;padding:16px 20px;margin-bottom:24px">
                    <p style="color:#fff;font-size:14px;font-weight:600;margin:0">GateGuard Compliance Alert</p>
                  </div>
                  <h2 style="font-size:18px;font-weight:700;color:#111;margin-bottom:8px">
                    Permit Expiring in ${days} Days
                  </h2>
                  <p style="color:#555;font-size:14px;line-height:1.6;margin-bottom:16px">
                    The following permit requires your attention:
                  </p>
                  <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
                    <tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888;font-size:13px;width:140px">Property</td><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:13px;font-weight:600">${siteName}</td></tr>
                    <tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888;font-size:13px">Permit Type</td><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:13px;font-weight:600">${permitType}</td></tr>
                    ${permit.permit_number ? `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888;font-size:13px">Permit #</td><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:13px;font-weight:600">${permit.permit_number}</td></tr>` : ''}
                    ${permit.issued_by ? `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888;font-size:13px">Issued By</td><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:13px;font-weight:600">${permit.issued_by}</td></tr>` : ''}
                    <tr><td style="padding:8px 0;color:#888;font-size:13px">Expiry Date</td><td style="padding:8px 0;font-size:13px;font-weight:600;color:#ef4444">${permit.expiry_date}</td></tr>
                  </table>
                  <a href="https://portal.gateguard.co/compliance" style="display:inline-block;background:#6B7EFF;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">
                    View in Portal →
                  </a>
                </div>
              `,
            }),
          })
          emailSent = res.ok
        } catch (e) {
          console.error('Resend error:', e)
        }
      }

      // Mark reminder sent
      await supabase
        .from('permits')
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq('id', permit.id)

      results.push({ permit_id: permit.id, days, sent: emailSent })
    }
  }

  return NextResponse.json({ ok: true, processed: results.length, results })
}
