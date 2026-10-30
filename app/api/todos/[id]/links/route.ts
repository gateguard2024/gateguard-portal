/**
 * Extra linked records and "blocked by" on a task (migration 194: todo_links, todo_dependencies).
 * POST   { kind: 'link', linked_type, linked_id, linked_label }  — link another record
 * POST   { kind: 'blocked_by', blocked_by_todo_id }               — mark blocked by another task
 * DELETE ?kind=link&link_id=… | ?kind=blocked_by&dep_id=…         — remove
 * The task's primary link stays on todos.linked_* (PATCH /api/todos/[id]); these are the extras.
 * Needs edit rights on the task.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { supabaseAdmin as supabase, loadTodoFor, logActivity, taskKey } from '@/lib/todo-activity'

export const dynamic = 'force-dynamic'

const LINK_TYPES = ['work_order', 'site', 'property', 'lead', 'opportunity', 'customer', 'dealer']

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const caller = await getCurrentUser()
    const found = await loadTodoFor(params.id, caller, 'edit')
    if ('error' in found) return NextResponse.json({ error: found.error }, { status: found.status })
    const body = await req.json()

    if (body.kind === 'link') {
      if (!LINK_TYPES.includes(body.linked_type) || !body.linked_id) {
        return NextResponse.json({ error: 'A valid linked_type and linked_id are required.' }, { status: 400 })
      }
      const { data, error } = await supabase.from('todo_links')
        .upsert({ todo_id: params.id, linked_type: body.linked_type, linked_id: body.linked_id, linked_label: body.linked_label ?? null },
          { onConflict: 'todo_id,linked_type,linked_id' })
        .select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      await logActivity(params.id, caller, [{ action: 'linked', field_name: 'link added', new_value: data.linked_label ?? data.linked_type }])
      return NextResponse.json({ link: data }, { status: 201 })
    }

    if (body.kind === 'blocked_by') {
      const otherId = body.blocked_by_todo_id
      if (!otherId || otherId === params.id) return NextResponse.json({ error: 'Pick a different task.' }, { status: 400 })
      const { data: other } = await supabase.from('todos').select('id, title, task_number').eq('id', otherId).maybeSingle()
      if (!other) return NextResponse.json({ error: 'That task was not found.' }, { status: 404 })
      // Refuse a direct loop (A blocked by B while B is blocked by A).
      const { data: loop } = await supabase.from('todo_dependencies').select('id').eq('todo_id', otherId).eq('blocked_by_todo_id', params.id).maybeSingle()
      if (loop) return NextResponse.json({ error: 'That task is already waiting on this one.' }, { status: 400 })
      const { data, error } = await supabase.from('todo_dependencies')
        .upsert({ todo_id: params.id, blocked_by_todo_id: otherId, created_by: caller.id }, { onConflict: 'todo_id,blocked_by_todo_id' })
        .select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      await logActivity(params.id, caller, [{ action: 'linked', field_name: 'blocked by', new_value: `${taskKey(other.task_number)} ${other.title}`.trim() }])
      return NextResponse.json({ dependency: { ...data, todos: other } }, { status: 201 })
    }

    return NextResponse.json({ error: "kind must be 'link' or 'blocked_by'" }, { status: 400 })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const caller = await getCurrentUser()
    const found = await loadTodoFor(params.id, caller, 'edit')
    if ('error' in found) return NextResponse.json({ error: found.error }, { status: found.status })
    const sp = new URL(req.url).searchParams
    const kind = sp.get('kind')

    if (kind === 'link') {
      const linkId = sp.get('link_id')
      if (!linkId) return NextResponse.json({ error: 'link_id is required' }, { status: 400 })
      const { data, error } = await supabase.from('todo_links').delete().eq('id', linkId).eq('todo_id', params.id).select('linked_label, linked_type').maybeSingle()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      if (data) await logActivity(params.id, caller, [{ action: 'linked', field_name: 'link removed', old_value: data.linked_label ?? data.linked_type }])
      return NextResponse.json({ ok: true })
    }

    if (kind === 'blocked_by') {
      const depId = sp.get('dep_id')
      if (!depId) return NextResponse.json({ error: 'dep_id is required' }, { status: 400 })
      const { error } = await supabase.from('todo_dependencies').delete().eq('id', depId).eq('todo_id', params.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      await logActivity(params.id, caller, [{ action: 'linked', field_name: 'blocked by removed' }])
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: "kind must be 'link' or 'blocked_by'" }, { status: 400 })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
