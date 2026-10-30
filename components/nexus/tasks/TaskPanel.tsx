'use client'

/** Tasks · Detail panel — opens on the right from the board or the list. */
import { useState } from 'react'
import { STATUS, T, addDays, fmtDue, initials, isOverdue, linkTypeLabel, localISO, PRIORITY, type Task, type TaskPriority, type TaskStatus } from './TasksSurface'

const RECORD_URL: Record<string, string> = {
  work_order: '/maintenance/', site: '/sites/', lead: '/crm/leads/', opportunity: '/crm/opportunities/', customer: '/customers/',
}

const CSS = `
.tkp{position:fixed;top:0;right:0;bottom:0;z-index:95;width:480px;max-width:100%;background:#fff;box-shadow:0 0 0 1px rgba(0,0,0,.06),-20px 0 50px -20px rgba(0,0,0,.35);display:flex;flex-direction:column}
.tkp-body{flex:1;overflow-y:auto;padding:20px 22px 28px;display:flex;flex-direction:column;gap:20px;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
.tkp-fld{display:grid;grid-template-columns:96px 1fr;gap:10px 12px;align-items:center;font-size:13px}
.tkp-fld>.l{color:#6E6E73}
.tkp-hdr{font-size:12px;font-weight:600;color:#6E6E73;letter-spacing:.02em;text-transform:uppercase;margin-bottom:6px}
.tkp-title{width:100%;border:1px solid transparent;border-radius:8px;padding:4px 6px;margin:-4px -6px;font-family:inherit;font-size:22px;font-weight:600;letter-spacing:-.02em;line-height:1.25;color:#1D1D1F;background:none;resize:none}
.tkp-title:hover{border-color:rgba(0,0,0,.12)}
.tkp-title:focus{outline:2px solid #0071E3;outline-offset:-1px;border-color:transparent}
.tkp-foot{display:flex;gap:10px;flex-wrap:wrap;border-top:1px solid rgba(0,0,0,.06);padding:14px 22px}
`

export function TaskPanel({ task, onClose, onPatch, onDelete }: {
  task: Task
  onClose: () => void
  onPatch: (updates: Partial<Task>) => void
  onDelete: () => void
}) {
  const [title, setTitle] = useState(task.title)
  const [body, setBody] = useState(task.body ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const done = task.status === 'done'
  const late = isOverdue(task)
  const recordUrl = task.linked_type && task.linked_id && RECORD_URL[task.linked_type] ? `${RECORD_URL[task.linked_type]}${task.linked_id}` : null

  const saveTitle = () => { const t = title.trim(); if (t && t !== task.title) onPatch({ title: t }); else setTitle(task.title) }
  const saveBody = () => { if (body !== (task.body ?? '')) onPatch({ body: body || null }) }

  return (
    <aside className="tkp" role="dialog" aria-label={`Task: ${task.title}`}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '14px 16px 0 22px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span className="tk-tag">{task.linked_type ? linkTypeLabel(task.linked_type) : 'Task'}</span>
          {task.recurrence_type && task.recurrence_type !== 'none' && <span className="tk-tag">Repeats {task.recurrence_type}</span>}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {recordUrl && <a className="tk-btn" style={{ minHeight: 34, fontSize: 13 }} href={recordUrl}>Open {linkTypeLabel(task.linked_type).toLowerCase()}</a>}
          <button type="button" onClick={onClose} aria-label="Close task" style={{ width: 40, height: 40, border: 0, background: 'none', fontSize: 22, color: T.ink3, cursor: 'pointer', borderRadius: 8 }}>×</button>
        </span>
      </div>

      <div className="tkp-body">
        <div>
          <label className="tk-sr" htmlFor="tkp-title">Title</label>
          <textarea id="tkp-title" className="tkp-title" rows={2} value={title} onChange={e => setTitle(e.target.value)} onBlur={saveTitle}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLTextAreaElement).blur() } }} />
          <div className="tk-sub" style={{ marginTop: 4 }}>
            {task.created_by_name ? `Created by ${task.created_by_name}` : 'Created'}{task.created_at ? ` · ${new Date(task.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ''}
          </div>
        </div>

        <div className="tkp-fld">
          <label className="l" htmlFor="tkp-status">Status</label>
          <span><select id="tkp-status" className="tk-select" value={task.status} onChange={e => onPatch({ status: e.target.value as TaskStatus })}>
            {STATUS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select></span>

          <label className="l" htmlFor="tkp-priority">Priority</label>
          <span><select id="tkp-priority" className="tk-select" value={task.priority} onChange={e => onPatch({ priority: e.target.value as TaskPriority })}>
            {(Object.keys(PRIORITY) as TaskPriority[]).map(p => <option key={p} value={p}>{PRIORITY[p].label}</option>)}
          </select></span>

          <span className="l">Owner</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><span className="tk-av">{initials(task.assigned_to_name)}</span>{task.assigned_to_name ?? 'Unassigned'}</span>

          <label className="l" htmlFor="tkp-due">Due</label>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <input id="tkp-due" type="date" className="tk-input" value={task.due_date ?? ''} onChange={e => onPatch({ due_date: e.target.value || null })} />
            {late && <span className="tk-due late">Overdue since {fmtDue(task.due_date)}</span>}
          </span>

          <span className="l">{task.linked_type ? linkTypeLabel(task.linked_type) : 'Site'}</span>
          <span>{task.linked_label ? (recordUrl ? <a href={recordUrl}>{task.linked_label}</a> : task.linked_label) : <span className="tk-sub">Internal — not linked to a site or record</span>}</span>
        </div>

        <div>
          <label className="tkp-hdr" htmlFor="tkp-body" style={{ display: 'block' }}>Description</label>
          <textarea id="tkp-body" className="tk-text" placeholder="Add details…" value={body} onChange={e => setBody(e.target.value)} onBlur={saveBody} />
        </div>

        {task.todo_attachments && task.todo_attachments.length > 0 && (
          <div>
            <div className="tkp-hdr">Attachments</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {task.todo_attachments.map(a => <a key={a.id} href={a.url} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>{a.name}</a>)}
            </div>
          </div>
        )}
      </div>

      <div className="tkp-foot">
        <button type="button" className="tk-btn pri" onClick={() => onPatch({ status: done ? 'open' : 'done' })}>{done ? 'Reopen' : 'Mark done'}</button>
        {!done && <button type="button" className="tk-btn" onClick={() => onPatch({ due_date: addDays(task.due_date && task.due_date >= localISO() ? task.due_date : localISO(), 1) })}>Snooze 1 day</button>}
        <span style={{ flex: 1 }} />
        {confirmDelete
          ? <><button type="button" className="tk-btn" onClick={() => setConfirmDelete(false)}>Keep</button><button type="button" className="tk-btn" style={{ color: T.red, borderColor: 'rgba(215,0,21,.35)' }} onClick={onDelete}>Delete task</button></>
          : <button type="button" className="tk-btn" style={{ color: T.red }} onClick={() => setConfirmDelete(true)}>Delete</button>}
      </div>
    </aside>
  )
}

export default TaskPanel
