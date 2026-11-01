'use client'
/**
 * ProductPage — one catalog item, full screen (same look as the job page).
 * Data: GET /api/products/[id] (product + stock + where used + manuals + kit).
 * Tabs: Overview · Stock · Where used · Manuals & help · Drawing setup.
 * Editing opens the shared ProductEditor; Gate Guard cost is corporate-only.
 */
import React, { useCallback, useEffect, useState } from 'react'
import {
  TEXT, MUTED, BRAND, GREEN, ORANGE, RED, LINE, FONT, SHADOW,
  type ProductRow, type ProductForm, fmt$, calcMargin, marginColor, rowToForm, productHref, ProductThumb,
} from '@/components/nexus/catalog/shared'
import { ProductEditor } from '@/components/nexus/catalog/ProductEditor'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>
type Detail = {
  product: ProductRow & Row; canEdit: boolean
  accessories: { product_id: string; qty: number; required: boolean; product: Row }[]
  partOfKits: Row[]; stock: Row[]
  used: { quotes: Row[]; jobs: Row[]; installed: Row[]; purchases: Row[] }
  manuals: { url: string; pages: number }[]; articles: Row[]
  counts: { onHand: number; onTruck: number; minStock: number; low: boolean; quotes: number; jobs: number; installed: number; purchases: number; quotedQty: number; usedQty: number }
}
const TABS = ['Overview', 'Stock', 'Where used', 'Manuals & help', 'Drawing setup'] as const
type Tab = (typeof TABS)[number]
const day = (d?: string | null) => (d ? new Date(String(d).length <= 10 ? `${d}T12:00:00` : d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—')
const cap = (s?: string | null) => (s ? s.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase()) : '—')
const unitLabel = (u?: string | null) => (!u || u === 'each' ? 'each' : u === 'ft' ? 'per foot' : `per ${u}`)

const CSS = `
.pp{position:fixed;inset:0;z-index:130;overflow-y:auto;background-color:#EEF2F7;background-image:linear-gradient(180deg,#0E1726 0px,#18263F 200px,#283B5E 380px,#5D7193 560px,#B4C1D6 760px,#E2E8F1 940px,#EEF2F7 1100px);background-repeat:no-repeat;background-attachment:local;color:${TEXT};font-family:${FONT};letter-spacing:-.01em;-webkit-overflow-scrolling:touch}
.pp *{box-sizing:border-box}
.pp-wrap{max-width:1180px;margin:0 auto;padding:20px 24px calc(140px + env(safe-area-inset-bottom))}
.pp-top{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.pp-back{display:inline-flex;align-items:center;gap:6px;min-height:34px;border:0;background:none;color:#8EC1FF;font:500 14px ${FONT};cursor:pointer;padding:0 2px}
.pp-tbtn{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 12px;border-radius:10px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);color:#fff;font:500 13px ${FONT};cursor:pointer;white-space:nowrap}
.pp-tbtn.pri{background:${BRAND};border-color:${BRAND};font-weight:600}
.pp-hd{margin:14px 0 16px}
.pp-hd .no{color:#8EC1FF;font-size:13px;font-weight:500}
.pp-hd h1{margin:2px 0 0;color:#fff;font-size:28px;font-weight:600;letter-spacing:-.025em;line-height:1.2}
.pp-hd .sub{color:rgba(255,255,255,.72);font-size:14px;margin-top:4px;display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.pp-pill{display:inline-flex;align-items:center;padding:2px 9px;border-radius:999px;font-size:12px;font-weight:600}
.pp-cmd{background:#fff;border-radius:16px;box-shadow:${SHADOW};padding:16px 18px;margin-bottom:16px;display:flex;gap:18px;align-items:center}
.pp-kpis{flex:1;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));row-gap:14px}
.pp-k{padding:0 14px;border-left:1px solid ${LINE};min-width:0}
.pp-k:nth-child(4n+1){border-left:0;padding-left:0}
.pp-k .l{font-size:12px;color:${MUTED};font-weight:500}
.pp-k .v{font-size:18px;font-weight:600;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pp-k .s{font-size:12px;color:${MUTED}}
.pp-tabs{display:flex;gap:2px;padding:3px;border-radius:12px;background:#E8EBF0;width:max-content;max-width:100%;overflow-x:auto;position:sticky;top:8px;z-index:3;box-shadow:0 1px 2px rgba(0,0,0,.06);margin-bottom:16px}
.pp-tabs button{min-height:34px;padding:0 16px;border-radius:9px;border:0;background:none;font:500 13.5px ${FONT};color:#3A3A3C;cursor:pointer;white-space:nowrap}
.pp-tabs button[aria-selected=true]{background:#fff;color:${TEXT};font-weight:600;box-shadow:0 1px 2px rgba(0,0,0,.08)}
.pp-grid{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:16px;align-items:start}
.pp-card{background:#fff;border-radius:16px;box-shadow:${SHADOW};padding:16px 18px}
.pp-card h2{margin:0 0 10px;font-size:15px;font-weight:600}
.pp-card+.pp-card{margin-top:16px}
.pp-dl{display:grid;grid-template-columns:140px minmax(0,1fr);row-gap:9px;font-size:14px}
.pp-dl dt{color:${MUTED}}.pp-dl dd{margin:0}
.pp-row{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:10px;background:#F7F8FA;text-decoration:none;color:inherit;font-size:14px}
.pp-row+.pp-row{margin-top:6px}
a.pp-row:hover{background:#EEF0F4}
.pp-row .m{color:${MUTED};font-size:12.5px;white-space:nowrap}
.pp-empty{color:${MUTED};font-size:13.5px}
.pp-tbl{width:100%;border-collapse:collapse;font-size:13.5px}
.pp-tbl th{text-align:left;font-weight:500;color:${MUTED};font-size:12px;padding:6px 8px;border-bottom:1px solid ${LINE}}
.pp-tbl td{padding:9px 8px;border-bottom:1px solid ${LINE}}
.pp-tbl td.n,.pp-tbl th.n{text-align:right;font-variant-numeric:tabular-nums}
.pp-sec{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}
.pp-sec h2{margin:0}
.pp-btn{display:inline-flex;align-items:center;height:32px;padding:0 12px;border-radius:9px;border:1px solid rgba(0,0,0,.12);background:#fff;color:${TEXT};font:500 13px ${FONT};cursor:pointer;text-decoration:none}
@media (max-width:860px){.pp-grid{grid-template-columns:minmax(0,1fr)}.pp-cmd{flex-direction:column;align-items:stretch}.pp-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.pp-k{border-left:0!important;padding-left:0!important}}
@media (max-width:640px){.pp-wrap{padding:16px 14px calc(140px + env(safe-area-inset-bottom))}.pp-hd h1{font-size:23px}.pp-dl{grid-template-columns:110px minmax(0,1fr)}.pp-tbl .hide-sm{display:none}}
`

export function ProductPage({ id, onClose, onChanged, onOpen, catalog = [], isCorporate = false, ggCosts = {} }: {
  id: string
  onClose: () => void
  onChanged?: (row: ProductRow) => void
  onOpen?: (id: string) => void
  catalog?: ProductRow[]
  isCorporate?: boolean
  ggCosts?: Record<string, number>
}) {
  const [d, setD] = useState<Detail | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('Overview')
  const [editing, setEditing] = useState<ProductForm | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setErr(null)
    try {
      const r = await fetch(`/api/products/${id}`, { cache: 'no-store' })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(j.error || 'Couldn’t load this product.'); return }
      setD(j as Detail)
    } catch { setErr('Couldn’t load this product.') }
  }, [id])
  useEffect(() => { setD(null); setTab('Overview'); void load() }, [load])
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && !editing) onClose() }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose, editing])

  const p = d?.product
  const sell = Number(p?.sell_price) || 0, cost = Number(p?.dealer_cost) || 0
  const margin = calcMargin(cost, sell)
  const gg = p ? ggCosts[p.id] ?? null : null

  async function setActive(active: boolean) {
    if (!p) return
    setBusy(true); setMsg(null)
    const r = await fetch('/api/products', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id, active }) }).catch(() => null)
    const j = r ? await r.json().catch(() => ({})) : {}
    setBusy(false)
    if (!r?.ok) { setMsg(j.error || 'That didn’t save.'); return }
    onChanged?.(j.product); void load()
  }
  function copyLink() {
    const url = `${window.location.origin}${productHref(id)}`
    navigator.clipboard?.writeText(url).then(() => { setMsg('Link copied.'); setTimeout(() => setMsg(null), 1500) }).catch(() => {})
  }

  const kitTotal = (d?.accessories ?? []).reduce((a, x) => a + (Number(x.product?.sell_price) || 0) * (x.qty || 1), 0)
  const dm = (p?.design_meta && typeof p.design_meta === 'object' ? p.design_meta : {}) as Row

  return <div className="pp" role="dialog" aria-label={p?.name ?? 'Product'}>
    <style>{CSS}</style>
    <div className="pp-wrap">
      <div className="pp-top">
        <button type="button" className="pp-back" onClick={onClose}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><path d="M15 18l-6-6 6-6" /></svg> Catalog</button>
        {p && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="pp-tbtn" onClick={copyLink}>Copy link</button>
          <button type="button" className="pp-tbtn" onClick={() => setEditing({ ...rowToForm(p), id: undefined, sku: '', name: `${p.name} (copy)` })}>Duplicate</button>
          {d?.canEdit && <button type="button" className="pp-tbtn" disabled={busy} onClick={() => setActive(p.active === false)}>{p.active === false ? 'Make active' : 'Archive'}</button>}
          {d?.canEdit && <button type="button" className="pp-tbtn pri" onClick={() => setEditing(rowToForm(p, gg))}>Edit</button>}
        </div>}
      </div>

      {err ? <div style={{ color: '#fff', marginTop: 30 }}>{err} <button type="button" className="pp-tbtn" onClick={() => void load()}>Try again</button></div>
        : !p || !d ? <div style={{ color: 'rgba(255,255,255,.75)', marginTop: 30 }}>Loading the product…</div>
        : <>
          <div className="pp-hd">
            <div className="no">{[p.brand, p.sku].filter(Boolean).join(' · ') || 'Product'}</div>
            <h1>{p.name}</h1>
            <div className="sub">
              <span>{[p.category, p.subcategory].filter(Boolean).join(' · ') || 'Uncategorized'}</span>
              {p.active === false && <span className="pp-pill" style={{ background: 'rgba(255,255,255,.14)', color: '#fff' }}>Archived</span>}
              {p.org_id && <span className="pp-pill" style={{ background: 'rgba(255,255,255,.14)', color: '#fff' }}>Your company’s item</span>}
              {d.counts.low && <span className="pp-pill" style={{ background: '#FFECEC', color: RED }}>Low stock</span>}
              {!d.canEdit && <span style={{ fontSize: 12.5 }}>Gate Guard catalog item — tap Duplicate to make your own version.</span>}
            </div>
          </div>
          {msg && <div role="status" style={{ background: /didn|n’t|Couldn/.test(msg) ? '#FFECEC' : '#E8F6EC', color: /didn|n’t|Couldn/.test(msg) ? RED : GREEN, borderRadius: 10, padding: '8px 12px', fontSize: 13, marginBottom: 12 }}>{msg}</div>}

          <section className="pp-cmd" aria-label="Key numbers">
            <ProductThumb url={p.image_url} brand={p.brand ?? ''} size={112} />
            <div className="pp-kpis">
              <div className="pp-k"><div className="l">Sell price</div><div className="v" style={{ color: sell ? TEXT : ORANGE }}>{sell ? fmt$(sell) : 'Not set'}</div><div className="s">{unitLabel(p.unit)}</div></div>
              <div className="pp-k"><div className="l">Dealer cost</div><div className="v">{fmt$(cost)}</div><div className="s">{isCorporate && gg != null ? `Gate Guard cost ${fmt$(gg)}` : p.msrp ? `MSRP ${fmt$(p.msrp)}` : ' '}</div></div>
              <div className="pp-k"><div className="l">Margin</div><div className="v" style={{ color: marginColor(margin) }}>{margin != null ? `${margin}%` : '—'}</div><div className="s">{margin != null ? `${fmt$(sell - cost)} per ${p.unit && p.unit !== 'each' ? p.unit : 'unit'}` : 'needs cost and price'}</div></div>
              <div className="pp-k"><div className="l">Install labor</div><div className="v">{p.labor_hours != null ? `${p.labor_hours} hr` : '—'}</div><div className="s">{p.warranty_months ? `${p.warranty_months}-month warranty` : ' '}</div></div>
              <div className="pp-k"><div className="l">On hand</div><div className="v" style={{ color: d.counts.low ? RED : TEXT }}>{d.stock.length ? d.counts.onHand : '—'}</div><div className="s">{d.stock.length ? `${d.counts.onTruck} on trucks · min ${d.counts.minStock}` : 'not tracked'}</div></div>
              <div className="pp-k"><div className="l">On jobs</div><div className="v">{d.counts.jobs}</div><div className="s">{d.counts.usedQty ? `${d.counts.usedQty} used` : ' '}</div></div>
              <div className="pp-k"><div className="l">In quotes</div><div className="v">{d.counts.quotes}</div><div className="s">{d.counts.quotedQty ? `${d.counts.quotedQty} quoted` : ' '}</div></div>
              <div className="pp-k"><div className="l">Installed at sites</div><div className="v">{d.counts.installed}</div><div className="s">{d.manuals.length ? `${d.manuals.length} manual${d.manuals.length > 1 ? 's' : ''}` : 'no manual yet'}</div></div>
            </div>
          </section>

          <div className="pp-tabs" role="tablist">
            {TABS.map(t => <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
              {t}{t === 'Where used' ? ` (${d.counts.jobs + d.counts.quotes + d.counts.installed + d.counts.purchases})` : t === 'Stock' && d.stock.length ? ` (${d.stock.length})` : ''}
            </button>)}
          </div>

          {tab === 'Overview' && <div className="pp-grid">
            <div>
              <div className="pp-card">
                <h2>About</h2>
                {p.description ? <p style={{ margin: '0 0 10px', fontSize: 14.5, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{p.description}</p> : <p className="pp-empty" style={{ margin: '0 0 10px' }}>No description yet.</p>}
                {p.specs && <><h2 style={{ marginTop: 14 }}>Specs</h2><p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap', color: '#3A3A3C' }}>{p.specs}</p></>}
              </div>
              <div className="pp-card">
                <div className="pp-sec"><h2>Goes with this item ({d.accessories.length})</h2>{kitTotal > 0 && <span className="pp-empty">Kit adds {fmt$(kitTotal)}</span>}</div>
                {d.accessories.length === 0 ? <p className="pp-empty" style={{ margin: 0 }}>No accessories yet.{d.canEdit ? ' Add mounts, power supplies and other parts that should go on a quote with it — Edit → Goes with this item.' : ''}</p>
                  : d.accessories.map(a => <a key={a.product_id} className="pp-row" href={productHref(a.product_id)} onClick={e => { if (onOpen) { e.preventDefault(); onOpen(a.product_id) } }}>
                    <ProductThumb url={a.product.image_url} brand={a.product.brand ?? ''} size={30} />
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.qty > 1 ? `${a.qty} × ` : ''}{a.product.name}</span>
                    {a.required && <span className="pp-pill" style={{ background: '#FFF4E5', color: ORANGE }}>Required</span>}
                    <span className="m">{fmt$(a.product.sell_price)}</span>
                  </a>)}
                {d.partOfKits.length > 0 && <><h2 style={{ marginTop: 16 }}>Part of these kits</h2>
                  {d.partOfKits.map(k => <a key={k.id} className="pp-row" href={productHref(k.id)} onClick={e => { if (onOpen) { e.preventDefault(); onOpen(k.id) } }}><ProductThumb url={k.image_url} brand={k.brand ?? ''} size={26} /><span style={{ flex: 1 }}>{k.name}</span><span className="m">{k.sku}</span></a>)}</>}
              </div>
            </div>
            <div className="pp-card">
              <h2>Details</h2>
              <dl className="pp-dl">
                <dt>Brand</dt><dd>{p.brand || '—'}</dd>
                <dt>Model / SKU</dt><dd style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13 }}>{p.sku || '—'}</dd>
                <dt>ADI part #</dt><dd>{p.adi_sku || '—'}</dd>
                <dt>Category</dt><dd>{[p.category, p.subcategory].filter(Boolean).join(' · ') || '—'}</dd>
                <dt>Sold</dt><dd>{unitLabel(p.unit)}</dd>
                <dt>MSRP</dt><dd>{fmt$(p.msrp)}</dd>
                <dt>Warranty</dt><dd>{p.warranty_months ? `${p.warranty_months} months` : '—'}</dd>
                <dt>Field service</dt><dd>{p.field_service ? 'Shows in the tech app' : 'No'}</dd>
                <dt>Tags</dt><dd>{Array.isArray(p.tags) && p.tags.length ? p.tags.join(', ') : '—'}</dd>
                <dt>Updated</dt><dd>{day(p.updated_at)}</dd>
              </dl>
            </div>
          </div>}

          {tab === 'Stock' && <div className="pp-card">
            <div className="pp-sec"><h2>Stock by location</h2>{d.stock.length > 0 && <span className="pp-empty">{d.counts.onHand} on hand · {d.counts.onTruck} on trucks</span>}</div>
            {d.stock.length === 0 ? <p className="pp-empty" style={{ margin: 0 }}>This item isn’t stocked anywhere yet. Inventory items linked to this product show here, with the minimum to keep on hand.</p>
              : <div style={{ overflowX: 'auto' }}><table className="pp-tbl"><thead><tr><th>Location</th><th className="n">On hand</th><th className="n">On trucks</th><th className="n">Minimum</th><th className="n hide-sm">Reorder</th><th className="hide-sm">Supplier</th><th className="n hide-sm">Unit cost</th></tr></thead>
                <tbody>{d.stock.map(s => { const low = (Number(s.on_hand) || 0) < (Number(s.min_stock) || 0); return <tr key={s.id}>
                  <td>{s.location || s.name || 'Main stock'}</td>
                  <td className="n" style={{ color: low ? RED : TEXT, fontWeight: low ? 600 : 400 }}>{s.on_hand ?? 0}{low ? ' · low' : ''}</td>
                  <td className="n">{s.on_truck ?? 0}</td><td className="n">{s.min_stock ?? '—'}</td><td className="n hide-sm">{s.reorder_qty ?? '—'}</td>
                  <td className="hide-sm">{s.supplier || '—'}{s.supplier_sku ? <span className="pp-empty"> · {s.supplier_sku}</span> : null}</td>
                  <td className="n hide-sm">{fmt$(s.unit_cost)}</td>
                </tr> })}</tbody></table></div>}
            {d.used.purchases.length > 0 && <><h2 style={{ marginTop: 18 }}>On order</h2>
              {d.used.purchases.filter(po => (po.received ?? 0) < (po.qty ?? 0)).map(po => <div key={po.id} className="pp-row"><span style={{ flex: 1 }}>{po.po_number || 'Purchase order'} · {po.supplier || 'No supplier'}</span><span className="m">{po.qty - (po.received ?? 0)} coming{po.expected_at ? ` · ${day(po.expected_at)}` : ''}</span></div>)}
              {d.used.purchases.every(po => (po.received ?? 0) >= (po.qty ?? 0)) && <p className="pp-empty" style={{ margin: 0 }}>Nothing on order.</p>}</>}
          </div>}

          {tab === 'Where used' && <div className="pp-grid">
            <div>
              <div className="pp-card">
                <h2>Jobs ({d.used.jobs.length})</h2>
                {d.used.jobs.length === 0 ? <p className="pp-empty" style={{ margin: 0 }}>Not used on any job yet.</p>
                  : d.used.jobs.slice(0, 50).map(j => <a key={j.id} className="pp-row" href={`/maintenance/${j.id}`}><span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[j.wo_number, j.title].filter(Boolean).join(' · ')}</span><span className="m">{j.customer_name ? `${j.customer_name} · ` : ''}{cap(j.status)}{j.qty ? ` · ×${j.qty}` : ''}</span></a>)}
              </div>
              <div className="pp-card">
                <h2>Quotes ({d.used.quotes.length})</h2>
                {d.used.quotes.length === 0 ? <p className="pp-empty" style={{ margin: 0 }}>Not on any quote yet.</p>
                  : d.used.quotes.slice(0, 50).map(q => <a key={q.id} className="pp-row" href={`/quotes/${q.id}`}><span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[q.quote_number, q.title].filter(Boolean).join(' · ')}</span><span className="m">{cap(q.status)}{q.qty ? ` · ×${q.qty}` : ''} · {day(q.created_at)}</span></a>)}
              </div>
            </div>
            <div>
              <div className="pp-card">
                <h2>Installed at ({d.used.installed.length})</h2>
                {d.used.installed.length === 0 ? <p className="pp-empty" style={{ margin: 0 }}>Not recorded at any site.</p>
                  : d.used.installed.slice(0, 50).map(a => <a key={a.id} className="pp-row" href={`/?tab=systems&site=${a.site_id}`}><span style={{ flex: 1 }}>{a.site?.name ?? 'Site'}{a.location_note ? <span className="pp-empty"> · {a.location_note}</span> : null}</span><span className="m">{a.serial_number ? `SN ${a.serial_number}` : cap(a.status)}</span></a>)}
              </div>
              <div className="pp-card">
                <h2>Purchase orders ({d.used.purchases.length})</h2>
                {d.used.purchases.length === 0 ? <p className="pp-empty" style={{ margin: 0 }}>Never ordered through Nexus.</p>
                  : d.used.purchases.slice(0, 50).map(po => <div key={po.id} className="pp-row"><span style={{ flex: 1 }}>{po.po_number || 'PO'} · {po.supplier || 'No supplier'}</span><span className="m">{cap(po.status)} · ×{po.qty}{po.unit_cost ? ` @ ${fmt$(po.unit_cost)}` : ''}</span></div>)}
              </div>
            </div>
          </div>}

          {tab === 'Manuals & help' && <div className="pp-grid">
            <div className="pp-card">
              <div className="pp-sec"><h2>Manuals ({d.manuals.length})</h2>{d.canEdit && <button type="button" className="pp-btn" onClick={() => setEditing(rowToForm(p, gg))}>Add a manual</button>}</div>
              {d.manuals.length === 0 ? <p className="pp-empty" style={{ margin: 0 }}>No manual yet. Add one so AI Tech Support can answer wiring and troubleshooting questions on jobs.</p>
                : d.manuals.map(m => <a key={m.url} className="pp-row" href={m.url} target="_blank" rel="noreferrer"><span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{decodeURIComponent(m.url.split('/').pop() || 'Manual').replace(/^\d+-/, '')}</span><span className="m">{m.pages ? `${m.pages} pages indexed for AI` : 'Not indexed yet'}</span></a>)}
            </div>
            <div className="pp-card">
              <h2>Help articles ({d.articles.length})</h2>
              {d.articles.length === 0 ? <p className="pp-empty" style={{ margin: 0 }}>No articles for this item yet.</p>
                : d.articles.map(a => <div key={a.id} className="pp-row"><span style={{ flex: 1 }}>{a.title}</span><span className="m">{cap(a.difficulty || a.category)}</span></div>)}
              <p className="pp-empty" style={{ margin: '12px 0 0' }}>Tip: ask Lexi “how do I wire the {p.name}?” — it searches these manuals.</p>
            </div>
          </div>}

          {tab === 'Drawing setup' && <div className="pp-grid">
            <div className="pp-card">
              <div className="pp-sec"><h2>How it shows on system drawings</h2>{d.canEdit && <button type="button" className="pp-btn" onClick={() => setEditing(rowToForm(p, gg))}>Edit drawing setup</button>}</div>
              <dl className="pp-dl">
                <dt>Drawing role</dt><dd>{cap(dm.role) }</dd>
                <dt>Badge</dt><dd>{dm.abbr || '—'}</dd>
                <dt>Marker color</dt><dd>{dm.color ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 14, borderRadius: 4, background: dm.color }} />{dm.color}</span> : '—'}</dd>
                <dt>Default cable</dt><dd>{dm.defaultCable || '—'}</dd>
                <dt>Terminals</dt><dd>{dm.isBoard ? `${(dm.terminals ?? []).length} mapped` : 'No terminal strip'}</dd>
              </dl>
            </div>
            <div className="pp-card">
              <h2>Drawings</h2>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {[['Placement symbol', dm.placementImageUrl], ['Line drawing', dm.wiringImageUrl]].map(([l, u]) => <div key={l as string} style={{ textAlign: 'center' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {u ? <img src={u as string} alt={l as string} style={{ width: 120, height: 120, objectFit: 'contain', borderRadius: 10, border: `1px solid ${LINE}`, background: '#fff' }} /> : <div style={{ width: 120, height: 120, borderRadius: 10, border: `1px dashed ${LINE}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED, fontSize: 12 }}>none</div>}
                  <div className="pp-empty" style={{ marginTop: 4, fontSize: 12 }}>{l}</div>
                </div>)}
              </div>
            </div>
          </div>}
        </>}
    </div>

    {editing && <ProductEditor initial={editing} catalog={catalog} isCorporate={isCorporate} onClose={() => setEditing(null)} onSaved={row => {
      setEditing(null); onChanged?.(row)
      if (row.id !== id && onOpen) onOpen(row.id); else void load()
    }} />}
  </div>
}
