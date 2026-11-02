/**
 * GET /api/eagle-eye/live?site_id=&camera_id=
 * The camera's live preview feed as one continuous MJPEG stream for an <img>
 * (dealer camera viewer). Cameras capability required; token stays server-side.
 * The stream ends at maxDuration — the viewer reconnects on its own before that.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { canOperate } from '@/lib/system-access'
import { getSiteEagleEyeAccess, eagleEyeLiveStream } from '@/lib/eagle-eye'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const siteId = req.nextUrl.searchParams.get('site_id') ?? ''
  const cameraId = req.nextUrl.searchParams.get('camera_id') ?? ''
  if (!siteId || !cameraId) return NextResponse.json({ error: 'site_id and camera_id required' }, { status: 400 })
  if (!(await canOperate(await getCurrentUser(), siteId, 'cameras'))) return NextResponse.json({ error: 'No camera access.' }, { status: 403 })
  try {
    const { token, baseHost } = await getSiteEagleEyeAccess(siteId)
    // Stop pulling from Eagle Eye the moment the viewer closes.
    const ctl = new AbortController()
    req.signal.addEventListener('abort', () => ctl.abort())
    const up = await eagleEyeLiveStream(token, baseHost, cameraId, ctl.signal)
    if (!up?.body) return NextResponse.json({ error: 'No live feed for this camera.' }, { status: 502 })
    return new Response(up.body, {
      headers: {
        'Content-Type': up.headers.get('content-type') || 'multipart/x-mixed-replace',
        'Cache-Control': 'no-store, no-transform',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Live feed failed' }, { status: 502 })
  }
}
