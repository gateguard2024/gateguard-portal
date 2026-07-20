/**
 * GET   /api/admin/product-costs        — CORPORATE ONLY. { costs: { [product_id]: gg_cost } }
 * PATCH /api/admin/product-costs         — CORPORATE ONLY. Set one product's GG cost.
 *
 * The single home for Gate Guard's per-part COGS (product_costs table, server
 * only). PATCH upserts gg_cost AND derives the locked dealer cost (gg_cost + 10%)
 * onto products.dealer_cost. Dealers never receive gg_cost — the product page
 * reads it only for corporate, through this route.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
export const dynamic = 'force-dynamic'

// Dealer cost = our cost + 10%, locked (the waterfall). Change here to change it everywhere.
export const DEALER_MARKUP = 0.10
const round2 = (n: number) => Math.round(n * 100) / 100

export async function GET() {
  const me = await getCurrentUser()
  if (!me.isCorporate) return NextResponse.json({ error: 'Forbidden — corporate only' }, { status: 403 })

  const { data, error } = await db().from('product_costs').select('product_id, gg_cost')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const costs: Record<string, number> = {}
  for (const r of data ?? []) if (r.gg_cost != null) costs[r.product_id as string] = Number(r.gg_cost)
  return NextResponse.json({ costs })
}

export async function PATCH(req: NextRequest) {
  const me = await getCurrentUser()
  if (!me.isCorporate) return NextResponse.json({ error: 'Forbidden — corporate only' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const product_id = String(body.product_id ?? '')
  if (!product_id) return NextResponse.json({ error: 'product_id required' }, { status: 400 })

  const raw = body.gg_cost
  const gg_cost = (raw === null || raw === '' || raw === undefined) ? null : Number(raw)
  if (gg_cost !== null && (!isFinite(gg_cost) || gg_cost < 0)) {
    return NextResponse.json({ error: 'gg_cost must be a non-negative number' }, { status: 400 })
  }

  const sb = db()
  const { error: upErr } = await sb.from('product_costs')
    .upsert({ product_id, gg_cost, updated_at: new Date().toISOString() }, { onConflict: 'product_id' })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  // Derive and write the locked dealer cost onto products (dealers may see it).
  const dealer_cost = gg_cost === null ? null : round2(gg_cost * (1 + DEALER_MARKUP))
  if (dealer_cost !== null) {
    const { error: pErr } = await sb.from('products').update({ dealer_cost }).eq('id', product_id)
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, gg_cost, dealer_cost })
}
