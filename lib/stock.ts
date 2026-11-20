/**
 * Stock + parts rules (Catalog phase 1, migration 236). Keep the rules HERE.
 *
 *  - Where parts sit: stock_locations — warehouse, each truck (one per tech), each
 *    property's spare shelf. org_id NULL = Gate Guard's own; otherwise the dealer's.
 *  - On hand = moves in − moves out (view stock_levels). Nothing is ever edited in
 *    place; a count adds a correcting move.
 *  - A part on a job is taken from a place (default: the assigned tech's truck,
 *    else the job owner's warehouse). Going below zero is allowed (the tech already
 *    used it) and is reported so someone counts that place.
 *  - Who pays (bill_to): a property on a service plan → 'plan' (always the default);
 *    otherwise 'property' (billable). A warranty part → 'warranty'. The job's own
 *    "who pays" answer, if given, sets the default for new parts. Only 'property'
 *    ever reaches an invoice; every line counts in the property's spending.
 *  - Who can change who-pays: Gate Guard on any job; a dealer on their own jobs
 *    (the job guard already limits them to those); the field app (tech code) may
 *    pick plan / warranty but never mark a part billable.
 *  - Cost is frozen on the part line when it's used: Gate Guard jobs at Gate
 *    Guard cost (product_costs.gg_cost), dealer jobs at dealer cost
 *    (products.dealer_cost — dealer pricing tiers replace this in phase 3).
 *  - Before migration 236 runs, stockReady() is false and the parts route keeps
 *    the old inventory_items behaviour.
 */
import { createClient } from '@supabase/supabase-js'
import type { OrgScope } from '@/lib/org-scope'

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export const BILL_TO_PART = ['plan', 'property', 'warranty', 'internal'] as const
export type PartBillTo = (typeof BILL_TO_PART)[number]
export const BILL_TO_LABEL: Record<PartBillTo, string> = { plan: 'Covered by plan', property: 'Billable', warranty: 'Warranty', internal: 'Internal' }
export const LOCATION_KINDS = ['warehouse', 'truck', 'site'] as const
export type LocationKind = (typeof LOCATION_KINDS)[number]
export type Location = { id: string; org_id: string | null; kind: LocationKind; name: string; technician_id: string | null; site_id: string | null; active: boolean }
export type Level = { org_id: string | null; location_id: string; product_id: string; qty: number }
export type MoveKind = 'opening' | 'receive' | 'transfer' | 'use' | 'return' | 'count'

const missingTable = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205' || /relation .* does not exist|Could not find the table/i.test(e.message ?? ''))

let ready: boolean | null = null
/** True once migration 236 has run. Cached per server instance (only flips false → true). */
export async function stockReady(): Promise<boolean> {
  if (ready) return true
  const { error } = await db().from('stock_locations').select('id').limit(1)
  ready = !error
  if (error && !missingTable(error)) console.warn('[stock] stock_locations check:', error.message)
  return ready
}
/** Tests only. */
export const _resetStockReady = () => { ready = null }

// ── Who pays ─────────────────────────────────────────────────────────────────
type SiteBilling = { status?: string | null; billing_video_fee?: number | string | null; billing_units?: number | null; units?: number | null; billing_unit_rate?: number | string | null }
/** Same test the monthly invoice run uses: an active property with plan billing set up. */
export const isPlanSite = (s: SiteBilling | null | undefined) =>
  !!s && String(s.status ?? 'active') === 'active' && (Number(s.billing_video_fee) > 0 || Number(s.billing_units) > 0)
/** Monthly plan income, same formula as /api/invoices/generate-monthly. */
export const planMonthly = (s: SiteBilling | null | undefined) => {
  if (!isPlanSite(s)) return 0
  const units = Number(s!.billing_units ?? s!.units ?? 0) || 0
  const rate = s!.billing_unit_rate != null && s!.billing_unit_rate !== '' ? Number(s!.billing_unit_rate) : 5
  return Math.round(((Number(s!.billing_video_fee) || 0) + units * rate) * 100) / 100
}

export function defaultBillTo(o: { action?: string | null; jobBillTo?: string | null; planSite: boolean }): PartBillTo {
  if (o.action === 'warranty') return 'warranty'
  if (o.jobBillTo === 'property' || o.jobBillTo === 'warranty' || o.jobBillTo === 'plan') return o.jobBillTo
  return o.planSite ? 'plan' : 'property'
}

