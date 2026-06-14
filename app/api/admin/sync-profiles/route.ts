/**
 * POST /api/admin/sync-profiles  (corporate only)
 *
 * One-time / on-demand backfill: pull every Clerk user and upsert their
 * Supabase `profiles` row. Use this to populate profiles for users that
 * existed before the Clerk webhook was wired up.
 *
 * The webhook keeps profiles current going forward; this catches everyone else.
 */
import { NextResponse } from 'next/server'
import { clerkClient } from '@clerk/nextjs/server'
import { getCurrentUser } from '@/lib/current-user'
import { upsertProfileFromClerk, type ClerkUserLike } from '@/lib/profile-sync'

export const dynamic = 'force-dynamic'

export async function POST() {
  const caller = await getCurrentUser()
  if (!caller.isCorporate) {
    return NextResponse.json({ error: 'Corporate only.' }, { status: 403 })
  }

  const client = await clerkClient()
  let synced = 0
  let skipped = 0
  let offset = 0
  const limit = 100
  const reasons: Record<string, number> = {}

  // Paginate through all Clerk users.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res: any = await client.users.getUserList({ limit, offset })
    const users: any[] = Array.isArray(res) ? res : (res?.data ?? [])
    if (users.length === 0) break

    for (const u of users) {
      const mapped: ClerkUserLike = {
        id: u.id,
        firstName: u.firstName ?? null,
        lastName: u.lastName ?? null,
        email: u.primaryEmailAddress?.emailAddress ?? u.emailAddresses?.[0]?.emailAddress ?? null,
        publicMetadata: u.publicMetadata ?? {},
      }
      const r = await upsertProfileFromClerk(mapped)
      if (r.ok) {
        synced++
      } else {
        skipped++
        reasons[r.reason ?? 'unknown'] = (reasons[r.reason ?? 'unknown'] ?? 0) + 1
      }
    }

    offset += limit
    if (users.length < limit) break
  }

  return NextResponse.json({ ok: true, synced, skipped, reasons })
}
