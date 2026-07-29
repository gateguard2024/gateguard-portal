'use client'

// ─────────────────────────────────────────────────────────────────────────────
// CustomerPortalTemplate — the SINGLE SOURCE OF TRUTH for the customer portal
// DESIGN. Every property's portal renders through this one component, so changing
// THEME or the layout here updates EVERY site at once. Per-site differences come
// in only as `config` (branding, which modules, which cameras) + live `data` —
// never as design forks. Steel theme, DM Sans (inherited from the app font).
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Home, Video, Ticket, ListChecks, Users, CreditCard, Settings, LockOpen, History, LifeBuoy, ShieldCheck, Mic, Maximize2, Camera } = require('lucide-react') as any

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

const NAV: { key: string; module?: string; Icon: any }[] = [
  { key: 'home', Icon: Home },
  { key: 'cameras', module: 'cameras', Icon: Video },
  { key: 'passes', module: 'passes', Icon: Ticket },
  { key: 'activity', module: 'activity', Icon: ListChecks },
  { key: 'people', module: 'people', Icon: Users },
  { key: 'billing', module: 'billing', Icon: CreditCard },
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
  const [live, setLive] = useState<{ cameras?: PortalCamera[]; activity?: PortalActivity[]; balanceDue?: number | null }>({})
  useEffect(() => {
    if (!config.slug) return
    let cancelled = false
    fetch(`/api/portal/${config.slug}/summary`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (!cancelled && j) setLive({ cameras: j.cameras, activity: j.activity, balanceDue: j.balanceDue }) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [config.slug])

  const effCameras = live.cameras && live.cameras.length ? live.cameras : cameras
  const effActivity = live.activity && live.activity.length ? live.activity : activity
  const effBalance = live.balanceDue !== undefined ? live.balanceDue : balanceDue

  const cams = effCameras.slice(0, 4)
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
        {NAV.filter(n => !n.module || has(n.module)).map((n, i) => (
          <button key={n.key} aria-label={n.key} style={{ width: 40, height: 40, borderRadius: 10, border: i === 0 ? `1px solid rgba(95,184,224,0.4)` : 'none', background: i === 0 ? 'rgba(95,184,224,0.18)' : 'transparent', color: i === 0 ? accent : '#7f96ab', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><n.Icon size={19} /></button>
        ))}
        <button aria-label="settings" style={{ marginTop: 'auto', width: 40, height: 40, borderRadius: 10, border: 'none', background: 'transparent', color: '#7f96ab', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Settings size={19} /></button>
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

        <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 14 }}>
          <div>
            {(has('cameras') || has('gate')) && (
              <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', border: `1px solid ${THEME.border}`, boxShadow: 'inset 0 1px 0 rgba(190,215,240,0.06)', background: `radial-gradient(120% 90% at 50% 8%, rgba(95,184,224,0.10), transparent 55%), radial-gradient(circle at 50% 42%, #1b2c3e, #0a121d)`, aspectRatio: '16 / 9', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Camera size={32} style={{ color: '#46617a' }} />
                <span style={{ fontSize: 11, color: THEME.label, letterSpacing: '0.04em' }}>Live view</span>
                <span style={{ position: 'absolute', top: 10, left: 12, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 600, color: '#fff', background: 'rgba(0,0,0,0.5)', borderRadius: 6, padding: '3px 8px' }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: THEME.alarm }} />LIVE · {primaryCam?.name ?? 'Front gate'}</span>
                {has('gate') && <button onClick={onOpenGate} style={{ position: 'absolute', bottom: 12, left: 12, background: accent, border: 'none', color: THEME.bg, borderRadius: 10, padding: '11px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer', ...font, display: 'inline-flex', alignItems: 'center', gap: 6 }}><LockOpen size={16} /> Open gate</button>}
                <div style={{ position: 'absolute', bottom: 12, right: 12, display: 'flex', gap: 6 }}>
                  <button aria-label="talk" style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.18)', color: '#fff', borderRadius: 9, padding: '8px 11px', cursor: 'pointer' }}><Mic size={14} /></button>
                  <button aria-label="fullscreen" style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.18)', color: '#fff', borderRadius: 9, padding: '8px 11px', cursor: 'pointer' }}><Maximize2 size={14} /></button>
                </div>
              </div>
            )}

            {has('cameras') && cams.length > 0 && (
              <>
                <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                  {cams.map((c, i) => (
                    <button key={c.id} onClick={() => setActiveCam(i)} style={{ flex: 1, aspectRatio: '16 / 10', borderRadius: 8, background: THEME.well, border: i === activeCam ? `2px solid ${accent}` : `1px solid rgba(140,170,200,0.2)`, position: 'relative', cursor: 'pointer' }}>
                      <span style={{ position: 'absolute', bottom: 3, left: 5, fontSize: 8, color: THEME.ink2 }}>{c.name}</span>
                    </button>
                  ))}
                </div>
                <button onClick={onRewind} style={{ width: '100%', marginTop: 8, background: THEME.tile, border: `1px solid ${THEME.border}`, color: THEME.label, borderRadius: 9, padding: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer', ...font, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><History size={14} /> Rewind — review the last 30 days</button>
              </>
            )}

            {has('passes') && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
                <button onClick={onIssuePass} style={{ ...tile, padding: 14, textAlign: 'left', cursor: 'pointer', ...font }}><Ticket size={20} style={{ color: THEME.ok }} /><div style={{ fontSize: 14, fontWeight: 600, marginTop: 6 }}>Issue a pass</div><div style={{ fontSize: 11, color: THEME.ink2 }}>Visitor, vendor, or delivery</div></button>
                <button onClick={onUnlock} style={{ ...tile, padding: 14, textAlign: 'left', cursor: 'pointer', ...font }}><LockOpen size={20} style={{ color: accent }} /><div style={{ fontSize: 14, fontWeight: 600, marginTop: 6 }}>Unlock a door</div><div style={{ fontSize: 11, color: THEME.ink2 }}>Any entry, unit, or amenity</div></button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {has('activity') && (
              <div style={{ ...tile, padding: 14 }}>
                <div style={eyebrow}><ListChecks size={14} style={{ color: THEME.label }} /> Live activity</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {(effActivity.length ? effActivity : DEMO_ACTIVITY).slice(0, 4).map(a => (
                    <div key={a.id} style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
                      <div style={{ width: 34, height: 26, borderRadius: 6, background: THEME.well, border: `1px solid rgba(140,170,200,0.2)`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3a4f63' }}><Camera size={12} /></div>
                      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 11.5 }}>{a.label}</div><div style={{ fontSize: 10, color: THEME.label }}>{a.where} · {a.time}</div></div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {has('billing') && (
              <div style={{ ...tile, padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10.5, color: THEME.label, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Balance due</div>
                  <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.1 }}>{effBalance != null ? `$${effBalance.toLocaleString()}` : '$0'}</div>
                </div>
                <button onClick={onPay} style={{ background: accent, border: 'none', color: THEME.bg, borderRadius: 9, padding: '10px 15px', fontSize: 13, fontWeight: 700, cursor: 'pointer', ...font }}>Pay</button>
              </div>
            )}

            {has('service') && (
              <button onClick={onRequestService} style={{ ...tile, border: `1px solid rgba(95,184,224,0.35)`, padding: 13, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, ...font }}>
                <LifeBuoy size={20} style={{ color: THEME.label }} />
                <div><div style={{ fontSize: 13, fontWeight: 600 }}>Request service</div><div style={{ fontSize: 11, color: THEME.ink2 }}>Report a broken gate, camera, or lock</div></div>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

const DEMO_ACTIVITY: PortalActivity[] = [
  { id: '1', label: 'Visitor let in — M. Chen', where: 'Front gate', time: '2:14 PM' },
  { id: '2', label: 'Package delivered', where: 'Lobby', time: '11:02 AM' },
  { id: '3', label: 'Gate opened — you', where: 'Front gate', time: '9:41 AM' },
]
