import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { guardWorkOrder } from '@/lib/ops-scope'
import { unitFromEquipment } from '@/lib/assets'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

// Only these fields can be changed (the job and the unit link are not editable here).
const EDITABLE = ['name', 'make', 'model', 'sku', 'serial_number', 'location', 'qty', 'condition', 'notes', 'confirmed', 'confirmed_by', 'confirmed_at', 'sort_order', 'product_id']

// PATCH — update equipment (tech confirms serial/location, or management edits).
// Confirming makes (or links) the unit at the property — lib/assets.ts, migration 237.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; equipId: string } }
) {
  if (!(await guardWorkOrder(req, params.id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const patch: Record<string, unknown> = {}
  for (const k of EDITABLE) if (k in body) patch[k] = body[k]
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to change' }, { status: 400 })
  // If confirming, stamp confirmed_at
  if (body.confirmed === true && !body.confirmed_at) {
    patch.confirmed_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('wo_installed_equipment')
    .update(patch)
    .eq('id', params.equipId)
    .eq('work_order_id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let unit_id: string | null = null, warning: string | null = null
  const item = (Array.isArray(data) ? data[0] : data) as (Parameters<typeof unitFromEquipment>[0] & { confirmed?: boolean }) | null
  if (item?.confirmed) {
    try { unit_id = await unitFromEquipment(item) } catch (e) { warning = `Saved, but the unit wasn’t added to the property: ${e instanceof Error ? e.message : 'error'}` }
  }
  return NextResponse.json({ item: data, unit_id, warning })
}

// DELETE — remove equipment item
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; equipId: string } }
) {
  if (!(await guardWorkOrder(req, params.id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { error } = await supabase
    .from('wo_installed_equipment')
    .delete()
    .eq('id', params.equipId)
    .eq('work_order_id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
