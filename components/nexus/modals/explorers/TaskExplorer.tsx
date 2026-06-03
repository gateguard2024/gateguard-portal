'use client'

import { useState, useEffect, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TodoItem {
  id:        string
  title:     string
  status:    string   // 'open' | 'in_progress' | 'done'
  priority:  string   // 'high' | 'medium' | 'low' | 'urgent'
  due_date:  string | null
  notes:     string | null
  ai_score:  number   // computed locally
}

interface Props {
  onBack:         () => void
  /** Called whenever a status change is made — syncs Command Mode cards */
  onStatusChange: (id: string, newStatus: string) => void
}

type ViewMode  = 'list' | 'kanban'
type TaskGroup = { key: string; label: string; color: string; tasks: TodoItem[] }

// ─── AI scoring ──────────────────────────────────────────────────────────────

function computeScore(t: TodoItem): number {
  const priorityBase: Record<string, number> = { urgent: 96, high: 85, medium: 66, low: 48 }
  let score = priorityBase[t.priority] ?? 60

  if (t.due_date) {
    const days = (new Date(t.due_date).getTime() - Date.now()) / 86400000
    if (days < 0)    score = Math.min(99, score + 14)   // overdue
    else if (days < 1) score = Math.min(99, score + 9)  // due today
    else if (days < 3) score = Math.min(99, score + 4)  // due this week
  }

  // Deterministic variance from id hash
  const h = Array.from(t.id).reduce((a, c) => ((a * 31) + c.charCodeAt(0)) & 0xffff, 0)
  return Math.min(99, score + (h % 7) - 3)
}

// ─── Status helpers ────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; hex: string; next: string }> = {
  open:        { label: 'To Do',       hex: '#6B7EFF', next: 'in_progress' },
  in_progress: { label: 'In Progress', hex: '#fbbf24', next: 'done'        },
  done:        { label: 'Done',        hex: '#34d399', next: 'open'        },
}

function hexRgb(h: string) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h)
  return r ? `${parseInt(r[1],16)},${parseInt(r[2],16)},${parseInt(r[3],16)}` : '107,126,255'
}

function formatDue(d: string | null): { label: string; urgent: boolean } {
  if (!d) return { label: '', urgent: false }
  const days = (new Date(d).getTime() - Date.now()) / 86400000
  if (days < -0.5)     return { label: 'Overdue',    urgent: true  }
  if (days < 0.5)      return { label: 'Due today',  urgent: true  }
  if (days < 1.5)      return { label: 'Tomorrow',   urgent: false }
  return { label: `${Math.ceil(days)}d`, urgent: false }
}

// ─── List row ─────────────────────────────────────────────────────────────────

function TaskRow({
  task, onStatusChange,
}: { task: TodoItem; onStatusChange: (id: string, s: string) => void }) {
  const [status, setStatus]   = useState(task.status)
  const [cycling, setCycling] = useState(false)
  const meta       = STATUS_META[status] ?? STATUS_META['open']
  const scoreColor = task.ai_score >= 85 ? '#34d399' : task.ai_score >= 70 ? '#fbbf24' : '#f87171'
  const due        = formatDue(task.due_date)

  function cycleStatus() {
    setCycling(true)
    const next = meta.next
    setStatus(next)
    onStatusChange(task.id, next)
    setTimeout(() => setCycling(false), 300)
  }

  return (
    <div
      className="grid items-center gap-2 px-3 py-2 rounded-lg transition-all"
      style={{
        gridTemplateColumns: '64px 1fr 52px 52px 30px',
        background: 'rgba(255,255,255,0.025)',
        border:     '0.5px solid rgba(255,255,255,0.06)',
        opacity:    cycling ? 0.6 : 1,
      }}
    >
      {/* Status pill — click to cycle */}
      <button
        onClick={cycleStatus}
        className="px-1.5 py-0.5 rounded text-[10px] font-medium transition-all text-left"
        style={{
          background: `rgba(${hexRgb(meta.hex)},0.14)`,
          border:     `0.5px solid rgba(${hexRgb(meta.hex)},0.3)`,
          color:      meta.hex,
        }}
      >
        {meta.label}
      </button>

      {/* Title */}
      <p
        className="text-xs truncate"
        style={{
          color:          'rgba(255,255,255,0.82)',
          textDecoration: status === 'done' ? 'line-through' : 'none',
          opacity:        status === 'done' ? 0.45 : 1,
        }}
      >
        {task.title}
      </p>

      {/* Due date */}
      {due.label ? (
        <span
          className="text-[10px] px-1.5 py-0.5 rounded text-center"
          style={{
            background: due.urgent ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.04)',
            color:      due.urgent ? '#f87171' : 'rgba(255,255,255,0.3)',
            border:     due.urgent ? '0.5px solid rgba(239,68,68,0.25)' : '0.5px solid rgba(255,255,255,0.07)',
          }}
        >
          {due.label}
        </span>
      ) : <span />}

      {/* Priority */}
      <span
        className="text-[10px] capitalize text-right"
        style={{ color: task.priority === 'high' || task.priority === 'urgent' ? '#fbbf24' : 'rgba(255,255,255,0.3)' }}
      >
        {task.priority}
      </span>

      {/* AI Score */}
      <span
        className="text-[10px] font-mono font-bold text-right"
        style={{ color: scoreColor }}
      >
        {task.ai_score}
      </span>
    </div>
  )
}

