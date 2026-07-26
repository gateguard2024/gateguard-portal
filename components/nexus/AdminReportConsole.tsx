'use client'

/**
 * AdminReportConsole — the Admin landing "command center" report band.
 * Rolls up the admin's whole hierarchy from EXISTING tables via two real,
 * org-scoped endpoints: /api/nexus/admin/rollup (leads/opps/jobs + per-person)
 * and /api/nexus/operations/dashboard (fleet health + service load). Steel
 * console theme, hand-rolled SVG charts (no chart dependency). No placeholders.
 */
import { useEffect, useState } from 'react'

const TILE_BG = 'repeating-linear-gradient(90deg,rgba(255,255,255,0.04) 0 1px,transparent 1px 4px), linear-gradient(180deg,#2b3c52,#1e2a3a)'
const TILE_STYLE = { background: TILE_BG, border: '1px solid rgba(140,170,200,0.22)', boxShadow: '0 14px 30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.14)' } as const
const WELL = 'linear-gradient(180deg,#22303f,#1a2532)'

type Rollup = {
  leads: { total: number; newThisWeek: number; trend: number[] }
  opps: { open: number; openPipeline: number; wonThisMonth: number; wonThisMonthValue: number; funnel: { key: string; label: string; count: number; value: number }[] }
  jobs: { open: number; completedThisWeek: number; byStatus: { status: string; count: number }[] }
  team: { members: number; orgs: number }
  people: { name: string; org: string; leads: number; pipeline: number; jobs: number }[]
  canViewFinancials: boolean
}
type Fleet = { online: number; attention: number; offline: number }
type Ops = {
  fleet: { devicesTotal: number; gates: number; cameras: number; readers: number; intercoms: number; sitesActive: number; sitesTotal: number; health: Fleet }
  response: { avgResponseHours: number | null; avgResolveDays: number | null }
  serviceLoad: { visits90d: number; devices: number; ratio: number }
}

const money = (n: number) => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `$${Math.round(n / 1000)}K` : `$${Math.round(n)}`
const STATUS_COLOR: Record<string, string> = { open: '#5FB8E0', scheduled: '#fbbf24', in_progress: '#9FD8EC', new: '#8FD3EC', on_hold: '#f2637e', assigned: '#7ee0a8' }

export function AdminReportConsole({ onOpenTab }: { onOpenTab?: (tab: string) => void }) {
  const [r, setR] = useState<Rollup | null>(null)
  const [ops, setOps] = useState<Ops | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    Promise.all([
      fetch('/api/nexus/admin/rollup', { cache: 'no-store' }).then(x => x.json()).catch(() => null),
      fetch('/api/nexus/operations/dashboard', { cache: 'no-store' }).then(x => x.json()).catch(() => null),
    ]).then(([rollup, opsData]) => { if (!alive) return; setR(rollup); setOps(opsData); setLoading(false) })
    return () => { alive = false }
  }, [])

  const fin = r?.canViewFinancials ?? false

  return (
    <div className="mb-6">
      {/* Report band header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: '#2f4a63' }}>Command Center · Your Hierarchy</div>
        <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold" style={{ background: 'rgba(20,32,44,0.5)', border: '1px solid rgba(95,184,224,0.4)', color: '#9FD8EC' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: loading ? '#fbbf24' : '#7ee0a8', boxShadow: `0 0 8px ${loading ? '#fbbf24' : '#7ee0a8'}` }} />
          {loading ? 'Loading…' : `${r?.team.members ?? 0} people · ${r?.team.orgs ?? 0} orgs`}
        </span>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiSpark glyph="👥" label="Leads" value={r?.leads.total ?? 0} sub={`+${r?.leads.newThisWeek ?? 0} new this week`} subColor="#7ee0a8" trend={r?.leads.trend ?? []} />
        <Kpi glyph="🎯" label="Opportunities" value={r?.opps.open ?? 0} sub={fin ? `${money(r?.opps.openPipeline ?? 0)} open pipeline` : `${r?.opps.wonThisMonth ?? 0} won this month`} subColor="#9FD8EC" foot={fin ? `${r?.opps.wonThisMonth ?? 0} won · ${money(r?.opps.wonThisMonthValue ?? 0)} this month` : undefined} />
        <Kpi glyph="🔧" label="Jobs" value={r?.jobs.open ?? 0} sub={`${r?.jobs.completedThisWeek ?? 0} completed this week`} subColor="#fbbf24" foot={ops ? `${ops.fleet.sitesActive}/${ops.fleet.sitesTotal} sites active` : undefined} />
        <Kpi glyph="📡" label="Fleet online" value={ops ? `${pct(ops.fleet.health)}%` : '—'} sub={ops ? `${ops.fleet.devicesTotal} devices tracked` : 'Operations feed'} subColor="#9FD8EC" foot={ops && ops.response.avgResponseHours != null ? `${ops.response.avgResponseHours}h avg response` : undefined} />
      </div>

      {/* Charts row */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* Pipeline funnel */}
        <div className="rounded-2xl p-3.5 lg:col-span-2" style={TILE_STYLE}>
          <CardHead title="Pipeline by stage" right={fin ? money(r?.opps.openPipeline ?? 0) : `${r?.opps.open ?? 0} open`} onOpen={() => onOpenTab?.('opps')} />
          <Funnel funnel={r?.opps.funnel ?? []} fin={fin} />
        </div>
        {/* Fleet health donut */}
        <div className="rounded-2xl p-3.5" style={TILE_STYLE}>
          <CardHead title="Fleet health" right={ops ? `${ops.fleet.devicesTotal}` : ''} onOpen={() => onOpenTab?.('recent')} />
          <FleetDonut health={ops?.fleet.health ?? { online: 0, attention: 0, offline: 0 }} />
        </div>
      </div>

      {/* Second charts row */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* Jobs by status */}
        <div className="rounded-2xl p-3.5" style={TILE_STYLE}>
          <CardHead title="Open jobs by status" right={`${r?.jobs.open ?? 0}`} onOpen={() => onOpenTab?.('jobs')} />
          <StatusBars rows={r?.jobs.byStatus ?? []} />
        </div>
        {/* Per-person breakdown */}
        <div className="rounded-2xl p-3.5 lg:col-span-2" style={{ background: WELL, border: '1px solid rgba(140,170,200,0.18)' }}>
          <CardHead title="By team member" right={`${r?.people.length ?? 0} people`} />
          <PeopleTable people={r?.people ?? []} fin={fin} loading={loading} />
        </div>
      </div>
    </div>
  )
}