/** May this caller set this who-pays value? `techOnly` = field app (tech code, no login). */
export function canSetBillTo(caller: { techOnly: boolean; isCorporate: boolean }, value: string): { ok: true } | { ok: false; error: string } {
  if (!(BILL_TO_PART as readonly string[]).includes(value)) return { ok: false, error: 'Who pays must be plan, property, warranty or internal.' }
  if (caller.techOnly && (value === 'property' || value === 'internal')) return { ok: false, error: 'Only the office can mark a part billable.' }
  return { ok: true }
}

// ── Cost ─────────────────────────────────────────────────────────────────────
/** Is this job Gate Guard's own (no company, or the corporate company)? */
export async function isGateGuardJob(orgId: string | null | undefined): Promise<boolean> {
  if (!orgId) return true
  const { data } = await db().from('organizations').select('org_tier').eq('id', orgId).maybeSingle()
  return (data as { org_tier?: string } | null)?.org_tier === 'corporate'
}

/** The cost to freeze on a part line. */
export async function partCost(productId: string | null, gateGuardJob: boolean, manual: number | null): Promise<{ unit_cost: number | null; basis: 'gg' | 'dealer' | 'manual' | null }> {
  if (!productId) return { unit_cost: manual, basis: manual != null ? 'manual' : null }
  if (gateGuardJob) {
    const { data } = await db().from('product_costs').select('gg_cost').eq('product_id', productId).maybeSingle()
    const gg = (data as { gg_cost?: number | null } | null)?.gg_cost
    if (gg != null && Number(gg) > 0) return { unit_cost: Number(gg), basis: 'gg' }
  }
  const { data: p } = await db().from('products').select('dealer_cost').eq('id', productId).maybeSingle()
  const dc = Number((p as { dealer_cost?: number | null } | null)?.dealer_cost)
  if (dc > 0) return { unit_cost: dc, basis: 'dealer' }
  return { unit_cost: manual, basis: manual != null ? 'manual' : null }
}

/** May this caller see / change a place (or stock) owned by orgId? NULL = Gate Guard's own → corporate only. */
export const ownsPlace = (scope: OrgScope, orgId: string | null | undefined) => scope.all || (!!orgId && scope.ids.includes(orgId))

// ── Places ───────────────────────────────────────────────────────────────────
const LOC_COLS = 'id, org_id, kind, name, technician_id, site_id, active'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sameOrg = (q: any, orgId: string | null): any => (orgId ? q.eq('org_id', orgId) : q.is('org_id', null))

export async function ensureWarehouse(orgId: string | null): Promise<Location> {
  const { data } = await sameOrg(db().from('stock_locations').select(LOC_COLS).eq('kind', 'warehouse').eq('active', true), orgId).order('created_at', { ascending: true }).limit(1)
  if (data?.[0]) return data[0] as Location
  const { data: made, error } = await db().from('stock_locations').insert({ org_id: orgId, kind: 'warehouse', name: 'Warehouse' }).select(LOC_COLS).single()
  if (error || !made) throw new Error(error?.message ?? 'Could not make the warehouse')
  return made as Location
}

export async function ensureTruck(technicianId: string): Promise<Location | null> {
  const { data } = await db().from('stock_locations').select(LOC_COLS).eq('kind', 'truck').eq('technician_id', technicianId).limit(1)
  if (data?.[0]) return data[0] as Location
  const { data: t } = await db().from('technicians').select('id, name, org_id').eq('id', technicianId).maybeSingle()
  if (!t) return null
  const tech = t as { name?: string | null; org_id?: string | null }
  const ins = await db().from('stock_locations').insert({ org_id: tech.org_id ?? null, kind: 'truck', name: `${tech.name || 'Tech'}’s truck`, technician_id: technicianId }).select(LOC_COLS).single()
  if (ins.error?.code === '23505') { const again = await db().from('stock_locations').select(LOC_COLS).eq('kind', 'truck').eq('technician_id', technicianId).limit(1); return (again.data?.[0] as Location) ?? null }
  if (ins.error) throw new Error(ins.error.message)
  return ins.data as Location
}

