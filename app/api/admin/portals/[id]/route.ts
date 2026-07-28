import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

const ALL_MODULES = ['gate', 'cameras', 'passes', 'activity', 'billing', 'service']

function slugify(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
}

// PATCH /api/admin/portals/[id] — update a portal's config (corporate-only).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user.isCorporate) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (typeof body.slug === 'string') update.slug = slugify(body.slug)
  if (body.login_type === 'property' || body.login_type === 'resident') update.login_type = body.login_type
  if (Array.isArray(body.modules)) update.modules = body.modules.filter((m: string) => ALL_MODULES.includes(m))
  if ('camera_ids' in body) update.camera_ids = Array.isArray(body.camera_ids) && body.camera_ids.length ? body.camera_ids : null
  if (body.branding && typeof body.branding === 'object') update.branding = body.branding
  if (['draft', 'live', 'disabled'].includes(body.status)) update.status = body.status

  const { data, error } = await supabase
    .from('client_portals')
    .update(update)
    .eq('id', params.id)
    .select()
    .single()

  if (error) {
    const code = (error as { code?: string }).code
    if (code === '23505') return NextResponse.json({ error: 'That slug is already in use.' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ portal: data })
}

// DELETE /api/admin/portals/[id] — remove a portal entirely (corporate-only).
// (To take one offline without deleting, PATCH status:'disabled' instead.)
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user.isCorporate) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabase.from('client_portals').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
