'use client'
/**
 * Systems → Service: how much service this property takes — visits, hours on
 * site, parts, return trips — for the last month, 90 days and 12 months, plus
 * the latest jobs, and the same per gate/door (Setup → Openings). A return trip
 * is a repeat at the same opening within 30 days. Numbers come from /api/service-stats (lib/service-stats.ts).
 * On site = spare parts kept on this property's shelf (/api/stock?site_id, migration 236).
 * Spending vs plan = what this property costs us vs what its plan brings in — Gate Guard
 * only (/api/sites/[id]/spending, lib/plan-spending.ts); dealers never see it.
 */
import React, { useEffect, useState } from 'react'
import { type Any, Card, MUTED, Note, ORANGE, TEXT, fmtWhen, getJson, send, type SiteCtx } from './shared'
import { BAND_LABEL, HEALTH_POINTS, type SiteHealth } from '@/lib/site-health-rules'

type T = { jobs: number; visits: number; hours: number; avg_visit_mins: number | null; parts: number; parts_cost: number; return_trips: number; jobs_without_time: number }
type ByOpening = { opening_id: string | null; jobs: number; visits: number; hours: number; parts_cost: number; return_trips: number; last_visit: string | null }
type Stats = { month: T; d90: T; year: T; by_opening?: ByOpening[]; last_visit: string | null; last_job_at: string | null; recent: { id: string; opening_id?: string | null; completed_at: string; tech: string | null; visits: number; mins: number; return_trip: boolean }[] }

type Shelf = { id: string; name: string; mine: boolean; items: { product_id: string; name: string; sku: string | null; qty: number }[] }
type Win = { income: number; parts_plan: number; labor_plan: number; spend: number; margin: number | null; parts_billable: number; labor_billable: number; parts_warranty: number; jobs: number; hours: number }
type Spend = { on_plan: boolean; plan_monthly: number; labor_rate: number; month: Win; d90: Win; year: Win; bought_for_site: { cost: number; lines: number; note: string | null }; note: string | null }
const money = (n: number) => `$${Math.round(n).toLocaleString()}`

const mins = (m: number | null) => (m == null ? '—' : m >= 60 ? `${Math.floor(m / 60)}h ${m % 60 ? `${m % 60}m` : ''}`.trim() : `${m}m`)