export async function ensureSiteShelf(orgId: string | null, siteId: string): Promise<Location> {
  const { data } = await sameOrg(db().from('stock_locations').select(LOC_COLS).eq('kind', 'site').eq('site_id', siteId), orgId).limit(1)
  if (data?.[0]) return data[0] as Location
  const { data: s } = await db().from('sites').select('name').eq('id', siteId).maybeSingle()
  const ins = await db().from('stock_locations').insert({ org_id: orgId, kind: 'site', name: `${(s as { name?: string } | null)?.name || 'Property'} — spare shelf`, site_id: siteId }).select(LOC_COLS).single()
  if (ins.error?.code === '23505') { const again = await sameOrg(db().from('stock_locations').select(LOC_COLS).eq('kind', 'site').eq('site_id', siteId), orgId).limit(1); return again.data![0] as Location }
  if (ins.error) throw new Error(ins.error.message)
  return ins.data as Location
}

/** Places a job can draw from: the tech's truck first, then the property shelf, then the owner's other places. */
export async function jobLocations(wo: { org_id: string | null; assignee_id?: string | null; site_id?: string | null }): Promise<{ locations: Location[]; defaultId: string | null }> {
  const owner = wo.org_id ?? null
  const truck = wo.assignee_id ? await ensureTruck(wo.assignee_id).catch(() => null) : null
  const wh = await ensureWarehouse(owner)
  const { data } = await sameOrg(db().from('stock_locations').select(LOC_COLS).eq('active', true), owner).limit(500)
  const all = ((data ?? []) as Location[]).filter((l) => l.kind !== 'site' || l.site_id === wo.site_id)
  if (truck && !all.some((l) => l.id === truck.id)) all.push(truck)
  const rank = (l: Location) => (l.id === truck?.id ? 0 : l.kind === 'site' ? 1 : l.kind === 'truck' ? 2 : 3)
  all.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
  return { locations: all, defaultId: truck?.id ?? wh.id }
}

// ── Levels ───────────────────────────────────────────────────────────────────
export async function levels(f: { orgIds: string[] | 'all' | 'gg'; productIds?: string[]; locationIds?: string[] }): Promise<Level[]> {
  const out: Level[] = []
  for (let from = 0; from < 50000; from += 1000) {
    let q = db().from('stock_levels').select('org_id, location_id, product_id, qty')
    if (f.orgIds === 'gg') q = q.is('org_id', null)
    else if (f.orgIds !== 'all') q = f.orgIds.length ? q.in('org_id', f.orgIds) : q.eq('location_id', '00000000-0000-0000-0000-000000000000')
    if (f.productIds) q = q.in('product_id', f.productIds.length ? f.productIds : ['00000000-0000-0000-0000-000000000000'])
    if (f.locationIds) q = q.in('location_id', f.locationIds.length ? f.locationIds : ['00000000-0000-0000-0000-000000000000'])
    const { data, error } = await q.range(from, from + 999)
    if (error) throw new Error(error.message)
    out.push(...((data ?? []) as Level[]).map((r) => ({ ...r, qty: Number(r.qty) || 0 })))
    if (!data || data.length < 1000) break
  }
  return out
}

export async function onHand(locationId: string, productId: string): Promise<number> {
  const l = await levels({ orgIds: 'all', productIds: [productId], locationIds: [locationId] })
  return l.reduce((a, r) => a + r.qty, 0)
}

// ── Moves ────────────────────────────────────────────────────────────────────
export type MoveInput = {
  org_id: string | null; product_id: string; kind: MoveKind; qty: number
  from_location_id?: string | null; to_location_id?: string | null; unit_cost?: number | null
  work_order_id?: string | null; work_order_part_id?: string | null; po_id?: string | null; po_item_id?: string | null
  note?: string | null; created_by?: string | null
}
export async function addMove(m: MoveInput) {
  if (!(m.qty > 0)) throw new Error('Quantity must be more than 0')
  if (!m.from_location_id && !m.to_location_id) throw new Error('A move needs a from or a to place')
  const { data, error } = await db().from('stock_moves').insert({ ...m, note: m.note ?? null, created_by: m.created_by ?? null }).select('id').single()
  if (error) throw new Error(error.message)
  return data as { id: string }
}

