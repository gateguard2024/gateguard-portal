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
const VIOLET = '#8B5CF6'

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

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map(f => {
          const active = filter === f.id
          return (
            <button key={f.id} type="button" onClick={() => { setFilter(f.id); setOpenId(null) }}
              className="rounded-full px-3 py-1.5 text-[11px] font-semibold"
              style={{ background: active ? `${VIOLET}26` : 'rgba(0,0,0,0.18)', border: `1px solid ${active ? VIOLET : 'rgba(255,255,255,0.08)'}`, color: active ? '#ddd6fe' : 'rgba(255,255,255,0.55)' }}>
              {f.label}
            </button>
          )
        })}
      </div>

      {/* Quick add */}
      <div className="flex gap-2">
        <input value={quick} onChange={e => setQuick(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void quickAdd() }}
          placeholder="Add a task and press Enter…" className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
          style={{ background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.9)' }} />
        <button type="button" disabled={busy || !quick.trim()} onClick={() => void quickAdd()} className="rounded-xl px-4 py-2 text-xs font-semibold text-white disabled:opacity-40" style={{ background: 'linear-gradient(135deg, #8B5CF6, #007CFF)' }}>Add</button>
      </div>

      {msg && <div className="rounded-xl p-3 text-xs" style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#fca5a5' }}>{msg}</div>}
      {loading && <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Loading tasks…</div>}
      {!loading && shown.length === 0 && <div className="rounded-2xl p-4 text-xs" style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.42)' }}>No tasks here. Add one above.</div>}

      {/* List */}
      <div className="space-y-1.5">
        {shown.map(t => {
          const done = t.status === 'done'
          const overdue = !done && t.due_date && t.due_date < todayISO()
          const expanded = openId === t.id
          return (
            <div key={t.id} className="rounded-2xl" style={{ background: 'rgba(0,0,0,0.18)', border: `1px solid ${expanded ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.06)'}` }}>
              <div className="flex items-center gap-2.5 px-3 py-2.5">
                <button type="button" disabled={busy} onClick={() => void patch(t.id, { status: done ? 'open' : 'done' })}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[11px]"
                  style={{ background: done ? '#34d399' : 'transparent', border: `1.5px solid ${done ? '#34d399' : 'rgba(255,255,255,0.3)'}`, color: '#062' }}>{done ? '✓' : ''}</button>
                <button type="button" onClick={() => setOpenId(expanded ? null : t.id)} className="min-w-0 flex-1 text-left">
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
                      <select defaultValue={t.priority} onChange={e => void patch(t.id, { priority: e.target.value })} className="ml-1 rounded-lg px-2 py-1 text-[11px]" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}>
                        <option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option>
                      </select>
                    </label>
                    <label className="text-[10px]" style={{ color: 'rgba(255,255,255,0.5)' }}>Due
                      <input type="date" defaultValue={t.due_date ?? ''} onChange={e => void patch(t.id, { due_date: e.target.value || null })} className="ml-1 rounded-lg px-2 py-1 text-[11px]" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }} />
                    </label>
                    <label className="text-[10px]" style={{ color: 'rgba(255,255,255,0.5)' }}>Status
                      <select defaultValue={t.status} onChange={e => void patch(t.id, { status: e.target.value })} className="ml-1 rounded-lg px-2 py-1 text-[11px]" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}>
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
