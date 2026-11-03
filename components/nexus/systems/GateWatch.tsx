'use client'
/**
 * Systems → Doors & gates → Gate Watch (AI). Every watched gate with its live
 * state (Closed / Open 3 min / LEFT OPEN), the last close-up the AI looked at, and
 * "Wrong?" buttons that teach it. Setup: pick the camera, outline the gate on a
 * live picture, teach it what open and closed look like, test it.
 * Engine: lib/gate-ai.ts + lib/gate-watch.ts (closed every 30 min; seen open → one recheck at limit + 1 min → alert).
 * Right? Yes / No on each reading teaches it (Yes = confirmed example, No = corrected example) and counts accuracy.
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
.gw-ask{display:inline-flex;align-items:center;gap:6px}.gw-ask .q{font-size:12px;color:#6E6E73}
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

/** 41 min · 2 h 5 min · 1 d 3 h */
export const fmtDur = (ms: number) => { const m = Math.round(ms / 60e3); if (m < 60) return `${Math.max(1, m)} min`; const h = Math.floor(m / 60); if (h < 24) return `${h} h${m % 60 ? ` ${m % 60} min` : ''}`; return `${Math.floor(h / 24)} d${h % 24 ? ` ${h % 24} h` : ''}` }
function statePill(g: Any) {
  const taughtOk = (g.taught?.open ?? 0) > 0 && (g.taught?.closed ?? 0) > 0
  if (!g.enabled) return <span className="gw-pill gray">Paused</span>
  if (g.state === 'left_open' && !g.incident_id) return <span className="gw-pill orange" title="A service ticket is already open — alerts are paused until that work order is finished"><Dot c={DOT.orange} />Down · ticket open</span>
  if (g.state === 'left_open') return <span className="gw-pill red"><Dot c={DOT.red} />Down · open {forMin(g.open_since)} min</span>
  if (g.state === 'open') return <span className="gw-pill orange"><Dot c={DOT.orange} />Open · {forMin(g.open_since)} min</span>
  if (g.state === 'closed') return <span className="gw-pill green"><Dot c={DOT.green} />Closed</span>
  if (g.state === 'blind') return <span className="gw-pill orange">Can’t see the gate</span>
  return <span className="gw-pill gray">{taughtOk ? 'Starting…' : 'Needs teaching'}</span>
}

/** Read a picture file, shrink it to ≤ 1600 px and return base64 JPEG (no data: prefix). */
function shrinkPicture(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!/^image\//.test(file.type)) { reject(new Error('not a picture')); return }
    const url = URL.createObjectURL(file)
    const im = new Image()
    im.onload = () => {
      const k = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight))
      const c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k)
      c.getContext('2d')?.drawImage(im, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      resolve(c.toDataURL('image/jpeg', 0.88).split(',')[1] ?? '')
    }
    im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('unreadable')) }
    im.src = url
  })
}

