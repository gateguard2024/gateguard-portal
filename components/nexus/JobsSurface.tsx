'use client'

import { useEffect, useState } from 'react'
import { JobGlassWindow } from '@/components/nexus/windows/JobGlassWindow'

type JobsFocus = 'myJobs' | 'needsAttention' | 'scheduledToday' | 'openJobs' | 'recentlyUpdated' | 'search'
type BoardAction = 'add_note' | 'create_task' | 'schedule_visit' | 'mark_complete' | null

type JobRecord = {
  id: string
  wo_number?: string | null
  title?: string | null
  customer_name?: string | null
  site_id?: string | null
  location?: string | null
  status?: string | null
  priority?: string | null
  assignee_name?: string | null
  scheduled_date?: string | null
  due_date?: string | null
  notes?: string | null
  created_at?: string | null
  updated_at?: string | null
}

type JobsWorkbenchData = {
  stats?: Record<string, number>
  myJobs?: JobRecord[]
  needsAttention?: JobRecord[]
  scheduledToday?: JobRecord[]
  openJobs?: JobRecord[]
  recentlyUpdated?: JobRecord[]
  jobs?: JobRecord[]
}

type JobCard = {
  focus: JobsFocus
  title: string
  subtitle: string
  hex: string
  actionLabel: string
  badgeKey?: keyof NonNullable<JobsWorkbenchData['stats']>
}

const JOBS_LABELS: Record<JobsFocus, string> = {
  myJobs: 'My Jobs',
  needsAttention: 'Needs Attention',
  scheduledToday: 'Scheduled Today',
  openJobs: 'Open Jobs',
  recentlyUpdated: 'Recently Updated',
  search: 'Search Job / Site',
}

const JOB_CARDS: JobCard[] = [
  { focus: 'needsAttention', title: 'Needs Attention', subtitle: 'Jobs that need a note, schedule, update, or next action.', hex: '#f97316', actionLabel: 'Open →', badgeKey: 'needsAttention' },
  { focus: 'scheduledToday', title: 'Scheduled Today', subtitle: 'Visits, work, and service items planned for today.', hex: '#00C8FF', actionLabel: 'Open →', badgeKey: 'scheduledToday' },
  { focus: 'openJobs', title: 'Open Jobs', subtitle: 'Active jobs that are not finished yet.', hex: '#34d399', actionLabel: 'Open →', badgeKey: 'openJobs' },
  { focus: 'recentlyUpdated', title: 'Recently Updated', subtitle: 'Jobs with the newest activity or movement.', hex: '#a855f7', actionLabel: 'Open →', badgeKey: 'recentlyUpdated' },
]

function rgb(hex: string): string {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return r ? `${parseInt(r[1], 16)},${parseInt(r[2], 16)},${parseInt(r[3], 16)}` : '52,211,153'
}

async function loadJobsWorkbench(query?: string): Promise<JobsWorkbenchData> {
  const url = query?.trim()
    ? `/api/nexus/jobs/workbench?q=${encodeURIComponent(query.trim())}`
    : '/api/nexus/jobs/workbench'

  const res = await fetch(url)
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.success === false) throw new Error(data?.message ?? 'Could not load jobs.')
  return data as JobsWorkbenchData
}

async function fetchJobWindow(id: string): Promise<Record<string, unknown>> {
  const res = await fetch(`/api/nexus/jobs/job-window/${id}`)
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.success === false) throw new Error(data?.message ?? 'Could not open job.')
  return data
}

function jobDisplayName(job: JobRecord): string {
  return job.title ?? job.wo_number ?? 'Untitled Job'
}

function jobDisplaySubtitle(job: JobRecord): string {
  return job.customer_name ?? job.location ?? job.assignee_name ?? 'No customer or site attached'
}

