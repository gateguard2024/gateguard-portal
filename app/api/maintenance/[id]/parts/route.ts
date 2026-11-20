import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { guardWorkOrder } from '@/lib/ops-scope'
import { isTechAuthed } from '@/lib/tech-auth'
import { getCurrentUser } from '@/lib/current-user'
import {
  stockReady, defaultBillTo, canSetBillTo, isPlanSite, isGateGuardJob, partCost,
  jobLocations, movePartForJob, reversePart, type PartBillTo,
} from '@/lib/stock'
import { installFromPart, undoInstall, unitsForJob } from '@/lib/assets'

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

  // Where each part came from (migration 236) — names only.
  const locIds = Array.from(new Set(parts.map(p => p.from_location_id).filter((v): v is string => typeof v === 'string' && v.length > 0)))
  if (locIds.length) {
    const { data: locs } = await supabase.from('stock_locations').select('id, name').in('id', locIds)
    const names = new Map(((locs ?? []) as { id: string; name: string }[]).map(l => [l.id, l.name]))
    for (const p of parts) p.from_location_name = typeof p.from_location_id === 'string' ? (names.get(p.from_location_id) ?? null) : null
  }

  // Units at this job's property, the job's gate/door first — for "Which one did it replace?" (migration 237).
  const { data: woRow } = await supabase.from('work_orders').select('*').eq('id', params.id).maybeSingle()
  const units = woRow ? await unitsForJob(woRow as { site_id: string | null; opening_id?: string | null }) : []

  return NextResponse.json({ parts, units })
}

/** Field app (tech code, no login) vs a signed-in office user. */
async function callerOf(req: NextRequest): Promise<{ techOnly: boolean; isCorporate: boolean; name: string | null }> {
  const user = await getCurrentUser()
  const signedIn = !!user.id && user.id !== 'anonymous'
  if (signedIn) return { techOnly: false, isCorporate: !!user.isCorporate, name: user.name ?? null }
  return { techOnly: await isTechAuthed(req), isCorporate: false, name: null }
}

