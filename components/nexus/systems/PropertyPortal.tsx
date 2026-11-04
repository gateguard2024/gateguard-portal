'use client'
/**
 * Property portal setup — the property manager portal (/portal/<address>) for one
 * property: turn it on, its web address, the access code, which cameras and gates
 * it shows. Used in two places (same card, light Apple look):
 *   • Systems → a property → "Property portal" (header button, corporate only)
 *   • Admin → "Property portals" (every portal; replaces the old /admin/portals page)
 * 🔒 Corporate only — every /api/admin/portals route refuses anyone else.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { type Any, Card, Dot, DOT, Field, Note, Sheet, getJson, send, useFlash, MUTED, BLUE } from '@/components/nexus/systems/shared'

const slugify = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
const fullLink = (slug: string) => `${typeof window !== 'undefined' ? window.location.origin : ''}/portal/${slug}`
const STATUS: Record<string, { label: string; dot: string }> = {
  live: { label: 'On', dot: DOT.green }, draft: { label: 'Not turned on yet', dot: DOT.orange }, disabled: { label: 'Off', dot: DOT.gray },
}

type Device = { key: string; name: string; online?: boolean | null; source: string }
const MODULES: { key: string; label: string }[] = [
  { key: 'gate', label: 'Open gate' }, { key: 'cameras', label: 'Cameras' }, { key: 'passes', label: 'Issue passes' },
  { key: 'activity', label: 'Activity' }, { key: 'billing', label: 'Billing & pay' }, { key: 'service', label: 'Request service' },
]

/** Every portal (Admin → Property portals). */
export function PortalsAdmin({ onClose }: { onClose: () => void }) {
  const [flash, notify] = useFlash()
  const [rows, setRows] = useState<Any[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [open, setOpen] = useState<{ siteId: string; siteName: string } | null>(null)
  const [adding, setAdding] = useState(false)
  const load = useCallback(async () => {
    const r = await getJson('/api/admin/portals')
    setRows(Array.isArray(r.data.portals) ? r.data.portals : []); setErr(r.ok ? null : (r.data.error || 'Could not load portals.'))
  }, [])
  useEffect(() => { void load() }, [load])

  return (
    <Sheet title="Property portals" sub="The portal each property manager signs in to. Corporate only." onClose={onClose} width={900}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, color: MUTED }}>{rows ? `${rows.length} portal${rows.length === 1 ? '' : 's'}` : 'Loading…'}</div>
        <button type="button" className="sy-b pri" onClick={() => setAdding(true)}>+ Add a property</button>
      </div>
      {err && <Note tone="red">{err}</Note>}
      {rows && !rows.length && !err && <Note>No property has a portal yet. Use “Add a property”.</Note>}
      {rows && rows.length > 0 && (
        <div>
          {rows.map(p => {
            const st = STATUS[p.status] ?? STATUS.draft
            const site = p.sites?.name || 'No property linked'
            return (
              <div key={p.id} className="sy-row">
                <div className="main">
                  <div className="t">{p.branding?.display_name || site}</div>
                  <div className="m">{site}{p.sites?.city ? ` · ${p.sites.city}, ${p.sites.state ?? ''}` : ''} · /portal/{p.slug}</div>
                </div>
                <span className="sy-pill"><Dot c={st.dot} />{st.label}</span>
                <a className="sy-b line sm" href={`/portal/${p.slug}`} target="_blank" rel="noopener noreferrer">Open</a>
                <button type="button" className="sy-b blue sm" disabled={!p.site_id} onClick={() => setOpen({ siteId: p.site_id, siteName: site })}>Set up</button>
              </div>
            )
          })}
        </div>
      )}
      {adding && <SitePick onClose={() => setAdding(false)} onPick={s => { setAdding(false); setOpen({ siteId: s.id, siteName: s.name }) }} />}
      {open && (
        <Sheet title={open.siteName} sub="Property portal" onClose={() => { setOpen(null); void load() }} width={640}>
          <PropertyPortalSetup siteId={open.siteId} siteName={open.siteName} notify={notify} onChanged={load} />
        </Sheet>
      )}
      {flash}
    </Sheet>
  )
}

