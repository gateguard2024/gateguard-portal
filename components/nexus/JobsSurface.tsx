'use client'

import { useState } from 'react'
import { JobGlassWindow } from '@/components/nexus/windows/JobGlassWindow'

type JobsFocus = 'myJobs' | 'needsAttention' | 'scheduledToday' | 'openJobs' | 'recentlyUpdated' | 'search'

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

const JOBS_LABELS: Record<JobsFocus, string> = {
  myJobs: 'My Jobs',
  needsAttention: 'Needs Attention',
  scheduledToday: 'Scheduled Today',
  openJobs: 'Open Jobs',
  recentlyUpdated: 'Recently Updated',
  search: 'Search Job / Site',
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

function JobRecordList({ records, emptyText, onJobClick, jobWindowBusy, loadingJobId }: {
  records: JobRecord[]
  emptyText: string
  onJobClick: (id: string) => void
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
        return (
          <div
            key={job.id}
            onClick={() => onJobClick(job.id)}
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onJobClick(job.id) }}
            className="cursor-pointer rounded-2xl p-4 transition-all hover:-translate-y-0.5"
            style={{ background: isLoading ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.035)', border: isLoading ? '1px solid rgba(52,211,153,0.28)' : '1px solid rgba(255,255,255,0.08)' }}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>{isLoading ? 'Opening...' : jobDisplayName(job)}</div>
                  {!isLoading && <span className="text-[10px] opacity-40" style={{ color: 'rgba(52,211,153,0.9)' }}>Open →</span>}
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
              <div className="flex flex-wrap gap-2">
                <div className="rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.14em]" style={{ background: 'rgba(52,211,153,0.1)', color: 'rgba(110,231,183,0.9)', border: '1px solid rgba(52,211,153,0.18)', whiteSpace: 'nowrap' }}>{job.status ?? 'open'}</div>
                {job.priority && <div className="rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.14em]" style={{ background: 'rgba(107,126,255,0.1)', color: 'rgba(165,180,255,0.9)', border: '1px solid rgba(107,126,255,0.18)', whiteSpace: 'nowrap' }}>{job.priority}</div>}
              </div>
            </div>
            {job.notes && <div className="mt-3 line-clamp-2 text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.38)' }}>{job.notes}</div>}
          </div>
        )
      })}
    </div>
  )
}

export function JobsSurface() {
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [jobsWorkbench, setJobsWorkbench] = useState<JobsWorkbenchData | null>(null)
  const [jobsFocus, setJobsFocus] = useState<JobsFocus>('myJobs')
  const [jobsSearchTerm, setJobsSearchTerm] = useState('')
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [jobWindowData, setJobWindowData] = useState<Record<string, unknown> | null>(null)
  const [jobWindowBusy, setJobWindowBusy] = useState(false)
  const [loadingJobId, setLoadingJobId] = useState<string | null>(null)

  async function openJobsWorkbench(focus: JobsFocus = 'myJobs') {
    setBusy(true)
    setStatus(null)
    try {
      const data = await loadJobsWorkbench(focus === 'search' ? jobsSearchTerm : undefined)
      setJobsWorkbench(data)
      setJobsFocus(focus)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not load jobs.')
    } finally {
      setBusy(false)
    }
  }

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
    } catch {
      // Keep current job visible if refresh fails.
    }
  }

  const focusedJobs = jobsFocus === 'search' ? jobsWorkbench?.jobs ?? [] : jobsWorkbench?.[jobsFocus] ?? []
  const focusedJobsEmptyText = jobsFocus === 'myJobs'
    ? 'No jobs assigned to you yet.'
    : jobsFocus === 'needsAttention'
      ? 'No jobs need attention right now.'
      : jobsFocus === 'scheduledToday'
        ? 'No jobs scheduled for today.'
        : 'No jobs found here yet.'

  return (
    <section className="mt-9 w-full max-w-4xl">
      <div className="rounded-[2rem] p-5 sm:p-6" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.022))', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 24px 80px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.06)', backdropFilter: 'blur(24px)' }}>
        {selectedJobId && jobWindowData ? (
          <JobGlassWindow data={jobWindowData as Parameters<typeof JobGlassWindow>[0]['data']} onBack={closeJobWindow} onRefresh={refreshOpenJob} />
        ) : (
          <>
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: 'rgba(52,211,153,0.62)' }}>Jobs</div>
                <h2 className="mt-1 text-xl font-semibold leading-tight" style={{ color: 'rgba(255,255,255,0.94)' }}>What jobs need work?</h2>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.42)' }}>Open your jobs, scheduled visits, attention items, or search by job, site, or customer.</p>
              </div>
              <div className="rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.18em]" style={{ background: 'rgba(52,211,153,0.1)', color: 'rgba(110,231,183,0.9)', border: '1px solid rgba(52,211,153,0.18)' }}>Jobs</div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
                {(['myJobs', 'needsAttention', 'scheduledToday', 'openJobs', 'recentlyUpdated', 'search'] as JobsFocus[]).map(focus => (
                  <button key={focus} type="button" onClick={() => void openJobsWorkbench(focus)} className="rounded-2xl p-3 text-left text-xs transition-all" style={{ background: jobsFocus === focus ? 'rgba(52,211,153,0.16)' : 'rgba(255,255,255,0.035)', border: jobsFocus === focus ? '1px solid rgba(52,211,153,0.32)' : '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.78)' }}>
                    <div className="font-semibold">{JOBS_LABELS[focus]}</div>
                    {focus !== 'search' && <div className="mt-1 opacity-50">{jobsWorkbench?.stats?.[focus] ?? 0} items</div>}
                  </button>
                ))}
              </div>

              {jobsFocus === 'search' && (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input value={jobsSearchTerm} onChange={e => setJobsSearchTerm(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void openJobsWorkbench('search') }} placeholder="Search job, site, customer, tech, or notes" className="flex-1 rounded-2xl px-4 py-3 text-sm outline-none" style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(52,211,153,0.22)', color: 'rgba(255,255,255,0.88)' }} />
                  <button type="button" onClick={() => void openJobsWorkbench('search')} className="rounded-2xl px-4 py-3 text-sm" style={{ background: '#34d399', color: '#06120c' }}>Search</button>
                </div>
              )}

              {status && <div className="rounded-2xl p-3 text-xs" style={{ background: 'rgba(107,126,255,0.08)', border: '1px solid rgba(107,126,255,0.18)', color: 'rgba(255,255,255,0.72)' }}>{status}</div>}

              {!jobsWorkbench && (
                <button type="button" disabled={busy} onClick={() => void openJobsWorkbench('myJobs')} className="w-full rounded-2xl p-4 text-left text-sm transition-all disabled:opacity-50" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.18)', color: 'rgba(255,255,255,0.84)' }}>
                  <div className="font-semibold">Load Jobs</div>
                  <div className="mt-1 text-xs opacity-50">Open your jobs workbench.</div>
                </button>
              )}

              {jobsWorkbench && <JobRecordList records={focusedJobs} emptyText={focusedJobsEmptyText} onJobClick={openJob} jobWindowBusy={jobWindowBusy} loadingJobId={loadingJobId} />}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
