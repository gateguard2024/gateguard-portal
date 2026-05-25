import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

// GET /api/playbooks/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { data, error } = await supabase
      .from('playbook_runs')
      .select('*')
      .eq('id', params.id)
      .single()
    if (error) throw error
    return NextResponse.json({ run: data })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// PATCH /api/playbooks/[id] — update step_progress, status, phase, etc.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const {
      step_progress, status, phase, assignee,
      due_date, notes, name, project_name, project_repo,
    } = body

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (step_progress  !== undefined) patch.step_progress  = step_progress
    if (status         !== undefined) patch.status         = status
    if (phase          !== undefined) patch.phase          = phase
    if (assignee       !== undefined) patch.assignee       = assignee
    if (due_date       !== undefined) patch.due_date       = due_date
    if (notes          !== undefined) patch.notes          = notes
    if (name           !== undefined) patch.name           = name
    if (project_name   !== undefined) patch.project_name   = project_name
    if (project_repo   !== undefined) patch.project_repo   = project_repo

    // Auto-set completed_at when status → completed
    if (status === 'completed') patch.completed_at = new Date().toISOString()
    if (status === 'active')    patch.completed_at = null

    const { data, error } = await supabase
      .from('playbook_runs')
      .update(patch)
      .eq('id', params.id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ run: data })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// DELETE /api/playbooks/[id]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { error } = await supabase
      .from('playbook_runs')
      .delete()
      .eq('id', params.id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
