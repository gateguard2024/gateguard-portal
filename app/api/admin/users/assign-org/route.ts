/**
 * POST /api/admin/users/assign-org
 *
 * Onboards a dealer by wiring their Clerk user to a Supabase org record.
 * Sets org_id, org_tier, and role on Clerk publicMetadata — these are read
 * by getCurrentUser() on every request and drive all data isolation.
 *
 * Request body:
 *   clerk_user_id  string   — Clerk user ID (user_xxxx)
 *   org_id         string   — Supabase organizations.id UUID
 *   org_tier       string   — org_tier enum value (master_dealer, service_dealer, etc.)
 *   role           string   — portal role (admin | supervisor | agent | dealer | rep | client)
 *
 * Auth: GateGuard corporate admin only (role = admin in Clerk metadata)
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

const VALID_TIERS: OrgTier[] = [
  'corporate', 'master_agent', 'master_dealer',
  'full_dealer', 'service_dealer', 'install_contractor', 'sales_partner', 'client',
]

const VALID_ROLES: PortalRole[] = [
  'admin', 'supervisor', 'agent', 'dealer', 'rep', 'client',
]

export async function POST(req: NextRequest) {
  // Only GateGuard corporate admins can call this
  const caller = await getCurrentUser()
  if (!caller.isCorporate || caller.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden — GateGuard admin only' }, { status: 403 })
  }

  const body = await req.json()
  const { clerk_user_id, org_id, org_tier, role } = body

  if (!clerk_user_id || !org_id || !org_tier || !role) {
    return NextResponse.json(
      { error: 'clerk_user_id, org_id, org_tier, and role are all required' },
      { status: 400 }
    )
  }

  if (!VALID_TIERS.includes(org_tier)) {
    return NextResponse.json({ error: `Invalid org_tier: ${org_tier}` }, { status: 400 })
  }
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: `Invalid role: ${role}` }, { status: 400 })
  }

  // Verify the org exists in Supabase
  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .select('id, name, org_tier')
    .eq('id', org_id)
    .single()

  if (orgErr || !org) {
    return NextResponse.json({ error: 'org_id not found in organizations table' }, { status: 404 })
  }

  // Set Clerk publicMetadata — this is the single source of truth for auth context
  try {
    await (await clerkClient()).users.updateUserMetadata(clerk_user_id, {
      publicMetadata: {
        org_id,
        org_tier,
        role,
        // Denormalize org name for display without extra DB calls
        org_name: org.name,
        // Timestamp for audit
        assigned_at: new Date().toISOString(),
        assigned_by: caller.id,
      },
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: `Clerk update failed: ${err.message}` },
      { status: 500 }
    )
  }

  // Optionally record the assignment in Supabase for audit trail
  await supabase.from('sensitive_field_access_log').insert({
    user_id:    caller.id,
    org_id:     caller.org_id ?? null,
    table_name: 'clerk_users',
    record_id:  '00000000-0000-0000-0000-000000000000', // placeholder
    fields:     ['org_id', 'org_tier', 'role'],
    ip_address: req.headers.get('x-forwarded-for') ?? null,
  })

  return NextResponse.json({
    ok: true,
    assigned: {
      clerk_user_id,
      org_id,
      org_name: org.name,
      org_tier,
      role,
    },
  })
}

/**
 * GET /api/admin/users/assign-org?clerk_user_id=user_xxxx
 * Read back what org a user is currently assigned to.
 */
export async function GET(req: NextRequest) {
  const caller = await getCurrentUser()
  if (!caller.isCorporate) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const clerk_user_id = searchParams.get('clerk_user_id')
  if (!clerk_user_id) {
    return NextResponse.json({ error: 'clerk_user_id required' }, { status: 400 })
  }

  try {
    const user = await (await clerkClient()).users.getUser(clerk_user_id)
    const meta = user.publicMetadata ?? {}
    return NextResponse.json({
      clerk_user_id,
      email: user.emailAddresses[0]?.emailAddress,
      name:  [user.firstName, user.lastName].filter(Boolean).join(' '),
      org_id:    meta.org_id    ?? null,
      org_name:  meta.org_name  ?? null,
      org_tier:  meta.org_tier  ?? null,
      role:      meta.role      ?? null,
      assigned_at: meta.assigned_at ?? null,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
