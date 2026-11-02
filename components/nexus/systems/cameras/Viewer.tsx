'use client'
/**
 * One camera, laid out like Frigate's recording view:
 *   left  — the big player (live ⇄ playback) with a control bar under it and a
 *           strip of the property's other cameras (switching keeps your time).
 *   right — a vertical timeline, newest at the top: recorded spans shaded,
 *           events marked, the playhead. Click or drag it to play from that
 *           moment; zoom 24 h / 6 h / 1 h; any past day. Flip to "Events" for
 *           the list with thumbnails. Alerts / Detections / Motion filter both.
 * Works for Eagle Eye (existing preview + clip routes) and Gate Guard Edge
 * (straight from the device with a pass).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DOT, LiveCam, getJson, previewUrl, clipUrl } from '../shared'
import { EdgeLive, EdgeSnap, HlsVideo, camPath, edgeUrl, type EdgePass } from './players'

export type Cam = { key: string; provider: 'een' | 'edge'; id: string; name: string; online: boolean | null }
export type VEvent = { key: string; provider: 'een' | 'edge'; cameraKey: string; cameraName: string; label: string; kind: string; start: string; end: string | null; plate: string | null; score: number | null; edgeId: string | null; hasClip: boolean }

export const KIND_DOT: Record<string, string> = { person: DOT.blue, vehicle: DOT.green, plate: DOT.green, animal: DOT.gray, motion: DOT.gray, alert: DOT.red, system: DOT.gray, other: DOT.gray }

// Frigate's three review groups.
type Group = 'alert' | 'detection' | 'motion'
export const groupOf = (kind: string): Group => kind === 'alert' || kind === 'plate' ? 'alert' : kind === 'motion' || kind === 'system' ? 'motion' : 'detection'
const GROUPS: [Group, string, string][] = [['alert', 'Alerts', '#FF453A'], ['detection', 'Detections', '#FF9F0A'], ['motion', 'Motion', '#8E8E93']]
const GROUP_COLOR: Record<Group, string> = { alert: '#FF453A', detection: '#FF9F0A', motion: '#8E8E93' }

const MIN = 60e3, HOUR = 36e5, PAD = 18
const ZOOMS = [
  { label: '24 h', ppm: 0.6, major: 3 * HOUR, minor: HOUR },
  { label: '6 h', ppm: 2, major: HOUR, minor: 15 * MIN },
  { label: '1 h', ppm: 8, major: 15 * MIN, minor: 5 * MIN },
] as const
const SPEEDS = [0.5, 1, 2, 4, 8]

// ── Timeline loading, fast ────────────────────────────────────────────────────
// The day is fetched in 3-hour pieces, the piece you're looking at first, 3 at a
// time, and each piece draws as soon as it lands (no waiting for the whole day).
// Pieces that are fully in the past never change, so they're kept for the
// session: reopening a camera, switching back, zooming or the 5-minute refresh
// only re-asks for the newest piece.
const CHUNK = 3 * HOUR
type Seg = { start: string; end: string }
type Piece = { segs: Seg[]; events: VEvent[]; err: string | null; at: number }
const pieceCache = new Map<string, Piece>()
const keepPiece = (k: string, p: Piece) => { pieceCache.set(k, p); if (pieceCache.size > 400) pieceCache.delete(pieceCache.keys().next().value as string) }
const mergeSegs = (all: Seg[]) => {
  const out: Seg[] = []
  for (const s of all.slice().sort((a, b) => a.start.localeCompare(b.start))) {
    const last = out[out.length - 1]
    if (last && Date.parse(s.start) - Date.parse(last.end) <= 2000) { if (s.end > last.end) last.end = s.end } else out.push({ ...s })
  }
  return out
}

const fmtT = (ms: number, withDay = false, sec = true) => new Date(ms).toLocaleString(undefined, { ...(withDay ? { month: 'short', day: 'numeric' } : {}), hour: 'numeric', minute: '2-digit', ...(sec ? { second: '2-digit' } : {}) })
const localDayStart = (ymd: string) => new Date(`${ymd}T00:00:00`).getTime()
const ymdOf = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

/** Where the viewer reads from. Dealer side = the default; the property portal passes its PIN-gated routes. */
export type ViewerApi = { video: (qs: string) => string; preview: (camId: string, t: number) => string; clip: (camId: string, ts: string) => string }
export const siteViewerApi = (siteId: string): ViewerApi => ({
  video: qs => `/api/sites/${siteId}/video?${qs}`,
  preview: (camId, t) => previewUrl(siteId, camId, t),
  clip: (camId, ts) => clipUrl(siteId, camId, ts),
})

