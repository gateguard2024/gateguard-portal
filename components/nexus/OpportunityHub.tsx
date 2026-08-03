'use client'

/**
 * OpportunityHub — the tactical-steel deal cockpit (sibling of LeadsHub).
 * KPI row + pipeline breakdown donut, a scrolling Deal Analysis table
 * (units / MRR / EMC carried from the lead), and a bottom row: stacked
 * New Opportunity / Work Existing Deal + two scrolling typed follow-up
 * columns. Opens the full OpportunityGlassWindow. Reads
 * /api/nexus/opps/opps-dashboard + workbench. No new backend beyond the
 * dashboard read.
 */
import { useCallback, useEffect, useState } from 'react'
import { NEXUS_BG, NexusBackdropLayers } from '@/components/nexus/NexusBackdrop'
import { NexusGlassBackButton } from '@/components/nexus/NexusGlassBackButton'
import { OpportunityGlassWindow } from '@/components/nexus/windows/OpportunityGlassWindow'
import { NewOpportunityFlow } from '@/components/nexus/NewOpportunityFlow'

type DealRow = { id: string; name: string; stage: string; units: number | null; mrr: number | null; emc: number | null; close_date: string | null; next_step: string | null }
type FollowUp = { id: string; type: 'call' | 'email' | 'visit' | 'task'; title: string; lead: string | null; due: string | null }
type Dash = {
  kpis?: { openPipeline: number | null; openDeals: number; winRate: number; wonMtd: number }
  breakdown?: { survey: number; propose: number; negotiate: number; contract: number }
  analysis?: DealRow[]
  followupsToday?: FollowUp[]
  followupsWeek?: FollowUp[]
}
type WbOpp = { id: string; name?: string | null; account_name?: string | null; stage?: string | null; est_mrr?: number | null; updated_at?: string | null }

const FRAME_STYLE = { background: 'repeating-linear-gradient(90deg,rgba(255,255,255,0.05) 0 1px,transparent 1px 4px), linear-gradient(180deg,#5a6c84,#45556a)', border: '1px solid rgba(10,16,24,0.4)', boxShadow: '0 26px 54px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -2px 2px rgba(0,0,0,0.4)' } as const
const TILE = 'repeating-linear-gradient(90deg,rgba(255,255,255,0.04) 0 1px,transparent 1px 4px), linear-gradient(180deg,#2b3c52,#1e2a3a)'
const TILE_STYLE = { background: TILE, border: '1px solid rgba(140,170,200,0.22)', boxShadow: '0 14px 30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.14)' } as const

const FU_STYLE: Record<FollowUp['type'], { fg: string; bg: string; label: string }> = {
  call: { fg: '#5FB8E0', bg: 'rgba(95,184,224,0.16)', label: 'Call' },
  email: { fg: '#9FD8EC', bg: 'rgba(159,216,236,0.16)', label: 'Email' },
  visit: { fg: '#7ee0a8', bg: 'rgba(126,224,168,0.16)', label: 'Visit' },
  task: { fg: '#c3d3e2', bg: 'rgba(148,163,184,0.16)', label: 'Task' },
}

