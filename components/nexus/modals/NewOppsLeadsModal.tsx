'use client'

import { useState, useEffect, useCallback } from 'react'
import { ModalScopeContext }    from '@/components/nexus/context/ModalScopeContext'
import { ActionCommandBar }     from '@/components/nexus/ActionCommandBar'
import { OppsLeadsExplorer }    from './explorers/OppsLeadsExplorer'

// ─── Types ────────────────────────────────────────────────────────────────────

type View = 'commander' | 'archivist'

interface OppSummary  { id: string; name?: string; company_name?: string; stage?: string; value?: number }
interface LeadSummary { id: string; name?: string; company_name?: string; stage?: string; property_name?: string }
interface ARIASummary { id: string; query?: string; created_at?: string }

const ACTIONABLE = new Set(['new', 'contacted', 'qualified', 'prospect', 'aria_draft', 'survey_requested', 'proposal_sent', 'negotiation'])

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
    <div className="rounded-2xl p-3.5 flex flex-col gap-2.5 transition-all"
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

export function NewOppsLeadsModal() {
  const [view,         setView]     = useState<View>('commander')
  const [actionCount,  setActCount] = useState<number | null>(null)
  const [topLead,      setTopLead]  = useState<LeadSummary | null>(null)
  const [lastARIA,     setLastARIA] = useState<ARIASummary | null>(null)
  const [loading,      setLoading]  = useState(true)
  const [cmdResult,    setCmdResult] = useState<string | null>(null)
  const [cmdLoading,   setCmdLoad]  = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/crm/leads?limit=5').then(r => r.json()).catch(() => ({ records: [] })),
      fetch('/api/crm/opportunities?limit=5').then(r => r.json()).catch(() => ({ records: [] })),
      fetch('/api/aria/searches?limit=1').then(r => r.json()).catch(() => ({ searches: [] })),
    ]).then(([leadsData, oppsData, ariaData]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const leads = leadsData.records ?? leadsData.leads ?? []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const opps  = oppsData.records ?? oppsData.opportunities ?? []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const count = [...leads, ...opps].filter((item: any) => ACTIONABLE.has(item.stage ?? '')).length
      setActCount(count)
      if (leads[0]) setTopLead(leads[0])
      const searches = ariaData.searches ?? ariaData.records ?? []
      if (searches[0]) setLastARIA(searches[0])
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
          scope:       'opps_leads',
          contextData: { lead_id: topLead?.id },
        }),
      })
      const d = await res.json()
      setCmdResult(d.response ?? d.message ?? 'Done.')
    } catch { setCmdResult('Something went wrong. Please try again.') }
    finally { setCmdLoad(false) }
  }, [topLead])

  const scopeValue = { scope: 'opps_leads' as const, commandResult: cmdResult, isCommandLoading: cmdLoading }

  if (view === 'archivist') {
    return (
      <ModalScopeContext.Provider value={scopeValue}>
        <OppsLeadsExplorer onBack={() => setView('commander')} />
      </ModalScopeContext.Provider>
    )
  }

  return (
    <ModalScopeContext.Provider value={scopeValue}>
      <div className="space-y-3">

        {loading ? (
          <div className="flex items-center gap-2 py-4 justify-center">
            <div className="w-4 h-4 rounded-full border-2 border-emerald-500/30 border-t-emerald-400 animate-spin" />
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Pulling pipeline…</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2.5">
            {/* Action center */}
            <CommandCard
              hex="#6B7EFF" tag="Action Center"
              urgent={(actionCount ?? 0) > 0}
              headline={
                actionCount === null ? 'Loading pipeline…' :
                actionCount > 0 ? `${actionCount} lead${actionCount !== 1 ? 's' : ''} need${actionCount === 1 ? 's' : ''} your attention right now.` :
                'Pipeline is clear — no urgent actions.'
              }
              sub={actionCount != null && actionCount > 0 ? 'Needs immediate follow-up' : 'All leads up to date'}
              actionLabel="Review Actions"
              onAction={() => setView('archivist')}
            />

            {/* Top lead */}
            <CommandCard
              hex="#34d399" tag="Lead Intel"
              headline={topLead ? `${topLead.name ?? 'Lead'} at ${topLead.property_name ?? topLead.company_name ?? 'property'} is a high-value prospect.` : 'No new leads assigned.'}
              sub={topLead ? `Stage: ${(topLead.stage ?? 'new').replace('_', ' ')}` : undefined}
              actionLabel="Start Outreach"
              onAction={async () => {
                if (!topLead) return
                await fetch('/api/assistant/execute', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ toolName: 'log_crm_activity', toolArgs: { type: 'call', subject: `Outreach: ${topLead.name}`, lead_id: topLead.id }, reasoning: 'User initiated outreach from Nexus' }),
                })
              }}
              disabled={!topLead}
            />

            {/* ARIA */}
            <CommandCard
              hex="#a855f7" tag="ARIA Intel"
              headline={lastARIA ? `Property insights ready from last research session. Generate pitch brief?` : 'No recent ARIA searches. Run lead intelligence.'}
              sub={lastARIA?.query ? `Last search: "${lastARIA.query.slice(0, 32)}…"` : undefined}
              actionLabel={lastARIA ? 'Generate Brief' : 'Run ARIA'}
              onAction={async () => {
                await fetch('/api/assistant/chat', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ messages: [{ role: 'user', content: 'Generate a pitch brief for the last ARIA search' }], scope: 'opps_leads' }),
                })
                setCmdResult('Pitch brief generated from your last ARIA intelligence session.')
              }}
            />
          </div>
        )}

        {/* See All */}
        <button
          onClick={() => setView('archivist')}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all"
          style={{ background: 'rgba(52,211,153,0.05)', border: '0.5px solid rgba(52,211,153,0.15)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(52,211,153,0.1)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(52,211,153,0.05)' }}
        >
          <span className="text-[10px]" style={{ color: 'rgba(52,211,153,0.7)' }}>Open full pipeline — opportunities, leads, ARIA intel</span>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M2 6h8M6 2l4 4-4 4" stroke="rgba(52,211,153,0.7)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <ActionCommandBar onSubmit={handleCommand} isLoading={cmdLoading} />

        {cmdResult && (
          <div className="px-3 py-2 rounded-xl text-xs" style={{ background: 'rgba(52,211,153,0.07)', border: '0.5px solid rgba(52,211,153,0.2)', color: 'rgba(255,255,255,0.75)' }}>
            {cmdResult}
          </div>
        )}
      </div>
    </ModalScopeContext.Provider>
  )
}
