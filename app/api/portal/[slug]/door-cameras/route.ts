/**
 * GET /api/portal/[slug]/door-cameras — PIN-gated. For each gate / door on the
 * portal, the camera that watches it (lib/door-cameras.ts: openings → Gate Watch
 * → same name), so the Access page can show live video next to the Open buttons.
 * Only this portal's doors (client_portals.door_ids) and cameras (camera_ids).
 * → { links: { [doorId]: { camera: { key, id, name, provider }, how } }, edge: EdgePass | null }
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyPortal } from '@/lib/portal-auth'
import { siteVideo, portalCameraScope } from '@/lib/video'
import { getSiteBrivoToken, listBrivoDoors } from '@/lib/brivo'
import { doorCameraLinks, type LinkCam } from '@/lib/door-cameras'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const v = await verifyPortal(req, params.slug)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status })
  const siteId = v.portal.site_id
  if (!siteId) return NextResponse.json({ links: {}, edge: null })

  const whitelist = v.portal.door_ids && v.portal.door_ids.length ? new Set(v.portal.door_ids.map(String)) : null
  const scope = portalCameraScope(v.portal.camera_ids)
  const [doors, cams] = await Promise.all([
    (async () => {
      try {
        const { token, apiKey, brivoSiteId } = await getSiteBrivoToken(siteId)
        const all = (await listBrivoDoors(token, apiKey, brivoSiteId)).map(d => ({ id: String(d.id), name: d.name }))
        return whitelist ? all.filter(d => whitelist.has(d.id)) : all
      } catch { return [] as { id: string; name: string }[] }
    })(),
    siteVideo(siteId, new URLSearchParams({ view: 'cameras' }), { userId: `portal:${v.portal.slug}`, allow: scope.allow, edgeCameras: scope.edgeCameras }).catch(() => null),
  ])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body = (cams?.body ?? {}) as any
  const cameras: LinkCam[] = (Array.isArray(body.cameras) ? body.cameras : []).map((c: LinkCam) => ({ key: c.key, id: c.id, name: c.name, provider: c.provider }))
  try {
    const links = await doorCameraLinks(siteId, doors, cameras)
    const usesEdge = Object.values(links).some(l => l.camera.provider === 'edge')
    return NextResponse.json({ links, edge: usesEdge ? (body.edge ?? null) : null })
  } catch (e) {
    return NextResponse.json({ links: {}, edge: null, error: e instanceof Error ? e.message : 'Could not match cameras' })
  }
}
