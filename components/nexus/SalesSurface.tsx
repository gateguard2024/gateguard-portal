'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useUser } from '@clerk/nextjs'
import { ActionFlowSurface } from '@/components/nexus/ActionFlowSurface'
import { LeadsHub } from '@/components/nexus/LeadsHub'
import { OpportunityHub } from '@/components/nexus/OpportunityHub'
import { NexusGlassBackButton } from '@/components/nexus/NexusGlassBackButton'
import { NewOpportunityFlow } from '@/components/nexus/NewOpportunityFlow'
import { ExistingOpportunityFlow } from '@/components/nexus/ExistingOpportunityFlow'
import { RoiCalculator } from '@/components/nexus/RoiCalculator'
import { OpportunityLifecycle } from '@/components/nexus/OpportunityLifecycle'
import { NEXUS_BG, NexusBackdropLayers } from '@/components/nexus/NexusBackdrop'

type PanelId = 'new-opp' | 'existing-opp' | 'new-lead-flow' | 'leads-workbench' | 'opps-workbench' | 'rough-calc'

// ---- Elevated glass tokens + control-center helpers ----
const BRAND = 'linear-gradient(135deg,#19C8F5 0%,#4A8CFF 52%,#6B7EFF 100%)'
const TILE_BG = 'linear-gradient(165deg,rgba(255,255,255,0.045),transparent 55%), linear-gradient(180deg,rgba(32,44,66,0.82),rgba(18,26,42,0.78))'
const TILE_STYLE = { background: TILE_BG, backdropFilter: 'blur(18px) saturate(1.15)', border: '1px solid rgba(255,255,255,0.09)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.09), 0 2px 6px rgba(0,0,0,0.25), 0 28px 64px -30px rgba(0,0,0,0.85)' } as const
const STAGE_ORDER = ['contract', 'deposit', 'negotiate', 'propose', 'survey', 'meet_present']
const STAGE_META: Record<string, { label: string; c: string }> = {
  meet_present: { label: 'Meet', c: 'indigo' }, survey: { label: 'Survey', c: 'cyan' }, propose: { label: 'Proposal', c: 'warn' },
  negotiate: { label: 'Negotiate', c: 'warn' }, contract: { label: 'Contract', c: 'safe' }, deposit: { label: 'Deposit', c: 'safe' },
}
function Ring({ size, pct, color, stroke, children }: { size: number; pct: number; color: string; stroke: number; children?: ReactNode }) {
  const r = (size - stroke) / 2 - 1, c = 2 * Math.PI * r, off = c * (1 - pct / 100)
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>{children}</div>
    </div>
  )
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
      <div className="mx-auto grid h-[calc(100dvh-2rem)] w-full max-w-5xl xl:max-w-none grid-cols-1 gap-4 overflow-hidden rounded-[2rem] p-5 shadow-2xl sm:h-[calc(100dvh-3rem)] lg:grid-cols-[minmax(0,1fr)_260px]"
        style={{ background: NEXUS_BG, border: '1px solid rgba(255,255,255,0.085)', boxShadow: '0 30px 100px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)' }}>
        <div className="min-h-0 overflow-y-auto pr-1 pb-28" style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
          <NexusGlassBackButton label="Back to Sales" onClick={onClose} />
          <div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: '#9FD8EC' }}>Sales</div>
          <h2 className="mt-1 text-2xl font-semibold" style={{ color: '#eaf2fb' }}>{title}</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed" style={{ color: '#c3d3e2' }}>{subtitle}</p>
          <div className="mt-5">{children}</div>
        </div>
        <aside className="min-h-0 overflow-y-auto rounded-3xl p-4" style={{ background: 'linear-gradient(165deg,rgba(255,255,255,0.04),transparent 55%), linear-gradient(180deg,rgba(32,44,66,0.82),rgba(18,26,42,0.78))', border: '1px solid rgba(255,255,255,0.085)', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
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

  const barMax = Math.max(1, ...STAGE_ORDER.map(stageN))

  // Flatten open-stage opportunities into an "active deals" list (closest-to-close first).
  const activeDeals = STAGE_ORDER.flatMap(k => stageRecords(k).map(r => ({ id: r.id, name: r.name || 'Untitled', stage: k }))).slice(0, 8)
  const col = (c: string) => ({ safe: '#22C55E', warn: '#F59E0B', cyan: '#00A3E0', indigo: '#6B7EFF' }[c] || '#9fb0c4')

  return (
    <section className="mt-4 w-full px-3 sm:px-5">
      <div className="mx-auto w-full" style={{ maxWidth: 1340, color: '#eef4fb' }}>

        {/* Sales status hero */}
        <div className="mb-5 grid grid-cols-1 items-center gap-5 rounded-[22px] p-5 sm:p-6 lg:grid-cols-[1.15fr_1fr_1.05fr]"
          style={{ background: 'linear-gradient(135deg,rgba(25,200,245,0.08),rgba(107,126,255,0.07)), linear-gradient(180deg,rgba(26,36,54,0.78),rgba(15,22,36,0.82))', backdropFilter: 'blur(18px) saturate(1.15)', border: '1px solid rgba(255,255,255,0.09)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 30px 70px -30px rgba(0,0,0,0.8)' }}>
          <div className="flex items-center gap-4">
            <div className="flex h-[66px] w-[66px] shrink-0 items-center justify-center rounded-[19px]" style={{ background: BRAND, boxShadow: '0 0 28px rgba(74,140,255,0.45), inset 0 1px 0 rgba(255,255,255,0.3)', color: '#eafaff' }}>
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M6 20V10M12 20V4M18 20v-6" /></svg>
            </div>
            <div>
              <div className="text-[10.5px] font-extrabold uppercase tracking-[0.14em]" style={{ color: '#6d7f94' }}>Pipeline</div>
              <div className="text-[27px] font-extrabold leading-none" style={{ letterSpacing: '-0.02em' }}>{money(opp.pipelineTotal)} · On Pace</div>
              <div className="mt-1 text-[12.5px]" style={{ color: '#9fb0c4' }}>Hi {firstName} — {counts.open} open deals · {wonN} won</div>
            </div>
          </div>
          <div className="flex items-center justify-center gap-4 lg:border-x" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <Ring size={92} pct={winRate} color={col('safe')} stroke={8}>
              <b style={{ fontSize: 23, fontWeight: 800 }}>{winRate}%</b>
              <span style={{ fontSize: 9, fontWeight: 700, color: col('safe'), letterSpacing: '0.04em' }}>WIN RATE</span>
            </Ring>
            <div className="flex flex-col gap-1.5">
              {[['Open deals', String(counts.open), 'cyan'], ['Won', String(wonN), 'safe'], ['Avg deal', money(avgDeal), 'warn']].map(([l, v, c]) => (
                <div key={l} className="flex items-center gap-2 text-[12px]" style={{ color: '#9fb0c4' }}><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: col(c) }} />{l} · <b style={{ color: '#eef4fb', fontWeight: 600 }}>{v}</b></div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <button type="button" onClick={() => setActivePanel('new-opp')} className="col-span-2 flex items-center justify-center gap-2 rounded-xl py-3 text-[12.5px] font-bold" style={{ background: BRAND, color: '#041018' }}><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 5v14M5 12h14" /></svg> New Opportunity</button>
            <button type="button" onClick={() => setLeadsHub(true)} className="flex items-center justify-center gap-2 rounded-xl py-3 text-[12.5px] font-bold" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#eef4fb' }}><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#00A3E0" strokeWidth={2}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM19 8v6M22 11h-6" /></svg> New Lead</button>
            <button type="button" onClick={() => setActivePanel('rough-calc')} className="flex items-center justify-center gap-2 rounded-xl py-3 text-[12.5px] font-bold" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#eef4fb' }}><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#00A3E0" strokeWidth={2}><path d="M9 7h6M9 11h6M9 15h4M5 3h14v18H5z" /></svg> ROI</button>
          </div>
        </div>

        {/* Metrics */}
        <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { l: 'Pipeline', v: money(opp.pipelineTotal), s: 'weighted open', pct: 72, c: 'safe', ic: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' },
            { l: 'Open Deals', v: String(counts.open), s: `${stageN('contract')} contracts out`, pct: 100, c: 'cyan', ic: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6' },
            { l: 'Win Rate', v: `${winRate}%`, s: 'won vs lost', pct: winRate, c: 'indigo', ic: 'M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M6 3h12v6a6 6 0 0 1-12 0z' },
            { l: 'Avg Deal', v: money(avgDeal), s: `${wonN} won to date`, pct: 55, c: 'warn', ic: 'M13 2 3 14h7l-1 8 10-12h-7z' },
          ].map((m, i) => (
            <div key={i} className="flex items-center gap-4 rounded-2xl p-4" style={{ background: 'linear-gradient(165deg,rgba(255,255,255,0.04),transparent 55%),rgba(20,28,43,0.5)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <Ring size={58} pct={m.pct} color={col(m.c)} stroke={5}><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke={col(m.c)} strokeWidth={1.9}><path d={m.ic} /></svg></Ring>
              <div><div className="text-[11px] font-bold uppercase tracking-[0.06em]" style={{ color: '#9fb0c4' }}>{m.l}</div><div className="mt-1.5 text-[23px] font-extrabold leading-none" style={{ letterSpacing: '-0.02em' }}>{loading ? '—' : m.v}</div><div className="mt-1.5 text-[11px]" style={{ color: '#6d7f94' }}>{m.s}</div></div>
            </div>
          ))}
        </div>

        {/* Active deals + pipeline/follow-ups */}
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[1.5fr_1fr]">
          {/* Active deals */}
          <div className="rounded-2xl" style={TILE_STYLE}>
            <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: '#1e2a3c' }}><span className="text-[14px] font-bold">Open Opportunities</span><button type="button" onClick={() => setOppsHub(true)} className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide" style={{ background: 'rgba(0,163,224,0.12)', color: '#00A3E0', border: '1px solid rgba(0,163,224,0.3)' }}>Open board →</button></div>
            <div className="p-4">
              {loading ? <div className="px-1 py-6 text-center text-xs" style={{ color: '#9fb0c4' }}>Loading deals…</div>
                : activeDeals.length === 0 ? <div className="px-1 py-6 text-center text-xs" style={{ color: '#9fb0c4' }}>No open deals yet. Start a quote to build pipeline.</div>
                : activeDeals.map(d => {
                  const meta = STAGE_META[d.stage] || { label: d.stage, c: 'cyan' }
                  return (
                    <button key={d.id} type="button" onClick={() => openLifecycle(d.id)} className="mb-2.5 flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-3 text-left transition-all hover:-translate-y-0.5" style={{ background: '#161f2e', border: '1px solid #1e2a3c', borderLeft: `3px solid ${col(meta.c)}` }}>
                      <span className="truncate text-[13.5px] font-semibold">{d.name}</span>
                      <span className="shrink-0 rounded-full px-3 py-1 text-[10px] font-extrabold" style={{ background: `${col(meta.c)}22`, color: col(meta.c) }}>{meta.label}</span>
                    </button>
                  )
                })}
            </div>
          </div>

          {/* Pipeline by stage + follow-ups */}
          <div className="flex flex-col gap-5">
            <div className="rounded-2xl" style={TILE_STYLE}>
              <div className="border-b px-5 py-4 text-[14px] font-bold" style={{ borderColor: '#1e2a3c' }}>Pipeline by stage</div>
              <div className="flex items-center gap-4 p-5">
                <Ring size={100} pct={100} color={col('cyan')} stroke={9}><b style={{ fontSize: 28, fontWeight: 800 }}>{counts.open}</b><span style={{ fontSize: 9, fontWeight: 700, color: '#6d7f94', letterSpacing: '0.04em' }}>DEALS</span></Ring>
                <div className="flex-1">
                  {STAGE_ORDER.map(k => {
                    const meta = STAGE_META[k]; const n = stageN(k)
                    return (
                      <div key={k} className="mb-2">
                        <div className="mb-1 flex justify-between text-[12px]"><span style={{ color: '#9fb0c4' }}>{meta.label}</span><b>{n}</b></div>
                        <div className="h-2 overflow-hidden rounded-full" style={{ background: '#0b111c' }}><i className="block h-full" style={{ width: `${(n / barMax) * 100}%`, background: col(meta.c) }} /></div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="rounded-2xl" style={TILE_STYLE}>
              <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: '#1e2a3c' }}><span className="text-[14px] font-bold">Follow-ups</span>{followups.length > 0 && <span className="text-[11px]" style={{ color: '#6d7f94' }}>{followups.length} due</span>}</div>
              <div className="p-4">
                {loading ? <div className="text-xs" style={{ color: '#9fb0c4' }}>Loading…</div>
                  : followups.length === 0 ? <div className="rounded-xl px-3 py-4 text-xs" style={{ background: '#0b111c', color: '#9fb0c4' }}>No follow-ups due. Nice and clear.</div>
                  : followups.slice(0, 5).map(a => (
                    <button key={a.id} type="button" onClick={() => a.opportunity_id && openLifecycle(a.opportunity_id)} className="mb-1.5 flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-all hover:-translate-y-0.5" style={{ background: '#0b111c', border: '1px solid #1e2a3c' }}>
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: (a.due_at && new Date(a.due_at) < new Date()) ? '#EF4444' : '#00A3E0' }} />
                      <div className="min-w-0 flex-1"><div className="truncate text-[12px]" style={{ color: '#eef4fb' }}>{a.subject || a.type}</div><div className="truncate text-[10px]" style={{ color: '#9fb0c4' }}>{a.opportunity_name || 'General'} · {timeLabel(a.due_at)}</div></div>
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
