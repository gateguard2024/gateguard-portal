'use client'

// Gate re-boot — a camera-monitored power-cycle macro for a gate operator.
// Runs entirely through the existing secured endpoints (/api/shelly/relays,
// /api/brivo/doors), so every step is permission-checked and logged. The
// operator watches the mapped camera live the whole time.
// Corporate sets them up; anyone with relay access can run one.
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { type Any, Card, Dot, DOT, Field, MUTED, Note, ORANGE, RED, Sheet, getJson, send, previewUrl, LiveCam } from '@/components/nexus/systems/shared'

type Reboot = {
  id: string; name: string
  camera_id: string | null; camera_name: string | null
  power_device_id: string; power_channel: number; power_relay_name: string | null
  wait_seconds: number
  actuation_type: 'brivo' | 'shelly' | 'none'
  actuation_door_id: string | null; actuation_door_name: string | null
  actuation_device_id: string | null; actuation_channel: number | null
  actuation_pulse_seconds: number | null; actuation_relay_name: string | null
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

export function GateReboots({ siteId, isCorporate }: { siteId: string; isCorporate?: boolean }) {
  const [reboots, setReboots] = useState<Reboot[] | null>(null)
  const [run, setRun] = useState<Reboot | null>(null)
  const [editing, setEditing] = useState<Reboot | 'new' | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    const r = await getJson(`/api/sites/${siteId}/gate-reboots`)
    setReboots(Array.isArray(r.data.reboots) ? r.data.reboots : [])
    setErr(r.ok ? null : (r.data.error || 'Couldn’t load gate re-boots.'))
  }, [siteId])
  useEffect(() => { void load() }, [load])

  async function remove(rb: Reboot) {
    if (!window.confirm(`Delete “${rb.name}”?`)) return
    const r = await send(`/api/sites/${siteId}/gate-reboots/${rb.id}`, 'DELETE')
    if (!r.ok) setErr(r.data.error || 'Couldn’t delete.')
    void load()
  }

  return (
    <Card title="Gate re-boot" sub="Watch the gate camera while it cuts power, waits, restores it, then opens the gate."
      right={isCorporate ? <button type="button" className="sy-b blue sm" onClick={() => setEditing('new')}>New re-boot</button> : undefined}>
      {err && <div style={{ marginBottom: 8 }}><Note tone="red">{err}</Note></div>}
      {reboots == null ? <div className="sy-empty">Loading…</div>
        : !reboots.length ? <div className="sy-empty">No gate re-boots set up yet.{isCorporate ? ' Tap “New re-boot” to make one for a gate.' : ' Ask Gate Guard to set one up.'}</div>
        : reboots.map(rb => (
          <div key={rb.id} className="sy-row">
            <div className="main">
              <div className="t">{rb.name}</div>
              <div className="m">
                {rb.power_relay_name || 'Power relay'} off {rb.wait_seconds}s, then {rb.actuation_type === 'brivo' ? `open ${rb.actuation_door_name || 'door'}` : rb.actuation_type === 'shelly' ? `pulse ${rb.actuation_relay_name || 'relay'}` : 'nothing'}
                {rb.camera_id ? ` · camera ${rb.camera_name || 'set'}` : <span style={{ color: ORANGE }}> · no camera</span>}
              </div>
            </div>
            {isCorporate && <button type="button" className="sy-b line sm" onClick={() => setEditing(rb)}>Edit</button>}
            {isCorporate && <button type="button" className="sy-b warn sm" onClick={() => remove(rb)} aria-label={`Delete ${rb.name}`}>Delete</button>}
            <button type="button" className="sy-b pri sm" onClick={() => setRun(rb)}>Run</button>
          </div>
        ))}
      {run && <RunSheet reboot={run} siteId={siteId} onClose={() => setRun(null)} />}
      {editing && <BuilderSheet siteId={siteId} reboot={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void load() }} />}
    </Card>
  )
}

// ── Run ──────────────────────────────────────────────────────────────────────
type Phase = 'idle' | 'powering_off' | 'waiting' | 'powering_on' | 'ready' | 'actuating' | 'done' | 'error'

