'use client'

/**
 * GatesClient — gates & access management: category filters, per-opening control
 * cards (Open 10s / Hold open 1hr / Force close), and a site lockdown control.
 * Control actions require a signed-in manager; destructive ones use press-and-hold.
 * Lockdown secures entry gates only — egress + pedestrian routes always stay open.
 * Live video: a gate/door with a camera (openings → Gate Watch → same name, via
 * /api/portal/[slug]/door-cameras) shows it right on the card; tap it to watch big
 * with the Open buttons, so the manager can see it's safe before opening.
 * Edge cameras = real live video; Eagle Eye = a picture every ~2 s, flagged if it
 * stops changing (Eagle Eye sometimes hands back an old still).
 * Arrange (signed-in manager): drag tiles (or ← →) to set their order and pick the
 * camera for each one — saved for the property (door-cameras POST).
 */
import { useEffect, useRef, useState } from 'react'
import { OpsShell, useOpsManager, C } from '@/components/portal/ops/OpsShell'
import { HoldButton } from '@/components/portal/ops/HoldButton'
import { EdgeLive, EdgeSnap, type EdgePass } from '@/components/nexus/systems/cameras/players'
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires
const { KeyRound, Lock, ShieldAlert } = require('lucide-react') as any

type Door = { id: string; name: string }
type LinkCam = { key: string; id: string; name: string; provider: 'een' | 'edge' }
type Link = { camera: LinkCam; how: string }

/** Eagle Eye picture every `everyMs`; says so when the picture stops changing. */
function EenLive({ slug, cam, everyMs }: { slug: string; cam: LinkCam; everyMs: number }) {
  const [url, setUrl] = useState<string | null>(null)
  const [stuck, setStuck] = useState(false)
  const [err, setErr] = useState(false)
  const cur = useRef<string | null>(null)
  const last = useRef<{ size: number; same: number }>({ size: -1, same: 0 })
  useEffect(() => {
    let dead = false
    const load = async () => {
      if (document.hidden) return
      try {
        const r = await fetch(`/api/portal/${slug}/camera-preview?camera_id=${encodeURIComponent(cam.id)}&t=${Date.now()}`, { cache: 'no-store' })
        if (!r.ok) throw new Error(String(r.status))
        const b = await r.blob()
        if (dead || !b.size) return
        const l = last.current
        l.same = b.size === l.size ? l.same + 1 : 0; l.size = b.size
        setStuck(l.same >= (everyMs >= 10_000 ? 3 : 5)); setErr(false)
        const next = URL.createObjectURL(b), prev = cur.current
        cur.current = next; setUrl(next)
        if (prev) setTimeout(() => URL.revokeObjectURL(prev), 1000)
      } catch { if (!dead) setErr(true) }
    }
    void load()
    const t = setInterval(load, everyMs)
    return () => { dead = true; clearInterval(t) }
  }, [slug, cam.id, everyMs])
  useEffect(() => () => { if (cur.current) URL.revokeObjectURL(cur.current) }, [])
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url ? <img alt={`${cam.name} camera`} src={url} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.7)', fontSize: 12.5 }}>{err ? 'Camera not answering' : 'Connecting…'}</div>}
      {(stuck || (err && url)) && <div style={{ position: 'absolute', left: 8, right: 8, bottom: 8, background: 'rgba(178,80,0,.92)', color: '#fff', fontSize: 12, fontWeight: 600, borderRadius: 8, padding: '6px 9px' }}>Picture isn’t updating — look before you open</div>}
    </>
  )
}

type Reset = { id: string; name: string; door_id: string | null; camera_id: string | null; camera_name: string | null; wait_seconds: number }
const gnorm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const sameGate = (a: string, b: string) => { const x = gnorm(a), y = gnorm(b); return !!x && !!y && (x === y || x.includes(y) || y.includes(x)) }

