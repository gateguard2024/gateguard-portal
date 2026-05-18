import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

const resend = new Resend(process.env.RESEND_API_KEY)

function firstName(fullName: string): string {
  return fullName?.split(' ')[0] ?? fullName ?? 'there'
}

function buildEmail(contactName: string, propertyName: string): { subject: string; html: string; text: string } {
  const first  = firstName(contactName)
  const prop   = propertyName && propertyName !== contactName ? propertyName : 'your property'

  const subject = `Great meeting you at the show — let's put real numbers together`

  const text = `Hi ${first},

It was great connecting with you at the show. I wanted to follow up and share a quick look at what GateGuard actually puts in your pocket.

Here's the model that's getting a lot of attention from property managers right now:

  • Residents pay a $150 one-time move-in access fee
  • We bill you $10/month per unit for GateGuard's managed access service
  • We maintain ALL gates, access control, gate cameras, and wiring — no more repair calls or unexpected capital expenses to you

For a 100-unit property like ${prop}, that's $3,000/year in new revenue with near-zero maintenance overhead. That's a direct NOI lift — which rolls straight into cap rate improvement when you're ready to refinance or sell.

I'd love to come out and do a free site evaluation — no cost, no obligation. We'll walk the property, assess what's there, and give you a real number. Usually takes about 30 minutes.

Would any time this week or next work for you?

Russel Feldman
Business Development, GateGuard
rfeldman@gateguard.co
(404) 842-5072

P.S. If you have questions about the model or want to see how other properties in your area are doing it, just reply here — happy to jump on a quick call.`

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { margin: 0; padding: 0; background: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; }
    .wrapper { max-width: 600px; margin: 32px auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; }
    .header { background: #0C111D; padding: 24px 32px; text-align: center; }
    .header-logo { width: 90px; height: auto; display: block; margin: 0 auto; }
    .header-tagline { color: #64748b; font-size: 11px; margin-top: 10px; letter-spacing: 0.5px; text-transform: uppercase; }
    .body { padding: 32px; }
    .greeting { font-size: 16px; color: #0f172a; margin-bottom: 20px; }
    .callout { background: #EBF4FF; border-left: 4px solid #0074D9; border-radius: 0 8px 8px 0; padding: 20px 24px; margin: 24px 0; }
    .callout-title { font-size: 13px; font-weight: 700; color: #0074D9; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }
    .bullet { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px; font-size: 14px; color: #1e293b; }
    .bullet-dot { width: 20px; height: 20px; background: #0074D9; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; }
    .bullet-dot svg { fill: white; }
    .highlight-box { background: #ecfdf5; border: 1px solid #6ee7b7; border-radius: 8px; padding: 16px 20px; margin: 24px 0; }
    .highlight-number { font-size: 24px; font-weight: 800; color: #059669; }
    .highlight-label { font-size: 13px; color: #065f46; margin-top: 2px; }
    p { font-size: 14px; line-height: 1.7; color: #334155; margin: 0 0 16px 0; }
    .cta-button { display: inline-block; background: #0074D9; color: #ffffff !important; text-decoration: none; font-size: 14px; font-weight: 600; padding: 13px 28px; border-radius: 8px; margin: 8px 0 24px 0; }
    .sig { border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 24px; }
    .sig-name { font-weight: 700; color: #0f172a; font-size: 14px; }
    .sig-title { color: #6b7280; font-size: 13px; margin-top: 2px; }
    .sig-contact { color: #0074D9; font-size: 13px; margin-top: 6px; }
    .footer { background: #f8fafc; padding: 16px 32px; text-align: center; }
    .footer-text { font-size: 11px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <img src="https://www.gateguard.co/logo.png" alt="GateGuard" class="header-logo" />
      <div class="header-tagline">The OS for Multifamily Access</div>
    </div>

    <div class="body">
      <p class="greeting">Hi ${first},</p>

      <p>It was great connecting with you at the show. I wanted to follow up and share a quick look at what GateGuard actually puts in your pocket.</p>

      <div class="callout">
        <div class="callout-title">The model property managers are talking about</div>
        <div class="bullet">
          <div class="bullet-dot"><svg viewBox="0 0 8 8" width="8" height="8"><circle cx="4" cy="4" r="3"/></svg></div>
          <div>Residents pay a <strong>$150 one-time move-in access fee</strong></div>
        </div>
        <div class="bullet">
          <div class="bullet-dot"><svg viewBox="0 0 8 8" width="8" height="8"><circle cx="4" cy="4" r="3"/></svg></div>
          <div>We bill you <strong>$10/month per unit</strong> for GateGuard's managed access service</div>
        </div>
        <div class="bullet">
          <div class="bullet-dot"><svg viewBox="0 0 8 8" width="8" height="8"><circle cx="4" cy="4" r="3"/></svg></div>
          <div>We maintain <strong>ALL gates, access control, gate cameras, and wiring</strong> — no more repair calls or unexpected capital expenses to you</div>
        </div>
      </div>

      <div class="highlight-box">
        <div class="highlight-number">$3,000/yr</div>
        <div class="highlight-label">in new revenue for a 100-unit property like ${prop} — direct NOI lift, zero new overhead</div>
      </div>

      <p>That's a direct NOI lift — which rolls straight into cap rate improvement when you're ready to refinance or sell.</p>

      <p>I'd love to come out and do a <strong>free site evaluation</strong> — no cost, no obligation. We'll walk the property, assess what's there, and give you a real number. Usually takes about 30 minutes.</p>

      <a href="mailto:rfeldman@gateguard.co?subject=Site Evaluation - ${encodeURIComponent(prop)}" class="cta-button">Schedule my free site evaluation →</a>

      <p style="font-size:13px;color:#64748b;">If you have questions or want to see how other properties in your area are doing this, just reply — happy to jump on a quick call.</p>

      <div class="sig">
        <div class="sig-name">Russel Feldman</div>
        <div class="sig-title">Business Development, GateGuard</div>
        <div class="sig-contact">rfeldman@gateguard.co &nbsp;·&nbsp; (404) 842-5072</div>
      </div>
    </div>

    <div class="footer">
      <div class="footer-text">GateGuard · Atlanta, GA · <a href="mailto:rfeldman@gateguard.co?subject=Unsubscribe" style="color:#94a3b8;">Unsubscribe</a></div>
    </div>
  </div>
</body>
</html>`

  return { subject, html, text }
}

// GET /api/crm/leads/campaign — preview: returns lead count + sample email
export async function GET(req: NextRequest) {
  try {
    await getCurrentUser()

    // Fetch all show leads (no status column — check converted via opportunities)
    const { data: allLeads, error } = await supabase
      .from('show_leads')
      .select('id, name, property_name, email, notes')
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Find which show_lead_ids already have an opportunity (converted)
    const { data: converted } = await supabase
      .from('opportunities')
      .select('show_lead_id')
      .not('show_lead_id', 'is', null)

    const convertedIds = new Set((converted || []).map((o: any) => o.show_lead_id))

    const rows = (allLeads || []).filter((r: any) => !convertedIds.has(r.id))
    const eligible = rows.filter((r: any) => r.email?.includes('@'))

    // Build sample email from first eligible lead (or placeholder)
    const sample = eligible[0]
    const sampleEmail = buildEmail(
      sample?.name ?? 'Alex Johnson',
      sample?.property_name ?? 'Maple Ridge Apartments'
    )

    return NextResponse.json({
      total:    rows.length,
      eligible: eligible.length,
      skipped:  rows.length - eligible.length,
      preview: {
        to:      sample?.email ?? 'lead@example.com',
        subject: sampleEmail.subject,
        html:    sampleEmail.html,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/crm/leads/campaign — send the campaign
export async function POST(req: NextRequest) {
  try {
    await getCurrentUser()

    const body = await req.json().catch(() => ({}))
    const dryRun  = body.dry_run  === true
    const testRun = body.test_run === true   // sends only to rfeldman@gateguard.co

    // ── TEST MODE: send one email to Russel using first eligible lead as sample ──
    if (testRun) {
      const { data: rows } = await supabase
        .from('show_leads')
        .select('id, name, property_name, email')
      const { data: converted } = await supabase
        .from('opportunities').select('show_lead_id').not('show_lead_id', 'is', null)
      const convertedIds = new Set((converted || []).map((o: any) => o.show_lead_id))
      const eligible = (rows || []).filter(
        (r: any) => !convertedIds.has(r.id) && r.email?.includes('@')
      )
      // Use first eligible lead's name/property for personalization, but send to Russel
      const sample  = eligible[0]
      const name    = sample?.name         ?? 'Alex Johnson'
      const prop    = sample?.property_name ?? 'Maple Ridge Apartments'
      const { subject, html, text } = buildEmail(name, prop)
      const { error: sendError } = await resend.emails.send({
        from:    'Russel Feldman <rfeldman@gateguard.co>',
        to:      ['rfeldman@gateguard.co'],
        subject: `[TEST] ${subject}`,
        html,
        text,
        replyTo: 'rfeldman@gateguard.co',
      })
      if (sendError) {
        return NextResponse.json({ error: sendError.message }, { status: 500 })
      }
      return NextResponse.json({
        test: true,
        sent_to: 'rfeldman@gateguard.co',
        personalized_as: { name, property: prop },
        subject: `[TEST] ${subject}`,
      })
    }

    // Fetch all show leads and exclude ones already converted to an opportunity
    const { data: rows, error } = await supabase
      .from('show_leads')
      .select('id, name, property_name, email')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { data: convertedOpps } = await supabase
      .from('opportunities').select('show_lead_id').not('show_lead_id', 'is', null)
    const convertedIds = new Set((convertedOpps || []).map((o: any) => o.show_lead_id))

    const eligible = (rows || []).filter(
      (r: any) => !convertedIds.has(r.id) && r.email?.includes('@')
    )

    if (eligible.length === 0) {
      return NextResponse.json({ sent: 0, failed: 0, skipped: 0, message: 'No eligible leads with email addresses.' })
    }

    const results = { sent: 0, failed: 0, skipped: 0, errors: [] as string[] }

    if (dryRun) {
      return NextResponse.json({
        dry_run:  true,
        eligible: eligible.length,
        leads:    eligible.map((r: any) => ({ id: r.id, name: r.name, email: r.email })),
      })
    }

    // Use resend.batch.send() — one API call for up to 100 emails, avoids rate-limit errors
    // that happen when firing individual sends concurrently (5 req/sec limit)
    const BATCH = 50  // Resend batch supports up to 100; 50 keeps us safe
    for (let i = 0; i < eligible.length; i += BATCH) {
      const batch = eligible.slice(i, i + BATCH)

      const messages = batch.map((lead: any) => {
        const { subject, html, text } = buildEmail(lead.name, lead.property_name)
        return {
          from:    'Russel Feldman <rfeldman@gateguard.co>',
          to:      [lead.email],
          subject,
          html,
          text,
          replyTo: 'rfeldman@gateguard.co',
        }
      })

      try {
        const { data: batchData, error: batchError } = await (resend.batch as any).send(messages)

        if (batchError) {
          // Whole batch failed — log each as failed
          results.failed += batch.length
          const errName = (batchError as any).name ?? ''
          const errDetail = errName ? `[${errName}] ${batchError.message}` : batchError.message
          batch.forEach((lead: any) => {
            results.errors.push(`${lead.email}: ${errDetail}`)
            void supabase.from('campaign_sends').insert({
              show_lead_id:  lead.id,
              lead_email:    lead.email,
              lead_name:     lead.name,
              campaign_name: 'show_follow_up',
              status:        'failed',
              error_message: errDetail,
              sent_at:       new Date().toISOString(),
            }).then(() => {})
          })
        } else {
          // Individual results — batchData is an array of { id } or error per email
          const batchResults: any[] = Array.isArray(batchData) ? batchData : []
          batch.forEach((lead: any, idx: number) => {
            const r = batchResults[idx]
            if (r && r.error) {
              results.failed++
              const errMsg = r.error.message ?? String(r.error)
              results.errors.push(`${lead.email}: ${errMsg}`)
              void supabase.from('campaign_sends').insert({
                show_lead_id:  lead.id,
                lead_email:    lead.email,
                lead_name:     lead.name,
                campaign_name: 'show_follow_up',
                status:        'failed',
                error_message: errMsg,
                sent_at:       new Date().toISOString(),
              }).then(() => {})
            } else {
              results.sent++
              const resendId = r?.id ?? null
              const sentAt   = new Date().toISOString()
              // Log the send with Resend message ID (needed for open-tracking webhook)
              void supabase.from('campaign_sends').insert({
                show_lead_id:      lead.id,
                lead_email:        lead.email,
                lead_name:         lead.name,
                campaign_name:     'show_follow_up',
                status:            'sent',
                resend_message_id: resendId,
                sent_at:           sentAt,
              }).then(() => {})
              // Log to activity feed so it appears on the lead detail page
              void supabase.from('crm_activities').insert({
                lead_id:         lead.id,
                type:            'email',
                subject:         'Campaign email sent — Show Follow-Up',
                body:            `Personalized follow-up email delivered on ${new Date().toLocaleDateString()}. Resend ID: ${resendId ?? 'pending'}`,
                created_by_name: 'Russel Feldman',
                created_at:      sentAt,
              }).then(() => {})
              // Also stamp the lead notes field for quick visibility in the list
              void supabase.from('show_leads').update({
                notes: `Campaign email sent ${new Date().toLocaleDateString()}`,
              }).eq('id', lead.id).then(() => {})
            }
          })
        }
      } catch (e: any) {
        results.failed += batch.length
        batch.forEach((lead: any) => {
          results.errors.push(`${lead.email}: ${e.message}`)
          void supabase.from('campaign_sends').insert({
            show_lead_id:  lead.id,
            lead_email:    lead.email,
            lead_name:     lead.name,
            campaign_name: 'show_follow_up',
            status:        'failed',
            error_message: e.message,
            sent_at:       new Date().toISOString(),
          }).then(() => {})
        })
      }

      // Small pause between batches if we have more
      if (i + BATCH < eligible.length) {
        await new Promise(r => setTimeout(r, 500))
      }
    }

    return NextResponse.json({
      sent:    results.sent,
      failed:  results.failed,
      skipped: (rows || []).length - results.sent - results.failed,
      errors:  results.errors.length > 0 ? results.errors : undefined,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
