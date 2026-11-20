'use client'
/**
 * StockPanel — Catalog → Stock (migration 236; rules in lib/stock.ts).
 * Where parts are: the warehouse, each truck, each property's spare shelf.
 *   • By place — what's in each place; count an item, move parts, receive parts
 *   • Low stock — under the minimum (warehouse + trucks), with how many to order
 *   • History — every move, newest first
 *   • Old stock not linked to a product — link each line once to copy its count in
 * Data: GET /api/stock, /api/stock/moves. Dealers only ever see their own company's.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { TEXT, MUTED, BRAND, GREEN, ORANGE, RED, LINE, FONT, SHADOW, type ProductRow } from '@/components/nexus/catalog/shared'

type Loc = { id: string; org_id: string | null; kind: 'warehouse' | 'truck' | 'site'; name: string; technician_id: string | null; site_id: string | null; active: boolean }
type Lv = { location_id: string; product_id: string; qty: number; org_id: string | null }
type Prod = { id: string; name: string; sku: string | null; brand: string | null }
type Min = { org_id: string | null; product_id: string; min_qty: number }
type Legacy = { id: string; name: string; sku: string | null; on_hand: number; on_truck: number }
type Move = { id: string; product_id: string | null; kind: string; qty: number; from_location_id: string | null; to_location_id: string | null; unit_cost: number | null; note: string | null; created_by: string | null; created_at: string; work_order_id: string | null }
type Data = { ready: boolean; note?: string; locations: Loc[]; levels: Lv[]; products: Record<string, Prod>; minimums: Min[]; legacy: Legacy[] }
type Dialog = null | { kind: 'receive' | 'move' | 'place' } | { kind: 'count'; loc: Loc; product: string; now: number } | { kind: 'link'; item: Legacy }

const KIND_LABEL: Record<Loc['kind'], string> = { warehouse: 'Warehouses', truck: 'Trucks', site: 'Property spare shelves' }
const MOVE_LABEL: Record<string, string> = { opening: 'Starting count', receive: 'Received', transfer: 'Moved', use: 'Used on a job', return: 'Put back', count: 'Count fixed' }

const CSS = `
.sp{position:fixed;inset:0;z-index:130;overflow-y:auto;background:#EEF2F7;color:${TEXT};font-family:${FONT};letter-spacing:-.01em}
.sp *{box-sizing:border-box}
.sp-top{background:linear-gradient(180deg,#0E1726,#1B2B47);padding:18px 0 22px}
.sp-w{max-width:1100px;margin:0 auto;padding:0 20px}
.sp-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.sp h1{margin:8px 0 2px;color:#fff;font-size:26px;font-weight:600;letter-spacing:-.02em}
.sp .sub{color:rgba(255,255,255,.72);font-size:14px}
.sp-back{border:0;background:none;color:#8EC1FF;font:500 14px ${FONT};cursor:pointer;padding:0}
.sp-b{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 13px;border-radius:10px;border:1px solid rgba(0,0,0,.12);background:#fff;color:${TEXT};font:500 13px ${FONT};cursor:pointer;white-space:nowrap}
.sp-b.pri{background:${BRAND};border-color:${BRAND};color:#fff;font-weight:600}
.sp-b.dk{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.18);color:#fff}
.sp-b:disabled{opacity:.5;cursor:default}
.sp-seg{display:inline-flex;gap:2px;padding:3px;border-radius:10px;background:#E3E7EE;margin:16px 0 12px}
.sp-seg button{border:0;background:none;height:30px;padding:0 13px;border-radius:8px;font:500 13px ${FONT};color:#3A3A3C;cursor:pointer}
.sp-seg button[aria-pressed=true]{background:#fff;color:${TEXT};font-weight:600;box-shadow:0 1px 2px rgba(0,0,0,.08)}
.sp-card{background:#fff;border-radius:14px;box-shadow:${SHADOW};margin-bottom:12px;overflow:hidden}
.sp-ch{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid ${LINE}}
.sp-ch b{font-weight:600;font-size:15px}
.sp-it{display:flex;align-items:center;gap:10px;padding:9px 16px;border-bottom:1px solid ${LINE};font-size:14px}
.sp-it:last-child{border-bottom:0}
.sp-n{font-variant-numeric:tabular-nums;font-weight:600;min-width:44px;text-align:right}
.sp-m{color:${MUTED};font-size:12.5px}
.sp-h{font-size:12px;font-weight:600;color:${MUTED};text-transform:uppercase;letter-spacing:.04em;margin:16px 2px 8px}
.sp-empty{padding:16px;color:${MUTED};font-size:14px}
.sp-in{height:36px;border:1px solid rgba(0,0,0,.14);border-radius:9px;padding:0 10px;font:400 14px ${FONT};color:${TEXT};background:#fff;width:100%}
.sp-dlg{position:fixed;inset:0;z-index:140;background:rgba(15,23,42,.42);display:flex;align-items:center;justify-content:center;padding:16px}
.sp-dlg .p{width:min(460px,100%);background:#fff;border-radius:16px;padding:18px;display:grid;gap:10px}
.sp-dlg label{display:grid;gap:4px;font-size:12px;font-weight:600;color:${MUTED}}
`

export function StockPanel({ catalog, onClose, onChanged }: { catalog: ProductRow[]; onClose: () => void; onChanged?: () => void }) {
  const [d, setD] = useState<Data | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [view, setView] = useState<'place' | 'low' | 'history'>('place')
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [moves, setMoves] = useState<Move[] | null>(null)
  const [dlg, setDlg] = useState<Dialog>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setErr(null)
    try {
      const r = await fetch('/api/stock', { cache: 'no-store' })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(j.error ?? 'Couldn’t load stock.'); return }
      setD(j as Data)
    } catch { setErr('Couldn’t load stock.') }
  }, [])
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (view !== 'history') return
    fetch('/api/stock/moves?limit=150', { cache: 'no-store' }).then((r) => r.json()).then((j) => setMoves(j.moves ?? [])).catch(() => setMoves([]))
  }, [view, d])

  const prodName = useCallback((id: string | null) => {
    if (!id) return 'Part'
    const p = d?.products[id] ?? catalog.find((c) => c.id === id)
    return p ? p.name : 'Part'
  }, [d, catalog])
  const locName = (id: string | null) => d?.locations.find((l) => l.id === id)?.name ?? '—'

  const byLoc = useMemo(() => {
    const m = new Map<string, Lv[]>()
    for (const l of d?.levels ?? []) (m.get(l.location_id) ?? m.set(l.location_id, []).get(l.location_id)!).push(l)
    return m
  }, [d])
  const low = useMemo(() => {
    if (!d) return []
    const kind = new Map(d.locations.map((l) => [l.id, l.kind]))
    const have = new Map<string, number>()
    for (const l of d.levels) if (kind.get(l.location_id) !== 'site') have.set(l.product_id, (have.get(l.product_id) ?? 0) + l.qty)
    const mins = new Map<string, number>()
    for (const m of d.minimums) mins.set(m.product_id, (mins.get(m.product_id) ?? 0) + (Number(m.min_qty) || 0))
    return Array.from(mins.entries()).filter(([pid, min]) => min > 0 && (have.get(pid) ?? 0) < min).map(([pid, min]) => ({ pid, min, have: have.get(pid) ?? 0 })).sort((a, b) => (a.have - a.min) - (b.have - b.min))
  }, [d])

  async function post(url: string, body: unknown, method = 'POST'): Promise<boolean> {
    setMsg(null)
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null)
    const j = r ? await r.json().catch(() => ({})) : {}
    if (!r?.ok) { setMsg(j.error ?? 'That didn’t save.'); return false }
    await load(); onChanged?.(); return true
  }

  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const kinds: Loc['kind'][] = ['warehouse', 'truck', 'site']
  const active = (d?.locations ?? []).filter((l) => l.active !== false)

  return <div className="sp" role="dialog" aria-label="Stock">
    <style>{CSS}</style>
    <div className="sp-top"><div className="sp-w">
      <button type="button" className="sp-back" onClick={onClose}>‹ Catalog</button>
      <div className="sp-row" style={{ justifyContent: 'space-between' }}>
        <div><h1>Stock</h1><div className="sub">Where parts are — warehouse, trucks and spare shelves at properties. Jobs take parts out as techs add them.</div></div>
        {d?.ready && <div className="sp-row">
          <button type="button" className="sp-b dk" onClick={() => setDlg({ kind: 'place' })}>+ Add a place</button>
          <button type="button" className="sp-b dk" onClick={() => setDlg({ kind: 'move' })}>Move parts</button>
          <button type="button" className="sp-b pri" onClick={() => setDlg({ kind: 'receive' })}>Receive parts</button>
        </div>}
      </div>
    </div></div>

    <div className="sp-w">
      {err && <div className="sp-card"><div className="sp-empty" style={{ color: RED }}>{err}</div></div>}
      {!d && !err && <div className="sp-empty">Loading…</div>}
      {d && !d.ready && <div className="sp-card" style={{ marginTop: 16 }}><div className="sp-empty">{d.note ?? 'Stock needs migration 236.'} Until it runs, the old inventory numbers are still used.</div></div>}
      {msg && <div role="alert" style={{ marginTop: 12, background: '#FFECEC', color: RED, borderRadius: 10, padding: '8px 12px', fontSize: 13 }}>{msg}</div>}

      {d?.ready && <>
        <div className="sp-seg" role="group" aria-label="View">
          <button type="button" aria-pressed={view === 'place'} onClick={() => setView('place')}>By place</button>
          <button type="button" aria-pressed={view === 'low'} onClick={() => setView('low')}>Low stock{low.length ? ` (${low.length})` : ''}</button>
          <button type="button" aria-pressed={view === 'history'} onClick={() => setView('history')}>History</button>
        </div>

        {view === 'place' && <>
          {active.length === 0 && <div className="sp-card"><div className="sp-empty">No places yet. A warehouse is made the first time parts are received, and each tech gets a truck the first time they add a part to a job.</div></div>}
          {kinds.map((k) => {
            const ls = active.filter((l) => l.kind === k)
            if (!ls.length) return null
            return <section key={k}>
              <div className="sp-h">{KIND_LABEL[k]}</div>
              {ls.map((l) => {
                const items = (byLoc.get(l.id) ?? []).slice().sort((a, b) => prodName(a.product_id).localeCompare(prodName(b.product_id)))
                const total = items.reduce((a, x) => a + x.qty, 0)
                const neg = items.some((x) => x.qty < 0)
                const isOpen = open.has(l.id) || ls.length === 1
                return <div key={l.id} className="sp-card">
                  <button type="button" className="sp-ch" onClick={() => toggle(l.id)} aria-expanded={isOpen} style={{ width: '100%', border: 0, background: '#fff', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', color: TEXT }}>
                    <b style={{ flex: 1 }}>{l.name}</b>
                    {neg && <span style={{ color: RED, fontSize: 12.5, fontWeight: 600 }}>needs a count</span>}
                    <span className="sp-m">{items.length} item{items.length === 1 ? '' : 's'} · {total} pcs</span>
                  </button>
                  {isOpen && (items.length === 0 ? <div className="sp-empty">Empty.</div> : items.map((x) => (
                    <div key={x.product_id} className="sp-it">
                      <span style={{ flex: 1, minWidth: 0 }}>{prodName(x.product_id)} <span className="sp-m">{d.products[x.product_id]?.sku ?? ''}</span></span>
                      <span className="sp-n" style={{ color: x.qty < 0 ? RED : TEXT }}>{x.qty}</span>
                      <button type="button" className="sp-b" style={{ height: 28 }} onClick={() => setDlg({ kind: 'count', loc: l, product: x.product_id, now: x.qty })}>Count</button>
                    </div>
                  )))}
                </div>
              })}
            </section>
          })}
          {d.legacy.length > 0 && <section>
            <div className="sp-h">Old stock not linked to a product</div>
            <div className="sp-card">
              <div className="sp-empty" style={{ paddingBottom: 6 }}>These lines from the old inventory list have no catalog product, so they weren’t copied in. Link each one once to bring its count into the warehouse.</div>
              {d.legacy.map((it) => <div key={it.id} className="sp-it">
                <span style={{ flex: 1 }}>{it.name} <span className="sp-m">{it.sku ?? ''}</span></span>
                <span className="sp-n">{(Number(it.on_hand) || 0) + (Number(it.on_truck) || 0)}</span>
                <button type="button" className="sp-b" style={{ height: 28 }} onClick={() => setDlg({ kind: 'link', item: it })}>Link</button>
              </div>)}
            </div>
          </section>}
        </>}

        {view === 'low' && <div className="sp-card">
          {low.length === 0 ? <div className="sp-empty">Nothing under its minimum. Set a minimum when you count an item (By place → Count).</div>
            : low.map((x) => <div key={x.pid} className="sp-it">
              <span style={{ flex: 1 }}>{prodName(x.pid)}</span>
              <span className="sp-m">have {x.have} · min {x.min}</span>
              <span className="sp-n" style={{ color: RED }}>order {x.min - x.have}</span>
            </div>)}
        </div>}

        {view === 'history' && <div className="sp-card">
          {!moves ? <div className="sp-empty">Loading…</div> : moves.length === 0 ? <div className="sp-empty">No moves yet.</div>
            : moves.map((m) => <div key={m.id} className="sp-it" style={{ alignItems: 'flex-start' }}>
              <span style={{ width: 92, flexShrink: 0 }} className="sp-m">{new Date(m.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontWeight: 600 }}>{MOVE_LABEL[m.kind] ?? m.kind}</b> · {prodName(m.product_id)}
                <div className="sp-m">{m.from_location_id ? locName(m.from_location_id) : ''}{m.from_location_id && m.to_location_id ? ' → ' : ''}{m.to_location_id ? locName(m.to_location_id) : ''}{m.work_order_id ? ' · job' : ''}{m.note ? ` · ${m.note}` : ''}{m.created_by ? ` · ${m.created_by}` : ''}</div>
              </span>
              <span className="sp-n" style={{ color: m.to_location_id && !m.from_location_id ? GREEN : m.from_location_id && !m.to_location_id ? ORANGE : TEXT }}>{m.to_location_id && !m.from_location_id ? '+' : m.from_location_id && !m.to_location_id ? '−' : ''}{m.qty}</span>
            </div>)}
        </div>}
      </>}
    </div>

    {dlg && d && <StockDialog dlg={dlg} d={d} catalog={catalog} onClose={() => setDlg(null)} post={post} />}
  </div>
}

function ProductPick({ catalog, value, onChange }: { catalog: ProductRow[]; value: string; onChange: (id: string) => void }) {
  const [q, setQ] = useState(() => catalog.find((c) => c.id === value)?.name ?? '')
  const hits = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (s.length < 2 || catalog.find((c) => c.id === value)?.name === q) return []
    return catalog.filter((c) => c.active !== false && `${c.name} ${c.sku ?? ''} ${c.brand ?? ''}`.toLowerCase().includes(s)).slice(0, 6)
  }, [q, catalog, value])
  return <div style={{ position: 'relative' }}>
    <input className="sp-in" aria-label="Product" placeholder="Search the catalog…" value={q} onChange={(e) => { setQ(e.target.value); onChange('') }} />
    {hits.length > 0 && <div style={{ position: 'absolute', left: 0, right: 0, top: 38, zIndex: 2, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 10, boxShadow: SHADOW, overflow: 'hidden' }}>
      {hits.map((h) => <button key={h.id} type="button" onClick={() => { onChange(h.id); setQ(h.name) }} style={{ display: 'block', width: '100%', textAlign: 'left', border: 0, borderTop: `1px solid ${LINE}`, background: '#fff', padding: '8px 10px', cursor: 'pointer', font: `400 13.5px ${FONT}`, color: TEXT }}>{h.name} <span style={{ color: MUTED }}>{[h.brand, h.sku].filter(Boolean).join(' · ')}</span></button>)}
    </div>}
  </div>
}

function StockDialog({ dlg, d, catalog, onClose, post }: { dlg: NonNullable<Dialog>; d: Data; catalog: ProductRow[]; onClose: () => void; post: (url: string, body: unknown, method?: string) => Promise<boolean> }) {
  const places = d.locations.filter((l) => l.active !== false)
  const [product, setProduct] = useState(dlg.kind === 'count' ? dlg.product : '')
  const [qty, setQty] = useState(dlg.kind === 'count' ? String(Math.max(0, dlg.now)) : '1')
  const [from, setFrom] = useState(places[0]?.id ?? '')
  const [to, setTo] = useState(places.find((l) => l.kind === 'warehouse')?.id ?? places[0]?.id ?? '')
  const [cost, setCost] = useState('')
  const [min, setMin] = useState('')
  const [kind, setKind] = useState<'warehouse' | 'truck'>('truck')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const go = async (fn: () => Promise<boolean>) => { setBusy(true); const ok = await fn(); setBusy(false); if (ok) onClose() }
  const placeSel = (v: string, set: (s: string) => void, label: string) => <label>{label}
    <select className="sp-in" value={v} onChange={(e) => set(e.target.value)}>{places.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>

  let title = '', body: React.ReactNode = null, act: (() => Promise<boolean>) | null = null, can = false
  if (dlg.kind === 'receive') {
    title = 'Receive parts'
    body = <><label>Product<ProductPick catalog={catalog} value={product} onChange={setProduct} /></label>
      <label>How many<input className="sp-in" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))} /></label>
      {placeSel(to, setTo, 'Put it in')}
      <label>Cost each (optional)<input className="sp-in" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} /></label>
      <div style={{ fontSize: 12.5, color: MUTED }}>Parts on a purchase order come in by themselves when the PO is marked received.</div></>
    can = !!product && Number(qty) > 0 && !!to
    act = () => post('/api/stock/moves', { action: 'receive', product_id: product, qty: Number(qty), to, unit_cost: cost || undefined })
  } else if (dlg.kind === 'move') {
    title = 'Move parts'
    body = <><label>Product<ProductPick catalog={catalog} value={product} onChange={setProduct} /></label>
      <label>How many<input className="sp-in" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))} /></label>
      {placeSel(from, setFrom, 'From')}{placeSel(to, setTo, 'To')}</>
    can = !!product && Number(qty) > 0 && !!from && !!to && from !== to
    act = () => post('/api/stock/moves', { action: 'transfer', product_id: product, qty: Number(qty), from, to })
  } else if (dlg.kind === 'count') {
    title = `Count — ${dlg.loc.name}`
    body = <><div style={{ fontSize: 14 }}>{d.products[dlg.product]?.name ?? catalog.find((c) => c.id === dlg.product)?.name ?? 'Part'} — shows <b>{dlg.now}</b></div>
      <label>How many are really there?<input className="sp-in" inputMode="numeric" autoFocus value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))} /></label>
      <label>Low-stock minimum (optional)<input className="sp-in" inputMode="numeric" placeholder="e.g. 4" value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ''))} /></label></>
    can = qty !== ''
    act = async () => {
      const ok = await post('/api/stock/moves', { action: 'count', product_id: dlg.product, location_id: dlg.loc.id, counted: Number(qty) })
      if (ok && min !== '') return post('/api/stock/moves', { action: 'set_min', product_id: dlg.product, min_qty: Number(min), ...(dlg.loc.org_id ? { org_id: dlg.loc.org_id } : {}) })
      return ok
    }
  } else if (dlg.kind === 'link') {
    title = 'Link to a catalog product'
    body = <><div style={{ fontSize: 14 }}>{dlg.item.name} — {(Number(dlg.item.on_hand) || 0) + (Number(dlg.item.on_truck) || 0)} on the old list</div>
      <label>Catalog product<ProductPick catalog={catalog} value={product} onChange={setProduct} /></label>
      <div style={{ fontSize: 12.5, color: MUTED }}>The count is copied into the warehouse once. Move some to trucks afterwards if they’re out there.</div></>
    can = !!product
    act = () => post('/api/stock/moves', { action: 'link_legacy', inventory_item_id: dlg.item.id, product_id: product })
  } else if (dlg.kind === 'place') {
    title = 'Add a place'
    body = <><label>What is it?<select className="sp-in" value={kind} onChange={(e) => setKind(e.target.value as 'warehouse' | 'truck')}><option value="truck">A truck</option><option value="warehouse">A warehouse / shop</option></select></label>
      <label>Name<input className="sp-in" placeholder={kind === 'truck' ? 'e.g. Truck 3' : 'e.g. Atlanta shop'} value={name} onChange={(e) => setName(e.target.value)} /></label>
      <div style={{ fontSize: 12.5, color: MUTED }}>Each tech also gets their own truck the first time they add a part to a job. Property spare shelves are added from the property’s Service tab or a PO line.</div></>
    can = !!name.trim()
    act = () => post('/api/stock', { kind, name: name.trim() })
  }

  return <div className="sp-dlg" onClick={onClose}>
    <div className="p" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
      <b style={{ fontSize: 17, fontWeight: 600 }}>{title}</b>
      {body}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
        <button type="button" className="sp-b" onClick={onClose}>Cancel</button>
        <button type="button" className="sp-b pri" disabled={!can || busy} onClick={() => act && void go(act)}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
    </div>
  </div>
}
