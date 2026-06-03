'use client'

import { useState, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type OLTab    = 'opportunities' | 'leads'
type OppStage = 'all' | 'prospect' | 'qualified' | 'proposal_sent' | 'negotiation' | 'won'

interface OppRow {
  id: string; name?: string; company_name?: string; stage?: string
  value?: number; probability?: number; created_at?: string; updated_at?: string
}
interface LeadRow {
  id: string; name?: string; company_name?: string; stage?: string
  property_name?: string; created_at?: string; source?: string
}

interface Props { onBack: () => void }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STAGE_HEX: Record<string, string> = {
  prospect: '#6B7EFF', new: '#6B7EFF', contacted: '#fbbf24', qualified: '#34d399',
  proposal_sent: '#0B7285', negotiation: '#f59e0b', won: '#10b981', lost: '#f87171',
  aria_draft: '#a855f7', survey_requested: '#0B7285',
}

function hexRgb(h: string) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h)
  return r ? `${parseInt(r[1], 16)},${parseInt(r[2], 16)},${parseInt(r[3], 16)}` : '107,126,255'
}

function aiScore(id: string, stage?: string): number {
  const base: Record<string, number> = { won: 94, negotiation: 85, proposal_sent: 74, qualified: 63, contacted: 48, prospect: 35, new: 30 }
  const b = base[stage ?? ''] ?? 40
  const h = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return Math.min(99, b + (h % 12))
}

function scoreColor(s: number): string {
  return s >= 80 ? '#34d399' : s >= 60 ? '#fbbf24' : '#f87171'
}

function timeAgo(iso: string): string {
  const d = (Date.now() - new Date(iso).getTime()) / 1000
  if (d < 3600)  return `${Math.round(d / 60)}m ago`
  if (d < 86400) return `${Math.round(d / 3600)}h ago`
  return `${Math.round(d / 86400)}d ago`
}

// ─── Explorer ─────────────────────────────────────────────────────────────────

