'use client'

/**
 * AdminReportConsole — the Admin landing "command center" report band.
 * Rolls up the admin's whole hierarchy from EXISTING tables via two real,
 * org-scoped endpoints: /api/nexus/admin/rollup (leads/opps/jobs + per-person)
 * and /api/nexus/operations/dashboard (fleet health + service load).
 * Light Apple look (same tokens + .sy CSS as Systems / Catalog / Events — the
 * parent InternalSurface injects the CSS). Hand-rolled SVG, no chart library.
 */
import { useEffect, useState } from 'react'
import { BLUE, DOT, LINE, MUTED, TEXT, TEXT2 } from '@/components/nexus/systems/shared'

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
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
// Job states that mean "something's wrong" get an orange dot; everything else is neutral.
const STATUS_DOT: Record<string, string> = { stuck: DOT.orange, on_hold: DOT.orange, blocked: DOT.red }

export function AdminReportConsole({ onOpenTab, onTeam }: { onOpenTab?: (tab: string) => void; onTeam?: (team: { members: number; orgs: number } | null) => void }) {
  const [r, setR] = useState<Rollup | null>(null)
  const [ops, setOps] = useState<Ops | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    Promise.all([
      fetch('/api/nexus/admin/rollup', { cache: 'no-store' }).then(x => x.json()).catch(() => null),
      fetch('/api/nexus/operations/dashboard', { cache: 'no-store' }).then(x => x.json()).catch(() => null),
    ]).then(([rollup, opsData]) => {
      if (!alive) return
      // Coerce error-shaped / malformed responses to null so the nested reads
      // below (r.leads.total, ops.fleet.health) can't crash the console.
      const ok = rollup && rollup.leads && rollup.opps && rollup.jobs ? rollup as Rollup : null
      setR(ok)
      setOps(opsData && opsData.fleet ? opsData : null)
      setLoading(false)
      onTeam?.(ok?.team ?? null)
    })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fin = r?.canViewFinancials ?? false
  const dash = loading ? '…' : '—'

  return (
    <div style={{ marginBottom: 22 }}>
      {/* KPI tiles — same shape as the Systems strip */}
      <div className="sy-kpis ad-kpis">
        <button type="button" className="sy-kpi" onClick={() => onOpenTab?.('opps')}>
          <div className="l"><span className="sy-dot" style={{ background: DOT.blue }} />Leads</div>
          <div className="ad-kv">
            <div className="v">{r ? r.leads.total : dash}</div>
            {r && <Spark trend={r.leads.trend} />}
          </div>
          <div className="s">{r ? `${r.leads.newThisWeek} new this week` : 'Sales'}</div>
        </button>
        <button type="button" className="sy-kpi" onClick={() => onOpenTab?.('opps')}>
          <div className="l"><span className="sy-dot" style={{ background: DOT.blue }} />Opportunities</div>
          <div className="v">{r ? r.opps.open : dash}</div>
          <div className="s">{r ? (fin ? `${money(r.opps.openPipeline)} open · ${r.opps.wonThisMonth} won this month` : `${r.opps.wonThisMonth} won this month`) : 'Sales'}</div>
        </button>
        <button type="button" className="sy-kpi" onClick={() => onOpenTab?.('jobs')}>
          <div className="l"><span className="sy-dot" style={{ background: DOT.blue }} />Open jobs</div>
          <div className="v">{r ? r.jobs.open : dash}</div>
          <div className="s">{r ? `${r.jobs.completedThisWeek} done this week${ops ? ` · ${ops.fleet.sitesActive}/${ops.fleet.sitesTotal} sites active` : ''}` : 'Operations'}</div>
        </button>
        <button type="button" className="sy-kpi" onClick={() => onOpenTab?.('systems')}>
          <div className="l"><span className="sy-dot" style={{ background: ops ? (ops.fleet.health.offline ? DOT.red : ops.fleet.health.attention ? DOT.orange : DOT.green) : DOT.gray }} />Devices online</div>
          <div className="v">{ops ? `${pct(ops.fleet.health)}%` : dash}</div>
          <div className="s">{ops ? `${plural(ops.fleet.devicesTotal, 'device')} tracked${ops.response.avgResponseHours != null ? ` · ${ops.response.avgResponseHours} h avg response` : ''}` : 'Systems'}</div>
        </button>
      </div>

      <div className="sy-split">
        <div className="sy-card">
          <div className="hd">
            <div><h3>Pipeline by stage</h3><div className="s">{r ? (fin ? `${money(r.opps.openPipeline)} open in ${plural(r.opps.open, 'deal')}` : plural(r.opps.open, 'open deal')) : 'Open deals in your companies'}</div></div>
            <button type="button" className="sy-b blue sm" onClick={() => onOpenTab?.('opps')}>Open Sales</button>
          </div>
          <div className="bd"><Funnel funnel={r?.opps.funnel ?? []} fin={fin} loading={loading} /></div>
        </div>
        <div className="sy-card">
          <div className="hd">
            <div><h3>Device health</h3><div className="s">{ops ? `${plural(ops.fleet.devicesTotal, 'device')} at ${plural(ops.fleet.sitesTotal, 'site')}` : 'Cameras, gates, readers and intercoms'}</div></div>
            <button type="button" className="sy-b blue sm" onClick={() => onOpenTab?.('systems')}>Open Systems</button>
          </div>
          <div className="bd"><FleetDonut health={ops?.fleet.health ?? { online: 0, attention: 0, offline: 0 }} loading={loading} /></div>
        </div>
      </div>

      <div className="sy-split ad-split2" style={{ marginTop: 14 }}>
        <div className="sy-card">
          <div className="hd">
            <div><h3>Open jobs by status</h3><div className="s">{r ? plural(r.jobs.open, 'open job') : 'Operations'}</div></div>
            <button type="button" className="sy-b blue sm" onClick={() => onOpenTab?.('jobs')}>Open Operations</button>
          </div>
          <div className="bd"><StatusBars rows={r?.jobs.byStatus ?? []} loading={loading} /></div>
        </div>
        <div className="sy-card">
          <div className="hd">
            <div><h3>By team member</h3><div className="s">{r ? plural(r.people.length, 'person', 'people') : 'Who owns what'}</div></div>
          </div>
          <div className="bd"><PeopleTable people={r?.people ?? []} fin={fin} loading={loading} /></div>
        </div>
      </div>
    </div>
  )
}

