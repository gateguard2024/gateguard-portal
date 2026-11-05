/**
 * lib/finance-bank.ts — SERVER ONLY. Bank transactions + recurring items (Admin → Finance → Bank).
 *
 * Reads the last 90 days of money in and out of Gate Guard's QuickBooks BANK accounts
 * (AccountType = 'Bank'), as recorded in QuickBooks — not the raw bank feed waiting in
 * QuickBooks' "For review" list (Intuit's API doesn't expose that). Cached 30 minutes in
 * qbo_report_cache like every other QuickBooks read.
 *
 *   Purchase      checks, debit/ACH charges          → out (Credit = refund → in)   markable
 *   Deposit       deposits                           → in                            markable
 *                 (a deposit made only of invoice payments is "counted" instead)
 *   Transfer      money between accounts             → out / in (bank→bank skipped)  markable
 *   SalesReceipt  money taken without an invoice     → in                            markable
 *   BillPayment   paying a QuickBooks bill           → out   counted (the forecast has the bill)
 *   Payment       a customer paying an invoice       → in    counted (the forecast has the invoice)
 *
 * "Counted" rows can't be made recurring: their bills / invoices are already in the
 * outlook, so it would count them twice.
 *
 * Recurring items live in finance_recurring (migration 221); marks per transaction in
 * finance_txn_marks. suggestRecurring() spots payees that repeat at a steady gap with a
 * steady amount.
 */
import { getQboAuth, qboQuery } from '@/lib/qbo'
import { fdb } from '@/lib/finance-auth'
import { addDaysISO, daysBetween, todayET } from '@/lib/tz'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>
const TTL_MS = 30 * 60 * 1000
export const LOOKBACK_DAYS = 90
const r2 = (n: number) => Math.round(n * 100) / 100

export type Frequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'
export type Tier = 'must_pay' | 'keeps_running' | 'flexible'
export const FREQUENCIES: Frequency[] = ['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly']
export const TIERS: Tier[] = ['must_pay', 'keeps_running', 'flexible']

export interface BankTxn {
  key: string                  // "<type>:<id>"
  type: 'Purchase' | 'Deposit' | 'Transfer' | 'SalesReceipt' | 'BillPayment' | 'Payment'
  date: string
  name: string                 // payee / customer / description
  memo: string | null
  account: string              // which bank account
  direction: 'in' | 'out'
  amount: number               // always positive
  markable: boolean
  counted_by: 'bill' | 'invoice' | null
  match_key: string            // "<in|out>:<normalized name>"
}

export interface RecurringRule {
  id: string; name: string; direction: 'in' | 'out'; amount: number; frequency: Frequency
  next_date: string; day_of_month: number | null; tier: Tier; match_key: string | null
  source: 'manual' | 'bank' | 'settings'; active: boolean
}

export interface Suggestion {
  match_key: string; name: string; direction: 'in' | 'out'; amount: number; frequency: Frequency
  next_date: string; count: number; txn_keys: string[]; last_date: string
}

// ── Names ────────────────────────────────────────────────────────────────────
/** Payee → stable key: lower case, no digits / punctuation / card-processor noise. */
export function normName(s: string): string {
  return String(s || '')
    .toLowerCase()
    .replace(/\b(pos|ach|debit|credit|purchase|payment|pmt|online|recurring|autopay|web|ppd|ccd|des|id|ref|inc|llc|co|corp|the)\b/g, ' ')
    .replace(/[^a-z]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
}
export const matchKey = (direction: 'in' | 'out', name: string) => `${direction}:${normName(name) || 'unknown'}`

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
  if (error) console.error('[finance-bank] cache save failed', error.message)
  return { ok: true, rows: r.rows }
}

export interface BankData { since: string; accounts: { id: string; name: string }[]; transactions: BankTxn[]; truncated: boolean }

