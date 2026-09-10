/**
 * GET    /api/products?q=&limit=20&active=true   — search / list catalog
 * POST   /api/products                            — create one, OR bulk upsert { action:'upsert', rows }
 * PATCH  /api/products                            — update one by { id, ...fields }
 * DELETE /api/products                            — delete { ids:[...] } (or { id })
 *
 * Portal-side product catalog API. Service-role DB access behind a Clerk gate,
 * so this is the single write path for products — the Product Catalog admin page,
 * the Nexus catalog editor, quote/floor-plan pickers, and operations parts all
 * go through here. Because writes never touch the anon key, products RLS can stay
 * ON (migration 186) without breaking any of these callers.
 *
 * Auth: Clerk session required.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth }                      from '@clerk/nextjs/server'
import { createClient }              from '@supabase/supabase-js'
import { getCurrentUser }            from '@/lib/current-user'
import { resolveOrgScope }           from '@/lib/org-scope'
import { inngest }                   from '@/inngest/client'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function serviceDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q      = (searchParams.get('q') ?? '').trim()
  // Cap raised to 2000 so the Product Catalog admin page can load the full list.
  const limit  = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 2000)
  const active = searchParams.get('active') !== 'false' // default true

  // select('*') is drift-proof — this db's products schema differs from the
  // migration files (e.g. no list_price), so we never name columns that may
  // be absent. Callers read whatever fields exist.
  let query = serviceDb()
    .from('products')
    .select('*')
    .order('name')
    .limit(limit)

  if (active) query = query.eq('active', true)

  // Catalog layer: everyone sees the global GateGuard catalog (org_id null);
  // dealers also see their own private items; corporate sees everything.
  const scope = await resolveOrgScope(await getCurrentUser())
  if (!scope.all) {
    const ids = scope.ids.filter(Boolean)
    query = ids.length > 0
      ? query.or(`org_id.is.null,org_id.in.(${ids.join(',')})`)
      : query.is('org_id', null)
  }

  if (q) {
    // ilike search across name, sku, brand, description
    query = query.or(
      `name.ilike.%${q}%,sku.ilike.%${q}%,brand.ilike.%${q}%,description.ilike.%${q}%`
    )
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ products: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const scope = await resolveOrgScope(await getCurrentUser())

  // ── Bulk upsert on SKU (Product Catalog admin import + first-run seed) ───────
  if (body.action === 'upsert') {
    const rowsIn = Array.isArray(body.rows) ? (body.rows as Record<string, unknown>[]) : []
    if (rowsIn.length === 0) return NextResponse.json({ error: 'No rows provided.' }, { status: 400 })
    const org_id = scope.all ? ((body.org_id as string) ?? null) : (scope.own_id ?? null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rows: Record<string, any>[] = rowsIn.map(r => ({ ...r, org_id }))
    async function upsertRows(rs: Record<string, unknown>[]) {
      return serviceDb().from('products').upsert(rs, { onConflict: 'sku' }).select('*')
    }
    let { data, error } = await upsertRows(rows)
    // Drift-safe: strip a column the live schema lacks (from every row) and retry.
    let guard = 0
    while (error && (error.code === '42703' || error.code === 'PGRST204') && guard < 12) {
      const m = /Could not find the '([a-z_]+)' column/i.exec(error.message)
        || /column "?([a-z_]+)"? of relation/i.exec(error.message)
        || /'([a-z_]+)' column/i.exec(error.message)
      const col = m?.[1]
      if (!col) break
      rows = rows.map(r => { const c = { ...r }; delete c[col]; return c })
      guard++
      ;({ data, error } = await upsertRows(rows))
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ products: data ?? [] })
  }

  // ── Single create (flat body — the contract every caller already uses) ───────
  // Catalog layer: dealers create PRIVATE items (org_id = their org).
  // Corporate creates GLOBAL items (org_id null) unless they pass org_id.
  const org_id = scope.all ? ((body.org_id as string) ?? null) : (scope.own_id ?? null)

  const {
    name, description, sku, brand, category, subcategory,
    sell_price, list_price, dealer_cost, msrp, specs, adi_sku,
    image_url, manual_url, field_service, tags, design_meta,
  } = body

  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const resolvedSku = (sku && typeof sku === 'string' && sku.trim())
    ? sku.trim().toUpperCase()
    : `CUSTOM-${Date.now().toString().slice(-6)}`

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row: Record<string, any> = {
    name:     name.trim(),
    sku:      resolvedSku,
    category: category ?? 'Custom',
    active:   true,
    org_id,
  }
  if (description != null) row.description = description
  if (brand != null) row.brand = brand
  if (subcategory != null) row.subcategory = subcategory
  if (typeof sell_price === 'number') row.sell_price = sell_price
  if (typeof list_price === 'number') row.list_price = list_price
  if (typeof dealer_cost === 'number') row.dealer_cost = dealer_cost
  if (typeof msrp === 'number') row.msrp = msrp
  if (specs != null) row.specs = specs
  if (adi_sku != null) row.adi_sku = adi_sku
  if (image_url != null) row.image_url = image_url
  if (manual_url != null) row.manual_url = manual_url
  if (field_service != null) row.field_service = field_service === true
  if (Array.isArray(tags)) row.tags = tags
  if (design_meta != null && typeof design_meta === 'object') row.design_meta = design_meta

  async function insertRow(r: Record<string, unknown>): Promise<{ data: unknown; error: { code?: string; message: string } | null }> {
    return serviceDb().from('products').insert(r).select('*').single()
  }
  async function fireManualIngest(p: unknown) {
    const pid = (p as { id?: string } | null)?.id
    if (pid && manual_url) {
      try { await inngest.send({ name: 'kb/manual.ingest', data: { product_id: pid, manual_url } }) } catch { /* non-fatal */ }
    }
  }

  let { data, error } = await insertRow(row)
  let guard = 0
  while (error && (error.code === '42703' || error.code === 'PGRST204') && guard < 10) {
    const m = /Could not find the '([a-z_]+)' column/i.exec(error.message)
      || /column "?([a-z_]+)"? of relation/i.exec(error.message)
      || /'([a-z_]+)' column/i.exec(error.message)
    const col = m?.[1]
    if (!col || !(col in row)) break
    delete row[col]
    guard++
    ;({ data, error } = await insertRow(row))
  }

  if (error) {
    if (error.code === '23505' && error.message.includes('sku')) {
      row.sku = `${row.sku}-${Date.now().toString().slice(-4)}`
      const { data: d2, error: e2 } = await serviceDb().from('products').insert(row).select('*').single()
      if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
      await fireManualIngest(d2)
      return NextResponse.json({ product: d2 }, { status: 201 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await fireManualIngest(data)
  return NextResponse.json({ product: data }, { status: 201 })
}

// PATCH /api/products — update an existing product by id (flat body of fields).
// Body: { id, name?, brand?, sku?, category?, sell_price?, active?, manual_url?, ... }
// If manual_url is set, kicks off background vectorization.
export async function PATCH(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const b = body as Record<string, unknown>
  const id = String(b.id ?? '')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const patch: Record<string, unknown> = {}
  for (const k of ['name', 'brand', 'sku', 'category', 'subcategory', 'description', 'specs', 'adi_sku', 'manual_url', 'image_url']) {
    if (b[k] != null) patch[k] = b[k]
  }
  for (const k of ['sell_price', 'dealer_cost', 'list_price', 'msrp']) {
    if (typeof b[k] === 'number') patch[k] = b[k]
  }
  if (typeof b.active === 'boolean') patch.active = b.active
  if (typeof b.field_service === 'boolean') patch.field_service = b.field_service
  if (Array.isArray(b.tags)) patch.tags = b.tags
  if (b.design_meta != null && typeof b.design_meta === 'object') patch.design_meta = b.design_meta
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  let { data, error } = await serviceDb().from('products').update(patch).eq('id', id).select('*').single()
  let guard = 0
  while (error && (error.code === '42703' || error.code === 'PGRST204') && guard < 10) {
    const m = /Could not find the '([a-z_]+)' column/i.exec(error.message) || /'([a-z_]+)' column/i.exec(error.message)
    const col = m?.[1]
    if (!col || !(col in patch)) break
    delete patch[col]; guard++
    ;({ data, error } = await serviceDb().from('products').update(patch).eq('id', id).select('*').single())
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (patch.manual_url) {
    try { await inngest.send({ name: 'kb/manual.ingest', data: { product_id: id, manual_url: patch.manual_url } }) } catch { /* non-fatal */ }
  }
  return NextResponse.json({ product: data })
}

// DELETE /api/products — remove one or many products by id { ids:[...] } or { id }
export async function DELETE(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const b = body as Record<string, unknown>
  const raw = Array.isArray(b.ids) ? b.ids : (b.id != null ? [b.id] : [])
  const ids = raw.map(x => String(x)).filter(Boolean)
  if (ids.length === 0) return NextResponse.json({ error: 'No ids provided.' }, { status: 400 })
  const { error } = await serviceDb().from('products').delete().in('id', ids)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, deleted: ids.length })
}