function money(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1000) return `$${(Math.round(n / 100) / 10).toLocaleString()}k`.replace('.0k', 'k')
  return `$${Math.round(n).toLocaleString()}`
}
function initials(name?: string | null): string {
  const n = (name || '?').trim()
  return n.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || '?'
}
function relTime(iso?: string | null): string {
  if (!iso) return ''
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3.6e6)
  if (h < 1) return 'now'
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}
function dueLabel(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(`${iso}T00:00:00`)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  if (d.getTime() === today.getTime()) return 'Today'
  return d.toLocaleDateString([], { weekday: 'short' })
}
function shortDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(`${iso}T00:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric' })
}
function stageChip(label: string): { fg: string; bg: string } {
  const v = label.toLowerCase()
  if (/won|deposit/.test(v)) return { fg: '#7ee0a8', bg: 'rgba(126,224,168,0.16)' }
  if (/contract/.test(v)) return { fg: '#7ee0a8', bg: 'rgba(126,224,168,0.16)' }
  if (/negoti/.test(v)) return { fg: '#e7b15c', bg: 'rgba(231,177,92,0.18)' }
  if (/lost|dead/.test(v)) return { fg: '#fca5a5', bg: 'rgba(248,113,113,0.16)' }
  return { fg: '#9FD8EC', bg: 'rgba(95,184,224,0.16)' }
}

export function OpportunityHub({ onClose }: { onClose: () => void }) {
  const [dash, setDash] = useState<Dash>({})
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<unknown | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [work, setWork] = useState<string | null>(null)

  const loadDash = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/nexus/opps/opps-dashboard', { cache: 'no-store' })
      const d = await r.json().catch(() => ({}))
      setDash(d && typeof d === 'object' ? d : {})
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { void loadDash() }, [loadDash])

  async function openDeal(id: string) {
    const r = await fetch(`/api/nexus/opps/opportunity-window/${id}`, { cache: 'no-store' })
    const d = await r.json().catch(() => null)
    if (d) setSelected(d)
  }
  // Re-fetch the OPEN deal (so edits show without a page refresh) AND the dashboard.
  async function refreshSelected() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const id = (selected as any)?.opportunity?.id
    if (id) await openDeal(String(id))
    void loadDash()
  }

  if (selected) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 92, overflowY: 'auto', background: NEXUS_BG }}>
        <NexusBackdropLayers variant="page" />
        {/* pb clears the Nexus bottom nav, which renders above this overlay because
            the overlay is nested inside main's z-10 stacking context. */}
        <div style={{ position: 'relative', paddingBottom: '160px' }} className="mx-auto max-w-5xl xl:max-w-none p-4"><OpportunityGlassWindow data={selected as never} onBack={() => setSelected(null)} onRefresh={refreshSelected} /></div>
      </div>
    )
  }
  if (work !== null) {
    return <WorkExistingDeal initialQuery={work} onBack={() => setWork(null)} onOpen={(id) => { setWork(null); void openDeal(id) }} />
  }

  const k = dash.kpis ?? { openPipeline: 0, openDeals: 0, winRate: 0, wonMtd: 0 }
  const bd = dash.breakdown ?? { survey: 0, propose: 0, negotiate: 0, contract: 0 }
  const bdTotal = bd.survey + bd.propose + bd.negotiate + bd.contract || 1
  const seg = (v: number) => (v / bdTotal) * 100
  const analysis = dash.analysis ?? []
  const fuToday = dash.followupsToday ?? []
  const fuWeek = dash.followupsWeek ?? []

  const kpiCard = (icon: string, value: string | number, label: string, accent = '#9FD8EC') => (
    <div className="rounded-2xl p-3" style={TILE_STYLE}>
      <div className="text-[16px]" aria-hidden style={{ color: accent }}>{icon}</div>
      <div className="mt-1 text-[22px] font-bold leading-none" style={{ color: '#eaf2fb' }}>{loading ? '–' : value}</div>
      <div className="mt-0.5 text-[10px]" style={{ color: '#c3d3e2' }}>{label}</div>
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, overflowY: 'auto', background: NEXUS_BG }}>
      <NexusBackdropLayers variant="page" />
      <div style={{ position: 'relative' }} className="mx-auto max-w-5xl xl:max-w-none p-4 pb-24">
        <NexusGlassBackButton label="Back to Sales" onClick={onClose} />
        <div className="mt-3 rounded-[2rem] p-5 sm:p-6" style={FRAME_STYLE}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div><div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: '#2f4a63' }}>Sales</div><h2 className="text-xl font-semibold leading-tight" style={{ color: '#152535' }}>Opportunity Hub</h2></div>
            <button type="button" onClick={() => setWork('')} className="flex items-center gap-2 rounded-xl px-3 py-2 text-[12px]" style={{ background: '#26374a', border: '1px solid rgba(140,170,200,0.25)', color: 'rgba(255,255,255,0.55)' }}><span aria-hidden style={{ color: '#9FD8EC' }}>⌕</span> Search deals…</button>
          </div>

          {/* KPI ROW */}
          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-[repeat(4,1fr)_1.6fr]">
            {kpiCard('◈', money(k.openPipeline), 'Open Pipeline', '#7ee0a8')}
            {kpiCard('◎', k.openDeals, 'Open Deals')}
            {kpiCard('◑', `${k.winRate}%`, 'Win Rate', '#7ee0a8')}
            {kpiCard('✓', k.wonMtd, 'Won MTD', '#7ee0a8')}
            <div className="col-span-2 flex items-center gap-3 rounded-2xl p-3 sm:col-span-4 lg:col-span-1" style={TILE_STYLE}>
              <div className="flex-1">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: '#9FD8EC' }}>Pipeline Breakdown</div>
                <div className="space-y-0.5 text-[11px]" style={{ color: '#c3d3e2' }}>
                  <div><span style={{ color: '#5FB8E0' }}>●</span> Survey · {bd.survey}</div>
                  <div><span style={{ color: '#3f7fb8' }}>●</span> Propose · {bd.propose}</div>
                  <div><span style={{ color: '#e7b15c' }}>●</span> Negotiate · {bd.negotiate}</div>
                  <div><span style={{ color: '#7ee0a8' }}>●</span> Contract · {bd.contract}</div>
                </div>
              </div>
              <svg viewBox="0 0 42 42" width={78} height={78} role="img" aria-label="Deal pipeline breakdown">
                <circle cx="21" cy="21" r="15.9" fill="none" stroke="#16222f" strokeWidth={7} />
                <circle cx="21" cy="21" r="15.9" fill="none" stroke="#5FB8E0" strokeWidth={7} strokeDasharray={`${seg(bd.survey).toFixed(1)} ${(100 - seg(bd.survey)).toFixed(1)}`} strokeDashoffset="0" transform="rotate(-90 21 21)" />
                <circle cx="21" cy="21" r="15.9" fill="none" stroke="#3f7fb8" strokeWidth={7} strokeDasharray={`${seg(bd.propose).toFixed(1)} ${(100 - seg(bd.propose)).toFixed(1)}`} strokeDashoffset={`${(-seg(bd.survey)).toFixed(1)}`} transform="rotate(-90 21 21)" />
                <circle cx="21" cy="21" r="15.9" fill="none" stroke="#e7b15c" strokeWidth={7} strokeDasharray={`${seg(bd.negotiate).toFixed(1)} ${(100 - seg(bd.negotiate)).toFixed(1)}`} strokeDashoffset={`${(-(seg(bd.survey) + seg(bd.propose))).toFixed(1)}`} transform="rotate(-90 21 21)" />
                <circle cx="21" cy="21" r="15.9" fill="none" stroke="#7ee0a8" strokeWidth={7} strokeDasharray={`${seg(bd.contract).toFixed(1)} ${(100 - seg(bd.contract)).toFixed(1)}`} strokeDashoffset={`${(-(seg(bd.survey) + seg(bd.propose) + seg(bd.negotiate))).toFixed(1)}`} transform="rotate(-90 21 21)" />
                <text x="21" y="23.5" textAnchor="middle" fill="#eaf2fb" fontSize="8" fontWeight="700">{k.openDeals}</text>
              </svg>
            </div>
          </div>

          {/* DEAL ANALYSIS — scrolls internally */}
          <div className="mb-3 rounded-2xl p-4" style={TILE_STYLE}>
            <div className="mb-2 text-[13px] font-semibold" style={{ color: '#eaf2fb' }}>Deal Analysis <span className="text-[10px] font-normal" style={{ color: '#7d93a8' }}>· sized data carried from the lead · tap a deal to open it</span></div>
            <div className="overflow-y-auto pr-1" style={{ maxHeight: 220 }}>
              <table className="w-full border-collapse text-[12px]">
                <thead><tr className="text-left text-[10px] uppercase tracking-[0.06em]" style={{ color: '#7d93a8' }}>
                  {['Deal', 'Stage', 'Units', 'MRR', 'EMC', 'Close', 'Next step'].map(h => <th key={h} className="sticky top-0 py-1.5" style={{ background: '#233346' }}>{h}</th>)}
                </tr></thead>
                <tbody style={{ color: '#dbeaf7' }}>
                  {loading ? (
                    <tr><td colSpan={7} className="py-6 text-center text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Loading…</td></tr>
                  ) : analysis.length === 0 ? (
                    <tr><td colSpan={7} className="py-6 text-center text-[11px]" style={{ color: 'rgba(255,255,255,0.82)' }}>No open deals yet. Convert a lead or start a new opportunity.</td></tr>
                  ) : analysis.map(row => {
                    const chip = stageChip(row.stage)
                    return (
                      <tr key={row.id} className="cursor-pointer border-b transition-colors hover:bg-white/5" style={{ borderColor: 'rgba(140,170,200,0.1)' }} onClick={() => void openDeal(row.id)}>
                        <td className="py-2 font-semibold" style={{ color: '#eaf2fb' }}>{row.name}</td>
                        <td className="py-2"><span className="rounded-full px-2 py-0.5 text-[10px]" style={{ background: chip.bg, color: chip.fg }}>{row.stage}</span></td>
                        <td className="py-2">{row.units ?? '—'}</td>
                        <td className="py-2" style={{ color: '#7ee0a8' }}>{money(row.mrr)}</td>
                        <td className="py-2">{money(row.emc)}</td>
                        <td className="py-2">{shortDate(row.close_date)}</td>
                        <td className="py-2 truncate" style={{ color: '#c3d3e2', maxWidth: 160 }}>{row.next_step || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ACTIONS + FOLLOW-UPS */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[0.85fr_2fr_2fr]">
            <div className="flex flex-col gap-3">
              <button type="button" onClick={() => setShowNew(true)} className="flex flex-1 flex-col items-center justify-center rounded-2xl p-4 text-center transition-all hover:-translate-y-0.5" style={{ background: 'linear-gradient(180deg,#3f7fb8,#2f6d94)', border: '1px solid rgba(150,200,230,0.4)', color: '#eaf6ff', minHeight: 84 }}><span className="text-[22px]" aria-hidden>＋</span><span className="mt-1 text-[12px] font-bold">New Opportunity</span></button>
              <button type="button" onClick={() => setWork('')} className="flex flex-1 flex-col items-center justify-center rounded-2xl p-4 text-center transition-all hover:-translate-y-0.5" style={{ ...TILE_STYLE, minHeight: 84 }}><span className="text-[22px]" aria-hidden style={{ color: '#9FD8EC' }}>⌕</span><span className="mt-1 text-[12px] font-bold" style={{ color: '#eaf2fb' }}>Work Existing Deal</span></button>
            </div>
            <FollowUpColumn title="Today's Follow-ups" items={fuToday} loading={loading} onOpen={() => setWork('')} />
            <FollowUpColumn title="This Week's Follow-ups" items={fuWeek} loading={loading} onOpen={() => setWork('')} />
          </div>
        </div>
      </div>

      {showNew && <NewOpportunityFlow onClose={() => setShowNew(false)} onCreated={(id) => { setShowNew(false); void openDeal(id) }} />}
    </div>
  )
}

function FollowUpColumn({ title, items, loading, onOpen }: { title: string; items: FollowUp[]; loading: boolean; onOpen: () => void }) {
  return (
    <div className="rounded-2xl p-4" style={TILE_STYLE}>
      <div className="mb-2.5 flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: '#9FD8EC' }}>{title}</div>
        <span className="text-[10px]" style={{ color: '#7d93a8' }}>{items.length}</span>
      </div>
      <div className="space-y-1.5 overflow-y-auto pr-1" style={{ maxHeight: 104 }}>
        {loading ? (
          <div className="py-4 text-center text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Loading…</div>
        ) : items.length === 0 ? (
          <div className="rounded-xl px-3 py-5 text-center text-[11px]" style={{ background: 'rgba(15,26,38,0.5)', color: 'rgba(255,255,255,0.82)' }}>Nothing due. Nice and clear.</div>
        ) : items.map(f => {
          const s = FU_STYLE[f.type]
          return (
            <button key={f.id} type="button" onClick={onOpen} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors hover:bg-white/5" style={{ background: 'rgba(15,26,38,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase" style={{ background: s.bg, color: s.fg }}>{s.label}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px]" style={{ color: '#dbeaf7' }}>{f.title}</div>
                {f.lead && <div className="truncate text-[10px]" style={{ color: '#7d93a8' }}>{f.lead}</div>}
              </div>
              <span className="shrink-0 text-[10px]" style={{ color: '#7d93a8' }}>{dueLabel(f.due)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// "Work Existing Deal" — one popup: search + a dropdown of deals → opens the deal window.
function WorkExistingDeal({ initialQuery, onBack, onOpen }: { initialQuery: string; onBack: () => void; onOpen: (id: string) => void }) {
  const [q, setQ] = useState(initialQuery)
  const [rows, setRows] = useState<WbOpp[]>([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(async (query: string) => {
    setLoading(true)
    try {
      const url = query.trim() ? `/api/nexus/opps/workbench?q=${encodeURIComponent(query)}` : '/api/nexus/opps/workbench'
      const r = await fetch(url, { cache: 'no-store' })
      const d = await r.json().catch(() => ({}))
      setRows(query.trim() ? (Array.isArray(d?.opportunities) ? d.opportunities : []) : (Array.isArray(d?.openOpportunities) ? d.openOpportunities : []))
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load(initialQuery) }, [load, initialQuery])

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 p-4" onClick={onBack}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-lg rounded-3xl p-5" style={{ background: 'repeating-linear-gradient(90deg,rgba(255,255,255,0.04) 0 1px,transparent 1px 4px), linear-gradient(180deg,#2b3c52,#1e2a3a)', border: '1px solid rgba(140,170,200,0.3)', boxShadow: '0 30px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.16)' }}>
        <div className="mb-1 text-[10px] uppercase tracking-[0.2em]" style={{ color: '#9FD8EC' }}>Work Existing Deal</div>
        <h3 className="mb-3 text-lg font-semibold" style={{ color: 'rgba(255,255,255,0.96)' }}>Pick a deal to work</h3>
        <div className="mb-2 flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'linear-gradient(180deg,#1b2836,#141e29)', border: '1px solid rgba(140,170,200,0.22)', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.45)' }}>
          <span aria-hidden style={{ color: '#9FD8EC' }}>⌕</span>
          <input autoFocus value={q} onChange={e => { setQ(e.target.value); void load(e.target.value) }} placeholder="Search deals by name, account…" className="w-full bg-transparent text-[13px] outline-none placeholder:text-white/35" style={{ color: 'rgba(255,255,255,0.92)' }} />
        </div>
        <div className="overflow-y-auto rounded-xl" style={{ maxHeight: 300, border: '1px solid rgba(140,170,200,0.18)' }}>
          {loading ? (
            <div className="py-8 text-center text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Loading…</div>
          ) : rows.length === 0 ? (
            <div className="py-8 text-center text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>No deals found.</div>
          ) : rows.map(o => (
            <button key={o.id} type="button" onClick={() => onOpen(o.id)} className="flex w-full items-center gap-3 border-b px-3 py-2.5 text-left transition-colors hover:bg-white/5" style={{ borderColor: 'rgba(140,170,200,0.1)' }}>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold" style={{ background: '#2f7fb8', color: '#eaf6ff' }}>{initials(o.name ?? o.account_name)}</div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold" style={{ color: '#eaf2fb' }}>{o.name || o.account_name || 'Untitled deal'}</div>
                <div className="truncate text-[10px]" style={{ color: '#c3d3e2' }}>{[o.account_name, o.stage, o.est_mrr != null ? `${money(o.est_mrr)}/mo` : null].filter(Boolean).join(' · ') || '—'}</div>
              </div>
              <span className="shrink-0 text-[10px]" style={{ color: '#7d93a8' }}>{relTime(o.updated_at)}</span>
            </button>
          ))}
        </div>
        <div className="mt-4 flex justify-end"><button type="button" onClick={onBack} className="rounded-xl px-4 py-2 text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>Cancel</button></div>
      </div>
    </div>
  )
}
