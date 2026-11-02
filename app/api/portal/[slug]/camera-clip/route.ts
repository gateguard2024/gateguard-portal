import { NextRequest, NextResponse } from 'next/server'
import { verifyPortal } from '@/lib/portal-auth'
import { portalCameraScope } from '@/lib/video'
import { getSiteEagleEyeAccess, eagleEyeFindClip, type EenLiveTrace } from '@/lib/eagle-eye'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

// GET /api/portal/[slug]/camera-clip?camera_id=&ts=<ISO> — PIN-gated recorded MP4
// for the timeline player. Finds the recording covering `ts` (main stream, then
// preview) and STREAMS it through (no buffering: faster first frame, no
// response-size limit), passing the browser's Range header so seeking works.
// `X-Clip-Start` = when the returned recording starts. `&debug=1` → JSON trace.
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const v = await verifyPortal(req, params.slug)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status })

  const cameraId = req.nextUrl.searchParams.get('camera_id') ?? ''
  const ts = req.nextUrl.searchParams.get('ts') ?? new Date(Date.now() - 60_000).toISOString()
  const debug = req.nextUrl.searchParams.get('debug') === '1'
  if (!cameraId || !v.portal.site_id) return NextResponse.json({ error: 'camera_id required' }, { status: 400 })
  if (!portalCameraScope(v.portal.camera_ids).allow(`een:${cameraId}`)) {
    return NextResponse.json({ error: 'Camera not on this portal.' }, { status: 403 })
  }

  const trace: EenLiveTrace[] = []
  try {
    const { token, baseHost } = await getSiteEagleEyeAccess(v.portal.site_id)
    const clip = await eagleEyeFindClip(token, baseHost, cameraId, ts, trace)
    if (debug) return NextResponse.json({ ts, clip: clip ? { start: clip.start, end: clip.end, type: clip.type } : null, trace })
    if (!clip) return NextResponse.json({ error: 'No recording found for that time.' }, { status: 404 })

    const range = req.headers.get('range')
    const res = await fetch(clip.url, { headers: { Authorization: `Bearer ${token}`, ...(range ? { Range: range } : {}) }, signal: AbortSignal.timeout(55_000) })
    if (!res.ok || !res.body) return NextResponse.json({ error: `Could not fetch the recording (${res.status}).` }, { status: 502 })
    const h = new Headers({ 'Content-Type': res.headers.get('content-type') || 'video/mp4', 'Cache-Control': 'no-store', 'X-Clip-Start': clip.start, 'Accept-Ranges': 'bytes' })
    for (const k of ['content-length', 'content-range']) { const val = res.headers.get(k); if (val) h.set(k, val) }
    return new NextResponse(res.body, { status: res.status, headers: h })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Clip failed'
    if (debug) return NextResponse.json({ ts, error: msg, trace })
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
