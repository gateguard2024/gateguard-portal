/**
 * GET /api/unifi/access/doors?site_id=  — list UniFi Access doors for a site.
 * 'doors' capability required. (Controller must be reachable from our servers.)
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { canOperate } from '@/lib/system-access'
import { listUnifiAccessDoors } from '@/lib/unifi'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const siteId = req.nextUrl.searchParams.get('site_id') ?? ''
  if (!siteId) return NextResponse.json({ error: 'site_id required' }, { status: 400 })
  if (!(await canOperate(await getCurrentUser(), siteId, 'doors'))) return NextResponse.json({ error: 'No door access.' }, { status: 403 })
  try {
    const doors = await listUnifiAccessDoors(siteId)
    return NextResponse.json({ doors })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'UniFi Access fetch failed', doors: [] }, { status: 502 })
  }
}
