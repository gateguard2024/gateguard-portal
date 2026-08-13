'use client'

/**
 * /quotes/[id]/build — the NEW rep/dealer proposal builder (Phase 2, Piece 1).
 *
 * Steel-themed workspace that sits ALONGSIDE the legacy editor (nothing breaks).
 * Piece 1 = the module palette + a live customer preview:
 *   - left:   toggle & reorder the interchangeable modules
 *   - center: the exact customer proposal, updating live (ProposalView, preview)
 *   - right:  quick numbers + save + links
 * Later pieces add line-item/pricing editing, the floor guard, auto-fill, send.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import ProposalView from '@/components/public/ProposalView'
import {
  resolveBlocks, moduleDef, computeTotals, computePL, estimateLineCost, MODULE_LIBRARY, OFFERING_LIBRARY,
  type ProposalBlock, type PricedLine, type ProposalBlockType, type OfferingDef,
} from '@/lib/proposal-modules'
import { GateProgramCalc, type GenLine } from '@/components/quotes/GateProgramCalc'
import { SiteVariables, EMPTY_SITE_VARS, type SiteVars } from '@/components/quotes/SiteVariables'
import { InstallCalculator } from '@/components/quotes/InstallCalculator'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Quote = Record<string, any>
const money = (n: number) => '$' + Math.round(n || 0).toLocaleString()

const FRAME = 'repeating-linear-gradient(90deg,rgba(255,255,255,0.04) 0 1px,transparent 1px 4px), linear-gradient(180deg,#2b3c52,#1e2a3a)'
const HEADER = 'linear-gradient(180deg,#33465e,#1e2a3a)'
const ACCENT = '#5FB8E0'

export default function ProposalBuilder() {
  const params = useParams()
  const id = String(params?.id ?? '')
  const [quote, setQuote] = useState<Quote | null>(null)
  const [lineItems, setLineItems] = useState<PricedLine[]>([])
  const [blocks, setBlocks] = useState<ProposalBlock[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [saved, setSaved] = useState(false)
  const [addingIn, setAddingIn] = useState<string | null>(null)
  const [sectionNames, setSectionNames] = useState<string[]>([])
  const [showCosts, setShowCosts] = useState(false)
  const [laborRate, setLaborRate] = useState(45)
  const [termMonths, setTermMonths] = useState(60)
  const [siteVars, setSiteVars] = useState<SiteVars>(EMPTY_SITE_VARS)

  useEffect(() => {
    if (!id) return
    let live = true
    fetch(`/api/quotes/${id}/public`).then(r => r.json()).then(j => {
      if (!live) return
      if (j?.error) { setErr(j.error); return }
      setQuote(j.quote); setLineItems(j.lineItems ?? []); setBlocks(resolveBlocks(j.quote))
      if (j.quote?.contract_term) setTermMonths(Number(j.quote.contract_term) || 60)
      if (j.quote?.site_vars && typeof j.quote.site_vars === 'object') setSiteVars({ ...EMPTY_SITE_VARS, ...j.quote.site_vars })
      // Seed a familiar starting structure only when the quote has no lines yet.
      if (!(j.lineItems ?? []).length) setSectionNames(['Monthly Program', 'One-Time Setup', 'Optional Upgrades'])
      // Merge INTERNAL cost/labor (never in the public payload) for the dealer P&L.
      fetch(`/api/quotes/${id}/items`).then(r => r.json()).then(ij => {
        if (!live) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cost = new Map((ij.items ?? []).map((it: any) => [it.id, { unit_cost: it.unit_cost != null ? Number(it.unit_cost) : undefined, labor_hours: it.labor_hours != null ? Number(it.labor_hours) : undefined }]))
        setLineItems(prev => prev.map(l => ({ ...l, ...(cost.get(l.id) ?? {}) })))
      }).catch(() => {})
    }).catch(() => { if (live) setErr('Could not load this quote.') })
    return () => { live = false }
  }, [id])

  const selectedSet = useMemo(() => new Set(lineItems.filter(l => l.is_optional && l.is_included).map(l => l.id)), [lineItems])
  const totals = useMemo(() => computeTotals(lineItems, selectedSet), [lineItems, selectedSet])
  const pl = useMemo(() => computePL(lineItems, selectedSet, laborRate, termMonths), [lineItems, selectedSet, laborRate, termMonths])

  const [addOpen, setAddOpen] = useState(false)
  const [offerOpen, setOfferOpen] = useState(false)
  const [calcOpen, setCalcOpen] = useState(false)
  const [installOpen, setInstallOpen] = useState(false)
  function mutate(next: ProposalBlock[]) { setBlocks(next); setDirty(true); setSaved(false) }
  function toggle(i: number) { const n = [...blocks]; n[i] = { ...n[i], enabled: !n[i].enabled }; mutate(n) }
  function remove(i: number) { const n = [...blocks]; n.splice(i, 1); mutate(n) }
  function add(type: ProposalBlockType) { mutate([...blocks, { type, enabled: true }]); setAddOpen(false) }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir; if (j < 0 || j >= blocks.length) return
    const n = [...blocks]; const t = n[i]; n[i] = n[j]; n[j] = t; mutate(n)
  }
  async function save() {
    setSaving(true)
    try {
      const r = await fetch(`/api/quotes/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ proposal_blocks: blocks }) })
      if (!r.ok) { const j = await r.json().catch(() => ({})); setErr(j?.error || 'Save failed.'); return }
      setDirty(false); setSaved(true)
    } catch { setErr('Save failed.') }
    finally { setSaving(false) }
  }

  // ── Line-item / pricing editor ──────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function apiToPriced(it: any): PricedLine {
    const qty = Number(it.qty) || 0, up = Number(it.unit_price) || 0
    return {
      id: it.id, description: it.description ?? '', qty, unitPrice: up, total: qty * up,
      recurring: !!it.is_recurring, is_optional: !!it.is_optional, is_included: it.is_included ?? true,
      section_name: it.section_name, notes: it.notes,
      unit_cost: it.unit_cost != null ? Number(it.unit_cost) : undefined,
      labor_hours: it.labor_hours != null ? Number(it.labor_hours) : undefined,
    }
  }
  function patchLocal(lineId: string, patch: Partial<PricedLine>) {
    setLineItems(prev => prev.map(l => l.id === lineId
      ? { ...l, ...patch, total: (patch.qty ?? l.qty) * (patch.unitPrice ?? l.unitPrice) }
      : l))
  }
  async function persist(lineId: string, apiPatch: Record<string, unknown>) {
    try { await fetch(`/api/quotes/${id}/items/${lineId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(apiPatch) }) } catch { /* keep optimistic */ }
  }
  async function deleteLine(lineId: string) {
    setLineItems(prev => prev.filter(l => l.id !== lineId))
    try { await fetch(`/api/quotes/${id}/items/${lineId}`, { method: 'DELETE' }) } catch { /* */ }
  }
  function toggleRecurring(l: PricedLine) { patchLocal(l.id, { recurring: !l.recurring }); persist(l.id, { is_recurring: !l.recurring }) }
  function toggleOptional(l: PricedLine) { patchLocal(l.id, { is_optional: !l.is_optional }); persist(l.id, { is_optional: !l.is_optional }) }

  // ── Named pricing sections (unlimited). A section is just a section_name on
  //    its lines; reps add/rename/remove sections and mark any line optional
  //    (client-selectable). ──
  const sectionOf = (l: PricedLine) => (l.section_name && l.section_name.trim()) || 'Services'
  const sections = (() => {
    const seen = new Set<string>(); const out: string[] = []
    for (const l of lineItems) { const s = sectionOf(l); if (!seen.has(s)) { seen.add(s); out.push(s) } }
    for (const s of sectionNames) if (!seen.has(s)) { seen.add(s); out.push(s) }
    return out
  })()
  const linesIn = (s: string) => lineItems.filter(l => sectionOf(l) === s)
  function addSection() {
    const name = typeof window !== 'undefined' ? window.prompt('New section name — e.g. Cameras, Smart Locks, Bulk Internet') : null
    if (name && name.trim()) setSectionNames(prev => [...prev, name.trim()])
  }
  // Add an OFFERING: drop its benefits/talking-points module AND seed its priced
  // section, so the rep sells the value, not just a line item.
  async function addOffering(off: OfferingDef) {
    mutate([...blocks, { type: 'offering', enabled: true, vars: { offeringId: off.id, section: off.section, kicker: off.kicker, title: off.title, benefits: off.benefits } }])
    setSectionNames(prev => prev.includes(off.section) ? prev : [...prev, off.section])
    setAddingIn(off.section)
    try {
      for (const s of (off.starter ?? [])) {
        const c = estimateLineCost({ description: s.description, is_recurring: s.is_recurring })
        const r = await fetch(`/api/quotes/${id}/items`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: s.description, qty: 1, unit_price: s.unit_price, is_recurring: s.is_recurring, is_optional: s.is_optional, section_name: off.section, item_type: 'service', unit_cost: c.unit_cost, labor_hours: c.labor_hours }),
        })
        const j = await r.json().catch(() => ({}))
        if (r.ok && j?.item) setLineItems(prev => [...prev, apiToPriced(j.item)])
      }
    } finally { setAddingIn(null); setOfferOpen(false) }
  }
  async function addLine(section: string, opts?: { optional?: boolean }) {
    setAddingIn(section); setErr(null)
    try {
      const c = estimateLineCost({ description: 'New line', is_recurring: true })
      const r = await fetch(`/api/quotes/${id}/items`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: 'New line', qty: 1, unit_price: 0, is_recurring: true, is_optional: !!opts?.optional, section_name: section, item_type: 'service', unit_cost: c.unit_cost, labor_hours: c.labor_hours }),
      })
      const j = await r.json().catch(() => ({}))
      if (r.ok && j?.item) setLineItems(prev => [...prev, apiToPriced(j.item)])
      else setErr(j?.error || 'Could not add line.')
    } catch { setErr('Could not add line.') }
    finally { setAddingIn(null) }
  }
  async function removeSection(s: string) {
    const ids = linesIn(s).map(l => l.id)
    setLineItems(prev => prev.filter(l => sectionOf(l) !== s))
    setSectionNames(prev => prev.filter(x => x !== s))
    for (const id of ids) { try { await fetch(`/api/quotes/${id}/items/${id}`, { method: 'DELETE' }) } catch { /* */ } }
  }
  // Calculator → priced lines, written into the "Gate Program" section.
  async function addGateProgram(lines: GenLine[]) {
    const section = 'Gate Program'
    setSectionNames(prev => prev.includes(section) ? prev : [...prev, section])
    setCalcOpen(false); setAddingIn(section)
    try {
      for (const s of lines) {
        const c = estimateLineCost({ description: s.description, is_recurring: s.is_recurring })
        const r = await fetch(`/api/quotes/${id}/items`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: s.description, qty: s.qty, unit_price: s.unit_price, is_recurring: s.is_recurring, is_optional: s.is_optional, section_name: section, item_type: 'service', unit_cost: c.unit_cost, labor_hours: c.labor_hours }),
        })
        const j = await r.json().catch(() => ({}))
        if (r.ok && j?.item) setLineItems(prev => [...prev, apiToPriced(j.item)])
      }
    } finally { setAddingIn(null) }
  }
  // ── Site Variables → auto-drive the managed "Gate Program" section ────────────
  // Persist the intake counts on the quote.
  async function saveSiteVars(v: SiteVars) {
    setSiteVars(v)
    try { await fetch(`/api/quotes/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ site_vars: v }) }) } catch { /* best effort */ }
  }
  // Regenerate the Gate Program section from the calculator lines: delete the old
  // managed lines, insert the fresh set. Serialized so rapid typing can't duplicate.
  const syncingRef = useRef(false)
  const pendingRef = useRef<GenLine[] | null>(null)
  async function syncGateProgram(lines: GenLine[]) {
    if (syncingRef.current) { pendingRef.current = lines; return }
    syncingRef.current = true
    const section = 'Gate Program'
    try {
      const existing = lineItems.filter(l => sectionOf(l) === section)
      setLineItems(prev => prev.filter(l => sectionOf(l) !== section))
      for (const l of existing) { try { await fetch(`/api/quotes/${id}/items/${l.id}`, { method: 'DELETE' }) } catch { /* */ } }
      if (lines.length) {
        setSectionNames(prev => prev.includes(section) ? prev : [...prev, section])
        for (const s of lines) {
          const c = estimateLineCost({ description: s.description, is_recurring: s.is_recurring })
          const unit_cost = s.unit_cost != null ? s.unit_cost : c.unit_cost
          const labor_hours = s.labor_hours != null ? s.labor_hours : c.labor_hours
          const r = await fetch(`/api/quotes/${id}/items`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description: s.description, qty: s.qty, unit_price: s.unit_price, is_recurring: s.is_recurring, is_optional: s.is_optional, section_name: section, item_type: 'service', unit_cost, labor_hours }),
          })
          const j = await r.json().catch(() => ({}))
          if (r.ok && j?.item) setLineItems(prev => [...prev, apiToPriced(j.item)])
        }
      }
    } finally {
      syncingRef.current = false
      if (pendingRef.current) { const next = pendingRef.current; pendingRef.current = null; void syncGateProgram(next) }
    }
  }
  // Install calculator → itemized parts + labor, written into the "Install & Setup"
  // section (replaces any prior install lines so re-running doesn't duplicate).
  async function applyInstallLines(lines: GenLine[]) {
    const section = 'Install & Setup'
    setInstallOpen(false)
    const existing = lineItems.filter(l => sectionOf(l) === section)
    setLineItems(prev => prev.filter(l => sectionOf(l) !== section))
    for (const l of existing) { try { await fetch(`/api/quotes/${id}/items/${l.id}`, { method: 'DELETE' }) } catch { /* */ } }
    setSectionNames(prev => prev.includes(section) ? prev : [...prev, section])
    setAddingIn(section)
    try {
      for (const s of lines) {
        const c = estimateLineCost({ description: s.description, is_recurring: s.is_recurring })
        const unit_cost = s.unit_cost != null ? s.unit_cost : c.unit_cost
        const labor_hours = s.labor_hours != null ? s.labor_hours : c.labor_hours
        const r = await fetch(`/api/quotes/${id}/items`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: s.description, qty: s.qty, unit_price: s.unit_price, is_recurring: s.is_recurring, is_optional: s.is_optional, section_name: section, item_type: 'hardware', unit_cost, labor_hours }),
        })
        const j = await r.json().catch(() => ({}))
        if (r.ok && j?.item) setLineItems(prev => [...prev, apiToPriced(j.item)])
      }
    } finally { setAddingIn(null) }
  }
  function renameSection(s: string) {
    const name = typeof window !== 'undefined' ? window.prompt('Rename section', s) : null
    if (!name || !name.trim() || name.trim() === s) return
    const nn = name.trim()
    const ids = linesIn(s).map(l => l.id)
    setLineItems(prev => prev.map(l => sectionOf(l) === s ? { ...l, section_name: nn } : l))
    setSectionNames(prev => prev.map(x => x === s ? nn : x))
    ids.forEach(id => persist(id, { section_name: nn }))
  }

  if (err) return <div style={{ padding: 40, color: '#e6555f' }}>{err}</div>
  if (!quote) return <div style={{ padding: 40, color: '#8fa4b8' }}>Loading builder…</div>

  const previewQuote = { ...quote, proposal_blocks: blocks }

  return (
    <div className="flex flex-col h-screen w-full" style={{ background: 'linear-gradient(180deg,#33465e,#26313f)', color: '#eef4fb' }}>
      {calcOpen && <GateProgramCalc defaultUnits={Number(quote.units) || 0} onClose={() => setCalcOpen(false)} onGenerate={addGateProgram} />}
      {installOpen && <InstallCalculator
        defaultWorkingGates={Math.max(0, (siteVars.vehicleGates + siteVars.amenityGates) - siteVars.nonWorkingGates)}
        defaultNonWorkingGates={siteVars.nonWorkingGates}
        onClose={() => setInstallOpen(false)} onGenerate={applyInstallLines} />}
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3" style={{ background: HEADER, borderBottom: '1px solid rgba(140,170,200,0.2)' }}>
        <a href={`/quotes/${id}`} className="text-[13px] font-semibold rounded-lg px-3 py-1.5" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(140,170,200,0.25)', color: '#cfe0f0' }}>← Line items</a>
        <div className="min-w-0">
          <div className="text-[15px] font-extrabold truncate">{quote.title || 'Proposal'} <span className="text-[12px] font-semibold" style={{ color: ACCENT }}>· builder</span></div>
          <div className="text-[11px]" style={{ color: '#9fb4c9' }}>{quote.property_name || quote.client_name || '—'}{quote.units ? ` · ${quote.units} units` : ''}</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <a href={`/quotes/${id}/proposal`} target="_blank" rel="noreferrer" className="text-[12px] font-semibold rounded-lg px-3 py-1.5" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(140,170,200,0.25)', color: '#cfe0f0' }}>Open customer view ↗</a>
          <button onClick={save} disabled={saving || !dirty} className="text-[12px] font-bold rounded-lg px-4 py-1.5" style={{ background: dirty ? ACCENT : 'rgba(255,255,255,0.08)', color: dirty ? '#04202e' : '#7f93a6', cursor: dirty ? 'pointer' : 'default' }}>
            {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* LEFT — module palette */}
        <aside className="w-64 shrink-0 overflow-y-auto p-3" style={{ background: 'linear-gradient(180deg,#2c3d52,#243141)', borderRight: '1px solid rgba(170,198,222,0.28)' }}>
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] mb-2" style={{ color: '#8fa4b8' }}>Modules · drag order</div>
          {blocks.map((b, i) => {
            const def = moduleDef(b.type)
            const core = def?.core
            return (
              <div key={b.type + i} className="flex items-center gap-2 rounded-xl px-2.5 py-2 mb-1.5" style={{ background: FRAME, border: '1px solid rgba(140,170,200,0.2)', opacity: b.enabled ? 1 : 0.45 }}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: b.enabled ? ACCENT : '#5f7186' }} />
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <span className="flex-1 text-[12.5px] font-semibold">{b.type === 'offering' ? String((b.vars as any)?.title ?? 'Offering') : (def?.label ?? b.type)}</span>
                <button onClick={() => move(i, -1)} title="Move up" className="text-[12px] px-1" style={{ color: '#9fb4c9' }}>↑</button>
                <button onClick={() => move(i, 1)} title="Move down" className="text-[12px] px-1" style={{ color: '#9fb4c9' }}>↓</button>
                <input type="checkbox" title={b.enabled ? 'Hide' : 'Show'} checked={b.enabled} onChange={() => toggle(i)} style={{ accentColor: ACCENT, width: 15, height: 15 }} />
                {core
                  ? <span className="text-[9px] px-1" style={{ color: '#6f8299' }}>core</span>
                  : <button onClick={() => remove(i)} title="Remove section" className="text-[12px] px-1" style={{ color: '#e6808a' }}>✕</button>}
              </div>
            )
          })}

          {/* Add an OFFERING — benefits + its own pricing section, together. */}
          <button onClick={() => setOfferOpen(o => !o)} className="w-full text-left rounded-xl px-2.5 py-2 mt-1 text-[12.5px] font-bold" style={{ background: 'linear-gradient(135deg,#2f7fb8,#5FB8E0)', color: '#04202e' }}>
            ✦ Add offering (talking points + pricing)
          </button>
          {offerOpen && (
            <div className="mt-1.5 rounded-xl p-1.5" style={{ background: '#0c1420', border: '1px solid rgba(140,170,200,0.2)' }}>
              {OFFERING_LIBRARY.map(o => (
                <button key={o.id} onClick={() => addOffering(o)} className="block w-full text-left rounded-lg px-2.5 py-1.5 text-[12px]" style={{ color: '#cfe0f0' }}>{o.label}</button>
              ))}
            </div>
          )}

          {/* Add a plain content block */}
          <button onClick={() => setAddOpen(o => !o)} className="w-full text-left rounded-xl px-2.5 py-2 mt-1.5 text-[12.5px] font-semibold" style={{ background: 'rgba(95,184,224,0.10)', border: '1px dashed rgba(95,184,224,0.4)', color: ACCENT }}>
            + Add content block
          </button>
          {addOpen && (
            <div className="mt-1.5 rounded-xl p-1.5" style={{ background: '#0c1420', border: '1px solid rgba(140,170,200,0.2)' }}>
              {MODULE_LIBRARY.filter(m => !m.core).map(m => (
                <button key={m.type} onClick={() => add(m.type)} className="block w-full text-left rounded-lg px-2.5 py-1.5 text-[12px]" style={{ color: '#cfe0f0' }}>{m.label}</button>
              ))}
            </div>
          )}

          <div className="text-[11px] mt-3 leading-relaxed" style={{ color: '#6f8299' }}>An <b style={{ color: '#9FD8EC' }}>offering</b> adds its benefits story <i>and</i> a matching pricing section. Reorder with the arrows, hide with the checkbox. The client sees exactly the center preview.</div>
        </aside>

        {/* CENTER — live customer preview */}
        <main className="flex-1 overflow-y-auto p-6" style={{ background: 'linear-gradient(180deg,#3d5069,#2c3c50)' }}>
          <ProposalView quote={previewQuote} lineItems={lineItems} preview />
        </main>

        {/* RIGHT — pricing editor */}
        <aside className="w-96 shrink-0 overflow-y-auto p-3" style={{ background: 'linear-gradient(180deg,#2c3d52,#243141)', borderLeft: '1px solid rgba(170,198,222,0.28)' }}>
          <div className="flex items-center mb-2">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: '#8fa4b8' }}>Pricing</div>
            <button onClick={() => setShowCosts(s => !s)} className="ml-auto text-[11px] font-bold rounded-lg px-2 py-1" style={{ background: showCosts ? 'rgba(18,184,134,0.16)' : 'rgba(255,255,255,0.06)', border: `1px solid ${showCosts ? 'rgba(18,184,134,0.4)' : 'rgba(140,170,200,0.24)'}`, color: showCosts ? '#7fe0b8' : '#9fb4c9' }}>{showCosts ? '✓ Costs & P&L' : 'Costs & P&L'}</button>
          </div>
          <div className="rounded-xl p-3 mb-3" style={{ background: FRAME, border: '1px solid rgba(140,170,200,0.2)' }}>
            <Row k="Monthly" v={money(totals.monthly)} strong />
            <Row k="One-time setup" v={money(totals.setup)} />
            <Row k="Due today" v={money(totals.dueToday)} strong />
          </div>

          <SiteVariables initial={siteVars} onVarsChange={saveSiteVars} onGenerate={syncGateProgram} />

          {showCosts && (
            <div className="rounded-xl p-3 mb-3" style={{ background: 'linear-gradient(180deg,#1c3a2e,#16322a)', border: '1px solid rgba(18,184,134,0.34)' }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: '#7fe0b8' }}>Dealer P&amp;L</div>
                <label className="ml-auto text-[10px]" style={{ color: '#9fb4c9' }}>Labor $/hr
                  <input type="number" value={laborRate} onChange={e => setLaborRate(Math.max(0, Number(e.target.value) || 0))} className="w-12 ml-1 rounded px-1 py-0.5 text-[11px] text-center" style={{ background: '#0c1420', border: '1px solid rgba(140,170,200,0.24)', color: '#e7eef7' }} />
                </label>
                <label className="text-[10px]" style={{ color: '#9fb4c9' }}>Term mo
                  <input type="number" value={termMonths} onChange={e => setTermMonths(Math.max(1, Number(e.target.value) || 60))} className="w-12 ml-1 rounded px-1 py-0.5 text-[11px] text-center" style={{ background: '#0c1420', border: '1px solid rgba(140,170,200,0.24)', color: '#e7eef7' }} />
                </label>
              </div>
              <div className="text-[10px] font-bold uppercase tracking-[0.08em] mb-0.5" style={{ color: '#8fa4b8' }}>One-time setup</div>
              <Row k="Revenue" v={money(pl.setupRevenue)} />
              <Row k="Cost (parts + labor)" v={money(pl.setupCost)} />
              <Row k={`Profit · ${Math.round(pl.setupMargin * 100)}%`} v={money(pl.setupProfit)} strong pos={pl.setupProfit >= 0} />
              <div className="text-[10px] font-bold uppercase tracking-[0.08em] mt-2 mb-0.5" style={{ color: '#8fa4b8' }}>Over {termMonths} mo term</div>
              <Row k="Recurring revenue" v={money(pl.termRevenue)} />
              <Row k="Recurring cost" v={money(pl.termCost)} />
              <Row k="Term profit" v={money(pl.termProfit)} strong pos={pl.termProfit >= 0} />
              <div className="mt-2 pt-2" style={{ borderTop: '1px dashed rgba(140,170,200,0.24)' }}>
                <Row k="Total contract profit" v={money(pl.totalProfit)} strong pos={pl.totalProfit >= 0} />
              </div>
            </div>
          )}

          {sections.map(sname => {
            const rows = linesIn(sname)
            return (
              <div key={sname} className="mb-3 rounded-xl p-2" style={{ background: 'rgba(12,20,32,0.28)', border: '1px solid rgba(140,170,200,0.16)' }}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <button onClick={() => renameSection(sname)} title="Rename section" className="flex-1 text-left text-[12px] font-bold uppercase tracking-[0.06em]" style={{ color: '#cfe0f0' }}>{sname} <span style={{ color: '#6f8299' }}>· {rows.length}</span></button>
                  <button onClick={() => addLine(sname)} disabled={addingIn === sname} className="text-[11px] font-bold rounded-lg px-2 py-1" style={{ background: 'rgba(95,184,224,0.14)', border: '1px solid rgba(95,184,224,0.4)', color: ACCENT }}>{addingIn === sname ? '…' : '+ Line'}</button>
                  <button onClick={() => removeSection(sname)} title="Remove section" className="text-[12px] px-1" style={{ color: '#e6808a' }}>✕</button>
                </div>
                {rows.length === 0 && <div className="text-[11px] mb-1.5 px-1" style={{ color: '#6f8299' }}>Empty — add a line.</div>}
                {rows.map(l => (
                  <div key={l.id} className="rounded-lg p-2 mb-1.5" style={{ background: 'rgba(12,20,32,0.5)', border: `1px solid ${l.is_optional ? 'rgba(95,184,224,0.4)' : 'rgba(140,170,200,0.18)'}` }}>
                    <input value={l.description} onChange={e => patchLocal(l.id, { description: e.target.value })} onBlur={e => persist(l.id, { description: e.target.value })}
                      className="w-full bg-transparent text-[12.5px] font-semibold outline-none" style={{ color: '#eef4fb' }} placeholder="Description" />
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <input type="number" value={l.qty} onChange={e => patchLocal(l.id, { qty: Number(e.target.value) })} onBlur={e => persist(l.id, { qty: Number(e.target.value) })}
                        className="w-11 rounded px-1 py-1 text-[12px] text-center outline-none" style={{ background: '#0c1420', border: '1px solid rgba(140,170,200,0.24)', color: '#e7eef7' }} />
                      <span className="text-[11px]" style={{ color: '#6f8299' }}>×</span>
                      <div className="flex items-center rounded px-1.5 py-1" style={{ background: '#0c1420', border: '1px solid rgba(140,170,200,0.24)' }}>
                        <span className="text-[11px]" style={{ color: '#6f8299' }}>$</span>
                        <input type="number" value={l.unitPrice} onChange={e => patchLocal(l.id, { unitPrice: Number(e.target.value) })} onBlur={e => persist(l.id, { unit_price: Number(e.target.value) })}
                          className="w-14 bg-transparent text-[12px] outline-none" style={{ color: '#e7eef7' }} />
                      </div>
                      <button onClick={() => toggleRecurring(l)} title="Monthly vs one-time" className="text-[10px] font-bold rounded px-1.5 py-1" style={{ background: l.recurring ? 'rgba(95,184,224,0.16)' : 'rgba(255,255,255,0.06)', border: `1px solid ${l.recurring ? 'rgba(95,184,224,0.4)' : 'rgba(140,170,200,0.24)'}`, color: l.recurring ? ACCENT : '#9fb4c9' }}>{l.recurring ? '/mo' : 'once'}</button>
                      <button onClick={() => toggleOptional(l)} title="Optional (client can select)" className="text-[10px] font-bold rounded px-1.5 py-1" style={{ background: l.is_optional ? 'rgba(95,184,224,0.16)' : 'rgba(255,255,255,0.06)', border: `1px solid ${l.is_optional ? 'rgba(95,184,224,0.4)' : 'rgba(140,170,200,0.24)'}`, color: l.is_optional ? ACCENT : '#9fb4c9' }}>{l.is_optional ? '★ opt' : 'req'}</button>
                      <button onClick={() => deleteLine(l.id)} title="Remove" className="ml-auto text-[12px]" style={{ color: '#e6808a' }}>✕</button>
                    </div>
                    <div className="text-right text-[11px] mt-1" style={{ color: '#9fb4c9' }}>{money(l.total)}{l.recurring ? '/mo' : ''}{l.is_optional ? ' · optional' : ''}</div>
                    {showCosts && (() => {
                      const uc = l.unit_cost ?? 0, lh = l.labor_hours ?? 0
                      const lineCost = l.recurring ? l.qty * uc : l.qty * (uc + lh * laborRate)
                      const profit = l.total - lineCost
                      return (
                        <div className="mt-1.5 pt-1.5 flex items-center gap-1.5" style={{ borderTop: '1px dashed rgba(140,170,200,0.16)' }}>
                          <span className="text-[9px] uppercase tracking-wide" style={{ color: '#6f8299' }}>cost</span>
                          <div className="flex items-center rounded px-1 py-0.5" style={{ background: '#0c1420', border: '1px solid rgba(140,170,200,0.24)' }}>
                            <span className="text-[10px]" style={{ color: '#6f8299' }}>$</span>
                            <input type="number" value={uc} onChange={e => patchLocal(l.id, { unit_cost: Number(e.target.value) })} onBlur={e => persist(l.id, { unit_cost: Number(e.target.value) })} className="w-12 bg-transparent text-[11px] outline-none" style={{ color: '#e7eef7' }} title="Material cost / unit" />
                          </div>
                          {!l.recurring && (
                            <div className="flex items-center rounded px-1 py-0.5" style={{ background: '#0c1420', border: '1px solid rgba(140,170,200,0.24)' }}>
                              <input type="number" value={lh} onChange={e => patchLocal(l.id, { labor_hours: Number(e.target.value) })} onBlur={e => persist(l.id, { labor_hours: Number(e.target.value) })} className="w-10 bg-transparent text-[11px] outline-none text-center" style={{ color: '#e7eef7' }} title="Labor hours / unit" />
                              <span className="text-[10px]" style={{ color: '#6f8299' }}>h</span>
                            </div>
                          )}
                          <span className="ml-auto text-[11px] font-bold" style={{ color: profit >= 0 ? '#7fe0b8' : '#fca5a5' }}>{money(profit)}{l.recurring ? '/mo' : ''}</span>
                        </div>
                      )
                    })()}
                  </div>
                ))}
              </div>
            )
          })}
          <button onClick={() => setCalcOpen(true)} className="w-full text-left rounded-xl px-3 py-2.5 mb-1.5 text-[12.5px] font-bold" style={{ background: 'linear-gradient(135deg,#2f7fb8,#5FB8E0)', color: '#04202e' }}>🧮 Gate Program calculator</button>
          <button onClick={() => setInstallOpen(true)} className="w-full text-left rounded-xl px-3 py-2.5 mb-1.5 text-[12.5px] font-bold" style={{ background: 'linear-gradient(135deg,#12b886,#3ddc97)', color: '#04231a' }}>🔧 Install calculator</button>
          <button onClick={addSection} className="w-full text-left rounded-xl px-3 py-2.5 text-[12.5px] font-semibold" style={{ background: 'rgba(95,184,224,0.10)', border: '1px dashed rgba(95,184,224,0.4)', color: ACCENT }}>+ Add section</button>
          <div className="text-[11px] leading-relaxed mt-3" style={{ color: '#6f8299' }}>Add any number of sections (Cameras, Smart Locks, Bulk Internet…). Mark a line <b style={{ color: '#a9bed1' }}>★ opt</b> and the client sees it as a selectable add-on. Preview updates live.</div>
        </aside>
      </div>
    </div>
  )
}

function Row({ k, v, strong, pos }: { k: string; v: string; strong?: boolean; pos?: boolean }) {
  const color = pos === undefined ? (strong ? '#eaf3fb' : '#cfe0f0') : (pos ? '#7fe0b8' : '#fca5a5')
  return (
    <div className="flex justify-between py-1.5" style={{ borderBottom: '1px solid rgba(140,170,200,0.12)' }}>
      <span className="text-[12px]" style={{ color: '#9fb4c9' }}>{k}</span>
      <span className={strong ? 'text-[13px] font-extrabold' : 'text-[12px] font-semibold'} style={{ color }}>{v}</span>
    </div>
  )
}
