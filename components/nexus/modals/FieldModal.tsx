'use client'

import { useState, useEffect, useCallback } from 'react'
import { ModalScopeContext }  from '@/components/nexus/context/ModalScopeContext'
import { ActionCommandBar }   from '@/components/nexus/ActionCommandBar'
import { FieldExplorer }      from './explorers/FieldExplorer'

// ─── Types ────────────────────────────────────────────────────────────────────

type View = 'commander' | 'archivist'

interface WOSummary   { id: string; wo_number?: string; title?: string; status?: string; priority?: string; customer_name?: string; assigned_tech?: string }
interface TechSummary { id: string; name?: string; status?: string; current_job?: string }

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

export function FieldModal() {
  const [view,       setView]      = useState<View>('commander')
  const [activeWO,   setActiveWO]  = useState<WOSummary | null>(null)
  const [onsite,     setOnsite]    = useState<TechSummary | null>(null)
  const [openWO,     setOpenWO]    = useState<WOSummary | null>(null)
  const [loading,    setLoading]   = useState(true)
  const [cmdResult,  setCmdResult] = useState<string | null>(null)
  const [cmdLoading, setCmdLoad]   = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/dispatch/work-orders/today').then(r => r.json()).catch(() => ({})),
      fetch('/api/dispatch/technicians').then(r => r.json()).catch(() => ({})),
    ]).then(([wo, tech]) => {
      const orders = wo.work_orders ?? wo.orders ?? wo.records ?? []
      const techs  = tech.technicians ?? tech.records ?? []
      const inProg = orders.find((w: WOSummary) => w.status === 'in_progress')
      const open   = orders.find((w: WOSummary) => w.status === 'open')
      const onsiteTech = techs.find((t: TechSummary) => t.status === 'busy')
      if (inProg) setActiveWO(inProg)
      if (open)   setOpenWO(open)
      if (onsiteTech) setOnsite(onsiteTech)
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
          scope:       'field',
          contextData: { wo_id: activeWO?.id, tech_id: onsite?.id },
        }),
      })
      const d = await res.json()
      setCmdResult(d.response ?? d.message ?? 'Done.')
    } catch { setCmdResult('Something went wrong. Please try again.') }
    finally { setCmdLoad(false) }
  }, [activeWO, onsite])

  const scopeValue = { scope: 'field' as const, commandResult: cmdResult, isCommandLoading: cmdLoading }

  if (view === 'archivist') {
    return (
      <ModalScopeContext.Provider value={scopeValue}>
        <FieldExplorer onBack={() => setView('commander')} />
      </ModalScopeContext.Provider>
    )
  }

  return (
    <ModalScopeContext.Provider value={scopeValue}>
      <div className="space-y-3">

        {loading ? (
          <div className="flex items-center gap-2 py-4 justify-center">
            <div className="w-4 h-4 rounded-full border-2 border-teal-500/30 border-t-teal-400 animate-spin" />
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Checking field ops…</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2.5">
            {/* Tech onsite */}
            <CommandCard
              hex="#0B7285" tag="Tech Onsite"
              urgent={!!onsite}
              headline={onsite ? `${onsite.name ?? 'Technician'} is onsite${onsite.current_job ? ` on ${onsite.current_job}` : ''}. Request progress update?` : 'No technicians currently onsite.'}
              sub={onsite ? 'Tap to request status report' : undefined}
              actionLabel="Request Update"
              onAction={async () => {
                if (!onsite) return
                await fetch('/api/assistant/execute', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ toolName: 'create_todo', toolArgs: { title: `Status update from ${onsite.name}`, priority: 'high' }, reasoning: 'User requesting onsite tech update via Nexus Field' }),
                })
              }}
              disabled={!onsite}
            />

            {/* Active WO */}
            <CommandCard
              hex="#fbbf24" tag="Active Job"
              urgent={activeWO?.priority === 'critical'}
              headline={activeWO ? `${activeWO.wo_number ?? 'Job'} at ${activeWO.customer_name ?? 'site'} is in progress.` : 'No active field jobs right now.'}
              sub={activeWO ? `Tech: ${activeWO.assigned_tech ?? 'unassigned'} · Priority: ${activeWO.priority ?? 'normal'}` : undefined}
              actionLabel="Mark Complete"
              onAction={async () => {
                if (!activeWO) return
                await fetch('/api/assistant/execute', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ toolName: 'update_work_order_status', toolArgs: { work_order_id: activeWO.id, status: 'completed' }, reasoning: 'User completing WO from Nexus Field tab' }),
                })
              }}
              disabled={!activeWO}
            />

            {/* Site intel */}
            <CommandCard
              hex="#a855f7" tag="Site Intel"
              headline={openWO ? `${openWO.wo_number ?? 'Open job'} at ${openWO.customer_name ?? 'site'} is unassigned. Dispatch now?` : 'All open jobs are dispatched.'}
              sub={openWO ? 'Needs technician assignment' : undefined}
              actionLabel="Dispatch Tech"
              onAction={async () => {
                if (!openWO) return
                await fetch('/api/assistant/execute', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ toolName: 'assign_technician', toolArgs: { work_order_id: openWO.id }, reasoning: 'User dispatching from Nexus Field tab' }),
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
          style={{ background: 'rgba(11,114,133,0.05)', border: '0.5px solid rgba(11,114,133,0.2)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(11,114,133,0.1)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(11,114,133,0.05)' }}
        >
          <span className="text-[10px]" style={{ color: 'rgba(11,114,133,0.8)' }}>Open field ops center — work orders, tech roster, diagnostics</span>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M2 6h8M6 2l4 4-4 4" stroke="rgba(11,114,133,0.8)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <ActionCommandBar onSubmit={handleCommand} isLoading={cmdLoading} />

        {cmdResult && (
          <div className="px-3 py-2 rounded-xl text-xs" style={{ background: 'rgba(11,114,133,0.07)', border: '0.5px solid rgba(11,114,133,0.2)', color: 'rgba(255,255,255,0.75)' }}>
            {cmdResult}
          </div>
        )}
      </div>
    </ModalScopeContext.Provider>
  )
}
