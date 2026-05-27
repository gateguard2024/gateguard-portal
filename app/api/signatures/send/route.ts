/**
 * POST /api/signatures/send
 * Generates a signing token, stores it, and emails the signer a link.
 *
 * Body: {
 *   document_type, document_version?, document_url?,
 *   opportunity_id?, lead_id?,
 *   signer_name, signer_email, signer_title?, signer_company?,
 *   advance_stage?
 * }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { Resend } from 'resend'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY)
export const dynamic = 'force-dynamic'

const DOC_LABELS: Record<string, string> = {
  nda:                         'Mutual Non-Disclosure Agreement',
  master_agent_agreement:      'Master Agent Agreement',
  dealer_agreement:            'Authorized Dealer Agreement',
  service_agreement:           'Service Agreement',
  install_partner_agreement:   'Installation Partner Agreement',
  sales_partner_agreement:     'Sales Partner Agreement',
}

export async function POST(req: NextRequest) {
  try {
    const caller = await getCurrentUser()
    const body   = await req.json()

    const {
      document_type,
      document_version,
      document_url,
      document_html,   // editable document text sent from wizard
      opportunity_id,
      lead_id,
      org_id,
      signer_name,
      signer_email,
      signer_title,
      signer_company,
      advance_stage,
    } = body

    if (!document_type || !signer_email) {
      return NextResponse.json({ error: 'document_type and signer_email are required' }, { status: 400 })
    }

    // Auto-lookup template if no document_url provided
    let resolvedUrl   = document_url ?? null
    let resolvedVersion = document_version ?? null
    if (!resolvedUrl) {
      const { data: tpl } = await supabase
        .from('document_templates')
        .select('public_url, version')
        .eq('document_type', document_type)
        .eq('is_active', true)
        .neq('public_url', 'PLACEHOLDER_UPDATE_AFTER_UPLOAD')
        .maybeSingle()
      if (tpl) {
        resolvedUrl     = tpl.public_url
        resolvedVersion = resolvedVersion ?? tpl.version
      }
    }

    // Generate a cryptographically secure token
    const token     = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days

    const { data: sig, error } = await supabase
      .from('document_signatures')
      .insert({
        token,
        document_type,
        document_version: resolvedVersion ?? null,
        document_url:     resolvedUrl ?? null,
        opportunity_id:   opportunity_id ?? null,
        lead_id:          lead_id ?? null,
        org_id:           org_id ?? null,
        signer_name:      signer_name ?? null,
        signer_email,
        signer_title:     signer_title ?? null,
        signer_company:   signer_company ?? null,
        sent_by:          caller.id,
        sent_by_name:     caller.name,
        expires_at:       expiresAt,
        advance_stage:    advance_stage ?? null,
        document_html:    document_html ?? null,
        status:           'pending',
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Send the signing email
    const baseUrl    = process.env.NEXT_PUBLIC_APP_URL ?? 'https://portal.gateguard.co'
    const signUrl    = `${baseUrl}/sign/${token}`
    const docLabel   = DOC_LABELS[document_type] ?? document_type
    const signerFirst = (signer_name ?? 'there').split(' ')[0]

    if (!process.env.RESEND_API_KEY) {
      console.error('[signatures/send] RESEND_API_KEY env var is not set')
      return NextResponse.json({
        error: 'Email service not configured — RESEND_API_KEY is missing. The signing record was created but the email was not sent.',
        signature_id: sig.id,
        token,
        email_sent: false,
      }, { status: 503 })
    }

    const { error: emailError } = await resend.emails.send({
      from:    'GateGuard <documents@mail.gateguard.co>',
      to:      signer_email,
      subject: `Action Required: Please sign your ${docLabel}`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0C111D;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#131B2E;border:1px solid #1E2A45;border-radius:16px;overflow:hidden;">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#6B7EFF20,#0B1728);padding:32px 32px 24px;border-bottom:1px solid #1E2A45;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
        <div style="width:36px;height:36px;background:#6B7EFF;border-radius:8px;display:flex;align-items:center;justify-content:center;">
          <span style="color:white;font-weight:bold;font-size:14px;">GG</span>
        </div>
        <span style="color:#6B7EFF;font-size:13px;font-weight:600;letter-spacing:0.5px;">GATEGUARD NEXUS</span>
      </div>
      <h1 style="margin:0;color:#F8FAFC;font-size:22px;font-weight:700;">Document Ready to Sign</h1>
      <p style="margin:8px 0 0;color:#94A3B8;font-size:14px;">${docLabel}</p>
    </div>
    <!-- Body -->
    <div style="padding:32px;">
      <p style="margin:0 0 16px;color:#CBD5E1;font-size:15px;">Hi ${signerFirst},</p>
      <p style="margin:0 0 24px;color:#94A3B8;font-size:14px;line-height:1.6;">
        ${caller.name} at GateGuard has sent you a <strong style="color:#CBD5E1;">${docLabel}</strong> to review and sign.
        Please click the button below to review the document and add your electronic signature.
      </p>
      <!-- CTA -->
      <div style="text-align:center;margin:32px 0;">
        <a href="${signUrl}" style="display:inline-block;background:#6B7EFF;color:white;text-decoration:none;padding:14px 36px;border-radius:10px;font-weight:600;font-size:15px;letter-spacing:0.3px;">
          Review &amp; Sign Document →
        </a>
      </div>
      <!-- Details -->
      <div style="background:#0C111D;border:1px solid #1E2A45;border-radius:10px;padding:16px;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="color:#64748B;font-size:12px;padding:4px 0;width:40%;">Document</td>
            <td style="color:#CBD5E1;font-size:12px;padding:4px 0;">${docLabel}</td>
          </tr>
          <tr>
            <td style="color:#64748B;font-size:12px;padding:4px 0;">Sent by</td>
            <td style="color:#CBD5E1;font-size:12px;padding:4px 0;">${caller.name} · GateGuard</td>
          </tr>
          <tr>
            <td style="color:#64748B;font-size:12px;padding:4px 0;">Expires</td>
            <td style="color:#CBD5E1;font-size:12px;padding:4px 0;">${new Date(expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</td>
          </tr>
        </table>
      </div>
      <p style="margin:0;color:#64748B;font-size:12px;line-height:1.6;">
        If you did not expect this document, you can safely ignore this email.
        This link expires in 30 days. Questions? Reply to this email or contact
        <a href="mailto:rfeldman@gateguard.co" style="color:#6B7EFF;">rfeldman@gateguard.co</a>
      </p>
    </div>
    <!-- Footer -->
    <div style="padding:16px 32px;border-top:1px solid #1E2A45;text-align:center;">
      <p style="margin:0;color:#475569;font-size:11px;">GateGuard · The OS for Multifamily Access · portal.gateguard.co</p>
    </div>
  </div>
</body>
</html>`,
    })

    if (emailError) {
      console.error('[signatures/send] Resend delivery error:', emailError)
      return NextResponse.json({
        error: `Email delivery failed: ${(emailError as { message?: string }).message ?? JSON.stringify(emailError)}. The signing record was created (ID: ${sig.id}) but the email was not sent.`,
        signature_id: sig.id,
        token,
        email_sent: false,
      }, { status: 502 })
    }

    return NextResponse.json({ ok: true, signature_id: sig.id, token, email_sent: true }, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
