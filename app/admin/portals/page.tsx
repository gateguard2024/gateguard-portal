'use client'

// Corporate admin — Customer Portals (steel theme). The reusable workflow for
// putting a site online as a branded customer portal. Every portal renders
// through the single shared template (CustomerPortalTemplate); this screen only
// manages each site's DATA row (site, slug, modules, cameras, branding, status).
import { useEffect, useState, useCallback } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Plus, X, Check, Copy, ExternalLink, Search, Trash2, Globe, Loader2 } from 'lucide-react'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Edit2, Eye, EyeOff } = require('lucide-react') as any

const T = {
  bg: '#0f1822', panel: 'linear-gradient(180deg,#1d2a39,#141d28)', tile: '#16232f', well: '#0c1420',
  border: 'rgba(140,170,200,0.24)', ink: '#eaf2fb', ink2: 'rgba(195,211,226,0.72)', label: '#9FD8EC',
  accent: '#5FB8E0', ok: '#7ee0a8', warn: '#fbbf24', alarm: '#f87171',
}
const inp: React.CSSProperties = { width: '100%', background: T.well, border: `1px solid ${T.border}`, borderRadius: 9, padding: '9px 11px', color: T.ink, fontSize: 13, outline: 'none', boxSizing: 'border-box' }
const lbl: React.CSSProperties = { display: 'block', fontSize: 10.5, fontWeight: 600, color: T.label, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }
const btnPrimary: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, background: T.accent, border: 'none', color: '#08192b', borderRadius: 9, padding: '7px 13px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }
const iconBtn: React.CSSProperties = { display: 'inline-flex', padding: 6, borderRadius: 8, background: 'transparent', border: 'none', color: T.ink2, cursor: 'pointer' }
function seg(active: boolean): React.CSSProperties {
  return { padding: '8px 10px', borderRadius: 9, border: `1px solid ${active ? 'rgba(95,184,224,0.5)' : T.border}`, background: active ? 'rgba(95,184,224,0.16)' : 'transparent', color: active ? T.accent : T.ink2, fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }
}

type Portal = {
  id: string
  site_id: string | null
  slug: string
  login_type: 'property' | 'resident'
  modules: string[]
  camera_ids: string[] | null
  branding: { display_name?: string; accent?: string; logo_url?: string }
  status: 'draft' | 'live' | 'disabled'
  sites?: { name?: string; city?: string; state?: string } | null
}
type SiteLite = { id: string; name: string; city?: string; state?: string }

const MODULES: { key: string; label: string }[] = [
  { key: 'gate', label: 'Open gate' },
  { key: 'cameras', label: 'Cameras' },
  { key: 'passes', label: 'Issue passes' },
  { key: 'activity', label: 'Activity feed' },
  { key: 'billing', label: 'Billing & pay' },
  { key: 'service', label: 'Request service' },
]

const STATUS_META: Record<Portal['status'], { label: string; color: string; bg: string }> = {
  live:     { label: 'Live',     color: T.ok,   bg: 'rgba(126,224,168,0.12)' },
  draft:    { label: 'Draft',    color: T.ink2, bg: 'rgba(255,255,255,0.06)' },
  disabled: { label: 'Disabled', color: T.warn, bg: 'rgba(251,191,36,0.12)' },
}

function slugify(s: string) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
}

