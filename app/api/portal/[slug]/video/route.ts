/**
 * GET /api/portal/[slug]/video?view=cameras|events|timeline|pass
 * The property portal's camera API: same as /api/sites/[id]/video (lib/video.ts),
 * but authed by the portal view PIN and limited to the cameras on this portal
 * (client_portals.camera_ids — see portalCameraScope). Eagle Eye pictures/clips
 * go through /api/portal/[slug]/camera-preview + /camera-clip; Edge video goes
 * browser → device with a pass that only opens this portal's Edge cameras.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyPortal } from '@/lib/portal-auth'
import { siteVideo, portalCameraScope } from '@/lib/video'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const v = await verifyPortal(req, params.slug)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status })
  if (!v.portal.site_id) return NextResponse.json({ cameras: [], edge: null, errors: {}, providers: { een: false, edge: false } })
  const scope = portalCameraScope(v.portal.camera_ids)
  const r = await siteVideo(v.portal.site_id, req.nextUrl.searchParams, { userId: `portal:${v.portal.slug}`, allow: scope.allow, edgeCameras: scope.edgeCameras })
  return NextResponse.json(r.body, { status: r.status })
}
