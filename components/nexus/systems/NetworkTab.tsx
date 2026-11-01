'use client'
/**
 * Systems → Network (UniFi).
 *   • Internet now — status, ISP, speed / latency / loss / uptime, alerts.
 *   • Internet history — 24 h / 7 d / 30 d speed and latency charts with outages
 *     shaded (Site Manager ISP metrics).
 *   • Network gear — every gateway / switch / access point with firmware + update
 *     flags; tap one for live CPU / memory / uplink, switch ports with PoE, Wi-Fi
 *     radios, and Restart / PoE power-cycle (logged to the property's activity).
 *   • Who's connected — searchable client list (Wi-Fi / wired / guest / VPN).
 *   • Guest Wi-Fi codes — make, copy, print and delete hotspot vouchers.
 * Device controls go through Ubiquiti's cloud connector (lib/unifi-net.ts); if the
 * console can't be reached that way, the tab falls back to the cloud overview it
 * always showed.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { type Any, BLUE, Card, Dot, DOT, GREEN, MUTED, NotConnected, Note, RED, Sheet, getJson, send, type SiteCtx } from './shared'

const UP = '#C93400' // upload line (validated against BLUE for colour-blind separation)
const upt = (s?: number | null) => s == null ? '' : s >= 86400 ? `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h` : s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m` : `${Math.floor(s / 60)}m`
const r1 = (n: number) => n >= 100 ? Math.round(n) : Math.round(n * 10) / 10
const rate = (bps?: number | null) => bps == null ? '—' : bps >= 1e9 ? `${r1(bps / 1e9)} Gbps` : bps >= 1e6 ? `${r1(bps / 1e6)} Mbps` : bps >= 1e3 ? `${r1(bps / 1e3)} Kbps` : `${Math.round(bps)} bps`
const speed = (m?: number | null) => m == null || m <= 0 ? '' : m >= 1000 ? `${r1(m / 1000)}G` : `${m}M`
const since = (iso?: string | null) => { if (!iso) return ''; const s = (Date.now() - Date.parse(iso)) / 1000; return s < 0 ? '' : upt(s) }
const KIND_LABEL: Record<string, string> = { gateway: 'Gateway', switch: 'Switch', ap: 'Wi-Fi', other: 'Device' }

const CSS = `
.nw-alerts{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
.nw-al{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:500;border-radius:999px;padding:4px 10px;background:#F2F2F7;color:#3A3A3C}
.nw-al.bad{background:#FFECEC;color:${RED}}.nw-al.warn{background:#FFF4E5;color:#B25000}.nw-al.ok{background:#E8F6EC;color:${GREEN}}
.nw-chart{position:relative;width:100%}
.nw-chart svg{display:block;overflow:visible}
.nw-tip{position:absolute;top:0;pointer-events:none;background:#1D1D1F;color:#fff;border-radius:8px;padding:6px 9px;font-size:12px;line-height:1.45;white-space:nowrap;transform:translateX(-50%);z-index:2;box-shadow:0 6px 18px rgba(0,0,0,.2)}
.nw-legend{display:flex;gap:14px;font-size:12px;color:${MUTED};align-items:center;flex-wrap:wrap}
.nw-legend i{display:inline-block;width:14px;height:2px;border-radius:1px;vertical-align:middle;margin-right:5px}
.nw-sum{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-top:12px}
.nw-sum div{background:#F5F5F7;border-radius:10px;padding:8px 10px}
.nw-sum b{display:block;font-size:17px;font-weight:600;font-variant-numeric:tabular-nums}
.nw-sum span{font-size:11.5px;color:${MUTED}}
.nw-dev{display:flex;align-items:center;gap:10px;width:100%;text-align:left;border:0;background:none;padding:10px 0;border-top:1px solid rgba(0,0,0,.08);font:inherit;color:inherit;cursor:pointer}
.nw-dev:first-child{border-top:0}
.nw-dev:disabled{cursor:default}
.nw-dev:not(:disabled):hover .t{color:${BLUE}}
.nw-dev .main{flex:1;min-width:0}
.nw-dev .t{font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nw-dev .m{font-size:12px;color:${MUTED};margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nw-kind{font-size:11px;font-weight:600;color:#3A3A3C;background:#F2F2F7;border-radius:6px;padding:2px 7px;flex:none}
.nw-upd{font-size:11px;font-weight:600;color:${BLUE};background:#EEF4FF;border-radius:6px;padding:2px 7px;flex:none}
.nw-bar{height:6px;border-radius:3px;background:#F2F2F7;overflow:hidden}
.nw-bar>i{display:block;height:6px;border-radius:3px}
.nw-ports{display:grid;grid-template-columns:repeat(auto-fill,minmax(54px,1fr));gap:6px}
.nw-port{border:1px solid rgba(0,0,0,.12);border-radius:8px;background:#fff;padding:6px 4px;text-align:center;cursor:pointer;font:inherit;color:inherit}
.nw-port.up{border-color:rgba(26,127,55,.45);background:#F3FAF5}
.nw-port[aria-pressed=true]{outline:2px solid ${BLUE};outline-offset:1px}
.nw-port b{display:block;font-size:13px;font-weight:600}
.nw-port span{display:block;font-size:10.5px;color:${MUTED};min-height:13px}
.nw-facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 14px;font-size:13px}
.nw-facts dt{font-size:11.5px;color:${MUTED}}
.nw-facts dd{margin:1px 0 0;font-weight:500;overflow:hidden;text-overflow:ellipsis}
.nw-confirm{border:1px solid rgba(215,0,21,.25);background:#FFF6F6;border-radius:12px;padding:12px;display:grid;gap:10px;font-size:13px}
.nw-code{font:600 15px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.04em}
.nw-new{background:#EEF4FF;border-radius:12px;padding:10px 12px}
.nw-tbl{width:100%;border-collapse:collapse;font-size:13px}
.nw-tbl th{text-align:left;font-size:11.5px;color:${MUTED};font-weight:500;padding:4px 6px}
.nw-tbl td{padding:6px;border-top:1px solid rgba(0,0,0,.08);font-variant-numeric:tabular-nums}
`

function Spark({ data }: { data: number[] }) {
  if (!data || data.length < 2) return null
  const w = 160, h = 40, max = Math.max(...data), min = Math.min(...data), rng = max - min || 1
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / rng) * (h - 6) - 3}`)
  return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-label="Download speed trend" role="img"><polyline points={pts.join(' ')} fill="none" stroke={BLUE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" /></svg>
}

export function NetworkTab({ ctx, ov }: { ctx: SiteCtx; ov: Any | null | undefined }) {
  const { siteId, isCorporate, openSetup, notify } = ctx
  // Gear from the console itself (needs the cloud connector). null = loading, false = not available.
  const [gear, setGear] = useState<Any[] | null | false>(null)
  const [gearErr, setGearErr] = useState<string | null>(null)
  const [open, setOpen] = useState<Any | null>(null)
  const loadGear = useCallback(async () => {
    const r = await getJson(`/api/unifi/net?site_id=${siteId}&view=devices`)
    if (r.ok && Array.isArray(r.data.devices)) { setGear(r.data.devices); setGearErr(null) } else { setGear(false); setGearErr(r.data.error || 'Device controls unavailable.') }
  }, [siteId])
  useEffect(() => { if (ov) void loadGear() }, [ov, loadGear])

  if (ov === undefined) return <Card title="Network"><div className="sy-empty">Loading network…</div></Card>
  if (!ov) return <Card title="Network"><NotConnected what="UniFi (network)" isCorporate={isCorporate} onSetup={openSetup} /></Card>

  const i = ov.internet ?? {}, cns = ov.console ?? {}, cl = ov.clients ?? {}, hl = ov.health ?? {}, al = ov.alerts ?? {}
  const status = i.status === 'up' ? 'Online' : i.status === 'down' ? 'Offline' : 'Unknown'
  const sc = i.status === 'up' ? DOT.green : i.status === 'down' ? DOT.red : DOT.orange
  const tiles = [
    i.download_mbps != null && { l: 'Download', v: `${r1(i.download_mbps)}`, u: 'Mbps' },
    i.upload_mbps != null && { l: 'Upload', v: `${r1(i.upload_mbps)}`, u: 'Mbps' },
    i.latency_ms != null && { l: 'Latency', v: `${Math.round(i.latency_ms)}`, u: 'ms' },
    i.packet_loss_pct != null && { l: 'Packet loss', v: `${r1(i.packet_loss_pct)}`, u: '%', bad: i.packet_loss_pct > 1 },
    i.uptime_pct != null && { l: 'Uptime', v: `${r1(i.uptime_pct)}`, u: '%' },
    { l: 'Clients', v: String(cl.total ?? 0), u: '' },
  ].filter(Boolean) as { l: string; v: string; u: string; bad?: boolean }[]
  const controls = Array.isArray(gear)
  const updates = controls ? (gear as Any[]).filter(d => d.updatable).length : (al.pending_updates ?? 0)
  const offline = controls ? (gear as Any[]).filter(d => !d.online).length : (hl.offline ?? 0)

  return (
    <div className="sy-stack">
      <style>{CSS}</style>
      <Card title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Dot c={sc} />Internet {status}</span>}
        sub={[i.isp, i.public_ip || cns.public_ip, cns.model, cns.version ? `v${cns.version}` : null, upt(cns.uptime_s) ? `up ${upt(cns.uptime_s)}` : null].filter(Boolean).join(' · ')}
        right={Array.isArray(i.trend) && i.trend.length > 1 ? <div style={{ textAlign: 'right' }}><Spark data={i.trend} /><div style={{ fontSize: 11, color: MUTED }}>Download trend</div></div> : undefined}>
        <div className="sy-kpis" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', marginBottom: 0 }}>
          {tiles.map(t => <div key={t.l} className="sy-kpi" style={{ boxShadow: 'none', background: '#F5F5F7' }}><div className="l">{t.l}</div><div className="v" style={{ color: t.bad ? RED : undefined }}>{t.v}<span style={{ fontSize: 13, color: MUTED, fontWeight: 500, marginLeft: 3 }}>{t.u}</span></div></div>)}
        </div>
        <div className="nw-alerts">
          {offline > 0 ? <span className="nw-al bad"><Dot c={DOT.red} />{offline} device{offline === 1 ? '' : 's'} offline</span> : <span className="nw-al ok"><Dot c={DOT.green} />All gear online</span>}
          {updates > 0 && <span className="nw-al warn">{updates} firmware update{updates === 1 ? '' : 's'} available</span>}
          {(al.critical ?? 0) > 0 && <span className="nw-al bad">{al.critical} critical notice{al.critical === 1 ? '' : 's'} in UniFi</span>}
          {(al.internet_issues ?? 0) > 0 && <span className="nw-al warn">{al.internet_issues} recent internet issue{al.internet_issues === 1 ? '' : 's'}</span>}
          <span className="nw-al" title={gearErr ?? undefined}>{gear === null ? 'Checking remote control…' : controls ? 'Remote control on' : 'Remote control off'}</span>
        </div>
      </Card>

      <HistoryCard siteId={siteId} />

      <GearCard gear={controls ? gear as Any[] : null} cloud={Array.isArray(ov.devices) ? ov.devices : []} err={gear === false ? gearErr : null} onOpen={setOpen} />

      <div className="sy-grid2" style={{ alignItems: 'start' }}>
        <ClientsCard siteId={siteId} counts={cl} gear={controls ? gear as Any[] : []} />
        <VouchersCard siteId={siteId} enabled={controls} notify={notify} />
      </div>

      {open && <DeviceSheet siteId={siteId} dev={open} gear={controls ? gear as Any[] : []} notify={notify} onClose={() => setOpen(null)} onChanged={loadGear} />}
    </div>
  )
}

// ── Internet history ────────────────────────────────────────────────────────
type Pt = { t: string; down: number | null; up: number | null; latency: number | null; maxLatency: number | null; loss: number | null; uptime: number | null; downtime: number | null }
// An interval counts as an outage when UniFi reports any downtime in it.
const isOut = (p: Pt) => p.downtime != null && p.downtime > 0

function HistoryCard({ siteId }: { siteId: string }) {
  const [range, setRange] = useState<'24h' | '7d' | '30d'>('24h')
  const [res, setRes] = useState<{ points: Pt[]; err: string | null } | null>(null)
  const [hover, setHover] = useState<number | null>(null)
  useEffect(() => {
    let alive = true; setRes(null); setHover(null)
    void getJson(`/api/unifi/net?site_id=${siteId}&view=history&range=${range}`).then(r => { if (alive) setRes({ points: Array.isArray(r.data.points) ? r.data.points : [], err: r.ok ? null : (r.data.error || 'History unavailable.') }) })
    return () => { alive = false }
  }, [siteId, range])
  const pts = res?.points ?? []
  const avg = (k: keyof Pt) => { const v = pts.map(p => p[k]).filter((x): x is number => typeof x === 'number'); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null }
  const worst = pts.reduce<number | null>((m, p) => p.maxLatency != null && (m == null || p.maxLatency > m) ? p.maxLatency : m, null)
  const outs = pts.filter(isOut).length
  const fmtX = (t: string) => new Date(t).toLocaleString(undefined, range === '24h' ? { hour: 'numeric' } : { month: 'short', day: 'numeric' })
  const fmtTip = (t: string) => new Date(t).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  return (
    <Card title="Internet history" sub="From UniFi’s own speed and latency checks"
      right={<div className="sy-chips" role="group" aria-label="History range">{(['24h', '7d', '30d'] as const).map(r => <button key={r} type="button" className="sy-chip" aria-pressed={range === r} onClick={() => setRange(r)}>{r === '24h' ? '24 hours' : r === '7d' ? '7 days' : '30 days'}</button>)}</div>}>
      {res == null ? <div className="sy-empty">Loading history…</div>
        : res.err ? <Note tone="orange">{res.err}</Note>
        : pts.length < 2 ? <div className="sy-empty">No history reported for this range yet.</div>
        : <>
          <div className="nw-legend" style={{ marginBottom: 6 }}><span style={{ fontWeight: 600, color: '#1D1D1F' }}>Speed (Mbps)</span><span><i style={{ background: BLUE }} />Download</span><span><i style={{ background: UP }} />Upload</span>{outs > 0 && <span><i style={{ background: 'rgba(215,0,21,.25)', height: 8 }} />Outage</span>}</div>
          <LineChart pts={pts} series={[{ k: 'down', c: BLUE, label: 'Download', unit: 'Mbps' }, { k: 'up', c: UP, label: 'Upload', unit: 'Mbps' }]} height={170} hover={hover} setHover={setHover} fmtX={fmtX} fmtTip={fmtTip} />
          <div className="nw-legend" style={{ margin: '14px 0 6px' }}><span style={{ fontWeight: 600, color: '#1D1D1F' }}>Latency (ms)</span></div>
          <LineChart pts={pts} series={[{ k: 'latency', c: BLUE, label: 'Latency', unit: 'ms' }]} height={120} hover={hover} setHover={setHover} fmtX={fmtX} fmtTip={fmtTip} />
          <div className="nw-sum">
            <div><b>{avg('down') != null ? r1(avg('down')!) : '—'}</b><span>Avg download, Mbps</span></div>
            <div><b>{avg('up') != null ? r1(avg('up')!) : '—'}</b><span>Avg upload, Mbps</span></div>
            <div><b>{avg('latency') != null ? Math.round(avg('latency')!) : '—'}</b><span>Avg latency, ms</span></div>
            <div><b>{worst != null ? Math.round(worst) : '—'}</b><span>Worst latency, ms</span></div>
            <div><b style={{ color: outs ? RED : undefined }}>{outs}</b><span>Intervals with an outage</span></div>
          </div>
        </>}
    </Card>
  )
}

function useWidth(): [React.RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(640)
  useEffect(() => {
    const el = ref.current; if (!el) return
    setW(el.clientWidth || 640)
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => setW(el.clientWidth || 640)) : null
    ro?.observe(el); return () => ro?.disconnect()
  }, [])
  return [ref, w]
}
const niceMax = (v: number) => { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const f = v / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p }

function LineChart({ pts, series, height, hover, setHover, fmtX, fmtTip }: { pts: Pt[]; series: { k: keyof Pt; c: string; label: string; unit: string }[]; height: number; hover: number | null; setHover: (i: number | null) => void; fmtX: (t: string) => string; fmtTip: (t: string) => string }) {
  const [ref, w] = useWidth()
  const L = 40, R = 8, T = 6, B = 22, iw = Math.max(50, w - L - R), ih = height - T - B
  const vals = series.flatMap(s => pts.map(p => p[s.k]).filter((x): x is number => typeof x === 'number'))
  const max = niceMax(Math.max(1, ...vals))
  const x = (i: number) => L + (pts.length < 2 ? 0 : (i / (pts.length - 1)) * iw)
  const y = (v: number) => T + ih - (v / max) * ih
  const path = (k: keyof Pt) => { let d = '', pen = false; pts.forEach((p, i) => { const v = p[k]; if (typeof v !== 'number') { pen = false; return } d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`; pen = true }); return d }
  const ticks = [0, max / 2, max]
  const step = Math.max(1, Math.ceil(pts.length / Math.max(2, Math.floor(iw / 90))))
  // One label per new hour/day, spaced so they never collide.
  const xLabels: { i: number; label: string }[] = []
  pts.forEach((p, i) => { const label = fmtX(p.t); const last = xLabels[xLabels.length - 1]; if ((!last || last.label !== label) && (!last || i - last.i >= step)) xLabels.push({ i, label }) })
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => { const r = e.currentTarget.getBoundingClientRect(); const i = Math.round(((e.clientX - r.left - L) / iw) * (pts.length - 1)); setHover(Math.max(0, Math.min(pts.length - 1, i))) }
  const hp = hover != null ? pts[hover] : null
  return (
    <div className="nw-chart" ref={ref}>
      <svg width={w} height={height} role="img" aria-label={`${series.map(s => s.label).join(' and ')} over time`} onPointerMove={onMove} onPointerLeave={() => setHover(null)} style={{ touchAction: 'pan-y' }}>
        {pts.map((p, i) => isOut(p) ? <rect key={`o${i}`} x={x(Math.max(0, i - 0.5))} y={T} width={Math.max(2, x(Math.min(pts.length - 1, i + 0.5)) - x(Math.max(0, i - 0.5)))} height={ih} fill="rgba(215,0,21,.14)" /> : null)}
        {ticks.map(t => <g key={t}><line x1={L} x2={L + iw} y1={y(t)} y2={y(t)} stroke="rgba(0,0,0,.07)" /><text x={L - 6} y={y(t) + 3.5} textAnchor="end" fontSize="10.5" fill={MUTED}>{t >= 100 ? Math.round(t) : r1(t)}</text></g>)}
        {xLabels.map(({ i, label }) => <text key={`x${i}`} x={x(i)} y={height - 6} textAnchor="middle" fontSize="10.5" fill={MUTED}>{label}</text>)}
        {series.map(s => <path key={String(s.k)} d={path(s.k)} fill="none" stroke={s.c} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />)}
        {hp && <>
          <line x1={x(hover!)} x2={x(hover!)} y1={T} y2={T + ih} stroke="rgba(0,0,0,.35)" strokeDasharray="3 3" />
          {series.map(s => typeof hp[s.k] === 'number' ? <circle key={String(s.k)} cx={x(hover!)} cy={y(hp[s.k] as number)} r={4} fill={s.c} stroke="#fff" strokeWidth={2} /> : null)}
        </>}
      </svg>
      {hp && <div className="nw-tip" style={{ left: Math.min(w - 70, Math.max(70, x(hover!))) }}>
        <div style={{ fontWeight: 600 }}>{fmtTip(hp.t)}</div>
        {series.map(s => <div key={String(s.k)}>{s.label}: {typeof hp[s.k] === 'number' ? `${r1(hp[s.k] as number)} ${s.unit}` : '—'}</div>)}
        {hp.loss != null && hp.loss > 0 && <div>Packet loss: {r1(hp.loss)}%</div>}
        {isOut(hp) && <div style={{ color: '#FF8A80' }}>Outage in this interval</div>}
      </div>}
    </div>
  )
}

// ── Gear ────────────────────────────────────────────────────────────────────
const FILTERS: [string, string][] = [['all', 'All'], ['gateway', 'Gateways'], ['switch', 'Switches'], ['ap', 'Wi-Fi'], ['offline', 'Offline'], ['updates', 'Updates']]
function GearCard({ gear, cloud, err, onOpen }: { gear: Any[] | null; cloud: Any[]; err: string | null; onOpen: (d: Any) => void }) {
  const [f, setF] = useState('all')
  const [q, setQ] = useState('')
  const list: Any[] = gear ?? cloud.map((d, k) => ({ id: `c${k}`, name: d.name ?? d.model ?? 'Device', model: d.model, ip: d.ip, online: !!d.online, firmware: d.version, updatable: !!d.update_available, kind: /gateway|udm|usg|uxg|ucg|console/i.test(`${d.type ?? ''} ${d.model ?? ''} ${d.product_line ?? ''}`) ? 'gateway' : /usw|switch/i.test(`${d.model ?? ''} ${d.type ?? ''}`) ? 'switch' : /u6|u7|uap|ap|nano|lite|mesh/i.test(`${d.model ?? ''} ${d.type ?? ''}`) ? 'ap' : 'other', uptime_s: d.uptime_s, clients: d.clients, cloudOnly: true }))
  const count = (k: string) => list.filter(d => k === 'all' ? true : k === 'offline' ? !d.online : k === 'updates' ? d.updatable : d.kind === k).length
  const shown = list.filter(d => (f === 'all' || (f === 'offline' ? !d.online : f === 'updates' ? d.updatable : d.kind === f)) && (!q.trim() || `${d.name} ${d.model ?? ''} ${d.ip ?? ''} ${d.mac ?? ''}`.toLowerCase().includes(q.trim().toLowerCase())))
    .sort((a, b) => Number(a.online) - Number(b.online) || ['gateway', 'switch', 'ap', 'other'].indexOf(a.kind) - ['gateway', 'switch', 'ap', 'other'].indexOf(b.kind) || String(a.name).localeCompare(String(b.name)))
  return (
    <Card title={`Network gear${list.length ? ` (${list.length})` : ''}`} sub={gear ? 'Tap a device for live stats, ports and controls' : 'From the UniFi cloud overview'}>
      {err && <div style={{ marginBottom: 10 }}><Note tone="orange">Remote control isn’t available for this console: {err}</Note></div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6, alignItems: 'center' }}>
        <div className="sy-chips" role="group" aria-label="Filter gear">{FILTERS.map(([k, l]) => count(k) || k === 'all' ? <button key={k} type="button" className="sy-chip" aria-pressed={f === k} onClick={() => setF(k)}>{l} {count(k)}</button> : null)}</div>
        <input className="sy-in" style={{ flex: '1 1 180px', maxWidth: 260, marginLeft: 'auto' }} value={q} onChange={e => setQ(e.target.value)} placeholder="Find a device, IP or MAC" aria-label="Find a device" />
      </div>
      {!shown.length ? <div className="sy-empty">{list.length ? 'Nothing matches.' : 'No devices reported.'}</div> : shown.map(d => (
        <button key={d.id} type="button" className="nw-dev" disabled={!!d.cloudOnly} onClick={() => onOpen(d)} aria-label={d.cloudOnly ? undefined : `${d.name} — details`}>
          <Dot c={d.online ? DOT.green : DOT.red} />
          <span className="main"><span className="t" style={{ display: 'block' }}>{d.name}</span><span className="m" style={{ display: 'block' }}>{[d.model, d.ip, d.firmware ? `v${d.firmware}` : null, !d.online ? (d.state && d.state !== 'OFFLINE' ? String(d.state).toLowerCase().replace(/_/g, ' ') : 'offline') : null, d.uptime_s ? `up ${upt(d.uptime_s)}` : null].filter(Boolean).join(' · ')}</span></span>
          {d.updatable && <span className="nw-upd">Update</span>}
          <span className="nw-kind">{KIND_LABEL[d.kind] ?? 'Device'}</span>
          {d.clients != null && <span style={{ fontSize: 12, color: MUTED, whiteSpace: 'nowrap' }}>{d.clients} clients</span>}
        </button>
      ))}
    </Card>
  )
}

function DeviceSheet({ siteId, dev, gear, notify, onClose, onChanged }: { siteId: string; dev: Any; gear: Any[]; notify: (m: string, ok?: boolean) => void; onClose: () => void; onChanged: () => void }) {
  const [d, setD] = useState<Any | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [port, setPort] = useState<number | null>(null)
  const [confirm, setConfirm] = useState<'restart' | 'cycle' | null>(null)
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    const r = await getJson(`/api/unifi/net?site_id=${siteId}&view=device&id=${encodeURIComponent(dev.id)}`)
    if (r.ok && r.data.device) { setD(r.data.device); setErr(null) } else setErr(r.data.error || 'Couldn’t load this device.')
  }, [siteId, dev.id])
  useEffect(() => { void load(); const t = setInterval(() => { if (!document.hidden) void load() }, 15_000); return () => clearInterval(t) }, [load])
  const x = d ?? dev
  const uplink = d?.uplinkDeviceId ? gear.find(g => g.id === d.uplinkDeviceId)?.name : null
  const p = port != null ? (d?.portList ?? []).find((q: Any) => q.idx === port) : null
  async function act(kind: 'restart' | 'cycle') {
    setBusy(true)
    const r = await send(`/api/unifi/net?site_id=${siteId}`, 'POST', kind === 'restart' ? { action: 'restart', device_id: x.id, device_name: x.name } : { action: 'power_cycle', device_id: x.id, port, device_name: x.name })
    setBusy(false); setConfirm(null)
    if (r.ok) { notify(kind === 'restart' ? `${x.name} is restarting — back in a few minutes.` : `Port ${port} power-cycled.`); onChanged() } else notify(r.data.error || 'UniFi didn’t accept that.', false)
  }
  const warn = x.kind === 'gateway' ? 'The whole property loses internet for about 2–5 minutes.' : x.kind === 'switch' ? 'Everything plugged into this switch — cameras, gate controllers, access points — goes offline for about 2 minutes.' : x.kind === 'ap' ? 'Wi-Fi users on this access point drop for about 2 minutes.' : 'The device goes offline for a couple of minutes.'
  return (
    <Sheet title={x.name} sub={[KIND_LABEL[x.kind] ?? 'Device', x.model, x.online ? 'Online' : 'Offline'].filter(Boolean).join(' · ')} onClose={onClose} width={680} locked={busy}>
      {err && <Note tone="orange">{err}</Note>}
      <dl className="nw-facts" style={{ margin: 0 }}>
        <div><dt>IP address</dt><dd>{x.ip ?? '—'}</dd></div>
        <div><dt>MAC</dt><dd>{x.mac ?? '—'}</dd></div>
        <div><dt>Firmware</dt><dd>{x.firmware ? `v${x.firmware}` : '—'}{x.updatable && <span className="nw-upd" style={{ marginLeft: 6 }}>Update available</span>}</dd></div>
        <div><dt>Up for</dt><dd>{d?.stats?.uptimeSec != null ? upt(d.stats.uptimeSec) : '—'}</dd></div>
        <div><dt>Connected to</dt><dd>{uplink ?? (d?.uplinkDeviceId ? 'Another device' : x.kind === 'gateway' ? 'Internet' : '—')}</dd></div>
        <div><dt>Adopted</dt><dd>{d?.adoptedAt ? new Date(d.adoptedAt).toLocaleDateString() : '—'}</dd></div>
      </dl>

      {d?.stats && (
        <div style={{ display: 'grid', gap: 10 }}>
          {([['CPU', d.stats.cpuPct], ['Memory', d.stats.memPct]] as [string, number | null][]).map(([l, v]) => v == null ? null : (
            <div key={l}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: MUTED, marginBottom: 4 }}><span>{l}</span><span style={{ color: '#1D1D1F', fontWeight: 600 }}>{Math.round(v)}%</span></div>
              <div className="nw-bar"><i style={{ width: `${Math.min(100, v)}%`, background: v > 85 ? RED : v > 65 ? '#B25000' : BLUE }} /></div></div>
          ))}
          <div style={{ fontSize: 13, color: MUTED }}>Uplink now: ↓ {rate(d.stats.rxBps)} · ↑ {rate(d.stats.txBps)}{d.stats.load1 != null ? ` · load ${r1(d.stats.load1)} / ${r1(d.stats.load5 ?? 0)} / ${r1(d.stats.load15 ?? 0)}` : ''}</div>
        </div>
      )}

      {d && d.portList?.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Ports <span style={{ fontWeight: 400, color: MUTED }}>· {d.portList.filter((q: Any) => q.up).length} of {d.portList.length} in use · ⚡ = PoE on</span></div>
          <div className="nw-ports" role="group" aria-label="Ports">
            {d.portList.map((q: Any) => (
              <button key={q.idx} type="button" className={`nw-port ${q.up ? 'up' : ''}`} aria-pressed={port === q.idx} onClick={() => { setPort(port === q.idx ? null : q.idx); setConfirm(null) }} aria-label={`Port ${q.idx}${q.up ? `, ${speed(q.speedMbps) || 'up'}` : ', not in use'}${q.poe?.enabled ? ', PoE on' : ''}`}>
                <b>{q.idx}</b><span>{q.up ? speed(q.speedMbps) || 'up' : '—'}{q.poe?.enabled ? ' ⚡' : ''}</span>
              </button>
            ))}
          </div>
          {p && (
            <div style={{ marginTop: 8, fontSize: 13, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span><b>Port {p.idx}</b> · {p.up ? `connected at ${speed(p.speedMbps) || '?'}bps` : 'nothing connected'}{p.maxSpeedMbps ? ` (max ${speed(p.maxSpeedMbps)})` : ''}{p.poe ? ` · PoE ${p.poe.enabled ? 'on' : 'off'}${p.poe.standard ? ` (${p.poe.standard})` : ''}` : ''}</span>
              {p.poe?.enabled && confirm !== 'cycle' && <button type="button" className="sy-b line sm" onClick={() => setConfirm('cycle')}>Power-cycle this port</button>}
            </div>
          )}
          {confirm === 'cycle' && p && (
            <div className="nw-confirm" style={{ marginTop: 8 }}>
              <div>Cut and restore power on <b>port {p.idx}</b>? Whatever it powers (camera, access point, gate reader) restarts and is back in about a minute.</div>
              <div className="sy-acts"><button type="button" className="sy-b line sm" onClick={() => setConfirm(null)} disabled={busy}>Cancel</button><button type="button" className="sy-b pri sm" style={{ background: RED }} onClick={() => act('cycle')} disabled={busy}>{busy ? 'Working…' : 'Power-cycle port'}</button></div>
            </div>
          )}
        </div>
      )}

      {d && d.radioList?.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Wi-Fi radios</div>
          <table className="nw-tbl"><thead><tr><th>Band</th><th>Channel</th><th>Width</th><th>Standard</th><th>Retries</th></tr></thead>
            <tbody>{d.radioList.map((r: Any, k: number) => <tr key={k}><td>{r.band}</td><td>{r.channel ?? '—'}</td><td>{r.widthMHz ? `${r.widthMHz} MHz` : '—'}</td><td>{r.standard ?? '—'}</td><td style={{ color: r.retriesPct > 15 ? RED : undefined }}>{r.retriesPct != null ? `${r1(r.retriesPct)}%` : '—'}</td></tr>)}</tbody>
          </table>
        </div>
      )}

      {d == null && !err && <div className="sy-empty">Loading live stats…</div>}

      {confirm === 'restart' ? (
        <div className="nw-confirm">
          <div><b>Restart {x.name}?</b> {warn}</div>
          <div className="sy-acts"><button type="button" className="sy-b line sm" onClick={() => setConfirm(null)} disabled={busy}>Cancel</button><button type="button" className="sy-b pri sm" style={{ background: RED }} onClick={() => act('restart')} disabled={busy}>{busy ? 'Restarting…' : 'Restart now'}</button></div>
        </div>
      ) : (
        <div className="sy-acts" style={{ justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: MUTED }}>Restarts and power-cycles are recorded in this property’s activity.</span>
          <button type="button" className="sy-b line sm" onClick={() => setConfirm('restart')} disabled={!x.online}>Restart device</button>
        </div>
      )}
    </Sheet>
  )
}

// ── Clients ─────────────────────────────────────────────────────────────────
const CTYPES: [string, string][] = [['', 'All'], ['WIRELESS', 'Wi-Fi'], ['WIRED', 'Wired'], ['GUEST', 'Guests'], ['VPN', 'VPN']]
function ClientsCard({ siteId, counts, gear }: { siteId: string; counts: Any; gear: Any[] }) {
  const [show, setShow] = useState(false)
  const [list, setList] = useState<Any[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [t, setT] = useState('')
  useEffect(() => {
    if (!show || list) return
    void getJson(`/api/unifi/net?site_id=${siteId}&view=clients`).then(async r => {
      if (r.ok && Array.isArray(r.data.clients)) { setList(r.data.clients); return }
      // Older path (console reachable directly) — same list, fewer details.
      const o = await getJson(`/api/unifi/clients?site_id=${siteId}`)
      if (o.ok && Array.isArray(o.data.clients)) setList(o.data.clients.map((c: Any, k: number) => ({ id: c.mac ?? k, name: c.name || c.mac, ip: c.ip, mac: c.mac, type: c.wired ? 'WIRED' : 'WIRELESS', guest: false })))
      else { setList([]); setErr(r.data.error || o.data.error || 'Client list unavailable.') }
    })
  }, [show, list, siteId])
  const nameOf = (id?: string | null) => id ? gear.find(g => g.id === id)?.name ?? null : null
  const mix = [{ k: 'Wi-Fi', v: counts.wifi ?? 0 }, { k: 'Wired', v: counts.wired ?? 0 }, { k: 'Guest', v: counts.guest ?? 0 }]
  const shown = useMemo(() => (list ?? []).filter(c => (!t || (t === 'GUEST' ? c.guest : c.type === t)) && (!q.trim() || `${c.name} ${c.ip ?? ''} ${c.mac ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()))), [list, t, q])
  return (
    <Card title="Who’s connected" sub={`${counts.total ?? 0} clients right now`}>
      {mix.map(m => <div key={m.k} className="sy-row"><div className="main"><div className="t" style={{ fontSize: 13 }}>{m.k}</div></div><span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 14 }}>{m.v}</span></div>)}
      <button type="button" className="sy-b line sm" style={{ marginTop: 8 }} onClick={() => setShow(v => !v)}>{show ? 'Hide the list' : 'Show every client'}</button>
      {show && (list == null ? <div className="sy-empty">Loading…</div> : <>
        {err && <div style={{ marginTop: 8 }}><Note tone="orange">{err}</Note></div>}
        {list.length > 0 && <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
          <input className="sy-in" value={q} onChange={e => setQ(e.target.value)} placeholder="Find a name, IP or MAC" aria-label="Find a client" />
          <div className="sy-chips" role="group" aria-label="Client type">{CTYPES.map(([k, l]) => <button key={k || 'all'} type="button" className="sy-chip" aria-pressed={t === k} onClick={() => setT(k)}>{l}</button>)}</div>
        </div>}
        <div className="sy-feed" style={{ maxHeight: 340, marginTop: 6 }}>
          {!shown.length && !err ? <div className="sy-empty">No clients match.</div> : shown.slice(0, 500).map(c => (
            <div key={c.id} className="sy-row"><div className="main">
              <div className="t" style={{ fontSize: 13 }}>{c.name}{c.guest && <span className="sy-pill" style={{ marginLeft: 6 }}>Guest</span>}</div>
              <div className="m">{[c.type === 'WIRED' ? 'Wired' : c.type === 'WIRELESS' ? 'Wi-Fi' : c.type === 'VPN' ? 'VPN' : null, c.ip, c.mac, c.connectedAt ? `on for ${since(c.connectedAt)}` : null, nameOf(c.uplinkDeviceId) ? `via ${nameOf(c.uplinkDeviceId)}` : null].filter(Boolean).join(' · ')}</div>
            </div></div>
          ))}
        </div>
      </>)}
    </Card>
  )
}

// ── Guest Wi-Fi codes ───────────────────────────────────────────────────────
const DURATIONS: [number, string][] = [[60, '1 hour'], [480, '8 hours'], [1440, '1 day'], [4320, '3 days'], [10080, '1 week'], [43200, '30 days']]
const fmtCode = (c: string) => c.length === 10 ? `${c.slice(0, 5)}-${c.slice(5)}` : c
const fmtMins = (m?: number | null) => m == null ? '' : m % 1440 === 0 ? `${m / 1440} day${m === 1440 ? '' : 's'}` : m % 60 === 0 ? `${m / 60} hour${m === 60 ? '' : 's'}` : `${m} min`

function VouchersCard({ siteId, enabled, notify }: { siteId: string; enabled: boolean; notify: (m: string, ok?: boolean) => void }) {
  const [list, setList] = useState<Any[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [making, setMaking] = useState(false)
  const [form, setForm] = useState({ count: 1, minutes: 1440, guests: '1', name: '' })
  const [fresh, setFresh] = useState<Any[]>([])
  const [busy, setBusy] = useState(false)
  const [del, setDel] = useState<string | null>(null)
  const load = useCallback(async () => {
    const r = await getJson(`/api/unifi/net?site_id=${siteId}&view=vouchers`)
    if (r.ok && Array.isArray(r.data.vouchers)) { setList(r.data.vouchers); setErr(null) } else { setList([]); setErr(r.data.error || 'Guest codes unavailable.') }
  }, [siteId])
  useEffect(() => { if (enabled) void load() }, [enabled, load])
  async function create() {
    setBusy(true)
    const r = await send(`/api/unifi/net?site_id=${siteId}`, 'POST', { action: 'create_vouchers', count: form.count, minutes: form.minutes, guest_limit: form.guests, name: form.name })
    setBusy(false)
    if (r.ok) { setFresh(r.data.vouchers ?? []); setMaking(false); notify(`${form.count} guest code${form.count === 1 ? '' : 's'} made.`); void load() } else notify(r.data.error || 'Couldn’t make codes.', false)
  }
  async function remove(id: string) {
    setBusy(true)
    const r = await send(`/api/unifi/net?site_id=${siteId}`, 'POST', { action: 'delete_voucher', id })
    setBusy(false); setDel(null)
    if (r.ok) { notify('Code deleted.'); setFresh(f => f.filter(v => v.id !== id)); void load() } else notify(r.data.error || 'Couldn’t delete that code.', false)
  }
  function print(codes: Any[]) {
    // Our own blank page (no 'noopener' — that makes window.open return null).
    const w = window.open('', '_blank', 'width=720,height=900'); if (!w) { notify('Allow pop-ups to print codes.', false); return }
    const esc = (s: string) => s.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] as string))
    w.document.write(`<!doctype html><title>Guest Wi-Fi codes</title><style>body{font-family:-apple-system,system-ui,sans-serif;margin:24px}div{border:1px dashed #999;border-radius:10px;padding:16px;margin:0 0 12px;break-inside:avoid}b{font:700 26px ui-monospace,Menlo,monospace;letter-spacing:.06em}p{margin:6px 0 0;color:#555}</style>${codes.map(v => `<div><p>Guest Wi-Fi code</p><b>${esc(fmtCode(v.code))}</b><p>Good for ${esc(fmtMins(v.minutes))}${v.guestLimit ? ` · ${v.guestLimit} device${v.guestLimit === 1 ? '' : 's'}` : ''}</p></div>`).join('')}<script>print()</script>`)
    w.document.close()
  }
  const active = (list ?? []).filter(v => !v.expired)
  return (
    <Card title="Guest Wi-Fi codes" sub={enabled ? `${active.length} active` : 'Needs remote control'}
      right={enabled && !making ? <button type="button" className="sy-b pri sm" onClick={() => setMaking(true)}>Make codes</button> : undefined}>
      {!enabled ? <div className="sy-empty">Guest codes are made on the console through UniFi’s cloud — available once remote control is on for this property.</div> : <>
        {making && (
          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(2,minmax(0,1fr))', marginBottom: 12 }}>
            <label><span className="sy-lbl">How many codes</span><input className="sy-in" type="number" min={1} max={100} value={form.count} onChange={e => setForm({ ...form, count: Math.max(1, Math.min(100, Number(e.target.value) || 1)) })} /></label>
            <label><span className="sy-lbl">Each code lasts</span><select className="sy-in" value={form.minutes} onChange={e => setForm({ ...form, minutes: Number(e.target.value) })}>{DURATIONS.map(([m, l]) => <option key={m} value={m}>{l}</option>)}</select></label>
            <label><span className="sy-lbl">Devices per code</span><input className="sy-in" type="number" min={1} value={form.guests} onChange={e => setForm({ ...form, guests: e.target.value })} placeholder="No limit" /></label>
            <label><span className="sy-lbl">Note (optional)</span><input className="sy-in" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Pool party" /></label>
            <div className="sy-acts" style={{ gridColumn: '1 / -1', justifyContent: 'flex-end' }}><button type="button" className="sy-b line sm" onClick={() => setMaking(false)} disabled={busy}>Cancel</button><button type="button" className="sy-b pri sm" onClick={create} disabled={busy}>{busy ? 'Making…' : `Make ${form.count} code${form.count === 1 ? '' : 's'}`}</button></div>
          </div>
        )}
        {fresh.length > 0 && (
          <div className="nw-new" style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: BLUE, fontWeight: 600, marginBottom: 6 }}>New codes</div>
            {fresh.map(v => <div key={v.id} className="nw-code">{fmtCode(v.code)}</div>)}
            <div className="sy-acts" style={{ marginTop: 8 }}>
              <button type="button" className="sy-b line sm" onClick={() => { void navigator.clipboard?.writeText(fresh.map(v => fmtCode(v.code)).join('\n')); notify('Copied.') }}>Copy</button>
              <button type="button" className="sy-b line sm" onClick={() => print(fresh)}>Print</button>
              <button type="button" className="sy-b line sm" onClick={() => setFresh([])}>Done</button>
            </div>
          </div>
        )}
        {err && <Note tone="orange">{err}</Note>}
        {list == null ? <div className="sy-empty">Loading codes…</div> : !active.length ? <div className="sy-empty">No active guest codes.</div> : (
          <div className="sy-feed" style={{ maxHeight: 320 }}>{active.map(v => (
            <div key={v.id} className="sy-row">
              <div className="main"><div className="nw-code">{fmtCode(v.code)}</div><div className="m">{[v.name, fmtMins(v.minutes), v.guestLimit ? `${v.guestsUsed}/${v.guestLimit} used` : `${v.guestsUsed} used`, v.expiresAt ? `expires ${new Date(v.expiresAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : 'not used yet'].filter(Boolean).join(' · ')}</div></div>
              {del === v.id ? <div className="sy-acts"><button type="button" className="sy-b line sm" onClick={() => setDel(null)} disabled={busy}>Keep</button><button type="button" className="sy-b pri sm" style={{ background: RED }} onClick={() => remove(v.id)} disabled={busy}>Delete</button></div>
                : <div className="sy-acts"><button type="button" className="sy-b line sm" onClick={() => print([v])} aria-label={`Print code ${fmtCode(v.code)}`}>Print</button><button type="button" className="sy-b line sm" onClick={() => setDel(v.id)} aria-label={`Delete code ${fmtCode(v.code)}`}>Delete</button></div>}
            </div>
          ))}</div>
        )}
      </>}
    </Card>
  )
}
