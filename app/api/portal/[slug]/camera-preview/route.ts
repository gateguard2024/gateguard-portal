import { NextRequest, NextResponse } from 'next/server'
import { verifyPortal } from '@/lib/portal-auth'
import { portalCameraScope } from '@/lib/video'
import { getSiteEagleEyeAccess, eagleEyeLiveFrame, eagleEyePreviewFrame, type EenLiveTrace } from '@/lib/eagle-eye'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

// GET /api/portal/[slug]/camera-preview?camera_id= — PIN-gated live JPEG for a
// camera, authed by the portal PIN, only for cameras the portal exposes.
// Same picture as the dealer wall (/api/eagle-eye/preview): Eagle Eye's preview
// still (liveImage type=preview) — fast (~0.3 s), refreshed by the page every 5 s.
// `&live=1` first tries the camera's live preview feed (eagleEyeLiveFrame). On
// Marbella (Nov 2 2026) that feed opened but sent no picture within 8 s, so it is
// opt-in until that is solved. `X-Frame` says `live` or `stored`.
// `&debug=1` returns the step-by-step trace as JSON instead of the picture.
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const v = await verifyPortal(req, params.slug)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status })

  const cameraId = req.nextUrl.searchParams.get('camera_id') ?? ''
  const debug = req.nextUrl.searchParams.get('debug') === '1'
  const tryLive = req.nextUrl.searchParams.get('live') === '1'
  if (!cameraId || !v.portal.site_id) return NextResponse.json({ error: 'camera_id required' }, { status: 400 })
  if (!portalCameraScope(v.portal.camera_ids).allow(`een:${cameraId}`)) {
    return NextResponse.json({ error: 'Camera not on this portal.' }, { status: 403 })
  }

  const trace: EenLiveTrace[] = []
  try {
    const { token, baseHost } = await getSiteEagleEyeAccess(v.portal.site_id)
    let source: 'live' | 'stored' = 'stored'
    let frame = tryLive ? await eagleEyeLiveFrame(token, baseHost, cameraId, trace) : null
    if (frame) source = 'live'
    else frame = await eagleEyePreviewFrame(token, baseHost, cameraId)
    if (debug) return NextResponse.json({ source: frame ? source : 'none', bytes: frame?.length ?? 0, trace })
    if (!frame) return NextResponse.json({ error: 'No preview available' }, { status: 502 })
    return new NextResponse(new Uint8Array(frame), {
      headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store', 'X-Frame': source },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Preview failed'
    if (debug) return NextResponse.json({ source: 'none', error: msg, trace })
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
