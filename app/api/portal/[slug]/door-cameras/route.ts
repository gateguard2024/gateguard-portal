/**
 * GET /api/portal/[slug]/door-cameras — PIN-gated. For each gate / door on the
 * portal, the camera that watches it (lib/door-cameras.ts: openings → Gate Watch
 * → same name), so the Access page can show live video next to the Open buttons.
 * Only this portal's doors (client_portals.door_ids) and cameras (camera_ids).
 * → { links: { [doorId]: { camera, how } }, cameras: LinkCam[], order: doorId[], edge: EdgePass | null }
 *
 * POST (signed-in manager — personal PIN): the property's own layout, saved on the
 * portal (client_portals.branding.access, no migration):
 *   { action: 'set_camera', door_id, camera_key }  — a camera key, 'none', or null = automatic
 *   { action: 'set_order', order: [doorId…] }       — tile order on the Access page
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getPortalManager } from '@/lib/portal-manager'
import { memo } from '@/lib/memo'
import { verifyPortal } from '@/lib/portal-auth'
import { siteVideo, portalCameraScope } from '@/lib/video'
import { getSiteBrivoToken, listBrivoDoors } from '@/lib/brivo'
import { doorCameraLinks, type LinkCam } from '@/lib/door-cameras'

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
type Layout = { cams?: Record<string, string>; order?: string[] }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const layoutOf = (branding: any): Layout => (branding && typeof branding.access === 'object' && branding.access) || {}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const v = await verifyPortal(req, params.slug)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status })
  const siteId = v.portal.site_id
  if (!siteId) return NextResponse.json({ links: {}, cameras: [], order: [], edge: null })
  const layout = layoutOf(v.portal.branding)

  const whitelist = v.portal.door_ids && v.portal.door_ids.length ? new Set(v.portal.door_ids.map(String)) : null
  const scope = portalCameraScope(v.portal.camera_ids)
  const [doors, cams] = await Promise.all([
    (async () => {
      try {
        const { token, apiKey, brivoSiteId } = await getSiteBrivoToken(siteId)
        // Same memory key as /summary, so the dashboard and Access share one Brivo call.
        const all = (await memo(`brivo-doors:${siteId}`, 10 * 60_000, async () => (await listBrivoDoors(token, apiKey, brivoSiteId)).map(d => ({ id: d.id, name: d.name })))).map(d => ({ id: String(d.id), name: d.name }))
        return whitelist ? all.filter(d => whitelist.has(d.id)) : all
      } catch { return [] as { id: string; name: string }[] }
    })(),
    siteVideo(siteId, new URLSearchParams({ view: 'cameras' }), { userId: `portal:${v.portal.slug}`, allow: scope.allow, edgeCameras: scope.edgeCameras }).catch(() => null),
  ])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body = (cams?.body ?? {}) as any
  const cameras: LinkCam[] = (Array.isArray(body.cameras) ? body.cameras : []).map((c: LinkCam) => ({ key: c.key, id: c.id, name: c.name, provider: c.provider }))
  try {
    const links = await doorCameraLinks(siteId, doors, cameras, layout.cams ?? {})
    const usesEdge = cameras.some(c => c.provider === 'edge')
    const byName: Record<string, string> = {}
    for (const d of doors) if (links[d.id]) byName[d.name] = links[d.id].camera.key
    return NextResponse.json({ links, byName, cameras, choices: layout.cams ?? {}, order: Array.isArray(layout.order) ? layout.order : [], edge: usesEdge ? (body.edge ?? null) : null })
  } catch (e) {
    return NextResponse.json({ links: {}, cameras, order: [], edge: null, error: e instanceof Error ? e.message : 'Could not match cameras' })
  }
}

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const v = await verifyPortal(req, params.slug)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status })
  const manager = await getPortalManager(req, params.slug)
  if (!manager) return NextResponse.json({ error: 'Sign in with your personal PIN first.' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const idOk = (x: unknown) => typeof x === 'string' && x.length > 0 && x.length <= 80

  // Re-read the portal so two quick saves don't drop each other's change.
  const { data: row, error: rErr } = await db().from('client_portals').select('id, branding').ilike('slug', v.portal.slug).maybeSingle()
  if (rErr || !row) return NextResponse.json({ error: rErr?.message ?? 'Portal not found.' }, { status: 500 })
  const branding = (row.branding && typeof row.branding === 'object') ? { ...row.branding } : {}
  const layout: Layout = { ...layoutOf(branding) }
  let note = ''

  if (b.action === 'set_camera') {
    if (!idOk(b.door_id)) return NextResponse.json({ error: 'door_id required' }, { status: 400 })
    const key = b.camera_key
    if (key !== null && key !== 'none' && !(typeof key === 'string' && /^(een|edge):.{1,120}$/.test(key))) return NextResponse.json({ error: 'Pick a camera.' }, { status: 400 })
    if (key && key !== 'none' && !portalCameraScope(v.portal.camera_ids).allow(key)) return NextResponse.json({ error: 'That camera isn’t on this portal.' }, { status: 403 })
    if (v.portal.door_ids?.length && !v.portal.door_ids.map(String).includes(b.door_id)) return NextResponse.json({ error: 'That door isn’t on this portal.' }, { status: 403 })
    const cams = { ...(layout.cams ?? {}) }
    if (key === null) delete cams[b.door_id]; else cams[b.door_id] = key
    layout.cams = cams
    note = key === null ? 'camera set back to automatic' : key === 'none' ? 'no camera' : `camera ${key}`
  } else if (b.action === 'set_order') {
    if (!Array.isArray(b.order) || b.order.length > 200 || !b.order.every(idOk)) return NextResponse.json({ error: 'order must be a list of door ids' }, { status: 400 })
    layout.order = Array.from(new Set(b.order as string[]))
    note = 'tile order'
  } else return NextResponse.json({ error: 'Unknown action' }, { status: 400 })

  const { error } = await db().from('client_portals').update({ branding: { ...branding, access: layout }, updated_at: new Date().toISOString() }).eq('id', row.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (v.portal.site_id) {
    const { error: eErr } = await db().from('site_events').insert({ site_id: v.portal.site_id, event_type: 'portal_access_layout', title: `Access page: ${note}`, description: `Changed by ${manager.name} (property portal)`, metadata: { door_id: b.door_id ?? null, by: manager.name } })
    if (eErr) console.error('[door-cameras] site_events', eErr.message)
  }
  return NextResponse.json({ ok: true, layout })
}
