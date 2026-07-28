'use client'

// Corporate admin — Customer Portals. The reusable workflow for putting a site
// online as a branded customer portal. Every portal renders through the single
// shared template (CustomerPortalTemplate); this screen only manages each site's
// DATA row (which site, slug, modules, cameras, branding, status).
import { useEffect, useState, useCallback } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Plus, X, Check, Copy, ExternalLink, Search, Trash2, Globe, Loader2 } from 'lucide-react'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Edit2, Eye, EyeOff } = require('lucide-react') as any

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

const STATUS_META: Record<Portal['status'], { label: string; cls: string }> = {
  live:     { label: 'Live',     cls: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  draft:    { label: 'Draft',    cls: 'bg-slate-100 text-slate-500 border-slate-200' },
  disabled: { label: 'Disabled', cls: 'bg-amber-50 text-amber-600 border-amber-200' },
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
    await fetch(`/api/admin/portals/${p.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    load()
  }

  async function remove(p: Portal) {
    if (!confirm(`Delete the portal for "${p.branding?.display_name || p.slug}"? This cannot be undone.`)) return
    await fetch(`/api/admin/portals/${p.id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        title="Customer Portals"
        subtitle="Put a site online as a branded customer portal — one shared design, per-site config"
        actions={
          <button
            onClick={() => setDrawer({ mode: 'add' })}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-400 hover:bg-brand-500 text-white transition-colors gg-glow"
          >
            <Plus size={13} /> Add Portal
          </button>
        }
      />

      <div className="flex-1 p-6">
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>
        )}

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {['Portal', 'Link', 'Site', 'Login', 'Modules', 'Status', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground"><Loader2 size={16} className="inline animate-spin mr-2" />Loading…</td></tr>
              ) : portals.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No portals yet. Click <strong>Add Portal</strong> to put your first site online.</td></tr>
              ) : portals.map(p => (
                <tr key={p.id} className="border-b border-border/60 hover:bg-accent/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-brand-400/10 border border-brand-400/20 flex items-center justify-center shrink-0">
                        <Globe size={13} className="text-brand-400" />
                      </div>
                      <span className="font-semibold text-foreground">{p.branding?.display_name || p.slug}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <code className="text-[11px] text-muted-foreground font-mono">/portal/{p.slug}</code>
                      <button title="Copy link" onClick={() => navigator.clipboard.writeText(`${origin}/portal/${p.slug}`)} className="text-muted-foreground hover:text-foreground"><Copy size={12} /></button>
                      <a title="Open" href={`${origin}/portal/${p.slug}`} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-brand-400"><ExternalLink size={12} /></a>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.sites?.name ?? '—'}{p.sites?.city ? <span className="text-[11px]"> · {p.sites.city}, {p.sites.state}</span> : null}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">{p.login_type}</td>
                  <td className="px-4 py-3 text-muted-foreground">{(p.modules || []).length} / {MODULES.length}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_META[p.status].cls}`}>{STATUS_META[p.status].label}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 justify-end">
                      <button title={p.status === 'live' ? 'Take offline' : 'Set live'} onClick={() => toggleStatus(p)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground">
                        {p.status === 'live' ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      <button title="Edit" onClick={() => setDrawer({ mode: 'edit', portal: p })} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground"><Edit2 size={14} /></button>
                      <button title="Delete" onClick={() => remove(p)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-500"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {drawer && (
        <PortalDrawer
          mode={drawer.mode}
          portal={drawer.portal}
          onClose={() => setDrawer(null)}
          onSaved={() => { setDrawer(null); load() }}
        />
      )}
    </div>
  )
}

// ── Add / Edit drawer ────────────────────────────────────────────────────────
function PortalDrawer({ mode, portal, onClose, onSaved }: {
  mode: 'add' | 'edit'
  portal?: Portal
  onClose: () => void
  onSaved: () => void
}) {
  const [site, setSite] = useState<SiteLite | null>(
    portal?.site_id ? { id: portal.site_id, name: portal.sites?.name || '', city: portal.sites?.city, state: portal.sites?.state } : null
  )
  const [displayName, setDisplayName] = useState(portal?.branding?.display_name || '')
  const [slug, setSlug] = useState(portal?.slug || '')
  const [slugTouched, setSlugTouched] = useState(mode === 'edit')
  const [loginType, setLoginType] = useState<'property' | 'resident'>(portal?.login_type || 'property')
  const [modules, setModules] = useState<string[]>(portal?.modules || MODULES.map(m => m.key))
  const [accent, setAccent] = useState(portal?.branding?.accent || '')
  const [cameras, setCameras] = useState((portal?.camera_ids || []).join(', '))
  const [status, setStatus] = useState<Portal['status']>(portal?.status || 'draft')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  function pickSite(s: SiteLite) {
    setSite(s)
    if (!displayName) setDisplayName(s.name)
    if (!slugTouched) setSlug(slugify(s.name))
  }

  const toggleModule = (k: string) =>
    setModules(m => m.includes(k) ? m.filter(x => x !== k) : [...m, k])

  async function save() {
    setErr(null)
    if (mode === 'add' && !site) { setErr('Pick a site first.'); return }
    if (!slug) { setErr('A slug is required.'); return }
    setSaving(true)

    const payload = {
      site_id: site?.id,
      slug,
      login_type: loginType,
      modules,
      camera_ids: cameras.split(',').map(c => c.trim()).filter(Boolean),
      branding: { display_name: displayName || site?.name, ...(accent ? { accent } : {}) },
      status,
    }

    const res = await fetch(
      mode === 'add' ? '/api/admin/portals' : `/api/admin/portals/${portal!.id}`,
      { method: mode === 'add' ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
    )
    const json = await res.json()
    setSaving(false)
    if (!res.ok) { setErr(json.error || 'Save failed'); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="w-[460px] bg-white border-l border-border h-full flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-bold text-foreground">{mode === 'add' ? 'Add Customer Portal' : 'Edit Portal'}</h2>
            <p className="text-xs text-muted-foreground">One shared design — this sets only this site's config.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Site */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Site <span className="text-red-400">*</span></label>
            {mode === 'edit' || site ? (
              <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-border bg-muted/30">
                <span className="text-sm text-foreground">{site?.name || '—'}{site?.city ? <span className="text-muted-foreground"> · {site.city}, {site.state}</span> : null}</span>
                {mode === 'add' && <button onClick={() => setSite(null)} className="text-xs text-brand-400 hover:underline">Change</button>}
              </div>
            ) : (
              <SitePicker onPick={pickSite} />
            )}
          </div>

          {/* Display name */}
          <Field label="Display name">
            <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="East Ponce Village"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:border-brand-400/60 focus:outline-none bg-background" />
          </Field>

          {/* Slug */}
          <Field label="Portal link">
            <div className="flex items-center gap-1 text-sm">
              <span className="text-muted-foreground">/portal/</span>
              <input value={slug} onChange={e => { setSlug(slugify(e.target.value)); setSlugTouched(true) }} placeholder="east-ponce-village"
                className="flex-1 px-3 py-2 text-sm border border-border rounded-lg focus:border-brand-400/60 focus:outline-none bg-background font-mono" />
            </div>
          </Field>

          {/* Login type */}
          <Field label="Login type">
            <div className="grid grid-cols-2 gap-2">
              {(['property', 'resident'] as const).map(t => (
                <button key={t} onClick={() => setLoginType(t)}
                  className={`px-3 py-2 rounded-lg border text-xs font-medium capitalize transition-all ${loginType === t ? 'border-brand-400/40 bg-brand-400/8 text-brand-400' : 'border-border text-muted-foreground hover:bg-accent'}`}>
                  {t}{t === 'resident' ? ' (soon)' : ''}
                </button>
              ))}
            </div>
          </Field>

          {/* Modules */}
          <Field label="Modules">
            <div className="grid grid-cols-2 gap-2">
              {MODULES.map(m => {
                const on = modules.includes(m.key)
                return (
                  <button key={m.key} onClick={() => toggleModule(m.key)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${on ? 'border-brand-400/40 bg-brand-400/8 text-brand-400' : 'border-border text-muted-foreground hover:bg-accent'}`}>
                    <span className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${on ? 'bg-brand-400 border-brand-400' : 'border-border'}`}>{on && <Check size={10} className="text-white" />}</span>
                    {m.label}
                  </button>
                )
              })}
            </div>
          </Field>

          {/* Accent */}
          <Field label="Accent color (optional)">
            <div className="flex items-center gap-2">
              <input type="color" value={accent || '#5FB8E0'} onChange={e => setAccent(e.target.value)} className="h-9 w-12 rounded border border-border bg-background cursor-pointer" />
              <input value={accent} onChange={e => setAccent(e.target.value)} placeholder="#5FB8E0 (default steel)"
                className="flex-1 px-3 py-2 text-sm border border-border rounded-lg focus:border-brand-400/60 focus:outline-none bg-background font-mono" />
              {accent && <button onClick={() => setAccent('')} className="text-xs text-muted-foreground hover:text-foreground">Reset</button>}
            </div>
          </Field>

          {/* Cameras */}
          <Field label="Cameras (optional)">
            <input value={cameras} onChange={e => setCameras(e.target.value)} placeholder="Leave blank = all cameras. Or paste camera IDs, comma-separated"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:border-brand-400/60 focus:outline-none bg-background" />
            <p className="text-[11px] text-muted-foreground mt-1">Eagle Eye camera picker comes in the live-data pass. Blank shows the demo strip for now.</p>
          </Field>

          {/* Status */}
          <Field label="Status">
            <div className="grid grid-cols-3 gap-2">
              {(['draft', 'live', 'disabled'] as const).map(s => (
                <button key={s} onClick={() => setStatus(s)}
                  className={`px-3 py-2 rounded-lg border text-xs font-medium capitalize transition-all ${status === s ? 'border-brand-400/40 bg-brand-400/8 text-brand-400' : 'border-border text-muted-foreground hover:bg-accent'}`}>{s}</button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Draft &amp; Disabled return 404 to visitors. Flip to Live when you&apos;re ready.</p>
          </Field>

          {err && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{err}</div>}
        </div>

        <div className="px-6 py-4 border-t border-border flex items-center gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent">Cancel</button>
          <button onClick={save} disabled={saving || (mode === 'add' && !site)}
            className="flex-1 px-4 py-2 rounded-lg bg-brand-400 hover:bg-brand-500 text-white text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} {mode === 'add' ? 'Create Portal' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">{label}</label>
      {children}
    </div>
  )
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
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search sites by name or city…"
          className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-lg focus:border-brand-400/60 focus:outline-none bg-background" />
      </div>
      <div className="mt-2 max-h-52 overflow-y-auto border border-border rounded-lg divide-y divide-border/60">
        {busy ? (
          <div className="px-3 py-3 text-xs text-muted-foreground"><Loader2 size={12} className="inline animate-spin mr-2" />Searching…</div>
        ) : results.length === 0 ? (
          <div className="px-3 py-3 text-xs text-muted-foreground">No sites found.</div>
        ) : results.map(s => (
          <button key={s.id} onClick={() => onPick(s)} className="w-full text-left px-3 py-2 hover:bg-accent/50 flex items-center justify-between">
            <span className="text-sm text-foreground">{s.name}</span>
            {s.city && <span className="text-[11px] text-muted-foreground">{s.city}, {s.state}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
