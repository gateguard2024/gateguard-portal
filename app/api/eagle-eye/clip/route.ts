/**
 * GET /api/eagle-eye/clip?site_id=&camera_id=&ts=<ISO>
 * Proxies a recorded MP4 around a timestamp so it plays in <video> on our
 * domain. Cameras capability required. Falls back to 502 if no recording.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { canOperate } from '@/lib/system-access'
import { getSiteEagleEyeAccess, eagleEyeRecordedMp4Url, eagleEyeFetchMp4 } from '@/lib/eagle-eye'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const siteId = req.nextUrl.searchParams.get('site_id') ?? ''
  const cameraId = req.nextUrl.searchParams.get('camera_id') ?? ''
  const ts = req.nextUrl.searchParams.get('ts') ?? new Date(Date.now() - 60_000).toISOString()
  if (!siteId || !cameraId) return NextResponse.json({ error: 'site_id and camera_id required' }, { status: 400 })
  if (!(await canOperate(await getCurrentUser(), siteId, 'cameras'))) return NextResponse.json({ error: 'No camera access.' }, { status: 403 })
  try {
    const { token, baseHost } = await getSiteEagleEyeAccess(siteId)
    const url = await eagleEyeRecordedMp4Url(token, baseHost, cameraId, ts)
    if (!url) return NextResponse.json({ error: 'No recording found for that time.' }, { status: 502 })
    const clip = await eagleEyeFetchMp4(token, url)
    if (!clip) return NextResponse.json({ error: 'Could not fetch the recording.' }, { status: 502 })
    return new NextResponse(new Uint8Array(clip.buf), { headers: { 'Content-Type': clip.type, 'Cache-Control': 'no-store' } })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Clip failed' }, { status: 502 })
  }
}
