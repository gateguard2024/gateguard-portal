/**
 * PATCH /api/purchase-orders/[id] — update a PO's status (draft → ordered → received)
 * or other top-level fields. Used by the Operations Hub Procurement tab.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth }         from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

function serviceDb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}
export const dynamic = 'force-dynamic'

const ALLOWED_STATUS = ['draft', 'ordered', 'received', 'cancelled', 'closed']

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.status === 'string' && ALLOWED_STATUS.includes(body.status)) patch.status = body.status
  if ('supplier' in body)    patch.supplier = body.supplier
  if ('po_number' in body)   patch.po_number = body.po_number
  if ('notes' in body)       patch.notes = body.notes
  if ('expected_at' in body) patch.expected_at = body.expected_at

  // Drift-resilient (updated_at may not exist on some PO schemas)
  let attempt = { ...patch }
  for (let i = 0; i < 3; i++) {
    const { data, error } = await serviceDb().from('purchase_orders').update(attempt).eq('id', params.id).select('*, purchase_order_items(*)').single()
    if (!error) return NextResponse.json({ record: data })
    const m = /Could not find the '(\w+)' column|column "?(\w+)"? .* does not exist/.exec(error.message)
    const bad = m?.[1] || m?.[2]
    if ((error.code === 'PGRST204' || error.code === '42703') && bad && bad in attempt) { delete (attempt as Record<string, unknown>)[bad]; continue }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ error: 'Could not update' }, { status: 500 })
}
