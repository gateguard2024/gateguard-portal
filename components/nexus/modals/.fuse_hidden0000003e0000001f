'use client'

import { useState, useEffect, useCallback } from 'react'
import { ModalScopeContext }  from '@/components/nexus/context/ModalScopeContext'
import { ActionCommandBar }   from '@/components/nexus/ActionCommandBar'
import { JobsExplorer }       from './explorers/JobsExplorer'

// ─── Types ────────────────────────────────────────────────────────────────────

type View = 'commander' | 'archivist'

interface JobSummary { id: string; title?: string; status?: string; job_type?: string; site_name?: string; assigned_tech?: string; value?: number }
interface OppSummary { id: string; name?: string; company_name?: string; value?: number }
interface WOSummary  { id: string; wo_number?: string; title?: string; status?: string; customer_name?: string }

function hexRgb(h: string) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h)
  return r ? `${parseInt(r[1], 16)},${parseInt(r[2], 16)},${parseInt(r[3], 16)}` : '107,126,255'
}

// ─── Commander card ───────────────────────────────────────────────────────────

function CommandCard({
  hex, tag, urgent, headline, sub, actionLabel, onAction, disabled,
}: {
  hex: string; tag: string; urgent?: boolean
  headline: string; sub?: string
  actionLabel: string; onAction: () => void; disabled?: boolean
}) {
  const rgb = hexRgb(hex)
  const [phase, setPhase] = useState<'idle' | 'confirm' | 'done'>('idle')

  function handleClick() {
    if (disabled) return
    if (phase === 'idle')    { setPhase('confirm'); return }
    if (phase === 'confirm') { onAction(); setPhase('done') }
  }

  return (
    <div className="rounded-2xl p-3.5 flex flex-col gap-2.5"
      style={{
        background:    `rgba(${rgb},0.06)`,
        border:        `1px solid rgba(${rgb},${urgent ? 0.35 : 0.18})`,
        backdropFilter: 'blur(16px)',
        boxShadow:     urgent ? `0 0 18px rgba(${rgb},0.12)` : 'none',
      }}
    >
      <div className="flex items-center gap-1.5">
        {urgent && <span className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0" style={{ background: hex }} />}
        <span className="text-[9px] uppercase tracking-widest font-mono" style={{ color: `rgba(${rgb},0.65)` }}>{tag}</span>
      </div>
      <p className="text-xs font-medium leading-snug" style={{ color: 'rgba(255,255,255,0.88)' }}>{headline}</p>
      {sub && <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{sub}</p>}
      {phase === 'done' ? (
        <div className="flex items-center gap-1.5">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1.5 5l2.5 2.5 5-5" stroke="#34d399" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-[9px]" style={{ color: '#34d399' }}>Done</span>
        </div>
      ) : (
        <button onClick={handleClick} disabled={disabled}
          className="w-full text-left text-[10px] px-2 py-1.5 rounded-lg font-medium transition-all mt-auto"
          style={phase === 'confirm'
            ? { background: `rgba(${rgb},0.22)`, border: `0.5px solid rgba(${rgb},0.5)`, color: hex }
            : { background: `rgba(${rgb},0.1)`, border: `0.5px solid rgba(${rgb},0.22)`, color: `rgba(${rgb},0.85)` }
          }
        >
          {phase === 'confirm' ? `Confirm: ${actionLabel}` : actionLabel}
        </button>
      )}
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export function JobsModal() {
  const [view,       setView]      = useState<View>('commander')
  const [activeJob,  setActiveJob] = useState<JobSummary | null>(null)
  const [wonOpp,     setWonOpp]    = useState<OppSummary | null>(null)
  const [openWO,     setOpenWO]    = useState<WOSummary | null>(null)
  const [loading,    setLoading]   = useState(true)
  const [cmdResult,  setCmdResult] = useState<string | null>(null)
  const [cmdLoading, setCmdLoad]   = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/projects?limit=1&status=in_progress').then(r => r.json()).catch(() => ({})),
      fetch('/api/crm/opportunities?stage=won&limit=1').then(r => r.json()).catch(() => ({})),
      fetch('/api/dispatch/work-orders/today').then(r => r.json()).catch(() => ({})),
    ]).then(([jobs, opps, wos]) => {
      const jobList = jobs.projects ?? jobs.records ?? []
      const oppList = opps.records ?? opps.opportunities ?? []
      const woList  = wos.work_orders ?? wos.orders ?? wos.records ?? []
      if (jobList[0]) setActiveJob(jobList[0])
      if (oppList[0]) setWonOpp(oppList[0])
      if (woList[0])  setOpenWO(woList[0])
    }).finally(() => setLoading(false))
  }, [])

  const handleCommand = useCallback(async (query: string) => {
    setCmdLoad(true)
    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages:    [{ role: 'user', content: query }],
          scope:       'jobs',
          contextData: { job_id: activeJob?.id, opp_id: wonOpp?.id },
        }),
      })
      const d = await res.json()
      setCmdResult(d.response ?? d.message ?? 'Done.')
    } catch { setCmdResult('Something went wrong. Please try again.') }
    finally { setCmdLoad(false) }
  }, [activeJob, wonOpp])

  const scopeValue = { scope: 'jobs' as const, commandResult: cmdResult, isCommandLoading: cmdLoading }

  if (view === 'archivist') {
    return (
      <ModalScopeContext.Provider value={scopeValue}>
        <JobsExplorer onBack={() => setView('commander')} />
      </ModalScopeContext.Provider>
    )
  }

  return (
    <ModalScopeContext.Provider value={scopeValue}>
      <div className="space-y-3">

        {loading ? (
          <div className="flex items-center gap-2 py-4 justify-center">
            <div className="w-4 h-4 rounded-full border-2 border-amber-500/30 border-t-amber-400 animate-spin" />
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Loading jobs…</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2.5">
            {/* Active job */}
            <CommandCard
              hex="#fbbf24" tag="Active Job"
              urgent={!!activeJob}
              headline={activeJob ? `Job in progress at ${activeJob.site_name ?? 'site'}. ${activeJob.assigned_tech ? `Assigned to ${activeJob.assigned_tech}.` : 'Check status.'}` : 'No active jobs right now.'}
              sub={activeJob ? `${activeJob.job_type ?? 'job'} · ${activeJob.value ? `$${Number(activeJob.value).toLocaleString()}` : ''}` : undefined}
              actionLabel="Request Update"
              onAction={async () => {
                if (!activeJob) return
                await fetch('/api/assistant/execute', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ toolName: 'update_work_order_status', toolArgs: { work_order_id: activeJob.id, status: 'in_progress' }, reasoning: 'User requested status update from Nexus Jobs' }),
                })
              }}
              disabled={!activeJob}
            />

            {/* Create job from won opp */}
            <CommandCard
              hex="#6B7EFF" tag="New Job"
              headline={wonOpp ? `Won opportunity from ${wonOpp.company_name ?? wonOpp.name ?? 'client'} ready for job creation.` : 'No won opportunities pending job creation.'}
              sub={wonOpp ? `${wonOpp.value ? `$${Number(wonOpp.value).toLocaleString()} · ` : ''}New install or service job` : undefined}
              actionLabel="Create Job"
              onAction={async () => {
                if (!wonOpp) return
                await fetch('/api/assistant/execute', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ toolName: 'create_work_order', toolArgs: { title: `Install: ${wonOpp.name ?? wonOpp.company_name}`, opportunity_id: wonOpp.id }, reasoning: 'User creating job from won opportunity via Nexus' }),
                })
              }}
              disabled={!wonOpp}
            />

            {/* Dispatch */}
            <CommandCard
              hex="#34d399" tag="Dispatch"
              urgent={openWO?.status === 'open'}
              headline={openWO ? `${openWO.wo_number ?? 'Work order'} for ${openWO.customer_name ?? 'client'} needs a technician.` : 'All work orders are assigned.'}
              sub={openWO ? `Status: ${openWO.status ?? 'open'} · Needs dispatch` : undefined}
              actionLabel="Assign Tech"
              onAction={async () => {
                if (!openWO) return
                await fetch('/api/assistant/execute', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ toolName: 'assign_technician', toolArgs: { work_order_id: openWO.id }, reasoning: 'User dispatching tech from Nexus Jobs' }),
                })
              }}
              disabled={!openWO}
            />
          </div>
        )}

        {/* See All */}
        <button
          onClick={() => setView('archivist')}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all"
          style={{ background: 'rgba(251,191,36,0.05)', border: '0.5px solid rgba(251,191,36,0.15)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(251,191,36,0.1)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(251,191,36,0.05)' }}
        >
          <span className="text-[10px]" style={{ color: 'rgba(251,191,36,0.7)' }}>Open full job board — all jobs, kanban, Gantt</span>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M2 6h8M6 2l4 4-4 4" stroke="rgba(251,191,36,0.7)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <ActionCommandBar onSubmit={handleCommand} isLoading={cmdLoading} />

        {cmdResult && (
          <div className="px-3 py-2 rounded-xl text-xs" style={{ background: 'rgba(251,191,36,0.07)', border: '0.5px solid rgba(251,191,36,0.2)', color: 'rgba(255,255,255,0.75)' }}>
            {cmdResult}
          </div>
        )}
      </div>
    </ModalScopeContext.Provider>
  )
}