function RunSheet({ reboot, siteId, onClose }: { reboot: Reboot; siteId: string; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [countdown, setCountdown] = useState(reboot.wait_seconds)
  const [err, setErr] = useState<string | null>(null)
  const [log, setLog] = useState<string[]>([])
  const [tick, setTick] = useState(0)
  const [camBad, setCamBad] = useState(false)
  const cancelled = useRef(false)
  useEffect(() => () => { cancelled.current = true }, [])
  useEffect(() => { const t = setInterval(() => { setCamBad(false); setTick(x => x + 1) }, 1500); return () => clearInterval(t) }, [])
  const addLog = (s: string) => setLog(l => [...l, s])

  async function shelly(deviceId: string, channel: number, body: Any, name: string) {
    const r = await send(`/api/shelly/relays/${deviceId}`, 'POST', { site_id: siteId, channel, confirm: true, name, ...body })
    if (!r.ok) throw new Error(r.data.error || 'Relay command failed')
  }
  async function runReset() {
    setErr(null); setLog([])
    try {
      setPhase('powering_off'); addLog(`Power off — ${reboot.power_relay_name || 'relay'}`)
      await shelly(reboot.power_device_id, reboot.power_channel, { on: false }, reboot.power_relay_name || 'Power relay')
      setPhase('waiting')
      for (let s = reboot.wait_seconds; s > 0 && !cancelled.current; s--) { setCountdown(s); await sleep(1000) }
      setCountdown(0)
      if (cancelled.current) return
      setPhase('powering_on'); addLog('Power on')
      await shelly(reboot.power_device_id, reboot.power_channel, { on: true }, reboot.power_relay_name || 'Power relay')
      addLog('Power restored — watch the camera for the operator to come back')
      setPhase('ready')
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); setPhase('error') }
  }
  async function actuate() {
    setErr(null)
    try {
      setPhase('actuating')
      if (reboot.actuation_type === 'brivo' && reboot.actuation_door_id) {
        const r = await send(`/api/brivo/doors/${reboot.actuation_door_id}`, 'POST', { site_id: siteId, door_name: reboot.actuation_door_name || 'Gate', confirm: true })
        if (!r.ok) throw new Error(r.data.error || 'Brivo open failed')
        addLog(`Opened ${reboot.actuation_door_name || 'gate'} (Brivo)`)
      } else if (reboot.actuation_type === 'shelly' && reboot.actuation_device_id) {
        await shelly(reboot.actuation_device_id, reboot.actuation_channel ?? 0, { pulse: reboot.actuation_pulse_seconds || 1 }, reboot.actuation_relay_name || 'Gate relay')
        addLog(`Pulsed ${reboot.actuation_relay_name || 'gate relay'}`)
      }
      setPhase('done')
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); setPhase('error') }
  }

  const status: Record<Phase, string> = {
    idle: 'Ready. Check the camera, then start.',
    powering_off: 'Cutting power to the gate…',
    waiting: `Power is off — turning it back on in ${countdown}s…`,
    powering_on: 'Restoring power…',
    ready: 'Power is back. When the operator is up on camera, open the gate.',
    actuating: 'Opening the gate…',
    done: 'Done — gate re-boot complete.',
    error: 'Something went wrong.',
  }
  const running = phase === 'powering_off' || phase === 'waiting' || phase === 'powering_on' || phase === 'actuating'
  return (
    <Sheet title={reboot.name} sub="Gate re-boot" onClose={onClose} width={600} locked={running}>
      <div className="sy-cam" style={{ cursor: 'default' }}>
        {reboot.camera_id && !camBad ? <LiveCam src={previewUrl(siteId, reboot.camera_id, tick)} alt={reboot.camera_name || 'Gate camera'} onError={() => setCamBad(true)} />
          : <div className="off">{reboot.camera_id ? 'Waiting for the camera…' : 'No camera set for this re-boot'}</div>}
        <span className="lv"><Dot c={DOT.red} />Live</span>
        <span className="nm">{reboot.camera_name || 'Gate camera'}</span>
        {phase === 'waiting' && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.35)', color: '#fff', fontSize: 48, fontWeight: 600 }}>{countdown}s</div>}
      </div>
      <div role="status" style={{ fontSize: 14, color: phase === 'error' ? RED : undefined }}>{err || status[phase]}</div>
      {(phase === 'idle' || phase === 'error') && <button type="button" className="sy-b pri" onClick={runReset}>Start — power off {reboot.wait_seconds}s, then on</button>}
      {phase === 'ready' && reboot.actuation_type !== 'none' && <button type="button" className="sy-b pri" onClick={actuate}>{reboot.actuation_type === 'brivo' ? `Open ${reboot.actuation_door_name || 'gate'}` : `Pulse ${reboot.actuation_relay_name || 'gate relay'}`}</button>}
      {((phase === 'ready' && reboot.actuation_type === 'none') || phase === 'done') && <button type="button" className="sy-b line" onClick={onClose}>Close</button>}
      {log.length > 0 && <div style={{ background: '#F5F5F7', borderRadius: 10, padding: 10, fontSize: 12, color: MUTED, display: 'grid', gap: 3 }}>{log.map((l, i) => <div key={i}>{l}</div>)}</div>}
    </Sheet>
  )
}

