'use client'

import { useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WOItem {
  id:               string
  wo_number:        string
  title:            string
  customer_name:    string | null
  priority:         string
  status:           string
  already_assigned: boolean
  recommended_tech: { id: string; name: string; status: string } | null
  ai_score:         number
  ai_reasoning:     string
}

interface Props {
  workOrders:    WOItem[]
  dismissed:     Set<string>
  onAssign:      (wo: WOItem) => Promise<void>
  onDismiss:     (id: string) => void
  onBack:        () => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

type WOFilter = 'all' | 'open' | 'scheduled' | 'in_progress' | 'critical'
type SortKey  = 'ai_score' | 'priority' | 'status' | 'wo_number'

const PRIORITY_RANK: Record<string, number> = { critical: 4, high: 3, normal: 2, low: 1 }
const STATUS_LABEL:  Record<string, string>  = { open: 'Pending', scheduled: 'Assigned', in_progress: 'In Progress', completed: 'Done' }
const PRIORITY_HEX:  Record<string, string>  = { critical: '#f87171', high: '#fbbf24', normal: '#6B7EFF', low: '#34d399' }

function hexRgb(h: string) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h)
  return r ? `${parseInt(r[1],16)},${parseInt(r[2],16)},${parseInt(r[3],16)}` : '107,126,255'
}

// ─── Row component ────────────────────────────────────────────────────────────

function WOGridRow({
  wo, onAssign, onDismiss,
}: { wo: WOItem; onAssign: () => Promise<void>; onDismiss: () => void }) {
  const [phase, setPhase]   = useState<'idle' | 'confirm' | 'busy' | 'done'>('idle')
  const [expanded, setExp]  = useState(false)
  const dot  = PRIORITY_HEX[wo.priority] ?? '#6B7EFF'
  const rgb  = hexRgb(dot)
  const scoreColor = wo.ai_score >= 85 ? '#34d399' : wo.ai_score >= 70 ? '#fbbf24' : '#f87171'

  async function handleAssign() {
    if (phase === 'idle')    { setPhase('confirm'); return }
    if (phase === 'confirm') {
      setPhase('busy')
      try    { await onAssign(); setPhase('done') }
      catch  { setPhase('confirm') }
    }
  }

  if (phase === 'done') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
        style={{ background: 'rgba(52,211,153,0.07)', border: '0.5px solid rgba(52,211,153,0.2)' }}>
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
          <path d="M1.5 5.5l3 3 5-5" stroke="#34d399" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span className="text-[10px] font-mono" style={{ color: 'rgba(52,211,153,0.8)' }}>
          {wo.wo_number} → Assigned
        </span>
      </div>
    )
  }

  return (
    <>
      <div
        className="grid items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all"
        style={{
          gridTemplateColumns: '8px 80px 1fr 80px 68px 80px 38px 28px',
          background: expanded ? 'rgba(107,126,255,0.08)' : 'rgba(255,255,255,0.025)',
          border: expanded
            ? '0.5px solid rgba(107,126,255,0.25)'
            : '0.5px solid rgba(255,255,255,0.06)',
        }}
        onClick={() => setExp(e => !e)}
      >
        {/* Priority dot */}
        <span className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: dot, boxShadow: `0 0 5px ${dot}90` }} />

        {/* WO number */}
        <span className="text-[10px] font-mono truncate" style={{ color: 'rgba(107,126,255,0.8)' }}>
          {wo.wo_number}
        </span>

        {/* Title */}
        <span className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.82)' }}>
          {wo.title}
        </span>

        {/* Status */}
        <span
          className="text-[10px] px-1.5 py-0.5 rounded text-center"
          style={{ background: `rgba(${rgb},0.12)`, color: dot, border: `0.5px solid rgba(${rgb},0.25)` }}
        >
          {STATUS_LABEL[wo.status] ?? wo.status}
        </span>

        {/* Customer */}
        <span className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.3)' }}>
          {wo.customer_name ?? '—'}
        </span>

        {/* Tech / Assign */}
        <button
          onClick={e => { e.stopPropagation(); handleAssign() }}
          disabled={phase === 'busy' || !wo.recommended_tech}
          className="text-[10px] px-2 py-0.5 rounded-lg font-medium transition-all text-left truncate"
          style={
            phase === 'confirm'
              ? { background: 'rgba(251,191,36,0.2)', border: '0.5px solid rgba(251,191,36,0.4)', color: '#fbbf24' }
              : wo.recommended_tech
              ? { background: 'rgba(107,126,255,0.12)', border: '0.5px solid rgba(107,126,255,0.28)', color: '#a5b4ff' }
              : { background: 'transparent', color: 'rgba(255,255,255,0.2)', cursor: 'default' }
          }
        >
          {phase === 'busy'    ? '…'
          : phase === 'confirm' ? 'Confirm'
          : wo.recommended_tech ? wo.recommended_tech.name
          : 'Unassigned'}
        </button>

        {/* AI Score */}
        <span className="text-[10px] font-mono font-bold text-right"
          style={{ color: scoreColor }}>
          {wo.ai_score}
        </span>

        {/* Dismiss */}
        <button
          onClick={e => { e.stopPropagation(); onDismiss() }}
          className="opacity-20 hover:opacity-60 transition-opacity flex justify-center"
          aria-label="Dismiss"
        >
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden="true">
            <path d="M1 1l7 7M8 1L1 8" stroke="rgba(255,255,255,0.7)" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Expanded reasoning row */}
      {expanded && (
        <div
          className="px-4 py-2.5 rounded-b-lg -mt-1 mb-1"
          style={{ background: 'rgba(107,126,255,0.05)', borderLeft: '2px solid rgba(107,126,255,0.3)' }}
        >
          <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'rgba(107,126,255,0.5)' }}>
            AI Reasoning
          </p>
          <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
            {wo.ai_reasoning}
          </p>
        </div>
      )}
    </>
  )
}

