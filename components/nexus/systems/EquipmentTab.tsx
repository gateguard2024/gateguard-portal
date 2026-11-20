'use client'
/**
 * Systems → property → Equipment (Catalog phase 2, migration 237; rules lib/assets.ts).
 * Every installed unit, grouped by gate/door, with status, age and warranty.
 *   • Tap a unit → its page: details (editable), the unit it's part of + units under it,
 *     what it replaced / what replaced it, history (jobs, parts, Faults, requests), QR.
 *   • Add a unit (from the catalog or by name), mark one removed.
 *   • Print QR labels — Avery 5160 sheet or 2" × 1" label roll. Scanning one opens
 *     /a/<code>: "Report a problem with Front Gate — LiftMaster CSW24UL".
 * Deep link: /?tab=systems&site=<id>&asset=<id> opens a unit here.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { type Any, BLUE, Card, DOT, Dot, Field, GREEN, MUTED, Note, ORANGE, RED, Sheet, TEXT, fmtWhen, getJson, send, type SiteCtx } from './shared'
import { qrMatrix, qrSvgPath } from '@/lib/qr'

type Unit = { id: string; product_id: string | null; product_name: string; product_sku: string | null; product_category: string | null; serial_number: string | null; mac_address: string | null; ip_address: string | null; firmware_version: string | null; location_note: string | null; opening_id: string | null; parent_asset_id: string | null; replaced_by_asset_id: string | null; status: string | null; installed_at: string | null; created_at: string | null; warranty_expires_at: string | null; qr_code: string | null; notes: string | null }
type Opening = { id: string; name: string; kind?: string; active?: boolean }
const GONE = new Set(['replaced', 'removed'])

const age = (iso: string | null) => {
  if (!iso) return null
  const days = (Date.now() - new Date(iso).getTime()) / 864e5
  if (days < 45) return 'new'
  if (days < 365) return `${Math.round(days / 30.4)} mo old`
  return `${(days / 365).toFixed(days < 3650 ? 1 : 0).replace(/\.0$/, '')} yr old`
}
const warranty = (d: string | null) => {
  if (!d) return null
  const left = (new Date(d + 'T12:00:00').getTime() - Date.now()) / 864e5
  const when = new Date(d + 'T12:00:00').toLocaleDateString([], { month: 'short', year: 'numeric' })
  return left < 0 ? { text: 'out of warranty', color: MUTED } : { text: `warranty to ${when}`, color: left < 60 ? ORANGE : GREEN }
}
const dotFor = (s: string | null) => (s === 'offline' ? DOT.red : s === 'degraded' ? DOT.orange : GONE.has(String(s)) ? DOT.gray : DOT.green)
const unitUrl = (code: string) => `${typeof window !== 'undefined' ? window.location.origin : 'https://portal.gateguard.co'}/a/${code}`

export function EquipmentTab({ ctx, siteName }: { ctx: SiteCtx; siteName?: string | null }) {
  const [units, setUnits] = useState<Unit[] | null>(null)
  const [openings, setOpenings] = useState<Opening[]>([])
  const [ready, setReady] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [showGone, setShowGone] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [printing, setPrinting] = useState(false)

  const load = useCallback(async () => {
    const [a, o] = await Promise.all([getJson(`/api/sites/${ctx.siteId}/assets`), getJson(`/api/sites/${ctx.siteId}/openings?lite=1&all=1`)])
    if (!a.ok) { setErr(a.data?.error ?? 'Couldn’t load equipment.'); setUnits([]); return }
    setErr(null); setUnits((a.data.assets ?? []) as Unit[]); setReady(a.data.ready !== false)
    if (o.ok) setOpenings((o.data.openings ?? []) as Opening[])
  }, [ctx.siteId])
  useEffect(() => { void load() }, [load])
  // Deep link ?asset=<id>
  useEffect(() => { try { const id = new URLSearchParams(window.location.search).get('asset'); if (id) setOpenId(id) } catch { /* ignore */ } }, [])

  const opName = useCallback((id: string | null) => (id ? openings.find((o) => o.id === id)?.name ?? null : null), [openings])
  const shown = useMemo(() => (units ?? []).filter((u) => showGone || !GONE.has(String(u.status))), [units, showGone])
  const groups = useMemo(() => {
    const byOp = new Map<string, Unit[]>()
    for (const u of shown) { const k = u.opening_id && opName(u.opening_id) ? u.opening_id : '_none'; (byOp.get(k) ?? byOp.set(k, []).get(k)!).push(u) }
    const order = [...openings.filter((o) => byOp.has(o.id)).map((o) => o.id), ...(byOp.has('_none') ? ['_none'] : [])]
    return order.map((k) => {
      const list = byOp.get(k)!
      const ids = new Set(list.map((u) => u.id))
      const tops = list.filter((u) => !u.parent_asset_id || !ids.has(u.parent_asset_id)).sort((a, b) => a.product_name.localeCompare(b.product_name))
      const kids = (p: string) => list.filter((u) => u.parent_asset_id === p).sort((a, b) => a.product_name.localeCompare(b.product_name))
      return { key: k, name: k === '_none' ? 'Whole property / not set' : opName(k)!, rows: tops.flatMap((t) => [{ u: t, depth: 0 }, ...kids(t.id).map((c) => ({ u: c, depth: 1 }))]) }
    })
  }, [shown, openings, opName])

  const active = (units ?? []).filter((u) => !GONE.has(String(u.status)))
  const inWarranty = active.filter((u) => u.warranty_expires_at && new Date(u.warranty_expires_at) > new Date()).length
  const gone = (units ?? []).length - active.length

  if (err) return <Card title="Equipment"><Note tone="red">{err}</Note></Card>
  if (!units) return <Card title="Equipment"><div className="sy-empty">Loading…</div></Card>

  return (
    <div className="sy-stack">
      <Card title="Equipment" sub={`${active.length} unit${active.length === 1 ? '' : 's'} at this property${inWarranty ? ` · ${inWarranty} under warranty` : ''}`}
        right={<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {ready && active.some((u) => u.qr_code) && <button type="button" className="sy-b line sm" onClick={() => setPrinting(true)}>Print QR labels</button>}
          <button type="button" className="sy-b pri sm" onClick={() => setAdding(true)}>+ Add a unit</button>
        </div>}>
        {!ready && <Note tone="orange">QR labels, “part of” and replaced-by need migration 237. The list still works.</Note>}
        {active.length === 0 && !showGone && <div className="sy-empty">No equipment recorded yet. Units are added here, from a job’s equipment list, or when a tech replaces a catalog part.</div>}
        {groups.map((g) => (
          <div key={g.key} style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '.04em', margin: '6px 0 2px' }}>{g.name}</div>
            {g.rows.map(({ u, depth }) => {
              const w = warranty(u.warranty_expires_at), a = age(u.installed_at ?? u.created_at)
              return (
                <button key={u.id} type="button" className="sy-row" onClick={() => setOpenId(u.id)}
                  style={{ width: '100%', border: 0, borderTop: '1px solid rgba(0,0,0,0.06)', background: 'none', textAlign: 'left', cursor: 'pointer', font: 'inherit', color: TEXT, paddingLeft: depth ? 22 : 0, opacity: GONE.has(String(u.status)) ? 0.55 : 1 }}>
                  <Dot c={dotFor(u.status)} />
                  <div className="main">
                    <div className="t">{depth ? '↳ ' : ''}{u.product_name}{GONE.has(String(u.status)) ? <span className="sy-pill" style={{ marginLeft: 6 }}>{u.status}</span> : null}</div>
                    <div className="m">{[u.product_sku, u.serial_number ? `SN ${u.serial_number}` : null, a].filter(Boolean).join(' · ')}{w ? <> · <span style={{ color: w.color }}>{w.text}</span></> : null}</div>
                  </div>
                  <span style={{ color: MUTED, fontSize: 18 }} aria-hidden>›</span>
                </button>
              )
            })}
          </div>
        ))}
        {gone > 0 && <button type="button" className="sy-chip" aria-pressed={showGone} onClick={() => setShowGone((v) => !v)} style={{ marginTop: 12 }}>{showGone ? 'Hide' : 'Show'} replaced / removed ({gone})</button>}
      </Card>

      {openId && <UnitSheet ctx={ctx} id={openId} units={units} openings={openings} onClose={() => { setOpenId(null); void load() }} onOpen={setOpenId} siteName={siteName} />}
      {adding && <AddUnitSheet ctx={ctx} units={active} openings={openings} onClose={() => setAdding(false)} onAdded={(id) => { setAdding(false); void load(); setOpenId(id) }} />}
      {printing && <PrintSheet units={active.filter((u) => u.qr_code)} opName={opName} siteName={siteName} onClose={() => setPrinting(false)} />}
    </div>
  )
}

