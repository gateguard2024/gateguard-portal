/**
 * User org self-heal — kills the "paste JSON into Clerk" problem.
 *
 * A user only works when their Clerk publicMetadata carries `org_tier` (+ org_id,
 * role). New users get it automatically from the Add-Person wizard. This route
 * covers the leftovers — users created before that, or straight in the Clerk
 * dashboard — so nobody has to hand-edit metadata again.
 *
 * GET  (corporate): list every user missing `org_tier` — the "needs setup" cases.
 * POST: heal one. Self-serve (no body) heals the CURRENT user; corporate may pass
 *       { clerk_user_id }. It ONLY auto-applies org context that was explicitly
 *       set on that user's own invitation — it never guesses a tier, so it can
 *       never accidentally grant corporate. If nothing safe is found it returns
 *       { needsSetup: true } and the Users page prompts a one-click Assign Org.
 */
import { NextRequest, NextResponse } from 'next/server'
import { clerkClient } from '@clerk/nextjs/server'
import { getCurrentUser } from '@/lib/current-user'
import { upsertProfileFromClerk } from '@/lib/profile-sync'

export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tierOf = (meta: any): string | null => (meta && typeof meta.org_tier === 'string' && meta.org_tier) ? meta.org_tier : null

export async function GET() {
  const caller = await getCurrentUser()
  if (!caller.isCorporate) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const client = await clerkClient()
  const { data: users } = await client.users.getUserList({ limit: 500 })
  const needs_setup = users
    .filter(u => !tierOf(u.publicMetadata))
    .map(u => ({
      id: u.id,
      email: u.emailAddresses[0]?.emailAddress ?? '',
      name: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || '(no name)',
      role: (u.publicMetadata as Record<string, unknown>)?.role ?? null,
      created_at: new Date(u.createdAt).toISOString(),
    }))
  return NextResponse.json({ needs_setup, count: needs_setup.length })
}

export async function POST(req: NextRequest) {
  const caller = await getCurrentUser()
  if (!caller?.id || caller.id === 'anonymous') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const targetId = (body.clerk_user_id as string | undefined) || caller.id
  // A user may heal themselves; only corporate may heal someone else.
  if (targetId !== caller.id && !caller.isCorporate) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const client = await clerkClient()
  const user = await client.users.getUser(targetId)
  if (tierOf(user.publicMetadata)) {
    return NextResponse.json({ ok: true, healed: false, reason: 'already set up' })
  }

  const email = (user.emailAddresses[0]?.emailAddress ?? '').toLowerCase()
  // ONLY safe source: this user's own invitation, where the org was chosen at
  // invite time. Never infer from anything else — guessing could over-grant.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let derived: { org_id: string; org_tier: string; role: string } | null = null
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: invs } = await client.invitations.getInvitationList({ limit: 200 }) as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inv = (invs ?? []).find((i: any) => (i.emailAddress ?? '').toLowerCase() === email && (i.publicMetadata as any)?.org_tier)
    if (inv) {
      const m = inv.publicMetadata as Record<string, string>
      derived = { org_id: m.org_id, org_tier: m.org_tier, role: m.role || 'dealer' }
    }
  } catch { /* best-effort */ }

  if (!derived || !derived.org_tier) {
    return NextResponse.json({ ok: true, healed: false, needsSetup: true })
  }

  await client.users.updateUserMetadata(targetId, {
    publicMetadata: { org_id: derived.org_id, org_tier: derived.org_tier, role: derived.role, healed_at: new Date().toISOString() },
  })
  await upsertProfileFromClerk({
    id: targetId, firstName: user.firstName, lastName: user.lastName, email,
    publicMetadata: { org_id: derived.org_id, org_tier: derived.org_tier, role: derived.role },
  })
  return NextResponse.json({ ok: true, healed: true, ...derived })
}
