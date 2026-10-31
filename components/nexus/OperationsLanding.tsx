'use client'

/**
 * OperationsLanding — the Operations tab's landing page.
 * Light look, same as Sales / My Day / Tasks: white header text on the navy part
 * of the fade, white cards, one blue accent (#0071E3), Apple system fonts.
 *
 * Data is 100% real from existing tables via /api/nexus/operations/dashboard
 * + /api/dispatch/analytics for crew utilization. Device counts are real;
 * "online" shows only once the UniFi / Eagle Eye rollup writes live status.
 * Cards drill into the Operations Hub tabs.
 */
import { useEffect, useState } from 'react'
import { OpsComingSoon } from '@/components/nexus/OpsComingSoon'

// ---- Light tokens (identical to SalesSurface's `L` / `CARD`) ----
const L = { ink: '#1D1D1F', ink2: '#3A3A3C', ink3: '#6E6E73', line: 'rgba(0,0,0,0.08)', blue: '#0071E3', green: '#248A3D', amber: '#B25000', red: '#D70015', track: '#EEF0F4', font: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, system-ui, sans-serif' }
const DOT = { green: '#34C759', amber: '#FF9F0A', red: '#FF3B30' }
const CARD: React.CSSProperties = { background: '#FFFFFF', borderRadius: 14, boxShadow: '0 1px 2px rgba(10,20,40,0.06), 0 8px 24px rgba(10,20,40,0.08)' }
const DARK_BTN: React.CSSProperties = { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)', color: '#fff', fontWeight: 500 }
const HDR_BTN = 'flex h-[38px] min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] px-2 text-[13px] sm:flex-none sm:gap-2 sm:px-4 sm:text-[14px] disabled:opacity-60'

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

const priorityDot = (p: string) => /urgent|critical/i.test(p) ? DOT.red : /high/i.test(p) ? DOT.amber : L.blue
const ageLabel = (h: number | null) => h == null ? '' : h < 24 ? `${h}h` : `${Math.round(h / 24)}d`

// Card with a header row (title left, link or count right) — the Sales card pattern.
function Card({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="min-w-0 overflow-hidden" style={CARD}>
      <div className="flex items-center justify-between gap-2 px-[18px] py-3.5" style={{ borderBottom: `1px solid ${L.line}` }}>
        <span className="text-[15px] font-semibold">{title}</span>
        {right}
      </div>
      {children}
    </div>
  )
}
function LinkBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="text-[13px] font-medium" style={{ color: L.blue }}>{label}</button>
}
function Empty({ text }: { text: string }) {
  return <div className="px-[18px] py-6 text-center text-[13px]" style={{ color: L.ink3 }}>{text}</div>
}
// A clickable list row (work order / schedule / request).
function Row({ first, onClick, left, right }: { first: boolean; onClick?: () => void; left: React.ReactNode; right: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 px-[18px] py-2.5 text-left hover:bg-[#F7F8FA]" style={first ? undefined : { borderTop: `1px solid ${L.line}` }}>
      <span className="min-w-0 flex-1 truncate text-[14px]">{left}</span>
      <span className="flex shrink-0 items-center gap-2 text-[12px]" style={{ color: L.ink3 }}>{right}</span>
    </button>
  )
}

// Semicircle gauge, light track.
function Gauge({ pct, color, label }: { pct: number; color: string; label: string }) {
  const p = Math.max(0, Math.min(1, pct))
  const end = { x: 60 - 48 * Math.cos(Math.PI * p), y: 60 - 48 * Math.sin(Math.PI * p) }
  return (
    <svg width="84" height="46" viewBox="0 0 120 66" className="mx-auto" aria-hidden>
      <path d="M12 60 A48 48 0 0 1 108 60" fill="none" stroke={L.track} strokeWidth="10" strokeLinecap="round" />
      {p > 0.001 && <path d={`M12 60 A48 48 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" />}
      <text x="60" y="54" textAnchor="middle" fontSize="26" fill={L.ink} fontWeight="600">{label}</text>
    </svg>
  )
}

function Bar({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center justify-between"><span className="text-[13px]" style={{ color: L.ink2 }}>{label}</span><span className="text-[13px] font-semibold">{value}</span></div>
      <div className="h-2 overflow-hidden rounded-full" style={{ background: L.track }}><i className="block h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} /></div>
    </div>
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
  const onDash = seg(health.online), atDash = seg(health.attention), offDash = seg(health.offline)
  const dash = (v: number | string) => (loading ? '—' : v)

  const openWo = d?.openWorkOrders.open ?? 0
  const today = d?.schedule.todayCount ?? (d?.schedule.items.length ?? 0)
  const reqs = d?.requests.open ?? 0

  return (
    <section className="w-full px-1 sm:px-2">
      <div className="mx-auto w-full" style={{ maxWidth: 1360, color: L.ink, fontFamily: L.font, letterSpacing: '-0.01em' }}>

        {/* Header — sits on the navy part of the fade */}
        <div className="mb-5 mt-2 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="m-0 text-[24px] font-semibold leading-tight sm:text-[30px]" style={{ color: '#fff', letterSpacing: '-0.025em' }}>Operations</h1>
            <div className="mt-1 text-[14px]" style={{ color: 'rgba(255,255,255,0.66)' }}>
              {loading ? 'Loading…' : <>
                <b style={{ color: '#fff', fontWeight: 600 }}>{openWo}</b> open work order{openWo === 1 ? '' : 's'} · <b style={{ color: '#fff', fontWeight: 600 }}>{today}</b> scheduled today
                {reqs > 0 && <> · <b style={{ color: '#fff', fontWeight: 600 }}>{reqs}</b> new request{reqs === 1 ? '' : 's'}</>}
              </>}
            </div>
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <button type="button" onClick={() => onOpenTab('Work Orders')} className={HDR_BTN} style={{ background: L.blue, color: '#fff', fontWeight: 600 }}>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><path d="M12 5v14M5 12h14" /></svg> <span className="sm:hidden">Work order</span><span className="hidden sm:inline">New work order</span>
            </button>
            <button type="button" onClick={() => onOpenTab('Dashboard')} className={HDR_BTN} style={DARK_BTN}>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth={1.9} aria-hidden><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg> <span className="sm:hidden">Hub</span><span className="hidden sm:inline">Operations Hub</span>
            </button>
            <button type="button" onClick={refreshFleet} disabled={refreshing} className={HDR_BTN} style={DARK_BTN}>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth={1.9} aria-hidden><path d="M21 12a9 9 0 1 1-2.64-6.36M21 4v5h-5" /></svg> {refreshing ? 'Syncing…' : 'Sync systems'}
            </button>
          </div>
        </div>

        {/* Four numbers — the systems */}
        <div className="mb-4 grid grid-cols-2 gap-2.5 sm:gap-3.5 lg:grid-cols-4">
          {[
            { l: 'Active sites', v: dash(f?.sitesActive ?? 0), s: `${(f?.units ?? 0).toLocaleString()} units` },
            { l: 'Gates', v: dash(f?.gates ?? 0), s: `Across ${f?.sitesTotal ?? 0} sites` },
            { l: 'Cameras', v: dash(f?.cameras ?? 0), s: live ? `${f?.camerasOnline ?? 0} online now` : 'Live status after first sync' },
            { l: 'Doors & panels', v: dash(f?.doors ?? 0), s: `${f?.panelsLive ?? 0} panels live` },
          ].map(m => (
            <button key={m.l} type="button" onClick={() => onOpenTab('Locations')} title="Open locations" className="min-w-0 p-3 text-left transition-transform hover:-translate-y-0.5 sm:px-[18px] sm:py-4" style={CARD}>
              <div className="text-[12px] font-medium" style={{ color: L.ink3 }}>{m.l}</div>
              <div className="mt-1 text-[22px] font-semibold leading-tight sm:text-[26px]" style={{ letterSpacing: '-0.02em' }}>{m.v}</div>
              <div className="mt-0.5 truncate text-[12px]" style={{ color: L.ink3 }}>{m.s}</div>
            </button>
          ))}
        </div>

        {/* Main grid — work on the left, upkeep on the right */}
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">

          {/* LEFT */}
          <div className="flex min-w-0 flex-col gap-4">
            <Card title="Open work orders" right={<LinkBtn label="View all" onClick={() => onOpenTab('Work Orders')} />}>
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {(d?.openWorkOrders.items ?? []).length === 0
                  ? <Empty text={loading ? 'Loading…' : 'No open work orders.'} />
                  : (d?.openWorkOrders.items ?? []).map((w, i) => (
                    <Row key={w.id} first={i === 0} onClick={() => onOpenJob?.(w.id)}
                      left={<>{w.wo && <span style={{ color: L.ink3 }}>#{w.wo} · </span>}<span className="font-medium">{w.title}</span>{w.site && <span style={{ color: L.ink3 }}> · {w.site}</span>}</>}
                      right={<><span className="capitalize">{String(w.status).replace(/_/g, ' ')}</span><span className="h-2 w-2 rounded-full" style={{ background: priorityDot(w.priority) }} aria-label={`${w.priority} priority`} /></>} />
                  ))}
              </div>
            </Card>

            <Card title="Today's schedule" right={<LinkBtn label="Calendar" onClick={() => onOpenTab('Calendar')} />}>
              {(d?.schedule.items ?? []).length === 0
                ? <Empty text={loading ? 'Loading…' : 'Nothing scheduled today.'} />
                : <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                  {(d?.schedule.items ?? []).map((j, i) => (
                    <Row key={j.id} first={i === 0} onClick={() => onOpenJob?.(j.id)}
                      left={<><span className="font-medium">{j.title}</span>{j.site && <span style={{ color: L.ink3 }}> · {j.site}</span>}</>}
                      right={<><span>{j.tech ?? String(j.status).replace(/_/g, ' ')}</span><span className="h-2 w-2 rounded-full" style={{ background: priorityDot(j.priority) }} /></>} />
                  ))}
                </div>}
            </Card>

            <Card title="Service performance" right={<span className="text-[13px]" style={{ color: L.ink3 }}>Rolling</span>}>
              <div className="grid grid-cols-3 gap-2 px-[18px] py-4 text-center">
                <div>
                  <Gauge pct={d?.response.avgResponseHours != null ? Math.min(1, d.response.avgResponseHours / 24) : 0} color={L.blue} label={d?.response.avgResponseHours != null ? `${d.response.avgResponseHours}h` : '—'} />
                  <div className="mt-1 text-[13px] font-medium">Avg response</div>
                  <div className="text-[12px]" style={{ color: L.ink3 }}>to on-site</div>
                </div>
                <div>
                  <Gauge pct={d?.response.avgResolveDays != null ? Math.min(1, d.response.avgResolveDays / 7) : 0} color={DOT.green} label={d?.response.avgResolveDays != null ? `${d.response.avgResolveDays}d` : '—'} />
                  <div className="mt-1 text-[13px] font-medium">Avg resolve</div>
                  <div className="text-[12px]" style={{ color: L.ink3 }}>to close</div>
                </div>
                <div className="flex flex-col items-center justify-end">
                  <div className="text-[26px] font-semibold leading-none" style={{ letterSpacing: '-0.02em' }}>{dash(d?.serviceLoad.ratio ?? 0)}</div>
                  <div className="mt-2 text-[13px] font-medium">Visits per device</div>
                  <div className="text-[12px]" style={{ color: L.ink3 }}>{d?.serviceLoad.visits90d ?? 0} visits · 90 days</div>
                </div>
              </div>
            </Card>
          </div>

          {/* RIGHT */}
          <div className="flex min-w-0 flex-col gap-4">
            <Card title="System health" right={<span className="text-[13px]" style={{ color: L.ink3 }}>{f?.devicesTotal ?? 0} devices</span>}>
              <div className="flex items-center gap-4 px-[18px] py-4">
                <svg width="92" height="92" viewBox="0 0 42 42" aria-hidden>
                  <circle cx="21" cy="21" r="15.9" fill="none" stroke={L.track} strokeWidth="5" />
                  <circle cx="21" cy="21" r="15.9" fill="none" stroke={DOT.green} strokeWidth="5" strokeDasharray={`${onDash} ${100 - onDash}`} strokeDashoffset="25" />
                  <circle cx="21" cy="21" r="15.9" fill="none" stroke={DOT.amber} strokeWidth="5" strokeDasharray={`${atDash} ${100 - atDash}`} strokeDashoffset={`${25 - onDash}`} />
                  <circle cx="21" cy="21" r="15.9" fill="none" stroke={DOT.red} strokeWidth="5" strokeDasharray={`${offDash} ${100 - offDash}`} strokeDashoffset={`${25 - onDash - atDash}`} />
                  <text x="21" y="21" textAnchor="middle" fontSize="8" fill={L.ink} fontWeight="600">{healthPct}%</text>
                  <text x="21" y="27" textAnchor="middle" fontSize="3.4" fill={L.ink3}>healthy</text>
                </svg>
                <div className="flex flex-col gap-1 text-[13px]" style={{ color: L.ink2 }}>
                  <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full" style={{ background: DOT.green }} />Online <b className="font-semibold" style={{ color: L.ink }}>{health.online}</b></span>
                  <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full" style={{ background: DOT.amber }} />Needs attention <b className="font-semibold" style={{ color: L.ink }}>{health.attention}</b></span>
                  <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full" style={{ background: DOT.red }} />Offline <b className="font-semibold" style={{ color: L.ink }}>{health.offline}</b></span>
                </div>
              </div>
              <div className="px-[18px] pb-3.5 text-[12px]" style={{ color: L.ink3 }}>{live ? 'Cameras and network report live. Gates show last-service status.' : 'Status from last service. Live monitoring turns on after the first sync.'}</div>
            </Card>

            <Card title="Open requests" right={<span className="rounded-md px-2 py-0.5 text-[12px] font-medium" style={reqs > 0 ? { background: '#FFECEC', color: L.red } : { background: '#F5F5F7', color: L.ink3 }}>{reqs} open</span>}>
              {(d?.requests.items ?? []).length === 0
                ? <Empty text={loading ? 'Loading…' : 'No open requests.'} />
                : <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                  {(d?.requests.items ?? []).map((r, i) => (
                    <Row key={r.id} first={i === 0} onClick={() => onOpenTab('Requests')}
                      left={<><span className="font-medium">{r.title}</span>{r.site && <span style={{ color: L.ink3 }}> · {r.site}</span>}</>}
                      right={<><span>{ageLabel(r.ageHours)}</span><span className="h-2 w-2 rounded-full" style={{ background: priorityDot(r.priority) }} /></>} />
                  ))}
                </div>}
            </Card>

            <Card title="Preventive maintenance" right={<LinkBtn label="Open" onClick={() => onOpenTab('PM')} />}>
              <div className="grid grid-cols-3 gap-2 px-[18px] py-4">
                {[
                  { n: d?.pm.overdue ?? 0, l: 'Overdue', c: L.red, bg: '#FFECEC' },
                  { n: d?.pm.dueSoon ?? 0, l: 'Due in 14 days', c: L.amber, bg: '#FFF4E5' },
                  { n: d?.pm.onTrack ?? 0, l: 'On track', c: L.green, bg: '#E8F6EC' },
                ].map(x => (
                  <button key={x.l} type="button" onClick={() => onOpenTab('PM')} className="rounded-xl px-2 py-3 text-center" style={{ background: x.bg }}>
                    <div className="text-[22px] font-semibold leading-none" style={{ color: x.c }}>{dash(x.n)}</div>
                    <div className="mt-1.5 text-[12px]" style={{ color: L.ink2 }}>{x.l}</div>
                  </button>
                ))}
              </div>
            </Card>

            <Card title="Crew performance · 30 days" right={<LinkBtn label="Open" onClick={() => onOpenTab('Analytics')} />}>
              <div className="px-[18px] pb-2 pt-4">
                <Bar label="First-time fix" value={`${t.ftfPct ?? 0}%`} pct={t.ftfPct ?? 0} color={DOT.green} />
                <Bar label="Utilization" value={`${t.avgUtilizationPct ?? 0}%`} pct={t.avgUtilizationPct ?? 0} color={L.blue} />
                <div className="flex items-center justify-between pb-2"><span className="text-[13px]" style={{ color: L.ink2 }}>Callbacks / re-work</span><span className="text-[13px] font-semibold" style={{ color: (t.callbacks ?? 0) > 0 ? L.amber : L.ink }}>{t.callbacks ?? 0}</span></div>
              </div>
            </Card>
          </div>
        </div>

        {/* Roadmap — features not built yet, shown honestly as Coming soon */}
        <OpsComingSoon />
      </div>
    </section>
  )
}
