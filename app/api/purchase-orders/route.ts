import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, applyOrgScope } from '@/lib/org-scope'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/purchase-orders — list POs for the org
export async function GET(req: NextRequest) {
  const user  = await getCurrentUser()
  const scope = await resolveOrgScope(user)

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? ''

  let query = supabase
    .from('purchase_orders')
    .select('*, purchase_order_items(*)', { count: 'exact' })
    .order('created_at', { ascending: false })

  query = applyOrgScope(query, scope, 'org_id') as typeof query

  if (status) {
    query = query.eq('status', status) as typeof query
  }

  const { data, error, count } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ records: data ?? [], total: count ?? 0 })
}

// POST /api/purchase-orders — create a draft PO
export async function POST(req: NextRequest) {
  const user  = await getCurrentUser()
  const scope = await resolveOrgScope(user)
  const body  = await req.json()

  const {
    supplier, notes, po_number,
    expected_at,
    items = [],
  } = body

  const org_id = scope.own_id

  // Compute totals from items
  const subtotal = (items as Array<{ qty: number; unit_cost: number }>)
    .reduce((acc, item) => acc + (item.qty ?? 1) * (item.unit_cost ?? 0), 0)
  const tax   = Number(body.tax ?? 0)
  const total = subtotal + tax

  const { data: po, error: poErr } = await supabase
    .from('purchase_orders')
    .insert({
      org_id,
      po_number:   po_number?.trim() || null,
      supplier:    supplier?.trim()  || null,
      status:      'draft',
      notes:       notes?.trim()     || null,
      subtotal,
      tax,
      total,
      expected_at: expected_at || null,
    })
    .select()
    .single()

  if (poErr) return NextResponse.json({ error: poErr.message }, { status: 500 })

  // Insert line items if provided
  if (items.length > 0) {
    const rows = (items as Array<{
      inventory_item_id?: string
      name: string
      sku?: string
      qty: number
      unit_cost?: number
    }>).map(item => ({
      po_id:             po.id,
      inventory_item_id: item.inventory_item_id || null,
      name:              item.name,
      sku:               item.sku              || null,
      qty:               item.qty              ?? 1,
      unit_cost:         item.unit_cost        ?? 0,
      received_qty:      0,
    }))

    const { error: itemsErr } = await supabase.from('purchase_order_items').insert(rows)
    if (itemsErr) {
      console.error('[purchase-orders POST] items insert error:', itemsErr.message)
    }
  }

  return NextResponse.json(po, { status: 201 })
}
