/**
 * GET /api/admin/setup-corporate
 *
 * One-time utility: looks up the corporate org row in Supabase and stamps
 * the calling user's Clerk publicMetadata with:
 *   org_id   = corporate org UUID
 *   org_tier = 'corporate'
 *   role     = 'admin'
 *
 * Only callable by users whose Clerk metadata already has org_tier='corporate'
 * OR whose email is rfeldman@gateguard.co (bootstrap case).
 *
 * Safe to call repeatedly — idempotent.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Look up the Clerk user to verify identity
  const clerk = await clerkClient()
  const clerkUser = await clerk.users.getUser(userId)
  const email = clerkUser.emailAddresses[0]?.emailAddress ?? ''
  const meta  = clerkUser.publicMetadata ?? {}

  // Only allow GateGuard staff (bootstrap: rfeldman@gateguard.co OR already marked corporate)
  const isAllowed =
    email.endsWith('@gateguard.co') ||
    (meta.org_tier as string) === 'corporate'

  if (!isAllowed) {
    return NextResponse.json({ error: 'Forbidden — GateGuard staff only' }, { status: 403 })
  }

  // Find or create the corporate org
  let { data: corpOrg } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('org_tier', 'corporate')
    .limit(1)
    .single()

  if (!corpOrg) {
    // Seed it now (in case migration 072 hasn't run yet)
    const { data: inserted, error: insertErr } = await supabase
      .from('organizations')
      .insert({ name: 'GateGuard', org_tier: 'corporate', is_active: true })
      .select('id, name')
      .single()

    if (insertErr || !inserted) {
      return NextResponse.json(
        { error: `Failed to create corporate org: ${insertErr?.message}` },
        { status: 500 }
      )
    }
    corpOrg = inserted
  }

  // Stamp Clerk metadata
  await clerk.users.updateUser(userId, {
    publicMetadata: {
      ...meta,
      org_id:   corpOrg.id,
      org_tier: 'corporate',
      role:     'admin',
    },
  })

  return NextResponse.json({
    ok:      true,
    org_id:  corpOrg.id,
    org_name: corpOrg.name,
    message: `Your Clerk metadata has been updated. org_id=${corpOrg.id}. Refresh the portal to apply.`,
  })
}
