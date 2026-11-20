/**
 * /api/sites/[id]/assets/[assetId] — one installed unit (rules: lib/assets.ts).
 *
 * GET   the unit page: details, catalog product, gate/door, the unit it's part of,
 *       units under it, what it replaced / what replaced it, history, QR link.
 * PATCH edit / backfill. Whitelisted columns only; site-scoped via guardSite.
 *       (Also used by the Fleet Health backfill: MAC for UniFi, serial = ESN for Eagle Eye.)
 *       status 'removed' stamps removed_at. Gate/door and parent must be at this property.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { guardSite } from '@/lib/ops-scope'
import { getCurrentUser } from '@/lib/current-user'
import { unitHistory, unitLabel } from '@/lib/assets'
import { openingOnSite } from '@/lib/openings'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)
export const dynamic = 'force-dynamic'

const EDITABLE = new Set([
  'product_name', 'product_category', 'serial_number', 'mac_address',
  'ip_address', 'firmware_version', 'location_note', 'location_zone',
  'status', 'notes',
  // migration 237+
  'opening_id', 'parent_asset_id', 'warranty_expires_at', 'installed_at', 'product_id', 'product_sku',
])
const STATUSES = new Set(['active', 'online', 'offline', 'degraded', 'replaced', 'removed'])
type Row = Record<string, unknown> & { id: string; site_id: string }

export async function GET(req: NextRequest, { params }: { params: { id: string; assetId: string } }) {
  if (!(await guardSite(req, params.id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { data, error } = await supabase.from('site_assets').select('*').eq('id', params.assetId).eq('site_id', params.id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Unit not found at this property.' }, { status: 404 })
  const a = data as Row
  const sel = 'id, product_name, serial_number, status, location_note, opening_id, qr_code'
  const [product, opening, parent, children, replaced, replacedBy] = await Promise.all([
    a.product_id ? supabase.from('products').select('id, name, sku, brand, category, image_url, manual_url, warranty_months').eq('id', String(a.product_id)).maybeSingle().then(r => r.data) : null,
    a.opening_id ? supabase.from('site_openings').select('id, name, kind').eq('id', String(a.opening_id)).maybeSingle().then(r => r.data) : null,
    a.parent_asset_id ? supabase.from('site_assets').select(sel).eq('id', String(a.parent_asset_id)).maybeSingle().then(r => r.data) : null,
    supabase.from('site_assets').select(sel).eq('parent_asset_id', a.id).then(r => r.data ?? []),
    supabase.from('site_assets').select(sel).eq('replaced_by_asset_id', a.id).then(r => r.data ?? []),
    a.replaced_by_asset_id ? supabase.from('site_assets').select(sel).eq('id', String(a.replaced_by_asset_id)).maybeSingle().then(r => r.data) : null,
  ])
  const history = await unitHistory(a as Parameters<typeof unitHistory>[0])
  const label = unitLabel(a as { product_name?: string; location_note?: string }, (opening as { name?: string } | null)?.name)
  return NextResponse.json({ asset: a, label, product, opening, parent, children, replaced, replaced_by: replacedBy, history, qr_path: a.qr_code ? `/a/${a.qr_code}` : null })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string; assetId: string } }) {
  if (!(await guardSite(req, params.id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const user = await getCurrentUser()
  if (!user.id || user.id === 'anonymous') return NextResponse.json({ error: 'Sign in' }, { status: 401 })

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patch: Record<string, any> = {}
  for (const [k, v] of Object.entries(body)) {
    if (EDITABLE.has(k)) patch[k] = v === '' ? null : v
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No editable fields provided.' }, { status: 400 })
  }
  if ('status' in patch) {
    if (!STATUSES.has(String(patch.status))) return NextResponse.json({ error: 'Unknown status.' }, { status: 400 })
    if (patch.status === 'removed') { patch.removed_at = new Date().toISOString(); patch.removed_by = user.name ?? user.email ?? null }
  }
  if (patch.opening_id && !(await openingOnSite(String(patch.opening_id), params.id))) return NextResponse.json({ error: 'That gate/door isn’t at this property.' }, { status: 400 })
  if (patch.parent_asset_id) {
    if (patch.parent_asset_id === params.assetId) return NextResponse.json({ error: 'A unit can’t be part of itself.' }, { status: 400 })
    // walk up from the new parent: it must be at this property and must not lead back to this unit
    let cur: string | null = String(patch.parent_asset_id)
    for (let i = 0; cur && i < 20; i++) {
      const res: { data: { site_id: string; parent_asset_id: string | null } | null } = await supabase.from('site_assets').select('site_id, parent_asset_id').eq('id', cur).maybeSingle()
      const r = res.data
      if (!r || r.site_id !== params.id) return NextResponse.json({ error: 'The unit it’s part of isn’t at this property.' }, { status: 400 })
      if (r.parent_asset_id === params.assetId) return NextResponse.json({ error: 'That would make a loop (each would be part of the other).' }, { status: 400 })
      cur = r.parent_asset_id
    }
  }
  patch.updated_at = new Date().toISOString()

  // Drift-resilient: a column this DB doesn't have yet is dropped and the rest saved.
  for (let i = 0; i < 8; i++) {
    const { data, error } = await supabase
      .from('site_assets')
      .update(patch)
      .eq('id', params.assetId)
      .eq('site_id', params.id)   // asset must belong to this (already-scoped) site
      .select()
      .single()
    if (!error) {
      if (!data) return NextResponse.json({ error: 'Asset not found for this site.' }, { status: 404 })
      return NextResponse.json({ asset: data })
    }
    const m = /Could not find the '(\w+)' column|column "?(\w+)"? .* does not exist/.exec(error.message)
    const bad = m?.[1] || m?.[2]
    if ((error.code === 'PGRST204' || error.code === '42703') && bad && bad in patch) { delete patch[bad]; continue }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ error: 'Could not save' }, { status: 500 })
}
