/**
 * GET /api/eagle-eye/preview?site_id=&camera_id=
 * Proxies a single live preview JPEG for a camera (token stays server-side).
 * Cameras capability required. The UI <img> polls this for a near-live tile.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { canOperate } from '@/lib/system-access'
import { getSiteEagleEyeAccess, eagleEyePreviewFrame } from '@/lib/eagle-eye'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const siteId = req.nextUrl.searchParams.get('site_id') ?? ''
  const cameraId = req.nextUrl.searchParams.get('camera_id') ?? ''
  if (!siteId || !cameraId) return NextResponse.json({ error: 'site_id and camera_id required' }, { status: 400 })
  if (!(await canOperate(await getCurrentUser(), siteId, 'cameras'))) return NextResponse.json({ error: 'No camera access.' }, { status: 403 })
  try {
    const { token, baseHost } = await getSiteEagleEyeAccess(siteId)
    const frame = await eagleEyePreviewFrame(token, baseHost, cameraId)
    if (!frame) return NextResponse.json({ error: 'No preview available' }, { status: 502 })
    return new NextResponse(new Uint8Array(frame), { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store' } })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Preview failed' }, { status: 502 })
  }
}