export function OppsLeadsExplorer({ onBack }: Props) {
  const [tab,   setTab]   = useState<OLTab>('opportunities')
  const [stage, setStage] = useState<OppStage>('all')
  const [opps,  setOpps]  = useState<OppRow[]>([])
  const [leads, setLeads] = useState<LeadRow[]>([])
  const [loading, setLoad] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/crm/opportunities?limit=30').then(r => r.json()).catch(() => ({})),
      fetch('/api/crm/leads?limit=30').then(r => r.json()).catch(() => ({})),
    ]).then(([o, l]) => {
      setOpps(o.records ?? o.opportunities ?? [])
      setLeads(l.records ?? l.leads ?? [])
    }).finally(() => setLoad(false))
  }, [])

  const STAGE_FILTERS: { key: OppStage; label: string }[] = [
    { key: 'all',           label: `All (${opps.length})` },
    { key: 'prospect',      label: 'Prospect'      },
    { key: 'qualified',     label: 'Qualified'     },
    { key: 'proposal_sent', label: 'Proposal'      },
    { key: 'negotiation',   label: 'Negotiation'   },
    { key: 'won',           label: 'Won'           },
  ]

  const filteredOpps = stage === 'all' ? opps : opps.filter(o => o.stage === stage)
  const pipelineTotal = filteredOpps.reduce((s, o) => s + (o.value ?? 0), 0)

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
            style={{ color: 'rgba(52,211,153,0.55)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(52,211,153,0.95)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(52,211,153,0.55)')}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-xs font-medium">New Opps / Leads</span>
          </button>
          <div className="flex-1 h-px" style={{ background: 'rgba(52,211,153,0.15)' }} />
          {pipelineTotal > 0 && (
            <span className="text-[9px] px-2 py-0.5 rounded-full font-mono font-medium"
              style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '0.5px solid rgba(52,211,153,0.25)' }}>
              ${(pipelineTotal / 1000).toFixed(0)}k pipeline
            </span>
          )}
          <span className="text-[9px] uppercase tracking-widest font-mono px-2 py-0.5 rounded"
            style={{ background: 'rgba(52,211,153,0.08)', color: 'rgba(52,211,153,0.55)', border: '0.5px solid rgba(52,211,153,0.18)' }}>
            Archivist
          </span>
        </div>

        {/* Tab toggle */}
        <div className="flex gap-1.5">
          {(['opportunities', 'leads'] as OLTab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-2.5 py-0.5 rounded-full text-[10px] font-medium capitalize transition-all"
              style={tab === t
                ? { background: 'rgba(52,211,153,0.2)', border: '0.5px solid rgba(52,211,153,0.45)', color: '#34d399' }
                : { background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.3)' }
              }
            >
              {t === 'opportunities' ? `Opportunities (${opps.length})` : `Leads (${leads.length})`}
            </button>
          ))}
        </div>

        {/* Stage filters — opps only */}
        {tab === 'opportunities' && (
          <div className="flex gap-1.5 flex-wrap">
            {STAGE_FILTERS.map(f => (
              <button key={f.key} onClick={() => setStage(f.key)}
                className="px-2 py-0.5 rounded-full text-[9px] font-medium transition-all"
                style={stage === f.key
                  ? { background: 'rgba(52,211,153,0.18)', border: '0.5px solid rgba(52,211,153,0.4)', color: '#34d399' }
                  : { background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.25)' }
                }
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex items-center gap-2 py-6 justify-center">
            <div className="w-4 h-4 rounded-full border-2 border-emerald-500/30 border-t-emerald-400 animate-spin" />
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Loading pipeline…</p>
          </div>
        ) : tab === 'opportunities' ? (
          <div className="space-y-1.5 overflow-y-auto pr-0.5" style={{ maxHeight: '38vh', scrollbarWidth: 'none' }}>
            <div className="grid px-3 py-1.5 rounded-lg gap-2"
              style={{ gridTemplateColumns: '1fr 90px 72px 48px 48px', background: 'rgba(255,255,255,0.03)', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
              {['Opportunity', 'Stage', 'Value', 'AI', 'Age'].map(h => (
                <span key={h} className="text-[9px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.25)' }}>{h}</span>
              ))}
            </div>
            {filteredOpps.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: 'rgba(255,255,255,0.22)' }}>No opportunities in this stage</p>
            ) : filteredOpps.map(o => {
              const hex2 = STAGE_HEX[o.stage ?? ''] ?? '#6B7EFF'
              const rgb2 = hexRgb(hex2)
              const score = aiScore(o.id, o.stage)
              return (
                <div key={o.id} className="grid items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ gridTemplateColumns: '1fr 90px 72px 48px 48px', background: 'rgba(255,255,255,0.025)', border: '0.5px solid rgba(255,255,255,0.06)' }}>
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: 'rgba(255,255,255,0.85)' }}>{o.name ?? 'Untitled'}</p>
                    <p className="text-[9px] truncate" style={{ color: 'rgba(255,255,255,0.3)' }}>{o.company_name ?? '—'}</p>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded capitalize"
                    style={{ background: `rgba(${rgb2},0.12)`, color: hex2, border: `0.5px solid rgba(${rgb2},0.25)` }}>
                    {(o.stage ?? '—').replace('_', ' ')}
                  </span>
                  <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.55)' }}>
                    {o.value ? `$${Number(o.value).toLocaleString()}` : '—'}
                  </span>
                  <span className="text-[10px] font-mono font-bold" style={{ color: scoreColor(score) }}>{score}</span>
                  <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.22)' }}>
                    {o.updated_at ? timeAgo(o.updated_at) : o.created_at ? timeAgo(o.created_at) : '—'}
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="space-y-1.5 overflow-y-auto pr-0.5" style={{ maxHeight: '38vh', scrollbarWidth: 'none' }}>
            <div className="grid px-3 py-1.5 rounded-lg gap-2"
              style={{ gridTemplateColumns: '1fr 1fr 80px 52px', background: 'rgba(255,255,255,0.03)', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
              {['Lead', 'Property', 'Stage', 'When'].map(h => (
                <span key={h} className="text-[9px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.25)' }}>{h}</span>
              ))}
            </div>
            {leads.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: 'rgba(255,255,255,0.22)' }}>No leads yet</p>
            ) : leads.map(l => {
              const hex2 = STAGE_HEX[l.stage ?? ''] ?? '#6B7EFF'
              const rgb2 = hexRgb(hex2)
              return (
                <div key={l.id} className="grid items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ gridTemplateColumns: '1fr 1fr 80px 52px', background: 'rgba(255,255,255,0.025)', border: '0.5px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-xs font-medium truncate" style={{ color: 'rgba(255,255,255,0.85)' }}>{l.name ?? '—'}</p>
                  <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>{l.property_name ?? l.company_name ?? '—'}</p>
                  <span className="text-[10px] px-1.5 py-0.5 rounded capitalize"
                    style={{ background: `rgba(${rgb2},0.12)`, color: hex2, border: `0.5px solid rgba(${rgb2},0.25)` }}>
                    {(l.stage ?? 'new').replace('_', ' ')}
                  </span>
                  <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.22)' }}>
                    {l.created_at ? timeAgo(l.created_at) : '—'}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-0.5" style={{ borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
          <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>
            {tab === 'opportunities' ? `${filteredOpps.length} opportunities` : `${leads.length} leads`}
          </span>
          <span className="text-[9px] uppercase tracking-widest" style={{ color: 'rgba(52,211,153,0.3)' }}>
            Nexus Archivist · Pipeline
          </span>
        </div>
      </div>
    </>
  )
}
