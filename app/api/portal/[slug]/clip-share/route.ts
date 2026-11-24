/**
 * /api/portal/[slug]/clip-share — make / list / turn off "share this clip" links
 * (lib/clip-shares.ts). Signed-in manager only; Eagle Eye cameras on this portal only.
 *   GET                         → { shares }
 *   POST { camera_id, camera_name, ts, note?, days? } → { url, expires_at }
 *   DELETE { id }               → turn the link off now
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyPortal } from '@/lib/portal-auth'
import { getPortalManager } from '@/lib/portal-manager'
import { portalCameraScope } from '@/lib/video'
import { createShare, listShares, revokeShare } from '@/lib/clip-shares'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function gate(req: NextRequest, slug: string) {
  const v = await verifyPortal(req, slug)
  if (!v.ok) return { res: NextResponse.json({ error: v.error }, { status: v.status }) }
  if (!v.portal.site_id) return { res: NextResponse.json({ error: 'This portal is not linked to a site.' }, { status: 400 }) }
  const manager = await getPortalManager(req, slug)
  if (!manager) return { res: NextResponse.json({ error: 'Sign in with your personal PIN to share clips.', need_manager: true }, { status: 403 }) }
  return { v, manager, siteId: v.portal.site_id }
}

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const g = await gate(req, params.slug); if ('res' in g) return g.res
  return NextResponse.json({ shares: await listShares(g.siteId) })
}

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const g = await gate(req, params.slug); if ('res' in g) return g.res
  const b = await req.json().catch(() => ({}))
  const cameraId = String(b.camera_id ?? '')
  const ts = String(b.ts ?? '')
  if (!/^[A-Za-z0-9_-]{2,64}$/.test(cameraId)) return NextResponse.json({ error: 'Pick a camera.' }, { status: 400 })
  if (Number.isNaN(Date.parse(ts)) || Date.parse(ts) > Date.now() + 60_000) return NextResponse.json({ error: 'Pick a time in the past.' }, { status: 400 })
  if (!portalCameraScope(g.v.portal.camera_ids).allow(`een:${cameraId}`)) return NextResponse.json({ error: 'That camera isn’t on this portal.' }, { status: 403 })
  try {
    const s = await createShare({ siteId: g.siteId, slug: g.v.portal.slug, cameraId, cameraName: String(b.camera_name || 'Camera').slice(0, 80), ts: new Date(ts).toISOString(), note: b.note ? String(b.note).slice(0, 200) : null, by: g.manager.name, days: Number(b.days) || 7 })
    const origin = req.headers.get('x-forwarded-host') ? `https://${req.headers.get('x-forwarded-host')}` : req.nextUrl.origin
    return NextResponse.json({ url: `${origin}/portal/${encodeURIComponent(g.v.portal.slug)}/clip/${s.secret}`, expires_at: s.expires_at, id: s.id })
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not make the link' }, { status: 500 }) }
}

export async function DELETE(req: NextRequest, { params }: { params: { slug: string } }) {
  const g = await gate(req, params.slug); if ('res' in g) return g.res
  const b = await req.json().catch(() => ({}))
  return (await revokeShare(g.siteId, String(b.id ?? ''), g.manager.name)) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Not found' }, { status: 404 })
}
