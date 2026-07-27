'use client'

import { useState, useEffect, useCallback } from 'react'
import { ActionCard }        from '@/components/nexus/ActionCard'
import { ActionCommandBar }  from '@/components/nexus/ActionCommandBar'
import { ModalScopeContext, type ModalScope } from '@/components/nexus/context/ModalScopeContext'
import { WOExplorer,  type WOItem }   from '@/components/nexus/modals/explorers/WOExplorer'
import { TaskExplorer, type TodoItem } from '@/components/nexus/modals/explorers/TaskExplorer'
import { CalExplorer }                 from '@/components/nexus/modals/explorers/CalExplorer'

// ─── State machine ────────────────────────────────────────────────────────────

type WOView =
  | 'menu'          // Stage 1 — selection cards
  | 'work-orders'   // Stage 2 Command — top 3 ActionCards
  | 'wo-explorer'   // Stage 2 Explorer — full data grid
  | 'tasks'         // Stage 2 Command — top 3 AI-scored tasks
  | 'task-explorer' // Stage 2 Explorer — Monday.com board
  | 'calendar'      // Stage 2 Command — appointment cards
  | 'cal-explorer'  // Stage 2 Explorer — full timeline

const VIEW_SCOPE: Record<WOView, ModalScope> = {
  'menu':          'global',
  'work-orders':   'dispatch_work_orders',
  'wo-explorer':   'dispatch_work_orders',
  'tasks':         'tasks',
  'task-explorer': 'tasks',
  'calendar':      'calendar',
  'cal-explorer':  'calendar',
}

// ─── WO helpers ───────────────────────────────────────────────────────────────

const PRIORITY_COLOR: Record<string, 'red' | 'amber' | 'blue' | 'green'> = {
  critical: 'red', high: 'amber', normal: 'blue', low: 'green',
}
const STATUS_LABEL: Record<string, string> = {
  open: 'Pending', scheduled: 'Assigned', in_progress: 'In Progress', completed: 'Done',
}

// ─── Task AI score ────────────────────────────────────────────────────────────

function taskScore(t: TodoItem): number {
  const base: Record<string, number> = { urgent: 96, high: 85, medium: 66, low: 48 }
  let s = base[t.priority] ?? 60
  if (t.due_date) {
    const days = (new Date(t.due_date).getTime() - Date.now()) / 86400000
    if (days < 0)   s = Math.min(99, s + 14)
    if (days < 1)   s = Math.min(99, s + 9)
  }
  const h = Array.from(t.id).reduce((a, c) => ((a * 31) + c.charCodeAt(0)) & 0xffff, 0)
  return Math.min(99, s + (h % 7) - 3)
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function BackBtn({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 mb-3 transition-colors"
      style={{ color: `rgba(${color},0.55)` }}
      onMouseEnter={e => (e.currentTarget.style.color = `rgba(${color},0.95)`)}
      onMouseLeave={e => (e.currentTarget.style.color = `rgba(${color},0.55)`)}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <span className="text-xs font-medium tracking-wide">{label}</span>
    </button>
  )
}

function CommandResult({ text, onDismiss }: { text: string; onDismiss: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-xl px-4 py-3"
      style={{ background: 'rgba(107,126,255,0.07)', border: '0.5px solid rgba(107,126,255,0.22)' }}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0 mt-0.5" aria-hidden="true">
        <path d="M7 1L8.2 5.4H13L9.4 7.8L10.8 12L7 9.4L3.2 12L4.6 7.8L1 5.4H5.8L7 1Z" fill="#6B7EFF"/>
      </svg>
      <p className="text-xs flex-1 leading-relaxed" style={{ color: 'rgba(255,255,255,0.72)' }}>{text}</p>
      <button onClick={onDismiss} className="flex-shrink-0 opacity-30 hover:opacity-70 transition-opacity" aria-label="Dismiss">
        <svg width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden="true">
          <path d="M1 1l7 7M8 1L1 8" stroke="rgba(255,255,255,0.8)" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  )
}

function LoadingSpinner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-4 px-4 rounded-xl"
      style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)' }}>
      <div className="w-4 h-4 rounded-full border-2 border-blue-600/30 border-t-blue-500 animate-spin flex-shrink-0" />
      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{label}</p>
    </div>
  )
}