export async function getBankTransactions(refresh = false): Promise<{ ok: true; data: BankData } | { ok: false; error: string }> {
  const today = todayET()
  const since = addDaysISO(today, -LOOKBACK_DAYS)
  const accts = await cachedQuery(`finance:bank_accounts:${today}`, refresh, "select Id, Name, AccountType, Active from Account where AccountType = 'Bank' maxresults 100")
  if (!accts.ok) return { ok: false, error: accts.error }
  const accounts = accts.rows.filter(a => a.Active !== false).map(a => ({ id: String(a.Id), name: String(a.Name) }))
  const bank = new Map(accounts.map(a => [a.id, a.name]))
  if (accounts.length === 0) return { ok: true, data: { since, accounts, transactions: [], truncated: false } }

  const q = (entity: string) => cachedQuery(`finance:bank:${entity}:${since}`, refresh, `select * from ${entity} where TxnDate >= '${since}' maxresults 1000`)
  const [purch, dep, xfer, sr, bp, pay] = await Promise.all([q('Purchase'), q('Deposit'), q('Transfer'), q('SalesReceipt'), q('BillPayment'), q('Payment')])
  for (const r of [purch, dep, xfer, sr, bp, pay]) if (!r.ok) return { ok: false, error: r.error }
  const rows = (r: typeof purch) => (r.ok ? r.rows : [])
  const truncated = [purch, dep, xfer, sr, bp, pay].some(r => r.ok && r.rows.length >= 1000)

  const out: BankTxn[] = []
  const push = (t: Omit<BankTxn, 'key' | 'match_key'> & { id: string }) => {
    if (!(t.amount > 0)) return
    const { id, ...rest } = t
    out.push({ ...rest, amount: r2(rest.amount), key: `${t.type}:${id}`, match_key: matchKey(t.direction, t.name) })
  }
  const date = (x: Row) => String(x.TxnDate ?? today).slice(0, 10)
  const memo = (x: Row) => (x.PrivateNote ? String(x.PrivateNote).slice(0, 200) : null)

  for (const p of rows(purch)) {
    const acct = p.AccountRef?.value != null ? String(p.AccountRef.value) : ''
    if (!bank.has(acct)) continue // card charges hit the card account; cash leaves when the card is paid
    push({ id: String(p.Id), type: 'Purchase', date: date(p), name: String(p.EntityRef?.name ?? p.Line?.[0]?.Description ?? 'Expense'), memo: memo(p), account: bank.get(acct)!, direction: p.Credit === true ? 'in' : 'out', amount: Number(p.TotalAmt) || 0, markable: true, counted_by: null })
  }
  for (const d of rows(dep)) {
    const acct = d.DepositToAccountRef?.value != null ? String(d.DepositToAccountRef.value) : ''
    if (!bank.has(acct)) continue
    const lines: Row[] = Array.isArray(d.Line) ? d.Line : []
    const onlyPayments = lines.length > 0 && lines.every(l => Array.isArray(l.LinkedTxn) && l.LinkedTxn.length > 0)
    const first = lines.find(l => l.DepositLineDetail?.Entity?.name)?.DepositLineDetail?.Entity?.name ?? lines[0]?.Description
    push({ id: String(d.Id), type: 'Deposit', date: date(d), name: String(first ?? (onlyPayments ? 'Customer payments' : 'Deposit')), memo: memo(d), account: bank.get(acct)!, direction: 'in', amount: Number(d.TotalAmt) || 0, markable: !onlyPayments, counted_by: onlyPayments ? 'invoice' : null })
  }
  for (const t of rows(xfer)) {
    const from = String(t.FromAccountRef?.value ?? ''), to = String(t.ToAccountRef?.value ?? '')
    const fromBank = bank.has(from), toBank = bank.has(to)
    if (fromBank && toBank) continue // between our own bank accounts: no cash moves
    if (fromBank) push({ id: String(t.Id), type: 'Transfer', date: date(t), name: `Transfer to ${t.ToAccountRef?.name ?? 'account'}`, memo: memo(t), account: bank.get(from)!, direction: 'out', amount: Number(t.Amount) || 0, markable: true, counted_by: null })
    else if (toBank) push({ id: String(t.Id), type: 'Transfer', date: date(t), name: `Transfer from ${t.FromAccountRef?.name ?? 'account'}`, memo: memo(t), account: bank.get(to)!, direction: 'in', amount: Number(t.Amount) || 0, markable: true, counted_by: null })
  }
  for (const s of rows(sr)) {
    const acct = String(s.DepositToAccountRef?.value ?? '')
    if (!bank.has(acct)) continue
    push({ id: String(s.Id), type: 'SalesReceipt', date: date(s), name: String(s.CustomerRef?.name ?? 'Sale'), memo: memo(s), account: bank.get(acct)!, direction: 'in', amount: Number(s.TotalAmt) || 0, markable: true, counted_by: null })
  }
  for (const b of rows(bp)) {
    const acct = String(b.CheckPayment?.BankAccountRef?.value ?? '')
    if (!bank.has(acct)) continue
    push({ id: String(b.Id), type: 'BillPayment', date: date(b), name: String(b.VendorRef?.name ?? 'Bill payment'), memo: memo(b), account: bank.get(acct)!, direction: 'out', amount: Number(b.TotalAmt) || 0, markable: false, counted_by: 'bill' })
  }
  for (const p of rows(pay)) {
    const acct = String(p.DepositToAccountRef?.value ?? '')
    if (!bank.has(acct)) continue // most land in Undeposited Funds and show up later as a Deposit
    push({ id: String(p.Id), type: 'Payment', date: date(p), name: String(p.CustomerRef?.name ?? 'Customer payment'), memo: memo(p), account: bank.get(acct)!, direction: 'in', amount: Number(p.TotalAmt) || 0, markable: false, counted_by: 'invoice' })
  }
  out.sort((a, b) => b.date.localeCompare(a.date) || b.amount - a.amount)
  return { ok: true, data: { since, accounts, transactions: out, truncated } }
}

