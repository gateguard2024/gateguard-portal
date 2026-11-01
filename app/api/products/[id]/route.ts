/**
 * GET /api/products/[id] — everything the product page shows, in one call.
 *   { product, canEdit, accessories: [{ product, qty, required }], partOfKits: [...],
 *     stock: [...inventory rows], used: { quotes, jobs, installed, purchases },
 *     manuals: [{ url, pages }], articles: [...], counts }
 *
 * Scoping: the product must be visible to the caller (global catalog or one of
 * their companies' private items). Every "where used" list is limited to the
 * caller's companies, so a dealer never sees another dealer's quotes or jobs.
 * Each list is fetched on its own and falls back to empty if that table/column
 * isn't on this database yet — one missing table never blanks the page.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { isSignedIn } from '@/lib/assistant-executor'
import { applyOrgScope, resolveOrgScope, type OrgScope } from '@/lib/org-scope'

export const dynamic = 'force-dynamic'
const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NO_MATCH = '00000000-0000-0000-0000-000000000000'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

const visible = (p: Row, scope: OrgScope) => scope.all || p.org_id == null || scope.ids.includes(p.org_id)
const canEdit = (p: Row, scope: OrgScope) => scope.all || (!!p.org_id && scope.ids.includes(p.org_id))
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const scoped = (q: any, scope: OrgScope, col = 'org_id') => (scope.all ? q : scope.ids.length ? applyOrgScope(q, scope, col) : q.eq('id', NO_MATCH))
// Run a query; on any error return [] (and log), so one bad table can't break the page.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function rows(label: string, q: PromiseLike<{ data: any; error: { message: string } | null }>): Promise<Row[]> {
  const { data, error } = await q
  if (error) { console.warn(`[products/id] ${label}:`, error.message); return [] }
  return (data ?? []) as Row[]
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!isSignedIn(user)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'Bad id' }, { status: 400 })
  const db = sb()
  const scope = await resolveOrgScope(user)

  const { data: product, error } = await db.from('products').select('*').eq('id', params.id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!product || !visible(product, scope)) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  const id = params.id
  const accIds = (Array.isArray(product.accessories) ? product.accessories : []).map((a: Row) => a.product_id).filter((x: unknown) => typeof x === 'string' && UUID.test(x as string))

  const [accRows, kitRows, stock, qli, wop, inst, assets, poi, chunks, articles] = await Promise.all([
    accIds.length ? rows('accessories', db.from('products').select('id, name, sku, brand, category, image_url, sell_price, dealer_cost, org_id, active').in('id', accIds)) : Promise.resolve([]),
    rows('kits', db.from('products').select('id, name, sku, brand, image_url, org_id').filter('accessories', 'cs', JSON.stringify([{ product_id: id }])).limit(20)),
    rows('stock', scoped(db.from('inventory_items').select('id, org_id, name, location, on_hand, on_truck, min_stock, reorder_qty, supplier, supplier_sku, unit_cost, is_active').eq('product_id', id), scope)),
    rows('quote lines', db.from('quote_line_items').select('quote_id, qty, unit_price').eq('product_id', id).limit(300)),
    rows('job parts', db.from('work_order_parts').select('work_order_id, qty, created_at').eq('product_id', id).limit(300)),
    rows('installed', db.from('wo_installed_equipment').select('work_order_id, qty, serial_number, location').eq('product_id', id).limit(300)),
    rows('site assets', scoped(db.from('site_assets').select('id, site_id, serial_number, location_note, status, installed_at').eq('product_id', id).limit(300), scope)),
    rows('po lines', db.from('purchase_order_items').select('po_id, qty, unit_cost, received_qty').eq('product_id', id).limit(300)),
    rows('manuals', db.from('manual_chunks').select('manual_url, page_number').eq('product_id', id).limit(2000)),
    rows('articles', db.from('kb_articles').select('id, title, category, difficulty').eq('product_id', id).eq('active', true).limit(20)),
  ])

  // Parents (quotes / jobs / POs / sites) — fetched scoped, so lines from other companies drop out.
  const uniq = (xs: unknown[]) => Array.from(new Set(xs.filter(Boolean) as string[])).slice(0, 200)
  const quoteIds = uniq(qli.map(r => r.quote_id))
  const woIds = uniq([...wop.map(r => r.work_order_id), ...inst.map(r => r.work_order_id)])
  const poIds = uniq(poi.map(r => r.po_id))
  const siteIds = uniq(assets.map(r => r.site_id))
  const [quotes, jobs, pos, sites] = await Promise.all([
    quoteIds.length ? rows('quotes', scoped(db.from('quotes').select('id, quote_number, title, status, total_one_time, created_at').in('id', quoteIds), scope)) : Promise.resolve([]),
    woIds.length ? rows('jobs', scoped(db.from('work_orders').select('id, wo_number, title, status, customer_name, scheduled_date, created_at').in('id', woIds), scope)) : Promise.resolve([]),
    poIds.length ? rows('pos', scoped(db.from('purchase_orders').select('id, po_number, supplier, status, created_at, expected_at').in('id', poIds), scope)) : Promise.resolve([]),
    siteIds.length ? rows('sites', scoped(db.from('sites').select('id, name, city, state').in('id', siteIds), scope, 'site')) : Promise.resolve([]),
  ])
  const sum = (xs: Row[], f: (r: Row) => number) => xs.reduce((a, r) => a + (Number(f(r)) || 0), 0)
  const siteById = new Map(sites.map(s => [s.id, s]))

  const usedQuotes = quotes.map((q): Row => ({ ...q, qty: sum(qli.filter(l => l.quote_id === q.id), l => l.qty) }))
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
  const usedJobs = jobs.map((j): Row => ({ ...j, qty: sum([...wop, ...inst].filter(l => l.work_order_id === j.id), l => l.qty || 1) }))
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
  const usedPOs = pos.map((p): Row => { const ls = poi.filter(l => l.po_id === p.id); return { ...p, qty: sum(ls, l => l.qty), received: sum(ls, l => l.received_qty), unit_cost: ls[0]?.unit_cost ?? null } })
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
  const installed = assets.filter(a => siteById.has(a.site_id)).map(a => ({ ...a, site: siteById.get(a.site_id) }))

  const manualMap = new Map<string, Set<number>>()
  for (const c of chunks) { if (!c.manual_url) continue; if (!manualMap.has(c.manual_url)) manualMap.set(c.manual_url, new Set()); if (c.page_number != null) manualMap.get(c.manual_url)!.add(c.page_number) }
  const manuals = Array.from(manualMap.entries()).map(([url, pages]) => ({ url, pages: pages.size }))
  if (product.manual_url && !manualMap.has(product.manual_url)) manuals.unshift({ url: product.manual_url, pages: 0 })

  const accessories = (Array.isArray(product.accessories) ? product.accessories : [])
    .map((a: Row) => ({ ...a, product: accRows.find(p => p.id === a.product_id && visible(p, scope)) ?? null }))
    .filter((a: Row) => a.product)
  const partOfKits = kitRows.filter(k => visible(k, scope) && k.id !== id)

  const onHand = sum(stock, s => s.on_hand), onTruck = sum(stock, s => s.on_truck), minStock = sum(stock, s => s.min_stock)
  return NextResponse.json({
    product, canEdit: canEdit(product, scope),
    accessories, partOfKits, stock,
    used: { quotes: usedQuotes, jobs: usedJobs, installed, purchases: usedPOs },
    manuals, articles,
    counts: {
      onHand, onTruck, minStock, low: stock.length > 0 && onHand < minStock,
      quotes: usedQuotes.length, jobs: usedJobs.length, installed: installed.length, purchases: usedPOs.length,
      quotedQty: sum(usedQuotes, q => q.qty), usedQty: sum(usedJobs, j => j.qty),
    },
  })
}
