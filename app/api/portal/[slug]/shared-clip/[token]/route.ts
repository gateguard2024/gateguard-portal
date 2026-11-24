/**
 * GET /api/portal/[slug]/shared-clip/[token] — the video behind a shared clip link.
 * NO PIN: the private link IS the permission (lib/clip-shares.ts). Streams the one
 * Eagle Eye recording covering the shared moment, with Range for seeking. Never
 * any other camera or time. A first request (no Range / bytes=0-) counts a view.
 */
import { NextRequest, NextResponse } from 'next/server'
import { resolveShare, countView } from '@/lib/clip-shares'
import { getSiteEagleEyeAccess, eagleEyeFindClip } from '@/lib/eagle-eye'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: NextRequest, { params }: { params: { slug: string; token: string } }) {
  const r = await resolveShare(params.token)
  if ('error' in r) return NextResponse.json({ error: r.error === 'expired' ? 'This link has expired.' : r.error === 'revoked' ? 'This link was turned off.' : 'Link not found.' }, { status: 404 })
  const s = r.share
  if (s.slug.toLowerCase() !== params.slug.toLowerCase()) return NextResponse.json({ error: 'Link not found.' }, { status: 404 })
  try {
    const { token, baseHost } = await getSiteEagleEyeAccess(s.site_id)
    const clip = await eagleEyeFindClip(token, baseHost, s.camera_id, s.ts)
    if (!clip) return NextResponse.json({ error: 'The recording for that time isn’t available any more.' }, { status: 404 })
    const range = req.headers.get('range')
    if (!range || /^bytes=0-$/.test(range)) await countView(s.id)
    const res = await fetch(clip.url, { headers: { Authorization: `Bearer ${token}`, ...(range ? { Range: range } : {}) }, signal: AbortSignal.timeout(55_000) })
    if (!res.ok || !res.body) return NextResponse.json({ error: `Could not fetch the recording (${res.status}).` }, { status: 502 })
    const h = new Headers({ 'Content-Type': res.headers.get('content-type') || 'video/mp4', 'Cache-Control': 'no-store', 'X-Clip-Start': clip.start, 'Accept-Ranges': 'bytes', 'Content-Disposition': `inline; filename="${s.camera_name.replace(/[^\w -]/g, '')}-${s.ts.slice(0, 16).replace(/[:T]/g, '-')}.mp4"` })
    for (const k of ['content-length', 'content-range']) { const val = res.headers.get(k); if (val) h.set(k, val) }
    return new NextResponse(res.body, { status: res.status, headers: h })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Clip failed' }, { status: 502 })
  }
}
