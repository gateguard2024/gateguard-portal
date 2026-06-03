'use client'

import { useState, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type JobView   = 'list' | 'kanban'
type JobFilter = 'all' | 'install' | 'service' | 'convert'

interface JobRow {
  id: string; title?: string; job_type?: string; status?: string
  site_name?: string; value?: number; assigned_tech?: string; due_date?: string
  phase?: string; created_at?: string
}

interface Props { onBack: () => void }

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_HEX:   Record<string, string> = { install: '#6B7EFF', service: '#34d399', convert: '#fbbf24', default: '#6B7EFF' }
const STATUS_HEX: Record<string, string> = {
  pending: '#94a3b8', in_progress: '#fbbf24', on_hold: '#f87171',
  completed: '#34d399', won: '#10b981', cancelled: '#f87171',
}
const STATUS_ORDER = ['pending', 'in_progress', 'on_hold', 'completed']

function hexRgb(h: string) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h)
  return r ? `${parseInt(r[1], 16)},${parseInt(r[2], 16)},${parseInt(r[3], 16)}` : '107,126,255'
}

function timeAgo(iso: string): string {
  const d = (Date.now() - new Date(iso).getTime()) / 1000
  if (d < 86400) return `${Math.round(d / 3600)}h ago`
  return `${Math.round(d / 86400)}d ago`
}

// ─── Kanban column ────────────────────────────────────────────────────────────

