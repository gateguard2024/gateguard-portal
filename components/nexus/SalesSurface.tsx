'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { ActionFlowSurface } from '@/components/nexus/ActionFlowSurface'
import { LeadsHub } from '@/components/nexus/LeadsHub'
import { OpportunityHub } from '@/components/nexus/OpportunityHub'
import { NexusGlassBackButton } from '@/components/nexus/NexusGlassBackButton'
import { NexusGlyphTile, type NexusGlyphKind } from '@/components/nexus/NexusGlyphTile'
import { NewOpportunityFlow } from '@/components/nexus/NewOpportunityFlow'
import { ExistingOpportunityFlow } from '@/components/nexus/ExistingOpportunityFlow'
import { PricingCalculator } from '@/components/nexus/PricingCalculator'
import { OpportunityLifecycle } from '@/components/nexus/OpportunityLifecycle'
import { NEXUS_BG, NexusBackdropLayers } from '@/components/nexus/NexusBackdrop'

type PanelId = 'new-opp' | 'existing-opp' | 'new-lead-flow' | 'leads-workbench' | 'opps-workbench' | 'rough-calc'

// ---- Dashboard console tokens (identical to My Day home) ----
const FRAME_STYLE = { background: 'repeating-linear-gradient(90deg,rgba(255,255,255,0.05) 0 1px,transparent 1px 4px), linear-gradient(180deg,#5a6c84,#45556a)', border: '1px solid rgba(10,16,24,0.4)', boxShadow: '0 26px 54px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -2px 2px rgba(0,0,0,0.4)' } as const
const TILE_BG = 'repeating-linear-gradient(90deg,rgba(255,255,255,0.04) 0 1px,transparent 1px 4px), repeating-linear-gradient(90deg,rgba(255,255,255,0.04) 0 1px,transparent 1px 4px), linear-gradient(180deg,#2b3c52,#1e2a3a)'
const TILE_STYLE = { background: TILE_BG, border: '1px solid rgba(140,170,200,0.32)', boxShadow: '0 14px 30px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -2px 2px rgba(0,0,0,0.4)' } as const
const WELL = 'linear-gradient(180deg,#26374a,#1e2c3c)'

type Activity = { id: string; type: string; subject: string | null; due_at: string | null; completed_at: string | null; opportunity_id: string | null; opportunity_name: string | null }
type OppRow = { id: string; name?: string | null }
type OppData = {
  grouped?: Record<string, { label: string; records: OppRow[]; total: number }>
  pipelineTotal?: number | null
  counts?: { total: number; open: number; won: number }
}

