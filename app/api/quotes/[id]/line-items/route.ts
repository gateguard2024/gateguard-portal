import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { data, error } = await supabase
    .from('quote_line_items')
    .select('*')
    .eq('quote_id', params.id)
    .order('sort_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ line_items: data ?? [] })
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { category, description, qty, unit_price, sort_order } = body as {
    category?: string
    description?: string
    qty?: number
    unit_price?: number
    sort_order?: number
  }

  const qtyVal = qty ?? 1
  const priceVal = unit_price ?? 0
  const total = qtyVal * priceVal

  // Get next sort_order if not provided
  let sortVal = sort_order
  if (sortVal === undefined) {
    const { count } = await supabase
      .from('quote_line_items')
      .select('*', { count: 'exact', head: true })
      .eq('quote_id', params.id)
    sortVal = (count ?? 0) + 1
  }

  const { data, error } = await supabase
    .from('quote_line_items')
    .insert({
      quote_id: params.id,
      category: category ?? null,
      description: description ?? '',
      qty: qtyVal,
      unit_price: priceVal,
      total,
      sort_order: sortVal,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Update quote totals
  void (async () => {
    try {
      const { data: items } = await supabase
        .from('quote_line_items')
        .select('total, category')
        .eq('quote_id', params.id)
      if (items) {
        const total_one_time = items
          .filter(i => i.category !== 'mrr')
          .reduce((s: number, i: { total: number }) => s + (i.total ?? 0), 0)
        const total_mrr = items
          .filter(i => i.category === 'mrr')
          .reduce((s: number, i: { total: number }) => s + (i.total ?? 0), 0)
        await supabase
          .from('quotes')
          .update({ total_one_time, total_mrr, updated_at: new Date().toISOString() })
          .eq('id', params.id)
      }
    } catch (_) { /* non-blocking */ }
  })()

  return NextResponse.json({ line_item: data }, { status: 201 })
}
