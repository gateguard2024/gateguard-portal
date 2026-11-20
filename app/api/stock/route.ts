/**
 * /api/stock — where parts are (rules: lib/stock.ts, migration 236).
 *
 * GET ?work_order_id=…[&q=…]  For the Finish job sheet (portal or field app): the places this
 *                             job can take parts from (tech's truck first) + catalog matches
 *                             for `q` with how many sit in each place. Job guard (tech code ok).
 * GET ?site_id=…              What's on that property's spare shelf (+ installed count is on
 *                             Systems). Corporate sees every company's shelf there; a dealer sees
 *                             only their own company's.
 * GET                         Catalog → Stock: the caller's places, levels, minimums, and old
 *                             inventory lines not linked to a product. Gate Guard sees all.
 * POST {kind, name, technician_id?, site_id?, org_id? (corporate)} — add a place.
 * PATCH {id, name?, active?}  — rename / retire a place.
 * Dealers never see Gate Guard's own stock or costs (org_id NULL rows are corporate-only).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, isInScope } from '@/lib/org-scope'
import { guardWorkOrder, guardSite } from '@/lib/ops-scope'
import { stockReady, jobLocations, levels, ownsPlace, LOCATION_KINDS, type Location } from '@/lib/stock'

export const dynamic = 'force-dynamic'
const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const LOC_COLS = 'id, org_id, kind, name, technician_id, site_id, active'
const notReady = { ready: false, note: 'Stock needs migration 236.' }
const clean = (s: string) => s.replace(/[,()%*\\]/g, ' ').trim().slice(0, 60)

type P = { id: string; name: string; sku: string | null; brand: string | null; org_id: string | null; active?: boolean }

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const woId = url.searchParams.get('work_order_id')
  const siteId = url.searchParams.get('site_id')

  // ── Finish job: places + catalog matches ──────────────────────────────────
  if (woId) {
    if (!(await guardWorkOrder(req, woId))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!(await stockReady())) return NextResponse.json({ ...notReady, locations: [], products: [] })
    const { data: wo } = await db().from('work_orders').select('org_id, assignee_id, site_id').eq('id', woId).maybeSingle()
    if (!wo) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const w = wo as { org_id: string | null; assignee_id: string | null; site_id: string | null }
    const { locations, defaultId } = await jobLocations(w)
    const q = clean(url.searchParams.get('q') ?? '')
    let products: (P & { stock: Record<string, number> })[] = []
    if (q.length >= 2) {
      let pq = db().from('products').select('id, name, sku, brand, org_id, active').or(`name.ilike.%${q}%,sku.ilike.%${q}%,brand.ilike.%${q}%`).limit(40)
      pq = w.org_id ? pq.or(`org_id.is.null,org_id.eq.${w.org_id}`) : pq.is('org_id', null)
      const { data } = await pq
      const ps = ((data ?? []) as P[]).filter((p) => p.active !== false).slice(0, 12)
      const lv = ps.length ? await levels({ orgIds: 'all', productIds: ps.map((p) => p.id), locationIds: locations.map((l) => l.id) }) : []
      products = ps.map((p) => ({ ...p, stock: Object.fromEntries(lv.filter((l) => l.product_id === p.id && l.qty !== 0).map((l) => [l.location_id, l.qty])) }))
    }
    return NextResponse.json({ ready: true, locations: locations.map(({ id, name, kind }) => ({ id, name, kind })), defaultId, products })
  }

  const user = await getCurrentUser()

  // ── A property's spare shelf ──────────────────────────────────────────────
  if (siteId) {
    if (!(await guardSite(req, siteId))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!(await stockReady())) return NextResponse.json({ ...notReady, shelves: [] })
    const scope = await resolveOrgScope(user)
    const { data } = await db().from('stock_locations').select(LOC_COLS).eq('kind', 'site').eq('site_id', siteId)
    const shelves = ((data ?? []) as Location[]).filter((l) => ownsPlace(scope, l.org_id))
    const lv = shelves.length ? await levels({ orgIds: 'all', locationIds: shelves.map((l) => l.id) }) : []
    const pids = Array.from(new Set(lv.filter((l) => l.qty !== 0).map((l) => l.product_id)))
    const { data: prods } = pids.length ? await db().from('products').select('id, name, sku, brand').in('id', pids) : { data: [] }
    const pm = new Map(((prods ?? []) as P[]).map((p) => [p.id, p]))
    return NextResponse.json({
      ready: true,
      shelves: shelves.map((l) => ({ id: l.id, name: l.name, mine: l.org_id === (scope.own_id ?? null),
        items: lv.filter((x) => x.location_id === l.id && x.qty !== 0).map((x) => ({ product_id: x.product_id, name: pm.get(x.product_id)?.name ?? 'Part', sku: pm.get(x.product_id)?.sku ?? null, qty: x.qty })).sort((a, b) => a.name.localeCompare(b.name)) })),
    })
  }

  // ── Catalog → Stock ───────────────────────────────────────────────────────
  if (!user.id || user.id === 'anonymous') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const scope = await resolveOrgScope(user)
  if (!scope.all && !scope.ids.length) return NextResponse.json({ ready: true, locations: [], levels: [], products: {}, minimums: [], legacy: [] })
  if (!(await stockReady())) return NextResponse.json({ ...notReady, locations: [], levels: [], products: {}, minimums: [], legacy: [] })

  let lq = db().from('stock_locations').select(LOC_COLS).order('kind').order('name').limit(2000)
  if (!scope.all) lq = lq.in('org_id', scope.ids)
  const { data: locs, error } = await lq
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const locations = (locs ?? []) as Location[]
  const lv = await levels({ orgIds: scope.all ? 'all' : scope.ids })
  let mq = db().from('stock_minimums').select('org_id, product_id, min_qty').limit(10000)
  if (!scope.all) mq = mq.in('org_id', scope.ids)
  const { data: mins } = await mq
  const pids = Array.from(new Set([...lv.map((l) => l.product_id), ...((mins ?? []) as { product_id: string }[]).map((m) => m.product_id)]))
  const products: Record<string, P> = {}
  for (let i = 0; i < pids.length; i += 200) {
    const { data } = await db().from('products').select('id, name, sku, brand, org_id').in('id', pids.slice(i, i + 200))
    for (const p of (data ?? []) as P[]) products[p.id] = p
  }
  // Old inventory lines that never got a catalog product (left out of the one-time copy).
  let iq = db().from('inventory_items').select('id, org_id, name, sku, on_hand, on_truck').is('product_id', null).eq('is_active', true).limit(500)
  if (!scope.all) iq = iq.in('org_id', scope.ids)
  const { data: inv } = await iq
  const { data: copied } = await db().from('stock_moves').select('legacy_item_id').not('legacy_item_id', 'is', null).limit(10000)
  const done = new Set(((copied ?? []) as { legacy_item_id: string }[]).map((r) => r.legacy_item_id))
  const legacy = ((inv ?? []) as { id: string; on_hand: number; on_truck: number }[]).filter((r) => !done.has(r.id) && ((Number(r.on_hand) || 0) + (Number(r.on_truck) || 0)) > 0)

  return NextResponse.json({ ready: true, own_id: scope.own_id, isCorporate: scope.all, locations, levels: lv.filter((l) => l.qty !== 0), products, minimums: mins ?? [], legacy })
}

async function body(req: NextRequest): Promise<Record<string, unknown> | null> { try { return await req.json() } catch { return null } }

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user.id || user.id === 'anonymous') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await stockReady())) return NextResponse.json({ error: 'Stock needs migration 236.' }, { status: 409 })
  const b = await body(req); if (!b) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  const scope = await resolveOrgScope(user)
  const kind = String(b.kind ?? '')
  if (!(LOCATION_KINDS as readonly string[]).includes(kind)) return NextResponse.json({ error: 'Pick warehouse, truck or property shelf.' }, { status: 400 })
  // Owner: corporate may name a company (or leave it as Gate Guard); everyone else = their own company.
  const orgId = scope.all ? ((b.org_id as string) || null) : scope.own_id
  if (!scope.all && !orgId) return NextResponse.json({ error: 'Your login isn’t linked to a company yet.' }, { status: 403 })
  const row: Record<string, unknown> = { org_id: orgId, kind, name: String(b.name ?? '').trim().slice(0, 80) }
  if (kind === 'truck') {
    const techId = String(b.technician_id ?? '')
    if (techId) {
      const { data: t } = await db().from('technicians').select('id, name, org_id').eq('id', techId).maybeSingle()
      const tech = t as { name?: string; org_id?: string | null } | null
      if (!tech || (!scope.all && !isInScope(scope, tech.org_id ?? null))) return NextResponse.json({ error: 'That tech isn’t on your team.' }, { status: 403 })
      row.technician_id = techId; row.org_id = tech.org_id ?? orgId
      if (!row.name) row.name = `${tech.name || 'Tech'}’s truck`
    }
  }
  if (kind === 'site') {
    const sid = String(b.site_id ?? '')
    if (!sid || !(await guardSite(req, sid))) return NextResponse.json({ error: 'Pick a property you work on.' }, { status: 400 })
    row.site_id = sid
    if (!row.name) { const { data: s } = await db().from('sites').select('name').eq('id', sid).maybeSingle(); row.name = `${(s as { name?: string } | null)?.name ?? 'Property'} — spare shelf` }
  }
  if (!row.name) return NextResponse.json({ error: 'Give it a name.' }, { status: 400 })
  const { data, error } = await db().from('stock_locations').insert(row).select(LOC_COLS).single()
  if (error?.code === '23505') return NextResponse.json({ error: kind === 'truck' ? 'That tech already has a truck.' : 'That property already has a shelf.' }, { status: 409 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ location: data }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user.id || user.id === 'anonymous') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const b = await body(req); if (!b?.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
  const scope = await resolveOrgScope(user)
  const { data: loc } = await db().from('stock_locations').select(LOC_COLS).eq('id', String(b.id)).maybeSingle()
  if (!loc || !ownsPlace(scope, (loc as Location).org_id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const patch: Record<string, unknown> = {}
  if (typeof b.name === 'string' && b.name.trim()) patch.name = b.name.trim().slice(0, 80)
  if (typeof b.active === 'boolean') patch.active = b.active
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to change' }, { status: 400 })
  const { data, error } = await db().from('stock_locations').update(patch).eq('id', String(b.id)).select(LOC_COLS).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ location: data })
}
