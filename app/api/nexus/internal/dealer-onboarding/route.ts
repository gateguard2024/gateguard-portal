import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type Bucket =
  | 'draft'
  | 'needs_nda'
  | 'nda_sent'
  | 'nda_signed'
  | 'needs_agreement'
  | 'agreement_signed'
  | 'needs_compliance'
  | 'ready_to_approve'
  | 'live'

type OrgRow = {
  id: string
  name: string | null
  org_tier: string | null
  tier_label: string | null
  parent_org_id: string | null
  is_active: boolean | null
  onboarding_complete: boolean | null
  onboarded_at: string | null
  created_at: string | null
  email?: string | null
  phone?: string | null
  license_number?: string | null
  service_area_states?: string[] | null
  contact_name?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  partner_docs?: Array<{ type?: string; status?: string; expires_at?: string | null }> | null
}

type SigRow = {
  id: string
  org_id: string | null
  document_type: string | null
  status: string | null
  sent_at: string | null
  signed_at: string | null
  countersigned_at?: string | null
  executed_at?: string | null
  executed_cert_url?: string | null
}

const PARTNER_TIERS = new Set([
  'master_agent',
  'master_dealer',
  'full_dealer',
  'service_dealer',
  'install_contractor',
  'sales_partner',
])

function signed(sig?: SigRow) {
  const status = String(sig?.status ?? '').toLowerCase()
  return !!sig?.signed_at || status === 'counterparty_signed' || status === 'fully_executed' || status === 'signed' || status === 'completed'
}

function executed(sig?: SigRow) {
  const status = String(sig?.status ?? '').toLowerCase()
  return !!sig?.executed_at || status === 'fully_executed'
}

function sent(sig?: SigRow) {
  return !!sig?.sent_at || !!sig?.status
}

function docOk(docs: OrgRow['partner_docs'], type: string) {
  const doc = docs?.find(item => item.type === type)
  const status = String(doc?.status ?? '').toLowerCase()
  return status === 'on_file' || status === 'approved' || status === 'complete'
}

function needsCompliance(org: OrgRow) {
  const tier = org.org_tier ?? ''
  if (tier === 'sales_partner') return false
  if (tier === 'master_agent') return !docOk(org.partner_docs, 'w9')
  return !(docOk(org.partner_docs, 'w9') && docOk(org.partner_docs, 'coi'))
}

function bucketFor(org: OrgRow, nda?: SigRow, agreement?: SigRow): Bucket {
  if (org.is_active && org.onboarding_complete) return 'live'
  if (!org.name || !org.org_tier) return 'draft'
  if (!nda) return 'needs_nda'
  if (!signed(nda)) return sent(nda) ? 'nda_sent' : 'needs_nda'
  if (!executed(nda)) return 'nda_signed'
  if (!agreement) return 'needs_agreement'
  if (!executed(agreement)) return signed(agreement) ? 'agreement_signed' : 'needs_agreement'
  if (needsCompliance(org)) return 'needs_compliance'
  if (!org.is_active || !org.onboarding_complete) return 'ready_to_approve'
  return 'live'
}

function nextActionFor(org: OrgRow, bucket: Bucket, nda?: SigRow, agreement?: SigRow) {
  if (bucket === 'draft') return 'Finish company info'
  if (bucket === 'needs_nda') return nda ? 'Resend NDA' : 'Send NDA'
  if (bucket === 'nda_sent') return 'Waiting on NDA signature'
  if (bucket === 'nda_signed') return 'Countersign NDA'
  if (bucket === 'needs_agreement') return agreement ? 'Resend Agreement' : 'Send Agreement'
  if (bucket === 'agreement_signed') return 'Countersign Agreement'
  if (bucket === 'needs_compliance') {
    if (org.org_tier === 'master_agent') return 'Collect W9'
    return 'Collect W9 / COI'
  }
  if (bucket === 'ready_to_approve') return 'Approve Dealer'
  return 'View final documents'
}

function agreementTypes() {
  return new Set([
    'dealer_agreement',
    'service_agreement',
    'install_partner_agreement',
    'sales_partner_agreement',
    'master_agent_agreement',
    'master_dealer_agreement',
  ])
}

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user.isCorporate && !user.isMasterAgent && !user.isMasterDealer) {
      return NextResponse.json({ success: false, message: 'You do not have access to dealer onboarding.' }, { status: 403 })
    }

    let orgQuery = supabase
      .from('organizations')
      .select('id,name,org_tier,tier_label,parent_org_id,is_active,onboarding_complete,onboarded_at,created_at,email,phone,license_number,service_area_states,contact_name,contact_email,contact_phone,partner_docs')
      .in('org_tier', Array.from(PARTNER_TIERS))
      .order('created_at', { ascending: false })
      .limit(120)

    if (!user.isCorporate && user.org_id) {
      orgQuery = orgQuery.or(`id.eq.${user.org_id},parent_org_id.eq.${user.org_id}`)
    }

    const { data: orgs, error: orgError } = await orgQuery
    if (orgError) return NextResponse.json({ success: false, message: orgError.message }, { status: 500 })

    const orgRows = (orgs ?? []) as OrgRow[]
    const ids = orgRows.map(org => org.id)

    const { data: signatures } = ids.length > 0
      ? await supabase
          .from('document_signatures')
          .select('id,org_id,document_type,status,sent_at,signed_at,countersigned_at,executed_at,executed_cert_url')
          .in('org_id', ids)
      : { data: [] }

    const byOrg = new Map<string, SigRow[]>()
    for (const sig of (signatures ?? []) as SigRow[]) {
      if (!sig.org_id) continue
      const list = byOrg.get(sig.org_id) ?? []
      list.push(sig)
      byOrg.set(sig.org_id, list)
    }

    const agreementSet = agreementTypes()
    const items = orgRows.map(org => {
      const sigs = byOrg.get(org.id) ?? []
      const nda = sigs.find(sig => sig.document_type === 'nda')
      const agreement = sigs.find(sig => agreementSet.has(String(sig.document_type ?? '')))
      const bucket = bucketFor(org, nda, agreement)
      return {
        id: org.id,
        title: org.name || 'Unnamed partner',
        subtitle: org.contact_email || org.email || org.tier_label || org.org_tier || 'Partner onboarding',
        org_tier: org.org_tier,
        tier_label: org.tier_label,
        parent_org_id: org.parent_org_id,
        is_active: !!org.is_active,
        onboarding_complete: !!org.onboarding_complete,
        onboarded_at: org.onboarded_at,
        created_at: org.created_at,
        contact_name: org.contact_name,
        contact_email: org.contact_email || org.email || null,
        contact_phone: org.contact_phone || org.phone || null,
        nda_status: nda?.status ?? 'missing',
        nda_signature_id: nda?.id ?? null,
        nda_executed_cert_url: nda?.executed_cert_url ?? null,
        agreement_status: agreement?.status ?? 'missing',
        agreement_signature_id: agreement?.id ?? null,
        agreement_executed_cert_url: agreement?.executed_cert_url ?? null,
        executed_cert_url: agreement?.executed_cert_url ?? nda?.executed_cert_url ?? null,
        compliance_needed: needsCompliance(org),
        partner_docs: org.partner_docs ?? [],
        bucket,
        next_action: nextActionFor(org, bucket, nda, agreement),
        resume_href: `/admin/dealers/new?resume=${org.id}`,
        open_href: `/admin/dealers/${org.id}`,
      }
    })

    return NextResponse.json({ success: true, items })
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : 'Could not load dealer onboarding.' }, { status: 500 })
  }
}
