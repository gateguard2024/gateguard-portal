import { NextRequest, NextResponse } from 'next/server'
import { verifyPortal } from '@/lib/portal-auth'
import { getSiteEagleEyeAccess, eagleEyePreviewFrame } from '@/lib/eagle-eye'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/portal/[slug]/camera-preview?camera_id= — PIN-gated live JPEG for a
// camera. Mirrors /api/eagle-eye/preview but authed by the portal PIN, and only
// for cameras the portal exposes.
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const v = await verifyPortal(req, params.slug)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status })

  const cameraId = req.nextUrl.searchParams.get('camera_id') ?? ''
  if (!cameraId || !v.portal.site_id) return NextResponse.json({ error: 'camera_id required' }, { status: 400 })
  if (v.portal.camera_ids && v.portal.camera_ids.length && !v.portal.camera_ids.includes(cameraId)) {
    return NextResponse.json({ error: 'Camera not on this portal.' }, { status: 403 })
  }

  try {
    const { token, baseHost } = await getSiteEagleEyeAccess(v.portal.site_id)
    const frame = await eagleEyePreviewFrame(token, baseHost, cameraId)
    if (!frame) return NextResponse.json({ error: 'No preview available' }, { status: 502 })
    return new NextResponse(new Uint8Array(frame), { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store' } })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Preview failed' }, { status: 502 })
  }
}
