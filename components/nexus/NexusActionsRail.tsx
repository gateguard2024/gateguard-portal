'use client'

// NexusActionsRail — collapsible RIGHT-edge pop-out. Redesigned to be calm and
// scannable: a compact Top-5 priority list (highest urgency, oldest first) plus
// three collapsible queues — To-Dos, Follow-ups, Open Work Orders. Each queue
// lazy-loads on expand. Desktop-only (lg+); open state persists.

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Priority { id: string; type: string; title: string; urgency: string; date?: string | null; time?: string | null; link?: string | null }
interface QueueRow { id: string; title: string; meta?: string; link?: string }

const OPEN_KEY = 'gg_nexus_actions_open'
const TYPE_LABEL: Record<string, string> = { todo: 'To-do', tracker_task: 'Task', work_order: 'Work order', crm_activity: 'Follow-up' }
const URGENCY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 }

function urgencyDot(u: string) { return u === 'high' ? '#f43f5e' : u === 'medium' ? '#fbbf24' : '#22d3ee' }

function relDue(d?: string | null): string {
  if (!d) return ''
  const day = new Date(`${d}T00:00:00`)
  if (isNaN(day.getTime())) return ''
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff = Math.round((day.getTime() - today.getTime()) / 86_400_000)
  if (diff < 0) return `${Math.abs(diff)}d overdue`
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  return day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// Defensive normalizers — read whatever shape each endpoint returns.
function normTodos(d: unknown): QueueRow[] {
  const o = d as Record<string, unknown>
  const a = (o?.records ?? o?.todos ?? (Array.isArray(d) ? d : [])) as Record<string, unknown>[]
  return a.slice(0, 15).map(t => ({ id: String(t.id), title: (t.title as string) ?? 'Task', meta: t.due_date ? relDue(String(t.due_date)) : ((t.linked_label as string) ?? '') }))
}
function normActivities(d: unknown): QueueRow[] {
  const a = (Array.isArray(d) ? d : ((d as Record<string, unknown>)?.records ?? [])) as Record<string, unknown>[]
  return a.slice(0, 15).map(x => ({ id: String(x.id), title: (x.subject as string) ?? 'Follow-up', meta: x.due_at ? relDue(String(x.due_at).split('T')[0]) : ((x.type as string) ?? ''), link: x.opportunity_id ? `/crm/opportunities/${x.opportunity_id}` : '/crm' }))
}
function normWorkOrders(d: unknown): QueueRow[] {
  const o = d as Record<string, unknown>
  const a = (o?.work_orders ?? o?.jobs ?? o?.records ?? (Array.isArray(d) ? d : [])) as Record<string, unknown>[]
  return a.filter(w => { const st = String(w.status ?? '').toLowerCase(); return st !== 'complete' && st !== 'completed' && st !== 'closed' })
    .slice(0, 15).map(w => ({ id: String(w.id), title: (w.title as string) ?? (w.summary as string) ?? 'Work order', meta: String(w.status ?? '').replace(/_/g, ' '), link: `/maintenance/${w.id}` }))
}

function QueueSection({ title, endpoint, normalize }: { title: string; endpoint: string; normalize: (d: unknown) => QueueRow[] }) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<QueueRow[] | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || rows !== null) return
    setLoading(true)
    fetch(endpoint, { cache: 'no-store' })
      .then(r => r.json()).then(d => setRows(normalize(d)))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [open, rows, endpoint, normalize])

  return (
    <div className="border-t border-white/5">
      <button type="button" onClick={() => setOpen(o => !o)} className="flex w-full items-center justify-between px-1 py-2.5 transition-colors hover:text-white">
        <span className="flex items-center gap-2 text-[12.5px] font-medium text-slate-200">
          <ChevronRight size={13} className="transition-transform" style={{ color: '#7dd3fc', transform: open ? 'rotate(90deg)' : 'none' }} />
          {title}
        </span>
        <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-slate-300" style={{ background: 'rgba(255,255,255,0.06)' }}>{rows === null ? '·' : rows.length}</span>
      </button>
      {open && (
        <div className="space-y-0.5 pb-2 pl-6 pr-0.5">
          {loading && <div className="px-1 py-1 text-[11px] text-slate-500">Loading…</div>}
          {!loading && rows && rows.length === 0 && <div className="px-1 py-1 text-[11px] text-slate-500">Nothing here.</div>}
          {rows?.map(row => (
            <a key={row.id} href={row.link || '#'} className="block rounded-md px-2 py-1.5 transition-colors hover:bg-white/5">
              <span className="block truncate text-[12px] text-slate-200">{row.title}</span>
              {row.meta && <span className="block truncate text-[10px] text-slate-400">{row.meta}</span>}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

export function NexusActionsRail({ open: openProp, onToggle }: { onOpenList?: () => void; open?: boolean; onToggle?: () => void }) {
  const controlled = openProp !== undefined
  const [openState, setOpenState] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [priorities, setPriorities] = useState<Priority[]>([])
  const [loaded, setLoaded] = useState(false)
  const open = controlled ? !!openProp : openState

  useEffect(() => {
    if (!controlled) { try { setOpenState(localStorage.getItem(OPEN_KEY) === '1') } catch { /* closed */ } }
    setHydrated(true)
  }, [controlled])

  useEffect(() => {
    if (!open || loaded) return
    fetch('/api/nexus/my-day', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        const items = (d?.top_10 ?? []) as Priority[]
        const sorted = [...items].sort((a, b) =>
          (URGENCY_RANK[a.urgency] ?? 1) - (URGENCY_RANK[b.urgency] ?? 1) ||
          (a.date ? new Date(a.date).getTime() : Infinity) - (b.date ? new Date(b.date).getTime() : Infinity))
        setPriorities(sorted.slice(0, 5))
      })
      .catch(() => setPriorities([]))
      .finally(() => setLoaded(true))
  }, [open, loaded])

  function toggle() {
    if (controlled) { onToggle?.(); return }
    setOpenState(v => { try { localStorage.setItem(OPEN_KEY, v ? '0' : '1') } catch { /* ignore */ } return !v })
  }

  return (
    <div className="hidden lg:block">
      <button
        type="button"
        onClick={toggle}
        aria-label={open ? 'Hide actions' : 'Show actions'}
        className="fixed z-40 flex h-16 w-6 -translate-y-1/2 items-center justify-center rounded-l-xl transition-all duration-300"
        style={{ top: 'calc(50% - 84px)', right: open ? 300 : 0, background: '#0e1e38', border: '1px solid rgba(45,212,191,0.30)', borderRight: 'none', color: '#7DE5FF', boxShadow: '0 0 18px rgba(45,212,191,0.20)' }}
      >
        {open ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      <aside
        aria-hidden={!open}
        className="fixed bottom-0 right-0 top-0 z-30 flex w-[300px] flex-col pt-6 transition-transform duration-300"
        style={{ transform: hydrated && open ? 'translateX(0)' : 'translateX(100%)', background: '#0e1e38', borderLeft: '1px solid rgba(45,212,191,0.22)', boxShadow: '-18px 0 60px rgba(0,0,0,0.45)' }}
      >
        <div className="px-4 pb-3">
          <div className="text-[13px] font-semibold text-white">Priorities</div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Top 5 · then your queues</div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
          <div className="space-y-0.5">
            {!loaded && <div className="px-1 py-2 text-[12px] text-slate-500">Loading…</div>}
            {loaded && priorities.length === 0 && <div className="rounded-lg px-2 py-3 text-[12px] text-slate-400">You&apos;re all caught up.</div>}
            {priorities.map((item, i) => (
              <a key={`${item.type}-${item.id}`} href={item.link || '#'} className="flex items-start gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-white/5">
                <span className="mt-px w-3.5 shrink-0 text-right text-[11px] font-semibold text-slate-500">{i + 1}</span>
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: urgencyDot(item.urgency) }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-medium text-slate-100">{item.title}</span>
                  <span className="block truncate text-[10.5px] text-slate-400">{TYPE_LABEL[item.type] ?? item.type}{item.date ? ` · ${relDue(item.date)}` : ''}</span>
                </span>
              </a>
            ))}
          </div>

          <div className="mt-4">
            <QueueSection title="To-Dos" endpoint="/api/todos?status=open,in_progress&limit=25" normalize={normTodos} />
            <QueueSection title="Follow-ups" endpoint="/api/crm/activities" normalize={normActivities} />
            <QueueSection title="Open Work Orders" endpoint="/api/maintenance" normalize={normWorkOrders} />
          </div>
        </div>
      </aside>
    </div>
  )
}
