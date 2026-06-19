/**
 * GET  /api/products?q=&limit=20&active=true
 * POST /api/products
 *
 * Portal-side product catalog API.
 * Returns the FULL catalog (not filtered to field_service=true).
 * Used by: quote editor line-item search, invoice line-item picker, etc.
 *
 * Auth: Clerk session required.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth }                      from '@clerk/nextjs/server'
import { createClient }              from '@supabase/supabase-js'
import { getCurrentUser }            from '@/lib/current-user'
import { resolveOrgScope }           from '@/lib/org-scope'
import { inngest }                   from '@/inngest/client'

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
  const limit  = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100)
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

  // Catalog layer: dealers create PRIVATE items (org_id = their org).
  // Corporate creates GLOBAL items (org_id null) unless they pass org_id.
  const scope = await resolveOrgScope(await getCurrentUser())
  const org_id = scope.all ? ((body.org_id as string) ?? null) : (scope.own_id ?? null)

  const {
    name,
    description,
    sku,
    brand,
    category,
    subcategory,
    sell_price,
    list_price,
    msrp,
    image_url,
    manual_url,
    field_service,
    tags,
  } = body

  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  // Auto-generate SKU if not provided
  const resolvedSku = (sku && typeof sku === 'string' && sku.trim())
    ? sku.trim().toUpperCase()
    : `CUSTOM-${Date.now().toString().slice(-6)}`

  // Build only with core columns that reliably exist (this db's products schema
  // drifted from the migrations — e.g. no list_price). Optional columns are added
  // only when the caller supplied a value, and a missing-column error retries
  // without it, so a dealer "Save to my catalog" (name only) always succeeds.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row: Record<string, any> = {
    name:        name.trim(),
    sku:         resolvedSku,
    category:    category ?? 'Custom',
    active:      true,
    org_id,
  }
  if (description != null) row.description = description
  if (brand != null) row.brand = brand
  if (subcategory != null) row.subcategory = subcategory
  if (typeof sell_price === 'number') row.sell_price = sell_price
  if (typeof list_price === 'number') row.list_price = list_price
  if (typeof msrp === 'number') row.msrp = msrp
  if (image_url != null) row.image_url = image_url
  if (manual_url != null) row.manual_url = manual_url
  if (field_service != null) row.field_service = field_service === true
  if (Array.isArray(tags)) row.tags = tags

  async function insertRow(r: Record<string, unknown>): Promise<{ data: unknown; error: { code?: string; message: string } | null }> {
    return serviceDb().from('products').insert(r).select('*').single()
  }
  // Phase E: auto-vectorize the manual in the background (universal coverage)
  async function fireManualIngest(p: unknown) {
    const pid = (p as { id?: string } | null)?.id
    if (pid && manual_url) {
      try { await inngest.send({ name: 'kb/manual.ingest', data: { product_id: pid, manual_url } }) } catch { /* non-fatal */ }
    }
  }

  let { data, error } = await insertRow(row)
  // Strip any column the live schema doesn't have and retry (handles drift).
  // Supabase reports it as Postgres 42703 OR PostgREST PGRST204.
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
    // Duplicate SKU — append a suffix and retry once
    if (error.code === '23505' && error.message.includes('sku')) {
      row.sku = `${row.sku}-${Date.now().toString().slice(-4)}`
      const { data: d2, error: e2 } = await serviceDb()
        .from('products')
        .insert(row)
        .select('*')
        .single()
      if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
      await fireManualIngest(d2)
      return NextResponse.json({ product: d2 }, { status: 201 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await fireManualIngest(data)
  return NextResponse.json({ product: data }, { status: 201 })
}
