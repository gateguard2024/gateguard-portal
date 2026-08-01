'use client'

// ─────────────────────────────────────────────────────────────────────────────
// CustomerPortalTemplate — the SINGLE SOURCE OF TRUTH for the customer portal
// DESIGN. Every property's portal renders through this one component, so changing
// THEME or the layout here updates EVERY site at once. Per-site differences come
// in only as `config` (branding, which modules, which cameras) + live `data` —
// never as design forks. Steel theme, DM Sans (inherited from the app font).
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Home, Video, Ticket, ListChecks, CreditCard, Settings, LockOpen, History, LifeBuoy, ShieldCheck, Maximize2, Camera, Users, Search, UserPlus, X, Mail, Phone, Zap, RotateCcw } = require('lucide-react') as any

const THEME = {
  bg: '#0f1822', nav: '#141d28', panel: 'linear-gradient(180deg,#1d2a39,#141d28)',
  tile: '#16232f', well: '#0c1420', border: 'rgba(140,170,200,0.24)',
  ink: '#eaf2fb', ink2: '#c3d3e2', label: '#9FD8EC', accent: '#5FB8E0',
  ok: '#7ee0a8', warn: '#fbbf24', alarm: '#f87171', chrome: '#1c1917',
} as const

export type PortalConfig = {
  display_name: string
  accent?: string | null
  modules: string[]
  login_type?: 'property' | 'resident'
  slug?: string            // when set, the template pulls live read-only data from /api/portal/<slug>/summary
}
export type PortalCamera = { id: string; name: string }
export type PortalActivity = { id: string; label: string; where: string; time: string }
export type PortalUser = { name: string; initials: string }

// Each nav icon maps to a real, rendered section (via its DOM id `sec-<key>`).
const NAV: { key: string; label: string; module?: string; Icon: any }[] = [
  { key: 'home', label: 'Home', Icon: Home },
  { key: 'cameras', label: 'Cameras', module: 'cameras', Icon: Video },
  { key: 'passes', label: 'Access', module: 'passes', Icon: Ticket },
  { key: 'activity', label: 'Activity', module: 'activity', Icon: ListChecks },
  { key: 'billing', label: 'Billing', module: 'billing', Icon: CreditCard },
]

