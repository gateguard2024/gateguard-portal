'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { ActionFlowSurface } from '@/components/nexus/ActionFlowSurface'
import { LeadsHub } from '@/components/nexus/LeadsHub'
import { SalesBoard } from '@/components/nexus/sales/SalesBoard'
import type { Deal } from '@/components/nexus/sales/salesShared'
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
// Light look for the main page (white cards on the navy fade) — same palette as My Day / Tasks.
// The pop-up shells below still use the dark tokens above until they're converted.
const L = { ink: '#1D1D1F', ink2: '#3A3A3C', ink3: '#6E6E73', line: 'rgba(0,0,0,0.08)', blue: '#0071E3', red: '#D70015', font: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, system-ui, sans-serif' }
const CARD: React.CSSProperties = { background: '#FFFFFF', borderRadius: 14, boxShadow: '0 1px 2px rgba(10,20,40,0.06), 0 8px 24px rgba(10,20,40,0.08)' }
const DARK_BTN: React.CSSProperties = { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)', color: '#fff', fontWeight: 500 }
const HDR_BTN = 'flex h-[38px] min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] px-2 text-[13px] sm:flex-none sm:gap-2 sm:px-4 sm:text-[14px]'
// Stage pills: green = late stage, orange = early, blue = proposal.
const PILL: Record<string, React.CSSProperties> = {
  safe: { background: '#E8F6EC', color: '#1A7F37' }, warn: { background: '#FFF4E5', color: '#B25000' }, cyan: { background: '#EEF4FF', color: '#0058B0' },
}
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
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`
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
        // Same source + scoping as the Sales board, so the numbers here match it.
        fetch('/api/sales/deals').then(r => r.json()).catch(() => ({})),
        fetch('/api/crm/leads').then(r => r.json()).catch(() => []),
      ])
      const acts: Activity[] = Array.isArray(aRes) ? aRes : (aRes?.records ?? [])
      const end = new Date(); end.setHours(23, 59, 59, 999)
      setFollowups(acts.filter(a => !a.completed_at && a.due_at && new Date(a.due_at) <= end).sort((x, y) => new Date(x.due_at!).getTime() - new Date(y.due_at!).getTime()))
      const deals: Deal[] = Array.isArray(oRes?.deals) ? oRes.deals : []
      const grouped: NonNullable<OppData['grouped']> = {}
      for (const d of deals) {
        const k = d.tab === 'open' ? d.stage : d.tab
        if (!grouped[k]) grouped[k] = { label: k, records: [], total: 0 }
        grouped[k].records.push({ id: d.id, name: d.name })
        grouped[k].total += d.tcv ?? 0
      }
      const openDeals = deals.filter(d => d.tab === 'open')
      setOpp({
        grouped,
        pipelineTotal: oRes?.canViewFinancials === false ? null : openDeals.reduce((n, d) => n + (d.tcv ?? 0), 0),
        counts: { total: deals.length, open: openDeals.length, won: deals.filter(d => d.tab === 'won').length },
      })
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

  return (
    <section className="w-full px-1 sm:px-2">
      <div className="mx-auto w-full" style={{ maxWidth: 1360, color: L.ink, fontFamily: L.font, letterSpacing: '-0.01em' }}>

        {/* Header — sits on the navy part of the fade */}
        <div className="mb-5 mt-2 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="m-0 text-[24px] font-semibold leading-tight sm:text-[30px]" style={{ color: '#fff', letterSpacing: '-0.025em' }}>Sales</h1>
            <div className="mt-1 text-[14px]" style={{ color: 'rgba(255,255,255,0.66)' }}>
              Hi {firstName} — <b style={{ color: '#fff', fontWeight: 600 }}>{counts.open}</b> open deals · <b style={{ color: '#fff', fontWeight: 600 }}>{wonN}</b> won
              {followups.length > 0 && <> · <b style={{ color: '#fff', fontWeight: 600 }}>{followups.length}</b> follow-up{followups.length === 1 ? '' : 's'} due</>}
            </div>
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <button type="button" onClick={() => setActivePanel('new-opp')} className={HDR_BTN} style={{ background: L.blue, color: '#fff', fontWeight: 600 }}>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 5v14M5 12h14" /></svg> <span className="sm:hidden">New deal</span><span className="hidden sm:inline">New opportunity</span>
            </button>
            <button type="button" onClick={() => setLeadsHub(true)} className={HDR_BTN} style={DARK_BTN}>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth={1.9}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM19 8v6M22 11h-6" /></svg> New lead
            </button>
            <button type="button" onClick={() => setActivePanel('rough-calc')} className={HDR_BTN} style={DARK_BTN}>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth={1.9}><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M8 6h8M8 11h2M14 11h2M8 15h2M14 15h2M8 19h2M14 19h2" /></svg> ROI
            </button>
          </div>
        </div>

        {/* Four numbers */}
        <div className="mb-4 grid grid-cols-2 gap-2.5 sm:gap-3.5 lg:grid-cols-4">
          {[
            { l: 'Pipeline', v: money(opp.pipelineTotal), s: 'Open deals, total contract value', onClick: () => setOppsHub(true) },
            { l: 'Open deals', v: String(counts.open), s: `${stageN('contract')} contract${stageN('contract') === 1 ? '' : 's'} out`, onClick: () => setOppsHub(true) },
            { l: 'Win rate', v: `${winRate}%`, s: `${wonN} won · ${lostN} lost`, onClick: () => setOppsHub(true) },
            { l: 'Avg deal', v: money(avgDeal), s: 'Per open deal', onClick: () => setOppsHub(true) },
          ].map(m => (
            <button key={m.l} type="button" onClick={m.onClick} title="Open the opportunities board" className="min-w-0 p-3 text-left transition-transform hover:-translate-y-0.5 sm:px-[18px] sm:py-4" style={CARD}>
              <div className="text-[12px] font-medium" style={{ color: L.ink3 }}>{m.l}</div>
              <div className="mt-1 text-[22px] font-semibold leading-tight sm:text-[26px]" style={{ letterSpacing: '-0.02em' }}>{loading ? '—' : m.v}</div>
              <div className="mt-0.5 truncate text-[12px]" style={{ color: L.ink3 }}>{m.s}</div>
            </button>
          ))}
        </div>

        {/* Open opportunities + pipeline / follow-ups */}
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="min-w-0 overflow-hidden" style={CARD}>
            <div className="flex items-center justify-between px-[18px] py-3.5" style={{ borderBottom: `1px solid ${L.line}` }}>
              <span className="text-[15px] font-semibold">Open opportunities</span>
              <button type="button" onClick={() => setOppsHub(true)} className="text-[13px] font-medium" style={{ color: L.blue }}>Open board</button>
            </div>
            {loading ? <div className="px-[18px] py-8 text-center text-[13px]" style={{ color: L.ink3 }}>Loading deals…</div>
              : activeDeals.length === 0 ? <div className="px-[18px] py-8 text-center text-[13px]" style={{ color: L.ink3 }}>No open deals yet. Start a quote to build pipeline.</div>
              : activeDeals.map((d, i) => {
                const meta = STAGE_META[d.stage] || { label: d.stage, c: 'cyan' }
                const pill = PILL[meta.c] ?? PILL.cyan
                return (
                  <button key={d.id} type="button" onClick={() => openLifecycle(d.id)} className="flex w-full items-center gap-3 px-[18px] py-3 text-left hover:bg-[#F7F8FA]" style={i > 0 ? { borderTop: `1px solid ${L.line}` } : undefined}>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[12px] font-semibold" style={{ background: '#EEF4FF', color: L.blue }}>{(d.name || '?').trim().charAt(0).toUpperCase()}</span>
                    <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{d.name}</span>
                    <span className="shrink-0 rounded-md px-2 py-0.5 text-[12px] font-medium" style={pill}>{meta.label}</span>
                  </button>
                )
              })}
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            <div className="overflow-hidden" style={CARD}>
              <div className="flex items-center justify-between px-[18px] py-3.5" style={{ borderBottom: `1px solid ${L.line}` }}>
                <span className="text-[15px] font-semibold">Pipeline by stage</span>
                <span className="text-[13px]" style={{ color: L.ink3 }}>{counts.open} deals</span>
              </div>
              <div className="px-[18px] py-4">
                {STAGE_ORDER.map(k => {
                  const meta = STAGE_META[k]; const n = stageN(k)
                  return (
                    <div key={k} className="mb-3 flex items-center gap-3 last:mb-0">
                      <span className="w-[76px] shrink-0 text-[13px]" style={{ color: L.ink2 }}>{meta.label}</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: '#EEF0F4' }}><i className="block h-full rounded-full" style={{ width: `${(n / barMax) * 100}%`, background: L.blue }} /></span>
                      <b className="w-6 text-right text-[13px] font-semibold">{n}</b>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="overflow-hidden" style={CARD}>
              <div className="flex items-center justify-between px-[18px] py-3.5" style={{ borderBottom: `1px solid ${L.line}` }}>
                <span className="text-[15px] font-semibold">Follow-ups</span>
                {followups.length > 0 && <span className="text-[13px]" style={{ color: L.ink3 }}>{followups.length} due</span>}
              </div>
              {loading ? <div className="px-[18px] py-5 text-[13px]" style={{ color: L.ink3 }}>Loading…</div>
                : followups.length === 0 ? <div className="px-[18px] py-5 text-[13px]" style={{ color: L.ink3 }}>No follow-ups due. Nice and clear.</div>
                : followups.slice(0, 5).map((a, i) => {
                  const late = !!a.due_at && new Date(a.due_at) < new Date()
                  return (
                    <button key={a.id} type="button" onClick={() => a.opportunity_id && openLifecycle(a.opportunity_id)} className="flex w-full items-start gap-2.5 px-[18px] py-2.5 text-left hover:bg-[#F7F8FA]" style={i > 0 ? { borderTop: `1px solid ${L.line}` } : undefined}>
                      <span className="mt-[7px] h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: late ? '#FF3B30' : L.blue }} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14px] font-medium">{a.subject || a.type}</div>
                        <div className="truncate text-[12px]" style={{ color: late ? L.red : L.ink3 }}>{a.opportunity_name || 'General'} · {timeLabel(a.due_at)}</div>
                      </div>
                    </button>
                  )
                })}
            </div>
          </div>
        </div>
        <div className="h-6" />
      </div>

      {(activePanel === 'new-lead-flow' || activePanel === 'opps-workbench') && (
        <SalesDetailShell
          title={activePanel === 'new-lead-flow' ? 'Add New Lead' : activePanel === 'opps-workbench' ? 'Your Opportunities' : 'Your Leads'}
          subtitle={activePanel === 'new-lead-flow' ? 'Capture a new lead — phone, walk-in, outbound, or website.' : activePanel === 'opps-workbench' ? 'Work all your open deals in one place.' : 'Work your open leads and follow-ups.'}
          onClose={() => { setActivePanel(null); void loadDashboard() }}
          actions={<>
            <ActionButton label="New Proposal" onClick={() => router.push('/quotes/new')} />
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
      {oppsHub && (
        <SalesBoard
          onClose={() => { setOppsHub(false); void loadDashboard() }}
          onNewDeal={() => { setOppsHub(false); setActivePanel('new-opp') }}
          onOpenFull={id => void openLifecycle(id)}
        />
      )}

      {activePanel === 'rough-calc' && (
        <SalesDetailShell title="ROI Calculator" subtitle="Enter the site scope + terms — start-up, monthly profit, and ROI update live." onClose={() => setActivePanel(null)}
          actions={<>
            <ActionButton label="Start a Proposal" onClick={() => router.push('/quotes/new')} />
            <ActionButton label="New Opportunity" onClick={() => { setActivePanel('new-opp') }} />
          </>}>
          <RoiCalculator />
        </SalesDetailShell>
      )}
    </section>
  )
}