/** Reset sheet: camera on screen, Start (hold to confirm), then live progress from the server run. */
function ResetSheet({ slug, reset, onClose }: { slug: string; reset: Reset; onClose: () => void }) {
  const [runId, setRunId] = useState<string | null>(null)
  const [run, setRun] = useState<{ phase: string; log: { at: string; text: string }[]; watts?: number | null; finished?: boolean } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const start = async () => {
    setErr(null)
    const r = await fetch(`/api/portal/${slug}/gate-reset`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reset_id: reset.id }) })
    const j = await r.json().catch(() => ({}))
    if (r.ok || (r.status === 409 && j.run_id)) setRunId(j.run_id); else setErr(j.error || 'Could not start the reset')
  }
  useEffect(() => {
    if (!runId) return
    let live = true
    const poll = async () => {
      const r = await fetch(`/api/portal/${slug}/gate-reset?run=${runId}`).then(x => x.json()).catch(() => null)
      if (!live || !r?.run) return
      setRun(r.run)
      if (!r.run.finished) setTimeout(poll, 2000)
    }
    void poll()
    return () => { live = false }
  }, [slug, runId])
  const cam: LinkCam | null = reset.camera_id ? { key: `een:${reset.camera_id}`, id: reset.camera_id, name: reset.camera_name || 'Camera', provider: 'een' } : null
  const STEP: Record<string, string> = { starting: 'Starting…', power_off: `Power off — back on by itself after ${reset.wait_seconds} s`, power_on: 'Power back on', sensing: 'Waiting for the operator to come back…', opening: 'Opening the gate…', done: 'Done', open_by_hand: 'Open the gate by hand when it’s up on camera', failed: 'Stopped' }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 140, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-label={`Reset ${reset.name}`} onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: 'min(860px, 100%)', maxHeight: '92dvh', overflowY: 'auto', boxShadow: '0 24px 70px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: `1px solid ${C.border}` }}>
          <div><div style={{ fontSize: 17, fontWeight: 600, color: C.ink }}>Reset {reset.name}</div><div style={{ fontSize: 12.5, color: C.ink3 }}>Turns the gate’s power off for {reset.wait_seconds} s, back on, then opens it once it’s running. Keeps going if you close this.</div></div>
          <button type="button" onClick={onClose} style={{ minHeight: 34, padding: '0 12px', borderRadius: 8, border: `1px solid ${C.border2}`, background: '#fff', font: 'inherit', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>{run?.finished || !runId ? 'Done' : 'Close'}</button>
        </div>
        <div style={{ padding: 16, display: 'grid', gap: 12 }}>
          {cam && <div style={{ position: 'relative', aspectRatio: '16 / 9', background: '#0b0b0d', borderRadius: 12, overflow: 'hidden' }}><EenLive slug={slug} cam={cam} everyMs={2000} /></div>}
          {!runId ? (
            <>
              <HoldButton tone="amber" label="Hold to reset the gate" holdingLabel="Starting…" onConfirm={start} />
              <div style={{ fontSize: 12, color: C.ink3 }}>Only reset when the gate is stuck. Make sure no car or person is in the gate.</div>
            </>
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: run?.phase === 'failed' ? C.alert : run?.phase === 'done' ? C.safe : C.ink }}>{STEP[run?.phase ?? 'starting'] ?? run?.phase}{run?.phase === 'sensing' && run.watts != null ? ` (now ${Math.round(run.watts)} W)` : ''}</div>
              {(run?.log ?? []).map((l, i) => <div key={i} style={{ fontSize: 12.5, color: C.ink2 }}>{new Date(l.at).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', second: '2-digit' })} · {l.text}</div>)}
            </div>
          )}
          {err && <div style={{ fontSize: 13, color: C.alert }}>{err}</div>}
        </div>
      </div>
    </div>
  )
}

/** The camera for a door: Edge = live video, Eagle Eye = refreshing picture. */
function DoorCam({ slug, link, edge, big }: { slug: string; link: Link; edge: EdgePass | null; big?: boolean }) {
  const [liveFail, setLiveFail] = useState(false)
  const c = link.camera
  return (
    <div style={{ position: 'relative', aspectRatio: '16 / 9', background: '#0b0b0d', borderRadius: big ? 12 : 10, overflow: 'hidden' }}>
      {c.provider === 'edge' && edge
        ? (!liveFail ? <EdgeLive key={c.key} edge={edge} cam={c.id} onFail={() => setLiveFail(true)} /> : <EdgeSnap edge={edge} cam={c.id} everyMs={1500} alt={`${c.name} camera`} />)
        : <EenLive slug={slug} cam={c} everyMs={big ? 1500 : 30_000} />}
      <div style={{ position: 'absolute', left: 8, top: 7, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600, color: '#fff', background: 'rgba(0,0,0,.5)', borderRadius: 6, padding: '2px 7px', pointerEvents: 'none' }}>
        <span style={{ width: 7, height: 7, borderRadius: 99, background: '#FF3B30' }} />{c.provider === 'edge' && !liveFail ? 'Live' : 'Camera'} · {c.name}
      </div>
    </div>
  )
}
const EGRESS = /(exit|egress|ped|pedestrian|walk|man\s?gate|ada|emergenc)/i
const arrowBtn: React.CSSProperties = { width: 30, height: 28, borderRadius: 7, border: `1px solid ${C.border2}`, background: '#fff', cursor: 'pointer', fontSize: 13, color: C.ink }
function card(): React.CSSProperties { return { background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 } }

function Inner({ slug }: { slug: string }) {
  const { manager, requireSignIn } = useOpsManager()
  const [doors, setDoors] = useState<Door[]>([])
  const [filter, setFilter] = useState<'all' | 'gates' | 'doors'>('all')
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [lockActive, setLockActive] = useState(false)
  const [links, setLinks] = useState<Record<string, Link>>({})
  const [edge, setEdge] = useState<EdgePass | null>(null)
  const [watch, setWatch] = useState<Door | null>(null)
  const [cams, setCams] = useState<LinkCam[]>([])
  const [choices, setChoices] = useState<Record<string, string>>({})
  const [order, setOrder] = useState<string[]>([])
  const [arrange, setArrange] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [leftOpen, setLeftOpen] = useState<string[]>([])
  useEffect(() => { fetch(`/api/portal/${slug}/summary`).then(r => r.json()).then(j => { setDoors(j.doors ?? []); setLeftOpen((j.gates?.open ?? []).map((g: { label: string }) => g.label)) }).catch(() => {}) }, [slug])
  const isLeftOpen = (name: string) => leftOpen.some(l => sameGate(l, name))

  // Gate reset (recipe set by Gate Guard in Nexus; runs on the server — lib/gate-reset.ts)
  const [resets, setResets] = useState<Reset[]>([])
  const [resetFor, setResetFor] = useState<Reset | null>(null)
  useEffect(() => { fetch(`/api/portal/${slug}/gate-reset`).then(r => r.json()).then(j => setResets(j.resets ?? [])).catch(() => {}) }, [slug])
  // Which camera watches each door (refresh every 10 min — the Edge pass lasts 15).
  useEffect(() => {
    const load = () => fetch(`/api/portal/${slug}/door-cameras`).then(r => r.json()).then(j => { setLinks(j.links ?? {}); setEdge(j.edge ?? null); setCams(j.cameras ?? []); setChoices(j.choices ?? {}); setOrder(o => (arrangeRef.current ? o : (j.order ?? []))) }).catch(() => {})
    loadRef.current = load
    load(); const t = setInterval(load, 10 * 60_000); return () => clearInterval(t)
  }, [slug])
  const arrangeRef = useRef(false); arrangeRef.current = arrange
  const loadRef = useRef<() => void>(() => {})

  const saveLayout = async (body: Record<string, unknown>) => {
    const r = await fetch(`/api/portal/${slug}/door-cameras`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(j.error || 'Could not save')
  }
  const startArrange = () => { if (!manager) { requireSignIn(); return } setOrder(sorted.map(d => d.id)); setArrange(true) }
  const finishArrange = async () => {
    setSaving(true)
    try { await saveLayout({ action: 'set_order', order }); setToast('Tile order saved') }
    catch (e) { setToast(e instanceof Error ? e.message : 'Could not save') }
    setSaving(false); setArrange(false); setTimeout(() => setToast(null), 3000)
  }
  const move = (id: string, to: number) => setOrder(o => { const cur = o.includes(id) ? o : sorted.map(d => d.id); const from = cur.indexOf(id); if (from < 0 || to < 0 || to >= cur.length) return cur; const n = cur.slice(); n.splice(from, 1); n.splice(to, 0, id); return n })
  const pickCamera = async (d: Door, value: string) => {
    const key = value === 'auto' ? null : value
    try { await saveLayout({ action: 'set_camera', door_id: d.id, camera_key: key }); loadRef.current(); setToast(`Camera for ${d.name} saved`) }
    catch (e) { setToast(e instanceof Error ? e.message : 'Could not save') }
    setTimeout(() => setToast(null), 3000)
  }
  useEffect(() => { if (!watch) return; const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setWatch(null) }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [watch])

  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(null), Math.max(3200, t.length * 70)) }
  async function cmd(d: Door, action: 'open' | 'hold_open' | 'force_close') {
    if (!manager) { requireSignIn(); return }
    setBusy(`${d.id}:${action}`)
    try {
      const r = await fetch(`/api/portal/${slug}/gate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ door_id: d.id, door_name: d.name, action, minutes: action === 'hold_open' ? 60 : undefined }) })
      const j = await r.json().catch(() => ({}))
      // Only 'open' moves the gate. Hold / force close are logged for now — say so plainly.
      flash(r.ok ? (j.physical ? `${d.name} opened ✓` : `${d.name}: ${action === 'hold_open' ? 'hold open' : 'force close'} logged — the gate does not do this automatically yet`) : (j?.error || 'Command failed'))
    } catch { flash('Command failed') } finally { setBusy(null) }
  }
  async function lockdown(active: boolean) {
    if (!manager) { requireSignIn(); return }
    try {
      const r = await fetch(`/api/portal/${slug}/lockdown`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active }) })
      const j = await r.json().catch(() => ({}))
      if (r.ok) { setLockActive(active); flash(active ? `Lockdown logged${j.alerted ? ' and Gate Guard alerted' : ''} — gates are NOT locked automatically yet. Call 911 in an emergency.` : 'Lockdown lifted') }
      else flash(j?.error || 'Lockdown failed')
    } catch { flash('Lockdown failed') }
  }

  const rank = (id: string) => { const i = order.indexOf(id); return i < 0 ? 1e6 : i }
  const sorted = doors.map((d, i) => ({ d, i })).sort((a, b) => rank(a.d.id) - rank(b.d.id) || a.i - b.i).map(x => x.d)
  const shown = sorted.filter(d => filter === 'all' ? true : filter === 'gates' ? /gate/i.test(d.name) : !/gate/i.test(d.name))
  const counts = { all: doors.length, gates: doors.filter(d => /gate/i.test(d.name)).length, doors: doors.filter(d => !/gate/i.test(d.name)).length }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Lockdown */}
      <div style={{ ...card(), borderColor: lockActive ? 'rgba(215,0,21,0.5)' : C.border, boxShadow: lockActive ? '0 0 0 3px rgba(215,0,21,0.1)' : undefined }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShieldAlert size={18} color={lockActive ? C.alert : C.ink2} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.ink }}>{lockActive ? 'Lockdown ACTIVE' : 'Site lockdown'}</div>
              <div style={{ fontSize: 11.5, color: C.ink2 }}>Secures entry gates only — people can always leave (egress + pedestrian stay open).</div>
            </div>
          </div>
          <div style={{ width: 220 }}>
            {lockActive
              ? <HoldButton tone="cyan" label="Hold to lift lockdown" holdingLabel="Lifting…" onConfirm={() => lockdown(false)} />
              : <HoldButton tone="alert" label="Hold to engage lockdown" holdingLabel="Engaging…" onConfirm={() => lockdown(true)} disabled={!manager} title={manager ? undefined : 'Sign in to control'} />}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {([['all', `All (${counts.all})`], ['gates', `Gates (${counts.gates})`], ['doors', `Doors (${counts.doors})`]] as const).map(([k, lbl]) => (
          <button key={k} onClick={() => setFilter(k)} style={{ fontSize: 12, fontWeight: 700, padding: '7px 14px', borderRadius: 999, cursor: 'pointer', border: `1px solid ${filter === k ? 'rgba(0,113,227,0.5)' : C.border2}`, background: filter === k ? 'rgba(0,113,227,0.08)' : 'transparent', color: filter === k ? C.cyan : C.ink2 }}>{lbl}</button>
        ))}
        <div style={{ flex: 1 }} />
        {arrange
          ? <button onClick={finishArrange} disabled={saving} style={{ fontSize: 12.5, fontWeight: 700, padding: '7px 16px', borderRadius: 999, cursor: 'pointer', border: 0, background: C.blue, color: '#fff' }}>{saving ? 'Saving…' : 'Done'}</button>
          : doors.length > 0 && <button onClick={startArrange} style={{ fontSize: 12, fontWeight: 700, padding: '7px 14px', borderRadius: 999, cursor: 'pointer', border: `1px solid ${C.border2}`, background: 'transparent', color: C.ink2 }}>Arrange tiles & cameras</button>}
      </div>

      {arrange && <div style={{ fontSize: 12.5, color: C.ink2, marginTop: -6 }}>Drag a tile (or use ← →) to move it, and pick each one’s camera. Press <b>Done</b> to save the order.</div>}

      {/* Control cards */}
      {shown.length === 0 ? (
        <div style={{ ...card(), textAlign: 'center', color: C.ink2, fontSize: 13 }}>No access points connected for this site yet.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {shown.map(d => {
            const egress = EGRESS.test(d.name)
            const link = links[d.id]
            const pos = sorted.findIndex(x => x.id === d.id)
            if (arrange) return (
              <div key={d.id} draggable
                onDragStart={e => { setDragId(d.id); e.dataTransfer.effectAllowed = 'move' }}
                onDragOver={e => { e.preventDefault(); if (dragId && dragId !== d.id) move(dragId, pos) }}
                onDragEnd={() => setDragId(null)}
                style={{ ...card(), cursor: 'grab', opacity: dragId === d.id ? 0.45 : 1, borderStyle: 'dashed', borderColor: C.blue }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span aria-hidden style={{ color: C.ink3, fontSize: 16, lineHeight: 1 }}>⠿</span>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: C.ink, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                  <button type="button" aria-label={`Move ${d.name} earlier`} onClick={() => move(d.id, pos - 1)} disabled={pos <= 0} style={arrowBtn}>←</button>
                  <button type="button" aria-label={`Move ${d.name} later`} onClick={() => move(d.id, pos + 1)} disabled={pos >= sorted.length - 1} style={arrowBtn}>→</button>
                </div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: C.ink2, marginBottom: 4 }}>Camera</label>
                <select value={choices[d.id] && (choices[d.id] === 'none' || cams.some(c => c.key === choices[d.id])) ? choices[d.id] : 'auto'} onChange={e => pickCamera(d, e.target.value)}
                  style={{ width: '100%', height: 36, borderRadius: 8, border: `1px solid ${C.border2}`, padding: '0 8px', font: 'inherit', fontSize: 13, background: '#fff', color: C.ink }}>
                  <option value="auto">Automatic{link && link.how !== 'chosen' ? ` (${link.camera.name})` : ' (none found)'}</option>
                  {cams.map(c => <option key={c.key} value={c.key}>{c.name}</option>)}
                  <option value="none">No camera</option>
                </select>
              </div>
            )
            return (
              <div key={d.id} style={card()}>
                {link && (
                  <button type="button" onClick={() => setWatch(d)} aria-label={`Watch ${d.name} big`} style={{ display: 'block', width: '100%', padding: 0, border: 0, background: 'none', cursor: 'pointer', marginBottom: 12 }}>
                    <DoorCam slug={slug} link={link} edge={edge} />
                  </button>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{d.name}</span>
                  {isLeftOpen(d.name) && <span title="Gate Watch sees this gate standing open" style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 999, background: 'rgba(215,0,21,0.08)', color: C.alert, border: '1px solid rgba(215,0,21,0.3)' }}>LEFT OPEN</span>}
                </div>
                <button onClick={() => cmd(d, 'open')} disabled={busy === `${d.id}:open`} style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1px solid rgba(0,113,227,0.4)', background: 'rgba(0,113,227,0.08)', color: C.cyan, fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8 }}><KeyRound size={14} /> Open (10s)</button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1 }}><HoldButton tone="amber" label="Hold 1 hr" holdingLabel="Holding…" onConfirm={() => cmd(d, 'hold_open')} disabled={!manager} /></div>
                  <div style={{ flex: 1 }}><HoldButton tone="alert" label="Force close" holdingLabel="Closing…" onConfirm={() => cmd(d, 'force_close')} disabled={!manager || egress} title={egress ? 'Egress/pedestrian routes cannot be force-closed' : undefined} /></div>
                </div>
                {resets.filter(x => x.door_id === d.id).map(x => (
                  <button key={x.id} type="button" onClick={() => manager ? setResetFor(x) : requireSignIn()} style={{ width: '100%', marginTop: 8, padding: '9px', borderRadius: 10, border: `1px solid ${C.border2}`, background: '#fff', color: C.ink, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>↻ Reset this gate</button>
                ))}
                {egress && <div style={{ fontSize: 10.5, color: C.ink2, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}><Lock size={11} /> Egress route — never force-closed</div>}
                {!link && <div style={{ fontSize: 11, color: C.ink3, marginTop: 8 }}>No camera on this {/gate/i.test(d.name) ? 'gate' : 'door'} — <button type="button" onClick={startArrange} style={{ border: 0, background: 'none', padding: 0, color: C.blue, font: 'inherit', fontSize: 11, cursor: 'pointer' }}>pick one</button></div>}
              </div>
            )
          })}
        </div>
      )}
      {!manager && <div style={{ fontSize: 11.5, color: C.ink2 }}>Sign in with your personal PIN to control gates.</div>}

      {/* Resets not tied to one gate card */}
      {resets.some(x => !x.door_id || !doors.some(d => d.id === x.door_id)) && (
        <div style={card()}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Gate resets</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {resets.filter(x => !x.door_id || !doors.some(d => d.id === x.door_id)).map(x => <button key={x.id} type="button" onClick={() => manager ? setResetFor(x) : requireSignIn()} style={{ padding: '9px 14px', borderRadius: 10, border: `1px solid ${C.border2}`, background: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>↻ {x.name}</button>)}
          </div>
        </div>
      )}
      {resetFor && <ResetSheet slug={slug} reset={resetFor} onClose={() => setResetFor(null)} />}

      {/* Watch big + open */}
      {watch && links[watch.id] && (
        <div onClick={() => setWatch(null)} style={{ position: 'fixed', inset: 0, zIndex: 140, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div role="dialog" aria-modal="true" aria-label={`${watch.name} — watch and open`} onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: 'min(980px, 100%)', maxHeight: '92dvh', overflowY: 'auto', boxShadow: '0 24px 70px rgba(0,0,0,.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: `1px solid ${C.border}` }}>
              <div><div style={{ fontSize: 17, fontWeight: 600, color: C.ink }}>{watch.name}</div><div style={{ fontSize: 12.5, color: C.ink3 }}>Look first — make sure it’s safe, then open.</div></div>
              <button type="button" onClick={() => setWatch(null)} style={{ minHeight: 34, padding: '0 12px', borderRadius: 8, border: `1px solid ${C.border2}`, background: '#fff', font: 'inherit', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Done</button>
            </div>
            <div style={{ padding: 16, display: 'grid', gap: 12 }}>
              <DoorCam slug={slug} link={links[watch.id]} edge={edge} big />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
                <button onClick={() => cmd(watch, 'open')} disabled={busy === `${watch.id}:open`} style={{ padding: '12px', borderRadius: 10, border: 0, background: C.blue, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><KeyRound size={15} /> Open (10s)</button>
                <HoldButton tone="amber" label="Hold open 1 hr" holdingLabel="Holding…" onConfirm={() => cmd(watch, 'hold_open')} disabled={!manager} />
                <HoldButton tone="alert" label="Force close" holdingLabel="Closing…" onConfirm={() => cmd(watch, 'force_close')} disabled={!manager || EGRESS.test(watch.name)} />
              </div>
              {!manager && <div style={{ fontSize: 12, color: C.ink3 }}>Sign in with your personal PIN to open or close.</div>}
            </div>
          </div>
        </div>
      )}

      {toast && <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 130, background: C.surface, border: `1px solid ${C.border}`, color: C.ink, borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 600, boxShadow: '0 12px 40px rgba(0,0,0,.18)' }}>{toast}</div>}
    </div>
  )
}

export default function GatesClient({ slug, displayName }: { slug: string; displayName: string }) {
  return <OpsShell slug={slug} displayName={displayName} active="gates"><Inner slug={slug} /></OpsShell>
}
