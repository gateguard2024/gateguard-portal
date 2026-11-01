'use client'
/**
 * One camera, full screen: Live ⇄ Playback, a scrubbable timeline (recordings +
 * event markers), skip / speed, download a clip, save a frame, and this camera's
 * events for the window. Works for Eagle Eye and Gate Guard Edge cameras.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { type Any, BLUE, Dot, DOT, LiveCam, MUTED, Note, getJson, previewUrl } from '../shared'
import { EdgeLive, EdgeSnap, HlsVideo, camPath, edgeUrl, type EdgePass } from './players'

export type Cam = { key: string; provider: 'een' | 'edge'; id: string; name: string; online: boolean | null }
export type VEvent = { key: string; provider: 'een' | 'edge'; cameraKey: string; cameraName: string; label: string; kind: string; start: string; end: string | null; plate: string | null; score: number | null; edgeId: string | null; hasClip: boolean }

export const KIND_DOT: Record<string, string> = { person: DOT.blue, vehicle: DOT.green, plate: DOT.green, animal: DOT.gray, motion: DOT.gray, alert: DOT.red, system: DOT.gray, other: DOT.gray }
const HOUR = 36e5
const fmtT = (ms: number, withDay = false) => new Date(ms).toLocaleString(undefined, { ...(withDay ? { month: 'short', day: 'numeric' } : {}), hour: 'numeric', minute: '2-digit', second: withDay ? undefined : '2-digit' })
const localDayStart = (ymd: string) => new Date(`${ymd}T00:00:00`).getTime()
const ymdOf = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

export function Viewer({ siteId, cam, edge, startAt, onClose }: { siteId: string; cam: Cam; edge: EdgePass | null; startAt?: number | null; onClose: () => void }) {
  const isEdge = cam.provider === 'edge'
  const [mode, setMode] = useState<'live' | 'play'>(startAt ? 'play' : 'live')
  const [playAt, setPlayAt] = useState<number>(startAt ?? Date.now() - 5 * 60e3)
  const [offset, setOffset] = useState(0)            // seconds played since playAt
  const [rate, setRate] = useState(1)
  const [err, setErr] = useState<string | null>(null)
  const [liveFail, setLiveFail] = useState<string | null>(null)
  const [span, setSpan] = useState<1 | 6 | 24>(24)
  const [day, setDay] = useState<string | null>(null) // a past day, or null = "up to now"
  const [segs, setSegs] = useState<{ start: string; end: string }[] | null>(null)
  const [events, setEvents] = useState<VEvent[] | null>(null)
  const [tlErr, setTlErr] = useState<string | null>(null)
  const vref = useRef<HTMLVideoElement>(null)

  const now = Date.now()
  const win = useMemo(() => {
    if (day) { const s = localDayStart(day); return { start: s, end: Math.min(s + 24 * HOUR, Date.now()) } }
    const end = Date.now()
    return { start: end - span * HOUR, end }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [span, day, mode === 'live' ? Math.floor(now / 60000) : 0])

  useEffect(() => {
    let alive = true
    setSegs(null); setEvents(null); setTlErr(null)
    const q = `start=${encodeURIComponent(new Date(win.start).toISOString())}&end=${encodeURIComponent(new Date(win.end).toISOString())}&camera=${encodeURIComponent(cam.key)}`
    void Promise.all([getJson(`/api/sites/${siteId}/video?view=timeline&${q}`), getJson(`/api/sites/${siteId}/video?view=events&${q}`)]).then(([t, e]) => {
      if (!alive) return
      setSegs(Array.isArray(t.data.segments) ? t.data.segments : [])
      setTlErr(t.data.error || (!t.ok ? (t.data.error || 'Timeline unavailable') : null))
      setEvents(Array.isArray(e.data.events) ? e.data.events : [])
    })
    return () => { alive = false }
  }, [siteId, cam.key, win.start, win.end])

  const pos = mode === 'live' ? Date.now() : playAt + offset * 1000
  const playFrom = useCallback((ms: number) => {
    const t = Math.min(Date.now() - 2000, Math.max(0, ms))
    setErr(null); setMode('play'); setOffset(0); setPlayAt(t)
  }, [])
  const skip = (sec: number) => {
    if (mode === 'live') { playFrom(Date.now() + sec * 1000 - 2000); return }
    const v = vref.current
    if (isEdge && v && v.duration && isFinite(v.duration) && v.currentTime + sec >= 0 && v.currentTime + sec <= v.duration) { v.currentTime += sec; return }
    playFrom(pos + sec * 1000)
  }
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      if (e.key === 'ArrowLeft') { e.preventDefault(); skip(e.shiftKey ? -60 : -10) }
      else if (e.key === 'ArrowRight') { e.preventDefault(); skip(e.shiftKey ? 60 : 10) }
      else if (e.key === 'l' || e.key === 'L') setMode('live')
      else if (e.key === ' ' && vref.current) { e.preventDefault(); if (vref.current.paused) void vref.current.play(); else vref.current.pause() }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  })

  const s = Math.floor(playAt / 1000)
  const vodUrl = edge && isEdge ? `${edge.base}/vod/${camPath(cam.id)}/start/${s}/end/${Math.min(Math.floor(Date.now() / 1000), s + 3600)}/index.m3u8` : ''
  const clipFrom = Math.floor(pos / 1000) - 10
  const downloadUrl = isEdge && edge
    ? edgeUrl(edge, `/api/${camPath(cam.id)}/start/${clipFrom}/end/${clipFrom + 60}/clip.mp4?download=true`)
    : `/api/eagle-eye/clip?site_id=${siteId}&camera_id=${encodeURIComponent(cam.id)}&ts=${encodeURIComponent(new Date(pos - 10000).toISOString())}`

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
    window.open(isEdge && edge ? edgeUrl(edge, `/api/${camPath(cam.id)}/latest.jpg`) : previewUrl(siteId, cam.id, Date.now()), '_blank', 'noopener')
  }

  // Timeline geometry
  const pct = (ms: number) => Math.max(0, Math.min(100, ((ms - win.start) / (win.end - win.start)) * 100))
  const bar = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const msAt = (clientX: number) => { const r = bar.current!.getBoundingClientRect(); return win.start + ((clientX - r.left) / r.width) * (win.end - win.start) }
  const ticks = useMemo(() => {
    const step = span === 1 && !day ? 10 * 60e3 : span === 6 && !day ? HOUR : 3 * HOUR
    const out: number[] = []
    for (let t = Math.ceil(win.start / step) * step; t <= win.end; t += step) out.push(t)
    return out
  }, [win.start, win.end, span, day])

  return (
    <div className="sy-sheet-bg" style={{ padding: 0, background: 'rgba(0,0,0,.6)' }} onClick={onClose}>
      <div className="cv" role="dialog" aria-modal="true" aria-label={cam.name} onClick={e => e.stopPropagation()}>
        <div className="cv-hd">
          <div style={{ minWidth: 0 }}>
            <div className="cv-t">{cam.name}</div>
            <div className="cv-s"><Dot c={cam.online === false ? DOT.orange : DOT.green} />{isEdge ? 'Gate Guard Edge' : 'Eagle Eye'} · {mode === 'live' ? 'Live' : `Playback · ${fmtT(pos, true)}`}</div>
          </div>
          <div className="sy-acts">
            {mode === 'play' && <button type="button" className="sy-b pri sm" onClick={() => setMode('live')}>Go live</button>}
            <button type="button" className="sy-b line sm" onClick={onClose}>Done</button>
          </div>
        </div>

        <div className="cv-stage">
          {mode === 'live' ? (
            isEdge && edge ? (liveFail ? <><EdgeSnap edge={edge} cam={cam.id} everyMs={1000} height={720} alt={cam.name} /><span className="cv-tag">Snapshots · {liveFail}</span></>
              : <EdgeLive edge={edge} cam={cam.id} onFail={setLiveFail} />)
              : isEdge ? <div className="off">The Edge device isn’t reachable right now.</div>
              : <LiveCamRefresh siteId={siteId} camId={cam.id} name={cam.name} />
          ) : isEdge && edge ? (
            <HlsVideo key={vodUrl} ref={vref} url={vodUrl} pass={edge.pass} rate={rate} onError={setErr} onTime={t => setOffset(t)} />
          ) : (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video key={playAt} ref={vref} controls autoPlay playsInline src={`/api/eagle-eye/clip?site_id=${siteId}&camera_id=${encodeURIComponent(cam.id)}&ts=${encodeURIComponent(new Date(playAt).toISOString())}`}
              onTimeUpdate={e => setOffset((e.target as HTMLVideoElement).currentTime)} onError={() => setErr('No recording for that time.')}
              onLoadedMetadata={e => { (e.target as HTMLVideoElement).playbackRate = rate }}
              style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }} />
          )}
          {mode === 'live' && <span className="cv-live"><Dot c={DOT.red} />Live</span>}
          {err && <div className="cv-err">{err}</div>}
        </div>

        <div className="cv-ctl">
          <div className="sy-acts">
            <button type="button" className="sy-b line sm" onClick={() => skip(-60)} aria-label="Back 1 minute">−1m</button>
            <button type="button" className="sy-b line sm" onClick={() => skip(-10)} aria-label="Back 10 seconds">−10s</button>
            <button type="button" className="sy-b line sm" onClick={() => skip(10)} aria-label="Forward 10 seconds" disabled={mode === 'live'}>+10s</button>
            <button type="button" className="sy-b line sm" onClick={() => skip(60)} aria-label="Forward 1 minute" disabled={mode === 'live'}>+1m</button>
          </div>
          <div className="sy-acts">
            <div className="ct-seg" role="group" aria-label="Speed" style={{ display: 'flex', gap: 2, padding: 2, borderRadius: 8, background: '#EEF0F4' }}>
              {[1, 2, 4].map(r => <button key={r} type="button" aria-pressed={rate === r} onClick={() => { setRate(r); if (vref.current) vref.current.playbackRate = r }} disabled={mode === 'live'} className="cv-seg">{r}×</button>)}
            </div>
            <a className="sy-b line sm" href={downloadUrl} target="_blank" rel="noopener noreferrer" download>Download 1-min clip</a>
            <button type="button" className="sy-b line sm" onClick={saveFrame}>Save frame</button>
          </div>
        </div>

        <div className="cv-tl">
          <div className="cv-tlh">
            <div className="sy-chips" role="group" aria-label="Timeline range">
              {([1, 6, 24] as const).map(h => <button key={h} type="button" className="sy-chip" aria-pressed={!day && span === h} onClick={() => { setDay(null); setSpan(h) }}>Last {h === 1 ? 'hour' : `${h} h`}</button>)}
              <input type="date" className="sy-in" aria-label="Pick a day" style={{ width: 150, height: 32 }} max={ymdOf(Date.now())} value={day ?? ''} onChange={e => setDay(e.target.value || null)} />
            </div>
            <div style={{ fontSize: 12, color: MUTED }}>{hover != null ? fmtT(hover, true) : 'Tap the bar to play from that moment · ← → skip'}</div>
          </div>
          <div ref={bar} className="cv-bar" role="slider" aria-label="Timeline" aria-valuemin={win.start} aria-valuemax={win.end} aria-valuenow={Math.round(pos)} tabIndex={0}
            onMouseMove={e => setHover(msAt(e.clientX))} onMouseLeave={() => setHover(null)} onClick={e => playFrom(msAt(e.clientX))}>
            {(segs ?? []).map((g, i) => <span key={i} className="cv-rec" style={{ left: `${pct(Date.parse(g.start))}%`, width: `${Math.max(0.15, pct(Date.parse(g.end)) - pct(Date.parse(g.start)))}%` }} />)}
            {(events ?? []).map(e => <span key={e.key} className="cv-ev" title={`${e.label} · ${fmtT(Date.parse(e.start), true)}`} style={{ left: `${pct(Date.parse(e.start))}%`, background: KIND_DOT[e.kind] ?? DOT.gray }} />)}
            {pos >= win.start && pos <= win.end && <span className="cv-head" style={{ left: `${pct(pos)}%` }} />}
            {hover != null && <span className="cv-hov" style={{ left: `${pct(hover)}%` }} />}
          </div>
          <div className="cv-ticks">{ticks.map(t => <span key={t} style={{ left: `${pct(t)}%` }}>{new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', ...(span === 1 && !day ? { minute: '2-digit' } : {}) })}</span>)}</div>
          {segs && !segs.length && !tlErr && <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>No recordings in this range.</div>}
          {tlErr && <div style={{ marginTop: 6 }}><Note tone="orange">{tlErr}</Note></div>}
        </div>

        <div className="cv-evs">
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Events in this range {events ? `(${events.length})` : ''}</div>
          {events == null ? <div className="sy-empty">Loading…</div> : !events.length ? <div className="sy-empty">No events.</div> : (
            <div className="cv-evgrid">
              {events.slice(0, 60).map(e => (
                <button key={e.key} type="button" className="cv-evc" onClick={() => playFrom(Date.parse(e.start) - 5000)}>
                  {e.provider === 'edge' && e.edgeId && edge ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt="" loading="lazy" src={edgeUrl(edge, `/api/events/${encodeURIComponent(e.edgeId)}/thumbnail.webp`)} />
                  ) : <span className="ph"><Dot c={KIND_DOT[e.kind] ?? DOT.gray} /></span>}
                  <span className="tx"><b>{e.plate ? `Plate ${e.plate}` : e.label}</b><span>{fmtT(Date.parse(e.start), true)}{e.score ? ` · ${Math.round(e.score * 100)}%` : ''}</span></span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Eagle Eye live = the existing preview route, refreshed every 2 s.
function LiveCamRefresh({ siteId, camId, name }: { siteId: string; camId: string; name: string }) {
  const [tick, setTick] = useState(0)
  const [bad, setBad] = useState(false)
  useEffect(() => { const t = setInterval(() => { if (!document.hidden) setTick(n => n + 1) }, 2000); return () => clearInterval(t) }, [])
  if (bad) return <div className="off">No live preview for this camera.</div>
  return <LiveCam src={previewUrl(siteId, camId, tick)} alt={name} onError={() => setBad(true)} />
}

export const VIEWER_CSS = `
.cv{background:#fff;width:min(1180px,100vw);height:min(100dvh,980px);display:flex;flex-direction:column;border-radius:16px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.4);font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",Inter,system-ui,sans-serif;color:#1D1D1F}
.cv-hd{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 16px;border-bottom:1px solid rgba(0,0,0,.08)}
.cv-t{font-size:17px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cv-s{display:flex;align-items:center;gap:6px;font-size:12px;color:#6E6E73;margin-top:2px}
.cv-stage{position:relative;background:#000;flex:1 1 auto;min-height:220px;display:flex;align-items:center;justify-content:center}
.cv-stage img{width:100%;height:100%;object-fit:contain}
.cv-stage .off{color:rgba(255,255,255,.7);font-size:13px;position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:12px}
.cv-live{position:absolute;top:10px;left:10px;display:flex;align-items:center;gap:5px;font:600 11px -apple-system,system-ui,sans-serif;color:#fff;background:rgba(0,0,0,.5);border-radius:6px;padding:3px 8px}
.cv-tag{position:absolute;bottom:10px;left:10px;font-size:11px;color:#fff;background:rgba(0,0,0,.55);border-radius:6px;padding:3px 8px}
.cv-err{position:absolute;bottom:12px;left:50%;transform:translateX(-50%);background:rgba(215,0,21,.92);color:#fff;font-size:13px;border-radius:8px;padding:6px 12px}
.cv-ctl{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;padding:10px 16px;border-bottom:1px solid rgba(0,0,0,.08)}
.cv-seg{border:0;background:none;height:26px;padding:0 10px;border-radius:6px;font:500 12px -apple-system,system-ui,sans-serif;color:#3A3A3C;cursor:pointer}
.cv-seg[aria-pressed=true]{background:#fff;font-weight:600;box-shadow:0 1px 2px rgba(0,0,0,.1)}
.cv-seg:disabled{opacity:.45;cursor:default}
.cv-tl{padding:10px 16px 6px}
.cv-tlh{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px}
.cv-bar{position:relative;height:34px;background:#F2F2F7;border-radius:8px;cursor:pointer;overflow:hidden;outline-offset:2px}
.cv-rec{position:absolute;top:0;bottom:0;background:rgba(0,113,227,.28)}
.cv-ev{position:absolute;top:6px;width:6px;height:6px;margin-left:-3px;border-radius:50%}
.cv-head{position:absolute;top:0;bottom:0;width:2px;margin-left:-1px;background:${BLUE}}
.cv-hov{position:absolute;top:0;bottom:0;width:1px;background:rgba(0,0,0,.35)}
.cv-ticks{position:relative;height:16px;font-size:10px;color:#86868B}
.cv-ticks span{position:absolute;transform:translateX(-50%);white-space:nowrap}
.cv-evs{padding:8px 16px 14px;overflow-y:auto;max-height:30%;border-top:1px solid rgba(0,0,0,.06)}
.cv-evgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px}
.cv-evc{display:flex;gap:8px;align-items:center;text-align:left;border:1px solid rgba(0,0,0,.08);background:#fff;border-radius:10px;padding:6px;cursor:pointer;font:inherit;color:inherit}
.cv-evc:hover{border-color:rgba(0,113,227,.4)}
.cv-evc img,.cv-evc .ph{width:64px;height:40px;border-radius:6px;object-fit:cover;background:#F2F2F7;flex:none;display:flex;align-items:center;justify-content:center}
.cv-evc .tx{display:flex;flex-direction:column;min-width:0;font-size:12px}
.cv-evc .tx b{font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cv-evc .tx span{color:#6E6E73}
@media (max-width:760px){.cv{height:100dvh;border-radius:0}.cv-evs{max-height:34%}}
`
