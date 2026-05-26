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

  let query = serviceDb()
    .from('products')
    .select('id, name, sku, brand, category, subcategory, description, sell_price, list_price, msrp, image_url, field_service, manual_url, active, tags')
    .order('brand', { nullsFirst: false })
    .order('name')
    .limit(limit)

  if (active) query = query.eq('active', true)

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

  const row = {
    name:          name.trim(),
    description:   description ?? null,
    sku:           resolvedSku,
    brand:         brand       ?? null,
    category:      category    ?? 'Custom',
    subcategory:   subcategory ?? null,
    sell_price:    typeof sell_price === 'number' ? sell_price : 0,
    list_price:    typeof list_price === 'number' ? list_price : (typeof sell_price === 'number' ? sell_price : 0),
    msrp:          typeof msrp       === 'number' ? msrp       : null,
    image_url:     image_url   ?? null,
    field_service: field_service === true,
    tags:          Array.isArray(tags) ? tags : [],
    active:        true,
  }

  const { data, error } = await serviceDb()
    .from('products')
    .insert(row)
    .select('id, name, sku, brand, category, sell_price, list_price, image_url, field_service, active')
    .single()

  if (error) {
    // Duplicate SKU — append a suffix and retry once
    if (error.code === '23505' && error.message.includes('sku')) {
      row.sku = `${row.sku}-${Date.now().toString().slice(-4)}`
      const { data: d2, error: e2 } = await serviceDb()
        .from('products')
        .insert(row)
        .select('id, name, sku, brand, category, sell_price, list_price, image_url, field_service, active')
        .single()
      if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
      return NextResponse.json({ product: d2 }, { status: 201 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ product: data }, { status: 201 })
}
