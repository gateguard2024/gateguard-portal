/**
 * GET /api/products/stats — per-product stock for the Catalog list.
 *   { stock: { [product_id]: { onHand, onTruck, min, locations } } }
 * From inventory_items linked to a catalog product, limited to the caller's
 * companies. (Manual coverage comes from /api/kb/coverage.)
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { isSignedIn } from '@/lib/assistant-executor'
import { applyOrgScope, resolveOrgScope } from '@/lib/org-scope'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getCurrentUser()
  if (!isSignedIn(user)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const scope = await resolveOrgScope(user)
  if (!scope.all && !scope.ids.length) return NextResponse.json({ stock: {} })
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  let q = db.from('inventory_items').select('product_id, on_hand, on_truck, min_stock, is_active').not('product_id', 'is', null).limit(10000)
  if (!scope.all) q = applyOrgScope(q, scope, 'org_id')
  const { data, error } = await q
  // Older databases may not have the inventory table yet — the list still works without stock.
  if (error) return NextResponse.json({ stock: {}, note: error.message })
  const stock: Record<string, { onHand: number; onTruck: number; min: number; locations: number }> = {}
  for (const r of (data ?? []) as { product_id: string; on_hand: number | null; on_truck: number | null; min_stock: number | null; is_active: boolean | null }[]) {
    if (r.is_active === false) continue
    const s = (stock[r.product_id] ??= { onHand: 0, onTruck: 0, min: 0, locations: 0 })
    s.onHand += Number(r.on_hand) || 0; s.onTruck += Number(r.on_truck) || 0; s.min += Number(r.min_stock) || 0; s.locations++
  }
  return NextResponse.json({ stock })
}
