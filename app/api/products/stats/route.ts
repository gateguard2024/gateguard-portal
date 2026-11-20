/**
 * GET /api/products/stats — per-product stock for the Catalog list.
 *   { stock: { [product_id]: { onHand, onTruck, onSite, min, locations } } }
 * After migration 236: from stock_levels (moves in − out). Gate Guard sees its own
 * stock (warehouse + trucks); a dealer sees their companies'. onHand = warehouse +
 * trucks (what we can grab); onSite = spares on property shelves; min = the low-stock
 * line. Before 236: the old inventory_items numbers. (Manuals come from /api/kb/coverage.)
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { isSignedIn } from '@/lib/assistant-executor'
import { applyOrgScope, resolveOrgScope } from '@/lib/org-scope'
import { stockReady, levels } from '@/lib/stock'

export const dynamic = 'force-dynamic'
type S = { onHand: number; onTruck: number; onSite: number; min: number; locations: number }

export async function GET() {
  const user = await getCurrentUser()
  if (!isSignedIn(user)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const scope = await resolveOrgScope(user)
  if (!scope.all && !scope.ids.length) return NextResponse.json({ stock: {} })
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const stock: Record<string, S> = {}
  const get = (id: string) => (stock[id] ??= { onHand: 0, onTruck: 0, onSite: 0, min: 0, locations: 0 })

  if (await stockReady()) {
    try {
      let lq = db.from('stock_locations').select('id, kind').eq('active', true).limit(5000)
      lq = scope.all ? lq.is('org_id', null) : lq.in('org_id', scope.ids)
      const { data: locs, error } = await lq
      if (error) throw new Error(error.message)
      const kind = new Map(((locs ?? []) as { id: string; kind: string }[]).map((l) => [l.id, l.kind]))
      const lv = kind.size ? await levels({ orgIds: scope.all ? 'gg' : scope.ids, locationIds: Array.from(kind.keys()) }) : []
      for (const l of lv) {
        if (!l.qty) continue
        const s = get(l.product_id), k = kind.get(l.location_id)
        if (k === 'site') s.onSite += l.qty
        else { s.onHand += l.qty; if (k === 'truck') s.onTruck += l.qty }
        s.locations++
      }
      let mq = db.from('stock_minimums').select('product_id, min_qty').limit(10000)
      mq = scope.all ? mq.is('org_id', null) : mq.in('org_id', scope.ids)
      const { data: mins } = await mq
      for (const m of (mins ?? []) as { product_id: string; min_qty: number }[]) get(m.product_id).min += Number(m.min_qty) || 0
      return NextResponse.json({ stock, source: 'stock' })
    } catch (e) {
      return NextResponse.json({ stock: {}, note: e instanceof Error ? e.message : 'stock error' })
    }
  }

  let q = db.from('inventory_items').select('product_id, on_hand, on_truck, min_stock, is_active').not('product_id', 'is', null).limit(10000)
  if (!scope.all) q = applyOrgScope(q, scope, 'org_id')
  const { data, error } = await q
  // Older databases may not have the inventory table yet — the list still works without stock.
  if (error) return NextResponse.json({ stock: {}, note: error.message })
  for (const r of (data ?? []) as { product_id: string; on_hand: number | null; on_truck: number | null; min_stock: number | null; is_active: boolean | null }[]) {
    if (r.is_active === false) continue
    const s = get(r.product_id)
    s.onHand += Number(r.on_hand) || 0; s.onTruck += Number(r.on_truck) || 0; s.min += Number(r.min_stock) || 0; s.locations++
  }
  return NextResponse.json({ stock, source: 'inventory' })
}
