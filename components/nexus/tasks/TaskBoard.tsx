'use client'

/** Tasks · Board view — one column per status; drag a card to change its status.
 *  The Done column is only a drop target: finished tasks live on the Completed tab. */
import { useState } from 'react'
import { STATUS, T, fmtDue, initials, isOverdue, linkTypeLabel, PriorityIcon, type Task, type TaskStatus } from './shared'

const CSS = `
.tkb-cols{display:grid;grid-template-columns:repeat(4,minmax(250px,1fr));gap:14px;overflow-x:auto;align-items:start;padding-bottom:4px}
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
@media (max-width:899px){.tkb-cols{grid-template-columns:repeat(4,minmax(250px,82vw))}}
.tkb-drop{display:flex;flex-direction:column;align-items:center;gap:8px;padding:22px 10px;border:1.5px dashed rgba(0,0,0,.16);border-radius:10px;color:#6E6E73;font-size:12.5px;text-align:center;line-height:1.45}
.tkb-col.over .tkb-drop{border-color:#0071E3;color:#0058B0}
.tkb-key{font:600 11px ui-monospace,SFMono-Regular,Menlo,monospace;color:#6E6E73}
.tkb-prog{display:inline-flex;align-items:center;gap:4px;font-size:12px;color:#3A3A3C;font-variant-numeric:tabular-nums}
`

export function TaskBoard({ tasks, openId, onOpen, onMove, onAdd, doneCount = 0, onShowDone }: {
  tasks: Task[]
  doneCount?: number
  onShowDone?: () => void
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
        const isDoneCol = col.key === 'done'
        const items = isDoneCol ? [] : tasks.filter(t => t.status === col.key)
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
            <div className="tkb-colh"><span className="tk-dot" style={{ background: col.dot }} />{col.label}<span className="n">{isDoneCol ? doneCount : items.length}</span></div>
            {isDoneCol && (
              <div className="tkb-drop">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.5 2.5L16 9.5" /></svg>
                <span>Drag a card here to complete it.<br />Finished tasks move to the Completed tab.</span>
                {onShowDone && doneCount > 0 && <button type="button" className="tkb-add" style={{ textAlign: 'center', color: '#0071E3' }} onClick={onShowDone}>View {doneCount} completed</button>}
              </div>
            )}
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
                  {(t.linked_label || t.parent_task_id || (t.tags ?? []).length > 0) && (
                    <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {t.parent_task_id && <span className="tk-tag">Subtask</span>}
                      {t.linked_label && <span className="tk-tag">{t.linked_label}</span>}
                      {t.linked_type && t.linked_type !== 'site' && t.linked_type !== 'property' && <span className={`tk-tag${t.linked_type === 'work_order' ? ' wo' : ''}`}>{linkTypeLabel(t.linked_type)}</span>}
                      {(t.tags ?? []).slice(0, 3).map(tag => <span key={tag} className="tk-tag" style={{ background: '#EFEAFB', color: '#5B3BB0' }}>{tag}</span>)}
                    </span>
                  )}
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {t.key && <span className="tkb-key">{t.key}</span>}
                    <PriorityIcon p={t.priority} />
                    {(t.checklist_total ?? 0) > 0 && (
                      <span className="tkb-prog" title="Checklist">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path d="M9 11l3 3 8-8" /><path d="M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h9" /></svg>
                        {t.checklist_done ?? 0}/{t.checklist_total}
                      </span>
                    )}
                    {t.recurrence_type && t.recurrence_type !== 'none' && <span className="tk-sub" style={{ fontSize: 12 }}>Repeats</span>}
                    <span style={{ flex: 1 }} />
                    {t.due_date && <span className={`tk-due${late ? ' late' : ''}`}>{late ? 'Overdue · ' : ''}{fmtDue(t.due_date)}</span>}
                    <span className="tk-av" title={t.assigned_to_name ?? 'Unassigned'}>{initials(t.assigned_to_name)}</span>
                  </span>
                </button>
              )
            })}
            {!isDoneCol && items.length === 0 && <span className="tk-sub" style={{ padding: '6px' }}>Nothing here</span>}
            {isDoneCol ? null : addingIn === col.key ? (
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
