'use client'

/**
 * VideoClient — the Cameras page (approved design).
 * Featured live player (defaults to a gate camera, which is always the big view) +
 * a scrollable grid of every camera. Double-click any tile (or Rewind) opens the
 * popup viewer with the recorded-history browser (Eagle Eye segments) + scrubber.
 *
 * Black-frame detection: a camera can report "online" to Eagle Eye yet produce an
 * all-black frame (IR off / covered / dead sensor). We sample each preview's
 * luminance client-side and flag a near-black feed as "No signal" instead of
 * falsely showing Live.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { OpsShell, C, BRAND } from '@/components/portal/ops/OpsShell'
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires
const { X, Maximize2, RotateCcw, ChevronDown } = require('lucide-react') as any

type Cam = { id: string; name: string; online?: boolean | null }
type Seg = { startISO?: string; mp4Url?: string; start?: string }

function panel(extra?: React.CSSProperties): React.CSSProperties {
  return { background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,.04), 0 6px 20px -12px rgba(0,0,0,.18)', ...extra }
}
const OFF_ICON = <svg viewBox="0 0 24 24" width={34} height={34} fill="none" stroke="currentColor" strokeWidth={1.6}><path d="M2 2l20 20M17 17H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2m3-1h2l2 2" /></svg>

// Average luminance of an <img>; returns 0..255 (null if it can't read pixels).
function frameLuma(img: HTMLImageElement): number | null {
  try {
    const w = 32, h = 18
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h
    const ctx = cv.getContext('2d'); if (!ctx) return null
    ctx.drawImage(img, 0, 0, w, h)
    const { data } = ctx.getImageData(0, 0, w, h)
    let sum = 0
    for (let i = 0; i < data.length; i += 4) sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    return sum / (data.length / 4)
  } catch { return null }
}

function Inner({ slug }: { slug: string }) {
  const [cams, setCams] = useState<Cam[]>([])
  const [sel, setSel] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const [noSignal, setNoSignal] = useState<Record<string, boolean>>({})
  const [modalCam, setModalCam] = useState<Cam | null>(null)

  useEffect(() => {
    fetch(`/api/portal/${slug}/summary`).then(r => r.json()).then(j => {
      const list: Cam[] = j.cameras ?? []
      setCams(list)
      // Gate camera is always the default featured view.
      const gate = list.find(c => /gate/i.test(c.name)) || list[0]
      setSel(gate ? gate.id : null)
    }).catch(() => {})
  }, [slug])
  useEffect(() => { const t = setInterval(() => setTick(x => x + 1), 15000); return () => clearInterval(t) }, [])

  const isOff = useCallback((c: Cam) => c.online === false || noSignal[c.id], [noSignal])
  const onImg = useCallback((c: Cam, e: React.SyntheticEvent<HTMLImageElement>) => {
    const l = frameLuma(e.currentTarget)
    if (l != null && l < 11 && !noSignal[c.id]) setNoSignal(s => ({ ...s, [c.id]: true }))
  }, [noSignal])

  const featured = useMemo(() => cams.find(c => c.id === sel) || cams[0] || null, [cams, sel])
  const src = (id: string) => `/api/portal/${slug}/camera-preview?camera_id=${encodeURIComponent(id)}&t=${tick}`

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>Cameras</h1>
          <div style={{ fontSize: 12.5, color: C.ink2, marginTop: 3 }}>{cams.length} cameras · Eagle Eye · live</div>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, background: C.card, border: `1px solid ${C.border2}`, borderRadius: 9, padding: '9px 13px', color: C.ink }}><span style={{ color: C.ink3 }}>View:</span> All cameras <ChevronDown size={15} color={C.ink2} /></span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 20, alignItems: 'start' }} className="gg-vidwrap">
        {/* Featured player */}
        <div style={panel({ overflow: 'hidden' })}>
          <div style={{ position: 'relative', aspectRatio: '16 / 9', background: '#05070b' }}>
            {featured && (isOff(featured) ? (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', justifyContent: 'center', color: C.ink3, fontSize: 13, fontWeight: 600 }}>{OFF_ICON}Camera offline — no signal</div>
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={src(featured.id)} alt={featured.name} onLoad={e => onImg(featured, e)} onDoubleClick={() => setModalCam(featured)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in' }} />
            ))}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: 'linear-gradient(180deg,rgba(0,0,0,.55),transparent)' }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: '#fff', textShadow: '0 1px 4px #000' }}>{featured?.name || '—'}</span>
              {featured && !isOff(featured) && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, color: '#fff' }}><span style={{ width: 8, height: 8, borderRadius: 999, background: C.safe, boxShadow: `0 0 8px ${C.safe}` }} />LIVE</span>}
            </div>
            {featured && (
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'linear-gradient(0deg,rgba(0,0,0,.6),transparent)' }}>
                <button onClick={() => setModalCam(featured)} style={vctrl}><RotateCcw size={15} /> Rewind</button>
                <button onClick={() => setModalCam(featured)} style={vctrl}><Maximize2 size={15} /> Expand</button>
              </div>
            )}
          </div>
        </div>

        {/* Camera grid (scrollable) */}
        <div style={panel()}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 18px', borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>All cameras</span>
            <span style={{ fontSize: 11.5, color: C.ink3 }}>{cams.filter(c => !isOff(c)).length}/{cams.length} online</span>
          </div>
          <div style={{ padding: 14 }}>
            {cams.length === 0 ? <div style={{ fontSize: 12.5, color: C.ink2, textAlign: 'center', padding: '20px 0' }}>No cameras connected.</div> : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, maxHeight: 520, overflowY: 'auto' }} className="gg-vidgrid">
                {cams.map(c => {
                  const off = isOff(c)
                  return (
                    <div key={c.id} onClick={() => setSel(c.id)} onDoubleClick={() => setModalCam(c)} title="Double-click to expand" style={{ position: 'relative', aspectRatio: '16 / 10', borderRadius: 11, overflow: 'hidden', cursor: 'pointer', background: '#05070b', border: `1px solid ${c.id === sel ? C.cyan : C.border2}`, boxShadow: c.id === sel ? '0 0 0 2px rgba(0,113,227,.35)' : 'none' }}>
                      {off ? <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.ink3, fontSize: 10.5, fontWeight: 600 }}>No signal</div> :
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={src(c.id)} alt={c.name} onLoad={e => onImg(c, e)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
                      <span style={{ position: 'absolute', right: 7, top: 6, width: 7, height: 7, borderRadius: 999, background: off ? C.alert : C.safe, boxShadow: `0 0 6px ${off ? C.alert : C.safe}` }} />
                      <span style={{ position: 'absolute', left: 7, bottom: 6, fontSize: 10.5, fontWeight: 700, color: '#fff', textShadow: '0 1px 3px #000' }}>{c.name}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {modalCam && <CamModal slug={slug} cam={modalCam} off={isOff(modalCam)} tick={tick} onClose={() => setModalCam(null)} />}

      <style>{`@media(max-width:1000px){.gg-vidwrap{grid-template-columns:1fr!important}.gg-vidgrid{grid-template-columns:1fr 1fr!important;max-height:none!important}}`}</style>
    </div>
  )
}

function CamModal({ slug, cam, off, tick, onClose }: { slug: string; cam: Cam; off: boolean; tick: number; onClose: () => void }) {
  const [segs, setSegs] = useState<Seg[] | null>(null)
  useEffect(() => {
    fetch(`/api/portal/${slug}/camera-history?camera_id=${encodeURIComponent(cam.id)}`).then(r => r.json()).then(j => setSegs(j.segments || [])).catch(() => setSegs([]))
  }, [slug, cam.id])
  const fmt = (s: Seg) => { const t = s.startISO || s.start; return t ? new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '—' }
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, zIndex: 130, background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: 980, maxWidth: '94vw', background: C.panel, border: `1px solid ${C.border2}`, borderRadius: 18, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,.04), 0 20px 50px -12px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 20px', borderBottom: `1px solid ${C.border}` }}>
          <span style={{ fontSize: 16, fontWeight: 800 }}>{cam.name}</span>
          <button onClick={onClose} style={{ background: 'transparent', border: 0, color: C.ink2, cursor: 'pointer' }}><X size={20} /></button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr' }} className="gg-cammbody">
          <div>
            <div style={{ position: 'relative', aspectRatio: '16 / 9', background: '#05070b' }}>
              {off ? <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', justifyContent: 'center', color: C.ink3, fontSize: 13, fontWeight: 600 }}>{OFF_ICON}Camera offline — no recent recording</div> :
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={`/api/portal/${slug}/camera-preview?camera_id=${encodeURIComponent(cam.id)}&t=${tick}`} alt={cam.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
            </div>
            <div style={{ padding: '14px 16px', borderTop: `1px solid ${C.border}`, fontSize: 11.5, color: C.ink3 }}>Recorded timeline — last 24 hours{segs && segs.length ? ` · ${segs.length} segments` : ''}</div>
          </div>
          <div style={{ borderLeft: `1px solid ${C.border}`, padding: '14px 16px', maxHeight: 440, overflowY: 'auto' }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.ink3, marginBottom: 10 }}>Recorded history</div>
            {segs == null ? <div style={{ fontSize: 12.5, color: C.ink2 }}>Loading…</div> :
              segs.length === 0 ? <div style={{ fontSize: 12.5, color: C.ink2 }}>No recordings available for the last 24 hours.</div> :
                segs.map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: `1px solid ${C.border}`, cursor: 'pointer' }}>
                    <span style={{ width: 7, height: 7, borderRadius: 999, background: C.cyan, flexShrink: 0 }} />
                    <span style={{ width: 72, fontSize: 12, fontWeight: 700 }}>{fmt(s)}</span>
                    {s.mp4Url ? <a href={s.mp4Url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: C.cyan, textDecoration: 'none' }}>Play clip →</a> : <span style={{ fontSize: 12, color: C.ink2 }}>Segment</span>}
                  </div>
                ))}
          </div>
        </div>
      </div>
      <style>{`@media(max-width:760px){.gg-cammbody{grid-template-columns:1fr!important}}`}</style>
    </div>
  )
}

const vctrl: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 700, color: '#fff', background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 10, padding: '9px 13px', cursor: 'pointer', backdropFilter: 'blur(6px)' }

export default function VideoClient({ slug, displayName }: { slug: string; displayName: string }) {
  return <OpsShell slug={slug} displayName={displayName} active="video"><Inner slug={slug} /></OpsShell>
}