function JobCardButton({ card, count, onClick }: { card: JobCard; count: number; onClick: () => void }) {
  const color = rgb(card.hex)

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative min-h-[132px] overflow-hidden rounded-3xl p-4 text-left transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-60"
      style={{
        background: `linear-gradient(145deg, rgba(${color},0.18), rgba(255,255,255,0.035))`,
        border: `1px solid rgba(${color},0.30)`,
        boxShadow: `0 0 22px rgba(${color},0.12), 0 18px 50px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.06)`,
        backdropFilter: 'blur(18px)',
      }}
    >
      <div className="absolute right-4 top-4 rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em]" style={{ background: `rgba(${color},0.14)`, border: `1px solid rgba(${color},0.28)`, color: 'rgba(255,255,255,0.82)' }}>{count} items</div>
      <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-2xl text-sm" style={{ background: `rgba(${color},0.28)`, border: `1px solid rgba(${color},0.38)`, color: 'rgba(255,255,255,0.9)' }} />
      <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.94)' }}>{card.title}</div>
      <div className="mt-1.5 text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.48)' }}>{card.subtitle}</div>
      <div className="absolute bottom-4 right-4 text-xs opacity-70 transition-opacity group-hover:opacity-100" style={{ color: card.hex }}>{card.actionLabel}</div>
    </button>
  )
}

function JobRecordList({ records, emptyText, onJobSelect, onJobOpen, selectedJobId, jobWindowBusy, loadingJobId }: {
  records: JobRecord[]
  emptyText: string
  onJobSelect: (id: string) => void
  onJobOpen: (id: string) => void
  selectedJobId?: string | null
  jobWindowBusy?: boolean
  loadingJobId?: string | null
}) {
  if (records.length === 0) {
    return <div className="rounded-2xl p-4 text-xs" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.42)' }}>{emptyText}</div>
  }

  return (
    <div className="space-y-2">
      {records.map(job => {
        const isLoading = jobWindowBusy && loadingJobId === job.id
        const selected = selectedJobId === job.id
        return (
          <div
            key={job.id}
            onClick={() => onJobSelect(job.id)}
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onJobSelect(job.id) }}
            className="cursor-pointer rounded-2xl p-4 transition-all hover:-translate-y-0.5"
            style={{
              background: selected ? 'rgba(52,211,153,0.12)' : isLoading ? 'rgba(52,211,153,0.10)' : 'rgba(255,255,255,0.035)',
              border: selected ? '1px solid rgba(52,211,153,0.34)' : isLoading ? '1px solid rgba(52,211,153,0.28)' : '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>{isLoading ? 'Opening...' : jobDisplayName(job)}</div>
                  {selected && <span className="text-[10px] opacity-70" style={{ color: 'rgba(52,211,153,0.95)' }}>Selected</span>}
                </div>
                <div className="mt-1 text-[11px]" style={{ color: 'rgba(255,255,255,0.45)' }}>{jobDisplaySubtitle(job)}</div>
                {(job.due_date || job.scheduled_date || job.assignee_name) && (
                  <div className="mt-2 text-[10px]" style={{ color: 'rgba(255,255,255,0.32)' }}>
                    {[
                      job.scheduled_date ? `Scheduled: ${job.scheduled_date}` : null,
                      job.due_date ? `Due: ${job.due_date}` : null,
                      job.assignee_name ? `Assigned: ${job.assignee_name}` : null,
                    ].filter(Boolean).join(' • ')}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-start gap-2">
                <div className="rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.14em]" style={{ background: 'rgba(52,211,153,0.1)', color: 'rgba(110,231,183,0.9)', border: '1px solid rgba(52,211,153,0.18)', whiteSpace: 'nowrap' }}>{job.status ?? 'open'}</div>
                {job.priority && <div className="rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.14em]" style={{ background: 'rgba(107,126,255,0.1)', color: 'rgba(165,180,255,0.9)', border: '1px solid rgba(107,126,255,0.18)', whiteSpace: 'nowrap' }}>{job.priority}</div>}
                <button type="button" onClick={e => { e.stopPropagation(); onJobOpen(job.id) }} className="rounded-full px-3 py-1 text-[10px] font-semibold" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.62)', border: '1px solid rgba(255,255,255,0.08)' }}>Open</button>
              </div>
            </div>
            {job.notes && <div className="mt-3 line-clamp-2 text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.38)' }}>{job.notes}</div>}
          </div>
        )
      })}
    </div>
  )
}

function ActionButton({ label, onClick, muted, disabled }: { label: string; onClick?: () => void; muted?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="w-full rounded-2xl px-3 py-3 text-left text-xs font-semibold transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-45"
      style={muted || disabled
        ? { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.48)' }
        : { background: 'rgba(52,211,153,0.10)', border: '1px solid rgba(52,211,153,0.22)', color: '#86efac' }}
    >
      {label}
    </button>
  )
}

function JobsDetailShell({ title, subtitle, onClose, children, actions }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode; actions: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 px-4 py-6">
      <div className="grid max-h-[86vh] w-full max-w-5xl grid-cols-1 gap-4 overflow-hidden rounded-[2rem] p-5 shadow-2xl lg:grid-cols-[1fr_260px]" style={{ background: 'linear-gradient(180deg, rgba(8,24,20,0.96), rgba(5,12,18,0.96))', border: '1px solid rgba(52,211,153,0.16)', boxShadow: '0 30px 100px rgba(0,0,0,0.55), 0 0 48px rgba(52,211,153,0.10), inset 0 1px 0 rgba(255,255,255,0.06)', backdropFilter: 'blur(26px)' }}>
        <div className="min-h-0 overflow-y-auto pr-1">
          <button type="button" onClick={onClose} className="mb-4 rounded-full px-3 py-1.5 text-[11px]" style={{ background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.58)' }}>← Back to Jobs</button>
          <div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: 'rgba(52,211,153,0.78)' }}>Jobs</div>
          <h2 className="mt-1 text-2xl font-semibold" style={{ color: 'rgba(255,255,255,0.96)' }}>{title}</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.48)' }}>{subtitle}</p>
          <div className="mt-5 space-y-2">{children}</div>
        </div>
        <aside className="rounded-3xl p-4" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.92)' }}>Actions</div>
          <div className="mt-4 space-y-2">{actions}</div>
        </aside>
      </div>
    </div>
  )
}

