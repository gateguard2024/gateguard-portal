/**
 * POST /api/admin/onboard-dealer
 *
 * Creates a dealer org, sends or updates the primary Clerk user, and sends
 * NDA + agreement signing links.
 *
 * GET /api/admin/onboard-dealer
 *
 * Lists dealer orgs scoped to the caller's hierarchy.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { clerkClient } from '@clerk/nextjs/server'
import { getCurrentUser, OrgTier, PortalRole } from '@/lib/current-user'
import { Resend } from 'resend'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY)
const DOCUMENTS_FROM_EMAIL = process.env.RESEND_DOCUMENTS_FROM_EMAIL ?? 'GateGuard <documents@gateguard.co>'
export const dynamic = 'force-dynamic'

const TIER_DOC_TYPES: Record<string, string> = {
  master_agent: 'master_agent_agreement',
  master_dealer: 'dealer_agreement',
  full_dealer: 'dealer_agreement',
  service_dealer: 'service_agreement',
  install_contractor: 'install_partner_agreement',
  sales_partner: 'sales_partner_agreement',
}

const DOC_LABELS: Record<string, string> = {
  nda: 'Mutual Non-Disclosure Agreement',
  master_agent_agreement: 'Master Agent Agreement',
  dealer_agreement: 'Authorized Dealer & Reseller Agreement',
  service_agreement: 'Service Partner Agreement',
  install_partner_agreement: 'Installation Partner Agreement',
  sales_partner_agreement: 'Sales Partner Agreement',
}

const VALID_DEALER_TIERS: OrgTier[] = [
  'master_agent',
  'master_dealer',
  'full_dealer',
  'service_dealer',
  'install_contractor',
  'sales_partner',
]

const TIER_LABELS: Record<string, string> = {
  master_agent: 'Master Agent',
  master_dealer: 'MSO',
  full_dealer: 'Full Dealership',
  service_dealer: 'Service Dealer',
  install_contractor: 'Install Contractor',
  sales_partner: 'Sales Partner',
}

const TIER_RANK: Record<string, number> = {
  corporate: 0,
  master_agent: 1,
  master_dealer: 2,
  full_dealer: 3,
  service_dealer: 4,
  install_contractor: 4,
  sales_partner: 4,
  client: 5,
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

async function sendSigningDocument({
  documentType,
  orgId,
  orgName,
  adminEmail,
  signerName,
  callerId,
  callerName,
  expiresAt,
  baseUrl,
}: {
  documentType: string
  orgId: string
  orgName: string
  adminEmail: string
  signerName: string
  callerId: string
  callerName: string
  expiresAt: string
  baseUrl: string
}) {
  const token = crypto.randomBytes(32).toString('hex')
  const docLabel = DOC_LABELS[documentType] ?? documentType

  const { data: tpl } = await supabase
    .from('document_templates')
    .select('public_url, version')
    .eq('document_type', documentType)
    .eq('is_active', true)
    .neq('public_url', 'PLACEHOLDER_UPDATE_AFTER_UPLOAD')
    .maybeSingle()

  const { error: sigError } = await supabase.from('document_signatures').insert({
    token,
    org_id: orgId,
    document_type: documentType,
    document_version: tpl?.version ?? 'v1.0',
    document_url: tpl?.public_url ?? null,
    signer_name: signerName,
    signer_email: adminEmail,
    signer_company: orgName,
    sent_by: callerId,
    sent_by_name: callerName,
    expires_at: expiresAt,
    status: 'pending',
  })

  if (sigError) throw new Error(sigError.message)

  if (!process.env.RESEND_API_KEY) {
    throw new Error('Email service not configured — RESEND_API_KEY is missing. The signing record was created but the email was not sent.')
  }

  const signUrl = `${baseUrl}/sign/${token}`
  const signerFirst = signerName.split(' ')[0]

  await resend.emails.send({
    from: DOCUMENTS_FROM_EMAIL,
    to: adminEmail,
    replyTo: 'rfeldman@gateguard.co',
    subject: `Action Required: Please sign your ${docLabel}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0C111D;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#131B2E;border:1px solid #1E2A45;border-radius:16px;overflow:hidden;">
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
    <div style="padding:32px;">
      <p style="margin:0 0 16px;color:#CBD5E1;font-size:15px;">Hi ${signerFirst},</p>
      <p style="margin:0 0 24px;color:#94A3B8;font-size:14px;line-height:1.6;">
        ${callerName} at GateGuard has sent you a <strong style="color:#CBD5E1;">${docLabel}</strong> for ${orgName}.
        Please click below to review and add your electronic signature.
      </p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${signUrl}" style="display:inline-block;background:#6B7EFF;color:white;text-decoration:none;padding:14px 36px;border-radius:10px;font-weight:600;font-size:15px;">
          Review &amp; Sign →
        </a>
      </div>
      <div style="background:#0C111D;border:1px solid #1E2A45;border-radius:10px;padding:16px;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="color:#64748B;font-size:12px;padding:4px 0;width:40%;">Document</td><td style="color:#CBD5E1;font-size:12px;">${docLabel}</td></tr>
          <tr><td style="color:#64748B;font-size:12px;padding:4px 0;">Organization</td><td style="color:#CBD5E1;font-size:12px;">${orgName}</td></tr>
          <tr><td style="color:#64748B;font-size:12px;padding:4px 0;">Sent by</td><td style="color:#CBD5E1;font-size:12px;">${callerName} · GateGuard</td></tr>
          <tr><td style="color:#64748B;font-size:12px;padding:4px 0;">Expires</td><td style="color:#CBD5E1;font-size:12px;">${new Date(expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</td></tr>
        </table>
      </div>
      <p style="margin:0;color:#64748B;font-size:12px;line-height:1.6;">
        Questions? Contact <a href="mailto:rfeldman@gateguard.co" style="color:#6B7EFF;">rfeldman@gateguard.co</a>
      </p>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #1E2A45;text-align:center;">
      <p style="margin:0;color:#475569;font-size:11px;">GateGuard · The OS for Multifamily Access · Electronic signatures are binding under ESIGN Act &amp; UETA</p>
    </div>
  </div>
</body>
</html>`,
  })
}

export async function POST(req: NextRequest) {
  const caller = await getCurrentUser()
  if (!caller.isCorporate || caller.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden — GateGuard admin only' }, { status: 403 })
  }

  const body = await req.json()
  const {
    org_name,
    org_tier,
    parent_org_id,
    license_number,
    service_area_states,
    tech_count,
    address, city, state, zip,
    phone, email: org_email, website,
    admin_first_name,
    admin_last_name,
    admin_email,
    admin_role = 'admin',
    send_invite = true,
  } = body

  if (!clean(org_name)) return NextResponse.json({ error: 'org_name is required' }, { status: 400 })
  if (!VALID_DEALER_TIERS.includes(org_tier)) return NextResponse.json({ error: `Invalid org_tier: ${org_tier}` }, { status: 400 })
  if (!clean(admin_first_name) || !clean(admin_last_name)) return NextResponse.json({ error: 'admin_first_name and admin_last_name are required' }, { status: 400 })
  if (!String(admin_email ?? '').includes('@')) return NextResponse.json({ error: 'valid admin_email is required' }, { status: 400 })

  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .insert({
      name: clean(org_name),
      org_tier,
      tier_label: TIER_LABELS[org_tier] ?? org_tier,
      parent_org_id: parent_org_id ?? null,
      license_number: license_number ?? null,
      service_area_states: service_area_states ?? [],
      tech_count: tech_count ?? 0,
      onboarded_at: new Date().toISOString(),
      ...(phone && { phone }),
      ...(org_email && { email: org_email }),
      ...(website && { website }),
      ...(address && { address }),
      ...(city && { city }),
      ...(state && { state }),
      ...(zip && { zip }),
    })
    .select()
    .single()

  if (orgErr || !org) {
    return NextResponse.json({ error: `Failed to create org: ${orgErr?.message}` }, { status: 500 })
  }

  let clerk_user_id: string | null = null
  let invite_status = 'pending'

  if (send_invite) {
    try {
      const clerk = await clerkClient()
      const existing = await clerk.users.getUserList({ emailAddress: [admin_email] })
      if (existing.totalCount > 0) {
        clerk_user_id = existing.data[0].id
        invite_status = 'existing_user'
      } else {
        await clerk.invitations.createInvitation({
          emailAddress: admin_email,
          publicMetadata: {
            org_id: org.id,
            org_tier,
            role: admin_role as PortalRole,
            org_name: clean(org_name),
            assigned_at: new Date().toISOString(),
            assigned_by: caller.id,
          },
          redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://portal.gateguard.co'}/onboarding`,
        })
        invite_status = 'invited'
      }

      if (clerk_user_id) {
        await clerk.users.updateUserMetadata(clerk_user_id, {
          publicMetadata: {
            org_id: org.id,
            org_tier,
            role: admin_role as PortalRole,
            org_name: clean(org_name),
            assigned_at: new Date().toISOString(),
            assigned_by: caller.id,
          },
        })
      }
    } catch (err: any) {
      return NextResponse.json({
        ok: false,
        org,
        clerk_error: err.message,
        message: 'Org created in Supabase but Clerk invite failed. Retry the invite from the dealer detail page.',
      }, { status: 207 })
    }
  }

  await supabase.from('sensitive_field_access_log').insert({
    user_id: caller.id,
    org_id: org.id,
    table_name: 'organizations',
    record_id: org.id,
    fields: ['onboarded'],
    ip_address: req.headers.get('x-forwarded-for') ?? null,
  })

  const agreementDocType = TIER_DOC_TYPES[org_tier] ?? 'dealer_agreement'
  const signerName = `${clean(admin_first_name)} ${clean(admin_last_name)}`
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://portal.gateguard.co'
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  let docs_sent = false
  let docs_error: string | null = null

  try {
    await sendSigningDocument({ documentType: 'nda', orgId: org.id, orgName: clean(org_name), adminEmail: admin_email, signerName, callerId: caller.id, callerName: caller.name, expiresAt, baseUrl })
    await sendSigningDocument({ documentType: agreementDocType, orgId: org.id, orgName: clean(org_name), adminEmail: admin_email, signerName, callerId: caller.id, callerName: caller.name, expiresAt, baseUrl })
    docs_sent = true
  } catch (emailErr: any) {
    console.error('[onboard-dealer] Doc e-sign send error:', emailErr)
    docs_error = emailErr?.message ?? String(emailErr)
  }

  return NextResponse.json({
    ok: true,
    org,
    clerk_user_id,
    invite_status,
    admin_email,
    docs_sent,
    docs_error,
    docs_note: docs_sent
      ? `NDA and ${DOC_LABELS[agreementDocType] ?? agreementDocType} signing links sent to ${admin_email}`
      : `Document emails NOT sent — error: ${docs_error ?? 'unknown'}`,
    message: invite_status === 'invited'
      ? `Invite sent to ${admin_email}. Their portal access will activate when they accept.`
      : invite_status === 'existing_user'
      ? `${admin_email} already has a portal account. Their org context has been updated.`
      : `Org created. No invite sent (send_invite=false). Call POST /api/admin/users/assign-org to wire a user.`,
  }, { status: 201 })
}

export async function GET(req: NextRequest) {
  const caller = await getCurrentUser()

  if (!caller.isCorporate && !caller.isMasterAgent && !caller.isMasterDealer) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const tier = searchParams.get('tier')
  const q = searchParams.get('q')
  const parent = searchParams.get('parent_org_id')

  const callerRank = TIER_RANK[caller.org_tier ?? 'corporate'] ?? 0
  const ALL_DEALER_TIERS = ['master_agent', 'master_dealer', 'full_dealer', 'service_dealer', 'install_contractor', 'sales_partner']
  const visibleTiers = caller.isCorporate ? ALL_DEALER_TIERS : ALL_DEALER_TIERS.filter(t => (TIER_RANK[t] ?? 99) > callerRank)

  let query = supabase
    .from('organizations')
    .select('id, name, org_tier, tier_label, parent_org_id, license_number, service_area_states, tech_count, onboarded_at, created_at, is_active, onboarding_complete, contact_name, contact_email, contact_phone, partner_docs')
    .in('org_tier', visibleTiers)
    .order('onboarded_at', { ascending: false, nullsFirst: false })

  if (tier) query = query.eq('org_tier', tier)
  if (parent) query = query.eq('parent_org_id', parent)
  if (q) query = query.ilike('name', `%${q}%`)

  if (!caller.isCorporate && caller.org_id) {
    query = query.eq('parent_org_id', caller.org_id)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ orgs: data ?? [] })
}
