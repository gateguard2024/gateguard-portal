/**
 * /api/stock/moves — stock history and changes (rules: lib/stock.ts).
 *
 * GET ?location_id=&product_id=&limit=   newest first, only the caller's companies
 *                                         (Gate Guard's own = corporate only).
 * POST {action, …}
 *   receive  {product_id, qty, to, unit_cost?, note?}       parts came in (not on a PO)
 *   transfer {product_id, qty, from, to, note?}             e.g. warehouse → a truck (same company)
 *   count    {product_id, location_id, counted}             sets the count; adds the difference
 *   set_min  {product_id, min_qty, org_id? (corporate)}     low-stock line
 *   link_legacy {inventory_item_id, product_id}             copy an old inventory line's counts in
 * Job parts move stock through /api/maintenance/[id]/parts; POs through /api/purchase-orders/[id].
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope } from '@/lib/org-scope'
import { stockReady, addMove, onHand, ownsPlace, ensureWarehouse, type Location } from '@/lib/stock'

export const dynamic = 'force-dynamic'
const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status })

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user.id || user.id === 'anonymous') return bad('Unauthorized', 401)
  if (!(await stockReady())) return NextResponse.json({ ready: false, moves: [] })
  const scope = await resolveOrgScope(user)
  if (!scope.all && !scope.ids.length) return NextResponse.json({ ready: true, moves: [] })
  const u = new URL(req.url)
  const limit = Math.min(500, Math.max(1, Number(u.searchParams.get('limit')) || 100))
  let q = db().from('stock_moves').select('id, org_id, product_id, kind, qty, from_location_id, to_location_id, unit_cost, work_order_id, po_id, note, created_by, created_at').order('created_at', { ascending: false }).limit(limit)
  if (!scope.all) q = q.in('org_id', scope.ids)
  const loc = u.searchParams.get('location_id'); if (loc) q = q.or(`from_location_id.eq.${loc.replace(/[^0-9a-f-]/gi, '')},to_location_id.eq.${loc.replace(/[^0-9a-f-]/gi, '')}`)
  const pid = u.searchParams.get('product_id'); if (pid) q = q.eq('product_id', pid)
  const { data, error } = await q
  if (error) return bad(error.message, 500)
  // Dealers see their own costs; Gate Guard's own rows never reach them (filtered above).
  return NextResponse.json({ ready: true, moves: data ?? [] })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user.id || user.id === 'anonymous') return bad('Unauthorized', 401)
  if (!(await stockReady())) return bad('Stock needs migration 236.', 409)
  let b: Record<string, unknown>
  try { b = await req.json() } catch { return bad('Invalid JSON') }
  const scope = await resolveOrgScope(user)
  const by = user.name ?? user.email ?? user.id
  const qty = Math.floor(Number(b.qty))
  const productId = String(b.product_id ?? '')

  const place = async (id: unknown): Promise<Location | null> => {
    if (!id) return null
    const { data } = await db().from('stock_locations').select('id, org_id, kind, name, technician_id, site_id, active').eq('id', String(id)).maybeSingle()
    const l = data as Location | null
    return l && ownsPlace(scope, l.org_id) ? l : null
  }
  const productOk = async () => {
    if (!productId) return false
    const { data } = await db().from('products').select('id, org_id').eq('id', productId).maybeSingle()
    const p = data as { org_id: string | null } | null
    return !!p && (p.org_id == null || ownsPlace(scope, p.org_id))
  }

  try {
    switch (b.action) {
      case 'receive': {
        const to = await place(b.to)
        if (!to) return bad('Pick where it went.')
        if (!(qty > 0)) return bad('How many?')
        if (!(await productOk())) return bad('Pick a product from the catalog.')
        const cost = b.unit_cost != null && b.unit_cost !== '' ? Number(b.unit_cost) : null
        await addMove({ org_id: to.org_id, product_id: productId, kind: 'receive', qty, to_location_id: to.id, unit_cost: cost != null && isFinite(cost) ? cost : null, note: typeof b.note === 'string' ? b.note.slice(0, 200) : null, created_by: by })
        return NextResponse.json({ ok: true, on_hand: await onHand(to.id, productId) })
      }
      case 'transfer': {
        const [from, to] = await Promise.all([place(b.from), place(b.to)])
        if (!from || !to) return bad('Pick both places.')
        if (from.id === to.id) return bad('Pick two different places.')
        if ((from.org_id ?? null) !== (to.org_id ?? null)) return bad('Both places must belong to the same company.')
        if (!(qty > 0)) return bad('How many?')
        if (!(await productOk())) return bad('Pick a product from the catalog.')
        await addMove({ org_id: from.org_id, product_id: productId, kind: 'transfer', qty, from_location_id: from.id, to_location_id: to.id, note: typeof b.note === 'string' ? b.note.slice(0, 200) : null, created_by: by })
        return NextResponse.json({ ok: true, from_on_hand: await onHand(from.id, productId), to_on_hand: await onHand(to.id, productId) })
      }
      case 'count': {
        const at = await place(b.location_id)
        if (!at) return bad('Pick the place you counted.')
        const counted = Math.floor(Number(b.counted))
        if (!(counted >= 0)) return bad('Enter what you counted (0 or more).')
        if (!(await productOk())) return bad('Pick a product from the catalog.')
        const now = await onHand(at.id, productId)
        const diff = counted - now
        if (diff !== 0) await addMove({ org_id: at.org_id, product_id: productId, kind: 'count', qty: Math.abs(diff), ...(diff > 0 ? { to_location_id: at.id } : { from_location_id: at.id }), note: `Counted ${counted} (was ${now})`, created_by: by })
        return NextResponse.json({ ok: true, was: now, on_hand: counted, changed: diff })
      }
      case 'set_min': {
        if (!(await productOk())) return bad('Pick a product from the catalog.')
        const orgId = scope.all ? ((b.org_id as string) || null) : scope.own_id
        if (!scope.all && !orgId) return bad('Your login isn’t linked to a company yet.', 403)
        const min = Math.max(0, Math.floor(Number(b.min_qty) || 0))
        let ex = db().from('stock_minimums').select('id').eq('product_id', productId)
        ex = orgId ? ex.eq('org_id', orgId) : ex.is('org_id', null)
        const { data: found } = await ex.limit(1)
        const res = found?.[0]
          ? await db().from('stock_minimums').update({ min_qty: min, updated_at: new Date().toISOString() }).eq('id', (found[0] as { id: string }).id)
          : await db().from('stock_minimums').insert({ org_id: orgId, product_id: productId, min_qty: min })
        if (res.error) return bad(res.error.message, 500)
        return NextResponse.json({ ok: true, min_qty: min })
      }
      case 'link_legacy': {
        const { data: it } = await db().from('inventory_items').select('id, org_id, on_hand, on_truck, unit_cost, min_stock').eq('id', String(b.inventory_item_id ?? '')).maybeSingle()
        const item = it as { id: string; org_id: string | null; on_hand: number; on_truck: number; unit_cost: number | null; min_stock: number | null } | null
        if (!item || !ownsPlace(scope, item.org_id)) return bad('Not found', 404)
        if (!(await productOk())) return bad('Pick a product from the catalog.')
        const { data: prior } = await db().from('stock_moves').select('id').eq('legacy_item_id', item.id).limit(1)
        if (prior?.length) return bad('That line was already copied in.', 409)
        const wh = await ensureWarehouse(item.org_id ?? null)
        const total = (Number(item.on_hand) || 0) + (Number(item.on_truck) || 0)
        if (total > 0) {
          const { error } = await db().from('stock_moves').insert({ org_id: item.org_id ?? null, product_id: productId, kind: 'opening', qty: total, to_location_id: wh.id, unit_cost: item.unit_cost ?? null, legacy_item_id: item.id, note: 'Copied from the old inventory list (linked by hand)', created_by: by })
          if (error) return bad(error.code === '23505' ? 'That line was already copied in.' : error.message, error.code === '23505' ? 409 : 500)
        }
        return NextResponse.json({ ok: true, copied: total, to: wh.name })
      }
      default: return bad('Unknown action')
    }
  } catch (e) {
    return bad(e instanceof Error ? e.message : 'That didn’t save', 500)
  }
}
