/**
 * What a property costs us to service vs what its plan brings in — GATE GUARD ONLY
 * (the route returns 403 to anyone else; dealers never see plan margin).
 *
 *  - Plan income  = the monthly plan (same formula as the monthly invoice run,
 *                   lib/stock.ts planMonthly) × days in the window ÷ 30.44.
 *  - Spend        = parts covered by the plan (qty × the cost frozen on the part
 *                   line) + labor on jobs the plan covers (hours on site + remote
 *                   minutes, at LABOR_RATE). Warranty and internal parts are shown
 *                   but not counted against the plan.
 *  - Billable     = parts marked billable + labor on jobs whose "who pays" is the
 *                   property. Shown so nothing is lost, never counted as spend.
 *  - Bought for this property = PO lines tagged to it (migration 236), whether or
 *                   not used yet — the spare shelf.
 * Jobs = completed work orders (lib/service-stats.ts loadWork).
 */
import { createClient } from '@supabase/supabase-js'
import { loadWork } from '@/lib/service-stats'
import { planMonthly } from '@/lib/stock'

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const DAY = 86_400_000
/** Burdened labor cost per hour — same number the job cost screen uses. */
export const LABOR_RATE = 65

type Part = { work_order_id: string; qty: number | null; unit_cost: number | null; action: string | null; bill_to?: string | null }
export type Window = { days: number; income: number; parts_plan: number; labor_plan: number; spend: number; margin: number | null; parts_billable: number; labor_billable: number; parts_warranty: number; jobs: number; hours: number }

const r2 = (n: number) => Math.round(n * 100) / 100

async function partsFor(ids: string[]): Promise<{ parts: Part[]; hasBillTo: boolean }> {
  const out: Part[] = []
  let hasBillTo = true
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200)
    let r = await db().from('work_order_parts').select('work_order_id, qty, unit_cost, action, bill_to').in('work_order_id', chunk)
    if (r.error) { hasBillTo = false; r = await db().from('work_order_parts').select('work_order_id, qty, unit_cost, action').in('work_order_id', chunk) as typeof r }
    if (r.error) throw new Error(r.error.message)
    out.push(...((r.data ?? []) as Part[]))
  }
  return { parts: out.filter((p) => p.action !== 'returned'), hasBillTo }
}

export async function planSpending(siteId: string) {
  const { data: site, error } = await db().from('sites').select('id, name, status, units, billing_video_fee, billing_units, billing_unit_rate').eq('id', siteId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!site) return null
  const monthly = planMonthly(site as Parameters<typeof planMonthly>[0])
  const since = new Date(Date.now() - 365 * DAY)
  const { jobs, visits } = await loadWork({ siteIds: [siteId], since })
  const { parts, hasBillTo } = await partsFor(jobs.map((j) => j.id))

  const minsBy = new Map<string, number>()
  for (const v of visits) minsBy.set(v.work_order_id, (minsBy.get(v.work_order_id) ?? 0) + (Number(v.duration_mins) || 0))
  const window = (days: number): Window => {
    const from = new Date(Date.now() - days * DAY).toISOString()
    const js = jobs.filter((j) => (j.completed_at ?? '') >= from)
    const ids = new Set(js.map((j) => j.id))
    const jobBill = new Map(js.map((j) => [j.id, j.bill_to ?? null]))
    let parts_plan = 0, parts_billable = 0, parts_warranty = 0, labor_plan = 0, labor_billable = 0, hours = 0
    for (const p of parts) {
      if (!ids.has(p.work_order_id)) continue
      const cost = (Number(p.qty) || 1) * (Number(p.unit_cost) || 0)
      // Parts saved before 236 have no who-pays: treat them like the job's answer, else the plan.
      const who = p.bill_to ?? (jobBill.get(p.work_order_id) === 'property' ? 'property' : jobBill.get(p.work_order_id) === 'warranty' ? 'warranty' : 'plan')
      if (who === 'property') parts_billable += cost
      else if (who === 'warranty') parts_warranty += cost
      else if (who === 'plan') parts_plan += cost
    }
    for (const j of js) {
      const mins = (minsBy.get(j.id) ?? 0) + (Number(j.remote_minutes) || 0)
      hours += mins / 60
      const cost = (mins / 60) * LABOR_RATE
      if (j.bill_to === 'property') labor_billable += cost
      else if (j.bill_to !== 'warranty') labor_plan += cost
    }
    const income = monthly * (days / 30.44)
    const spend = parts_plan + labor_plan
    return {
      days, income: r2(income), parts_plan: r2(parts_plan), labor_plan: r2(labor_plan), spend: r2(spend),
      margin: income > 0 ? Math.round(((income - spend) / income) * 100) : null,
      parts_billable: r2(parts_billable), labor_billable: r2(labor_billable), parts_warranty: r2(parts_warranty),
      jobs: js.length, hours: Math.round(hours * 10) / 10,
    }
  }

  // Bought for this property's plan (PO lines tagged to it), last 12 months.
  let bought = 0, boughtLines = 0, boughtNote: string | null = null
  const b = await db().from('purchase_order_items').select('qty, unit_cost, created_at').eq('site_id', siteId).gte('created_at', since.toISOString())
  if (b.error) boughtNote = 'needs migration 236'
  else for (const it of (b.data ?? []) as { qty: number | null; unit_cost: number | null }[]) { bought += (Number(it.qty) || 0) * (Number(it.unit_cost) || 0); boughtLines++ }

  return {
    site: { id: (site as { id: string }).id, name: (site as { name?: string }).name ?? null },
    on_plan: monthly > 0, plan_monthly: monthly, labor_rate: LABOR_RATE,
    month: window(30), d90: window(90), year: window(365),
    bought_for_site: { cost: r2(bought), lines: boughtLines, note: boughtNote },
    note: hasBillTo ? null : 'Who-pays on parts needs migration 236 — until then parts follow the job’s answer.',
  }
}
