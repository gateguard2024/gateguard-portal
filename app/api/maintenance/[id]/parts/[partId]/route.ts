import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// DELETE /api/maintenance/[id]/parts/[partId]
// Deletes a part record and restores inventory stock if it was consumed
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; partId: string } }
) {
  // Fetch the part first so we can restore stock
  const { data: part, error: fetchErr } = await supabase
    .from('work_order_parts')
    .select('inventory_item_id, qty, action')
    .eq('id', params.partId)
    .eq('work_order_id', params.id)
    .single()

  if (fetchErr || !part) {
    return NextResponse.json({ error: 'Part not found' }, { status: 404 })
  }

  // Restore stock if this part consumed inventory
  if (part.inventory_item_id && (part.action === 'used' || part.action === 'installed')) {
    const { data: inv } = await supabase
      .from('inventory_items')
      .select('on_hand')
      .eq('id', part.inventory_item_id)
      .single()

    if (inv) {
      const { error: restoreErr } = await supabase
        .from('inventory_items')
        .update({
          on_hand:    inv.on_hand + part.qty,
          updated_at: new Date().toISOString(),
        })
        .eq('id', part.inventory_item_id)

      if (restoreErr) {
        // Log but don't block deletion
        console.error('[parts/[partId] DELETE] stock restore failed:', restoreErr.message)
      }
    }
  }

  const { error } = await supabase
    .from('work_order_parts')
    .delete()
    .eq('id', params.partId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
