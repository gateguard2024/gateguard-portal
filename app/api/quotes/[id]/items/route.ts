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
    .select('qty, unit_price, is_recurring')
    .eq('quote_id', quoteId)

  if (!items) return

  const oneTime = items.filter(i => !i.is_recurring).reduce((s, i) => s + (i.qty * i.unit_price), 0)
  const mrr     = items.filter(i =>  i.is_recurring).reduce((s, i) => s + (i.qty * i.unit_price), 0)

  await supabase
    .from('quotes')
    .update({ total_one_time: oneTime, total_mrr: mrr, updated_at: new Date().toISOString() })
    .eq('id', quoteId)
}

// GET /api/quotes/[id]/items — list all line items for this quote
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { data, error } = await supabase
    .from('quote_line_items')
    .select(`
      id, sort_order, category, description, qty, unit_price, is_recurring, created_at,
      section_name, product_id, item_type, unit, is_optional, is_included,
      package_tier, image_url, model_number, notes, sku
    `)
    .eq('quote_id', params.id)
    .order('sort_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data ?? [] })
}

// POST /api/quotes/[id]/items — add a line item, recalculate quote totals
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user  = await getCurrentUser()
  const scope = await resolveOrgScope(user)
  const body  = await req.json()

  // Verify ownership
  const { data: quote } = await supabase
    .from('quotes')
    .select('id, org_id')
    .eq('id', params.id)
    .single()

  if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
  if (!scope.all && !scope.ids.includes(quote.org_id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Find current max sort_order
  const { data: maxRow } = await supabase
    .from('quote_line_items')
    .select('sort_order')
    .eq('quote_id', params.id)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single()

  const sort_order = maxRow ? (maxRow.sort_order + 1) : 0

  const { data: item, error } = await supabase
    .from('quote_line_items')
    .insert({
      quote_id:     params.id,
      sort_order,
      category:     body.category     ?? 'General',
      description:  body.description  ?? '',
      qty:          body.qty          ?? 1,
      unit_price:   body.unit_price   ?? 0,
      unit:         body.unit         ?? 'each',
      is_recurring: body.is_recurring ?? false,
      section_name: body.section_name ?? 'Equipment',
      product_id:   body.product_id   ?? null,
      item_type:    body.item_type    ?? 'equipment',
      is_optional:  body.is_optional  ?? false,
      is_included:  body.is_included  ?? true,
      package_tier: body.package_tier ?? null,
      image_url:    body.image_url    ?? null,
      model_number: body.model_number ?? null,
      notes:        body.notes        ?? null,
      sku:          body.sku          ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Recalculate parent quote totals
  await recalcTotals(params.id)

  return NextResponse.json({ item }, { status: 201 })
}
