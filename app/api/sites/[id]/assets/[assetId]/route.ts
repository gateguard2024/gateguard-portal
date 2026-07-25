/**
 * PATCH /api/sites/[id]/assets/[assetId] — edit / backfill one installed asset.
 *
 * Built for the Fleet Health backfill: filling in MAC (UniFi match) and
 * serial_number = ESN (Eagle Eye match) on existing site_assets so the nightly
 * rollup can identify them. Whitelisted columns only; site-scoped via guardSite.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { guardSite } from '@/lib/ops-scope'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)
export const dynamic = 'force-dynamic'

const EDITABLE = new Set([
  'product_name', 'product_category', 'serial_number', 'mac_address',
  'ip_address', 'firmware_version', 'location_note', 'location_zone',
  'status', 'notes',
])

export async function PATCH(req: NextRequest, { params }: { params: { id: string; assetId: string } }) {
  if (!(await guardSite(req, params.id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patch: Record<string, any> = {}
  for (const [k, v] of Object.entries(body)) {
    if (EDITABLE.has(k)) patch[k] = v === '' ? null : v
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No editable fields provided.' }, { status: 400 })
  }
  patch.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('site_assets')
    .update(patch)
    .eq('id', params.assetId)
    .eq('site_id', params.id)   // asset must belong to this (already-scoped) site
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Asset not found for this site.' }, { status: 404 })
  return NextResponse.json({ asset: data })
}