function money(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1000) return `$${Math.round(n / 1000)}k`
  return `$${Math.round(n)}`
}
function timeLabel(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const day = new Date(d); day.setHours(0, 0, 0, 0)
  const t = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (day < today) return `Overdue · ${t}`
  if (day.getTime() === today.getTime()) return `Today · ${t}`
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${t}`
}

// A dashboard-style card tile (glyph + title + subtitle + "Open →"), matching MyDayCardButton.
function HubTile({ glyph, hex, title, subtitle, badge, onClick }: { glyph: NexusGlyphKind; hex: string; title: string; subtitle: string; badge?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="group relative flex flex-1 flex-col overflow-hidden rounded-2xl p-5 text-left transition-all duration-200 hover:-translate-y-0.5"
      style={TILE_STYLE}>
      {badge && (
        <div className="absolute right-4 top-4 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]" style={{ background: 'rgba(13,20,32,0.5)', border: '1px solid rgba(255,255,255,0.18)', color: '#DCE6F0' }}>{badge}</div>
      )}
      <NexusGlyphTile kind={glyph} color={hex} />
      <div className="text-[17px] font-semibold leading-tight" style={{ color: '#F1F6FB' }}>{title}</div>
      <div className="mt-1.5 text-[13px] leading-relaxed" style={{ color: 'rgba(201,213,227,0.96)' }}>{subtitle}</div>
      <div className="mt-auto flex items-center pt-4">
        <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold transition-all duration-200 group-hover:gap-2.5" style={{ color: '#8FD3EC' }}>Open <span aria-hidden className="text-[15px] leading-none">&rarr;</span></span>
      </div>
    </button>
  )
}

// Popup detail shell (leads/opps workbench, rough calc).
function SalesDetailShell({ title, subtitle, onClose, children, actions }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[90] overflow-hidden bg-black/68 px-4 py-4 backdrop-blur-sm sm:py-6">
      <div className="mx-auto grid h-[calc(100dvh-2rem)] w-full max-w-5xl xl:max-w-none grid-cols-1 gap-4 overflow-hidden rounded-[2rem] p-5 shadow-2xl sm:h-[calc(100dvh-3rem)] lg:grid-cols-[minmax(0,1fr)_260px]"
        style={{ background: NEXUS_BG, border: '1px solid rgba(150,180,210,0.22)', boxShadow: '0 30px 100px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)' }}>
        <div className="min-h-0 overflow-y-auto pr-1" style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
          <NexusGlassBackButton label="Back to Sales" onClick={onClose} />
          <div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: '#9FD8EC' }}>Sales</div>
          <h2 className="mt-1 text-2xl font-semibold" style={{ color: 'rgba(255,255,255,0.96)' }}>{title}</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.64)' }}>{subtitle}</p>
          <div className="mt-5">{children}</div>
        </div>
        <aside className="min-h-0 overflow-y-auto rounded-3xl p-4" style={{ background: 'repeating-linear-gradient(90deg,rgba(255,255,255,0.04) 0 1px,transparent 1px 4px), linear-gradient(180deg,#2b3c52,#1e2a3a)', border: '1px solid rgba(140,170,200,0.28)', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
          <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.94)' }}>Actions</div>
          <div className="mt-4 space-y-2">{actions}</div>
        </aside>
      </div>
    </div>
  )
}

function ActionButton({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className="w-full rounded-2xl px-3 py-3 text-left text-xs font-semibold transition-all hover:-translate-y-0.5 active:translate-y-0"
      style={{ background: 'rgba(95,184,224,0.12)', border: '1px solid rgba(95,184,224,0.3)', color: '#9FD8EC' }}>
      {label}
    </button>
  )
}

export function SalesSurface() {
  const router = useRouter()
  const { user } = useUser()
  const firstName = user?.firstName ?? 'there'

  const [activePanel, setActivePanel] = useState<PanelId | null>(null)
  const [lifecycleOppId, setLifecycleOppId] = useState<string | null>(null)
  const [pendingStage, setPendingStage] = useState<number | null>(null)
  const [leadsHub, setLeadsHub] = useState(false)
  const [oppsHub, setOppsHub] = useState(false)

  const [followups, setFollowups] = useState<Activity[]>([])
  const [opp, setOpp] = useState<OppData>({})
  const [leadCount, setLeadCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  function openLifecycle(id: string) { setActivePanel(null); setLifecycleOppId(id) }
  function closeLifecycle() { setLifecycleOppId(null); setPendingStage(null) }

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    try {
      const [aRes, oRes, lRes] = await Promise.all([
        fetch('/api/crm/activities').then(r => r.json()).catch(() => []),
        fetch('/api/crm/opportunities').then(r => r.json()).catch(() => ({})),
        fetch('/api/crm/leads').then(r => r.json()).catch(() => []),
      ])
      const acts: Activity[] = Array.isArray(aRes) ? aRes : (aRes?.records ?? [])
      const end = new Date(); end.setHours(23, 59, 59, 999)
      setFollowups(acts.filter(a => !a.completed_at && a.due_at && new Date(a.due_at) <= end).sort((x, y) => new Date(x.due_at!).getTime() - new Date(y.due_at!).getTime()))
      setOpp((oRes && typeof oRes === 'object') ? oRes as OppData : {})
      setLeadCount(Array.isArray(lRes) ? lRes.length : (lRes?.records?.length ?? null))
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void loadDashboard() }, [loadDashboard])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const hub = params.get('hub'); if (hub === 'leads' || hub === 'opps') { if (hub === 'leads') setLeadsHub(true); else setOppsHub(true); params.delete('hub'); const qs = params.toString(); window.history.replaceState({}, '', qs ? `/?${qs}` : '/') }
  }, [])

  const grouped = opp.grouped ?? {}
  const stageRecords = (k: string): OppRow[] => grouped[k]?.records ?? []
  const stageN = (k: string) => stageRecords(k).length
  const counts = opp.counts ?? { total: 0, open: 0, won: 0 }
  const lostN = stageN('lost')
  // Count won from the API count OR the grouped records — whichever is populated
  // (they can diverge if the stage value normalizes differently in one path).
  const wonN = counts.won || stageN('won')
  const winRate = (wonN + lostN) > 0 ? Math.round((wonN / (wonN + lostN)) * 100) : 0
  const avgDeal = (counts.open > 0 && opp.pipelineTotal != null) ? Math.round(opp.pipelineTotal / counts.open) : null

  const stageBar = ['meet_present', 'survey', 'propose', 'negotiate', 'contract', 'deposit', 'won']
  const barMax = Math.max(1, ...stageBar.map(stageN))

  // Gauge arc = win rate; ring = win rate too.
  const gaugeFrac = Math.max(0, Math.min(1, winRate / 100))
  const SEMI = 251.3

  function openStatus() { setOppsHub(true) }

  return (
    <section className="mt-6 w-full px-3 sm:px-4">
      <div className="relative overflow-hidden rounded-[2rem] p-5 sm:p-6" style={FRAME_STYLE}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(148,163,184,0.45), transparent)' }} />

        {/* Header — identical to dashboard */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
          <h2 className="text-base font-medium leading-tight sm:text-lg" style={{ color: 'rgba(226,232,240,0.94)' }}>Hi <span style={{ color: '#ffffff', fontWeight: 600 }}>{firstName}</span>, <span style={{ color: 'rgba(224,232,241,0.92)', fontWeight: 400 }}>what are we closing today?</span></h2>
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ background: 'rgba(6,78,59,0.45)', border: '1px solid rgba(16,185,129,0.45)', color: '#34d399', fontFamily: 'var(--font-mono, ui-monospace)' }}>
            <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: '#34d399' }} />
            Live Connection
          </span>
        </div>

        {/* Top row — Today's Follow-ups + Opportunities by status */}
        <div className="mb-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-2xl p-4" style={TILE_STYLE}>
            <div className="mb-2.5 flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: '#9FD8EC' }}>Today&apos;s follow-ups</div>
              {followups.length > 0 && <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.82)' }}>{followups.length} due</div>}
            </div>
            {loading ? <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Loading…</div>
              : followups.length === 0 ? <div className="rounded-xl px-3 py-4 text-xs" style={{ background: 'rgba(15,26,38,0.5)', color: 'rgba(255,255,255,0.5)' }}>No follow-ups due. Nice and clear.</div>
              : <div className="space-y-1.5">
                  {followups.slice(0, 4).map(a => (
                    <button key={a.id} type="button" onClick={() => a.opportunity_id && openLifecycle(a.opportunity_id)} className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-all hover:-translate-y-0.5" style={{ background: 'rgba(15,26,38,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: (a.due_at && new Date(a.due_at) < new Date()) ? '#f87171' : '#5FB8E0' }} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12px]" style={{ color: '#eaf2fb' }}>{a.subject || a.type}</div>
                        <div className="truncate text-[10px]" style={{ color: '#c3d3e2' }}>
                          {a.opportunity_name || 'General'}
                          {(() => {
                            const [status, time] = timeLabel(a.due_at).split(' · ')
                            const overdue = status === 'Overdue'
                            return <> · <span style={overdue ? { color: '#f87171', fontWeight: 600 } : undefined}>{status}</span>{time ? ` · ${time}` : ''}</>
                          })()}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>}
          </div>

          <div className="rounded-2xl p-4" style={TILE_STYLE}>
            <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: '#9FD8EC' }}>Opportunities by status</div>
            <div className="grid grid-cols-3 gap-2">
              {([['Survey', 'survey'], ['Propose', 'propose'], ['Contract', 'contract']] as const).map(([label, key]) => {
                const recs = stageRecords(key)
                return (
                  <button key={key} type="button" onClick={openStatus} className="rounded-xl p-2.5 text-left transition-all hover:-translate-y-0.5" style={{ background: WELL, border: '1px solid rgba(95,184,224,0.25)' }}>
                    <div className="text-[22px] font-bold leading-none" style={{ color: '#eaf2fb' }}>{loading ? '–' : recs.length}</div>
                    <div className="mb-1.5 mt-0.5 text-[9px] uppercase tracking-wide" style={{ color: '#9FD8EC' }}>{label}</div>
                    <div className="space-y-0.5">
                      {recs.slice(0, 2).map(r => <div key={r.id} className="truncate text-[10px]" style={{ color: '#c3d3e2' }}>{r.name || 'Untitled'}</div>)}
                      {recs.length > 2 && <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>+{recs.length - 2} more</div>}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* 3-column row — identical to dashboard [1fr 1.3fr 1fr] */}
        <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-[1fr_1.3fr_1fr]">
          <div className="flex flex-col gap-3">
            <HubTile glyph="lead" hex="#5FB8E0" title="Leads Hub" subtitle={`${leadCount ?? '—'} leads · capture, qualify, convert.`} onClick={() => setLeadsHub(true)} />
            <HubTile glyph="pipeline" hex="#3f7fb8" title="Opportunity Hub" subtitle={`${counts.open} open · drive all 7 stages to won.`} onClick={() => setOppsHub(true)} />
          </div>

          {/* Center — Sales Performance */}
          <div className="flex flex-col rounded-2xl p-5" style={TILE_STYLE}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: '#9FD8EC' }}>Sales performance</div>
            <div className="flex flex-col items-center">
              <svg viewBox="0 0 200 118" style={{ width: 210, marginTop: 4 }} role="img" aria-label={`Win rate ${winRate} percent`}>
                <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="#16222f" strokeWidth={14} strokeLinecap="round" />
                <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="#5FB8E0" strokeWidth={14} strokeLinecap="round" strokeDasharray={`${(gaugeFrac * SEMI).toFixed(1)} ${SEMI}`} />
                <text x="100" y="84" textAnchor="middle" fill="#eaf2fb" fontSize="30" fontWeight="600">{winRate}%</text>
                <text x="100" y="100" textAnchor="middle" fill="#9FD8EC" fontSize="9" letterSpacing="1.5">WIN RATE</text>
              </svg>
              <div className="mt-1 flex items-center gap-5">
                <div className="text-center"><div className="text-[20px] font-bold" style={{ color: '#9FD8EC' }}>{money(opp.pipelineTotal)}</div><div className="text-[9px]" style={{ color: '#c3d3e2' }}>Pipeline</div></div>
                <div className="text-center"><div className="text-[20px] font-bold" style={{ color: '#7ee0a8' }}>{counts.won}</div><div className="text-[9px]" style={{ color: '#c3d3e2' }}>Won</div></div>
                <div className="text-center"><div className="text-[20px] font-bold" style={{ color: '#e7b15c' }}>{money(avgDeal)}</div><div className="text-[9px]" style={{ color: '#c3d3e2' }}>Avg deal</div></div>
              </div>
            </div>
            <div className="mt-auto flex items-end gap-1 pt-4" style={{ height: 34 }}>
              {stageBar.map((k, i) => (
                <div key={k} className="flex-1 rounded-sm" style={{ height: `${Math.max(8, (stageN(k) / barMax) * 100)}%`, background: i === stageBar.length - 1 ? '#5FB8E0' : '#3f7fb8' }} title={`${grouped[k]?.label ?? k}: ${stageN(k)}`} />
              ))}
            </div>
            <div className="mt-1 text-[9px]" style={{ color: '#7d93a8' }}>Meet · Survey · Propose · Negotiate · Contract · Deposit · Won</div>
          </div>

          <div className="flex flex-col gap-3">
            <HubTile glyph="quote" hex="#5FB8E0" title="Rough Calculator" subtitle="Fast monthly price from gates, doors, cameras, units." onClick={() => setActivePanel('rough-calc')} />
            <HubTile glyph="research" hex="#5FB8E0" title="ARIA Research" subtitle="Property, owner, contacts, and proptech intel." badge="ARIA" onClick={() => router.push('/aria')} />
          </div>
        </div>
      </div>

      {(activePanel === 'new-lead-flow' || activePanel === 'opps-workbench') && (
        <SalesDetailShell
          title={activePanel === 'new-lead-flow' ? 'Add New Lead' : activePanel === 'opps-workbench' ? 'Your Opportunities' : 'Your Leads'}
          subtitle={activePanel === 'new-lead-flow' ? 'Capture a new lead — phone, walk-in, outbound, or website.' : activePanel === 'opps-workbench' ? 'Work all your open deals in one place.' : 'Work your open leads and follow-ups.'}
          onClose={() => { setActivePanel(null); void loadDashboard() }}
          actions={<>
            <ActionButton label="New Quote" onClick={() => router.push('/quotes/new')} />
            <ActionButton label="Research Property" onClick={() => router.push('/aria')} />
            <ActionButton label="Site Survey" onClick={() => router.push('/survey')} />
          </>}
        >
          <ActionFlowSurface activeTab="opps" initialView={activePanel === 'new-lead-flow' ? 'capture-lead' : activePanel === 'opps-workbench' ? 'opportunities' : 'leads'} onOpenPanel={(p) => setActivePanel(p)} />
        </SalesDetailShell>
      )}

      {activePanel === 'new-opp' && <NewOpportunityFlow onClose={() => setActivePanel(null)} onCreated={openLifecycle} />}
      {activePanel === 'existing-opp' && <ExistingOpportunityFlow onClose={() => setActivePanel(null)} onOpen={openLifecycle} />}

      {lifecycleOppId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 95, overflowY: 'auto', background: NEXUS_BG }}>
          <NexusBackdropLayers variant="page" />
          <div style={{ position: 'relative' }}>
            <OpportunityLifecycle key={`${lifecycleOppId}-${pendingStage ?? 'x'}`} opportunityId={lifecycleOppId} initialStage={pendingStage ?? undefined} onClose={closeLifecycle} />
          </div>
        </div>
      )}

      {leadsHub && <LeadsHub onClose={() => { setLeadsHub(false); void loadDashboard() }} />}
      {oppsHub && <OpportunityHub onClose={() => { setOppsHub(false); void loadDashboard() }} />}

      {activePanel === 'rough-calc' && (
        <SalesDetailShell title="Rough Calculator" subtitle="Enter what's on the site — Gate Guard cost + dealer price update live." onClose={() => setActivePanel(null)}
          actions={<>
            <ActionButton label="Start a Quote" onClick={() => router.push('/quotes/new')} />
            <ActionButton label="New Opportunity" onClick={() => { setActivePanel('new-opp') }} />
          </>}>
          <PricingCalculator />
        </SalesDetailShell>
      )}
    </section>
  )
}
