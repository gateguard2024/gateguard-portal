'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import {
  Plus, X, Check, Clock, Calendar, Search, ChevronDown, ChevronRight,
  Users, Wrench, Building2, FileText, Filter, MoreHorizontal,
  AlertTriangle, Layers, TrendingUp, Loader2, RefreshCw,
  ClipboardList, CheckCircle2, ArrowRight, Zap,
} from 'lucide-react'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const {
  LayoutGrid, LayoutList, GanttChartSquare, BarChart3,
  Briefcase, DollarSign, Grid3X3, KanbanSquare, Timer,
  SlidersHorizontal, ArrowUpRight, Edit2, Hammer,
} = require('lucide-react') as any

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewMode = 'grid' | 'board' | 'timeline' | 'chart' | 'list'

interface TrackerItem {
  id: string
  title: string
  status: 'new' | 'in_progress' | 'done' | 'blocked' | 'wont_fix'
  start_date?: string | null
  due_date?: string | null
  progress_pct?: number
  owner_name?: string | null
  group_id: string
  position: number
}

interface TrackerGroup {
  id: string
  name: string
  color: string
  position: number
  items: TrackerItem[]
}

interface Job {
  id: string
  title: string
  job_type: 'new_install' | 'service' | 'small_install_to_service'
  status: 'active' | 'on_hold' | 'completed' | 'cancelled'
  opportunity_id?: string | null
  opportunity_name?: string | null
  site_id?: string | null
  site_name?: string | null
  assigned_tech_id?: string | null
  assigned_tech_name?: string | null
  total_value?: number | null
  start_date?: string | null
  target_completion_date?: string | null
  completed_at?: string | null
  notes?: string | null
  created_at: string
  updated_at: string
  groups?: TrackerGroup[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const JOB_TYPE_LABEL: Record<string, string> = {
  new_install: 'New Install',
  service: 'Service',
  small_install_to_service: 'Install → Service',
}

const JOB_TYPE_COLOR: Record<string, string> = {
  new_install:              '#6B7EFF',
  service:                  '#059669',
  small_install_to_service: '#D97706',
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  active:    { label: 'Active',     color: '#059669', bg: '#ECFDF5', icon: Zap },
  on_hold:   { label: 'On Hold',    color: '#D97706', bg: '#FFFBEB', icon: Clock },
  completed: { label: 'Completed',  color: '#6B7EFF', bg: '#EEF2FF', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled',  color: '#6B7280', bg: '#F3F4F6', icon: X },
}

const ITEM_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  new:         { label: 'Not Started', color: '#6B7280', bg: '#F3F4F6' },
  in_progress: { label: 'In Progress', color: '#D97706', bg: '#FFFBEB' },
  done:        { label: 'Done',        color: '#059669', bg: '#ECFDF5' },
  blocked:     { label: 'Blocked',     color: '#DC2626', bg: '#FEF2F2' },
  wont_fix:    { label: "Won't Do",    color: '#6B7280', bg: '#F3F4F6' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcJobProgress(job: Job): number {
  if (!job.groups) return 0
  const allItems = job.groups.flatMap(g => g.items)
  if (allItems.length === 0) return 0
  const done = allItems.filter(i => i.status === 'done' || i.status === 'wont_fix').length
  return Math.round((done / allItems.length) * 100)
}

function fmtDate(d?: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

function fmtCurrency(v?: number | null): string {
  if (v == null) return '—'
  return '$' + v.toLocaleString()
}

function daysBetween(a?: string | null, b?: string | null): number {
  if (!a || !b) return 0
  return Math.max(0, Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / 86400000))
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
      style={{ background: JOB_TYPE_COLOR[type] + '18', color: JOB_TYPE_COLOR[type] }}
    >
      {JOB_TYPE_LABEL[type] ?? type}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: '#6B7280', bg: '#F3F4F6', icon: Clock }
  const Icon = cfg.icon
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      <Icon size={10} />
      {cfg.label}
    </span>
  )
}

function ItemStatusPill({ status, onChange }: { status: string; onChange?: (s: string) => void }) {
  const cfg = ITEM_STATUS_CONFIG[status] ?? ITEM_STATUS_CONFIG.new
  return (
    <select
      value={status}
      onChange={e => onChange?.(e.target.value)}
      className="text-xs font-medium rounded px-1.5 py-0.5 border-0 cursor-pointer appearance-none"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {Object.entries(ITEM_STATUS_CONFIG).map(([k, v]) => (
        <option key={k} value={k}>{v.label}</option>
      ))}
    </select>
  )
}

function ProgressBar({ pct, height = 6 }: { pct: number; height?: number }) {
  const color = pct >= 80 ? '#059669' : pct >= 40 ? '#6B7EFF' : '#D97706'
  return (
    <div className="rounded-full overflow-hidden" style={{ height, background: '#E5E7EB' }}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  )
}

// ─── Grid View (Smartsheet-style) ─────────────────────────────────────────────

function GridView({ jobs, onItemStatusChange, onRefresh }: {
  jobs: Job[]
  onItemStatusChange: (itemId: string, status: string) => Promise<void>
  onRefresh: () => void
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(jobs.map(j => j.id)))
  const [groupExpanded, setGroupExpanded] = useState<Set<string>>(new Set())

  const toggleJob = (id: string) => setExpanded(prev => {
    const n = new Set(prev)
    n.has(id) ? n.delete(id) : n.add(id)
    return n
  })
  const toggleGroup = (id: string) => setGroupExpanded(prev => {
    const n = new Set(prev)
    n.has(id) ? n.delete(id) : n.add(id)
    return n
  })

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500 w-[340px]">Task / Phase</th>
            <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500 w-[120px]">Status</th>
            <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500 w-[120px]">Assignee</th>
            <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500 w-[110px]">Start</th>
            <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500 w-[110px]">Due</th>
            <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500 w-[100px]">Progress</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map(job => {
            const progress = calcJobProgress(job)
            const isOpen = expanded.has(job.id)
            return (
              <>
                {/* Job header row */}
                <tr
                  key={`job-${job.id}`}
                  className="border-b border-gray-200 bg-white hover:bg-gray-50 cursor-pointer group"
                  onClick={() => toggleJob(job.id)}
                >
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 flex items-center justify-center text-gray-400 flex-shrink-0">
                        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </div>
                      <div
                        className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                        style={{ background: JOB_TYPE_COLOR[job.job_type] }}
                      />
                      <span className="font-semibold text-sm text-gray-900">{job.title}</span>
                      <TypeBadge type={job.job_type} />
                    </div>
                  </td>
                  <td className="py-2.5 px-3"><StatusBadge status={job.status} /></td>
                  <td className="py-2.5 px-3 text-sm text-gray-600">{job.assigned_tech_name ?? '—'}</td>
                  <td className="py-2.5 px-3 text-sm text-gray-500">{fmtDate(job.start_date)}</td>
                  <td className="py-2.5 px-3 text-sm text-gray-500">{fmtDate(job.target_completion_date)}</td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <ProgressBar pct={progress} />
                      <span className="text-xs text-gray-400 w-6 text-right">{progress}%</span>
                    </div>
                  </td>
                </tr>

                {/* Expanded: groups + items */}
                {isOpen && (job.groups ?? []).map(group => {
                  const groupOpen = !groupExpanded.has(group.id)
                  return (
                    <>
                      {/* Group header */}
                      <tr
                        key={`group-${group.id}`}
                        className="border-b border-gray-100 bg-gray-50/70 cursor-pointer"
                        onClick={() => toggleGroup(group.id)}
                      >
                        <td className="py-2 px-3" colSpan={6}>
                          <div className="flex items-center gap-2 pl-8">
                            <div className="w-4 h-4 flex items-center justify-center text-gray-400">
                              {groupOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            </div>
                            <div
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ background: group.color }}
                            />
                            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: group.color }}>
                              {group.name}
                            </span>
                            <span className="text-xs text-gray-400 ml-1">
                              {group.items.filter(i => i.status === 'done').length}/{group.items.length} done
                            </span>
                          </div>
                        </td>
                      </tr>

                      {/* Items */}
                      {groupOpen && group.items.map(item => (
                        <tr
                          key={`item-${item.id}`}
                          className="border-b border-gray-100 hover:bg-blue-50/30 transition-colors"
                        >
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2 pl-16">
                              <div
                                className="w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 cursor-pointer"
                                style={{
                                  borderColor: item.status === 'done' ? '#059669' : '#D1D5DB',
                                  background: item.status === 'done' ? '#059669' : 'transparent',
                                }}
                                onClick={() => onItemStatusChange(item.id, item.status === 'done' ? 'new' : 'done')}
                              />
                              <span className={`text-sm ${item.status === 'done' ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                                {item.title}
                              </span>
                            </div>
                          </td>
                          <td className="py-2 px-3">
                            <ItemStatusPill
                              status={item.status}
                              onChange={s => onItemStatusChange(item.id, s)}
                            />
                          </td>
                          <td className="py-2 px-3 text-xs text-gray-500">{item.owner_name ?? '—'}</td>
                          <td className="py-2 px-3 text-xs text-gray-400">{fmtDate(item.start_date)}</td>
                          <td className="py-2 px-3 text-xs text-gray-400">{fmtDate(item.due_date)}</td>
                          <td className="py-2 px-3">
                            <ProgressBar pct={item.progress_pct ?? 0} height={4} />
                          </td>
                        </tr>
                      ))}
                    </>
                  )
                })}
              </>
            )
          })}
        </tbody>
      </table>
      {jobs.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Briefcase size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No jobs yet. Create your first job to get started.</p>
        </div>
      )}
    </div>
  )
}

// ─── Board View (Kanban) ──────────────────────────────────────────────────────

function BoardView({ jobs }: { jobs: Job[] }) {
  const columns: { key: string; label: string }[] = [
    { key: 'active',    label: 'Active' },
    { key: 'on_hold',   label: 'On Hold' },
    { key: 'completed', label: 'Completed' },
    { key: 'cancelled', label: 'Cancelled' },
  ]

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map(col => {
        const colJobs = jobs.filter(j => j.status === col.key)
        const cfg = STATUS_CONFIG[col.key]
        return (
          <div key={col.key} className="flex-shrink-0 w-72">
            {/* Column header */}
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className="w-2 h-2 rounded-full" style={{ background: cfg.color }} />
              <span className="text-sm font-semibold text-gray-700">{col.label}</span>
              <span
                className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full"
                style={{ background: cfg.bg, color: cfg.color }}
              >
                {colJobs.length}
              </span>
            </div>

            {/* Cards */}
            <div className="space-y-2.5">
              {colJobs.map(job => {
                const progress = calcJobProgress(job)
                const totalTasks = (job.groups ?? []).reduce((s, g) => s + g.items.length, 0)
                const doneTasks = (job.groups ?? []).reduce((s, g) => s + g.items.filter(i => i.status === 'done').length, 0)
                return (
                  <div
                    key={job.id}
                    className="bg-white rounded-xl border border-gray-200 p-3.5 hover:border-[#6B7EFF]/40 hover:shadow-sm transition-all cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="text-sm font-semibold text-gray-900 leading-snug">{job.title}</h4>
                      <TypeBadge type={job.job_type} />
                    </div>

                    {job.site_name && (
                      <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                        <Building2 size={11} />
                        {job.site_name}
                      </div>
                    )}

                    {job.assigned_tech_name && (
                      <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                        <Wrench size={11} />
                        {job.assigned_tech_name}
                      </div>
                    )}

                    <div className="flex items-center gap-2 mb-3">
                      <ProgressBar pct={progress} />
                      <span className="text-xs text-gray-400 flex-shrink-0">{progress}%</span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>{doneTasks}/{totalTasks} tasks</span>
                      <div className="flex items-center gap-1">
                        <Calendar size={10} />
                        {fmtDate(job.target_completion_date)}
                      </div>
                    </div>

                    {job.total_value != null && (
                      <div className="mt-2 pt-2 border-t border-gray-100 text-xs font-medium text-gray-600">
                        {fmtCurrency(job.total_value)}
                      </div>
                    )}
                  </div>
                )
              })}
              {colJobs.length === 0 && (
                <div className="border-2 border-dashed border-gray-200 rounded-xl py-8 text-center text-xs text-gray-400">
                  No {col.label.toLowerCase()} jobs
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Timeline View (Gantt) ────────────────────────────────────────────────────

function TimelineView({ jobs }: { jobs: Job[] }) {
  // Determine overall date range
  const allDates = jobs.flatMap(j => [j.start_date, j.target_completion_date]).filter(Boolean) as string[]
  const minDate = allDates.length ? new Date(Math.min(...allDates.map(d => new Date(d).getTime()))) : new Date()
  const maxDate = allDates.length ? new Date(Math.max(...allDates.map(d => new Date(d).getTime()))) : new Date(Date.now() + 90 * 86400000)

  // Pad by a week on each side
  const start = new Date(minDate); start.setDate(start.getDate() - 7)
  const end = new Date(maxDate); end.setDate(end.getDate() + 14)
  const totalDays = daysBetween(start.toISOString(), end.toISOString())

  const today = new Date()
  const todayOffset = Math.max(0, daysBetween(start.toISOString(), today.toISOString()))
  const todayPct = Math.min(100, (todayOffset / totalDays) * 100)

  function barStyle(s?: string | null, e?: string | null) {
    if (!s && !e) return null
    const startD = s ? new Date(s) : today
    const endD = e ? new Date(e) : new Date(startD.getTime() + 7 * 86400000)
    const leftPct = Math.max(0, (daysBetween(start.toISOString(), startD.toISOString()) / totalDays) * 100)
    const widthPct = Math.min(100 - leftPct, (daysBetween(startD.toISOString(), endD.toISOString()) / totalDays) * 100)
    return { left: `${leftPct}%`, width: `${Math.max(widthPct, 1)}%` }
  }

  // Build month labels
  const months: { label: string; pct: number }[] = []
  const cur = new Date(start.getFullYear(), start.getMonth(), 1)
  while (cur <= end) {
    const offset = daysBetween(start.toISOString(), cur.toISOString())
    months.push({
      label: cur.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      pct: (offset / totalDays) * 100,
    })
    cur.setMonth(cur.getMonth() + 1)
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[900px]">
        {/* Header row: month labels */}
        <div className="flex border-b border-gray-200">
          <div className="w-56 flex-shrink-0 py-2 px-3 text-xs font-semibold text-gray-500 bg-gray-50 border-r border-gray-200">
            Job / Phase
          </div>
          <div className="flex-1 relative h-8 bg-gray-50">
            {months.map((m, i) => (
              <div key={i} className="absolute top-0 bottom-0 flex items-center" style={{ left: `${m.pct}%` }}>
                <div className="h-full border-l border-gray-200" />
                <span className="text-xs text-gray-400 pl-1 whitespace-nowrap">{m.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Jobs */}
        {jobs.map(job => {
          const progress = calcJobProgress(job)
          const jobBar = barStyle(job.start_date, job.target_completion_date)
          return (
            <div key={job.id}>
              {/* Job row */}
              <div className="flex border-b border-gray-200 hover:bg-gray-50/60">
                <div className="w-56 flex-shrink-0 py-2.5 px-3 border-r border-gray-200">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: JOB_TYPE_COLOR[job.job_type] }} />
                    <span className="text-xs font-semibold text-gray-800 truncate">{job.title}</span>
                  </div>
                  <div className="mt-1 text-xs text-gray-400">{progress}% complete</div>
                </div>
                <div className="flex-1 relative py-2.5">
                  {/* Today line */}
                  <div
                    className="absolute top-0 bottom-0 border-l-2 border-red-400/60 z-10"
                    style={{ left: `${todayPct}%` }}
                  />
                  {/* Gantt bar */}
                  {jobBar && (
                    <div className="absolute top-1/2 -translate-y-1/2 h-5 rounded" style={{
                      ...jobBar,
                      background: JOB_TYPE_COLOR[job.job_type] + 'CC',
                    }}>
                      {/* Progress fill */}
                      <div
                        className="h-full rounded"
                        style={{
                          width: `${progress}%`,
                          background: JOB_TYPE_COLOR[job.job_type],
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Group rows */}
              {(job.groups ?? []).map(group => {
                const groupDone = group.items.filter(i => i.status === 'done').length
                const groupPct = group.items.length ? Math.round((groupDone / group.items.length) * 100) : 0
                const firstStart = group.items.map(i => i.start_date).filter(Boolean).sort()[0]
                const lastDue = group.items.map(i => i.due_date).filter(Boolean).sort().reverse()[0]
                const groupBar = barStyle(firstStart ?? job.start_date, lastDue ?? job.target_completion_date)

                return (
                  <div key={group.id} className="flex border-b border-gray-100 bg-gray-50/30 hover:bg-gray-50/70">
                    <div className="w-56 flex-shrink-0 py-1.5 px-3 border-r border-gray-100 pl-7">
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: group.color }} />
                        <span className="text-xs text-gray-600 truncate">{group.name}</span>
                      </div>
                      <span className="text-xs text-gray-400 pl-3">{groupPct}%</span>
                    </div>
                    <div className="flex-1 relative py-1.5">
                      <div className="absolute top-0 bottom-0 border-l-2 border-red-400/60" style={{ left: `${todayPct}%` }} />
                      {groupBar && (
                        <div className="absolute top-1/2 -translate-y-1/2 h-3.5 rounded overflow-hidden" style={{ ...groupBar, background: group.color + '33' }}>
                          <div className="h-full rounded" style={{ width: `${groupPct}%`, background: group.color + 'AA' }} />
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}

        {jobs.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <GanttChartSquare size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No jobs with dates yet. Set start and end dates to see the timeline.</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Chart View ───────────────────────────────────────────────────────────────

function ChartView({ jobs }: { jobs: Job[] }) {
  const statusCounts = {
    active:    jobs.filter(j => j.status === 'active').length,
    on_hold:   jobs.filter(j => j.status === 'on_hold').length,
    completed: jobs.filter(j => j.status === 'completed').length,
    cancelled: jobs.filter(j => j.status === 'cancelled').length,
  }
  const total = jobs.length || 1

  const typeCounts: Record<string, number> = {}
  jobs.forEach(j => { typeCounts[j.job_type] = (typeCounts[j.job_type] ?? 0) + 1 })

  const totalValue = jobs.reduce((s, j) => s + (j.total_value ?? 0), 0)
  const avgProgress = jobs.length
    ? Math.round(jobs.reduce((s, j) => s + calcJobProgress(j), 0) / jobs.length)
    : 0

  // SVG donut
  const r = 60, cx = 80, cy = 80, circ = 2 * Math.PI * r
  const colors = ['#059669', '#D97706', '#6B7EFF', '#6B7280']
  let cumPct = 0
  const segments = Object.entries(statusCounts).map(([key, count], i) => {
    const pct = count / total
    const dash = pct * circ
    const gap = circ - dash
    const offset = circ - cumPct * circ
    cumPct += pct
    return { key, count, pct, dash, gap, offset, color: colors[i] }
  }).filter(s => s.count > 0)

  return (
    <div className="p-2">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Status donut */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Status Distribution</h3>
          <div className="flex items-center gap-4">
            <svg width={160} height={160} viewBox="0 0 160 160">
              <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F3F4F6" strokeWidth={18} />
              {segments.map(s => (
                <circle
                  key={s.key}
                  cx={cx} cy={cy} r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={18}
                  strokeDasharray={`${s.dash} ${s.gap}`}
                  strokeDashoffset={s.offset}
                  transform={`rotate(-90 ${cx} ${cy})`}
                  className="transition-all duration-500"
                />
              ))}
              <text x={cx} y={cy - 8} textAnchor="middle" className="text-2xl font-bold" fill="#111827" fontSize={26} fontWeight={700}>{total}</text>
              <text x={cx} y={cy + 10} textAnchor="middle" fill="#6B7280" fontSize={11}>jobs</text>
            </svg>
            <div className="space-y-2">
              {Object.entries(statusCounts).map(([key, count]) => {
                const cfg = STATUS_CONFIG[key]
                return (
                  <div key={key} className="flex items-center gap-2 text-xs">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
                    <span className="text-gray-600">{cfg.label}</span>
                    <span className="ml-auto font-semibold text-gray-800">{count}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Job type breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">By Job Type</h3>
          <div className="space-y-3">
            {Object.entries(typeCounts).map(([type, count]) => (
              <div key={type}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-600">{JOB_TYPE_LABEL[type] ?? type}</span>
                  <span className="text-xs font-semibold text-gray-800">{count}</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden bg-gray-100">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(count / total) * 100}%`, background: JOB_TYPE_COLOR[type] }}
                  />
                </div>
              </div>
            ))}
            {Object.keys(typeCounts).length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">No data</p>
            )}
          </div>
        </div>

        {/* Summary stats */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-xs text-gray-500 mb-1">Total Pipeline Value</div>
            <div className="text-2xl font-bold text-gray-900">{fmtCurrency(totalValue)}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-xs text-gray-500 mb-1">Avg. Completion</div>
            <div className="text-2xl font-bold text-gray-900">{avgProgress}%</div>
            <ProgressBar pct={avgProgress} />
          </div>
        </div>
      </div>

      {/* Per-job progress bars */}
      <div className="mt-6 bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Job Completion</h3>
        <div className="space-y-3">
          {jobs.map(job => {
            const progress = calcJobProgress(job)
            return (
              <div key={job.id}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-700">{job.title}</span>
                    <TypeBadge type={job.job_type} />
                  </div>
                  <span className="text-xs text-gray-500">{progress}%</span>
                </div>
                <ProgressBar pct={progress} height={8} />
              </div>
            )
          })}
          {jobs.length === 0 && <p className="text-xs text-gray-400 text-center py-4">No jobs yet</p>}
        </div>
      </div>
    </div>
  )
}

// ─── List View ────────────────────────────────────────────────────────────────

function ListView({ jobs }: { jobs: Job[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[800px] border-collapse">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            {['Job', 'Type', 'Status', 'Tech', 'Value', 'Start', 'Due', 'Progress'].map(h => (
              <th key={h} className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {jobs.map(job => {
            const progress = calcJobProgress(job)
            return (
              <tr key={job.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer">
                <td className="py-2.5 px-4">
                  <div className="font-medium text-sm text-gray-900">{job.title}</div>
                  {job.site_name && <div className="text-xs text-gray-400">{job.site_name}</div>}
                </td>
                <td className="py-2.5 px-4"><TypeBadge type={job.job_type} /></td>
                <td className="py-2.5 px-4"><StatusBadge status={job.status} /></td>
                <td className="py-2.5 px-4 text-sm text-gray-600">{job.assigned_tech_name ?? '—'}</td>
                <td className="py-2.5 px-4 text-sm text-gray-600">{fmtCurrency(job.total_value)}</td>
                <td className="py-2.5 px-4 text-sm text-gray-400">{fmtDate(job.start_date)}</td>
                <td className="py-2.5 px-4 text-sm text-gray-400">{fmtDate(job.target_completion_date)}</td>
                <td className="py-2.5 px-4 min-w-[120px]">
                  <div className="flex items-center gap-2">
                    <ProgressBar pct={progress} />
                    <span className="text-xs text-gray-400 w-7 text-right">{progress}%</span>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {jobs.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <LayoutList size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No jobs found.</p>
        </div>
      )}
    </div>
  )
}

// ─── New Job Modal ────────────────────────────────────────────────────────────

function NewJobModal({ onClose, onCreated, defaults }: {
  onClose: () => void
  onCreated: (job: Job) => void
  defaults?: { oppName?: string; siteName?: string; totalValue?: string } | null
}) {
  const [title, setTitle] = useState('')
  const [jobType, setJobType] = useState<'new_install' | 'service' | 'small_install_to_service'>('new_install')
  const [oppName, setOppName] = useState(defaults?.oppName ?? '')
  const [siteName, setSiteName] = useState(defaults?.siteName ?? '')
  const [techName, setTechName] = useState('')
  const [totalValue, setTotalValue] = useState(defaults?.totalValue ?? '')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('Job title is required'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          job_type: jobType,
          opportunity_name: oppName.trim() || null,
          site_name: siteName.trim() || null,
          assigned_tech_name: techName.trim() || null,
          total_value: totalValue ? parseFloat(totalValue) : null,
          start_date: startDate || null,
          target_completion_date: endDate || null,
          notes: notes.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create job')
      onCreated(data.job)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error creating job')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">New Job</h2>
            <p className="text-xs text-gray-500 mt-0.5">Creates a job with pre-built workflow stages</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Job Type selector */}
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 block">Job Type</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(JOB_TYPE_LABEL) as [string, string][]).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setJobType(key as typeof jobType)}
                  className="p-3 rounded-xl border-2 text-xs font-medium transition-all text-center"
                  style={{
                    borderColor: jobType === key ? JOB_TYPE_COLOR[key] : '#E5E7EB',
                    background: jobType === key ? JOB_TYPE_COLOR[key] + '12' : 'white',
                    color: jobType === key ? JOB_TYPE_COLOR[key] : '#6B7280',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Job Title *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Stonegate at Park Ave — Gate Install"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30 focus:border-[#6B7EFF]"
              autoFocus
            />
          </div>

          {/* Row: Site + Tech */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Site / Property</label>
              <input value={siteName} onChange={e => setSiteName(e.target.value)} placeholder="Property name"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30 focus:border-[#6B7EFF]" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Assigned Tech</label>
              <input value={techName} onChange={e => setTechName(e.target.value)} placeholder="Tech name"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30 focus:border-[#6B7EFF]" />
            </div>
          </div>

          {/* Row: Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Start Date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30 focus:border-[#6B7EFF]" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Target Completion</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30 focus:border-[#6B7EFF]" />
            </div>
          </div>

          {/* Row: Opp + Value */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Opportunity (optional)</label>
              <input value={oppName} onChange={e => setOppName(e.target.value)} placeholder="Opportunity name"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30 focus:border-[#6B7EFF]" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Total Value ($)</label>
              <input type="number" value={totalValue} onChange={e => setTotalValue(e.target.value)} placeholder="0.00"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30 focus:border-[#6B7EFF]" />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Any notes about this job..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30 focus:border-[#6B7EFF]" />
          </div>

          {/* Template preview */}
          <div className="bg-blue-50 rounded-xl p-3">
            <div className="text-xs font-semibold text-blue-700 mb-1.5">
              Stages auto-created for {JOB_TYPE_LABEL[jobType]}:
            </div>
            <div className="flex flex-wrap gap-1.5">
              {jobType === 'new_install' && ['Deposit & Contract', 'Procurement', 'Staging', 'Installation', 'QC & Handoff', 'Final Billing'].map(s => (
                <span key={s} className="text-xs bg-blue-100 text-blue-700 rounded px-2 py-0.5">{s}</span>
              ))}
              {jobType === 'service' && ['Assessment', 'Activation', 'Ongoing'].map(s => (
                <span key={s} className="text-xs bg-green-100 text-green-700 rounded px-2 py-0.5">{s}</span>
              ))}
              {jobType === 'small_install_to_service' && ['Install', 'Service Transition'].map(s => (
                <span key={s} className="text-xs bg-amber-100 text-amber-700 rounded px-2 py-0.5">{s}</span>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ background: '#6B7EFF' }}>
              {saving ? <><Loader2 size={14} className="animate-spin" /> Creating...</> : <><Briefcase size={14} /> Create Job</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const searchParams = useSearchParams()
  const [view, setView] = useState<ViewMode>('grid')
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [showNewJob, setShowNewJob] = useState(false)
  // Pre-fill from URL when coming from opportunity "Create Job" CTA
  const [newJobDefaults, setNewJobDefaults] = useState<{
    oppName?: string; siteName?: string; totalValue?: string
  } | null>(null)

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setNewJobDefaults({
        oppName:    searchParams.get('opp_name')  ?? undefined,
        siteName:   searchParams.get('site_name') ?? undefined,
        totalValue: searchParams.get('value')     ?? undefined,
      })
      setShowNewJob(true)
    }
  }, [searchParams])

  const views: { key: ViewMode; label: string; Icon: React.ElementType }[] = [
    { key: 'grid',     label: 'Grid',     Icon: Grid3X3 },
    { key: 'board',    label: 'Board',    Icon: KanbanSquare },
    { key: 'timeline', label: 'Timeline', Icon: GanttChartSquare },
    { key: 'chart',    label: 'Chart',    Icon: BarChart3 },
    { key: 'list',     label: 'List',     Icon: LayoutList },
  ]

  const loadJobs = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const res = await fetch(`/api/jobs?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load jobs')

      // For grid view, fetch detail for each job (groups + items)
      // For performance, only do this if < 20 jobs
      const jobList: Job[] = data.jobs ?? []

      if (jobList.length <= 30) {
        const detailed = await Promise.all(
          jobList.map(async (j: Job) => {
            try {
              const dr = await fetch(`/api/jobs/${j.id}`)
              const dd = await dr.json()
              return dd.job ? { ...dd.job, groups: dd.groups } : j
            } catch {
              return j
            }
          })
        )
        setJobs(detailed)
      } else {
        setJobs(jobList)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error loading jobs')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { loadJobs() }, [loadJobs])

  async function handleItemStatusChange(itemId: string, newStatus: string) {
    try {
      await fetch(`/api/tracker/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      // Update local state
      setJobs(prev => prev.map(job => ({
        ...job,
        groups: (job.groups ?? []).map(g => ({
          ...g,
          items: g.items.map(i => i.id === itemId ? { ...i, status: newStatus as TrackerItem['status'] } : i),
        })),
      })))
    } catch (e) {
      console.error('Failed to update item status', e)
    }
  }

  function handleJobCreated(job: Job) {
    setShowNewJob(false)
    loadJobs()
  }

  // Filter jobs
  const filteredJobs = jobs.filter(j => {
    const q = search.toLowerCase()
    const matchSearch = !q || j.title.toLowerCase().includes(q) ||
      (j.site_name ?? '').toLowerCase().includes(q) ||
      (j.assigned_tech_name ?? '').toLowerCase().includes(q)
    const matchType = typeFilter === 'all' || j.job_type === typeFilter
    return matchSearch && matchType
  })

  // KPI summary
  const activeCount = jobs.filter(j => j.status === 'active').length
  const completedCount = jobs.filter(j => j.status === 'completed').length
  const totalValue = jobs.reduce((s, j) => s + (j.total_value ?? 0), 0)
  const avgProgress = jobs.length ? Math.round(jobs.reduce((s, j) => s + calcJobProgress(j), 0) / jobs.length) : 0

  return (
    <div className="flex flex-col min-h-full bg-[#F8FAFC]">
      <TopBar
        title="Projects"
        subtitle="Job tracking and project management"
        actions={
          <button
            onClick={() => setShowNewJob(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: '#6B7EFF' }}
          >
            <Plus size={16} /> New Job
          </button>
        }
      />

      <div className="flex-1 p-6 space-y-5">

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Active Jobs',    value: activeCount,              sub: 'In progress',          color: '#059669', bg: '#ECFDF5' },
            { label: 'Completed',      value: completedCount,           sub: 'This quarter',          color: '#6B7EFF', bg: '#EEF2FF' },
            { label: 'Pipeline Value', value: fmtCurrency(totalValue),  sub: 'All active jobs',      color: '#D97706', bg: '#FFFBEB' },
            { label: 'Avg. Progress',  value: `${avgProgress}%`,        sub: 'Across all jobs',      color: '#0891B2', bg: '#ECFEFF' },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-xs text-gray-500 mb-1">{card.label}</div>
              <div className="text-2xl font-bold text-gray-900">{card.value}</div>
              <div className="text-xs mt-1" style={{ color: card.color }}>{card.sub}</div>
            </div>
          ))}
        </div>

        {/* Controls: View toggle + Search + Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* View toggle */}
          <div className="flex items-center bg-white border border-gray-200 rounded-lg p-1 gap-0.5">
            {views.map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all"
                style={{
                  background: view === key ? '#6B7EFF' : 'transparent',
                  color: view === key ? 'white' : '#6B7280',
                }}
              >
                <Icon size={13} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search jobs..."
              className="w-full pl-8 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30 focus:border-[#6B7EFF]"
            />
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="on_hold">On Hold</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {/* Type filter */}
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30"
          >
            <option value="all">All Types</option>
            <option value="new_install">New Install</option>
            <option value="service">Service</option>
            <option value="small_install_to_service">Install → Service</option>
          </select>

          {/* Refresh */}
          <button onClick={loadJobs} className="p-2 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50">
            <RefreshCw size={15} />
          </button>
        </div>

        {/* Main content area */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-gray-400">
              <Loader2 size={24} className="animate-spin mr-3" />
              <span className="text-sm">Loading jobs...</span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-20 text-red-500 gap-2">
              <AlertTriangle size={18} />
              <span className="text-sm">{error}</span>
            </div>
          ) : (
            <>
              {view === 'grid'     && <GridView jobs={filteredJobs} onItemStatusChange={handleItemStatusChange} onRefresh={loadJobs} />}
              {view === 'board'    && <BoardView jobs={filteredJobs} />}
              {view === 'timeline' && <TimelineView jobs={filteredJobs} />}
              {view === 'chart'    && <ChartView jobs={filteredJobs} />}
              {view === 'list'     && <ListView jobs={filteredJobs} />}
            </>
          )}
        </div>

      </div>

      {/* New Job Modal */}
      {showNewJob && (
        <NewJobModal
          onClose={() => { setShowNewJob(false); setNewJobDefaults(null) }}
          onCreated={handleJobCreated}
          defaults={newJobDefaults}
        />
      )}
    </div>
  )
}
