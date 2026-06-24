/**
 * POST /api/nexus/internal/dealer-onboarding/send-document
 *
 * Sends (or resends) an NDA or dealer agreement signing link to a dealer org.
 * Reuses an existing pending record if one is still live; creates a new one otherwise.
 *
 * The document body is ALWAYS built from the maintained templates in
 * lib/nda-template.ts / lib/agreement-template.ts (never a stale uploaded PDF),
 * stamped with a glass public_slug, and the signer is sent the glass
 * /document/[slug] portal link.
 *
 * Body: { org_id: string, kind: 'nda' | 'agreement' }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { getCurrentUser } from '@/lib/current-user'
import { buildNdaHtml } from '@/lib/nda-template'
import { buildAgreementText, buildAgreementVarsFromOrg } from '@/lib/agreement-template'
import { generateSecureToken, generatePublicSlug, publicDocUrl } from '@/lib/doc-slug'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM =
  process.env.RESEND_DOCUMENTS_FROM_EMAIL ?? 'GateGuard Nexus <documents@nexus.gateguard.co>'

const AGREEMENT_BY_TIER: Record<string, string> = {
  master_agent:       'master_agent_agreement',
  master_dealer:      'dealer_agreement',
  full_dealer:        'dealer_agreement',
  service_dealer:     'service_agreement',
  install_contractor: 'install_partner_agreement',
  sales_partner:      'sales_partner_agreement',
}

const DOC_LABELS: Record<string, string> = {
  nda:                      'Mutual Non-Disclosure Agreement',
  master_agent_agreement:   'Master Agent Agreement',
  dealer_agreement:         'Authorized Dealer Agreement',
  service_agreement:        'Service Agreement',
  install_partner_agreement:'Installation Partner Agreement',
  sales_partner_agreement:  'Sales Partner Agreement',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OrgRow = Record<string, any> & {
  id: string
  name: string | null
  org_tier: string | null
  parent_org_id: string | null
}

type SignatureRow = {
  id: string
  token: string
  document_type: string
  status: string | null
  expires_at: string | null
  signer_name: string | null
  signer_email: string
  public_slug: string | null
  document_html: string | null
}

function canReuse(sig: SignatureRow) {
  const status = String(sig.status ?? '').toLowerCase()
  if (['counterparty_signed', 'fully_executed', 'signed', 'completed', 'cancelled', 'declined'].includes(status)) return false
  if (sig.expires_at && new Date(sig.expires_at) < new Date()) return false
  return true
}

/** Compose a best-effort mailing address from whatever the org row has. */
function orgAddress(org: OrgRow): string {
  const parts = [org.address || org.street, org.city, org.state, org.zip || org.postal_code].filter(Boolean)
  return parts.length ? parts.join(', ') : 'Address on file'
}

function entityDescriptor(org: OrgRow): string {
  const state = org.state ? `${org.state} ` : ''
  const entity = org.entity_type || 'limited liability company'
  return `${state}${entity}`.trim()
}

/** Build the maintained document body for this document type + org. */
function buildDocumentHtml(documentType: string, org: OrgRow): string {
  const effectiveDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const dealerLegalName = org.name || 'Dealer'

  if (documentType === 'nda') {
    return buildNdaHtml({
      effectiveDate,
      dealerLegalName,
      dealerStateAndEntityType: entityDescriptor(org),
      dealerAddress: orgAddress(org),
    })
  }

  // All agreement variants share the maintained agreement template (tier-aware).
  const vars = buildAgreementVarsFromOrg({
    effectiveDate,
    dealerLegalName,
    dealerStateAndEntityType: entityDescriptor(org),
    dealerAddress: orgAddress(org),
    approvedTerritory: org.territory || org.approved_territory || 'As mutually agreed',
    orgTier: org.org_tier ?? 'full_dealer',
  })
  return buildAgreementText(vars)
}

