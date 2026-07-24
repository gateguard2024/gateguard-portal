'use client'

// NexusActionsRail — collapsible RIGHT-edge pop-out for "Upcoming Actions"
// (to-dos + follow-ups). Per Russel's July 2026 direction the right rail carries
// actions/to-dos/follow-ups; the left rail is the launch pad.
//
// Data: real open/in-progress todos from /api/todos (self + assigned to me),
// soonest due first. Cards are high-contrast frosted LIGHT tiles on the dark
// #0e1e38 panel (mockup §right). Desktop-only (lg+), state persists.

import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Calendar, Clock } from 'lucide-react'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { ListChecks } = require('lucide-react') as any

interface TodoRow {
  id: string
  title: string
  body?: string | null
  priority?: string | null
  status?: string | null
  due_date?: string | null
  linked_label?: string | null
}

const OPEN_KEY = 'gg_nexus_actions_open'

function dueMeta(due?: string | null): { label: string; tone: 'over' | 'today' | 'soon' | 'none' } {
  if (!due) return { label: 'No date', tone: 'none' }
  const d = new Date(due + 'T00:00:00')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000)
  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, tone: 'over' }
  if (diff === 0) return { label: 'Today', tone: 'today' }
  if (diff === 1) return { label: 'Tomorrow', tone: 'soon' }
  return { label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), tone: 'soon' }
}

const PRIORITY_DOT: Record<string, string> = {
  urgent: '#ef4444', high: '#f59e0b', medium: '#3b82f6', low: '#64748b',
}

export function NexusActionsRail({ onOpenList }: { onOpenList?: () => void }) {
  const [open, setOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [rows, setRows] = useState<TodoRow[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try { setOpen(localStorage.getItem(OPEN_KEY) === '1') } catch { /* closed */ }
    setHydrated(true)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/todos?status=open,in_progress&limit=25', { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      const list: TodoRow[] = data.records ?? data.todos ?? []
      setRows(list)
    } catch { setRows([]) }
    finally { setLoading(false); setLoaded(true) }
  }, [])

  // Load the first time the panel is opened; refresh on each open thereafter.
  useEffect(() => { if (open) void load() }, [open, load])

  function toggle() {
    setOpen((v) => {
      try { localStorage.setItem(OPEN_KEY, v ? '0' : '1') } catch { /* ignore */ }
      return !v
    })
  }

  return (
    <div className="hidden lg:block">
      {/* Edge toggle tab — rides the right edge. */}
      <button
        type="button"
        onClick={toggle}
        aria-label={open ? 'Hide actions' : 'Show actions'}
        className="fixed z-40 flex h-16 w-6 -translate-y-1/2 items-center justify-center rounded-l-xl transition-all duration-300"
        style={{
          top: 'calc(50% - 84px)',
          right: open ? 300 : 0,
          background: '#0e1e38',
          border: '1px solid rgba(45,212,191,0.30)',
          borderRight: 'none',
          color: '#7DE5FF',
          boxShadow: '0 0 18px rgba(45,212,191,0.20)',
        }}
      >
        {open ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      <aside
        aria-hidden={!open}
        className="fixed bottom-0 right-0 top-0 z-30 flex w-[300px] flex-col pt-6 transition-transform duration-300"
        style={{
          transform: hydrated && open ? 'translateX(0)' : 'translateX(100%)',
          background: '#0e1e38',
          borderLeft: '1px solid rgba(45,212,191,0.22)',
          boxShadow: '-18px 0 60px rgba(0,0,0,0.45)',
        }}
      >
        <div className="flex items-center justify-between px-5 pb-4">
          <div>
            <div className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: 'rgba(255,255,255,0.95)' }}>
              <ListChecks size={15} style={{ color: '#7DE5FF' }} />
              Upcoming Actions
            </div>
            <div className="mt-0.5 text-[10px] uppercase tracking-[0.16em]" style={{ color: 'rgba(125,229,255,0.6)' }}>
              To-dos &amp; follow-ups
            </div>
          </div>
          {onOpenList && (
            <button
              type="button"
              onClick={onOpenList}
              className="rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors"
              style={{ background: 'rgba(45,212,191,0.14)', border: '1px solid rgba(45,212,191,0.30)', color: '#7DE5FF' }}
            >
              Open
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6">
          {loading && !loaded && (
            <div className="px-2 py-6 text-center text-[12px]" style={{ color: 'rgba(255,255,255,0.5)' }}>Loading…</div>
          )}
          {loaded && rows.length === 0 && (
            <div className="rounded-xl px-3 py-6 text-center text-[12px]" style={{ background: 'rgba(255,255,255,0.9)', color: '#334155' }}>
              You&apos;re all caught up — no open actions.
            </div>
          )}
          {rows.map((t) => {
            const due = dueMeta(t.due_date)
            const dot = PRIORITY_DOT[(t.priority ?? 'medium').toLowerCase()] ?? PRIORITY_DOT.medium
            const dueColor = due.tone === 'over' ? '#dc2626' : due.tone === 'today' ? '#b45309' : '#475569'
            return (
              <div
                key={t.id}
                className="mb-2 rounded-xl px-3 py-2.5"
                style={{
                  background: 'rgba(255,255,255,0.94)',
                  border: '1px solid rgba(255,255,255,0.7)',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.28)',
                }}
              >
                <div className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: dot }} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-semibold" style={{ color: '#0f172a' }}>{t.title}</div>
                    {t.linked_label && (
                      <div className="mt-0.5 truncate text-[10.5px]" style={{ color: '#64748b' }}>{t.linked_label}</div>
                    )}
                    <div className="mt-1 flex items-center gap-1 text-[10.5px] font-medium" style={{ color: dueColor }}>
                      {due.tone === 'none' ? <Calendar size={11} /> : <Clock size={11} />}
                      {due.label}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </aside>
    </div>
  )
}
