import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY!)
export const dynamic = 'force-dynamic'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://portal.gateguard.co'
const FROM_EMAIL = 'GateGuard CRM <crm@mail.gateguard.co>'

// Build a 1x1 transparent tracking pixel tag
function trackingPixel(activityId: string): string {
  return `<img src="${BASE_URL}/api/track/open?id=${activityId}" width="1" height="1" style="display:none" alt="" />`
}

// Wrap plain text in minimal branded HTML
function buildHtml(body: string, activityId: string, signerName: string): string {
  const escaped = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Arial,sans-serif;font-size:14px;color:#1a1a2e;line-height:1.6;max-width:600px;margin:0 auto;padding:24px">
  <div style="margin-bottom:24px">
    ${escaped}
  </div>
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
  <div style="font-size:12px;color:#64748b">
    <strong style="color:#6B7EFF">GateGuard</strong> · The Operating System for Multifamily Access<br>
    ${signerName} · rfeldman@gateguard.co · 844-694-2283
  </div>
  ${trackingPixel(activityId)}
</body>
</html>`
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      opportunity_id,
      lead_id,
      show_lead_id,   // for show leads (show_leads table) — separate FK
      to_email,
      to_name,
      subject,
      body: emailBody,
      sender_name = 'Russel Feldman',
      sender_initials = 'RF',
    } = body

    if (!to_email || !subject || !emailBody) {
      return NextResponse.json({ error: 'to_email, subject, and body are required' }, { status: 400 })
    }

    // 1. Create the activity record first so we have the ID for the pixel
    // Validate lead_id as a proper UUID — reject show_ prefixed IDs (those use show_lead_id)
    const safeLeadId = lead_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lead_id)
      ? lead_id
      : null
    const safeShowLeadId = show_lead_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(show_lead_id)
      ? show_lead_id
      : null

    const { data: activity, error: actErr } = await supabase
      .from('crm_activities')
      .insert({
        opportunity_id: opportunity_id ?? null,
        lead_id:        safeLeadId,
        show_lead_id:   safeShowLeadId ?? null,
        type:           'email',
        subject,
        body:           emailBody,
        to_email,
        from_email:     'crm@mail.gateguard.co',
        email_status:   'sending',
        sent_via_resend: false,
        created_by_name: sender_name,
        created_at:     new Date().toISOString(),
      })
      .select()
      .single()

    if (actErr || !activity) {
      return NextResponse.json({ error: actErr?.message ?? 'Failed to create activity' }, { status: 500 })
    }

    // 2. Send via Resend with tracking pixel embedded in HTML
    const html = buildHtml(emailBody, activity.id, sender_name)

    const { data: sent, error: sendErr } = await resend.emails.send({
      from: FROM_EMAIL,
      to:   to_name ? `${to_name} <${to_email}>` : to_email,
      subject,
      text: emailBody, // plain text fallback
      html,
    })

    if (sendErr || !sent) {
      // Mark as failed but don't delete — keep audit trail
      await supabase
        .from('crm_activities')
        .update({ email_status: 'failed' })
        .eq('id', activity.id)
      return NextResponse.json({ error: sendErr?.message ?? 'Resend failed' }, { status: 500 })
    }

    // 3. Update activity with Resend message ID and sent status
    const { data: updated } = await supabase
      .from('crm_activities')
      .update({
        sent_via_resend:   true,
        resend_message_id: sent.id,
        email_status:      'sent',
      })
      .eq('id', activity.id)
      .select()
      .single()

    // 4. If this email is for an opportunity, log a stage history note (non-blocking)
    if (opportunity_id) {
      void (async () => {
        try {
          await supabase.from('opportunity_stage_history').insert({
            opportunity_id,
            stage: 'email_sent',
            changed_at: new Date().toISOString(),
            changed_by: sender_name,
          })
        } catch (_) { /* non-blocking */ }
      })()
    }

    return NextResponse.json(updated ?? activity, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