export function GateWatch({ ctx, doors }: { ctx: SiteCtx; doors: Any[] | null }) {
  const { siteId, notify } = ctx
  const [gates, setGates] = useState<Any[] | null>(null)
  const [summary, setSummary] = useState<Any | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [canSetup, setCanSetup] = useState(false)
  const [edit, setEdit] = useState<Any | 'new' | null>(null)
  const [presetCam, setPresetCam] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const load = useCallback(async () => {
    const r = await getJson(`/api/sites/${siteId}/gates`)
    if (r.ok) { setGates(r.data.gates ?? []); setSummary(r.data.summary ?? null); setCanSetup(!!r.data.can_setup); setErr(null) } else { setGates([]); setErr(r.data.error || 'Gate Watch unavailable.') }
  }, [siteId])
  useEffect(() => { void load(); const t = setInterval(() => { if (!document.hidden) void load() }, 30_000); return () => clearInterval(t) }, [load])

  async function act(g: Any, body: Any, okMsg: string | ((d: Any) => string)) {
    setBusy(g.id)
    const r = await send(`/api/sites/${siteId}/gates`, 'POST', { id: g.id, ...body })
    setBusy(null)
    if (r.ok) { notify(typeof okMsg === 'function' ? okMsg(r.data) : okMsg); void load() } else notify(r.data.error || 'Gate Watch didn’t accept that.', false)
    return r
  }
  const left = (gates ?? []).filter(g => g.state === 'left_open').length

  if (err && /migration 210/.test(err)) return <Card title="Gate Watch (AI)"><Note>Gate Watch is installed but its database table isn’t yet — run migration 210 on this Supabase project.</Note></Card>
  return (
    <>
      <style>{CSS}</style>
      <Card title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>Gate Watch (AI){left > 0 && <span className="gw-pill red">{left} down</span>}</span>}
        sub={summary?.watched ? `${summary.watched} gate${summary.watched === 1 ? '' : 's'} · ${summary.down ? `${summary.down} down` : 'all up'}${summary.up_pct != null ? ` · ${summary.up_pct}% up (30 days)` : ''}${summary.avg_down_ms != null ? ` · average ${fmtDur(summary.avg_down_ms)} down` : ''}${summary.blind ? ` · ${summary.blind} can’t be seen` : ''}` : 'Watches each gate camera and alerts when a gate stays open too long — no one has to look.'}
        right={canSetup ? <button type="button" className="sy-b pri sm" onClick={() => { setPresetCam(null); setEdit('new') }}>Add a gate</button> : undefined}>
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
                  {g.uptime && <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{g.uptime.up_pct != null ? `Up ${g.uptime.up_pct}%` : 'Up —'} · 30 days · {g.uptime.down_count ? `${g.uptime.down_count} time${g.uptime.down_count === 1 ? '' : 's'} down${g.uptime.avg_down_ms != null ? ` · average ${fmtDur(g.uptime.avg_down_ms)} down` : ''}` : 'never down'}{g.uptime.blind_ms > 60e3 ? ` · couldn’t see it ${fmtDur(g.uptime.blind_ms)}` : ''}</div>}
                  {(g.feedback?.right ?? 0) + (g.feedback?.wrong ?? 0) > 0 && <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>Right {g.feedback.right} of {g.feedback.right + g.feedback.wrong} times you checked (30 days)</div>}
                  {!taughtOk && <div style={{ fontSize: 12, color: BLUE, marginTop: 4 }}>{canSetup ? 'Teach it one picture open and one closed to make it accurate.' : 'Not taught yet — ask your admin to finish setup.'}</div>}
                </div>
                <div className="sy-acts" style={{ justifyContent: 'flex-end' }}>
                  <button type="button" className="sy-b line sm" disabled={busy === g.id} onClick={() => act(g, { action: 'check_now' }, d => `${g.label}: ${String(d.verdict ?? '').toUpperCase() || 'checked'}${d.confidence != null ? ` (${d.confidence}% sure)` : ''}${d.alerted ? ' — alert sent' : d.why ? ` — ${d.why}` : ''}.`)}>{busy === g.id ? 'Checking…' : 'Check now'}</button>
                  {g.last_frame && (isOpen || g.state === 'closed') && (g.feedback?.rated
                    ? <span className="gw-pill gray" title="Someone already marked this reading">Marked</span>
                    : <span className="gw-ask" role="group" aria-label={`Is ${g.label} really ${isOpen ? 'open' : 'closed'}?`}>
                      <span className="q">Right?</span>
                      <button type="button" className="sy-b go sm" disabled={busy === g.id} onClick={() => act(g, { action: 'confirm' }, 'Thanks — saved as a correct answer.')} aria-label={`Right — ${g.label} is ${isOpen ? 'open' : 'closed'}`}>Yes</button>
                      <button type="button" className="sy-b warn sm" disabled={busy === g.id} onClick={() => act(g, { action: 'feedback', correct: isOpen ? 'closed' : 'open' }, 'Thanks — it learned from that.')} aria-label={`Wrong — ${g.label} is actually ${isOpen ? 'closed' : 'open'}`}>No, it’s {isOpen ? 'closed' : 'open'}</button>
                    </span>)}
                  {g.last_frame && !isOpen && g.state !== 'closed' && <>
                    <button type="button" className="sy-b line sm" disabled={busy === g.id} onClick={() => act(g, { action: 'feedback', correct: 'open', teach_only: true }, 'Thanks — it learned from that.')} aria-label={`${g.label} is open in the last picture`}>It’s open</button>
                    <button type="button" className="sy-b line sm" disabled={busy === g.id} onClick={() => act(g, { action: 'feedback', correct: 'closed', teach_only: true }, 'Thanks — it learned from that.')} aria-label={`${g.label} is closed in the last picture`}>It’s closed</button>
                  </>}
                  {canSetup && <button type="button" className="sy-b line sm" onClick={() => setEdit(g)} aria-label={`Set up ${g.label}`}>Set up</button>}
                </div>
              </div>
            )
          })}
      </Card>
      {edit && <GateSetup key={edit === 'new' ? `new-${presetCam ?? ''}` : edit.id} ctx={ctx} gate={edit === 'new' ? null : edit} presetCamera={edit === 'new' ? presetCam : null} others={gates ?? []} doors={doors ?? []}
        onClose={() => { setEdit(null); setPresetCam(null); void load() }}
        onAddAnother={cam => { setPresetCam(cam); setEdit('new'); void load() }} />}
    </>
  )
}

