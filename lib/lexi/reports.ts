/**
 * Lexi — reports on demand (Phase 3). "Pipeline by rep", "jobs closed by tech"…
 * Each report reads only what the caller can see (Sales rules for deals, company
 * scope for jobs) and returns a chart the Lexi screen draws, plus the rows so
 * Lexi can explain them.
 */
import type Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { applyOrgScope } from '@/lib/org-scope'
import { OPEN_STAGES, dealMoney, dealTab, ownerFor, profileNames, scopeDeals } from '@/lib/sales-deals'
import type { LexiCtx } from '@/lib/lexi/tools'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const NO_MATCH = '00000000-0000-0000-0000-000000000000'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

export type LexiChart = { kind: 'bar' | 'line'; title: string; unit: 'money' | 'count'; labels: string[]; series: { name: string; values: number[] }[]; note?: string }

export const REPORTS = {
  pipeline_by_stage: 'Open sales pipeline (contract value) by stage',
  pipeline_by_rep: 'Open sales pipeline (contract value) by rep',
  won_by_month: 'Deals won per month (contract value)',
  jobs_completed_by_tech: 'Jobs completed per technician',
  open_jobs_by_status: 'Open jobs by status',
  jobs_trend: 'Jobs created vs completed per week',
} as const
export type ReportKey = keyof typeof REPORTS

export const REPORT_TOOL: Anthropic.Tool = {
  name: 'run_report',
  description: `Build a report with a chart from live Nexus data. Reports: ${Object.entries(REPORTS).map(([k, v]) => `${k} (${v})`).join('; ')}. "months" sets the window for won_by_month (default 6); "days" for jobs_completed_by_tech (default 30); "weeks" for jobs_trend (default 8). The chart shows on screen — summarize the 2–3 things that stand out.`,
  input_schema: { type: 'object', properties: { report: { type: 'string', enum: Object.keys(REPORTS) }, months: { type: 'number' }, days: { type: 'number' }, weeks: { type: 'number' } }, required: ['report'] },
}

const STAGE_LABEL: Record<string, string> = { meet_present: 'Meet', survey: 'Survey', propose: 'Proposal', negotiate: 'Negotiate', contract: 'Contract', deposit: 'Deposit' }
const OPEN_WO = ['open', 'scheduled', 'in_progress', 'procurement', 'stuck', 'on_hold']
const clampN = (v: unknown, d: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number(v) || d))
const round = (n: number) => Math.round(n)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const scopedWO = (cols: string, ctx: LexiCtx): any => {
  const q = sb.from('work_orders').select(cols)
  if (ctx.scope.all) return q
  return ctx.scope.ids.length ? applyOrgScope(q, ctx.scope, 'org_id') : q.eq('id', NO_MATCH)
}
const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
const monthLabel = (k: string) => new Date(`${k}-15T12:00:00`).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
const weekStart = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x }

async function openDeals(ctx: LexiCtx): Promise<Row[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q: any = scopeDeals(sb.from('opportunities').select('*').is('deleted_at', null), ctx.deals)
  const { data, error } = await q.limit(2000)
  if (error) throw new Error(error.message)
  return ((data ?? []) as Row[]).filter(d => dealTab(d) === 'open')
}

