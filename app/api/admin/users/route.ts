/**
 * GET  /api/admin/users  — list all Clerk users + their permissions from Supabase
 * POST /api/admin/users  — invite a new user via Clerk invitation
 */
import { NextRequest, NextResponse } from 'next/server'
import { clerkClient } from '@clerk/nextjs/server'
import { sendClerkInvite } from '@/lib/send-invite'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { normalizeRole } from '@/lib/permissions'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const caller = await getCurrentUser()

    // Must be authenticated and at an org tier that manages other users
    if (!caller.id || caller.id === 'system') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // Only corporate, master_agent, master_dealer, full_dealer can access user management
    if (
      !caller.isCorporate &&
      !caller.isMasterAgent &&
      !caller.isMasterDealer &&
      !caller.isFullDealer
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Build the set of org IDs this caller is allowed to see users for
    // Corporate → all orgs (no filter). Others → own org + direct child orgs only.
    let permittedOrgIds: string[] | null = null
    if (!caller.isCorporate && caller.org_id) {
      const { data: childOrgs } = await supabase
        .from('organizations')
        .select('id')
        .eq('parent_org_id', caller.org_id)

      permittedOrgIds = [
        caller.org_id,
        ...((childOrgs ?? []) as { id: string }[]).map(o => o.id),
      ]
    }

    // Optional ?org_id= filter — narrows the list to a specific org's staff
    // (used by the opportunity window to pick the assigned DEALER's people).
    // Corporate may target any org; others only within their own permitted
    // subtree. An out-of-scope or unknown org is ignored (falls back to the
    // default scoping) so the param can never widen access.
    let filterOrgIds: string[] | null = permittedOrgIds
    const requestedOrg = new URL(req.url).searchParams.get('org_id')
    if (requestedOrg) {
      const allowed = caller.isCorporate || (permittedOrgIds?.includes(requestedOrg) ?? false)
      if (allowed) {
        const { data: kids } = await supabase
          .from('organizations')
          .select('id')
          .eq('parent_org_id', requestedOrg)
        filterOrgIds = [requestedOrg, ...((kids ?? []) as { id: string }[]).map(o => o.id)]
      }
    }

    const client = await clerkClient()

    // Fetch Clerk users — use a higher limit; filter in-memory by org scope
    const { data: clerkUsers } = await client.users.getUserList({ limit: 500 })

    // Get all permissions from Supabase (scoped if needed)
    const { data: perms } = await supabase
      .from('user_permissions')
      .select('*')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const permsMap = Object.fromEntries((perms ?? []).map((p: any) => [p.clerk_user_id, p]))

    const users = clerkUsers
      .filter(u => {
        // No filter set → corporate with no ?org_id= narrowing → sees everyone
        if (!filterOrgIds) return true
        // Otherwise: only users whose org_id is in the permitted / requested set
        const userOrgId = u.publicMetadata?.org_id as string | undefined
        // If user has no org assigned, only unfiltered corporate can see them
        if (!userOrgId) return false
        return filterOrgIds.includes(userOrgId)
      })
      .map(u => ({
        id: u.id,
        email: u.emailAddresses[0]?.emailAddress ?? '',
        full_name: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim(),
        image_url: u.imageUrl,
        created_at: new Date(u.createdAt).toISOString(),
        last_sign_in: u.lastSignInAt ? new Date(u.lastSignInAt).toISOString() : null,
        org_id:   (u.publicMetadata?.org_id  as string) ?? null,
        org_tier: (u.publicMetadata?.org_tier as string) ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        role: (u.publicMetadata?.role as string) ?? (permsMap[u.id] as any)?.role ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        permissions: permsMap[u.id] ?? null,
      }))

    // Pending invitations — only corporate or the inviting org can see them
    // (Clerk doesn't store which org invited them, so corporate sees all; others see none)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let pending: any[] = []
    if (caller.isCorporate) {
      const { data: invitations } = await client.invitations.getInvitationList({ status: 'pending' })
      pending = (invitations ?? []).map((inv: any) => ({
        id:          `inv_${inv.id}`,
        email:       inv.emailAddress,
        full_name:   '— Invited',
        image_url:   null,
        created_at:  new Date(inv.createdAt).toISOString(),
        last_sign_in: null,
        status:      'pending_invite',
        permissions: null,
      }))
    }

    return NextResponse.json({ users, pending })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[admin/users GET]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const caller = await getCurrentUser()

    // AUTH GATE — this route had NONE. Any logged-in user could invite users.
    // Inviting a portal login is a corporate/admin action.
    if (!caller.isCorporate && normalizeRole(caller.role) !== 'admin') {
      return NextResponse.json({ error: 'Only an Admin can invite users.' }, { status: 403 })
    }

    const { email, role, full_name } = await req.json()
    if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

    const client = await clerkClient()

    // Send Clerk invitation.
    //
    // ⚠️ HIERARCHY: this used to stamp only `{ role, invited_by }` — NO org_id,
    // NO org_tier. A user invited here signed up with no org context, so
    // resolveOrgScope failed them closed and they saw NOTHING (and could never
    // be corporate, since this page has no corporate option). We now stamp the
    // caller's own org context, so an invitee lands at the inviter's level —
    // a corporate admin inviting here produces a working corporate user.
    // The preferred path is still the glass "+ Add Person" wizard, which has an
    // org picker; this is the safety net so the legacy page can't mint a
    // scope-less user.
    const invitation = await sendClerkInvite({
      emailAddress: email,
      redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://portal.gateguard.co'}/sign-up`,
      publicMetadata: {
        role: role ?? 'viewer',
        org_id: caller.org_id ?? null,
        org_tier: caller.org_tier ?? null,
        invited_by: caller.id,
      },
    })

    // Pre-create permissions row in Supabase (will be linked when user signs up)
    await supabase.from('user_permissions').upsert({
      clerk_user_id: `pending_${invitation.id}`,
      email,
      full_name: full_name ?? email,
      role: role ?? 'viewer',
      invited_at: new Date().toISOString(),
    }, { onConflict: 'clerk_user_id' })

    return NextResponse.json({ ok: true, invitation_id: invitation.id })
  } catch (err: any) {
    console.error('[admin/users POST]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
