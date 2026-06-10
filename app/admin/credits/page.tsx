'use client'

import { useState, useEffect, useCallback } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Search, Plus, Loader2, Building2 } from 'lucide-react'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { DollarSign, RefreshCw } = require('lucide-react') as any

const GRANT_TYPES = [
  { value: 'trial',         label: 'Trial',          description: '30-day welcome credits' },
  { value: 'demo',          label: 'Demo',           description: 'For a specific demo call' },
  { value: 'bonus',         label: 'Bonus',          description: 'No expiry' },
  { value: 'plan_included', label: 'Plan Included',  description: 'Bundled with their plan' },
  { value: 'adjustment',    label: 'Adjustment',     description: 'Manual correction' },
]

interface Org { id: string; name: string; org_tier: string }
interface CreditTx {
  id: string; transaction_type: string; amount: number; balance_after: number
  note: string | null; granted_by_name: string | null; expires_at: string | null; created_at: string
}

export default function AdminCreditsPage() {
  // Org search
  const [query, setQuery]           = useState('')
  const [orgs, setOrgs]             = useState<Org[]>([])
  const [searching, setSearching]   = useState(false)
  const [selected, setSelected]     = useState<Org | null>(null)

  // Balance + history
  const [balance, setBalance]       = useState<number | null>(null)
  const [txns, setTxns]             = useState<CreditTx[]>([])
  const [loadingInfo, setLoadingInfo] = useState(false)

  // Grant form
  const [amount, setAmount]         = useState('200')
  const [grantType, setGrantType]   = useState('bonus')
  const [note, setNote]             = useState('')
  const [useExpiry, setUseExpiry]   = useState(false)
  const [expiryDays, setExpiryDays] = useState('30')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult]         = useState<{ ok: boolean; msg: string } | null>(null)

  // Search orgs
  useEffect(() => {
    if (query.length < 2) { setOrgs([]); return }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/admin/dealers?search=${encodeURIComponent(query)}&limit=10`)
        if (res.ok) {
          const d = await res.json()
          setOrgs(d.orgs ?? d.dealers ?? [])
        }
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  const loadInfo = useCallback(async (orgId: string) => {
    setLoadingInfo(true)
    setBalance(null)
    setTxns([])
    try {
      const [balRes, txRes] = await Promise.all([
        fetch(`/api/aria/credits/balance?org_id=${orgId}`),
        fetch(`/api/aria/credits/transactions?org_id=${orgId}&limit=20`),
      ])
      if (balRes.ok) { const d = await balRes.json(); setBalance(d.balance ?? 0) }
      if (txRes.ok)  { const d = await txRes.json();  setTxns(d.transactions ?? []) }
    } finally {
      setLoadingInfo(false)
    }
  }, [])

  function selectOrg(org: Org) {
    setSelected(org)
    setQuery(org.name)
    setOrgs([])
    setResult(null)
    void loadInfo(org.id)
  }

  async function handleGrant() {
    if (!selected) return
    const amt = parseInt(amount, 10)
    if (!amt || amt <= 0) { setResult({ ok: false, msg: 'Enter a valid amount' }); return }
    setSubmitting(true)
    setResult(null)
    try {
      const expiresAt = useExpiry
        ? new Date(Date.now() + parseInt(expiryDays, 10) * 24 * 60 * 60 * 1000).toISOString()
        : null
      const res = await fetch('/api/billing/credits/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: selected.id,
          amount: amt,
          transaction_type: grantType,
          note: note.trim() || undefined,
          expires_at: expiresAt,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setResult({ ok: false, msg: data.error ?? 'Failed' })
      } else {
        setResult({ ok: true, msg: `✓ Granted ${amt} credits to ${selected.name} — new balance: ${data.balance_after}` })
        setNote('')
        void loadInfo(selected.id)
      }
    } catch {
      setResult({ ok: false, msg: 'Network error' })
    } finally {
      setSubmitting(false)
    }
  }

  const txTypeColor = (t: string) => ({
    purchase: 'text-emerald-600 bg-emerald-50', spend: 'text-red-600 bg-red-50',
    bonus: 'text-purple-600 bg-purple-50', trial: 'text-blue-600 bg-blue-50',
    demo: 'text-indigo-600 bg-indigo-50', plan_included: 'text-teal-600 bg-teal-50',
    refund: 'text-orange-600 bg-orange-50', adjustment: 'text-slate-600 bg-slate-100',
  }[t] ?? 'text-slate-600 bg-slate-100')

  const fmtTxType = (t: string) => ({
    purchase: 'Purchase', spend: 'Search', bonus: 'Bonus', trial: 'Trial',
    demo: 'Demo', plan_included: 'Plan', refund: 'Refund', adjustment: 'Adjustment',
  }[t] ?? t)

  return (
    <div className="flex flex-col min-h-full bg-[#F8FAFC]">
      <TopBar title="ARIA Credits" subtitle="Grant and manage search credits for any org" />

      <div className="flex-1 p-6 max-w-5xl mx-auto w-full space-y-6">

        {/* ── Org picker ─────────────────────────────────── */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <Building2 size={14} className="text-[#6B7EFF]" />
            Select Organization
          </h2>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); setSelected(null) }}
              placeholder="Search by org name…"
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30 bg-white"
            />
            {searching && <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />}
          </div>

          {/* Dropdown results */}
          {orgs.length > 0 && (
            <div className="mt-1 border border-slate-200 rounded-lg overflow-hidden shadow-sm">
              {orgs.map(o => (
                <button
                  key={o.id}
                  onClick={() => selectOrg(o)}
                  className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 flex items-center justify-between border-b border-slate-100 last:border-0"
                >
                  <span className="font-medium text-slate-800">{o.name}</span>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">{o.org_tier}</span>
                </button>
              ))}
            </div>
          )}

          {selected && (
            <div className="mt-3 flex items-center gap-2 text-sm">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="font-medium text-slate-800">{selected.name}</span>
              {loadingInfo ? (
                <span className="text-slate-400 flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> loading…</span>
              ) : (
                <span className="text-slate-500">
                  · <span className={`font-semibold ${(balance ?? 0) > 0 ? 'text-slate-800' : 'text-slate-400'}`}>{balance ?? 0}</span> credits available
                </span>
              )}
              <button onClick={() => { if (selected) void loadInfo(selected.id) }} className="ml-auto text-slate-400 hover:text-slate-600">
                <RefreshCw size={12} />
              </button>
            </div>
          )}
        </div>

        {selected && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* ── Grant form ─────────────────────────────── */}
            <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm space-y-4">
              <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Plus size={14} className="text-[#6B7EFF]" />
                Grant Credits
              </h2>

              {/* Amount */}
              <div>
                <label className="text-xs font-medium text-slate-500">Amount</label>
                <input
                  type="number" min="1" value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="mt-1 w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30"
                />
                <p className="text-xs text-slate-400 mt-1">{Math.floor(parseInt(amount || '0', 10) / 100)} ARIA searches</p>
              </div>

              {/* Type */}
              <div>
                <label className="text-xs font-medium text-slate-500">Type</label>
                <select
                  value={grantType} onChange={e => setGrantType(e.target.value)}
                  className="mt-1 w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30 bg-white"
                >
                  {GRANT_TYPES.map(g => (
                    <option key={g.value} value={g.value}>{g.label} — {g.description}</option>
                  ))}
                </select>
              </div>

              {/* Note */}
              <div>
                <label className="text-xs font-medium text-slate-500">Note <span className="font-normal">(optional)</span></label>
                <input
                  type="text" value={note} onChange={e => setNote(e.target.value)}
                  placeholder="e.g. Internal team credits, Q3 demo…"
                  className="mt-1 w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30"
                />
              </div>

              {/* Expiry */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-500">Expiry</label>
                  <button
                    onClick={() => setUseExpiry(v => !v)}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                      useExpiry ? 'bg-[#6B7EFF]/10 text-[#6B7EFF]' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {useExpiry ? 'Expires' : 'Never expires'}
                  </button>
                </div>
                {useExpiry && (
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="number" min="1" value={expiryDays}
                      onChange={e => setExpiryDays(e.target.value)}
                      className="w-20 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30"
                    />
                    <span className="text-sm text-slate-500">days from now</span>
                  </div>
                )}
              </div>

              {result && (
                <div className={`text-xs px-3 py-2.5 rounded-lg ${result.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                  {result.msg}
                </div>
              )}

              <button
                onClick={() => { void handleGrant() }}
                disabled={submitting || !selected}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#6B7EFF] text-white rounded-lg text-sm font-medium hover:bg-[#5a6eee] disabled:opacity-50 transition-colors"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <DollarSign size={14} />}
                Grant {amount || '0'} credits to {selected.name}
              </button>
            </div>

            {/* ── Transaction history ─────────────────────── */}
            <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-sm">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-800">Transaction History</h2>
                <button onClick={() => { if (selected) void loadInfo(selected.id) }} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <RefreshCw size={13} />
                </button>
              </div>
              {loadingInfo ? (
                <div className="flex items-center gap-2 text-sm text-slate-400 p-5">
                  <Loader2 size={14} className="animate-spin" /> Loading…
                </div>
              ) : txns.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-400">No transactions yet</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {txns.map(tx => (
                    <div key={tx.id} className="px-5 py-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${txTypeColor(tx.transaction_type)}`}>
                            {fmtTxType(tx.transaction_type)}
                          </span>
                          {tx.note && <span className="text-xs text-slate-500 truncate max-w-[160px]">{tx.note}</span>}
                        </div>
                        <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                          <span>{new Date(tx.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          {tx.granted_by_name && <span>· {tx.granted_by_name}</span>}
                          {tx.expires_at && <span>· exp {new Date(tx.expires_at).toLocaleDateString()}</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`text-sm font-bold ${tx.amount > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {tx.amount > 0 ? '+' : ''}{tx.amount}
                        </div>
                        <div className="text-[10px] text-slate-400">{tx.balance_after} after</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