export default function PortalsAdminPage() {
  const [portals, setPortals] = useState<Portal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [drawer, setDrawer] = useState<{ mode: 'add' | 'edit'; portal?: Portal } | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    const res = await fetch('/api/admin/portals')
    const json = await res.json()
    if (!res.ok) { setError(json.error || 'Failed to load'); setLoading(false); return }
    setPortals(json.portals || [])
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  async function toggleStatus(p: Portal) {
    const next = p.status === 'live' ? 'disabled' : 'live'
    await fetch(`/api/admin/portals/${p.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: next }) })
    load()
  }
  async function remove(p: Portal) {
    if (!confirm(`Delete the portal for "${p.branding?.display_name || p.slug}"? This cannot be undone.`)) return
    await fetch(`/api/admin/portals/${p.id}`, { method: 'DELETE' })
    load()
  }

  const th: React.CSSProperties = { textAlign: 'left', padding: '11px 16px', fontSize: 10.5, fontWeight: 600, color: T.label, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { padding: '12px 16px', color: T.ink2, fontSize: 13, borderTop: `1px solid rgba(140,170,200,0.12)` }

  return (
    <div style={{ minHeight: '100%', background: `radial-gradient(1100px 460px at 50% -8%, rgba(95,184,224,0.08), transparent 62%), ${T.bg}`, display: 'flex', flexDirection: 'column' }}>
      <TopBar
        title="Customer Portals"
        subtitle="Put a site online as a branded customer portal — one shared design, per-site config"
        actions={<button onClick={() => setDrawer({ mode: 'add' })} style={btnPrimary}><Plus size={13} /> Add Portal</button>}
      />

      <div style={{ flex: 1, padding: 24 }}>
        {error && <div style={{ marginBottom: 14, borderRadius: 10, border: '1px solid rgba(248,113,113,0.35)', background: 'rgba(248,113,113,0.1)', padding: '10px 14px', color: T.alarm, fontSize: 13 }}>{error}</div>}

        <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: 'inset 0 1px 0 rgba(190,215,240,0.05)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.18)' }}>
                {['Portal', 'Link', 'Site', 'Login', 'Modules', 'Status', ''].map(h => <th key={h} style={th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ ...td, textAlign: 'center', padding: 40 }}><Loader2 size={16} style={{ display: 'inline', verticalAlign: -3, marginRight: 8 }} className="animate-spin" />Loading…</td></tr>
              ) : portals.length === 0 ? (
                <tr><td colSpan={7} style={{ ...td, textAlign: 'center', padding: 40 }}>No portals yet. Click <strong style={{ color: T.ink }}>Add Portal</strong> to put your first site online.</td></tr>
              ) : portals.map(p => (
                <tr key={p.id}>
                  <td style={td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(95,184,224,0.12)', border: '1px solid rgba(95,184,224,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Globe size={13} style={{ color: T.accent }} /></div>
                      <span style={{ fontWeight: 600, color: T.ink }}>{p.branding?.display_name || p.slug}</span>
                    </div>
                  </td>
                  <td style={td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <code style={{ fontSize: 11, color: T.ink2, fontFamily: 'var(--font-plex-mono, monospace)' }}>/portal/{p.slug}</code>
                      <button title="Copy link" onClick={() => navigator.clipboard.writeText(`${origin}/portal/${p.slug}`)} style={iconBtn}><Copy size={12} /></button>
                      <a title="Open" href={`${origin}/portal/${p.slug}`} target="_blank" rel="noreferrer" style={{ ...iconBtn, color: T.accent }}><ExternalLink size={12} /></a>
                    </div>
                  </td>
                  <td style={td}>{p.sites?.name ?? '—'}{p.sites?.city ? <span style={{ fontSize: 11 }}> · {p.sites.city}, {p.sites.state}</span> : null}</td>
                  <td style={{ ...td, textTransform: 'capitalize' }}>{p.login_type}</td>
                  <td style={td}>{(p.modules || []).length} / {MODULES.length}</td>
                  <td style={td}><span style={{ fontSize: 11, fontWeight: 700, color: STATUS_META[p.status].color, background: STATUS_META[p.status].bg, border: `1px solid ${STATUS_META[p.status].color}44`, borderRadius: 999, padding: '3px 10px' }}>{STATUS_META[p.status].label}</span></td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <button title={p.status === 'live' ? 'Take offline' : 'Set live'} onClick={() => toggleStatus(p)} style={iconBtn}>{p.status === 'live' ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                      <button title="Edit" onClick={() => setDrawer({ mode: 'edit', portal: p })} style={iconBtn}><Edit2 size={14} /></button>
                      <button title="Delete" onClick={() => remove(p)} style={{ ...iconBtn, color: T.alarm }}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {drawer && <PortalDrawer mode={drawer.mode} portal={drawer.portal} onClose={() => setDrawer(null)} onSaved={() => { setDrawer(null); load() }} />}
    </div>
  )
}

// ── Add / Edit drawer ────────────────────────────────────────────────────────
function PortalDrawer({ mode, portal, onClose, onSaved }: { mode: 'add' | 'edit'; portal?: Portal; onClose: () => void; onSaved: () => void }) {
  const [site, setSite] = useState<SiteLite | null>(portal?.site_id ? { id: portal.site_id, name: portal.sites?.name || '', city: portal.sites?.city, state: portal.sites?.state } : null)
  const [displayName, setDisplayName] = useState(portal?.branding?.display_name || '')
  const [slug, setSlug] = useState(portal?.slug || '')
  const [slugTouched, setSlugTouched] = useState(mode === 'edit')
  const [loginType, setLoginType] = useState<'property' | 'resident'>(portal?.login_type || 'property')
  const [modules, setModules] = useState<string[]>(portal?.modules || MODULES.map(m => m.key))
  const [accent, setAccent] = useState(portal?.branding?.accent || '')
  const [cameras, setCameras] = useState((portal?.camera_ids || []).join(', '))
  const [status, setStatus] = useState<Portal['status']>(portal?.status || 'draft')
  const [pin, setPin] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  function pickSite(s: SiteLite) { setSite(s); if (!displayName) setDisplayName(s.name); if (!slugTouched) setSlug(slugify(s.name)) }
  const toggleModule = (k: string) => setModules(m => m.includes(k) ? m.filter(x => x !== k) : [...m, k])

  async function save() {
    setErr(null)
    if (mode === 'add' && !site) { setErr('Pick a site first.'); return }
    if (!slug) { setErr('A slug is required.'); return }
    if (pin.trim() && pin.trim().length < 6) { setErr('Access code must be at least 6 digits.'); return }
    setSaving(true)
    const payload = {
      site_id: site?.id, slug, login_type: loginType, modules,
      camera_ids: cameras.split(',').map(c => c.trim()).filter(Boolean),
      branding: { display_name: displayName || site?.name, ...(accent ? { accent } : {}) },
      status, ...(pin.trim() ? { access_pin: pin.trim() } : {}),
    }
    const res = await fetch(mode === 'add' ? '/api/admin/portals' : `/api/admin/portals/${portal!.id}`, { method: mode === 'add' ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) { setErr(json.error || 'Save failed'); return }
    onSaved()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'flex' }}>
      <div style={{ flex: 1, background: 'rgba(4,10,20,0.6)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div style={{ width: 470, maxWidth: '94vw', background: T.panel, borderLeft: `1px solid ${T.border}`, height: '100%', display: 'flex', flexDirection: 'column', boxShadow: '-20px 0 50px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', borderBottom: `1px solid ${T.border}` }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>{mode === 'add' ? 'Add Customer Portal' : 'Edit Portal'}</div>
            <div style={{ fontSize: 12, color: T.ink2 }}>One shared design — this sets only this site&apos;s config.</div>
          </div>
          <button onClick={onClose} style={iconBtn}><X size={16} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={lbl}>Site *</div>
            {mode === 'edit' || site ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 11px', borderRadius: 9, border: `1px solid ${T.border}`, background: T.well }}>
                <span style={{ fontSize: 13, color: T.ink }}>{site?.name || '—'}{site?.city ? <span style={{ color: T.ink2 }}> · {site.city}, {site.state}</span> : null}</span>
                {mode === 'add' && <button onClick={() => setSite(null)} style={{ fontSize: 12, color: T.accent, background: 'none', border: 'none', cursor: 'pointer' }}>Change</button>}
              </div>
            ) : <SitePicker onPick={pickSite} />}
          </div>

          <L label="Display name"><input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="East Ponce Village" style={inp} /></L>

          <L label="Portal link">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13, color: T.ink2 }}>/portal/</span>
              <input value={slug} onChange={e => { setSlug(slugify(e.target.value)); setSlugTouched(true) }} placeholder="east-ponce-village" style={{ ...inp, fontFamily: 'var(--font-plex-mono, monospace)' }} />
            </div>
          </L>

          <L label="Login type">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {(['property', 'resident'] as const).map(t => <button key={t} onClick={() => setLoginType(t)} style={seg(loginType === t)}>{t}{t === 'resident' ? ' (soon)' : ''}</button>)}
            </div>
          </L>

          <L label="Modules">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {MODULES.map(m => {
                const on = modules.includes(m.key)
                return (
                  <button key={m.key} onClick={() => toggleModule(m.key)} style={{ ...seg(on), display: 'flex', alignItems: 'center', gap: 8, textTransform: 'none' }}>
                    <span style={{ width: 14, height: 14, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${on ? T.accent : T.border}`, background: on ? T.accent : 'transparent' }}>{on && <Check size={10} style={{ color: '#08192b' }} />}</span>
                    {m.label}
                  </button>
                )
              })}
            </div>
          </L>

          <L label="Accent color (optional)">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="color" value={accent || '#5FB8E0'} onChange={e => setAccent(e.target.value)} style={{ height: 36, width: 48, borderRadius: 8, border: `1px solid ${T.border}`, background: T.well, cursor: 'pointer' }} />
              <input value={accent} onChange={e => setAccent(e.target.value)} placeholder="#5FB8E0 (default steel)" style={{ ...inp, fontFamily: 'var(--font-plex-mono, monospace)' }} />
              {accent && <button onClick={() => setAccent('')} style={{ fontSize: 12, color: T.ink2, background: 'none', border: 'none', cursor: 'pointer' }}>Reset</button>}
            </div>
          </L>

          <L label="Cameras (optional)">
            <input value={cameras} onChange={e => setCameras(e.target.value)} placeholder="Blank = all cameras. Or paste camera IDs, comma-separated" style={inp} />
            <div style={{ fontSize: 11, color: T.ink2, marginTop: 5 }}>Blank shows every Eagle Eye camera the site exposes.</div>
          </L>

          <L label="Status">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {(['draft', 'live', 'disabled'] as const).map(s => <button key={s} onClick={() => setStatus(s)} style={seg(status === s)}>{s}</button>)}
            </div>
            <div style={{ fontSize: 11, color: T.ink2, marginTop: 5 }}>Draft &amp; Disabled return 404 to visitors. Flip to Live when ready.</div>
          </L>

          <L label="Access code (PIN)">
            <input value={pin} onChange={e => setPin(e.target.value)} placeholder={portal ? 'Leave blank to keep current code' : 'Passcode customers enter to view'} style={inp} />
            <div style={{ fontSize: 11, color: T.ink2, marginTop: 5 }}>At least 6 digits. Share it with the property manager.</div>
          </L>

          {err && <div style={{ borderRadius: 9, border: '1px solid rgba(248,113,113,0.35)', background: 'rgba(248,113,113,0.1)', padding: '9px 11px', fontSize: 13, color: T.alarm }}>{err}</div>}
        </div>

        <div style={{ padding: 16, borderTop: `1px solid ${T.border}`, display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: `1px solid ${T.border}`, background: 'transparent', color: T.ink2, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={save} disabled={saving || (mode === 'add' && !site)} style={{ ...btnPrimary, flex: 1, justifyContent: 'center', padding: '10px 0', opacity: saving || (mode === 'add' && !site) ? 0.5 : 1 }}>{saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} {mode === 'add' ? 'Create Portal' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  )
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div style={lbl}>{label}</div>{children}</div>
}

// ── Site search picker ───────────────────────────────────────────────────────
function SitePicker({ onPick }: { onPick: (s: SiteLite) => void }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SiteLite[]>([])
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const t = setTimeout(async () => {
      setBusy(true)
      const res = await fetch(`/api/sites?limit=25${q ? `&q=${encodeURIComponent(q)}` : ''}`)
      const json = await res.json()
      setResults((json.sites || []).map((s: SiteLite) => ({ id: s.id, name: s.name, city: s.city, state: s.state })))
      setBusy(false)
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  return (
    <div>
      <div style={{ position: 'relative' }}>
        <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: T.ink2 }} />
        <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search sites by name or city…" style={{ ...inp, paddingLeft: 30 }} />
      </div>
      <div style={{ marginTop: 8, maxHeight: 210, overflowY: 'auto', border: `1px solid ${T.border}`, borderRadius: 9 }}>
        {busy ? (
          <div style={{ padding: 12, fontSize: 12, color: T.ink2 }}><Loader2 size={12} style={{ display: 'inline', verticalAlign: -2, marginRight: 6 }} className="animate-spin" />Searching…</div>
        ) : results.length === 0 ? (
          <div style={{ padding: 12, fontSize: 12, color: T.ink2 }}>No sites found.</div>
        ) : results.map(s => (
          <button key={s.id} onClick={() => onPick(s)} style={{ width: '100%', textAlign: 'left', padding: '9px 11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'transparent', border: 'none', borderTop: `1px solid rgba(140,170,200,0.12)`, cursor: 'pointer' }}>
            <span style={{ fontSize: 13, color: T.ink }}>{s.name}</span>
            {s.city && <span style={{ fontSize: 11, color: T.ink2 }}>{s.city}, {s.state}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