function SitePick({ onClose, onPick }: { onClose: () => void; onPick: (s: Any) => void }) {
  const [q, setQ] = useState('')
  const [list, setList] = useState<Any[] | null>(null)
  useEffect(() => {
    const t = setTimeout(async () => {
      const r = await getJson(`/api/sites?limit=25${q ? `&q=${encodeURIComponent(q)}` : ''}`)
      setList(Array.isArray(r.data.sites) ? r.data.sites : [])
    }, 250)
    return () => clearTimeout(t)
  }, [q])
  return (
    <Sheet title="Which property?" onClose={onClose} width={480}>
      <input className="sy-in" autoFocus placeholder="Search by name or city" value={q} onChange={e => setQ(e.target.value)} aria-label="Search properties" />
      <div>
        {list == null ? <div className="sy-empty">Searching…</div> : !list.length ? <div className="sy-empty">No properties found.</div>
          : list.map(s => (
            <button key={s.id} type="button" className="sy-row" style={{ width: '100%', background: 'none', border: 0, borderTop: '1px solid rgba(0,0,0,.08)', font: 'inherit', textAlign: 'left', cursor: 'pointer' }} onClick={() => onPick(s)}>
              <div className="main"><div className="t">{s.name}</div>{s.city && <div className="m">{s.city}, {s.state}</div>}</div>
              <span style={{ color: BLUE, fontSize: 13 }}>Choose</span>
            </button>
          ))}
      </div>
    </Sheet>
  )
}

