'use client'

/**
 * OpsShell — elevated chrome for the property-manager ops portal.
 * Lifted graded-navy canvas + ambient depth glow, glass app bar, a left icon
 * nav rail, the signature GateGuard brand gradient, and the personal-PIN manager
 * sign-in. Shares the signed-in manager via context so control surfaces (gate
 * open, lockdown, pay) can require it.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires
const { LayoutDashboard, Activity, Video, DoorOpen, Users, Home, LogOut, X, KeyRound, Settings } = require('lucide-react') as any

export const C = {
  canvas: '#0e1521', nav: '#0b111b', surface: '#131b29', panel: '#111826',
  card: '#161f2e', well: '#0b111c', border: '#1e2a3c', border2: '#273548',
  ink: '#eef4fb', ink2: '#9fb0c4', ink3: '#6d7f94', cyan: '#00A3E0', blue: '#0072CE',
  safe: '#22C55E', warn: '#F59E0B', alert: '#EF4444',
}
// Signature brand gradient — the single thing that stops it reading as "Brivo cyan".
export const BRAND = 'linear-gradient(135deg,#19C8F5 0%,#4A8CFF 52%,#8A5CFF 100%)'

type Manager = { id: string; name: string; email: string | null }
type Ctx = { manager: Manager | null; slug: string; refresh: () => void; requireSignIn: () => void }
const OpsCtx = createContext<Ctx>({ manager: null, slug: '', refresh: () => {}, requireSignIn: () => {} })
export const useOpsManager = () => useContext(OpsCtx)

const NAV = [
  { key: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { key: 'activity', label: 'Activity', Icon: Activity },
  { key: 'video', label: 'Video', Icon: Video },
  { key: 'gates', label: 'Gates & Doors', Icon: DoorOpen },
  { key: 'residents', label: 'Residents', Icon: Users },
]

export function OpsShell({ slug, displayName, active, lockdown, children }: { slug: string; displayName: string; active: string; lockdown?: boolean; children: ReactNode }) {
  const router = useRouter()
  const [manager, setManager] = useState<Manager | null>(null)
  const [signInOpen, setSignInOpen] = useState(false)
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const refresh = () => { fetch(`/api/portal/${slug}/manager/me`).then(r => r.json()).then(j => setManager(j.manager ?? null)).catch(() => {}) }
  useEffect(() => { refresh() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [slug])

  async function signIn() {
    setBusy(true); setErr('')
    try {
      const r = await fetch(`/api/portal/${slug}/manager/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(j?.error || 'Sign-in failed.'); return }
      setPin(''); setSignInOpen(false); setManager({ id: 'me', name: j.name, email: null }); refresh(); router.refresh()
    } catch { setErr('Sign-in failed.') } finally { setBusy(false) }
  }
  async function signOut() {
    await fetch(`/api/portal/${slug}/manager/verify`, { method: 'DELETE' }).catch(() => {})
    setManager(null); router.refresh()
  }

  const navBtn = (href: string, label: string, Icon: any, on: boolean) => (
    <Link key={label} href={href} title={label} style={{ position: 'relative', width: 44, height: 42, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', color: on ? C.cyan : C.ink3, background: on ? 'rgba(0,163,224,0.12)' : 'transparent', textDecoration: 'none' }}>
      {on && <span style={{ position: 'absolute', left: -12, width: 3, height: 24, borderRadius: '0 3px 3px 0', background: C.cyan }} />}
      <Icon size={19} />
    </Link>
  )

  return (
    <OpsCtx.Provider value={{ manager, slug, refresh, requireSignIn: () => setSignInOpen(true) }}>
      <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#141d2e 0%,#0e1521 55%,#0b111b 100%)', color: C.ink, display: 'grid', gridTemplateColumns: '60px 1fr', position: 'relative', fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
        {/* ambient depth */}
        <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', background: 'radial-gradient(1100px 720px at 8% -8%, rgba(30,150,230,0.14), transparent 58%), radial-gradient(1100px 760px at 100% 112%, rgba(90,120,255,0.12), transparent 55%)' }} />
        {/* Nav rail */}
        <nav style={{ position: 'relative', zIndex: 1, background: C.nav, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '14px 0' }}>
          <Link href={`/portal/${slug}`} title="Home" style={{ width: 36, height: 36, borderRadius: 10, background: BRAND, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, color: '#041018', letterSpacing: '-0.5px', marginBottom: 12, boxShadow: '0 0 16px rgba(74,140,255,0.4)', textDecoration: 'none' }}>GG</Link>
          {NAV.map(n => navBtn(`/portal/${slug}/${n.key}`, n.label, n.Icon, active === n.key))}
          <div style={{ flex: 1 }} />
          {navBtn(`/portal/${slug}/settings`, 'Settings', Settings, active === 'settings')}
        </nav>

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 24px', borderBottom: `1px solid ${C.border}`, background: 'rgba(11,17,27,0.6)', backdropFilter: 'blur(10px)' }}>
            <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: '0.01em' }}>Gate<span style={{ color: C.cyan }}>Guard</span> <span style={{ color: C.ink3, fontWeight: 600 }}>· {displayName}</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 700, color: lockdown ? C.alert : C.safe, background: lockdown ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', border: `1px solid ${lockdown ? 'rgba(239,68,68,0.4)' : 'rgba(34,197,94,0.28)'}`, borderRadius: 999, padding: '7px 13px' }}><span style={{ width: 8, height: 8, borderRadius: 999, background: lockdown ? C.alert : C.safe, boxShadow: `0 0 8px ${lockdown ? C.alert : C.safe}` }} />{lockdown ? 'Lockdown active' : 'All secure'}</span>
              {manager ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, fontSize: 12.5, fontWeight: 700, color: C.ink, background: C.card, border: `1px solid ${C.border2}`, borderRadius: 9, padding: '6px 10px' }}>
                  <span style={{ width: 24, height: 24, borderRadius: 999, background: BRAND, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#041018', fontWeight: 800 }}>{(manager.name || 'M').split(' ').map(s => s[0]).slice(0, 2).join('')}</span>
                  {manager.name}
                  <button onClick={signOut} title="Sign out" style={{ background: 'transparent', border: 0, color: C.ink3, cursor: 'pointer', display: 'inline-flex' }}><LogOut size={14} /></button>
                </span>
              ) : (
                <button onClick={() => setSignInOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 700, color: '#041018', background: BRAND, border: 0, borderRadius: 9, padding: '9px 15px', cursor: 'pointer' }}><KeyRound size={14} /> Sign in to control</button>
              )}
            </div>
          </header>
          <main style={{ padding: '24px 28px', flex: 1, minWidth: 0 }}>{children}</main>
        </div>
      </div>

      {signInOpen && (
        <div onClick={() => setSignInOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(5,8,14,0.72)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 360, background: C.panel, border: `1px solid ${C.border2}`, borderRadius: 16, padding: 24, boxShadow: '0 30px 70px rgba(0,0,0,0.65)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontSize: 17, fontWeight: 800 }}>Sign in to control</div>
              <button onClick={() => setSignInOpen(false)} style={{ background: 'transparent', border: 0, color: C.ink3, cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ fontSize: 12.5, color: C.ink2, marginBottom: 14 }}>Enter your personal PIN so gate and lockdown commands are logged under your name.</div>
            <input type="password" inputMode="numeric" autoFocus value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && pin) signIn() }} placeholder="Personal PIN" style={{ width: '100%', padding: '13px', borderRadius: 10, background: C.well, border: `1px solid ${C.border2}`, color: C.ink, fontSize: 22, letterSpacing: '0.4em', textAlign: 'center', boxSizing: 'border-box' }} />
            {err && <div style={{ fontSize: 12, color: C.alert, marginTop: 8 }}>{err}</div>}
            <button onClick={signIn} disabled={busy || !pin} style={{ marginTop: 13, width: '100%', padding: '12px', borderRadius: 10, border: 0, fontWeight: 800, fontSize: 14, color: '#041018', background: BRAND, cursor: 'pointer', opacity: busy || !pin ? 0.5 : 1 }}>{busy ? 'Signing in…' : 'Sign in'}</button>
          </div>
        </div>
      )}
    </OpsCtx.Provider>
  )
}

export default OpsShell
