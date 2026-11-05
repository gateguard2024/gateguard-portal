/**
 * lib/finance-outlook.ts — SERVER ONLY. Gate Guard's cash outlook (Admin → Finance).
 *
 * Projects the bank balance forward: 13 weeks by week, 12 months by month.
 *
 * Money in:
 *   - Open QuickBooks invoices (Balance > 0). Not late → on the due date ("expected").
 *     1–60 days late → next week ("estimated"). Over 60 days late → left out and listed
 *     separately, so a dead invoice never props up the forecast.
 *   - Monthly site billing for active sites, same formula as /api/invoices/generate-monthly
 *     (video fee + units × unit rate), from NEXT month on (this month is already invoiced
 *     or will show as an open invoice). Lands collect_lag_days after the 1st ("expected").
 *     Resident-funded fees are not modelled yet (no billing data — see lib/portal-billing.ts).
 * Money out ("known"):
 *   - Open QuickBooks bills (Balance > 0) on their due date; already past due → today.
 *   - Payroll from finance_settings (amount per run + frequency + next date).
 *   - Recurring money in / out from finance_recurring (Bank tab, migration 221). An out
 *     item is skipped in a month where an open QuickBooks bill from the same payee is due,
 *     so a vendor that sometimes sends a bill isn't counted twice. Before 221 runs, falls
 *     back to finance_settings.recurring_costs (220).
 *   - Gate Guard's own open purchase orders (sent / confirmed / partial) at expected
 *     date + 30 days. Dealer POs are not ours and are left out.
 *
 * Starting cash = QuickBooks bank balances (lib/qbo-reports overview, cached 30 min).
 * QuickBooks reads are metered by Intuit, so bills + invoices are cached 30 min too.
 */
import { getQboAuth, qboQuery } from '@/lib/qbo'
import { overview } from '@/lib/qbo-reports'
import { fdb } from '@/lib/finance-auth'
import { listRules, normName, occurrences } from '@/lib/finance-bank'
import { addDaysISO, daysBetween, todayET } from '@/lib/tz'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>
const TTL_MS = 30 * 60 * 1000
const r2 = (n: number) => Math.round(n * 100) / 100

export type Tier = 'must_pay' | 'keeps_running' | 'flexible'
export type Certainty = 'known' | 'expected' | 'estimated'
export interface CashItem {
  date: string                    // YYYY-MM-DD (ET)
  amount: number                  // + in, − out
  label: string
  source: 'qbo_bill' | 'qbo_invoice' | 'site_billing' | 'payroll' | 'recurring' | 'purchase_order'
  recurring_id?: string
  certainty: Certainty
  tier?: Tier                     // money out only
  ref?: string                    // QuickBooks id / site id / PO id
}
export interface Bucket { start: string; end: string; label: string; in: number; out: number; end_balance: number; below_floor: boolean; items: CashItem[] }
export interface PayPlanBill { qbo_id: string; vendor: string; vendor_id: string | null; doc: string | null; due_date: string; balance: number; days_to_due: number; overdue: boolean; tier: Tier }
export interface FinanceSettings {
  cash_floor: number; idle_minutes: number; payroll_amount: number; payroll_frequency: 'weekly' | 'biweekly' | 'semimonthly' | 'monthly'
  payroll_next_date: string | null; recurring_costs: { name: string; amount: number; day: number; tier: Tier }[]; collect_lag_days: number
}
export interface Outlook {
  as_of: string
  today: string
  cash_today: number
  cash_accounts: { name: string; balance: number }[]
  floor: number
  receivable_total: number                  // all open customer invoices (QuickBooks)
  payable_total: number                     // all open bills (QuickBooks)
  recurring_count: number
  weeks: Bucket[]
  months: Bucket[]
  lowest_week: { label: string; balance: number } | null
  lowest_month: { label: string; balance: number } | null
  share: Record<Certainty, number>          // of all money moving in 13 weeks, by certainty (0–1)
  left_out: { label: string; amount: number; days_late: number }[]   // invoices > 60 days late
  pay_plan: PayPlanBill[]
  gaps: string[]                            // what the forecast doesn't know yet, in plain words
}