// ─── Menu card ────────────────────────────────────────────────────────────────

function MenuCard({
  label, subtitle, icon, accentHex, badge, onClick,
}: { label: string; subtitle: string; icon: React.ReactNode; accentHex: string; badge?: string | number; onClick: () => void }) {
  const [hover, setHover] = useState(false)
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(accentHex)
  const rgb = r ? `${parseInt(r[1],16)},${parseInt(r[2],16)},${parseInt(r[3],16)}` : '107,126,255'

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="relative flex flex-col items-start gap-2.5 w-full rounded-2xl p-4 text-left transition-all duration-200"
      style={{
        background: hover ? `rgba(${rgb},0.14)` : `rgba(${rgb},0.06)`,
        border:     hover ? `1px solid rgba(${rgb},0.45)` : `1px solid rgba(${rgb},0.18)`,
        transform:  hover ? 'translateY(-2px)' : 'none',
        boxShadow:  hover ? `0 8px 28px rgba(${rgb},0.2), 0 0 0 0.5px rgba(${rgb},0.08)` : 'none',
      }}
    >
      {badge !== undefined && (
        <span className="absolute top-3 right-3 min-w-[20px] text-center text-[10px] font-bold px-1.5 py-0.5 rounded-full"
          style={{ background: `rgba(${rgb},0.25)`, color: accentHex }}>
          {badge}
        </span>
      )}
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `rgba(${rgb},0.16)`, border: `0.5px solid rgba(${rgb},0.3)` }}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>{label}</p>
        <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.32)' }}>{subtitle}</p>
      </div>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="mt-auto self-end transition-all duration-200"
        style={{ opacity: hover ? 0.9 : 0.3, transform: hover ? 'translateX(2px)' : 'none' }} aria-hidden="true">
        <path d="M2 6h8M6 2l4 4-4 4" stroke={accentHex} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  )
}

// ─── Scoped command bar wrapper ───────────────────────────────────────────────

