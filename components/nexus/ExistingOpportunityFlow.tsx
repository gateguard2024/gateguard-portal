'use client'

// Existing Opportunity — pick from the deals the user owns or can see, then
// open the glass opportunity window to work it. Mirrors the New Opportunity flow.
import { useEffect, useState } from 'react'
import { OpportunityGlassWindow } from '@/components/nexus/windows/OpportunityGlassWindow'

type Opp = { id: string; name?: string; account_name?: string; stage?: string; value?: number; est_mrr?: number; amount?: number; owner_name?: string }

const inputStyle = { background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.92)' } as const

export function ExistingOpportunityFlow({ onClose, onOpen }: { onClose: () => void; onOpen?: (id: string) => void }) {
  const [opps, setOpps] = useState<Opp[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [windowData, setWindowData] = useState<Record<string, unknown> | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/crm/opportunities')
        const data = await res.json().catch(() => ({}))
        if (!cancelled) setOpps(data.records ?? data.opportunities ?? [])
      } catch { if (!cancelled) setError('Could not load opportunities.') }
      finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [])

  async function pick(id: string) {
    // Seamless hand-off: open the deal's life cycle instead of the read-only window.
    if (onOpen) { onOpen(id); return }
    setBusyId(id); setError(null)
    try {
      const res = await fetch(`/api/nexus/opps/opportunity-window/${id}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.success === false) throw new Error(data?.message ?? 'Could not open opportunity.')
      setWindowData(data)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not open opportunity.') }
    finally { setBusyId(null) }
  }

  const filtered = query.trim()
    ? opps.filter(o => `${o.name ?? ''} ${o.account_name ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()))
    : opps

  return (
    <div className="fixed inset-0 z-[96] overflow-hidden bg-black/70 px-4 py-6 backdrop-blur-sm">
      <div className="mx-auto flex h-[calc(100dvh-3rem)] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] p-5 shadow-2xl"
        style={{ background: 'radial-gradient(circle at 16% 0%, rgba(0,124,255,0.16), transparent 34%), linear-gradient(180deg, rgba(8,18,34,0.97), rgba(3,9,22,0.97))', border: '1px solid rgba(0,200,255,0.22)', backdropFilter: 'blur(28px)' }}>
        {windowData ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <OpportunityGlassWindow data={windowData as Parameters<typeof OpportunityGlassWindow>[0]['data']} onBack={() => setWindowData(null)} />
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: 'rgba(0,200,255,0.82)' }}>Existing Opportunity</div>
                <h2 className="mt-1 text-xl font-semibold" style={{ color: 'rgba(255,255,255,0.97)' }}>Pick a deal to work</h2>
              </div>
              <button type="button" onClick={onClose} className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>✕</button>
            </div>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by deal name or account…" className="mb-3 w-full rounded-xl px-3 py-2 text-sm outline-none" style={inputStyle} />
            {error && <div className="mb-3 rounded-2xl p-3 text-xs" style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.35)', color: '#fca5a5' }}>{error}</div>}
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {loading && <div className="rounded-2xl p-4 text-xs" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }}>Loading your opportunities…</div>}
              {!loading && filtered.map(o => (
                <button key={o.id} type="button" disabled={busyId === o.id} onClick={() => pick(o.id)} className="w-full rounded-2xl px-3 py-3 text-left transition-all hover:-translate-y-0.5 disabled:opacity-50" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>{o.name || 'Opportunity'}</div>
                      <div className="mt-0.5 truncate text-[11px]" style={{ color: 'rgba(255,255,255,0.48)' }}>{[o.account_name, (o.stage ?? '').replace(/_/g, ' '), o.owner_name].filter(Boolean).join(' · ') || 'Deal'}</div>
                    </div>
                    <span className="shrink-0 text-[11px]" style={{ color: 'rgba(125,229,255,0.85)' }}>{busyId === o.id ? '…' : 'Open →'}</span>
                  </div>
                </button>
              ))}
              {!loading && filtered.length === 0 && <div className="rounded-2xl p-4 text-xs" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.45)' }}>{query ? 'No opportunities match your search.' : 'No opportunities you can see yet. Create one from New Opportunity.'}</div>}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
