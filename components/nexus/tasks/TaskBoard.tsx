'use client'

/** Tasks · Board view — one column per status; drag a card to change its status. */
import { useState } from 'react'
import { STATUS, T, fmtDue, initials, isOverdue, linkTypeLabel, PriorityIcon, type Task, type TaskStatus } from './TasksSurface'

const DONE_SHOWN = 20

const CSS = `
.tkb-cols{display:grid;grid-template-columns:repeat(3,minmax(280px,1fr));gap:14px;overflow-x:auto;align-items:start;padding-bottom:4px}
.tkb-col{background:rgba(220,227,238,.92);border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:8px;min-width:0;min-height:120px;transition:background .12s}
.tkb-col.over{background:#DCE8F8}
.tkb-colh{display:flex;align-items:center;gap:8px;padding:4px 4px 6px;font-size:13px;font-weight:600}
.tkb-colh span.n{font-weight:500;color:#6E6E73}
.tkb-card{display:flex;flex-direction:column;gap:10px;width:100%;text-align:left;background:#fff;border-radius:10px;padding:12px;border:1px solid rgba(0,0,0,.04);box-shadow:0 1px 2px rgba(0,0,0,.06);font:inherit;color:inherit;cursor:pointer}
.tkb-card:hover{box-shadow:0 1px 2px rgba(0,0,0,.06),0 6px 16px -8px rgba(0,0,0,.25)}
.tkb-card:focus-visible{outline:2px solid #0071E3;outline-offset:1px}
.tkb-card.sel{outline:2px solid #0071E3;outline-offset:-1px}
.tkb-card.drag{opacity:.45}
.tkb-ttl{font-size:14px;font-weight:600;line-height:1.35;word-break:break-word}
.tkb-add{min-height:40px;border:0;border-radius:8px;background:none;color:#6E6E73;font-family:inherit;font-size:13px;font-weight:500;text-align:left;padding:0 8px;cursor:pointer}
.tkb-add:hover{background:rgba(0,0,0,.05)}
@media (max-width:899px){.tkb-cols{grid-template-columns:repeat(3,minmax(260px,82vw))}}
`

export function TaskBoard({ tasks, openId, onOpen, onMove, onAdd }: {
  tasks: Task[]
  openId: string | null
  onOpen: (id: string) => void
  onMove: (id: string, status: TaskStatus) => void
  onAdd: (title: string, status: TaskStatus) => void
}) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [over, setOver] = useState<TaskStatus | null>(null)
  const [addingIn, setAddingIn] = useState<TaskStatus | null>(null)
  const [draft, setDraft] = useState('')

  return (
    <div className="tkb-cols">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {STATUS.map(col => {
        let items = tasks.filter(t => t.status === col.key)
        let hidden = 0
        if (col.key === 'done') {
          items = [...items].sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))
          hidden = Math.max(0, items.length - DONE_SHOWN)
          items = items.slice(0, DONE_SHOWN)
        }
        return (
          <section
            key={col.key}
            aria-label={col.label}
            className={`tkb-col${over === col.key ? ' over' : ''}`}
            onDragOver={e => { if (dragId) { e.preventDefault(); setOver(col.key) } }}
            onDragLeave={() => setOver(o => (o === col.key ? null : o))}
            onDrop={e => {
              e.preventDefault()
              const id = e.dataTransfer.getData('text/plain') || dragId
              const t = tasks.find(x => x.id === id)
              if (t && t.status !== col.key) onMove(t.id, col.key)
              setDragId(null); setOver(null)
            }}
          >
            <div className="tkb-colh"><span className="tk-dot" style={{ background: col.dot }} />{col.label}<span className="n">{tasks.filter(t => t.status === col.key).length}</span></div>
            {items.map(t => {
              const done = t.status === 'done'
              const late = isOverdue(t)
              return (
                <button
                  key={t.id}
                  type="button"
                  draggable
                  onDragStart={e => { e.dataTransfer.setData('text/plain', t.id); e.dataTransfer.effectAllowed = 'move'; setDragId(t.id) }}
                  onDragEnd={() => { setDragId(null); setOver(null) }}
                  onClick={() => onOpen(t.id)}
                  className={`tkb-card${openId === t.id ? ' sel' : ''}${dragId === t.id ? ' drag' : ''}`}
                >
                  <span className="tkb-ttl" style={done ? { color: T.ink3, textDecoration: 'line-through' } : undefined}>{t.title}</span>
                  {t.linked_label && (
                    <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      <span className="tk-tag">{t.linked_label}</span>
                      {t.linked_type && t.linked_type !== 'site' && <span className={`tk-tag${t.linked_type === 'work_order' ? ' wo' : ''}`}>{linkTypeLabel(t.linked_type)}</span>}
                    </span>
                  )}
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <PriorityIcon p={t.priority} />
                    {t.recurrence_type && t.recurrence_type !== 'none' && <span className="tk-sub" style={{ fontSize: 12 }}>Repeats</span>}
                    <span style={{ flex: 1 }} />
                    {t.due_date && <span className={`tk-due${late ? ' late' : ''}`}>{late ? 'Overdue · ' : ''}{fmtDue(t.due_date)}</span>}
                    <span className="tk-av" title={t.assigned_to_name ?? 'Unassigned'}>{initials(t.assigned_to_name)}</span>
                  </span>
                </button>
              )
            })}
            {hidden > 0 && <span className="tk-sub" style={{ padding: '2px 6px' }}>+ {hidden} older done — see List view</span>}
            {items.length === 0 && hidden === 0 && <span className="tk-sub" style={{ padding: '6px' }}>Nothing here</span>}
            {addingIn === col.key ? (
              <form onSubmit={e => { e.preventDefault(); if (draft.trim()) { onAdd(draft, col.key); setDraft(''); setAddingIn(null) } }} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="tk-sr" htmlFor={`tkb-add-${col.key}`}>New task in {col.label}</label>
                <input id={`tkb-add-${col.key}`} autoFocus className="tk-input" placeholder="Task title" value={draft} onChange={e => setDraft(e.target.value)} onBlur={() => { if (!draft.trim()) setAddingIn(null) }} />
              </form>
            ) : (
              <button type="button" className="tkb-add" onClick={() => { setAddingIn(col.key); setDraft('') }}>+ Add task</button>
            )}
          </section>
        )
      })}
    </div>
  )
}

export default TaskBoard
