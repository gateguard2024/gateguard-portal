/**
 * POST /api/signatures/countersign
 * Clerk-authenticated. Records GateGuard's countersignature on a document
 * that the counterparty has already signed (status: 'counterparty_signed').
 *
 * Body: { signature_id, countersigned_name, countersigned_title? }
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
const DOCUMENTS_FROM_EMAIL = process.env.RESEND_DOCUMENTS_FROM_EMAIL ?? 'GateGuard <documents@gateguard.co>'
export const dynamic = 'force-dynamic'

const BUCKET = 'document-templates'

const DOC_LABELS: Record<string, string> = {
  nda: 'Mutual Non-Disclosure Agreement',
  master_agent_agreement: 'Master Agent Agreement',
  master_dealer_agreement: 'MSO Agreement',
  dealer_agreement: 'Authorized Dealer Agreement',
  service_agreement: 'Service Agreement',
  install_partner_agreement: 'Installation Partner Agreement',
  sales_partner_agreement: 'Sales Partner Agreement',
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function buildExecutedHtml({ sig, docLabel, countersignedName, countersignedTitle, executedAt }: { sig: any; docLabel: string; countersignedName: string; countersignedTitle: string; executedAt: string }) {
  const counterpartyName = sig.signed_name ?? sig.signer_name ?? 'Counterparty'
  const counterpartyTitle = sig.signed_title ?? sig.signer_title ?? ''
  const signedAt = sig.signed_at ?? executedAt
  const body = sig.document_html || `Document: ${docLabel}`

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(docLabel)} — Fully Executed</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111827; line-height: 1.55; padding: 40px; }
    .header { border-bottom: 2px solid #111827; padding-bottom: 16px; margin-bottom: 24px; }
    .kicker { font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: #4f46e5; font-weight: 700; }
    h1 { margin: 6px 0 0; font-size: 24px; }
    .box { border: 1px solid #d1d5db; border-radius: 12px; padding: 18px; margin: 22px 0; background: #f9fafb; }
    .row { display: flex; gap: 20px; margin: 8px 0; }
    .label { width: 150px; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; }
    .value { font-weight: 600; }
    .doc { white-space: pre-wrap; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; margin-top: 24px; }
    .siggrid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 24px; }
    .sig { border-top: 1px solid #111827; padding-top: 10px; }
    .small { font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="header"><div class="kicker">GateGuard Nexus — Fully Executed Document</div><h1>${escapeHtml(docLabel)}</h1></div>
  <div class="box">
    <div class="row"><div class="label">Status</div><div class="value">Fully Executed</div></div>
    <div class="row"><div class="label">Executed At</div><div class="value">${escapeHtml(new Date(executedAt).toLocaleString('en-US'))}</div></div>
    <div class="row"><div class="label">Signer</div><div class="value">${escapeHtml(counterpartyName)}${counterpartyTitle ? `, ${escapeHtml(counterpartyTitle)}` : ''}</div></div>
    <div class="row"><div class="label">Signer Email</div><div class="value">${escapeHtml(sig.signer_email)}</div></div>
    <div class="row"><div class="label">Countersigned By</div><div class="value">${escapeHtml(countersignedName)}${countersignedTitle ? `, ${escapeHtml(countersignedTitle)}` : ''}</div></div>
  </div>
  <div class="doc">${escapeHtml(body)}</div>
  <div class="siggrid">
    <div class="sig"><div class="value">${escapeHtml(counterpartyName)}</div><div class="small">Counterparty signature • ${escapeHtml(new Date(signedAt).toLocaleString('en-US'))}</div></div>
    <div class="sig"><div class="value">${escapeHtml(countersignedName)}</div><div class="small">GateGuard countersignature • ${escapeHtml(new Date(executedAt).toLocaleString('en-US'))}</div></div>
  </div>
  <p class="small" style="margin-top:32px;">This electronic record is intended to be retained as the fully executed signing certificate and document copy.</p>
</body>
</html>`
}

async function storeExecutedCertificate(sig: any, html: string) {
  try {
    const safeType = String(sig.document_type ?? 'document').replace(/[^a-zA-Z0-9_-]/g, '_')
    const safeId = String(sig.id).replace(/[^a-zA-Z0-9_-]/g, '_')
    const orgOrRecord = sig.org_id || sig.opportunity_id || sig.lead_id || 'unlinked'
    const path = `executed/${orgOrRecord}/${Date.now()}_${safeType}_${safeId}.html`
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, Buffer.from(html, 'utf8'), {
        contentType: 'text/html; charset=utf-8',
        upsert: false,
      })
    if (error) return { url: null, warning: error.message }
    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)
    return { url: publicUrl, warning: null }
  } catch (error) {
    return { url: null, warning: error instanceof Error ? error.message : 'Could not store executed certificate.' }
  }
}

export async function POST(req: NextRequest) {
  try {
    const caller = await getCurrentUser()
    const { signature_id, countersigned_name, countersigned_title } = await req.json()

    if (!signature_id || !countersigned_name?.trim()) {
      return NextResponse.json({ error: 'signature_id and countersigned_name are required' }, { status: 400 })
    }

    const { data: sig, error: fetchErr } = await supabase
      .from('document_signatures')
      .select('*')
      .eq('id', signature_id)
      .single()

    if (fetchErr || !sig) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

    if (sig.status !== 'counterparty_signed') {
      return NextResponse.json({
        error: sig.status === 'fully_executed' ? 'This document has already been fully executed.' : `Cannot countersign — document status is '${sig.status}'.`,
      }, { status: 409 })
    }

    const now = new Date().toISOString()
    const docLabel = DOC_LABELS[sig.document_type] ?? sig.document_type
    const countersignedName = countersigned_name.trim()
    const countersignedTitle = countersigned_title?.trim() ?? 'CEO'
    const executedHtml = buildExecutedHtml({ sig, docLabel, countersignedName, countersignedTitle, executedAt: now })
    const stored = await storeExecutedCertificate(sig, executedHtml)

    // executed_cert_url: relative path for internal links (dealer detail, onboarding board)
    // certAbsoluteUrl: absolute URL for the email — points to the PUBLIC /sign/[token] page
    // so the client is never sent to a portal.gateguard.co/api/ path
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://portal.gateguard.co').replace(/\/$/, '')
    const certUrl = `/api/signatures/${signature_id}/cert`
    // The signer already has access to /sign/[token] — after countersigning it shows the
    // executed certificate inline. Use that as the public "final copy" link in emails.
    const signerCertUrl = sig.token ? `${baseUrl}/sign/${sig.token}` : `${baseUrl}${certUrl}`
    const certAbsoluteUrl = signerCertUrl

    const { error: updateErr } = await supabase
      .from('document_signatures')
      .update({
        status: 'fully_executed',
        countersigned_name: countersignedName,
        countersigned_by: caller.id,
        countersigned_title: countersignedTitle,
        countersigned_at: now,
        executed_at: now,
        executed_cert_url: certUrl,
        document_html: executedHtml,   // overwrite with full certificate — original no longer needed
        updated_at: now,
      })
      .eq('id', signature_id)

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

    if (sig.advance_stage && sig.opportunity_id) {
      void (async () => {
        try {
          await supabase.from('opportunities').update({ stage: sig.advance_stage, updated_at: now }).eq('id', sig.opportunity_id)
        } catch {}
      })()
    }

    const execDate = new Date(now).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    const signerFirst = (sig.signed_name ?? sig.signer_name ?? 'there').split(' ')[0]
    const executedLink = `<p style="margin:18px 0 0;color:#94A3B8;font-size:13px;line-height:1.6;">Executed document: <a href="${certAbsoluteUrl}" style="color:#6B7EFF;">Open final copy</a></p>`

    if (process.env.RESEND_API_KEY) {
      void (async () => {
        try {
          const confirmationHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0C111D;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#131B2E;border:1px solid #1E2A45;border-radius:16px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#10B98120,#0B1728);padding:28px 32px;border-bottom:1px solid #1E2A45;">
      <div style="width:52px;height:52px;background:#10B98120;border:2px solid #10B981;border-radius:50%;display:flex;align-items:center;justify-content:center;margin-bottom:12px;font-size:22px;">✓</div>
      <h1 style="margin:0;color:#F8FAFC;font-size:20px;font-weight:700;">Agreement Fully Executed</h1>
      <p style="margin:6px 0 0;color:#94A3B8;font-size:13px;">${docLabel}</p>
    </div>
    <div style="padding:28px 32px;">
      <p style="margin:0 0 20px;color:#CBD5E1;font-size:14px;line-height:1.6;">Hi ${signerFirst}, this confirms that the <strong style="color:#F8FAFC;">${docLabel}</strong> between you and GateGuard is now fully executed. Both parties have signed.</p>
      <div style="background:#0C111D;border:1px solid #1E2A45;border-radius:10px;padding:16px;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="color:#64748B;font-size:11px;padding:6px 0;">Party 1</td><td style="color:#CBD5E1;font-size:12px;padding:6px 0;">${sig.signed_name ?? sig.signer_name} · ${sig.signer_email}</td></tr>
          <tr><td style="color:#64748B;font-size:11px;padding:6px 0;">Party 2</td><td style="color:#CBD5E1;font-size:12px;padding:6px 0;">${countersignedName} · GateGuard</td></tr>
          <tr><td style="color:#64748B;font-size:11px;padding:6px 0;">Executed</td><td style="color:#CBD5E1;font-size:12px;padding:6px 0;">${execDate}</td></tr>
        </table>
        ${executedLink}
      </div>
      <p style="margin:0;color:#64748B;font-size:11px;line-height:1.6;text-align:center;">Keep this email as your record. Questions? <a href="mailto:rfeldman@gateguard.co" style="color:#6B7EFF;">rfeldman@gateguard.co</a></p>
    </div>
  </div>
</body>
</html>`

          await resend.emails.send({
            from: DOCUMENTS_FROM_EMAIL,
            to: sig.signer_email,
            replyTo: 'rfeldman@gateguard.co',
            subject: `Fully Executed: ${docLabel}`,
            html: confirmationHtml,
          })

          await resend.emails.send({
            from: DOCUMENTS_FROM_EMAIL,
            to: 'rfeldman@gateguard.co',
            replyTo: 'rfeldman@gateguard.co',
            subject: `Fully Executed Copy: ${docLabel} — ${sig.signer_company ?? sig.signer_email}`,
            html: confirmationHtml,
          })
        } catch {}
      })()
    }

    return NextResponse.json({ ok: true, executed_at: now, executed_cert_url: certUrl, cert_url: certAbsoluteUrl, storage_warning: stored.warning })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
