import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST /api/maintenance/[id]/parts — add a part used on this WO
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const { part_name, part_number, quantity, unit_cost, part_id } = body

  if (!part_name?.trim()) {
    return NextResponse.json({ error: 'part_name required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('wo_parts_used')
    .insert({
      work_order_id: params.id,
      part_id:       part_id    ?? null,
      part_name:     part_name.trim(),
      part_number:   part_number ?? null,
      quantity:      quantity    ?? 1,
      unit_cost:     unit_cost   ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Decrement inventory if part_id provided (graceful — rpc may not exist yet)
  if (part_id && quantity) {
    try {
      await supabase.rpc('decrement_part_qty', { p_id: part_id, qty: quantity })
    } catch (_) {
      // skip if rpc not deployed
    }
  }

  return NextResponse.json({ part: data })
}

// DELETE /api/maintenance/[id]/parts — remove a part record
export async function DELETE(req: NextRequest, _ctx: { params: { id: string } }) {
  const body = await req.json()
  const { part_used_id } = body
  if (!part_used_id) return NextResponse.json({ error: 'part_used_id required' }, { status: 400 })

  const { error } = await supabase.from('wo_parts_used').delete().eq('id', part_used_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