export function Viewer({ siteId, api: apiProp, cam: firstCam, cams, edge, startAt, onClose }: { siteId: string; api?: ViewerApi; cam: Cam; cams?: Cam[]; edge: EdgePass | null; startAt?: number | null; onClose: () => void }) {
  const api = useMemo(() => apiProp ?? siteViewerApi(siteId), [apiProp, siteId])
  const [cam, setCam] = useState<Cam>(firstCam)
  const isEdge = cam.provider === 'edge'
  const [mode, setMode] = useState<'live' | 'play'>(startAt ? 'play' : 'live')
  const [playAt, setPlayAt] = useState<number>(startAt ?? Date.now() - 5 * MIN)
  const [offset, setOffset] = useState(0)             // seconds played since playAt
  const [paused, setPaused] = useState(false)
  const [rate, setRate] = useState(1)
  const [err, setErr] = useState<string | null>(null)
  const [liveFail, setLiveFail] = useState<string | null>(null)
  const [day, setDay] = useState<string | null>(startAt && startAt < Date.now() - 23 * HOUR ? ymdOf(startAt) : null)
  const [zoom, setZoom] = useState<0 | 1 | 2>(1)
  const [panel, setPanel] = useState<'timeline' | 'events'>('timeline')
  const [show, setShow] = useState<Record<Group, boolean>>({ alert: true, detection: true, motion: true })
  const [pieces, setPieces] = useState<Record<number, Piece>>({})
  const [loadingPieces, setLoadingPieces] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const vref = useRef<HTMLVideoElement>(null)
  const stage = useRef<HTMLDivElement>(null)

  // The clock moves the "now" edge; the data refetches every 5 minutes (or on a new day/camera).
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 15_000); return () => clearInterval(t) }, [])
  const refresh = day ?? String(Math.floor(now / (5 * MIN)))
  const win = useMemo(() => day ? { start: localDayStart(day), end: Math.min(localDayStart(day) + 24 * HOUR, now) } : { start: now - 24 * HOUR, end: now }, [day, now])

  // Where the person is looking — that piece loads first.
  const focusRef = useRef<number>(startAt ?? Date.now())
  useEffect(() => {
    let alive = true
    const t0 = Date.now()
    const s = day ? localDayStart(day) : t0 - 24 * HOUR
    const e = day ? Math.min(s + 24 * HOUR, t0) : t0
    const starts: number[] = []
    for (let c = Math.floor(s / CHUNK) * CHUNK; c < e; c += CHUNK) starts.push(c)
    const focus = Math.min(e, Math.max(s, focusRef.current))
    starts.sort((a, b) => (a <= focus && focus < a + CHUNK ? -1 : b <= focus && focus < b + CHUNK ? 1 : b - a))
    const keyOf = (c: number) => `${api.video('')}|${cam.key}|${c}`
    const ready: Record<number, Piece> = {}
    const todo: number[] = []
    for (const c of starts) {
      const hit = pieceCache.get(keyOf(c))
      const growing = c + CHUNK > t0 - 10 * MIN            // still recording into it
      if (hit) ready[c] = hit                               // show what we have right away
      if (!hit || (growing && t0 - hit.at > 4 * MIN)) todo.push(c)
    }
    setPieces(ready); setLoadingPieces(todo.length)
    let i = 0
    const worker = async () => {
      while (alive && i < todo.length) {
        const c = todo[i++]
        const q = `start=${encodeURIComponent(new Date(c).toISOString())}&end=${encodeURIComponent(new Date(Math.min(c + CHUNK, Date.now())).toISOString())}&camera=${encodeURIComponent(cam.key)}`
        const [t, ev] = await Promise.all([getJson(api.video(`view=timeline&${q}`)), getJson(api.video(`view=events&${q}`))])
        const piece: Piece = {
          segs: Array.isArray(t.data.segments) ? t.data.segments : [],
          events: Array.isArray(ev.data.events) ? ev.data.events : [],
          err: t.data.error || (!t.ok ? 'Timeline unavailable.' : null),
          at: Date.now(),
        }
        if (!piece.err && t.ok) keepPiece(keyOf(c), piece)   // never keep a failed answer
        if (!alive) return
        setPieces(p => ({ ...p, [c]: piece }))
        setLoadingPieces(n => Math.max(0, n - 1))
      }
    }
    void Promise.all([worker(), worker(), worker()])
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, cam.key, refresh])
  const loadedList = Object.values(pieces)
  const segs = useMemo(() => (loadedList.length ? mergeSegs(loadedList.flatMap(p => p.segs)) : null), [pieces]) // eslint-disable-line react-hooks/exhaustive-deps
  const events = useMemo(() => {
    if (!loadedList.length) return null
    const seen = new Map<string, VEvent>()
    for (const p of loadedList) for (const ev of p.events) seen.set(ev.key, ev)
    return [...seen.values()].sort((a, b) => Date.parse(b.start) - Date.parse(a.start))
  }, [pieces]) // eslint-disable-line react-hooks/exhaustive-deps
  const tlErr = loadedList.find(p => p.err)?.err ?? null

  const pos = mode === 'live' ? now : playAt + offset * 1000
  focusRef.current = pos
  const playFrom = useCallback((ms: number) => {
    const t = Math.min(Date.now() - 2000, Math.max(0, ms))
    setErr(null); setMode('play'); setOffset(0); setPaused(false); setPlayAt(t)
  }, [])
  const goLive = () => { setMode('live'); setErr(null); setLiveFail(null); if (day) setDay(null) }
  const skip = (sec: number) => {
    if (mode === 'live') { if (sec < 0) playFrom(Date.now() + sec * 1000 - 2000); return }
    const v = vref.current
    if (v && v.duration && isFinite(v.duration) && v.currentTime + sec >= 0 && v.currentTime + sec <= v.duration) { v.currentTime += sec; return }
    playFrom(pos + sec * 1000)
  }
  const togglePlay = () => {
    if (mode === 'live') { playFrom(Date.now() - 10_000); return }
    const v = vref.current; if (!v) return
    if (v.paused) { void v.play(); setPaused(false) } else { v.pause(); setPaused(true) }
  }
  const switchCam = (c: Cam) => {
    if (c.key === cam.key) return
    const at = pos
    setCam(c); setLiveFail(null); setErr(null)
    if (mode === 'play') { setOffset(0); setPlayAt(at) }
  }
  const fullscreen = () => { const el = stage.current; if (!el) return; if (document.fullscreenElement) void document.exitFullscreen(); else void el.requestFullscreen?.() }

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'SELECT') return
      if (e.key === 'Escape') { if (!document.fullscreenElement) onClose() }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); skip(e.shiftKey ? -60 : -10) }
      else if (e.key === 'ArrowRight') { e.preventDefault(); skip(e.shiftKey ? 60 : 10) }
      else if (e.key === 'l' || e.key === 'L') goLive()
      else if (e.key === 'f' || e.key === 'F') fullscreen()
      else if (e.key === ' ') { e.preventDefault(); togglePlay() }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  })
  // Lock the page behind the viewer.
  useEffect(() => { const o = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = o } }, [])

  const s = Math.floor(playAt / 1000)
  const vodUrl = edge && isEdge ? `${edge.base}/vod/${camPath(cam.id)}/start/${s}/end/${Math.min(Math.floor(Date.now() / 1000), s + 3600)}/index.m3u8` : ''
  const clipFrom = Math.floor(pos / 1000) - 10
  const downloadUrl = isEdge && edge
    ? edgeUrl(edge, `/api/${camPath(cam.id)}/start/${clipFrom}/end/${clipFrom + 60}/clip.mp4?download=true`)
    : api.clip(cam.id, new Date(pos - 10000).toISOString())

  function saveFrame() {
    const v = vref.current
    if (v && mode === 'play' && v.videoWidth) {
      try {
        const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight
        c.getContext('2d')?.drawImage(v, 0, 0)
        c.toBlob(b => { if (!b) return; const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `${cam.name}-${new Date(pos).toISOString().replace(/[:.]/g, '-')}.jpg`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000) }, 'image/jpeg', 0.92)
        return
      } catch { /* cross-origin frame — fall through to the camera's snapshot */ }
    }
    window.open(isEdge && edge ? edgeUrl(edge, `/api/${camPath(cam.id)}/latest.jpg`) : api.preview(cam.id, Date.now()), '_blank', 'noopener')
  }

  const shownEvents = useMemo(() => (events ?? []).filter(e => show[groupOf(e.kind)]), [events, show])
  const counts = useMemo(() => { const c: Record<Group, number> = { alert: 0, detection: 0, motion: 0 }; for (const e of events ?? []) c[groupOf(e.kind)]++; return c }, [events])
  const others = cams ?? []

  return (
    <div className="cv" role="dialog" aria-modal="true" aria-label={cam.name}>
      <div className="cv-hd">
        <button type="button" className="cv-btn" onClick={onClose} aria-label="Back to cameras">‹ Done</button>
        <div className="cv-title">
          <div className="cv-t">{cam.name}</div>
          <div className="cv-s"><span className="dot" style={{ background: cam.online === false ? DOT.orange : DOT.green }} />{isEdge ? 'Gate Guard Edge' : 'Eagle Eye'} · {mode === 'live' ? 'Live' : `Playback · ${fmtT(pos, true)}`}</div>
        </div>
        <div className="cv-hacts">
          <div className="cv-seg" role="group" aria-label="Day">
            <button type="button" aria-pressed={!day} onClick={() => setDay(null)}>Last 24 h</button>
            <input type="date" aria-label="Pick a day" max={ymdOf(Date.now())} value={day ?? ''} onChange={e => { const v = e.target.value || null; setDay(v); if (v) playFrom(localDayStart(v) + 12 * HOUR > Date.now() ? Date.now() - HOUR : localDayStart(v) + 8 * HOUR) }} />
          </div>
          <button type="button" className={`cv-btn ${mode === 'live' ? 'on' : ''}`} onClick={goLive} aria-pressed={mode === 'live'}>{mode === 'live' ? '● Live' : 'Go live'}</button>
        </div>
      </div>

      <div className="cv-body">
        <div className="cv-main">
          <div className="cv-stage" ref={stage}>
            {mode === 'live' ? (
              isEdge && edge ? (liveFail ? <><EdgeSnap edge={edge} cam={cam.id} everyMs={1000} height={720} alt={cam.name} /><span className="cv-tag">Snapshots · {liveFail}</span></>
                : <EdgeLive key={cam.key} edge={edge} cam={cam.id} onFail={setLiveFail} />)
                : isEdge ? <div className="off">The Edge device isn’t reachable right now.</div>
                : <LiveCamRefresh key={cam.key} src={t => api.preview(cam.id, t)} name={cam.name} />
            ) : isEdge && edge ? (
              <HlsVideo key={vodUrl} ref={vref} url={vodUrl} pass={edge.pass} rate={rate} controls={false} onError={setErr} onTime={t => setOffset(t)} />
            ) : (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video key={`${cam.key}-${playAt}`} ref={vref} autoPlay playsInline src={api.clip(cam.id, new Date(playAt).toISOString())}
                onTimeUpdate={e => setOffset((e.target as HTMLVideoElement).currentTime)} onError={() => setErr('No recording for that time.')}
                onLoadedMetadata={e => { (e.target as HTMLVideoElement).playbackRate = rate }}
                onEnded={() => playFrom(pos + 1000)}
                style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }} />
            )}
            {mode === 'live' && <span className="cv-live"><span className="dot" style={{ background: DOT.red }} />Live</span>}
            <span className="cv-clock">{fmtT(pos, true)}</span>
            {err && <div className="cv-err">{err}</div>}
          </div>

          <div className="cv-ctl">
            <div className="grp">
              <button type="button" className="cv-ib" onClick={togglePlay} aria-label={mode === 'play' && !paused ? 'Pause' : 'Play'}>{mode === 'play' && !paused ? '❚❚' : '▶'}</button>
              <button type="button" className="cv-ib" onClick={() => skip(-60)} aria-label="Back 1 minute">−1m</button>
              <button type="button" className="cv-ib" onClick={() => skip(-10)} aria-label="Back 10 seconds">−10s</button>
              <button type="button" className="cv-ib" onClick={() => skip(10)} aria-label="Forward 10 seconds" disabled={mode === 'live'}>+10s</button>
              <button type="button" className="cv-ib" onClick={() => skip(60)} aria-label="Forward 1 minute" disabled={mode === 'live'}>+1m</button>
              <select className="cv-sel" aria-label="Speed" value={rate} disabled={mode === 'live'} onChange={e => { const r = Number(e.target.value); setRate(r); if (vref.current) vref.current.playbackRate = r }}>
                {SPEEDS.map(r => <option key={r} value={r}>{r}×</option>)}
              </select>
            </div>
            <div className="grp">
              <a className="cv-btn" href={downloadUrl} target="_blank" rel="noopener noreferrer" download>Download 1-min clip</a>
              <button type="button" className="cv-btn" onClick={saveFrame}>Save frame</button>
              <button type="button" className="cv-ib" onClick={fullscreen} aria-label="Full screen">⛶</button>
            </div>
          </div>

          {others.length > 1 && (
            <div className="cv-strip" role="group" aria-label="Other cameras">
              {others.slice(0, 24).map(c => (
                <button key={c.key} type="button" className={`cv-thumb ${c.key === cam.key ? 'on' : ''}`} onClick={() => switchCam(c)} aria-label={`Switch to ${c.name}`} aria-current={c.key === cam.key}>
                  {c.online === false ? <div className="off">Offline</div>
                    : c.provider === 'edge' ? (edge ? <EdgeSnap edge={edge} cam={c.id} everyMs={10_000} height={180} alt={c.name} /> : <div className="off">—</div>)
                    : <StripSnap src={t => api.preview(c.id, t)} name={c.name} />}
                  <span className="nm">{c.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <aside className="cv-side">
          <div className="cv-sideh">
            <div className="cv-seg" role="tablist" aria-label="Side panel">
              <button type="button" role="tab" aria-selected={panel === 'timeline'} aria-pressed={panel === 'timeline'} onClick={() => setPanel('timeline')}>Timeline</button>
              <button type="button" role="tab" aria-selected={panel === 'events'} aria-pressed={panel === 'events'} onClick={() => setPanel('events')}>Events{events ? ` ${shownEvents.length}` : ''}</button>
            </div>
            <div className="cv-groups" role="group" aria-label="Show">
              {GROUPS.map(([g, l, c]) => (
                <button key={g} type="button" className="cv-gchip" aria-pressed={show[g]} onClick={() => setShow(v => ({ ...v, [g]: !v[g] }))}>
                  <span className="dot" style={{ background: c }} />{l}{events ? ` ${counts[g]}` : ''}
                </button>
              ))}
            </div>
            {panel === 'timeline' && (
              <div className="cv-zoom">
                <span>Zoom</span>
                <div className="cv-seg sm" role="group" aria-label="Zoom">
                  {ZOOMS.map((z, i) => <button key={z.label} type="button" aria-pressed={zoom === i} onClick={() => setZoom(i as 0 | 1 | 2)}>{z.label}</button>)}
                </div>
              </div>
            )}
          </div>
          {tlErr && <div className="cv-note">{tlErr}</div>}
          {loadingPieces > 0 && segs != null && <div className="cv-loading" role="status"><span className="spin" aria-hidden />Loading more of the day…</div>}
          {panel === 'timeline'
            ? <Timeline win={win} zoom={zoom} segs={segs} events={shownEvents} pos={pos} live={mode === 'live'} onSeek={playFrom} />
            : <EventList events={events == null ? null : shownEvents} edge={edge} pos={pos} onPlay={e => playFrom(Date.parse(e.start) - 5000)} />}
        </aside>
      </div>
    </div>
  )
}

/** Frigate-style vertical timeline: newest at the top, drag or click to play. */
function Timeline({ win, zoom, segs, events, pos, live, onSeek }: { win: { start: number; end: number }; zoom: 0 | 1 | 2; segs: { start: string; end: string }[] | null; events: VEvent[]; pos: number; live: boolean; onSeek: (ms: number) => void }) {
  const z = ZOOMS[zoom]
  const H = ((win.end - win.start) / MIN) * z.ppm
  const yOf = (ms: number) => PAD + ((win.end - ms) / MIN) * z.ppm
  const scroller = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const drag = useRef(false)
  const userAt = useRef(0)
  const msAt = (clientY: number) => {
    const r = inner.current!.getBoundingClientRect()
    return Math.max(win.start, Math.min(win.end, win.end - ((clientY - r.top - PAD) / z.ppm) * MIN))
  }

  // Ticks aligned to local time.
  const ticks = useMemo(() => {
    const off = new Date(win.end).getTimezoneOffset() * MIN
    const out: { t: number; major: boolean }[] = []
    for (let t = Math.floor((win.end - off) / z.minor) * z.minor + off; t >= win.start; t -= z.minor) out.push({ t, major: (t - off) % z.major === 0 })
    return out
  }, [win.start, win.end, z])

  // Only what's inside the window; motion marks that would touch on screen become one mark.
  const inWin = useMemo(() => (segs ?? []).filter(g => Date.parse(g.end) >= win.start && Date.parse(g.start) <= win.end).map(g => ({ start: Math.max(win.start, Date.parse(g.start)), end: Math.min(win.end, Date.parse(g.end)) })), [segs, win.start, win.end])
  const marks = useMemo(() => {
    const gap = (3 / z.ppm) * MIN
    const out: VEvent[] = []
    let run: VEvent | null = null, runEnd = 0, n = 0
    for (const e of events.filter(x => { const t = Date.parse(x.start); return t >= win.start && t <= win.end }).sort((a, b) => Date.parse(a.start) - Date.parse(b.start))) {
      if (groupOf(e.kind) !== 'motion') { out.push(e); continue }
      const st = Date.parse(e.start), en = Math.max(st, Date.parse(e.end ?? e.start))
      if (run && st - runEnd <= gap) { runEnd = Math.max(runEnd, en); n++; run = { ...(run as VEvent), end: new Date(runEnd).toISOString(), label: `Motion (${n})` }; out[out.length - 1] = run }
      else { run = { ...e }; runEnd = en; n = 1; out.push(run) }
    }
    return out
  }, [events, z, win.start, win.end])

  // Labels only where there's room for them.
  const labelled = useMemo(() => {
    const keep = new Set<string>(); let last = -1e9
    for (const e of events.slice().sort((a, b) => Date.parse(b.start) - Date.parse(a.start))) {
      if (groupOf(e.kind) === 'motion') continue
      const y = yOf(Date.parse(e.start)); if (y - last >= 18) { keep.add(e.key); last = y }
    }
    return keep
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, zoom, win.end])

  // Keep the playhead in view (unless the person is scrolling the timeline themselves).
  const posY = yOf(pos)
  useEffect(() => {
    const el = scroller.current; if (!el || drag.current || Date.now() - userAt.current < 4000) return
    if (posY < el.scrollTop + 40 || posY > el.scrollTop + el.clientHeight - 40) el.scrollTop = Math.max(0, posY - el.clientHeight / 3)
  }, [posY])
  useEffect(() => { const el = scroller.current; if (el) el.scrollTop = Math.max(0, posY - el.clientHeight / 3) }, [zoom]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="cv-tlscroll" ref={scroller} onWheel={() => { userAt.current = Date.now() }} onTouchMove={() => { userAt.current = Date.now() }}>
      <div ref={inner} className="cv-bar" style={{ height: H + PAD * 2 }} role="slider" tabIndex={0} aria-label="Timeline — click or drag to play from a moment" aria-orientation="vertical" aria-valuemin={win.start} aria-valuemax={win.end} aria-valuenow={Math.round(pos)} aria-valuetext={fmtT(pos, true)}
        onPointerDown={e => { drag.current = true; (e.target as Element).setPointerCapture?.(e.pointerId); setHover(msAt(e.clientY)) }}
        onPointerMove={e => setHover(msAt(e.clientY))}
        onPointerUp={e => { if (drag.current) { drag.current = false; onSeek(msAt(e.clientY)) } }}
        onPointerLeave={() => { if (!drag.current) setHover(null) }}
        onKeyDown={e => { if (e.key === 'ArrowUp') { e.preventDefault(); onSeek(pos + 60_000) } else if (e.key === 'ArrowDown') { e.preventDefault(); onSeek(pos - 60_000) } }}>
        {ticks.map(({ t, major }) => (
          <div key={t} className={`cv-tick ${major ? 'mj' : ''}`} style={{ top: yOf(t) }}>
            {major && <span>{new Date(t).getHours() === 0 && new Date(t).getMinutes() === 0 ? new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', ...(z.major < HOUR ? { minute: '2-digit' } : {}) })}</span>}
          </div>
        ))}
        <div className="cv-track" />
        {inWin.map((g, i) => { const a = yOf(g.end), b = yOf(g.start); return <span key={i} className="cv-rec" style={{ top: a, height: Math.max(1, b - a) }} /> })}
        {marks.map(e => {
          const g = groupOf(e.kind); const a = yOf(Date.parse(e.end ?? e.start)), b = yOf(Date.parse(e.start))
          return (
            <button key={e.key} type="button" className={`cv-ev ${g}`} title={`${e.plate ? `Plate ${e.plate}` : e.label} · ${fmtT(Date.parse(e.start), true)}`}
              style={{ top: a, height: Math.max(g === 'motion' ? 2 : 6, b - a), background: GROUP_COLOR[g] }}
              onPointerDown={ev => ev.stopPropagation()} onClick={ev => { ev.stopPropagation(); onSeek(Date.parse(e.start) - 5000) }}>
              {labelled.has(e.key) && <span className="lb">{e.plate ?? e.label}</span>}
            </button>
          )
        })}
        {segs && !inWin.length && <div className="cv-none" style={{ top: PAD + 40 }}>No recordings in this range</div>}
        {segs == null && <div className="cv-none" style={{ top: PAD + 40 }}>Loading…</div>}
        {pos >= win.start && pos <= win.end && <div className="cv-head" style={{ top: posY }}><span>{live ? 'Live' : fmtT(pos)}</span></div>}
        {hover != null && <div className="cv-hov" style={{ top: yOf(hover) }}><span>{fmtT(hover, false)}</span></div>}
      </div>
    </div>
  )
}

function EventList({ events, edge, pos, onPlay }: { events: VEvent[] | null; edge: EdgePass | null; pos: number; onPlay: (e: VEvent) => void }) {
  if (events == null) return <div className="cv-empty">Loading…</div>
  if (!events.length) return <div className="cv-empty">No events.</div>
  return (
    <div className="cv-evs">
      {events.slice(0, 200).map(e => {
        const at = Date.parse(e.start), end = e.end ? Date.parse(e.end) : at + 10_000
        const g = groupOf(e.kind)
        return (
          <button key={e.key} type="button" className={`cv-evc ${pos >= at - 5000 && pos <= end ? 'on' : ''}`} onClick={() => onPlay(e)}>
            {e.provider === 'edge' && e.edgeId && edge
              // eslint-disable-next-line @next/next/no-img-element
              ? <img alt="" loading="lazy" src={edgeUrl(edge, `/api/events/${encodeURIComponent(e.edgeId)}/thumbnail.webp`)} />
              : <span className="ph"><span className="dot" style={{ background: GROUP_COLOR[g] }} /></span>}
            <span className="tx">
              <b>{e.plate ? `Plate ${e.plate}` : e.label}</b>
              <span>{fmtT(at, true, false)}{e.end ? ` · ${Math.max(1, Math.round((Date.parse(e.end) - at) / 1000))}s` : ''}{e.score ? ` · ${Math.round(e.score * 100)}%` : ''}</span>
            </span>
            <span className="tag" style={{ color: GROUP_COLOR[g] }}>{g === 'alert' ? 'Alert' : g === 'motion' ? 'Motion' : 'Detection'}</span>
          </button>
        )
      })}
    </div>
  )
}

// Eagle Eye live = the existing preview route, refreshed every 2 s.
function LiveCamRefresh({ src, name }: { src: (tick: number) => string; name: string }) {
  const [tick, setTick] = useState(0)
  const [bad, setBad] = useState(false)
  useEffect(() => { const t = setInterval(() => { if (!document.hidden) setTick(n => n + 1) }, 2000); return () => clearInterval(t) }, [])
  if (bad) return <div className="off">No live preview for this camera.</div>
  return <LiveCam src={src(tick)} alt={name} onError={() => setBad(true)} />
}
// Camera strip tiles refresh slowly (every 10 s) to keep the viewer light.
function StripSnap({ src, name }: { src: (tick: number) => string; name: string }) {
  const [tick, setTick] = useState(0)
  const [bad, setBad] = useState(false)
  useEffect(() => { const t = setInterval(() => { if (!document.hidden) setTick(n => n + 1) }, 10_000); return () => clearInterval(t) }, [])
  if (bad) return <div className="off">No preview</div>
  return <LiveCam src={src(tick)} alt={name} onError={() => setBad(true)} />
}

const BG = '#0D1117', PANEL = '#161B22', LINE2 = 'rgba(255,255,255,.08)', INK = '#E6EDF3', SUB = '#8B949E', ACC = '#0A84FF'
export const VIEWER_CSS = `
.cv{position:fixed;inset:0;z-index:140;background:${BG};color:${INK};display:flex;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",Inter,system-ui,sans-serif;letter-spacing:-.01em}
.cv .dot{display:inline-block;width:7px;height:7px;border-radius:50%;flex:none}
.cv-hd{display:flex;align-items:center;gap:12px;padding:10px 14px;padding-top:calc(10px + env(safe-area-inset-top));border-bottom:1px solid ${LINE2};background:${PANEL}}
.cv-title{min-width:0;flex:1}
.cv-t{font-size:16px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cv-s{display:flex;align-items:center;gap:6px;font-size:12px;color:${SUB};margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cv-hacts{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.cv-btn{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:8px;border:1px solid ${LINE2};background:rgba(255,255,255,.06);color:${INK};font-weight:500;font-size:13px;font-family:inherit;cursor:pointer;text-decoration:none;white-space:nowrap}
.cv-btn:hover{background:rgba(255,255,255,.1)}
.cv-btn.on{background:rgba(255,69,58,.16);border-color:rgba(255,69,58,.4);color:#FF6961;font-weight:600}
.cv-seg{display:flex;align-items:center;gap:2px;padding:2px;border-radius:8px;background:rgba(255,255,255,.06);border:1px solid ${LINE2}}
.cv-seg button{border:0;background:none;color:${SUB};height:28px;padding:0 10px;border-radius:6px;font-weight:500;font-size:12.5px;font-family:inherit;cursor:pointer;white-space:nowrap}
.cv-seg button[aria-pressed=true]{background:rgba(255,255,255,.14);color:${INK};font-weight:600}
.cv-seg.sm button{height:24px;padding:0 8px;font-size:12px}
.cv-seg input[type=date]{height:28px;border:0;background:transparent;color:${INK};font-weight:500;font-size:12.5px;font-family:inherit;padding:0 6px;color-scheme:dark}
.cv-body{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 320px}
.cv-main{min-width:0;min-height:0;display:flex;flex-direction:column}
.cv-stage{position:relative;background:#000;flex:1 1 auto;min-height:200px;display:flex;align-items:center;justify-content:center;overflow:hidden}
.cv-stage img,.cv-stage video{width:100%;height:100%;object-fit:contain}
.cv-stage .off,.cv-thumb .off{color:rgba(255,255,255,.65);font-size:13px;position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:12px}
.cv-live{position:absolute;top:10px;left:10px;display:flex;align-items:center;gap:5px;font:600 11px -apple-system,system-ui,sans-serif;color:#fff;background:rgba(0,0,0,.5);border-radius:6px;padding:3px 8px}
.cv-clock{position:absolute;top:10px;right:10px;font:500 11.5px ui-monospace,SFMono-Regular,Menlo,monospace;color:#fff;background:rgba(0,0,0,.5);border-radius:6px;padding:3px 8px}
.cv-tag{position:absolute;bottom:10px;left:10px;font-size:11px;color:#fff;background:rgba(0,0,0,.55);border-radius:6px;padding:3px 8px}
.cv-err{position:absolute;bottom:12px;left:50%;transform:translateX(-50%);background:rgba(215,0,21,.92);color:#fff;font-size:13px;border-radius:8px;padding:6px 12px;max-width:90%}
.cv-ctl{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;padding:8px 12px;border-top:1px solid ${LINE2};background:${PANEL}}
.cv-ctl .grp{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.cv-ib{min-width:36px;height:32px;padding:0 8px;border-radius:8px;border:1px solid ${LINE2};background:rgba(255,255,255,.06);color:${INK};font-weight:600;font-size:12.5px;font-family:inherit;cursor:pointer}
.cv-ib:hover:not(:disabled){background:rgba(255,255,255,.12)}
.cv-ib:disabled,.cv-sel:disabled{opacity:.4;cursor:default}
.cv-sel{height:32px;border-radius:8px;border:1px solid ${LINE2};background:rgba(255,255,255,.06);color:${INK};font-weight:500;font-size:12.5px;font-family:inherit;padding:0 8px;color-scheme:dark}
.cv-strip{display:flex;gap:8px;overflow-x:auto;padding:10px 12px;border-top:1px solid ${LINE2};background:${BG};flex:none}
.cv-thumb{position:relative;flex:none;width:156px;aspect-ratio:16/9;border-radius:8px;overflow:hidden;border:2px solid transparent;background:#000;padding:0;cursor:pointer}
.cv-thumb.on{border-color:${ACC}}
.cv-thumb img{width:100%;height:100%;object-fit:cover}
.cv-thumb .nm{position:absolute;left:0;right:0;bottom:0;padding:10px 6px 4px;font:600 11px -apple-system,system-ui,sans-serif;color:#fff;text-align:left;background:linear-gradient(transparent,rgba(0,0,0,.7));white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cv-side{min-height:0;display:flex;flex-direction:column;border-left:1px solid ${LINE2};background:${PANEL}}
.cv-sideh{display:grid;gap:8px;padding:10px 12px;border-bottom:1px solid ${LINE2}}
.cv-sideh>.cv-seg{justify-self:start}
.cv-groups{display:flex;gap:6px;flex-wrap:wrap}
.cv-gchip{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 10px;border-radius:13px;border:1px solid ${LINE2};background:transparent;color:${SUB};font-weight:500;font-size:12px;font-family:inherit;cursor:pointer}
.cv-gchip[aria-pressed=true]{background:rgba(255,255,255,.1);color:${INK}}
.cv-zoom{display:flex;align-items:center;justify-content:space-between;font-size:12px;color:${SUB}}
.cv-loading{display:flex;align-items:center;gap:8px;margin:8px 12px 0;font-size:12px;color:${SUB}}
.cv-loading .spin{width:12px;height:12px;border-radius:50%;border:2px solid rgba(255,255,255,.18);border-top-color:${ACC};animation:cvspin .8s linear infinite}
@keyframes cvspin{to{transform:rotate(360deg)}}
.cv-note{margin:8px 12px 0;font-size:12px;color:#FFB340;background:rgba(255,159,10,.12);border:1px solid rgba(255,159,10,.3);border-radius:8px;padding:6px 8px}
.cv-tlscroll{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;position:relative}
.cv-bar{position:relative;cursor:ns-resize;touch-action:none;user-select:none;outline:none}
.cv-tick{position:absolute;left:0;right:0;height:0;border-top:1px solid rgba(255,255,255,.05)}
.cv-tick.mj{border-top-color:rgba(255,255,255,.14)}
.cv-tick span{position:absolute;left:10px;top:-8px;font:500 10.5px ui-monospace,SFMono-Regular,Menlo,monospace;color:${SUB};white-space:nowrap}
.cv-track{position:absolute;top:${PAD}px;bottom:${PAD}px;left:76px;width:10px;border-radius:5px;background:rgba(255,255,255,.04)}
.cv-rec{position:absolute;left:76px;width:10px;border-radius:2px;background:rgba(10,132,255,.55)}
.cv-ev{position:absolute;left:94px;width:6px;border-radius:3px;border:0;padding:0;cursor:pointer;opacity:.9}
.cv-ev.motion{width:4px;left:95px;opacity:.55}
.cv-ev:hover{opacity:1;box-shadow:0 0 0 2px rgba(255,255,255,.35)}
.cv-ev .lb{position:absolute;left:12px;top:-2px;font:500 11px -apple-system,system-ui,sans-serif;color:${INK};white-space:nowrap;max-width:190px;overflow:hidden;text-overflow:ellipsis;pointer-events:none}
.cv-none{position:absolute;left:104px;right:10px;font-size:12px;color:${SUB}}
.cv-head{position:absolute;left:0;right:0;height:0;border-top:2px solid ${ACC};pointer-events:none;z-index:2}
.cv-head span{position:absolute;right:8px;top:-11px;font:600 11px ui-monospace,SFMono-Regular,Menlo,monospace;color:#fff;background:${ACC};border-radius:6px;padding:2px 6px}
.cv-hov{position:absolute;left:0;right:0;height:0;border-top:1px dashed rgba(255,255,255,.45);pointer-events:none;z-index:1}
.cv-hov span{position:absolute;left:8px;top:-10px;font:500 10.5px ui-monospace,SFMono-Regular,Menlo,monospace;color:#0D1117;background:#E6EDF3;border-radius:5px;padding:1px 5px}
.cv-evs{flex:1;min-height:0;overflow-y:auto;padding:8px;display:grid;gap:6px;align-content:start}
.cv-evc{display:flex;gap:10px;align-items:center;text-align:left;border:1px solid ${LINE2};background:rgba(255,255,255,.03);border-radius:10px;padding:6px;cursor:pointer;font:inherit;color:inherit}
.cv-evc:hover{border-color:rgba(10,132,255,.5)}
.cv-evc.on{border-color:${ACC};background:rgba(10,132,255,.12)}
.cv-evc img,.cv-evc .ph{width:72px;height:44px;border-radius:6px;object-fit:cover;background:rgba(255,255,255,.06);flex:none;display:flex;align-items:center;justify-content:center}
.cv-evc .tx{display:flex;flex-direction:column;min-width:0;flex:1;font-size:12px}
.cv-evc .tx b{font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cv-evc .tx span{color:${SUB}}
.cv-evc .tag{font-size:11px;font-weight:600;flex:none}
.cv-empty{padding:20px 12px;font-size:13px;color:${SUB}}
@media (max-width:860px){
  .cv-body{display:flex;flex-direction:column;overflow-y:auto}
  .cv-main{flex:none}
  .cv-stage{flex:none;aspect-ratio:16/9;min-height:0}
  .cv-side{border-left:0;border-top:1px solid ${LINE2};flex:none;height:62dvh}
  .cv-hd{flex-wrap:wrap}
  .cv-hacts{width:100%;justify-content:space-between}
  .cv-hacts .cv-seg input[type=date]{width:118px}
  .cv-ctl .cv-btn{padding:0 9px;font-size:12px}
}
`
