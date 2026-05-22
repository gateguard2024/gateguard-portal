/**
 * POST /api/quotes/[id]/send
 *
 * Marks the quote as 'sent', emails the approval link to the client,
 * and CCs rfeldman@gateguard.co so Russel always has a copy.
 *
 * If no client_email on the quote, marks sent but skips email.
 * Safe to call multiple times — re-sends the email each time.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY)

const CC_EMAIL   = 'rfeldman@gateguard.co'
const FROM_NAME  = 'Russel Feldman'
const FROM_EMAIL = 'rfeldman@gateguard.co'
const APP_URL    = process.env.NEXT_PUBLIC_APP_URL ?? 'https://portal.gateguard.co'

function buildQuoteEmail(opts: {
  clientName:    string
  quoteNumber:   string
  propertyName:  string | null
  totalOneTime:  number
  totalMrr:      number
  approvalUrl:   string
  coverMessage:  string | null
  validUntil:    string | null
}): { subject: string; html: string; text: string } {
  const { clientName, quoteNumber, propertyName, totalOneTime, totalMrr, approvalUrl, coverMessage, validUntil } = opts
  const first     = clientName?.split(' ')[0] ?? clientName ?? 'there'
  const propLine  = propertyName ? ` for ${propertyName}` : ''
  const subject   = `Your GateGuard proposal is ready — ${quoteNumber}`
  const expiryLine = validUntil
    ? `This proposal is valid until ${new Date(validUntil).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.`
    : ''

  const coverHtml = coverMessage
    ? coverMessage.split('\n').map(l => `<p>${l}</p>`).join('')
    : `<p>I've put together a proposal${propLine} based on our conversation. Please review the details below and let me know if you have any questions.</p>`

  const text = `Hi ${first},

${coverMessage ?? `I've put together a proposal${propLine} based on our conversation.`}

Review and approve your proposal here:
${approvalUrl}

${totalOneTime > 0 ? `One-Time Total: $${totalOneTime.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : ''}
${totalMrr > 0 ? `Monthly (MRR): $${totalMrr.toLocaleString('en-US', { minimumFractionDigits: 2 })}/mo` : ''}
${expiryLine}

Reply to this email with any questions — happy to hop on a call.

${FROM_NAME}
Business Development, GateGuard
${FROM_EMAIL}
(404) 842-5072`

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    body { margin:0; padding:0; background:#f8fafc; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif; }
    .wrap { max-width:600px; margin:32px auto; background:#fff; border-radius:12px; overflow:hidden; border:1px solid #e2e8f0; }
    .hdr  { background:#0C111D; padding:24px 32px; }
    .hdr-logo { color:#fff; font-size:18px; font-weight:700; letter-spacing:-.3px; }
    .hdr-tag  { color:#6B7EFF; font-size:10px; font-weight:700; letter-spacing:1px; text-transform:uppercase; margin-top:6px; }
    .body { padding:32px; }
    .qnum { display:inline-block; background:#EEF0FF; color:#6B7EFF; font-size:11px; font-weight:700; letter-spacing:.5px; padding:3px 10px; border-radius:999px; margin-bottom:20px; }
    p { font-size:14px; line-height:1.75; color:#334155; margin:0 0 14px; }
    .totals { background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:16px 20px; margin:20px 0; }
    .total-row { display:flex; justify-content:space-between; font-size:14px; color:#1e293b; margin-bottom:6px; }
    .total-row:last-child { margin-bottom:0; font-weight:700; }
    .total-label { color:#64748b; }
    .cta { text-align:center; margin:28px 0; }
    .cta-btn { display:inline-block; background:linear-gradient(135deg,#6B7EFF 0%,#3B4FCC 100%); color:#fff!important; text-decoration:none; font-size:15px; font-weight:600; padding:14px 36px; border-radius:10px; box-shadow:0 4px 14px rgba(107,126,255,.35); }
    .expiry { text-align:center; font-size:12px; color:#94a3b8; margin-top:-12px; }
    .sig { border-top:1px solid #e2e8f0; padding-top:20px; margin-top:24px; }
    .sig-name { font-weight:700; color:#0f172a; font-size:14px; }
    .sig-info { color:#64748b; font-size:13px; margin-top:3px; }
    .sig-link { color:#6B7EFF; font-size:13px; }
    .ftr { background:#f8fafc; padding:14px 32px; text-align:center; }
    .ftr p { font-size:11px; color:#94a3b8; margin:0; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hdr">
      <div class="hdr-logo">GateGuard</div>
      <div class="hdr-tag">The OS for Multifamily Access</div>
    </div>
    <div class="body">
      <div class="qnum">Proposal ${quoteNumber}</div>
      <p>Hi ${first},</p>
      ${coverHtml}
      ${(totalOneTime > 0 || totalMrr > 0) ? `
      <div class="totals">
        ${totalOneTime > 0 ? `<div class="total-row"><span class="total-label">One-Time Total</span><span>$${totalOneTime.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>` : ''}
        ${totalMrr > 0     ? `<div class="total-row"><span class="total-label">Monthly (MRR)</span><span>$${totalMrr.toLocaleString('en-US', { minimumFractionDigits: 2 })}/mo</span></div>` : ''}
      </div>` : ''}
      <div class="cta">
        <a href="${approvalUrl}" class="cta-btn">Review &amp; Approve Proposal →</a>
      </div>
      ${expiryLine ? `<p class="expiry">${expiryLine}</p>` : ''}
      <p>Reply to this email with any questions — happy to hop on a call.</p>
      <div class="sig">
        <div class="sig-name">${FROM_NAME}</div>
        <div class="sig-info">Business Development · GateGuard</div>
        <div class="sig-link">${FROM_EMAIL} · (404) 842-5072</div>
      </div>
    </div>
    <div class="ftr">
      <p>GateGuard · The OS for Multifamily Access · <a href="${APP_URL}" style="color:#94a3b8;">portal.gateguard.co</a></p>
    </div>
  </div>
</body>
</html>`

  return { subject, html, text }
}

// ─── Route handler ─────────────────────────────────────────────────────────

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()

    // Fetch the quote
    const { data: quote, error: qErr } = await supabase
      .from('quotes')
      .select('id, quote_number, org_id, client_name, client_email, property_name, total_one_time, total_mrr, cover_message, valid_until, expiry_date, status, share_token')
      .eq('id', params.id)
      .single()

    if (qErr || !quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })

    // Build approval URL
    const approvalUrl = `${APP_URL}/quotes/${params.id}/approve`

    // Mark quote as sent + set sent_at
    const { data: updated, error: patchErr } = await supabase
      .from('quotes')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', params.id)
      .select()
      .single()

    if (patchErr) return NextResponse.json({ error: patchErr.message }, { status: 500 })

    // ── Send email if client_email exists ──────────────────────────────────
    let email_sent = false
    let email_error: string | null = null

    if (quote.client_email && process.env.RESEND_API_KEY) {
      const { subject, html, text } = buildQuoteEmail({
        clientName:   quote.client_name ?? 'there',
        quoteNumber:  quote.quote_number,
        propertyName: quote.property_name,
        totalOneTime: quote.total_one_time ?? 0,
        totalMrr:     quote.total_mrr ?? 0,
        approvalUrl,
        coverMessage: quote.cover_message,
        validUntil:   quote.expiry_date ?? quote.valid_until,
      })

      const { error: emailErr } = await resend.emails.send({
        from:    `${FROM_NAME} <${FROM_EMAIL}>`,
        to:      quote.client_email,
        cc:      CC_EMAIL,                // ← always CC Russel
        replyTo: FROM_EMAIL,
        subject,
        html,
        text,
      })

      if (emailErr) {
        email_error = (emailErr as any).message ?? 'Email send failed'
        console.error('[quotes/send] email error:', email_error)
      } else {
        email_sent = true
      }
    }

    return NextResponse.json({
      ok:          true,
      quote:       updated,
      email_sent,
      email_to:    quote.client_email ?? null,
      email_cc:    CC_EMAIL,
      email_error,
      approval_url: approvalUrl,
      message: email_sent
        ? `Quote marked sent. Email delivered to ${quote.client_email} (CC: ${CC_EMAIL}).`
        : quote.client_email
        ? `Quote marked sent. Email failed: ${email_error}`
        : 'Quote marked sent. No client email on file — no email sent.',
    })

  } catch (err: any) {
    console.error('[quotes/send]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
