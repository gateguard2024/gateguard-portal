'use client'

// Gate re-boot — a camera-monitored power-cycle macro for a gate operator.
// Runs entirely through the existing secured endpoints (/api/shelly/relays,
// /api/brivo/doors), so every step is permission-checked and logged. The
// operator watches the mapped camera live the whole time.
import React, { useCallback, useEffect, useRef, useState } from 'react'

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
type Relay = { id: string; name: string; channel: number }
type Door = { id: string; name: string }
type Cam = { id: string; name: string }

const C = {
  accent: '#5FB8E0', ok: '#7ee0a8', warn: '#fbbf24', alarm: '#f87171',
  border: 'rgba(140,170,200,0.24)', panel: 'linear-gradient(180deg,#1d2a39,#141d28)',
  tile: '#16232f', well: '#0c1420', ink: '#eaf2fb', ink2: 'rgba(255,255,255,0.6)',
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

function LiveCam({ siteId, cameraId, alt }: { siteId: string; cameraId: string; alt: string }) {
  const [tick, setTick] = useState(0)
  const [failed, setFailed] = useState(false)
  useEffect(() => { const t = setInterval(() => setTick(x => x + 1), 1500); return () => clearInterval(t) }, [])
  if (!cameraId || failed) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: C.ink2, fontSize: 12 }}>📹 {alt}<br />live preview unavailable</div>
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} onError={() => setFailed(true)}
      src={`/api/eagle-eye/preview?site_id=${siteId}&camera_id=${encodeURIComponent(cameraId)}&t=${tick}`}
      style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
  )
}

