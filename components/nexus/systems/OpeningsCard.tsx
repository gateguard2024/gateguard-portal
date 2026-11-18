'use client'
/**
 * Systems → Setup → Openings: the gates, doors and entrances at this property.
 * Each opening groups its devices (asset list), Brivo door, cameras, Shelly
 * relays and Gate Watch. Jobs pick an opening at Finish job, so return trips
 * are counted per opening. Suggestions come from what the property already has.
 * Rules + API: lib/openings.ts, /api/sites/[id]/openings.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, MUTED, Note, Sheet, Field, send, getJson, type Any, type SiteCtx } from './shared'

type Opening = { id: string; name: string; kind: string; brivo_door_ids: string[]; camera_ids: string[]; relay_ids: string[]; gate_watch_ids: string[]; notes: string | null }
type Suggestion = Omit<Opening, 'id' | 'notes'> & { key: string; source: string; asset_ids: string[] }
type Asset = { id: string; product_name: string; product_category: string | null; location_note: string | null; opening_id: string | null }

const KINDS: [string, string][] = [['gate', 'Vehicle gate'], ['pedestrian', 'Pedestrian gate'], ['door', 'Door'], ['garage', 'Garage'], ['elevator', 'Elevator'], ['other', 'Other']]
const kindLabel = (k: string) => KINDS.find(([v]) => v === k)?.[1] ?? 'Other'
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

export function OpeningsCard({ ctx, doors, cams, relays }: { ctx: SiteCtx; doors: Any[] | null; cams: Any[] | null; relays: Any[] | null }) {
  const { siteId, notify } = ctx
  const [data, setData] = useState<{ openings: Opening[]; assets: Asset[]; suggestions: Suggestion[]; can_setup: boolean; needs_migration: boolean } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [gates, setGates] = useState<{ id: string; label: string }[]>([])
  const [pick, setPick] = useState<Set<string>>(new Set())
  const [edit, setEdit] = useState<(Opening & { asset_ids: string[] }) | null>(null)
  const [busy, setBusy] = useState(false)

  const doorList = useMemo(() => (doors ?? []).map((d) => ({ id: String(d.id), name: String(d.name ?? 'Door') })), [doors])
  const load = useCallback(async () => {
    const q = encodeURIComponent(JSON.stringify(doorList))
    const r = await getJson(`/api/sites/${siteId}/openings?doors=${q}`)
    if (!r.ok) { setErr(r.data.error ?? 'Couldn’t load openings.'); return }
    setErr(null); setData(r.data as typeof data & object)
    setPick(new Set(((r.data.suggestions ?? []) as Suggestion[]).map((s) => s.key)))
  }, [siteId, doorList])
  useEffect(() => { void load() }, [load])
  useEffect(() => { void getJson(`/api/sites/${siteId}/gates`).then((r) => { if (r.ok) setGates(((r.data.gates ?? []) as Any[]).map((g) => ({ id: String(g.id), label: String(g.label) }))) }) }, [siteId])

  const relayList = (relays ?? []).map((r) => ({ id: `${r.id}:${r.channel ?? 0}`, name: String(r.name ?? 'Relay') }))
  const camList = (cams ?? []).map((c) => ({ id: String(c.id), name: String(c.name ?? 'Camera') }))
  const nameOf = (list: { id: string; name: string }[], id: string) => list.find((x) => x.id === id)?.name ?? null

  async function acceptPicked() {
    if (!data) return
    const items = data.suggestions.filter((s) => pick.has(s.key))
    if (!items.length) return
    setBusy(true)
    const r = await send(`/api/sites/${siteId}/openings`, 'POST', { action: 'accept', items })
    setBusy(false)
    notify(r.ok ? `${plural(items.length, 'opening')} added.` : (r.data.error ?? 'Couldn’t add them.'), r.ok)
    void load()
  }
  async function save() {
    if (!edit) return
    setBusy(true)
    const body = { name: edit.name, kind: edit.kind, brivo_door_ids: edit.brivo_door_ids, camera_ids: edit.camera_ids, relay_ids: edit.relay_ids, gate_watch_ids: edit.gate_watch_ids, asset_ids: edit.asset_ids, notes: edit.notes }
    const r = await send(`/api/sites/${siteId}/openings`, 'POST', edit.id ? { action: 'update', opening_id: edit.id, ...body } : { action: 'create', ...body })
    setBusy(false)
    if (!r.ok) { notify(r.data.error ?? 'Couldn’t save.', false); return }
    notify(`${edit.name} saved.`); setEdit(null); void load()
  }
  async function remove(o: Opening) {
    if (!window.confirm(`Remove “${o.name}”? Its devices stay on the property; past jobs keep their history.`)) return
    setBusy(true)
    const r = await send(`/api/sites/${siteId}/openings`, 'POST', { action: 'remove', opening_id: o.id })
    setBusy(false)
    notify(r.ok ? `${o.name} removed.` : (r.data.error ?? 'Couldn’t remove it.'), r.ok)
    setEdit(null); void load()
  }

  const sub = 'Each gate, door or entrance, with its devices, cameras and controls. Techs pick one when they finish a job, so repeat visits show up on the right gate.'
  if (err) return <Card title="Openings" sub={sub}><Note tone="red">{err}</Note></Card>
  if (!data) return <Card title="Openings" sub={sub}><div className="sy-empty">Loading…</div></Card>
  if (data.needs_migration) return <Card title="Openings" sub={sub}><Note tone="orange">Openings need migration 233.</Note></Card>

  const { openings, assets, suggestions, can_setup } = data
  const devicesOf = (id: string) => assets.filter((a) => a.opening_id === id)
  const summary = (o: Opening) => [
    devicesOf(o.id).length ? plural(devicesOf(o.id).length, 'device') : null,
    o.brivo_door_ids.length ? (o.brivo_door_ids.length === 1 ? `Brivo: ${nameOf(doorList, o.brivo_door_ids[0]) ?? 'door'}` : plural(o.brivo_door_ids.length, 'Brivo door')) : null,
    o.camera_ids.length ? plural(o.camera_ids.length, 'camera') : null,
    o.relay_ids.length ? plural(o.relay_ids.length, 'relay') : null,
    o.gate_watch_ids.length ? 'Gate Watch' : null,
  ].filter(Boolean).join(' · ') || 'Nothing linked yet'

  return (
    <Card title={`Openings${openings.length ? ` (${openings.length})` : ''}`} sub={sub}
      right={can_setup ? <button type="button" className="sy-b line sm" onClick={() => setEdit({ id: '', name: '', kind: 'gate', brivo_door_ids: [], camera_ids: [], relay_ids: [], gate_watch_ids: [], notes: null, asset_ids: [] })}>+ Add opening</button> : undefined}>
      {can_setup && suggestions.length > 0 && (
        <div style={{ background: '#F5F5F7', borderRadius: 12, padding: '12px 14px', marginBottom: 12 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>Found {plural(suggestions.length, 'likely opening')} from what’s set up here</div>
          <div style={{ fontSize: 12.5, color: MUTED, margin: '2px 0 8px' }}>Untick any that aren’t real gates or doors. You can rename or fix them after.</div>
          {suggestions.map((s) => (
            <label key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', fontSize: 14, cursor: 'pointer' }}>
              <input type="checkbox" checked={pick.has(s.key)} onChange={(e) => setPick((p) => { const n = new Set(p); if (e.target.checked) n.add(s.key); else n.delete(s.key); return n })} style={{ width: 17, height: 17 }} />
              <span style={{ flex: 1, minWidth: 0 }}>{s.name} <span style={{ color: MUTED, fontSize: 12.5 }}>· {kindLabel(s.kind)} · from {s.source}</span></span>
            </label>
          ))}
          <button type="button" className="sy-b pri sm" style={{ marginTop: 6 }} disabled={busy || !pick.size} onClick={() => void acceptPicked()}>Add {pick.size ? plural(pick.size, 'opening') : 'openings'}</button>
        </div>
      )}
      {openings.length === 0 ? <div className="sy-empty">{suggestions.length ? 'No openings yet — add the ones above.' : 'No openings yet. Add each gate and door at this property.'}</div>
        : openings.map((o) => (
          <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: '1px solid rgba(0,0,0,0.08)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{o.name} <span style={{ fontWeight: 400, color: MUTED, fontSize: 12.5 }}>· {kindLabel(o.kind)}</span></div>
              <div style={{ fontSize: 12.5, color: MUTED }}>{summary(o)}</div>
            </div>
            {can_setup && <button type="button" className="sy-b line sm" onClick={() => setEdit({ ...o, asset_ids: devicesOf(o.id).map((a) => a.id) })}>Edit</button>}
          </div>
        ))}

      {edit && (
        <Sheet title={edit.id ? `Edit ${edit.name || 'opening'}` : 'Add an opening'} sub="Tap to link what belongs to this gate or door." onClose={() => setEdit(null)} locked={busy}>
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              <Field label="Name"><input className="sy-in" value={edit.name} placeholder="Front vehicle gate" onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
              <Field label="Type"><select className="sy-in" value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value })}>{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
            </div>
            <Chips label="Devices (from the device list)" empty="No devices on this property’s list yet." items={assets.filter((a) => !a.opening_id || a.opening_id === edit.id).map((a) => ({ id: a.id, name: `${a.product_name}${a.location_note ? ` · ${a.location_note}` : ''}` }))} on={edit.asset_ids} set={(v) => setEdit({ ...edit, asset_ids: v })} />
            <Chips label="Brivo door" empty="Brivo isn’t connected here." items={doorList} on={edit.brivo_door_ids} set={(v) => setEdit({ ...edit, brivo_door_ids: v })} />
            <Chips label="Cameras" empty="No cameras connected." items={camList} on={edit.camera_ids} set={(v) => setEdit({ ...edit, camera_ids: v })} />
            <Chips label="Relays (Shelly)" empty="No relays connected." items={relayList} on={edit.relay_ids} set={(v) => setEdit({ ...edit, relay_ids: v })} />
            <Chips label="Gate Watch" empty="No Gate Watch gates." items={gates.map((g) => ({ id: g.id, name: g.label }))} on={edit.gate_watch_ids} set={(v) => setEdit({ ...edit, gate_watch_ids: v })} />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button type="button" className="sy-b pri" disabled={busy || !edit.name.trim()} onClick={() => void save()}>{edit.id ? 'Save' : 'Add opening'}</button>
              <button type="button" className="sy-b line" onClick={() => setEdit(null)}>Cancel</button>
              {edit.id && <button type="button" className="sy-b warn" style={{ marginLeft: 'auto' }} disabled={busy} onClick={() => void remove(edit)}>Remove</button>}
            </div>
          </div>
        </Sheet>
      )}
    </Card>
  )
}

function Chips({ label, items, on, set, empty }: { label: string; items: { id: string; name: string }[]; on: string[]; set: (v: string[]) => void; empty: string }) {
  return (
    <div>
      <span className="sy-lbl">{label}</span>
      {items.length === 0 ? <div className="sy-empty">{empty}</div> : (
        <div className="sy-chips">
          {items.map((it) => {
            const p = on.includes(it.id)
            return <button key={it.id} type="button" className="sy-chip" aria-pressed={p} onClick={() => set(p ? on.filter((x) => x !== it.id) : [...on, it.id])}>{it.name}</button>
          })}
        </div>
      )}
    </div>
  )
}
