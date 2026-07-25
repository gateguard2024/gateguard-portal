import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { guardWorkOrder } from '@/lib/ops-scope'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST /api/maintenance/[id]/checklist — add a checklist item
//
// `phase_id` groups the step under a work-order phase (Wiring, Trim, Headend,
// Program) — that's what turns a flat list into:
//   Headend            <- the phase
//     · Clean wiring — detail   <- title + notes
// Omit it and the step is ungrouped, exactly as before (migration 150).
//
// NOTE: `category` is NOT the group — it's a CHECK-constrained enum
// ('task','safety','inspection','verification') used for a badge. Don't put
// "Headend" in it; Postgres will reject the row.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await guardWorkOrder(req, params.id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const body = await req.json()
  const { title, sort_order, category, added_by, notes, phase_id } = body

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Title required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('wo_checklist_items')
    .insert({
      work_order_id: params.id,
      title:     title.trim(),
      sort_order: sort_order ?? 0,
      category:  category  || 'task',
      added_by:  added_by  || 'management',
      notes:     notes?.trim() || null,
      phase_id:  phase_id  || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item: data })
}

// PATCH /api/maintenance/[id]/checklist — toggle, set outcome, or update an item
export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  const { params } = ctx
  if (!(await guardWorkOrder(req, params.id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const body = await req.json()
  const { item_id, title, outcome, notes, completed_by_name, sort_order, phase_id } = body
  // Accept either `completed` or `is_complete` from clients.
  const completed = body.completed !== undefined ? body.completed : body.is_complete

  if (!item_id) return NextResponse.json({ error: 'item_id required' }, { status: 400 })

  const update: Record<string, unknown> = {}
  if (completed !== undefined) {
    update.completed    = completed
    update.completed_at = completed ? new Date().toISOString() : null
  }
  if (title              !== undefined) update.title              = title
  if (outcome            !== undefined) update.outcome            = outcome
  if (notes              !== undefined) update.notes              = notes
  if (completed_by_name  !== undefined) update.completed_by_name = completed_by_name
  if (sort_order         !== undefined) update.sort_order         = sort_order
  // Move a step into (or out of) a phase. null = ungrouped.
  if (phase_id           !== undefined) update.phase_id           = phase_id || null

  const { data, error } = await supabase
    .from('wo_checklist_items')
    .update(update)
    .eq('id', item_id)
    .eq('work_order_id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item: data })
}

// DELETE /api/maintenance/[id]/checklist — delete an item
export async function DELETE(req: NextRequest, ctx: { params: { id: string } }) {
  const { params } = ctx
  if (!(await guardWorkOrder(req, params.id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const body = await req.json()
  const { item_id } = body
  if (!item_id) return NextResponse.json({ error: 'item_id required' }, { status: 400 })

  const { error } = await supabase.from('wo_checklist_items').delete().eq('id', item_id).eq('work_order_id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