export function GateReboots({ siteId, isCorporate }: { siteId: string; isCorporate?: boolean }) {
  const [reboots, setReboots] = useState<Reboot[]>([])
  const [loading, setLoading] = useState(true)
  const [run, setRun] = useState<Reboot | null>(null)
  const [editing, setEditing] = useState<Reboot | 'new' | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/sites/${siteId}/gate-reboots`, { cache: 'no-store' })
      .then(r => r.json()).then(j => setReboots(Array.isArray(j.reboots) ? j.reboots : []))
      .catch(() => setReboots([])).finally(() => setLoading(false))
  }, [siteId])
  useEffect(() => { load() }, [load])

  async function remove(rb: Reboot) {
    if (!confirm(`Delete "${rb.name}"?`)) return
    await fetch(`/api/sites/${siteId}/gate-reboots/${rb.id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, display: 'flex', alignItems: 'center', gap: 7 }}>🔄 Gate re-boot</div>
          <div style={{ fontSize: 11.5, color: C.ink2 }}>Watch the camera while it power-cycles the gate, then opens.</div>
        </div>
        {isCorporate && (
          <button onClick={() => setEditing('new')} style={btn(C.accent)}>+ New re-boot</button>
        )}
      </div>

      {loading ? (
        <div style={{ color: C.ink2, fontSize: 12, padding: 12 }}>Loading…</div>
      ) : reboots.length === 0 ? (
        <div style={{ color: C.ink2, fontSize: 12.5, background: C.well, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12 }}>
          No gate re-boots configured yet.{isCorporate ? ' Click “New re-boot” to set one up for a gate.' : ' Ask Gate Guard to set one up.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
          {reboots.map(rb => (
            <div key={rb.id} style={{ background: C.tile, border: `1px solid ${C.border}`, borderRadius: 11, padding: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{rb.name}</div>
              <div style={{ fontSize: 10.5, color: C.ink2, marginTop: 3, marginBottom: 10 }}>
                {(rb.power_relay_name || 'power relay')} · off {rb.wait_seconds}s · then {rb.actuation_type === 'brivo' ? (rb.actuation_door_name || 'open door') : rb.actuation_type === 'shelly' ? (rb.actuation_relay_name || 'pulse relay') : 'no open'}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setRun(rb)} style={{ ...btn(C.warn), flex: 1 }}>▶ Run reset</button>
                {isCorporate && <button onClick={() => setEditing(rb)} style={btnGhost()}>Edit</button>}
                {isCorporate && <button onClick={() => remove(rb)} style={btnGhost(C.alarm)}>✕</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {run && <RunModal reboot={run} siteId={siteId} onClose={() => setRun(null)} />}
      {editing && <BuilderModal siteId={siteId} reboot={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
    </div>
  )
}

// ── Run modal ────────────────────────────────────────────────────────────────
type Phase = 'idle' | 'powering_off' | 'waiting' | 'powering_on' | 'ready' | 'actuating' | 'done' | 'error'

function RunModal({ reboot, siteId, onClose }: { reboot: Reboot; siteId: string; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [countdown, setCountdown] = useState(reboot.wait_seconds)
  const [err, setErr] = useState<string | null>(null)
  const [log, setLog] = useState<string[]>([])
  const cancelled = useRef(false)
  useEffect(() => () => { cancelled.current = true }, [])

  const addLog = (s: string) => setLog(l => [...l, s])

  async function shelly(deviceId: string, channel: number, body: Record<string, unknown>, name: string) {
    const res = await fetch(`/api/shelly/relays/${deviceId}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ site_id: siteId, channel, confirm: true, name, ...body }),
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Relay command failed')
  }

  async function runReset() {
    setErr(null); setLog([])
    try {
      setPhase('powering_off'); addLog(`Cutting power — ${reboot.power_relay_name || 'relay'} OFF`)
      await shelly(reboot.power_device_id, reboot.power_channel, { on: false }, reboot.power_relay_name || 'Power relay')

      setPhase('waiting')
      for (let s = reboot.wait_seconds; s > 0 && !cancelled.current; s--) { setCountdown(s); await sleep(1000) }
      setCountdown(0)

      setPhase('powering_on'); addLog('Restoring power — relay ON')
      await shelly(reboot.power_device_id, reboot.power_channel, { on: true }, reboot.power_relay_name || 'Power relay')

      addLog('Power restored — watch the camera for the operator to come online')
      setPhase('ready')
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e)); setPhase('error')
    }
  }

  async function actuate() {
    setErr(null)
    try {
      setPhase('actuating')
      if (reboot.actuation_type === 'brivo' && reboot.actuation_door_id) {
        const res = await fetch(`/api/brivo/doors/${reboot.actuation_door_id}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ site_id: siteId, door_name: reboot.actuation_door_name || 'Gate', confirm: true }),
        })
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Brivo open failed')
        addLog(`Opened ${reboot.actuation_door_name || 'gate'} (Brivo)`)
      } else if (reboot.actuation_type === 'shelly' && reboot.actuation_device_id) {
        await shelly(reboot.actuation_device_id, reboot.actuation_channel ?? 0, { pulse: reboot.actuation_pulse_seconds || 1 }, reboot.actuation_relay_name || 'Gate relay')
        addLog(`Pulsed ${reboot.actuation_relay_name || 'gate relay'}`)
      }
      setPhase('done')
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e)); setPhase('error')
    }
  }

  const statusText: Record<Phase, string> = {
    idle: 'Ready. Watch the camera, then start the reset.',
    powering_off: 'Cutting power to the gate…',
    waiting: `Powered off — waiting ${countdown}s before restoring…`,
    powering_on: 'Restoring power…',
    ready: 'Power restored. Watch the camera — when the operator is back online, open the gate.',
    actuating: 'Opening the gate…',
    done: 'Done. Gate re-boot complete.',
    error: 'Something went wrong.',
  }
  const running = phase === 'powering_off' || phase === 'waiting' || phase === 'powering_on' || phase === 'actuating'

  return (
    <Overlay onClose={running ? undefined : onClose}>
      <div style={{ width: 'min(560px, 94vw)', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '13px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ color: C.ink, fontWeight: 700, fontSize: 14 }}>🔄 {reboot.name}</div>
          <button onClick={onClose} disabled={running} style={{ ...btnGhost(), opacity: running ? 0.4 : 1 }}>Close</button>
        </div>

        {/* Live camera */}
        <div style={{ position: 'relative', aspectRatio: '16 / 9', background: '#0a121d', borderBottom: `1px solid ${C.border}` }}>
          <LiveCam siteId={siteId} cameraId={reboot.camera_id || ''} alt={reboot.camera_name || 'Gate camera'} />
          <span style={{ position: 'absolute', top: 8, left: 10, fontSize: 10.5, fontWeight: 700, color: '#fff', background: 'rgba(0,0,0,0.55)', borderRadius: 6, padding: '2px 8px' }}>
            <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: C.alarm, marginRight: 5 }} />LIVE · {reboot.camera_name || 'Gate camera'}
          </span>
          {phase === 'waiting' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)' }}>
              <div style={{ fontSize: 52, fontWeight: 800, color: '#fff', textShadow: '0 2px 12px rgba(0,0,0,0.6)' }}>{countdown}s</div>
            </div>
          )}
        </div>

        {/* Status + controls */}
        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 12.5, color: phase === 'error' ? C.alarm : C.ink, marginBottom: 12 }}>{err || statusText[phase]}</div>

          {(phase === 'idle' || phase === 'error') && (
            <button onClick={runReset} style={{ ...btn(C.warn), width: '100%', padding: '11px 0', fontSize: 14 }}>
              ⏻ Start reset — power off {reboot.wait_seconds}s, then on
            </button>
          )}
          {phase === 'ready' && reboot.actuation_type !== 'none' && (
            <button onClick={actuate} style={{ ...btn(C.ok), width: '100%', padding: '11px 0', fontSize: 14, color: '#08301f' }}>
              {reboot.actuation_type === 'brivo' ? `🔓 Open ${reboot.actuation_door_name || 'gate'} (Brivo)` : `⚡ Pulse ${reboot.actuation_relay_name || 'gate relay'}`}
            </button>
          )}
          {(phase === 'ready' && reboot.actuation_type === 'none') && (
            <button onClick={onClose} style={{ ...btn(C.accent), width: '100%', padding: '11px 0' }}>Done</button>
          )}
          {phase === 'done' && (
            <button onClick={onClose} style={{ ...btn(C.accent), width: '100%', padding: '11px 0' }}>Close</button>
          )}

          {log.length > 0 && (
            <div style={{ marginTop: 12, background: C.well, border: `1px solid ${C.border}`, borderRadius: 10, padding: 10 }}>
              {log.map((l, i) => <div key={i} style={{ fontSize: 11, color: C.ink2, padding: '2px 0' }}>› {l}</div>)}
            </div>
          )}
        </div>
      </div>
    </Overlay>
  )
}