export function CustomerPortalTemplate({
  config, user, cameras = [], activity = [], balanceDue = null,
  onOpenGate, onIssuePass, onUnlock, onRewind, onPay, onRequestService,
}: {
  config: PortalConfig
  user?: PortalUser
  cameras?: PortalCamera[]
  activity?: PortalActivity[]
  balanceDue?: number | null
  onOpenGate?: () => void
  onIssuePass?: () => void
  onUnlock?: () => void
  onRewind?: () => void
  onPay?: () => void
  onRequestService?: () => void
}) {
  const accent = config.accent || THEME.accent
  const has = (m: string) => config.modules.includes(m)

  // Live read-only data behind the PIN — fetched after mount, falls back to props/demo.
  const [live, setLive] = useState<{ cameras?: PortalCamera[]; doors?: { id: string; name: string }[]; activity?: PortalActivity[]; balanceDue?: number | null; payables?: { id: string; number: string; balance: number; link: string | null }[] }>({})
  const [payOpen, setPayOpen] = useState(false)
  const reloadSummary = () => {
    if (!config.slug) return
    fetch(`/api/portal/${config.slug}/summary`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (j) setLive({ cameras: j.cameras, doors: j.doors, activity: j.activity, balanceDue: j.balanceDue, payables: j.payables }) })
      .catch(() => {})
  }
  useEffect(() => {
    if (!config.slug) return
    reloadSummary()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.slug])

  // ── Site-manager actions (PIN-gated server-side) ─────────────────────────
  const doors = live.doors ?? []
  const [unlockOpen, setUnlockOpen] = useState(false)
  const [passOpen, setPassOpen] = useState(false)
  const [busyDoor, setBusyDoor] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null)
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3200); return () => clearTimeout(t) }, [toast])
  const [pass, setPass] = useState<{ firstName: string; lastName: string; email: string; to: string; busy: boolean; err: string | null }>({ firstName: '', lastName: '', email: '', to: '', busy: false, err: null })

  async function doUnlock(doorId: string, doorName: string) {
    if (!config.slug) return
    setBusyDoor(doorId)
    try {
      const r = await fetch(`/api/portal/${config.slug}/unlock`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ door_id: doorId, door_name: doorName }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setToast({ msg: j.error || 'Unlock failed.', kind: 'err' }); return }
      setToast({ msg: `${doorName} unlocked.`, kind: 'ok' })
      setUnlockOpen(false)
      setTimeout(reloadSummary, 1500)
    } catch { setToast({ msg: 'Unlock failed.', kind: 'err' }) }
    finally { setBusyDoor(null) }
  }

  async function submitPass() {
    if (!config.slug || !pass.firstName.trim() || !pass.lastName.trim() || !pass.email.trim()) return
    setPass(p => ({ ...p, busy: true, err: null }))
    try {
      const r = await fetch(`/api/portal/${config.slug}/issue-pass`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ firstName: pass.firstName, lastName: pass.lastName, email: pass.email, to: pass.to || null }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setPass(p => ({ ...p, busy: false, err: j.error || 'Could not issue the pass.' })); return }
      setPass({ firstName: '', lastName: '', email: '', to: '', busy: false, err: null })
      setPassOpen(false)
      setToast({ msg: 'Visitor pass sent.', kind: 'ok' })
    } catch { setPass(p => ({ ...p, busy: false, err: 'Could not issue the pass.' })) }
  }

  // Rewind clip player. (Live previews self-refresh inside PortalCamImg.)
  const [clip, setClip] = useState<{ camId: string; name: string } | null>(null)
  // Cameras tab: enlarge (3/4 screen) + archive history browser.
  const [enlarge, setEnlarge] = useState<{ id: string; name: string } | null>(null)
  const enlargeRef = useRef<HTMLDivElement | null>(null)
  const [hist, setHist] = useState<{ camId: string; name: string } | null>(null)
  const todayStr = new Date().toISOString().slice(0, 10)
  const [histDate, setHistDate] = useState(todayStr)
  const [histSegs, setHistSegs] = useState<{ start: string; end: string | null }[]>([])
  const [histLoading, setHistLoading] = useState(false)
  const [histPlayTs, setHistPlayTs] = useState<string | null>(null)
  function openHistory(camId: string, name: string) { setHist({ camId, name }); setHistDate(todayStr); setHistPlayTs(null) }
  useEffect(() => {
    if (!hist || !config.slug) return
    let cancelled = false
    setHistLoading(true); setHistSegs([])
    fetch(`/api/portal/${config.slug}/camera-history?camera_id=${encodeURIComponent(hist.camId)}&date=${histDate}`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : { segments: [] }))
      .then(j => { if (!cancelled) setHistSegs(Array.isArray(j.segments) ? j.segments : []) })
      .catch(() => { if (!cancelled) setHistSegs([]) })
      .finally(() => { if (!cancelled) setHistLoading(false) })
    return () => { cancelled = true }
  }, [hist, histDate, config.slug])
  const [svc, setSvc] = useState<{ open: boolean; title: string; desc: string; contact: string; busy: boolean; done: boolean; err: string | null }>({ open: false, title: '', desc: '', contact: '', busy: false, done: false, err: null })
  async function submitService() {
    if (!config.slug || !svc.title.trim()) return
    setSvc(s => ({ ...s, busy: true, err: null }))
    try {
      const r = await fetch(`/api/portal/${config.slug}/request-service`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: svc.title, description: svc.desc, contact_name: svc.contact }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setSvc(s => ({ ...s, busy: false, err: j.error || 'Could not send.' })); return }
      setSvc(s => ({ ...s, busy: false, done: true, title: '', desc: '' }))
    } catch { setSvc(s => ({ ...s, busy: false, err: 'Could not send.' })) }
  }

  // Left-rail navigation — the portal is one scrolling page; the rail scrolls to
  // (and highlights) each section. Genuinely useful on mobile where it stacks.
  const [activeNav, setActiveNav] = useState('home')
  const camViewRef = useRef<HTMLDivElement | null>(null)
  // The rail is a view switcher: 'home' shows everything; any other key focuses
  // that one section (full width). This makes every rail click visibly change the
  // screen instead of scrolling within an already-visible single-screen layout.
  const show = (key: string) => activeNav === 'home' || activeNav === key
  function goToSection(key: string) {
    setActiveNav(key)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const effCameras = live.cameras && live.cameras.length ? live.cameras : cameras
  const effActivity = live.activity && live.activity.length ? live.activity : activity
  // On a real (slug'd) portal never show demo activity — show real or an empty state.
  const activityRows = effActivity.length ? effActivity : (config.slug ? [] : DEMO_ACTIVITY)
  const effBalance = live.balanceDue !== undefined ? live.balanceDue : balanceDue

  const cams = effCameras
  const [activeCam, setActiveCam] = useState(0)
  const primaryCam = cams[activeCam] ?? cams[0]

  const font = { fontFamily: "'DM Sans', var(--font-dm-sans, system-ui), sans-serif" }
  // Raised steel panel — matches the dealer Command Center cards: gradient face,
  // 1px steel border, a hairline top highlight and a soft drop so tiles read as
  // lifted off the page rather than flat black.
  const tile = {
    background: THEME.panel, border: `1px solid ${THEME.border}`, borderRadius: 14,
    boxShadow: 'inset 0 1px 0 rgba(190,215,240,0.06), 0 10px 24px -18px rgba(0,0,0,0.8)',
  } as const
  // Small-caps cyan section eyebrow — the dealer shell's label style.
  const eyebrow = {
    fontSize: 10.5, fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase',
    color: THEME.label, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10,
  } as const
  // Ambient top glow behind all content — the faint cyan bloom the dealer shell has.
  const pageBg = `radial-gradient(1100px 460px at 50% -8%, rgba(95,184,224,0.10), transparent 62%), ${THEME.bg}`

  return (
    <div style={{ ...font, minHeight: '100dvh', background: pageBg, color: THEME.ink, display: 'grid', gridTemplateColumns: '58px 1fr' }}>
      <nav style={{ background: THEME.nav, borderRight: `1px solid rgba(140,170,200,0.14)`, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 0', gap: 6 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', color: THEME.bg, marginBottom: 10 }}><ShieldCheck size={18} /></div>
        {NAV.filter(n => !n.module || has(n.module)).map((n) => {
          const active = activeNav === n.key
          return (
            <button key={n.key} aria-label={n.label} title={n.label} onClick={() => goToSection(n.key)} style={{ width: 40, height: 40, borderRadius: 10, border: active ? `1px solid rgba(95,184,224,0.4)` : '1px solid transparent', background: active ? 'rgba(95,184,224,0.18)' : 'transparent', color: active ? accent : '#7f96ab', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.15s, color 0.15s' }}><n.Icon size={19} /></button>
          )
        })}
        <button aria-label="settings" title="Settings" style={{ marginTop: 'auto', width: 40, height: 40, borderRadius: 10, border: '1px solid transparent', background: 'transparent', color: '#7f96ab', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Settings size={19} /></button>
      </nav>

      <div style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 600 }}>{config.display_name}</div>
            <div style={{ fontSize: 12, color: THEME.label }}>{greeting()}{user ? `, ${user.name.split(' ')[0]}` : ''}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: THEME.ok, background: 'rgba(126,224,168,0.10)', border: '1px solid rgba(126,224,168,0.3)', borderRadius: 999, padding: '4px 10px' }}><ShieldCheck size={13} /> All secure</span>
            {user && <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#292524', border: `1px solid rgba(95,184,224,0.4)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: THEME.label, fontSize: 11, fontWeight: 600 }}>{user.initials}</div>}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: activeNav === 'home' ? '1.55fr 1fr' : '1fr', gap: 14 }}>
          <div style={{ display: (show('cameras') || show('passes')) ? 'block' : 'none' }}>
            {(has('cameras') || has('gate')) && activeNav === 'home' && (
              <div id="sec-cameras" ref={camViewRef} style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', border: `1px solid ${THEME.border}`, boxShadow: 'inset 0 1px 0 rgba(190,215,240,0.06)', background: `radial-gradient(120% 90% at 50% 8%, rgba(95,184,224,0.10), transparent 55%), radial-gradient(circle at 50% 42%, #1b2c3e, #0a121d)`, aspectRatio: '16 / 9', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {config.slug && primaryCam?.id
                  ? <PortalCamImg slug={config.slug} cameraId={primaryCam.id} alt={primaryCam.name} intervalMs={2500} />
                  : (<><Camera size={32} style={{ color: '#46617a' }} /><span style={{ fontSize: 11, color: THEME.label, letterSpacing: '0.04em' }}>Live view</span></>)}
                <span style={{ position: 'absolute', top: 10, left: 12, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 600, color: '#fff', background: 'rgba(0,0,0,0.5)', borderRadius: 6, padding: '3px 8px' }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: THEME.alarm }} />LIVE · {primaryCam?.name ?? 'Front gate'}</span>
                {has('gate') && (() => {
                  const gate = doors.find(d => /gate|entry|entrance/i.test(d.name)) || doors[0]
                  const busy = gate ? busyDoor === gate.id : false
                  return (
                    <button onClick={() => { if (config.slug && gate) doUnlock(gate.id, gate.name); else onOpenGate?.() }} disabled={busy} style={{ position: 'absolute', bottom: 12, left: 12, background: accent, border: 'none', color: THEME.bg, borderRadius: 10, padding: '11px 18px', fontSize: 14, fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, ...font, display: 'inline-flex', alignItems: 'center', gap: 6 }}><LockOpen size={16} /> {busy ? 'Opening…' : 'Open gate'}</button>
                  )
                })()}
                <div style={{ position: 'absolute', bottom: 12, right: 12, display: 'flex', gap: 6 }}>
                  <button aria-label="fullscreen" title="Fullscreen" onClick={() => { try { camViewRef.current?.requestFullscreen?.() } catch { /* not supported */ } }} style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.18)', color: '#fff', borderRadius: 9, padding: '8px 11px', cursor: 'pointer' }}><Maximize2 size={14} /></button>
                </div>
              </div>
            )}

            {has('cameras') && cams.length > 0 && activeNav === 'home' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: 6, marginTop: 10 }}>
                  {cams.map((c, i) => (
                    <button key={c.id} onClick={() => setActiveCam(i)} onDoubleClick={() => setEnlarge({ id: c.id, name: c.name })} title="Click to view · double-click to enlarge" style={{ aspectRatio: '16 / 10', borderRadius: 8, background: THEME.well, border: i === activeCam ? `2px solid ${accent}` : `1px solid rgba(140,170,200,0.2)`, position: 'relative', overflow: 'hidden', cursor: 'pointer', padding: 0 }}>
                      {config.slug && c.id && <PortalCamImg slug={config.slug} cameraId={c.id} alt={c.name} intervalMs={4500} />}
                      <span style={{ position: 'absolute', bottom: 3, left: 5, fontSize: 8, color: '#fff', background: 'rgba(0,0,0,0.5)', borderRadius: 3, padding: '0 3px', zIndex: 1 }}>{c.name}</span>
                    </button>
                  ))}
                </div>
                <button onClick={() => { if (config.slug && primaryCam?.id) setClip({ camId: primaryCam.id, name: primaryCam.name }); else onRewind?.() }} style={{ width: '100%', marginTop: 8, background: THEME.tile, border: `1px solid ${THEME.border}`, color: THEME.label, borderRadius: 9, padding: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer', ...font, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><History size={14} /> Rewind — review recent footage</button>
              </>
            )}

            {/* Cameras tab — every camera, live. Double-click a tile to enlarge. */}
            {has('cameras') && activeNav === 'cameras' && (
              <div>
                <div style={{ ...eyebrow, marginBottom: 12 }}><Video size={14} style={{ color: THEME.label }} /> All cameras · {effCameras.length}</div>
                {effCameras.length === 0 ? (
                  <div style={{ ...tile, padding: 24, textAlign: 'center', color: THEME.ink2, fontSize: 13 }}>No cameras are available on this site yet.</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                    {effCameras.map(c => (
                      <div key={c.id} onDoubleClick={() => setEnlarge({ id: c.id, name: c.name })} title="Double-click to enlarge" style={{ position: 'relative', aspectRatio: '16 / 9', borderRadius: 12, overflow: 'hidden', border: `1px solid ${THEME.border}`, background: THEME.well, cursor: 'pointer' }}>
                        {config.slug && c.id && <PortalCamImg slug={config.slug} cameraId={c.id} alt={c.name} intervalMs={3500} />}
                        <span style={{ position: 'absolute', top: 8, left: 8, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9.5, fontWeight: 600, color: '#fff', background: 'rgba(0,0,0,0.5)', borderRadius: 5, padding: '2px 7px', zIndex: 2 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: THEME.alarm }} />LIVE</span>
                        <span style={{ position: 'absolute', bottom: 8, left: 8, fontSize: 11, fontWeight: 600, color: '#fff', background: 'rgba(0,0,0,0.5)', borderRadius: 5, padding: '2px 7px', zIndex: 2 }}>{c.name}</span>
                        <div style={{ position: 'absolute', bottom: 7, right: 7, display: 'flex', gap: 6, zIndex: 2 }}>
                          <button aria-label="Enlarge" title="Enlarge" onClick={e => { e.stopPropagation(); setEnlarge({ id: c.id, name: c.name }) }} style={{ background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: 8, padding: '6px 8px', cursor: 'pointer' }}><Maximize2 size={13} /></button>
                          <button aria-label="History" title="Archive history" onClick={e => { e.stopPropagation(); openHistory(c.id, c.name) }} style={{ background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: 8, padding: '6px 8px', cursor: 'pointer' }}><History size={13} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Access tab (full manager) renders in the left column at full width.
                Home's quick pass/unlock/gate buttons now live in the RIGHT column. */}
            {has('passes') && activeNav === 'passes' && config.slug && (
              <div id="sec-passes" style={{ scrollMarginTop: 12 }}>
                <AccessManager slug={config.slug} accent={accent} onUnlock={() => setUnlockOpen(true)} onGuest={() => setPassOpen(true)} />
              </div>
            )}
          </div>

          <div style={{ display: (show('activity') || show('billing')) ? 'flex' : 'none', flexDirection: 'column', gap: 12 }}>
            {/* Request service — pinned to the TOP of the events column, above the feed. */}
            {has('service') && (show('billing') || show('activity')) && (
              <button onClick={() => config.slug ? setSvc(s => ({ ...s, open: true, done: false, err: null })) : onRequestService?.()} style={{ ...tile, border: `1px solid rgba(95,184,224,0.35)`, padding: 13, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, ...font }}>
                <LifeBuoy size={20} style={{ color: accent }} />
                <div><div style={{ fontSize: 13, fontWeight: 600 }}>Request service</div><div style={{ fontSize: 11, color: THEME.ink2 }}>Report a broken gate, camera, or lock</div></div>
              </button>
            )}

            {/* Quick actions — below Request Service, above Live activity. */}
            {(has('passes') || has('gate')) && show('activity') && (
              <div style={{ ...tile, padding: 12 }}>
                <div style={{ ...eyebrow, marginBottom: 8 }}><Zap size={13} style={{ color: THEME.label }} /> Quick actions</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {has('passes') && (
                    <button onClick={() => config.slug ? setPassOpen(true) : onIssuePass?.()} style={{ background: THEME.tile, border: `1px solid ${THEME.border}`, borderRadius: 9, padding: '10px 8px', cursor: 'pointer', ...font, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, color: THEME.ink }}><Ticket size={17} style={{ color: THEME.ok }} /><span style={{ fontSize: 11.5, fontWeight: 600 }}>Issue pass</span></button>
                  )}
                  {has('passes') && (
                    <button onClick={() => config.slug ? setUnlockOpen(true) : onUnlock?.()} style={{ background: THEME.tile, border: `1px solid ${THEME.border}`, borderRadius: 9, padding: '10px 8px', cursor: 'pointer', ...font, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, color: THEME.ink }}><LockOpen size={17} style={{ color: accent }} /><span style={{ fontSize: 11.5, fontWeight: 600 }}>Unlock door</span></button>
                  )}
                  {has('gate') && (() => {
                    const gate = doors.find(d => /gate|entry|entrance/i.test(d.name)) || doors[0]
                    const busy = gate ? busyDoor === gate.id : false
                    return (
                      <button onClick={() => { if (config.slug && gate) doUnlock(gate.id, gate.name); else onOpenGate?.() }} disabled={busy} style={{ gridColumn: has('passes') ? '1 / -1' : 'auto', background: THEME.tile, border: `1px solid ${THEME.border}`, borderRadius: 9, padding: '10px 8px', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, ...font, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, color: THEME.ink }}><RotateCcw size={17} style={{ color: THEME.warn }} /><span style={{ fontSize: 11.5, fontWeight: 600 }}>{busy ? 'Opening…' : 'Reset gate'}</span></button>
                    )
                  })()}
                </div>
              </div>
            )}
            {has('activity') && show('activity') && (
              <div id="sec-activity" style={{ ...tile, padding: 14, scrollMarginTop: 12 }}>
                <div style={eyebrow}><ListChecks size={14} style={{ color: THEME.label }} /> Live activity</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {activityRows.length === 0 ? (
                    <div style={{ fontSize: 12, color: THEME.ink2, padding: '4px 0' }}>No recent activity yet.</div>
                  ) : activityRows.slice(0, 4).map(a => (
                    <div key={a.id} style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
                      <div style={{ width: 34, height: 26, borderRadius: 6, background: THEME.well, border: `1px solid rgba(140,170,200,0.2)`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3a4f63' }}><Camera size={12} /></div>
                      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 11.5 }}>{a.label}</div><div style={{ fontSize: 10, color: THEME.label }}>{a.where} · {a.time}</div></div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {has('billing') && show('billing') && (
              <div id="sec-billing" style={{ ...tile, padding: 14, display: 'flex', alignItems: 'center', gap: 12, scrollMarginTop: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10.5, color: THEME.label, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Balance due</div>
                  <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.1 }}>{effBalance != null ? `$${effBalance.toLocaleString()}` : '$0'}</div>
                </div>
                <button onClick={() => { const p = (live.payables ?? []).filter(x => x.link); if (p.length === 1) window.open(p[0].link!, '_blank'); else if (p.length > 1) setPayOpen(true); else onPay?.() }} style={{ background: accent, border: 'none', color: THEME.bg, borderRadius: 9, padding: '10px 15px', fontSize: 13, fontWeight: 700, cursor: 'pointer', ...font }}>Pay</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {clip && config.slug && (
        <div onClick={() => setClip(null)} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(4,10,20,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 'min(880px, 96vw)', background: THEME.panel, border: `1px solid ${THEME.border}`, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: `1px solid ${THEME.border}` }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: THEME.ink }}><History size={14} style={{ verticalAlign: -2, marginRight: 6 }} />{clip.name} · recent recording</div>
              <button onClick={() => setClip(null)} style={{ background: 'transparent', border: 'none', color: THEME.ink2, cursor: 'pointer', fontSize: 13 }}>✕ Close</button>
            </div>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video controls autoPlay style={{ width: '100%', display: 'block', background: '#000', aspectRatio: '16 / 9' }} src={`/api/portal/${config.slug}/camera-clip?camera_id=${encodeURIComponent(clip.camId)}&ts=${encodeURIComponent(new Date(Date.now() - 120000).toISOString())}`} />
          </div>
        </div>
      )}

      {/* Enlarge — 3/4-screen live view, expandable to fullscreen. */}
      {enlarge && config.slug && (
        <div onClick={() => setEnlarge(null)} style={{ ...font, position: 'fixed', inset: 0, zIndex: 92, background: 'rgba(4,10,20,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div ref={enlargeRef} onClick={e => e.stopPropagation()} style={{ width: '76vw', height: '76vh', maxWidth: '100%', maxHeight: '100%', background: '#050b13', border: `1px solid ${THEME.border}`, borderRadius: 14, overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: `1px solid ${THEME.border}`, background: THEME.nav }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: THEME.ink, display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: THEME.alarm }} />{enlarge.name} · live</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => openHistory(enlarge.id, enlarge.name)} style={{ background: 'transparent', border: `1px solid ${THEME.border}`, color: THEME.ink2, borderRadius: 8, padding: '6px 11px', fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}><History size={13} /> History</button>
                <button onClick={() => { try { enlargeRef.current?.requestFullscreen?.() } catch { /* unsupported */ } }} style={{ background: 'transparent', border: `1px solid ${THEME.border}`, color: THEME.ink2, borderRadius: 8, padding: '6px 11px', fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}><Maximize2 size={13} /> Fullscreen</button>
                <button onClick={() => setEnlarge(null)} style={{ background: 'transparent', border: 'none', color: THEME.ink2, cursor: 'pointer', fontSize: 13 }}>✕ Close</button>
              </div>
            </div>
            <div style={{ position: 'relative', flex: 1, background: '#000' }}>
              <PortalCamImg slug={config.slug} cameraId={enlarge.id} alt={enlarge.name} intervalMs={2000} />
            </div>
          </div>
        </div>
      )}

      {/* Archive history browser — pick a day, see available recordings, play them. */}
      {hist && config.slug && (
        <div onClick={() => { setHist(null); setHistPlayTs(null) }} style={{ ...font, position: 'fixed', inset: 0, zIndex: 93, background: 'rgba(4,10,20,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 'min(1000px, 96vw)', maxHeight: '92vh', background: THEME.panel, border: `1px solid ${THEME.border}`, borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: `1px solid ${THEME.border}`, background: THEME.nav }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: THEME.ink, display: 'inline-flex', alignItems: 'center', gap: 6 }}><History size={14} /> {hist.name} · archive</div>
              <button onClick={() => { setHist(null); setHistPlayTs(null) }} style={{ background: 'transparent', border: 'none', color: THEME.ink2, cursor: 'pointer', fontSize: 13 }}>✕ Close</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', flex: 1, minHeight: 0 }}>
              {/* Left: date + segment list */}
              <div style={{ borderRight: `1px solid ${THEME.border}`, padding: 12, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: THEME.label, marginBottom: 4 }}>Date</label>
                  <input type="date" value={histDate} max={todayStr} onChange={e => { setHistDate(e.target.value); setHistPlayTs(null) }} style={{ width: '100%', background: THEME.well, border: `1px solid ${THEME.border}`, borderRadius: 9, padding: '8px 10px', color: THEME.ink, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div style={{ fontSize: 10.5, color: THEME.label, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{histLoading ? 'Loading…' : `${histSegs.length} recording${histSegs.length === 1 ? '' : 's'}`}</div>
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, minHeight: 0 }}>
                  {!histLoading && histSegs.length === 0 && <div style={{ fontSize: 12, color: THEME.ink2 }}>No archived video found for this day.</div>}
                  {histSegs.map(s => {
                    const active = histPlayTs === s.start
                    return (
                      <button key={s.start} onClick={() => setHistPlayTs(s.start)} style={{ ...tile, padding: '9px 11px', textAlign: 'left', cursor: 'pointer', border: active ? `1px solid ${accent}` : `1px solid ${THEME.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <History size={13} style={{ color: active ? accent : THEME.label }} />
                        <span style={{ fontSize: 12.5, color: THEME.ink }}>{fmtClock(s.start)}{s.end ? ` – ${fmtClock(s.end)}` : ''}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
              {/* Right: player */}
              <div style={{ background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320 }}>
                {histPlayTs ? (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <video key={histPlayTs} controls autoPlay style={{ width: '100%', height: '100%', maxHeight: '78vh', background: '#000' }} src={`/api/portal/${config.slug}/camera-clip?camera_id=${encodeURIComponent(hist.camId)}&ts=${encodeURIComponent(histPlayTs)}`} />
                ) : (
                  <div style={{ color: THEME.ink2, fontSize: 13, textAlign: 'center', padding: 20 }}><History size={26} style={{ color: '#46617a' }} /><div style={{ marginTop: 8 }}>Select a recording to play.</div></div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {svc.open && (
        <div onClick={() => setSvc(s => ({ ...s, open: false }))} style={{ ...font, position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(4,10,20,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 'min(440px, 96vw)', background: THEME.panel, border: `1px solid ${THEME.border}`, borderRadius: 14, padding: 18 }}>
            {svc.done ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 30 }}>✅</div>
                <div style={{ color: THEME.ink, fontSize: 16, fontWeight: 600, marginTop: 6 }}>Request sent</div>
                <div style={{ color: THEME.ink2, fontSize: 12.5, marginTop: 4 }}>Gate Guard will follow up shortly.</div>
                <button onClick={() => setSvc(s => ({ ...s, open: false }))} style={{ marginTop: 14, background: accent, border: 'none', color: THEME.bg, borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', ...font }}>Done</button>
              </div>
            ) : (
              <>
                <div style={{ color: THEME.ink, fontSize: 15, fontWeight: 600 }}>Request service</div>
                <div style={{ color: THEME.ink2, fontSize: 12, marginBottom: 12 }}>Report a broken gate, camera, or lock.</div>
                <input value={svc.title} onChange={e => setSvc(s => ({ ...s, title: e.target.value }))} placeholder="What's wrong?" style={{ width: '100%', background: THEME.well, border: `1px solid ${THEME.border}`, borderRadius: 10, padding: '10px 12px', color: THEME.ink, fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 8 }} />
                <textarea value={svc.desc} onChange={e => setSvc(s => ({ ...s, desc: e.target.value }))} placeholder="Any details (optional)…" rows={3} style={{ width: '100%', background: THEME.well, border: `1px solid ${THEME.border}`, borderRadius: 10, padding: '10px 12px', color: THEME.ink, fontSize: 13, outline: 'none', boxSizing: 'border-box', resize: 'none', marginBottom: 8 }} />
                <input value={svc.contact} onChange={e => setSvc(s => ({ ...s, contact: e.target.value }))} placeholder="Your name (optional)" style={{ width: '100%', background: THEME.well, border: `1px solid ${THEME.border}`, borderRadius: 10, padding: '10px 12px', color: THEME.ink, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                {svc.err && <div style={{ color: THEME.alarm, fontSize: 12, marginTop: 8 }}>{svc.err}</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
                  <button onClick={() => setSvc(s => ({ ...s, open: false }))} style={{ background: 'transparent', border: `1px solid ${THEME.border}`, color: THEME.ink2, borderRadius: 10, padding: '9px 14px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={submitService} disabled={svc.busy || !svc.title.trim()} style={{ background: accent, border: 'none', color: THEME.bg, borderRadius: 10, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: svc.busy || !svc.title.trim() ? 0.5 : 1 }}>{svc.busy ? 'Sending…' : 'Send request'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {payOpen && (
        <div onClick={() => setPayOpen(false)} style={{ ...font, position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(4,10,20,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 'min(420px, 96vw)', background: THEME.panel, border: `1px solid ${THEME.border}`, borderRadius: 14, padding: 16 }}>
            <div style={{ color: THEME.ink, fontSize: 15, fontWeight: 600 }}>Pay an invoice</div>
            <div style={{ color: THEME.ink2, fontSize: 12, marginBottom: 12 }}>Opens the QuickBooks payment page in a new tab.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(live.payables ?? []).filter(p => p.link).map(p => (
                <button key={p.id} onClick={() => window.open(p.link!, '_blank')} style={{ ...tile, padding: 12, textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: THEME.ink, fontSize: 13 }}>{p.number}</span>
                  <span style={{ color: accent, fontSize: 14, fontWeight: 700 }}>${p.balance.toLocaleString()}</span>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}><button onClick={() => setPayOpen(false)} style={{ background: 'transparent', border: `1px solid ${THEME.border}`, color: THEME.ink2, borderRadius: 10, padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}>Close</button></div>
          </div>
        </div>
      )}

      {/* Unlock a door — site-manager action. Lists the site's Brivo doors. */}
      {unlockOpen && (
        <div onClick={() => setUnlockOpen(false)} style={{ ...font, position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(4,10,20,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 'min(440px, 96vw)', background: THEME.panel, border: `1px solid ${THEME.border}`, borderRadius: 14, padding: 18 }}>
            <div style={{ color: THEME.ink, fontSize: 15, fontWeight: 600 }}>Unlock a door</div>
            <div style={{ color: THEME.ink2, fontSize: 12, marginBottom: 12 }}>Momentarily releases the door. This is recorded in the activity log.</div>
            {doors.length === 0 ? (
              <div style={{ fontSize: 12.5, color: THEME.ink2, padding: '8px 0' }}>No doors are available on this site.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {doors.map(d => (
                  <button key={d.id} onClick={() => doUnlock(d.id, d.name)} disabled={busyDoor === d.id} style={{ ...tile, padding: 12, textAlign: 'left', cursor: busyDoor === d.id ? 'default' : 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: busyDoor && busyDoor !== d.id ? 0.5 : 1 }}>
                    <span style={{ color: THEME.ink, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 8 }}><LockOpen size={15} style={{ color: accent }} /> {d.name}</span>
                    <span style={{ color: accent, fontSize: 12, fontWeight: 600 }}>{busyDoor === d.id ? 'Unlocking…' : 'Unlock'}</span>
                  </button>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}><button onClick={() => setUnlockOpen(false)} style={{ background: 'transparent', border: `1px solid ${THEME.border}`, color: THEME.ink2, borderRadius: 10, padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}>Close</button></div>
          </div>
        </div>
      )}

      {/* Issue a pass — site-manager action. Creates a Brivo guest + emails a Mobile Pass. */}
      {passOpen && (
        <div onClick={() => setPassOpen(false)} style={{ ...font, position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(4,10,20,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 'min(440px, 96vw)', background: THEME.panel, border: `1px solid ${THEME.border}`, borderRadius: 14, padding: 18 }}>
            <div style={{ color: THEME.ink, fontSize: 15, fontWeight: 600 }}>Issue a visitor pass</div>
            <div style={{ color: THEME.ink2, fontSize: 12, marginBottom: 12 }}>Emails a mobile pass to your visitor, vendor, or delivery.</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input value={pass.firstName} onChange={e => setPass(p => ({ ...p, firstName: e.target.value }))} placeholder="First name" style={{ flex: 1, background: THEME.well, border: `1px solid ${THEME.border}`, borderRadius: 10, padding: '10px 12px', color: THEME.ink, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              <input value={pass.lastName} onChange={e => setPass(p => ({ ...p, lastName: e.target.value }))} placeholder="Last name" style={{ flex: 1, background: THEME.well, border: `1px solid ${THEME.border}`, borderRadius: 10, padding: '10px 12px', color: THEME.ink, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <input value={pass.email} onChange={e => setPass(p => ({ ...p, email: e.target.value }))} placeholder="Visitor email" type="email" style={{ width: '100%', background: THEME.well, border: `1px solid ${THEME.border}`, borderRadius: 10, padding: '10px 12px', color: THEME.ink, fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 8 }} />
            <label style={{ display: 'block', fontSize: 11, color: THEME.label, marginBottom: 4 }}>Valid until (optional)</label>
            <input value={pass.to} onChange={e => setPass(p => ({ ...p, to: e.target.value }))} type="date" style={{ width: '100%', background: THEME.well, border: `1px solid ${THEME.border}`, borderRadius: 10, padding: '10px 12px', color: THEME.ink, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            {pass.err && <div style={{ color: THEME.alarm, fontSize: 12, marginTop: 8 }}>{pass.err}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
              <button onClick={() => setPassOpen(false)} style={{ background: 'transparent', border: `1px solid ${THEME.border}`, color: THEME.ink2, borderRadius: 10, padding: '9px 14px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button onClick={submitPass} disabled={pass.busy || !pass.firstName.trim() || !pass.lastName.trim() || !pass.email.trim()} style={{ background: accent, border: 'none', color: THEME.bg, borderRadius: 10, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: pass.busy || !pass.firstName.trim() || !pass.lastName.trim() || !pass.email.trim() ? 0.5 : 1 }}>{pass.busy ? 'Sending…' : 'Send pass'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Action toast */}
      {toast && (
        <div style={{ ...font, position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 95, background: THEME.panel, border: `1px solid ${toast.kind === 'ok' ? 'rgba(126,224,168,0.4)' : 'rgba(248,113,113,0.4)'}`, color: toast.kind === 'ok' ? THEME.ok : THEME.alarm, borderRadius: 999, padding: '10px 18px', fontSize: 13, fontWeight: 600, boxShadow: '0 10px 30px -10px rgba(0,0,0,0.8)' }}>{toast.msg}</div>
      )}
    </div>
  )
}

// Live preview — mirrors the internal Systems `LiveCam` exactly, which reliably
// streams every camera: fetch→blob→objectURL on a steady interval, all tiles
// refreshing independently (no global limiter — Eagle Eye is fine with the whole
// grid polling at once; the Systems page proves it). An `inFlight` guard prevents
// a tile from overlapping its own fetch; the last good frame stays until the next
// one lands. Indoor cameras emit preview frames slowly, so we just keep retrying.
function PortalCamImg({ slug, cameraId, alt, intervalMs = 5000 }: { slug: string; cameraId: string; alt: string; intervalMs?: number }) {
  const [url, setUrl] = useState<string | null>(null)
  const urlRef = useRef<string | null>(null)
  const mounted = useRef(true)
  const inFlight = useRef(false)

  useEffect(() => {
    mounted.current = true
    const endpoint = `/api/portal/${slug}/camera-preview?camera_id=${encodeURIComponent(cameraId)}`
    const load = async () => {
      if (inFlight.current || !mounted.current) return
      inFlight.current = true
      try {
        const r = await fetch(`${endpoint}&t=${Date.now()}`, { cache: 'no-store' })
        if (r.ok) {
          const blob = await r.blob()
          if (mounted.current && blob.size > 0) {
            const next = URL.createObjectURL(blob)
            const prev = urlRef.current
            urlRef.current = next
            setUrl(next)
            if (prev) setTimeout(() => URL.revokeObjectURL(prev), 1000)
          }
        }
      } catch { /* keep last good frame */ }
      finally { inFlight.current = false }
    }
    load()
    const timer = setInterval(load, intervalMs)
    return () => {
      mounted.current = false
      clearInterval(timer)
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    }
  }, [slug, cameraId, intervalMs])

  if (!url) {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#46617a' }}>
        <Camera size={26} /><span style={{ fontSize: 10, color: THEME.label }}>Connecting…</span>
      </div>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} src={url} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
  )
}

// ── Access manager — the Ticket tab. Mirrors the internal Systems "Site users"
// surface (look up, edit, issue/revoke pass, suspend/reactivate, add user, guest
// pass) but in a larger two-pane interface. All calls PIN-gated server-side.
type BrivoU = { id: string; firstName: string; lastName: string; email: string | null; phone: string | null; unitNumber: string | null; active: boolean; groupIds?: string[]; groupNames?: string[] }
type BrivoCred = { id: string; label: string; type: string; isPass: boolean; active: boolean; effectiveFrom: string | null; effectiveTo: string | null }

function AccessManager({ slug, accent, onUnlock, onGuest }: { slug: string; accent: string; onUnlock: () => void; onGuest: () => void }) {
  const font = { fontFamily: "'DM Sans', var(--font-dm-sans, system-ui), sans-serif" } as const
  const tileS = { background: THEME.panel, border: `1px solid ${THEME.border}`, borderRadius: 12 } as const
  const inp: React.CSSProperties = { background: THEME.well, border: `1px solid ${THEME.border}`, borderRadius: 9, padding: '9px 11px', color: THEME.ink, fontSize: 13, outline: 'none', boxSizing: 'border-box', width: '100%' }

  const [users, setUsers] = useState<BrivoU[]>([])
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [selId, setSelId] = useState<string | null>(null)
  const [creds, setCreds] = useState<BrivoCred[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [edit, setEdit] = useState({ firstName: '', lastName: '', email: '', phone: '' })
  const [addOpen, setAddOpen] = useState(false)
  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(null), 3500); return () => clearTimeout(t) }, [notice])

  const load = () => {
    setLoading(true); setErr(null)
    fetch(`/api/portal/${slug}/users?groups=1`, { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { setUsers(Array.isArray(j.users) ? j.users : []); setGroups(Array.isArray(j.groups) ? j.groups : []); if (j.error) setErr(j.error) })
      .catch(() => setErr('Could not load users.'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [slug])

  const sel = users.find(u => u.id === selId) || null
  function selectUser(u: BrivoU) {
    setSelId(u.id); setEdit({ firstName: u.firstName, lastName: u.lastName, email: u.email || '', phone: u.phone || '' })
    setCreds([]); setDetailLoading(true)
    fetch(`/api/portal/${slug}/users/${u.id}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (j.credentials) setCreds(j.credentials); if (j.user) setEdit(e => ({ ...e, email: j.user.email ?? e.email, phone: j.user.phone ?? e.phone })) })
      .catch(() => {})
      .finally(() => setDetailLoading(false))
  }

  async function patch(id: string, bodyObj: Record<string, unknown>, okMsg: string, busyKey: string) {
    setBusy(busyKey); setErr(null)
    try {
      const r = await fetch(`/api/portal/${slug}/users/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bodyObj) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(j.error || 'Action failed.'); return false }
      setNotice(okMsg)
      return true
    } catch { setErr('Action failed.'); return false }
    finally { setBusy(null) }
  }

  const filtered = q.trim()
    ? users.filter(u => `${u.firstName} ${u.lastName} ${u.email ?? ''} ${u.unitNumber ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()))
    : users

  return (
    <div style={{ ...font }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase', color: THEME.label, display: 'flex', alignItems: 'center', gap: 6 }}><Users size={14} /> Access · site users {users.length ? `· ${users.length}` : ''}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setAddOpen(true)} style={{ background: accent, border: 'none', color: THEME.bg, borderRadius: 9, padding: '8px 13px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}><UserPlus size={14} /> Add user</button>
          <button onClick={onGuest} style={{ ...tileS, color: THEME.ink, padding: '8px 13px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Ticket size={14} style={{ color: THEME.ok }} /> Guest pass</button>
          <button onClick={onUnlock} style={{ ...tileS, color: THEME.ink, padding: '8px 13px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}><LockOpen size={14} style={{ color: accent }} /> Unlock door</button>
        </div>
      </div>

      {err && <div style={{ marginBottom: 10, borderRadius: 10, padding: '9px 12px', fontSize: 12, background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.35)', color: THEME.alarm }}>{err}</div>}
      {notice && <div style={{ marginBottom: 10, borderRadius: 10, padding: '9px 12px', fontSize: 12, background: 'rgba(126,224,168,0.12)', border: '1px solid rgba(126,224,168,0.35)', color: THEME.ok }}>{notice}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: sel ? 'minmax(280px, 1fr) minmax(300px, 1fr)' : '1fr', gap: 12 }}>
        {/* Directory */}
        <div>
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: THEME.label }} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name, email, or unit…" style={{ ...inp, paddingLeft: 32 }} />
          </div>
          {loading ? (
            <div style={{ ...tileS, padding: 16, fontSize: 12.5, color: THEME.ink2 }}>Loading users…</div>
          ) : filtered.length === 0 ? (
            <div style={{ ...tileS, padding: 16, fontSize: 12.5, color: THEME.ink2 }}>{q ? 'No users match your search.' : 'No users at this site yet.'}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 460, overflowY: 'auto' }}>
              {filtered.map(u => (
                <button key={u.id} onClick={() => selectUser(u)} style={{ ...tileS, border: selId === u.id ? `1px solid ${accent}` : `1px solid ${THEME.border}`, padding: '10px 12px', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: THEME.ink }}>{`${u.firstName} ${u.lastName}`.trim() || 'Unnamed'}</span>
                      <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', borderRadius: 999, padding: '2px 7px', ...(u.active ? { background: 'rgba(126,224,168,0.14)', color: THEME.ok, border: '1px solid rgba(126,224,168,0.35)' } : { background: 'rgba(248,113,113,0.14)', color: THEME.alarm, border: '1px solid rgba(248,113,113,0.35)' }) }}>{u.active ? 'Active' : 'Suspended'}</span>
                    </div>
                    <div style={{ marginTop: 2, fontSize: 11, color: THEME.ink2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[u.unitNumber ? `Unit ${u.unitNumber}` : null, u.email, u.phone].filter(Boolean).join(' · ') || 'No contact info'}</div>
                  </div>
                  <span style={{ fontSize: 11, color: accent, flexShrink: 0 }}>Manage →</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail / edit */}
        {sel && (
          <div style={{ ...tileS, padding: 16, alignSelf: 'start' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: THEME.ink }}>{`${sel.firstName} ${sel.lastName}`.trim() || 'Unnamed'}</div>
              <button onClick={() => setSelId(null)} style={{ background: 'transparent', border: 'none', color: THEME.ink2, cursor: 'pointer' }}><X size={16} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <input value={edit.firstName} onChange={e => setEdit(x => ({ ...x, firstName: e.target.value }))} placeholder="First name" style={inp} />
              <input value={edit.lastName} onChange={e => setEdit(x => ({ ...x, lastName: e.target.value }))} placeholder="Last name" style={inp} />
            </div>
            <div style={{ position: 'relative', marginBottom: 8 }}><Mail size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: THEME.label }} /><input value={edit.email} onChange={e => setEdit(x => ({ ...x, email: e.target.value }))} placeholder="Email" style={{ ...inp, paddingLeft: 32 }} /></div>
            <div style={{ position: 'relative', marginBottom: 10 }}><Phone size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: THEME.label }} /><input value={edit.phone} onChange={e => setEdit(x => ({ ...x, phone: e.target.value }))} placeholder="Phone" style={{ ...inp, paddingLeft: 32 }} /></div>
            <button disabled={busy === 'save'} onClick={() => patch(sel.id, { action: 'update', ...edit }, 'Saved.', 'save').then(ok => ok && load())} style={{ width: '100%', background: accent, border: 'none', color: THEME.bg, borderRadius: 9, padding: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: busy === 'save' ? 0.6 : 1 }}>{busy === 'save' ? 'Saving…' : 'Save changes'}</button>

            {/* Credentials */}
            <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: THEME.label, margin: '14px 0 6px' }}>Credentials</div>
            {detailLoading ? (
              <div style={{ fontSize: 12, color: THEME.ink2 }}>Loading…</div>
            ) : creds.length === 0 ? (
              <div style={{ fontSize: 12, color: THEME.ink2 }}>No active credentials.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {creds.map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: THEME.well, borderRadius: 8, padding: '7px 10px', fontSize: 12 }}>
                    <span style={{ color: THEME.ink, display: 'inline-flex', alignItems: 'center', gap: 6 }}>{c.isPass ? <Ticket size={13} style={{ color: THEME.ok }} /> : <ShieldCheck size={13} style={{ color: THEME.label }} />}{c.label}</span>
                    <span style={{ color: c.active ? THEME.ok : THEME.ink2, fontSize: 10.5 }}>{c.active ? 'Active' : 'Off'}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              <button disabled={busy === 'pass'} onClick={() => patch(sel.id, { action: 'issue_pass', email: edit.email || sel.email }, 'Mobile pass sent.', 'pass').then(ok => ok && selectUser(sel))} style={{ ...tileS, color: THEME.ink, padding: '8px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', flex: '1 1 auto' }}>{busy === 'pass' ? '…' : 'Issue mobile pass'}</button>
              <button disabled={busy === 'revoke'} onClick={() => patch(sel.id, { action: 'revoke_pass' }, 'Pass revoked.', 'revoke').then(ok => ok && selectUser(sel))} style={{ ...tileS, color: THEME.ink2, padding: '8px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{busy === 'revoke' ? '…' : 'Revoke pass'}</button>
              <button disabled={busy === 'susp'} onClick={() => patch(sel.id, { action: sel.active ? 'suspend' : 'reactivate' }, sel.active ? 'User suspended.' : 'User reactivated.', 'susp').then(ok => ok && load())} style={{ ...tileS, padding: '8px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: sel.active ? THEME.alarm : THEME.ok, border: `1px solid ${sel.active ? 'rgba(248,113,113,0.35)' : 'rgba(126,224,168,0.35)'}` }}>{busy === 'susp' ? '…' : sel.active ? 'Suspend' : 'Reactivate'}</button>
            </div>
          </div>
        )}
      </div>

      {addOpen && (
        <AddUserModal slug={slug} accent={accent} groups={groups} onClose={() => setAddOpen(false)} onAdded={() => { setAddOpen(false); setNotice('User added.'); load() }} />
      )}
    </div>
  )
}

function AddUserModal({ slug, accent, groups, onClose, onAdded }: { slug: string; accent: string; groups: { id: string; name: string }[]; onClose: () => void; onAdded: () => void }) {
  const font = { fontFamily: "'DM Sans', var(--font-dm-sans, system-ui), sans-serif" } as const
  const inp: React.CSSProperties = { background: THEME.well, border: `1px solid ${THEME.border}`, borderRadius: 9, padding: '9px 11px', color: THEME.ink, fontSize: 13, outline: 'none', boxSizing: 'border-box', width: '100%' }
  const [f, setF] = useState({ firstName: '', lastName: '', email: '', phone: '', unit: '', groupId: '', mobilePass: false, fobCardNumber: '', pin: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  async function submit() {
    setBusy(true); setErr(null)
    try {
      const r = await fetch(`/api/portal/${slug}/users`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(j.error || 'Could not add user.'); return }
      // Surface any credential that failed even though the user was created.
      const failed = Object.entries((j.credentials ?? {}) as Record<string, string>).filter(([, v]) => v.startsWith('failed'))
      if (failed.length) { setErr(`User created, but: ${failed.map(([k, v]) => `${k} ${v}`).join('; ')}`); setBusy(false); return }
      onAdded()
    } catch { setErr('Could not add user.') } finally { setBusy(false) }
  }
  const lbl: React.CSSProperties = { fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: THEME.label, marginBottom: 4 }
  return (
    <div onClick={onClose} style={{ ...font, position: 'fixed', inset: 0, zIndex: 94, background: 'rgba(4,10,20,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(460px, 96vw)', background: THEME.panel, border: `1px solid ${THEME.border}`, borderRadius: 14, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ color: THEME.ink, fontSize: 15, fontWeight: 700 }}>Add user</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: THEME.ink2, cursor: 'pointer' }}><X size={16} /></button>
        </div>
        {err && <div style={{ marginBottom: 10, borderRadius: 10, padding: '9px 12px', fontSize: 12, background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.35)', color: THEME.alarm }}>{err}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <input value={f.firstName} onChange={e => setF(x => ({ ...x, firstName: e.target.value }))} placeholder="First name" style={inp} />
          <input value={f.lastName} onChange={e => setF(x => ({ ...x, lastName: e.target.value }))} placeholder="Last name" style={inp} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <input value={f.email} onChange={e => setF(x => ({ ...x, email: e.target.value }))} type="email" placeholder="Email" style={inp} />
          <input value={f.phone} onChange={e => setF(x => ({ ...x, phone: e.target.value }))} type="tel" placeholder="Phone" style={inp} />
        </div>
        <input value={f.unit} onChange={e => setF(x => ({ ...x, unit: e.target.value }))} placeholder="Unit (optional)" style={{ ...inp, marginBottom: 8 }} />
        {groups.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div style={lbl}>Access group (grants entry)</div>
            <select value={f.groupId} onChange={e => setF(x => ({ ...x, groupId: e.target.value }))} style={{ ...inp }}>
              <option value="" style={{ background: '#0b1424' }}>No group yet</option>
              {groups.map(g => <option key={g.id} value={g.id} style={{ background: '#0b1424' }}>{g.name}</option>)}
            </select>
          </div>
        )}

        {/* Credentials — issued on creation. All optional. */}
        <div style={{ borderTop: `1px solid ${THEME.border}`, paddingTop: 10, marginBottom: 4 }}>
          <div style={lbl}>Credentials (optional)</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: THEME.ink, cursor: 'pointer', marginBottom: 8 }}>
            <input type="checkbox" checked={f.mobilePass} onChange={e => setF(x => ({ ...x, mobilePass: e.target.checked }))} style={{ accentColor: accent, width: 16, height: 16 }} />
            <Ticket size={15} style={{ color: THEME.ok }} /> Email a mobile pass {f.mobilePass && !f.email.trim() && <span style={{ color: THEME.warn, fontSize: 11 }}>(needs email)</span>}
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input value={f.fobCardNumber} onChange={e => setF(x => ({ ...x, fobCardNumber: e.target.value }))} placeholder="Fob / card number" style={inp} />
            <input value={f.pin} onChange={e => setF(x => ({ ...x, pin: e.target.value }))} placeholder="Keypad PIN" inputMode="numeric" style={inp} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
          <button onClick={onClose} style={{ background: 'transparent', border: `1px solid ${THEME.border}`, color: THEME.ink2, borderRadius: 10, padding: '9px 14px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button disabled={busy || !f.firstName.trim() || !f.lastName.trim()} onClick={submit} style={{ background: accent, border: 'none', color: THEME.bg, borderRadius: 10, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: busy || !f.firstName.trim() || !f.lastName.trim() ? 0.5 : 1 }}>{busy ? 'Adding…' : 'Add user'}</button>
        </div>
      </div>
    </div>
  )
}

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

function fmtClock(iso: string) {
  try { return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' }) } catch { return iso }
}

const DEMO_ACTIVITY: PortalActivity[] = [
  { id: '1', label: 'Visitor let in — M. Chen', where: 'Front gate', time: '2:14 PM' },
  { id: '2', label: 'Package delivered', where: 'Lobby', time: '11:02 AM' },
  { id: '3', label: 'Gate opened — you', where: 'Front gate', time: '9:41 AM' },
]
