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
  const optionalCount = lineItems.filter(l => l.is_optional).length

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

  if (err) return <div style={{ padding: 40, color: '#e6555f' }}>{err}</div>
  if (!quote) return <div style={{ padding: 40, color: '#8fa4b8' }}>Loading builder…</div>

  const previewQuote = { ...quote, proposal_blocks: blocks }

  return (
    <div className="flex flex-col h-full" style={{ background: '#0f1822', color: '#e7eef7' }}>
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
        <aside className="w-64 shrink-0 overflow-y-auto p-3" style={{ background: '#141d28', borderRight: '1px solid rgba(140,170,200,0.16)' }}>
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
        <main className="flex-1 overflow-y-auto p-6" style={{ background: 'radial-gradient(120% 90% at 50% 0%, #16233400 0%, #0b1420 70%)' }}>
          <ProposalView quote={previewQuote} lineItems={lineItems} preview />
        </main>

        {/* RIGHT — quick numbers + next steps */}
        <aside className="w-72 shrink-0 overflow-y-auto p-3" style={{ background: '#141d28', borderLeft: '1px solid rgba(140,170,200,0.16)' }}>
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] mb-2" style={{ color: '#8fa4b8' }}>The numbers</div>
          <div className="rounded-xl p-3 mb-2" style={{ background: FRAME, border: '1px solid rgba(140,170,200,0.2)' }}>
            <Row k="Monthly" v={money(totals.monthly)} />
            <Row k="One-time setup" v={money(totals.setup)} />
            <Row k="Due today" v={money(totals.dueToday)} strong />
            <Row k="Optional upgrades" v={String(optionalCount)} />
            <Row k="Line items" v={String(lineItems.length)} />
          </div>
          {lineItems.length === 0 && (
            <div className="rounded-xl p-3 mb-2 text-[12px] leading-relaxed" style={{ background: 'rgba(240,160,32,0.12)', border: '1px solid rgba(240,160,32,0.4)', color: '#f2c879' }}>
              No line items yet — the quote will read $0. Add them in the line-item editor, then they flow into this preview automatically.
            </div>
          )}
          <a href={`/quotes/${id}`} className="block text-center text-[12px] font-bold rounded-xl px-3 py-2.5 mb-2" style={{ background: ACCENT, color: '#04202e' }}>+ Edit line items</a>
          <div className="text-[11px] leading-relaxed" style={{ color: '#6f8299' }}>Pricing editing, the floor guard, and one-click send land in the next builder pieces.</div>
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
