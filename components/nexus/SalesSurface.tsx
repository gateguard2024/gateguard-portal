'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { ActionFlowSurface } from '@/components/nexus/ActionFlowSurface'
import { LeadsHub } from '@/components/nexus/LeadsHub'
import { OpportunityHub } from '@/components/nexus/OpportunityHub'
import { NexusGlassBackButton } from '@/components/nexus/NexusGlassBackButton'
import { NewOpportunityFlow } from '@/components/nexus/NewOpportunityFlow'
import { ExistingOpportunityFlow } from '@/components/nexus/ExistingOpportunityFlow'
import { RoiCalculator } from '@/components/nexus/RoiCalculator'
import { OpportunityGlassWindow } from '@/components/nexus/windows/OpportunityGlassWindow'
import { NEXUS_BG, NexusBackdropLayers } from '@/components/nexus/NexusBackdrop'

type PanelId = 'new-opp' | 'existing-opp' | 'new-lead-flow' | 'leads-workbench' | 'opps-workbench' | 'rough-calc'

// ---- Elevated glass tokens + control-center helpers ----
// Calm pass — flat cards, one accent, hairline borders, tighter corners, legible text.
const ACCENT = '#4A8CFF'
const INK = '#eef4fb'
const MUT = '#9aa7b8'    // legible secondary text
const MUT2 = '#73839a'   // legible tertiary text
const LINE = '#1e2a3a'
const CARD = { background: '#121a27', border: `1px solid ${LINE}` } as const
const STAGE_ORDER = ['contract', 'deposit', 'negotiate', 'propose', 'survey', 'meet_present']
const STAGE_META: Record<string, { label: string; c: string }> = {
  meet_present: { label: 'Meet', c: 'warn' }, survey: { label: 'Survey', c: 'warn' }, propose: { label: 'Proposal', c: 'cyan' },
  negotiate: { label: 'Negotiate', c: 'warn' }, contract: { label: 'Contract', c: 'safe' }, deposit: { label: 'Deposit', c: 'safe' },
}
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

// Popup detail shell (leads/opps workbench, rough calc).
function SalesDetailShell({ title, subtitle, onClose, children, actions }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[90] overflow-hidden bg-black/68 px-4 py-4 backdrop-blur-sm sm:py-6">
      <div className="mx-auto grid h-[calc(100dvh-2rem)] w-full max-w-5xl xl:max-w-none grid-cols-1 gap-4 overflow-hidden rounded-[16px] p-5 shadow-2xl sm:h-[calc(100dvh-3rem)] lg:grid-cols-[minmax(0,1fr)_260px]"
        style={{ background: NEXUS_BG, border: '1px solid rgba(255,255,255,0.085)', boxShadow: '0 30px 100px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)' }}>
        <div className="min-h-0 overflow-y-auto pr-1 pb-28" style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
          <NexusGlassBackButton label="Back to Sales" onClick={onClose} />
          <div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: '#00A3FF' }}>Sales</div>
          <h2 className="mt-1 text-2xl font-semibold" style={{ color: '#eaf2fb' }}>{title}</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed" style={{ color: '#c3d3e2' }}>{subtitle}</p>
          <div className="mt-5">{children}</div>
        </div>
        <aside className="min-h-0 overflow-y-auto rounded-[12px] p-4" style={{ background: '#121a27', border: `1px solid ${LINE}`, WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
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
      style={{ background: 'rgba(0,163,255,0.12)', border: '1px solid rgba(0,163,255,0.3)', color: '#00A3FF' }}>
      {label}
    </button>
  )
}