/** One property's portal: create it, or change it. */
export function PropertyPortalSetup({ siteId, siteName, notify, onChanged }: { siteId: string; siteName?: string; notify: (m: string, ok?: boolean) => void; onChanged?: () => void }) {
  const [portal, setPortal] = useState<Any | null | undefined>(undefined)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [devices, setDevices] = useState<{ cameras: Device[]; doors: Device[] } | null>(null)
  const [slug, setSlug] = useState(slugify(siteName || ''))
  const [name, setName] = useState(siteName || '')
  const [mods, setMods] = useState<Set<string>>(new Set(MODULES.map(m => m.key)))
  const [accent, setAccent] = useState('')
  const [pin, setPin] = useState('')
  const [cams, setCams] = useState<Set<string>>(new Set())
  const [doors, setDoors] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const load = useCallback(async () => {
    const [p, d] = await Promise.all([getJson(`/api/admin/portals?site_id=${encodeURIComponent(siteId)}`), getJson(`/api/admin/portals/devices?site_id=${encodeURIComponent(siteId)}`)])
    if (!p.ok) { setLoadErr(p.data.error || 'Could not load the portal.'); setPortal(null) }
    else {
      const row: Any | null = (p.data.portals ?? [])[0] ?? null
      setPortal(row); setLoadErr(null)
      if (row) {
        setSlug(row.slug)
        setName(row.branding?.display_name || siteName || '')
        setAccent(row.branding?.accent || '')
        setMods(new Set(Array.isArray(row.modules) && row.modules.length ? row.modules : MODULES.map(m => m.key)))
        // Saved list → keys; a plain Eagle Eye id (older portals) is "een:<id>".
        setCams(new Set((row.camera_ids ?? []).map((x: string) => (x.startsWith('edge:') || x.startsWith('een:') ? x : `een:${x}`))))
        setDoors(new Set((row.door_ids ?? []).map(String)))
      }
    }
    const camList: Device[] = (d.data.cameras ?? []).map((c: Any) => ({ key: c.key ?? `een:${c.id}`, name: c.name, online: c.online, source: c.source ?? 'Eagle Eye' }))
    const doorList: Device[] = (d.data.doors ?? []).map((x: Any) => ({ key: String(x.id), name: x.name, source: 'Brivo' }))
    setDevices({ cameras: camList, doors: doorList })
  }, [siteId])
  useEffect(() => { void load() }, [load])

  const link = useMemo(() => fullLink(portal?.slug ?? slugify(slug)), [portal?.slug, slug])
  const st = STATUS[portal?.status ?? 'draft'] ?? STATUS.draft

  async function save(extra?: Any) {
    const s = slugify(slug)
    if (!s) return notify('Give the portal a web address.', false)
    if (pin && pin.trim().length < 6) return notify('The access code needs at least 6 digits.', false)
    if (!portal && pin.trim().length < 6) return notify('Set an access code (at least 6 digits) so only the manager can get in.', false)
    setBusy(true)
    const body: Any = {
      slug: s, camera_ids: [...cams], door_ids: [...doors], modules: [...mods],
      branding: { ...(portal?.branding ?? {}), display_name: name.trim() || siteName || s, ...(accent ? { accent } : { accent: undefined }) },
      ...(pin.trim() ? { access_pin: pin.trim() } : {}),
      ...(portal ? {} : { site_id: siteId, status: 'live', login_type: 'property' }),
      ...extra,
    }
    const r = portal ? await send(`/api/admin/portals/${portal.id}`, 'PATCH', body) : await send('/api/admin/portals', 'POST', body)
    setBusy(false)
    if (!r.ok) return notify(r.data.error || 'Could not save.', false)
    setPin('')
    notify(portal ? 'Saved.' : 'Portal is on.')
    await load(); onChanged?.()
  }
  async function setStatus(next: 'live' | 'disabled') {
    if (!portal) return
    setBusy(true)
    const r = await send(`/api/admin/portals/${portal.id}`, 'PATCH', { status: next })
    setBusy(false)
    if (!r.ok) return notify(r.data.error || 'Could not change it.', false)
    notify(next === 'live' ? 'Portal is on.' : 'Portal is off — the link now says “not found”.')
    await load(); onChanged?.()
  }
  async function remove() {
    if (!portal) return
    setBusy(true)
    const r = await send(`/api/admin/portals/${portal.id}`, 'DELETE')
    setBusy(false)
    if (!r.ok) return notify(r.data.error || 'Could not delete it.', false)
    notify('Portal deleted.'); setConfirmDelete(false); setPortal(null); setCams(new Set()); setDoors(new Set()); setSlug(slugify(siteName || ''))
    onChanged?.()
  }
  function copy() {
    void navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }).catch(() => {})
  }
  const toggle = (set: Set<string>, fn: (s: Set<string>) => void, k: string) => { const n = new Set(set); if (n.has(k)) n.delete(k); else n.add(k); fn(n) }

  if (portal === undefined) return <div className="sy-empty">Loading…</div>
  return (
    <div className="sy-stack">
      {loadErr && <Note tone="red">{loadErr}</Note>}

      <Card title="Portal" sub={portal ? undefined : 'This property doesn’t have a portal yet.'}
        right={portal ? <span className="sy-pill"><Dot c={st.dot} />{st.label}</span> : undefined}>
        <div className="sy-stack">
          <Field label="Name the manager sees">
            <input className="sy-in" value={name} onChange={e => setName(e.target.value)} placeholder={siteName} aria-label="Portal name" />
          </Field>
          <Field label="Web address">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14, color: MUTED, whiteSpace: 'nowrap' }}>/portal/</span>
              <input className="sy-in" value={slug} onChange={e => setSlug(e.target.value)} onBlur={() => setSlug(slugify(slug))} aria-label="Web address" />
            </div>
          </Field>
          {portal && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a className="sy-b line sm" href={`/portal/${portal.slug}`} target="_blank" rel="noopener noreferrer">Open portal</a>
              <button type="button" className="sy-b line sm" onClick={copy}>{copied ? 'Copied' : 'Copy link'}</button>
            </div>
          )}
          <Field label={portal ? 'New access code (leave blank to keep the current one)' : 'Access code (at least 6 digits)'}>
            <input className="sy-in" inputMode="numeric" autoComplete="off" value={pin} onChange={e => setPin(e.target.value.replace(/\s/g, ''))} placeholder={portal ? '••••••' : 'e.g. 650100'} aria-label="Access code" />
          </Field>
          <div style={{ fontSize: 12, color: MUTED }}>The property manager types this code once on each device. We only keep a scrambled copy, so we can’t show it again — write it down when you set it.</div>
        </div>
      </Card>

      <Card title="What the manager can do" sub={`${mods.size} of ${MODULES.length} on`}>
        <div className="sy-chips">
          {MODULES.map(m => <button key={m.key} type="button" className="sy-chip" aria-pressed={mods.has(m.key)} onClick={() => toggle(mods, setMods, m.key)}>{m.label}</button>)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
          <span className="sy-lbl" style={{ margin: 0 }}>Accent color (optional)</span>
          <input type="color" value={accent || '#0A84FF'} onChange={e => setAccent(e.target.value)} aria-label="Accent color" style={{ width: 34, height: 26, border: 0, padding: 0, background: 'none' }} />
          {accent && <button type="button" className="sy-b line sm" onClick={() => setAccent('')}>Reset</button>}
        </div>
      </Card>

      <Card title="Cameras" sub={cams.size ? `${cams.size} picked` : 'None picked = all cameras show'}>
        {devices == null ? <div className="sy-empty">Loading…</div> : !devices.cameras.length ? <div className="sy-empty">No cameras connected for this property yet (Setup &amp; keys).</div> : (
          <div className="sy-chips">
            {devices.cameras.map(c => (
              <button key={c.key} type="button" className="sy-chip" aria-pressed={cams.has(c.key)} onClick={() => toggle(cams, setCams, c.key)} title={c.source}>
                {c.online === false && <Dot c={DOT.orange} />} {c.name}{c.source !== 'Eagle Eye' ? ` · ${c.source}` : ''}
              </button>
            ))}
          </div>
        )}
      </Card>

      <Card title="Gates & doors" sub={doors.size ? `${doors.size} picked` : 'None picked = all gates and doors show'}>
        {devices == null ? <div className="sy-empty">Loading…</div> : !devices.doors.length ? <div className="sy-empty">No gates or doors connected for this property yet (Setup &amp; keys).</div> : (
          <div className="sy-chips">
            {devices.doors.map(d => <button key={d.key} type="button" className="sy-chip" aria-pressed={doors.has(d.key)} onClick={() => toggle(doors, setDoors, d.key)}>{d.name}</button>)}
          </div>
        )}
      </Card>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" className="sy-b pri" disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : portal ? 'Save' : 'Turn on portal'}</button>
        {portal && portal.status !== 'live' && <button type="button" className="sy-b go" disabled={busy} onClick={() => void setStatus('live')}>Turn on</button>}
        {portal && portal.status === 'live' && <button type="button" className="sy-b line" disabled={busy} onClick={() => void setStatus('disabled')}>Turn off</button>}
        <span style={{ flex: 1 }} />
        {portal && !confirmDelete && <button type="button" className="sy-b warn sm" disabled={busy} onClick={() => setConfirmDelete(true)}>Delete portal</button>}
        {portal && confirmDelete && <>
          <span style={{ fontSize: 12, color: MUTED }}>Delete for good?</span>
          <button type="button" className="sy-b line sm" onClick={() => setConfirmDelete(false)}>Keep</button>
          <button type="button" className="sy-b warn sm" disabled={busy} onClick={() => void remove()}>Delete</button>
        </>}
      </div>
    </div>
  )
}
