/**
 * POST /api/signatures/countersign
 * Clerk-authenticated. Records GateGuard's countersignature on a document
 * that the counterparty has already signed (status: 'counterparty_signed').
 *
 * Body: { signature_id, countersigned_name, countersigned_title? }
 *
 * On success:
 *   1. Sets status → 'fully_executed', records countersig fields
 *   2. Optionally advances opportunity stage
 *   3. Sends "Fully Executed" confirmation email to both parties
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { Resend } from 'resend'

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

export async function POST(req: NextRequest) {
  try {
    const caller = await getCurrentUser()
    const { signature_id, countersigned_name, countersigned_title } = await req.json()

    if (!signature_id || !countersigned_name?.trim()) {
      return NextResponse.json({ error: 'signature_id and countersigned_name are required' }, { status: 400 })
    }

    // Fetch the record
    const { data: sig, error: fetchErr } = await supabase
      .from('document_signatures')
      .select('*')
      .eq('id', signature_id)
      .single()

    if (fetchErr || !sig) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    if (sig.status !== 'counterparty_signed') {
      return NextResponse.json({
        error: sig.status === 'fully_executed'
          ? 'This document has already been fully executed.'
          : `Cannot countersign — document status is '${sig.status}'.`
      }, { status: 409 })
    }

    const now = new Date().toISOString()

    // Record countersignature → fully_executed
    const { error: updateErr } = await supabase
      .from('document_signatures')
      .update({
        status:               'fully_executed',
        countersigned_name:   countersigned_name.trim(),
        countersigned_by:     caller.id,
        countersigned_title:  countersigned_title?.trim() ?? 'CEO',
        countersigned_at:     now,
        executed_at:          now,
        updated_at:           now,
      })
      .eq('id', signature_id)

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

    // Advance opportunity stage if specified
    if (sig.advance_stage && sig.opportunity_id) {
      void (async () => {
        try {
          await supabase
            .from('opportunities')
            .update({ stage: sig.advance_stage, updated_at: now })
            .eq('id', sig.opportunity_id)
        } catch (_) {}
      })()
    }

    // Send "Fully Executed" confirmation to counterparty
    const docLabel   = DOC_LABELS[sig.document_type] ?? sig.document_type
    const execDate   = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    const signerFirst = (sig.signed_name ?? sig.signer_name ?? 'there').split(' ')[0]

    void (async () => {
      try {
        await resend.emails.send({
          from:    'GateGuard <documents@gateguard.co>',
          to:      sig.signer_email,
          subject: `✅ Fully Executed: ${docLabel}`,
          html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0C111D;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#131B2E;border:1px solid #1E2A45;border-radius:16px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#10B98120,#0B1728);padding:28px 32px;border-bottom:1px solid #1E2A45;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
        <div style="width:36px;height:36px;background:#6B7EFF;border-radius:8px;display:flex;align-items:center;justify-content:center;">
          <span style="color:white;font-weight:bold;font-size:14px;">GG</span>
        </div>
        <span style="color:#6B7EFF;font-size:13px;font-weight:600;letter-spacing:0.5px;">GATEGUARD NEXUS</span>
      </div>
      <div style="width:52px;height:52px;background:#10B98120;border:2px solid #10B981;border-radius:50%;display:flex;align-items:center;justify-content:center;margin-bottom:12px;font-size:22px;">✓</div>
      <h1 style="margin:0;color:#F8FAFC;font-size:20px;font-weight:700;">Agreement Fully Executed</h1>
      <p style="margin:6px 0 0;color:#94A3B8;font-size:13px;">${docLabel}</p>
    </div>
    <div style="padding:28px 32px;">
      <p style="margin:0 0 20px;color:#CBD5E1;font-size:14px;line-height:1.6;">
        Hi ${signerFirst}, this confirms that the <strong style="color:#F8FAFC;">${docLabel}</strong>
        between you and GateGuard is now fully executed and legally binding. Both parties have signed.
      </p>
      <div style="background:#0C111D;border:1px solid #1E2A45;border-radius:10px;padding:16px;margin-bottom:24px;">
        <p style="margin:0 0 12px;color:#94A3B8;font-size:11px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;">Signature Audit Trail</p>
        <table style="width:100%;border-collapse:collapse;">
          <tr style="border-bottom:1px solid #1E2A45;">
            <td style="color:#64748B;font-size:11px;padding:6px 0;">Party 1</td>
            <td style="color:#CBD5E1;font-size:12px;padding:6px 0;">${sig.signed_name ?? sig.signer_name} · ${sig.signer_email}</td>
          </tr>
          <tr style="border-bottom:1px solid #1E2A45;">
            <td style="color:#64748B;font-size:11px;padding:6px 0;">Signed</td>
            <td style="color:#CBD5E1;font-size:12px;padding:6px 0;">${sig.signed_at ? new Date(sig.signed_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : execDate}</td>
          </tr>
          <tr style="border-bottom:1px solid #1E2A45;">
            <td style="color:#64748B;font-size:11px;padding:6px 0;">Party 2</td>
            <td style="color:#CBD5E1;font-size:12px;padding:6px 0;">${countersigned_name.trim()} · GateGuard</td>
          </tr>
          <tr>
            <td style="color:#64748B;font-size:11px;padding:6px 0;">Countersigned</td>
            <td style="color:#CBD5E1;font-size:12px;padding:6px 0;">${execDate}</td>
          </tr>
        </table>
      </div>
      <p style="margin:0;color:#64748B;font-size:11px;line-height:1.6;text-align:center;">
        This record is binding under the ESIGN Act &amp; UETA. Keep this email as your record.
        Questions? <a href="mailto:rfeldman@gateguard.co" style="color:#6B7EFF;">rfeldman@gateguard.co</a>
      </p>
    </div>
  </div>
</body>
</html>`,
        })
      } catch (_) {}
    })()

    return NextResponse.json({ ok: true, executed_at: now })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
