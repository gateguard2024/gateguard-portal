'use client'
/**
 * Systems tab — shared look + small pieces (light Apple look, same tokens as
 * Catalog / Events / Operations). Used by SystemsExplorer, SiteCommand and every
 * tab under components/nexus/systems/.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'

// ── Look ─────────────────────────────────────────────────────────────────────
export const TEXT = '#1D1D1F'
export const TEXT2 = '#3A3A3C'
export const MUTED = '#6E6E73'
export const LINE = 'rgba(0,0,0,0.08)'
export const BORDER = 'rgba(0,0,0,0.12)'
export const BLUE = '#0071E3'
export const GREEN = '#1A7F37'
export const ORANGE = '#B25000'
export const RED = '#D70015'
export const DOT = { green: '#30D158', orange: '#FF9F0A', red: '#FF453A', gray: '#C7C7CC', blue: '#0A84FF' }
export const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, system-ui, sans-serif'
export const SHADOW = '0 1px 2px rgba(10,20,40,.06), 0 8px 24px rgba(10,20,40,.08)'

export const CSS = `
.sy{color:${TEXT};font-family:${FONT};letter-spacing:-.01em;width:100%;max-width:1360px;margin:0 auto;padding:4px 4px calc(140px + env(safe-area-inset-bottom));-webkit-font-smoothing:antialiased}
.sy *{box-sizing:border-box}
.sy-hd{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;flex-wrap:wrap;margin:6px 0 18px}
.sy-hd h1{margin:0;color:#fff;font-size:30px;font-weight:600;letter-spacing:-.025em}
.sy-hd .sub{color:rgba(255,255,255,.72);font-size:14px;margin-top:4px}
.sy-back{display:inline-flex;align-items:center;gap:4px;background:none;border:0;padding:0;margin-bottom:6px;color:rgba(255,255,255,.85);font:500 14px ${FONT};cursor:pointer}
.sy-acts{display:flex;gap:8px;flex-wrap:wrap}
.sy-b{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:36px;padding:0 14px;border-radius:10px;border:0;font:600 13px ${FONT};cursor:pointer;white-space:nowrap;text-decoration:none}
.sy-b.sm{height:30px;padding:0 11px;font-size:12px;border-radius:8px}
.sy-b.dark{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);color:#fff;font-weight:500}
.sy-b.pri{background:${BLUE};color:#fff}
.sy-b.line{background:#fff;border:1px solid ${BORDER};color:${TEXT};font-weight:500}
.sy-b.blue{background:#fff;border:1px solid ${BORDER};color:${BLUE}}
.sy-b.warn{background:#fff;border:1px solid rgba(215,0,21,.28);color:${RED}}
.sy-b.go{background:#E8F6EC;border:1px solid rgba(26,127,55,.25);color:${GREEN}}
.sy-b:disabled{opacity:.5;cursor:default}
.sy-card{background:#fff;border-radius:14px;box-shadow:${SHADOW};overflow:hidden}
.sy-card>.hd{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px 0;flex-wrap:wrap}
.sy-card>.hd h3{margin:0;font-size:15px;font-weight:600}
.sy-card>.hd .s{font-size:12px;color:${MUTED};margin-top:2px}
.sy-card>.bd{padding:14px 16px 16px}
.sy-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-bottom:12px}
.sy-kpi{background:#fff;border-radius:14px;padding:12px 14px;box-shadow:${SHADOW};text-align:left;border:0;font:inherit;color:inherit}
button.sy-kpi{cursor:pointer}
.sy-kpi .l{display:flex;align-items:center;gap:6px;font-size:12px;color:${MUTED};font-weight:500}
.sy-kpi .v{font-size:24px;font-weight:600;letter-spacing:-.02em;margin-top:2px;font-variant-numeric:tabular-nums}
.sy-kpi .s{font-size:12px;color:${MUTED};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sy-quick{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-bottom:16px}
.sy-q{display:flex;align-items:center;gap:10px;background:#fff;border:0;border-radius:12px;box-shadow:${SHADOW};padding:12px 14px;font:600 13px ${FONT};color:${TEXT};cursor:pointer;text-align:left}
.sy-q .ic{width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:#EEF4FF;color:${BLUE};flex:none}
.sy-q:hover{box-shadow:0 0 0 1px rgba(0,113,227,.35),${SHADOW}}
.sy-tabs{display:flex;gap:2px;padding:3px;border-radius:12px;background:#E9ECF1;box-shadow:${SHADOW};margin-bottom:14px;overflow-x:auto;position:sticky;top:8px;z-index:5;scrollbar-width:none}
.sy-tabs::-webkit-scrollbar{display:none}
.sy-tabs button{flex:none;border:0;background:none;height:34px;padding:0 14px;border-radius:9px;font:500 13px ${FONT};color:${TEXT2};cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;gap:6px}
.sy-tabs button[aria-selected=true]{background:#fff;color:${TEXT};font-weight:600;box-shadow:0 1px 2px rgba(0,0,0,.1)}
.sy-tabs .n{font-size:11px;color:#fff;background:${DOT.red};border-radius:9px;padding:0 6px;line-height:16px}
.sy-grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.sy-stack{display:grid;gap:14px}
.sy-row{display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid ${LINE}}
.sy-row:first-child{border-top:0}
.sy-row .main{flex:1;min-width:0}
.sy-row .t{font-size:14px;font-weight:500;overflow:hidden;text-overflow:ellipsis}
.sy-row .m{font-size:12px;color:${MUTED};margin-top:2px}
.sy-in{height:36px;border:1px solid ${BORDER};border-radius:10px;padding:0 12px;font:400 14px ${FONT};color:${TEXT};background:#fff;width:100%;min-width:0}
textarea.sy-in{height:auto;padding:8px 12px;resize:vertical}
.sy-lbl{display:block;font-size:12px;font-weight:500;color:${MUTED};margin:0 0 5px}
.sy-dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex:none}
.sy-pill{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:${TEXT2};background:#F2F2F7;border-radius:6px;padding:2px 7px;white-space:nowrap}
.sy-note{border-radius:10px;padding:10px 12px;font-size:13px;line-height:1.45;background:#F5F5F7;color:${MUTED}}
.sy-note.red{background:#FFECEC;color:${RED}}.sy-note.green{background:#E8F6EC;color:${GREEN}}.sy-note.blue{background:#EEF4FF;color:${BLUE}}.sy-note.orange{background:#FFF4E5;color:${ORANGE}}
.sy-empty{font-size:13px;color:${MUTED};padding:6px 0}
.sy-chips{display:flex;gap:6px;flex-wrap:wrap}
.sy-chip{border:1px solid ${BORDER};background:#fff;border-radius:999px;padding:5px 12px;font:500 13px ${FONT};color:${TEXT2};cursor:pointer;white-space:nowrap}
.sy-chip[aria-pressed=true]{background:${TEXT};border-color:${TEXT};color:#fff}
.sy-cams{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.sy-cam{position:relative;padding:0;border:0;border-radius:12px;overflow:hidden;background:#0B0D12;aspect-ratio:16/9;cursor:pointer;display:block;width:100%}
.sy-cam img{width:100%;height:100%;object-fit:cover;display:block}
.sy-cam .nm{position:absolute;left:0;right:0;bottom:0;padding:16px 10px 7px;font:500 12px ${FONT};color:#fff;text-align:left;background:linear-gradient(transparent,rgba(0,0,0,.6));white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sy-cam .lv{position:absolute;top:8px;right:8px;font:600 10px ${FONT};color:#fff;background:rgba(0,0,0,.45);border-radius:6px;padding:2px 6px;display:flex;align-items:center;gap:4px}
.sy-cam .off{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.55);font:500 12px ${FONT};text-align:center;padding:8px}
.sy-flash{position:fixed;left:50%;bottom:calc(96px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:150;background:rgba(29,29,31,.92);color:#fff;border-radius:12px;padding:10px 16px;font:500 13px ${FONT};box-shadow:0 10px 30px rgba(0,0,0,.25);max-width:min(560px,calc(100vw - 32px))}
.sy-flash.bad{background:${RED}}
.sy-sheet-bg{position:fixed;inset:0;z-index:130;background:rgba(0,0,0,.32);display:flex;align-items:center;justify-content:center;padding:16px}
.sy-sheet{background:#fff;border-radius:16px;width:min(var(--w,560px),100%);max-height:88dvh;display:flex;flex-direction:column;box-shadow:0 24px 70px rgba(0,0,0,.28);color:${TEXT};font-family:${FONT}}
.sy-sheet>.hd{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;border-bottom:1px solid ${LINE}}
.sy-sheet>.hd h2{margin:0;font-size:17px;font-weight:600}
.sy-sheet>.hd .s{font-size:12px;color:${MUTED};margin-top:2px}
.sy-sheet>.bd{padding:16px;overflow-y:auto;display:grid;gap:12px}
.sy-sites{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px}
.sy-site{display:block;text-align:left;background:#fff;border:0;border-radius:14px;box-shadow:${SHADOW};padding:14px 16px;cursor:pointer;font:inherit;color:inherit}
.sy-site:hover{box-shadow:0 0 0 1px rgba(0,113,227,.35),${SHADOW}}
.sy-site .t{font-size:15px;font-weight:600}
.sy-site .m{font-size:13px;color:${MUTED};margin-top:3px}
.sy-site .go{font-size:12px;color:${BLUE};margin-top:10px;font-weight:500}
.sy-feed{max-height:520px;overflow-y:auto}
.sy-split{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:14px;align-items:start}
@media (max-width:1100px){.sy-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}.sy-quick{grid-template-columns:repeat(3,minmax(0,1fr))}.sy-split{grid-template-columns:1fr}}
@media (max-width:760px){.sy-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.sy-quick{grid-template-columns:repeat(2,minmax(0,1fr))}.sy-grid2{grid-template-columns:1fr}.sy-cams{grid-template-columns:repeat(2,minmax(0,1fr))}.sy-hd h1{font-size:26px}.sy-tabs{top:0}}
@media (max-width:340px){.sy-cams{grid-template-columns:1fr}}
`

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Any = Record<string, any>

// ── Data ─────────────────────────────────────────────────────────────────────
/** Fetch JSON; never throws. ok=false carries the server's error text. */
export async function getJson(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: Any }> {
  try {
    const r = await fetch(url, { cache: 'no-store', ...init, headers: init?.body ? { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } : init?.headers })
    const data = await r.json().catch(() => ({}))
    return { ok: r.ok, status: r.status, data: data ?? {} }
  } catch (e) {
    return { ok: false, status: 0, data: { error: e instanceof Error ? e.message : 'Network error' } }
  }
}
export const send = (url: string, method: string, body?: Any) => getJson(url, { method, ...(body ? { body: JSON.stringify(body) } : {}) })

