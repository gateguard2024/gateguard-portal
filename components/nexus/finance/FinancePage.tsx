'use client'
/**
 * Finance — Gate Guard senior admins only (Admin → Finance). One page, laid out like a
 * CFO / investor cash report, in the same light look as the rest of Admin
 * (components/nexus/systems/shared: .sy styles, Card, Sheet). Behind a second,
 * per-person 6-digit code on top of corporate sign-in (lib/finance-auth.ts).
 *
 * The report, top to bottom:
 *   Headline numbers   cash today · lowest point · 13-week net · customers owe · we owe
 *   Cash position      projected balance per week / month vs the cash floor
 *   Cash flow statement  beginning cash → receipts → disbursements → ending cash, by period
 *   Bills due · Recurring money in & out · Bank activity (last 90 days)
 * Everything you change opens in a pop-up: a period's detail, bills + vendor tiers,
 * recurring items, bank transactions (mark recurring / one-time), settings, codes.
 *
 * Every number comes from /api/finance/* — all of which re-check the code session.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { CSS, Card, Field, Note, Sheet, getJson, send, useFlash, BLUE, GREEN, LINE, MUTED, ORANGE, TEXT, TEXT2, DOT, type Any } from '@/components/nexus/systems/shared'

type Tier = 'must_pay' | 'keeps_running' | 'flexible'
type Freq = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'

const money = (n: unknown) => { const v = Number(n); return isFinite(v) ? v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }) : '—' }
const acct = (n: number) => (Math.abs(n) < 0.005 ? money(0) : n < 0 ? `(${money(-n)})` : money(n))   // accounting style: negatives in brackets
const short = (n: number) => { const a = Math.abs(n); const s = a >= 1e6 ? `$${(a / 1e6).toFixed(2)}M` : a >= 1e3 ? `$${Math.round(a / 1e3)}K` : `$${Math.round(a)}`; return n < 0 ? `−${s}` : s }
const day = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const TIER: Record<Tier, string> = { must_pay: 'Must pay on time', keeps_running: 'Keeps sites running', flexible: 'Flexible' }
const FREQ: Record<Freq, string> = { weekly: 'Every week', biweekly: 'Every other week', monthly: 'Every month', quarterly: 'Every 3 months', yearly: 'Every year' }
const TYPE: Record<string, string> = { Purchase: 'Payment', Deposit: 'Deposit', Transfer: 'Transfer', SalesReceipt: 'Sale', BillPayment: 'Bill paid', Payment: 'Invoice paid' }

const FIN_CSS = `
.fn-lock{max-width:420px;margin:32px auto;background:#fff;border-radius:16px;box-shadow:0 1px 2px rgba(10,20,40,.06),0 8px 24px rgba(10,20,40,.08);padding:28px 26px;display:grid;gap:16px;justify-items:center;text-align:center}
.fn-lock .ic{width:48px;height:48px;border-radius:12px;background:${TEXT};display:flex;align-items:center;justify-content:center}
.fn-lock h2{margin:0;font-size:20px;font-weight:600}
.fn-code{width:100%;height:54px;border:1px solid rgba(0,0,0,.14);border-radius:12px;text-align:center;font:600 26px -apple-system,Inter,sans-serif;letter-spacing:.5em;padding-left:.5em;color:${TEXT}}
.fn-code:focus{outline:2px solid ${BLUE};outline-offset:1px}
.fn-rules{width:100%;text-align:left;border-top:1px solid ${LINE};padding-top:12px;display:grid;gap:5px;font-size:12.5px;color:${MUTED}}
.fn-tbl{width:100%;border-collapse:collapse;font-size:13px;font-variant-numeric:tabular-nums}
.fn-tbl th{font-size:12px;font-weight:500;color:${MUTED};text-align:left;padding:8px 10px;border-bottom:1px solid ${LINE};white-space:nowrap}
.fn-tbl td{padding:8px 10px;border-bottom:1px solid rgba(0,0,0,.05);white-space:nowrap}
.fn-tbl .r{text-align:right}
.fn-tbl tr:last-child td{border-bottom:0}
.fn-st th.r button{background:none;border:0;padding:0;font:inherit;color:${BLUE};cursor:pointer}
.fn-st td:first-child,.fn-st th:first-child{position:sticky;left:0;background:#fff;z-index:1;min-width:210px}
.fn-st .grp td{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:${MUTED};padding-top:14px;border-bottom:0}
.fn-st .sub td:first-child{padding-left:22px;color:${TEXT2}}
.fn-st .tot td{font-weight:600;border-top:1px solid rgba(0,0,0,.14)}
.fn-st .key td{font-weight:600;background:#F7F8FA}
.fn-st .key td:first-child{background:#F7F8FA}
.fn-st .neg{color:${ORANGE}}
.fn-wrap{overflow-x:auto}
.fn-legend{display:flex;flex-wrap:wrap;gap:14px;font-size:12px;color:${MUTED}}
.fn-legend span{display:inline-flex;align-items:center;gap:6px}
.fn-sw{width:10px;height:10px;border-radius:3px;display:inline-block}
.fn-tag{display:inline-flex;align-items:center;padding:2px 8px;border-radius:6px;font-size:11.5px;font-weight:600;white-space:nowrap}
.fn-tag.must_pay{background:${TEXT};color:#fff}.fn-tag.keeps_running{background:#EEF4FF;color:#0058B0}.fn-tag.flexible{background:#F2F2F7;color:${TEXT2}}
.fn-tag.in{background:#E8F6EC;color:${GREEN}}.fn-tag.out{background:#F2F2F7;color:${TEXT2}}
.fn-tag.suggested{background:#FFF4E5;color:${ORANGE}}.fn-tag.recurring{background:#EEF4FF;color:#0058B0}.fn-tag.counted{background:#F2F2F7;color:${MUTED}}.fn-tag.one_time{background:#F2F2F7;color:${MUTED}}
.fn-sel{height:30px;border:1px solid rgba(0,0,0,.12);border-radius:8px;padding:0 8px;font:500 12.5px -apple-system,Inter,sans-serif;background:#fff;color:${TEXT}}
.fn-unl{display:inline-flex;align-items:center;gap:7px;height:30px;padding:0 12px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);color:#fff;font-size:13px;font-weight:500}
.fn-two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.fn-in{color:${GREEN}}
@media (max-width:900px){.fn-two{grid-template-columns:1fr}}
`

// ── Lock card ────────────────────────────────────────────────────────────────
function LockCard({ status, me, onChange }: { status: Any; me: string; onChange: () => void }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const first = status.state === 'no_code' && status.owner
  const canType = status.state === 'locked' || first
  const submit = async () => {
    setBusy(true); setMsg(null)
    if (first) {
      const r = await send('/api/finance/codes', 'POST', { email: me, code })
      if (!r.ok) { setMsg(r.data.error ?? 'Couldn’t save your code.'); setBusy(false); return }
    }
    const r = await send('/api/finance/unlock', 'POST', { code })
    setBusy(false)
    if (r.ok) { onChange(); return }
    setMsg(`${r.data.error ?? 'Couldn’t unlock.'}${typeof r.data.tries_left === 'number' ? ` ${r.data.tries_left} ${r.data.tries_left === 1 ? 'try' : 'tries'} left.` : ''}`)
    setCode('')
    if (r.status === 423) onChange()
  }
  const title = status.state === 'locked_out' ? 'Finance is locked for now' : first ? 'Set your Finance code' : status.state === 'no_code' ? 'You don’t have a Finance code' : 'Finance is locked'
  const sub = status.state === 'locked_out' ? `Too many wrong tries. Try again after ${new Date(status.until).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}.`
    : first ? 'You’re the owner. Pick a 6-digit code. You’ll enter it every time you open Finance, and then you can set codes for other senior admins.'
      : status.state === 'no_code' ? 'Ask the owner to set one for you.'
        : 'Enter your 6-digit senior admin code to see cash, bills and payroll.'
  return (
    <form className="fn-lock" onSubmit={e => { e.preventDefault(); if (code.length === 6) void submit() }}>
      <span className="ic" aria-hidden><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg></span>
      <div><h2>{title}</h2><div style={{ color: MUTED, fontSize: 13, marginTop: 6, lineHeight: 1.45 }}>{sub}</div></div>
      {canType && <>
        <input className="fn-code" aria-label={first ? 'New 6-digit code' : '6-digit code'} autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
        <button type="submit" className="sy-b pri" style={{ width: '100%', height: 42 }} disabled={busy || code.length !== 6}>{busy ? 'Checking…' : first ? 'Save my code' : 'Unlock Finance'}</button>
      </>}
      {msg && <div style={{ width: '100%' }}><Note tone="red">{msg}</Note></div>}
      <div className="fn-rules"><div>· Locks again after a few minutes without use.</div><div>· 5 wrong tries locks you out for 30 minutes.</div><div>· Every unlock and every change is logged.</div></div>
    </form>
  )
}

// ── Chart ────────────────────────────────────────────────────────────────────
function CashChart({ buckets, floor, onPick }: { buckets: Any[]; floor: number; onPick: (i: number) => void }) {
  const W = 1000, H = 260, base = 220, top = 26, left = 54
  const vals = buckets.map(b => Number(b.end_balance) || 0)
  const max = Math.max(floor, ...vals, 1), min = Math.min(0, ...vals), span = max - min || 1
  const y = (v: number) => base - ((v - min) / span) * (base - top)
  const slot = (W - left - 10) / buckets.length, bw = Math.min(54, slot * 0.7)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Projected balance; lowest ${money(Math.min(...vals))}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <g fontFamily="-apple-system,Inter,sans-serif" fontSize="11" fill={MUTED}>
        <line x1={left} y1={y(0)} x2={W - 10} y2={y(0)} stroke="rgba(0,0,0,.15)" />
        <text x="0" y={y(max) + 4}>{short(max)}</text>
        {min < 0 && <text x="0" y={y(min) + 4}>{short(min)}</text>}
        {buckets.map((b, i) => {
          const v = Number(b.end_balance) || 0
          const x = left + i * slot + (slot - bw) / 2
          const y0 = y(Math.max(v, 0)), y1 = y(Math.min(v, 0))
          const low = b.below_floor || v < 0
          return (
            <g key={b.start} onClick={() => onPick(i)} style={{ cursor: 'pointer' }}>
              <rect x={x - 4} y={top} width={bw + 8} height={base - top} fill="transparent" />
              <rect x={x} y={y0} width={bw} height={Math.max(1, y1 - y0)} rx="4" fill={low ? DOT.orange : BLUE}><title>{`${b.label}: ${money(v)}`}</title></rect>
              {(low || i === 0 || i === buckets.length - 1) && <text x={x + bw / 2} y={y0 - 6} textAnchor="middle" fill={low ? ORANGE : TEXT} fontWeight={low ? 600 : 400}>{short(v)}</text>}
              <text x={x + bw / 2} y={base + 20} textAnchor="middle">{String(b.label).replace('Week of ', '').replace(/ \d{4}$/, '')}</text>
            </g>
          )
        })}
        {floor > 0 && <line x1={left} y1={y(floor)} x2={W - 10} y2={y(floor)} stroke={TEXT} strokeWidth="1.5" strokeDasharray="6 5" />}
      </g>
    </svg>
  )
}

// ── Cash flow statement ──────────────────────────────────────────────────────
const RECEIPTS: [string, (i: Any) => boolean][] = [
  ['Customer invoices', i => i.source === 'qbo_invoice'],
  ['Monthly site billing', i => i.source === 'site_billing'],
  ['Other recurring receipts', i => i.source === 'recurring' && i.amount > 0],
]
const DISBURSEMENTS: [string, (i: Any) => boolean][] = [
  ['Payroll', i => i.source === 'payroll'],
  ['Vendor bills', i => i.source === 'qbo_bill'],
  ['Recurring costs', i => i.source === 'recurring' && i.amount < 0],
  ['Purchase orders', i => i.source === 'purchase_order'],
]
function Statement({ buckets, cashToday, floor, onPick }: { buckets: Any[]; cashToday: number; floor: number; onPick: (i: number) => void }) {
  const sum = (b: Any, f: (i: Any) => boolean) => (b.items as Any[]).filter(f).reduce((s, i) => s + Math.abs(i.amount), 0)
  const begin = buckets.map((_, i) => (i === 0 ? cashToday : Number(buckets[i - 1].end_balance)))
  const total = (row: (b: Any, i: number) => number) => buckets.reduce((s, b, i) => s + row(b, i), 0)
  const line = (label: string, row: (b: Any, i: number) => number, cls = '', showTotal = true, neg = false) => (
    <tr className={cls} key={label}>
      <td>{label}</td>
      {buckets.map((b, i) => { const v = row(b, i); return <td key={b.start} className={`r${v < 0 ? ' neg' : ''}`}>{v === 0 && cls === 'sub' ? '—' : neg ? acct(-v) : acct(v)}</td> })}
      <td className="r" style={{ fontWeight: 600 }}>{showTotal ? (neg ? acct(-total(row)) : acct(total(row))) : ''}</td>
    </tr>
  )
  const rIn = (b: Any) => (b.items as Any[]).filter(i => i.amount > 0).reduce((s, i) => s + i.amount, 0)
  const rOut = (b: Any) => (b.items as Any[]).filter(i => i.amount < 0).reduce((s, i) => s - i.amount, 0)
  return (
    <div className="fn-wrap">
      <table className="fn-tbl fn-st">
        <thead><tr><th>{buckets.length > 12 ? 'Week beginning' : 'Month'}</th>{buckets.map((b, i) => <th key={b.start} className="r"><button type="button" onClick={() => onPick(i)} aria-label={`Details for ${b.label}`}>{String(b.label).replace('Week of ', '')}</button></th>)}<th className="r">Total</th></tr></thead>
        <tbody>
          {line('Beginning cash', (_, i) => begin[i], 'key', false)}
          <tr className="grp"><td colSpan={buckets.length + 2}>Cash receipts</td></tr>
          {RECEIPTS.map(([label, f]) => line(label, b => sum(b, f), 'sub'))}
          {line('Total receipts', rIn, 'tot')}
          <tr className="grp"><td colSpan={buckets.length + 2}>Cash disbursements</td></tr>
          {DISBURSEMENTS.map(([label, f]) => line(label, b => sum(b, f), 'sub', true, true))}
          {line('Total disbursements', rOut, 'tot', true, true)}
          {line('Net cash flow', b => rIn(b) - rOut(b), 'tot')}
          {line('Ending cash', b => Number(b.end_balance), 'key', false)}
          {floor > 0 && line('Over / (under) cash floor', b => Number(b.end_balance) - floor, '', false)}
        </tbody>
      </table>
    </div>
  )
}

// ── Pop-ups ──────────────────────────────────────────────────────────────────
function PeriodSheet({ b, onClose }: { b: Any; onClose: () => void }) {
  const items = b.items as Any[]
  return (
    <Sheet title={b.label} sub={`Ends at ${money(b.end_balance)} · in ${money(b.in)} · out ${money(b.out)}`} onClose={onClose} width={720}>
      {items.length === 0 ? <Note>Nothing moves in this period.</Note> : (
        <div className="fn-wrap"><table className="fn-tbl">
          <thead><tr><th>Date</th><th>Item</th><th>How sure</th><th className="r">Amount</th></tr></thead>
          <tbody>{items.map((it, i) => (
            <tr key={`${it.source}-${it.ref ?? it.recurring_id ?? i}-${it.date}`}>
              <td>{day(it.date)}</td><td style={{ whiteSpace: 'normal' }}>{it.label}</td>
              <td style={{ color: MUTED }}>{it.certainty === 'known' ? 'Known' : it.certainty === 'expected' ? 'Expected' : 'Estimate'}</td>
              <td className={`r${it.amount > 0 ? ' fn-in' : ''}`}>{it.amount > 0 ? '+' : '−'}{money(Math.abs(it.amount))}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </Sheet>
  )
}

function BillsSheet({ bills, onTier, onClose }: { bills: Any[]; onTier: (id: string, name: string, t: Tier) => void; onClose: () => void }) {
  const [f, setF] = useState<Tier | 'all'>('all')
  const shown = f === 'all' ? bills : bills.filter(b => b.tier === f)
  return (
    <Sheet title="Bills" sub="Open bills in QuickBooks, by due date. Set each vendor’s tier once; new bills from them follow it." onClose={onClose} width={860}>
      <div className="sy-chips" role="group" aria-label="Filter by tier">
        {(['all', 'must_pay', 'keeps_running', 'flexible'] as const).map(k => <button key={k} type="button" className="sy-chip" aria-pressed={f === k} onClick={() => setF(k)}>{k === 'all' ? `All ${bills.length}` : `${TIER[k]} ${bills.filter(b => b.tier === k).length}`}</button>)}
      </div>
      {shown.length === 0 ? <Note>No open bills{f !== 'all' ? ' in this tier' : ''}.</Note> : (
        <div className="fn-wrap"><table className="fn-tbl">
          <thead><tr><th>Vendor</th><th>Bill</th><th>Due</th><th className="r">Amount</th><th>Tier</th></tr></thead>
          <tbody>{shown.map(b => (
            <tr key={b.qbo_id}>
              <td style={{ fontWeight: 600 }}>{b.vendor}</td><td style={{ color: MUTED }}>{b.doc ?? '—'}</td>
              <td style={{ color: b.overdue ? ORANGE : TEXT, fontWeight: b.overdue ? 600 : 400 }}>{day(b.due_date)}{b.overdue ? ` · ${-b.days_to_due} d late` : ''}</td>
              <td className="r">{money(b.balance)}</td>
              <td>{b.vendor_id ? <select className="fn-sel" aria-label={`Tier for ${b.vendor}`} value={b.tier} onChange={e => onTier(b.vendor_id, b.vendor, e.target.value as Tier)}>{(Object.keys(TIER) as Tier[]).map(t => <option key={t} value={t}>{TIER[t]}</option>)}</select> : <span className={`fn-tag ${b.tier}`}>{TIER[b.tier as Tier]}</span>}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </Sheet>
  )
}

function RuleSheet({ title, sub, initial, direction, onSave, onClose }: { title: string; sub?: string; initial: Any; direction: 'in' | 'out' | null; onSave: (rule: Any) => Promise<string | null>; onClose: () => void }) {
  const [r, setR] = useState<Any>({ tier: 'flexible', frequency: 'monthly', ...initial, direction: direction ?? initial.direction ?? 'out' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const set = (k: string, v: unknown) => setR(p => ({ ...p, [k]: v }))
  const save = async () => { setBusy(true); setErr(null); const e = await onSave({ ...r, amount: Number(r.amount) }); setBusy(false); if (e) setErr(e) }
  return (
    <Sheet title={title} sub={sub} onClose={onClose} width={520} locked={busy}>
      <Field label="Name"><input className="sy-in" value={r.name ?? ''} onChange={e => set('name', e.target.value)} /></Field>
      <div className="sy-grid2">
        <Field label="Money in or out">{direction ? <div className="sy-in" style={{ display: 'flex', alignItems: 'center', color: MUTED }}>{direction === 'in' ? 'Money in' : 'Money out'}</div> : <select className="sy-in" value={r.direction} onChange={e => set('direction', e.target.value)}><option value="out">Money out</option><option value="in">Money in</option></select>}</Field>
        <Field label="Amount each time"><input className="sy-in" type="number" min={0} step="0.01" value={r.amount ?? ''} onChange={e => set('amount', e.target.value)} /></Field>
        <Field label="How often"><select className="sy-in" value={r.frequency} onChange={e => set('frequency', e.target.value)}>{(Object.keys(FREQ) as Freq[]).map(f => <option key={f} value={f}>{FREQ[f]}</option>)}</select></Field>
        <Field label="Next time"><input className="sy-in" type="date" value={r.next_date ?? ''} onChange={e => set('next_date', e.target.value)} /></Field>
      </div>
      {r.direction === 'out' && <Field label="Tier"><select className="sy-in" value={r.tier} onChange={e => set('tier', e.target.value)}>{(Object.keys(TIER) as Tier[]).map(t => <option key={t} value={t}>{TIER[t]}</option>)}</select></Field>}
      {err && <Note tone="red">{err}</Note>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button type="button" className="sy-b line" onClick={onClose} disabled={busy}>Cancel</button><button type="button" className="sy-b pri" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></div>
    </Sheet>
  )
}

function RecurringSheet({ rules, onEdit, onAdd, onStop, onClose }: { rules: Any[]; onEdit: (r: Any) => void; onAdd: () => void; onStop: (r: Any) => void; onClose: () => void }) {
  const monthly = (r: Any) => r.amount * ({ weekly: 52 / 12, biweekly: 26 / 12, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 } as Record<string, number>)[r.frequency]
  const out = rules.filter(r => r.direction === 'out'), inn = rules.filter(r => r.direction === 'in')
  return (
    <Sheet title="Recurring money in & out" sub={`About ${money(out.reduce((s, r) => s + monthly(r), 0))} a month out · ${money(inn.reduce((s, r) => s + monthly(r), 0))} a month in`} onClose={onClose} width={820}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}><div style={{ fontSize: 13, color: MUTED }}>Made from bank transactions or added by hand. Each one is in the cash outlook.</div><button type="button" className="sy-b pri sm" onClick={onAdd}>+ Add one</button></div>
      {rules.length === 0 ? <Note>Nothing yet. Open Bank activity and mark the payments that repeat.</Note> : (
        <div className="fn-wrap"><table className="fn-tbl">
          <thead><tr><th>Name</th><th></th><th className="r">Amount</th><th>How often</th><th>Next</th><th>Tier</th><th></th></tr></thead>
          <tbody>{rules.map(r => (
            <tr key={r.id}>
              <td style={{ fontWeight: 600 }}>{r.name}</td>
              <td><span className={`fn-tag ${r.direction}`}>{r.direction === 'in' ? 'In' : 'Out'}</span></td>
              <td className="r">{money(r.amount)}</td><td>{FREQ[r.frequency as Freq]}</td><td>{day(r.next_date)}</td>
              <td>{r.direction === 'out' ? <span className={`fn-tag ${r.tier}`}>{TIER[r.tier as Tier]}</span> : '—'}</td>
              <td className="r" style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}><button type="button" className="sy-b blue sm" onClick={() => onEdit(r)}>Change</button><button type="button" className="sy-b warn sm" onClick={() => onStop(r)}>Stop</button></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </Sheet>
  )
}

function BankSheet({ bank, onRecurring, onOneTime, onClear, onClose, onRefresh, busy }: { bank: Any; onRecurring: (t: Any, s?: Any) => void; onOneTime: (keys: string[]) => void; onClear: (keys: string[]) => void; onClose: () => void; onRefresh: () => void; busy: boolean }) {
  const [f, setF] = useState<'decide' | 'out' | 'in' | 'all'>('decide')
  const [q, setQ] = useState('')
  const txns: Any[] = bank.transactions ?? []
  const sugByKey = useMemo(() => { const m = new Map<string, Any>(); for (const s of bank.suggestions ?? []) for (const k of s.txn_keys) m.set(k, s); return m }, [bank.suggestions])
  const shown = txns.filter(t => (f === 'all' || (f === 'decide' ? (t.status === 'suggested' || t.status === 'open') : t.direction === f)) && (!q || `${t.name} ${t.memo ?? ''}`.toLowerCase().includes(q.toLowerCase())))
  const undecided = txns.filter(t => t.status === 'suggested' || t.status === 'open').length
  return (
    <Sheet title="Bank activity" sub={`Last 90 days in ${(bank.accounts ?? []).map((a: Any) => a.name).join(', ') || 'your bank accounts'}, as recorded in QuickBooks`} onClose={onClose} width={980}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="sy-chips" role="group" aria-label="Show">
          {([['decide', `To decide ${undecided}`], ['out', 'Money out'], ['in', 'Money in'], ['all', `All ${txns.length}`]] as const).map(([k, l]) => <button key={k} type="button" className="sy-chip" aria-pressed={f === k} onClick={() => setF(k)}>{l}</button>)}
        </div>
        <label style={{ flex: '1 1 200px' }}><span className="sy-lbl" style={{ position: 'absolute', left: -9999 }}>Search</span><input className="sy-in" placeholder="Search payee or memo" value={q} onChange={e => setQ(e.target.value)} /></label>
        <button type="button" className="sy-b line sm" onClick={onRefresh} disabled={busy}>{busy ? 'Reading…' : 'Refresh from QuickBooks'}</button>
      </div>
      {bank.truncated && <Note tone="orange">QuickBooks returned 1,000 of one kind of transaction — only those are shown.</Note>}
      {(bank.suggestions ?? []).length > 0 && f === 'decide' && (
        <Card title="Looks recurring" sub="Same payee, a steady amount, at a steady gap">
          {(bank.suggestions as Any[]).map(s => (
            <div key={s.match_key} className="sy-row">
              <div className="main"><div className="t">{s.name}</div><div className="m">About {money(s.amount)} {FREQ[s.frequency as Freq].toLowerCase()} · seen {s.count} times · last {day(s.last_date)}</div></div>
              <span className={`fn-tag ${s.direction}`}>{s.direction === 'in' ? 'In' : 'Out'}</span>
              <button type="button" className="sy-b pri sm" onClick={() => { const t = txns.find(x => x.key === s.txn_keys[s.txn_keys.length - 1]); if (t) onRecurring(t, s) }}>Make recurring</button>
              <button type="button" className="sy-b line sm" onClick={() => onOneTime(s.txn_keys)}>Not recurring</button>
            </div>
          ))}
        </Card>
      )}
      {shown.length === 0 ? <Note>{f === 'decide' ? 'Nothing left to decide.' : 'No transactions match.'}</Note> : (
        <div className="fn-wrap"><table className="fn-tbl">
          <thead><tr><th>Date</th><th>Payee</th><th>Type</th><th className="r">Amount</th><th>Status</th><th></th></tr></thead>
          <tbody>{shown.map(t => (
            <tr key={t.key}>
              <td>{day(t.date)}</td>
              <td style={{ whiteSpace: 'normal', minWidth: 200 }}><div style={{ fontWeight: 600 }}>{t.name}</div>{t.memo && <div style={{ fontSize: 12, color: MUTED }}>{t.memo}</div>}</td>
              <td style={{ color: MUTED }}>{TYPE[t.type] ?? t.type}</td>
              <td className={`r${t.direction === 'in' ? ' fn-in' : ''}`}>{t.direction === 'in' ? '+' : '−'}{money(t.amount)}</td>
              <td>{t.status === 'counted' ? <span className="fn-tag counted" title="The outlook already counts this bill or invoice">{t.counted_by === 'bill' ? 'From a bill' : 'From an invoice'}</span>
                : t.status === 'recurring' ? <span className="fn-tag recurring">Recurring</span>
                  : t.status === 'one_time' ? <span className="fn-tag one_time">One-time</span>
                    : t.status === 'suggested' ? <span className="fn-tag suggested">Looks recurring</span> : <span style={{ color: MUTED, fontSize: 12 }}>Not decided</span>}</td>
              <td className="r">{t.markable && (t.status === 'open' || t.status === 'suggested') && <span style={{ display: 'inline-flex', gap: 6 }}><button type="button" className="sy-b blue sm" onClick={() => onRecurring(t, sugByKey.get(t.key))}>Recurring</button><button type="button" className="sy-b line sm" onClick={() => onOneTime([t.key])}>One-time</button></span>}
                {t.status === 'one_time' && <button type="button" className="sy-b line sm" onClick={() => onClear([t.key])}>Undo</button>}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      <div style={{ fontSize: 12, color: MUTED }}>Bill payments and invoice payments can’t be made recurring — the outlook already counts those bills and invoices. Card charges show up when the card is paid from the bank.</div>
    </Sheet>
  )
}

function SettingsSheet({ onSaved, onClose }: { onSaved: () => void; onClose: () => void }) {
  const [s, setS] = useState<Any | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { void (async () => { const r = await getJson('/api/finance/settings'); if (r.ok) setS(r.data.settings); else setErr(r.data.error ?? 'Couldn’t load settings.') })() }, [])
  const set = (k: string, v: unknown) => setS(p => ({ ...(p ?? {}), [k]: v }))
  const save = async () => {
    if (!s) return
    setBusy(true); setErr(null)
    const r = await send('/api/finance/settings', 'PUT', { cash_floor: Number(s.cash_floor) || 0, idle_minutes: Number(s.idle_minutes) || 15, collect_lag_days: Number(s.collect_lag_days) || 0, payroll_amount: Number(s.payroll_amount) || 0, payroll_frequency: s.payroll_frequency, payroll_next_date: s.payroll_next_date || null })
    setBusy(false)
    if (r.ok) { onSaved(); onClose() } else setErr(r.data.error ?? 'Couldn’t save.')
  }
  return (
    <Sheet title="Finance settings" sub="Every change is logged." onClose={onClose} width={620} locked={busy}>
      {!s ? (err ? <Note tone="red">{err}</Note> : <div className="sy-empty">Loading…</div>) : <>
        <div className="sy-grid2">
          <Field label="Cash floor (weeks below it show in orange)"><input className="sy-in" type="number" min={0} step={1000} value={s.cash_floor ?? 0} onChange={e => set('cash_floor', e.target.value)} /></Field>
          <Field label="Lock after this many idle minutes (5–60)"><input className="sy-in" type="number" min={5} max={60} value={s.idle_minutes ?? 15} onChange={e => set('idle_minutes', e.target.value)} /></Field>
          <Field label="Days after the 1st site billing usually arrives"><input className="sy-in" type="number" min={0} max={120} value={s.collect_lag_days ?? 15} onChange={e => set('collect_lag_days', e.target.value)} /></Field>
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>Payroll</div>
        <div className="sy-grid2">
          <Field label="Amount per run (incl. employer taxes)"><input className="sy-in" type="number" min={0} step={100} value={s.payroll_amount ?? 0} onChange={e => set('payroll_amount', e.target.value)} /></Field>
          <Field label="How often"><select className="sy-in" value={s.payroll_frequency ?? 'biweekly'} onChange={e => set('payroll_frequency', e.target.value)}><option value="weekly">Every week</option><option value="biweekly">Every other week</option><option value="semimonthly">15th and last day</option><option value="monthly">Once a month</option></select></Field>
          <Field label="Next pay date"><input className="sy-in" type="date" value={s.payroll_next_date ?? ''} onChange={e => set('payroll_next_date', e.target.value)} /></Field>
        </div>
        <Note>Rent, software and other repeating costs are set in <b>Recurring money in &amp; out</b>, or straight from Bank activity.</Note>
        {err && <Note tone="red">{err}</Note>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button type="button" className="sy-b line" onClick={onClose} disabled={busy}>Cancel</button><button type="button" className="sy-b pri" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></div>
      </>}
    </Sheet>
  )
}

function CodesSheet({ me, onSelfReset, onClose }: { me: string; onSelfReset: () => void; onClose: () => void }) {
  const [people, setPeople] = useState<Any[] | null>(null)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState<{ tone: 'green' | 'red'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => { const r = await getJson('/api/finance/codes'); if (r.ok) setPeople(r.data.people ?? []); else setMsg({ tone: 'red', text: r.data.error ?? 'Couldn’t load.' }) }, [])
  useEffect(() => { void load() }, [load])
  const save = async () => {
    setBusy(true); setMsg(null)
    const r = await send('/api/finance/codes', 'POST', { email, code })
    setBusy(false)
    if (!r.ok) { setMsg({ tone: 'red', text: r.data.error ?? 'Couldn’t save.' }); return }
    if (email.trim().toLowerCase() === me.toLowerCase()) { onSelfReset(); return }
    setMsg({ tone: 'green', text: `Code saved for ${email}. Tell them in person or by phone — never by email or text.` }); setEmail(''); setCode(''); void load()
  }
  const remove = async (e: string) => {
    if (!window.confirm(`Remove Finance access for ${e}?`)) return
    const r = await send('/api/finance/codes', 'DELETE', { email: e })
    if (r.ok) void load(); else setMsg({ tone: 'red', text: r.data.error ?? 'Couldn’t remove.' })
  }
  return (
    <Sheet title="Finance codes" sub="Only the owner sees this. Resetting someone’s code signs them out of Finance." onClose={onClose} width={720}>
      <div className="sy-grid2">
        <Field label="Their Nexus email (corporate admin)"><input className="sy-in" type="email" value={email} onChange={e => setEmail(e.target.value)} /></Field>
        <Field label="6-digit code"><input className="sy-in" inputMode="numeric" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} /></Field>
      </div>
      <div><button type="button" className="sy-b pri" onClick={save} disabled={busy || !email.trim() || code.length !== 6}>{busy ? 'Saving…' : 'Save code'}</button></div>
      {msg && <Note tone={msg.tone}>{msg.text}</Note>}
      {!people ? <div className="sy-empty">Loading…</div> : people.map(p => {
        const out = p.locked_until && new Date(p.locked_until).getTime() > Date.now()
        return (
          <div key={p.email} className="sy-row">
            <div className="main"><div className="t">{p.name ?? p.email}</div><div className="m">{p.email} · {!p.active ? 'Removed' : out ? 'Locked out (wrong tries)' : 'Active'} · last unlock {p.last_unlock_at ? new Date(p.last_unlock_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'never'}</div></div>
            {p.active && p.email.toLowerCase() !== me.toLowerCase() && <button type="button" className="sy-b warn sm" onClick={() => remove(p.email)}>Remove</button>}
          </div>
        )
      })}
    </Sheet>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
type Pop = { k: 'period'; i: number } | { k: 'bills' } | { k: 'recurring' } | { k: 'bank' } | { k: 'settings' } | { k: 'codes' }
  | { k: 'rule'; mode: 'add' | 'edit' | 'from_txn'; initial: Any; txn?: Any; rule?: Any }

export function FinancePage({ onClose, myEmail }: { onClose: () => void; myEmail: string }) {
  const [flash, notify] = useFlash()
  const [status, setStatus] = useState<Any | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [o, setO] = useState<Any | null>(null)
  const [oErr, setOErr] = useState<string | null>(null)
  const [bank, setBank] = useState<Any | null>(null)
  const [bankErr, setBankErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [view, setView] = useState<'weeks' | 'months'>('weeks')
  const [pop, setPop] = useState<Pop | null>(null)
  const [now, setNow] = useState(Date.now())

  const loadStatus = useCallback(async () => {
    const r = await getJson('/api/finance/session')
    if (r.ok) { setStatus(r.data); setErr(null) } else { setStatus(null); setErr(r.status === 403 ? 'Finance is for Gate Guard senior admins only.' : r.data.error ?? 'Couldn’t check Finance.') }
  }, [])
  const relock = useCallback(() => { setO(null); setBank(null); setPop(null); void loadStatus() }, [loadStatus])
  const loadAll = useCallback(async (refresh = false) => {
    setBusy(true)
    const qs = refresh ? '?refresh=1' : ''
    // One after the other, not together: QuickBooks throttles a company that asks for too much at once.
    const a = await getJson(`/api/finance/outlook${qs}`)
    if (a.status === 401) { setBusy(false); relock(); return }
    if (a.ok) { setO(a.data); setOErr(null) } else setOErr(a.data.error ?? 'Couldn’t build the outlook.')
    const b = await getJson(`/api/finance/transactions${qs}`)
    setBusy(false)
    if (b.status === 401) { relock(); return }
    if (b.ok) { setBank(b.data); setBankErr(null) } else setBankErr(b.data.error ?? 'Couldn’t read bank transactions.')
    void loadStatus()
  }, [relock, loadStatus])

  useEffect(() => { void loadStatus() }, [loadStatus])
  const unlocked = status?.state === 'unlocked'
  useEffect(() => { if (unlocked && !o) void loadAll() }, [unlocked]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t) }, [])
  const expiresAt = unlocked ? new Date(status!.expires_at).getTime() : 0
  useEffect(() => { if (unlocked && expiresAt && now >= expiresAt) relock() }, [now, expiresAt, unlocked, relock])

  const act = async (path: string, method: string, body: Any, ok: string): Promise<string | null> => {
    const r = await send(path, method, body)
    if (r.status === 401) { relock(); return 'Finance locked.' }
    if (!r.ok) return r.data.error ?? 'Couldn’t save.'
    notify(ok); void loadAll()
    return null
  }
  const setTier = (id: string, name: string, tier: Tier) => { void act('/api/finance/settings', 'PUT', { vendor: { id, name, tier } }, `${name}: ${TIER[tier]}`).then(e => { if (e) notify(e, false) }) }
  const oneTime = (keys: string[]) => { void act('/api/finance/transactions', 'POST', { action: 'not_recurring', txn_keys: keys }, keys.length > 1 ? 'Marked not recurring' : 'Marked one-time').then(e => { if (e) notify(e, false) }) }
  const clear = (keys: string[]) => { void act('/api/finance/transactions', 'POST', { action: 'clear', txn_keys: keys }, 'Undone').then(e => { if (e) notify(e, false) }) }
  const stop = (r: Any) => { if (!window.confirm(`Stop “${r.name}”? It leaves the outlook.`)) return; void act('/api/finance/transactions', 'POST', { action: 'stop_rule', id: r.id }, `Stopped ${r.name}`).then(e => { if (e) notify(e, false) }) }
  const fromTxn = (t: Any, s?: Any) => setPop({ k: 'rule', mode: 'from_txn', txn: t, initial: { name: t.name, amount: s?.amount ?? t.amount, frequency: s?.frequency ?? 'monthly', next_date: s?.next_date ?? '', tier: 'flexible', direction: t.direction } })
  const lockNow = async () => { await send('/api/finance/lock', 'POST'); relock() }

  const buckets: Any[] = o ? (view === 'weeks' ? o.weeks : o.months) : []
  const lowest = o ? (view === 'weeks' ? o.lowest_week : o.lowest_month) : null
  const net13 = o ? (o.weeks as Any[]).reduce((s, w) => s + w.in - w.out, 0) : 0
  const below = buckets.filter(b => b.below_floor)
  const minsLeft = unlocked ? Math.max(0, Math.ceil((expiresAt - now) / 60000)) : 0
  const asOf = o ? new Date(o.as_of).toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''
  const rules: Any[] = bank?.rules ?? []
  const bills: Any[] = o?.pay_plan ?? []
  const in28 = bills.filter(b => b.days_to_due <= 28)
  const undecided = (bank?.transactions ?? []).filter((t: Any) => t.status === 'suggested' || t.status === 'open').length

  return (
    <section className="sy">
      <style>{CSS}{FIN_CSS}</style>
      <header className="sy-hd">
        <div>
          <button type="button" className="sy-back" onClick={onClose}>‹ Admin</button>
          <h1>Finance</h1>
          <div className="sub">{unlocked && o ? `Cash report as of ${asOf} · QuickBooks + Nexus` : 'Cash coming in and going out, and when to pay what. Senior admins only.'}</div>
        </div>
        {unlocked && (
          <div className="sy-acts">
            <span className="fn-unl"><span className="sy-dot" style={{ background: DOT.green }} />Unlocked · {minsLeft} min</span>
            <button type="button" className="sy-b dark" onClick={() => loadAll(true)} disabled={busy}>{busy ? 'Refreshing…' : 'Refresh'}</button>
            <button type="button" className="sy-b dark" onClick={() => setPop({ k: 'settings' })}>Settings</button>
            {status?.owner && <button type="button" className="sy-b dark" onClick={() => setPop({ k: 'codes' })}>Codes</button>}
            <button type="button" className="sy-b dark" onClick={lockNow}>Lock</button>
          </div>
        )}
      </header>

      {err ? <Note tone="red">{err}</Note> : !status ? <div className="sy-empty">Checking…</div> : !unlocked ? (
        <LockCard status={status} me={myEmail} onChange={() => void loadStatus()} />
      ) : oErr ? <Note tone="red">{oErr} <button type="button" className="sy-b line sm" onClick={() => loadAll(true)}>Try again</button></Note>
        : !o ? <div className="sy-empty">Reading QuickBooks and Nexus…</div> : (
          <div className="sy-stack">
            {/* Headline numbers */}
            <div className="sy-kpis" style={{ marginBottom: 0 }}>
              <div className="sy-kpi" title="The balance booked in QuickBooks. The bank's own balance (QuickBooks Banking › Bank balance) isn't available to other apps."><div className="l">Cash in QuickBooks</div><div className="v">{money(o.cash_today)}</div><div className="s">Book balance · {(o.cash_accounts ?? []).length} bank account{(o.cash_accounts ?? []).length === 1 ? '' : 's'}</div></div>
              <div className="sy-kpi"><div className="l">{o.floor > 0 && lowest && lowest.balance < o.floor && <span className="sy-dot" style={{ background: DOT.orange }} />}Lowest point · 13 weeks</div><div className="v" style={{ color: o.floor > 0 && o.lowest_week && o.lowest_week.balance < o.floor ? ORANGE : TEXT }}>{money(o.lowest_week?.balance)}</div><div className="s">{o.lowest_week?.label}</div></div>
              <div className="sy-kpi"><div className="l">Net cash flow · 13 weeks</div><div className="v" style={{ color: net13 < 0 ? ORANGE : TEXT }}>{acct(net13)}</div><div className="s">In {money((o.weeks as Any[]).reduce((s, w) => s + w.in, 0))} · out {money((o.weeks as Any[]).reduce((s, w) => s + w.out, 0))}</div></div>
              <div className="sy-kpi"><div className="l">Customers owe us</div><div className="v">{money(o.receivable_total)}</div><div className="s">{(o.left_out ?? []).length ? `${money((o.left_out as Any[]).reduce((s, x) => s + x.amount, 0))} is 60+ days late` : 'Open invoices'}</div></div>
              <button type="button" className="sy-kpi" onClick={() => setPop({ k: 'bills' })}><div className="l">We owe (bills)</div><div className="v">{money(o.payable_total)}</div><div className="s">{money(in28.reduce((s, b) => s + b.balance, 0))} due in 4 weeks</div></button>
            </div>

            {below.length > 0 && <Note tone="orange"><b>{below.length === 1 ? `Tight: ${below[0].label}.` : `Tight: ${below.length} ${view} under your floor.`}</b> Lowest {money(lowest?.balance)} ({lowest?.label}), {money(o.floor - (lowest?.balance ?? 0))} under your {money(o.floor)} floor.</Note>}
            {o.floor <= 0 && <Note>Set a cash floor in <button type="button" className="sy-b blue sm" onClick={() => setPop({ k: 'settings' })}>Settings</button> so tight weeks are flagged.</Note>}

            {/* Cash position */}
            <Card title="Cash position" sub={`Projected bank balance at the end of each ${view === 'weeks' ? 'week' : 'month'}. Click a bar for what moves.`}
              right={<div className="sy-chips" role="group" aria-label="Period">{(['weeks', 'months'] as const).map(v => <button key={v} type="button" className="sy-chip" aria-pressed={view === v} onClick={() => setView(v)}>{v === 'weeks' ? '13 weeks' : '12 months'}</button>)}</div>}>
              <CashChart buckets={buckets} floor={o.floor} onPick={i => setPop({ k: 'period', i })} />
              <div className="fn-legend" style={{ marginTop: 8 }}><span><i className="fn-sw" style={{ background: BLUE }} />Above floor</span><span><i className="fn-sw" style={{ background: DOT.orange }} />Below floor</span>{o.floor > 0 && <span>— — Floor {money(o.floor)}</span>}</div>
            </Card>

            {/* Statement */}
            <Card title={view === 'weeks' ? '13-week cash flow' : '12-month cash flow'} sub="Direct method · beginning cash plus receipts less disbursements. Click a column for detail.">
              <Statement buckets={buckets} cashToday={o.cash_today} floor={o.floor} onPick={i => setPop({ k: 'period', i })} />
            </Card>

            <div className="fn-two">
              {/* Bills due */}
              <Card title="Bills due" sub={`${bills.length} open in QuickBooks · ${money(o.payable_total)}`} right={<button type="button" className="sy-b blue sm" onClick={() => setPop({ k: 'bills' })}>Manage</button>}>
                {bills.length === 0 ? <div className="sy-empty">No open bills.</div> : bills.slice(0, 6).map(b => (
                  <div key={b.qbo_id} className="sy-row">
                    <div className="main"><div className="t">{b.vendor}</div><div className="m" style={{ color: b.overdue ? ORANGE : MUTED }}>{b.overdue ? `${-b.days_to_due} days late` : `Due ${day(b.due_date)}`}</div></div>
                    <span className={`fn-tag ${b.tier}`}>{TIER[b.tier as Tier]}</span>
                    <div style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', minWidth: 80, textAlign: 'right' }}>{money(b.balance)}</div>
                  </div>
                ))}
              </Card>

              {/* Recurring */}
              <Card title="Recurring money in & out" sub={`${rules.length} item${rules.length === 1 ? '' : 's'} in the outlook`} right={<button type="button" className="sy-b blue sm" onClick={() => setPop({ k: 'recurring' })} disabled={!bank}>Manage</button>}>
                {bankErr && !bank ? <Note tone="orange">{bankErr}</Note> : rules.length === 0 ? <div className="sy-empty">None yet. Mark repeating payments in Bank activity.</div> : rules.slice(0, 6).map(r => (
                  <div key={r.id} className="sy-row">
                    <div className="main"><div className="t">{r.name}</div><div className="m">{FREQ[r.frequency as Freq]} · next {day(r.next_date)}</div></div>
                    <span className={`fn-tag ${r.direction}`}>{r.direction === 'in' ? 'In' : 'Out'}</span>
                    <div style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', minWidth: 80, textAlign: 'right' }}>{money(r.amount)}</div>
                  </div>
                ))}
              </Card>
            </div>

            {/* Bank activity */}
            <Card title="Bank activity · last 90 days" sub="Money in and out of your QuickBooks bank accounts. Mark what repeats so the outlook includes it." right={<button type="button" className="sy-b pri sm" onClick={() => setPop({ k: 'bank' })} disabled={!bank}>Review transactions</button>}>
              {bankErr && !bank ? <Note tone="orange">{bankErr}</Note> : !bank ? <div className="sy-empty">Reading…</div> : (
                <div className="sy-kpis" style={{ marginBottom: 0 }}>
                  <div className="sy-kpi" style={{ boxShadow: 'none', background: '#F7F8FA' }}><div className="l">Money in</div><div className="v">{money((bank.transactions as Any[]).filter(t => t.direction === 'in').reduce((s, t) => s + t.amount, 0))}</div></div>
                  <div className="sy-kpi" style={{ boxShadow: 'none', background: '#F7F8FA' }}><div className="l">Money out</div><div className="v">{money((bank.transactions as Any[]).filter(t => t.direction === 'out').reduce((s, t) => s + t.amount, 0))}</div></div>
                  <div className="sy-kpi" style={{ boxShadow: 'none', background: '#F7F8FA' }}><div className="l">Transactions</div><div className="v">{(bank.transactions as Any[]).length}</div></div>
                  <button type="button" className="sy-kpi" style={{ boxShadow: 'none', background: '#FFF4E5' }} onClick={() => setPop({ k: 'bank' })}><div className="l">Look recurring</div><div className="v" style={{ color: ORANGE }}>{(bank.suggestions ?? []).length}</div><div className="s">Review</div></button>
                  <button type="button" className="sy-kpi" style={{ boxShadow: 'none', background: '#F7F8FA' }} onClick={() => setPop({ k: 'bank' })}><div className="l">Not decided</div><div className="v">{undecided}</div><div className="s">Review</div></button>
                </div>
              )}
            </Card>

            {/* What's not in it */}
            {((o.gaps ?? []).length > 0 || (o.left_out ?? []).length > 0) && (
              <Card title="Notes on this report">
                <div style={{ display: 'grid', gap: 6, fontSize: 13, color: TEXT2 }}>
                  <div>Sure-ness of the next 13 weeks: {Math.round((o.share?.known ?? 0) * 100)}% known (bills, payroll, recurring costs, POs), {Math.round((o.share?.expected ?? 0) * 100)}% expected (invoices not late yet, site billing, recurring receipts), {Math.round((o.share?.estimated ?? 0) * 100)}% estimate (late invoices, counted next week).</div>
                  {(o.left_out ?? []).length > 0 && <div>Left out: {(o.left_out as Any[]).length} invoice{(o.left_out as Any[]).length === 1 ? '' : 's'} over 60 days late ({money((o.left_out as Any[]).reduce((s, x) => s + x.amount, 0))}).</div>}
                  {(o.gaps as string[]).map(g => <div key={g}>{g}</div>)}
                </div>
              </Card>
            )}
          </div>
        )}

      {pop?.k === 'period' && buckets[pop.i] && <PeriodSheet b={buckets[pop.i]} onClose={() => setPop(null)} />}
      {pop?.k === 'bills' && <BillsSheet bills={bills} onTier={setTier} onClose={() => setPop(null)} />}
      {pop?.k === 'recurring' && <RecurringSheet rules={rules} onClose={() => setPop(null)} onStop={stop}
        onAdd={() => setPop({ k: 'rule', mode: 'add', initial: { frequency: 'monthly', direction: 'out', tier: 'flexible' } })}
        onEdit={r => setPop({ k: 'rule', mode: 'edit', rule: r, initial: r })} />}
      {pop?.k === 'bank' && bank && <BankSheet bank={bank} busy={busy} onClose={() => setPop(null)} onRefresh={() => loadAll(true)} onRecurring={fromTxn} onOneTime={oneTime} onClear={clear} />}
      {pop?.k === 'settings' && <SettingsSheet onClose={() => setPop(null)} onSaved={() => { notify('Settings saved'); void loadAll(true) }} />}
      {pop?.k === 'codes' && <CodesSheet me={myEmail} onClose={() => setPop(null)} onSelfReset={relock} />}
      {pop?.k === 'rule' && (
        <RuleSheet
          title={pop.mode === 'edit' ? `Change ${pop.rule?.name}` : pop.mode === 'from_txn' ? 'Make recurring' : 'Add a recurring item'}
          sub={pop.mode === 'from_txn' ? `From ${pop.txn?.name} · ${day(pop.txn?.date)} · ${money(pop.txn?.amount)}. Earlier payments to them link to it too.` : undefined}
          initial={pop.initial}
          direction={pop.mode === 'add' ? null : (pop.mode === 'edit' ? pop.rule?.direction : pop.txn?.direction)}
          onClose={() => setPop(pop.mode === 'from_txn' ? { k: 'bank' } : { k: 'recurring' })}
          onSave={async rule => {
            const e = pop.mode === 'from_txn' ? await act('/api/finance/transactions', 'POST', { action: 'make_recurring', txn_key: pop.txn?.key, rule }, `${rule.name} is recurring`)
              : pop.mode === 'edit' ? await act('/api/finance/transactions', 'POST', { action: 'update_rule', id: pop.rule?.id, rule }, `${rule.name} changed`)
                : await act('/api/finance/transactions', 'POST', { action: 'add_rule', rule }, `${rule.name} added`)
            if (!e) setPop(pop.mode === 'from_txn' ? { k: 'bank' } : { k: 'recurring' })
            return e
          }}
        />
      )}
      {flash}
    </section>
  )
}
