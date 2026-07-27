'use client'

import { useState, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type FieldTab = 'work_orders' | 'technicians'

interface WORow  {
  id: string; wo_number?: string; title?: string; status?: string
  priority?: string; customer_name?: string; assigned_tech?: string
  scheduled_date?: string
}
interface TechRow {
  id: string; name?: string; status?: string; tech_code?: string
  current_job?: string; phone?: string
}

interface Props { onBack: () => void }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRIORITY_HEX: Record<string, string> = { critical: '#f87171', high: '#fbbf24', normal: '#6B7EFF', low: '#34d399' }
const STATUS_HEX:   Record<string, string> = {
  open: '#f87171', scheduled: '#6B7EFF', in_progress: '#fbbf24',
  completed: '#34d399', on_hold: '#94a3b8',
  available: '#34d399', busy: '#fbbf24', offline: '#94a3b8',
}

function hexRgb(h: string) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h)
  return r ? `${parseInt(r[1], 16)},${parseInt(r[2], 16)},${parseInt(r[3], 16)}` : '107,126,255'
}

function statusDot(status: string) {
  const hex = STATUS_HEX[status] ?? '#94a3b8'
  return <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: hex, boxShadow: `0 0 5px ${hex}80` }} />
}

// ─── Explorer ─────────────────────────────────────────────────────────────────