/** Take a job part out of (or, for a return, back into) a place. Returns a warning when stock goes below zero. */
export async function movePartForJob(o: { orgId: string | null; productId: string; qty: number; action: string; locationId: string; unitCost: number | null; woId: string; partId: string; by?: string | null }): Promise<{ warning: string | null }> {
  const back = o.action === 'returned'
  await addMove({
    org_id: o.orgId, product_id: o.productId, kind: back ? 'return' : 'use', qty: o.qty,
    ...(back ? { to_location_id: o.locationId } : { from_location_id: o.locationId }),
    unit_cost: o.unitCost, work_order_id: o.woId, work_order_part_id: o.partId, created_by: o.by ?? null,
  })
  if (back) return { warning: null }
  const left = await onHand(o.locationId, o.productId)
  if (left >= 0) return { warning: null }
  const { data } = await db().from('stock_locations').select('name').eq('id', o.locationId).maybeSingle()
  return { warning: `${(data as { name?: string } | null)?.name ?? 'That place'} now shows ${left} — count it when you can.` }
}

/** Undo what a job part did to stock (part removed from the job). */
export async function reversePart(partId: string, by?: string | null) {
  const { data, error } = await db().from('stock_moves').select('id, org_id, product_id, kind, qty, from_location_id, to_location_id, unit_cost, work_order_id').eq('work_order_part_id', partId)
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as (MoveInput & { id: string })[]
  const net = new Map<string, { m: MoveInput; qty: number }>()
  for (const r of rows) {
    if (!r.product_id) continue
    const loc = (r.from_location_id ?? r.to_location_id)!
    const k = `${loc}|${r.product_id}`
    const sign = r.from_location_id ? -1 : 1 // what this part did to that place
    const cur = net.get(k) ?? { m: r, qty: 0 }
    cur.qty += sign * r.qty; net.set(k, cur)
  }
  for (const [k, { m, qty }] of Array.from(net)) {
    if (!qty) continue
    const loc = k.split('|')[0]
    await addMove({
      org_id: m.org_id ?? null, product_id: m.product_id, kind: qty < 0 ? 'return' : 'use', qty: Math.abs(qty),
      ...(qty < 0 ? { to_location_id: loc } : { from_location_id: loc }),
      unit_cost: m.unit_cost ?? null, work_order_id: m.work_order_id ?? null, note: 'Part removed from the job', created_by: by ?? null,
    })
  }
}

/** Receive what's still outstanding on a PO into stock. Lines tagged to a property go to that property's shelf. */
export async function receivePO(poId: string, opts: { locationId?: string | null; by?: string | null }): Promise<{ received: number; lines: number }> {
  const { data: po, error } = await db().from('purchase_orders').select('id, org_id').eq('id', poId).maybeSingle()
  if (error || !po) throw new Error(error?.message ?? 'PO not found')
  const owner = (po as { org_id: string | null }).org_id ?? null
  const { data: items, error: iErr } = await db().from('purchase_order_items').select('id, product_id, qty, received_qty, unit_cost, site_id').eq('po_id', poId)
  if (iErr) throw new Error(iErr.message)
  let received = 0, lines = 0
  const wh = opts.locationId ? null : await ensureWarehouse(owner)
  for (const it of (items ?? []) as { id: string; product_id: string | null; qty: number; received_qty: number | null; unit_cost: number | null; site_id?: string | null }[]) {
    const left = (Number(it.qty) || 0) - (Number(it.received_qty) || 0)
    if (left <= 0) continue
    if (it.product_id) {
      const to = it.site_id ? (await ensureSiteShelf(owner, it.site_id)).id : (opts.locationId ?? wh!.id)
      await addMove({ org_id: owner, product_id: it.product_id, kind: 'receive', qty: left, to_location_id: to, unit_cost: it.unit_cost ?? null, po_id: poId, po_item_id: it.id, created_by: opts.by ?? null, note: it.site_id ? 'Bought for this property’s service plan' : null })
      received += left
    }
    const { error: uErr } = await db().from('purchase_order_items').update({ received_qty: Number(it.qty) || 0 }).eq('id', it.id)
    if (uErr) throw new Error(uErr.message)
    lines++
  }
  return { received, lines }
}