function GateSetup({ ctx, gate, presetCamera, others, doors, onClose, onAddAnother }: { ctx: SiteCtx; gate: Any | null; presetCamera?: string | null; others: Any[]; doors: Any[]; onClose: () => void; onAddAnother: (cameraKey: string) => void }) {
  const { siteId, notify } = ctx
  const [cams, setCams] = useState<Any[]>([])
  const [g, setG] = useState<Any | null>(gate)
  const hold0 = Array.isArray(gate?.hold_open_hours) && gate.hold_open_hours[0] ? gate.hold_open_hours[0] : null
  const [f, setF] = useState({
    camera_key: gate?.camera_key ?? presetCamera ?? '', label: gate?.label ?? '', gate_type: gate?.gate_type ?? 'swing', threshold_min: gate ? Math.round(gate.threshold_sec / 60) : 5,
    brivo_door_id: gate?.brivo_door_id ?? '', phones: (gate?.notify_phones ?? []).join(', '), emails: (gate?.notify_emails ?? []).join(', '), notes: gate?.notes ?? '', enabled: gate?.enabled ?? true,
    hold: !!hold0, holdDays: (hold0?.days ?? [1, 2, 3, 4, 5]) as number[], holdStart: hold0?.start ?? '09:00', holdEnd: hold0?.end ?? '18:00',
  })
  const [region, setRegion] = useState<{ x: number; y: number }[]>(Array.isArray(gate?.region) ? gate.region : [])
  const [snap, setSnap] = useState<string | null>(null)
  const [snapBusy, setSnapBusy] = useState(false)
  const [snapNote, setSnapNote] = useState<string | null>(null)
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
    if (r.ok) { setSnap(r.data.image); setSnapNote(r.data.stale ? 'This is Eagle Eye’s last stored picture — it may be old. If it doesn’t look like right now, upload a picture instead.' : null) }
    else { notify(r.data.error || 'No picture from that camera.', false); setSnapNote('Couldn’t get the camera’s picture. Upload one instead (a full screenshot or export from this camera).') }
  }
  // A picture from the person's computer: used for the outline and for teaching.
  async function useFileForOutline(file: File | undefined) {
    if (!file) return
    const img = await shrinkPicture(file).catch(() => null)
    if (!img) { notify('That file isn’t a picture we can read (use JPG or PNG).', false); return }
    setSnap(img); setSnapNote('Using your picture. It must be the whole view from this camera, so the outline lines up with the live picture.')
  }
  async function teachFiles(state: 'open' | 'closed', files: FileList | null) {
    if (!g?.id || !files?.length) return
    setBusy(`teach-${state}`)
    let ok = 0; let lastErr = ''
    for (const file of Array.from(files).slice(0, 8)) {
      const image = await shrinkPicture(file).catch(() => null)
      if (!image) { lastErr = `${file.name} isn’t a picture we can read.`; continue }
      const r = await send(`/api/sites/${siteId}/gates`, 'POST', { action: 'teach', id: g.id, state, image })
      if (r.ok) { ok++; setRefs(x => [r.data.ref, ...x]) } else lastErr = r.data.error || 'Couldn’t save a picture.'
    }
    setBusy(null)
    if (ok) notify(`Saved ${ok} ${state.toUpperCase()} picture${ok === 1 ? '' : 's'}.${lastErr ? ` ${lastErr}` : ''}`, !lastErr)
    else notify(lastErr || 'Nothing was saved.', false)
  }
  useEffect(() => { const k = gate?.camera_key ?? presetCamera; if (k) void getSnap(k) }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
      threshold_min: f.threshold_min, brivo_door_id: f.brivo_door_id || null, notify_phones: f.phones, notify_emails: f.emails, notes: f.notes, enabled: f.enabled,
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
  // Other gates watched on this same camera — drawn dashed so you outline only this one.
  const sameCam = others.filter(o => o.id !== g?.id && o.camera_key === f.camera_key && Array.isArray(o.region) && o.region.length >= 3)
  const mid = (r: { x: number; y: number }[]) => ({ x: r.reduce((a, p) => a + p.x, 0) / r.length * W, y: r.reduce((a, p) => a + p.y, 0) / r.length * H })
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
        <label><span className="sy-lbl">Also email (info@gateguard.co always gets these)</span><input className="sy-in" type="text" inputMode="email" value={f.emails} onChange={e => setF({ ...f, emails: e.target.value })} placeholder="manager@property.com, owner@company.com" />
          {g?.id && <button type="button" className="sy-b line sm" style={{ marginTop: 6 }} disabled={!!busy} onClick={async e => { e.preventDefault(); setBusy('test-alert'); const r = await send(`/api/sites/${siteId}/gates`, 'POST', { action: 'test_alert', id: g.id }); setBusy(null); notify(r.ok ? `Test email sent to ${(r.data.sent_to ?? []).join(', ')}. (Save first if you just changed the emails.)` : (r.data.error || 'The test email didn’t send.'), r.ok) }}>{busy === 'test-alert' ? 'Sending…' : 'Send test email'}</button>}
        </label>
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
        {sameCam.length > 0 && <div style={{ marginBottom: 6 }}><Note tone="blue">This camera also watches {sameCam.map(o => o.label).join(', ')} (white dashed). Outline only this gate and keep the outlines apart — each gate is judged only inside its own outline.</Note></div>}
        {!snap ? <div className="sy-empty">{snapBusy ? 'Getting a picture…' : f.camera_key ? 'No picture yet.' : 'Pick the camera above.'}</div> : (
          <div ref={drawRef} className="gw-draw" onClick={addPoint} role="img" aria-label="Camera picture — click to outline the gate">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="" src={`data:image/jpeg;base64,${snap}`} draggable={false} onLoad={e => { const im = e.currentTarget; if (im.naturalWidth) setDim({ w: im.naturalWidth, h: im.naturalHeight }) }} />
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
              {sameCam.map(o => <g key={o.id}><polygon points={o.region.map((p: Any) => `${p.x * W},${p.y * H}`).join(' ')} fill="rgba(255,255,255,.10)" stroke="#fff" strokeOpacity={0.85} strokeDasharray={`${W / 90} ${W / 120}`} strokeWidth={Math.max(2, W / 400)} /><text x={mid(o.region).x} y={mid(o.region).y} textAnchor="middle" fontSize={Math.max(14, W / 45)} fontWeight={600} fill="#fff" stroke="#000" strokeWidth={Math.max(2, W / 400)} paintOrder="stroke">{o.label}</text></g>)}
              {region.length >= 3 && <polygon points={pts} fill="rgba(255,214,10,.18)" stroke="#FFD60A" strokeWidth={Math.max(2, W / 330)} />}
              {region.length > 0 && region.length < 3 && <polyline points={pts} fill="none" stroke="#FFD60A" strokeWidth={3} />}
              {region.map((p, i) => <circle key={i} cx={p.x * W} cy={p.y * H} r={Math.max(6, W / 120)} fill="#FFD60A" stroke="#000" strokeWidth={2} />)}
            </svg>
          </div>
        )}
        {snapNote && <div style={{ marginTop: 6 }}><Note tone="orange">{snapNote}</Note></div>}
        <div className="sy-acts" style={{ marginTop: 6 }}>
          <button type="button" className="sy-b line sm" onClick={() => getSnap()} disabled={!f.camera_key || snapBusy}>{snapBusy ? 'Loading…' : 'New picture'}</button>
          <label className="sy-b line sm" style={{ cursor: 'pointer' }}>Upload a picture<input type="file" accept="image/*" hidden aria-label="Upload a picture to outline the gate on" onChange={e => { void useFileForOutline(e.target.files?.[0]); e.target.value = '' }} /></label>
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
          <div className="gw-sec">Teach it this gate <span style={{ fontWeight: 400, color: MUTED }}>· save the live picture when the gate is closed, and again when it’s open. 2–3 of each (day and night) makes it very accurate. You can also upload pictures — use the whole view from this camera (e.g. saved from Eagle Eye), not a close-up.</span></div>
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
                <div className="sy-acts">
                  <button type="button" className="sy-b line sm" onClick={() => teach(s)} disabled={!!busy}>{busy === `teach-${s}` ? 'Saving…' : `Gate is ${s} now — save picture`}</button>
                  <label className="sy-b line sm" style={{ cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1 }}>Upload {s} pictures<input type="file" accept="image/*" multiple hidden disabled={!!busy} aria-label={`Upload pictures of the gate ${s}`} onChange={e => { void teachFiles(s, e.target.files); e.target.value = '' }} /></label>
                </div>
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
          {!confirmDel && <button type="button" className="sy-b line sm" style={{ marginRight: 'auto' }} onClick={() => onAddAnother(f.camera_key)} disabled={!f.camera_key}>Add another gate on this camera</button>}
          {confirmDel ? <><span style={{ fontSize: 13, color: RED, alignSelf: 'center' }}>Stop watching this gate and delete its pictures?</span><button type="button" className="sy-b line sm" onClick={() => setConfirmDel(false)}>Keep</button><button type="button" className="sy-b warn sm" onClick={remove} disabled={busy === 'del'}>Remove gate</button></>
            : <button type="button" className="sy-b warn sm" onClick={() => setConfirmDel(true)}>Remove gate</button>}
        </div>
      </>}
    </Sheet>
  )
}
