import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

// GET /api/sites/[id]/assets — list assets for a site
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const { data, error } = await supabase
    .from('site_assets')
    .select(`
      id, product_id, product_name, product_sku, product_category,
      serial_number, mac_address, ip_address, firmware_version,
      location_note, location_zone,
      work_order_id, installed_by, installed_at, install_notes,
      status, last_seen_at, offline_since, notes, created_at
    `)
    .eq('site_id', params.id)
    .order('product_category')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ assets: data ?? [] })
}

// POST /api/sites/[id]/assets — add an installed asset to this site
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
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

  const { data: asset, error } = await supabase
    .from('site_assets')
    .insert({
      site_id: params.id,
      product_id: product_id ?? null,
      product_name,
      product_sku: product_sku ?? null,
      product_category: product_category ?? null,
      org_id: org_id ?? null,
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
