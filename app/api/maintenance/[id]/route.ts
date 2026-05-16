import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/maintenance/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { data, error } = await supabase
    .from('work_orders')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ work_order: data })
}

// PATCH /api/maintenance/[id] — update fields
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()

  // If marking complete, set completed_at
  if (body.status === 'completed' && !body.completed_at) {
    body.completed_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('work_orders')
    .update(body)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data)  return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // If assignee changed, update technician's current_job_id
  if (body.assignee_id !== undefined) {
    // Clear previous tech's current job if they had this WO
    await supabase
      .from('technicians')
      .update({ current_job_id: null })
      .eq('current_job_id', params.id)
      .neq('id', body.assignee_id || '00000000-0000-0000-0000-000000000000')

    if (body.assignee_id) {
      await supabase
        .from('technicians')
        .update({ current_job_id: params.id })
        .eq('id', body.assignee_id)
    }
  }

  return NextResponse.json({ work_order: data })
}

// DELETE /api/maintenance/[id]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  // Clear any tech references first
  await supabase
    .from('technicians')
    .update({ current_job_id: null })
    .eq('current_job_id', params.id)

  const { error } = await supabase
    .from('work_orders')
    .delete()
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
