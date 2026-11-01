'use client'
/**
 * Systems → Doors & gates: every Brivo door (unlock + link the camera that
 * watches it), every Shelly relay (pulse / on / off), and the gate re-boot
 * macros. One list of each — this replaces the three separate door lists and two
 * relay lists the old Systems page had.
 */
import React, { useState } from 'react'
import { GateReboots } from '@/components/nexus/GateReboots'
import { type Any, BLUE, Card, Dot, DOT, Field, GREEN, MUTED, NotConnected, Note, Sheet, send, type SiteCtx } from './shared'

export function DoorsTab({ ctx, doors, doorErr, camMap, cams, relays, relayErr, reloadDoors, reloadRelays, setRelayState }: {
  ctx: SiteCtx
  doors: Any[] | null; doorErr: string | null
  camMap: Record<string, Any>; cams: Any[] | null
  relays: Any[] | null; relayErr: string | null
  reloadDoors: () => void; reloadRelays: () => void
  setRelayState: (id: string, channel: number, on: boolean) => void
}) {
  const { siteId, isCorporate, notify, openSetup } = ctx
  const [busy, setBusy] = useState<string | null>(null)
  const [linkFor, setLinkFor] = useState<Any | null>(null)

  async function unlock(d: Any) {
    if (!window.confirm(`Unlock “${d.name}” now? This physically unlocks it.`)) return
    setBusy(`d:${d.id}`)
    const r = await send(`/api/brivo/doors/${d.id}`, 'POST', { site_id: siteId, door_name: d.name, confirm: true })
    setBusy(null)
    const cam = camMap[String(d.id)]?.camera_name
    notify(r.ok ? `${d.name} unlocked — logged${cam ? ` with ${cam}` : ''}.` : (r.data.error || 'Couldn’t unlock.'), r.ok)
  }
  // Suggest the camera whose name/tags share a word with the door name.
  function suggest(doorName: string) {
    // Best match wins (most shared words); cameras already on another door are skipped.
    const words = String(doorName).toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2)
    const used = new Set(Object.values(camMap).map(m => String(m.camera_id)))
    let best: Any | null = null, bestScore = 0
    for (const c of cams ?? []) {
      if (used.has(String(c.id))) continue
      const hay = `${c.name} ${(c.tags || []).join(' ')}`.toLowerCase()
      const score = words.filter(w => hay.includes(w)).length
      if (score > bestScore) { best = c; bestScore = score }
    }
    return best
  }
  async function quickLink(d: Any, c: Any) {
    setBusy(`d:${d.id}`)
    const r = await send(`/api/sites/${siteId}/door-cameras`, 'PUT', { door_id: d.id, door_name: d.name, camera_id: c.id, camera_name: c.name, tags: c.tags ?? [] })
    setBusy(null)
    notify(r.ok ? `${c.name} linked to ${d.name}.` : (r.data.error || 'Couldn’t link the camera.'), r.ok)
    if (r.ok) reloadDoors()
  }
  async function relay(r: Any, kind: 'pulse' | 'on' | 'off') {
    const nm = r.name ?? 'Relay'
    const q = kind === 'pulse' ? `Pulse “${nm}” for 1 second? (opens / resets a gate)` : `Turn “${nm}” ${kind.toUpperCase()}? This switches the physical relay.`
    if (!window.confirm(q)) return
    const key = `r:${r.id}:${r.channel ?? 0}`
    setBusy(key)
    const body: Any = { site_id: siteId, channel: r.channel ?? 0, name: nm, confirm: true }
    if (kind === 'pulse') body.pulse = 1; else body.on = kind === 'on'
    const res = await send(`/api/shelly/relays/${r.id}`, 'POST', body)
    setBusy(null)
    if (res.ok) {
      notify(kind === 'pulse' ? `${nm} pulsed — logged.` : `${nm} turned ${kind} — logged.`)
      if (kind !== 'pulse') setRelayState(String(r.id), Number(r.channel ?? 0), kind === 'on')
    } else notify(res.data.error || 'Couldn’t switch the relay.', false)
  }

  return (
    <div className="sy-stack">
      <Card title={`Doors & gates${doors?.length ? ` (${doors.length})` : ''}`} sub="Live from Brivo. Every unlock is logged with who, when and the linked camera.">
        {doors == null ? <div className="sy-empty">Loading doors…</div>
          : doorErr && !doors.length ? (/no door access/i.test(doorErr) ? <Note>You don’t have door access at this property.</Note> : <NotConnected what="Brivo (doors)" isCorporate={isCorporate} onSetup={openSetup} />)
          : !doors.length ? <div className="sy-empty">No doors found in Brivo for this property.</div>
          : doors.map(d => {
            const m = camMap[String(d.id)]
            const s = !m ? suggest(d.name) : null
            const b = busy === `d:${d.id}`
            return (
              <div key={d.id} className="sy-row">
                <div className="main">
                  <div className="t">{d.name}</div>
                  <div className="m">
                    {m ? <>Camera: {m.camera_name}{(m.tags ?? []).length ? <> · {(m.tags as string[]).join(', ')}</> : null}</> : 'No camera linked'}
                    {s && <> · <button type="button" onClick={() => quickLink(d, s)} disabled={b} style={{ border: 0, background: 'none', padding: 0, color: BLUE, font: 'inherit', fontWeight: 600, cursor: 'pointer' }}>Link “{s.name}”?</button></>}
                  </div>
                </div>
                <button type="button" className="sy-b line sm" onClick={() => setLinkFor(d)}>{m ? 'Camera' : 'Add camera'}</button>
                <button type="button" className="sy-b pri sm" onClick={() => unlock(d)} disabled={b}>{b ? '…' : 'Unlock'}</button>
              </div>
            )
          })}
      </Card>

      <Card title={`Relays & power${relays?.length ? ` (${relays.length})` : ''}`} sub="Shelly smart relays. Pulse opens or resets a gate; on/off switches power. All logged.">
        {relays == null ? <div className="sy-empty">Loading relays…</div>
          : relayErr && !relays.length ? (/relay access/i.test(relayErr) ? <Note>You don’t have relay access at this property.</Note> : <NotConnected what="Shelly (relays)" isCorporate={isCorporate} onSetup={openSetup} />)
          : !relays.length ? <div className="sy-empty">No relays found. {isCorporate ? 'Shelly devices are matched by name — the device name must contain the property name (or set the property tag in Setup & keys).' : ''}</div>
          : relays.map(r => {
            const key = `r:${r.id}:${r.channel ?? 0}`
            const on = r.on ?? r.ison
            return (
              <div key={key} className="sy-row">
                <Dot c={on === true ? DOT.green : on === false ? DOT.gray : DOT.orange} />
                <div className="main">
                  <div className="t">{r.name ?? 'Relay'}</div>
                  <div className="m" style={{ color: on == null ? '#B25000' : MUTED }}>{on === true ? 'On' : on === false ? 'Off' : 'Status unknown — may be offline'}</div>
                </div>
                <button type="button" className="sy-b blue sm" onClick={() => relay(r, 'pulse')} disabled={busy === key}>Pulse</button>
                <button type="button" className="sy-b line sm" onClick={() => relay(r, on === true ? 'off' : 'on')} disabled={busy === key} style={{ color: on === true ? '#D70015' : GREEN }}>{busy === key ? '…' : on === true ? 'Turn off' : 'Turn on'}</button>
              </div>
            )
          })}
        {relays && relays.length > 0 && <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}><button type="button" className="sy-b line sm" onClick={reloadRelays}>Refresh status</button></div>}
      </Card>

      <div id="sy-reboots" style={{ scrollMarginTop: 60 }}><GateReboots siteId={siteId} isCorporate={isCorporate} /></div>

      {linkFor && <LinkCamera ctx={ctx} door={linkFor} current={camMap[String(linkFor.id)]} cams={cams ?? []} onClose={() => setLinkFor(null)} onSaved={() => { setLinkFor(null); reloadDoors() }} />}
    </div>
  )
}