// PATCH /api/maintenance/[id]/parts — update procurement fields on one part.
// Body: { part_id, supply_status?, expected_at?, is_expendable?, po_id?, bill_to? }
// bill_to (who pays): Gate Guard on any job, a dealer on their own jobs (the guard
// above already limits them to those), the field app never to 'property'.
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
  if ('bill_to' in body) {
    const who = await callerOf(req)
    const ok = canSetBillTo(who, String(body.bill_to ?? ''))
    if (!ok.ok) return NextResponse.json({ error: ok.error }, { status: who.techOnly ? 403 : 400 })
    patch.bill_to = body.bill_to
  }

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

  // ── After migration 236: stock places + who pays + frozen cost (lib/stock.ts) ──
  const useStock = await stockReady()
  let productId: string | null = body.product_id ?? null
  if (!productId && inventory_item_id) {
    const { data: inv } = await supabase.from('inventory_items').select('product_id').eq('id', inventory_item_id).maybeSingle()
    productId = (inv as { product_id?: string | null } | null)?.product_id ?? null
  }
  let fromLocationId: string | null = null
  let billTo: PartBillTo | null = null
  let costBasis: string | null = null
  let frozenCost = unit_cost
  let jobOrg: string | null = null

  if (useStock) {
    const { data: woRow } = await supabase.from('work_orders').select('*').eq('id', params.id).maybeSingle()
    const wo = (woRow ?? {}) as { org_id?: string | null; site_id?: string | null; assignee_id?: string | null; bill_to?: string | null }
    jobOrg = wo.org_id ?? null
    const { data: site } = wo.site_id
      ? await supabase.from('sites').select('status, billing_video_fee, billing_units').eq('id', wo.site_id).maybeSingle()
      : { data: null }
    if (body.bill_to != null && body.bill_to !== '') {
      const who = await callerOf(req)
      const ok = canSetBillTo(who, String(body.bill_to))
      if (!ok.ok) return NextResponse.json({ error: ok.error }, { status: who.techOnly ? 403 : 400 })
      billTo = body.bill_to as PartBillTo
    } else {
      billTo = defaultBillTo({ action, jobBillTo: wo.bill_to ?? null, planSite: isPlanSite(site as Parameters<typeof isPlanSite>[0]) })
    }
    const c = await partCost(productId, await isGateGuardJob(jobOrg), unit_cost)
    frozenCost = c.unit_cost; costBasis = c.basis
    if (productId) {
      const { locations, defaultId } = await jobLocations({ org_id: jobOrg, assignee_id: wo.assignee_id ?? null, site_id: wo.site_id ?? null })
      const asked = body.from_location_id ? String(body.from_location_id) : null
      if (asked && !locations.some(l => l.id === asked)) {
        return NextResponse.json({ error: 'That place isn’t one this job can take parts from.' }, { status: 400 })
      }
      fromLocationId = asked ?? defaultId
    }
  } else if (inventory_item_id && (action === 'used' || action === 'installed')) {
    // Before migration 236: the old single-number inventory list.
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
    unit_cost:         frozenCost,
    unit_price,
    action,
    site_asset_id:     site_asset_id || null,
    notes,
    added_by,
  }
  if (productId) insertRow.product_id = productId
  if (useStock) {
    insertRow.bill_to = billTo
    if (costBasis) insertRow.cost_basis = costBasis
    if (fromLocationId) insertRow.from_location_id = fromLocationId
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

  // Take it out of (or put it back into) the place it came from.
  let warning: string | null = null
  const part = data as { id: string } | null

  // A catalog part marked "Replaced" becomes a unit at the property (lib/assets.ts, migration 237).
  let unit: { assetId: string | null; replaced: string | null } | null = null
  if (part && productId && action === 'installed') {
    try {
      const { data: w } = await supabase.from('work_orders').select('*').eq('id', params.id).maybeSingle()
      const wo = (w ?? {}) as { site_id?: string | null; org_id?: string | null; opening_id?: string | null }
      const r = await installFromPart({
        wo: { id: params.id, site_id: wo.site_id ?? null, org_id: wo.org_id ?? null, opening_id: wo.opening_id ?? null },
        part: { id: part.id, name, sku, product_id: productId },
        serial: typeof body.serial_number === 'string' ? body.serial_number : null,
        replacesAssetId: body.replaces_asset_id ? String(body.replaces_asset_id) : null,
        by: added_by,
      })
      if (r.error) warning = r.error
      else if (r.assetId) unit = r
    } catch (e) {
      warning = `Saved on the job, but the unit wasn’t added to the property: ${e instanceof Error ? e.message : 'error'}`
    }
  }
  if (useStock && part && productId && fromLocationId && qty > 0) {
    try {
      const w = (await movePartForJob({ orgId: jobOrg, productId, qty, action, locationId: fromLocationId, unitCost: frozenCost, woId: params.id, partId: part.id, by: added_by })).warning
      if (w) warning = warning ? `${warning} ${w}` : w
    } catch (e) {
      // The part is on the job; say plainly that stock didn't follow.
      const w = `Saved on the job, but stock didn’t update: ${e instanceof Error ? e.message : 'error'}`
      warning = warning ? `${warning} ${w}` : w
    }
  }

  return NextResponse.json({ part: data, warning, unit }, { status: 201 })
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

  // Restore stock BEFORE deleting the part row — awaited so it actually lands in
  // serverless (a detached write would leave inventory drifting low over time).
  try { await undoInstall(partId) } catch (e) { return NextResponse.json({ error: `Couldn’t undo the unit this part made: ${e instanceof Error ? e.message : 'error'}` }, { status: 500 }) }
  if (await stockReady()) {
    try { await reversePart(partId) } catch (e) { return NextResponse.json({ error: `Couldn’t put the part back in stock: ${e instanceof Error ? e.message : 'error'}` }, { status: 500 }) }
  } else if (part?.inventory_item_id && (part.action === 'used' || part.action === 'installed')) {
    const { data: inv } = await supabase
      .from('inventory_items')
      .select('on_hand')
      .eq('id', part.inventory_item_id)
      .single()
    if (inv) {
      const { error: restockErr } = await supabase
        .from('inventory_items')
        .update({ on_hand: (Number(inv.on_hand) || 0) + (Number(part.qty) || 0), updated_at: new Date().toISOString() })
        .eq('id', part.inventory_item_id)
      if (restockErr) console.warn('[wo parts] inventory restock failed:', restockErr.message)
    }
  }

  const { error } = await supabase.from('work_order_parts').delete().eq('id', partId).eq('work_order_id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
