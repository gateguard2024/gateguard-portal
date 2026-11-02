'use client'

/**
 * VideoClient — the property portal's Vision tab. One camera list across
 * Eagle Eye (cloud) and Gate Guard Edge (Jetson + Frigate), from
 * /api/portal/[slug]/video (lib/video.ts — the same layer the dealer side uses).
 *
 *   Cameras — a featured player (a gate camera by default) + every camera.
 *             Eagle Eye = preview stills via /camera-preview (same as the dealer wall, every 5 s);
 *             Edge = live video straight from the device (MSE), snapshots as fallback.
 *             Tap a camera to feature it; "Playback & timeline" opens the shared
 *             Viewer (live ⇄ playback, timeline, events, 1-min clip download).
 *   Events  — search across both systems; tap one to play it.
 *
 * Black-frame detection: an Eagle Eye camera can report "online" yet send an
 * all-black frame (IR off / covered / dead sensor). We sample each frame's
 * luminance and show "No signal" instead of a false Live.
 * If the new route fails, falls back to the old Eagle Eye list (/summary).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { OpsShell, C } from '@/components/portal/ops/OpsShell'
import { Viewer, VIEWER_CSS, KIND_DOT, type Cam, type VEvent, type ViewerApi } from '@/components/nexus/systems/cameras/Viewer'
import { EdgeLive, EdgeSnap, edgeUrl, type EdgePass } from '@/components/nexus/systems/cameras/players'

const DOT = { live: '#34C759', off: '#FF3B30', warn: '#FF9500', gray: '#C7C7CC' }
const KINDS: [string, string][] = [['', 'Everything'], ['person', 'People'], ['vehicle', 'Vehicles'], ['plate', 'Plates'], ['motion', 'Motion'], ['alert', 'Alerts']]
const RANGES: [number, string][] = [[1, 'Last hour'], [24, 'Last 24 h'], [72, 'Last 3 days'], [168, 'Last 7 days']]

async function getJson(url: string): Promise<{ ok: boolean; data: any }> { // eslint-disable-line @typescript-eslint/no-explicit-any
  try { const r = await fetch(url, { cache: 'no-store' }); return { ok: r.ok, data: (await r.json().catch(() => ({}))) ?? {} } } catch (e) { return { ok: false, data: { error: e instanceof Error ? e.message : 'Network error' } } }
}

// Average luminance (0–255) of an image; null if pixels can't be read.
function frameLuma(img: HTMLImageElement): number | null {
  try {
    const w = 32, h = 18, cv = document.createElement('canvas'); cv.width = w; cv.height = h
    const ctx = cv.getContext('2d'); if (!ctx) return null
    ctx.drawImage(img, 0, 0, w, h)
    const { data } = ctx.getImageData(0, 0, w, h)
    let sum = 0
    for (let i = 0; i < data.length; i += 4) sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    return sum / (data.length / 4)
  } catch { return null }
}

/** Eagle Eye frame that refreshes every `everyMs`, flicker-free, with black-frame detection. */
function EenFrame({ src, everyMs, alt, onState }: { src: (t: number) => string; everyMs: number; alt: string; onState: (s: 'ok' | 'black' | 'error') => void }) {
  const [url, setUrl] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const cur = useRef<string | null>(null)
  const fails = useRef(0)
  const stateRef = useRef(onState); stateRef.current = onState
  useEffect(() => { const t = setInterval(() => { if (!document.hidden) setTick(n => n + 1) }, everyMs); return () => clearInterval(t) }, [everyMs])
  useEffect(() => {
    let dead = false
    fetch(src(tick), { cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.blob() })
      .then(b => {
        if (dead || !b.size) return
        fails.current = 0
        const next = URL.createObjectURL(b), prev = cur.current
        cur.current = next; setUrl(next)
        if (prev) setTimeout(() => URL.revokeObjectURL(prev), 1000)
      })
      .catch(() => { if (!dead && ++fails.current >= 2) stateRef.current('error') })
    return () => { dead = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick])
  useEffect(() => () => { if (cur.current) URL.revokeObjectURL(cur.current) }, [])
  if (!url) return <div className="vz-off">Connecting…</div>
  // eslint-disable-next-line @next/next/no-img-element
  return <img alt={alt} src={url} onLoad={e => { const l = frameLuma(e.currentTarget); stateRef.current(l != null && l < 11 ? 'black' : 'ok') }} />
}

const CSS = `
.vz-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:18px}
.vz-h1{margin:0;font-size:28px;font-weight:600;letter-spacing:-.02em}
.vz-sub{font-size:13px;color:${C.ink3};margin-top:2px}
.vz-seg{display:inline-flex;gap:2px;padding:3px;border-radius:10px;background:rgba(0,0,0,.05)}
.vz-seg button{min-height:36px;padding:0 14px;border:0;border-radius:8px;background:none;font:500 13px inherit;color:${C.ink2};cursor:pointer}
.vz-seg button[aria-pressed=true]{background:#fff;color:${C.ink};font-weight:600;box-shadow:0 1px 2px rgba(0,0,0,.08)}
.vz-card{background:#fff;border-radius:12px;box-shadow:0 1px 2px rgba(0,0,0,.04),0 6px 20px -12px rgba(0,0,0,.18);overflow:hidden;min-width:0}
.vz-wrap{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:16px;align-items:start}
.vz-stage{position:relative;aspect-ratio:16/9;background:#0b0b0d}
.vz-stage img,.vz-stage video,.vz-tile img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.vz-stage video{object-fit:contain}
.vz-off{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:10px;color:rgba(255,255,255,.7);font-size:13px}
.vz-top{position:absolute;left:0;right:0;top:0;display:flex;justify-content:space-between;align-items:center;gap:8px;padding:12px 14px;background:linear-gradient(180deg,rgba(0,0,0,.55),transparent);color:#fff;font-weight:600;font-size:15px;pointer-events:none}
.vz-pill{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:600;letter-spacing:.02em}
.vz-dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex:none}
.vz-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:12px 14px}
.vz-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:40px;padding:0 14px;border-radius:10px;border:1px solid rgba(0,0,0,.12);background:#fff;color:${C.ink};font:600 13px inherit;cursor:pointer}
.vz-btn.pri{background:${C.blue};border-color:${C.blue};color:#fff}
.vz-btn:disabled{opacity:.5;cursor:default}
.vz-gh{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid rgba(0,0,0,.06);font-weight:600}
.vz-gh span{font-weight:400;font-size:13px;color:${C.ink3}}
.vz-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:12px;max-height:560px;overflow-y:auto}
.vz-tile{position:relative;aspect-ratio:16/10;border-radius:10px;overflow:hidden;background:#0b0b0d;border:0;padding:0;cursor:pointer;outline-offset:2px}
.vz-tile.on{box-shadow:0 0 0 2px ${C.blue}}
.vz-nm{position:absolute;left:8px;bottom:6px;right:8px;text-align:left;font-size:12px;font-weight:600;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.9);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vz-st{position:absolute;right:8px;top:7px}
.vz-src{position:absolute;left:8px;top:7px;font-size:10px;font-weight:600;color:#fff;background:rgba(0,0,0,.45);border-radius:6px;padding:2px 6px}
.vz-note{font-size:13px;color:#8A3D00;background:#FFF4E5;border-radius:10px;padding:10px 12px;margin-bottom:12px}
.vz-in{min-height:40px;border:1px solid rgba(0,0,0,.12);border-radius:10px;padding:0 12px;font:14px inherit;background:#fff;color:${C.ink};box-sizing:border-box}
.vz-chips{display:flex;flex-wrap:wrap;gap:6px}
.vz-chip{min-height:34px;padding:0 12px;border-radius:999px;border:1px solid rgba(0,0,0,.12);background:#fff;font:500 13px inherit;color:${C.ink2};cursor:pointer}
.vz-chip[aria-pressed=true]{background:rgba(0,113,227,.08);border-color:rgba(0,113,227,.45);color:${C.blue};font-weight:600}
.vz-res{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}
.vz-r{display:block;text-align:left;border:0;background:#fff;border-radius:12px;box-shadow:0 1px 2px rgba(0,0,0,.05),0 4px 14px rgba(0,0,0,.06);padding:0;overflow:hidden;cursor:pointer;font:inherit;color:inherit}
.vz-r .im{position:relative;aspect-ratio:16/9;background:#F2F2F7;display:flex;align-items:center;justify-content:center}
.vz-r .im img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.vz-r .tx{padding:8px 10px;font-size:12px;color:${C.ink3}}
.vz-r .tx b{display:block;font-size:13px;color:${C.ink};font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vz-empty{padding:28px 12px;text-align:center;color:${C.ink3};font-size:13px}
.vz-sr{position:absolute;left:-9999px}
@media (max-width:1000px){.vz-wrap{grid-template-columns:1fr}.vz-grid{max-height:none}}
${VIEWER_CSS}`

function Inner({ slug }: { slug: string }) {
  const api: ViewerApi = useMemo(() => ({
    video: qs => `/api/portal/${slug}/video?${qs}`,
    preview: (id, t) => `/api/portal/${slug}/camera-preview?camera_id=${encodeURIComponent(id)}&t=${t}`,
    clip: (id, ts) => `/api/portal/${slug}/camera-clip?camera_id=${encodeURIComponent(id)}&ts=${encodeURIComponent(ts)}`,
  }), [slug])
  const [cams, setCams] = useState<Cam[] | null>(null)
  const [edge, setEdge] = useState<EdgePass | null>(null)
  const [errs, setErrs] = useState<Record<string, string>>({})
  const [fallback, setFallback] = useState(false)
  const [tab, setTab] = useState<'cameras' | 'events'>('cameras')
  const [sel, setSel] = useState<string | null>(null)
  const [state, setState] = useState<Record<string, 'ok' | 'black' | 'error'>>({})
  const [liveFail, setLiveFail] = useState<string | null>(null)
  const [open, setOpen] = useState<{ cam: Cam; at?: number | null } | null>(null)

  const load = useCallback(async () => {
    const r = await getJson(api.video('view=cameras'))
    let list: Cam[]
    if (r.ok && Array.isArray(r.data.cameras)) {
      list = r.data.cameras; setEdge(r.data.edge ?? null); setErrs(r.data.errors ?? {}); setFallback(false)
    } else {
      const s = await getJson(`/api/portal/${slug}/summary`)
      list = (s.data.cameras ?? []).map((c: { id: string; name: string; online?: boolean }) => ({ key: `een:${c.id}`, provider: 'een' as const, id: String(c.id), name: String(c.name ?? 'Camera'), online: c.online ?? null }))
      setFallback(true)
    }
    setCams(list)
    setSel(cur => cur ?? (list.find(c => /gate/i.test(c.name)) ?? list[0])?.key ?? null)
  }, [api, slug])
  useEffect(() => { void load() }, [load])
  // Renew the Edge pass two minutes before it expires (15 min).
  useEffect(() => {
    if (!edge) return
    const t = setTimeout(() => { void getJson(api.video('view=pass')).then(r => { if (r.ok && r.data.edge) setEdge(r.data.edge) }) }, Math.max(30_000, edge.exp * 1000 - Date.now() - 120_000))
    return () => clearTimeout(t)
  }, [edge, api])

  const list = cams ?? []
  const featured = list.find(c => c.key === sel) ?? list[0] ?? null
  useEffect(() => { setLiveFail(null) }, [featured?.key])
  const mark = useCallback((k: string, s: 'ok' | 'black' | 'error') => setState(m => m[k] === s ? m : { ...m, [k]: s }), [])
  const isOff = (c: Cam) => c.online === false || state[c.key] === 'black' || state[c.key] === 'error'
  const mixed = list.some(c => c.provider === 'edge') && list.some(c => c.provider === 'een')
  const online = list.filter(c => !isOff(c)).length
  const sources = [list.some(c => c.provider === 'een') && 'Eagle Eye', list.some(c => c.provider === 'edge') && 'Gate Guard Edge'].filter(Boolean).join(' + ')

  const picture = (c: Cam, big: boolean) => {
    if (c.online === false) return <div className="vz-off">Camera offline</div>
    if (c.provider === 'edge') {
      if (!edge) return <div className="vz-off">The Edge device isn’t reachable right now.</div>
      if (big && !liveFail) return <EdgeLive key={c.key} edge={edge} cam={c.id} onFail={setLiveFail} />
      return <EdgeSnap edge={edge} cam={c.id} everyMs={big ? 1000 : 5000} height={big ? 720 : 270} alt={c.name} onError={() => mark(c.key, 'error')} />
    }
    if (state[c.key] === 'black') return <div className="vz-off">No signal: the camera is sending a black picture</div>
    if (state[c.key] === 'error') return <div className="vz-off">No picture from this camera</div>
    return <EenFrame key={c.key + (big ? ':big' : '')} src={t => api.preview(c.id, t)} everyMs={big ? 3000 : 5000} alt={c.name} onState={s => mark(c.key, s)} />
  }

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="vz-head">
        <div>
          <h1 className="vz-h1">Vision</h1>
          <div className="vz-sub">{cams == null ? 'Loading cameras…' : `${online} of ${list.length} cameras live${sources ? ` · ${sources}` : ''}`}</div>
        </div>
        <div className="vz-seg" role="tablist" aria-label="Vision view">
          <button type="button" role="tab" aria-selected={tab === 'cameras'} aria-pressed={tab === 'cameras'} onClick={() => setTab('cameras')}>Cameras</button>
          <button type="button" role="tab" aria-selected={tab === 'events'} aria-pressed={tab === 'events'} onClick={() => setTab('events')} disabled={fallback}>Events</button>
        </div>
      </div>

      {errs.edge && <div className="vz-note">Gate Guard Edge: {errs.edge}</div>}
      {errs.een && <div className="vz-note">Eagle Eye: {errs.een}</div>}
      {fallback && <div className="vz-note">Showing Eagle Eye pictures only. Playback and event search will be back shortly.</div>}

      {tab === 'events' && !fallback ? <EventSearch api={api} cams={list} edge={edge} onOpen={(cam, at) => setOpen({ cam, at })} />
        : cams == null ? <div className="vz-card"><div className="vz-empty">Loading cameras…</div></div>
        : !list.length ? <div className="vz-card"><div className="vz-empty">No cameras are connected to this property yet.</div></div>
        : (
          <div className="vz-wrap">
            {featured && (
              <section className="vz-card" aria-label={`${featured.name} live`}>
                <div className="vz-stage">
                  {picture(featured, true)}
                  <div className="vz-top">
                    <span>{featured.name}</span>
                    {!isOff(featured) && <span className="vz-pill"><span className="vz-dot" style={{ background: DOT.off }} />{featured.provider === 'edge' && liveFail ? 'SNAPSHOTS' : 'LIVE'}</span>}
                  </div>
                </div>
                <div className="vz-bar">
                  <button type="button" className="vz-btn pri" onClick={() => setOpen({ cam: featured })} disabled={fallback}>Playback &amp; timeline</button>
                  <button type="button" className="vz-btn" onClick={() => setOpen({ cam: featured, at: Date.now() - 5 * 60_000 })} disabled={fallback}>Rewind 5 min</button>
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 13, color: C.ink3 }}>{featured.provider === 'edge' ? 'Gate Guard Edge' : 'Eagle Eye'}</span>
                </div>
              </section>
            )}
            <section className="vz-card" aria-label="All cameras">
              <div className="vz-gh">All cameras <span>{online}/{list.length} live</span></div>
              <div className="vz-grid">
                {list.map(c => (
                  <button key={c.key} type="button" className={`vz-tile${c.key === featured?.key ? ' on' : ''}`} onClick={() => setSel(c.key)} onDoubleClick={() => { if (!fallback) setOpen({ cam: c }) }} aria-label={`Show ${c.name}`} aria-pressed={c.key === featured?.key}>
                    {c.key === featured?.key ? <div className="vz-off">Showing above</div> : picture(c, false)}
                    {mixed && <span className="vz-src">{c.provider === 'edge' ? 'Edge' : 'Eagle Eye'}</span>}
                    <span className="vz-st"><span className="vz-dot" style={{ background: isOff(c) ? DOT.off : DOT.live }} /></span>
                    <span className="vz-nm">{c.name}</span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}

      {open && <Viewer siteId={slug} api={api} cam={open.cam} cams={list} edge={edge} startAt={open.at ?? null} onClose={() => setOpen(null)} />}
    </div>
  )
}

function EventSearch({ api, cams, edge, onOpen }: { api: ViewerApi; cams: Cam[]; edge: EdgePass | null; onOpen: (c: Cam, at: number) => void }) {
  const [camera, setCamera] = useState('')
  const [kind, setKind] = useState('')
  const [hours, setHours] = useState(24)
  const [q, setQ] = useState('')
  const [qDeb, setQDeb] = useState('')
  const [res, setRes] = useState<{ events: VEvent[]; errors: Record<string, string> } | null>(null)
  useEffect(() => { const t = setTimeout(() => setQDeb(q), 350); return () => clearTimeout(t) }, [q])
  useEffect(() => {
    let alive = true
    setRes(null)
    const end = Date.now(), start = end - hours * 36e5
    const qs = new URLSearchParams({ view: 'events', start: new Date(start).toISOString(), end: new Date(end).toISOString(), ...(camera ? { camera } : {}), ...(kind ? { kind } : {}), ...(qDeb.trim() ? { q: qDeb.trim() } : {}) })
    void getJson(api.video(qs.toString())).then(r => { if (alive) setRes({ events: Array.isArray(r.data.events) ? r.data.events : [], errors: r.data.errors ?? (r.ok ? {} : { all: r.data.error || 'Search failed' }) }) })
    return () => { alive = false }
  }, [api, camera, kind, hours, qDeb])
  const camOf = (key: string, name: string): Cam => cams.find(c => c.key === key) ?? { key, provider: key.startsWith('edge:') ? 'edge' : 'een', id: key.replace(/^(een|edge):/, ''), name, online: null }
  return (
    <div className="vz-card" style={{ padding: 16, display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <label style={{ flex: '1 1 220px', display: 'flex' }}><span className="vz-sr">Search events</span><input className="vz-in" style={{ width: '100%' }} value={q} onChange={e => setQ(e.target.value)} placeholder="Search a plate, person, car, camera…" /></label>
        <label><span className="vz-sr">Camera</span><select className="vz-in" value={camera} onChange={e => setCamera(e.target.value)}><option value="">All cameras</option>{cams.map(c => <option key={c.key} value={c.key}>{c.name}</option>)}</select></label>
        <label><span className="vz-sr">Time range</span><select className="vz-in" value={hours} onChange={e => setHours(Number(e.target.value))}>{RANGES.map(([h, l]) => <option key={h} value={h}>{l}</option>)}</select></label>
      </div>
      <div className="vz-chips" role="group" aria-label="Event type">{KINDS.map(([k, l]) => <button key={k || 'all'} type="button" className="vz-chip" aria-pressed={kind === k} onClick={() => setKind(k)}>{l}</button>)}</div>
      {res && Object.entries(res.errors).map(([k, m]) => <div key={k} className="vz-note" style={{ margin: 0 }}>{k === 'edge' ? 'Gate Guard Edge' : k === 'een' ? 'Eagle Eye' : 'Search'}: {m}</div>)}
      {res == null ? <div className="vz-empty">Searching…</div> : !res.events.length ? <div className="vz-empty">No events match.</div> : (
        <>
          <div style={{ fontSize: 13, color: C.ink3 }}>{res.events.length} event{res.events.length === 1 ? '' : 's'} · tap one to play it</div>
          <div className="vz-res">
            {res.events.map(e => (
              <button key={e.key} type="button" className="vz-r" onClick={() => onOpen(camOf(e.cameraKey, e.cameraName), Date.parse(e.start) - 5000)}>
                <div className="im">
                  {e.provider === 'edge' && e.edgeId && edge
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img alt="" loading="lazy" src={edgeUrl(edge, `/api/events/${encodeURIComponent(e.edgeId)}/thumbnail.webp`)} />
                    : <span className="vz-dot" style={{ width: 12, height: 12, background: KIND_DOT[e.kind] ?? DOT.gray }} />}
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

export default function VideoClient({ slug, displayName }: { slug: string; displayName: string }) {
  return <OpsShell slug={slug} displayName={displayName} active="video"><Inner slug={slug} /></OpsShell>
}