export function SalesSurface() {
  const router = useRouter()
  const { user } = useUser()
  const firstName = user?.firstName ?? 'there'

  const [activePanel, setActivePanel] = useState<PanelId | null>(null)
  // Opportunity glass window (the Deal Life Cycle view is deprecated — every
  // "open a deal" and "deal just created" path now opens this window instead).
  const [oppWindowId, setOppWindowId] = useState<string | null>(null)
  const [oppWindowData, setOppWindowData] = useState<Record<string, unknown> | null>(null)
  const [leadsHub, setLeadsHub] = useState(false)
  const [oppsHub, setOppsHub] = useState(false)

  const [followups, setFollowups] = useState<Activity[]>([])
  const [opp, setOpp] = useState<OppData>({})
  const [leadCount, setLeadCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchOppWindow = useCallback(async (id: string) => {
    const res = await fetch(`/api/nexus/opps/opportunity-window/${id}`)
    const data = await res.json().catch(() => null)
    if (res.ok && data && data.success !== false) setOppWindowData(data)
  }, [])
  const openLifecycle = useCallback(async (id: string) => {
    setActivePanel(null); setOppWindowId(id); setOppWindowData(null)
    try { await fetchOppWindow(id) } catch {}
  }, [fetchOppWindow])
  const refreshOppWindow = useCallback(async () => {
    if (oppWindowId) { try { await fetchOppWindow(oppWindowId) } catch {} }
  }, [oppWindowId, fetchOppWindow])
  function closeLifecycle() { setOppWindowId(null); setOppWindowData(null) }

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

  const barMax = Math.max(1, ...STAGE_ORDER.map(stageN))

  // Flatten open-stage opportunities into an "active deals" list (closest-to-close first).
  const activeDeals = STAGE_ORDER.flatMap(k => stageRecords(k).map(r => ({ id: r.id, name: r.name || 'Untitled', stage: k }))).slice(0, 8)
  const col = (c: string) => ({ safe: '#30c08b', warn: '#e0a53b', cyan: ACCENT, indigo: ACCENT }[c] || MUT)

  return (
    <section className="mt-4 w-full px-3 sm:px-5">
      <div className="mx-auto w-full" style={{ maxWidth: 1340, color: '#eef4fb' }}>

        {/* Sales summary */}
        <div className="mb-4 flex flex-col gap-5 rounded-[12px] p-5 lg:flex-row lg:items-center" style={CARD}>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: MUT }}>Pipeline</div>
            <div className="mt-1 text-[26px] font-extrabold leading-none" style={{ letterSpacing: '-0.02em' }}>{money(opp.pipelineTotal)} <span style={{ color: '#30c08b', fontSize: 14, fontWeight: 700 }}>· On Pace</span></div>
            <div className="mt-1.5 text-[12.5px]" style={{ color: MUT }}>Hi {firstName} — {counts.open} open deals · {wonN} won</div>
          </div>
          <div className="flex items-center gap-8 lg:ml-4 lg:border-l lg:pl-8" style={{ borderColor: LINE }}>
            <div><div className="text-[20px] font-extrabold leading-none" style={{ color: ACCENT }}>{winRate}%</div><div className="mt-1.5 text-[11.5px]" style={{ color: MUT }}>Win rate</div></div>
            <div><div className="text-[20px] font-extrabold leading-none">{counts.open}</div><div className="mt-1.5 text-[11.5px]" style={{ color: MUT }}>Open deals</div></div>
            <div><div className="text-[20px] font-extrabold leading-none">{money(avgDeal)}</div><div className="mt-1.5 text-[11.5px]" style={{ color: MUT }}>Avg deal</div></div>
          </div>
          <div className="flex flex-wrap gap-2.5 lg:ml-auto">
            <button type="button" onClick={() => setActivePanel('new-opp')} className="flex items-center gap-2 rounded-[8px] px-4 py-2.5 text-[12.5px] font-bold" style={{ background: ACCENT, color: '#fff' }}><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 5v14M5 12h14" /></svg> New Opportunity</button>
            <button type="button" onClick={() => setLeadsHub(true)} className="flex items-center gap-2 rounded-[8px] px-4 py-2.5 text-[12.5px] font-semibold" style={{ background: 'transparent', border: `1px solid ${LINE}`, color: INK }}>New Lead</button>
            <button type="button" onClick={() => setActivePanel('rough-calc')} className="flex items-center gap-2 rounded-[8px] px-4 py-2.5 text-[12.5px] font-semibold" style={{ background: 'transparent', border: `1px solid ${LINE}`, color: INK }}>ROI</button>
          </div>
        </div>

        {/* Metrics */}
        <div className="mb-4 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          {[
            { l: 'Pipeline', v: money(opp.pipelineTotal), s: 'Weighted open' },
            { l: 'Open Deals', v: String(counts.open), s: `${stageN('contract')} contracts out` },
            { l: 'Win Rate', v: `${winRate}%`, s: 'Won vs lost' },
            { l: 'Avg Deal', v: money(avgDeal), s: `${wonN} won to date` },
          ].map((m, i) => (
            <div key={i} className="rounded-[10px] p-4" style={CARD}>
              <div className="text-[11px] font-bold uppercase tracking-[0.06em]" style={{ color: MUT }}>{m.l}</div>
              <div className="mt-2.5 text-[23px] font-extrabold leading-none" style={{ letterSpacing: '-0.02em' }}>{loading ? '—' : m.v}</div>
              <div className="mt-2 text-[11.5px]" style={{ color: MUT2 }}>{m.s}</div>
            </div>
          ))}
        </div>

        {/* Open opportunities + pipeline/follow-ups */}
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.6fr_1fr]">
          {/* Open opportunities */}
          <div className="rounded-[12px]" style={CARD}>
            <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: LINE }}><span className="text-[14px] font-bold">Open Opportunities</span><button type="button" onClick={() => setOppsHub(true)} className="text-[11.5px] font-semibold" style={{ color: ACCENT }}>Open board →</button></div>
            <div className="px-2.5 py-2">
              {loading ? <div className="px-3 py-6 text-center text-[12.5px]" style={{ color: MUT }}>Loading deals…</div>
                : activeDeals.length === 0 ? <div className="px-3 py-6 text-center text-[12.5px]" style={{ color: MUT }}>No open deals yet. Start a quote to build pipeline.</div>
                : activeDeals.map((d, i) => {
                  const meta = STAGE_META[d.stage] || { label: d.stage, c: 'cyan' }
                  return (
                    <button key={d.id} type="button" onClick={() => openLifecycle(d.id)} className="flex w-full items-center gap-3 rounded-[6px] px-3 py-3 text-left hover:bg-white/[0.03]" style={i > 0 ? { borderTop: '1px solid rgba(255,255,255,0.045)' } : undefined}>
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: col(meta.c) }} />
                      <span className="flex-1 truncate text-[13px] font-medium">{d.name}</span>
                      <span className="shrink-0 text-[11.5px]" style={{ color: MUT }}>{meta.label}</span>
                    </button>
                  )
                })}
            </div>
          </div>

          {/* Pipeline by stage + follow-ups */}
          <div className="flex flex-col gap-4">
            <div className="rounded-[12px]" style={CARD}>
              <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: LINE }}><span className="text-[14px] font-bold">Pipeline by stage</span><span className="text-[11.5px]" style={{ color: MUT }}>{counts.open} deals</span></div>
              <div className="px-5 py-4">
                {STAGE_ORDER.map(k => {
                  const meta = STAGE_META[k]; const n = stageN(k)
                  return (
                    <div key={k} className="mb-3.5 flex items-center gap-3 last:mb-0">
                      <span className="w-[72px] shrink-0 text-[12px]" style={{ color: MUT }}>{meta.label}</span>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: '#172131' }}><i className="block h-full rounded-full" style={{ width: `${(n / barMax) * 100}%`, background: ACCENT }} /></span>
                      <b className="w-6 text-right text-[12px]">{n}</b>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="rounded-[12px]" style={CARD}>
              <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: LINE }}><span className="text-[14px] font-bold">Follow-ups</span>{followups.length > 0 && <span className="text-[11.5px]" style={{ color: MUT }}>{followups.length} due</span>}</div>
              <div className="px-2.5 py-2">
                {loading ? <div className="px-3 py-4 text-[12.5px]" style={{ color: MUT }}>Loading…</div>
                  : followups.length === 0 ? <div className="px-3 py-4 text-[12.5px]" style={{ color: MUT }}>No follow-ups due. Nice and clear.</div>
                  : followups.slice(0, 5).map((a, i) => (
                    <button key={a.id} type="button" onClick={() => a.opportunity_id && openLifecycle(a.opportunity_id)} className="flex w-full items-start gap-2.5 rounded-[6px] px-3 py-2.5 text-left hover:bg-white/[0.03]" style={i > 0 ? { borderTop: '1px solid rgba(255,255,255,0.045)' } : undefined}>
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: (a.due_at && new Date(a.due_at) < new Date()) ? '#e0a53b' : ACCENT }} />
                      <div className="min-w-0 flex-1"><div className="truncate text-[12.5px] font-semibold" style={{ color: INK }}>{a.subject || a.type}</div><div className="truncate text-[11px]" style={{ color: MUT }}>{a.opportunity_name || 'General'} · {timeLabel(a.due_at)}</div></div>
                    </button>
                  ))}
              </div>
            </div>
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

      {oppWindowId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 95, overflowY: 'auto', background: NEXUS_BG }}>
          <NexusBackdropLayers variant="page" />
          <div style={{ position: 'relative' }}>
            {oppWindowData
              ? <OpportunityGlassWindow data={oppWindowData as Parameters<typeof OpportunityGlassWindow>[0]['data']} onBack={() => { closeLifecycle(); void loadDashboard() }} onRefresh={refreshOppWindow} />
              : <div style={{ padding: 48, color: '#9fb4cc', fontSize: 13 }}>Loading opportunity…</div>}
          </div>
        </div>
      )}

      {leadsHub && <LeadsHub onClose={() => { setLeadsHub(false); void loadDashboard() }} />}
      {oppsHub && <OpportunityHub onClose={() => { setOppsHub(false); void loadDashboard() }} />}

      {activePanel === 'rough-calc' && (
        <SalesDetailShell title="ROI Calculator" subtitle="Enter the site scope + terms — start-up, monthly profit, and ROI update live." onClose={() => setActivePanel(null)}
          actions={<>
            <ActionButton label="Start a Quote" onClick={() => router.push('/quotes/new')} />
            <ActionButton label="New Opportunity" onClick={() => { setActivePanel('new-opp') }} />
          </>}>
          <RoiCalculator />
        </SalesDetailShell>
      )}
    </section>
  )
}
