/**
 * Shared helpers for Tasks (todos): who may edit/comment, history lines, notifications.
 * Tables from migration 194: todo_activity, notifications.
 *
 * Rules (confirmed with Russel 2026-10-30):
 *  - Edit:    the creator, the owner (assigned_to), or corporate.
 *  - Comment: anyone who can edit, plus watchers.
 *  - View:    anyone who can comment, plus people in the task's org (the Team view).
 */
import { createClient } from '@supabase/supabase-js'
import type { PortalUser } from '@/lib/current-user'

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type TodoRow = {
  id: string
  title: string
  status: string
  created_by: string
  assigned_to: string | null
  assigned_to_name?: string | null
  org_id: string | null
  watcher_ids?: string[] | null
  task_number?: number | null
  [key: string]: unknown
}

export const taskKey = (n?: number | null) => (n ? `T-${n}` : '')

export function canEditTodo(t: TodoRow, u: PortalUser) {
  return u.isCorporate || t.created_by === u.id || t.assigned_to === u.id
}
export function canCommentTodo(t: TodoRow, u: PortalUser) {
  return canEditTodo(t, u) || (t.watcher_ids ?? []).includes(u.id)
}
export function canViewTodo(t: TodoRow, u: PortalUser) {
  return canCommentTodo(t, u) || (!!u.org_id && t.org_id === u.org_id)
}

/** Load a task and check access. Returns { todo } or { error, status }. */
export async function loadTodoFor(id: string, u: PortalUser, need: 'view' | 'comment' | 'edit') {
  const { data, error } = await supabaseAdmin.from('todos').select('*').eq('id', id).maybeSingle()
  if (error) return { error: error.message, status: 500 as const }
  if (!data) return { error: 'Not found', status: 404 as const }
  const t = data as TodoRow
  const ok = need === 'edit' ? canEditTodo(t, u) : need === 'comment' ? canCommentTodo(t, u) : canViewTodo(t, u)
  if (!ok) return { error: need === 'edit' ? 'Only the creator or owner can change this task.' : 'Forbidden', status: 403 as const }
  return { todo: t }
}

const asText = (v: unknown): string | null => {
  if (v === null || v === undefined || v === '') return null
  if (Array.isArray(v)) return v.join(', ')
  return String(v)
}

/** Write history lines. History failing must not undo the user's change, so errors are logged, not thrown. */
export async function logActivity(
  todoId: string,
  u: PortalUser,
  rows: { action: string; field_name?: string | null; old_value?: unknown; new_value?: unknown }[],
) {
  if (rows.length === 0) return
  const { error } = await supabaseAdmin.from('todo_activity').insert(rows.map(r => ({
    todo_id: todoId,
    user_id: u.id,
    user_name: u.name,
    action: r.action,
    field_name: r.field_name ?? null,
    old_value: asText(r.old_value),
    new_value: asText(r.new_value),
  })))
  if (error) console.error('[todo-activity] history write failed:', error.message)
}

/** Send notifications to people other than the actor. Same error rule as history. */
export async function notify(
  recipients: (string | null | undefined)[],
  u: PortalUser,
  n: { type: string; title: string; body?: string | null; todo: TodoRow },
) {
  const to = Array.from(new Set(recipients.filter((r): r is string => !!r && r !== u.id && r !== 'system')))
  if (to.length === 0) return
  const { error } = await supabaseAdmin.from('notifications').insert(to.map(user_id => ({
    user_id,
    org_id: n.todo.org_id ?? null,
    type: n.type,
    title: n.title,
    body: n.body ?? null,
    link: `/?tab=my-day&task=${n.todo.id}`,
    entity_type: 'todo',
    entity_id: n.todo.id,
    actor_user_id: u.id,
    actor_name: u.name,
  })))
  if (error) console.error('[todo-activity] notification write failed:', error.message)
}

/** Fields a task edit may change, with how each one is labelled in History. */
export const EDITABLE_FIELDS: Record<string, string> = {
  title: 'title', body: 'description', priority: 'priority', status: 'status', waiting_on: 'waiting on',
  due_date: 'due date', start_date: 'start date', assigned_to: 'owner', linked_type: 'link', linked_id: 'link',
  linked_label: 'link', recurrence_type: 'repeat', recurrence_interval: 'repeat', recurrence_ends_at: 'repeat end',
  tags: 'tags', watcher_ids: 'watchers', estimate_mins: 'estimate', parent_task_id: 'parent task', sort_order: 'order',
}
