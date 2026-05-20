import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope } from '@/lib/org-scope'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

async function recalcTotals(quoteId: string) {
  const { data: items } = await supabase
    .from('quote_line_items')
    .select('qty, unit_price, is_recurring, line_discount_percent')
    .eq('quote_id', quoteId)

  const eff = (i: { qty: number; unit_price: number; line_discount_percent?: number }) =>
    i.qty * i.unit_price * (1 - (i.line_discount_percent ?? 0) / 100)

  const oneTime = (items ?? []).filter(i => !i.is_recurring).reduce((s, i) => s + eff(i), 0)
  const mrr     = (items ?? []).filter(i =>  i.is_recurring).reduce((s, i) => s + eff(i), 0)

  await supabase
    .from('quotes')
    .update({ total_one_time: oneTime, total_mrr: mrr, updated_at: new Date().toISOString() })
    .eq('id', quoteId)
}

// PATCH /api/quotes/[id]/items/[itemId] — update line item fields
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  const user  = await getCurrentUser()
  const scope = await resolveOrgScope(user)
  const body  = await req.json()

  const { data: quote } = await supabase
    .from('quotes')
    .select('id, org_id')
    .eq('id', params.id)
    .single()

  if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
  if (!scope.all && !scope.ids.includes(quote.org_id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const allowedFields = [
    'sort_order', 'category', 'description', 'qty', 'unit_price', 'unit',
    'is_recurring', 'section_name', 'product_id', 'item_type',
    'is_optional', 'is_included', 'package_tier',
    'image_url', 'model_number', 'notes', 'sku',
    'line_discount_percent',
  ]

  const updates: Record<string, unknown> = {}
  for (const key of allowedFields) {
    if (key in body) updates[key] = body[key]
  }

  const { data: item, error } = await supabase
    .from('quote_line_items')
    .update(updates)
    .eq('id', params.itemId)
    .eq('quote_id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Recalc totals if pricing fields changed
  if ('qty' in body || 'unit_price' in body || 'is_recurring' in body || 'line_discount_percent' in body) {
    await recalcTotals(params.id)
  }

  return NextResponse.json({ item })
}

// DELETE /api/quotes/[id]/items/[itemId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  const user  = await getCurrentUser()
  const scope = await resolveOrgScope(user)

  // Verify ownership via parent quote
  const { data: quote } = await supabase
    .from('quotes')
    .select('id, org_id')
    .eq('id', params.id)
    .single()

  if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
  if (!scope.all && !scope.ids.includes(quote.org_id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await supabase
    .from('quote_line_items')
    .delete()
    .eq('id', params.itemId)
    .eq('quote_id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await recalcTotals(params.id)

  return NextResponse.json({ ok: true })
}