function KanbanCol({ status, jobs }: { status: string; jobs: JobRow[] }) {
  const hex = STATUS_HEX[status] ?? '#94a3b8'
  const rgb = hexRgb(hex)
  const label = status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5 mb-2 px-1">
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: hex }} />
        <span className="text-[9px] uppercase tracking-widest font-medium" style={{ color: `rgba(${rgb},0.8)` }}>{label}</span>
        <span className="text-[9px] font-mono ml-auto" style={{ color: 'rgba(255,255,255,0.25)' }}>{jobs.length}</span>
      </div>
      <div className="space-y-1.5 overflow-y-auto pr-0.5" style={{ maxHeight: '30vh', scrollbarWidth: 'none' }}>
        {jobs.length === 0 ? (
          <div className="px-2 py-3 rounded-lg text-center"
            style={{ border: '0.5px dashed rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.18)' }}>
            <p className="text-[9px]">Empty</p>
          </div>
        ) : jobs.map(j => {
          const typeHex = TYPE_HEX[j.job_type ?? ''] ?? TYPE_HEX.default
          const typeRgb = hexRgb(typeHex)
          return (
            <div key={j.id} className="px-2.5 py-2 rounded-lg space-y-1"
              style={{ background: `rgba(${typeRgb},0.06)`, border: `0.5px solid rgba(${typeRgb},0.15)` }}>
              <p className="text-[10px] font-medium leading-tight" style={{ color: 'rgba(255,255,255,0.82)' }}>
                {j.title ?? 'Untitled'}
              </p>
              {j.site_name && (
                <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{j.site_name}</p>
              )}
              <div className="flex items-center justify-between mt-1">
                <span className="text-[9px] capitalize px-1.5 py-0.5 rounded"
                  style={{ background: `rgba(${typeRgb},0.12)`, color: typeHex }}>
                  {j.job_type ?? 'job'}
                </span>
                {j.value && (
                  <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    ${Number(j.value).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Explorer ─────────────────────────────────────────────────────────────────

export function JobsExplorer({ onBack }: Props) {
  const [viewMode, setView]   = useState<JobView>('list')
  const [filter,   setFilter] = useState<JobFilter>('all')
  const [jobs,     setJobs]   = useState<JobRow[]>([])
  const [loading,  setLoad]   = useState(true)

  useEffect(() => {
    fetch('/api/projects?limit=30').then(r => r.json())
      .then(d => setJobs(d.projects ?? d.records ?? d ?? []))
      .catch(() => setJobs([]))
      .finally(() => setLoad(false))
  }, [])

  const FILTERS: { key: JobFilter; label: string }[] = [
    { key: 'all',     label: `All (${jobs.length})` },
    { key: 'install', label: 'Install' },
    { key: 'service', label: 'Service' },
    { key: 'convert', label: 'Convert' },
  ]

  const visible = filter === 'all' ? jobs : jobs.filter(j => j.job_type === filter)
  const totalValue = visible.reduce((s, j) => s + (j.value ?? 0), 0)

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
            style={{ color: 'rgba(251,191,36,0.55)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(251,191,36,0.95)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(251,191,36,0.55)')}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-xs font-medium">Jobs</span>
          </button>
          <div className="flex-1 h-px" style={{ background: 'rgba(251,191,36,0.15)' }} />
          {totalValue > 0 && (
            <span className="text-[9px] px-2 py-0.5 rounded-full font-mono font-medium"
              style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '0.5px solid rgba(251,191,36,0.25)' }}>
              ${(totalValue / 1000).toFixed(0)}k active
            </span>
          )}
          {/* View toggle */}
          <div className="flex rounded-lg overflow-hidden"
            style={{ border: '0.5px solid rgba(255,255,255,0.1)' }}>
            {(['list', 'kanban'] as JobView[]).map(v => (
              <button key={v} onClick={() => setView(v)}
                className="px-2 py-0.5 text-[9px] capitalize transition-all"
                style={viewMode === v
                  ? { background: 'rgba(251,191,36,0.2)', color: '#fbbf24' }
                  : { background: 'rgba(255,255,255,0.02)', color: 'rgba(255,255,255,0.3)' }
                }
              >
                {v}
              </button>
            ))}
          </div>
          <span className="text-[9px] uppercase tracking-widest font-mono px-2 py-0.5 rounded"
            style={{ background: 'rgba(251,191,36,0.08)', color: 'rgba(251,191,36,0.55)', border: '0.5px solid rgba(251,191,36,0.18)' }}>
            Archivist
          </span>
        </div>

        {/* Filters */}
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className="px-2.5 py-0.5 rounded-full text-[10px] font-medium transition-all"
              style={filter === f.key
                ? { background: 'rgba(251,191,36,0.2)', border: '0.5px solid rgba(251,191,36,0.45)', color: '#fbbf24' }
                : { background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.3)' }
              }
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center gap-2 py-6 justify-center">
            <div className="w-4 h-4 rounded-full border-2 border-amber-500/30 border-t-amber-400 animate-spin" />
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Loading jobs…</p>
          </div>
        ) : viewMode === 'kanban' ? (
          <div className="flex gap-2">
            {STATUS_ORDER.map(s => (
              <KanbanCol key={s} status={s} jobs={visible.filter(j => j.status === s)} />
            ))}
          </div>
        ) : (
          <div className="space-y-1.5 overflow-y-auto pr-0.5" style={{ maxHeight: '38vh', scrollbarWidth: 'none' }}>
            <div className="grid px-3 py-1.5 rounded-lg gap-2"
              style={{ gridTemplateColumns: '1fr 70px 80px 70px 52px', background: 'rgba(255,255,255,0.03)', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
              {['Job', 'Type', 'Status', 'Value', 'Age'].map(h => (
                <span key={h} className="text-[9px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.25)' }}>{h}</span>
              ))}
            </div>
            {visible.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: 'rgba(255,255,255,0.22)' }}>No jobs match this filter</p>
            ) : visible.map(j => {
              const typeHex = TYPE_HEX[j.job_type ?? ''] ?? TYPE_HEX.default
              const typeRgb = hexRgb(typeHex)
              const statHex = STATUS_HEX[j.status ?? ''] ?? '#94a3b8'
              const statRgb = hexRgb(statHex)
              return (
                <div key={j.id} className="grid items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ gridTemplateColumns: '1fr 70px 80px 70px 52px', background: 'rgba(255,255,255,0.025)', border: '0.5px solid rgba(255,255,255,0.06)' }}>
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: 'rgba(255,255,255,0.85)' }}>{j.title ?? '—'}</p>
                    {j.site_name && <p className="text-[9px] truncate" style={{ color: 'rgba(255,255,255,0.3)' }}>{j.site_name}</p>}
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded capitalize"
                    style={{ background: `rgba(${typeRgb},0.12)`, color: typeHex, border: `0.5px solid rgba(${typeRgb},0.25)` }}>
                    {j.job_type ?? 'job'}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded capitalize"
                    style={{ background: `rgba(${statRgb},0.12)`, color: statHex, border: `0.5px solid rgba(${statRgb},0.25)` }}>
                    {(j.status ?? '—').replace('_', ' ')}
                  </span>
                  <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.55)' }}>
                    {j.value ? `$${Number(j.value).toLocaleString()}` : '—'}
                  </span>
                  <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.22)' }}>
                    {j.created_at ? timeAgo(j.created_at) : '—'}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-0.5" style={{ borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
          <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>
            {visible.length} job{visible.length !== 1 ? 's' : ''} · {viewMode} view
          </span>
          <span className="text-[9px] uppercase tracking-widest" style={{ color: 'rgba(251,191,36,0.3)' }}>
            Nexus Archivist · Job OS
          </span>
        </div>
      </div>
    </>
  )
}
