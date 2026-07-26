'use client'

/**
 * OperationsLanding — the Operations tab's command-center landing.
 * Same steel console as My Day + Sales (FRAME_STYLE / TILE_STYLE / dashboard width).
 *
 * Phase 1: 100% real data from existing tables via /api/nexus/operations/dashboard
 * + the existing /api/dispatch/analytics for crew utilization. Device counts are
 * real; "online" is NOT shown yet (Phase 2 lights it up once the UniFi/Eagle-Eye
 * rollup writes live status). Tiles drill into the Operations Hub tabs.
 */
import { useEffect, useState } from 'react'

// ---- Console tokens (identical to Sales / My Day) ----
const FRAME_STYLE = { background: 'repeating-linear-gradient(90deg,rgba(255,255,255,0.05) 0 1px,transparent 1px 4px), linear-gradient(180deg,#5a6c84,#45556a)', border: '1px solid rgba(10,16,24,0.4)', boxShadow: '0 26px 54px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -2px 2px rgba(0,0,0,0.4)' } as const
const TILE_BG = 'repeating-linear-gradient(90deg,rgba(255,255,255,0.04) 0 1px,transparent 1px 4px), linear-gradient(180deg,#2b3c52,#1e2a3a)'
const TILE_STYLE = { background: TILE_BG, border: '1px solid rgba(140,170,200,0.22)', boxShadow: '0 14px 30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.14)' } as const
const WELL = 'linear-gradient(180deg,#22303f,#1a2532)'

type FleetHealth = { online: number; attention: number; offline: number }
type OpsData = {
  fleet: { gates: number; cameras: number; readers: number; intercoms: number; network: number; devicesTotal: number; doors: number; panelsLive: number; panelsTotal: number; sitesActive: number; sitesTotal: number; units: number; health: FleetHealth; onlineTrackingLive: boolean; camerasOnline?: number; networkOnline?: number }
  response: { avgResponseHours: number | null; avgResolveDays: number | null; sampleSize: number }
  requests: { open: number; items: Array<{ id: string; title: string; site: string | null; priority: string; ageHours: number | null }> }
  schedule: { todayCount: number; items: Array<{ id: string; title: string; site: string | null; tech: string | null; priority: string; status: string }> }
  openWorkOrders: { open: number; items: Array<{ id: string; wo: string | null; title: string; site: string | null; tech: string | null; priority: string; status: string; scheduled: string | null }> }
  pm: { overdue: number; dueSoon: number; onTrack: number }
  serviceLoad: { visits90d: number; devices: number; ratio: number }
}
type Analytics = { totals?: { ftfPct?: number; avgUtilizationPct?: number; callbacks?: number; completed?: number } }

const priorityColor = (p: string) => /urgent|critical/i.test(p) ? '#f2637e' : /high/i.test(p) ? '#fbbf24' : '#9FD8EC'
const ageLabel = (h: number | null) => h == null ? '' : h < 24 ? `${h}h` : `${Math.round(h / 24)}d`

