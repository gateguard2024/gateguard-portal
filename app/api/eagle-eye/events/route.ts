/**
 * GET /api/eagle-eye/events?site_id=<site>&hours=24&camera_id=<id>
 * Historical camera events (motion, LPR, tamper, line-cross, device status) for a
 * property over the last N hours, with camera names joined in. 'cameras' capability.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { canOperate } from '@/lib/system-access'
import { getSiteEagleEyeAccess, listEagleEyeEvents, listEagleEyeCameras } from '@/lib/eagle-eye'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const siteId = req.nextUrl.searchParams.get('site_id') ?? ''
  if (!siteId) return NextResponse.json({ error: 'site_id required', events: [] }, { status: 400 })
  if (!(await canOperate(await getCurrentUser(), siteId, 'cameras'))) return NextResponse.json({ error: 'You don’t have camera access for this site.', events: [] }, { status: 403 })
  try {
    const { token, baseHost } = await getSiteEagleEyeAccess(siteId)
    const hours = Number(req.nextUrl.searchParams.get('hours')) || 24
    const cameraId = req.nextUrl.searchParams.get('camera_id') || undefined
    const [events, cameras] = await Promise.all([
      listEagleEyeEvents(token, baseHost, { hours, cameraId }),
      listEagleEyeCameras(token, baseHost).catch(() => []),
    ])
    const nameOf = new Map(cameras.map(c => [c.id, c.name]))
    const enriched = events
      .map(e => ({ ...e, cameraName: e.cameraId ? (nameOf.get(e.cameraId) ?? null) : null }))
      .sort((a, b) => (b.when ? Date.parse(b.when) : 0) - (a.when ? Date.parse(a.when) : 0))
    return NextResponse.json({ events: enriched })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Eagle Eye events failed', events: [] }, { status: 502 })
  }
}
