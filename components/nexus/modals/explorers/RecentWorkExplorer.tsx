'use client'

import { useState, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type RWTab = 'quotes' | 'orders' | 'activity'

interface QuoteRow { id: string; title?: string; customer_name?: string; status?: string; total?: number; created_at?: string }
interface WORow    { id: string; wo_number?: string; title?: string; status?: string; priority?: string; customer_name?: string }
interface ActRow   { id: string; subject?: string; type?: string; outcome?: string; created_at?: string; contact_name?: string }

interface Props { onBack: () => void }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_HEX: Record<string, string> = {
  draft: '#6B7EFF', sent: '#fbbf24', viewed: '#34d399', accepted: '#10b981', declined: '#f87171',
  open: '#f87171', scheduled: '#6B7EFF', in_progress: '#fbbf24', completed: '#34d399',
  call: '#0B7285', email: '#6B7EFF', meeting: '#a855f7', task: '#fbbf24', note: '#94a3b8',
  critical: '#f87171', high: '#fbbf24', normal: '#6B7EFF', low: '#34d399',
}

function hexRgb(h: string) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h)
  return r ? `${parseInt(r[1], 16)},${parseInt(r[2], 16)},${parseInt(r[3], 16)}` : '107,126,255'
}

function timeAgo(iso: string): string {
  const d = (Date.now() - new Date(iso).getTime()) / 1000
  if (d < 60)    return 'just now'
  if (d < 3600)  return `${Math.round(d / 60)}m ago`
  if (d < 86400) return `${Math.round(d / 3600)}h ago`
  return `${Math.round(d / 86400)}d ago`
}

// ─── Explorer ─────────────────────────────────────────────────────────────────

