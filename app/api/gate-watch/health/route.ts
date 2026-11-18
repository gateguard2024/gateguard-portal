import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { gateWatchHealth } from '@/lib/gate-watch'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/gate-watch/health[?site_id=]  — corporate only.
 * Plain-English "why isn't this gate alerting?" for every Gate Watch gate:
 * schedule running, picture, last reads, and anything silencing it.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user?.isCorporate) return NextResponse.json({ error: 'Corporate only' }, { status: 403 })
  try {
    return NextResponse.json(await gateWatchHealth(new URL(req.url).searchParams.get('site_id')), { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Health check failed' }, { status: 500 })
  }
}
