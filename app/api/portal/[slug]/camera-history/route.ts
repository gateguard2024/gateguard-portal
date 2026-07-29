import { NextRequest, NextResponse } from 'next/server'
import { verifyPortal } from '@/lib/portal-auth'
import { getSiteEagleEyeAccess, eagleEyeListRecordedSegments } from '@/lib/eagle-eye'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/portal/[slug]/camera-history?camera_id=&date=YYYY-MM-DD
// PIN-gated. Lists the recorded video segments available for a camera on a given
// day so the portal can render an archive browser. Falls back to the last 24h if
// no date is given.
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const v = await verifyPortal(req, params.slug)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status })

  const cameraId = req.nextUrl.searchParams.get('camera_id') ?? ''
  if (!cameraId || !v.portal.site_id) return NextResponse.json({ error: 'camera_id required' }, { status: 400 })
  if (v.portal.camera_ids && v.portal.camera_ids.length && !v.portal.camera_ids.includes(cameraId)) {
    return NextResponse.json({ error: 'Camera not on this portal.' }, { status: 403 })
  }

  const date = req.nextUrl.searchParams.get('date') // YYYY-MM-DD (local day)
  let startISO: string, endISO: string
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    startISO = new Date(`${date}T00:00:00`).toISOString()
    endISO = new Date(`${date}T23:59:59`).toISOString()
  } else {
    endISO = new Date().toISOString()
    startISO = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  }

  try {
    const { token, baseHost } = await getSiteEagleEyeAccess(v.portal.site_id)
    const segments = await eagleEyeListRecordedSegments(token, baseHost, cameraId, startISO, endISO)
    return NextResponse.json({ segments })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'History lookup failed', segments: [] }, { status: 502 })
  }
}
