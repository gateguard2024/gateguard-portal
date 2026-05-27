/**
 * POST /api/admin/onboard-dealer
 *
 * Full dealer onboarding orchestration — one call does everything:
 *   1. Create the org record in Supabase organizations table
 *   2. Send a Clerk invitation to the primary admin email
 *   3. Set org_id + org_tier + role on the invited user's Clerk publicMetadata
 *      (done via a post-signup webhook OR pre-set on the invitation metadata)
 *
 * Auth: GateGuard corporate admin only.
 *
 * Request body:
 *   org_name           string   required
 *   org_tier           OrgTier  required  (master_agent | master_dealer | full_dealer | service_dealer | install_contractor | sales_partner)
 *   parent_org_id      string?  UUID of parent org (master_agent or master_dealer above them)
 *   license_number     string?
 *   service_area_states string[] e.g. ['GA','FL']
 *   tech_count         number?
 *   address            string?
 *   city               string?
 *   state              string?
 *   zip                string?
 *   phone              string?
 *   email              string?  org email
 *   website            string?
 *   admin_first_name   string   required  — primary user
 *   admin_last_name    string   required
 *   admin_email        string   required
 *   admin_role         PortalRole required (default 'admin')
 *   send_invite        boolean  default true — send Clerk email invite
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
export const dynamic = 'force-dynamic'

/** Document type for each tier */
const TIER_DOC_TYPES: Record<string, string> = {
  master_agent:       'master_agent_agreement',
  master_dealer:      'dealer_agreement',
  full_dealer:        'dealer_agreement',
  service_dealer:     'service_agreement',
  install_contractor: 'install_partner_agreement',
  sales_partner:      'sales_partner_agreement',
}

const DOC_LABELS: Record<string, string> = {
  nda:                        'Mutual Non-Disclosure Agreement',
  master_agent_agreement:     'Master Agent Agreement',
  dealer_agreement:           'Authorized Dealer & Reseller Agreement',
  service_agreement:          'Service Partner Agreement',
  install_partner_agreement:  'Installation Partner Agreement',
  sales_partner_agreement:    'Sales Partner Agreement',
}

const VALID_DEALER_TIERS: OrgTier[] = [
  'master_agent', 'master_dealer', 'full_dealer',
  'service_dealer', 'install_contractor', 'sales_partner',
]

const TIER_LABELS: Record<string, string> = {
  master_agent:       'Master Agent',
  master_dealer:      'MSO',
  full_dealer:        'Full Dealership',
  service_dealer:     'Service Dealer',
  install_contractor: 'Install Contractor',
  sales_partner:      'Sales Partner',
}

/** Maps org_tier → { ndaType, agreementType } for automatic document dispatch */
const TIER_DOC_MAP: Record<string, { ndaType: 'A' | 'B' | 'C'; agreementType: string }> = {
  master_agent:       { ndaType: 'A', agreementType: 'Master Agent Agreement'    },
  master_dealer:      { ndaType: 'A', agreementType: 'MSO Agreement'             },
  full_dealer:        { ndaType: 'B', agreementType: 'Dealer Agreement'          },
  service_dealer:     { ndaType: 'B', agreementType: 'Service Partner Agreement' },
  install_contractor: { ndaType: 'B', agreementType: 'Install Partner Agreement' },
  sales_partner:      { ndaType: 'C', agreementType: 'Sales Partner Agreement'   },
}

