'use client'

/** Tasks · List view — a table grouped by site / record (default), status, owner or due date. */
import { useMemo, useState } from 'react'
import { STATUS, T, addDays, fmtDue, groupName, initials, isOverdue, linkTypeLabel, localISO, PriorityIcon, StatusPill, type GroupBy, type Task } from './shared'

export const LIST_CSS = `
.tkl-grp{background:#fff;border-radius:12px;box-shadow:0 1px 2px rgba(0,0,0,.04),0 6px 20px -12px rgba(0,0,0,.18);overflow:hidden}
.tkl-gh{display:flex;align-items:center;gap:10px;width:100%;padding:0 16px;min-height:48px;border:0;border-bottom:1px solid rgba(0,0,0,.06);background:#FBFBFD;font:inherit;color:inherit;cursor:pointer;text-align:left}
.tkl-gh b{font-size:14px;font-weight:600}
.tkl-tw{overflow-x:auto}
.tkl table{width:100%;min-width:760px;border-collapse:collapse;font-size:13px;table-layout:fixed}
.tkl th{text-align:left;font-weight:500;color:#6E6E73;font-size:12px;padding:8px 10px;border-bottom:1px solid rgba(0,0,0,.06);white-space:nowrap}
.tkl td{padding:9px 10px;border-bottom:1px solid rgba(0,0,0,.05);white-space:nowrap;vertical-align:middle}
.tkl tr:last-child td{border-bottom:0}
.tkl tr.sel td{background:#F0F6FE}
.tkl tbody tr:hover td{background:#FAFAFC}
.tkl tbody tr.sel:hover td{background:#F0F6FE}
.tkl-ttl{border:0;background:none;padding:0;font-family:inherit;font-size:13px;font-weight:600;color:#1D1D1F;cursor:pointer;text-align:left;white-space:normal}
.tkl-ttl:hover{color:#0071E3}
.tkl-key{font:600 11px ui-monospace,SFMono-Regular,Menlo,monospace;color:#6E6E73;white-space:nowrap}
.tkl input[type=checkbox]{width:16px;height:16px;margin:0;accent-color:#0071E3;cursor:pointer}
`

