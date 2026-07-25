'use client'

/**
 * LeadsHub — the tactical-steel Leads cockpit (CRMX layout).
 * KPI row + Identified/Contacted/Sent-Info donut, an editable + scrolling
 * Lead Analysis table (sizing carries to the opportunity on convert), and a
 * bottom row: stacked Enter New Lead / Work Existing Lead + two scrolling
 * typed follow-up columns (call/email/visit/task). Full Lead + Opportunity
 * windows open over it. Conversion is real — computed from leads that carry a
 * real opportunity_id (converted) over the full worked set.
 * Reads /api/nexus/opps/leads-dashboard + workbench.
 */
import { useCallback, useEffect, useState } from 'react'
import { NEXUS_BG, NexusBackdropLayers } from '@/components/nexus/NexusBackdrop'
import { NexusGlassBackButton } from '@/components/nexus/NexusGlassBackButton'
import { LeadGlassWindow } from '@/components/nexus/windows/LeadGlassWindow'
import { OpportunityGlassWindow } from '@/components/nexus/windows/OpportunityGlassWindow'

type AnalysisRow = { id: string; name: string; lead_type: string | null; units: number | null; entry_points: number | null; cameras: number | null; mrr: number | null; pcr: number | null }
type FollowUp = { id: string; type: 'call' | 'email' | 'visit' | 'task'; title: string; lead: string | null; due: string | null }
type Dash = {
  kpis?: { newLeadIds: number; leadsVisited: number; leadsCount: number; conversionPct: number }
  breakdown?: { identified: number; contacted: number; sentInfo: number }
  analysis?: AnalysisRow[]
  followupsToday?: FollowUp[]
  followupsWeek?: FollowUp[]
}
type WbLead = { id: string; contact_name?: string | null; company_name?: string | null; stage?: string | null; location?: string | null; source?: string | null; updated_at?: string | null }

const FRAME_STYLE = { background: 'repeating-linear-gradient(90deg,rgba(255,255,255,0.05) 0 1px,transparent 1px 4px), linear-gradient(180deg,#5a6c84,#45556a)', border: '1px solid rgba(10,16,24,0.4)', boxShadow: '0 26px 54px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -2px 2px rgba(0,0,0,0.4)' } as const
const TILE = 'repeating-linear-gradient(90deg,rgba(255,255,255,0.04) 0 1px,transparent 1px 4px), linear-gradient(180deg,#2b3c52,#1e2a3a)'
const TILE_STYLE = { background: TILE, border: '1px solid rgba(140,170,200,0.22)', boxShadow: '0 14px 30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.14)' } as const
const CELL_INPUT = { background: '#0f1a26', border: '1px solid rgba(95,184,224,0.5)', color: '#fff', borderRadius: 6, padding: '2px 6px', width: 74, fontSize: 12, outline: 'none' } as const

const LEAD_TYPES = ['MDU', 'SFH', 'Commercial', 'Mixed-Use', 'Gated', 'HOA']
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
  const ms = Date.now() - new Date(iso).getTime()
  const h = Math.floor(ms / 3.6e6)
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