function QrBox({ text, size = 132 }: { text: string; size?: number }) {
  const { d, size: s } = useMemo(() => qrSvgPath(qrMatrix(text)), [text])
  return <svg width={size} height={size} viewBox={`0 0 ${s} ${s}`} role="img" aria-label="QR code" shapeRendering="crispEdges" style={{ background: '#fff', borderRadius: 8, border: '1px solid rgba(0,0,0,0.08)' }}><path d={d} fill="#000" /></svg>
}

function UnitSheet({ ctx, id, units, openings, onClose, onOpen, siteName }: { ctx: SiteCtx; id: string; units: Unit[]; openings: Opening[]; onClose: () => void; onOpen: (id: string) => void; siteName?: string | null }) {
  const [d, setD] = useState<Any | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [f, setF] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const load = useCallback(async () => {
    const r = await getJson(`/api/sites/${ctx.siteId}/assets/${id}`)
    if (!r.ok) { setErr(r.data?.error ?? 'Couldn’t load this unit.'); return }
    setD(r.data); const a = r.data.asset as Unit
    setF({ serial_number: a.serial_number ?? '', mac_address: a.mac_address ?? '', ip_address: a.ip_address ?? '', firmware_version: a.firmware_version ?? '', opening_id: a.opening_id ?? '', parent_asset_id: a.parent_asset_id ?? '', warranty_expires_at: a.warranty_expires_at ?? '', notes: a.notes ?? '' })
  }, [ctx.siteId, id])
  useEffect(() => { setD(null); setErr(null); setConfirmRemove(false); void load() }, [load])

  const a = d?.asset as Unit | undefined
  const changed = a ? Object.entries(f).filter(([k, v]) => (v || null) !== ((a as unknown as Record<string, string | null>)[k] || null)) : []
  async function save(extra?: Record<string, unknown>) {
    setBusy(true)
    const body = extra ?? Object.fromEntries(changed)
    const r = await send(`/api/sites/${ctx.siteId}/assets/${id}`, 'PATCH', body)
    setBusy(false)
    if (!r.ok) { ctx.notify(r.data?.error ?? 'That didn’t save.', false); return }
    ctx.notify(extra?.status === 'removed' ? 'Marked removed.' : 'Saved.'); void load()
  }
  const others = units.filter((u) => u.id !== id && !GONE.has(String(u.status)))
  const linkUnit = (u: Any | null | undefined, prefix: string) => u ? <button type="button" onClick={() => onOpen(u.id)} style={{ border: 0, background: 'none', padding: 0, color: BLUE, font: 'inherit', cursor: 'pointer', textAlign: 'left' }}>{prefix}{u.product_name}{u.serial_number ? ` · SN ${u.serial_number}` : ''}</button> : null

  return (
    <Sheet title={d?.label ?? 'Unit'} sub={a ? [a.product_sku, a.status ? a.status : null].filter(Boolean).join(' · ') : 'Loading…'} onClose={onClose} width={640}>
      {err && <Note tone="red">{err}</Note>}
      {!d && !err && <div className="sy-empty">Loading…</div>}
      {d && a && (
        <div className="sy-stack">
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {a.qr_code ? <div style={{ display: 'grid', gap: 6, justifyItems: 'center' }}>
              <QrBox text={unitUrl(a.qr_code)} />
              <div style={{ fontSize: 11.5, color: MUTED, fontVariantNumeric: 'tabular-nums' }}>{a.qr_code}</div>
              <button type="button" className="sy-b line sm" onClick={() => { if (!printLabels([{ code: a.qr_code!, title: d.label, site: siteName ?? '' }], 'avery5160')) ctx.notify('Allow pop-ups for this site to print labels.', false) }}>Print this label</button>
            </div> : <Note>QR label needs migration 237.</Note>}
            <div style={{ flex: 1, minWidth: 220, display: 'grid', gap: 6, fontSize: 14 }}>
              {d.product && <div><span style={{ color: MUTED }}>Catalog: </span>{d.product.brand && !String(d.product.name ?? '').toLowerCase().startsWith(String(d.product.brand).toLowerCase()) ? `${d.product.brand} ${d.product.name}` : d.product.name}{d.product.sku ? ` · ${d.product.sku}` : ''}</div>}
              <div><span style={{ color: MUTED }}>Installed: </span>{a.installed_at ? fmtWhen(a.installed_at) : '—'}{age(a.installed_at ?? a.created_at) ? ` (${age(a.installed_at ?? a.created_at)})` : ''}</div>
              {warranty(a.warranty_expires_at) && <div><span style={{ color: MUTED }}>Warranty: </span><span style={{ color: warranty(a.warranty_expires_at)!.color }}>{warranty(a.warranty_expires_at)!.text}</span></div>}
              {d.parent && <div><span style={{ color: MUTED }}>Part of: </span>{linkUnit(d.parent, '')}</div>}
              {(d.children ?? []).length > 0 && <div><span style={{ color: MUTED }}>Has: </span>{(d.children as Any[]).map((c, i) => <span key={c.id}>{i ? ', ' : ''}{linkUnit(c, '')}</span>)}</div>}
              {(d.replaced ?? []).length > 0 && <div><span style={{ color: MUTED }}>Replaced: </span>{(d.replaced as Any[]).map((c, i) => <span key={c.id}>{i ? ', ' : ''}{linkUnit(c, '')}</span>)}</div>}
              {d.replaced_by && <div><span style={{ color: RED }}>Replaced by: </span>{linkUnit(d.replaced_by, '')}</div>}
              {d.product?.manual_url && <a href={d.product.manual_url} target="_blank" rel="noreferrer" style={{ color: BLUE }}>Manual</a>}
            </div>
          </div>

          <Card title="Details">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
              <Field label="Serial number"><input className="sy-in" value={f.serial_number} onChange={(e) => setF({ ...f, serial_number: e.target.value })} /></Field>
              <Field label="Gate / door"><select className="sy-in" value={f.opening_id} onChange={(e) => setF({ ...f, opening_id: e.target.value })}><option value="">Whole property / not set</option>{openings.filter((o) => o.active !== false || o.id === f.opening_id).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field>
              <Field label="Part of"><select className="sy-in" value={f.parent_asset_id} onChange={(e) => setF({ ...f, parent_asset_id: e.target.value })}><option value="">Nothing (stands alone)</option>{others.map((u) => <option key={u.id} value={u.id}>{u.product_name}{u.serial_number ? ` · ${u.serial_number}` : ''}</option>)}</select></Field>
              <Field label="Warranty ends"><input className="sy-in" type="date" value={f.warranty_expires_at} onChange={(e) => setF({ ...f, warranty_expires_at: e.target.value })} /></Field>
              <Field label="MAC address"><input className="sy-in" value={f.mac_address} onChange={(e) => setF({ ...f, mac_address: e.target.value })} /></Field>
              <Field label="IP address"><input className="sy-in" value={f.ip_address} onChange={(e) => setF({ ...f, ip_address: e.target.value })} /></Field>
              <Field label="Firmware"><input className="sy-in" value={f.firmware_version} onChange={(e) => setF({ ...f, firmware_version: e.target.value })} /></Field>
            </div>
            <div style={{ marginTop: 10 }}><Field label="Notes"><textarea className="sy-in" rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field></div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 12, flexWrap: 'wrap' }}>
              {!GONE.has(String(a.status)) ? (confirmRemove
                ? <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: 13 }}>Taken off the property?<button type="button" className="sy-b warn sm" disabled={busy} onClick={() => void save({ status: 'removed' })}>Yes, mark removed</button><button type="button" className="sy-b line sm" onClick={() => setConfirmRemove(false)}>Cancel</button></span>
                : <button type="button" className="sy-b warn sm" onClick={() => setConfirmRemove(true)}>Mark removed</button>) : <span />}
              <button type="button" className="sy-b pri sm" disabled={!changed.length || busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save'}</button>
            </div>
          </Card>

          <Card title="History" sub="Jobs at this gate/door, parts, Faults and requests about this unit">
            {(d.history ?? []).length === 0 ? <div className="sy-empty">Nothing yet.</div> : (d.history as Any[]).slice(0, 60).map((h, i) => (
              <div key={i} className="sy-row" style={{ alignItems: 'flex-start' }}>
                <span style={{ width: 92, flexShrink: 0, fontSize: 12, color: MUTED }}>{new Date(h.at).toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' })}</span>
                <div className="main" style={{ fontSize: 14 }}>
                  {h.job_id ? <a href={`/?tab=jobs&job=${h.job_id}`} style={{ color: TEXT, textDecoration: 'none' }}>{h.text} <span style={{ color: BLUE }}>›</span></a> : h.text}
                </div>
                <span className="sy-pill">{({ install: 'Installed', job: 'Job', part: 'Part', fault: 'Fault', event: 'Event', request: 'Request', replaced: 'Replaced' } as Record<string, string>)[h.kind] ?? h.kind}</span>
              </div>
            ))}
          </Card>
        </div>
      )}
    </Sheet>
  )
}