function LinkCamera({ ctx, door, current, cams, onClose, onSaved }: { ctx: SiteCtx; door: Any; current?: Any; cams: Any[]; onClose: () => void; onSaved: () => void }) {
  const { siteId, notify } = ctx
  const [f, setF] = useState({ camera_id: current?.camera_id ?? '', camera_name: current?.camera_name ?? '', stream_url: current?.stream_url ?? '', tags: (current?.tags ?? []).join(', ') })
  const [busy, setBusy] = useState(false)
  const pick = (id: string) => {
    const c = cams.find(x => String(x.id) === id)
    setF(v => c ? { ...v, camera_id: String(c.id), camera_name: c.name, tags: (c.tags ?? []).join(', ') } : { ...v, camera_id: '' })
  }
  async function save() {
    if (!f.camera_name.trim()) return
    setBusy(true)
    const r = await send(`/api/sites/${siteId}/door-cameras`, 'PUT', { door_id: door.id, door_name: door.name, camera_name: f.camera_name.trim(), camera_id: f.camera_id || null, stream_url: f.stream_url.trim() || null, tags: f.tags.split(',').map((t: string) => t.trim()).filter(Boolean) })
    setBusy(false)
    if (!r.ok) { notify(r.data.error || 'Couldn’t save the camera.', false); return }
    notify(`Camera saved for ${door.name}.`); onSaved()
  }
  async function unlink() {
    setBusy(true)
    const r = await send(`/api/sites/${siteId}/door-cameras?door_id=${encodeURIComponent(door.id)}`, 'DELETE')
    setBusy(false)
    if (!r.ok) { notify(r.data.error || 'Couldn’t unlink.', false); return }
    notify(`Camera unlinked from ${door.name}.`); onSaved()
  }
  return (
    <Sheet title={`Camera for ${door.name}`} sub="Unlocks are logged with this camera so you can pull the footage." onClose={onClose} width={480}>
      {cams.length > 0 && <Field label="Eagle Eye camera"><select className="sy-in" value={f.camera_id} onChange={e => pick(e.target.value)}><option value="">Pick a camera…</option>{cams.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>}
      <Field label="Camera name"><input className="sy-in" value={f.camera_name} onChange={e => setF({ ...f, camera_name: e.target.value })} placeholder="Front Gate Cam" /></Field>
      <Field label="Live view link (optional)"><input className="sy-in" value={f.stream_url} onChange={e => setF({ ...f, stream_url: e.target.value })} placeholder="https://…" /></Field>
      <Field label="Tags (comma-separated)"><input className="sy-in" value={f.tags} onChange={e => setF({ ...f, tags: e.target.value })} placeholder="entrance, LPR" /></Field>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="sy-b pri" onClick={save} disabled={busy || !f.camera_name.trim()}>{busy ? 'Saving…' : 'Save'}</button>
        {current && <button type="button" className="sy-b warn" onClick={unlink} disabled={busy} style={{ marginLeft: 'auto' }}>Unlink</button>}
      </div>
    </Sheet>
  )
}
