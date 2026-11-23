/**
 * PATCH /api/purchase-orders/[id] — update a PO's status (draft → ordered → received)
 * or other top-level fields. Used by the Operations Hub Procurement tab.
 * Marking it received (migration 236) puts what's still outstanding into stock:
 * lines tagged to a property go on that property's spare shelf, the rest into
 * `location_id` (optional) or the company warehouse.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth }         from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { recordInScope, guardSite } from '@/lib/ops-scope'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope } from '@/lib/org-scope'
import { stockReady, receivePO, ownsPlace } from '@/lib/stock'

function serviceDb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}
export const dynamic = 'force-dynamic'

const ALLOWED_STATUS = ['draft', 'ordered', 'received', 'cancelled', 'closed']

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await recordInScope('purchase_orders', params.id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  // Tag (or untag) ONE line as bought for a property's service plan (migration 236):
  // { tag_line: { item_id, site_id | null } }. Only before the PO is received — receiving
  // is what puts tagged lines on that property's spare shelf.
  if (body.tag_line && typeof body.tag_line === 'object') {
    const t = body.tag_line as { item_id?: unknown; site_id?: unknown }
    const itemId = typeof t.item_id === 'string' ? t.item_id : ''
    const siteId = typeof t.site_id === 'string' && t.site_id ? t.site_id : null
    const db = serviceDb()
    const [{ data: po }, { data: item }] = await Promise.all([
      db.from('purchase_orders').select('status').eq('id', params.id).maybeSingle(),
      db.from('purchase_order_items').select('id').eq('id', itemId).eq('po_id', params.id).maybeSingle(),
    ])
    if (!item) return NextResponse.json({ error: 'That line isn’t on this PO.' }, { status: 404 })
    if (['received', 'closed', 'cancelled'].includes(String((po as { status?: string } | null)?.status ?? ''))) {
      return NextResponse.json({ error: 'This PO is already received or closed — tag lines before receiving.' }, { status: 400 })
    }
    if (siteId) {
      const { data: site } = await db.from('sites').select('id').eq('id', siteId).maybeSingle()
      if (!site || !(await guardSite(req, siteId))) return NextResponse.json({ error: 'Pick a property you work on.' }, { status: 400 })
    }
    const { error: tErr } = await db.from('purchase_order_items').update({ site_id: siteId }).eq('id', itemId)
    if (tErr) return NextResponse.json({ error: /site_id/.test(tErr.message) ? 'Needs migration 236.' : tErr.message }, { status: 500 })
    const { data: rec, error: rErr } = await db.from('purchase_orders').select('*, purchase_order_items(*)').eq('id', params.id).single()
    if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 })
    return NextResponse.json({ record: rec })
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.status === 'string' && ALLOWED_STATUS.includes(body.status)) patch.status = body.status
  if ('supplier' in body)    patch.supplier = body.supplier
  if ('po_number' in body)   patch.po_number = body.po_number
  if ('notes' in body)       patch.notes = body.notes
  if ('expected_at' in body) patch.expected_at = body.expected_at
  const caller = await getCurrentUser()
  if (caller.isCorporate && body.org_id) patch.org_id = body.org_id   // corporate transfer

  // Receiving → stock. Check the place first so a bad pick changes nothing.
  const { data: before } = await serviceDb().from('purchase_orders').select('status, org_id').eq('id', params.id).maybeSingle()
  const prev = before as { status?: string | null; org_id?: string | null } | null
  const receiving = patch.status === 'received' && prev?.status !== 'received' && await stockReady()
  let receiveAt: string | null = null
  if (receiving && body.location_id) {
    const scope = await resolveOrgScope(caller)
    const { data: loc } = await serviceDb().from('stock_locations').select('id, org_id').eq('id', String(body.location_id)).maybeSingle()
    const l = loc as { id: string; org_id: string | null } | null
    if (!l || !ownsPlace(scope, l.org_id) || (l.org_id ?? null) !== (prev?.org_id ?? null)) return NextResponse.json({ error: 'Pick a place that belongs to the same company as this PO.' }, { status: 400 })
    receiveAt = l.id
  }

  // Drift-resilient (updated_at may not exist on some PO schemas)
  let attempt = { ...patch }
  for (let i = 0; i < 3; i++) {
    const { data, error } = await serviceDb().from('purchase_orders').update(attempt).eq('id', params.id).select('*, purchase_order_items(*)').single()
    if (!error) {
      if (!receiving) return NextResponse.json({ record: data })
      try {
        const r = await receivePO(params.id, { locationId: receiveAt, by: caller.name ?? caller.email ?? null })
        return NextResponse.json({ record: data, received: r })
      } catch (e) {
        return NextResponse.json({ record: data, warning: `Marked received, but stock didn’t update: ${e instanceof Error ? e.message : 'error'}` })
      }
    }
    const m = /Could not find the '(\w+)' column|column "?(\w+)"? .* does not exist/.exec(error.message)
    const bad = m?.[1] || m?.[2]
    if ((error.code === 'PGRST204' || error.code === '42703') && bad && bad in attempt) { delete (attempt as Record<string, unknown>)[bad]; continue }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ error: 'Could not update' }, { status: 500 })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await recordInScope('purchase_orders', params.id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { error } = await serviceDb().from('purchase_orders').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
