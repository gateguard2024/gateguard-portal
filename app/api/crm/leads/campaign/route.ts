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
      <img src="data:image/png;base64,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VnoLz7BFSXwQkvjRV7vAlngkOy0QGsUeRVVlJHHQbrn/Djn0zMNWsLAeAz+QBmtKubLWaft6UpmQpvo9iA2Hz+TVUnX2LnKODp+dQO7vGyyqkEms51W36gp7NiTvrsOGvHYONjHGErJmkMaaBWUyq6lm/dffUabW5ulwvulnZ/KW3/RCnE83uAVjp+/FGlt/uqVzfVtL5+ZHXiFBE+GctEDaCDYtqykvlHnVfrv1Z/9bDjy26XW9n9eV+DjQj+OxiaWBhIvwzby82Z557T8Y8h7uHrBzQd7hSVqbA6ErFpZL/ZzK5m9Cbfa0jOOy1tM3EYE38s7fxGL9cWdN485mTEX85Jbe9a0thzY//DJJHIvmpAWDJHFdRaHMqvTb4WMdeD/OrCUS7K1+WYbUWHoyvbjObumMWoe6B7D+VwZ2IqTk9YeuXFQpjU01zfdcVarkfZuq7FtdJ96mxzzHbgvD1hosCoDlUic/+bve9ft3dWz+3YudYGg8hn7iwDhGbBVgg7Ji7JvEFR3fLkf1mjsk9mK52UFMysjCFjHYusWQ96ollZC8Ndd8fV3pZtPmxRDSt6uc5/N9lcBv19tPsU7f+sixdQd2tm/5zQuHIXBB4oDfPx7GsrNc4Z1v6GT67VtRbu/eIDG3Ch2PcJuHYPAdSytl1vya5q9B8qrB6q14Eae+hxL41Ni8JTFeu/EvQeJ9IPFDLxyBNo1duf1cVBrMfTvfED8c5v74wfxICaUFr15aIY3za5W8b0ntOP1N3s7qcfrSnScpPMOWQ+K2LQe7MGjCR/JiN4W3S/qmYM9KEsO+Y3VlIZnpktf78KQkU+/bgIAS+G0A/WS3XPMothBZuzb2qU1dl4+NT67HKhfD6DrCLixvXxvYKSf6oKHMY9+H7Kz89N/8xzsqtt5yjw1LuqXrNp/sRWrY+YsAJfG5/vR/CGU81zE8m+VTCXw20TwLeVE1He1utw7119nzz0J+ZyuL0cJ2K7u8ztYpgWcLUc1HEVAEFAFFQBFQBBQBRUARUAQUAUVAEVAEFAFFQBFQBBQBRUARUAQUAUVAEVAEFAFFQBFQBBQBRUARUAQUAUVAEVAEFAFFQBFQBBQBRUARUAQUAUVAEVAEFAFFQBFQBBQBRUARUAQUAUVAEVAEFAFFQBFQBBQBRUARUAQUAUVAEVAEFAFFQBFQBBQBRUARUAQUAUVAEVAEFAFFQBFQBBQBRUARUAQUAUVAEVAEFAFFQBFQBBQBRUARUAQUAUVAEVAEFAFFQBFQBBQBRUARUAQUAUVAEVAEFAFFQBFQBBQBRUARUAQUAUVAEVAEFAFFQBFQBBQBRUARUAQUAUVAEVAEFAFFQBFQBBQBRUARUAQUAUVAEVAEFAFFQBFQBBQBRUARUAQUAUVAEVAEFAFFQBFQBBQBRUARUAQUAUVAEVAEFAFFQBFQBBQBRUARUAQUAUVAEVAEFAFFQBFQBBQBRUARUAQUAUVAEVAEFAFFQBFQBBQBRUARUAQUAUVAEVAEFAFFQBFQBBQBRUARUAQUAUVAEVAEFAFFQBFQBBQBRUARUAQUAUVAEVAEFAFFQBFQBBQBRUARUAQUAUVAEVAEFAFFQBFQBBQBRUARUAQUgT9oBP4v2ZgFwCmGxX4AAAAASUVORK5CYII=" alt="GateGuard" class="header-logo" />
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

    const { data, error } = await supabase
      .from('show_leads')
      .select('id, name, property_name, email, status')
      .is('status', null)   // only unconverted (null status)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Also include rows where status != 'converted'
    const all = await supabase
      .from('show_leads')
      .select('id, name, property_name, email, status')

    const rows = (all.data || []).filter((r: any) => r.status !== 'converted')
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
    const dryRun = body.dry_run === true

    // Fetch all unconverted show leads
    const { data: rows, error } = await supabase
      .from('show_leads')
      .select('id, name, property_name, email, status')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const eligible = (rows || []).filter(
      (r: any) => r.status !== 'converted' && r.email?.includes('@')
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

    // Send emails in batches of 10 (Resend rate limit)
    const BATCH = 10
    for (let i = 0; i < eligible.length; i += BATCH) {
      const batch = eligible.slice(i, i + BATCH)

      await Promise.all(
        batch.map(async (lead: any) => {
          const { subject, html, text } = buildEmail(lead.name, lead.property_name)
          try {
            const { error: sendError } = await resend.emails.send({
              from:    'Russel Feldman <rfeldman@gateguard.co>',
              to:      [lead.email],
              subject,
              html,
              text,
              replyTo: 'rfeldman@gateguard.co',
            })
            if (sendError) {
              results.failed++
              results.errors.push(`${lead.email}: ${sendError.message}`)
            } else {
              results.sent++
              // Log the outreach on the lead
              void (async () => {
                try {
                  await supabase.from('show_leads').update({
                    notes: `Campaign email sent ${new Date().toLocaleDateString()}`,
                  }).eq('id', lead.id)
                } catch (_) { /* non-blocking */ }
              })()
            }
          } catch (e: any) {
            results.failed++
            results.errors.push(`${lead.email}: ${e.message}`)
          }
        })
      )

      // Small delay between batches
      if (i + BATCH < eligible.length) {
        await new Promise(r => setTimeout(r, 300))
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
