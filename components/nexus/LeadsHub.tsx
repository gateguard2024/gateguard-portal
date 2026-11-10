'use client'

/**
 * LeadsHub — Nexus Leads (same navy frame + light sheet as Nexus Mail).
 *
 * Built to beat HubSpot / Pipedrive / Close at the things that matter for Gate Guard:
 *   • Every lead is scored 0–100 (size, reachability, stage, how recently touched) with
 *     the reasons shown, so you work the right ones first.
 *   • Every lead shows its NEXT STEP — and leads with none (or overdue) are called out.
 *   • Speed to lead, pipeline $/mo and conversion at the top.
 *   • Views: Hot, No next step, Overdue, New, Stale, by stage, Mine.
 *   • List or Board (drag a card to change stage, or onto "Deal" to convert).
 *   • Lead panel: call / email / text, log a call in two taps, follow-up chips,
 *     sizing → est. MRR, timeline, their emails from Nexus Mail, ARIA research.
 * Reads /api/nexus/leads; actions go through /api/nexus/opps/lead-window/[id].
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Search, Plus, X, Loader2, Phone, Mail, Filter, RefreshCw } from 'lucide-react'
import { M, N } from '@/components/nexus/mail/mailShared'
import { LeadPanel } from '@/components/nexus/leads/LeadPanel'
import { NewLeadModal, FoundRow, type FoundLead } from '@/components/nexus/leads/NewLeadModal'
import { DealPage } from '@/components/nexus/sales/DealPage'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { ArrowLeft, Flame, Clock: ClockI, AlarmClock, Sparkles, Users: UsersI, Inbox, Snowflake, LayoutList, LayoutGrid, UserCheck, Send, Target, TrendingUp: Trend } = require('lucide-react') as any

export type LeadRow = {
  id: string; name: string; company: string | null; property: string | null; contact: string | null; title: string | null
  email: string | null; phone: string | null; location: string | null; stage: string | null; bucket: 'identified' | 'contacted' | 'sent_info'
  source: string | null; lead_type: string | null; units: number | null; cameras: number | null; entry_points: number | null; mrr: number | null
  owner_id: string | null; owner: string | null; created_at: string; last_touch: string | null; touches: number
  next_step: { title: string; due: string; kind: string } | null; overdue: boolean; score: number; why: string[]; researched: boolean
  snoozed_until?: string | null; snooze_reason?: string | null
}
type Counts = Record<'all' | 'mine' | 'new' | 'hot' | 'no_next' | 'overdue' | 'identified' | 'contacted' | 'sent_info' | 'stale' | 'snoozed', number>
type Kpis = { open: number; new_week: number; speed_hours: number | null; due_today: number; pipeline_mrr: number; conversion_pct: number; converted_90: number }
type View = keyof Counts

const VIEWS: { id: View; label: string; color: string; icon: unknown; hint: string }[] = [
  { id: 'all', label: 'All open leads', color: '#4A8CFF', icon: Inbox, hint: '' },
  { id: 'hot', label: 'Hot', color: '#FF6B3D', icon: Flame, hint: 'Score 70+' },
  { id: 'overdue', label: 'Overdue', color: '#F04438', icon: AlarmClock, hint: 'Follow-up date has passed' },
  { id: 'no_next', label: 'No next step', color: '#F5A524', icon: Target, hint: 'Nothing scheduled — set one' },
  { id: 'new', label: 'New (14 days)', color: '#22C1EE', icon: Sparkles, hint: '' },
  { id: 'mine', label: 'Mine', color: '#A78BFA', icon: UserCheck, hint: 'Assigned to you' },
  { id: 'identified', label: 'Not contacted yet', color: '#94A3B8', icon: UsersI, hint: '' },
  { id: 'contacted', label: 'Contacted', color: '#38BDF8', icon: Phone, hint: '' },
  { id: 'sent_info', label: 'Info sent', color: '#34D399', icon: Send, hint: '' },
  { id: 'stale', label: 'Gone quiet (14+ days)', color: '#8FA3B8', icon: Snowflake, hint: '' },
  { id: 'snoozed', label: 'Not now (snoozed)', color: '#64748B', icon: ClockI, hint: 'Comes back on its revisit date' },
]
const STAGES: { id: LeadRow['bucket']; label: string; color: string; set: string }[] = [
  { id: 'identified', label: 'Identified', color: '#94A3B8', set: 'new' },
  { id: 'contacted', label: 'Contacted', color: '#38BDF8', set: 'contacted' },
  { id: 'sent_info', label: 'Info sent', color: '#34D399', set: 'proposal' },
]
type Sort = 'score' | 'next' | 'recent' | 'mrr' | 'name'

export const money = (n: number | null | undefined) => n == null ? '—' : n >= 1000 ? `$${(Math.round(n / 100) / 10).toLocaleString()}k` : `$${Math.round(n).toLocaleString()}`
export const scoreColor = (s: number) => (s >= 70 ? '#FF6B3D' : s >= 40 ? '#F5A524' : '#8FA3B8')
export const scoreLabel = (s: number) => (s >= 70 ? 'Hot' : s >= 40 ? 'Warm' : 'Cold')
export function ago(iso: string | null): string {
  if (!iso) return 'never'
  const d = Math.floor((Date.now() - Date.parse(iso)) / 86400_000)
  if (d <= 0) { const h = Math.floor((Date.now() - Date.parse(iso)) / 3600_000); return h <= 0 ? 'just now' : `${h}h ago` }
  return d === 1 ? 'yesterday' : `${d}d ago`
}
export function dueText(due: string): string {
  const t = new Date(); t.setHours(0, 0, 0, 0)
  const d = new Date(`${due}T00:00:00`)
  const diff = Math.round((d.getTime() - t.getTime()) / 86400_000)
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  if (diff === -1) return 'yesterday'
  if (diff < 0) return `${-diff} days late`
  if (diff < 7) return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}
const TINTS = ['#4A8CFF', '#10B981', '#F97316', '#8B5CF6', '#06B6D4', '#EC4899', '#EAB308', '#64748B']
export const tint = (s: string) => TINTS[[...(s || '?')].reduce((a, c) => a + c.charCodeAt(0), 0) % TINTS.length]
export const initials = (s: string | null | undefined) => (s || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?'

export function LeadsHub({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<LeadRow[]>([])
  const [counts, setCounts] = useState<Counts | null>(null)
  const [kpis, setKpis] = useState<Kpis | null>(null)
  const [me, setMe] = useState<string | null>(null)
  const [canReassign, setCanReassign] = useState(false)
  const [asDeals, setAsDeals] = useState(0)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [view, setView] = useState<View>('all')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<Sort>('score')
  const [layout, setLayout] = useState<'list' | 'board'>('list')
  const [selId, setSelId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [dealId, setDealId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => { try { const v = localStorage.getItem('gg_leads_layout'); if (v === 'board' || v === 'list') setLayout(v) } catch { /* ignore */ } }, [])
  const saveLayout = (l: 'list' | 'board') => { setLayout(l); try { localStorage.setItem('gg_leads_layout', l) } catch { /* ignore */ } }
  const flash = (t: string) => { setToast(t); window.setTimeout(() => setToast((x) => (x === t ? null : x)), 3000) }

  const apply = (d: { leads?: LeadRow[]; counts?: Counts; kpis?: Kpis; me?: string; can_reassign?: boolean; hidden_as_deals?: number }) => {
    setAsDeals(d.hidden_as_deals ?? 0)
    setRows(Array.isArray(d.leads) ? d.leads : [])
    setCounts(d.counts ?? null); setKpis(d.kpis ?? null); setMe(d.me ?? null); setCanReassign(!!d.can_reassign)
  }
  // Last list from this browser shows instantly; fresh numbers replace it when they arrive.
  useEffect(() => {
    try { const c = sessionStorage.getItem('gg_leads_cache'); if (c) { apply(JSON.parse(c)); setLoading(false) } } catch { /* ignore */ }
  }, [])
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const r = await fetch('/api/nexus/leads', { cache: 'no-store' })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(d?.error ?? 'Could not load leads.'); return }
      setErr(null)
      try { sessionStorage.setItem('gg_leads_cache', JSON.stringify(d)) } catch { /* too big / private mode */ }
      apply(d)
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  const filtered = useMemo(() => {
    const now = Date.now()
    const t = q.trim().toLowerCase()
    let list = rows.filter((l) => {
      if (view === 'snoozed') return !!l.snoozed_until
      if (l.snoozed_until) return false
      switch (view) {
        case 'mine': return l.owner_id === me
        case 'new': return now - Date.parse(l.created_at) <= 14 * 86400_000
        case 'hot': return l.score >= 70
        case 'no_next': return !l.next_step
        case 'overdue': return l.overdue
        case 'identified': case 'contacted': case 'sent_info': return l.bucket === view
        case 'stale': return l.last_touch ? now - Date.parse(l.last_touch) > 14 * 86400_000 : now - Date.parse(l.created_at) > 14 * 86400_000
        default: return true
      }
    })
    if (t) list = list.filter((l) => [l.name, l.company, l.contact, l.email, l.phone, l.location, l.source, l.owner].some((v) => String(v ?? '').toLowerCase().includes(t)))
    const by: Record<Sort, (a: LeadRow, b: LeadRow) => number> = {
      score: (a, b) => b.score - a.score,
      next: (a, b) => (a.next_step?.due ?? '9999').localeCompare(b.next_step?.due ?? '9999'),
      recent: (a, b) => (b.last_touch ?? b.created_at).localeCompare(a.last_touch ?? a.created_at),
      mrr: (a, b) => (b.mrr ?? 0) - (a.mrr ?? 0),
      name: (a, b) => a.name.localeCompare(b.name),
    }
    return [...list].sort(by[sort])
  }, [rows, view, q, sort, me])

  const selected = rows.find((r) => r.id === selId) ?? null

  // Search also looks past this list — lost leads, Not now, ones already a deal — so a
  // lead is never "missing" when the duplicate check says it exists.
  const [found, setFound] = useState<FoundLead[]>([])
  useEffect(() => {
    const t = q.trim()
    if (t.length < 2) { setFound([]); return }
    const h = window.setTimeout(async () => {
      const d = await fetch(`/api/nexus/leads?find=${encodeURIComponent(t)}`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
      setFound(Array.isArray(d?.matches) ? d.matches : [])
    }, 350)
    return () => window.clearTimeout(h)
  }, [q])
  const elsewhere = found.filter((m) => !filtered.some((l) => l.id === m.id))
  async function goTo(m: FoundLead) {
    setShowNew(false)
    if (m.status === 'deal' && m.opportunity_id) { setDealId(m.opportunity_id); return }
    if (m.status === 'lost') {
      const r = await fetch(`/api/nexus/opps/lead-window/${m.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update_status', stage: 'new' }) })
      if (!r.ok) { flash('Couldn’t bring that lead back.'); return }
      flash(`${m.name} is back in your leads`)
      await load(true)
    }
    setQ('')
    setView(m.status === 'snoozed' ? 'snoozed' : 'all')
    setSelId(m.id)
  }

  // Keyboard: j/k move, n new lead, / search, Esc close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return
      if (e.metaKey || e.ctrlKey || showNew) return
      const i = filtered.findIndex((r) => r.id === selId)
      if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); const r = filtered[Math.min(filtered.length - 1, i + 1)]; if (r) setSelId(r.id) }
      if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); const r = filtered[Math.max(0, i - 1)]; if (r) setSelId(r.id) }
      if (e.key === 'n') { e.preventDefault(); setShowNew(true) }
      if (e.key === '/') { e.preventDefault(); searchRef.current?.focus() }
      if (e.key === 'Escape') setSelId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [filtered, selId, showNew])

  async function moveStage(id: string, to: LeadRow['bucket'] | 'deal') {
    const lead = rows.find((r) => r.id === id)
    if (!lead) return
    if (to === 'deal') { await convert(id); return }
    if (lead.bucket === to) return
    const before = rows
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, bucket: to } : r)))
    const r = await fetch(`/api/nexus/opps/lead-window/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update_status', stage: STAGES.find((s) => s.id === to)!.set }) })
    if (!r.ok) { setRows(before); flash('Couldn’t move that lead.'); return }
    flash(`Moved to ${STAGES.find((s) => s.id === to)!.label}`)
    void load(true)
  }
  async function convert(id: string) {
    const r = await fetch(`/api/nexus/opps/lead-window/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create_opportunity' }) })
    const d = await r.json().catch(() => ({}))
    if (!r.ok || !d?.opportunityId) { flash(d?.message ?? 'Couldn’t make the deal.'); return }
    flash(d.existing ? 'Already a deal — opening it' : 'Lead converted — opening the deal')
    setSelId(null)
    setDealId(String(d.opportunityId))
    void load(true)
  }

  if (dealId) return <DealPage dealId={dealId} onClose={() => { setDealId(null); void load(true) }} />

  const kpi = (label: string, value: string, sub: string, color: string, icon: React.ReactNode) => (
    <div style={{ flex: '1 1 150px', minWidth: 140, boxSizing: 'border-box', background: '#fff', border: `1px solid ${N.cardLine}`, borderRadius: 14, boxShadow: N.cardShadow, padding: '12px 14px', display: 'flex', gap: 11, alignItems: 'center' }}>
      <span aria-hidden style={{ width: 36, height: 36, borderRadius: 10, background: `${color}1C`, color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 20, fontWeight: 650, color: M.ink, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{!kpis ? '–' : value}</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: M.ink2, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: M.ink3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
      </div>
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, display: 'flex', flexDirection: 'column', background: N.bg, color: N.ink, fontFamily: M.font }}>
      {/* top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderBottom: `1px solid ${N.line}`, flexWrap: 'wrap' }}>
        <button type="button" onClick={onClose} className="hover:bg-white/[0.08]" style={navBtnLg}><ArrowLeft size={14} /> Back to Sales</button>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, marginLeft: 6 }}>
          <span aria-hidden style={{ width: 28, height: 28, borderRadius: 8, background: N.brand, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 6px 16px -6px rgba(74,140,255,0.7)' }}><Target size={15} /></span>
          <span style={{ fontSize: 16, fontWeight: 650, color: '#fff', letterSpacing: '-0.01em' }}>Leads</span>
          <span className="hidden sm:inline" style={{ fontSize: 11, color: N.label, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Nexus</span>
        </span>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={() => void load()} className="hover:bg-white/[0.08]" style={navBtnLg} aria-label="Refresh">{loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}</button>
        <button type="button" onClick={() => setShowNew(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13.5, fontWeight: 600, color: '#fff', background: N.brand, border: 0, borderRadius: 10, padding: '8px 14px', cursor: 'pointer', boxShadow: '0 8px 20px -10px rgba(74,140,255,0.9)', fontFamily: M.font }}>
          <Plus size={15} /> New lead
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {/* views */}
        <nav aria-label="Lead views" className="hidden lg:flex" style={{ width: 236, flexShrink: 0, flexDirection: 'column', borderRight: `1px solid ${N.line}`, padding: '12px 10px', overflowY: 'auto' }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase', color: N.label, padding: '4px 10px 6px' }}>Work these</div>
          {VIEWS.map((v, i) => {
            const on = view === v.id
            const Icon = v.icon as React.ComponentType<{ size?: number }>
            const c = counts?.[v.id] ?? 0
            return (
              <React.Fragment key={v.id}>
                {i === 10 && <div style={{ height: 10 }} />}
                {i === 6 && <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase', color: N.label, padding: '14px 10px 6px' }}>By stage</div>}
                <button type="button" onClick={() => setView(v.id)} title={v.hint || undefined} aria-current={on ? 'page' : undefined} className={on ? '' : 'hover:bg-white/[0.06]'}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', marginBottom: 2, borderRadius: 9, border: 0, cursor: 'pointer', background: on ? N.sel : 'transparent', boxShadow: on ? `inset 3px 0 0 ${v.color}` : undefined, color: on ? '#fff' : N.ink, fontFamily: M.font, fontSize: 13.5, fontWeight: on ? 600 : 500, textAlign: 'left' }}>
                  <span aria-hidden style={{ width: 26, height: 26, borderRadius: 8, background: `${v.color}26`, color: v.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={15} /></span>
                  <span style={{ flex: 1 }}>{v.label}</span>
                  {c > 0 && <span style={{ fontSize: 11.5, fontWeight: 600, minWidth: 22, textAlign: 'center', padding: '1px 7px', borderRadius: 20, background: (v.id === 'overdue' || v.id === 'no_next') && c ? `${v.color}` : v.id === 'all' ? N.accent : N.pill, color: '#fff' }}>{c}</span>}
                </button>
              </React.Fragment>
            )
          })}
          <div style={{ marginTop: 'auto', padding: '14px 10px 4px', fontSize: 11.5, color: N.ink2, lineHeight: 1.6 }}>
            <b style={{ color: '#fff' }}>Score</b> = size + can we reach them + stage + how recently touched. Work Hot and Overdue first.
            <div style={{ marginTop: 6, color: N.label }}>j / k move · n new · / search</div>
          </div>
        </nav>

        {/* sheet */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', background: N.canvas }} className="lg:rounded-tl-[14px]">
          <section aria-label="Leads" style={{ flex: 1, minWidth: 0, flexDirection: 'column', minHeight: 0 }} className={selected ? 'hidden xl:flex' : 'flex'}>
            {/* numbers */}
            <div style={{ display: 'flex', gap: 10, padding: '14px 14px 4px', flexWrap: 'wrap' }}>
              {kpi('Open leads', String(kpis?.open ?? 0), `${kpis?.new_week ?? 0} new this week`, '#4A8CFF', <Inbox size={18} />)}
              {kpi('Speed to lead', kpis?.speed_hours == null ? '—' : kpis.speed_hours < 24 ? `${kpis.speed_hours}h` : `${Math.round(kpis.speed_hours / 24)}d`, 'median to first contact', '#22C1EE', <ClockI size={18} />)}
              {kpi('Due today', String(kpis?.due_today ?? 0), `${counts?.overdue ?? 0} overdue`, (counts?.overdue ?? 0) > 0 ? '#F04438' : '#F5A524', <AlarmClock size={18} />)}
              {kpi('Pipeline', `${money(kpis?.pipeline_mrr ?? 0)}/mo`, 'est. if all close', '#10B981', <Trend size={18} />)}
              {kpi('Conversion', `${kpis?.conversion_pct ?? 0}%`, `${kpis?.converted_90 ?? 0} deals · 90 days`, '#8B5CF6', <Target size={18} />)}
            </div>

            {/* tools */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', flexWrap: 'wrap' }}>
              <select aria-label="View" value={view} onChange={(e) => setView(e.target.value as View)} className="lg:hidden" style={selectStyle}>
                {VIEWS.map((v) => <option key={v.id} value={v.id}>{v.label} ({counts?.[v.id] ?? 0})</option>)}
              </select>
              <div style={{ flex: '1 1 220px', display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: `1px solid ${N.cardLine}`, borderRadius: 10, padding: '0 10px', boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}>
                <Search size={14} style={{ color: M.ink3 }} />
                <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search leads — name, company, phone, city…" aria-label="Search leads"
                  style={{ flex: 1, border: 0, outline: 'none', background: 'transparent', fontSize: 13.5, padding: '8px 0', color: M.ink, fontFamily: M.font }} />
                {q && <button type="button" aria-label="Clear search" onClick={() => setQ('')} style={{ border: 0, background: 'none', color: M.ink3, cursor: 'pointer', display: 'inline-flex' }}><X size={14} /></button>}
              </div>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: M.ink3 }}>
                <Filter size={13} />
                <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)} style={selectStyle}>
                  <option value="score">Best first (score)</option>
                  <option value="next">Next step date</option>
                  <option value="recent">Recently touched</option>
                  <option value="mrr">Biggest $/mo</option>
                  <option value="name">Name A–Z</option>
                </select>
              </label>
              <div role="group" aria-label="Layout" style={{ display: 'inline-flex', background: '#fff', border: `1px solid ${N.cardLine}`, borderRadius: 9, padding: 2 }}>
                {(['list', 'board'] as const).map((l) => (
                  <button key={l} type="button" onClick={() => saveLayout(l)} aria-pressed={layout === l}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 600, padding: '5px 10px', borderRadius: 7, border: 0, cursor: 'pointer', background: layout === l ? N.accent : 'transparent', color: layout === l ? '#fff' : M.ink2, fontFamily: M.font }}>
                    {l === 'list' ? <LayoutList size={14} /> : <LayoutGrid size={14} />} {l === 'list' ? 'List' : 'Board'}
                  </button>
                ))}
              </div>
            </div>

            {asDeals > 0 && <div style={{ margin: '0 14px 8px', fontSize: 12.5, color: M.ink3 }}>{asDeals} lead{asDeals === 1 ? ' is' : 's are'} already a deal — they live in Opportunities now, so they’re left out here.</div>}
            {err && <div role="alert" style={{ margin: '0 14px 8px', padding: '9px 12px', borderRadius: 10, background: '#FDECEA', color: M.red, fontSize: 13 }}>{err}</div>}

            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 4px 20px' }}>
              {loading && !rows.length ? (
                <div style={{ padding: 40, textAlign: 'center', color: M.ink3 }}><Loader2 size={20} className="animate-spin" /></div>
              ) : layout === 'list' ? (
                <>
                  {filtered.length === 0 && !(q && elsewhere.length) ? <Empty view={view} onNew={() => setShowNew(true)} /> : filtered.map((l) => (
                    <LeadCard key={l.id} l={l} selected={l.id === selId} onOpen={() => setSelId(l.id)} />
                  ))}
                  {q && elsewhere.length > 0 && (
                    <div style={{ margin: '10px', padding: '10px 14px', background: '#fff', border: `1px solid ${N.cardLine}`, borderRadius: 12, boxShadow: N.cardShadow }}>
                      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: M.ink3, marginBottom: 4 }}>Also found — not in this list</div>
                      {elsewhere.map((m) => <FoundRow key={m.id} m={m} onGo={goTo} />)}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(240px, 1fr))', gap: 10, padding: '0 10px', minWidth: 1000 }}>
                  {[...STAGES, { id: 'deal' as const, label: 'Make it a deal', color: '#8B5CF6', set: '' }].map((s) => {
                    const items = s.id === 'deal' ? [] : filtered.filter((l) => l.bucket === s.id)
                    const total = items.reduce((a, l) => a + (l.mrr ?? 0), 0)
                    return (
                      <div key={s.id} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (dragId) void moveStage(dragId, s.id as LeadRow['bucket'] | 'deal'); setDragId(null) }}
                        aria-label={`${s.label} column`}
                        style={{ background: s.id === 'deal' ? 'linear-gradient(180deg, rgba(139,92,246,0.10), rgba(74,140,255,0.06))' : 'rgba(15,23,42,0.035)', border: s.id === 'deal' ? '1.5px dashed rgba(139,92,246,0.45)' : `1px solid ${N.cardLine}`, borderRadius: 14, padding: 8, minHeight: 300 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px 10px' }}>
                          <span aria-hidden style={{ width: 8, height: 8, borderRadius: 8, background: s.color }} />
                          <span style={{ fontSize: 13, fontWeight: 650, color: M.ink }}>{s.label}</span>
                          {s.id !== 'deal' && <span style={{ fontSize: 12, color: M.ink3 }}>{items.length} · {money(total)}/mo</span>}
                        </div>
                        {s.id === 'deal'
                          ? <div style={{ padding: '30px 12px', textAlign: 'center', fontSize: 12.5, color: '#6D4FD8', lineHeight: 1.5 }}>Drag a lead here to turn it into a deal. Its sizing carries over.</div>
                          : items.map((l) => (
                            <div key={l.id} draggable onDragStart={() => setDragId(l.id)} onDragEnd={() => setDragId(null)} style={{ opacity: dragId === l.id ? 0.5 : 1 }}>
                              <LeadCard l={l} compact selected={l.id === selId} onOpen={() => setSelId(l.id)} />
                            </div>
                          ))}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </section>

          {selected && (
            <aside aria-label="Lead details" className="w-full xl:w-[460px]" style={{ flexShrink: 0, minHeight: 0, borderLeft: `1px solid ${N.cardLine}` }}>
              <LeadPanel lead={selected} canReassign={canReassign} onClose={() => setSelId(null)} onChanged={() => load(true)} onConvert={() => convert(selected.id)} onToast={flash}
                onRemoved={() => { setSelId(null); void load(true) }} onStage={(b) => moveStage(selected.id, b)} />
            </aside>
          )}
        </div>
      </div>

      {showNew && <NewLeadModal onClose={() => setShowNew(false)} onOpenExisting={(m) => void goTo(m)}
        onCreated={async (id) => { setShowNew(false); await load(true); setSelId(id); flash('Lead added') }} />}

      {toast && (
        <div role="status" aria-live="polite" style={{ position: 'fixed', left: '50%', bottom: 20, transform: 'translateX(-50%)', zIndex: 120, background: '#1D1D1F', color: '#fff', borderRadius: 10, padding: '10px 16px', fontSize: 13.5, boxShadow: '0 10px 30px rgba(0,0,0,0.25)' }}>{toast}</div>
      )}
    </div>
  )
}

function LeadCard({ l, selected, compact, onOpen }: { l: LeadRow; selected: boolean; compact?: boolean; onOpen: () => void }) {
  const t = tint(l.name)
  const sc = scoreColor(l.score)
  return (
    <button type="button" onClick={onOpen} id={`lead-${l.id}`} aria-current={selected ? 'true' : undefined}
      style={{ display: 'flex', gap: 12, width: compact ? '100%' : 'calc(100% - 20px)', margin: compact ? '0 0 8px' : '6px 10px', padding: compact ? '10px 11px' : '12px 14px', textAlign: 'left', cursor: 'pointer', fontFamily: M.font,
        background: '#fff', borderRadius: 12, border: `1px solid ${selected ? N.accent : N.cardLine}`, boxShadow: selected ? '0 0 0 3px rgba(74,140,255,0.16), 0 6px 18px -8px rgba(74,140,255,0.45)' : N.cardShadow, position: 'relative' }}>
      {l.overdue && <span aria-hidden style={{ position: 'absolute', left: 0, top: 10, bottom: 10, width: 3, borderRadius: 3, background: '#F04438' }} />}
      <span aria-hidden style={{ width: compact ? 34 : 40, height: compact ? 34 : 40, borderRadius: 40, background: `linear-gradient(140deg, ${t}, ${t}B3)`, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13.5, fontWeight: 650, flexShrink: 0, boxShadow: `0 4px 10px -4px ${t}99` }}>{initials(l.name)}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 650, color: M.ink, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{l.name}</span>
          <span title={l.why.length ? `Why: ${l.why.join(' · ')}` : undefined} aria-label={`Score ${l.score} (${scoreLabel(l.score)})`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 700, color: sc, background: `${sc}17`, borderRadius: 20, padding: '2px 8px', flexShrink: 0 }}>
            {l.score >= 70 && <Flame size={11} />}{l.score}
          </span>
        </span>
        <span style={{ display: 'block', fontSize: 12.5, color: M.ink2, marginTop: 2, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {[l.contact, l.company && l.company !== l.name ? l.company : null, l.location].filter(Boolean).join(' · ') || 'No contact yet'}
        </span>
        <span style={{ display: 'flex', gap: 5, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {l.snoozed_until
            ? <span style={{ ...chip, color: '#475569', background: '#E7ECF3' }}>Not now · back {new Date(`${l.snoozed_until}T00:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}{l.snooze_reason ? ` · ${l.snooze_reason}` : ''}</span>
            : l.next_step
            ? <span style={{ ...chip, color: l.overdue ? '#C4302B' : '#0B5CAD', background: l.overdue ? 'rgba(240,68,56,0.12)' : 'rgba(74,140,255,0.12)' }}>{l.overdue ? 'Overdue: ' : 'Next: '}{l.next_step.title} · {dueText(l.next_step.due)}</span>
            : <span style={{ ...chip, color: '#9A5B00', background: 'rgba(245,165,36,0.16)' }}>No next step</span>}
          {!compact && <span style={{ ...chip, color: STAGES.find((s) => s.id === l.bucket)!.color === '#94A3B8' ? '#5B6B80' : '#0F766E', background: '#EEF1F6' }}>{STAGES.find((s) => s.id === l.bucket)!.label}</span>}
          {l.mrr != null && <span style={{ ...chip, color: '#047857', background: 'rgba(16,185,129,0.12)' }}>{money(l.mrr)}/mo</span>}
          {!compact && l.units != null && <span style={{ ...chip }}>{l.units} units</span>}
        </span>
        {!compact && (
          <span style={{ display: 'flex', gap: 12, marginTop: 7, fontSize: 11.5, color: M.ink3, flexWrap: 'wrap' }}>
            <span>Last touch {ago(l.last_touch)}</span>
            {l.source && <span>Source: {l.source}</span>}
            {l.owner && <span>Rep: {l.owner}</span>}
            {l.phone && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Phone size={11} /> {l.phone}</span>}
            {!l.phone && l.email && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Mail size={11} /> {l.email}</span>}
          </span>
        )}
      </span>
    </button>
  )
}

function Empty({ view, onNew }: { view: View; onNew: () => void }) {
  const msg: Partial<Record<View, string>> = {
    overdue: 'Nothing overdue. Nice work.', no_next: 'Every lead has a next step.', hot: 'No hot leads right now — log calls and set follow-ups to warm them up.',
    stale: 'Nothing has gone quiet.', mine: 'No leads assigned to you yet.', snoozed: 'Nothing snoozed. Use “Not now” on a lead to park it for 3, 6 or 12 months.',
  }
  return (
    <div style={{ padding: '50px 20px', textAlign: 'center', color: M.ink3, fontSize: 13.5 }}>
      <div>{msg[view] ?? 'No leads here yet.'}</div>
      <button type="button" onClick={onNew} style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 600, color: '#fff', background: N.brand, border: 0, borderRadius: 10, padding: '9px 16px', cursor: 'pointer' }}><Plus size={15} /> New lead</button>
    </div>
  )
}

const navBtnLg: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: N.ink, background: 'rgba(255,255,255,0.05)', border: `1px solid ${N.line}`, borderRadius: 9, padding: '7px 11px', cursor: 'pointer', fontFamily: M.font }
const selectStyle: React.CSSProperties = { fontSize: 13, padding: '7px 9px', borderRadius: 9, border: `1px solid ${N.cardLine}`, background: '#fff', color: M.ink, fontFamily: M.font }
export const chip: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#5B6B80', background: '#EEF1F6', borderRadius: 6, padding: '2px 7px', whiteSpace: 'nowrap', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }
