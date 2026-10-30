'use client'

/**
 * Shared types, colours and helpers for the Tasks screens. Kept in its own file so the
 * screen files can import it without a circular import through TasksSurface.
 */
export type TaskStatus = 'open' | 'in_progress' | 'waiting' | 'done'
export type TaskPriority = 'high' | 'normal' | 'low'
export type Task = {
  id: string
  title: string
  body?: string | null
  priority: TaskPriority
  status: TaskStatus
  due_date: string | null
  assigned_to?: string | null
  assigned_to_name?: string | null
  created_by_name?: string | null
  linked_type?: string | null
  linked_id?: string | null
  linked_label?: string | null
  recurrence_type?: string | null
  completed_at?: string | null
  created_at?: string | null
  todo_attachments?: { id: string; name: string; url: string }[]
  created_by?: string | null
  key?: string
  task_number?: number | null
  waiting_on?: string | null
  start_date?: string | null
  tags?: string[]
  watcher_ids?: string[]
  estimate_mins?: number | null
  parent_task_id?: string | null
  recurrence_interval?: number | null
  recurrence_ends_at?: string | null
  checklist_total?: number
  checklist_done?: number
}
export type Person = { id: string; name: string; initials: string; email?: string | null; role?: string | null }
export type GroupBy = 'site' | 'status' | 'owner' | 'due'
export type Scope = 'mine' | 'team'
export type DueFilter = 'all' | 'today' | 'overdue' | 'week'

// Same palette as the property portal shell (components/portal/ops/OpsShell.tsx).
export const T = {
  canvas: '#F5F5F7', card: '#FFFFFF', ink: '#1D1D1F', ink2: '#3A3A3C', ink3: '#6E6E73',
  line: 'rgba(0,0,0,0.08)', line2: 'rgba(0,0,0,0.12)', blue: '#0071E3', blueDark: '#0058B0',
  red: '#D70015', orange: '#B25000', green: '#1A6B32',
}
export const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, system-ui, sans-serif'

export const STATUS: { key: TaskStatus; label: string; dot: string; bg: string; fg: string }[] = [
  { key: 'open', label: 'To do', dot: '#8E8E93', bg: '#F2F2F4', fg: '#3A3A3C' },
  { key: 'in_progress', label: 'In progress', dot: '#0071E3', bg: '#E8F1FD', fg: '#0058B0' },
  { key: 'waiting', label: 'Waiting', dot: '#FF9500', bg: '#FFF4E5', fg: '#8A4B06' },
  { key: 'done', label: 'Done', dot: '#34C759', bg: '#E6F6EA', fg: '#1A6B32' },
]
export const statusOf = (s: string) => STATUS.find(x => x.key === s) ?? STATUS[0]
export const PRIORITY: Record<TaskPriority, { label: string; color: string }> = {
  high: { label: 'High', color: '#D70015' },
  normal: { label: 'Normal', color: '#B25000' },
  low: { label: 'Low', color: '#0071E3' },
}
const LINK_LABEL: Record<string, string> = { work_order: 'Work order', site: 'Site', property: 'Site', lead: 'Lead', opportunity: 'Opportunity', customer: 'Customer', dealer: 'Dealer' }
export const linkTypeLabel = (t?: string | null) => (t ? LINK_LABEL[t] ?? t : '')

// Local calendar dates (not UTC) so "today" is right in the evening.
export function localISO(d = new Date()) {
  const m = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}
export function addDays(iso: string | null, n: number) {
  const base = iso ? new Date(`${iso}T00:00:00`) : new Date()
  base.setDate(base.getDate() + n)
  return localISO(base)
}
export function fmtDue(iso: string | null) {
  if (!iso) return ''
  const d = new Date(`${iso}T00:00:00`)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
export const isOverdue = (t: Task) => t.status !== 'done' && !!t.due_date && t.due_date < localISO()
export const initials = (name?: string | null) =>
  (name ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || '—'
export const groupName = (t: Task) => (t.linked_label?.trim() ? t.linked_label.trim() : 'Internal')

export function PriorityIcon({ p, label = false }: { p: TaskPriority; label?: boolean }) {
  const c = PRIORITY[p]?.color ?? T.ink3
  const path = p === 'high' ? 'M6 15l6-6 6 6M6 10l6-6 6 6' : p === 'low' ? 'M6 9l6 6 6-6' : 'M5 9h14M5 15h14'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 500, color: T.ink2 }} title={`${PRIORITY[p]?.label ?? p} priority`}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>
      {label ? PRIORITY[p]?.label ?? p : <span className="tk-sr">{PRIORITY[p]?.label ?? p} priority</span>}
    </span>
  )
}
export function StatusPill({ s }: { s: string }) {
  const st = statusOf(s)
  return <span className="tk-st" style={{ background: st.bg, color: st.fg }}>{st.label}</span>
}

