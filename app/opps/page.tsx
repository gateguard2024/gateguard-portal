'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter }   from 'next/navigation'
import { NexusBottomNav } from '@/components/nexus/NexusBottomNav'
import { OpportunityActionCard } from '@/components/nexus/OpportunityActionCard'
import type { ActionItem }       from '@/components/nexus/OpportunityActionCard'

// ─── Filter types ─────────────────────────────────────────────────────────────

type FilterId = 'needs-action' | 'all' | 'leads' | 'opps'

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'needs-action', label: 'Needs action' },
  { id: 'all',          label: 'All' },
  { id: 'leads',        label: 'Leads' },
  { id: 'opps',         label: 'Opportunities' },
]

// Stages that have a defined next action (= "needs action")
const ACTIONABLE_STAGES = new Set([
  'new', 'contacted', 'qualified',
  'prospect', 'aria_draft', 'survey_requested', 'proposal_sent', 'negotiation', 'won',
])

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OppsPage() {
  const router = useRouter()

  const [filter,    setFilter]    = useState<FilterId>('needs-action')
  const [items,     setItems]     = useState<ActionItem[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)

  // ── Fetch leads + opportunities ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const [leadsRes, oppsRes] = await Promise.all([
          fetch('/api/crm/leads'),
          fetch('/api/crm/opportunities'),
        ])

        if (!leadsRes.ok || !oppsRes.ok) throw new Error('Failed to load data')

        const [leadsData, oppsData] = await Promise.all([
          leadsRes.json(),
          oppsRes.json(),
        ])

        if (cancelled) return

        const leads: ActionItem[] = (leadsData.records ?? leadsData.leads ?? []).map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (l: any): ActionItem => ({
            id:              l.id,
            type:            'lead',
            name:            l.name ?? l.contact_name ?? 'Unnamed lead',
            propertyName:    l.property_name ?? null,
            propertyAddress: l.property_address ?? null,
            units:           l.units ?? null,
            contactName:     l.contact_name ?? null,
            stage:           l.stage ?? 'new',
            notes:           l.notes ?? null,
            ariaSummary:     l.aria_summary ?? null,
            updatedAt:       l.updated_at ?? null,
            createdAt:       l.created_at,
          })
        )

        const opps: ActionItem[] = (oppsData.records ?? oppsData.opportunities ?? []).map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (o: any): ActionItem => ({
            id:              o.id,
            type:            'opportunity',
            name:            o.name ?? 'Unnamed opportunity',
            propertyName:    o.property_name ?? o.name ?? null,
            propertyAddress: o.property_address ?? o.address ?? null,
            units:           o.units ?? null,
            contactName:     o.contact_name ?? null,
            stage:           o.stage ?? 'prospect',
            amount:          o.amount ?? o.mrr ?? null,
            notes:           o.notes ?? null,
            ariaSummary:     o.aria_summary ?? null,
            updatedAt:       o.updated_at ?? null,
            createdAt:       o.created_at,
          })
        )

        // Sort: ARIA drafts first, then by AI score (higher first), then by updatedAt
        const merged = [...leads, ...opps].sort((a, b) => {
          if (a.stage === 'aria_draft' && b.stage !== 'aria_draft') return -1
          if (b.stage === 'aria_draft' && a.stage !== 'aria_draft') return  1
          const aScore = aiSortScore(a.id, a.stage)
          const bScore = aiSortScore(b.id, b.stage)
          if (bScore !== aScore) return bScore - aScore
          return new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime()
        })

        setItems(merged)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  // ── Sort score (separate from display score) ─────────────────────────────
  function aiSortScore(id: string, stage: string): number {
    const h    = Array.from(id).reduce((a, c) => ((a * 31) + c.charCodeAt(0)) & 0xffff, 0)
    const base = (h % 30) + 50
    const bump: Record<string, number> = {
      aria_draft: 18, won: 25, negotiation: 20, qualified: 15,
      proposal_sent: 10, survey_requested: 12, contacted: 8, prospect: 5, new: 5,
    }
    return Math.min(99, base + (bump[stage] ?? 0))
  }

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleDismiss  = useCallback((id: string) => {
    setDismissed(prev => new Set([...prev, id]))
  }, [])

  const handleExecuted = useCallback((id: string) => {
    // After a short delay, remove from list so it doesn't clog the action view
    setTimeout(() => setDismissed(prev => new Set([...prev, id])), 1500)
  }, [])

  // ── Filter logic ──────────────────────────────────────────────────────────
  const visible = items.filter(item => {
    if (dismissed.has(item.id)) return false
    switch (filter) {
      case 'needs-action': return ACTIONABLE_STAGES.has(item.stage)
      case 'leads':        return item.type === 'lead'
      case 'opps':         return item.type === 'opportunity'
      default:             return true
    }
  })

  const needsActionCount = items.filter(i =>
    !dismissed.has(i.id) && ACTIONABLE_STAGES.has(i.stage)
  ).length

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen flex flex-col relative overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse at 50% 30%, #0d2150 0%, #060e28 40%, #020810 70%, #000306 100%)',
      }}
    >
      {/* Grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          backgroundImage:
            'linear-gradient(rgba(107,126,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(107,126,255,0.03) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Header */}
      <header
        className="relative z-10 flex items-center justify-between px-5 py-4"
        style={{ borderBottom: '0.5px solid rgba(107,126,255,0.1)' }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            aria-label="Back to Nexus home"
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
            style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', border: '0.5px solid rgba(255,255,255,0.08)' }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div>
            <div
              className="text-xs uppercase tracking-widest mb-0.5"
              style={{ color: 'rgba(255,255,255,0.2)', letterSpacing: '0.14em' }}
            >
              Sales action center
            </div>
            <h1 className="text-lg font-medium" style={{ color: 'rgba(255,255,255,0.9)' }}>
              New opps &amp; leads
            </h1>
          </div>
        </div>

        <button
          onClick={() => router.push('/aria')}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition-opacity hover:opacity-80"
          style={{
            background: 'rgba(107,126,255,0.15)',
            border:     '1px solid rgba(107,126,255,0.3)',
            color:      '#93a3ff',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
            <path d="M6.5 1L7.5 5.5H12L8.5 8.2L10 13L6.5 10L3 13L4.5 8.2L1 5.5H5.5L6.5 1Z"
              fill="#6B7EFF"/>
          </svg>
          Find with ARIA
        </button>
      </header>

      {/* Filter tabs */}
      <div
        className="relative z-10 flex gap-2 px-5 pt-4 pb-2 overflow-x-auto scrollbar-none"
      >
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm whitespace-nowrap transition-all duration-150"
            style={
              filter === f.id
                ? { background: 'rgba(107,126,255,0.2)', border: '1px solid rgba(107,126,255,0.4)', color: '#93a3ff' }
                : { background: 'transparent', border: '0.5px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.28)' }
            }
          >
            {f.label}
            {f.id === 'needs-action' && needsActionCount > 0 && (
              <span
                className="rounded-full font-medium leading-none"
                style={{ background: '#6B7EFF', color: '#fff', padding: '2px 6px', fontSize: '10px' }}
              >
                {needsActionCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Main content */}
      <main className="relative z-10 flex-1 px-5 pt-2 pb-32 overflow-y-auto">

        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-6 h-6 rounded-full border-2 border-blue-600/30 border-t-blue-500 animate-spin" />
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.25)' }}>Loading your pipeline…</p>
          </div>
        )}

        {error && (
          <div
            className="rounded-xl p-4 my-4 text-sm text-center"
            style={{ background: 'rgba(239,68,68,0.08)', border: '0.5px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}
          >
            {error}
          </div>
        )}

        {!loading && !error && visible.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(107,126,255,0.1)', border: '1px solid rgba(107,126,255,0.2)' }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 2L14 9H21L15.5 13.5L17.5 21L12 17L6.5 21L8.5 13.5L3 9H10L12 2Z"
                  fill="rgba(107,126,255,0.6)"/>
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
                {filter === 'needs-action' ? 'All caught up' : 'Nothing here yet'}
              </p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
                {filter === 'needs-action'
                  ? 'No actions pending — use ARIA to surface new leads'
                  : 'Run ARIA to find and add new properties'}
              </p>
            </div>
            <button
              onClick={() => router.push('/aria')}
              className="rounded-full px-5 py-2 text-sm transition-opacity hover:opacity-80"
              style={{ background: 'rgba(107,126,255,0.18)', border: '1px solid rgba(107,126,255,0.35)', color: '#93a3ff' }}
            >
              Find with ARIA
            </button>
          </div>
        )}

        {!loading && !error && visible.length > 0 && visible.map(item => (
          <OpportunityActionCard
            key={item.id}
            item={item}
            onDismiss={handleDismiss}
            onExecuted={handleExecuted}
          />
        ))}

      </main>

      {/* Nexus bottom nav — Opps tab active */}
      <NexusBottomNav activeTab="opps" badge={needsActionCount} />
    </div>
  )
}
