/**
 * GET  /api/todos  — list todos for current user (mine + assigned to me), with attachments
 * POST /api/todos  — create a todo
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { pushTodoToGcal } from '@/lib/gcal-sync'
import { loadTodoFor, logActivity, notify, taskKey } from '@/lib/todo-activity'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const caller = await getCurrentUser()
    const { searchParams } = new URL(req.url)
    const view        = searchParams.get('view') ?? 'mine'
    const status      = searchParams.get('status')
    const unscheduled = searchParams.get('unscheduled') === 'true'
    const limit       = parseInt(searchParams.get('limit') ?? '200', 10)

    // Completed list (status=done) comes back newest-finished first; everything else by due date.
    const base = supabase
      .from('todos')
      .select(`*, todo_attachments(id, name, url, size_bytes, mime_type, created_at), todo_checklist_items(done)`)
    let query = (status === 'done'
      ? base.order('completed_at', { ascending: false, nullsFirst: false })
      : base.order('due_date', { ascending: true, nullsFirst: false }))
      .order('created_at', { ascending: false })
      .limit(limit)

    if (view === 'mine') {
      query = query.or(`created_by.eq.${caller.id},assigned_to.eq.${caller.id}`)
    } else if (view === 'assigned') {
      query = query
        .eq('created_by', caller.id)
        .not('assigned_to', 'is', null)
        .neq('assigned_to', caller.id)
    } else if (view === 'team') {
      query = caller.org_id ? query.eq('org_id', caller.org_id) : query.or(`created_by.eq.${caller.id},assigned_to.eq.${caller.id}`)
    } else {
      query = query.or(`created_by.eq.${caller.id},assigned_to.eq.${caller.id}`)
    }

    // status accepts a comma list ("open,in_progress"). This was `.eq(status)`,
    // which searched for the literal string "open,in_progress" — no row has that,
    // so My Day and the Task Explorer always rendered zero tasks even when tasks
    // existed. Split it and use .in().
    if (status) {
      const wanted = status.split(',').map(s => s.trim()).filter(Boolean)
      query = wanted.length > 1 ? query.in('status', wanted) : query.eq('status', wanted[0])
    }

    // unscheduled=true → only todos without a due_date
    if (unscheduled) query = query.is('due_date', null)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Board cards show the key (T-123) and checklist progress; send counts, not every item.
    const rows = (data ?? []).map(({ todo_checklist_items: items, ...t }) => ({
      ...t,
      key: taskKey(t.task_number),
      checklist_total: (items ?? []).length,
      checklist_done: (items ?? []).filter((i: { done: boolean }) => i.done).length,
    }))
    // Return both keys so callers expecting either shape work
    return NextResponse.json({ todos: rows, records: rows })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const caller = await getCurrentUser()
    const body   = await req.json()
    const {
      title,
      body: todoBody,
      priority = 'normal',
      due_date,
      assigned_to,
      assigned_to_name,
      linked_type,
      linked_id,
      linked_label,
      recurrence_type    = 'none',
      recurrence_interval = 1,
      recurrence_ends_at,
      status = 'open',
      start_date,
      tags,
      watcher_ids,
      estimate_mins,
      parent_task_id,
    } = body

    if (!title?.trim()) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }

    // A subtask needs edit rights on its parent and inherits the parent's org.
    // A subtask also takes the parent's link (site / work order…) when none is given, so it groups with it.
    let parentOrg: string | null | undefined
    let parentLink: { linked_type: unknown; linked_id: unknown; linked_label: unknown } | null = null
    if (parent_task_id) {
      const parent = await loadTodoFor(parent_task_id, caller, 'edit')
      if ('error' in parent) return NextResponse.json({ error: parent.error }, { status: parent.status })
      parentOrg = parent.todo.org_id
      if (!linked_type && parent.todo.linked_type) parentLink = { linked_type: parent.todo.linked_type, linked_id: parent.todo.linked_id, linked_label: parent.todo.linked_label }
    }

    const { data, error } = await supabase
      .from('todos')
      .insert({
        title: title.trim(),
        body:  todoBody ?? null,
        priority,
        status,
        completed_at:       status === 'done' ? new Date().toISOString() : null,
        due_date:           due_date ?? null,
        start_date:         start_date ?? null,
        org_id:             parentOrg !== undefined ? parentOrg : (caller.org_id ?? null),
        tags:               Array.isArray(tags) ? tags : [],
        watcher_ids:        Array.isArray(watcher_ids) ? watcher_ids : [],
        estimate_mins:      estimate_mins ?? null,
        parent_task_id:     parent_task_id ?? null,
        created_by:         caller.id,
        created_by_name:    caller.name,
        // Default to self-assignment so it lands in the creator's own tasks + calendar.
        assigned_to:        assigned_to ?? caller.id,
        assigned_to_name:   assigned_to_name ?? caller.name,
        linked_type:        linked_type ?? parentLink?.linked_type ?? null,
        linked_id:          linked_id ?? parentLink?.linked_id ?? null,
        linked_label:       linked_label ?? parentLink?.linked_label ?? null,
        recurrence_type:    recurrence_type,
        recurrence_interval: recurrence_interval,
        recurrence_ends_at: recurrence_ends_at ?? null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await logActivity(data.id, caller, [{ action: 'created', new_value: data.title }])
    if (parent_task_id) await logActivity(parent_task_id, caller, [{ action: 'subtask', field_name: 'subtask added', new_value: data.title }])
    if (data.assigned_to && data.assigned_to !== caller.id) {
      await notify([data.assigned_to], caller, { type: 'task_assigned', title: `${caller.name} assigned you ${taskKey(data.task_number)} ${data.title}`.trim(), todo: data })
    }

    // Push-on-create: a dated task lands on the creator's Google Calendar instantly
    // (no-op if they haven't connected Google). Best-effort — never blocks the save.
    if (data?.due_date) {
      try { await pushTodoToGcal(caller.id, { id: data.id, title: data.title, due_date: data.due_date, status: data.status, priority: data.priority }) } catch { /* best-effort */ }
    }

    return NextResponse.json({ ...data, key: taskKey(data.task_number), checklist_total: 0, checklist_done: 0 }, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
