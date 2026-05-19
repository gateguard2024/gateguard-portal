import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

// POST /api/inventory/[id]/adjust
// Body: { type: "add"|"remove"|"set", qty: number, location?: "warehouse"|"truck", notes?: string }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const { type, qty, location = 'warehouse' } = body

  if (!type || qty === undefined || qty === null) {
    return NextResponse.json({ error: 'type and qty are required' }, { status: 400 })
  }

  if (!['add', 'remove', 'set'].includes(type)) {
    return NextResponse.json({ error: 'type must be add, remove, or set' }, { status: 400 })
  }

  const numQty = Number(qty)
  if (isNaN(numQty) || numQty < 0) {
    return NextResponse.json({ error: 'qty must be a non-negative number' }, { status: 400 })
  }

  // Fetch current item
  const { data: current, error: fetchErr } = await supabase
    .from('inventory_items')
    .select('on_hand, on_truck, min_stock')
    .eq('id', params.id)
    .single()

  if (fetchErr || !current) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 })
  }

  const col = location === 'truck' ? 'on_truck' : 'on_hand'
  const currentVal: number = current[col] ?? 0

  let newVal: number
  if (type === 'set') {
    newVal = numQty
  } else if (type === 'add') {
    newVal = currentVal + numQty
  } else {
    // remove — floor at 0
    newVal = Math.max(0, currentVal - numQty)
  }

  const { data, error } = await supabase
    .from('inventory_items')
    .update({ [col]: newVal, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    ...data,
    status: computeStatus(data.on_hand, data.min_stock),
  })
}