function Tile({ children, onClick, className = '' }: { children: React.ReactNode; onClick?: () => void; className?: string }) {
  const base = `rounded-2xl p-3.5 ${className}`
  if (onClick) return <button type="button" onClick={onClick} className={`${base} text-left transition-transform hover:-translate-y-0.5`} style={TILE_STYLE}>{children}</button>
  return <div className={base} style={TILE_STYLE}>{children}</div>
}
function CardHead({ title, right, onOpen }: { title: string; right?: React.ReactNode; onOpen?: () => void }) {
  return (
    <div className="mb-2.5 flex items-center justify-between">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: '#9FD8EC' }}>{title}</div>
      {right ?? (onOpen && <span className="text-[11px] font-semibold" style={{ color: '#8FD3EC' }}>Open →</span>)}
    </div>
  )
}
function Kpi({ glyph, value, label, sub, onClick }: { glyph: string; value: string | number; label: string; sub?: string; onClick?: () => void }) {
  return (
    <Tile onClick={onClick}>
      <div className="text-[15px]" aria-hidden style={{ color: '#9FD8EC' }}>{glyph}</div>
      <div className="mt-0.5 text-[24px] font-extrabold leading-none" style={{ color: '#eaf2fb' }}>{value}</div>
      <div className="mt-0.5 text-[10px]" style={{ color: '#98abbd' }}>{label}</div>
      {sub && <div className="mt-1 text-[9px]" style={{ color: '#7f96ab' }}>{sub}</div>}
    </Tile>
  )
}
function Dial({ label, value, unit, pct, color, note }: { label: string; value: string; unit?: string; pct: number; color: string; note: string }) {
  // 180° gauge: track sweeps LEFT (12,60) → over the top → RIGHT (108,60).
  // The filled portion always sweeps the SHORT way (clockwise, sweep-flag 1),
  // and a semicircle is never >180°, so large-arc-flag is ALWAYS 0.
  const p = Math.max(0, Math.min(1, pct))
  const end = { x: 60 - 48 * Math.cos(Math.PI * p), y: 60 - 48 * Math.sin(Math.PI * p) }
  return (
    <div className="rounded-2xl p-3 text-center" style={TILE_STYLE}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: '#9FD8EC' }}>{label}</div>
      <svg width="112" height="62" viewBox="0 0 120 66" className="mx-auto">
        <path d="M12 60 A48 48 0 0 1 108 60" fill="none" stroke="#12202c" strokeWidth="9" strokeLinecap="round" />
        {p > 0.001 && (
          <path d={`M12 60 A48 48 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" />
        )}
        <text x="60" y="50" textAnchor="middle" fontSize="20" fill="#eaf2fb" fontWeight="800">{value}{unit ?? ''}</text>
      </svg>
      <div className="text-[9px]" style={{ color: '#98abbd' }}>{note}</div>
    </div>
  )
}

// Bare semicircle gauge (no card) — for the compact Service Performance tile.
function Gauge({ pct, color, label }: { pct: number; color: string; label: string }) {
  const p = Math.max(0, Math.min(1, pct))
  const end = { x: 60 - 48 * Math.cos(Math.PI * p), y: 60 - 48 * Math.sin(Math.PI * p) }
  return (
    <svg width="76" height="42" viewBox="0 0 120 66" className="mx-auto">
      <path d="M12 60 A48 48 0 0 1 108 60" fill="none" stroke="#12202c" strokeWidth="10" strokeLinecap="round" />
      {p > 0.001 && <path d={`M12 60 A48 48 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" />}
      <text x="60" y="53" textAnchor="middle" fontSize="27" fill="#eaf2fb" fontWeight="800">{label}</text>
    </svg>
  )
}

export function OperationsLanding({ onOpenTab, onOpenJob }: { onOpenTab: (tab: string) => void; onOpenJob?: (id: string) => void }) {
  const [d, setD] = useState<OpsData | null>(null)
  const [an, setAn] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      const [r1, r2] = await Promise.all([
        fetch('/api/nexus/operations/dashboard').then(r => r.ok ? r.json() : null).catch(() => null),
        fetch('/api/dispatch/analytics?days=30').then(r => r.ok ? r.json() : null).catch(() => null),
      ])
      if (!alive) return
      setD(r1); setAn(r2); setLoading(false)
    })()
    return () => { alive = false }
  }, [])

  const f = d?.fleet
  const live = !!f?.onlineTrackingLive
  const [refreshing, setRefreshing] = useState(false)
  async function refreshFleet() {
    setRefreshing(true)
    try { await fetch('/api/nexus/operations/fleet-refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }) } catch { /* ignore */ }
    setTimeout(() => setRefreshing(false), 2500)
  }
  const health = f?.health ?? { online: 0, attention: 0, offline: 0 }
  const hTotal = health.online + health.attention + health.offline || 1
  const seg = (v: number) => (v / hTotal) * 100
  const healthPct = Math.round((health.online / hTotal) * 100)
  const t = an?.totals ?? {}

  // donut dash offsets
  const onDash = seg(health.online), atDash = seg(health.attention), offDash = seg(health.offline)

  return (
    <section className="mt-6 w-full px-3 sm:px-4">
      <div className="mx-auto w-full max-w-5xl xl:max-w-none rounded-[2rem] p-5 sm:p-6" style={FRAME_STYLE}>

        {/* Header */}
        <div className="relative mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: '#2f4a63' }}>Operations</div>
            <h2 className="text-xl font-semibold leading-tight" style={{ color: '#152535' }}>Command Center</h2>
          </div>
          {/* Centered Operations Hub entry — dark grey steel, slightly larger */}
          <button type="button" onClick={() => onOpenTab('Dashboard')}
            className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 rounded-xl px-6 py-2.5 text-[13.5px] font-semibold transition-transform hover:-translate-y-[calc(50%+2px)] lg:inline-flex lg:items-center lg:gap-2"
            style={{ background: 'linear-gradient(180deg,#3a4552,#2a333d)', border: '1px solid rgba(150,168,190,0.28)', color: '#e4ebf2', boxShadow: '0 8px 20px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)' }}>
            ⊞ Operations Hub →
          </button>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold" style={{ background: 'rgba(20,32,44,0.5)', border: '1px solid rgba(95,184,224,0.4)', color: '#9FD8EC' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: loading ? '#fbbf24' : '#7ee0a8', boxShadow: `0 0 8px ${loading ? '#fbbf24' : '#7ee0a8'}` }} />{loading ? 'Loading…' : 'Live'}
            </span>
            <button type="button" onClick={() => onOpenTab('Dashboard')} className="rounded-xl px-3 py-2 text-[12px] font-semibold lg:hidden" style={{ background: 'linear-gradient(180deg,#3a4552,#2a333d)', border: '1px solid rgba(150,168,190,0.28)', color: '#e4ebf2' }}>⊞ Hub</button>
            <button type="button" onClick={refreshFleet} disabled={refreshing} className="rounded-xl px-3 py-2 text-[12px] font-semibold disabled:opacity-50" style={{ background: '#22303f', border: '1px solid rgba(95,184,224,0.28)', color: '#9FD8EC' }}>{refreshing ? 'Syncing…' : '↻ Sync fleet'}</button>
            <button type="button" onClick={() => onOpenTab('Work Orders')} className="rounded-xl px-3 py-2 text-[12px] font-semibold" style={{ background: '#26374a', border: '1px solid rgba(140,170,200,0.25)', color: '#cfe0f0' }}>＋ New Work Order</button>
          </div>
        </div>

        {/* Readable source legend — light text on a dark well */}
        <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 rounded-xl px-3 py-2 text-[10px]" style={{ background: WELL, border: '1px solid rgba(140,170,200,0.18)', color: '#c3d3e2' }}>
          <span><span style={{ color: '#7ee0a8' }}>●</span> <b style={{ color: '#eaf2fb' }}>REAL</b> — computed from your records</span>
          <span><span style={{ color: '#5FB8E0' }}>●</span> <b style={{ color: '#eaf2fb' }}>COUNTS</b> — true device totals</span>
          <span><span style={{ color: '#fbbf24' }}>●</span> <b style={{ color: '#eaf2fb' }}>LIVE ONLINE</b> — arrives in Phase 2 (UniFi / Eagle Eye)</span>
        </div>

        {/* 3-column cockpit */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1.25fr_1fr]">

          {/* ===== COL 1 · FLEET ===== */}
          <div className="flex flex-col gap-3">
            <Tile>
              <CardHead title="Fleet Health" right={<span className="text-[10px]" style={{ color: '#98abbd' }}>{f?.devicesTotal ?? 0} devices</span>} />
              <div className="flex items-center gap-3">
                <svg width="92" height="92" viewBox="0 0 42 42">
                  <circle cx="21" cy="21" r="15.9" fill="none" stroke="#12202c" strokeWidth="5" />
                  <circle cx="21" cy="21" r="15.9" fill="none" stroke="#7ee0a8" strokeWidth="5" strokeDasharray={`${onDash} ${100 - onDash}`} strokeDashoffset="25" />
                  <circle cx="21" cy="21" r="15.9" fill="none" stroke="#fbbf24" strokeWidth="5" strokeDasharray={`${atDash} ${100 - atDash}`} strokeDashoffset={`${25 - onDash}`} />
                  <circle cx="21" cy="21" r="15.9" fill="none" stroke="#f2637e" strokeWidth="5" strokeDasharray={`${offDash} ${100 - offDash}`} strokeDashoffset={`${25 - onDash - atDash}`} />
                  <text x="21" y="20" textAnchor="middle" fontSize="8" fill="#eaf2fb" fontWeight="700">{healthPct}%</text>
                  <text x="21" y="26.5" textAnchor="middle" fontSize="3.2" fill="#98abbd">healthy</text>
                </svg>
                <div className="text-[11px] leading-[1.7]" style={{ color: '#c3d3e2' }}>
                  <div><span style={{ color: '#7ee0a8' }}>●</span> Online · {health.online}</div>
                  <div><span style={{ color: '#fbbf24' }}>●</span> Attention · {health.attention}</div>
                  <div><span style={{ color: '#f2637e' }}>●</span> Offline · {health.offline}</div>
                </div>
              </div>
              <div className="mt-2 border-t pt-1.5 text-[9px]" style={{ borderColor: 'rgba(140,170,200,0.14)', color: '#7f96ab' }}>{live ? 'Cameras & network report live · gates show last-service status' : 'Status from last service · live monitoring turns on after first fleet sync'}</div>
            </Tile>

            <div className="grid grid-cols-2 gap-3">
              <Kpi glyph="⛩" value={loading ? '–' : (f?.gates ?? 0)} label="Gates" sub={`across ${f?.sitesTotal ?? 0} sites`} onClick={() => onOpenTab('Locations')} />
              <Kpi glyph="◉" value={loading ? '–' : (f?.cameras ?? 0)} label="Cameras" sub={live ? `${f?.camerasOnline ?? 0} online · live` : 'online tracking soon'} onClick={() => onOpenTab('Locations')} />
              <Kpi glyph="▤" value={loading ? '–' : (f?.doors ?? 0)} label="Doors / Panels" sub={`${f?.panelsLive ?? 0} panels live`} onClick={() => onOpenTab('Locations')} />
              <Kpi glyph="⌂" value={loading ? '–' : (f?.sitesActive ?? 0)} label="Active Sites" sub={`${(f?.units ?? 0).toLocaleString()} units`} onClick={() => onOpenTab('Locations')} />
            </div>
          </div>

          {/* ===== COL 2 · SERVICE PERFORMANCE ===== */}
          <div className="flex flex-col gap-3">

            {/* Open Work Orders — the full open queue */}
            <Tile>
              <CardHead title="Open Work Orders" right={
                <div className="flex items-center gap-2">
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: 'rgba(95,184,224,0.14)', border: '1px solid rgba(95,184,224,0.35)', color: '#9FD8EC' }}>{d?.openWorkOrders.open ?? 0} open</span>
                  <button type="button" onClick={() => onOpenTab('Work Orders')} className="text-[11px] font-semibold" style={{ color: '#8FD3EC' }}>View all →</button>
                </div>
              } />
              <div className="flex flex-col gap-1.5" style={{ maxHeight: 152, overflowY: 'auto' }}>
                {(d?.openWorkOrders.items ?? []).length === 0 && <div className="py-4 text-center text-[11px]" style={{ color: '#7f96ab' }}>{loading ? 'Loading…' : 'No open work orders.'}</div>}
                {(d?.openWorkOrders.items ?? []).map(w => (
                  <button key={w.id} type="button" onClick={() => onOpenJob?.(w.id)} className="flex items-center justify-between rounded-xl px-3 py-2 text-left transition-colors hover:brightness-110" style={{ background: WELL, border: '1px solid rgba(140,170,200,0.16)' }}>
                    <span className="min-w-0 flex-1 truncate text-[12px]" style={{ color: '#e7eff7' }}>{w.wo ? `#${w.wo} · ` : ''}{w.title}{w.site ? ` · ${w.site}` : ''}</span>
                    <span className="ml-2 flex shrink-0 items-center gap-2">
                      <span className="whitespace-nowrap text-[10px] capitalize" style={{ color: '#98abbd' }}>{String(w.status).replace(/_/g, ' ')}</span>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: priorityColor(w.priority) }} />
                    </span>
                  </button>
                ))}
              </div>
            </Tile>

            {/* Service performance — response, resolve, load in one compact tile */}
            <Tile>
              <CardHead title="Service Performance" right={<span className="text-[10px]" style={{ color: '#98abbd' }}>REAL · rolling</span>} />
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl px-2 pb-2.5 pt-1.5 text-center" style={{ background: WELL, border: '1px solid rgba(140,170,200,0.16)' }}>
                  <Gauge pct={d?.response.avgResponseHours != null ? Math.min(1, d.response.avgResponseHours / 24) : 0} color="#5FB8E0" label={d?.response.avgResponseHours != null ? `${d.response.avgResponseHours}h` : '—'} />
                  <div className="mt-0.5 text-[10px] font-semibold" style={{ color: '#9FD8EC' }}>Avg Response</div>
                  <div className="text-[8px]" style={{ color: '#7f96ab' }}>to on-site</div>
                </div>
                <div className="rounded-xl px-2 pb-2.5 pt-1.5 text-center" style={{ background: WELL, border: '1px solid rgba(140,170,200,0.16)' }}>
                  <Gauge pct={d?.response.avgResolveDays != null ? Math.min(1, d.response.avgResolveDays / 7) : 0} color="#7ee0a8" label={d?.response.avgResolveDays != null ? `${d.response.avgResolveDays}d` : '—'} />
                  <div className="mt-0.5 text-[10px] font-semibold" style={{ color: '#9FD8EC' }}>Avg Resolve</div>
                  <div className="text-[8px]" style={{ color: '#7f96ab' }}>to close</div>
                </div>
                <div className="flex flex-col items-center justify-center rounded-xl px-2 py-2 text-center" style={{ background: WELL, border: '1px solid rgba(140,170,200,0.16)' }}>
                  <div className="text-[24px] font-extrabold leading-none" style={{ color: '#eaf2fb' }}>{loading ? '–' : (d?.serviceLoad.ratio ?? 0)}</div>
                  <div className="mt-1 text-[10px] font-semibold" style={{ color: '#9FD8EC' }}>Load / device</div>
                  <div className="text-[8px]" style={{ color: '#7f96ab' }}>{d?.serviceLoad.visits90d ?? 0} visits · 90d</div>
                </div>
              </div>
            </Tile>

            {/* Today's schedule — slim (thin when empty) */}
            <Tile>
              <CardHead title="Today's Schedule" right={<button type="button" onClick={() => onOpenTab('Calendar')} className="text-[10px] font-semibold" style={{ color: '#8FD3EC' }}>Calendar →</button>} />
              {(d?.schedule.items ?? []).length === 0 ? (
                <div className="py-1.5 text-center text-[11px]" style={{ color: '#7f96ab' }}>{loading ? 'Loading…' : 'Nothing scheduled today.'}</div>
              ) : (
                <div className="flex flex-col gap-1.5" style={{ maxHeight: 120, overflowY: 'auto' }}>
                  {(d?.schedule.items ?? []).map(j => (
                    <button key={j.id} type="button" onClick={() => onOpenJob?.(j.id)} className="flex items-center justify-between rounded-xl px-3 py-2 text-left transition-colors hover:brightness-110" style={{ background: WELL, border: '1px solid rgba(140,170,200,0.16)' }}>
                      <span className="truncate text-[12px]" style={{ color: '#e7eff7' }}>{j.title}{j.site ? ` · ${j.site}` : ''}</span>
                      <span className="ml-2 whitespace-nowrap text-[10px]" style={{ color: priorityColor(j.priority) }}>{j.tech ?? j.status}</span>
                    </button>
                  ))}
                </div>
              )}
            </Tile>
          </div>

          {/* ===== COL 3 · WORKLOAD & UPKEEP ===== */}
          <div className="flex flex-col gap-3">
            <Tile>
              <CardHead title="Open Requests" right={<span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: 'rgba(242,99,126,0.16)', border: '1px solid rgba(242,99,126,0.4)', color: '#f7a3b3' }}>{d?.requests.open ?? 0} open</span>} />
              {(d?.requests.items ?? []).length === 0 ? (
                <div className="py-1.5 text-center text-[11px]" style={{ color: '#7f96ab' }}>{loading ? 'Loading…' : 'No open requests.'}</div>
              ) : (
                <div className="flex flex-col gap-1.5" style={{ maxHeight: 124, overflowY: 'auto' }}>
                  {(d?.requests.items ?? []).map(r => (
                    <button key={r.id} type="button" onClick={() => onOpenTab('Requests')} className="flex items-center justify-between rounded-xl px-3 py-2 text-left transition-colors hover:brightness-110" style={{ background: WELL, border: '1px solid rgba(140,170,200,0.16)' }}>
                      <span className="truncate text-[12px]" style={{ color: '#e7eff7' }}>{r.title}{r.site ? ` · ${r.site}` : ''}</span>
                      <span className="ml-2 whitespace-nowrap text-[10px]" style={{ color: priorityColor(r.priority) }}>{ageLabel(r.ageHours)}</span>
                    </button>
                  ))}
                </div>
              )}
            </Tile>

            <Tile onClick={() => onOpenTab('PM')}>
              <CardHead title="Preventive Maintenance" onOpen={() => onOpenTab('PM')} />
              <div className="flex gap-2">
                <div className="flex-1 rounded-xl p-2 text-center" style={{ background: WELL, border: '1px solid rgba(242,99,126,0.3)' }}><div className="text-[22px] font-extrabold" style={{ color: '#f2637e' }}>{d?.pm.overdue ?? 0}</div><div className="text-[9px]" style={{ color: '#98abbd' }}>Overdue</div></div>
                <div className="flex-1 rounded-xl p-2 text-center" style={{ background: WELL, border: '1px solid rgba(251,191,36,0.3)' }}><div className="text-[22px] font-extrabold" style={{ color: '#fbbf24' }}>{d?.pm.dueSoon ?? 0}</div><div className="text-[9px]" style={{ color: '#98abbd' }}>Due 14d</div></div>
                <div className="flex-1 rounded-xl p-2 text-center" style={{ background: WELL, border: '1px solid rgba(140,170,200,0.2)' }}><div className="text-[22px] font-extrabold" style={{ color: '#7ee0a8' }}>{d?.pm.onTrack ?? 0}</div><div className="text-[9px]" style={{ color: '#98abbd' }}>On track</div></div>
              </div>
            </Tile>

            <Tile onClick={() => onOpenTab('Analytics')}>
              <CardHead title="Crew Performance · 30d" onOpen={() => onOpenTab('Analytics')} />
              <Bar label="First-time fix" value={`${t.ftfPct ?? 0}%`} pct={t.ftfPct ?? 0} color="#7ee0a8" />
              <Bar label="Utilization" value={`${t.avgUtilizationPct ?? 0}%`} pct={t.avgUtilizationPct ?? 0} color="#5FB8E0" />
              <div className="flex items-center justify-between pt-0.5"><span className="text-[12px]" style={{ color: '#c3d3e2' }}>Callbacks / re-work</span><span className="text-[13px] font-bold" style={{ color: '#fbbf24' }}>{t.callbacks ?? 0}</span></div>
            </Tile>
          </div>
        </div>
      </div>
    </section>
  )
}

function Bar({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  return (
    <div className="mb-2.5">
      <div className="mb-1 flex items-center justify-between"><span className="text-[12px]" style={{ color: '#c3d3e2' }}>{label}</span><span className="text-[13px] font-bold" style={{ color }}>{value}</span></div>
      <div style={{ height: 6, borderRadius: 4, background: '#12202c' }}><div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', borderRadius: 4, background: color }} /></div>
    </div>
  )
}
