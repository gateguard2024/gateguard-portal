/**
 * POST /api/nexus/internal/dealer-onboarding/send-document
 *
 * Sends (or resends) an NDA or dealer agreement signing link to a dealer org.
 * Reuses an existing pending record if one is still live; creates a new one otherwise.
 *
 * Body: { org_id: string, kind: 'nda' | 'agreement' }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import crypto from 'crypto'
import { getCurrentUser } from '@/lib/current-user'

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

type OrgRow = {
  id: string
  name: string | null
  org_tier: string | null
  parent_org_id: string | null
  email?: string | null
  contact_name?: string | null
  contact_email?: string | null
}

type SignatureRow = {
  id: string
  token: string
  document_type: string
  status: string | null
  expires_at: string | null
  signer_name: string | null
  signer_email: string
}

function canReuse(sig: SignatureRow) {
  const status = String(sig.status ?? '').toLowerCase()

  if (
    [
      'counterparty_signed',
      'fully_executed',
      'signed',
      'completed',
      'cancelled',
      'declined',
    ].includes(status)
  ) {
    return false
  }

  if (sig.expires_at && new Date(sig.expires_at) < new Date()) {
    return false
  }

  return true
}

async function sendEmail({
  sig,
  org,
  callerName,
}: {
  sig: SignatureRow
  org: OrgRow
  callerName: string
}) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is missing.')
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://portal.gateguard.co'
  const signUrl = `${baseUrl}/sign/${sig.token}`
  const docLabel = DOC_LABELS[sig.document_type] ?? sig.document_type
  const firstName = (sig.signer_name ?? 'there').split(' ')[0]
  const orgName = org.name ?? 'your organization'
  const expires = sig.expires_at
    ? new Date(sig.expires_at).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : '30 days'

  const { error } = await resend.emails.send({
    from: FROM,
    to: sig.signer_email,
    replyTo: 'rfeldman@gateguard.co',
    subject: `Action Required: Please sign your ${docLabel}`,
    html: `
      <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.5;max-width:560px;margin:0 auto;padding:24px">
        <h2 style="margin:0 0 8px">${docLabel}</h2>
        <p>Hi ${firstName},</p>
        <p>${callerName} at GateGuard sent this document for <strong>${orgName}</strong>.</p>
        <p>Please review and sign using the secure link below.</p>
        <p style="margin:24px 0">
          <a href="${signUrl}" style="background:#4f46e5;color:white;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">
            Review and Sign
          </a>
        </p>
        <p style="font-size:12px;color:#6b7280">This signing link expires on ${expires}.</p>
        <p style="font-size:12px;color:#6b7280">Questions? Reply to this email or contact rfeldman@gateguard.co.</p>
      </div>
    `,
  })

  if (error) {
    throw new Error((error as { message?: string }).message ?? JSON.stringify(error))
  }
}

export async function POST(req: NextRequest) {
  try {
    const caller = await getCurrentUser()

    if (!caller.isCorporate && !caller.isMasterAgent && !caller.isMasterDealer) {
      return NextResponse.json(
        { success: false, message: 'You do not have access to send dealer documents.' },
        { status: 403 }
      )
    }

    const body = await req.json().catch(() => ({}))
    const orgId = String(body.org_id ?? '').trim()
    const kind  = String(body.kind  ?? '').trim()

    if (!orgId) {
      return NextResponse.json(
        { success: false, message: 'org_id is required.' },
        { status: 400 }
      )
    }

    if (kind !== 'nda' && kind !== 'agreement') {
      return NextResponse.json(
        { success: false, message: 'kind must be nda or agreement.' },
        { status: 400 }
      )
    }

    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id,name,org_tier,parent_org_id,email,contact_name,contact_email')
      .eq('id', orgId)
      .single()

    if (orgError || !org) {
      return NextResponse.json(
        { success: false, message: 'Dealer organization not found.' },
        { status: 404 }
      )
    }

    const orgRow = org as OrgRow

    if (
      !caller.isCorporate &&
      caller.org_id !== orgRow.parent_org_id &&
      caller.org_id !== orgRow.id
    ) {
      return NextResponse.json(
        { success: false, message: 'You can only send documents for your own dealer network.' },
        { status: 403 }
      )
    }

    const documentType =
      kind === 'nda'
        ? 'nda'
        : AGREEMENT_BY_TIER[orgRow.org_tier ?? ''] ?? 'dealer_agreement'

    const signerEmail = orgRow.contact_email || orgRow.email
    const signerName  = orgRow.contact_name  || orgRow.name || 'Partner signer'

    if (!signerEmail) {
      return NextResponse.json(
        { success: false, message: 'This dealer needs a contact email before a signing link can be sent.' },
        { status: 400 }
      )
    }

    const { data: existing } = await supabase
      .from('document_signatures')
      .select('id,token,document_type,status,expires_at,signer_name,signer_email')
      .eq('org_id', orgId)
      .eq('document_type', documentType)
      .order('sent_at', { ascending: false })
      .limit(5)

    let sig = ((existing ?? []) as SignatureRow[]).find(canReuse)
    const reused = !!sig

    if (!sig) {
      const { data: tpl } = await supabase
        .from('document_templates')
        .select('public_url, version')
        .eq('document_type', documentType)
        .eq('is_active', true)
        .neq('public_url', 'PLACEHOLDER_UPDATE_AFTER_UPLOAD')
        .maybeSingle()

      const token     = crypto.randomBytes(32).toString('hex')
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

      const { data: created, error: createError } = await supabase
        .from('document_signatures')
        .insert({
          token,
          org_id:           orgId,
          document_type:    documentType,
          document_version: tpl?.version ?? 'v1.0',
          document_url:     tpl?.public_url ?? null,
          signer_name:      signerName,
          signer_email:     signerEmail,
          signer_company:   orgRow.name,
          sent_by:          caller.id,
          sent_by_name:     caller.name,
          expires_at:       expiresAt,
          status:           'pending',
        })
        .select('id,token,document_type,status,expires_at,signer_name,signer_email')
        .single()

      if (createError || !created) {
        throw new Error(createError?.message ?? 'Could not create signing record.')
      }

      sig = created as SignatureRow
    }

    await sendEmail({ sig, org: orgRow, callerName: caller.name })

    await supabase
      .from('document_signatures')
      .update({
        sent_at:    new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', sig.id)

    return NextResponse.json({
      success:                true,
      signature_id:           sig.id,
      reused_existing_record: reused,
      message:                `${DOC_LABELS[documentType] ?? documentType} sent to ${signerEmail}.`,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Could not send dealer document.',
      },
      { status: 500 }
    )
  }
}
