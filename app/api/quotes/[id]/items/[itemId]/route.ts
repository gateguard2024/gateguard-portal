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

  const oneTime = (items ?? []).filter(i => !i.is_recurring).reduce((s, i) => s + i.qty * i.unit_price, 0)
  const mrr     = (items ?? []).filter(i =>  i.is_recurring).reduce((s, i) => s + i.qty * i.unit_price, 0)

  await supabase
    .from('quotes')
    .update({ total_one_time: oneTime, total_mrr: mrr, updated_at: new Date().toISOString() })
    .eq('id', quoteId)
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