function pct(h: Fleet) { const t = h.online + h.attention + h.offline; return t ? Math.round((h.online / t) * 100) : 0 }

function Spark({ trend }: { trend: number[] }) {
  // trend[0] = this week … reverse so the line reads left (old) → right (now)
  const series = [...trend].reverse()
  if (series.length < 2) return null
  const max = Math.max(1, ...series)
  const w = 76, h = 24, step = w / (series.length - 1)
  const pts = series.map((v, i) => `${(i * step).toFixed(1)},${(2 + (h - 4) - (v / max) * (h - 4)).toFixed(1)}`).join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden style={{ flex: 'none' }}>
      <polyline points={pts} fill="none" stroke={BLUE} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function Bar({ label, count, max, right, dot }: { label: string; count: number; max: number; right?: string; dot?: string }) {
  return (
    <div className="ad-bar">
      <div className="lb">{dot && <span className="sy-dot" style={{ background: dot }} />}{label}</div>
      <div className="tr"><div className="fl" style={{ width: count ? `${Math.max(2, (count / max) * 100)}%` : 0 }} /></div>
      <div className="n">{count}</div>
      {right != null && <div className="r">{right}</div>}
    </div>
  )
}

function Funnel({ funnel, fin, loading }: { funnel: { key: string; label: string; count: number; value: number }[]; fin: boolean; loading: boolean }) {
  if (loading) return <div className="sy-empty">Loading…</div>
  if (funnel.every(f => f.count === 0)) return <div className="sy-empty">No open deals yet.</div>
  const max = Math.max(1, ...funnel.map(f => f.count))
  return <div className="ad-bars">{funnel.map(f => <Bar key={f.key} label={f.label} count={f.count} max={max} right={fin ? money(f.value) : undefined} />)}</div>
}

function FleetDonut({ health, loading }: { health: Fleet; loading: boolean }) {
  if (loading) return <div className="sy-empty">Loading…</div>
  const total = health.online + health.attention + health.offline
  if (!total) return <div className="sy-empty">No devices tracked yet.</div>
  const segs = [
    { v: health.online, c: DOT.green, label: 'Online' },
    { v: health.attention, c: DOT.orange, label: 'Needs a look' },
    { v: health.offline, c: DOT.red, label: 'Offline' },
  ]
  const R = 36, C = 2 * Math.PI * R
  let offset = 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
      <svg width="96" height="96" viewBox="0 0 96 96" style={{ flex: 'none' }} role="img" aria-label={`${pct(health)}% online`}>
        <circle cx="48" cy="48" r={R} fill="none" stroke="#EEF0F4" strokeWidth="9" />
        {segs.map((s, i) => {
          if (s.v <= 0) return null
          const len = (s.v / total) * C
          const gap = segs.filter(x => x.v > 0).length > 1 ? 2 : 0
          const el = <circle key={i} cx="48" cy="48" r={R} fill="none" stroke={s.c} strokeWidth="9" strokeDasharray={`${Math.max(0, len - gap)} ${C - len + gap}`} strokeDashoffset={-offset} transform="rotate(-90 48 48)" />
          offset += len
          return el
        })}
        <text x="48" y="47" textAnchor="middle" fontSize="19" fontWeight="600" fill={TEXT} style={{ fontVariantNumeric: 'tabular-nums' }}>{pct(health)}%</text>
        <text x="48" y="62" textAnchor="middle" fontSize="10" fill={MUTED}>online</text>
      </svg>
      <div style={{ display: 'grid', gap: 8, flex: 1, minWidth: 0 }}>
        {segs.map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: TEXT2 }}>
            <span className="sy-dot" style={{ background: s.c }} />
            <span>{s.label}</span>
            <span style={{ marginLeft: 'auto', fontWeight: 600, color: TEXT, fontVariantNumeric: 'tabular-nums' }}>{s.v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function StatusBars({ rows, loading }: { rows: { status: string; count: number }[]; loading: boolean }) {
  if (loading) return <div className="sy-empty">Loading…</div>
  if (rows.length === 0) return <div className="sy-empty">No open jobs.</div>
  const max = Math.max(1, ...rows.map(r => r.count))
  return (
    <div className="ad-bars">
      {rows.slice(0, 6).map(r => {
        const label = r.status.replace(/_/g, ' ')
        return <Bar key={r.status} label={label.charAt(0).toUpperCase() + label.slice(1)} count={r.count} max={max} dot={STATUS_DOT[r.status]} />
      })}
    </div>
  )
}

function PeopleTable({ people, fin, loading }: { people: Rollup['people']; fin: boolean; loading: boolean }) {
  if (loading) return <div className="sy-empty">Loading team…</div>
  if (people.length === 0) return <div className="sy-empty">No one in your companies owns a lead, deal or job yet.</div>
  return (
    <div className="ad-tbl">
      <table>
        <thead>
          <tr>
            <th>Person</th>
            <th className="co">Company</th>
            <th className="num">Leads</th>
            {fin && <th className="num">Pipeline</th>}
            <th className="num">Jobs</th>
          </tr>
        </thead>
        <tbody>
          {people.map((p, i) => (
            <tr key={i}>
              <td><span className="ad-av">{initials(p.name)}</span>{p.name}</td>
              <td className="co" style={{ color: MUTED }}>{p.org}</td>
              <td className="num">{p.leads}</td>
              {fin && <td className="num">{money(p.pipeline)}</td>}
              <td className="num">{p.jobs}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function initials(name: string) { return name.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '?' }

/** Extra CSS for the report band + admin tool tiles (on top of systems/shared CSS). */
export const ADMIN_CSS = `
.ad-kpis{grid-template-columns:repeat(4,minmax(0,1fr))}
.sy-kpi{transition:box-shadow .15s}
button.sy-kpi:hover{box-shadow:0 0 0 1px rgba(0,113,227,.35),0 1px 2px rgba(10,20,40,.06),0 8px 24px rgba(10,20,40,.08)}
.ad-kv{display:flex;align-items:flex-end;justify-content:space-between;gap:8px}
.ad-bars{display:grid;gap:9px}
.ad-bar{display:grid;grid-template-columns:120px minmax(0,1fr) 34px auto;align-items:center;gap:10px;font-size:13px}
.ad-bar .lb{display:flex;align-items:center;gap:6px;color:${TEXT2};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ad-bar .tr{height:8px;border-radius:4px;background:#EEF0F4;overflow:hidden}
.ad-bar .fl{height:100%;border-radius:4px;background:${BLUE}}
.ad-bar .n{text-align:right;font-weight:600;color:${TEXT};font-variant-numeric:tabular-nums}
.ad-bar .r{min-width:48px;text-align:right;color:${MUTED};font-variant-numeric:tabular-nums}
.ad-tbl{max-height:260px;overflow:auto;margin:-4px 0}
.ad-tbl table{width:100%;border-collapse:collapse;font-size:13px}
.ad-tbl th{position:sticky;top:0;background:#fff;text-align:left;font-size:12px;font-weight:500;color:${MUTED};padding:4px 8px 8px 0;border-bottom:1px solid ${LINE}}
.ad-tbl td{padding:8px 8px 8px 0;border-top:1px solid ${LINE};color:${TEXT};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:260px}
.ad-tbl tr:first-child td{border-top:0}
.ad-tbl .num{text-align:right;font-variant-numeric:tabular-nums;padding-right:0;padding-left:12px}
.ad-av{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:#EEF4FF;color:${BLUE};font-size:10px;font-weight:600;margin-right:8px;vertical-align:middle}
.ad-sec{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin:0 0 10px}
.ad-sec h2{margin:0;font-size:17px;font-weight:600;color:${TEXT}}
.ad-sec .s{font-size:13px;color:${MUTED}}
.ad-tools{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}
.ad-tool{display:flex;gap:12px;align-items:flex-start;text-align:left;background:#fff;border:0;border-radius:14px;box-shadow:0 1px 2px rgba(10,20,40,.06),0 8px 24px rgba(10,20,40,.08);padding:14px 16px;cursor:pointer;font:inherit;color:inherit;transition:box-shadow .15s}
.ad-tool:hover{box-shadow:0 0 0 1px rgba(0,113,227,.35),0 1px 2px rgba(10,20,40,.06),0 8px 24px rgba(10,20,40,.08)}
.ad-tool .ic{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:#EEF4FF;color:${BLUE};flex:none}
.ad-tool .t{display:flex;align-items:center;flex-wrap:wrap;gap:4px 8px;font-size:15px;font-weight:600}
.ad-tool .m{font-size:13px;color:${MUTED};margin-top:3px;line-height:1.4}
.ad-team{display:inline-flex;align-items:center;gap:7px;height:30px;padding:0 12px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);color:#fff;font-size:13px;font-weight:500}
@media (min-width:1101px){.ad-split2{grid-template-columns:minmax(0,1fr) minmax(0,1.5fr)}}
@media (max-width:1100px){.ad-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:560px){.ad-tbl .co{display:none}.ad-tbl td{max-width:170px}.ad-bar{grid-template-columns:92px minmax(0,1fr) 28px auto}}
`