export function FieldExplorer({ onBack }: Props) {
  const [tab,     setTab]    = useState<FieldTab>('work_orders')
  const [orders,  setOrders] = useState<WORow[]>([])
  const [techs,   setTechs]  = useState<TechRow[]>([])
  const [loading, setLoad]   = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/dispatch/work-orders/today').then(r => r.json()).catch(() => ({})),
      fetch('/api/dispatch/technicians').then(r => r.json()).catch(() => ({})),
    ]).then(([wo, t]) => {
      setOrders(wo.work_orders ?? wo.orders ?? wo.records ?? [])
      setTechs(t.technicians ?? t.records ?? [])
    }).finally(() => setLoad(false))
  }, [])

  const openCount  = orders.filter(w => w.status === 'open').length
  const activeCount = orders.filter(w => w.status === 'in_progress').length

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
            style={{ color: 'rgba(11,114,133,0.7)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(11,114,133,1)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(11,114,133,0.7)')}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-xs font-medium">Field Ops</span>
          </button>
          <div className="flex-1 h-px" style={{ background: 'rgba(11,114,133,0.2)' }} />
          <div className="flex gap-2">
            {openCount > 0 && (
              <span className="text-[9px] px-2 py-0.5 rounded-full font-medium"
                style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171', border: '0.5px solid rgba(248,113,113,0.25)' }}>
                {openCount} open
              </span>
            )}
            {activeCount > 0 && (
              <span className="text-[9px] px-2 py-0.5 rounded-full font-medium"
                style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '0.5px solid rgba(251,191,36,0.25)' }}>
                {activeCount} active
              </span>
            )}
          </div>
          <span className="text-[9px] uppercase tracking-widest font-mono px-2 py-0.5 rounded"
            style={{ background: 'rgba(11,114,133,0.1)', color: 'rgba(11,114,133,0.7)', border: '0.5px solid rgba(11,114,133,0.2)' }}>
            Archivist
          </span>
        </div>

        {/* Tab toggle */}
        <div className="flex gap-1.5">
          <button onClick={() => setTab('work_orders')}
            className="px-2.5 py-0.5 rounded-full text-[10px] font-medium transition-all"
            style={tab === 'work_orders'
              ? { background: 'rgba(11,114,133,0.2)', border: '0.5px solid rgba(11,114,133,0.45)', color: '#0B7285' }
              : { background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.3)' }
            }
          >
            Work Orders ({orders.length})
          </button>
          <button onClick={() => setTab('technicians')}
            className="px-2.5 py-0.5 rounded-full text-[10px] font-medium transition-all"
            style={tab === 'technicians'
              ? { background: 'rgba(11,114,133,0.2)', border: '0.5px solid rgba(11,114,133,0.45)', color: '#0B7285' }
              : { background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.3)' }
            }
          >
            Tech Roster ({techs.length})
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center gap-2 py-6 justify-center">
            <div className="w-4 h-4 rounded-full border-2 border-teal-500/30 border-t-teal-400 animate-spin" />
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Loading field data…</p>
          </div>
        ) : tab === 'work_orders' ? (
          <div className="space-y-1.5 overflow-y-auto pr-0.5" style={{ maxHeight: '38vh', scrollbarWidth: 'none' }}>
            <div className="grid px-3 py-1.5 rounded-lg gap-2"
              style={{ gridTemplateColumns: '8px 64px 1fr 80px 60px', background: 'rgba(255,255,255,0.03)', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
              <span />
              {['WO#', 'Job', 'Status', 'Priority'].map(h => (
                <span key={h} className="text-[9px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.25)' }}>{h}</span>
              ))}
            </div>
            {orders.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: 'rgba(255,255,255,0.22)' }}>No work orders today</p>
            ) : orders.map(wo => {
              const statHex = STATUS_HEX[wo.status ?? ''] ?? '#6B7EFF'
              const statRgb = hexRgb(statHex)
              const priHex  = PRIORITY_HEX[wo.priority ?? ''] ?? '#6B7EFF'
              return (
                <div key={wo.id} className="grid items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ gridTemplateColumns: '8px 64px 1fr 80px 60px', background: 'rgba(255,255,255,0.025)', border: '0.5px solid rgba(255,255,255,0.06)' }}>
                  <span className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: priHex, boxShadow: `0 0 4px ${priHex}80` }} />
                  <span className="text-[10px] font-mono truncate" style={{ color: 'rgba(52,211,153,0.8)' }}>{wo.wo_number ?? '—'}</span>
                  <div className="min-w-0">
                    <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.82)' }}>{wo.title ?? '—'}</p>
                    {wo.customer_name && <p className="text-[9px] truncate" style={{ color: 'rgba(255,255,255,0.3)' }}>{wo.customer_name}</p>}
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded capitalize"
                    style={{ background: `rgba(${statRgb},0.12)`, color: statHex, border: `0.5px solid rgba(${statRgb},0.25)` }}>
                    {(wo.status ?? '—').replace('_', ' ')}
                  </span>
                  <span className="text-[10px] capitalize font-medium" style={{ color: priHex }}>{wo.priority ?? '—'}</span>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="space-y-1.5 overflow-y-auto pr-0.5" style={{ maxHeight: '38vh', scrollbarWidth: 'none' }}>
            <div className="grid px-3 py-1.5 rounded-lg gap-2"
              style={{ gridTemplateColumns: '8px 1fr 80px 90px', background: 'rgba(255,255,255,0.03)', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
              <span />
              {['Technician', 'Status', 'Code'].map(h => (
                <span key={h} className="text-[9px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.25)' }}>{h}</span>
              ))}
            </div>
            {techs.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: 'rgba(255,255,255,0.22)' }}>No technicians found</p>
            ) : techs.map(t => {
              const statHex = STATUS_HEX[t.status ?? 'offline'] ?? '#94a3b8'
              const statRgb = hexRgb(statHex)
              return (
                <div key={t.id} className="grid items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ gridTemplateColumns: '8px 1fr 80px 90px', background: 'rgba(255,255,255,0.025)', border: '0.5px solid rgba(255,255,255,0.06)' }}>
                  {statusDot(t.status ?? 'offline')}
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: 'rgba(255,255,255,0.85)' }}>{t.name ?? '—'}</p>
                    {t.current_job && <p className="text-[9px] truncate" style={{ color: 'rgba(255,255,255,0.3)' }}>{t.current_job}</p>}
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded capitalize"
                    style={{ background: `rgba(${statRgb},0.12)`, color: statHex, border: `0.5px solid rgba(${statRgb},0.25)` }}>
                    {t.status ?? 'offline'}
                  </span>
                  <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    {t.tech_code ?? '—'}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-0.5" style={{ borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
          <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>
            {tab === 'work_orders' ? `${orders.length} orders today` : `${techs.length} technicians`}
          </span>
          <span className="text-[9px] uppercase tracking-widest" style={{ color: 'rgba(11,114,133,0.4)' }}>
            Nexus Archivist · Field Ops
          </span>
        </div>
      </div>
    </>
  )
}
