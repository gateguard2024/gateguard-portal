'use client'
/**
 * Systems → Service: how much service this property takes — visits, hours on
 * site, parts, return trips — for the last month, 90 days and 12 months, plus
 * the latest jobs. Numbers come from /api/service-stats (lib/service-stats.ts).
 */
import React, { useEffect, useState } from 'react'
import { type Any, Card, MUTED, Note, ORANGE, TEXT, fmtWhen, getJson, type SiteCtx } from './shared'

type T = { jobs: number; visits: number; hours: number; avg_visit_mins: number | null; parts: number; parts_cost: number; return_trips: number; jobs_without_time: number }
type Stats = { month: T; d90: T; year: T; last_visit: string | null; last_job_at: string | null; recent: { id: string; completed_at: string; tech: string | null; visits: number; mins: number; return_trip: boolean }[] }

const mins = (m: number | null) => (m == null ? '—' : m >= 60 ? `${Math.floor(m / 60)}h ${m % 60 ? `${m % 60}m` : ''}`.trim() : `${m}m`)

export function ServiceTab({ ctx }: { ctx: SiteCtx }) {
  const [s, setS] = useState<Stats | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    void getJson(`/api/service-stats?view=site&site_id=${ctx.siteId}`).then((r: Any) => {
      if (!alive) return
      if (r.ok) setS(r.data as Stats); else setErr(r.data?.error ?? 'Couldn’t load service stats.')
    })
    return () => { alive = false }
  }, [ctx.siteId])

  if (err) return <Card title="Service"><Note tone="red">{err}</Note></Card>
  if (!s) return <Card title="Service"><div style={{ color: MUTED, fontSize: 14 }}>Loading…</div></Card>

  const cols: [string, T][] = [['Last 30 days', s.month], ['Last 90 days', s.d90], ['Last 12 months', s.year]]
  const rows: [string, (t: T) => React.ReactNode][] = [
    ['Jobs done', (t) => t.jobs],
    ['Visits', (t) => t.visits],
    ['Hours on site', (t) => t.hours],
    ['Avg time per visit', (t) => mins(t.avg_visit_mins)],
    ['Parts used', (t) => t.parts],
    ['Parts cost', (t) => `$${t.parts_cost.toLocaleString()}`],
    ['Return trips', (t) => (t.jobs ? `${t.return_trips} (${Math.round((t.return_trips / t.jobs) * 100)}%)` : t.return_trips)],
  ]
  const th: React.CSSProperties = { textAlign: 'right', fontSize: 12, fontWeight: 600, color: MUTED, padding: '6px 10px', whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { textAlign: 'right', fontSize: 14, padding: '9px 10px', fontVariantNumeric: 'tabular-nums', color: TEXT }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Card title="Service at this property" sub={s.last_visit ? `Last visit ${fmtWhen(s.last_visit)}` : s.last_job_at ? `Last job closed ${fmtWhen(s.last_job_at)} (no time logged)` : 'No finished jobs in the last 12 months'}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ borderBottom: '1px solid rgba(0,0,0,0.10)' }}><th style={{ ...th, textAlign: 'left' }} />{cols.map(([k]) => <th key={k} style={th}>{k}</th>)}</tr></thead>
            <tbody>{rows.map(([label, f]) => (
              <tr key={label} style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                <td style={{ ...td, textAlign: 'left', color: MUTED }}>{label}</td>{cols.map(([k, t]) => <td key={k} style={td}>{f(t)}</td>)}
              </tr>
            ))}</tbody>
          </table>
        </div>
        {s.year.jobs_without_time > 0 && <div style={{ marginTop: 10, fontSize: 12.5, color: ORANGE }}>{s.year.jobs_without_time} job{s.year.jobs_without_time === 1 ? '' : 's'} this year closed before time on site was required — hours here run low until new jobs fill in.</div>}
        <div style={{ marginTop: 8, fontSize: 12, color: MUTED }}>A return trip is a job opened within 30 days of the last one closing here.</div>
      </Card>

      {s.recent.length > 0 && (
        <Card title="Latest jobs">
          {s.recent.map((j) => (
            <a key={j.id} href={`/maintenance/${j.id}`} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '9px 0', borderTop: '1px solid rgba(0,0,0,0.06)', color: TEXT, textDecoration: 'none', fontSize: 14 }}>
              <span style={{ flex: 1 }}>{fmtWhen(j.completed_at)}{j.tech ? ` · ${j.tech}` : ''}</span>
              {j.return_trip && <span style={{ fontSize: 11.5, fontWeight: 600, color: ORANGE }}>Return trip</span>}
              <span style={{ color: MUTED, fontVariantNumeric: 'tabular-nums' }}>{j.visits ? `${j.visits} visit${j.visits === 1 ? '' : 's'} · ${mins(j.mins)}` : 'no time logged'}</span>
            </a>
          ))}
        </Card>
      )}
    </div>
  )
}
