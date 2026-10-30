/**
 * Checklist items on a task (migration 194: todo_checklist_items).
 * POST   { title }                         — add an item (goes to the end)
 * PATCH  { item_id, title?, done? }        — rename / tick an item
 * PATCH  { order: [item_id, ...] }         — reorder (drag)
 * DELETE ?item_id=…                        — remove an item
 * Needs edit rights on the task.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { supabaseAdmin as supabase, loadTodoFor, logActivity } from '@/lib/todo-activity'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const caller = await getCurrentUser()
    const found = await loadTodoFor(params.id, caller, 'edit')
    if ('error' in found) return NextResponse.json({ error: found.error }, { status: found.status })
    const { title } = await req.json()
    if (!title?.trim()) return NextResponse.json({ error: 'title is required' }, { status: 400 })

    const { data: last } = await supabase.from('todo_checklist_items').select('sort_order')
      .eq('todo_id', params.id).order('sort_order', { ascending: false }).limit(1).maybeSingle()
    const { data, error } = await supabase.from('todo_checklist_items')
      .insert({ todo_id: params.id, title: title.trim(), sort_order: (last?.sort_order ?? -1) + 1 })
      .select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await logActivity(params.id, caller, [{ action: 'checklist', field_name: 'checklist item added', new_value: data.title }])
    return NextResponse.json({ item: data }, { status: 201 })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const caller = await getCurrentUser()
    const found = await loadTodoFor(params.id, caller, 'edit')
    if ('error' in found) return NextResponse.json({ error: found.error }, { status: found.status })
    const body = await req.json()

    if (Array.isArray(body.order)) {
      const results = await Promise.all((body.order as string[]).map((itemId, i) =>
        supabase.from('todo_checklist_items').update({ sort_order: i }).eq('id', itemId).eq('todo_id', params.id)))
      const failed = results.find(r => r.error)
      if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    if (!body.item_id) return NextResponse.json({ error: 'item_id is required' }, { status: 400 })
    const updates: Record<string, unknown> = {}
    if (typeof body.title === 'string' && body.title.trim()) updates.title = body.title.trim()
    if (typeof body.done === 'boolean') {
      updates.done = body.done
      updates.done_at = body.done ? new Date().toISOString() : null
      updates.done_by = body.done ? caller.id : null
    }
    const { data, error } = await supabase.from('todo_checklist_items').update(updates)
      .eq('id', body.item_id).eq('todo_id', params.id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (typeof body.done === 'boolean') {
      await logActivity(params.id, caller, [{ action: 'checklist', field_name: body.done ? 'checked off' : 'unchecked', new_value: data.title }])
    }
    return NextResponse.json({ item: data })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const caller = await getCurrentUser()
    const found = await loadTodoFor(params.id, caller, 'edit')
    if ('error' in found) return NextResponse.json({ error: found.error }, { status: found.status })
    const itemId = new URL(req.url).searchParams.get('item_id')
    if (!itemId) return NextResponse.json({ error: 'item_id is required' }, { status: 400 })
    const { data, error } = await supabase.from('todo_checklist_items').delete()
      .eq('id', itemId).eq('todo_id', params.id).select('title').maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (data) await logActivity(params.id, caller, [{ action: 'checklist', field_name: 'checklist item removed', old_value: data.title }])
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