function pct(h: Fleet) { const t = h.online + h.attention + h.offline; return t ? Math.round((h.online / t) * 100) : 0 }

function CardHead({ title, right, onOpen }: { title: string; right?: React.ReactNode; onOpen?: () => void }) {
  return (
    <div className="mb-2.5 flex items-center justify-between">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: '#9FD8EC' }}>{title}</div>
      {onOpen ? <button onClick={onOpen} className="text-[11px] font-semibold" style={{ color: '#8FD3EC' }}>{right ? <span className="mr-2" style={{ color: '#c3d3e2' }}>{right}</span> : null}Open →</button>
        : right ? <span className="text-[11px] font-semibold" style={{ color: '#c3d3e2' }}>{right}</span> : null}
    </div>
  )
}

function Kpi({ glyph, value, label, sub, subColor, foot }: { glyph: string; value: string | number; label: string; sub: string; subColor: string; foot?: string }) {
  return (
    <div className="rounded-2xl p-3.5" style={TILE_STYLE}>
      <div className="text-[15px]" aria-hidden style={{ color: '#9FD8EC' }}>{glyph}</div>
      <div className="mt-0.5 text-[26px] font-extrabold leading-none" style={{ color: '#eaf2fb' }}>{value}</div>
      <div className="mt-0.5 text-[10px]" style={{ color: '#98abbd' }}>{label}</div>
      <div className="mt-1 text-[11px] font-semibold" style={{ color: subColor }}>{sub}</div>
      {foot && <div className="mt-0.5 text-[9px]" style={{ color: '#7f96ab' }}>{foot}</div>}
    </div>
  )
}