function AddUnitSheet({ ctx, units, openings, onClose, onAdded }: { ctx: SiteCtx; units: Unit[]; openings: Opening[]; onClose: () => void; onAdded: (id: string) => void }) {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<Any[]>([])
  const [prod, setProd] = useState<Any | null>(null)
  const [serial, setSerial] = useState('')
  const [op, setOp] = useState('')
  const [parent, setParent] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (prod || q.trim().length < 2) { setHits([]); return }
    const t = setTimeout(() => { void getJson(`/api/products?q=${encodeURIComponent(q.trim())}&limit=8`).then((r) => setHits(r.ok ? (r.data.products ?? []) : [])) }, 250)
    return () => clearTimeout(t)
  }, [q, prod])
  async function add() {
    setBusy(true)
    const r = await send(`/api/sites/${ctx.siteId}/assets`, 'POST', {
      product_id: prod?.id ?? null, product_name: prod?.name ?? q.trim(), product_sku: prod?.sku ?? null, product_category: prod?.category ?? null,
      serial_number: serial.trim() || null, opening_id: op || null, parent_asset_id: parent || null,
      location_note: openings.find((o) => o.id === op)?.name ?? null,
    })
    setBusy(false)
    if (!r.ok) { ctx.notify(r.data?.error ?? 'Couldn’t add it.', false); return }
    ctx.notify('Unit added.'); onAdded(r.data.asset.id)
  }
  return (
    <Sheet title="Add a unit" sub="Something installed at this property" onClose={onClose}>
      <div className="sy-stack">
        <Field label="What is it? (search the catalog, or type a name)">
          <input className="sy-in" autoFocus value={q} onChange={(e) => { setQ(e.target.value); setProd(null) }} placeholder="e.g. LiftMaster CSW24UL" />
        </Field>
        {hits.length > 0 && <div style={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10, overflow: 'hidden', marginTop: -6 }}>
          {hits.map((h) => <button key={h.id} type="button" onClick={() => { setProd(h); setQ(h.name); setHits([]) }} style={{ display: 'block', width: '100%', textAlign: 'left', border: 0, borderTop: '1px solid rgba(0,0,0,0.06)', background: '#fff', padding: '8px 10px', cursor: 'pointer', font: 'inherit', fontSize: 14, color: TEXT }}>{h.name} <span style={{ color: MUTED }}>{[h.brand, h.sku].filter(Boolean).join(' · ')}</span></button>)}
        </div>}
        {prod && <Note tone="green">From the catalog{prod.warranty_months ? ` — ${prod.warranty_months}-month warranty is set from today` : ''}.</Note>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
          <Field label="Serial number"><input className="sy-in" value={serial} onChange={(e) => setSerial(e.target.value)} /></Field>
          <Field label="Gate / door"><select className="sy-in" value={op} onChange={(e) => setOp(e.target.value)}><option value="">Whole property / not set</option>{openings.filter((o) => o.active !== false).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field>
          <Field label="Part of"><select className="sy-in" value={parent} onChange={(e) => setParent(e.target.value)}><option value="">Nothing (stands alone)</option>{units.map((u) => <option key={u.id} value={u.id}>{u.product_name}{u.serial_number ? ` · ${u.serial_number}` : ''}</option>)}</select></Field>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="sy-b line" onClick={onClose}>Cancel</button>
          <button type="button" className="sy-b pri" disabled={!q.trim() || busy} onClick={() => void add()}>{busy ? 'Adding…' : 'Add unit'}</button>
        </div>
      </div>
    </Sheet>
  )
}

