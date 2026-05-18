/**
 * POST /api/signatures/[token]/sign
 * Public endpoint — records counterparty signature, then:
 *   1. Sets status → 'counterparty_signed'
 *   2. Sends notification email to GateGuard (rfeldman@gateguard.co) — action required
 * No auth required; token IS the auth.
 *
 * Body: { signed_name, signed_title? }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { headers } from 'next/headers'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY)
export const dynamic = 'force-dynamic'

const DOC_LABELS: Record<string, string> = {
  nda:                        'Mutual Non-Disclosure Agreement',
  master_agent_agreement:     'Master Agent Agreement',
  dealer_agreement:           'Authorized Dealer Agreement',
  service_agreement:          'Service Agreement',
  install_partner_agreement:  'Installation Partner Agreement',
  sales_partner_agreement:    'Sales Partner Agreement',
}

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const body = await req.json()
    const { signed_name, signed_title } = body

    if (!signed_name?.trim()) {
      return NextResponse.json({ error: 'signed_name is required' }, { status: 400 })
    }

    // Fetch the signature record
    const { data: sig, error: fetchErr } = await supabase
      .from('document_signatures')
      .select('*')
      .eq('token', params.token)
      .single()

    if (fetchErr || !sig) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (new Date(sig.expires_at) < new Date()) {
      await supabase
        .from('document_signatures')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('token', params.token)
      return NextResponse.json({ error: 'This signing link has expired.' }, { status: 410 })
    }

    if (sig.status !== 'pending') {
      return NextResponse.json({ error: `Document is already ${sig.status}.` }, { status: 409 })
    }

    // Capture IP + User-Agent
    void headers() // activate dynamic headers
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? req.headers.get('x-real-ip')
      ?? 'unknown'
    const userAgent = req.headers.get('user-agent') ?? ''
    const now = new Date().toISOString()

    // Record the counterparty signature → status: counterparty_signed
    const { error: updateErr } = await supabase
      .from('document_signatures')
      .update({
        status:               'counterparty_signed',
        signed_name:          signed_name.trim(),
        signed_title:         signed_title?.trim() ?? null,
        signed_ip:            ip,
        signed_user_agent:    userAgent,
        signed_at:            now,
        notification_sent_at: now,
        updated_at:           now,
      })
      .eq('token', params.token)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    // ── Send ACTION REQUIRED notification to GateGuard ────────────────────
    const docLabel    = DOC_LABELS[sig.document_type] ?? sig.document_type
    const baseUrl     = process.env.NEXT_PUBLIC_APP_URL ?? 'https://portal.gateguard.co'
    const oppUrl      = sig.opportunity_id ? `${baseUrl}/crm/opportunities/${sig.opportunity_id}` : `${baseUrl}/crm`
    const signedDate  = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    const company     = sig.signer_company ?? signed_name.trim()

    void (async () => {
      try {
        await resend.emails.send({
          from:    'GateGuard Nexus <documents@mail.gateguard.co>',
          to:      'rfeldman@gateguard.co',
          subject: `✍️ Action Required: Countersign ${docLabel} — ${company}`,
          html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0C111D;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#131B2E;border:1px solid #1E2A45;border-radius:16px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#F59E0B20,#0B1728);padding:28px 32px;border-bottom:1px solid #1E2A45;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
        <div style="width:36px;height:36px;background:#6B7EFF;border-radius:8px;display:flex;align-items:center;justify-content:center;">
          <span style="color:white;font-weight:bold;font-size:14px;">GG</span>
        </div>
        <span style="color:#6B7EFF;font-size:13px;font-weight:600;letter-spacing:0.5px;">GATEGUARD NEXUS</span>
      </div>
      <div style="display:inline-block;background:#F59E0B20;border:1px solid #F59E0B50;border-radius:6px;padding:4px 12px;margin-bottom:10px;">
        <span style="color:#F59E0B;font-size:11px;font-weight:700;letter-spacing:1px;">ACTION REQUIRED</span>
      </div>
      <h1 style="margin:0;color:#F8FAFC;font-size:20px;font-weight:700;">Your Countersignature is Needed</h1>
    </div>
    <div style="padding:28px 32px;">
      <p style="margin:0 0 20px;color:#CBD5E1;font-size:14px;line-height:1.6;">
        <strong style="color:#F8FAFC;">${signed_name.trim()}</strong>
        ${sig.signer_company ? `at <strong style="color:#F8FAFC;">${sig.signer_company}</strong>` : ''}
        has signed the <strong style="color:#F8FAFC;">${docLabel}</strong> on ${signedDate}.
        Your countersignature is required to fully execute this agreement.
      </p>
      <div style="background:#0C111D;border:1px solid #1E2A45;border-radius:10px;padding:16px;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="color:#64748B;font-size:12px;padding:4px 0;width:40%;">Document</td><td style="color:#CBD5E1;font-size:12px;">${docLabel}</td></tr>
          <tr><td style="color:#64748B;font-size:12px;padding:4px 0;">Signed by</td><td style="color:#CBD5E1;font-size:12px;">${signed_name.trim()}${sig.signer_company ? ` · ${sig.signer_company}` : ''}</td></tr>
          <tr><td style="color:#64748B;font-size:12px;padding:4px 0;">Email</td><td style="color:#CBD5E1;font-size:12px;">${sig.signer_email}</td></tr>
          <tr><td style="color:#64748B;font-size:12px;padding:4px 0;">Signed at</td><td style="color:#CBD5E1;font-size:12px;">${signedDate} · IP ${ip}</td></tr>
        </table>
      </div>
      <div style="text-align:center;margin:28px 0;">
        <a href="${oppUrl}" style="display:inline-block;background:#6B7EFF;color:white;text-decoration:none;padding:13px 32px;border-radius:10px;font-weight:600;font-size:14px;">
          Open Opportunity &amp; Countersign →
        </a>
      </div>
      <p style="margin:0;color:#64748B;font-size:11px;text-align:center;line-height:1.6;">
        Open the opportunity in Nexus, find the document in the Documents tab, and click <strong>Sign</strong>.
      </p>
    </div>
  </div>
</body>
</html>`,
        })
      } catch (_) { /* non-blocking */ }
    })()

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
