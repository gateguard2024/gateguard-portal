import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { guardSite } from '@/lib/ops-scope'
import { getCurrentUser } from '@/lib/current-user'
import { assetsReady, createUnit, warrantyEnd } from '@/lib/assets'
import { openingOnSite } from '@/lib/openings'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

// GET /api/sites/[id]/assets — every unit at a site (all statuses; the Equipment tab
// hides replaced/removed by default). After 237: QR code, parent unit, replaced-by,
// warranty end, gate/door name. select('*') so a column a DB doesn't have yet can't break it.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await guardSite(req, params.id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { data, error } = await supabase
    .from('site_assets')
    .select('*')
    .eq('site_id', params.id)
    .order('product_category')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const rows = (data ?? []) as Record<string, unknown>[]
  const opIds = Array.from(new Set(rows.map(r => r.opening_id).filter(Boolean))) as string[]
  const openings: Record<string, string> = {}
  if (opIds.length) {
    const { data: ops } = await supabase.from('site_openings').select('id, name').in('id', opIds)
    for (const o of (ops ?? []) as { id: string; name: string }[]) openings[o.id] = o.name
  }
  return NextResponse.json({ assets: rows, openings, ready: await assetsReady() })
}

// POST /api/sites/[id]/assets — add an installed asset to this site
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await guardSite(req, params.id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const body = await req.json()
  const {
    product_id, product_name, product_sku, product_category,
    org_id,
    serial_number, mac_address, ip_address, firmware_version,
    location_note, location_zone,
    work_order_id, installed_by, installed_at, install_notes,
    status, notes,
  } = body

  if (!product_name) {
    return NextResponse.json({ error: 'product_name is required' }, { status: 400 })
  }

  // Who owns it: corporate may name a company; everyone else = their own company.
  const caller = await getCurrentUser()
  const ownerOrg = caller.isCorporate ? (org_id ?? null) : (caller.org_id ?? null)

  // After 237: gate/door + parent must be at this site; QR code + warranty end are added.
  if (await assetsReady()) {
    if (body.opening_id && !(await openingOnSite(String(body.opening_id), params.id))) return NextResponse.json({ error: 'That gate/door isn’t at this property.' }, { status: 400 })
    if (body.parent_asset_id) {
      const { data: par } = await supabase.from('site_assets').select('id').eq('id', String(body.parent_asset_id)).eq('site_id', params.id).maybeSingle()
      if (!par) return NextResponse.json({ error: 'The unit it’s part of isn’t at this property.' }, { status: 400 })
    }
    let months: number | null = null
    if (product_id) { const { data: pr } = await supabase.from('products').select('warranty_months').eq('id', product_id).maybeSingle(); months = (pr as { warranty_months?: number | null } | null)?.warranty_months ?? null }
    const at = installed_at ?? new Date().toISOString()
    try {
      const asset = await createUnit({
        site_id: params.id, org_id: ownerOrg, product_id: product_id ?? null, product_name, product_sku: product_sku ?? null,
        product_category: product_category ?? null, serial_number: serial_number ?? null, location_note: location_note ?? null,
        opening_id: body.opening_id ?? null, parent_asset_id: body.parent_asset_id ?? null, work_order_id: work_order_id ?? null,
        installed_by: installed_by ?? caller.name ?? null, installed_at: at, install_notes: install_notes ?? null,
        warranty_expires_at: body.warranty_expires_at ?? warrantyEnd(at, months), status: status ?? 'active',
      })
      const extra: Record<string, unknown> = {}
      if (mac_address) extra.mac_address = mac_address
      if (ip_address) extra.ip_address = ip_address
      if (firmware_version) extra.firmware_version = firmware_version
      if (notes) extra.notes = notes
      if (Object.keys(extra).length) { const { error: xErr } = await supabase.from('site_assets').update(extra).eq('id', asset.id); if (xErr) return NextResponse.json({ error: xErr.message }, { status: 500 }) }
      const { error: evErr } = await supabase.from('site_events').insert({ site_id: params.id, asset_id: asset.id, event_type: 'install', event_source: 'manual', summary: `${product_name} added at ${location_note ?? 'Main Gate'}`, severity: 'info' })
      if (evErr) console.warn('[assets] install event:', evErr.message)
      return NextResponse.json({ asset: { ...asset, ...extra } }, { status: 201 })
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'Couldn’t add the unit' }, { status: 500 })
    }
  }

  const { data: asset, error } = await supabase
    .from('site_assets')
    .insert({
      site_id: params.id,
      product_id: product_id ?? null,
      product_name,
      product_sku: product_sku ?? null,
      product_category: product_category ?? null,
      org_id: ownerOrg,
      serial_number: serial_number ?? null,
      mac_address: mac_address ?? null,
      ip_address: ip_address ?? null,
      firmware_version: firmware_version ?? null,
      location_note: location_note ?? 'Main Gate',
      location_zone: location_zone ?? null,
      work_order_id: work_order_id ?? null,
      installed_by: installed_by ?? null,
      installed_at: installed_at ?? null,
      install_notes: install_notes ?? null,
      status: status ?? 'active',
      notes: notes ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Pre-populate terminal map from device_suggestions if available
  if (asset && product_id) {
    const { data: suggestion } = await supabase
      .from('device_suggestions')
      .select('device_def')
      .eq('product_id', product_id)
      .eq('status', 'verified')
      .single()
      .then(r => r.data ? r : supabase.from('device_suggestions').select('device_def').eq('product_id', product_id).eq('status', 'ai_generated').single())

    if (suggestion?.device_def?.terminals) {
      const terminals = suggestion.device_def.terminals as Array<{
        id: string
        label?: string
        function?: string
      }>
      const terminalRows = terminals.map(t => ({
        site_asset_id:       asset.id,
        terminal_id:         t.id,
        terminal_label:      t.label ?? t.id,
        terminal_function:   t.function ?? null,
        verification_status: 'unverified' as const,
      }))
      if (terminalRows.length > 0) {
        await supabase.from('site_asset_terminals').insert(terminalRows)
      }
    }
  }

  // Log install event
  await supabase.from('site_events').insert({
    site_id:     params.id,
    asset_id:    asset.id,
    event_type:  'install',
    event_source: 'manual',
    summary:     `${product_name} added at ${location_note ?? 'Main Gate'}`,
    severity:    'info',
  })

  return NextResponse.json({ asset }, { status: 201 })
}
