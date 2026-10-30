'use client'

/**
 * Tasks · Completed tab — finished tasks, kept out of the open board/list.
 * Grouped by date finished (default), customer / site, or person. Unticking reopens a task.
 */
import { useMemo, useState } from 'react'
import { LIST_CSS } from './TaskList'
import { T, groupName, initials, localISO, type Task } from './shared'

export type DoneGroupBy = 'date' | 'customer' | 'person'
type Group = { key: string; label: string; items: Task[] }

const dayISO = (iso: string) => localISO(new Date(iso))

function dateBucket(iso: string | null | undefined, today: string, yesterday: string, weekAgo: string) {
  if (!iso) return { key: '0000', label: 'Date not recorded' }
  const d = dayISO(iso)
  if (d === today) return { key: '9-today', label: 'Today' }
  if (d === yesterday) return { key: '8-yesterday', label: 'Yesterday' }
  if (d >= weekAgo) return { key: '7-week', label: 'Earlier this week' }
  const m = d.slice(0, 7)
  return { key: `1-${m}`, label: new Date(`${m}-01T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) }
}

function fmtFinished(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) })}, ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
}

export function TaskCompleted({ tasks, groupBy, openId, onOpen, onReopen }: {
  tasks: Task[]
  groupBy: DoneGroupBy
  openId: string | null
  onOpen: (id: string) => void
  onReopen: (t: Task) => void
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const groups = useMemo<Group[]>(() => {
    const today = localISO()
    const y = new Date(); y.setDate(y.getDate() - 1)
    const w = new Date(); w.setDate(w.getDate() - 6)
    const yesterday = localISO(y), weekAgo = localISO(w)
    const byFinished = (a: Task, b: Task) => (b.completed_at ?? '').localeCompare(a.completed_at ?? '')
    const map = new Map<string, Group>()
    for (const t of tasks) {
      const g = groupBy === 'date' ? dateBucket(t.completed_at, today, yesterday, weekAgo)
        : groupBy === 'customer' ? { key: groupName(t), label: groupName(t) }
        : { key: t.assigned_to_name ?? '~', label: t.assigned_to_name ?? 'Unassigned' }
      if (!map.has(g.key)) map.set(g.key, { ...g, items: [] })
      map.get(g.key)!.items.push(t)
    }
    const list = [...map.values()].map(g => ({ ...g, items: g.items.sort(byFinished) }))
    if (groupBy === 'date') return list.sort((a, b) => b.key.localeCompare(a.key))
    // Customer / person: busiest first, then A–Z; "Internal" / "Unassigned" last.
    return list.sort((a, b) => Number(a.key === 'Internal' || a.key === '~') - Number(b.key === 'Internal' || b.key === '~') || b.items.length - a.items.length || a.label.localeCompare(b.label))
  }, [tasks, groupBy])

  if (groups.length === 0) return <div className="tk-empty" style={{ background: '#fff', borderRadius: 12 }}>No completed tasks yet.</div>

  return (
    <div className="tkl" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <style dangerouslySetInnerHTML={{ __html: LIST_CSS }} />
      {groups.map(g => {
        const ck = `done:${groupBy}:${g.key}`
        const isCollapsed = !!collapsed[ck]
        return (
          <section key={g.key} className="tkl-grp" aria-label={g.label}>
            <button type="button" className="tkl-gh" aria-expanded={!isCollapsed} onClick={() => setCollapsed(c => ({ ...c, [ck]: !isCollapsed }))}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.ink2} strokeWidth={2.4} strokeLinecap="round" aria-hidden="true" style={{ transform: isCollapsed ? 'rotate(-90deg)' : undefined, transition: 'transform .12s' }}><path d="M6 9l6 6 6-6" /></svg>
              <b>{g.label}</b>
              <span className="tk-sub">{g.items.length} completed</span>
            </button>
            {!isCollapsed && (
              <div className="tkl-tw">
                <table>
                  <thead><tr>
                    <th style={{ width: 40 }}><span className="tk-sr">Reopen</span></th><th style={{ width: 72 }}>Key</th><th>Task</th>
                    {groupBy !== 'customer' && <th style={{ width: 200 }}>Customer / site</th>}
                    {groupBy !== 'person' && <th style={{ width: 190 }}>Owner</th>}
                    <th style={{ width: 150 }}>Finished</th>
                  </tr></thead>
                  <tbody>
                    {g.items.map(t => (
                      <tr key={t.id} className={openId === t.id ? 'sel' : undefined}>
                        <td><input type="checkbox" checked onChange={() => onReopen(t)} aria-label={`Reopen: ${t.title}`} title="Untick to reopen" /></td>
                        <td><span className="tkl-key">{t.key}</span></td>
                        <td style={{ whiteSpace: 'normal' }}>
                          <button type="button" className="tkl-ttl" onClick={() => onOpen(t.id)} style={{ color: T.ink2 }}>{t.title}</button>
                          {t.parent_task_id && <span className="tk-tag" style={{ marginLeft: 8 }}>Subtask</span>}
                        </td>
                        {groupBy !== 'customer' && <td>{t.linked_label ? <span className="tk-tag">{t.linked_label}</span> : <span className="tk-sub">Internal</span>}</td>}
                        {groupBy !== 'person' && <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><span className="tk-av">{initials(t.assigned_to_name)}</span><span className="tk-sub" style={{ color: T.ink2 }}>{t.assigned_to_name ?? 'Unassigned'}</span></span></td>}
                        <td><span className="tk-due">{fmtFinished(t.completed_at)}</span></td>
                      </tr>
                    ))}
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

export default TaskCompleted