function KpiSpark({ glyph, value, label, sub, subColor, trend }: { glyph: string; value: number; label: string; sub: string; subColor: string; trend: number[] }) {
  // trend[0] = this week … reverse so the sparkline reads left(old)→right(now)
  const series = [...trend].reverse()
  const max = Math.max(1, ...series)
  const w = 108, h = 26, step = series.length > 1 ? w / (series.length - 1) : w
  const pts = series.map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * h).toFixed(1)}`).join(' ')
  return (
    <div className="rounded-2xl p-3.5" style={TILE_STYLE}>
      <div className="text-[15px]" aria-hidden style={{ color: '#9FD8EC' }}>{glyph}</div>
      <div className="mt-0.5 text-[26px] font-extrabold leading-none" style={{ color: '#eaf2fb' }}>{value}</div>
      <div className="mt-0.5 text-[10px]" style={{ color: '#98abbd' }}>{label}</div>
      <div className="mt-1 flex items-end justify-between gap-2">
        <div className="text-[11px] font-semibold" style={{ color: subColor }}>{sub}</div>
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0" aria-hidden>
          <polyline points={pts} fill="none" stroke="#5FB8E0" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  )
}

function Funnel({ funnel, fin }: { funnel: { key: string; label: string; count: number; value: number }[]; fin: boolean }) {
  const max = Math.max(1, ...funnel.map(f => f.count))
  if (funnel.every(f => f.count === 0)) return <Empty label="No open opportunities yet" />
  return (
    <div className="flex flex-col gap-1.5">
      {funnel.map(f => (
        <div key={f.key} className="flex items-center gap-2">
          <div className="w-24 shrink-0 text-[11px]" style={{ color: '#c3d3e2' }}>{f.label}</div>
          <div className="relative h-5 flex-1 overflow-hidden rounded-md" style={{ background: 'rgba(10,16,24,0.5)' }}>
            <div className="h-full rounded-md" style={{ width: `${Math.max(3, (f.count / max) * 100)}%`, background: 'linear-gradient(90deg,#2f7fb8,#5FB8E0)' }} />
          </div>
          <div className="w-8 shrink-0 text-right text-[12px] font-bold" style={{ color: '#eaf2fb' }}>{f.count}</div>
          {fin && <div className="w-12 shrink-0 text-right text-[10px]" style={{ color: '#7f96ab' }}>{money(f.value)}</div>}
        </div>
      ))}
    </div>
  )
}

function FleetDonut({ health }: { health: Fleet }) {
  const total = health.online + health.attention + health.offline
  const segs = [
    { v: health.online, c: '#7ee0a8', label: 'Online' },
    { v: health.attention, c: '#fbbf24', label: 'Attention' },
    { v: health.offline, c: '#f2637e', label: 'Offline' },
  ]
  const R = 34, C = 2 * Math.PI * R
  let offset = 0
  return (
    <div className="flex items-center gap-4">
      <svg width="92" height="92" viewBox="0 0 92 92" className="shrink-0">
        <circle cx="46" cy="46" r={R} fill="none" stroke="#12202c" strokeWidth="11" />
        {total > 0 && segs.map((s, i) => {
          if (s.v <= 0) return null
          const len = (s.v / total) * C
          const el = <circle key={i} cx="46" cy="46" r={R} fill="none" stroke={s.c} strokeWidth="11" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} transform="rotate(-90 46 46)" strokeLinecap="butt" />
          offset += len
          return el
        })}
        <text x="46" y="43" textAnchor="middle" fontSize="18" fontWeight="700" fill="#eaf2fb">{pct(health)}%</text>
        <text x="46" y="57" textAnchor="middle" fontSize="8" fill="#98abbd">online</text>
      </svg>
      <div className="flex flex-col gap-1.5">
        {segs.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-[11px]">
            <span style={{ width: 8, height: 8, borderRadius: 2, background: s.c }} />
            <span style={{ color: '#c3d3e2' }}>{s.label}</span>
            <span className="ml-auto font-bold" style={{ color: '#eaf2fb' }}>{s.v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function StatusBars({ rows }: { rows: { status: string; count: number }[] }) {
  if (rows.length === 0) return <Empty label="No open jobs" />
  const max = Math.max(1, ...rows.map(r => r.count))
  return (
    <div className="flex flex-col gap-2">
      {rows.slice(0, 6).map(r => {
        const c = STATUS_COLOR[r.status] ?? '#9FD8EC'
        return (
          <div key={r.status} className="flex items-center gap-2">
            <div className="w-24 shrink-0 text-[11px] capitalize" style={{ color: '#c3d3e2' }}>{r.status.replace(/_/g, ' ')}</div>
            <div className="relative h-4 flex-1 overflow-hidden rounded-md" style={{ background: 'rgba(10,16,24,0.5)' }}>
              <div className="h-full rounded-md" style={{ width: `${Math.max(4, (r.count / max) * 100)}%`, background: c }} />
            </div>
            <div className="w-7 shrink-0 text-right text-[12px] font-bold" style={{ color: '#eaf2fb' }}>{r.count}</div>
          </div>
        )
      })}
    </div>
  )
}

function PeopleTable({ people, fin, loading }: { people: Rollup['people']; fin: boolean; loading: boolean }) {
  if (loading) return <div className="py-6 text-center text-[12px]" style={{ color: '#7f96ab' }}>Loading team…</div>
  if (people.length === 0) return <Empty label="No assigned records in your hierarchy yet" />
  return (
    <div className="max-h-56 overflow-y-auto">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="text-[9.5px] uppercase tracking-[0.06em]" style={{ color: '#7f96ab' }}>
            <th className="py-1 pr-2 text-left font-medium">Person</th>
            <th className="py-1 pr-2 text-left font-medium">Org</th>
            <th className="py-1 pr-2 text-right font-medium">Leads</th>
            {fin && <th className="py-1 pr-2 text-right font-medium">Pipeline</th>}
            <th className="py-1 text-right font-medium">Jobs</th>
          </tr>
        </thead>
        <tbody>
          {people.map((p, i) => (
            <tr key={i} style={{ borderTop: '1px solid rgba(140,170,200,0.1)' }}>
              <td className="py-1.5 pr-2" style={{ color: '#eaf2fb' }}>
                <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full align-middle text-[9px] font-bold" style={{ background: '#2f7fb8', color: '#eaf2fb' }}>{initials(p.name)}</span>
                {p.name}
              </td>
              <td className="py-1.5 pr-2" style={{ color: '#98abbd' }}>{p.org}</td>
              <td className="py-1.5 pr-2 text-right" style={{ color: '#eaf2fb' }}>{p.leads}</td>
              {fin && <td className="py-1.5 pr-2 text-right" style={{ color: '#eaf2fb' }}>{money(p.pipeline)}</td>}
              <td className="py-1.5 text-right" style={{ color: '#eaf2fb' }}>{p.jobs}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Empty({ label }: { label: string }) {
  return <div className="rounded-xl px-3 py-6 text-center text-[11px]" style={{ color: '#6f8397' }}>{label}</div>
}
function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '?' }