// ─── Kanban column ────────────────────────────────────────────────────────────

function KanbanColumn({
  group, onStatusChange,
}: { group: TaskGroup; onStatusChange: (id: string, s: string) => void }) {
  const rgb = hexRgb(group.color)
  return (
    <div className="flex-1 min-w-0 space-y-1.5">
      <div className="flex items-center gap-1.5 mb-2">
        <span
          className="w-2 h-2 rounded-full"
          style={{ background: group.color, boxShadow: `0 0 5px ${group.color}80` }}
        />
        <span className="text-[10px] uppercase tracking-wider" style={{ color: `rgba(${rgb},0.8)` }}>
          {group.label}
        </span>
        <span
          className="text-[9px] px-1.5 py-0.5 rounded-full font-mono"
          style={{ background: `rgba(${rgb},0.12)`, color: `rgba(${rgb},0.7)` }}
        >
          {group.tasks.length}
        </span>
      </div>
      {group.tasks.map(t => (
        <div
          key={t.id}
          className="p-2.5 rounded-xl"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border:     `0.5px solid rgba(${rgb},0.15)`,
          }}
        >
          <p className="text-xs leading-snug mb-1.5" style={{ color: 'rgba(255,255,255,0.8)' }}>
            {t.title}
          </p>
          <div className="flex items-center justify-between">
            <button
              onClick={() => onStatusChange(t.id, STATUS_META[t.status]?.next ?? 'open')}
              className="text-[9px] px-1.5 py-0.5 rounded"
              style={{
                background: `rgba(${hexRgb(STATUS_META[t.status]?.hex ?? '#6B7EFF')},0.12)`,
                color: STATUS_META[t.status]?.hex ?? '#6B7EFF',
              }}
            >
              → Move
            </button>
            <span
              className="text-[9px] font-mono font-bold"
              style={{ color: t.ai_score >= 85 ? '#34d399' : t.ai_score >= 70 ? '#fbbf24' : '#f87171' }}
            >
              AI {t.ai_score}
            </span>
          </div>
        </div>
      ))}
      {group.tasks.length === 0 && (
        <div className="rounded-xl py-4 text-center" style={{ border: `0.5px dashed rgba(${rgb},0.15)` }}>
          <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>Empty</p>
        </div>
      )}
    </div>
  )
}

// ─── Explorer ─────────────────────────────────────────────────────────────────

