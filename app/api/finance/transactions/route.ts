/**
 * Bank transactions + recurring items — senior admins with Finance unlocked (lib/finance-auth).
 *
 *   GET [?refresh=1]  → { since, accounts, transactions (+ status), suggestions, rules, truncated }
 *   POST { action }:
 *     make_recurring { txn_key, rule }   → new recurring item from a bank transaction (all past
 *                                           transactions from the same payee link to it)
 *     not_recurring  { txn_keys[] }       → mark one-time (hides them from suggestions)
 *     clear          { txn_keys[] }       → undo a mark
 *     add_rule       { rule }             → recurring item typed by hand
 *     update_rule    { id, rule }         → change amount / how often / next date / tier / name
 *     stop_rule      { id }               → stop it (kept for the log, no longer forecast)
 * Every change is written to finance_audit.
 */
import { NextRequest, NextResponse } from 'next/server'
import { audit, clientIp, fdb, requireFinance, setSessionCookie } from '@/lib/finance-auth'
import { cleanRule, getBankTransactions, getMarks, listRules, suggestRecurring, type BankTxn } from '@/lib/finance-bank'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type Status = 'counted' | 'recurring' | 'one_time' | 'suggested' | 'open'

export async function GET(req: NextRequest) {
  const gate = await requireFinance(req)
  if (!gate.ok) return NextResponse.json({ error: gate.error, state: gate.state }, { status: gate.status })
  try {
    const [bank, rules, marks] = await Promise.all([getBankTransactions(req.nextUrl.searchParams.get('refresh') === '1'), listRules(), getMarks()])
    if (!bank.ok) return NextResponse.json({ error: bank.error }, { status: 502 })
    if (!rules.ok) return NextResponse.json({ error: rules.missing ? 'Run migration 221 (finance_recurring) on this database first.' : rules.error }, { status: rules.missing ? 409 : 500 })
    if (!marks.ok) return NextResponse.json({ error: marks.error }, { status: 500 })
    const markOnly = new Map([...marks.marks].map(([k, v]) => [k, v.mark]))
    const suggestions = suggestRecurring(bank.data.transactions, rules.rules, markOnly)
    const suggested = new Set(suggestions.flatMap(s => s.txn_keys))
    const ruleByKey = new Map(rules.rules.filter(r => r.match_key).map(r => [r.match_key as string, r]))
    const transactions = bank.data.transactions.map((t: BankTxn) => {
      const m = marks.marks.get(t.key)
      const rule = ruleByKey.get(t.match_key)
      const status: Status = t.counted_by ? 'counted' : m?.mark === 'one_time' ? 'one_time' : (m?.mark === 'recurring' || rule) ? 'recurring' : suggested.has(t.key) ? 'suggested' : 'open'
      return { ...t, status, recurring_id: m?.recurring_id ?? rule?.id ?? null }
    })
    const res = NextResponse.json({ since: bank.data.since, accounts: bank.data.accounts, truncated: bank.data.truncated, transactions, suggestions, rules: rules.rules })
    setSessionCookie(res, gate.token, gate.idle)
    return res
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Couldn’t read bank transactions.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireFinance(req)
  if (!gate.ok) return NextResponse.json({ error: gate.error, state: gate.state }, { status: gate.status })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body = (await req.json().catch(() => ({}))) as Record<string, any>
  const db = fdb()
  const ip = clientIp(req)
  const now = new Date().toISOString()
  const done = (extra: object = {}) => { const res = NextResponse.json({ ok: true, ...extra }); setSessionCookie(res, gate.token, gate.idle); return res }
  const bad = (error: string, status = 400) => NextResponse.json({ error }, { status })
  const keys = (v: unknown): string[] => (Array.isArray(v) ? v.map(String).filter(k => /^[A-Za-z]+:[\w-]{1,40}$/.test(k)).slice(0, 200) : [])

  try {
    switch (body.action) {
      case 'make_recurring': {
        const key = keys([body.txn_key])[0]
        if (!key) return bad('Pick a transaction.')
        // Re-read the transaction on the server — never trust the browser for which payee / direction it is.
        const bank = await getBankTransactions(false)
        if (!bank.ok) return bad(bank.error, 502)
        const txn = bank.data.transactions.find(t => t.key === key)
        if (!txn) return bad('That transaction isn’t in the last 90 days any more. Refresh and try again.', 404)
        if (!txn.markable) return bad(txn.counted_by === 'bill' ? 'This pays a QuickBooks bill — the outlook already counts the bill.' : 'This is an invoice payment — the outlook already counts the invoice.')
        const c = cleanRule({ ...body.rule, direction: txn.direction })
        if (!c.ok) return bad(c.error)
        const { data: rule, error } = await db.from('finance_recurring').insert({ ...c.rule, match_key: txn.match_key, source: 'bank', active: true, created_by: gate.user.id, updated_by: gate.user.id }).select('id').single()
        if (error || !rule) return bad(error?.message ?? 'Couldn’t save.', 500)
        const same = bank.data.transactions.filter(t => t.markable && t.match_key === txn.match_key).map(t => ({ txn_key: t.key, mark: 'recurring', recurring_id: rule.id, marked_by: gate.user.id, marked_at: now }))
        const { error: mErr } = await db.from('finance_txn_marks').upsert(same, { onConflict: 'txn_key' })
        if (mErr) return bad(mErr.message, 500)
        await audit({ user: gate.user, action: 'recurring_add', target: c.rule.name, detail: { from: key, ...c.rule }, ip })
        return done({ id: rule.id, linked: same.length })
      }
      case 'not_recurring': {
        const ks = keys(body.txn_keys)
        if (!ks.length) return bad('Pick a transaction.')
        const { error } = await db.from('finance_txn_marks').upsert(ks.map(k => ({ txn_key: k, mark: 'one_time', recurring_id: null, marked_by: gate.user.id, marked_at: now })), { onConflict: 'txn_key' })
        if (error) return bad(error.message, 500)
        await audit({ user: gate.user, action: 'txn_one_time', detail: ks, ip })
        return done()
      }
      case 'clear': {
        const ks = keys(body.txn_keys)
        if (!ks.length) return bad('Pick a transaction.')
        const { error } = await db.from('finance_txn_marks').delete().in('txn_key', ks)
        if (error) return bad(error.message, 500)
        await audit({ user: gate.user, action: 'txn_clear', detail: ks, ip })
        return done()
      }
      case 'add_rule': {
        const c = cleanRule(body.rule)
        if (!c.ok) return bad(c.error)
        const { data: rule, error } = await db.from('finance_recurring').insert({ ...c.rule, source: 'manual', active: true, created_by: gate.user.id, updated_by: gate.user.id }).select('id').single()
        if (error || !rule) return bad(error?.message ?? 'Couldn’t save.', 500)
        await audit({ user: gate.user, action: 'recurring_add', target: c.rule.name, detail: c.rule, ip })
        return done({ id: rule.id })
      }
      case 'update_rule': {
        const id = String(body.id ?? '')
        if (!/^[0-9a-f-]{36}$/i.test(id)) return bad('Pick an item.')
        const { data: cur, error: rErr } = await db.from('finance_recurring').select('direction').eq('id', id).maybeSingle()
        if (rErr) return bad(rErr.message, 500)
        if (!cur) return bad('That item is gone.', 404)
        const c = cleanRule({ ...body.rule, direction: cur.direction })
        if (!c.ok) return bad(c.error)
        const { error } = await db.from('finance_recurring').update({ ...c.rule, updated_by: gate.user.id, updated_at: now }).eq('id', id)
        if (error) return bad(error.message, 500)
        await audit({ user: gate.user, action: 'recurring_change', target: c.rule.name, detail: { id, ...c.rule }, ip })
        return done()
      }
      case 'stop_rule': {
        const id = String(body.id ?? '')
        if (!/^[0-9a-f-]{36}$/i.test(id)) return bad('Pick an item.')
        const { data, error } = await db.from('finance_recurring').update({ active: false, updated_by: gate.user.id, updated_at: now }).eq('id', id).select('name')
        if (error) return bad(error.message, 500)
        if (!data?.length) return bad('That item is gone.', 404)
        await audit({ user: gate.user, action: 'recurring_stop', target: data[0].name, detail: { id }, ip })
        return done()
      }
      default:
        return bad('Unknown action.')
    }
  } catch (e) {
    return bad(e instanceof Error ? e.message : 'Couldn’t save.', 500)
  }
}