export async function runReport(input: Row, ctx: LexiCtx): Promise<{ data: unknown; chart?: LexiChart }> {
  const key = String(input.report ?? '') as ReportKey
  if (!(key in REPORTS)) return { data: { error: `Unknown report. Pick one of: ${Object.keys(REPORTS).join(', ')}` } }
  try {
    switch (key) {
      case 'pipeline_by_stage': {
        const deals = await openDeals(ctx)
        const by = new Map<string, { v: number; n: number }>()
        for (const d of deals) { const s = String(d.stage); const e = by.get(s) ?? { v: 0, n: 0 }; e.v += dealMoney(d).tcv ?? 0; e.n++; by.set(s, e) }
        const stages = [...OPEN_STAGES.filter(s => by.has(s)), ...Array.from(by.keys()).filter(s => !(OPEN_STAGES as readonly string[]).includes(s))]
        const rows = stages.map(s => ({ stage: STAGE_LABEL[s] ?? s, deals: by.get(s)!.n, value: round(by.get(s)!.v) }))
        return { data: { rows, total_value: rows.reduce((a, r) => a + r.value, 0), total_deals: deals.length }, chart: { kind: 'bar', title: REPORTS[key], unit: 'money', labels: rows.map(r => r.stage), series: [{ name: 'Contract value', values: rows.map(r => r.value) }], note: `${deals.length} open deals` } }
      }
      case 'pipeline_by_rep': {
        const deals = await openDeals(ctx)
        const names = await profileNames(deals.map(d => d.rep_id).filter(Boolean))
        const by = new Map<string, { v: number; n: number }>()
        for (const d of deals) { const o = ownerFor(d, names) ?? 'Unassigned'; const e = by.get(o) ?? { v: 0, n: 0 }; e.v += dealMoney(d).tcv ?? 0; e.n++; by.set(o, e) }
        const rows = Array.from(by.entries()).map(([rep, e]) => ({ rep, deals: e.n, value: round(e.v) })).sort((a, b) => b.value - a.value).slice(0, 12)
        return { data: { rows }, chart: { kind: 'bar', title: REPORTS[key], unit: 'money', labels: rows.map(r => r.rep), series: [{ name: 'Contract value', values: rows.map(r => r.value) }], note: `${deals.length} open deals` } }
      }
      case 'won_by_month': {
        const months = clampN(input.months, 6, 2, 24)
        const since = new Date(); since.setDate(1); since.setMonth(since.getMonth() - (months - 1)); since.setHours(0, 0, 0, 0)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const q: any = scopeDeals(sb.from('opportunities').select('*').is('deleted_at', null), ctx.deals)
        const { data, error } = await q.gte('updated_at', since.toISOString()).limit(3000)
        if (error) throw new Error(error.message)
        const keys: string[] = []; for (let i = 0; i < months; i++) { const d = new Date(since); d.setMonth(since.getMonth() + i); keys.push(ym(d)) }
        const v = new Map(keys.map(k => [k, 0])), n = new Map(keys.map(k => [k, 0]))
        for (const d of ((data ?? []) as Row[]).filter(x => dealTab(x) === 'won')) {
          const when = new Date(d.won_at ?? d.closed_at ?? d.close_date ?? d.updated_at); const k = ym(when)
          if (!v.has(k)) continue
          v.set(k, v.get(k)! + (dealMoney(d).tcv ?? 0)); n.set(k, n.get(k)! + 1)
        }
        const rows = keys.map(k => ({ month: monthLabel(k), won: n.get(k)!, value: round(v.get(k)!) }))
        return { data: { rows }, chart: { kind: 'bar', title: REPORTS[key], unit: 'money', labels: rows.map(r => r.month), series: [{ name: 'Won', values: rows.map(r => r.value) }], note: `${rows.reduce((a, r) => a + r.won, 0)} deals won` } }
      }
      case 'jobs_completed_by_tech': {
        const days = clampN(input.days, 30, 1, 365)
        const since = new Date(Date.now() - days * 86400000).toISOString()
        const { data, error } = await scopedWO('assignee_name, status, completed_at', ctx).eq('status', 'completed').gte('completed_at', since).limit(5000)
        if (error) throw new Error(error.message)
        const by = new Map<string, number>()
        for (const w of (data ?? []) as Row[]) { const t = w.assignee_name || 'No tech'; by.set(t, (by.get(t) ?? 0) + 1) }
        const rows = Array.from(by.entries()).map(([tech, jobs]) => ({ tech, jobs })).sort((a, b) => b.jobs - a.jobs).slice(0, 15)
        return { data: { rows, days }, chart: { kind: 'bar', title: `${REPORTS[key]} — last ${days} days`, unit: 'count', labels: rows.map(r => r.tech), series: [{ name: 'Jobs completed', values: rows.map(r => r.jobs) }] } }
      }
      case 'open_jobs_by_status': {
        const { data, error } = await scopedWO('status', ctx).in('status', OPEN_WO).limit(5000)
        if (error) throw new Error(error.message)
        const label: Record<string, string> = { open: 'New', scheduled: 'Scheduled', in_progress: 'In progress', procurement: 'Waiting on parts', stuck: 'Stuck', on_hold: 'On hold' }
        const by = new Map<string, number>()
        for (const w of (data ?? []) as Row[]) by.set(String(w.status), (by.get(String(w.status)) ?? 0) + 1)
        const rows = OPEN_WO.filter(s => by.has(s)).map(s => ({ status: label[s] ?? s, jobs: by.get(s)! }))
        return { data: { rows }, chart: { kind: 'bar', title: REPORTS[key], unit: 'count', labels: rows.map(r => r.status), series: [{ name: 'Jobs', values: rows.map(r => r.jobs) }] } }
      }
      case 'jobs_trend': {
        const weeks = clampN(input.weeks, 8, 2, 26)
        const start = weekStart(new Date()); start.setDate(start.getDate() - 7 * (weeks - 1))
        const [made, done] = await Promise.all([
          scopedWO('created_at', ctx).gte('created_at', start.toISOString()).limit(5000),
          scopedWO('completed_at', ctx).eq('status', 'completed').gte('completed_at', start.toISOString()).limit(5000),
        ])
        if (made.error) throw new Error(made.error.message)
        if (done.error) throw new Error(done.error.message)
        const idx = (iso: string) => Math.floor((weekStart(new Date(iso)).getTime() - start.getTime()) / (7 * 86400000))
        const c = Array(weeks).fill(0), f = Array(weeks).fill(0)
        for (const w of (made.data ?? []) as Row[]) { const i = idx(w.created_at); if (i >= 0 && i < weeks) c[i]++ }
        for (const w of (done.data ?? []) as Row[]) { const i = idx(w.completed_at); if (i >= 0 && i < weeks) f[i]++ }
        const labels = Array.from({ length: weeks }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + 7 * i); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) })
        return { data: { weeks: labels.map((l, i) => ({ week_of: l, created: c[i], completed: f[i] })) }, chart: { kind: 'line', title: `${REPORTS[key]} — last ${weeks} weeks`, unit: 'count', labels, series: [{ name: 'Created', values: c }, { name: 'Completed', values: f }] } }
      }
    }
  } catch (e) {
    return { data: { error: e instanceof Error ? e.message : 'The report failed.' } }
  }
  return { data: { error: 'Unknown report.' } }
}
