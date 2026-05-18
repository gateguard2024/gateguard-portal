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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

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
    admin_first_name,
    admin_last_name,
    admin_email,
    admin_role = 'admin',
    send_invite = true,
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
      tier:                org_tier,
      tier_label:          TIER_LABELS[org_tier] ?? org_tier,
      parent_id:           parent_org_id ?? null,
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

  return NextResponse.json({
    ok:            true,
    org,
    clerk_user_id,
    invite_status,
    admin_email,
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
    .select('id, name, tier, tier_label, parent_id, license_number, service_area_states, tech_count, onboarded_at, created_at')
    .not('tier', 'eq', 'corporate')
    .order('onboarded_at', { ascending: false, nullsFirst: false })

  if (tier)   query = query.eq('tier', tier)
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
