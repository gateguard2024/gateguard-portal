/**
 * /api/portal/[slug]/vision-layouts — saved camera layouts for Vision ("Gates",
 * "Pool area"…), shared by everyone on the property. Stored on the portal
 * (client_portals.branding.vision_layouts) — no migration. Saving needs a manager.
 *   GET → { layouts: [{ id, name, cams: [key], featured }] }
 *   POST { name, cams, featured? } → add · DELETE { id } → remove
 */
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { verifyPortal } from '@/lib/portal-auth'
import { getPortalManager } from '@/lib/portal-manager'
import { portalCameraScope } from '@/lib/video'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
type Layout = { id: string; name: string; cams: string[]; featured: string | null }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const layoutsOf = (b: any): Layout[] => (b && Array.isArray(b.vision_layouts) ? b.vision_layouts : [])

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const v = await verifyPortal(req, params.slug)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status })
  return NextResponse.json({ layouts: layoutsOf(v.portal.branding) })
}

async function write(req: NextRequest, slug: string, change: (l: Layout[], scope: ReturnType<typeof portalCameraScope>) => Layout[] | string) {
  const v = await verifyPortal(req, slug)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status })
  if (!(await getPortalManager(req, slug))) return NextResponse.json({ error: 'Sign in with your personal PIN to save layouts.', need_manager: true }, { status: 403 })
  const { data: row, error } = await db().from('client_portals').select('id, branding').ilike('slug', v.portal.slug).maybeSingle()
  if (error || !row) return NextResponse.json({ error: error?.message ?? 'Portal not found' }, { status: 500 })
  const next = change(layoutsOf(row.branding), portalCameraScope(v.portal.camera_ids))
  if (typeof next === 'string') return NextResponse.json({ error: next }, { status: 400 })
  const branding = { ...(row.branding && typeof row.branding === 'object' ? row.branding : {}), vision_layouts: next }
  const { error: uErr } = await db().from('client_portals').update({ branding, updated_at: new Date().toISOString() }).eq('id', row.id)
  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 })
  return NextResponse.json({ layouts: next })
}

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const b = await req.json().catch(() => ({}))
  return write(req, params.slug, (list, scope) => {
    const name = String(b.name ?? '').trim().slice(0, 40)
    const cams = Array.isArray(b.cams) ? Array.from(new Set((b.cams as unknown[]).map(String))).filter(k => /^(een|edge):.{1,120}$/.test(k) && scope.allow(k)).slice(0, 40) : []
    if (!name) return 'Name the layout.'
    if (!cams.length) return 'Pick at least one camera.'
    if (list.length >= 12) return 'Up to 12 layouts — remove one first.'
    const featured = b.featured && cams.includes(String(b.featured)) ? String(b.featured) : cams[0]
    return [...list.filter(l => l.name.toLowerCase() !== name.toLowerCase()), { id: randomUUID(), name, cams, featured }]
  })
}

export async function DELETE(req: NextRequest, { params }: { params: { slug: string } }) {
  const b = await req.json().catch(() => ({}))
  return write(req, params.slug, list => list.filter(l => l.id !== String(b.id ?? '')))
}
