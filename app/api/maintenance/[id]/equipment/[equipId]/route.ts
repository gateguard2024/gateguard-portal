import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

// PATCH — update equipment (tech confirms serial/location, or management edits)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; equipId: string } }
) {
  const body = await req.json()

  // If confirming, stamp confirmed_at
  const patch: Record<string, unknown> = { ...body }
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
  return NextResponse.json({ item: data })
}

// DELETE — remove equipment item
export async function DELETE(
  _: NextRequest,
  { params }: { params: { id: string; equipId: string } }
) {
  const { error } = await supabase
    .from('wo_installed_equipment')
    .delete()
    .eq('id', params.equipId)
    .eq('work_order_id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
