'use client'
/**
 * CatalogSurface — the Catalog tab. One product list for quotes, jobs, drawings,
 * inventory and the tech app (merges the old dark Catalog tab and /products).
 *
 *   • KPI tiles that filter: Active, Low stock, Needs a price, Low margin, No manual, Archived
 *   • Search, category chips, brand, sort, list / grid
 *   • Select rows → bulk: change category, raise/lower price %, archive / make active, export
 *   • Import / export CSV (header-based), New product
 *   • Tap a product → ProductPage (full screen, deep link /?tab=catalog&product=<id>)
 *
 * Data: /api/products (scoped catalog), /api/products/stats (stock),
 * /api/kb/coverage (manuals), /api/admin/product-costs (corporate only).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  TEXT, MUTED, BRAND, GREEN, ORANGE, RED, LINE, FONT, SHADOW, CATEGORIES,
  type ProductRow, type ProductForm, fmt$, calcMargin, marginColor, catOf, emptyForm, ProductThumb,
} from '@/components/nexus/catalog/shared'
import { ProductEditor } from '@/components/nexus/catalog/ProductEditor'
import { ProductPage } from '@/components/nexus/catalog/ProductPage'

type Stock = Record<string, { onHand: number; onTruck: number; min: number; locations: number }>
type Kpi = 'active' | 'low' | 'noprice' | 'lowmargin' | 'nomanual' | 'archived'
type Sort = 'name' | 'price' | 'margin' | 'updated' | 'stock'

const CSS = `
.ct{color:${TEXT};font-family:${FONT};letter-spacing:-.01em;width:100%;max-width:1360px;margin:0 auto;padding:4px 4px calc(140px + env(safe-area-inset-bottom))}
.ct *{box-sizing:border-box}
.ct-hd{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;flex-wrap:wrap;margin:6px 0 18px}
.ct-hd h1{margin:0;color:#fff;font-size:30px;font-weight:600;letter-spacing:-.025em}
.ct-hd .sub{color:rgba(255,255,255,.72);font-size:14px;margin-top:4px}
.ct-acts{display:flex;gap:8px;flex-wrap:wrap}
.ct-b{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:36px;padding:0 14px;border-radius:10px;border:0;font:600 13px ${FONT};cursor:pointer;white-space:nowrap}
.ct-b.dark{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);color:#fff;font-weight:500}
.ct-b.pri{background:${BRAND};color:#fff}
.ct-b.line{background:#fff;border:1px solid rgba(0,0,0,.12);color:${TEXT};font-weight:500}
.ct-b:disabled{opacity:.5;cursor:default}
.ct-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin-bottom:16px}
.ct-kpi{text-align:left;background:#fff;border:0;border-radius:14px;padding:12px 14px;box-shadow:${SHADOW};cursor:pointer;font:inherit;color:inherit;outline-offset:2px}
.ct-kpi[aria-pressed=true]{box-shadow:0 0 0 2px ${BRAND},${SHADOW}}
.ct-kpi .l{display:flex;align-items:center;gap:6px;font-size:12px;color:${MUTED};font-weight:500}
.ct-kpi .v{font-size:24px;font-weight:600;letter-spacing:-.02em;margin-top:2px}
.ct-kpi .s{font-size:12px;color:${MUTED}}
.ct-dot{width:8px;height:8px;border-radius:50%;display:inline-block}
.ct-card{background:#fff;border-radius:16px;box-shadow:${SHADOW};overflow:hidden}
.ct-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:12px 14px;border-bottom:1px solid ${LINE}}
.ct-in{height:36px;border:1px solid rgba(0,0,0,.12);border-radius:10px;padding:0 12px;font:400 14px ${FONT};color:${TEXT};background:#fff}
.ct-chips{display:flex;gap:6px;overflow-x:auto;padding:10px 14px;border-bottom:1px solid ${LINE}}
.ct-chip{flex:none;border:1px solid rgba(0,0,0,.12);background:#fff;border-radius:999px;padding:5px 12px;font:500 13px ${FONT};color:#3A3A3C;cursor:pointer;white-space:nowrap}
.ct-chip[aria-pressed=true]{background:${TEXT};border-color:${TEXT};color:#fff}
.ct-seg{display:flex;gap:2px;padding:3px;border-radius:10px;background:#EEF0F4}
.ct-seg button{border:0;background:none;height:30px;padding:0 12px;border-radius:8px;font:500 13px ${FONT};color:#3A3A3C;cursor:pointer}
.ct-seg button[aria-pressed=true]{background:#fff;color:${TEXT};font-weight:600;box-shadow:0 1px 2px rgba(0,0,0,.08)}
.ct-bulk{display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:10px 14px;background:#EEF4FF;border-bottom:1px solid #D6E4FF;font-size:13px}
.ct-tbl{width:100%;border-collapse:collapse;font-size:14px}
.ct-tbl th{position:sticky;top:0;background:#FAFAFB;text-align:left;font-weight:500;color:${MUTED};font-size:12px;padding:8px 10px;border-bottom:1px solid ${LINE};white-space:nowrap}
.ct-tbl td{padding:9px 10px;border-bottom:1px solid ${LINE};vertical-align:middle}
.ct-tbl tbody tr{cursor:pointer}.ct-tbl tbody tr:hover{background:#F7F8FA}
.ct-tbl .n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.ct-tbl input[type=checkbox]{width:16px;height:16px}
.ct-nm{font-weight:600;max-width:340px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ct-sm{font-size:12.5px;color:${MUTED};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:340px}
.ct-tag{display:inline-block;padding:1px 7px;border-radius:999px;font-size:11.5px;font-weight:600}
.ct-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px;padding:14px}
.ct-gc{position:relative;text-align:left;border:1px solid ${LINE};border-radius:14px;background:#fff;padding:12px;cursor:pointer;font:inherit;color:inherit;display:flex;flex-direction:column;gap:8px}
.ct-gc:hover{box-shadow:${SHADOW}}
.ct-empty{padding:40px 16px;text-align:center;color:${MUTED};font-size:14px}
.ct-modal{position:fixed;inset:0;z-index:140;background:rgba(15,23,42,.42);display:flex;align-items:center;justify-content:center;padding:16px}
.ct-modal .p{width:min(680px,100%);max-height:90vh;overflow-y:auto;background:#fff;border-radius:16px;padding:18px;font-family:${FONT}}
@media (max-width:1100px){.ct-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (max-width:640px){.ct-hd h1{font-size:24px}.ct-acts{width:100%}.ct-acts .ct-b{flex:1}.ct-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.ct-tbl .hide-sm{display:none}.ct-nm,.ct-sm{max-width:180px}}
`

// ── CSV (header-based; handles quotes and commas inside quotes) ──────────────
function parseCsv(text: string): string[][] {
  const out: string[][] = []; let row: string[] = []; let cell = ''; let q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++ } else q = false } else cell += c }
    else if (c === '"') q = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); out.push(row); row = []; cell = '' }
    else cell += c
  }
  if (cell || row.length) { row.push(cell); out.push(row) }
  return out.filter(r => r.some(x => x.trim()))
}
const CSV_COLS = ['sku', 'name', 'brand', 'category', 'subcategory', 'description', 'specs', 'msrp', 'dealer_cost', 'sell_price', 'labor_hours', 'unit', 'warranty_months', 'adi_sku', 'image_url', 'active'] as const
const HEADER_ALIASES: Record<string, string> = { model: 'sku', 'model #': 'sku', 'part #': 'sku', product: 'name', 'product name': 'name', manufacturer: 'brand', cost: 'dealer_cost', 'your cost': 'dealer_cost', price: 'sell_price', 'sell price': 'sell_price', labor: 'labor_hours', 'labor hours': 'labor_hours', warranty: 'warranty_months', image: 'image_url' }
const NUM_COLS = new Set(['msrp', 'dealer_cost', 'sell_price', 'labor_hours', 'warranty_months'])
const csvEsc = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
function toCsv(rows: ProductRow[]): string {
  return [CSV_COLS.join(','), ...rows.map(r => CSV_COLS.map(c => csvEsc((r as unknown as Record<string, unknown>)[c] ?? (c === 'active' ? (r.active === false ? 'no' : 'yes') : ''))).join(','))].join('\n')
}
function download(name: string, text: string) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export default function CatalogSurface() {
  const [products, setProducts] = useState<ProductRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [stock, setStock] = useState<Stock>({})
  const [coverage, setCoverage] = useState<Record<string, { chunks: number }>>({})
  const [ggCosts, setGgCosts] = useState<Record<string, number>>({})
  const [isCorporate, setIsCorporate] = useState(false)
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState('All')
  const [brand, setBrand] = useState('')
  const [kpi, setKpi] = useState<Kpi>('active')
  const [sort, setSort] = useState<Sort>('name')
  const [view, setView] = useState<'list' | 'grid'>(() => { try { return (localStorage.getItem('gg_catalog_view') as 'list' | 'grid') || 'list' } catch { return 'list' } })
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [openId, setOpenId] = useState<string | null>(null)
  const [editing, setEditing] = useState<ProductForm | null>(null)
  const [importing, setImporting] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [pct, setPct] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setLoadErr(null)
    try {
      const [p, s, c, g] = await Promise.all([
        fetch('/api/products?limit=2000&active=false', { cache: 'no-store' }),
        fetch('/api/products/stats', { cache: 'no-store' }).catch(() => null),
        fetch('/api/kb/coverage', { cache: 'no-store' }).catch(() => null),
        fetch('/api/admin/product-costs', { cache: 'no-store' }).catch(() => null),
      ])
      const pj = await p.json().catch(() => ({}))
      if (!p.ok) setLoadErr(pj.error || 'Couldn’t load the catalog.')
      setProducts(Array.isArray(pj.products) ? pj.products : [])
      if (s?.ok) setStock((await s.json().catch(() => ({}))).stock ?? {})
      if (c?.ok) setCoverage((await c.json().catch(() => ({}))).coverage ?? {})
      if (g?.ok) { setIsCorporate(true); setGgCosts((await g.json().catch(() => ({}))).costs ?? {}) }
    } catch { setLoadErr('Couldn’t load the catalog.') }
    setLoading(false)
  }, [])
  useEffect(() => { void load() }, [load])

  // Deep link: /?tab=catalog&product=<id> opens the product page; the URL follows the open product.
  useEffect(() => { try { const id = new URLSearchParams(window.location.search).get('product'); if (id) setOpenId(id) } catch { /* ignore */ } }, [])
  useEffect(() => {
    try {
      const u = new URL(window.location.href)
      if (openId) u.searchParams.set('product', openId); else u.searchParams.delete('product')
      window.history.replaceState({}, '', u.pathname + (u.search ? u.search : ''))
    } catch { /* ignore */ }
  }, [openId])
  useEffect(() => { try { localStorage.setItem('gg_catalog_view', view) } catch { /* ignore */ } }, [view])

  const hasManual = useCallback((p: ProductRow) => !!p.manual_url || (coverage[p.id]?.chunks ?? 0) > 0, [coverage])
  const isLow = useCallback((p: ProductRow) => { const s = stock[p.id]; return !!s && s.min > 0 && s.onHand < s.min }, [stock])
  const marginOf = (p: ProductRow) => calcMargin(Number(p.dealer_cost) || 0, Number(p.sell_price) || 0)

  const counts = useMemo(() => {
    const act = products.filter(p => p.active !== false)
    return {
      active: act.length,
      low: act.filter(isLow).length,
      noprice: act.filter(p => !(Number(p.sell_price) > 0) && catOf(p) !== 'Labor').length,
      lowmargin: act.filter(p => { const m = marginOf(p); return m !== null && m < 25 }).length,
      nomanual: act.filter(p => !hasManual(p) && !['Labor', 'Wire & Hardware'].includes(catOf(p))).length,
      archived: products.length - act.length,
    }
  }, [products, isLow, hasManual])

  const base = useMemo(() => products.filter(p => {
    switch (kpi) {
      case 'archived': return p.active === false
      case 'low': return p.active !== false && isLow(p)
      case 'noprice': return p.active !== false && !(Number(p.sell_price) > 0) && catOf(p) !== 'Labor'
      case 'lowmargin': { const m = marginOf(p); return p.active !== false && m !== null && m < 25 }
      case 'nomanual': return p.active !== false && !hasManual(p) && !['Labor', 'Wire & Hardware'].includes(catOf(p))
      default: return p.active !== false
    }
  }), [products, kpi, isLow, hasManual])

  const chips = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of base) m.set(catOf(p), (m.get(catOf(p)) ?? 0) + 1)
    const order = [...CATEGORIES.filter(c => m.has(c)), ...Array.from(m.keys()).filter(c => !(CATEGORIES as readonly string[]).includes(c)).sort()]
    return [{ label: 'All', count: base.length }, ...order.map(c => ({ label: c, count: m.get(c) ?? 0 }))]
  }, [base])
  const brands = useMemo(() => Array.from(new Set(products.map(p => p.brand).filter(Boolean) as string[])).sort(), [products])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    const xs = base.filter(p => (cat === 'All' || catOf(p) === cat) && (!brand || p.brand === brand) &&
      (!q || `${p.name} ${p.sku ?? ''} ${p.brand ?? ''} ${p.category ?? ''} ${p.subcategory ?? ''} ${p.adi_sku ?? ''} ${(p.tags ?? []).join(' ')}`.toLowerCase().includes(q)))
    const by: Record<Sort, (a: ProductRow, b: ProductRow) => number> = {
      name: (a, b) => a.name.localeCompare(b.name),
      price: (a, b) => (Number(b.sell_price) || 0) - (Number(a.sell_price) || 0),
      margin: (a, b) => (marginOf(a) ?? 999) - (marginOf(b) ?? 999),
      updated: (a, b) => String(b.updated_at ?? '').localeCompare(String(a.updated_at ?? '')),
      stock: (a, b) => (stock[a.id]?.onHand ?? -1) - (stock[b.id]?.onHand ?? -1),
    }
    return xs.sort(by[sort])
  }, [base, cat, brand, query, sort, stock])

  useEffect(() => { setSel(new Set()) }, [kpi, cat, brand, query])

  const upsertLocal = (row: ProductRow) => setProducts(prev => { const i = prev.findIndex(p => p.id === row.id); if (i >= 0) { const n = prev.slice(); n[i] = { ...prev[i], ...row }; return n } return [row, ...prev] })

  // ── Bulk ────────────────────────────────────────────────────────────────────
  async function bulkPatch(label: string, make: (p: ProductRow) => Record<string, unknown> | null) {
    const targets = products.filter(p => sel.has(p.id))
    if (!targets.length || busy) return
    setBusy(true); setMsg(`${label}…`)
    let ok = 0, denied = 0, failed = 0
    for (const p of targets) {
      const patch = make(p); if (!patch) continue
      const r = await fetch('/api/products', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id, ...patch }) }).catch(() => null)
      if (r?.ok) { ok++; const j = await r.json().catch(() => ({})); if (j.product) upsertLocal(j.product) } else if (r?.status === 403) denied++; else failed++
    }
    setBusy(false); setSel(new Set())
    setMsg(`${label}: ${ok} updated${denied ? ` · ${denied} are Gate Guard catalog items you can’t change` : ''}${failed ? ` · ${failed} didn’t save` : ''}.`)
  }
  const adjustPrices = () => {
    const n = Number(pct)
    if (!isFinite(n) || n === 0 || n < -90 || n > 500) { setMsg('Enter a percent like 5 or -10.'); return }
    void bulkPatch(`Prices ${n > 0 ? 'up' : 'down'} ${Math.abs(n)}%`, p => { const s = Number(p.sell_price) || 0; return s > 0 ? { sell_price: Math.round(s * (1 + n / 100) * 100) / 100 } : null })
    setPct('')
  }

  // ── Import ──────────────────────────────────────────────────────────────────
  const [csvText, setCsvText] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const preview = useMemo(() => {
    const grid = parseCsv(csvText)
    if (grid.length < 2) return { rows: [] as Record<string, unknown>[], cols: [] as string[], error: csvText.trim() ? 'Add a header row and at least one product row.' : '' }
    const cols = grid[0].map(h => { const k = h.trim().toLowerCase().replace(/[$()]/g, '').trim(); return HEADER_ALIASES[k] ?? k.replace(/\s+/g, '_') })
    if (!cols.includes('name') && !cols.includes('sku')) return { rows: [], cols, error: 'The first row needs column names — at least “name” or “sku”.' }
    const rows = grid.slice(1).map(r => {
      const o: Record<string, unknown> = {}
      cols.forEach((c, i) => { if (!(CSV_COLS as readonly string[]).includes(c)) return; const v = (r[i] ?? '').trim(); if (v === '') return; o[c] = c === 'active' ? !/^(n|no|false|0)$/i.test(v) : NUM_COLS.has(c) ? Number(v.replace(/[^0-9.]/g, '')) || 0 : v })
      if (!o.name && o.sku) o.name = o.sku
      if (o.sku) o.sku = String(o.sku).toUpperCase()
      return o
    }).filter(o => o.name)
    return { rows, cols, error: rows.length ? '' : 'No product rows found.' }
  }, [csvText])
  async function doImport() {
    if (!preview.rows.length || busy) return
    setBusy(true)
    const r = await fetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'upsert', rows: preview.rows }) }).catch(() => null)
    const j = r ? await r.json().catch(() => ({})) : {}
    setBusy(false)
    if (!r?.ok) { setMsg(j.error || 'Import failed.'); return }
    setImporting(false); setCsvText('')
    setMsg(`Imported ${(j.products ?? []).length} products${j.skipped?.length ? ` · skipped ${j.skipped.length} that belong to the Gate Guard catalog` : ''}.`)
    void load()
  }

  const allSel = shown.length > 0 && shown.every(p => sel.has(p.id))
  const toggle = (id: string) => setSel(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const KPIS: { k: Kpi; l: string; s: string; dot: string }[] = [
    { k: 'active', l: 'Products', s: 'active in the catalog', dot: BRAND },
    { k: 'low', l: 'Low stock', s: 'below the minimum', dot: RED },
    { k: 'noprice', l: 'Needs a price', s: 'no sell price set', dot: ORANGE },
    { k: 'lowmargin', l: 'Low margin', s: 'under 25%', dot: ORANGE },
    { k: 'nomanual', l: 'No manual', s: 'AI can’t help on jobs', dot: '#8E8E93' },
    { k: 'archived', l: 'Archived', s: 'hidden from quotes', dot: '#8E8E93' },
  ]

  return <div className="ct">
    <style>{CSS}</style>
    <header className="ct-hd">
      <div>
        <h1>Catalog</h1>
        <div className="sub">{counts.active} products — one list for quotes, jobs, drawings, stock and the tech app</div>
      </div>
      <div className="ct-acts">
        <button type="button" className="ct-b dark" onClick={() => setImporting(true)}>Import CSV</button>
        <button type="button" className="ct-b dark" onClick={() => download(`catalog-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(shown))} disabled={!shown.length}>Export</button>
        <button type="button" className="ct-b pri" onClick={() => setEditing(emptyForm())}>+ New product</button>
      </div>
    </header>

    <div className="ct-kpis">
      {KPIS.map(x => <button key={x.k} type="button" className="ct-kpi" aria-pressed={kpi === x.k} onClick={() => { setKpi(x.k); setCat('All') }}>
        <div className="l"><span className="ct-dot" style={{ background: x.dot }} />{x.l}</div>
        <div className="v" style={{ color: x.k === 'low' && counts.low ? RED : TEXT }}>{loading ? '—' : counts[x.k]}</div>
        <div className="s">{x.s}</div>
      </button>)}
    </div>

    {msg && <div role="status" style={{ background: /n’t|fail|Couldn|Enter/i.test(msg) ? '#FFECEC' : '#E8F6EC', color: /n’t|fail|Couldn|Enter/i.test(msg) ? RED : GREEN, borderRadius: 10, padding: '8px 12px', fontSize: 13, marginBottom: 12, display: 'flex', justifyContent: 'space-between', gap: 10 }}>{msg}<button type="button" onClick={() => setMsg(null)} style={{ border: 0, background: 'none', cursor: 'pointer', color: 'inherit' }} aria-label="Dismiss">×</button></div>}

    <section className="ct-card" aria-label="Products">
      <div className="ct-bar">
        <input className="ct-in" style={{ flex: '1 1 240px', minWidth: 0 }} placeholder="Search name, SKU, brand, tag…" value={query} onChange={e => setQuery(e.target.value)} aria-label="Search products" />
        <select className="ct-in" value={brand} onChange={e => setBrand(e.target.value)} aria-label="Brand"><option value="">All brands</option>{brands.map(b => <option key={b} value={b}>{b}</option>)}</select>
        <select className="ct-in" value={sort} onChange={e => setSort(e.target.value as Sort)} aria-label="Sort">
          <option value="name">Name A–Z</option><option value="price">Price high–low</option><option value="margin">Lowest margin first</option><option value="stock">Lowest stock first</option><option value="updated">Recently changed</option>
        </select>
        <div className="ct-seg" role="group" aria-label="View">
          <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}>List</button>
          <button type="button" aria-pressed={view === 'grid'} onClick={() => setView('grid')}>Grid</button>
        </div>
      </div>
      <div className="ct-chips">{chips.map(c => <button key={c.label} type="button" className="ct-chip" aria-pressed={cat === c.label} onClick={() => setCat(c.label)}>{c.label} <span style={{ opacity: .6 }}>{c.count}</span></button>)}</div>

      {sel.size > 0 && <div className="ct-bulk" role="region" aria-label="Bulk actions">
        <b style={{ fontWeight: 600 }}>{sel.size} selected</b>
        <select className="ct-in" style={{ height: 32 }} value="" aria-label="Change category" onChange={e => { const v = e.target.value; if (v) void bulkPatch(`Moved to ${v}`, () => ({ category: v })) }}>
          <option value="">Change category…</option>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          <input className="ct-in" style={{ height: 32, width: 84 }} placeholder="+5 %" inputMode="decimal" value={pct} onChange={e => setPct(e.target.value)} aria-label="Change prices by percent" />
          <button type="button" className="ct-b line" style={{ height: 32 }} onClick={adjustPrices} disabled={busy}>Change prices</button>
        </span>
        {kpi === 'archived'
          ? <button type="button" className="ct-b line" style={{ height: 32 }} disabled={busy} onClick={() => void bulkPatch('Made active', () => ({ active: true }))}>Make active</button>
          : <button type="button" className="ct-b line" style={{ height: 32 }} disabled={busy} onClick={() => void bulkPatch('Archived', () => ({ active: false }))}>Archive</button>}
        <button type="button" className="ct-b line" style={{ height: 32 }} onClick={() => download('catalog-selected.csv', toCsv(products.filter(p => sel.has(p.id))))}>Export</button>
        <button type="button" className="ct-b line" style={{ height: 32, marginLeft: 'auto' }} onClick={() => setSel(new Set())}>Clear</button>
      </div>}

      {loading ? <div className="ct-empty">Loading the catalog…</div>
        : loadErr ? <div className="ct-empty" style={{ color: RED }}>{loadErr} <button type="button" className="ct-b line" onClick={() => void load()}>Try again</button></div>
        : shown.length === 0 ? <div className="ct-empty">{products.length === 0 ? 'No products yet. Add one, or import a CSV.' : 'Nothing matches. Try another search or filter.'}</div>
        : view === 'list' ? <div style={{ overflowX: 'auto' }}><table className="ct-tbl">
          <thead><tr>
            <th style={{ width: 34 }}><input type="checkbox" aria-label="Select all" checked={allSel} onChange={() => setSel(allSel ? new Set() : new Set(shown.map(p => p.id)))} /></th>
            <th>Product</th><th className="hide-sm">Category</th><th className="n hide-sm">Cost</th><th className="n">Price</th><th className="n">Margin</th><th className="n hide-sm">Labor</th><th className="n hide-sm">Stock</th><th className="hide-sm">Manual</th>
          </tr></thead>
          <tbody>{shown.slice(0, 600).map(p => {
            const m = marginOf(p), s = stock[p.id], low = isLow(p)
            return <tr key={p.id} onClick={() => setOpenId(p.id)} style={{ opacity: p.active === false ? .6 : 1 }}>
              <td onClick={e => e.stopPropagation()}><input type="checkbox" aria-label={`Select ${p.name}`} checked={sel.has(p.id)} onChange={() => toggle(p.id)} /></td>
              <td><div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><ProductThumb url={p.image_url} brand={p.brand ?? ''} size={36} /><div style={{ minWidth: 0 }}><div className="ct-nm">{p.name}</div><div className="ct-sm">{[p.brand, p.sku].filter(Boolean).join(' · ') || '—'}{p.org_id ? ' · yours' : ''}</div></div></div></td>
              <td className="hide-sm" style={{ color: MUTED, whiteSpace: 'nowrap' }}>{catOf(p)}</td>
              <td className="n hide-sm" style={{ color: MUTED }}>{fmt$(p.dealer_cost)}</td>
              <td className="n" style={{ fontWeight: 600, color: Number(p.sell_price) > 0 ? TEXT : ORANGE }}>{Number(p.sell_price) > 0 ? fmt$(p.sell_price) : 'No price'}</td>
              <td className="n" style={{ color: marginColor(m), fontWeight: 600 }}>{m != null ? `${m}%` : '—'}</td>
              <td className="n hide-sm" style={{ color: MUTED }}>{p.labor_hours != null ? `${p.labor_hours} h` : '—'}</td>
              <td className="n hide-sm" style={{ color: low ? RED : MUTED, fontWeight: low ? 600 : 400 }}>{s ? `${s.onHand}${low ? ' · low' : ''}` : '—'}</td>
              <td className="hide-sm">{hasManual(p) ? <span className="ct-tag" style={{ background: '#E8F6EC', color: GREEN }}>AI ready</span> : <span className="ct-tag" style={{ background: '#F0F1F4', color: MUTED }}>None</span>}</td>
            </tr>
          })}</tbody>
        </table>{shown.length > 600 && <div className="ct-empty">Showing the first 600 — search to narrow it down.</div>}</div>
        : <div className="ct-grid">{shown.slice(0, 600).map(p => {
          const m = marginOf(p), low = isLow(p)
          return <div key={p.id} role="button" tabIndex={0} className="ct-gc" onClick={() => setOpenId(p.id)} onKeyDown={e => { if (e.key === 'Enter') setOpenId(p.id) }} style={{ opacity: p.active === false ? .6 : 1 }}>
            <input type="checkbox" aria-label={`Select ${p.name}`} checked={sel.has(p.id)} onClick={e => e.stopPropagation()} onChange={() => toggle(p.id)} style={{ position: 'absolute', top: 10, right: 10, width: 16, height: 16 }} />
            <ProductThumb url={p.image_url} brand={p.brand ?? ''} size={64} />
            <div style={{ minWidth: 0 }}><div className="ct-nm" style={{ whiteSpace: 'normal' }}>{p.name}</div><div className="ct-sm">{[p.brand, p.sku].filter(Boolean).join(' · ')}</div></div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 'auto' }}>
              <span style={{ fontWeight: 600, fontSize: 16, color: Number(p.sell_price) > 0 ? TEXT : ORANGE }}>{Number(p.sell_price) > 0 ? fmt$(p.sell_price) : 'No price'}</span>
              {m != null && <span style={{ color: marginColor(m), fontSize: 12.5, fontWeight: 600 }}>{m}%</span>}
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                {low && <span className="ct-tag" style={{ background: '#FFECEC', color: RED }}>Low</span>}
                {hasManual(p) && <span className="ct-tag" style={{ background: '#E8F6EC', color: GREEN }}>AI</span>}
              </span>
            </div>
          </div>
        })}</div>}
    </section>

    {importing && <div className="ct-modal" onClick={() => !busy && setImporting(false)}>
      <div className="p" role="dialog" aria-label="Import products" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}><b style={{ fontSize: 17, fontWeight: 600 }}>Import products</b><button type="button" className="ct-b line" onClick={() => setImporting(false)}>Close</button></div>
        <p style={{ margin: '0 0 10px', color: MUTED, fontSize: 13.5, lineHeight: 1.5 }}>Use a CSV with a header row. Recognized columns: {CSV_COLS.join(', ')}. Rows with a SKU that’s already in the catalog are updated. Tip: Export first to get a ready-made template.</p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input ref={fileRef} type="file" accept=".csv,text/csv,.txt" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = ev => setCsvText(String(ev.target?.result ?? '')); r.readAsText(f); e.target.value = '' }} />
          <button type="button" className="ct-b line" onClick={() => fileRef.current?.click()}>Choose a CSV file</button>
          <button type="button" className="ct-b line" onClick={() => download('catalog-template.csv', CSV_COLS.join(',') + '\nLM-CSW24UL,LiftMaster CSW24UL Slide Gate Operator,LiftMaster,Gate Operator,Slide,,,4200,2850,3600,6,each,24,,,yes')}>Download template</button>
        </div>
        <textarea rows={7} value={csvText} onChange={e => setCsvText(e.target.value)} placeholder="…or paste CSV here" aria-label="CSV text" style={{ width: '100%', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12.5, border: '1px solid rgba(0,0,0,.12)', borderRadius: 10, padding: 10 }} />
        {preview.error && <div style={{ color: RED, fontSize: 13, marginTop: 6 }}>{preview.error}</div>}
        {preview.rows.length > 0 && <div style={{ marginTop: 8, fontSize: 13, color: MUTED }}>Ready: <b style={{ color: TEXT }}>{preview.rows.length}</b> products — e.g. {preview.rows.slice(0, 3).map(r => String(r.name)).join(', ')}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}><button type="button" className="ct-b pri" disabled={busy || !preview.rows.length} onClick={doImport}>{busy ? 'Importing…' : `Import ${preview.rows.length || ''} products`}</button></div>
      </div>
    </div>}

    {editing && <ProductEditor initial={editing} catalog={products} isCorporate={isCorporate} onClose={() => setEditing(null)} onSaved={row => { upsertLocal(row); setEditing(null); setOpenId(row.id) }} />}
    {openId && <ProductPage id={openId} catalog={products} isCorporate={isCorporate} ggCosts={ggCosts} onClose={() => setOpenId(null)} onOpen={id => setOpenId(id)} onChanged={row => { if (row) upsertLocal(row); if (isCorporate) fetch('/api/admin/product-costs', { cache: 'no-store' }).then(r => r.json()).then(j => setGgCosts(j.costs ?? {})).catch(() => {}) }} />}
  </div>
}
