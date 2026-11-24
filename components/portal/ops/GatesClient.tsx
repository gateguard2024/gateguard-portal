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
        setStuck(l.same >= 5); setErr(false)
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

/** The camera for a door: Edge = live video, Eagle Eye = refreshing picture. */
function DoorCam({ slug, link, edge, big }: { slug: string; link: Link; edge: EdgePass | null; big?: boolean }) {
  const [liveFail, setLiveFail] = useState(false)
  const c = link.camera
  return (
    <div style={{ position: 'relative', aspectRatio: '16 / 9', background: '#0b0b0d', borderRadius: big ? 12 : 10, overflow: 'hidden' }}>
      {c.provider === 'edge' && edge
        ? (!liveFail ? <EdgeLive key={c.key} edge={edge} cam={c.id} onFail={() => setLiveFail(true)} /> : <EdgeSnap edge={edge} cam={c.id} everyMs={1500} alt={`${c.name} camera`} />)
        : <EenLive slug={slug} cam={c} everyMs={big ? 1500 : 2500} />}
      <div style={{ position: 'absolute', left: 8, top: 7, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600, color: '#fff', background: 'rgba(0,0,0,.5)', borderRadius: 6, padding: '2px 7px', pointerEvents: 'none' }}>
        <span style={{ width: 7, height: 7, borderRadius: 99, background: '#FF3B30' }} />{c.provider === 'edge' && !liveFail ? 'Live' : 'Camera'} · {c.name}
      </div>
    </div>
  )
}
const EGRESS = /(exit|egress|ped|pedestrian|walk|man\s?gate|ada|emergenc)/i
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

  useEffect(() => { fetch(`/api/portal/${slug}/summary`).then(r => r.json()).then(j => setDoors(j.doors ?? [])).catch(() => {}) }, [slug])
  // Which camera watches each door (refresh every 10 min — the Edge pass lasts 15).
  useEffect(() => {
    const load = () => fetch(`/api/portal/${slug}/door-cameras`).then(r => r.json()).then(j => { setLinks(j.links ?? {}); setEdge(j.edge ?? null) }).catch(() => {})
    load(); const t = setInterval(load, 10 * 60_000); return () => clearInterval(t)
  }, [slug])
  useEffect(() => { if (!watch) return; const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setWatch(null) }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [watch])

  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(null), 3200) }
  async function cmd(d: Door, action: 'open' | 'hold_open' | 'force_close') {
    if (!manager) { requireSignIn(); return }
    setBusy(`${d.id}:${action}`)
    try {
      const r = await fetch(`/api/portal/${slug}/gate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ door_id: d.id, door_name: d.name, action, minutes: action === 'hold_open' ? 60 : undefined }) })
      const j = await r.json().catch(() => ({}))
      flash(r.ok ? `${d.name}: ${action.replace('_', ' ')} ✓${j.note ? ' (recorded)' : ''}` : (j?.error || 'Command failed'))
    } catch { flash('Command failed') } finally { setBusy(null) }
  }
  async function lockdown(active: boolean) {
    if (!manager) { requireSignIn(); return }
    try {
      const r = await fetch(`/api/portal/${slug}/lockdown`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active }) })
      const j = await r.json().catch(() => ({}))
      if (r.ok) { setLockActive(active); flash(active ? `Lockdown engaged — ${(j.affected || []).length} gate(s); egress stays open` : 'Lockdown lifted') }
      else flash(j?.error || 'Lockdown failed')
    } catch { flash('Lockdown failed') }
  }

  const shown = doors.filter(d => filter === 'all' ? true : filter === 'gates' ? /gate/i.test(d.name) : !/gate/i.test(d.name))
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
      <div style={{ display: 'flex', gap: 8 }}>
        {([['all', `All (${counts.all})`], ['gates', `Gates (${counts.gates})`], ['doors', `Doors (${counts.doors})`]] as const).map(([k, lbl]) => (
          <button key={k} onClick={() => setFilter(k)} style={{ fontSize: 12, fontWeight: 700, padding: '7px 14px', borderRadius: 999, cursor: 'pointer', border: `1px solid ${filter === k ? 'rgba(0,113,227,0.5)' : C.border2}`, background: filter === k ? 'rgba(0,113,227,0.08)' : 'transparent', color: filter === k ? C.cyan : C.ink2 }}>{lbl}</button>
        ))}
      </div>

      {/* Control cards */}
      {shown.length === 0 ? (
        <div style={{ ...card(), textAlign: 'center', color: C.ink2, fontSize: 13 }}>No access points connected for this site yet.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {shown.map(d => {
            const egress = EGRESS.test(d.name)
            const link = links[d.id]
            return (
              <div key={d.id} style={card()}>
                {link && (
                  <button type="button" onClick={() => setWatch(d)} aria-label={`Watch ${d.name} big`} style={{ display: 'block', width: '100%', padding: 0, border: 0, background: 'none', cursor: 'pointer', marginBottom: 12 }}>
                    <DoorCam slug={slug} link={link} edge={edge} />
                  </button>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{d.name}</span>
                  <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 999, background: 'rgba(31,138,59,0.08)', color: C.safe, border: '1px solid rgba(31,138,59,0.3)' }}>SECURED</span>
                </div>
                <button onClick={() => cmd(d, 'open')} disabled={busy === `${d.id}:open`} style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1px solid rgba(0,113,227,0.4)', background: 'rgba(0,113,227,0.08)', color: C.cyan, fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8 }}><KeyRound size={14} /> Open (10s)</button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1 }}><HoldButton tone="amber" label="Hold 1 hr" holdingLabel="Holding…" onConfirm={() => cmd(d, 'hold_open')} disabled={!manager} /></div>
                  <div style={{ flex: 1 }}><HoldButton tone="alert" label="Force close" holdingLabel="Closing…" onConfirm={() => cmd(d, 'force_close')} disabled={!manager || egress} title={egress ? 'Egress/pedestrian routes cannot be force-closed' : undefined} /></div>
                </div>
                {egress && <div style={{ fontSize: 10.5, color: C.ink2, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}><Lock size={11} /> Egress route — never force-closed</div>}
                {!link && <div style={{ fontSize: 11, color: C.ink3, marginTop: 8 }}>No camera linked to this {/gate/i.test(d.name) ? 'gate' : 'door'}.</div>}
              </div>
            )
          })}
        </div>
      )}
      {!manager && <div style={{ fontSize: 11.5, color: C.ink2 }}>Sign in with your personal PIN to control gates.</div>}

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