export function TaskExplorer({ onBack, onStatusChange }: Props) {
  const [todos,    setTodos]    = useState<TodoItem[]>([])
  const [loading,  setLoading]  = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [newTask,  setNewTask]  = useState('')
  const [saving,   setSaving]   = useState(false)

  useEffect(() => {
    fetch('/api/todos?limit=20&status=open,in_progress')
      .then(r => r.json())
      .then(d => {
        const raw: TodoItem[] = (d.todos ?? d.records ?? [])
        setTodos(raw.map(t => ({ ...t, ai_score: computeScore(t) })))
      })
      .catch(() => setTodos([]))
      .finally(() => setLoading(false))
  }, [])

  // Bidirectional sync: update local state AND bubble up to MyDayModal
  const handleStatusChange = useCallback((id: string, newStatus: string) => {
    setTodos(prev => prev.map(t =>
      t.id === id ? { ...t, status: newStatus, ai_score: computeScore({ ...t, status: newStatus }) } : t
    ))
    onStatusChange(id, newStatus)
  }, [onStatusChange])

  async function handleAddTask() {
    if (!newTask.trim() || saving) return
    setSaving(true)
    try {
      const res  = await fetch('/api/todos', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ title: newTask.trim(), status: 'open', priority: 'medium' }),
      })
      const data = await res.json()
      const t = data.todo ?? data
      if (t?.id) {
        const scored = { ...t, ai_score: computeScore(t) }
        setTodos(prev => [scored, ...prev])
      }
      setNewTask('')
    } finally { setSaving(false) }
  }

  const sorted = [...todos].sort((a, b) => b.ai_score - a.ai_score)

  const groups: TaskGroup[] = [
    { key: 'open',        label: 'To Do',       color: '#6B7EFF', tasks: sorted.filter(t => t.status === 'open') },
    { key: 'in_progress', label: 'In Progress', color: '#fbbf24', tasks: sorted.filter(t => t.status === 'in_progress') },
    { key: 'done',        label: 'Done',        color: '#34d399', tasks: sorted.filter(t => t.status === 'done') },
  ]

  return (
    <>
      <style>{`
        @keyframes nexus-slide-up {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .nexus-explorer { animation: nexus-slide-up 0.22s cubic-bezier(0.16,1,0.3,1) both; }
      `}</style>

      <div className="nexus-explorer space-y-3">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 transition-colors"
            style={{ color: 'rgba(52,211,153,0.55)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(52,211,153,0.95)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(52,211,153,0.55)')}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-xs font-medium">Tasks</span>
          </button>
          <div className="flex-1 h-px" style={{ background: 'rgba(52,211,153,0.15)' }} />

          {/* View toggle */}
          <div className="flex gap-0.5">
            {(['list', 'kanban'] as ViewMode[]).map(v => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                className="px-2 py-0.5 rounded text-[10px] font-medium transition-all capitalize"
                style={
                  viewMode === v
                    ? { background: 'rgba(52,211,153,0.18)', color: '#34d399', border: '0.5px solid rgba(52,211,153,0.35)' }
                    : { background: 'transparent', color: 'rgba(255,255,255,0.25)', border: '0.5px solid rgba(255,255,255,0.07)' }
                }
              >
                {v}
              </button>
            ))}
          </div>

          <span
            className="text-[9px] uppercase tracking-widest font-mono px-2 py-0.5 rounded"
            style={{ background: 'rgba(52,211,153,0.08)', color: 'rgba(52,211,153,0.55)', border: '0.5px solid rgba(52,211,153,0.18)' }}
          >
            Explorer
          </span>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-6 justify-center">
            <div className="w-4 h-4 rounded-full border-2 border-emerald-600/30 border-t-emerald-400 animate-spin" />
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Loading tasks…</p>
          </div>
        ) : viewMode === 'list' ? (
          <>
            {/* Column headers */}
            <div
              className="grid px-3 py-1 rounded-lg"
              style={{ gridTemplateColumns: '64px 1fr 52px 52px 30px', background: 'rgba(255,255,255,0.03)' }}
            >
              {['Status', 'Task', 'Due', 'Priority', 'AI'].map(h => (
                <span key={h} className="text-[9px] uppercase tracking-wider"
                  style={{ color: 'rgba(255,255,255,0.25)' }}>{h}</span>
              ))}
            </div>

            <div className="space-y-1 overflow-y-auto pr-0.5" style={{ maxHeight: '38vh', scrollbarWidth: 'none' }}>
              {sorted.length === 0 && (
                <p className="text-xs text-center py-6" style={{ color: 'rgba(255,255,255,0.22)' }}>
                  No open tasks
                </p>
              )}
              {sorted.map(t => (
                <TaskRow key={t.id} task={t} onStatusChange={handleStatusChange} />
              ))}
            </div>
          </>
        ) : (
          <div className="flex gap-3 overflow-y-auto pr-0.5" style={{ maxHeight: '38vh', scrollbarWidth: 'none' }}>
            {groups.map(g => (
              <KanbanColumn key={g.key} group={g} onStatusChange={handleStatusChange} />
            ))}
          </div>
        )}

        {/* Quick add */}
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)' }}
        >
          <input
            value={newTask}
            onChange={e => setNewTask(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddTask()}
            placeholder="+ Add a task…"
            className="flex-1 bg-transparent outline-none text-xs"
            style={{ color: 'rgba(255,255,255,0.75)', caretColor: '#34d399' }}
          />
          {newTask.trim() && (
            <button
              onClick={handleAddTask}
              disabled={saving}
              className="text-[10px] px-2.5 py-1 rounded-lg transition-all"
              style={{ background: 'rgba(52,211,153,0.18)', color: '#34d399', border: '0.5px solid rgba(52,211,153,0.3)' }}
            >
              {saving ? '…' : 'Add'}
            </button>
          )}
        </div>

        <div className="flex items-center justify-between pt-0.5" style={{ borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
          <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>
            {todos.filter(t => t.status !== 'done').length} open · sorted by AI score
          </span>
          <span className="text-[9px] uppercase tracking-widest" style={{ color: 'rgba(52,211,153,0.3)' }}>
            Nexus Tasks · Explorer Mode
          </span>
        </div>
      </div>
    </>
  )
}