// ── Recurring rules ──────────────────────────────────────────────────────────
export async function listRules(includeStopped = false): Promise<{ ok: true; rules: RecurringRule[] } | { ok: false; error: string; missing?: boolean }> {
  let q = fdb().from('finance_recurring').select('*').order('next_date')
  if (!includeStopped) q = q.eq('active', true)
  const { data, error } = await q
  if (error) return { ok: false, error: error.message, missing: /finance_recurring|PGRST205|42P01|does not exist|schema cache/i.test(`${error.code} ${error.message}`) }
  return { ok: true, rules: (data ?? []).map(r => ({ ...r, amount: Number(r.amount), next_date: String(r.next_date).slice(0, 10) })) as RecurringRule[] }
}

const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate() // m = 1–12
/** Every date a rule happens in [from, to], starting at next_date (an old next_date rolls forward). */
export function occurrences(rule: Pick<RecurringRule, 'frequency' | 'next_date' | 'day_of_month'>, from: string, to: string): string[] {
  const out: string[] = []
  const anchor = rule.next_date
  if (rule.frequency === 'weekly' || rule.frequency === 'biweekly') {
    const step = rule.frequency === 'weekly' ? 7 : 14
    let d = anchor
    const gap = daysBetween(anchor, from)
    if (gap > 0) d = addDaysISO(anchor, Math.ceil(gap / step) * step)
    for (; d <= to; d = addDaysISO(d, step)) if (d >= from) out.push(d)
    return out
  }
  const months = rule.frequency === 'monthly' ? 1 : rule.frequency === 'quarterly' ? 3 : 12
  const [ay, am, ad] = anchor.split('-').map(Number)
  const day = rule.day_of_month ?? ad
  const at = (k: number) => {
    const t = ay * 12 + (am - 1) + k * months
    const y = Math.floor(t / 12), m = (t % 12) + 1
    return `${y}-${String(m).padStart(2, '0')}-${String(Math.min(day, daysInMonth(y, m))).padStart(2, '0')}`
  }
  // next_date is the NEXT time it happens: never before it. An old anchor walks forward.
  let k = 0
  while (at(k) < from && k < 2000) k++
  for (let n = 0; n < 1000; n++, k++) {
    const d = at(k)
    if (d > to) break
    if (d >= from) out.push(d)
  }
  return out
}

/** Default next date after the last time it happened. */
export function nextAfter(last: string, frequency: Frequency, today = todayET()): string {
  let n = occurrences({ frequency, next_date: last, day_of_month: null }, addDaysISO(last, 1), addDaysISO(last, 800))[0] ?? addDaysISO(last, 30)
  // already passed (it was due and we haven't seen it yet) → keep it, the outlook will show it today-forward
  while (n < today) { const m = occurrences({ frequency, next_date: n, day_of_month: null }, addDaysISO(n, 1), addDaysISO(n, 800))[0]; if (!m) break; n = m }
  return n
}

