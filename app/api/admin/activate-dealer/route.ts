/**
 * POST /api/admin/activate-dealer
 *
 * Phase 2 of the 2-phase onboarding flow.
 * Activates the org (is_active: true, onboarded_at: now).
 * Sends Clerk invitations for all portal users.
 * Creates technician records in the technicians table.
 *
 * Body:
 *   org_id           string   required
 *   portal_users     Array<{ first_name, last_name, email, role }>
 *   technicians      Array<{ first_name, last_name, email?, phone? }>
 *
 * Returns: { ok, invite_statuses, tech_ids, message }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { clerkClient } from '@clerk/nextjs/server'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

interface PortalUser {
  first_name: string
  last_name:  string
  email:      string
  role:       string
}

interface TechUser {
  first_name: string
  last_name:  string
  email?:     string
  phone?:     string
}

function generateTechCode(first: string, last: string): string {
  const initials = `${first[0] ?? 'X'}${last[0] ?? 'X'}`.toUpperCase()
  const digits = String(Math.floor(1000 + Math.random() * 9000))
  return `GG-${initials}-${digits}`
}

export async function POST(req: NextRequest) {
  const caller = await getCurrentUser()
  if (!caller.isCorporate || caller.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden — GateGuard admin only' }, { status: 403 })
  }

  const body = await req.json()
  const {
    org_id,
    portal_users = [],
    technicians  = [],
  }: { org_id: string; portal_users: PortalUser[]; technicians: TechUser[] } = body

  if (!org_id) {
    return NextResponse.json({ error: 'org_id is required' }, { status: 400 })
  }

  // Fetch the org to confirm it exists
  const { data: org, error: orgFetchErr } = await supabase
    .from('organizations')
    .select('id, name, org_tier')
    .eq('id', org_id)
    .single()

  if (orgFetchErr || !org) {
    return NextResponse.json({ error: 'Org not found' }, { status: 404 })
  }

  // Activate the org
  const { error: activateErr } = await supabase
    .from('organizations')
    .update({
      is_active:    true,
      onboarded_at: new Date().toISOString(),
    })
    .eq('id', org_id)

  if (activateErr) {
    return NextResponse.json(
      { error: `Failed to activate org: ${activateErr.message}` },
      { status: 500 }
    )
  }

  // Send Clerk invites for portal users
  const invite_statuses: Array<{ email: string; status: string; error?: string }> = []
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://portal.gateguard.co'

  const clerk = await clerkClient()
  for (const u of portal_users) {
    if (!u.email?.includes('@')) {
      invite_statuses.push({ email: u.email, status: 'skipped_invalid_email' })
      continue
    }
    try {
      const existing = await clerk.users.getUserList({ emailAddress: [u.email] })
      if (existing.totalCount > 0) {
        // Existing user — wire org context
        await clerk.users.updateUserMetadata(existing.data[0].id, {
          publicMetadata: {
            org_id:      org.id,
            org_tier:    org.org_tier,
            role:        u.role,
            org_name:    org.name,
            assigned_at: new Date().toISOString(),
            assigned_by: caller.id,
          },
        })
        invite_statuses.push({ email: u.email, status: 'existing_user_updated' })
      } else {
        await clerk.invitations.createInvitation({
          emailAddress: u.email,
          publicMetadata: {
            org_id:      org.id,
            org_tier:    org.org_tier,
            role:        u.role,
            org_name:    org.name,
            assigned_at: new Date().toISOString(),
            assigned_by: caller.id,
          },
          redirectUrl: `${baseUrl}/onboarding`,
        })
        invite_statuses.push({ email: u.email, status: 'invited' })
      }
    } catch (err: any) {
      invite_statuses.push({ email: u.email, status: 'error', error: err.message })
    }
  }

  // Create technician records
  const tech_ids: string[] = []
  for (const tech of technicians) {
    if (!tech.first_name?.trim() || !tech.last_name?.trim()) continue
    const tech_code = generateTechCode(tech.first_name, tech.last_name)
    const { data: techRow } = await supabase
      .from('technicians')
      .insert({
        org_id,
        first_name: tech.first_name.trim(),
        last_name:  tech.last_name.trim(),
        email:      tech.email ?? null,
        phone:      tech.phone ?? null,
        tech_code,
        status:     'active',
      })
      .select('id')
      .single()
    if (techRow?.id) tech_ids.push(techRow.id)
  }

  // Log activation (fire-and-forget, non-fatal)
  void (async () => {
    try {
      await supabase.from('sensitive_field_access_log').insert({
        user_id:    caller.id,
        org_id,
        table_name: 'organizations',
        record_id:  org_id,
        fields:     ['activated'],
        ip_address: req.headers.get('x-forwarded-for') ?? null,
      })
    } catch (_) {}
  })()

  const invited_count  = invite_statuses.filter(s => s.status === 'invited').length
  const error_count    = invite_statuses.filter(s => s.status === 'error').length

  return NextResponse.json({
    ok: true,
    invite_statuses,
    tech_ids,
    message: `${org.name} is now live. ${invited_count} portal invite${invited_count !== 1 ? 's' : ''} sent.${error_count > 0 ? ` ${error_count} invite(s) failed — check invite_statuses.` : ''} ${tech_ids.length > 0 ? `${tech_ids.length} technician record${tech_ids.length !== 1 ? 's' : ''} created.` : ''}`.trim(),
  }, { status: 200 })
}
