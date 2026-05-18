/**
 * PATCH  /api/todos/[id]  — update a todo (status, priority, title, due_date, assigned_to)
 * DELETE /api/todos/[id]  — delete a todo
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const caller = await getCurrentUser()
    const body   = await req.json()

    // Only creator or assignee can modify
    const { data: existing } = await supabase
      .from('todos')
      .select('created_by, assigned_to')
      .eq('id', params.id)
      .single()

    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (existing.created_by !== caller.id && existing.assigned_to !== caller.id && !caller.isCorporate) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.title         !== undefined) updates.title         = body.title
    if (body.body          !== undefined) updates.body          = body.body
    if (body.priority      !== undefined) updates.priority      = body.priority
    if (body.status        !== undefined) {
      updates.status       = body.status
      updates.completed_at = body.status === 'done' ? new Date().toISOString() : null
    }
    if (body.due_date      !== undefined) updates.due_date      = body.due_date
    if (body.assigned_to   !== undefined) updates.assigned_to   = body.assigned_to
    if (body.assigned_to_name !== undefined) updates.assigned_to_name = body.assigned_to_name

    const { data, error } = await supabase
      .from('todos')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const caller = await getCurrentUser()

    const { data: existing } = await supabase
      .from('todos')
      .select('created_by')
      .eq('id', params.id)
      .single()

    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (existing.created_by !== caller.id && !caller.isCorporate) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error } = await supabase.from('todos').delete().eq('id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
