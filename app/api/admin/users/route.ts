/**
 * GET  /api/admin/users  — list all Clerk users + their permissions from Supabase
 * POST /api/admin/users  — invite a new user via Clerk invitation
 */
import { NextRequest, NextResponse } from 'next/server'
import { clerkClient } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

export async function GET() {
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
        // Corporate sees everyone
        if (!permittedOrgIds) return true
        // Others: only users whose org_id is in their permitted subtree
        const userOrgId = u.publicMetadata?.org_id as string | undefined
        // If user has no org assigned, only corporate can see them
        if (!userOrgId) return false
        return permittedOrgIds.includes(userOrgId)
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
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { email, role, full_name } = await req.json()
    if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

    const client = await clerkClient()

    // Send Clerk invitation
    const invitation = await client.invitations.createInvitation({
      emailAddress: email,
      redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://portal.gateguard.co'}/sign-up`,
      publicMetadata: { role: role ?? 'viewer', invited_by: userId },
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
