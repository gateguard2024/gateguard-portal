/**
 * QuickBooks money picture for the QuickBooks page and Lexi (corporate only).
 * Reads are metered by Intuit, so every report is cached for 30 minutes in
 * qbo_report_cache (refresh: true skips the cache).
 *
 *   overview()  → cash in bank, open A/R with aging buckets + biggest late
 *                 customers, open A/P, P&L this month vs last month, YTD.
 *   flattenReport() turns any QuickBooks report into simple rows.
 */
import { getQboAuth, qboJson, qboQuery } from '@/lib/qbo'
import { qdb } from '@/lib/qbo-sync'
import { addDaysISO, todayET } from '@/lib/tz'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>
const TTL_MS = 30 * 60 * 1000

export interface FlatRow { label: string; values: (number | string | null)[]; depth: number; kind: 'data' | 'section' | 'total' }
export interface FlatReport { title: string; period: string; columns: string[]; rows: FlatRow[] }

const num = (v: unknown): number | string | null => {
  if (v == null || v === '') return null
  const n = Number(String(v).replace(/,/g, ''))
  return isFinite(n) ? n : String(v)
}

/** QuickBooks report JSON → { columns, rows } (sections, data lines and totals, with depth). */
export function flattenReport(rep: Row): FlatReport {
  const columns = ((rep?.Columns?.Column ?? []) as Row[]).map(c => String(c.ColTitle ?? ''))
  const rows: FlatRow[] = []
  const walk = (list: Row[] | undefined, depth: number) => {
    for (const r of list ?? []) {
      if (r.Header?.ColData) rows.push({ label: String(r.Header.ColData[0]?.value ?? ''), values: (r.Header.ColData as Row[]).slice(1).map(c => num(c.value)), depth, kind: 'section' })
      if (r.ColData) rows.push({ label: String(r.ColData[0]?.value ?? ''), values: (r.ColData as Row[]).slice(1).map(c => num(c.value)), depth, kind: 'data' })
      if (r.Rows?.Row) walk(r.Rows.Row, depth + 1)
      if (r.Summary?.ColData) rows.push({ label: String(r.Summary.ColData[0]?.value ?? ''), values: (r.Summary.ColData as Row[]).slice(1).map(c => num(c.value)), depth, kind: 'total' })
    }
  }
  walk(rep?.Rows?.Row, 0)
  const h = rep?.Header ?? {}
  return { title: String(h.ReportName ?? ''), period: h.StartPeriod && h.EndPeriod ? `${h.StartPeriod} – ${h.EndPeriod}` : String(h.Time ?? ''), columns: columns.slice(1), rows }
}

async function cached<T>(key: string, refresh: boolean, load: () => Promise<T>): Promise<T> {
  const db = qdb()
  if (!refresh) {
    const { data } = await db.from('qbo_report_cache').select('data, fetched_at').eq('key', key).maybeSingle()
    if (data && Date.now() - new Date(data.fetched_at).getTime() < TTL_MS) return data.data as T
  }
  const fresh = await load()
  const { error } = await db.from('qbo_report_cache').upsert({ key, data: fresh as unknown as Row, fetched_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) console.error('[qbo-reports] cache save failed', error.message)
  return fresh
}

export async function getReport(name: 'ProfitAndLoss' | 'BalanceSheet' | 'AgedReceivables' | 'AgedPayables', params: Record<string, string>, refresh = false): Promise<{ ok: true; report: FlatReport } | { ok: false; error: string }> {
  const auth = await getQboAuth()
  if (!auth.ok) return { ok: false, error: auth.reason }
  const qs = new URLSearchParams(params).toString()
  try {
    const report = await cached(`report:${name}:${qs}`, refresh, async () => {
      const r = await qboJson<Row>(auth, `/reports/${name}${qs ? `?${qs}` : ''}`)
      if (!r.ok) throw new Error(r.error)
      return flattenReport(r.data)
    })
    return { ok: true, report }
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : 'Report failed' } }
}

export interface MoneyOverview {
  asOf: string
  cash: { total: number; accounts: { name: string; balance: number }[] }
  receivable: { total: number; current: number; d1_30: number; d31_60: number; d61_90: number; over90: number; late: { customer: string; overdue: number; total: number }[] }
  payable: { total: number }
  pnl: { thisMonth: { income: number; expenses: number; net: number }; lastMonth: { income: number; expenses: number; net: number }; ytd: { income: number; expenses: number; net: number } }
}

