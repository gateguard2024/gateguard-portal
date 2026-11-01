'use client'
/**
 * Video players for the camera screen.
 *   EdgeLive    — low-latency live from a Gate Guard Edge box: go2rtc MSE over a
 *                 WebSocket straight to the device; falls back to fast snapshots.
 *   EdgeSnap    — refreshing snapshot (camera wall tiles; cheap and instant).
 *   HlsVideo    — recorded playback (Frigate VOD). hls.js (from cdnjs) with the pass
 *                 in an Authorization header; Safari/iOS native HLS as a fallback.
 * Eagle Eye keeps using the existing /api/eagle-eye/preview + /clip routes.
 */
import React, { useEffect, useRef, useState } from 'react'

export type EdgePass = { base: string; pass: string; exp: number; deviceId?: string }
export const edgeUrl = (e: EdgePass, path: string, extra = '') => `${e.base}${path}${path.includes('?') ? '&' : '?'}gg=${encodeURIComponent(e.pass)}${extra}`
export const camPath = (cam: string) => encodeURIComponent(cam)

/** Snapshot that refreshes every `everyMs`; keeps the last frame until the next one loads. */
export function EdgeSnap({ edge, cam, everyMs = 2000, height = 360, alt, onError }: { edge: EdgePass; cam: string; everyMs?: number; height?: number; alt: string; onError?: () => void }) {
  const [src, setSrc] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const errs = useRef(0)
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) setTick(n => n + 1) }, everyMs)
    return () => clearInterval(t)
  }, [everyMs])
  useEffect(() => {
    const url = edgeUrl(edge, `/api/${camPath(cam)}/latest.webp?h=${height}`, `&t=${tick}`)
    const img = new Image()
    img.onload = () => { errs.current = 0; setSrc(url) }
    img.onerror = () => { errs.current++; if (errs.current >= 3) onError?.() }
    img.src = url
    return () => { img.onload = null; img.onerror = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edge.pass, edge.base, cam, tick, height])
  if (!src) return <div className="off">Connecting…</div>
  // eslint-disable-next-line @next/next/no-img-element
  return <img alt={alt} src={src} />
}

const CODECS = ['avc1.640029', 'avc1.64002A', 'avc1.640033', 'hvc1.1.6.L153.B0', 'mp4a.40.2', 'mp4a.40.5', 'flac', 'opus']
type MS = typeof MediaSource

/** Live via go2rtc MSE (Frigate's /live/mse). onFail → caller shows snapshots instead. */
export function EdgeLive({ edge, cam, onFail, muted = true }: { edge: EdgePass; cam: string; onFail: (why: string) => void; muted?: boolean }) {
  const vid = useRef<HTMLVideoElement>(null)
  const [state, setState] = useState<'connecting' | 'live'>('connecting')
  useEffect(() => {
    const w = window as unknown as { ManagedMediaSource?: MS; MediaSource?: MS }
    const MSClass = w.ManagedMediaSource ?? w.MediaSource
    if (!MSClass || !vid.current) { onFail('This browser can’t play the live stream.'); return }
    const supported = CODECS.filter(c => MSClass.isTypeSupported(`video/mp4; codecs="${c}"`)).join(',')
    const ms = new MSClass()
    const v = vid.current
    if (w.ManagedMediaSource && MSClass === w.ManagedMediaSource) (v as unknown as { disableRemotePlayback: boolean }).disableRemotePlayback = true
    v.src = URL.createObjectURL(ms)
    let sb: SourceBuffer | null = null
    const queue: ArrayBuffer[] = []
    let ws: WebSocket | null = null
    let closed = false
    let gotData = false
    const fail = (why: string) => { if (!closed) { closed = true; try { ws?.close() } catch { /* */ } onFail(why) } }
    const timer = setTimeout(() => { if (!gotData) fail('The live stream didn’t start.') }, 8000)
    const pump = () => {
      if (!sb || sb.updating || !queue.length) return
      try {
        sb.appendBuffer(queue.shift() as ArrayBuffer)
      } catch { fail('Live stream error.') }
    }
    ms.addEventListener('sourceopen', () => {
      const wsUrl = edgeUrl(edge, `/live/mse/api/ws?src=${camPath(cam)}`).replace(/^http/, 'ws')
      ws = new WebSocket(wsUrl)
      ws.binaryType = 'arraybuffer'
      ws.onopen = () => ws?.send(JSON.stringify({ type: 'mse', value: supported }))
      ws.onmessage = ev => {
        if (typeof ev.data === 'string') {
          let msg: { type?: string; value?: string } = {}
          try { msg = JSON.parse(ev.data) } catch { return }
          if (msg.type === 'mse' && msg.value && !sb) {
            try {
              sb = ms.addSourceBuffer(msg.value)
              sb.mode = 'segments'
              sb.addEventListener('updateend', () => {
                // Keep ~10 s of buffer and stay near the live edge.
                if (sb && !sb.updating && v.buffered.length) {
                  const endT = v.buffered.end(v.buffered.length - 1)
                  if (endT - v.buffered.start(0) > 15) { try { sb.remove(0, endT - 10) } catch { /* */ } }
                  if (endT - v.currentTime > 2.5) v.currentTime = endT - 0.5
                }
                pump()
              })
            } catch { fail('This camera’s video format isn’t supported here.') }
          } else if (msg.type === 'error') fail(msg.value || 'Live stream error.')
        } else {
          if (!gotData) { gotData = true; setState('live'); v.play().catch(() => { /* autoplay muted */ }) }
          queue.push(ev.data as ArrayBuffer); pump()
        }
      }
      ws.onerror = () => fail('Couldn’t open the live stream.')
      ws.onclose = () => { if (!gotData) fail('The live stream closed.') }
    }, { once: true })
    return () => { closed = true; clearTimeout(timer); try { ws?.close() } catch { /* */ } try { URL.revokeObjectURL(v.src) } catch { /* */ } v.removeAttribute('src'); v.load() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edge.base, cam])
  return (
    <>
      <video ref={vid} muted={muted} playsInline autoPlay style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }} />
      {state === 'connecting' && <div className="off">Connecting live…</div>}
    </>
  )
}