export function JobsSurface() {
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [jobsWorkbench, setJobsWorkbench] = useState<JobsWorkbenchData | null>(null)
  const [jobsFocus, setJobsFocus] = useState<JobsFocus>('needsAttention')
  const [activePanel, setActivePanel] = useState<JobsFocus | null>(null)
  const [jobsSearchTerm, setJobsSearchTerm] = useState('')
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [selectedBoardJobId, setSelectedBoardJobId] = useState<string | null>(null)
  const [boardAction, setBoardAction] = useState<BoardAction>(null)
  const [boardBusy, setBoardBusy] = useState(false)
  const [boardMessage, setBoardMessage] = useState<string | null>(null)
  const [boardNote, setBoardNote] = useState('')
  const [boardTaskTitle, setBoardTaskTitle] = useState('')
  const [boardTaskDueDate, setBoardTaskDueDate] = useState('')
  const [boardVisitDate, setBoardVisitDate] = useState('')
  const [boardCompleteNote, setBoardCompleteNote] = useState('')
  const [jobWindowData, setJobWindowData] = useState<Record<string, unknown> | null>(null)
  const [jobWindowBusy, setJobWindowBusy] = useState(false)
  const [loadingJobId, setLoadingJobId] = useState<string | null>(null)

  async function openJobsWorkbench(focus: JobsFocus = 'needsAttention') {
    setBusy(true)
    setStatus(null)
    setSelectedBoardJobId(null)
    setBoardAction(null)
    setBoardMessage(null)
    try {
      const data = await loadJobsWorkbench(focus === 'search' ? jobsSearchTerm : undefined)
      setJobsWorkbench(data)
      setJobsFocus(focus)
      setActivePanel(focus)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not load jobs.')
    } finally {
      setBusy(false)
    }
  }

  async function refreshBoard() {
    try {
      const data = await loadJobsWorkbench(jobsFocus === 'search' ? jobsSearchTerm : undefined)
      setJobsWorkbench(data)
    } catch (error) {
      setBoardMessage(error instanceof Error ? error.message : 'Could not refresh jobs.')
    }
  }

  useEffect(() => {
    if (!jobsWorkbench && !busy) {
      void loadJobsWorkbench().then(setJobsWorkbench).catch(() => setStatus('Could not load job counts.'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function openJob(id: string) {
    setJobWindowBusy(true)
    setLoadingJobId(id)
    setStatus(null)
    try {
      const data = await fetchJobWindow(id)
      setSelectedJobId(id)
      setJobWindowData(data)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not open job.')
    } finally {
      setJobWindowBusy(false)
      setLoadingJobId(null)
    }
  }

  function closeJobWindow() {
    setSelectedJobId(null)
    setJobWindowData(null)
  }

  async function refreshOpenJob() {
    if (!selectedJobId) return
    try {
      const data = await fetchJobWindow(selectedJobId)
      setJobWindowData(data)
      await refreshBoard()
    } catch {
      // Keep current job visible if refresh fails.
    }
  }

  async function submitBoardAction(payload: Record<string, unknown>) {
    if (!selectedBoardJobId) return
    setBoardBusy(true)
    setBoardMessage(null)
    try {
      const res = await fetch(`/api/nexus/jobs/job-window/${selectedBoardJobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok || result.success === false) throw new Error(result?.message ?? 'Could not complete that action.')
      setBoardMessage(result?.message ?? 'Done.')
      setBoardAction(null)
      setBoardNote('')
      setBoardTaskTitle('')
      setBoardTaskDueDate('')
      setBoardVisitDate('')
      setBoardCompleteNote('')
      await refreshBoard()
    } catch (error) {
      setBoardMessage(error instanceof Error ? error.message : 'That did not work. Try again.')
    } finally {
      setBoardBusy(false)
    }
  }

  const focusedJobs = jobsFocus === 'search' ? jobsWorkbench?.jobs ?? [] : jobsWorkbench?.[jobsFocus] ?? []
  const selectedBoardJob = focusedJobs.find(job => job.id === selectedBoardJobId) ?? null
  const focusedJobsEmptyText = jobsFocus === 'needsAttention'
    ? 'No jobs need attention right now.'
    : jobsFocus === 'scheduledToday'
      ? 'No jobs scheduled for today.'
      : jobsFocus === 'openJobs'
        ? 'No open jobs found.'
        : jobsFocus === 'recentlyUpdated'
          ? 'No recently updated jobs found.'
          : 'No jobs found here yet.'

  const activeTitle = activePanel ? JOBS_LABELS[activePanel] : 'Jobs'
  const activeSubtitle = activePanel === 'needsAttention'
    ? 'Jobs that need a note, schedule, update, or next action.'
    : activePanel === 'scheduledToday'
      ? 'Jobs and visits scheduled for today.'
      : activePanel === 'openJobs'
        ? 'Active jobs that are still open.'
        : activePanel === 'recentlyUpdated'
          ? 'Jobs with recent movement.'
          : 'Search jobs, sites, customers, techs, or notes.'

  return (
    <section className="mt-9 w-full max-w-5xl">
      <div className="rounded-[2rem] p-5 sm:p-6" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.022))', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 24px 80px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.06)', backdropFilter: 'blur(24px)' }}>
        {selectedJobId && jobWindowData ? (
          <JobGlassWindow data={jobWindowData as Parameters<typeof JobGlassWindow>[0]['data']} onBack={closeJobWindow} onRefresh={refreshOpenJob} />
        ) : (
          <>
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: 'rgba(52,211,153,0.62)' }}>Jobs</div>
                <h2 className="mt-1 text-xl font-semibold leading-tight" style={{ color: 'rgba(255,255,255,0.94)' }}>What jobs need work?</h2>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.42)' }}>Pick a board, select a job, then choose a simple action.</p>
              </div>
              <div className="rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.18em]" style={{ background: 'rgba(52,211,153,0.1)', color: 'rgba(110,231,183,0.9)', border: '1px solid rgba(52,211,153,0.18)' }}>{busy ? 'Loading…' : 'Jobs'}</div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {JOB_CARDS.map(card => (
                <JobCardButton key={card.focus} card={card} count={card.badgeKey ? jobsWorkbench?.stats?.[card.badgeKey] ?? 0 : 0} onClick={() => void openJobsWorkbench(card.focus)} />
              ))}
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input value={jobsSearchTerm} onChange={e => setJobsSearchTerm(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void openJobsWorkbench('search') }} placeholder="Search job, site, customer, tech, or notes" className="flex-1 rounded-2xl px-4 py-3 text-sm outline-none" style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(52,211,153,0.22)', color: 'rgba(255,255,255,0.88)' }} />
              <button type="button" onClick={() => void openJobsWorkbench('search')} className="rounded-2xl px-4 py-3 text-sm" style={{ background: '#34d399', color: '#06120c' }}>Search</button>
            </div>

            {status && <div className="mt-4 rounded-2xl p-3 text-xs" style={{ background: 'rgba(107,126,255,0.08)', border: '1px solid rgba(107,126,255,0.18)', color: 'rgba(255,255,255,0.72)' }}>{status}</div>}

            <div className="mt-5 text-[11px]" style={{ color: 'rgba(255,255,255,0.32)' }}>
              Jobs stays action-first: board, selected job, action rail, then full Job Glass only when needed.
            </div>
          </>
        )}
      </div>

      {activePanel && !(selectedJobId && jobWindowData) && (
        <JobsDetailShell
          title={activeTitle}
          subtitle={activeSubtitle}
          onClose={() => { setActivePanel(null); setSelectedBoardJobId(null); setBoardAction(null); setBoardMessage(null) }}
          actions={
            <>
              {selectedBoardJob ? (
                <div className="rounded-2xl p-3 text-[11px]" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.16)', color: 'rgba(255,255,255,0.72)' }}>
                  Selected:<br /> <span style={{ color: 'rgba(255,255,255,0.9)' }}>{jobDisplayName(selectedBoardJob)}</span>
                </div>
              ) : (
                <div className="rounded-2xl p-3 text-[11px]" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.42)' }}>Select a job first.</div>
              )}

              <ActionButton label="Open Job Glass" disabled={!selectedBoardJobId} onClick={() => selectedBoardJobId ? void openJob(selectedBoardJobId) : undefined} />
              <ActionButton label="Add Note" disabled={!selectedBoardJobId} onClick={() => { setBoardAction(boardAction === 'add_note' ? null : 'add_note'); setBoardMessage(null) }} />
              <ActionButton label="Schedule Visit" disabled={!selectedBoardJobId} onClick={() => { setBoardAction(boardAction === 'schedule_visit' ? null : 'schedule_visit'); setBoardMessage(null) }} />
              <ActionButton label="Create Task" disabled={!selectedBoardJobId} onClick={() => { setBoardAction(boardAction === 'create_task' ? null : 'create_task'); setBoardMessage(null) }} />
              <ActionButton label="Mark Complete" disabled={!selectedBoardJobId} onClick={() => { setBoardAction(boardAction === 'mark_complete' ? null : 'mark_complete'); setBoardMessage(null) }} />

              {boardAction === 'add_note' && (
                <div className="space-y-2 rounded-2xl p-3" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(52,211,153,0.22)' }}>
                  <textarea value={boardNote} onChange={e => setBoardNote(e.target.value)} placeholder="What should Nexus remember?" rows={3} className="w-full resize-none rounded-xl px-3 py-2 text-xs outline-none" style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(52,211,153,0.2)', color: 'rgba(255,255,255,0.88)' }} />
                  <button type="button" disabled={boardBusy || !boardNote.trim()} onClick={() => void submitBoardAction({ action: 'add_note', note: boardNote })} className="rounded-full px-3 py-1.5 text-[11px] disabled:opacity-40" style={{ background: '#34d399', color: '#06120c' }}>{boardBusy ? 'Saving...' : 'Save Note'}</button>
                </div>
              )}

              {boardAction === 'schedule_visit' && (
                <div className="space-y-2 rounded-2xl p-3" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(52,211,153,0.22)' }}>
                  <input type="date" value={boardVisitDate} onChange={e => setBoardVisitDate(e.target.value)} className="w-full rounded-xl px-3 py-2 text-xs outline-none" style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(52,211,153,0.2)', color: 'rgba(255,255,255,0.88)' }} />
                  <textarea value={boardNote} onChange={e => setBoardNote(e.target.value)} placeholder="Optional note" rows={2} className="w-full resize-none rounded-xl px-3 py-2 text-xs outline-none" style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.88)' }} />
                  <button type="button" disabled={boardBusy || !boardVisitDate} onClick={() => void submitBoardAction({ action: 'schedule_visit', scheduled_date: boardVisitDate, note: boardNote })} className="rounded-full px-3 py-1.5 text-[11px] disabled:opacity-40" style={{ background: '#34d399', color: '#06120c' }}>{boardBusy ? 'Scheduling...' : 'Schedule Visit'}</button>
                </div>
              )}

              {boardAction === 'create_task' && (
                <div className="space-y-2 rounded-2xl p-3" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(52,211,153,0.22)' }}>
                  <input value={boardTaskTitle} onChange={e => setBoardTaskTitle(e.target.value)} placeholder="What needs to get done?" className="w-full rounded-xl px-3 py-2 text-xs outline-none" style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(52,211,153,0.2)', color: 'rgba(255,255,255,0.88)' }} />
                  <input type="date" value={boardTaskDueDate} onChange={e => setBoardTaskDueDate(e.target.value)} className="w-full rounded-xl px-3 py-2 text-xs outline-none" style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.88)' }} />
                  <button type="button" disabled={boardBusy || !boardTaskTitle.trim()} onClick={() => void submitBoardAction({ action: 'create_task', title: boardTaskTitle, due_date: boardTaskDueDate })} className="rounded-full px-3 py-1.5 text-[11px] disabled:opacity-40" style={{ background: '#34d399', color: '#06120c' }}>{boardBusy ? 'Creating...' : 'Create Task'}</button>
                </div>
              )}

              {boardAction === 'mark_complete' && (
                <div className="space-y-2 rounded-2xl p-3" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(52,211,153,0.22)' }}>
                  <textarea value={boardCompleteNote} onChange={e => setBoardCompleteNote(e.target.value)} placeholder="Optional completion note" rows={2} className="w-full resize-none rounded-xl px-3 py-2 text-xs outline-none" style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.88)' }} />
                  <button type="button" disabled={boardBusy} onClick={() => void submitBoardAction({ action: 'mark_complete', note: boardCompleteNote })} className="rounded-full px-3 py-1.5 text-[11px] disabled:opacity-40" style={{ background: '#34d399', color: '#06120c' }}>{boardBusy ? 'Closing...' : 'Mark Complete'}</button>
                </div>
              )}

              {boardMessage && <div className="rounded-2xl px-3 py-2 text-[11px]" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.18)', color: 'rgba(255,255,255,0.72)' }}>{boardMessage}</div>}
            </>
          }
        >
          {activePanel === 'search' && (
            <div className="mb-3 flex flex-col gap-2 sm:flex-row">
              <input value={jobsSearchTerm} onChange={e => setJobsSearchTerm(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void openJobsWorkbench('search') }} placeholder="Search job, site, customer, tech, or notes" className="flex-1 rounded-2xl px-4 py-3 text-sm outline-none" style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(52,211,153,0.22)', color: 'rgba(255,255,255,0.88)' }} />
              <button type="button" onClick={() => void openJobsWorkbench('search')} className="rounded-2xl px-4 py-3 text-sm" style={{ background: '#34d399', color: '#06120c' }}>Search</button>
            </div>
          )}
          <JobRecordList records={focusedJobs} emptyText={focusedJobsEmptyText} onJobSelect={id => { setSelectedBoardJobId(id); setBoardAction(null); setBoardMessage(null) }} onJobOpen={openJob} selectedJobId={selectedBoardJobId} jobWindowBusy={jobWindowBusy} loadingJobId={loadingJobId} />
        </JobsDetailShell>
      )}
    </section>
  )
}
