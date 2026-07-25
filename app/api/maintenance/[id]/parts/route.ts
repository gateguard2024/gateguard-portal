import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { guardWorkOrder } from '@/lib/ops-scope'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// The six supply states a part can be in, in the order a tech experiences them.
// Kept in sync with the work_order_parts.supply_status CHECK (migration 151).
//
// NOT exported: Next.js route files may only export route handlers (GET/POST/…)
// plus a few config keys. Exporting anything else fails the build with TS2344
// "does not satisfy the constraint '{ [x: string]: never; }'".
const SUPPLY_STATUSES = [
  'not_ordered', 'ordered', 'shipped', 'at_office', 'on_truck', 'installed',
] as const

// GET /api/maintenance/[id]/parts — list all parts for a WO, each with its PO
// (po_number / supplier / status) resolved so the tech can see at a glance
// whether the part is still at the supplier or already on his truck.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await guardWorkOrder(req, params.id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
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

  const parts = (data ?? []) as Array<Record<string, unknown>>

  // Second (and final) round trip: resolve every PO these parts point at in one
  // `in` query. Done as a lookup rather than a PostgREST embed so a missing or
  // unnamed FK can never break the whole parts list.
  const poIds = Array.from(new Set(
    parts.map(p => p.po_id).filter((v): v is string => typeof v === 'string' && v.length > 0)
  ))

  if (poIds.length > 0) {
    const { data: pos, error: poErr } = await supabase
      .from('purchase_orders')
      .select('id, po_number, supplier, status, expected_at')
      .in('id', poIds)

    if (poErr) return NextResponse.json({ error: poErr.message }, { status: 500 })

    const poMap = new Map((pos ?? []).map(po => [po.id, po]))
    for (const p of parts) {
      p.po = typeof p.po_id === 'string' ? (poMap.get(p.po_id) ?? null) : null
    }
  } else {
    for (const p of parts) p.po = null
  }

  return NextResponse.json({ parts })
}

// PATCH /api/maintenance/[id]/parts — update procurement fields on one part.
// Body: { part_id, supply_status?, expected_at?, is_expendable?, po_id? }
// Errors are returned, never swallowed — a status that silently doesn't save is
// worse than an error message, because the tech drives out on a bad assumption.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await guardWorkOrder(req, params.id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const partId = (body.part_id ?? body.id) as string | undefined
  if (!partId) return NextResponse.json({ error: 'part_id is required' }, { status: 400 })

  const patch: Record<string, unknown> = {}

  if ('supply_status' in body) {
    const s = body.supply_status
    if (typeof s !== 'string' || !(SUPPLY_STATUSES as readonly string[]).includes(s)) {
      return NextResponse.json({ error: 'invalid supply_status' }, { status: 400 })
    }
    patch.supply_status = s
  }
  if ('expected_at' in body) {
    const d = body.expected_at
    patch.expected_at = d === null || d === '' ? null : String(d).slice(0, 10)
  }
  if ('is_expendable' in body) patch.is_expendable = Boolean(body.is_expendable)
  if ('po_id' in body)         patch.po_id = body.po_id || null

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('work_order_parts')
    .update(patch)
    .eq('id', partId)
    .eq('work_order_id', params.id)   // a part can only be patched from its own job
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data)  return NextResponse.json({ error: 'Part not found on this job' }, { status: 404 })

  return NextResponse.json({ part: data })
}

// POST /api/maintenance/[id]/parts — add a part to a WO
// Body: { inventory_item_id?, name, sku?, qty, unit_cost?, action, notes?, added_by? }
// Backward-compat: also accepts { part_name, part_number, quantity } from old UI
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await guardWorkOrder(req, params.id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
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
export async function DELETE(req: NextRequest, ctx: { params: { id: string } }) {
  const { params } = ctx
  if (!(await guardWorkOrder(req, params.id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const body = await req.json()
  const partId = body.part_used_id ?? body.part_id
  if (!partId) return NextResponse.json({ error: 'part_used_id required' }, { status: 400 })

  // Fetch part to restore stock if needed
  const { data: part } = await supabase
    .from('work_order_parts')
    .select('inventory_item_id, qty, action')
    .eq('id', partId)
    .eq('work_order_id', params.id)   // part must belong to the guarded WO
    .single()
  if (!part) return NextResponse.json({ error: 'Part not found on this job' }, { status: 404 })

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

  const { error } = await supabase.from('work_order_parts').delete().eq('id', partId).eq('work_order_id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
