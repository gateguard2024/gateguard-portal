'use client'
/**
 * Systems → Live → Cameras. One wall for Eagle Eye + Gate Guard Edge cameras
 * (1 / 4 / 9 / 16 layout, filter), tap a camera for the full Viewer (live,
 * timeline, playback, download), and Event search across both systems.
 *
 * Never breaks the existing setup: if the new /video route isn't reachable it
 * falls back to the Eagle Eye list it was given (the same wall as before).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { type Any, Card, Dot, DOT, LiveCam, MUTED, Note, NotConnected, getJson, previewUrl, type SiteCtx } from '../shared'
import { EdgeSnap, edgeUrl, type EdgePass } from './players'
import { Viewer, VIEWER_CSS, KIND_DOT, type Cam, type VEvent } from './Viewer'

const LAYOUTS = [1, 4, 9, 16] as const
const KINDS: [string, string][] = [['', 'Everything'], ['person', 'People'], ['vehicle', 'Vehicles'], ['plate', 'Plates'], ['motion', 'Motion'], ['alert', 'Alerts']]
const RANGES: [number, string][] = [[1, 'Last hour'], [24, 'Last 24 h'], [72, 'Last 3 days'], [168, 'Last 7 days']]

const CSS = `
.cw-bar{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px}
.cw-grid{display:grid;gap:8px}
.cw-grid.l1{grid-template-columns:1fr}.cw-grid.l4{grid-template-columns:repeat(2,minmax(0,1fr))}.cw-grid.l9{grid-template-columns:repeat(3,minmax(0,1fr))}.cw-grid.l16{grid-template-columns:repeat(4,minmax(0,1fr))}
.cw-src{position:absolute;top:8px;left:8px;font:600 10px -apple-system,system-ui,sans-serif;color:#fff;background:rgba(0,0,0,.45);border-radius:6px;padding:2px 6px}
.cw-res{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px}
.cw-r{display:block;text-align:left;border:0;background:#fff;border-radius:12px;box-shadow:0 1px 2px rgba(10,20,40,.06),0 4px 14px rgba(10,20,40,.06);padding:0;overflow:hidden;cursor:pointer;font:inherit;color:inherit}
.cw-r .im{aspect-ratio:16/9;background:#F2F2F7;display:flex;align-items:center;justify-content:center}
.cw-r .im img{width:100%;height:100%;object-fit:cover}
.cw-r .tx{padding:8px 10px;font-size:12px;color:#6E6E73}
.cw-r .tx b{display:block;font-size:13px;color:#1D1D1F;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@media (max-width:760px){.cw-grid.l9,.cw-grid.l16{grid-template-columns:repeat(2,minmax(0,1fr))}}
${VIEWER_CSS}`

function readLayout(): 1 | 4 | 9 | 16 { try { const n = Number(localStorage.getItem('gg_cam_layout')); return (LAYOUTS as readonly number[]).includes(n) ? n as 1 | 4 | 9 | 16 : 9 } catch { return 9 } }

export function CamerasTab({ ctx, fallbackCams, fallbackErr }: { ctx: SiteCtx; fallbackCams: Any[] | null; fallbackErr: string | null }) {
  const { siteId, isCorporate, openSetup } = ctx
  const [cams, setCams] = useState<Cam[] | null>(null)
  const [edge, setEdge] = useState<EdgePass | null>(null)
  const [errs, setErrs] = useState<Record<string, string>>({})
  const [fallback, setFallback] = useState(false)
  const [view, setView] = useState<'wall' | 'search'>('wall')
  const [layout, setLayoutState] = useState<1 | 4 | 9 | 16>(9)
  const [page, setPage] = useState(0)
  const [filter, setFilter] = useState('')
  const [open, setOpen] = useState<{ cam: Cam; at?: number | null } | null>(null)
  const [tick, setTick] = useState(0)
  const bad = useRef<Set<string>>(new Set())
  const [, force] = useState(0)

  useEffect(() => { setLayoutState(readLayout()) }, [])
  const setLayout = (n: 1 | 4 | 9 | 16) => { setLayoutState(n); setPage(0); try { localStorage.setItem('gg_cam_layout', String(n)) } catch { /* */ } }

  const load = useCallback(async () => {
    const r = await getJson(`/api/sites/${siteId}/video?view=cameras`)
    if (!r.ok || !Array.isArray(r.data.cameras)) { setFallback(true); setCams([]); return }
    setFallback(false); setCams(r.data.cameras); setEdge(r.data.edge ?? null); setErrs(r.data.errors ?? {})
  }, [siteId])
  useEffect(() => { void load() }, [load])
  // Renew the Edge pass before it expires (15 min).
  useEffect(() => {
    if (!edge) return
    const ms = Math.max(30_000, (edge.exp * 1000 - Date.now()) - 120_000)
    const t = setTimeout(() => { void getJson(`/api/sites/${siteId}/video?view=pass`).then(r => { if (r.ok && r.data.edge) setEdge(r.data.edge) }) }, ms)
    return () => clearTimeout(t)
  }, [edge, siteId])
  // Eagle Eye tiles refresh every 5 s (same as before).
  useEffect(() => { const t = setInterval(() => { if (!document.hidden) setTick(n => n + 1) }, 5000); return () => clearInterval(t) }, [])

  // Fallback = exactly the old Eagle Eye wall data.
  const list: Cam[] = useMemo(() => {
    if (fallback) return (fallbackCams ?? []).map(c => ({ key: `een:${c.id}`, provider: 'een' as const, id: String(c.id), name: String(c.name ?? 'Camera'), online: c.online ?? null }))
    return cams ?? []
  }, [fallback, fallbackCams, cams])
  const shown = useMemo(() => { const q = filter.trim().toLowerCase(); return q ? list.filter(c => c.name.toLowerCase().includes(q)) : list }, [list, filter])
  const pages = Math.max(1, Math.ceil(shown.length / layout))
  const pg = Math.min(page, pages - 1)
  const tiles = shown.slice(pg * layout, pg * layout + layout)
  const offline = list.filter(c => c.online === false).length
  const markBad = (k: string) => { if (!bad.current.has(k)) { bad.current.add(k); force(n => n + 1) } }
  const loading = cams == null && !fallback

  return (
    <>
      <style>{CSS}</style>
      <Card title={`Cameras${list.length ? ` (${list.length})` : ''}`}
        sub={list.length ? `${offline ? `${offline} offline · ` : ''}Tap a camera for live, timeline and playback` : 'Eagle Eye and Gate Guard Edge'}
        right={<div className="sy-chips" role="tablist" aria-label="Camera view">
          <button type="button" role="tab" className="sy-chip" aria-selected={view === 'wall'} aria-pressed={view === 'wall'} onClick={() => setView('wall')}>Camera wall</button>
          <button type="button" role="tab" className="sy-chip" aria-selected={view === 'search'} aria-pressed={view === 'search'} onClick={() => setView('search')}>Search events</button>
        </div>}>
        {errs.edge && <div style={{ marginBottom: 8 }}><Note tone="orange">Gate Guard Edge: {errs.edge}</Note></div>}
        {errs.een && <div style={{ marginBottom: 8 }}><Note tone="orange">Eagle Eye: {errs.een}</Note></div>}
        {view === 'wall' ? (
          loading ? <div className="sy-empty">Loading cameras…</div>
            : !list.length ? (fallbackErr && !/not connected|client id|secret|connect eagle|no eagle/i.test(fallbackErr) && !Object.keys(errs).length
              ? <Note tone="orange">Cameras didn’t load: {fallbackErr}</Note>
              : <NotConnected what="Cameras (Eagle Eye or Gate Guard Edge)" isCorporate={isCorporate} onSetup={openSetup} />)
            : <>
              <div className="cw-bar">
                <input className="sy-in" style={{ flex: '1 1 200px', maxWidth: 320 }} value={filter} onChange={e => { setFilter(e.target.value); setPage(0) }} placeholder="Find a camera" aria-label="Find a camera" />
                <div className="sy-acts">
                  <div className="sy-chips" role="group" aria-label="Layout">{LAYOUTS.map(n => <button key={n} type="button" className="sy-chip" aria-pressed={layout === n} onClick={() => setLayout(n)}>{n === 1 ? '1' : n === 4 ? '2×2' : n === 9 ? '3×3' : '4×4'}</button>)}</div>
                  {pages > 1 && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button type="button" className="sy-b line sm" onClick={() => setPage(Math.max(0, pg - 1))} disabled={pg === 0} aria-label="Previous cameras">‹</button>
                    <span style={{ fontSize: 12, color: MUTED }}>{pg + 1} of {pages}</span>
                    <button type="button" className="sy-b line sm" onClick={() => setPage(Math.min(pages - 1, pg + 1))} disabled={pg >= pages - 1} aria-label="Next cameras">›</button>
                  </div>}
                </div>
              </div>
              <div className={`cw-grid l${layout}`}>
                {tiles.map(c => {
                  const ok = c.online !== false && !bad.current.has(c.key)
                  return (
                    <button key={c.key} type="button" className="sy-cam" aria-label={`${c.name} — open`} onClick={() => setOpen({ cam: c })}>
                      {!ok ? <div className="off">{c.online === false ? 'Offline' : 'No live preview'}</div>
                        : c.provider === 'edge' ? (edge ? <EdgeSnap edge={edge} cam={c.id} everyMs={layout <= 4 ? 1000 : 2000} height={layout <= 4 ? 540 : 360} alt={c.name} onError={() => markBad(c.key)} /> : <div className="off">Edge not reachable</div>)
                        : <LiveCam src={previewUrl(siteId, c.id, tick)} alt={c.name} onError={() => markBad(c.key)} />}
                      {ok && <span className="lv"><Dot c={DOT.red} />Live</span>}
                      {c.online === false && <span className="lv"><Dot c={DOT.orange} />Offline</span>}
                      {!fallback && list.some(x => x.provider !== c.provider) && <span className="cw-src">{c.provider === 'edge' ? 'Edge' : 'Eagle Eye'}</span>}
                      <span className="nm">{c.name}</span>
                    </button>
                  )
                })}
              </div>
              {fallback && <div style={{ fontSize: 12, color: MUTED, marginTop: 8 }}>Showing Eagle Eye only — timeline and search will be back shortly.</div>}
            </>
        ) : <EventSearch siteId={siteId} cams={list} edge={edge} onOpen={(cam, at) => setOpen({ cam, at })} />}
      </Card>
      {open && <Viewer siteId={siteId} cam={open.cam} cams={list} edge={edge} startAt={open.at ?? null} onClose={() => setOpen(null)} />}
    </>
  )
}