// ── Suggestions ──────────────────────────────────────────────────────────────
function median(xs: number[]): number { const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
function freqFromGap(gap: number): Frequency | null {
  if (gap >= 5 && gap <= 9) return 'weekly'
  if (gap >= 12 && gap <= 17) return 'biweekly'
  if (gap >= 26 && gap <= 35) return 'monthly'
  if (gap >= 82 && gap <= 99) return 'quarterly'
  return null
}

/**
 * Payees that repeat on a steady schedule with a steady amount: 2+ times monthly
 * (3+ weekly/every-other-week), gaps all near the same length, every amount within
 * 15% of the typical one. Skips payees that already have a rule, transactions marked
 * one-time, and counted (bill / invoice) payments.
 */
export function suggestRecurring(txns: BankTxn[], rules: RecurringRule[], marks: Map<string, string>, today = todayET()): Suggestion[] {
  const ruled = new Set(rules.filter(r => r.active && r.match_key).map(r => r.match_key as string))
  const groups = new Map<string, BankTxn[]>()
  for (const t of txns) {
    if (!t.markable || marks.has(t.key) || ruled.has(t.match_key) || t.match_key.endsWith(':unknown')) continue
    const g = groups.get(t.match_key) ?? []
    g.push(t); groups.set(t.match_key, g)
  }
  const out: Suggestion[] = []
  for (const [key, g] of groups) {
    if (g.length < 2) continue
    const byDate = [...g].sort((a, b) => a.date.localeCompare(b.date))
    const gaps = byDate.slice(1).map((t, i) => daysBetween(byDate[i].date, t.date)).filter(x => x > 0)
    if (gaps.length === 0) continue
    const gap = median(gaps)
    const freq = freqFromGap(gap)
    if (!freq) continue
    if ((freq === 'weekly' || freq === 'biweekly') && byDate.length < 3) continue
    if (gaps.some(x => Math.abs(x - gap) > Math.max(4, gap * 0.25))) continue
    const amt = median(byDate.map(t => t.amount))
    if (byDate.some(t => Math.abs(t.amount - amt) > amt * 0.15)) continue
    const last = byDate[byDate.length - 1]
    out.push({ match_key: key, name: last.name, direction: last.direction, amount: r2(amt), frequency: freq, next_date: nextAfter(last.date, freq, today), count: byDate.length, txn_keys: byDate.map(t => t.key), last_date: last.date })
  }
  return out.sort((a, b) => b.amount * (b.direction === 'out' ? 1 : 0.999) - a.amount * (a.direction === 'out' ? 1 : 0.999))
}

export async function getMarks(): Promise<{ ok: true; marks: Map<string, { mark: string; recurring_id: string | null }> } | { ok: false; error: string }> {
  const { data, error } = await fdb().from('finance_txn_marks').select('txn_key, mark, recurring_id')
  if (error) return { ok: false, error: error.message }
  return { ok: true, marks: new Map((data ?? []).map(m => [String(m.txn_key), { mark: String(m.mark), recurring_id: m.recurring_id ?? null }])) }
}

/** Validate a rule coming from the browser. Returns the clean row or an error message. */
export function cleanRule(b: Row): { ok: true; rule: Omit<RecurringRule, 'id' | 'active' | 'source' | 'match_key'> } | { ok: false; error: string } {
  const name = String(b?.name ?? '').trim().slice(0, 120)
  const direction = b?.direction === 'in' ? 'in' : b?.direction === 'out' ? 'out' : null
  const amount = Math.round(Number(b?.amount) * 100) / 100
  const frequency = FREQUENCIES.includes(b?.frequency) ? (b.frequency as Frequency) : null
  const next = typeof b?.next_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.next_date) ? b.next_date : null
  const tier = TIERS.includes(b?.tier) ? (b.tier as Tier) : 'flexible'
  if (!name) return { ok: false, error: 'Give it a name.' }
  if (!direction) return { ok: false, error: 'Pick money in or money out.' }
  if (!(amount > 0 && amount < 1e10)) return { ok: false, error: 'Amount must be more than $0.' }
  if (!frequency) return { ok: false, error: 'Pick how often it happens.' }
  if (!next) return { ok: false, error: 'Pick the next date it happens.' }
  const dom = frequency === 'weekly' || frequency === 'biweekly' ? null : Number(next.slice(8, 10))
  return { ok: true, rule: { name, direction, amount, frequency, next_date: next, day_of_month: dom, tier: direction === 'in' ? 'flexible' : tier } }
}
