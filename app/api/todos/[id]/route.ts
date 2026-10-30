/**
 * GET    /api/todos/[id]  — one task with everything in it (checklist, subtasks, comments,
 *                           history, extra links, blocked-by, time, files)
 * PATCH  /api/todos/[id]  — update a task; writes History, notifies a new owner,
 *                           auto-spawns the next repeat when a recurring task is marked done
 * DELETE /api/todos/[id]  — delete a task + its files (checklist, comments etc. cascade)
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { supabaseAdmin as supabase, loadTodoFor, canEditTodo, canCommentTodo, logActivity, notify, taskKey, EDITABLE_FIELDS } from '@/lib/todo-activity'

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

const sameValue = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const caller = await getCurrentUser()
    const found = await loadTodoFor(params.id, caller, 'view')
    if ('error' in found) return NextResponse.json({ error: found.error }, { status: found.status })
    const todo = found.todo

    const [checklist, subtasks, comments, activity, links, blockedBy, blocking, time, files] = await Promise.all([
      supabase.from('todo_checklist_items').select('*').eq('todo_id', todo.id).order('sort_order').order('created_at'),
      supabase.from('todos').select('id, title, status, priority, due_date, assigned_to, assigned_to_name, task_number, sort_order')
        .eq('parent_task_id', todo.id).order('sort_order').order('created_at'),
      supabase.from('todo_comments').select('*').eq('todo_id', todo.id).order('created_at'),
      supabase.from('todo_activity').select('*').eq('todo_id', todo.id).order('created_at', { ascending: false }).limit(200),
      supabase.from('todo_links').select('*').eq('todo_id', todo.id).order('created_at'),
      supabase.from('todo_dependencies').select('id, blocked_by_todo_id, todos!todo_dependencies_blocked_by_todo_id_fkey(id, title, status, task_number)').eq('todo_id', todo.id),
      supabase.from('todo_dependencies').select('id, todo_id, todos!todo_dependencies_todo_id_fkey(id, title, status, task_number)').eq('blocked_by_todo_id', todo.id),
      supabase.from('todo_time_entries').select('*').eq('todo_id', todo.id).order('started_at', { ascending: false }),
      supabase.from('todo_attachments').select('id, name, url, size_bytes, mime_type, uploaded_by, created_at').eq('todo_id', todo.id).order('created_at'),
    ])
    const firstError = [checklist, subtasks, comments, activity, links, blockedBy, blocking, time, files].find(r => r.error)?.error
    if (firstError) return NextResponse.json({ error: firstError.message }, { status: 500 })

    let parent = null
    if (todo.parent_task_id) {
      const { data } = await supabase.from('todos').select('id, title, task_number').eq('id', todo.parent_task_id as string).maybeSingle()
      parent = data
    }

    const entries = time.data ?? []
    const loggedMins = entries.reduce((sum, e) => sum + (e.minutes ?? 0), 0)

    return NextResponse.json({
      todo: { ...todo, key: taskKey(todo.task_number) },
      parent,
      checklist: checklist.data ?? [],
      subtasks: (subtasks.data ?? []).map(s => ({ ...s, key: taskKey(s.task_number) })),
      comments: comments.data ?? [],
      activity: activity.data ?? [],
      links: links.data ?? [],
      blocked_by: blockedBy.data ?? [],
      blocking: blocking.data ?? [],
      time: { entries, logged_mins: loggedMins, running: entries.find(e => !e.ended_at && e.user_id === caller.id) ?? null },
      files: files.data ?? [],
      can: { edit: canEditTodo(todo, caller), comment: canCommentTodo(todo, caller) },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const caller = await getCurrentUser()
    const body   = await req.json()

    const found = await loadTodoFor(params.id, caller, 'edit')
    if ('error' in found) return NextResponse.json({ error: found.error }, { status: found.status })
    const existing = found.todo

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const field of Object.keys(EDITABLE_FIELDS)) {
      if (body[field] !== undefined) updates[field] = body[field]
    }
    if (body.assigned_to_name !== undefined) updates.assigned_to_name = body.assigned_to_name
    // Leaving "Waiting" clears what it was waiting on.
    if (body.status !== undefined && body.status !== 'waiting' && body.waiting_on === undefined) updates.waiting_on = null
    if (body.parent_task_id && body.parent_task_id === existing.id) {
      return NextResponse.json({ error: 'A task cannot be its own subtask.' }, { status: 400 })
    }

    let spawnedNext = null

    if (body.status !== undefined) {
      updates.completed_at = body.status === 'done' ? (existing.status === 'done' ? existing.completed_at : new Date().toISOString()) : null

      // Auto-spawn next recurring instance when marked done
      if (body.status === 'done' && existing.status !== 'done' && existing.recurrence_type && existing.recurrence_type !== 'none') {
        const next = nextDueDate(
          existing.due_date as string | null,
          existing.recurrence_type as string,
          (existing.recurrence_interval as number) ?? 1
        )
        // Only spawn if within recurrence_ends_at window (or no end date)
        const withinWindow =
          !existing.recurrence_ends_at ||
          !next ||
          next <= (existing.recurrence_ends_at as string)

        if (next && withinWindow) {
          const { data: spawned, error: spawnError } = await supabase
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
              tags:                existing.tags ?? [],
              watcher_ids:         existing.watcher_ids ?? [],
              estimate_mins:       existing.estimate_mins ?? null,
            })
            .select()
            .single()
          if (spawnError) console.error('[todos] next repeat not created:', spawnError.message)
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

    // History: one line per field that actually changed (link fields collapse into one line).
    const history: { action: string; field_name: string; old_value: unknown; new_value: unknown }[] = []
    let linkLogged = false
    for (const field of Object.keys(EDITABLE_FIELDS)) {
      if (body[field] === undefined || sameValue(existing[field], body[field])) continue
      if (field === 'sort_order') continue
      if (field.startsWith('linked_')) {
        if (linkLogged) continue
        linkLogged = true
        history.push({ action: 'updated', field_name: 'link', old_value: existing.linked_label, new_value: data.linked_label })
        continue
      }
      if (field === 'assigned_to') {
        history.push({ action: 'updated', field_name: 'owner', old_value: existing.assigned_to_name, new_value: data.assigned_to_name })
        continue
      }
      history.push({ action: 'updated', field_name: EDITABLE_FIELDS[field], old_value: existing[field], new_value: body[field] })
    }
    await logActivity(existing.id, caller, history)

    // Notifications: new owner; watchers + creator when the status changes.
    const after = { ...existing, ...data }
    if (body.assigned_to !== undefined && body.assigned_to !== existing.assigned_to && body.assigned_to) {
      await notify([body.assigned_to], caller, { type: 'task_assigned', title: `${caller.name} assigned you ${taskKey(after.task_number as number)} ${after.title}`.trim(), todo: after })
    }
    if (body.status !== undefined && body.status !== existing.status) {
      const label = body.status === 'in_progress' ? 'In progress' : body.status === 'open' ? 'To do' : body.status === 'waiting' ? 'Waiting' : 'Done'
      await notify([...(after.watcher_ids ?? []), after.created_by, after.assigned_to], caller, {
        type: 'task_update', title: `${taskKey(after.task_number as number)} ${after.title} → ${label}`.trim(), todo: after,
      })
    }

    return NextResponse.json({ todo: { ...data, key: taskKey(data.task_number) }, spawned: spawnedNext })
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
      return NextResponse.json({ error: 'Only the person who created this task can delete it.' }, { status: 403 })
    }

    // Attachments cascade-delete via FK, but clean up Storage paths too
    // (this task's and its subtasks' — subtasks cascade-delete with it).
    const { data: subs } = await supabase.from('todos').select('id').eq('parent_task_id', params.id)
    const ids = [params.id, ...(subs ?? []).map(s => s.id)]
    const { data: attachments } = await supabase
      .from('todo_attachments')
      .select('storage_path')
      .in('todo_id', ids)

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