function EventSearch({ siteId, cams, edge, onOpen }: { siteId: string; cams: Cam[]; edge: EdgePass | null; onOpen: (c: Cam, at: number) => void }) {
  const [camera, setCamera] = useState('')
  const [kind, setKind] = useState('')
  const [hours, setHours] = useState(24)
  const [day, setDay] = useState('')
  const [q, setQ] = useState('')
  const [qDeb, setQDeb] = useState('')
  const [res, setRes] = useState<{ events: VEvent[]; errors: Record<string, string> } | null>(null)
  useEffect(() => { const t = setTimeout(() => setQDeb(q), 350); return () => clearTimeout(t) }, [q])
  useEffect(() => {
    let alive = true
    setRes(null)
    let start: number, end: number
    if (day) { start = new Date(`${day}T00:00:00`).getTime(); end = Math.min(Date.now(), start + 864e5) } else { end = Date.now(); start = end - hours * 36e5 }
    const qs = new URLSearchParams({ view: 'events', start: new Date(start).toISOString(), end: new Date(end).toISOString(), ...(camera ? { camera } : {}), ...(kind ? { kind } : {}), ...(qDeb.trim() ? { q: qDeb.trim() } : {}) })
    void getJson(`/api/sites/${siteId}/video?${qs}`).then(r => { if (alive) setRes({ events: Array.isArray(r.data.events) ? r.data.events : [], errors: r.data.errors ?? (r.ok ? {} : { all: r.data.error || 'Search failed' }) }) })
    return () => { alive = false }
  }, [siteId, camera, kind, hours, day, qDeb])
  const camOf = (key: string, name: string): Cam => cams.find(c => c.key === key) ?? { key, provider: key.startsWith('edge:') ? 'edge' : 'een', id: key.replace(/^(een|edge):/, ''), name, online: null }
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input className="sy-in" style={{ flex: '1 1 220px' }} value={q} onChange={e => setQ(e.target.value)} placeholder="Search a plate, person, car, camera…" aria-label="Search events" />
        <select className="sy-in" style={{ width: 200, flex: 'none' }} value={camera} onChange={e => setCamera(e.target.value)} aria-label="Camera"><option value="">All cameras</option>{cams.map(c => <option key={c.key} value={c.key}>{c.name}</option>)}</select>
        <select className="sy-in" style={{ width: 150, flex: 'none' }} value={day ? '' : String(hours)} onChange={e => { setDay(''); setHours(Number(e.target.value)) }} aria-label="Time range">{RANGES.map(([h, l]) => <option key={h} value={h}>{l}</option>)}{day && <option value="">A chosen day</option>}</select>
        <input type="date" className="sy-in" style={{ width: 150, flex: 'none' }} value={day} max={new Date().toISOString().slice(0, 10)} onChange={e => setDay(e.target.value)} aria-label="Pick a day" />
      </div>
      <div className="sy-chips" role="group" aria-label="Event type">{KINDS.map(([k, l]) => <button key={k || 'all'} type="button" className="sy-chip" aria-pressed={kind === k} onClick={() => setKind(k)}>{l}</button>)}</div>
      {res && Object.entries(res.errors).map(([k, m]) => <Note key={k} tone="orange">{k === 'edge' ? 'Gate Guard Edge' : k === 'een' ? 'Eagle Eye' : 'Search'}: {m}</Note>)}
      {res == null ? <div className="sy-empty">Searching…</div> : !res.events.length ? <div className="sy-empty">No events match.</div> : (
        <>
          <div style={{ fontSize: 12, color: MUTED }}>{res.events.length} event{res.events.length === 1 ? '' : 's'} · tap one to play it</div>
          <div className="cw-res">
            {res.events.map(e => (
              <button key={e.key} type="button" className="cw-r" onClick={() => onOpen(camOf(e.cameraKey, e.cameraName), Date.parse(e.start) - 5000)}>
                <div className="im">
                  {e.provider === 'edge' && e.edgeId && edge
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img alt="" loading="lazy" src={edgeUrl(edge, `/api/events/${encodeURIComponent(e.edgeId)}/thumbnail.webp`)} />
                    : <Dot c={KIND_DOT[e.kind] ?? DOT.gray} />}
                </div>
                <div className="tx"><b>{e.plate ? `Plate ${e.plate}` : e.label}</b>{e.cameraName} · {new Date(e.start).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}{e.score ? ` · ${Math.round(e.score * 100)}%` : ''}</div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
