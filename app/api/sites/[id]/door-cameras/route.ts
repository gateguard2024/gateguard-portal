/**
 * /api/sites/[id]/door-cameras — map a camera to a door for one site.
 * GET    → all mappings for the site.
 * PUT    → upsert { door_id, door_name?, camera_id?, camera_name, stream_url? }
 * DELETE → ?door_id=<id> removes a mapping.
 * Admin + site-scope gated.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope } from '@/lib/org-scope'
import { normalizeRole } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function canManageSite(siteId: string): Promise<boolean> {
  const user = await getCurrentUser()
  if (!user.isCorporate && normalizeRole(user.role) !== 'admin') return false
  const scope = await resolveOrgScope(user)
  if (scope.all) return true
  const { data } = await supabase.from('sites').select('master_dealer_id, install_dealer_id, service_dealer_id, org_id').eq('id', siteId).maybeSingle()
  if (!data) return false
  return [data.master_dealer_id, data.install_dealer_id, data.service_dealer_id, data.org_id].some(o => o && scope.ids.includes(o))
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await canManageSite(params.id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // select('*') is drift-safe: the tags column (migration 130) may not exist yet.
  const { data } = await supabase.from('door_cameras').select('*').eq('site_id', params.id)
  return NextResponse.json({ mappings: data ?? [] })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await canManageSite(params.id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const body = await req.json().catch(() => ({}))
  const door_id = String(body.door_id ?? '')
  const camera_name = String(body.camera_name ?? '').trim()
  if (!door_id || !camera_name) return NextResponse.json({ error: 'door_id and camera_name are required' }, { status: 400 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row: Record<string, any> = {
    site_id: params.id,
    door_id,
    door_name: body.door_name ? String(body.door_name) : null,
    camera_id: body.camera_id ? String(body.camera_id) : null,
    camera_name,
    stream_url: body.stream_url ? String(body.stream_url).trim() : null,
    updated_at: new Date().toISOString(),
  }
  if (Array.isArray(body.tags)) row.tags = body.tags.map((t: unknown) => String(t).trim()).filter(Boolean)
  async function up(r: Record<string, unknown>) { return supabase.from('door_cameras').upsert(r, { onConflict: 'site_id,door_id' }) }
  let { error } = await up(row)
  // Drift-safe: if the tags column isn't deployed yet, retry without it.
  if (error && (error.code === '42703' || error.code === 'PGRST204') && 'tags' in row) { delete row.tags; ({ error } = await up(row)) }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await canManageSite(params.id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const door_id = req.nextUrl.searchParams.get('door_id') ?? ''
  if (!door_id) return NextResponse.json({ error: 'door_id required' }, { status: 400 })
  const { error } = await supabase.from('door_cameras').delete().eq('site_id', params.id).eq('door_id', door_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