export function RecentWorkExplorer({ onBack }: Props) {
  const [tab,     setTab]    = useState<RWTab>('quotes')
  const [quotes,  setQuotes] = useState<QuoteRow[]>([])
  const [orders,  setOrders] = useState<WORow[]>([])
  const [acts,    setActs]   = useState<ActRow[]>([])
  const [loading, setLoad]   = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/quotes?limit=25').then(r => r.json()).catch(() => ({})),
      fetch('/api/dispatch/work-orders/today').then(r => r.json()).catch(() => ({})),
      fetch('/api/crm/activities?limit=25').then(r => r.json()).catch(() => ({})),
    ]).then(([q, wo, a]) => {
      setQuotes(q.quotes ?? q.records ?? [])
      setOrders(wo.work_orders ?? wo.orders ?? wo.records ?? [])
      setActs(a.activities ?? a.records ?? [])
    }).finally(() => setLoad(false))
  }, [])

  const TABS = [
    { key: 'quotes'   as RWTab, label: 'Quotes',      hex: '#6B7EFF', count: quotes.length  },
    { key: 'orders'   as RWTab, label: 'Work Orders',  hex: '#34d399', count: orders.length  },
    { key: 'activity' as RWTab, label: 'CRM Activity', hex: '#a855f7', count: acts.length    },
  ]
  const activeHex = TABS.find(t => t.key === tab)?.hex ?? '#6B7EFF'
  const rgb = hexRgb(activeHex)

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
            style={{ color: `rgba(${rgb},0.55)` }}
            onMouseEnter={e => (e.currentTarget.style.color = `rgba(${rgb},0.95)`)}
            onMouseLeave={e => (e.currentTarget.style.color = `rgba(${rgb},0.55)`)}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-xs font-medium">Recent Work</span>
          </button>
          <div className="flex-1 h-px" style={{ background: `rgba(${rgb},0.15)` }} />
          <span className="text-[9px] uppercase tracking-widest font-mono px-2 py-0.5 rounded"
            style={{ background: `rgba(${rgb},0.08)`, color: `rgba(${rgb},0.55)`, border: `0.5px solid rgba(${rgb},0.18)` }}>
            Archivist
          </span>
        </div>

        {/* Tab pills */}
        <div className="flex gap-1.5 flex-wrap">
          {TABS.map(t => {
            const tRgb = hexRgb(t.hex)
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className="px-2.5 py-0.5 rounded-full text-[10px] font-medium transition-all"
                style={tab === t.key
                  ? { background: `rgba(${tRgb},0.2)`, border: `0.5px solid rgba(${tRgb},0.45)`, color: t.hex }
                  : { background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.3)' }
                }
              >
                {t.label}{t.count > 0 ? ` (${t.count})` : ''}
              </button>
            )
          })}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex items-center gap-2 py-6 justify-center">
            <div className="w-4 h-4 rounded-full border-2 border-indigo-500/30 border-t-indigo-400 animate-spin" />
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Loading…</p>
          </div>
        ) : tab === 'quotes' ? (
          <div className="space-y-1.5 overflow-y-auto pr-0.5" style={{ maxHeight: '38vh', scrollbarWidth: 'none' }}>
            <div className="grid px-3 py-1.5 rounded-lg gap-2"
              style={{ gridTemplateColumns: '1fr 76px 72px 52px', background: 'rgba(255,255,255,0.03)', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
              {['Quote', 'Status', 'Total', 'When'].map(h => (
                <span key={h} className="text-[9px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.25)' }}>{h}</span>
              ))}
            </div>
            {quotes.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: 'rgba(255,255,255,0.22)' }}>No quotes found</p>
            ) : quotes.map(q => {
              const hex2 = STATUS_HEX[q.status ?? ''] ?? '#6B7EFF'
              const rgb2 = hexRgb(hex2)
              return (
                <div key={q.id} className="grid items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ gridTemplateColumns: '1fr 76px 72px 52px', background: 'rgba(255,255,255,0.025)', border: '0.5px solid rgba(255,255,255,0.06)' }}>
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: 'rgba(255,255,255,0.82)' }}>{q.title ?? 'Untitled'}</p>
                    <p className="text-[9px] truncate" style={{ color: 'rgba(255,255,255,0.3)' }}>{q.customer_name ?? '—'}</p>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded text-center capitalize"
                    style={{ background: `rgba(${rgb2},0.12)`, color: hex2, border: `0.5px solid rgba(${rgb2},0.25)` }}>
                    {q.status ?? '—'}
                  </span>
                  <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.55)' }}>
                    {q.total ? `$${Number(q.total).toLocaleString()}` : '—'}
                  </span>
                  <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.22)' }}>
                    {q.created_at ? timeAgo(q.created_at) : '—'}
                  </span>
                </div>
              )
            })}
          </div>
        ) : tab === 'orders' ? (
          <div className="space-y-1.5 overflow-y-auto pr-0.5" style={{ maxHeight: '38vh', scrollbarWidth: 'none' }}>
            <div className="grid px-3 py-1.5 rounded-lg gap-2"
              style={{ gridTemplateColumns: '68px 1fr 80px 58px', background: 'rgba(255,255,255,0.03)', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
              {['WO#', 'Job', 'Status', 'Priority'].map(h => (
                <span key={h} className="text-[9px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.25)' }}>{h}</span>
              ))}
            </div>
            {orders.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: 'rgba(255,255,255,0.22)' }}>No work orders today</p>
            ) : orders.map(wo => {
              const hex2 = STATUS_HEX[wo.status ?? ''] ?? '#6B7EFF'
              const rgb2 = hexRgb(hex2)
              const pHex = STATUS_HEX[wo.priority ?? ''] ?? '#94a3b8'
              return (
                <div key={wo.id} className="grid items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ gridTemplateColumns: '68px 1fr 80px 58px', background: 'rgba(255,255,255,0.025)', border: '0.5px solid rgba(255,255,255,0.06)' }}>
                  <span className="text-[10px] font-mono truncate" style={{ color: 'rgba(52,211,153,0.8)' }}>{wo.wo_number ?? '—'}</span>
                  <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.82)' }}>{wo.title ?? '—'}</p>
                  <span className="text-[10px] px-1.5 py-0.5 rounded text-center capitalize"
                    style={{ background: `rgba(${rgb2},0.12)`, color: hex2, border: `0.5px solid rgba(${rgb2},0.25)` }}>
                    {wo.status ?? '—'}
                  </span>
                  <span className="text-[10px] capitalize font-medium" style={{ color: pHex }}>{wo.priority ?? '—'}</span>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="space-y-1.5 overflow-y-auto pr-0.5" style={{ maxHeight: '38vh', scrollbarWidth: 'none' }}>
            <div className="grid px-3 py-1.5 rounded-lg gap-2"
              style={{ gridTemplateColumns: '60px 1fr 80px 52px', background: 'rgba(255,255,255,0.03)', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
              {['Type', 'Subject', 'Outcome', 'When'].map(h => (
                <span key={h} className="text-[9px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.25)' }}>{h}</span>
              ))}
            </div>
            {acts.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: 'rgba(255,255,255,0.22)' }}>No recent activity</p>
            ) : acts.map(a => {
              const hex2 = STATUS_HEX[a.type ?? ''] ?? '#6B7EFF'
              const rgb2 = hexRgb(hex2)
              return (
                <div key={a.id} className="grid items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ gridTemplateColumns: '60px 1fr 80px 52px', background: 'rgba(255,255,255,0.025)', border: '0.5px solid rgba(255,255,255,0.06)' }}>
                  <span className="text-[10px] px-1.5 py-0.5 rounded text-center capitalize"
                    style={{ background: `rgba(${rgb2},0.12)`, color: hex2, border: `0.5px solid rgba(${rgb2},0.25)` }}>
                    {a.type ?? '—'}
                  </span>
                  <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.82)' }}>{a.subject ?? '—'}</p>
                  <span className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>{a.outcome ?? '—'}</span>
                  <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.22)' }}>
                    {a.created_at ? timeAgo(a.created_at) : '—'}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-0.5" style={{ borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
          <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>
            {tab === 'quotes' ? `${quotes.length} quotes` : tab === 'orders' ? `${orders.length} orders` : `${acts.length} activities`}
          </span>
          <span className="text-[9px] uppercase tracking-widest" style={{ color: `rgba(${rgb},0.3)` }}>
            Nexus Archivist · Recent Work
          </span>
        </div>
      </div>
    </>
  )
}
