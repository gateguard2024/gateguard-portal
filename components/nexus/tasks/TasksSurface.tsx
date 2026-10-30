'use client'

/**
 * Tasks — My Day's task screen (Jira-style board + Wrike-style list).
 * Design: "Dealer · My Day" page of the design canvas (Tasks · Board / List / Task detail).
 * Data: /api/todos (list, create), /api/todos/[id] (detail, edit, delete) and its sub-routes
 * (checklist, comments, links, time, attachments); /api/todos/people for the pickers.
 * Needs migration 194 (Waiting status, task keys, checklist, subtasks, comments, history…).
 * Rendered in a portal on <body> so the dealer app's bottom bar can't cover it.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { TaskBoard } from './TaskBoard'
import { TaskList } from './TaskList'
import { TaskPanel } from './TaskPanel'

export * from './shared'
import { T, FONT, PAGE_BG, addDays, localISO, type DueFilter, type GroupBy, type Person, type Scope, type Task, type TaskStatus } from './shared'

// Shared CSS for the four Tasks files. Raw so server and client output match.
const CSS = `
.tk-root{position:fixed;inset:0;z-index:90;overflow-y:auto;${PAGE_BG}color:${T.ink};font-family:${FONT};font-size:14px;line-height:1.45;letter-spacing:-0.01em;-webkit-overflow-scrolling:touch}
.tk-root *{box-sizing:border-box}
.tk-main{max-width:1600px;margin:0 auto;padding:20px 32px calc(64px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:16px}
.tk-root a{color:${T.blue};text-decoration:none}
.tk-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:40px;padding:0 14px;border-radius:10px;border:1px solid ${T.line2};background:#fff;color:${T.ink};font:600 14px ${FONT};cursor:pointer;white-space:nowrap}
.tk-btn:hover{background:#FAFAFB}
.tk-btn.pri{background:${T.blue};border-color:${T.blue};color:#fff}
.tk-btn.pri:hover{background:${T.blueDark}}
.tk-btn:disabled{opacity:.5;cursor:default}
.tk-back{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:0 4px;border:0;background:none;color:${T.blue};font:500 14px ${FONT};cursor:pointer}
.tk-seg{display:inline-flex;gap:4px;padding:3px;border-radius:10px;background:rgba(0,0,0,.06)}
.tk-seg button{min-height:34px;display:inline-flex;align-items:center;gap:6px;padding:0 14px;border-radius:8px;border:0;background:none;font:500 13px ${FONT};color:${T.ink2};cursor:pointer}
.tk-seg button[aria-pressed=true]{background:#fff;color:${T.ink};font-weight:600;box-shadow:0 1px 2px rgba(0,0,0,.08)}
.tk-chip{display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:0 12px;border-radius:999px;border:1px solid ${T.line2};background:#fff;font:500 13px ${FONT};color:${T.ink2};cursor:pointer}
.tk-chip[aria-pressed=true]{background:${T.ink};border-color:${T.ink};color:#fff}
.tk-chip b{font-weight:600}
.tk-input,.tk-select,.tk-text{font:500 13px ${FONT};min-height:34px;padding:0 10px;border:1px solid ${T.line2};border-radius:8px;background:#fff;color:${T.ink}}
.tk-text{width:100%;min-height:88px;padding:10px;font-size:14px;font-weight:400;line-height:1.45;resize:vertical;border-radius:10px}
.tk-input:focus,.tk-select:focus,.tk-text:focus{outline:2px solid ${T.blue};outline-offset:-1px;border-color:transparent}
.tk-bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.tk-sub{color:${T.ink3};font-size:13px}
.tk-tag{display:inline-flex;align-items:center;gap:5px;padding:1px 8px;border-radius:6px;font-size:12px;font-weight:500;white-space:nowrap;background:#F2F2F4;color:${T.ink2};max-width:100%;overflow:hidden;text-overflow:ellipsis}
.tk-tag.wo{background:#E8F1FD;color:${T.blueDark}}
.tk-st{display:inline-flex;align-items:center;gap:6px;padding:2px 9px;border-radius:999px;font-size:12px;font-weight:600;white-space:nowrap}
.tk-due{font-size:12px;color:${T.ink2};white-space:nowrap;font-variant-numeric:tabular-nums}
.tk-due.late{color:${T.red};font-weight:600}
.tk-av{width:24px;height:24px;border-radius:50%;background:#2C3A55;color:#fff;font-size:10px;font-weight:600;display:inline-flex;align-items:center;justify-content:center;flex:none}
.tk-dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex:none}
.tk-msg{padding:10px 14px;border-radius:10px;background:#FDECEA;color:#8A1209;font-size:13px}
.tk-empty{padding:28px;text-align:center;color:${T.ink3};font-size:13px}
.tk-sr{position:absolute;left:-9999px}
.tk-head h1{color:#fff}
.tk-head .tk-back{color:#8EC1FF}
.tk-head .tk-seg{background:rgba(255,255,255,.12)}
.tk-head .tk-seg button{color:#C9D2E0}
.tk-head .tk-seg button[aria-pressed=true]{background:#fff;color:${T.ink}}
@media (min-width:1200px){.tk-root.panel-open .tk-main{padding-right:592px}}
@media (max-width:899px){.tk-main{padding:14px 16px 64px}}
`

export function TasksSurface({ onClose, initialDue = 'all', initialTaskId = null }: { onClose: () => void; initialDue?: DueFilter; initialTaskId?: string | null }) {
  const [view, setView] = useState<'board' | 'list'>(() => {
    try { return (localStorage.getItem('nexus.tasks.view') as 'board' | 'list') || 'board' } catch { return 'board' }
  })
  const [scope, setScope] = useState<Scope>('mine')
  const [due, setDue] = useState<DueFilter>(initialDue)
  const [groupBy, setGroupBy] = useState<GroupBy>('site')
  const [q, setQ] = useState('')
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(initialTaskId)
  // A notification clicked while Tasks is open → switch the panel to that task.
  useEffect(() => {
    function onOpenTask(e: Event) {
      const id = (e as CustomEvent<string>).detail
      if (id) { setExpanded(false); setOpenId(id) }
    }
    window.addEventListener('nexus:open-task', onOpenTask)
    return () => window.removeEventListener('nexus:open-task', onOpenTask)
  }, [])
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [people, setPeople] = useState<Person[]>([])
  const [me, setMe] = useState<string>('')

  // Team list for the owner / watcher / @mention pickers.
  useEffect(() => {
    fetch('/api/todos/people').then(r => r.json()).then(d => { setPeople(d.people ?? []); setMe(d.me ?? '') }).catch(() => {})
  }, [])

  useEffect(() => { try { localStorage.setItem('nexus.tasks.view', view) } catch { /* ignore */ } }, [view])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/todos?view=${scope}&limit=500`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? 'Could not load tasks.')
      setTasks((data.records ?? data.todos ?? []) as Task[])
      setMsg(null)
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Could not load tasks.') }
    finally { setLoading(false) }
  }, [scope])
  useEffect(() => { void load() }, [load])

  // Escape: close an open editor first, then the full page, then the panel, then Tasks.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.querySelector('[data-tk-pop]')) return
      if (expanded) setExpanded(false)
      else if (openId) setOpenId(null)
      else onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openId, expanded, onClose])

  const patch = useCallback(async (id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, ...updates, ...(updates.status ? { completed_at: updates.status === 'done' ? new Date().toISOString() : null } : {}) } : t)))
    try {
      const res = await fetch(`/api/todos/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? 'Could not save.')
      if (data?.spawned) setTasks(prev => [...prev, data.spawned as Task]) // next repeat of a recurring task
      setMsg(null)
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Could not save.'); void load() }
  }, [load])

  const create = useCallback(async (title: string, status: TaskStatus = 'open') => {
    const t = title.trim()
    if (!t) return
    try {
      const res = await fetch('/api/todos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: t, status, due_date: due === 'today' ? localISO() : null }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? 'Could not create the task.')
      setTasks(prev => [data as Task, ...prev])
      setNewTitle(''); setAdding(false); setOpenId((data as Task).id)
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Could not create the task.') }
  }, [due])

  // The panel tells the list about changes so the board/list stay in step without a reload.
  const rowChanged = useCallback((id: string, changes: Partial<Task>) => {
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, ...changes } : t)))
  }, [])
  const rowAdded = useCallback((t: Task) => setTasks(prev => (prev.some(x => x.id === t.id) ? prev : [t, ...prev])), [])
  const rowRemoved = useCallback((id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id && t.parent_task_id !== id))
    setOpenId(null); setExpanded(false)
  }, [])

  const today = localISO(); const weekEnd = addDays(today, 7)
  const counts = useMemo(() => {
    const open = tasks.filter(t => t.status !== 'done')
    return {
      today: open.filter(t => t.due_date === today).length,
      overdue: open.filter(t => t.due_date && t.due_date < today).length,
      week: open.filter(t => t.due_date && t.due_date >= today && t.due_date <= weekEnd).length,
    }
  }, [tasks, today, weekEnd])

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return tasks.filter(t => {
      if (needle && !`${t.key ?? ''} ${t.title} ${t.linked_label ?? ''} ${t.assigned_to_name ?? ''} ${(t.tags ?? []).join(' ')}`.toLowerCase().includes(needle)) return false
      if (due === 'all') return true
      if (t.status === 'done') return false
      if (due === 'today') return t.due_date === today
      if (due === 'overdue') return !!t.due_date && t.due_date < today
      return !!t.due_date && t.due_date >= today && t.due_date <= weekEnd
    })
  }, [tasks, q, due, today, weekEnd])

  const openTask = tasks.find(t => t.id === openId) ?? null
  const dueChip = (key: DueFilter, label: string, n: number, dot?: string) => (
    <button type="button" className="tk-chip" aria-pressed={due === key} onClick={() => setDue(due === key ? 'all' : key)}>
      {dot && <span className="tk-dot" style={{ background: dot }} />}{label} <b>{n}</b>
    </button>
  )

  // Lock the page behind Tasks so only Tasks scrolls.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  return createPortal(
    <div className={`tk-root${openTask && !expanded ? ' panel-open' : ''}`} role="dialog" aria-modal="true" aria-label="Tasks">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="tk-main">
        <div className="tk-head" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
          <div>
            <button type="button" className="tk-back" onClick={onClose}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>My Day
            </button>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em' }}>Tasks</h1>
          </div>
          <div className="tk-bar">
            <div className="tk-seg" role="group" aria-label="View">
              <button type="button" aria-pressed={view === 'board'} onClick={() => setView('board')}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><rect x="3" y="4" width="5" height="16" rx="1" /><rect x="10" y="4" width="5" height="11" rx="1" /><rect x="17" y="4" width="4" height="7" rx="1" /></svg>Board
              </button>
              <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>List
              </button>
            </div>
            <button type="button" className="tk-btn pri" onClick={() => setAdding(a => !a)} aria-expanded={adding}>New task</button>
          </div>
        </div>

        {adding && (
          <form onSubmit={e => { e.preventDefault(); void create(newTitle) }} className="tk-bar" style={{ background: '#fff', borderRadius: 12, padding: 12, boxShadow: '0 1px 2px rgba(0,0,0,.04), 0 6px 20px -12px rgba(0,0,0,.18)' }}>
            <label className="tk-sr" htmlFor="tk-new">New task title</label>
            <input id="tk-new" autoFocus className="tk-input" style={{ flex: '1 1 320px', minHeight: 40, fontSize: 14 }} placeholder="What needs to get done?" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
            <button type="submit" className="tk-btn pri" disabled={!newTitle.trim()}>Add</button>
            <button type="button" className="tk-btn" onClick={() => { setAdding(false); setNewTitle('') }}>Cancel</button>
          </form>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div className="tk-bar">
            <button type="button" className="tk-chip" aria-pressed={scope === 'mine'} onClick={() => setScope('mine')}>Mine</button>
            <button type="button" className="tk-chip" aria-pressed={scope === 'team'} onClick={() => setScope('team')}>Team</button>
            <span style={{ width: 1, height: 22, background: T.line2 }} aria-hidden="true" />
            {dueChip('today', 'Today', counts.today)}
            {dueChip('overdue', 'Overdue', counts.overdue, '#FF3B30')}
            {dueChip('week', 'This week', counts.week)}
          </div>
          <div className="tk-bar">
            <label><span className="tk-sr">Search tasks</span><input type="search" className="tk-input" placeholder="Search tasks" value={q} onChange={e => setQ(e.target.value)} style={{ width: 200 }} /></label>
            {view === 'list' && (
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#C9D2E0' }}>Group by
                <select className="tk-select" value={groupBy} onChange={e => setGroupBy(e.target.value as GroupBy)}>
                  <option value="site">Site / record</option><option value="status">Status</option><option value="owner">Owner</option><option value="due">Due date</option>
                </select>
              </label>
            )}
          </div>
        </div>

        {msg && <div className="tk-msg" role="alert">{msg}</div>}

        {loading && tasks.length === 0 ? <div className="tk-empty">Loading tasks…</div>
          : view === 'board'
            ? <TaskBoard tasks={shown} openId={openId} onOpen={setOpenId} onMove={(id, status) => void patch(id, { status })} onAdd={(title, status) => void create(title, status)} />
            : <TaskList tasks={shown} groupBy={groupBy} openId={openId} onOpen={setOpenId} onToggleDone={t => void patch(t.id, { status: t.status === 'done' ? 'open' : 'done' })} />}
      </div>

      {openId && (
        <TaskPanel
          key={openId}
          taskId={openId}
          row={openTask}
          allTasks={tasks}
          people={people}
          me={me}
          expanded={expanded}
          onExpand={setExpanded}
          onClose={() => { setOpenId(null); setExpanded(false) }}
          onOpen={id => setOpenId(id)}
          onRowChange={rowChanged}
          onRowAdd={rowAdded}
          onRowRemove={rowRemoved}
        />
      )}
    </div>,
    document.body,
  )
}

export default TasksSurface