function ScopedBar({ onSubmit }: { onSubmit: (q: string) => void }) {
  return (
    <div className="pt-3" style={{ borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
      <ActionCommandBar onSubmit={onSubmit} />
    </div>
  )
}

// ─── Task action card (command mode) ─────────────────────────────────────────

function TaskCommandCard({
  task, onComplete,
}: { task: TodoItem; onComplete: (id: string) => void }) {
  const scoreColor = task.ai_score >= 85 ? '#34d399' : task.ai_score >= 70 ? '#fbbf24' : '#f87171'
  const isOverdue  = task.due_date && (new Date(task.due_date).getTime() - Date.now()) < 0
  const isDueToday = task.due_date && !isOverdue &&
    (new Date(task.due_date).getTime() - Date.now()) < 86400000

  return (
    <div
      className="flex items-start gap-3 px-3 py-3 rounded-xl"
      style={{
        background: isOverdue
          ? 'rgba(239,68,68,0.06)'
          : 'rgba(52,211,153,0.05)',
        border: isOverdue
          ? '0.5px solid rgba(239,68,68,0.2)'
          : '0.5px solid rgba(52,211,153,0.15)',
      }}
    >
      {/* Priority stripe */}
      <div className="flex-shrink-0 mt-0.5">
        <div
          className="w-0.5 h-8 rounded-full"
          style={{ background: isOverdue ? '#f87171' : isDueToday ? '#fbbf24' : '#34d399' }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium leading-snug" style={{ color: 'rgba(255,255,255,0.88)' }}>
          {task.title}
        </p>
        {task.due_date && (
          <p className="text-[10px] mt-0.5" style={{ color: isOverdue ? '#f87171' : 'rgba(255,255,255,0.3)' }}>
            {isOverdue ? 'Overdue' : isDueToday ? 'Due today' : `Due ${new Date(task.due_date).toLocaleDateString()}`}
          </p>
        )}
      </div>

      {/* AI score */}
      <span
        className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded flex-shrink-0"
        style={{ background: 'rgba(0,0,0,0.3)', color: scoreColor, border: `0.5px solid ${scoreColor}40` }}
      >
        AI {task.ai_score}
      </span>

      {/* Complete */}
      <button
        onClick={() => onComplete(task.id)}
        className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all"
        style={{ background: 'rgba(52,211,153,0.1)', border: '0.5px solid rgba(52,211,153,0.25)' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(52,211,153,0.22)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(52,211,153,0.1)')}
        aria-label="Mark complete"
      >
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
          <path d="M1.5 5.5l3 3 5-5" stroke="#34d399" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  )
}

// ─── Calendar appointment card (command mode) ─────────────────────────────────

function AppointmentCard({ event }: { event: { id: string; title: string; type: string; start_time: string; is_all_day: boolean } }) {
  const mins    = (new Date(event.start_time).getTime() - Date.now()) / 60000
  const isPulse = mins > 0 && mins < 30
  const isPast  = mins < -60

  function formatTime(iso: string) {
    try { return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) }
    catch { return '' }
  }

  const TYPE_HEX: Record<string, string> = {
    todo: '#6B7EFF', work_order: '#059669', work_order_phase: '#C2410C',
    pm_schedule: '#0B7285', gcal: '#7C3AED', crm_activity: '#fbbf24',
  }
  const hex = TYPE_HEX[event.type] ?? '#6B7EFF'
  const r   = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  const rgb = r ? `${parseInt(r[1],16)},${parseInt(r[2],16)},${parseInt(r[3],16)}` : '107,126,255'

  return (
    <>
      {isPulse && (
        <style>{`
          @keyframes appt-pulse {
            0%, 100% { border-color: rgba(${rgb},0.2); }
            50%       { border-color: rgba(${rgb},0.6); box-shadow: 0 0 10px rgba(${rgb},0.2); }
          }
          .appt-pulse-${event.id.replace(/-/g,'_')} {
            animation: appt-pulse 2s ease-in-out infinite;
          }
        `}</style>
      )}
      <div
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${isPulse ? `appt-pulse-${event.id.replace(/-/g,'_')}` : ''}`}
        style={{
          background: isPast ? 'rgba(255,255,255,0.02)' : `rgba(${rgb},0.06)`,
          border:     `0.5px solid rgba(${rgb},${isPast ? 0.08 : 0.2})`,
          opacity:    isPast ? 0.45 : 1,
        }}
      >
        <div
          className="w-1.5 h-8 rounded-full flex-shrink-0"
          style={{ background: hex }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate" style={{ color: 'rgba(255,255,255,0.85)' }}>
            {event.title}
          </p>
          <p className="text-[10px] mt-0.5" style={{ color: `rgba(${rgb},0.7)` }}>
            {event.is_all_day ? 'All day' : formatTime(event.start_time)}
            {isPulse && <span className="ml-2 font-medium">· Starting soon</span>}
          </p>
        </div>
        {isPulse && (
          <span
            className="text-[9px] px-2 py-0.5 rounded-full font-medium flex-shrink-0"
            style={{ background: `rgba(${rgb},0.2)`, color: hex, border: `0.5px solid rgba(${rgb},0.4)` }}
          >
            {Math.round(mins)} min
          </span>
        )}
      </div>
    </>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MyDayModal() {
  const [view,       setView]      = useState<WOView>('menu')
  const [cmdResult,  setCmdResult] = useState<string | null>(null)
  const [cmdLoading, setCmdLoad]   = useState(false)

  // ── Work Orders ──────────────────────────────────────────────────────────
  const [workOrders, setWorkOrders] = useState<WOItem[]>([])
  const [woLoading,  setWOLoading]  = useState(true)
  const [woDismissed, setWODis]     = useState<Set<string>>(new Set())

  // ── Tasks ────────────────────────────────────────────────────────────────
  const [todos,        setTodos]      = useState<TodoItem[]>([])
  const [todosLoading, setTodosLoad]  = useState(false)
  const [todosFetched, setTodosFetched] = useState(false)
  const [todoDismissed, setTodoDis]   = useState<Set<string>>(new Set())

  // ── Calendar ─────────────────────────────────────────────────────────────
  const [calEvents,    setCalEvents]   = useState<Array<{ id: string; title: string; type: string; start_time: string; is_all_day: boolean }>>([])
  const [calLoading,   setCalLoading]  = useState(false)
  const [calFetched,   setCalFetched]  = useState(false)

  // Fetch WOs immediately (drives menu badge)
  useEffect(() => {
    fetch('/api/dispatch/work-orders/today')
      .then(r => r.json())
      .then(d => setWorkOrders(d.work_orders ?? []))
      .catch(() => setWorkOrders([]))
      .finally(() => setWOLoading(false))
  }, [])

  // Lazy-fetch todos when tasks view is first opened
  useEffect(() => {
    if ((view === 'tasks' || view === 'task-explorer') && !todosFetched) {
      setTodosLoad(true); setTodosFetched(true)
      fetch('/api/todos?limit=10&status=open,in_progress')
        .then(r => r.json())
        .then(d => {
          const raw: TodoItem[] = d.todos ?? d.records ?? []
          setTodos(raw.map(t => ({ ...t, ai_score: taskScore(t) }))
            .sort((a, b) => b.ai_score - a.ai_score))
        })
        .catch(() => setTodos([]))
        .finally(() => setTodosLoad(false))
    }
  }, [view, todosFetched])

  // Lazy-fetch calendar events when calendar view is first opened
  useEffect(() => {
    if ((view === 'calendar' || view === 'cal-explorer') && !calFetched) {
      setCalLoading(true); setCalFetched(true)
      const today    = new Date(); today.setHours(0,0,0,0)
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
      fetch(`/api/calendar/events?start=${today.toISOString()}&end=${tomorrow.toISOString()}`)
        .then(r => r.json())
        .then(d => {
          const raw = d.events ?? d ?? []
          setCalEvents(raw.sort((a: { start_time: string }, b: { start_time: string }) =>
            new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
          ))
        })
        .catch(() => setCalEvents([]))
        .finally(() => setCalLoading(false))
    }
  }, [view, calFetched])

  // ── Assignment ────────────────────────────────────────────────────────────
  async function executeAssignment(wo: WOItem) {
    if (!wo.recommended_tech) throw new Error('No technician available.')
    const res  = await fetch('/api/assistant/execute', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toolName: 'assign_technician',
        toolArgs: { work_order_id: wo.id, technician_id: wo.recommended_tech.id,
          technician_name: wo.recommended_tech.name, reasoning: wo.ai_reasoning },
      }),
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.error ?? 'Assignment failed.')
  }

  // ── Task complete ─────────────────────────────────────────────────────────
  const handleTaskComplete = useCallback(async (id: string) => {
    setTodoDis(prev => new Set([...prev, id]))
    await fetch('/api/assistant/execute', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toolName: 'complete_todo', toolArgs: { id } }),
    })
  }, [])

  // ── Bidirectional task sync from explorer ─────────────────────────────────
  const handleTaskStatusChange = useCallback((id: string, status: string) => {
    setTodos(prev => prev.map(t =>
      t.id === id ? { ...t, status, ai_score: taskScore({ ...t, status }) } : t
    ))
    if (status === 'done') setTodoDis(prev => new Set([...prev, id]))
  }, [])

  // ── Scoped command handler ────────────────────────────────────────────────
  const handleCommand = useCallback(async (query: string) => {
    setCmdLoad(true); setCmdResult(null)
    const scope   = VIEW_SCOPE[view]
    const visible = workOrders.filter(w => !woDismissed.has(w.id))
    try {
      const res  = await fetch('/api/assistant/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages:    [{ role: 'user', content: query }],
          scope,
          contextData: { work_order_ids: visible.map(w => w.id), work_order_count: visible.length },
        }),
      })
      const data = await res.json()
      setCmdResult(data.response ?? data.message ?? 'Done.')
    } catch { setCmdResult('Something went wrong. Try again.') }
    finally  { setCmdLoad(false) }
  }, [view, workOrders, woDismissed])

  const woVisible    = workOrders.filter(w => !woDismissed.has(w.id))
  const topThreeWO   = woVisible.slice(0, 3)
  const topThreeTasks = todos.filter(t => !todoDismissed.has(t.id) && t.status !== 'done').slice(0, 3)
  const upcomingCal  = calEvents
    .filter(e => (new Date(e.start_time).getTime() - Date.now()) > -3600000)
    .slice(0, 3)

  // ───────────────────────────────────────────────────────────────────────────
  // STAGE 1 — MENU
  // ───────────────────────────────────────────────────────────────────────────
  if (view === 'menu') {
    return (
      <div className="space-y-4">
        <p className="text-[10px] uppercase tracking-[0.16em]" style={{ color: 'rgba(255,255,255,0.22)' }}>
          Select your area of focus
        </p>
        <div className="grid grid-cols-3 gap-3">
          <MenuCard label="Work Orders" subtitle="Today's jobs" accentHex="#6B7EFF"
            badge={!woLoading && woVisible.length > 0 ? woVisible.length : undefined}
            onClick={() => setView('work-orders')}
            icon={
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <rect x="2" y="3" width="14" height="12" rx="2" stroke="#6B7EFF" strokeWidth="1.3"/>
                <path d="M6 3V2a1 1 0 012 0v1M10 3V2a1 1 0 012 0v1" stroke="#6B7EFF" strokeWidth="1.3" strokeLinecap="round"/>
                <path d="M5 9h8M5 12h5" stroke="#6B7EFF" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            }
          />
          <MenuCard label="Open Tasks" subtitle="Your to-dos" accentHex="#34d399"
            onClick={() => setView('tasks')}
            icon={
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path d="M3 9l3.5 3.5L15 5" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            }
          />
          <MenuCard label="Schedule" subtitle="Calendar" accentHex="#fbbf24"
            onClick={() => setView('calendar')}
            icon={
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <rect x="1.5" y="3.5" width="15" height="13" rx="2" stroke="#fbbf24" strokeWidth="1.3"/>
                <path d="M5.5 2v3M12.5 2v3M1.5 8h15" stroke="#fbbf24" strokeWidth="1.3" strokeLinecap="round"/>
                <circle cx="6" cy="12" r="1" fill="#fbbf24"/>
                <circle cx="9" cy="12" r="1" fill="#fbbf24"/>
                <circle cx="12" cy="12" r="1" fill="#fbbf24"/>
              </svg>
            }
          />
        </div>
      </div>
    )
  }

  // ───────────────────────────────────────────────────────────────────────────
  // EXPLORER LAYERS — rendered by dedicated components
  // ───────────────────────────────────────────────────────────────────────────

  if (view === 'wo-explorer') {
    return (
      <ModalScopeContext.Provider value={{ scope: 'dispatch_work_orders', commandResult: cmdResult, isCommandLoading: cmdLoading }}>
        <WOExplorer
          workOrders={workOrders}
          dismissed={woDismissed}
          onAssign={executeAssignment}
          onDismiss={id => setWODis(prev => new Set([...prev, id]))}
          onBack={() => setView('work-orders')}
        />
        {cmdResult && <CommandResult text={cmdResult} onDismiss={() => setCmdResult(null)} />}
        <ScopedBar onSubmit={handleCommand} />
      </ModalScopeContext.Provider>
    )
  }

  if (view === 'task-explorer') {
    return (
      <ModalScopeContext.Provider value={{ scope: 'tasks', commandResult: cmdResult, isCommandLoading: cmdLoading }}>
        <TaskExplorer onBack={() => setView('tasks')} onStatusChange={handleTaskStatusChange} />
        {cmdResult && <CommandResult text={cmdResult} onDismiss={() => setCmdResult(null)} />}
        <ScopedBar onSubmit={handleCommand} />
      </ModalScopeContext.Provider>
    )
  }

  if (view === 'cal-explorer') {
    return (
      <ModalScopeContext.Provider value={{ scope: 'calendar', commandResult: cmdResult, isCommandLoading: cmdLoading }}>
        <CalExplorer onBack={() => setView('calendar')} />
        {cmdResult && <CommandResult text={cmdResult} onDismiss={() => setCmdResult(null)} />}
        <ScopedBar onSubmit={handleCommand} />
      </ModalScopeContext.Provider>
    )
  }

  // ───────────────────────────────────────────────────────────────────────────
  // COMMAND VIEWS
  // ───────────────────────────────────────────────────────────────────────────

  // ── Work Orders Command ────────────────────────────────────────────────────
  if (view === 'work-orders') {
    return (
      <ModalScopeContext.Provider value={{ scope: 'dispatch_work_orders', commandResult: cmdResult, isCommandLoading: cmdLoading }}>
        <div className="space-y-2">
          <BackBtn label="My Day" color="107,126,255" onClick={() => setView('menu')} />
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: 'rgba(107,126,255,0.55)' }}>
              Work orders today
            </p>
            <button
              onClick={() => setView('wo-explorer')}
              className="text-[10px] transition-colors"
              style={{ color: 'rgba(255,255,255,0.25)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.65)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.25)')}
            >
              See all →
            </button>
          </div>
          {woLoading && <LoadingSpinner label="Loading today's jobs…" />}
          {!woLoading && topThreeWO.length === 0 && (
            <div className="py-4 px-4 rounded-xl text-center"
              style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)' }}>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>No open work orders today</p>
            </div>
          )}
          {!woLoading && topThreeWO.map(wo => (
            <ActionCard key={wo.id}
              title={`${wo.wo_number}: ${wo.title}`}
              subtitle={wo.customer_name ?? undefined}
              status={STATUS_LABEL[wo.status] ?? wo.status}
              statusColor={PRIORITY_COLOR[wo.priority] ?? 'blue'}
              aiScore={wo.ai_score}
              aiContext={wo.recommended_tech ? 'Technician Recommendation' : 'No technician available'}
              reasoning={wo.ai_reasoning}
              actionLabel={wo.recommended_tech ? `Assign ${wo.recommended_tech.name}` : 'View in Dispatch'}
              confirmLabel="Confirm Assignment"
              onExecute={() => executeAssignment(wo)}
              onDismiss={() => setWODis(prev => new Set([...prev, wo.id]))}
            />
          ))}
          {cmdResult && <CommandResult text={cmdResult} onDismiss={() => setCmdResult(null)} />}
          <ScopedBar onSubmit={handleCommand} />
        </div>
      </ModalScopeContext.Provider>
    )
  }

  // ── Tasks Command ──────────────────────────────────────────────────────────
  if (view === 'tasks') {
    return (
      <ModalScopeContext.Provider value={{ scope: 'tasks', commandResult: cmdResult, isCommandLoading: cmdLoading }}>
        <div className="space-y-2">
          <BackBtn label="My Day" color="52,211,153" onClick={() => setView('menu')} />
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: 'rgba(52,211,153,0.55)' }}>
              Priority tasks
            </p>
            <button
              onClick={() => setView('task-explorer')}
              className="text-[10px] transition-colors"
              style={{ color: 'rgba(255,255,255,0.25)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.65)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.25)')}
            >
              Full board →
            </button>
          </div>
          {todosLoading && <LoadingSpinner label="Loading tasks…" />}
          {!todosLoading && topThreeTasks.length === 0 && (
            <div className="py-4 px-4 rounded-xl text-center"
              style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)' }}>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>No open tasks</p>
            </div>
          )}
          {!todosLoading && topThreeTasks.map(t => (
            <TaskCommandCard key={t.id} task={t} onComplete={handleTaskComplete} />
          ))}
          {cmdResult && <CommandResult text={cmdResult} onDismiss={() => setCmdResult(null)} />}
          <ScopedBar onSubmit={handleCommand} />
        </div>
      </ModalScopeContext.Provider>
    )
  }

  // ── Calendar Command ───────────────────────────────────────────────────────
  return (
    <ModalScopeContext.Provider value={{ scope: 'calendar', commandResult: cmdResult, isCommandLoading: cmdLoading }}>
      <div className="space-y-2">
        <BackBtn label="My Day" color="251,191,36" onClick={() => setView('menu')} />
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: 'rgba(251,191,36,0.55)' }}>
            Today's schedule
          </p>
          <button
            onClick={() => setView('cal-explorer')}
            className="text-[10px] transition-colors"
            style={{ color: 'rgba(255,255,255,0.25)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.65)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.25)')}
          >
            Full calendar →
          </button>
        </div>
        {calLoading && <LoadingSpinner label="Loading schedule…" />}
        {!calLoading && upcomingCal.length === 0 && (
          <div className="py-4 px-4 rounded-xl text-center"
            style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)' }}>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>No upcoming events today</p>
          </div>
        )}
        {!calLoading && upcomingCal.map(e => <AppointmentCard key={e.id} event={e} />)}
        {cmdResult && <CommandResult text={cmdResult} onDismiss={() => setCmdResult(null)} />}
        <ScopedBar onSubmit={handleCommand} />
      </div>
    </ModalScopeContext.Provider>
  )
}
