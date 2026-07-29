import { NextRequest, NextResponse } from 'next/server'
import { verifyPortal } from '@/lib/portal-auth'
import { getSiteEagleEyeAccess, eagleEyeRecordedMp4Url, eagleEyeFetchMp4 } from '@/lib/eagle-eye'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/portal/[slug]/camera-clip?camera_id=&ts=<ISO> — PIN-gated recorded MP4
// for the rewind/history player. Mirrors /api/eagle-eye/clip.
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const v = await verifyPortal(req, params.slug)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status })

  const cameraId = req.nextUrl.searchParams.get('camera_id') ?? ''
  const ts = req.nextUrl.searchParams.get('ts') ?? new Date(Date.now() - 60_000).toISOString()
  if (!cameraId || !v.portal.site_id) return NextResponse.json({ error: 'camera_id required' }, { status: 400 })
  if (v.portal.camera_ids && v.portal.camera_ids.length && !v.portal.camera_ids.includes(cameraId)) {
    return NextResponse.json({ error: 'Camera not on this portal.' }, { status: 403 })
  }

  try {
    const { token, baseHost } = await getSiteEagleEyeAccess(v.portal.site_id)
    const url = await eagleEyeRecordedMp4Url(token, baseHost, cameraId, ts)
    if (!url) return NextResponse.json({ error: 'No recording found for that time.' }, { status: 502 })
    const clip = await eagleEyeFetchMp4(token, url)
    if (!clip) return NextResponse.json({ error: 'Could not fetch the recording.' }, { status: 502 })
    return new NextResponse(new Uint8Array(clip.buf), { headers: { 'Content-Type': clip.type, 'Cache-Control': 'no-store' } })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Clip failed' }, { status: 502 })
  }
}
