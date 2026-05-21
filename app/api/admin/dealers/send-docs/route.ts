/**
 * POST /api/admin/dealers/send-docs
 *
 * Sends the appropriate NDA + Agreement to a dealer based on their org_tier.
 *
 * Body: { dealer_id, dealer_name, email, org_tier, org_name }
 *
 * Tier → document mapping:
 *   master_agent       → NDA-A + Master Agent Agreement
 *   master_dealer      → NDA-A + MSO Agreement
 *   full_dealer        → NDA-B + Dealer Agreement
 *   service_dealer     → NDA-B + Service Partner Agreement
 *   install_contractor → NDA-B + Install Partner Agreement
 *   sales_partner      → NDA-C + Sales Partner Agreement
 *
 * Auth: GateGuard corporate admin only (checked via getCurrentUser).
 * Returns: { ok, nda, agreement } — each has { success, id?, error? }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { sendEmail } from '@/lib/email-sender'
import { generateNdaEmail, generateAgreementEmail } from '@/lib/email-templates'

export const dynamic = 'force-dynamic'

type NdaType = 'A' | 'B' | 'C'

interface TierDocConfig {
  ndaType: NdaType
  agreementType: string
}

const TIER_DOC_MAP: Record<string, TierDocConfig> = {
  master_agent:       { ndaType: 'A', agreementType: 'Master Agent Agreement' },
  master_dealer:      { ndaType: 'A', agreementType: 'MSO Agreement'          },
  full_dealer:        { ndaType: 'B', agreementType: 'Dealer Agreement'        },
  service_dealer:     { ndaType: 'B', agreementType: 'Service Partner Agreement' },
  install_contractor: { ndaType: 'B', agreementType: 'Install Partner Agreement' },
  sales_partner:      { ndaType: 'C', agreementType: 'Sales Partner Agreement'   },
}

export async function POST(req: NextRequest) {
  // Auth: corporate admin only
  const caller = await getCurrentUser()
  if (!caller.isCorporate || caller.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden — GateGuard admin only' }, { status: 403 })
  }

  let body: {
    dealer_id?: string
    dealer_name?: string
    email?: string
    org_tier?: string
    org_name?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { dealer_id, dealer_name, email, org_tier, org_name } = body

  if (!dealer_id || !email || !org_tier) {
    return NextResponse.json(
      { error: 'dealer_id, email, and org_tier are required' },
      { status: 400 }
    )
  }

  const docConfig = TIER_DOC_MAP[org_tier]
  if (!docConfig) {
    return NextResponse.json(
      { error: `No document mapping found for org_tier: ${org_tier}` },
      { status: 400 }
    )
  }

  const recipientName = dealer_name ?? 'there'
  const displayOrgName = org_name ?? 'Your Organization'
  const senderName = 'Russel Feldman'

  const ndaSignUrl = `https://portal.gateguard.co/sign/nda?dealer=${encodeURIComponent(dealer_id)}`
  const agreementSignUrl = `https://portal.gateguard.co/sign/agreement?dealer=${encodeURIComponent(dealer_id)}`

  // Send NDA email
  const ndaHtml = generateNdaEmail({
    recipientName,
    orgName: displayOrgName,
    ndaType: docConfig.ndaType,
    signUrl: ndaSignUrl,
    senderName,
  })

  const ndaResult = await sendEmail({
    to: email,
    subject: `Action Required: NDA-${docConfig.ndaType} for ${displayOrgName}`,
    html: ndaHtml,
    replyTo: 'rfeldman@gateguard.co',
  })

  // Send Agreement email
  const agreementHtml = generateAgreementEmail({
    recipientName,
    orgName: displayOrgName,
    agreementType: docConfig.agreementType,
    signUrl: agreementSignUrl,
    senderName,
  })

  const agreementResult = await sendEmail({
    to: email,
    subject: `Action Required: ${docConfig.agreementType} for ${displayOrgName}`,
    html: agreementHtml,
    replyTo: 'rfeldman@gateguard.co',
  })

  const bothSent = ndaResult.success && agreementResult.success

  return NextResponse.json(
    {
      ok: bothSent,
      dealer_id,
      email,
      org_tier,
      nda_type: docConfig.ndaType,
      agreement_type: docConfig.agreementType,
      nda: ndaResult,
      agreement: agreementResult,
      message: bothSent
        ? `NDA-${docConfig.ndaType} and ${docConfig.agreementType} sent to ${email}`
        : `Partial send — check nda and agreement fields for details`,
    },
    { status: bothSent ? 200 : 207 }
  )
}
