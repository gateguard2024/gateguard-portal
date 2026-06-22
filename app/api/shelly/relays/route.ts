/**
 * GET /api/shelly/relays?site_id=<site>  — list the site's Shelly relays.
 * Operate action — available to users scoped to the site (dealers included).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { canOperate } from '@/lib/system-access'
import { listSiteShellyRelays } from '@/lib/shelly'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const siteId = req.nextUrl.searchParams.get('site_id') ?? ''
  if (!siteId) return NextResponse.json({ error: 'site_id required' }, { status: 400 })
  if (!(await canOperate(await getCurrentUser(), siteId, 'relays'))) return NextResponse.json({ error: 'You don’t have relay access for this site.' }, { status: 403 })
  try {
    const relays = await listSiteShellyRelays(siteId)
    return NextResponse.json({ relays })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Shelly fetch failed', relays: [] }, { status: 502 })
  }
}