// ── Builder (corporate) ──────────────────────────────────────────────────────
function BuilderSheet({ siteId, reboot, onClose, onSaved }: { siteId: string; reboot: Reboot | null; onClose: () => void; onSaved: () => void }) {
  const [relays, setRelays] = useState<Any[]>([])
  const [doors, setDoors] = useState<Any[]>([])
  const [cams, setCams] = useState<Any[]>([])
  const [name, setName] = useState(reboot?.name || '')
  const [cameraId, setCameraId] = useState(reboot?.camera_id || '')
  const [powerId, setPowerId] = useState(reboot?.power_device_id ? `${reboot.power_device_id}:${reboot.power_channel}` : '')
  const [wait, setWait] = useState(reboot?.wait_seconds ?? 30)
  const [actType, setActType] = useState<'brivo' | 'shelly' | 'none'>(reboot?.actuation_type || 'brivo')
  const [doorId, setDoorId] = useState(reboot?.actuation_door_id || '')
  const [actRelay, setActRelay] = useState(reboot?.actuation_device_id ? `${reboot.actuation_device_id}:${reboot.actuation_channel ?? 0}` : '')
  const [pulse, setPulse] = useState(reboot?.actuation_pulse_seconds ?? 1)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    void getJson(`/api/shelly/relays?site_id=${siteId}`).then(r => setRelays(Array.isArray(r.data.relays) ? r.data.relays : []))
    void getJson(`/api/brivo/doors?site_id=${siteId}`).then(r => setDoors(Array.isArray(r.data.doors) ? r.data.doors : []))
    void getJson(`/api/eagle-eye/cameras?site_id=${siteId}`).then(r => setCams((Array.isArray(r.data.cameras) ? r.data.cameras : []).map((c: Any) => ({ id: String(c.id ?? c.camera_id), name: c.name ?? c.camera_name ?? c.id }))))
  }, [siteId])

  async function save() {
    setErr(null)
    if (!name.trim() || !powerId) { setErr('Give it a name and pick the power relay.'); return }
    if (actType === 'brivo' && !doorId) { setErr('Pick the Brivo door to open.'); return }
    if (actType === 'shelly' && !actRelay) { setErr('Pick the relay to pulse.'); return }
    const [pDev, pCh] = powerId.split(':')
    const payload: Any = {
      name: name.trim(), camera_id: cameraId || null, camera_name: cams.find(c => c.id === cameraId)?.name || null,
      power_device_id: pDev, power_channel: Number(pCh) || 0, power_relay_name: relays.find(r => `${r.id}:${r.channel}` === powerId)?.name || null,
      wait_seconds: Math.max(1, Math.min(600, Number(wait) || 30)), actuation_type: actType,
      actuation_door_id: null, actuation_door_name: null, actuation_device_id: null, actuation_channel: null, actuation_relay_name: null,
      actuation_pulse_seconds: Math.max(1, Math.min(10, Number(pulse) || 1)),
    }
    if (actType === 'brivo') { payload.actuation_door_id = doorId; payload.actuation_door_name = doors.find(d => String(d.id) === doorId)?.name || null }
    if (actType === 'shelly') {
      const [aDev, aCh] = actRelay.split(':')
      payload.actuation_device_id = aDev; payload.actuation_channel = Number(aCh) || 0
      payload.actuation_relay_name = relays.find(r => `${r.id}:${r.channel}` === actRelay)?.name || null
    }
    setSaving(true)
    const r = await send(reboot ? `/api/sites/${siteId}/gate-reboots/${reboot.id}` : `/api/sites/${siteId}/gate-reboots`, reboot ? 'PATCH' : 'POST', payload)
    setSaving(false)
    if (!r.ok) { setErr(r.data.error || 'Save failed'); return }
    onSaved()
  }
  const relayOpts = relays.map(r => <option key={`${r.id}:${r.channel}`} value={`${r.id}:${r.channel}`}>{r.name}</option>)
  return (
    <Sheet title={reboot ? 'Edit gate re-boot' : 'New gate re-boot'} onClose={onClose} width={480}>
      <Field label="Name"><input className="sy-in" value={name} onChange={e => setName(e.target.value)} placeholder="Exit gate re-boot" /></Field>
      <Field label="Gate camera to watch"><select className="sy-in" value={cameraId} onChange={e => setCameraId(e.target.value)}><option value="">None</option>{cams.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      <Field label="Power relay (Shelly)"><select className="sy-in" value={powerId} onChange={e => setPowerId(e.target.value)}><option value="">Pick a relay…</option>{relayOpts}</select></Field>
      <Field label="Seconds to leave the power off"><input className="sy-in" type="number" min={1} max={600} value={wait} onChange={e => setWait(Number(e.target.value))} /></Field>
      <div>
        <span className="sy-lbl">Then open the gate with</span>
        <div className="sy-chips">
          {(['brivo', 'shelly', 'none'] as const).map(t => <button key={t} type="button" className="sy-chip" aria-pressed={actType === t} onClick={() => setActType(t)}>{t === 'brivo' ? 'Brivo door' : t === 'shelly' ? 'Second relay' : 'Nothing'}</button>)}
        </div>
      </div>
      {actType === 'brivo' && <Field label="Brivo door"><select className="sy-in" value={doorId} onChange={e => setDoorId(e.target.value)}><option value="">Pick a door…</option>{doors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>}
      {actType === 'shelly' && <>
        <Field label="Relay to pulse"><select className="sy-in" value={actRelay} onChange={e => setActRelay(e.target.value)}><option value="">Pick a relay…</option>{relayOpts}</select></Field>
        <Field label="Pulse seconds (1–10)"><input className="sy-in" type="number" min={1} max={10} value={pulse} onChange={e => setPulse(Number(e.target.value))} /></Field>
      </>}
      {err && <Note tone="red">{err}</Note>}
      <button type="button" className="sy-b pri" onClick={save} disabled={saving}>{saving ? 'Saving…' : reboot ? 'Save changes' : 'Create re-boot'}</button>
    </Sheet>
  )
}
