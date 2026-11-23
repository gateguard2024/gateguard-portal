'use client'
/**
 * opsKit — small shared pieces for property portal pages (Residents, Billing, Service):
 * the light Apple look (same as PackagesClient), a sheet (pop-up), a toast, dots,
 * date + money formatting. Page-specific layout stays in each page.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { C } from '@/components/portal/ops/OpsShell'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Any = Record<string, any>
export const TZ = 'America/New_York'
export const DOT = { blue: '#0A84FF', green: '#34C759', orange: '#FF9500', red: '#FF3B30', gray: '#C7C7CC' }

export const OK_CSS = `
.ok-wrap{display:flex;flex-direction:column;gap:16px}
.ok-card{background:${C.card};border-radius:12px;padding:18px 20px;box-shadow:0 1px 2px rgba(0,0,0,.04),0 6px 20px -12px rgba(0,0,0,.18);min-width:0;box-sizing:border-box}
.ok-card h3{margin:0;font-size:15px;font-weight:600;color:${C.ink}}
.ok-card .sub{font-size:12.5px;color:${C.ink3};margin-top:2px}
.ok-hd{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px}
.ok-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.ok-kpi{background:${C.card};border:0;border-radius:12px;padding:16px 18px;text-align:left;font:inherit;color:inherit;box-shadow:0 1px 2px rgba(0,0,0,.04),0 6px 20px -12px rgba(0,0,0,.18)}
button.ok-kpi{cursor:pointer}button.ok-kpi:hover{box-shadow:0 0 0 1px rgba(0,113,227,.35),0 6px 20px -12px rgba(0,0,0,.18)}
.ok-num{font-size:28px;font-weight:600;letter-spacing:-.02em;font-variant-numeric:tabular-nums;line-height:1.15;color:${C.ink}}
.ok-k{color:${C.ink3};font-size:13px;display:flex;align-items:center;gap:8px}
.ok-s{color:${C.ink3};font-size:12.5px;margin-top:2px}
.ok-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:38px;padding:0 14px;border-radius:10px;border:1px solid ${C.border2};background:#fff;color:${C.ink};font:600 13.5px inherit;font-family:inherit;cursor:pointer;white-space:nowrap;text-decoration:none}
.ok-btn.sm{min-height:32px;padding:0 11px;font-size:12.5px;border-radius:8px}
.ok-btn.pri{background:${C.blue};border-color:${C.blue};color:#fff}
.ok-btn.warn{color:${C.alert};border-color:rgba(215,0,21,.3)}
.ok-btn.go{color:${C.safe};border-color:rgba(31,138,59,.3);background:#F0FAF2}
.ok-btn:disabled{opacity:.5;cursor:default}
.ok-seg{display:inline-flex;background:#E8E8ED;border-radius:10px;padding:2px;gap:2px;flex-wrap:wrap}
.ok-seg button{border:0;background:none;min-height:34px;padding:0 13px;border-radius:8px;font:500 13px inherit;font-family:inherit;color:${C.ink};cursor:pointer}
.ok-seg button[aria-pressed=true]{background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.12);font-weight:600}
.ok-in{height:40px;border:1px solid ${C.border2};border-radius:10px;padding:0 12px;font:400 14px inherit;font-family:inherit;color:${C.ink};background:#fff;width:100%;min-width:0;box-sizing:border-box}
textarea.ok-in{height:auto;padding:9px 12px;resize:vertical}
select.ok-in{padding-right:8px}
.ok-lbl{display:block;font-size:12px;font-weight:500;color:${C.ink3};margin-bottom:5px}
.ok-grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.ok-tw{overflow-x:auto}
.ok-tbl{width:100%;border-collapse:collapse;font-size:13.5px;color:${C.ink}}
.ok-tbl th{text-align:left;font-weight:500;color:${C.ink3};font-size:12px;padding:10px 12px;border-bottom:1px solid ${C.border};white-space:nowrap}
.ok-tbl td{padding:11px 12px;border-bottom:1px solid rgba(0,0,0,.055);vertical-align:middle}
.ok-tbl tr.click{cursor:pointer}.ok-tbl tr.click:hover td{background:#F7F9FC}
.ok-row{display:flex;align-items:center;gap:12px;padding:11px 0;border-top:1px solid rgba(0,0,0,.06)}
.ok-row:first-child{border-top:0}
.ok-row .main{flex:1;min-width:0}
.ok-row .t{font-size:14px;font-weight:500;color:${C.ink}}
.ok-row .m{font-size:12.5px;color:${C.ink3};margin-top:2px}
.ok-pill{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:${C.ink2};background:#F2F2F7;border-radius:6px;padding:3px 8px;white-space:nowrap}
.ok-dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex:none}
.ok-chips{display:flex;gap:6px;flex-wrap:wrap}
.ok-chip{border:1px solid ${C.border2};background:#fff;border-radius:999px;padding:5px 12px;font:500 13px inherit;font-family:inherit;color:${C.ink2};cursor:pointer;white-space:nowrap}
.ok-chip[aria-pressed=true]{background:${C.ink};border-color:${C.ink};color:#fff}
.ok-note{border-radius:10px;padding:10px 12px;font-size:13px;line-height:1.45;background:#F5F5F7;color:${C.ink3}}
.ok-note.orange{background:#FFF4E5;color:${C.warn}}.ok-note.red{background:#FFECEC;color:${C.alert}}.ok-note.blue{background:#EEF4FF;color:${C.blue}}
.ok-empty{font-size:13px;color:${C.ink3};padding:8px 0}
.ok-bg{position:fixed;inset:0;z-index:140;background:rgba(0,0,0,.32);display:flex;align-items:center;justify-content:center;padding:16px}
.ok-sheet{background:#fff;border-radius:16px;width:min(var(--w,560px),100%);max-height:88dvh;display:flex;flex-direction:column;box-shadow:0 24px 70px rgba(0,0,0,.28);color:${C.ink}}
.ok-sheet>.hd{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:16px 18px;border-bottom:1px solid ${C.border}}
.ok-sheet>.hd h2{margin:0;font-size:17px;font-weight:600}
.ok-sheet>.hd .s{font-size:12.5px;color:${C.ink3};margin-top:2px}
.ok-sheet>.bd{padding:16px 18px;overflow-y:auto;display:grid;gap:14px}
.ok-toast{position:fixed;left:50%;bottom:calc(28px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:160;background:rgba(29,29,31,.92);color:#fff;border-radius:12px;padding:10px 16px;font-size:13px;font-weight:500;box-shadow:0 10px 30px rgba(0,0,0,.25);max-width:min(560px,calc(100vw - 32px))}
.ok-toast.bad{background:${C.alert}}
@media(max-width:900px){.ok-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:600px){.ok-grid2{grid-template-columns:1fr}}
`

export const Dot = ({ c }: { c: string }) => <span className="ok-dot" style={{ background: c }} aria-hidden />

export function Sheet({ title, sub, onClose, children, width = 560 }: { title: ReactNode; sub?: ReactNode; onClose: () => void; children: ReactNode; width?: number }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="ok-bg" onClick={onClose}>
      <div className="ok-sheet" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} style={{ ['--w' as string]: `${width}px` } as CSSProperties} onClick={e => e.stopPropagation()}>
        <div className="hd"><div><h2>{title}</h2>{sub && <div className="s">{sub}</div>}</div><button type="button" className="ok-btn sm" onClick={onClose}>Done</button></div>
        <div className="bd">{children}</div>
      </div>
    </div>
  )
}

export function useToast(): [ReactNode, (t: string, ok?: boolean) => void] {
  const [toast, setToast] = useState<{ t: string; ok: boolean } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const show = useCallback((t: string, ok = true) => {
    if (timer.current) clearTimeout(timer.current)
    setToast({ t, ok }); timer.current = setTimeout(() => setToast(null), 3500)
  }, [])
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  return [toast ? <div role="status" className={`ok-toast${toast.ok ? '' : ' bad'}`}>{toast.t}</div> : null, show]
}

/** "Today 3:12 pm" / "Mon, Nov 3, 3:12 pm" in Eastern time. */
export function when(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  const t = d.toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).toLowerCase()
  if (d.toLocaleDateString('en-CA', { timeZone: TZ }) === new Date().toLocaleDateString('en-CA', { timeZone: TZ })) return `Today ${t}`
  return `${d.toLocaleDateString('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric' })}, ${t}`
}
/** A plain date (YYYY-MM-DD from the database) as "Nov 3, 2026". */
export function day(d?: string | null): string {
  if (!d) return '—'
  const x = new Date(d.length <= 10 ? `${d}T12:00:00` : d)
  return isNaN(x.getTime()) ? '—' : x.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
export const money = (n: number) => `$${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`

/** fetch + JSON that never throws. */
export async function call(url: string, init?: RequestInit): Promise<{ ok: boolean; data: Any }> {
  try {
    const r = await fetch(url, { cache: 'no-store', ...init, headers: init?.body ? { 'Content-Type': 'application/json' } : undefined })
    const data = await r.json().catch(() => ({}))
    return { ok: r.ok, data: data ?? {} }
  } catch { return { ok: false, data: { error: 'Network error — try again.' } } }
}