// ─── Explorer ─────────────────────────────────────────────────────────────────

export function WOExplorer({ workOrders, dismissed, onAssign, onDismiss, onBack }: Props) {
  const [filter, setFilter] = useState<WOFilter>('all')
  const [sortBy, setSortBy] = useState<SortKey>('ai_score')
  const [sortAsc, setSortAsc] = useState(false)

  const visible = workOrders
    .filter(wo => !dismissed.has(wo.id))
    .filter(wo => {
      if (filter === 'all')         return true
      if (filter === 'open')        return wo.status === 'open'
      if (filter === 'scheduled')   return wo.status === 'scheduled'
      if (filter === 'in_progress') return wo.status === 'in_progress'
      if (filter === 'critical')    return wo.priority === 'critical' || wo.priority === 'high'
      return true
    })
    .sort((a, b) => {
      let delta = 0
      if (sortBy === 'ai_score')  delta = a.ai_score - b.ai_score
      if (sortBy === 'priority')  delta = (PRIORITY_RANK[a.priority] ?? 0) - (PRIORITY_RANK[b.priority] ?? 0)
      if (sortBy === 'status')    delta = a.status.localeCompare(b.status)
      if (sortBy === 'wo_number') delta = a.wo_number.localeCompare(b.wo_number)
      return sortAsc ? delta : -delta
    })

  const filters: { key: WOFilter; label: string }[] = [
    { key: 'all',         label: `All (${workOrders.filter(w => !dismissed.has(w.id)).length})` },
    { key: 'critical',    label: 'Critical' },
    { key: 'open',        label: 'Pending' },
    { key: 'scheduled',   label: 'Assigned' },
    { key: 'in_progress', label: 'Active' },
  ]

  function toggleSort(key: SortKey) {
    if (sortBy === key) setSortAsc(a => !a)
    else { setSortBy(key); setSortAsc(false) }
  }

  const SortBtn = ({ col, label }: { col: SortKey; label: string }) => (
    <button
      onClick={() => toggleSort(col)}
      className="text-[9px] uppercase tracking-wider flex items-center gap-0.5 transition-colors"
      style={{ color: sortBy === col ? 'rgba(107,126,255,0.9)' : 'rgba(255,255,255,0.25)' }}
    >
      {label}
      {sortBy === col && (
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
          <path d={sortAsc ? 'M1 5l3-3 3 3' : 'M1 3l3 3 3-3'}
            stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </button>
  )

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
        {/* Back + header */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 transition-colors"
            style={{ color: 'rgba(107,126,255,0.55)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(107,126,255,0.95)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(107,126,255,0.55)')}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-xs font-medium">Work Orders</span>
          </button>
          <div
            className="flex-1 h-px"
            style={{ background: 'rgba(107,126,255,0.15)' }}
          />
          <span
            className="text-[9px] uppercase tracking-widest font-mono px-2 py-0.5 rounded"
            style={{ background: 'rgba(107,126,255,0.1)', color: 'rgba(107,126,255,0.6)', border: '0.5px solid rgba(107,126,255,0.2)' }}
          >
            Explorer
          </span>
        </div>

        {/* Filter pills */}
        <div className="flex gap-1.5 flex-wrap">
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className="px-2.5 py-0.5 rounded-full text-[10px] font-medium transition-all"
              style={
                filter === f.key
                  ? { background: 'rgba(107,126,255,0.22)', border: '0.5px solid rgba(107,126,255,0.5)', color: '#a5b4ff' }
                  : { background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.3)' }
              }
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Column headers */}
        <div
          className="grid px-3 py-1.5 rounded-lg"
          style={{
            gridTemplateColumns: '8px 80px 1fr 80px 68px 80px 38px 28px',
            background: 'rgba(255,255,255,0.03)',
            borderBottom: '0.5px solid rgba(255,255,255,0.07)',
          }}
        >
          <span />
          <SortBtn col="wo_number" label="WO#" />
          <span className="text-[9px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.25)' }}>Job</span>
          <SortBtn col="status" label="Status" />
          <span className="text-[9px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.25)' }}>Customer</span>
          <span className="text-[9px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.25)' }}>Tech</span>
          <SortBtn col="ai_score" label="AI" />
          <span />
        </div>

        {/* Data rows */}
        <div className="space-y-1 overflow-y-auto pr-0.5" style={{ maxHeight: '42vh', scrollbarWidth: 'none' }}>
          {visible.length === 0 ? (
            <p className="text-xs text-center py-6" style={{ color: 'rgba(255,255,255,0.22)' }}>
              No work orders match this filter
            </p>
          ) : visible.map(wo => (
            <WOGridRow
              key={wo.id}
              wo={wo}
              onAssign={() => onAssign(wo)}
              onDismiss={() => onDismiss(wo.id)}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1" style={{ borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
          <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>
            {visible.length} work order{visible.length !== 1 ? 's' : ''} · sorted by {sortBy.replace('_', ' ')}
          </span>
          <span
            className="text-[9px] uppercase tracking-widest"
            style={{ color: 'rgba(107,126,255,0.35)' }}
          >
            Nexus Dispatch · Explorer Mode
          </span>
        </div>
      </div>
    </>
  )
}