// hls.js from cdnjs, loaded once.
let hlsLoad: Promise<unknown> | null = null
function loadHls(): Promise<unknown> {
  const w = window as unknown as { Hls?: unknown }
  if (w.Hls) return Promise.resolve(w.Hls)
  if (!hlsLoad) hlsLoad = new Promise((res, rej) => {
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.5.13/hls.min.js'
    s.async = true
    s.onload = () => res((window as unknown as { Hls: unknown }).Hls)
    s.onerror = () => { hlsLoad = null; rej(new Error('Couldn’t load the video player.')) }
    document.head.appendChild(s)
  })
  return hlsLoad
}

/** Recorded playback. `url` = the m3u8 WITHOUT the pass; `pass` goes in a header (or ?gg= for native). */
export const HlsVideo = React.forwardRef<HTMLVideoElement, { url: string; pass: string; rate: number; controls?: boolean; onError: (m: string) => void; onTime?: (t: number) => void }>(function HlsVideo({ url, pass, rate, controls = true, onError, onTime }, ref) {
  const inner = useRef<HTMLVideoElement>(null)
  // The pass renews every ~10 min; segments read the latest one without reloading.
  const passRef = useRef(pass)
  passRef.current = pass
  React.useImperativeHandle(ref, () => inner.current as HTMLVideoElement)
  useEffect(() => {
    const v = inner.current
    if (!v) return
    let hls: { destroy: () => void } | null = null
    let dead = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    loadHls().then((H: any) => {
      if (dead) return
      if (H && H.isSupported()) {
        const h = new H({ xhrSetup: (xhr: XMLHttpRequest) => xhr.setRequestHeader('Authorization', `Bearer ${passRef.current}`), lowLatencyMode: false, maxBufferLength: 30 })
        h.on(H.Events.ERROR, (_e: unknown, d: { fatal?: boolean; details?: string; response?: { code?: number } }) => {
          if (d?.fatal) onError(d.response?.code === 404 ? 'No recording for that time.' : d.response?.code === 401 ? 'The camera pass expired — tap play again.' : 'Playback stopped.')
        })
        h.loadSource(url); h.attachMedia(v)
        hls = h
        v.play().catch(() => { /* user gesture needed */ })
      } else if (v.canPlayType('application/vnd.apple.mpegurl')) {
        v.src = `${url}${url.includes('?') ? '&' : '?'}gg=${encodeURIComponent(pass)}`
        v.play().catch(() => { /* */ })
      } else onError('This browser can’t play recordings.')
    }).catch(() => {
      if (v.canPlayType('application/vnd.apple.mpegurl')) { v.src = `${url}${url.includes('?') ? '&' : '?'}gg=${encodeURIComponent(pass)}`; v.play().catch(() => { /* */ }) }
      else onError('Couldn’t load the video player.')
    })
    return () => { dead = true; hls?.destroy(); v.removeAttribute('src'); v.load() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])
  useEffect(() => { if (inner.current) inner.current.playbackRate = rate }, [rate])
  return <video ref={inner} controls={controls} playsInline onTimeUpdate={e => onTime?.((e.target as HTMLVideoElement).currentTime)} style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }} />
})
