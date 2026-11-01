'use client'
/**
 * Systems → Doors & gates → Gate Watch (AI). Every watched gate with its live
 * state (Closed / Open 3 min / LEFT OPEN), the last close-up the AI looked at, and
 * "Wrong?" buttons that teach it. Setup: pick the camera, outline the gate on a
 * live picture, teach it what open and closed look like, test it.
 * Engine: lib/gate-ai.ts + lib/gate-watch.ts (checks every 1–2 min).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { type Any, BLUE, Card, DOT, Dot, GREEN, MUTED, Note, RED, Sheet, getJson, send, type SiteCtx } from './shared'

const TYPES: [string, string][] = [['swing', 'Swing gate'], ['slide', 'Slide gate'], ['barrier_arm', 'Barrier arm'], ['vertical_lift', 'Vertical lift'], ['other', 'Other']]
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const ago = (iso?: string | null) => { if (!iso) return 'never'; const s = (Date.now() - Date.parse(iso)) / 1000; return s < 60 ? 'just now' : s < 3600 ? `${Math.round(s / 60)} min ago` : `${Math.round(s / 3600)} h ago` }
const forMin = (iso?: string | null) => iso ? Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 60000)) : null
const METHOD: Record<string, string> = { quick: 'quick match', fast_ai: 'AI', strong_ai: 'AI (double-checked)' }

const CSS = `
.gw-row{display:flex;gap:12px;align-items:center;padding:12px 0;border-top:1px solid rgba(0,0,0,.08)}
.gw-row:first-child{border-top:0}
.gw-thumb{width:112px;aspect-ratio:16/10;border-radius:8px;background:#0B0D12;object-fit:cover;flex:none}
.gw-pill{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;border-radius:999px;padding:3px 10px;white-space:nowrap}
.gw-pill.red{background:#FFECEC;color:${RED}}.gw-pill.orange{background:#FFF4E5;color:#B25000}.gw-pill.green{background:#E8F6EC;color:${GREEN}}.gw-pill.gray{background:#F2F2F7;color:#3A3A3C}
.gw-draw{position:relative;border-radius:10px;overflow:hidden;background:#0B0D12;cursor:crosshair;user-select:none}
.gw-draw img{display:block;width:100%}
.gw-draw svg{position:absolute;inset:0;width:100%;height:100%}
.gw-refs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.gw-refcol{background:#F5F5F7;border-radius:12px;padding:10px}
.gw-refgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:6px;margin:8px 0}
.gw-ref{position:relative}.gw-ref img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:6px;display:block}
.gw-ref button{position:absolute;top:3px;right:3px;width:22px;height:22px;border-radius:11px;border:0;background:rgba(0,0,0,.6);color:#fff;font-size:12px;cursor:pointer}
.gw-ref .fb{position:absolute;left:3px;bottom:3px;font-size:9.5px;font-weight:600;color:#fff;background:rgba(0,113,227,.85);border-radius:4px;padding:1px 4px}
.gw-grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.gw-sec{font-size:13px;font-weight:600;margin:4px 0 6px}
.gw-test{display:flex;gap:12px;align-items:flex-start;background:#F5F5F7;border-radius:12px;padding:10px}
.gw-test img{width:180px;border-radius:8px;flex:none}
@media (max-width:640px){.gw-grid2,.gw-refs{grid-template-columns:1fr}.gw-thumb{width:84px}.gw-test{flex-direction:column}.gw-test img{width:100%}}
`

function statePill(g: Any) {
  const taughtOk = (g.taught?.open ?? 0) > 0 && (g.taught?.closed ?? 0) > 0
  if (!g.enabled) return <span className="gw-pill gray">Paused</span>
  if (g.state === 'left_open') return <span className="gw-pill red"><Dot c={DOT.red} />Left open · {forMin(g.open_since)} min</span>
  if (g.state === 'open') return <span className="gw-pill orange"><Dot c={DOT.orange} />Open · {forMin(g.open_since)} min</span>
  if (g.state === 'closed') return <span className="gw-pill green"><Dot c={DOT.green} />Closed</span>
  if (g.state === 'blind') return <span className="gw-pill orange">Can’t see the gate</span>
  return <span className="gw-pill gray">{taughtOk ? 'Starting…' : 'Needs teaching'}</span>
}

export function GateWatch({ ctx, doors }: { ctx: SiteCtx; doors: Any[] | null }) {
  const { siteId, notify } = ctx
  const [gates, setGates] = useState<Any[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [canSetup, setCanSetup] = useState(false)
  const [edit, setEdit] = useState<Any | 'new' | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const load = useCallback(async () => {
    const r = await getJson(`/api/sites/${siteId}/gates`)
    if (r.ok) { setGates(r.data.gates ?? []); setCanSetup(!!r.data.can_setup); setErr(null) } else { setGates([]); setErr(r.data.error || 'Gate Watch unavailable.') }
  }, [siteId])
  useEffect(() => { void load(); const t = setInterval(() => { if (!document.hidden) void load() }, 30_000); return () => clearInterval(t) }, [load])

  async function act(g: Any, body: Any, okMsg: string) {
    setBusy(g.id)
    const r = await send(`/api/sites/${siteId}/gates`, 'POST', { id: g.id, ...body })
    setBusy(null)
    if (r.ok) { notify(okMsg); void load() } else notify(r.data.error || 'Gate Watch didn’t accept that.', false)
    return r
  }
  const left = (gates ?? []).filter(g => g.state === 'left_open').length

  if (err && /migration 210/.test(err)) return <Card title="Gate Watch (AI)"><Note>Gate Watch is installed but its database table isn’t yet — run migration 210 on this Supabase project.</Note></Card>
  return (
    <>
      <style>{CSS}</style>
      <Card title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>Gate Watch (AI){left > 0 && <span className="gw-pill red">{left} left open</span>}</span>}
        sub="Watches each gate camera and alerts when a gate stays open too long — no one has to look."
        right={canSetup ? <button type="button" className="sy-b pri sm" onClick={() => setEdit('new')}>Add a gate</button> : undefined}>
        {err && <div style={{ marginBottom: 8 }}><Note tone="orange">{err}</Note></div>}
        {gates == null ? <div className="sy-empty">Loading…</div>
          : !gates.length ? <div className="sy-empty">{canSetup ? 'No gates watched yet. Add one: pick its camera, outline the gate, and show it what open and closed look like.' : 'No gates are being watched here yet.'}</div>
          : gates.map(g => {
            const taughtOk = (g.taught?.open ?? 0) > 0 && (g.taught?.closed ?? 0) > 0
            const isOpen = g.state === 'open' || g.state === 'left_open'
            return (
              <div key={g.id} className="gw-row">
                {g.last_frame
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img className="gw-thumb" alt={`${g.label} — last picture checked`} src={`data:image/jpeg;base64,${g.last_frame}`} />
                  : <div className="gw-thumb" />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><span style={{ fontSize: 14, fontWeight: 600 }}>{g.label}</span>{statePill(g)}</div>
                  <div style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>{[g.camera_name, `alert after ${Math.round(g.threshold_sec / 60)} min`, g.last_checked_at ? `checked ${ago(g.last_checked_at)}${g.last_confidence != null ? ` · ${g.last_confidence}% sure` : ''}${g.last_method ? ` · ${METHOD[g.last_method] ?? g.last_method}` : ''}` : 'not checked yet'].filter(Boolean).join(' · ')}</div>
                  {g.last_reason && <div style={{ fontSize: 12, color: MUTED, marginTop: 2, fontStyle: 'italic' }}>“{g.last_reason}”</div>}
                  {!taughtOk && <div style={{ fontSize: 12, color: BLUE, marginTop: 4 }}>{canSetup ? 'Teach it one picture open and one closed to make it accurate.' : 'Not taught yet — ask your admin to finish setup.'}</div>}
                </div>
                <div className="sy-acts" style={{ justifyContent: 'flex-end' }}>
                  <button type="button" className="sy-b line sm" disabled={busy === g.id} onClick={() => act(g, { action: 'check_now' }, `${g.label} checked.`)}>{busy === g.id ? 'Checking…' : 'Check now'}</button>
                  {(isOpen || g.state === 'closed') && g.last_frame && <button type="button" className="sy-b line sm" disabled={busy === g.id} onClick={() => act(g, { action: 'feedback', correct: isOpen ? 'closed' : 'open' }, 'Thanks — it learned from that.')} aria-label={`Wrong — ${g.label} is actually ${isOpen ? 'closed' : 'open'}`}>Wrong? It’s {isOpen ? 'closed' : 'open'}</button>}
                  {canSetup && <button type="button" className="sy-b line sm" onClick={() => setEdit(g)} aria-label={`Set up ${g.label}`}>Set up</button>}
                </div>
              </div>
            )
          })}
      </Card>
      {edit && <GateSetup ctx={ctx} gate={edit === 'new' ? null : edit} doors={doors ?? []} onClose={() => { setEdit(null); void load() }} />}
    </>
  )
}

function GateSetup({ ctx, gate, doors, onClose }: { ctx: SiteCtx; gate: Any | null; doors: Any[]; onClose: () => void }) {
  const { siteId, notify } = ctx
  const [cams, setCams] = useState<Any[]>([])
  const [g, setG] = useState<Any | null>(gate)
  const hold0 = Array.isArray(gate?.hold_open_hours) && gate.hold_open_hours[0] ? gate.hold_open_hours[0] : null
  const [f, setF] = useState({
    camera_key: gate?.camera_key ?? '', label: gate?.label ?? '', gate_type: gate?.gate_type ?? 'swing', threshold_min: gate ? Math.round(gate.threshold_sec / 60) : 5,
    brivo_door_id: gate?.brivo_door_id ?? '', phones: (gate?.notify_phones ?? []).join(', '), notes: gate?.notes ?? '', enabled: gate?.enabled ?? true,
    hold: !!hold0, holdDays: (hold0?.days ?? [1, 2, 3, 4, 5]) as number[], holdStart: hold0?.start ?? '09:00', holdEnd: hold0?.end ?? '18:00',
  })
  const [region, setRegion] = useState<{ x: number; y: number }[]>(Array.isArray(gate?.region) ? gate.region : [])
  const [snap, setSnap] = useState<string | null>(null)
  const [snapBusy, setSnapBusy] = useState(false)
  const [refs, setRefs] = useState<Any[]>([])
  const [checks, setChecks] = useState<Any[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [test, setTest] = useState<Any | null>(null)
  const [confirmDel, setConfirmDel] = useState(false)
  const drawRef = useRef<HTMLDivElement>(null)
  const [dim, setDim] = useState({ w: 1000, h: 562 })

  useEffect(() => { void getJson(`/api/sites/${siteId}/video?view=cameras`).then(r => setCams(Array.isArray(r.data.cameras) ? r.data.cameras : [])) }, [siteId])
  const loadDetail = useCallback(async (id: string) => {
    const r = await getJson(`/api/sites/${siteId}/gates?gate=${id}`)
    if (r.ok) { setRefs(r.data.refs ?? []); setChecks(r.data.checks ?? []); setG(r.data.gate) }
  }, [siteId])
  useEffect(() => { if (g?.id) void loadDetail(g.id) }, [g?.id, loadDetail])

  async function getSnap(key = f.camera_key) {
    if (!key) { notify('Pick the camera first.', false); return }
    setSnapBusy(true)
    const r = await send(`/api/sites/${siteId}/gates`, 'POST', { action: 'snapshot', camera_key: key })
    setSnapBusy(false)
    if (r.ok) setSnap(r.data.image); else notify(r.data.error || 'No picture from that camera.', false)
  }
  useEffect(() => { if (gate?.camera_key) void getSnap(gate.camera_key) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function addPoint(e: React.MouseEvent) {
    const r = drawRef.current!.getBoundingClientRect()
    if (region.length >= 16) return
    setRegion(p => [...p, { x: Math.round(((e.clientX - r.left) / r.width) * 1000) / 1000, y: Math.round(((e.clientY - r.top) / r.height) * 1000) / 1000 }])
  }

  async function save() {
    const cam = cams.find(c => c.key === f.camera_key)
    setBusy('save')
    const r = await send(`/api/sites/${siteId}/gates`, 'POST', {
      action: 'save', id: g?.id, camera_key: f.camera_key, camera_name: cam?.name ?? g?.camera_name ?? null, label: f.label, gate_type: f.gate_type, region,
      threshold_min: f.threshold_min, brivo_door_id: f.brivo_door_id || null, notify_phones: f.phones, notes: f.notes, enabled: f.enabled,
      hold_open_hours: f.hold ? [{ days: f.holdDays, start: f.holdStart, end: f.holdEnd }] : [],
    })
    setBusy(null)
    if (!r.ok) { notify(r.data.error || 'Couldn’t save the gate.', false); return }
    setG(r.data.gate)
    notify(r.data.refs_cleared ? 'Saved. The camera or outline changed, so teach it open and closed again.' : g ? 'Saved.' : 'Gate added — now teach it what open and closed look like.')
    if (r.data.refs_cleared) setRefs([])
  }
  async function teach(state: 'open' | 'closed') {
    if (!g?.id) return
    setBusy(`teach-${state}`)
    const r = await send(`/api/sites/${siteId}/gates`, 'POST', { action: 'teach', id: g.id, state })
    setBusy(null)
    if (r.ok) { setRefs(x => [r.data.ref, ...x]); notify(`Saved as ${state.toUpperCase()}.`) } else notify(r.data.error || 'Couldn’t save the picture.', false)
  }
  async function delRef(id: string) {
    const r = await send(`/api/sites/${siteId}/gates`, 'POST', { action: 'delete_ref', ref_id: id })
    if (r.ok) setRefs(x => x.filter(y => y.id !== id)); else notify(r.data.error || 'Couldn’t delete.', false)
  }
  async function runTest(ai = false) {
    if (!g?.id) return
    setBusy(ai ? 'test-ai' : 'test'); setTest(null)
    const r = await send(`/api/sites/${siteId}/gates`, 'POST', { action: 'test', id: g.id, ai })
    setBusy(null)
    if (r.ok) setTest(r.data); else notify(r.data.error || 'Test failed.', false)
  }
  async function openGate() {
    const d = doors.find(x => String(x.id) === String(f.brivo_door_id))
    if (!d) return
    setBusy('open')
    const r = await send(`/api/brivo/doors/${d.id}`, 'POST', { site_id: siteId, door_name: d.name, confirm: true })
    setBusy(null)
    notify(r.ok ? `${d.name} opening — save the OPEN picture while it’s open.` : (r.data.error || 'Couldn’t open the gate.'), r.ok)
  }
  async function remove() {
    if (!g?.id) return
    setBusy('del')
    const r = await send(`/api/sites/${siteId}/gates`, 'POST', { action: 'delete', id: g.id })
    setBusy(null)
    if (r.ok) { notify('Gate removed.'); onClose() } else notify(r.data.error || 'Couldn’t remove the gate.', false)
  }

  const W = dim.w, H = dim.h
  const pts = region.map(p => `${p.x * W},${p.y * H}`).join(' ')
  const byState = (s: string) => refs.filter(r => r.state === s)
  const verdictPill = (v: string) => v === 'closed' ? 'green' : v === 'open' ? 'orange' : v === 'partial' ? 'orange' : 'gray'

  return (
    <Sheet title={g ? `Set up · ${g.label}` : 'Add a gate'} sub="Gate Watch alerts when this gate stays open longer than its limit." onClose={onClose} width={900} locked={busy === 'save'}>
      <div className="gw-grid2">
        <label><span className="sy-lbl">Camera that sees the gate</span>
          <select className="sy-in" value={f.camera_key} onChange={e => { setF({ ...f, camera_key: e.target.value }); setRegion([]); setSnap(null); if (e.target.value) void getSnap(e.target.value) }}>
            <option value="">Pick a camera…</option>
            {cams.map(c => <option key={c.key} value={c.key}>{c.name}{c.provider === 'edge' ? ' (Edge)' : ''}</option>)}
          </select></label>
        <label><span className="sy-lbl">Gate name</span><input className="sy-in" value={f.label} onChange={e => setF({ ...f, label: e.target.value })} placeholder="e.g. Main entrance" /></label>
        <label><span className="sy-lbl">Kind of gate</span><select className="sy-in" value={f.gate_type} onChange={e => setF({ ...f, gate_type: e.target.value })}>{TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label><span className="sy-lbl">Alert if open longer than (minutes)</span><input className="sy-in" type="number" min={1} max={1440} value={f.threshold_min} onChange={e => setF({ ...f, threshold_min: Number(e.target.value) || 5 })} /></label>
        <label><span className="sy-lbl">Brivo door for this gate (optional)</span><select className="sy-in" value={f.brivo_door_id} onChange={e => setF({ ...f, brivo_door_id: e.target.value })}><option value="">None</option>{doors.map(d => <option key={d.id} value={String(d.id)}>{d.name}</option>)}</select></label>
        <label><span className="sy-lbl">Text these numbers when it’s left open</span><input className="sy-in" value={f.phones} onChange={e => setF({ ...f, phones: e.target.value })} placeholder="404-555-0100, 678-555-0199" /></label>
      </div>
      <label><span className="sy-lbl">Anything that helps (optional)</span><input className="sy-in" value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} placeholder="e.g. Two panels, swings away from the camera; the left lane is the exit" /></label>
      <div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}><input type="checkbox" checked={f.hold} onChange={e => setF({ ...f, hold: e.target.checked })} />Gate is meant to be open during set hours (no alerts then)</label>
        {f.hold && <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
          <div className="sy-chips" role="group" aria-label="Days">{DAYS.map((d, i) => <button key={d} type="button" className="sy-chip" aria-pressed={f.holdDays.includes(i)} onClick={() => setF({ ...f, holdDays: f.holdDays.includes(i) ? f.holdDays.filter(x => x !== i) : [...f.holdDays, i].sort() })}>{d}</button>)}</div>
          <input className="sy-in" type="time" style={{ width: 120 }} value={f.holdStart} onChange={e => setF({ ...f, holdStart: e.target.value })} aria-label="Open from" />
          <span style={{ fontSize: 13, color: MUTED }}>to</span>
          <input className="sy-in" type="time" style={{ width: 120 }} value={f.holdEnd} onChange={e => setF({ ...f, holdEnd: e.target.value })} aria-label="Open until" />
        </div>}
      </div>

      <div>
        <div className="gw-sec">Outline the gate <span style={{ fontWeight: 400, color: MUTED }}>· click its corners on the picture (include the space it swings or slides into)</span></div>
        {!snap ? <div className="sy-empty">{snapBusy ? 'Getting a picture…' : f.camera_key ? 'No picture yet.' : 'Pick the camera above.'}</div> : (
          <div ref={drawRef} className="gw-draw" onClick={addPoint} role="img" aria-label="Camera picture — click to outline the gate">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="" src={`data:image/jpeg;base64,${snap}`} draggable={false} onLoad={e => { const im = e.currentTarget; if (im.naturalWidth) setDim({ w: im.naturalWidth, h: im.naturalHeight }) }} />
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
              {region.length >= 3 && <polygon points={pts} fill="rgba(255,214,10,.18)" stroke="#FFD60A" strokeWidth={Math.max(2, W / 330)} />}
              {region.length > 0 && region.length < 3 && <polyline points={pts} fill="none" stroke="#FFD60A" strokeWidth={3} />}
              {region.map((p, i) => <circle key={i} cx={p.x * W} cy={p.y * H} r={Math.max(6, W / 120)} fill="#FFD60A" stroke="#000" strokeWidth={2} />)}
            </svg>
          </div>
        )}
        <div className="sy-acts" style={{ marginTop: 6 }}>
          <button type="button" className="sy-b line sm" onClick={() => getSnap()} disabled={!f.camera_key || snapBusy}>{snapBusy ? 'Loading…' : 'New picture'}</button>
          <button type="button" className="sy-b line sm" onClick={() => setRegion(r => r.slice(0, -1))} disabled={!region.length}>Undo point</button>
          <button type="button" className="sy-b line sm" onClick={() => setRegion([])} disabled={!region.length}>Clear outline</button>
          <span style={{ fontSize: 12, color: region.length >= 3 ? GREEN : MUTED, alignSelf: 'center' }}>{region.length >= 3 ? `Outline set (${region.length} points)` : `${region.length} of at least 3 points`}</span>
        </div>
      </div>

      <div className="sy-acts" style={{ justifyContent: 'space-between' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}><input type="checkbox" checked={f.enabled} onChange={e => setF({ ...f, enabled: e.target.checked })} />Watching on</label>
        <button type="button" className="sy-b pri" onClick={save} disabled={busy === 'save' || !f.camera_key || !f.label.trim() || region.length < 3}>{busy === 'save' ? 'Saving…' : g ? 'Save changes' : 'Add gate'}</button>
      </div>

      {g?.id && <>
        <div>
          <div className="gw-sec">Teach it this gate <span style={{ fontWeight: 400, color: MUTED }}>· save the live picture when the gate is closed, and again when it’s open. 2–3 of each (day and night) makes it very accurate.</span></div>
          {f.brivo_door_id && <div style={{ marginBottom: 8 }}><button type="button" className="sy-b blue sm" onClick={openGate} disabled={busy === 'open'}>{busy === 'open' ? 'Opening…' : 'Open the gate now (Brivo)'}</button></div>}
          <div className="gw-refs">
            {(['closed', 'open'] as const).map(s => (
              <div key={s} className="gw-refcol">
                <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}><Dot c={s === 'closed' ? DOT.green : DOT.orange} />{s === 'closed' ? 'Closed' : 'Open'} pictures ({byState(s).length})</div>
                <div className="gw-refgrid">
                  {byState(s).map(r => <div key={r.id} className="gw-ref">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt={`${s} example`} src={`data:image/jpeg;base64,${r.image}`} />
                    {r.source === 'feedback' && <span className="fb">learned</span>}
                    <button type="button" onClick={() => delRef(r.id)} aria-label={`Delete this ${s} picture`}>✕</button>
                  </div>)}
                </div>
                <button type="button" className="sy-b line sm" onClick={() => teach(s)} disabled={!!busy}>{busy === `teach-${s}` ? 'Saving…' : `Gate is ${s} now — save picture`}</button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="gw-sec">Test it</div>
          <div className="sy-acts"><button type="button" className="sy-b line sm" onClick={() => runTest(false)} disabled={!!busy}>{busy === 'test' ? 'Testing…' : 'Test now'}</button><button type="button" className="sy-b line sm" onClick={() => runTest(true)} disabled={!!busy}>{busy === 'test-ai' ? 'Asking the AI…' : 'Test with the AI'}</button></div>
          {test && <div className="gw-test" style={{ marginTop: 8 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="What the AI looked at" src={`data:image/jpeg;base64,${test.image}`} />
            <div style={{ fontSize: 13 }}>
              <span className={`gw-pill ${verdictPill(test.verdict)}`}>{String(test.verdict).toUpperCase()} · {test.confidence}% sure</span>
              <div style={{ marginTop: 6 }}>{test.reason}</div>
              <div style={{ marginTop: 4, color: MUTED, fontSize: 12 }}>{METHOD[test.method] ?? test.method} · {Math.round((test.ms ?? 0) / 100) / 10}s{test.vehicle ? ' · vehicle in the gate' : ''}</div>
            </div>
          </div>}
        </div>

        {checks.length > 0 && <div>
          <div className="gw-sec">Recent checks</div>
          <div className="sy-feed" style={{ maxHeight: 200 }}>{checks.slice(0, 20).map((c, i) => (
            <div key={i} className="sy-row" style={{ padding: '6px 0' }}><div className="main"><div className="t" style={{ fontSize: 12.5 }}>{new Date(c.checked_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} · {c.verdict} · {c.confidence ?? '—'}% · {METHOD[c.method] ?? c.method}</div>{c.reason && <div className="m">{c.reason}</div>}</div></div>
          ))}</div>
        </div>}

        <div className="sy-acts" style={{ justifyContent: 'flex-end' }}>
          {confirmDel ? <><span style={{ fontSize: 13, color: RED, alignSelf: 'center' }}>Stop watching this gate and delete its pictures?</span><button type="button" className="sy-b line sm" onClick={() => setConfirmDel(false)}>Keep</button><button type="button" className="sy-b warn sm" onClick={remove} disabled={busy === 'del'}>Remove gate</button></>
            : <button type="button" className="sy-b warn sm" onClick={() => setConfirmDel(true)}>Remove gate</button>}
        </div>
      </>}
    </Sheet>
  )
}