export function ServiceTab({ ctx, health }: { ctx: SiteCtx; health?: SiteHealth | null }) {
  const [s, setS] = useState<Stats | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [ops, setOps] = useState<{ id: string; name: string; active?: boolean }[]>([])
  useEffect(() => { void getJson(`/api/sites/${ctx.siteId}/openings?lite=1&all=1`).then((r: Any) => { if (r.ok) setOps(r.data.openings ?? []) }) }, [ctx.siteId])
  useEffect(() => {
    let alive = true
    void getJson(`/api/service-stats?view=site&site_id=${ctx.siteId}`).then((r: Any) => {
      if (!alive) return
      if (r.ok) setS(r.data as Stats); else setErr(r.data?.error ?? 'Couldn’t load service stats.')
    })
    return () => { alive = false }
  }, [ctx.siteId])

  // Spare parts on site + (Gate Guard only) spending vs plan.
  const [shelves, setShelves] = useState<Shelf[] | null>(null)
  const [stockNote, setStockNote] = useState<string | null>(null)
  const [spend, setSpend] = useState<Spend | null>(null)
  const [spendErr, setSpendErr] = useState<string | null>(null)
  const loadShelves = React.useCallback(() => getJson(`/api/stock?site_id=${ctx.siteId}`).then((r: Any) => {
    if (!r.ok) { setStockNote(r.data?.error ?? 'Couldn’t load spare parts.'); setShelves([]); return }
    if (r.data.ready === false) { setStockNote('Spare parts on site need migration 236.'); setShelves([]); return }
    setStockNote(null); setShelves(r.data.shelves ?? [])
  }), [ctx.siteId])
  useEffect(() => { void loadShelves() }, [loadShelves])
  useEffect(() => {
    if (!ctx.isCorporate) return
    void getJson(`/api/sites/${ctx.siteId}/spending`).then((r: Any) => { if (r.ok) setSpend(r.data as Spend); else setSpendErr(r.data?.error ?? 'Couldn’t load spending.') })
  }, [ctx.siteId, ctx.isCorporate])
  const addShelf = async () => {
    const r = await send('/api/stock', 'POST', { kind: 'site', site_id: ctx.siteId })
    if (!r.ok) ctx.notify(r.data?.error ?? 'Couldn’t add the shelf.', false); else { ctx.notify('Spare shelf added — move parts to it from Catalog → Stock.'); void loadShelves() }
  }

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

  const bandColor = (b: string) => (b === 'good' ? '#1A7F37' : b === 'watch' ? ORANGE : '#D70015')
  const healthCard = health ? (
    <Card title={`Health ${health.score}`} sub={`${BAND_LABEL[health.band]} — starts at 100 and loses points for what’s wrong right now.`}>
      {health.reasons.length === 0 ? <div style={{ fontSize: 14, color: MUTED }}>Nothing open — no gates left open, Faults, open jobs or requests.</div>
        : health.reasons.map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: i ? '1px solid rgba(0,0,0,0.06)' : undefined, fontSize: 14, color: TEXT }}>
            <span style={{ flex: 1 }}>{r.text}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: bandColor(health.band) }}>−{r.points}</span>
          </div>
        ))}
      <div style={{ marginTop: 8, fontSize: 12, color: MUTED }}>Gate left open or Fault −{HEALTH_POINTS.gateLeftOpen} · can’t see a gate −{HEALTH_POINTS.gateBlind} · cameras offline up to −{HEALTH_POINTS.camerasMax} · urgent job −{HEALTH_POINTS.jobUrgent}, other job −{HEALTH_POINTS.jobOther}, overdue −{HEALTH_POINTS.jobOverdue} more · request −{HEALTH_POINTS.requestOther} (urgent −{HEALTH_POINTS.requestHigh}) · repeat visit −{HEALTH_POINTS.repeatVisit}</div>
    </Card>
  ) : null

  const onSite = shelves ? shelves.reduce((a, sh) => a + sh.items.reduce((b, i) => b + Math.max(0, i.qty), 0), 0) : 0
  const onSiteCard = (
    <Card title="Spare parts on site" sub={shelves === null ? 'Loading…' : stockNote ?? (shelves.length ? `${onSite} part${onSite === 1 ? '' : 's'} on the shelf here` : 'No spare shelf at this property yet')}>
      {(shelves ?? []).map((sh) => (
        <div key={sh.id} style={{ marginBottom: 6 }}>
          {shelves && shelves.length > 1 && <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, margin: '4px 0' }}>{sh.name}{sh.mine ? '' : ' (dealer)'}</div>}
          {sh.items.length === 0 ? <div style={{ fontSize: 14, color: MUTED }}>Empty.</div> : sh.items.map((i) => (
            <div key={i.product_id} style={{ display: 'flex', gap: 10, padding: '7px 0', borderTop: '1px solid rgba(0,0,0,0.06)', fontSize: 14, color: TEXT }}>
              <span style={{ flex: 1 }}>{i.name}{i.sku ? <span style={{ color: MUTED }}> · {i.sku}</span> : null}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: i.qty < 0 ? '#D70015' : TEXT }}>{i.qty}</span>
            </div>
          ))}
        </div>
      ))}
      {shelves && !stockNote && !shelves.some((sh) => sh.mine) && (
        <button type="button" onClick={() => void addShelf()} style={{ marginTop: 6, border: '1px solid rgba(0,0,0,0.12)', background: '#fff', borderRadius: 9, padding: '7px 12px', fontSize: 13, fontWeight: 600, color: TEXT, cursor: 'pointer', fontFamily: 'inherit' }}>+ Keep spare parts here</button>
      )}
    </Card>
  )

  const spendRows: [string, (w: Win) => React.ReactNode, boolean?][] = [
    ['Plan income', (w) => money(w.income)],
    ['Parts covered by plan', (w) => money(w.parts_plan)],
    [`Labor on plan jobs (at $${spend?.labor_rate ?? 65}/h)`, (w) => money(w.labor_plan)],
    ['What it cost us', (w) => <b style={{ fontWeight: 600 }}>{money(w.spend)}</b>],
    ['Margin', (w) => (w.margin == null ? '—' : <span style={{ fontWeight: 600, color: w.margin < 0 ? '#D70015' : w.margin < 30 ? ORANGE : '#1A7F37' }}>{w.margin}%</span>)],
    ['Billable (not counted)', (w) => money(w.parts_billable + w.labor_billable), true],
    ['Warranty parts (not counted)', (w) => money(w.parts_warranty), true],
  ]
  const spendCard = ctx.isCorporate ? (
    <Card title="Spending vs plan" sub={spend ? (spend.on_plan ? `Plan ${money(spend.plan_monthly)}/month. Gate Guard only — dealers don’t see this.` : 'This property isn’t on a service plan — nothing is covered, parts default to billable.') : spendErr ?? 'Loading…'}>
      {spend && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ borderBottom: '1px solid rgba(0,0,0,0.10)' }}><th style={{ ...th, textAlign: 'left' }} /><th style={th}>Last 30 days</th><th style={th}>Last 90 days</th><th style={th}>Last 12 months</th></tr></thead>
            <tbody>{spendRows.map(([label, f, quiet]) => (
              <tr key={label} style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                <td style={{ ...td, textAlign: 'left', color: MUTED }}>{label}</td>
                {[spend.month, spend.d90, spend.year].map((w, i) => <td key={i} style={{ ...td, color: quiet ? MUTED : TEXT }}>{f(w)}</td>)}
              </tr>
            ))}</tbody>
          </table>
          <div style={{ marginTop: 8, fontSize: 12, color: MUTED }}>
            Bought for this property’s plan in the last 12 months: {spend.bought_for_site.note ? spend.bought_for_site.note : `${money(spend.bought_for_site.cost)} (${spend.bought_for_site.lines} PO line${spend.bought_for_site.lines === 1 ? '' : 's'})`} — counted when used. Parts cost is what we paid (Gate Guard cost on our jobs, dealer cost on theirs).
            {spend.note ? ` ${spend.note}` : ''}
          </div>
        </div>
      )}
    </Card>
  ) : null

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {healthCard}
      {spendCard}
      {onSiteCard}
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
        <div style={{ marginTop: 8, fontSize: 12, color: MUTED }}>A return trip is a job at the same gate or door opened within 30 days of the last one closing there.</div>
      </Card>

      {ops.length > 0 && (
        <Card title="By gate / door" sub="Last 12 months. Set up gates and doors in Setup → Openings; techs pick one when they finish a job.">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ borderBottom: '1px solid rgba(0,0,0,0.10)' }}>
                <th style={{ ...th, textAlign: 'left' }}>Opening</th><th style={th}>Jobs</th><th style={th}>Visits</th><th style={th}>Hours</th><th style={th}>Parts $</th><th style={th}>Return trips</th><th style={th}>Last visit</th>
              </tr></thead>
              <tbody>{[...ops.filter((o) => o.active !== false || (s.by_opening ?? []).some((b) => b.opening_id === o.id)).map((o) => ({ key: o.id, name: o.name, row: (s.by_opening ?? []).find((b) => b.opening_id === o.id) })),
                ...((s.by_opening ?? []).some((b) => !b.opening_id) ? [{ key: '_none', name: 'Whole property / not set', row: (s.by_opening ?? []).find((b) => !b.opening_id) }] : [])]
                .map(({ key, name, row }) => (
                  <tr key={key} style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                    <td style={{ ...td, textAlign: 'left', color: key === '_none' ? MUTED : TEXT }}>{name}</td>
                    <td style={td}>{row?.jobs ?? 0}</td><td style={td}>{row?.visits ?? 0}</td><td style={td}>{row?.hours ?? 0}</td>
                    <td style={td}>{`$${(row?.parts_cost ?? 0).toLocaleString()}`}</td>
                    <td style={{ ...td, color: row?.return_trips ? ORANGE : TEXT, fontWeight: row?.return_trips ? 600 : 400 }}>{row?.return_trips ?? 0}</td>
                    <td style={{ ...td, color: MUTED }}>{row?.last_visit ? fmtWhen(row.last_visit) : '—'}</td>
                  </tr>
                ))}</tbody>
            </table>
          </div>
        </Card>
      )}

      {s.recent.length > 0 && (
        <Card title="Latest jobs">
          {s.recent.map((j) => (
            <a key={j.id} href={`/maintenance/${j.id}`} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '9px 0', borderTop: '1px solid rgba(0,0,0,0.06)', color: TEXT, textDecoration: 'none', fontSize: 14 }}>
              <span style={{ flex: 1 }}>{fmtWhen(j.completed_at)}{j.tech ? ` · ${j.tech}` : ''}{j.opening_id && ops.find((o) => o.id === j.opening_id) ? <span style={{ color: MUTED }}> · {ops.find((o) => o.id === j.opening_id)!.name}</span> : null}</span>
              {j.return_trip && <span style={{ fontSize: 11.5, fontWeight: 600, color: ORANGE }}>Return trip</span>}
              <span style={{ color: MUTED, fontVariantNumeric: 'tabular-nums' }}>{j.visits ? `${j.visits} visit${j.visits === 1 ? '' : 's'} · ${mins(j.mins)}` : 'no time logged'}</span>
            </a>
          ))}
        </Card>
      )}
    </div>
  )
}