type LabelFormat = 'avery5160' | 'roll2x1'
function PrintSheet({ units, opName, siteName, onClose }: { units: Unit[]; opName: (id: string | null) => string | null; siteName?: string | null; onClose: () => void }) {
  const [sel, setSel] = useState<Set<string>>(() => new Set(units.map((u) => u.id)))
  const [fmt, setFmt] = useState<LabelFormat>('avery5160')
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const [blocked, setBlocked] = useState(false)
  const go = () => setBlocked(!printLabels(units.filter((u) => sel.has(u.id)).map((u) => ({ code: u.qr_code!, title: [opName(u.opening_id) ?? u.location_note, u.product_name].filter(Boolean).join(' — '), site: siteName ?? '' })), fmt))
  return (
    <Sheet title="Print QR labels" sub="Scanning a label opens “Report a problem with …” for that unit" onClose={onClose}>
      <div className="sy-stack">
        <div className="sy-chips" role="group" aria-label="Label size">
          <button type="button" className="sy-chip" aria-pressed={fmt === 'avery5160'} onClick={() => setFmt('avery5160')}>Avery 5160 sheet (1″ × 2⅝″, 30 a page)</button>
          <button type="button" className="sy-chip" aria-pressed={fmt === 'roll2x1'} onClick={() => setFmt('roll2x1')}>2″ × 1″ label roll</button>
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: MUTED, marginBottom: 4 }}><span>{sel.size} of {units.length} selected</span><button type="button" onClick={() => setSel(sel.size === units.length ? new Set() : new Set(units.map((u) => u.id)))} style={{ border: 0, background: 'none', color: BLUE, cursor: 'pointer', font: 'inherit' }}>{sel.size === units.length ? 'None' : 'All'}</button></div>
          {units.map((u) => <label key={u.id} className="sy-row" style={{ cursor: 'pointer' }}><input type="checkbox" checked={sel.has(u.id)} onChange={() => toggle(u.id)} style={{ width: 18, height: 18 }} /><div className="main"><div className="t">{u.product_name}</div><div className="m">{[opName(u.opening_id), u.serial_number ? `SN ${u.serial_number}` : null].filter(Boolean).join(' · ') || '—'}</div></div></label>)}
        </div>
        {blocked && <Note tone="orange">Your browser blocked the print window — allow pop-ups for this site and try again.</Note>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="sy-b line" onClick={onClose}>Cancel</button>
          <button type="button" className="sy-b pri" disabled={!sel.size} onClick={go}>Print {sel.size} label{sel.size === 1 ? '' : 's'}</button>
        </div>
      </div>
    </Sheet>
  )
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
/** Opens a print window with the labels laid out for the chosen stock. */
export function printLabels(labels: { code: string; title: string; site: string }[], fmt: LabelFormat) {
  const one = (l: { code: string; title: string; site: string }) => {
    const { d, size } = qrSvgPath(qrMatrix(unitUrl(l.code)), 2)
    return `<div class="l"><svg viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><path d="${d}"/></svg><div class="t"><b>${esc(l.title)}</b><span>${esc(l.site)}</span><i>Scan to report a problem · ${esc(l.code)}</i></div></div>`
  }
  const css = fmt === 'avery5160'
    ? `@page{size:letter;margin:0}body{margin:0;padding:0.5in 0.1875in 0}.g{display:grid;grid-template-columns:repeat(3,2.625in);column-gap:0.125in;grid-auto-rows:1in}.l{height:1in;padding:0.08in 0.1in;gap:0.08in}.l svg{width:0.84in;height:0.84in}`
    : `@page{size:2in 1in;margin:0}body{margin:0}.g{display:block}.l{width:2in;height:1in;padding:0.06in;gap:0.06in;page-break-after:always;break-after:page}.l svg{width:0.88in;height:0.88in}`
  const html = `<!doctype html><html><head><title>QR labels</title><style>*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,Inter,Arial,sans-serif;color:#000}.l{display:flex;align-items:center;overflow:hidden}.l svg{flex:none}.l path{fill:#000}.t{display:grid;gap:2px;min-width:0;font-size:8pt;line-height:1.15}.t b{font-weight:600;font-size:8.5pt;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.t span{color:#333;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.t i{font-style:normal;font-size:6.5pt;color:#555}${css}</style></head><body><div class="g">${labels.map(one).join('')}</div><script>window.onload=function(){setTimeout(function(){window.print()},150)}</script></body></html>`
  const w = window.open('', '_blank')
  if (!w) return false
  w.document.open(); w.document.write(html); w.document.close()
  return true
}
