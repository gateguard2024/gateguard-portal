import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, applyOrgScope } from '@/lib/org-scope'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function computeStatus(on_hand: number, min_stock: number): string {
  if (on_hand === 0) return 'out'
  if (on_hand <= min_stock) return 'low'
  return 'ok'
}

// GET /api/inventory — list inventory items
export async function GET(req: NextRequest) {
  const user  = await getCurrentUser()
  const scope = await resolveOrgScope(user)

  const { searchParams } = new URL(req.url)
  const q        = searchParams.get('q')        ?? ''
  const category = searchParams.get('category') ?? ''
  const status   = searchParams.get('status')   ?? ''

  let query = supabase
    .from('inventory_items')
    .select('*', { count: 'exact' })
    .eq('is_active', true)
    .order('category', { ascending: true })
    .order('name',     { ascending: true })

  // Org scope
  query = applyOrgScope(query, scope, 'org_id') as typeof query

  // Search
  if (q) {
    query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%`) as typeof query
  }

  // Category filter
  if (category) {
    query = query.eq('category', category) as typeof query
  }

  const { data, error, count } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Compute status client-side since PostgREST column-column comparisons are tricky
  const records = (data ?? []).map(item => ({
    ...item,
    status: computeStatus(item.on_hand, item.min_stock),
  }))

  // Apply status filter in-memory if provided (more reliable than PostgREST column-column)
  const filtered = status
    ? records.filter(r => r.status === status)
    : records

  return NextResponse.json({ records: filtered, total: filtered.length })
}

// POST /api/inventory — create inventory item
export async function POST(req: NextRequest) {
  const user  = await getCurrentUser()
  const scope = await resolveOrgScope(user)
  const body  = await req.json()

  const {
    name, sku, category = 'Other', description,
    unit_cost = 0, unit_price = 0,
    on_hand = 0, on_truck = 0, min_stock = 0, reorder_qty = 1,
    location, supplier, supplier_sku, product_id,
  } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const org_id = scope.own_id

  const { data, error } = await supabase
    .from('inventory_items')
    .insert({
      org_id,
      name: name.trim(),
      sku:  sku?.trim() || null,
      category,
      description: description?.trim() || null,
      unit_cost,
      unit_price,
      on_hand,
      on_truck,
      min_stock,
      reorder_qty,
      location:     location?.trim()     || null,
      supplier:     supplier?.trim()     || null,
      supplier_sku: supplier_sku?.trim() || null,
      product_id:   product_id           || null,
      is_active: true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    ...data,
    status: computeStatus(data.on_hand, data.min_stock),
  }, { status: 201 })
}
