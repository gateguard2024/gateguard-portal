/**
 * POST /api/nexus/operations/fleet-refresh — admin "refresh fleet health now".
 * Fires the Inngest operations/fleet.sync event (all sites, or one if site_id given)
 * so live UniFi/Eagle-Eye status is pulled on demand instead of waiting for the
 * nightly cron. Admin / corporate only.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { inngest } from '@/inngest/client'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!(user.role === 'admin' || user.isCorporate)) {
    return NextResponse.json({ error: 'Only an administrator can refresh fleet health.' }, { status: 403 })
  }
  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const siteId = typeof body.site_id === 'string' ? body.site_id : undefined
  await inngest.send({ name: 'operations/fleet.sync', data: siteId ? { site_id: siteId } : {} })
  return NextResponse.json({ queued: true })
}