// ── Settings ─────────────────────────────────────────────────────────────────
export async function getFinanceSettings(): Promise<FinanceSettings> {
  const { data, error } = await fdb().from('finance_settings').select('*').eq('id', 1).maybeSingle()
  if (error) throw new Error(error.message)
  const d = (data ?? {}) as Row
  return {
    cash_floor: Number(d.cash_floor) || 0,
    idle_minutes: Number(d.idle_minutes) || 15,
    payroll_amount: Number(d.payroll_amount) || 0,
    payroll_frequency: (['weekly', 'biweekly', 'semimonthly', 'monthly'].includes(d.payroll_frequency) ? d.payroll_frequency : 'biweekly'),
    payroll_next_date: typeof d.payroll_next_date === 'string' ? d.payroll_next_date.slice(0, 10) : null,
    recurring_costs: Array.isArray(d.recurring_costs) ? d.recurring_costs.map((c: Row) => ({ name: String(c.name ?? ''), amount: Number(c.amount) || 0, day: Math.min(31, Math.max(1, Number(c.day) || 1)), tier: (['must_pay', 'keeps_running', 'flexible'].includes(c.tier) ? c.tier : 'flexible') as Tier })).filter((c: { name: string; amount: number }) => c.name && c.amount > 0) : [],
    collect_lag_days: Number.isFinite(Number(d.collect_lag_days)) ? Number(d.collect_lag_days) : 15,
  }
}

