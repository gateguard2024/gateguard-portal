'use client'

/**
 * OpsShell — obsidian/cyan chrome for the property-manager ops portal: a left icon
 * nav rail (Dashboard / Gates / Residents), a top bar with the site name + security
 * badge + personal manager sign-in, and a personal-PIN modal. Shares the signed-in
 * manager via context so control surfaces (gate open, lockdown) can require it.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires
const { LayoutDashboard, DoorOpen, Users, Home, ShieldCheck, LogOut, X, KeyRound } = require('lucide-react') as any

export const C = {
  canvas: '#07090E', surface: '#0F131C', card: '#141A26', border: '#1E2638',
  ink: '#eef3fb', ink2: '#9fb1c6', cyan: '#00A3E0', blue: '#0072CE',
  safe: '#10B981', warn: '#F59E0B', alert: '#EF4444',
}

type Manager = { id: string; name: string; email: string | null }
type Ctx = { manager: Manager | null; slug: string; refresh: () => void; requireSignIn: () => void }
const OpsCtx = createContext<Ctx>({ manager: null, slug: '', refresh: () => {}, requireSignIn: () => {} })
export const useOpsManager = () => useContext(OpsCtx)

const NAV = [
  { key: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { key: 'gates', label: 'Gates', Icon: DoorOpen },
  { key: 'residents', label: 'Residents', Icon: Users },
]

export function OpsShell({ slug, displayName, active, children }: { slug: string; displayName: string; active: string; children: ReactNode }) {
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

  return (
    <OpsCtx.Provider value={{ manager, slug, refresh, requireSignIn: () => setSignInOpen(true) }}>
      <div style={{ minHeight: '100vh', background: C.canvas, color: C.ink, display: 'grid', gridTemplateColumns: '64px 1fr', fontFamily: "'DM Sans', var(--font-dm-sans, system-ui), sans-serif" }}>
        {/* Nav rail */}
        <nav style={{ background: C.surface, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '14px 0' }}>
          <Link href={`/portal/${slug}`} title="Resident home" style={{ width: 42, height: 42, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.ink2, border: '1px solid transparent' }}><Home size={19} /></Link>
          <div style={{ height: 8 }} />
          {NAV.map(n => {
            const on = active === n.key
            return (
              <Link key={n.key} href={`/portal/${slug}/${n.key}`} title={n.label} style={{ width: 42, height: 42, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', color: on ? C.cyan : C.ink2, background: on ? 'rgba(0,163,224,0.15)' : 'transparent', border: on ? '1px solid rgba(0,163,224,0.4)' : '1px solid transparent' }}><n.Icon size={19} /></Link>
            )
          })}
        </nav>

        {/* Content */}
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 22px', borderBottom: `1px solid ${C.border}`, background: `linear-gradient(180deg, rgba(0,163,224,0.06), transparent)` }}>
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.cyan }}>Operations</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.ink }}>{displayName}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: C.safe, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 999, padding: '5px 11px' }}><ShieldCheck size={13} /> All secure</span>
              {manager ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.ink2, background: C.card, border: `1px solid ${C.border}`, borderRadius: 999, padding: '5px 6px 5px 12px' }}>
                  <span>Signed in · <b style={{ color: C.ink }}>{manager.name}</b></span>
                  <button onClick={signOut} title="Sign out" style={{ display: 'inline-flex', width: 26, height: 26, borderRadius: 999, alignItems: 'center', justifyContent: 'center', background: 'transparent', border: `1px solid ${C.border}`, color: C.ink2, cursor: 'pointer' }}><LogOut size={13} /></button>
                </div>
              ) : (
                <button onClick={() => setSignInOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 700, color: '#04202e', background: C.cyan, border: 0, borderRadius: 999, padding: '7px 14px', cursor: 'pointer' }}><KeyRound size={14} /> Sign in to control</button>
              )}
            </div>
          </header>
          <main style={{ padding: '22px', flex: 1, minWidth: 0 }}>{children}</main>
        </div>
      </div>

      {/* Personal-PIN sign-in modal */}
      {signInOpen && (
        <div onClick={() => setSignInOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(3,6,10,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 360, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 22, boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.ink }}>Sign in to control</div>
              <button onClick={() => setSignInOpen(false)} style={{ background: 'transparent', border: 0, color: C.ink2, cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ fontSize: 12.5, color: C.ink2, marginBottom: 14 }}>Enter your personal PIN so gate and lockdown commands are logged under your name.</div>
            <input type="password" inputMode="numeric" autoFocus value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && pin) signIn() }} placeholder="Personal PIN" style={{ width: '100%', padding: '11px 12px', borderRadius: 10, background: C.card, border: `1px solid ${C.border}`, color: C.ink, fontSize: 15, letterSpacing: '0.3em', textAlign: 'center' }} />
            {err && <div style={{ fontSize: 12, color: C.alert, marginTop: 8 }}>{err}</div>}
            <button onClick={signIn} disabled={busy || !pin} style={{ marginTop: 14, width: '100%', padding: '11px', borderRadius: 10, border: 0, fontWeight: 800, fontSize: 13, color: '#04202e', background: C.cyan, cursor: 'pointer', opacity: busy || !pin ? 0.5 : 1 }}>{busy ? 'Signing in…' : 'Sign in'}</button>
          </div>
        </div>
      )}
    </OpsCtx.Provider>
  )
}

export default OpsShell
