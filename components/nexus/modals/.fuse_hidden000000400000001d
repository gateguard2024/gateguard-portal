'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ModalScopeContext }     from '@/components/nexus/context/ModalScopeContext'
import { ActionCommandBar }      from '@/components/nexus/ActionCommandBar'
import { RecentWorkExplorer }    from './explorers/RecentWorkExplorer'

// ─── Types ────────────────────────────────────────────────────────────────────

type View = 'commander' | 'archivist'

interface QuoteSummary { id: string; title?: string; customer_name?: string; status?: string; total?: number; updated_at?: string }
interface WOSummary    { id: string; wo_number?: string; title?: string; status?: string; priority?: string; customer_name?: string }
interface ActSummary   { id: string; type?: string; subject?: string; contact_name?: string; created_at?: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexRgb(h: string) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h)
  return r ? `${parseInt(r[1], 16)},${parseInt(r[2], 16)},${parseInt(r[3], 16)}` : '107,126,255'
}

function timeAgo(iso?: string): string {
  if (!iso) return ''
  const d = (Date.now() - new Date(iso).getTime()) / 1000
  if (d < 3600)  return `${Math.round(d / 60)}m ago`
  if (d < 86400) return `${Math.round(d / 3600)}h ago`
  return `${Math.round(d / 86400)}d ago`
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
        boxShadow:     urgent ? `0 0 20px rgba(${rgb},0.12)` : 'none',
      }}
    >
      {/* Tag row */}
      <div className="flex items-center gap-1.5">
        {urgent && (
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse"
            style={{ background: hex, boxShadow: `0 0 6px ${hex}` }} />
        )}
        <span className="text-[9px] uppercase tracking-widest font-mono" style={{ color: `rgba(${rgb},0.65)` }}>{tag}</span>
      </div>

      {/* Content */}
      <p className="text-xs font-medium leading-snug" style={{ color: 'rgba(255,255,255,0.88)' }}>{headline}</p>
      {sub && <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{sub}</p>}

      {/* Action */}
      {phase === 'done' ? (
        <div className="flex items-center gap-1.5">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1.5 5l2.5 2.5 5-5" stroke="#34d399" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-[9px]" style={{ color: '#34d399' }}>Done</span>
        </div>
      ) : (
        <button onClick={handleClick}
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

export function RecentWorkModal() {
  const [view,       setView]      = useState<View>('commander')
  const [quote,      setQuote]     = useState<QuoteSummary | null>(null)
  const [wo,         setWO]        = useState<WOSummary | null>(null)
  const [act,        setAct]       = useState<ActSummary | null>(null)
  const [loading,    setLoading]   = useState(true)
  const [cmdResult,  setCmdResult] = useState<string | null>(null)
  const [cmdLoading, setCmdLoad]   = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/quotes?limit=1').then(r => r.json()).catch(() => ({})),
      fetch('/api/dispatch/work-orders/today').then(r => r.json()).catch(() => ({})),
      fetch('/api/crm/activities?limit=1').then(r => r.json()).catch(() => ({})),
    ]).then(([q, wo, a]) => {
      const quotes = q.quotes ?? q.records ?? []
      const orders = wo.work_orders ?? wo.orders ?? wo.records ?? []
      const acts   = a.activities ?? a.records ?? []
      if (quotes[0]) setQuote(quotes[0])
      if (orders[0]) setWO(orders[0])
      if (acts[0])   setAct(acts[0])
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
          scope:       'recent_work',
          contextData: { quote_id: quote?.id, wo_id: wo?.id },
        }),
      })
      const d = await res.json()
      setCmdResult(d.response ?? d.message ?? 'Done.')
    } catch { setCmdResult('Something went wrong. Please try again.') }
    finally { setCmdLoad(false) }
  }, [quote, wo])

  const scopeValue = { scope: 'recent_work' as const, commandResult: cmdResult, isCommandLoading: cmdLoading }

  if (view === 'archivist') {
    return (
      <ModalScopeContext.Provider value={scopeValue}>
        <RecentWorkExplorer onBack={() => setView('commander')} />
      </ModalScopeContext.Provider>
    )
  }

  return (
    <ModalScopeContext.Provider value={scopeValue}>
      <div className="space-y-3">

        {loading ? (
          <div className="flex items-center gap-2 py-4 justify-center">
            <div className="w-4 h-4 rounded-full border-2 border-indigo-500/30 border-t-indigo-400 animate-spin" />
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Pulling recent activity…</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2.5">
            {/* Quote card */}
            <CommandCard
              hex="#6B7EFF" tag="Quote"
              headline={quote ? `${quote.title ?? 'Quote'} for ${quote.customer_name ?? 'client'} is ${quote.status ?? 'pending'}.` : 'No recent quotes.'}
              sub={quote ? `${quote.total ? `$${Number(quote.total).toLocaleString()} · ` : ''}${timeAgo(quote.updated_at)}` : undefined}
              actionLabel="Finalize & Send"
              onAction={async () => {
                if (!quote) return
                await fetch('/api/assistant/execute', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ toolName: 'create_quote', toolArgs: { quote_id: quote.id, action: 'finalize' }, reasoning: 'User requested finalize from Nexus' }),
                })
              }}
              disabled={!quote}
            />

            {/* WO card */}
            <CommandCard
              hex="#34d399" tag="Work Order"
              urgent={wo?.priority === 'critical' || wo?.priority === 'high'}
              headline={wo ? `${wo.wo_number ?? 'WO'}: ${wo.title ?? 'Work order'} at ${wo.customer_name ?? 'site'}.` : 'No open work orders.'}
              sub={wo ? `Status: ${wo.status ?? '—'} · Priority: ${wo.priority ?? 'normal'}` : undefined}
              actionLabel="Update Status"
              onAction={async () => {
                if (!wo) return
                await fetch('/api/assistant/execute', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ toolName: 'update_work_order_status', toolArgs: { work_order_id: wo.id, status: 'completed' }, reasoning: 'User marked WO complete from Nexus' }),
                })
              }}
              disabled={!wo}
            />

            {/* Activity card */}
            <CommandCard
              hex="#a855f7" tag="CRM Activity"
              urgent={act?.type === 'call'}
              headline={act ? `${act.type === 'call' ? 'Call' : act.type === 'email' ? 'Email' : 'Activity'} from ${act.contact_name ?? 'contact'}: ${act.subject ?? 'follow up required'}.` : 'No recent CRM activity.'}
              sub={act ? timeAgo(act.created_at) : undefined}
              actionLabel="Log Follow-Up"
              onAction={async () => {
                if (!act) return
                await fetch('/api/assistant/execute', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ toolName: 'log_crm_activity', toolArgs: { type: 'call', subject: `Follow-up on: ${act.subject}` }, reasoning: 'User logged follow-up from Nexus' }),
                })
              }}
              disabled={!act}
            />
          </div>
        )}

        {/* See All → Archivist */}
        <button
          onClick={() => setView('archivist')}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all"
          style={{ background: 'rgba(107,126,255,0.05)', border: '0.5px solid rgba(107,126,255,0.15)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(107,126,255,0.1)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(107,126,255,0.05)' }}
        >
          <span className="text-[10px]" style={{ color: 'rgba(107,126,255,0.7)' }}>Open full archive — quotes, orders, activity</span>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M2 6h8M6 2l4 4-4 4" stroke="rgba(107,126,255,0.7)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* Command bar */}
        <ActionCommandBar onSubmit={handleCommand} isLoading={cmdLoading} />

        {/* Command result */}
        {cmdResult && (
          <div className="px-3 py-2 rounded-xl text-xs" style={{ background: 'rgba(107,126,255,0.08)', border: '0.5px solid rgba(107,126,255,0.2)', color: 'rgba(255,255,255,0.75)' }}>
            {cmdResult}
          </div>
        )}
      </div>
    </ModalScopeContext.Provider>
  )
}
