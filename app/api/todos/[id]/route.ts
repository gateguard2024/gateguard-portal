/**
 * PATCH  /api/todos/[id]  — update todo; auto-spawns next recurrence when marked done
 * DELETE /api/todos/[id]  — delete todo + attachments
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

// ── Recurrence helper ─────────────────────────────────────────────────────────
function nextDueDate(
  currentDue: string | null,
  type: string,
  interval: number
): string | null {
  if (!currentDue || type === 'none') return null
  const d = new Date(currentDue + 'T00:00:00')
  switch (type) {
    case 'daily':   d.setDate(d.getDate()     + interval); break
    case 'weekly':  d.setDate(d.getDate()     + interval * 7); break
    case 'monthly': d.setMonth(d.getMonth()   + interval); break
    case 'yearly':  d.setFullYear(d.getFullYear() + interval); break
  }
  return d.toISOString().slice(0, 10)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const caller = await getCurrentUser()
    const body   = await req.json()

    const { data: existing } = await supabase
      .from('todos')
      .select('*')
      .eq('id', params.id)
      .single()

    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (existing.created_by !== caller.id && existing.assigned_to !== caller.id && !caller.isCorporate) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.title              !== undefined) updates.title              = body.title
    if (body.body               !== undefined) updates.body               = body.body
    if (body.priority           !== undefined) updates.priority           = body.priority
    if (body.due_date           !== undefined) updates.due_date           = body.due_date
    if (body.assigned_to        !== undefined) updates.assigned_to        = body.assigned_to
    if (body.assigned_to_name   !== undefined) updates.assigned_to_name   = body.assigned_to_name
    if (body.linked_type        !== undefined) updates.linked_type        = body.linked_type
    if (body.linked_id          !== undefined) updates.linked_id          = body.linked_id
    if (body.linked_label       !== undefined) updates.linked_label       = body.linked_label
    if (body.recurrence_type    !== undefined) updates.recurrence_type    = body.recurrence_type
    if (body.recurrence_interval !== undefined) updates.recurrence_interval = body.recurrence_interval
    if (body.recurrence_ends_at !== undefined) updates.recurrence_ends_at = body.recurrence_ends_at

    let spawnedNext = null

    if (body.status !== undefined) {
      updates.status       = body.status
      updates.completed_at = body.status === 'done' ? new Date().toISOString() : null

      // Auto-spawn next recurring instance when marked done
      if (body.status === 'done' && existing.recurrence_type && existing.recurrence_type !== 'none') {
        const next = nextDueDate(
          existing.due_date,
          existing.recurrence_type,
          existing.recurrence_interval ?? 1
        )
        // Only spawn if within recurrence_ends_at window (or no end date)
        const withinWindow =
          !existing.recurrence_ends_at ||
          !next ||
          next <= existing.recurrence_ends_at

        if (next && withinWindow) {
          const { data: spawned } = await supabase
            .from('todos')
            .insert({
              title:               existing.title,
              body:                existing.body,
              priority:            existing.priority,
              status:              'open',
              due_date:            next,
              org_id:              existing.org_id,
              created_by:          existing.created_by,
              created_by_name:     existing.created_by_name,
              assigned_to:         existing.assigned_to,
              assigned_to_name:    existing.assigned_to_name,
              linked_type:         existing.linked_type,
              linked_id:           existing.linked_id,
              linked_label:        existing.linked_label,
              recurrence_type:     existing.recurrence_type,
              recurrence_interval: existing.recurrence_interval,
              recurrence_ends_at:  existing.recurrence_ends_at,
              parent_todo_id:      existing.parent_todo_id ?? existing.id,
            })
            .select()
            .single()
          spawnedNext = spawned
        }
      }
    }

    const { data, error } = await supabase
      .from('todos')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ todo: data, spawned: spawnedNext })
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

    // Attachments cascade-delete via FK, but clean up Storage paths too
    const { data: attachments } = await supabase
      .from('todo_attachments')
      .select('storage_path')
      .eq('todo_id', params.id)

    if (attachments && attachments.length > 0) {
      const paths = attachments.map(a => a.storage_path).filter(Boolean) as string[]
      if (paths.length > 0) {
        await supabase.storage.from('todo-attachments').remove(paths)
      }
    }

    const { error } = await supabase.from('todos').delete().eq('id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
