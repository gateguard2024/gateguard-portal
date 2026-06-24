import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/maintenance/[id]/parts — list all parts for a WO
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { data, error } = await supabase
    .from('work_order_parts')
    .select(`
      *,
      inventory_items (
        id,
        name,
        sku,
        on_hand,
        unit_cost,
        unit_price
      )
    `)
    .eq('work_order_id', params.id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ parts: data ?? [] })
}

// POST /api/maintenance/[id]/parts — add a part to a WO
// Body: { inventory_item_id?, name, sku?, qty, unit_cost?, action, notes?, added_by? }
// Backward-compat: also accepts { part_name, part_number, quantity } from old UI
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()

  // Normalize legacy field names from old UI calls
  const inventory_item_id = body.inventory_item_id ?? null
  const name              = (body.name ?? body.part_name ?? '').trim()
  const sku               = body.sku ?? body.part_number ?? null
  const qty               = Number(body.qty ?? body.quantity ?? 1)
  const unit_cost         = body.unit_cost != null ? Number(body.unit_cost) : null
  const unit_price        = body.unit_price != null ? Number(body.unit_price) : null
  const action            = body.action ?? 'used'
  const site_asset_id     = body.site_asset_id ?? null
  const notes             = body.notes?.trim()     || null
  const added_by          = body.added_by?.trim()  || null

  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  if (!['used', 'installed', 'returned', 'warranty'].includes(action)) {
    return NextResponse.json({ error: 'invalid action' }, { status: 400 })
  }

  // If linked to inventory and action consumes stock, decrement on_hand
  if (inventory_item_id && (action === 'used' || action === 'installed')) {
    const { data: invItem, error: fetchErr } = await supabase
      .from('inventory_items')
      .select('on_hand')
      .eq('id', inventory_item_id)
      .single()

    if (fetchErr || !invItem) {
      return NextResponse.json({ error: 'Inventory item not found' }, { status: 404 })
    }

    if (invItem.on_hand < qty) {
      return NextResponse.json(
        { error: `Insufficient stock. Available: ${invItem.on_hand}, requested: ${qty}` },
        { status: 409 }
      )
    }

    const { error: decrementErr } = await supabase
      .from('inventory_items')
      .update({
        on_hand:    invItem.on_hand - qty,
        updated_at: new Date().toISOString(),
      })
      .eq('id', inventory_item_id)
      .gte('on_hand', qty)  // extra safety guard

    if (decrementErr) {
      return NextResponse.json(
        { error: 'Failed to decrement inventory: ' + decrementErr.message },
        { status: 500 }
      )
    }
  }

  const insertRow: Record<string, unknown> = {
    work_order_id:     params.id,
    phase_id:          body.phase_id ?? null,
    inventory_item_id: inventory_item_id || null,
    name,
    sku:               sku?.trim()  || null,
    qty,
    unit_cost,
    unit_price,
    action,
    site_asset_id:     site_asset_id || null,
    notes,
    added_by,
  }
  // Drift-resilient: strip any column this DB doesn't have yet (e.g. unit_price
  // before migration 135) and retry, so adding a part never silently fails.
  let data: unknown = null
  let error: { code?: string; message: string } | null = null
  for (let i = 0; i < 6; i++) {
    const res = await supabase.from('work_order_parts').insert(insertRow).select().single()
    data = res.data; error = res.error
    if (!error) break
    if (error.code === '42703' || error.code === 'PGRST204') {
      const m = /Could not find the '([a-z_]+)' column/i.exec(error.message) || /'([a-z_]+)' column/i.exec(error.message) || /column "?([a-z_]+)"?/i.exec(error.message)
      const col = m?.[1]
      if (col && col in insertRow) { delete insertRow[col]; continue }
    }
    break
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ part: data }, { status: 201 })
}

// DELETE /api/maintenance/[id]/parts — legacy: remove by part_used_id in body
// (new UI uses DELETE /api/maintenance/[id]/parts/[partId])
export async function DELETE(req: NextRequest, _ctx: { params: { id: string } }) {
  const body = await req.json()
  const partId = body.part_used_id ?? body.part_id
  if (!partId) return NextResponse.json({ error: 'part_used_id required' }, { status: 400 })

  // Fetch part to restore stock if needed
  const { data: part } = await supabase
    .from('work_order_parts')
    .select('inventory_item_id, qty, action')
    .eq('id', partId)
    .single()

  if (part?.inventory_item_id && (part.action === 'used' || part.action === 'installed')) {
    void (async () => {
      try {
        const { data: inv } = await supabase
          .from('inventory_items')
          .select('on_hand')
          .eq('id', part.inventory_item_id)
          .single()
        if (inv) {
          await supabase
            .from('inventory_items')
            .update({ on_hand: inv.on_hand + part.qty, updated_at: new Date().toISOString() })
            .eq('id', part.inventory_item_id)
        }
      } catch (_) { /* non-blocking */ }
    })()
  }

  const { error } = await supabase.from('work_order_parts').delete().eq('id', partId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
