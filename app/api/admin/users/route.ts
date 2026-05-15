/**
 * GET  /api/admin/users  — list all Clerk users + their permissions from Supabase
 * POST /api/admin/users  — invite a new user via Clerk invitation
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Get all users from Clerk
    const client = await clerkClient()
    const { data: clerkUsers } = await client.users.getUserList({ limit: 100 })

    // Get all permissions from Supabase
    const { data: perms } = await supabase
      .from('user_permissions')
      .select('*')

    const permsMap = Object.fromEntries(
      (perms || []).map((p: any) => [p.clerk_user_id, p])
    )

    const users = clerkUsers.map((u) => ({
      id: u.id,
      email: u.emailAddresses[0]?.emailAddress ?? '',
      full_name: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim(),
      image_url: u.imageUrl,
      created_at: new Date(u.createdAt).toISOString(),
      last_sign_in: u.lastSignInAt ? new Date(u.lastSignInAt).toISOString() : null,
      permissions: permsMap[u.id] ?? null,
    }))

    // Also include pending invitations
    const { data: invitations } = await client.invitations.getInvitationList({ status: 'pending' })
    const pending = (invitations || []).map((inv: any) => ({
      id: `inv_${inv.id}`,
      email: inv.emailAddress,
      full_name: '— Invited',
      image_url: null,
      created_at: new Date(inv.createdAt).toISOString(),
      last_sign_in: null,
      status: 'pending_invite',
      permissions: null,
    }))

    return NextResponse.json({ users, pending })
  } catch (err: any) {
    console.error('[admin/users GET]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
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