export async function POST(req: NextRequest) {
  // Gate: corporate admins only
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
    entity_type,
    admin_first_name,
    admin_last_name,
    admin_email,
    admin_role = 'admin',
    send_invite = true,
    sales_partner_rate,
    service_dealer_rate,
    commission_notes,
  } = body

  // ── Validation ──────────────────────────────────────────────────────
  if (!org_name?.trim()) {
    return NextResponse.json({ error: 'org_name is required' }, { status: 400 })
  }
  if (!VALID_DEALER_TIERS.includes(org_tier)) {
    return NextResponse.json({ error: `Invalid org_tier: ${org_tier}` }, { status: 400 })
  }
  if (!admin_first_name?.trim() || !admin_last_name?.trim()) {
    return NextResponse.json({ error: 'admin_first_name and admin_last_name are required' }, { status: 400 })
  }
  if (!admin_email?.includes('@')) {
    return NextResponse.json({ error: 'valid admin_email is required' }, { status: 400 })
  }

  // ── Step 1: Create org in Supabase ──────────────────────────────────
  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .insert({
      name:                org_name.trim(),
      org_tier:            org_tier,
      tier_label:          TIER_LABELS[org_tier] ?? org_tier,
      parent_org_id:       parent_org_id ?? null,
      license_number:      license_number ?? null,
      service_area_states: service_area_states ?? [],
      tech_count:          tech_count ?? 0,
      onboarded_at:        new Date().toISOString(),
      // Store contact info if provided
      ...(phone     && { phone }),
      ...(org_email && { email: org_email }),
      ...(website   && { website }),
      ...(address   && { address }),
      ...(city      && { city }),
      ...(state     && { state }),
      ...(zip       && { zip }),
    })
    .select()
    .single()

  if (orgErr || !org) {
    return NextResponse.json(
      { error: `Failed to create org: ${orgErr?.message}` },
      { status: 500 }
    )
  }

  // ── Step 2: Send Clerk invitation (or find existing user) ───────────
  let clerk_user_id: string | null = null
  let invite_status: string = 'pending'

  if (send_invite) {
    try {
      const clerk = await clerkClient()

      // Check if a user with this email already exists in Clerk
      const existing = await clerk.users.getUserList({ emailAddress: [admin_email] })

      if (existing.totalCount > 0) {
        // User already exists — just assign the org context
        clerk_user_id = existing.data[0].id
        invite_status = 'existing_user'
      } else {
        // Create an invitation — Clerk sends the email
        const invitation = await clerk.invitations.createInvitation({
          emailAddress: admin_email,
          publicMetadata: {
            // Pre-set org context so it's applied as soon as they sign up
            org_id:      org.id,
            org_tier,
            role:        admin_role,
            org_name:    org_name.trim(),
            assigned_at: new Date().toISOString(),
            assigned_by: caller.id,
          },
          redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://portal.gateguard.co'}/onboarding`,
        })
        clerk_user_id = null  // Not a user yet — they need to accept the invite
        invite_status = 'invited'
      }

      // If user already exists, wire the org context now
      if (clerk_user_id) {
        await clerk.users.updateUserMetadata(clerk_user_id, {
          publicMetadata: {
            org_id:      org.id,
            org_tier,
            role:        admin_role,
            org_name:    org_name.trim(),
            assigned_at: new Date().toISOString(),
            assigned_by: caller.id,
          },
        })
      }
    } catch (err: any) {
      // Don't roll back the org — return partial success so admin can retry
      return NextResponse.json({
        ok: false,
        org,
        clerk_error: err.message,
        message: 'Org created in Supabase but Clerk invite failed. Retry the invite from the dealer detail page.',
      }, { status: 207 })
    }
  }

  // ── Step 3: Log the onboarding event ───────────────────────────────
  await supabase.from('sensitive_field_access_log').insert({
    user_id:    caller.id,
    org_id:     org.id,
    table_name: 'organizations',
    record_id:  org.id,
    fields:     ['onboarded'],
    ip_address: req.headers.get('x-forwarded-for') ?? null,
  })

  // ── Step 4: Send NDA + Agreement via token-based e-sign system ────────
  // Non-blocking — org creation is not affected if email delivery fails.
  const agreementDocType = TIER_DOC_TYPES[org_tier] ?? 'dealer_agreement'
  const signerName       = `${admin_first_name.trim()} ${admin_last_name.trim()}`
  const baseUrl          = process.env.NEXT_PUBLIC_APP_URL ?? 'https://portal.gateguard.co'
  const expiresAt        = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  let docs_sent = false

  void (async () => {
    try {
      // Helper: create document_signature record + send signing email
      const sendDoc = async (documentType: string) => {
        const token = crypto.randomBytes(32).toString('hex')
        const docLabel = DOC_LABELS[documentType] ?? documentType

        // Auto-lookup template URL from document_templates table
        const { data: tpl } = await supabase
          .from('document_templates')
          .select('public_url, version')
          .eq('document_type', documentType)
          .eq('is_active', true)
          .neq('public_url', 'PLACEHOLDER_UPDATE_AFTER_UPLOAD')
          .maybeSingle()

        await supabase.from('document_signatures').insert({
          token,
          org_id:          org.id,
          document_type:   documentType,
          document_version: tpl?.version ?? 'v1.0',
          document_url:    tpl?.public_url ?? null,
          signer_name:     signerName,
          signer_email:    admin_email,
          signer_company:  org_name.trim(),
          sent_by:         caller.id,
          sent_by_name:    caller.name,
          expires_at:      expiresAt,
          status:          'pending',
        })

        const signUrl    = `${baseUrl}/sign/${token}`
        const signerFirst = admin_first_name.trim()

        await resend.emails.send({
          from:    'GateGuard <documents@mail.gateguard.co>',
          to:      admin_email,
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
        ${caller.name} at GateGuard has sent you a <strong style="color:#CBD5E1;">${docLabel}</strong> for ${org_name.trim()}.
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
          <tr><td style="color:#64748B;font-size:12px;padding:4px 0;">Organization</td><td style="color:#CBD5E1;font-size:12px;">${org_name.trim()}</td></tr>
          <tr><td style="color:#64748B;font-size:12px;padding:4px 0;">Sent by</td><td style="color:#CBD5E1;font-size:12px;">${caller.name} · GateGuard</td></tr>
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

      await sendDoc('nda')
      await sendDoc(agreementDocType)
    } catch (emailErr) {
      console.error('[onboard-dealer] Doc e-sign send error:', emailErr)
    }
  })()
  docs_sent = true

  return NextResponse.json({
    ok:            true,
    org,
    clerk_user_id,
    invite_status,
    admin_email,
    docs_sent,
    docs_note: docs_sent
      ? `NDA and ${DOC_LABELS[agreementDocType] ?? agreementDocType} signing links sent to ${admin_email}`
      : 'No document emails sent',
    message: invite_status === 'invited'
      ? `Invite sent to ${admin_email}. Their portal access will activate when they accept.`
      : invite_status === 'existing_user'
      ? `${admin_email} already has a portal account. Their org context has been updated.`
      : `Org created. No invite sent (send_invite=false). Call POST /api/admin/users/assign-org to wire a user.`,
  }, { status: 201 })
}

// GET /api/admin/onboard-dealer — list all dealer orgs for the admin view
export async function GET(req: NextRequest) {
  const caller = await getCurrentUser()
  if (!caller.isCorporate && !caller.isMasterAgent) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const tier   = searchParams.get('tier')
  const q      = searchParams.get('q')
  const parent = searchParams.get('parent_org_id')

  let query = supabase
    .from('organizations')
    .select('id, name, org_tier, tier_label, parent_org_id, license_number, service_area_states, tech_count, onboarded_at, created_at, is_active, onboarding_complete, contact_name, contact_email, contact_phone, partner_docs')
    .in('org_tier', ['master_agent', 'master_dealer', 'full_dealer', 'service_dealer', 'install_contractor', 'sales_partner'])
    .order('onboarded_at', { ascending: false, nullsFirst: false })

  if (tier)   query = query.eq('org_tier', tier)
  if (parent) query = query.eq('parent_id', parent)
  if (q)      query = query.ilike('name', `%${q}%`)

  // Master agents only see their own subtree
  if (!caller.isCorporate && caller.org_id) {
    query = query.eq('parent_id', caller.org_id)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ orgs: data ?? [] })
}
