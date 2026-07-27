'use client'

import { useState, useEffect, useCallback } from 'react'
import { ModalScopeContext }  from '@/components/nexus/context/ModalScopeContext'
import { ActionCommandBar }   from '@/components/nexus/ActionCommandBar'
import { PeopleExplorer }     from './explorers/PeopleExplorer'

// ─── Types ────────────────────────────────────────────────────────────────────

type View = 'commander' | 'archivist'

interface AccountSummary { id: string; name?: string; status?: string; created_at?: string }
interface DealerSummary  { id: string; name?: string; tier?: string; onboarding_complete?: boolean; updated_at?: string }
interface LeadSummary    { id: string; name?: string; company_name?: string; stage?: string }

function hexRgb(h: string) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h)
  return r ? `${parseInt(r[1], 16)},${parseInt(r[2], 16)},${parseInt(r[3], 16)}` : '107,126,255'
}

function daysSince(iso?: string): number {
  if (!iso) return 0
  return Math.round((Date.now() - new Date(iso).getTime()) / 86400000)
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

// ─── Quick-add contact ────────────────────────────────────────────────────────

function QuickAddCard({ onAdded }: { onAdded: (name: string) => void }) {
  const [name,  setName]  = useState('')
  const [phone, setPhone] = useState('')
  const [busy,  setBusy]  = useState(false)
  const [done,  setDone]  = useState(false)

  async function handleAdd() {
    if (!name.trim()) return
    setBusy(true)
    try {
      await fetch('/api/assistant/execute', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolName: 'create_lead', toolArgs: { name: name.trim(), phone: phone.trim() || undefined }, reasoning: 'Quick-add contact from Nexus People tab' }),
      })
      setDone(true)
      onAdded(name.trim())
    } finally { setBusy(false) }
  }

  if (done) {
    return (
      <div className="rounded-2xl p-3.5 flex items-center gap-2"
        style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.18)' }}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 6l3 3 5-5" stroke="#34d399" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span className="text-xs" style={{ color: '#34d399' }}>Contact added</span>
      </div>
    )
  }

  return (
    <div className="rounded-2xl p-3.5 flex flex-col gap-2"
      style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.18)', backdropFilter: 'blur(16px)' }}>
      <span className="text-[9px] uppercase tracking-widest font-mono" style={{ color: 'rgba(251,191,36,0.65)' }}>Quick Add</span>
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Contact name…"
        className="text-xs bg-transparent outline-none px-2 py-1 rounded-lg"
        style={{ border: '0.5px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.8)', caretColor: '#fbbf24' }}
      />
      <input
        value={phone}
        onChange={e => setPhone(e.target.value)}
        placeholder="Phone (optional)…"
        className="text-xs bg-transparent outline-none px-2 py-1 rounded-lg"
        style={{ border: '0.5px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', caretColor: '#fbbf24' }}
      />
      <button onClick={handleAdd} disabled={!name.trim() || busy}
        className="text-[10px] px-2 py-1.5 rounded-lg font-medium transition-all"
        style={{ background: 'rgba(251,191,36,0.12)', border: '0.5px solid rgba(251,191,36,0.28)', color: '#fbbf24', opacity: !name.trim() ? 0.4 : 1 }}>
        {busy ? 'Adding…' : 'Add Contact'}
      </button>
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export function PeopleModal() {
  const [view,       setView]      = useState<View>('commander')
  const [account,    setAccount]   = useState<AccountSummary | null>(null)
  const [dealer,     setDealer]    = useState<DealerSummary | null>(null)
  const [newAdded,   setNewAdded]  = useState<string | null>(null)
  const [loading,    setLoading]   = useState(true)
  const [cmdResult,  setCmdResult] = useState<string | null>(null)
  const [cmdLoading, setCmdLoad]   = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/accounts?limit=5').then(r => r.json()).catch(() => ({})),
      fetch('/api/admin/dealers?limit=5').then(r => r.json()).catch(() => ({})),
    ]).then(([a, d]) => {
      const accts   = a.accounts ?? a.records ?? a.organizations ?? []
      const dealers = d.dealers ?? d.records ?? d.organizations ?? []
      // Find the most recently touched account/dealer
      if (accts[0])   setAccount(accts[0])
      // Find a dealer that's inactive or incomplete
      const inactive = dealers.find((dl: DealerSummary) => !dl.onboarding_complete || daysSince(dl.updated_at) > 60)
      if (inactive)   setDealer(inactive)
      else if (dealers[0]) setDealer(dealers[0])
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
          scope:       'people',
          contextData: { account_id: account?.id, dealer_id: dealer?.id },
        }),
      })
      const d = await res.json()
      setCmdResult(d.response ?? d.message ?? 'Done.')
    } catch { setCmdResult('Something went wrong. Please try again.') }
    finally { setCmdLoad(false) }
  }, [account, dealer])

  const accountDays  = daysSince(account?.created_at)
  const dealerDays   = daysSince(dealer?.updated_at)
  const scopeValue   = { scope: 'people' as const, commandResult: cmdResult, isCommandLoading: cmdLoading }

  if (view === 'archivist') {
    return (
      <ModalScopeContext.Provider value={scopeValue}>
        <PeopleExplorer onBack={() => setView('commander')} />
      </ModalScopeContext.Provider>
    )
  }

  return (
    <ModalScopeContext.Provider value={scopeValue}>
      <div className="space-y-3">

        {loading ? (
          <div className="flex items-center gap-2 py-4 justify-center">
            <div className="w-4 h-4 rounded-full border-2 border-indigo-500/30 border-t-indigo-400 animate-spin" />
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Loading relationships…</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2.5">
            {/* Account */}
            <CommandCard
              hex="#6B7EFF" tag="Account"
              urgent={accountDays > 30}
              headline={account ? `${account.name ?? 'Account'} ${accountDays > 30 ? `has been inactive for ${accountDays} days.` : 'is your most recent account.'}` : 'No accounts yet. Add your first one.'}
              sub={account ? `${accountDays > 30 ? 'Overdue for check-in' : 'Recently active'}` : undefined}
              actionLabel={accountDays > 30 ? 'Schedule Check-In' : 'Log Activity'}
              onAction={async () => {
                if (!account) return
                await fetch('/api/assistant/execute', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ toolName: 'schedule_followup', toolArgs: { subject: `Check-in: ${account.name}` }, reasoning: 'User scheduling account check-in from Nexus People' }),
                })
              }}
              disabled={!account}
            />

            {/* Dealer */}
            <CommandCard
              hex="#34d399" tag="Network"
              urgent={!dealer?.onboarding_complete || dealerDays > 60}
              headline={dealer ? (
                !dealer.onboarding_complete ? `${dealer.name ?? 'Dealer'} hasn't completed onboarding. Follow up?` :
                dealerDays > 60 ? `${dealer.name ?? 'Dealer'} has been inactive for ${dealerDays} days.` :
                `${dealer.name ?? 'Dealer'} is your top active dealer.`
              ) : 'No dealers in your network yet.'}
              sub={dealer ? `Tier: ${(dealer.tier ?? 'dealer').replace('_', ' ')}` : undefined}
              actionLabel={!dealer?.onboarding_complete ? 'Resume Onboarding' : 'Re-Engage'}
              onAction={async () => {
                if (!dealer) return
                await fetch('/api/assistant/execute', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ toolName: 'log_crm_activity', toolArgs: { type: 'call', subject: `Re-engagement: ${dealer.name}` }, reasoning: 'User re-engaging inactive dealer from Nexus People' }),
                })
              }}
              disabled={!dealer}
            />

            {/* Quick add contact */}
            {newAdded ? (
              <div className="rounded-2xl p-3.5 flex items-center gap-2"
                style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.2)' }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="#34d399" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="text-xs" style={{ color: '#34d399' }}>{newAdded} added</span>
              </div>
            ) : (
              <QuickAddCard onAdded={name => setNewAdded(name)} />
            )}
          </div>
        )}

        {/* See All */}
        <button
          onClick={() => setView('archivist')}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all"
          style={{ background: 'rgba(107,126,255,0.05)', border: '0.5px solid rgba(107,126,255,0.15)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(107,126,255,0.1)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(107,126,255,0.05)' }}
        >
          <span className="text-[10px]" style={{ color: 'rgba(107,126,255,0.7)' }}>Open full people directory — accounts, network, contacts</span>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M2 6h8M6 2l4 4-4 4" stroke="rgba(107,126,255,0.7)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <ActionCommandBar onSubmit={handleCommand} isLoading={cmdLoading} />

        {cmdResult && (
          <div className="px-3 py-2 rounded-xl text-xs" style={{ background: 'rgba(107,126,255,0.08)', border: '0.5px solid rgba(107,126,255,0.2)', color: 'rgba(255,255,255,0.75)' }}>
            {cmdResult}
          </div>
        )}
      </div>
    </ModalScopeContext.Provider>
  )
}
