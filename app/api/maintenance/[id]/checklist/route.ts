import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST /api/maintenance/[id]/checklist — add a checklist item
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const { title, sort_order } = body

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Title required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('wo_checklist_items')
    .insert({ work_order_id: params.id, title: title.trim(), sort_order: sort_order ?? 0 })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item: data })
}

// PATCH /api/maintenance/[id]/checklist — toggle or update an item
export async function PATCH(req: NextRequest, _ctx: { params: { id: string } }) {
  const body = await req.json()
  const { item_id, completed, title } = body

  if (!item_id) return NextResponse.json({ error: 'item_id required' }, { status: 400 })

  const update: Record<string, unknown> = {}
  if (completed !== undefined) {
    update.completed    = completed
    update.completed_at = completed ? new Date().toISOString() : null
  }
  if (title !== undefined) update.title = title

  const { data, error } = await supabase
    .from('wo_checklist_items')
    .update(update)
    .eq('id', item_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item: data })
}

// DELETE /api/maintenance/[id]/checklist — delete an item
export async function DELETE(req: NextRequest, _ctx: { params: { id: string } }) {
  const body = await req.json()
  const { item_id } = body
  if (!item_id) return NextResponse.json({ error: 'item_id required' }, { status: 400 })

  const { error } = await supabase.from('wo_checklist_items').delete().eq('id', item_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