// ── QuickBooks reads (cached) ────────────────────────────────────────────────
async function cachedQuery(key: string, refresh: boolean, query: string): Promise<{ ok: true; rows: Row[] } | { ok: false; error: string }> {
  const db = fdb()
  if (!refresh) {
    const { data } = await db.from('qbo_report_cache').select('data, fetched_at').eq('key', key).maybeSingle()
    if (data && Date.now() - new Date(data.fetched_at).getTime() < TTL_MS && Array.isArray(data.data)) return { ok: true, rows: data.data as Row[] }
  }
  const auth = await getQboAuth()
  if (!auth.ok) return { ok: false, error: auth.reason }
  const r = await qboQuery<Row>(auth, query)
  if (!r.ok) return { ok: false, error: r.error }
  const { error } = await db.from('qbo_report_cache').upsert({ key, data: r.rows, fetched_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) console.error('[finance] cache save failed', error.message)
  return { ok: true, rows: r.rows }
}

// ── Date helpers (all YYYY-MM-DD, ET) ────────────────────────────────────────
const monthStartOf = (d: string) => `${d.slice(0, 7)}-01`
function addMonths(ym01: string, n: number): string {
  const [y, m] = ym01.split('-').map(Number)
  const t = y * 12 + (m - 1) + n
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}-01`
}
const daysInMonth = (ym01: string) => { const [y, m] = ym01.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate() }
const onDay = (ym01: string, day: number) => `${ym01.slice(0, 8)}${String(Math.min(day, daysInMonth(ym01))).padStart(2, '0')}`
function weekStartMon(d: string): string {
  const [y, m, dd] = d.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, dd)).getUTCDay() // 0 Sun
  return addDaysISO(d, -((dow + 6) % 7))
}
const shortDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const monthLabel = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })

export function payrollDates(s: Pick<FinanceSettings, 'payroll_frequency' | 'payroll_next_date'>, from: string, to: string): string[] {
  const out: string[] = []
  if (!s.payroll_next_date) return out
  const anchor = s.payroll_next_date
  if (s.payroll_frequency === 'weekly' || s.payroll_frequency === 'biweekly') {
    const step = s.payroll_frequency === 'weekly' ? 7 : 14
    // walk from the anchor in either direction to the first date ≥ from
    let d = anchor
    const gap = daysBetween(anchor, from)
    if (gap > 0) d = addDaysISO(anchor, Math.ceil(gap / step) * step)
    for (; d <= to; d = addDaysISO(d, step)) if (d >= from) out.push(d)
    return out
  }
  for (let m = monthStartOf(from); m <= to; m = addMonths(m, 1)) {
    const days = s.payroll_frequency === 'semimonthly' ? [15, daysInMonth(m)] : [Number(anchor.slice(8, 10))]
    for (const day of days) { const d = onDay(m, day); if (d >= from && d <= to) out.push(d) }
  }
  return out
}

// ── The outlook ──────────────────────────────────────────────────────────────
export async function buildOutlook(refresh = false): Promise<{ ok: true; data: Outlook } | { ok: false; error: string }> {
  const today = todayET()
  const horizonEnd = addDaysISO(addMonths(monthStartOf(today), 12), -1)
  const settings = await getFinanceSettings()
  const db = fdb()
  const gaps: string[] = []

  const ov = await overview(refresh)
  if (!ov.ok) return { ok: false, error: ov.error }

  const [bills, invoices] = await Promise.all([
    cachedQuery(`finance:bills:${today}`, refresh, "select * from Bill where Balance > '0' maxresults 1000"),
    cachedQuery(`finance:invoices:${today}`, refresh, "select * from Invoice where Balance > '0' maxresults 1000"),
  ])
  if (!bills.ok) return { ok: false, error: bills.error }
  if (!invoices.ok) return { ok: false, error: invoices.error }
  if (bills.rows.length >= 1000 || invoices.rows.length >= 1000) gaps.push('QuickBooks returned 1,000 open bills or invoices — only the first 1,000 are counted.')

  const { data: tierRows, error: tierErr } = await db.from('finance_vendor_tiers').select('qbo_vendor_id, tier')
  if (tierErr) return { ok: false, error: tierErr.message }
  const tierOf = new Map<string, Tier>((tierRows ?? []).map(t => [String(t.qbo_vendor_id), t.tier as Tier]))

  const items: CashItem[] = []
  const payPlan: PayPlanBill[] = []
  const leftOut: Outlook['left_out'] = []

  // Bills (money out)
  for (const b of bills.rows) {
    const bal = Number(b.Balance) || 0
    if (bal <= 0) continue
    const due = String(b.DueDate ?? b.TxnDate ?? today).slice(0, 10)
    const vendorId = b.VendorRef?.value != null ? String(b.VendorRef.value) : null
    const vendor = String(b.VendorRef?.name ?? 'Vendor')
    const tier = (vendorId && tierOf.get(vendorId)) || 'flexible'
    payPlan.push({ qbo_id: String(b.Id), vendor, vendor_id: vendorId, doc: b.DocNumber ? String(b.DocNumber) : null, due_date: due, balance: r2(bal), days_to_due: daysBetween(today, due), overdue: due < today, tier })
    items.push({ date: due < today ? today : due, amount: -bal, label: `${vendor}${b.DocNumber ? ` · ${b.DocNumber}` : ''}`, source: 'qbo_bill', certainty: 'known', tier, ref: String(b.Id) })
  }
  payPlan.sort((a, b) => a.due_date.localeCompare(b.due_date) || b.balance - a.balance)

  // Invoices (money in)
  for (const inv of invoices.rows) {
    const bal = Number(inv.Balance) || 0
    if (bal <= 0) continue
    const due = String(inv.DueDate ?? inv.TxnDate ?? today).slice(0, 10)
    const cust = String(inv.CustomerRef?.name ?? 'Customer')
    const late = daysBetween(due, today)
    const label = `${cust}${inv.DocNumber ? ` · #${inv.DocNumber}` : ''}`
    if (late > 60) { leftOut.push({ label, amount: r2(bal), days_late: late }); continue }
    if (late > 0) items.push({ date: addDaysISO(weekStartMon(today), 7), amount: bal, label: `${label} (late ${late} d)`, source: 'qbo_invoice', certainty: 'estimated', ref: String(inv.Id) })
    else items.push({ date: due, amount: bal, label, source: 'qbo_invoice', certainty: 'expected', ref: String(inv.Id) })
  }
  leftOut.sort((a, b) => b.amount - a.amount)

  // Monthly site billing (same formula + filter as generate-monthly)
  const { data: sites, error: siteErr } = await db.from('sites')
    .select('id, name, units, billing_video_fee, billing_unit_rate, billing_units')
    .eq('status', 'active')
    .or('billing_video_fee.gt.0,billing_units.gt.0')
  if (siteErr) return { ok: false, error: siteErr.message }
  let monthlyBilling = 0
  for (const s of sites ?? []) {
    const video = Number(s.billing_video_fee) || 0
    const units = Number(s.billing_units ?? s.units) || 0
    const rate = s.billing_unit_rate == null ? 5 : Number(s.billing_unit_rate) || 0
    monthlyBilling += video + (units > 0 && rate > 0 ? units * rate : 0)
  }
  monthlyBilling = r2(monthlyBilling)
  if (monthlyBilling > 0) {
    for (let m = addMonths(monthStartOf(today), 1); m <= horizonEnd; m = addMonths(m, 1)) {
      const d = addDaysISO(m, settings.collect_lag_days)
      if (d <= horizonEnd) items.push({ date: d, amount: monthlyBilling, label: `Monthly site billing · ${(sites ?? []).length} sites (${monthLabel(m)})`, source: 'site_billing', certainty: 'expected' })
    }
  }
  gaps.push('Resident-funded move-in and renewal fees aren’t in the forecast yet.')

  // Payroll
  if (settings.payroll_amount > 0 && settings.payroll_next_date) {
    for (const d of payrollDates(settings, today, horizonEnd)) items.push({ date: d, amount: -settings.payroll_amount, label: 'Payroll', source: 'payroll', certainty: 'known', tier: 'must_pay' })
  } else gaps.push('Payroll isn’t set up — add it in Settings.')

  // Recurring money in / out
  let recurringCount = 0
  const rules = await listRules()
  if (rules.ok) {
    const billMonths = new Set(payPlan.map(b => `${normName(b.vendor)}|${b.due_date.slice(0, 7)}`))
    for (const rule of rules.rules) {
      recurringCount++
      const payee = rule.match_key ? rule.match_key.slice(rule.match_key.indexOf(':') + 1) : normName(rule.name)
      for (const d of occurrences(rule, today, horizonEnd)) {
        if (rule.direction === 'out' && billMonths.has(`${payee}|${d.slice(0, 7)}`)) continue
        items.push(rule.direction === 'in'
          ? { date: d, amount: rule.amount, label: rule.name, source: 'recurring', certainty: 'expected', recurring_id: rule.id }
          : { date: d, amount: -rule.amount, label: rule.name, source: 'recurring', certainty: 'known', tier: rule.tier, recurring_id: rule.id })
      }
    }
  } else if (rules.missing) {
    gaps.push('Run migration 221 to use recurring items from bank transactions.')
    for (const c of settings.recurring_costs) {
      recurringCount++
      for (let m = monthStartOf(today); m <= horizonEnd; m = addMonths(m, 1)) {
        const d = onDay(m, c.day)
        if (d >= today && d <= horizonEnd) items.push({ date: d, amount: -c.amount, label: c.name, source: 'recurring', certainty: 'known', tier: c.tier })
      }
    }
  } else return { ok: false, error: rules.error }

  // Gate Guard's own open purchase orders
  const { data: corp } = await db.from('organizations').select('id').eq('org_tier', 'corporate').limit(1).maybeSingle()
  let poQuery = db.from('purchase_orders').select('id, po_number, supplier, status, total, expected_at, ordered_at, org_id').in('status', ['sent', 'confirmed', 'partial'])
  poQuery = corp?.id ? poQuery.or(`org_id.eq.${corp.id},org_id.is.null`) : poQuery.is('org_id', null)
  const { data: pos, error: poErr } = await poQuery
  if (poErr) return { ok: false, error: poErr.message }
  for (const p of pos ?? []) {
    const total = Number(p.total) || 0
    if (total <= 0) continue
    const base = (p.expected_at ? String(p.expected_at) : p.ordered_at ? String(p.ordered_at) : today).slice(0, 10)
    let d = addDaysISO(base, 30)
    if (d < today) d = today
    if (d <= horizonEnd) items.push({ date: d, amount: -total, label: `PO ${p.po_number ?? ''} · ${p.supplier ?? 'Supplier'}`.replace(/\s+/g, ' '), source: 'purchase_order', certainty: 'known', tier: 'flexible', ref: String(p.id) })
  }

  items.sort((a, b) => a.date.localeCompare(b.date))

  // Buckets
  const floor = settings.cash_floor
  const bucketize = (ranges: { start: string; end: string; label: string }[]): Bucket[] => {
    let bal = ov.data.cash.total
    return ranges.map(rg => {
      const its = items.filter(i => i.date >= rg.start && i.date <= rg.end)
      const inn = r2(its.filter(i => i.amount > 0).reduce((s, i) => s + i.amount, 0))
      const out = r2(-its.filter(i => i.amount < 0).reduce((s, i) => s + i.amount, 0))
      bal = r2(bal + inn - out)
      return { ...rg, in: inn, out, end_balance: bal, below_floor: floor > 0 && bal < floor, items: its }
    })
  }
  const wk0 = weekStartMon(today)
  const weekRanges = Array.from({ length: 13 }, (_, i) => {
    const start = i === 0 ? today : addDaysISO(wk0, i * 7)
    const end = addDaysISO(wk0, i * 7 + 6)
    return { start, end, label: `Week of ${shortDate(addDaysISO(wk0, i * 7))}` }
  })
  const monthRanges = Array.from({ length: 12 }, (_, i) => {
    const m = addMonths(monthStartOf(today), i)
    return { start: i === 0 ? today : m, end: addDaysISO(addMonths(m, 1), -1), label: monthLabel(m) }
  })
  const weeks = bucketize(weekRanges)
  const months = bucketize(monthRanges)
  const low = (bs: Bucket[]) => bs.reduce<Bucket | null>((m, b) => (!m || b.end_balance < m.end_balance ? b : m), null)
  const lw = low(weeks), lm = low(months)

  const in13 = weeks.flatMap(w => w.items)
  const total13 = in13.reduce((s, i) => s + Math.abs(i.amount), 0)
  const share = (c: Certainty) => (total13 > 0 ? Math.round((in13.filter(i => i.certainty === c).reduce((s, i) => s + Math.abs(i.amount), 0) / total13) * 100) / 100 : 0)

  return {
    ok: true,
    data: {
      as_of: new Date().toISOString(), today,
      cash_today: ov.data.cash.total, cash_accounts: ov.data.cash.accounts, floor,
      receivable_total: r2(invoices.rows.reduce((s, i) => s + (Number(i.Balance) || 0), 0)),
      payable_total: r2(payPlan.reduce((s, b) => s + b.balance, 0)),
      recurring_count: recurringCount,
      weeks, months,
      lowest_week: lw ? { label: lw.label, balance: lw.end_balance } : null,
      lowest_month: lm ? { label: lm.label, balance: lm.end_balance } : null,
      share: { known: share('known'), expected: share('expected'), estimated: share('estimated') },
      left_out: leftOut, pay_plan: payPlan, gaps,
    },
  }
}