export const fmtWhen = (t?: string | null) => {
  if (!t) return ''
  const d = new Date(t)
  return isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
export function dur(ms: number | null | undefined): string {
  if (ms == null) return '—'
  const m = Math.floor(ms / 60000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h}h ${m % 60}m`
  return `${Math.floor(h / 24)}d ${h % 24}h`
}

// ── Flash (one at a time, newest wins) ───────────────────────────────────────
export type Notify = (msg: string, ok?: boolean) => void
export function useFlash(): [React.ReactNode, Notify] {
  const [f, setF] = useState<{ msg: string; ok: boolean } | null>(null)
  const t = useRef<ReturnType<typeof setTimeout> | null>(null)
  const notify = useCallback<Notify>((msg, ok = true) => {
    if (t.current) clearTimeout(t.current)
    setF({ msg, ok })
    t.current = setTimeout(() => setF(null), 4000)
  }, [])
  useEffect(() => () => { if (t.current) clearTimeout(t.current) }, [])
  return [f ? <div role="status" className={`sy-flash${f.ok ? '' : ' bad'}`}>{f.msg}</div> : null, notify]
}

// ── Pieces ───────────────────────────────────────────────────────────────────
export function Card({ title, sub, right, children, id }: { title?: React.ReactNode; sub?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; id?: string }) {
  return (
    <section className="sy-card" id={id} aria-label={typeof title === 'string' ? title : undefined}>
      {(title || right) && <div className="hd"><div>{title && <h3>{title}</h3>}{sub && <div className="s">{sub}</div>}</div>{right}</div>}
      <div className="bd">{children}</div>
    </section>
  )
}
export const Dot = ({ c }: { c: string }) => <span className="sy-dot" style={{ background: c }} aria-hidden />
export const Note = ({ tone, children }: { tone?: 'red' | 'green' | 'blue' | 'orange'; children: React.ReactNode }) => <div className={`sy-note${tone ? ` ${tone}` : ''}`} role={tone === 'red' ? 'alert' : undefined}>{children}</div>
export const Field = ({ label, children }: { label: string; children: React.ReactNode }) => <label style={{ display: 'block' }}><span className="sy-lbl">{label}</span>{children}</label>

/** Centered sheet (modal). Escape or the backdrop closes it unless `locked`. */
export function Sheet({ title, sub, onClose, children, width = 560, locked }: { title: React.ReactNode; sub?: React.ReactNode; onClose: () => void; children: React.ReactNode; width?: number; locked?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && !locked) { e.stopPropagation(); onClose() } }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose, locked])
  return (
    <div className="sy-sheet-bg" onClick={() => { if (!locked) onClose() }}>
      <div className="sy-sheet" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} style={{ ['--w' as string]: `${width}px` }} onClick={e => e.stopPropagation()}>
        <div className="hd"><div><h2>{title}</h2>{sub && <div className="s">{sub}</div>}</div><button type="button" className="sy-b line sm" onClick={onClose} disabled={locked}>Done</button></div>
        <div className="bd">{children}</div>
      </div>
    </div>
  )
}

/** Not-connected message: corporate gets the fix, everyone else who to ask. */
export function NotConnected({ what, isCorporate, onSetup }: { what: string; isCorporate: boolean; onSetup?: () => void }) {
  return (
    <Note>
      {what} isn’t connected for this property yet.{' '}
      {isCorporate
        ? onSetup ? <button type="button" onClick={onSetup} style={{ border: 0, background: 'none', padding: 0, color: BLUE, font: 'inherit', fontWeight: 600, cursor: 'pointer' }}>Open Setup &amp; keys</button> : 'Add it under Setup & keys.'
        : 'Ask Gate Guard to set it up.'}
    </Note>
  )
}

/**
 * Live camera frame, flicker-free: each frame is fetched as a blob and swapped in
 * only once it has fully downloaded (the preview endpoint is no-store, so an
 * <img src> would blank between frames).
 */
export function LiveCam({ src, alt, onError }: { src: string; alt: string; onError?: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  const urlRef = useRef<string | null>(null)
  const errRef = useRef(onError)
  errRef.current = onError
  useEffect(() => {
    let cancelled = false
    fetch(src, { cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.blob() })
      .then(blob => {
        if (cancelled) return
        if (blob.size === 0) { errRef.current?.(); return }
        const next = URL.createObjectURL(blob)
        const prev = urlRef.current
        urlRef.current = next
        setUrl(next)
        if (prev) setTimeout(() => URL.revokeObjectURL(prev), 1000)
      })
      .catch(() => { if (!cancelled) errRef.current?.() })
    return () => { cancelled = true }
  }, [src])
  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current) }, [])
  if (!url) return <div className="off">Loading…</div>
  // eslint-disable-next-line @next/next/no-img-element
  return <img alt={alt} src={url} />
}
export const previewUrl = (siteId: string, camId: string, tick: number) => `/api/eagle-eye/preview?site_id=${siteId}&camera_id=${encodeURIComponent(camId)}&t=${tick}`
export const clipUrl = (siteId: string, camId: string, ts: string) => `/api/eagle-eye/clip?site_id=${siteId}&camera_id=${encodeURIComponent(camId)}&ts=${encodeURIComponent(ts)}`

/** Recorded clip viewer (Eagle Eye). */
export function ClipSheet({ siteId, clip, onClose }: { siteId: string; clip: { camId: string; name: string; ts: string }; onClose: () => void }) {
  return (
    <Sheet title={clip.name} sub={`Recording from ${fmtWhen(clip.ts)}`} onClose={onClose} width={760}>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video controls autoPlay src={clipUrl(siteId, clip.camId, clip.ts)} style={{ width: '100%', borderRadius: 10, background: '#000', aspectRatio: '16/9' }} />
      <div style={{ fontSize: 12, color: MUTED }}>Plays the couple of minutes around that time. If it doesn’t load, the camera may not have recorded then.</div>
    </Sheet>
  )
}

// Shared context passed to every tab.
export type SiteCtx = { siteId: string; isCorporate: boolean; notify: Notify; openSetup: () => void }
