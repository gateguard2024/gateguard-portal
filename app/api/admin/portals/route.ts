import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { createHash } from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

const ALL_MODULES = ['gate', 'cameras', 'passes', 'activity', 'billing', 'service']
const hashPin = (p: string) => createHash('sha256').update(`gg-portal:${p.trim()}`).digest('hex')

function slugify(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

// GET /api/admin/portals — list every customer portal (corporate-only).
export async function GET() {
  const user = await getCurrentUser()
  if (!user.isCorporate) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('client_portals')
    .select('id, org_id, site_id, slug, login_type, modules, camera_ids, branding, status, created_at, updated_at, sites(name, city, state)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ portals: data ?? [] })
}

// POST /api/admin/portals — provision a new portal for an existing site (corporate-only).
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user.isCorporate) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { site_id } = body
  if (!site_id) return NextResponse.json({ error: 'site_id is required' }, { status: 400 })

  // Resolve the owning org + name from the site so the portal is tenant-stamped.
  const { data: site, error: siteErr } = await supabase
    .from('sites')
    .select('id, name, org_id')
    .eq('id', site_id)
    .single()
  if (siteErr || !site) return NextResponse.json({ error: 'Site not found' }, { status: 404 })
  if (!site.org_id) return NextResponse.json({ error: 'This site has no owning org — set the site\'s org first' }, { status: 400 })

  const slug = slugify(body.slug || site.name)
  if (!slug) return NextResponse.json({ error: 'Could not derive a slug — provide one' }, { status: 400 })

  const modules: string[] = Array.isArray(body.modules) && body.modules.length
    ? body.modules.filter((m: string) => ALL_MODULES.includes(m))
    : ALL_MODULES

  const branding = {
    display_name: body?.branding?.display_name || site.name,
    ...(body?.branding?.accent ? { accent: body.branding.accent } : {}),
    ...(body?.branding?.logo_url ? { logo_url: body.branding.logo_url } : {}),
  }

  const cameraIds: string[] | null = Array.isArray(body.camera_ids) && body.camera_ids.length
    ? body.camera_ids
    : null

  const row = {
    org_id: site.org_id,
    site_id: site.id,
    slug,
    login_type: body.login_type === 'resident' ? 'resident' : 'property',
    modules,
    camera_ids: cameraIds,
    branding,
    status: ['draft', 'live', 'disabled'].includes(body.status) ? body.status : 'draft',
    access_pin: body.access_pin ? hashPin(String(body.access_pin)) : null,
    created_by: user.id,
  }

  const { data, error } = await supabase.from('client_portals').insert(row).select().single()
  if (error) {
    // 23505 = unique_violation (slug already used)
    const code = (error as { code?: string }).code
    if (code === '23505') return NextResponse.json({ error: `Slug "${slug}" is already in use — pick another.` }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ portal: data }, { status: 201 })
}