function pnlTotals(rep: FlatReport) {
  const find = (re: RegExp) => { const r = rep.rows.find(x => x.kind === 'total' && re.test(x.label)); const v = r?.values[r.values.length - 1]; return typeof v === 'number' ? v : 0 }
  const income = find(/^Total Income$/i)
  const net = rep.rows.find(x => /^Net Income$/i.test(x.label))
  const netV = typeof net?.values[net.values.length - 1] === 'number' ? (net!.values[net!.values.length - 1] as number) : 0
  const cogs = find(/^Total Cost of Goods Sold$/i)
  const exp = find(/^Total Expenses$/i)
  return { income, expenses: Math.round((cogs + exp) * 100) / 100, net: netV }
}

export async function overview(refresh = false): Promise<{ ok: true; data: MoneyOverview } | { ok: false; error: string }> {
  const auth = await getQboAuth()
  if (!auth.ok) return { ok: false, error: auth.reason }
  const today = todayET()
  const ym = today.slice(0, 7)
  const monthStart = `${ym}-01`
  const lastStart = (() => { const [y, m] = ym.split('-').map(Number); return m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, '0')}-01` })()
  const lastEnd = addDaysISO(monthStart, -1)
  try {
    const data = await cached(`overview:${today}`, refresh, async () => {
      const [banks, ar, ap, pThis, pLast, pYtd] = await Promise.all([
        qboQuery<Row>(auth, "select Name, CurrentBalance, AccountType, Active from Account where AccountType = 'Bank' maxresults 100"),
        qboJson<Row>(auth, `/reports/AgedReceivables?report_date=${today}`),
        qboJson<Row>(auth, `/reports/AgedPayables?report_date=${today}`),
        qboJson<Row>(auth, `/reports/ProfitAndLoss?start_date=${monthStart}&end_date=${today}`),
        qboJson<Row>(auth, `/reports/ProfitAndLoss?start_date=${lastStart}&end_date=${lastEnd}`),
        qboJson<Row>(auth, `/reports/ProfitAndLoss?start_date=${today.slice(0, 4)}-01-01&end_date=${today}`),
      ])
      for (const r of [ar, ap, pThis, pLast, pYtd]) if (!r.ok) throw new Error(r.error)
      if (!banks.ok) throw new Error(banks.error)
      const accounts = (banks.rows ?? []).filter(a => a.Active !== false).map(a => ({ name: String(a.Name), balance: Number(a.CurrentBalance) || 0 }))
      // A/R aging: columns usually Current, 1 - 30, 31 - 60, 61 - 90, 91 and over, Total
      const arRep = flattenReport((ar as { data: Row }).data)
      const idx = (re: RegExp) => arRep.columns.findIndex(c => re.test(c))
      const iCur = idx(/^current/i), i30 = idx(/^1\s*-\s*30/), i60 = idx(/^31/), i90 = idx(/^61/), iOver = idx(/91|over/i), iTot = idx(/^total/i)
      const v = (r: FlatRow, i: number) => (i >= 0 && typeof r.values[i] === 'number' ? (r.values[i] as number) : 0)
      const custRows = arRep.rows.filter(r => r.kind === 'data' && r.label)
      const totalRow = arRep.rows.find(r => r.kind === 'total' && /^total/i.test(r.label)) ?? arRep.rows[arRep.rows.length - 1]
      const late = custRows.map(r => ({ customer: r.label, overdue: Math.round((v(r, i30) + v(r, i60) + v(r, i90) + v(r, iOver)) * 100) / 100, total: v(r, iTot) }))
        .filter(x => x.overdue > 0).sort((a, b) => b.overdue - a.overdue).slice(0, 8)
      const apRep = flattenReport((ap as { data: Row }).data)
      const apTot = apRep.rows.find(r => r.kind === 'total' && /^total/i.test(r.label))
      const apTotal = apTot ? (apTot.values[apTot.values.length - 1] as number) || 0 : 0
      const out: MoneyOverview = {
        asOf: new Date().toISOString(),
        cash: { total: Math.round(accounts.reduce((s, a) => s + a.balance, 0) * 100) / 100, accounts },
        receivable: totalRow ? { total: v(totalRow, iTot), current: v(totalRow, iCur), d1_30: v(totalRow, i30), d31_60: v(totalRow, i60), d61_90: v(totalRow, i90), over90: v(totalRow, iOver), late } : { total: 0, current: 0, d1_30: 0, d31_60: 0, d61_90: 0, over90: 0, late: [] },
        payable: { total: apTotal },
        pnl: { thisMonth: pnlTotals(flattenReport((pThis as { data: Row }).data)), lastMonth: pnlTotals(flattenReport((pLast as { data: Row }).data)), ytd: pnlTotals(flattenReport((pYtd as { data: Row }).data)) },
      }
      return out
    })
    return { ok: true, data }
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : 'Couldn’t read QuickBooks' } }
}
