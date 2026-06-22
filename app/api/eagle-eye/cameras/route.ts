/**
 * GET /api/eagle-eye/cameras?site_id=<site>
 * Live camera list for a site (id, name, tags). OPERATE action — available to
 * any user scoped to the site (dealers included); the OAuth setup that makes it
 * work is corporate-only. Refreshes the token automatically.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { canOperate } from '@/lib/system-access'
import { getSiteEagleEyeAccess, listEagleEyeCameras } from '@/lib/eagle-eye'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const siteId = req.nextUrl.searchParams.get('site_id') ?? ''
  if (!siteId) return NextResponse.json({ error: 'site_id required' }, { status: 400 })
  if (!(await canOperate(await getCurrentUser(), siteId, 'cameras'))) return NextResponse.json({ error: 'You don’t have camera access for this site.' }, { status: 403 })
  try {
    const { token, baseHost } = await getSiteEagleEyeAccess(siteId)
    const cameras = await listEagleEyeCameras(token, baseHost)
    return NextResponse.json({ cameras })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Eagle Eye fetch failed', cameras: [] }, { status: 502 })
  }
}
