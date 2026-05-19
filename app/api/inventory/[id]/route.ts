import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function computeStatus(on_hand: number, min_stock: number): string {
  if (on_hand === 0) return 'out'
  if (on_hand <= min_stock) return 'low'
  return 'ok'
}

// GET /api/inventory/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ ...data, status: computeStatus(data.on_hand, data.min_stock) })
}

// PATCH /api/inventory/[id]
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()

  const { data, error } = await supabase
    .from('inventory_items')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data)  return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ ...data, status: computeStatus(data.on_hand, data.min_stock) })
}

// DELETE /api/inventory/[id] — soft delete (is_active = false)
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await supabase
    .from('inventory_items')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