type Group = { key: string; label: string; items: Task[] }
const PRI_RANK: Record<string, number> = { high: 0, normal: 1, low: 2 }
const sortTasks = (a: Task, b: Task) =>
  (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0) ||
  (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') ||
  (PRI_RANK[a.priority] ?? 1) - (PRI_RANK[b.priority] ?? 1)

function buildGroups(tasks: Task[], by: GroupBy): Group[] {
  const map = new Map<string, Task[]>()
  const keyOf = (t: Task): string => {
    if (by === 'status') return t.status
    if (by === 'owner') return t.assigned_to_name?.trim() || 'Unassigned'
    if (by === 'due') {
      if (t.status === 'done') return 'done'
      if (!t.due_date) return 'none'
      const today = localISO()
      if (t.due_date < today) return 'overdue'
      if (t.due_date === today) return 'today'
      if (t.due_date <= addDays(today, 7)) return 'week'
      return 'later'
    }
    return groupName(t)
  }
  for (const t of tasks) { const k = keyOf(t); map.set(k, [...(map.get(k) ?? []), t]) }
  // Subtasks sit right under their parent when the parent is in the same group.
  const nest = (items: Task[]) => {
    const ids = new Set(items.map(t => t.id))
    const top = items.filter(t => !t.parent_task_id || !ids.has(t.parent_task_id)).sort(sortTasks)
    const out: Task[] = []
    for (const t of top) {
      out.push(t)
      out.push(...items.filter(c => c.parent_task_id === t.id).sort(sortTasks))
    }
    return out
  }

  let order: string[]
  const labels: Record<string, string> = {}
  if (by === 'status') { order = STATUS.map(s => s.key); STATUS.forEach(s => { labels[s.key] = s.label }) }
  else if (by === 'due') {
    order = ['overdue', 'today', 'week', 'later', 'none', 'done']
    Object.assign(labels, { overdue: 'Overdue', today: 'Today', week: 'Next 7 days', later: 'Later', none: 'No due date', done: 'Done' })
  } else {
    // Groups with open work first, alphabetical; the catch-all group goes last.
    const tail = by === 'site' ? 'Internal' : 'Unassigned'
    order = Array.from(map.keys()).filter(k => k !== tail).sort((a, b) => {
      const oa = (map.get(a) ?? []).some(t => t.status !== 'done') ? 0 : 1
      const ob = (map.get(b) ?? []).some(t => t.status !== 'done') ? 0 : 1
      return oa - ob || a.localeCompare(b)
    })
    if (map.has(tail)) order.push(tail)
  }
  return order.filter(k => map.has(k)).map(k => ({ key: k, label: labels[k] ?? k, items: nest(map.get(k) ?? []) }))
}

export function TaskList({ tasks, groupBy, openId, onOpen, onToggleDone }: {
  tasks: Task[]
  groupBy: GroupBy
  openId: string | null
  onOpen: (id: string) => void
  onToggleDone: (t: Task) => void
}) {
  const groups = useMemo(() => buildGroups(tasks, groupBy), [tasks, groupBy])
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  if (groups.length === 0) return <div className="tk-empty" style={{ background: '#fff', borderRadius: 12 }}>No tasks match these filters.</div>

  return (
    <div className="tkl" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <style dangerouslySetInnerHTML={{ __html: LIST_CSS }} />
      {groups.map(g => {
        const open = g.items.filter(t => t.status !== 'done').length
        const done = g.items.length - open
        const isCollapsed = !!collapsed[`${groupBy}:${g.key}`]
        return (
          <section key={g.key} className="tkl-grp" aria-label={g.label}>
            <button type="button" className="tkl-gh" aria-expanded={!isCollapsed} onClick={() => setCollapsed(c => ({ ...c, [`${groupBy}:${g.key}`]: !isCollapsed }))}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.ink2} strokeWidth={2.4} strokeLinecap="round" aria-hidden="true" style={{ transform: isCollapsed ? 'rotate(-90deg)' : undefined, transition: 'transform .12s' }}><path d="M6 9l6 6 6-6" /></svg>
              <b>{g.label}</b>
              <span className="tk-sub">{open} open{done ? ` · ${done} done` : ''}</span>
            </button>
            {!isCollapsed && (
              <div className="tkl-tw">
                <table>
                  <thead><tr><th style={{ width: 40 }}><span className="tk-sr">Done</span></th><th style={{ width: 72 }}>Key</th><th>Task</th>{groupBy !== 'status' && <th style={{ width: 130 }}>Status</th>}<th style={{ width: 110 }}>Priority</th>{groupBy !== 'owner' && <th style={{ width: 190 }}>Owner</th>}<th style={{ width: 90 }}>Due</th></tr></thead>
                  <tbody>
                    {g.items.map(t => {
                      const isDone = t.status === 'done'
                      const late = isOverdue(t)
                      return (
                        <tr key={t.id} className={openId === t.id ? 'sel' : undefined}>
                          <td><input type="checkbox" checked={isDone} onChange={() => onToggleDone(t)} aria-label={`${isDone ? 'Reopen' : 'Mark done'}: ${t.title}`} /></td>
                          <td><span className="tkl-key">{t.key}</span></td>
                          <td style={{ whiteSpace: 'normal' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingLeft: t.parent_task_id && g.items.some(x => x.id === t.parent_task_id) ? 22 : 0 }}>
                              {t.parent_task_id && g.items.some(x => x.id === t.parent_task_id) && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#AEAEB2" strokeWidth={2} aria-hidden="true" style={{ marginLeft: -18 }}><path d="M5 4v9h12" /></svg>}
                              <button type="button" className="tkl-ttl" onClick={() => onOpen(t.id)} style={isDone ? { color: T.ink3, textDecoration: 'line-through' } : undefined}>{t.title}</button>
                              {groupBy !== 'site' && t.linked_label && <span className="tk-tag">{t.linked_label}</span>}
                              {(t.checklist_total ?? 0) > 0 && <span className="tk-sub" style={{ fontSize: 12 }}>✓ {t.checklist_done ?? 0}/{t.checklist_total}</span>}
                              {t.linked_type && t.linked_type !== 'site' && t.linked_type !== 'property' && <span className={`tk-tag${t.linked_type === 'work_order' ? ' wo' : ''}`}>{linkTypeLabel(t.linked_type)}</span>}
                            </span>
                          </td>
                          {groupBy !== 'status' && <td><StatusPill s={t.status} /></td>}
                          <td><PriorityIcon p={t.priority} label /></td>
                          {groupBy !== 'owner' && <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><span className="tk-av">{initials(t.assigned_to_name)}</span><span className="tk-sub" style={{ color: T.ink2 }}>{t.assigned_to_name ?? 'Unassigned'}</span></span></td>}
                          <td>{t.due_date ? <span className={`tk-due${late ? ' late' : ''}`}>{fmtDue(t.due_date)}</span> : <span className="tk-sub">—</span>}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

export default TaskList
