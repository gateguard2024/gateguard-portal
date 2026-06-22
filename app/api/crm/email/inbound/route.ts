import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

// Resend inbound email webhook
// Configure in Resend dashboard: Inbound → catch-all → POST to this URL
// Recommended inbound address: crm@mail.gateguard.co

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json()

    // Resend inbound payload shape
    const fromEmail: string = payload.from?.email ?? payload.from ?? ''
    const fromName:  string = payload.from?.name  ?? ''
    const toEmail:   string = Array.isArray(payload.to)
      ? (payload.to[0]?.email ?? payload.to[0] ?? '')
      : (payload.to?.email ?? payload.to ?? '')
    const subject:   string = payload.subject ?? ''
    const bodyText:  string = payload.text ?? ''
    const bodyHtml:  string = payload.html ?? ''
    const messageId: string = payload.headers?.['message-id'] ?? payload.message_id ?? ''
    const inReplyTo: string = payload.headers?.['in-reply-to'] ?? ''

    // 1. Try to match to an opportunity by from-email → site_contact_email
    let matchedOppId: string | null = null
    if (fromEmail) {
      const { data: opp } = await supabase
        .from('opportunities')
        .select('id')
        .eq('site_contact_email', fromEmail)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      if (opp) matchedOppId = opp.id
    }

    // 2. Try to match to a lead by email
    let matchedLeadId: string | null = null
    if (!matchedOppId && fromEmail) {
      const { data: lead } = await supabase
        .from('leads')
        .select('id')
        .eq('email', fromEmail)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      if (lead) matchedLeadId = lead.id
    }

    // 3. Store inbound email record
    const { data: inbound, error: inboundErr } = await supabase
      .from('crm_inbound_emails')
      .insert({
        from_email:      fromEmail,
        from_name:       fromName,
        to_email:        toEmail,
        subject,
        body_text:       bodyText,
        body_html:       bodyHtml,
        message_id:      messageId,
        in_reply_to:     inReplyTo,
        matched_opp_id:  matchedOppId,
        matched_lead_id: matchedLeadId,
        raw_payload:     payload,
      })
      .select()
      .single()

    if (inboundErr) {
      console.error('Failed to store inbound email:', inboundErr.message)
      return NextResponse.json({ error: inboundErr.message }, { status: 500 })
    }

    // 4. If matched to an opportunity, create an activity so it shows in the feed
    let activityId: string | null = null
    if (matchedOppId && inbound) {
      const { data: activity } = await supabase
        .from('crm_activities')
        .insert({
          opportunity_id:  matchedOppId,
          type:            'email',
          subject:         subject || `Reply from ${fromName || fromEmail}`,
          body:            bodyText.slice(0, 2000), // truncate for activity feed
          from_email:      fromEmail,
          to_email:        toEmail,
          email_status:    'received',
          sent_via_resend: false,
          created_by_name: fromName || fromEmail,
          created_at:      new Date().toISOString(),
        })
        .select()
        .single()

      if (activity) {
        activityId = activity.id
        // Link back to inbound record
        await supabase
          .from('crm_inbound_emails')
          .update({ activity_id: activityId })
          .eq('id', inbound.id)
      }
    }

    return NextResponse.json({
      ok: true,
      inbound_id:     inbound?.id,
      matched_opp_id: matchedOppId,
      matched_lead_id: matchedLeadId,
      activity_id:    activityId,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('Inbound email webhook error:', msg)
    // Always return 200 to Resend so they don't retry
    return NextResponse.json({ ok: false, error: msg })
  }
}