export function LeadsHub({ onClose }: { onClose: () => void }) {
  const [dash, setDash] = useState<Dash>({})
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<unknown | null>(null)
  const [oppData, setOppData] = useState<unknown | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [work, setWork] = useState<string | null>(null)
  const [edit, setEdit] = useState<{ id: string; field: keyof AnalysisRow; value: string } | null>(null)
  const [savingCell, setSavingCell] = useState(false)

  const loadDash = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/nexus/opps/leads-dashboard', { cache: 'no-store' })
      const d = await r.json().catch(() => ({}))
      setDash(d && typeof d === 'object' ? d : {})
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { void loadDash() }, [loadDash])

  async function openLead(id: string) {
    const r = await fetch(`/api/nexus/opps/lead-window/${id}`, { cache: 'no-store' })
    const d = await r.json().catch(() => null)
    if (d) setSelected(d)
  }
  async function openOpportunity(id: string) {
    const r = await fetch(`/api/nexus/opps/opportunity-window/${id}`, { cache: 'no-store' })
    const d = await r.json().catch(() => null)
    if (d) { setSelected(null); setOppData(d) }
  }
  async function refreshSelected() {
    await loadDash()
    const cur = selected as { lead?: { id?: string } } | null
    const id = cur?.lead?.id
    if (id) { const r = await fetch(`/api/nexus/opps/lead-window/${id}`, { cache: 'no-store' }); const d = await r.json().catch(() => null); if (d) setSelected(d) }
  }

  const FIELD_TO_BODY: Record<string, string> = { lead_type: 'lead_type', units: 'unit_count', entry_points: 'entry_points', cameras: 'cameras', mrr: 'mrr', pcr: 'pcr' }
  async function saveCell() {
    if (!edit) return
    setSavingCell(true)
    try {
      const bodyKey = FIELD_TO_BODY[edit.field]
      await fetch(`/api/nexus/opps/lead-window/${edit.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update_details', [bodyKey]: edit.value }) })
      setEdit(null)
      await loadDash()
    } finally { setSavingCell(false) }
  }

  if (oppData) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 92, overflowY: 'auto', background: NEXUS_BG }}>
        <NexusBackdropLayers variant="page" />
        <div style={{ position: 'relative' }} className="mx-auto max-w-6xl p-4"><OpportunityGlassWindow data={oppData as never} onBack={() => setOppData(null)} onRefresh={loadDash} /></div>
      </div>
    )
  }
  if (selected) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 92, overflowY: 'auto', background: NEXUS_BG }}>
        <NexusBackdropLayers variant="page" />
        <div style={{ position: 'relative' }} className="mx-auto max-w-6xl p-4"><LeadGlassWindow data={selected as never} onBack={() => setSelected(null)} onRefresh={refreshSelected} onOpenOpportunity={openOpportunity} /></div>
      </div>
    )
  }
  if (work !== null) {
    return <WorkExistingLead initialQuery={work} onBack={() => setWork(null)} onOpen={openLead} />
  }

  const k = dash.kpis ?? { newLeadIds: 0, leadsVisited: 0, leadsCount: 0, conversionPct: 0 }
  const bd = dash.breakdown ?? { identified: 0, contacted: 0, sentInfo: 0 }
  const bdTotal = bd.identified + bd.contacted + bd.sentInfo || 1
  const seg = (v: number) => (v / bdTotal) * 100
  const analysis = dash.analysis ?? []
  const fuToday = dash.followupsToday ?? []
  const fuWeek = dash.followupsWeek ?? []

  const kpiCard = (icon: string, value: string | number, label: string, accent = '#9FD8EC') => (
    <div className="rounded-2xl p-3" style={TILE_STYLE}>
      <div className="text-[16px]" aria-hidden style={{ color: accent }}>{icon}</div>
      <div className="mt-1 text-[22px] font-bold leading-none" style={{ color: '#eaf2fb' }}>{loading ? '–' : value}</div>
      <div className="mt-0.5 text-[10px]" style={{ color: '#98abbd' }}>{label}</div>
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, overflowY: 'auto', background: NEXUS_BG }}>
      <NexusBackdropLayers variant="page" />
      <div style={{ position: 'relative' }} className="mx-auto max-w-6xl p-4 pb-24">
        <NexusGlassBackButton label="Back to Sales" onClick={onClose} />
        <div className="mt-3 rounded-[2rem] p-5 sm:p-6" style={FRAME_STYLE}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div><div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: '#2f4a63' }}>Sales</div><h2 className="text-xl font-semibold leading-tight" style={{ color: '#152535' }}>Leads Hub</h2></div>
            <button type="button" onClick={() => setWork('')} className="flex items-center gap-2 rounded-xl px-3 py-2 text-[12px]" style={{ background: '#26374a', border: '1px solid rgba(140,170,200,0.25)', color: 'rgba(255,255,255,0.55)' }}><span aria-hidden style={{ color: '#9FD8EC' }}>⌕</span> Search leads…</button>
          </div>

          {/* KPI ROW */}
          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-[repeat(4,1fr)_1.6fr]">
            {kpiCard('⊕', k.newLeadIds, 'New Lead IDs')}
            {kpiCard('◎', k.leadsVisited, 'Leads Visited')}
            {kpiCard('☰', k.leadsCount, 'Leads Count')}
            {kpiCard('◑', `${k.conversionPct}%`, 'Conversion', '#7ee0a8')}
            <div className="col-span-2 flex items-center gap-3 rounded-2xl p-3 sm:col-span-4 lg:col-span-1" style={TILE_STYLE}>
              <div className="flex-1">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: '#9FD8EC' }}>Pipeline Breakdown</div>
                <div className="space-y-0.5 text-[11px]" style={{ color: '#c3d3e2' }}>
                  <div><span style={{ color: '#5FB8E0' }}>●</span> Identified · {bd.identified}</div>
                  <div><span style={{ color: '#3f7fb8' }}>●</span> Contacted · {bd.contacted}</div>
                  <div><span style={{ color: '#7ee0a8' }}>●</span> Sent Info · {bd.sentInfo}</div>
                </div>
              </div>
              <svg viewBox="0 0 42 42" width={78} height={78} role="img" aria-label="Lead pipeline breakdown">
                <circle cx="21" cy="21" r="15.9" fill="none" stroke="#16222f" strokeWidth={7} />
                <circle cx="21" cy="21" r="15.9" fill="none" stroke="#5FB8E0" strokeWidth={7} strokeDasharray={`${seg(bd.identified).toFixed(1)} ${(100 - seg(bd.identified)).toFixed(1)}`} strokeDashoffset="0" transform="rotate(-90 21 21)" />
                <circle cx="21" cy="21" r="15.9" fill="none" stroke="#3f7fb8" strokeWidth={7} strokeDasharray={`${seg(bd.contacted).toFixed(1)} ${(100 - seg(bd.contacted)).toFixed(1)}`} strokeDashoffset={`${(-seg(bd.identified)).toFixed(1)}`} transform="rotate(-90 21 21)" />
                <circle cx="21" cy="21" r="15.9" fill="none" stroke="#7ee0a8" strokeWidth={7} strokeDasharray={`${seg(bd.sentInfo).toFixed(1)} ${(100 - seg(bd.sentInfo)).toFixed(1)}`} strokeDashoffset={`${(-(seg(bd.identified) + seg(bd.contacted))).toFixed(1)}`} transform="rotate(-90 21 21)" />
                <text x="21" y="23.5" textAnchor="middle" fill="#eaf2fb" fontSize="8" fontWeight="700">{k.leadsCount}</text>
              </svg>
            </div>
          </div>

          {/* LEAD ANALYSIS — editable, scrolls internally */}
          <div className="mb-3 rounded-2xl p-4" style={TILE_STYLE}>
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[13px] font-semibold" style={{ color: '#eaf2fb' }}>Lead Analysis <span className="text-[10px] font-normal" style={{ color: '#7d93a8' }}>· tap a cell to edit · carries to the opportunity on convert</span></div>
            </div>
            <div className="overflow-y-auto pr-1" style={{ maxHeight: 200 }}>
              <table className="w-full border-collapse text-[12px]">
                <thead><tr className="text-left text-[10px] uppercase tracking-[0.06em]" style={{ color: '#7d93a8' }}>
                  <th className="sticky top-0 py-1.5" style={{ background: '#233346' }}>Lead</th>
                  {(['lead_type', 'units', 'entry_points', 'cameras', 'mrr', 'pcr'] as const).map(h => (
                    <th key={h} className="sticky top-0 py-1.5" style={{ background: '#233346' }}>{({ lead_type: 'Type', units: 'Units', entry_points: 'Entry Points', cameras: 'Cams', mrr: 'MRR', pcr: 'PCR' } as Record<string, string>)[h]}</th>
                  ))}
                </tr></thead>
                <tbody style={{ color: '#dbeaf7' }}>
                  {loading ? (
                    <tr><td colSpan={7} className="py-6 text-center text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Loading…</td></tr>
                  ) : analysis.length === 0 ? (
                    <tr><td colSpan={7} className="py-6 text-center text-[11px]" style={{ color: 'rgba(255,255,255,0.45)' }}>No open leads yet. Enter a new lead below.</td></tr>
                  ) : analysis.map(row => (
                    <tr key={row.id} className="border-b" style={{ borderColor: 'rgba(140,170,200,0.1)' }}>
                      <td className="cursor-pointer py-2 font-semibold" onClick={() => void openLead(row.id)} style={{ color: '#eaf2fb' }}>{row.name}</td>
                      {(['lead_type', 'units', 'entry_points', 'cameras', 'mrr', 'pcr'] as const).map(field => {
                        const editing = edit && edit.id === row.id && edit.field === field
                        const raw = row[field]
                        const display = field === 'mrr' || field === 'pcr' ? money(raw as number | null) : (raw ?? '—')
                        return (
                          <td key={field} className="py-2" onClick={() => { if (!editing) setEdit({ id: row.id, field, value: raw == null ? '' : String(raw) }) }}>
                            {editing ? (
                              field === 'lead_type' ? (
                                <select autoFocus value={edit.value} onChange={e => setEdit({ ...edit, value: e.target.value })} onBlur={() => void saveCell()} style={CELL_INPUT}>
                                  <option value="">—</option>{LEAD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                              ) : (
                                <input autoFocus value={edit.value} disabled={savingCell} onChange={e => setEdit({ ...edit, value: e.target.value })} onBlur={() => void saveCell()} onKeyDown={e => { if (e.key === 'Enter') void saveCell(); if (e.key === 'Escape') setEdit(null) }} inputMode={field === 'mrr' || field === 'pcr' ? 'decimal' : 'numeric'} style={CELL_INPUT} />
                              )
                            ) : (
                              <span className="rounded px-1.5 py-0.5 transition-colors hover:bg-white/5" style={{ color: raw == null ? '#7d93a8' : (field === 'mrr' ? '#7ee0a8' : '#dbeaf7') }}>{display}</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ACTIONS + FOLLOW-UPS */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[0.85fr_2fr_2fr]">
            <div className="flex flex-col gap-3">
              <button type="button" onClick={() => setShowNew(true)} className="flex flex-1 flex-col items-center justify-center rounded-2xl p-4 text-center transition-all hover:-translate-y-0.5" style={{ background: 'linear-gradient(180deg,#3f7fb8,#2f6d94)', border: '1px solid rgba(150,200,230,0.4)', color: '#eaf6ff', minHeight: 84 }}><span className="text-[22px]" aria-hidden>＋</span><span className="mt-1 text-[12px] font-bold">Enter New Lead</span></button>
              <button type="button" onClick={() => setWork('')} className="flex flex-1 flex-col items-center justify-center rounded-2xl p-4 text-center transition-all hover:-translate-y-0.5" style={{ ...TILE_STYLE, minHeight: 84 }}><span className="text-[22px]" aria-hidden style={{ color: '#9FD8EC' }}>⌕</span><span className="mt-1 text-[12px] font-bold" style={{ color: '#eaf2fb' }}>Work Existing Lead</span></button>
            </div>
            <FollowUpColumn title="Today's Follow-ups" items={fuToday} loading={loading} onOpen={() => setWork('')} />
            <FollowUpColumn title="This Week's Follow-ups" items={fuWeek} loading={loading} onOpen={() => setWork('')} />
          </div>
        </div>
      </div>

      {showNew && <NewLeadModal onClose={() => setShowNew(false)} onCreated={async (id) => { setShowNew(false); await loadDash(); await openLead(id) }} />}
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
      <div className="space-y-1.5 overflow-y-auto pr-1" style={{ maxHeight: 168 }}>
        {loading ? (
          <div className="py-4 text-center text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Loading…</div>
        ) : items.length === 0 ? (
          <div className="rounded-xl px-3 py-5 text-center text-[11px]" style={{ background: 'rgba(15,26,38,0.5)', color: 'rgba(255,255,255,0.45)' }}>Nothing due. Nice and clear.</div>
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

// "Work Existing Lead" — search + open-leads list, opens the Lead window.
function WorkExistingLead({ initialQuery, onBack, onOpen }: { initialQuery: string; onBack: () => void; onOpen: (id: string) => void }) {
  const [q, setQ] = useState(initialQuery)
  const [rows, setRows] = useState<WbLead[]>([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(async (query: string) => {
    setLoading(true)
    try {
      const url = query.trim() ? `/api/nexus/opps/workbench?q=${encodeURIComponent(query)}` : '/api/nexus/opps/workbench'
      const r = await fetch(url, { cache: 'no-store' })
      const d = await r.json().catch(() => ({}))
      setRows(query.trim() ? (Array.isArray(d?.leads) ? d.leads : []) : (Array.isArray(d?.openLeads) ? d.openLeads : []))
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load(initialQuery) }, [load, initialQuery])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 91, overflowY: 'auto', background: NEXUS_BG }}>
      <NexusBackdropLayers variant="page" />
      <div style={{ position: 'relative' }} className="mx-auto max-w-4xl p-4 pb-24">
        <NexusGlassBackButton label="Back to Leads Hub" onClick={onBack} />
        <div className="mt-3 rounded-[2rem] p-5" style={FRAME_STYLE}>
          <h2 className="mb-3 text-xl font-semibold" style={{ color: '#152535' }}>Work Existing Lead</h2>
          <div className="mb-4 flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: '#26374a', border: '1px solid rgba(140,170,200,0.25)' }}>
            <span aria-hidden style={{ color: '#9FD8EC' }}>⌕</span>
            <input autoFocus value={q} onChange={e => { setQ(e.target.value); void load(e.target.value) }} placeholder="Search by name, company, location, email…" className="w-full bg-transparent text-[13px] outline-none placeholder:text-white/35" style={{ color: 'rgba(255,255,255,0.9)' }} />
          </div>
          {loading ? (
            <div className="py-10 text-center text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Loading…</div>
          ) : rows.length === 0 ? (
            <div className="rounded-2xl px-4 py-10 text-center text-xs" style={{ background: TILE, border: '1px solid rgba(140,170,200,0.2)', color: 'rgba(255,255,255,0.5)' }}>No leads found.</div>
          ) : (
            <div className="space-y-2">
              {rows.map(l => (
                <button key={l.id} type="button" onClick={() => onOpen(l.id)} className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-all hover:-translate-y-0.5" style={TILE_STYLE}>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-bold" style={{ background: '#2f7fb8', color: '#eaf6ff' }}>{initials(l.contact_name ?? l.company_name)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-semibold" style={{ color: '#eaf2fb' }}>{l.company_name || l.contact_name || 'Unnamed lead'}</div>
                    <div className="truncate text-[11px]" style={{ color: '#98abbd' }}>{[l.contact_name, l.location, l.stage].filter(Boolean).join(' · ') || '—'}</div>
                  </div>
                  <span className="shrink-0 text-[10px]" style={{ color: '#7d93a8' }}>{relTime(l.updated_at)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// New Lead modal → POST /api/crm/leads
function NewLeadModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [f, setF] = useState({ name: '', company: '', email: '', phone: '', location: '', source: 'phone' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const set = (key: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF(p => ({ ...p, [key]: e.target.value }))
  async function save() {
    if (!f.name.trim()) { setErr('A contact or property name is required.'); return }
    setBusy(true); setErr(null)
    try {
      const res = await fetch('/api/crm/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: f.name, company: f.company, email: f.email, phone: f.phone, city: f.location, source: f.source }) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || !d?.id) throw new Error(d?.error || 'Could not create the lead.')
      onCreated(d.id)
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not create the lead.'); setBusy(false) }
  }
  const input = 'w-full rounded-xl px-3 py-2 text-sm outline-none'
  const inStyle = { background: '#0f1a26', border: '1px solid rgba(140,170,200,0.25)', color: 'rgba(255,255,255,0.9)' } as const
  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-3xl p-5" style={{ background: 'linear-gradient(180deg,#26374a,#1e2c3c)', border: '1px solid rgba(150,180,210,0.32)', boxShadow: '0 30px 80px rgba(0,0,0,0.5)' }}>
        <div className="mb-1 text-[10px] uppercase tracking-[0.2em]" style={{ color: '#9FD8EC' }}>New Lead</div>
        <h3 className="mb-4 text-lg font-semibold" style={{ color: 'rgba(255,255,255,0.96)' }}>Add a lead</h3>
        <div className="space-y-2.5">
          <input className={input} style={inStyle} placeholder="Property or contact name *" value={f.name} onChange={set('name')} />
          <input className={input} style={inStyle} placeholder="Company / management co." value={f.company} onChange={set('company')} />
          <div className="grid grid-cols-2 gap-2.5">
            <input className={input} style={inStyle} placeholder="Email" value={f.email} onChange={set('email')} />
            <input className={input} style={inStyle} placeholder="Phone" value={f.phone} onChange={set('phone')} />
          </div>
          <input className={input} style={inStyle} placeholder="City / location" value={f.location} onChange={set('location')} />
          <select className={input} style={inStyle} value={f.source} onChange={set('source')}>
            <option value="phone">Phone</option><option value="walk_in">Walk-in</option><option value="website">Website</option><option value="referral">Referral</option><option value="aria">ARIA research</option><option value="outbound">Cold call / field</option>
          </select>
        </div>
        {err && <div className="mt-3 rounded-xl px-3 py-2 text-xs" style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)', color: '#fca5a5' }}>{err}</div>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>Cancel</button>
          <button type="button" onClick={() => void save()} disabled={busy} className="rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-40" style={{ background: 'linear-gradient(180deg,#3f7fb8,#2f6d94)', border: '1px solid rgba(150,200,230,0.4)', color: '#eaf6ff' }}>{busy ? 'Saving…' : 'Create lead'}</button>
        </div>
      </div>
    </div>
  )
}
