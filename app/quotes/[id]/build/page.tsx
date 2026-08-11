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
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import ProposalView from '@/components/public/ProposalView'
import {
  resolveBlocks, moduleDef, computeTotals, MODULE_LIBRARY,
  type ProposalBlock, type PricedLine, type ProposalBlockType,
} from '@/lib/proposal-modules'

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

  useEffect(() => {
    if (!id) return
    let live = true
    fetch(`/api/quotes/${id}/public`).then(r => r.json()).then(j => {
      if (!live) return
      if (j?.error) { setErr(j.error); return }
      setQuote(j.quote); setLineItems(j.lineItems ?? []); setBlocks(resolveBlocks(j.quote))
    }).catch(() => { if (live) setErr('Could not load this quote.') })
    return () => { live = false }
  }, [id])

  const totals = useMemo(() => computeTotals(lineItems, new Set(lineItems.filter(l => l.is_optional && l.is_included).map(l => l.id))), [lineItems])

  const [addOpen, setAddOpen] = useState(false)
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
    }
  }
  const GROUPS = {
    monthly:  { section: 'Monthly Program',   is_recurring: true,  is_optional: false, item_type: 'service' },
    setup:    { section: 'One-Time Setup',    is_recurring: false, is_optional: false, item_type: 'labor' },
    optional: { section: 'Optional Upgrades', is_recurring: true,  is_optional: true,  item_type: 'service' },
  } as const
  async function addLine(group: keyof typeof GROUPS) {
    setAddingIn(group); setErr(null)
    const g = GROUPS[group]
    try {
      const r = await fetch(`/api/quotes/${id}/items`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: 'New line', qty: 1, unit_price: 0, is_recurring: g.is_recurring, is_optional: g.is_optional, section_name: g.section, item_type: g.item_type }),
      })
      const j = await r.json().catch(() => ({}))
      if (r.ok && j?.item) setLineItems(prev => [...prev, apiToPriced(j.item)])
      else setErr(j?.error || 'Could not add line.')
    } catch { setErr('Could not add line.') }
    finally { setAddingIn(null) }
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
  const groupLines = (g: keyof typeof GROUPS) => lineItems.filter(l =>
    g === 'optional' ? l.is_optional : (g === 'monthly' ? (!l.is_optional && l.recurring) : (!l.is_optional && !l.recurring)))

  if (err) return <div style={{ padding: 40, color: '#e6555f' }}>{err}</div>
  if (!quote) return <div style={{ padding: 40, color: '#8fa4b8' }}>Loading builder…</div>

  const previewQuote = { ...quote, proposal_blocks: blocks }

  return (
    <div className="flex flex-col h-screen w-full" style={{ background: 'linear-gradient(180deg,#33465e,#26313f)', color: '#eef4fb' }}>
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
                <span className="flex-1 text-[12.5px] font-semibold">{def?.label ?? b.type}</span>
                <button onClick={() => move(i, -1)} title="Move up" className="text-[12px] px-1" style={{ color: '#9fb4c9' }}>↑</button>
                <button onClick={() => move(i, 1)} title="Move down" className="text-[12px] px-1" style={{ color: '#9fb4c9' }}>↓</button>
                <input type="checkbox" title={b.enabled ? 'Hide' : 'Show'} checked={b.enabled} onChange={() => toggle(i)} style={{ accentColor: ACCENT, width: 15, height: 15 }} />
                {core
                  ? <span className="text-[9px] px-1" style={{ color: '#6f8299' }}>core</span>
                  : <button onClick={() => remove(i)} title="Remove section" className="text-[12px] px-1" style={{ color: '#e6808a' }}>✕</button>}
              </div>
            )
          })}

          {/* Add a section from the library (duplicates allowed — e.g. two value blocks) */}
          <button onClick={() => setAddOpen(o => !o)} className="w-full text-left rounded-xl px-2.5 py-2 mt-1 text-[12.5px] font-semibold" style={{ background: 'rgba(95,184,224,0.10)', border: '1px dashed rgba(95,184,224,0.4)', color: ACCENT }}>
            + Add section
          </button>
          {addOpen && (
            <div className="mt-1.5 rounded-xl p-1.5" style={{ background: '#0c1420', border: '1px solid rgba(140,170,200,0.2)' }}>
              {MODULE_LIBRARY.filter(m => !m.core).map(m => (
                <button key={m.type} onClick={() => add(m.type)} className="block w-full text-left rounded-lg px-2.5 py-1.5 text-[12px]" style={{ color: '#cfe0f0' }}>{m.label}</button>
              ))}
            </div>
          )}

          <div className="text-[11px] mt-3 leading-relaxed" style={{ color: '#6f8299' }}>Add or remove any section, reorder with the arrows, or hide one with its checkbox. The client sees exactly the center preview.</div>
        </aside>

        {/* CENTER — live customer preview */}
        <main className="flex-1 overflow-y-auto p-6" style={{ background: 'linear-gradient(180deg,#3d5069,#2c3c50)' }}>
          <ProposalView quote={previewQuote} lineItems={lineItems} preview />
        </main>

        {/* RIGHT — pricing editor */}
        <aside className="w-96 shrink-0 overflow-y-auto p-3" style={{ background: 'linear-gradient(180deg,#2c3d52,#243141)', borderLeft: '1px solid rgba(170,198,222,0.28)' }}>
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] mb-2" style={{ color: '#8fa4b8' }}>Pricing</div>
          <div className="rounded-xl p-3 mb-3" style={{ background: FRAME, border: '1px solid rgba(140,170,200,0.2)' }}>
            <Row k="Monthly" v={money(totals.monthly)} strong />
            <Row k="One-time setup" v={money(totals.setup)} />
            <Row k="Due today" v={money(totals.dueToday)} strong />
          </div>

          {([
            { key: 'monthly',  label: 'Monthly Program',  suffix: '/mo' },
            { key: 'setup',    label: 'One-Time Setup',   suffix: '' },
            { key: 'optional', label: 'Optional Upgrades', suffix: '' },
          ] as const).map(g => {
            const rows = groupLines(g.key)
            return (
              <div key={g.key} className="mb-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: '#a9bed1' }}>{g.label} <span style={{ color: '#6f8299' }}>· {rows.length}</span></span>
                  <button onClick={() => addLine(g.key)} disabled={addingIn === g.key} className="text-[11px] font-bold rounded-lg px-2 py-1" style={{ background: 'rgba(95,184,224,0.14)', border: '1px solid rgba(95,184,224,0.4)', color: ACCENT }}>{addingIn === g.key ? '…' : '+ Add'}</button>
                </div>
                {rows.length === 0 && <div className="text-[11px] mb-1.5" style={{ color: '#6f8299' }}>Nothing here yet.</div>}
                {rows.map(l => (
                  <div key={l.id} className="rounded-lg p-2 mb-1.5" style={{ background: 'rgba(12,20,32,0.5)', border: '1px solid rgba(140,170,200,0.18)' }}>
                    <input value={l.description} onChange={e => patchLocal(l.id, { description: e.target.value })} onBlur={e => persist(l.id, { description: e.target.value })}
                      className="w-full bg-transparent text-[12.5px] font-semibold outline-none" style={{ color: '#eef4fb' }} placeholder="Description" />
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <input type="number" value={l.qty} onChange={e => patchLocal(l.id, { qty: Number(e.target.value) })} onBlur={e => persist(l.id, { qty: Number(e.target.value) })}
                        className="w-12 rounded px-1.5 py-1 text-[12px] text-center outline-none" style={{ background: '#0c1420', border: '1px solid rgba(140,170,200,0.24)', color: '#e7eef7' }} />
                      <span className="text-[11px]" style={{ color: '#6f8299' }}>×</span>
                      <div className="flex items-center rounded px-1.5 py-1" style={{ background: '#0c1420', border: '1px solid rgba(140,170,200,0.24)' }}>
                        <span className="text-[11px]" style={{ color: '#6f8299' }}>$</span>
                        <input type="number" value={l.unitPrice} onChange={e => patchLocal(l.id, { unitPrice: Number(e.target.value) })} onBlur={e => persist(l.id, { unit_price: Number(e.target.value) })}
                          className="w-16 bg-transparent text-[12px] outline-none" style={{ color: '#e7eef7' }} />
                      </div>
                      <button onClick={() => toggleRecurring(l)} title="Monthly vs one-time" className="text-[10px] font-bold rounded px-1.5 py-1" style={{ background: l.recurring ? 'rgba(95,184,224,0.16)' : 'rgba(255,255,255,0.06)', border: `1px solid ${l.recurring ? 'rgba(95,184,224,0.4)' : 'rgba(140,170,200,0.24)'}`, color: l.recurring ? ACCENT : '#9fb4c9' }}>{l.recurring ? '/mo' : 'once'}</button>
                      <span className="ml-auto text-[12.5px] font-bold" style={{ color: '#eaf3fb' }}>{money(l.total)}{l.recurring ? g.suffix || '/mo' : ''}</span>
                      <button onClick={() => deleteLine(l.id)} title="Remove" className="text-[12px]" style={{ color: '#e6808a' }}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
          <div className="text-[11px] leading-relaxed" style={{ color: '#6f8299' }}>Edit here and the preview updates live. Optional upgrades show the client a checkbox. Floor guard + one-click send land next.</div>
        </aside>
      </div>
    </div>
  )
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex justify-between py-1.5" style={{ borderBottom: '1px solid rgba(140,170,200,0.12)' }}>
      <span className="text-[12px]" style={{ color: '#9fb4c9' }}>{k}</span>
      <span className={strong ? 'text-[13px] font-extrabold' : 'text-[12px] font-semibold'} style={{ color: strong ? '#eaf3fb' : '#cfe0f0' }}>{v}</span>
    </div>
  )
}