// ── Builder modal (corporate) ────────────────────────────────────────────────
function BuilderModal({ siteId, reboot, onClose, onSaved }: { siteId: string; reboot: Reboot | null; onClose: () => void; onSaved: () => void }) {
  const [relays, setRelays] = useState<Relay[]>([])
  const [doors, setDoors] = useState<Door[]>([])
  const [cams, setCams] = useState<Cam[]>([])
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
    fetch(`/api/shelly/relays?site_id=${siteId}`, { cache: 'no-store' }).then(r => r.json()).then(j => setRelays(Array.isArray(j.relays) ? j.relays : [])).catch(() => {})
    fetch(`/api/brivo/doors?site_id=${siteId}`, { cache: 'no-store' }).then(r => r.json()).then(j => setDoors(Array.isArray(j.doors) ? j.doors : [])).catch(() => {})
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fetch(`/api/eagle-eye/cameras?site_id=${siteId}`, { cache: 'no-store' }).then(r => r.json()).then(j => setCams((Array.isArray(j.cameras) ? j.cameras : []).map((c: any) => ({ id: c.id ?? c.camera_id, name: c.name ?? c.camera_name ?? c.id })))).catch(() => {})
  }, [siteId])

  async function save() {
    setErr(null)
    if (!name || !powerId) { setErr('Name and a power relay are required.'); return }
    const [pDev, pCh] = powerId.split(':')
    const relayName = relays.find(r => `${r.id}:${r.channel}` === powerId)?.name
    const camName = cams.find(c => c.id === cameraId)?.name
    const payload: Record<string, unknown> = {
      name, camera_id: cameraId || null, camera_name: camName || null,
      power_device_id: pDev, power_channel: Number(pCh) || 0, power_relay_name: relayName || null,
      wait_seconds: Number(wait) || 30, actuation_type: actType,
      actuation_door_id: null, actuation_door_name: null, actuation_device_id: null, actuation_channel: null, actuation_relay_name: null, actuation_pulse_seconds: Number(pulse) || 1,
    }
    if (actType === 'brivo') { payload.actuation_door_id = doorId; payload.actuation_door_name = doors.find(d => d.id === doorId)?.name || null }
    if (actType === 'shelly' && actRelay) {
      const [aDev, aCh] = actRelay.split(':')
      payload.actuation_device_id = aDev; payload.actuation_channel = Number(aCh) || 0
      payload.actuation_relay_name = relays.find(r => `${r.id}:${r.channel}` === actRelay)?.name || null
    }
    setSaving(true)
    const res = await fetch(reboot ? `/api/sites/${siteId}/gate-reboots/${reboot.id}` : `/api/sites/${siteId}/gate-reboots`, {
      method: reboot ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    const j = await res.json(); setSaving(false)
    if (!res.ok) { setErr(j.error || 'Save failed'); return }
    onSaved()
  }

  return (
    <Overlay onClose={onClose}>
      <div style={{ width: 'min(480px, 94vw)', maxHeight: '90vh', overflowY: 'auto', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16 }}>
        <div style={{ padding: '13px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ color: C.ink, fontWeight: 700, fontSize: 14 }}>{reboot ? 'Edit re-boot' : 'New gate re-boot'}</div>
          <button onClick={onClose} style={btnGhost()}>Close</button>
        </div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <L label="Name"><input value={name} onChange={e => setName(e.target.value)} placeholder="P3 Exit Gate re-boot" style={inp()} /></L>
          <L label="Gate camera (to watch)"><select value={cameraId} onChange={e => setCameraId(e.target.value)} style={inp()}><option value="">— none —</option>{cams.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></L>
          <L label="Power relay (Shelly)"><select value={powerId} onChange={e => setPowerId(e.target.value)} style={inp()}><option value="">— pick relay —</option>{relays.map(r => <option key={`${r.id}:${r.channel}`} value={`${r.id}:${r.channel}`}>{r.name}</option>)}</select></L>
          <L label="Wait before power-on (seconds)"><input type="number" value={wait} onChange={e => setWait(Number(e.target.value))} style={inp()} /></L>
          <L label="Then open with">
            <div style={{ display: 'flex', gap: 6 }}>
              {(['brivo', 'shelly', 'none'] as const).map(t => (
                <button key={t} onClick={() => setActType(t)} style={{ ...(actType === t ? btn(C.accent) : btnGhost()), flex: 1, textTransform: 'capitalize' }}>{t === 'brivo' ? 'Brivo door' : t === 'shelly' ? '2nd relay' : 'Nothing'}</button>
              ))}
            </div>
          </L>
          {actType === 'brivo' && <L label="Brivo door to open"><select value={doorId} onChange={e => setDoorId(e.target.value)} style={inp()}><option value="">— pick door —</option>{doors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></L>}
          {actType === 'shelly' && <>
            <L label="Second relay to pulse"><select value={actRelay} onChange={e => setActRelay(e.target.value)} style={inp()}><option value="">— pick relay —</option>{relays.map(r => <option key={`${r.id}:${r.channel}`} value={`${r.id}:${r.channel}`}>{r.name}</option>)}</select></L>
            <L label="Pulse seconds"><input type="number" value={pulse} onChange={e => setPulse(Number(e.target.value))} style={inp()} /></L>
          </>}
          {err && <div style={{ color: C.alarm, fontSize: 12 }}>{err}</div>}
          <button onClick={save} disabled={saving} style={{ ...btn(C.accent), width: '100%', padding: '10px 0', opacity: saving ? 0.5 : 1 }}>{saving ? 'Saving…' : reboot ? 'Save changes' : 'Create re-boot'}</button>
        </div>
      </div>
    </Overlay>
  )
}

// ── bits ─────────────────────────────────────────────────────────────────────
function Overlay({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(4,10,20,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()}>{children}</div>
    </div>
  )
}
function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div style={{ fontSize: 10.5, fontWeight: 600, color: C.accent, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>{label}</div>{children}</div>
}
function inp(): React.CSSProperties { return { width: '100%', background: C.well, border: `1px solid ${C.border}`, borderRadius: 9, padding: '8px 10px', color: C.ink, fontSize: 13, outline: 'none' } }
function btn(color: string): React.CSSProperties { return { background: color, border: 'none', color: '#08192b', borderRadius: 9, padding: '7px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' } }
function btnGhost(color = 'rgba(255,255,255,0.75)'): React.CSSProperties { return { background: 'transparent', border: `1px solid ${C.border}`, color, borderRadius: 9, padding: '7px 10px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' } }
