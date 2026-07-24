'use client'

/**
 * TodoBoard — Monday-simple, 5th-grader-easy task board for My Day.
 * List view with filters (Mine / Team / Overdue / Today / This Week), quick-add,
 * one-tap complete, and an inline editor (priority, due date, status, notes,
 * assignee when available). Wired to /api/todos (GET/POST) + /api/todos/[id] (PATCH).
 * Calendar view is a follow-on (outsourceable).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'

type Todo = {
  id: string
  title: string
  body?: string | null
  priority: 'high' | 'normal' | 'low'
  status: 'open' | 'in_progress' | 'done'
  due_date: string | null
  assigned_to?: string | null
  assigned_to_name?: string | null
  linked_type?: string | null
  linked_label?: string | null
  parent_todo_id?: string | null
}
type Filter = 'mine' | 'team' | 'overdue' | 'today' | 'week'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'mine', label: 'Mine' }, { id: 'team', label: 'Team' },
  { id: 'overdue', label: 'Overdue' }, { id: 'today', label: 'Today' }, { id: 'week', label: 'This Week' },
]
const PRIORITY_COLOR: Record<string, string> = { high: '#f87171', normal: '#7dd3fc', low: '#94a3b8' }

function todayISO() { return new Date().toISOString().slice(0, 10) }
function weekEndISO() { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10) }

export function TodoBoard() {
  const [filter, setFilter] = useState<Filter>('today')
  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)
  const [quick, setQuick] = useState('')
  const [busy, setBusy] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const view = filter === 'team' ? 'team' : 'mine'
      const res = await fetch(`/api/todos?view=${view}&limit=200`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? 'Could not load tasks.')
      setTodos((data.records ?? data.todos ?? []) as Todo[])
      setMsg(null)
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Could not load tasks.') }
    finally { setLoading(false) }
  }, [filter])

  useEffect(() => { void load() }, [load])

  const shown = useMemo(() => {
    const open = todos.filter(t => t.status !== 'done')
    const t = todayISO(), w = weekEndISO()
    if (filter === 'overdue') return open.filter(x => x.due_date && x.due_date < t)
    if (filter === 'today') return open.filter(x => x.due_date === t)
    if (filter === 'week') return open.filter(x => x.due_date && x.due_date >= t && x.due_date <= w)
    return todos // mine / team → show all (incl. done at bottom)
  }, [todos, filter])

  async function quickAdd() {
    const title = quick.trim()
    if (!title) return
    setBusy(true)
    try {
      const res = await fetch('/api/todos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, due_date: filter === 'today' ? todayISO() : null }) })
      if (!res.ok) throw new Error('Could not add task.')
      setQuick(''); await load()
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Could not add task.') }
    finally { setBusy(false) }
  }

  async function patch(id: string, updates: Record<string, unknown>) {
    setBusy(true)
    try {
      const res = await fetch(`/api/todos/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.error ?? 'Update failed.') }
      await load()
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Update failed.') }
    finally { setBusy(false) }
  }

  const selectedTodo = useMemo(() => shown.find(t => t.id === selectedId) ?? null, [shown, selectedId])

  // Push a task's due date forward by N days (Snooze).
  function snoozeDays(iso: string | null, days: number): string {
    const base = iso ? new Date(`${iso}T00:00:00`) : new Date()
    base.setDate(base.getDate() + days)
    return base.toISOString().slice(0, 10)
  }

  return (
    <div className="space-y-3">
      {/* Filters + planner link */}
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-white/10 bg-[#0e1e38] p-1">
          {FILTERS.map(f => {
            const active = filter === f.id
            return (
              <button key={f.id} type="button" onClick={() => { setFilter(f.id); setOpenId(null); setSelectedId(null) }}
                className={`rounded-lg px-3 py-1 text-[11px] font-semibold transition-all ${active ? 'border border-cyan-500/40 bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-slate-200'}`}>
                {f.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Quick add */}
      <div className="flex gap-2">
        <input value={quick} onChange={e => setQuick(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void quickAdd() }}
          placeholder="Add a task and press Enter…" className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
          style={{ background: 'rgba(15,23,42,0.65)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.9)' }} />
        <button type="button" disabled={busy || !quick.trim()} onClick={() => void quickAdd()} className="rounded-xl px-4 py-2 text-xs font-bold disabled:opacity-40" style={{ background: 'rgba(34,211,238,0.2)', border: '1px solid rgba(34,211,238,0.4)', color: '#67e8f9' }}>Add</button>
      </div>

      {msg && <div className="rounded-xl p-3 text-xs" style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#fca5a5' }}>{msg}</div>}
      {loading && <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Loading tasks…</div>}
      {!loading && shown.length === 0 && <div className="rounded-2xl p-4 text-xs" style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.42)' }}>No tasks here. Add one above.</div>}

      {/* Selected-task action bar — the side-panel actions operate on the chosen task */}
      {selectedTodo && (
        <div className="rounded-2xl p-3" style={{ background: 'rgba(34,211,238,0.10)', border: '1px solid rgba(34,211,238,0.28)' }}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.16em]" style={{ color: 'rgba(221,214,254,0.85)' }}>Selected task</div>
              <div className="truncate text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.92)' }}>{selectedTodo.title}</div>
            </div>
            <button type="button" onClick={() => setSelectedId(null)} className="shrink-0 rounded-full px-2.5 py-1 text-[11px]" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}>Clear</button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => void patch(selectedTodo.id, { status: selectedTodo.status === 'done' ? 'open' : 'done' })} className="rounded-xl px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-40" style={{ background: 'linear-gradient(135deg, #34d399, #059669)' }}>{selectedTodo.status === 'done' ? 'Mark open' : 'Mark done'}</button>
            <button type="button" disabled={busy} onClick={() => void patch(selectedTodo.id, { due_date: todayISO() })} className="rounded-xl px-3 py-1.5 text-[11px] font-semibold disabled:opacity-40" style={{ background: 'rgba(0,124,255,0.16)', border: '1px solid rgba(0,200,255,0.30)', color: '#bfe9ff' }}>Due today</button>
            <button type="button" disabled={busy} onClick={() => void patch(selectedTodo.id, { due_date: snoozeDays(selectedTodo.due_date, 1) })} className="rounded-xl px-3 py-1.5 text-[11px] font-semibold disabled:opacity-40" style={{ background: 'rgba(251,191,36,0.14)', border: '1px solid rgba(251,191,36,0.30)', color: '#fcd34d' }}>Snooze +1 day</button>
            <button type="button" disabled={busy} onClick={() => void patch(selectedTodo.id, { priority: 'high' })} className="rounded-xl px-3 py-1.5 text-[11px] font-semibold disabled:opacity-40" style={{ background: 'rgba(248,113,113,0.14)', border: '1px solid rgba(248,113,113,0.30)', color: '#fca5a5' }}>Make high priority</button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="space-y-1.5">
        {shown.map(t => {
          const done = t.status === 'done'
          const overdue = !done && t.due_date && t.due_date < todayISO()
          const expanded = openId === t.id
          const selected = selectedId === t.id
          return (
            <div key={t.id} className="rounded-2xl" style={{ background: selected ? 'rgba(34,211,238,0.14)' : 'rgba(15,23,42,0.6)', border: `1px solid ${selected ? 'rgba(34,211,238,0.6)' : expanded ? 'rgba(34,211,238,0.4)' : 'rgba(255,255,255,0.06)'}` }}>
              <div className="flex items-center gap-2.5 px-3 py-2.5">
                <button type="button" disabled={busy} onClick={() => void patch(t.id, { status: done ? 'open' : 'done' })}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[11px]"
                  style={{ background: done ? '#34d399' : 'transparent', border: `1.5px solid ${done ? '#34d399' : 'rgba(255,255,255,0.3)'}`, color: '#062' }}>{done ? '✓' : ''}</button>
                <button type="button" onClick={() => { setSelectedId(t.id); setOpenId(expanded ? null : t.id) }} className="min-w-0 flex-1 text-left">
                  <div className="truncate text-sm" style={{ color: done ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.9)', textDecoration: done ? 'line-through' : 'none' }}>{t.title}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    <span style={{ color: PRIORITY_COLOR[t.priority] }}>● {t.priority}</span>
                    {t.due_date && <span style={{ color: overdue ? '#f87171' : 'rgba(255,255,255,0.4)' }}>{overdue ? 'Overdue ' : ''}{t.due_date}</span>}
                    {t.assigned_to_name && <span>· {t.assigned_to_name}</span>}
                    {t.linked_label && <span>· {t.linked_label}</span>}
                  </div>
                </button>
              </div>
              {expanded && (
                <div className="space-y-2 border-t px-3 py-3" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  <div className="flex flex-wrap gap-2">
                    <label className="text-[10px]" style={{ color: 'rgba(255,255,255,0.5)' }}>Priority
                      <select defaultValue={t.priority} onChange={e => void patch(t.id, { priority: e.target.value })} className="ml-1 rounded-lg px-2 py-1 text-[11px]" style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}>
                        <option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option>
                      </select>
                    </label>
                    <label className="text-[10px]" style={{ color: 'rgba(255,255,255,0.5)' }}>Due
                      <input type="date" defaultValue={t.due_date ?? ''} onChange={e => void patch(t.id, { due_date: e.target.value || null })} className="ml-1 rounded-lg px-2 py-1 text-[11px]" style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }} />
                    </label>
                    <label className="text-[10px]" style={{ color: 'rgba(255,255,255,0.5)' }}>Status
                      <select defaultValue={t.status} onChange={e => void patch(t.id, { status: e.target.value })} className="ml-1 rounded-lg px-2 py-1 text-[11px]" style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}>
                        <option value="open">Open</option><option value="in_progress">In progress</option><option value="done">Done</option>
                      </select>
                    </label>
                  </div>
                  {t.body && <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.55)' }}>{t.body}</div>}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