async function sendEmail({
  sig,
  org,
  callerName,
  signUrl,
}: {
  sig: SignatureRow
  org: OrgRow
  callerName: string
  signUrl: string
}) {
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is missing.')

  const docLabel = DOC_LABELS[sig.document_type] ?? sig.document_type
  const firstName = (sig.signer_name ?? 'there').split(' ')[0]
  const orgName = org.name ?? 'your organization'
  const expires = sig.expires_at
    ? new Date(sig.expires_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '30 days'

  const { error } = await resend.emails.send({
    from: FROM,
    to: sig.signer_email,
    replyTo: 'rfeldman@gateguard.co',
    subject: `Action Required: Please sign your ${docLabel}`,
    html: `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0C111D;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#131B2E;border:1px solid #1E2A45;border-radius:16px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#6B7EFF20,#0B1728);padding:28px 32px;border-bottom:1px solid #1E2A45;">
      <h1 style="margin:0;color:#F8FAFC;font-size:20px;font-weight:700;">${docLabel}</h1>
      <p style="margin:6px 0 0;color:#94A3B8;font-size:13px;">Signature requested by GateGuard</p>
    </div>
    <div style="padding:28px 32px;">
      <p style="margin:0 0 14px;color:#CBD5E1;font-size:14px;line-height:1.6;">Hi ${firstName}, ${callerName} at GateGuard sent this document for <strong style="color:#F8FAFC;">${orgName}</strong>. Please review and sign using the secure link below.</p>
      <p style="margin:24px 0;text-align:center;">
        <a href="${signUrl}" style="background:#6B7EFF;color:white;padding:13px 22px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block;">Review &amp; Sign Document</a>
      </p>
      <p style="margin:0;color:#64748B;font-size:11px;line-height:1.6;">This signing link expires on ${expires}. Questions? Reply to this email or contact <a href="mailto:rfeldman@gateguard.co" style="color:#6B7EFF;">rfeldman@gateguard.co</a>.</p>
    </div>
  </div>
</body></html>`,
  })

  if (error) throw new Error((error as { message?: string }).message ?? JSON.stringify(error))
}

export async function POST(req: NextRequest) {
  try {
    const caller = await getCurrentUser()

    if (!caller.isCorporate && !caller.isMasterAgent && !caller.isMasterDealer) {
      return NextResponse.json({ success: false, message: 'You do not have access to send dealer documents.' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const orgId = String(body.org_id ?? '').trim()
    const kind  = String(body.kind  ?? '').trim()

    if (!orgId) return NextResponse.json({ success: false, message: 'org_id is required.' }, { status: 400 })
    if (kind !== 'nda' && kind !== 'agreement') return NextResponse.json({ success: false, message: 'kind must be nda or agreement.' }, { status: 400 })

    const { data: org, error: orgError } = await supabase.from('organizations').select('*').eq('id', orgId).single()
    if (orgError || !org) return NextResponse.json({ success: false, message: 'Dealer organization not found.' }, { status: 404 })

    const orgRow = org as OrgRow

    if (!caller.isCorporate && caller.org_id !== orgRow.parent_org_id && caller.org_id !== orgRow.id) {
      return NextResponse.json({ success: false, message: 'You can only send documents for your own dealer network.' }, { status: 403 })
    }

    const documentType = kind === 'nda' ? 'nda' : AGREEMENT_BY_TIER[orgRow.org_tier ?? ''] ?? 'dealer_agreement'
    const signerEmail = orgRow.contact_email || orgRow.email
    const signerName  = orgRow.contact_name  || orgRow.name || 'Partner signer'

    if (!signerEmail) {
      return NextResponse.json({ success: false, message: 'This dealer needs a contact email before a signing link can be sent.' }, { status: 400 })
    }

    const { data: existing } = await supabase
      .from('document_signatures')
      .select('id,token,document_type,status,expires_at,signer_name,signer_email,public_slug,document_html')
      .eq('org_id', orgId)
      .eq('document_type', documentType)
      .order('sent_at', { ascending: false })
      .limit(5)

    let sig = ((existing ?? []) as SignatureRow[]).find(canReuse)
    const reused = !!sig

    if (!sig) {
      const token      = generateSecureToken()
      const publicSlug = generatePublicSlug(orgRow.name)
      const expiresAt  = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      const documentHtml = buildDocumentHtml(documentType, orgRow)

      const { data: created, error: createError } = await supabase
        .from('document_signatures')
        .insert({
          token,
          public_slug:      publicSlug,
          org_id:           orgId,
          document_type:    documentType,
          document_version: documentType === 'nda' ? 'nda-v2' : 'agreement-v2',
          document_html:    documentHtml,
          signer_name:      signerName,
          signer_email:     signerEmail,
          signer_company:   orgRow.name,
          sent_by:          caller.id,
          sent_by_name:     caller.name,
          expires_at:       expiresAt,
          status:           'pending',
        })
        .select('id,token,document_type,status,expires_at,signer_name,signer_email,public_slug,document_html')
        .single()

      if (createError || !created) throw new Error(createError?.message ?? 'Could not create signing record.')
      sig = created as SignatureRow
    } else if (!sig.public_slug || !sig.document_html) {
      // Backfill older reused records so the glass link + correct template apply.
      const backfill: Record<string, unknown> = {}
      if (!sig.public_slug) backfill.public_slug = generatePublicSlug(orgRow.name)
      if (!sig.document_html) { backfill.document_html = buildDocumentHtml(documentType, orgRow); backfill.document_version = documentType === 'nda' ? 'nda-v2' : 'agreement-v2' }
      const { data: patched } = await supabase
        .from('document_signatures').update(backfill).eq('id', sig.id)
        .select('id,token,document_type,status,expires_at,signer_name,signer_email,public_slug,document_html').single()
      if (patched) sig = patched as SignatureRow
    }

    // Always link the signer to the glass public portal.
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://portal.gateguard.co').replace(/\/$/, '')
    const signUrl = sig.public_slug ? publicDocUrl(sig.public_slug) : `${baseUrl}/sign/${sig.token}`

    await sendEmail({ sig, org: orgRow, callerName: caller.name, signUrl })

    await supabase
      .from('document_signatures')
      .update({ sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', sig.id)

    return NextResponse.json({
      success:                true,
      signature_id:           sig.id,
      reused_existing_record: reused,
      public_url:             signUrl,
      message:                `${DOC_LABELS[documentType] ?? documentType} sent to ${signerEmail}.`,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Could not send dealer document.' },
      { status: 500 }
    )
  }
}
