'use client'

/**
 * OpsShell — chrome for the Nexus Property portal (property managers / owners).
 * Matches the design canvas "Property Portal" page (Part 2, step 2): light
 * Apple-grade surfaces, a labeled left sidebar with every product tab, a phone
 * bottom tab bar (Home · Vision · Access · Packages · More), and the personal-PIN
 * manager sign-in. Shares the signed-in manager via context so control surfaces
 * (gate open, lockdown, pay) can require it.
 *
 * `C` is the palette every ops page reads, so retoning it here retones all pages.
 * Page bodies get their own pass in step 3 (moving today's features into tabs).
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

// Light Apple-grade tokens (docs/DESIGN_LANGUAGE.md, light theme). Key names kept
// from the old dark palette so existing pages keep compiling unchanged.
export const C = {
  canvas: '#F5F5F7', nav: '#FBFBFD', surface: '#FFFFFF', panel: '#FFFFFF',
  card: '#FFFFFF', well: '#F5F5F7', border: 'rgba(0,0,0,0.08)', border2: 'rgba(0,0,0,0.12)',
  ink: '#1D1D1F', ink2: '#3A3A3C', ink3: '#6E6E73', cyan: '#0071E3', blue: '#0071E3',
  safe: '#1F8A3B', warn: '#B25000', alert: '#D70015',
}
// The one accent. Kept as `BRAND` because pages import it; no more gradient.
export const BRAND = '#0071E3'
const DOT = { safe: '#34C759', alert: '#FF3B30', warn: '#FF9500' }
const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, system-ui, sans-serif'

type Manager = { id: string; name: string; email: string | null }
type Ctx = { manager: Manager | null; slug: string; refresh: () => void; requireSignIn: () => void }
const OpsCtx = createContext<Ctx>({ manager: null, slug: '', refresh: () => {}, requireSignIn: () => {} })
export const useOpsManager = () => useContext(OpsCtx)

// Icons drawn from the design canvas (stroke, currentColor).
const P: Record<string, ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  vision: <><path d="M3 7h11a2 2 0 012 2v6a2 2 0 01-2 2H3z" /><path d="M16 11l5-3v8l-5-3" /></>,
  access: <><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M17 6l3 3" /></>,
  packages: <><path d="M3 7l9-4 9 4v10l-9 4-9-4z" /><path d="M3 7l9 4 9-4M12 11v10" /></>,
  units: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 018 0v3" /></>,
  residents: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5M16 4.5a3.5 3.5 0 010 7M18 14.8c1.8.8 3 2.6 3.5 5.2" /></>,
  movein: <path d="M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1z" />,
  service: <path d="M14.7 6.3a4 4 0 00-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 005.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z" />,
  billing: <><rect x="2.5" y="5" width="19" height="14" rx="2" /><path d="M2.5 10h19M6 15h4" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1" /></>,
  more: <><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></>,
}
const Icon = ({ k, size = 18 }: { k: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}>{P[k]}</svg>
)

// Tab order and names follow the canvas. `path` is today's route for that tab;
// tabs without a built page land on app/portal/[slug]/[section] (placeholder).
export const PM_TABS = [
  { key: 'dashboard', label: 'Dashboard', path: 'dashboard' },
  { key: 'vision', label: 'Vision', path: 'video' },
  { key: 'access', label: 'Access', path: 'gates' },
  { key: 'packages', label: 'Packages', path: 'packages' },
  { key: 'units', label: 'Units', path: 'units' },
  { key: 'residents', label: 'Residents', path: 'residents' },
  { key: 'movein', label: 'Move-in & Renewals', path: 'movein' },
  { key: 'service', label: 'Service', path: 'service' },
  { key: 'billing', label: 'Billing', path: 'billing' },
  { key: 'settings', label: 'Settings', path: 'settings' },
] as const
const MOBILE_TABS = ['dashboard', 'vision', 'access', 'packages']
// Older pages pass their route name as `active`; map it to the tab it now lives in.
const ACTIVE_ALIAS: Record<string, string> = { video: 'vision', gates: 'access', activity: 'access' }
// Access holds two of today's pages until step 3 merges them.
const ACCESS_SUB = [{ key: 'gates', label: 'Gates & doors' }, { key: 'activity', label: 'Access log' }]

const CSS = `
.ops-app{display:flex;min-height:100vh}
.ops-side{width:240px;flex:none;position:sticky;top:0;height:100vh;overflow-y:auto;box-sizing:border-box;background:${C.nav};border-right:1px solid ${C.border};padding:18px 12px;display:flex;flex-direction:column;gap:2px}
.ops-nav{display:flex;align-items:center;gap:10px;min-height:44px;padding:0 12px;border-radius:8px;color:${C.ink};font-size:14px;text-decoration:none;box-sizing:border-box}
.ops-nav:hover{background:rgba(0,0,0,.04);color:${C.ink}}
.ops-nav.on{background:${C.blue};color:#fff;font-weight:600}
.ops-main{flex:1;min-width:0;padding:28px 36px 48px;box-sizing:border-box}
.ops-sub{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:20px;padding:3px;border-radius:10px;background:rgba(0,0,0,.05);width:max-content;max-width:100%}
.ops-sub a{min-height:36px;display:inline-flex;align-items:center;padding:0 14px;border-radius:8px;font-size:13px;font-weight:500;color:${C.ink2};text-decoration:none}
.ops-sub a.on{background:#fff;color:${C.ink};font-weight:600;box-shadow:0 1px 2px rgba(0,0,0,.08)}
.ops-top,.ops-tabbar{display:none}
.ops-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:0 16px;border-radius:10px;border:1px solid ${C.border2};background:#fff;color:${C.ink};font:600 14px ${FONT};cursor:pointer;box-sizing:border-box}
.ops-btn.pri{background:${C.blue};border-color:${C.blue};color:#fff}
@media (max-width:899px){
  .ops-side{display:none}
  .ops-top{display:flex;align-items:center;justify-content:space-between;gap:10px;position:sticky;top:0;z-index:20;padding:10px 16px;background:rgba(251,251,253,.92);backdrop-filter:saturate(180%) blur(12px);border-bottom:1px solid ${C.border}}
  .ops-main{padding:18px 16px calc(84px + env(safe-area-inset-bottom))}
  .ops-tabbar{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:30;background:rgba(251,251,253,.94);backdrop-filter:saturate(180%) blur(12px);border-top:1px solid ${C.border};padding:4px 4px calc(4px + env(safe-area-inset-bottom))}
  .ops-tabbar a,.ops-tabbar button{flex:1;min-height:52px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;font:500 11px ${FONT};color:${C.ink3};text-decoration:none;background:none;border:0;cursor:pointer}
  .ops-tabbar .on{color:${C.blue}}
}
`

export function OpsShell({ slug, displayName, active, lockdown, children }: { slug: string; displayName: string; active: string; lockdown?: boolean; children: ReactNode }) {
  const router = useRouter()
  const [manager, setManager] = useState<Manager | null>(null)
  const [signInOpen, setSignInOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
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

  const tab = ACTIVE_ALIAS[active] ?? active
  const href = (path: string) => `/portal/${slug}/${path}`
  const status = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.ink2 }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: lockdown ? DOT.alert : DOT.safe, flex: 'none' }} />
      {lockdown ? 'Lockdown active' : 'All secure'}
    </span>
  )
  const mark = (
    <span style={{ width: 26, height: 26, borderRadius: 7, background: C.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" aria-hidden="true"><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z" /></svg>
    </span>
  )

  return (
    <OpsCtx.Provider value={{ manager, slug, refresh, requireSignIn: () => setSignInOpen(true) }}>
      {/* Raw so server and client emit identical text (quotes in FONT break hydration otherwise). */}
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="ops-app" style={{ background: C.canvas, color: C.ink, fontFamily: FONT, fontSize: 14, lineHeight: 1.45, letterSpacing: '-0.01em' }}>
        <nav className="ops-side" aria-label="Property portal">
          <Link href={href('dashboard')} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 10px 16px', fontWeight: 600, fontSize: 15, color: C.ink, textDecoration: 'none' }}>
            {mark}Nexus <span style={{ fontWeight: 400, color: C.ink3 }}>Property</span>
          </Link>
          {/* Site block. Becomes a switcher once a login can hold several sites. */}
          <div style={{ padding: '10px 12px', marginBottom: 12, border: `1px solid ${C.border2}`, borderRadius: 10, background: '#fff' }}>
            <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
            <div style={{ marginTop: 2 }}>{status}</div>
          </div>
          {PM_TABS.map(t => (
            <Link key={t.key} href={href(t.path)} className={`ops-nav${tab === t.key ? ' on' : ''}`} aria-current={tab === t.key ? 'page' : undefined}>
              <Icon k={t.key} />{t.label}
            </Link>
          ))}
          <div style={{ marginTop: 'auto', padding: '14px 4px 4px', borderTop: `1px solid ${C.border}` }}>
            {manager ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '0 8px' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{manager.name}</div>
                  <div style={{ fontSize: 13, color: C.ink3 }}>Signed in to control</div>
                </div>
                <button type="button" onClick={signOut} className="ops-btn" style={{ minHeight: 36, padding: '0 10px', fontSize: 13, flex: 'none', whiteSpace: 'nowrap' }}>Sign out</button>
              </div>
            ) : (
              <button type="button" onClick={() => setSignInOpen(true)} className="ops-btn" style={{ width: '100%' }}>Sign in to control</button>
            )}
          </div>
        </nav>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <header className="ops-top">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              {mark}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
                {status}
              </div>
            </div>
            {manager
              ? <button type="button" onClick={signOut} className="ops-btn" style={{ minHeight: 40, fontSize: 13 }}>Sign out</button>
              : <button type="button" onClick={() => setSignInOpen(true)} className="ops-btn" style={{ minHeight: 40, fontSize: 13 }}>Sign in</button>}
          </header>
          <main className="ops-main">
            {tab === 'access' && (
              <nav className="ops-sub" aria-label="Access">
                {ACCESS_SUB.map(s => <Link key={s.key} href={href(s.key)} className={active === s.key ? 'on' : ''} aria-current={active === s.key ? 'page' : undefined}>{s.label}</Link>)}
              </nav>
            )}
            {children}
          </main>
        </div>

        <nav className="ops-tabbar" aria-label="Property portal">
          {PM_TABS.filter(t => MOBILE_TABS.includes(t.key)).map(t => (
            <Link key={t.key} href={href(t.path)} className={tab === t.key ? 'on' : ''} aria-current={tab === t.key ? 'page' : undefined}>
              <Icon k={t.key} size={22} />{t.key === 'dashboard' ? 'Home' : t.label}
            </Link>
          ))}
          <button type="button" onClick={() => setMoreOpen(true)} className={MOBILE_TABS.includes(tab) ? '' : 'on'} aria-haspopup="dialog">
            <Icon k="more" size={22} />More
          </button>
        </nav>
      </div>

      {moreOpen && (
        <div onClick={() => setMoreOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 110, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'flex-end' }}>
          <div role="dialog" aria-label="More" onClick={e => e.stopPropagation()} style={{ width: '100%', background: '#fff', borderRadius: '12px 12px 0 0', padding: '8px 12px calc(16px + env(safe-area-inset-bottom))', fontFamily: FONT }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 4px' }}>
              <div style={{ fontWeight: 600, fontSize: 17, color: C.ink }}>More</div>
              <button type="button" onClick={() => setMoreOpen(false)} className="ops-btn" style={{ minHeight: 36, fontSize: 13 }}>Done</button>
            </div>
            {PM_TABS.filter(t => !MOBILE_TABS.includes(t.key)).map(t => (
              <Link key={t.key} href={href(t.path)} onClick={() => setMoreOpen(false)} className={`ops-nav${tab === t.key ? ' on' : ''}`}><Icon k={t.key} />{t.label}</Link>
            ))}
          </div>
        </div>
      )}

      {signInOpen && (
        <div onClick={() => setSignInOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div role="dialog" aria-label="Sign in to control" onClick={e => e.stopPropagation()} style={{ width: 360, maxWidth: '100%', boxSizing: 'border-box', background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 2px rgba(0,0,0,.04), 0 20px 50px -12px rgba(0,0,0,.3)', fontFamily: FONT, color: C.ink }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontSize: 17, fontWeight: 600 }}>Sign in to control</div>
              <button type="button" onClick={() => setSignInOpen(false)} aria-label="Close" style={{ background: 'transparent', border: 0, color: C.ink3, cursor: 'pointer', minWidth: 44, minHeight: 44, fontSize: 20 }}>×</button>
            </div>
            <div style={{ fontSize: 13, color: C.ink3, marginBottom: 14 }}>Enter your personal PIN so gate and lockdown commands are logged under your name.</div>
            <label style={{ position: 'absolute', left: -9999 }} htmlFor="ops-pin">Personal PIN</label>
            <input id="ops-pin" type="password" inputMode="numeric" autoFocus value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && pin) signIn() }} placeholder="Personal PIN" style={{ width: '100%', padding: '12px', borderRadius: 10, background: C.well, border: `1px solid ${C.border2}`, color: C.ink, fontSize: 22, letterSpacing: '0.4em', textAlign: 'center', boxSizing: 'border-box', fontFamily: FONT }} />
            {err && <div style={{ fontSize: 13, color: C.alert, marginTop: 8 }}>{err}</div>}
            <button type="button" onClick={signIn} disabled={busy || !pin} className="ops-btn pri" style={{ marginTop: 14, width: '100%', opacity: busy || !pin ? 0.5 : 1 }}>{busy ? 'Signing in…' : 'Sign in'}</button>
          </div>
        </div>
      )}
    </OpsCtx.Provider>
  )
}

export default OpsShell
