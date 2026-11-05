'use client'
/**
 * Finance — Gate Guard senior admins only (Admin → Finance). Behind a second,
 * per-person 6-digit code on top of corporate sign-in (lib/finance-auth.ts).
 *
 * Sections:
 *   Cash outlook  projected bank balance (13 weeks / 12 months) vs the cash floor,
 *                 what moves each period, how sure the numbers are
 *   Pay plan      open QuickBooks bills by due date with each vendor's tier
 *   Settings      cash floor, payroll, recurring costs, idle lock
 *   Codes         (owner only) who has a Finance code; set / reset / remove
 *
 * Every number comes from /api/finance/* — all of which re-check the code session.
 * Design: Admin · Finance page on the design canvas.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>
type Section = 'outlook' | 'payplan' | 'settings' | 'codes'
type Tier = 'must_pay' | 'keeps_running' | 'flexible'

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", Inter, system-ui, sans-serif'
const C = { bg: '#F5F5F7', card: '#FFFFFF', line: 'rgba(0,0,0,0.08)', ink: '#1D1D1F', sub: '#6E6E73', faint: '#86868B', blue: '#0071E3', blueSoft: 'rgba(0,113,227,0.08)', orange: '#A04A00', orangeBar: '#FF9500', orangeSoft: '#FFF7EB', red: '#C9341F', green: '#1A7F37' }
const money = (n: unknown) => { const v = Number(n); return isFinite(v) ? v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }) : '—' }
const short = (n: number) => { const a = Math.abs(n); const s = a >= 1e6 ? `$${(a / 1e6).toFixed(2)}M` : a >= 1e3 ? `$${Math.round(a / 1e3)}K` : `$${Math.round(a)}`; return n < 0 ? `−${s}` : s }
const dateLabel = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const TIER_LABEL: Record<Tier, string> = { must_pay: 'Must pay on time', keeps_running: 'Keeps sites running', flexible: 'Flexible' }
const TIER_STYLE: Record<Tier, React.CSSProperties> = {
  must_pay: { background: '#1D1D1F', color: '#fff' },
  keeps_running: { background: 'rgba(0,113,227,0.12)', color: '#0058B0' },
  flexible: { background: 'rgba(0,0,0,0.06)', color: '#3A3A3C' },
}

async function api<T = Row>(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T & { error?: string; state?: string } }> {
  try {
    const r = await fetch(path, { ...init, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } })
    const data = await r.json().catch(() => ({}))
    return { ok: r.ok, status: r.status, data }
  } catch (e) {
    return { ok: false, status: 0, data: { error: e instanceof Error ? e.message : 'Network error' } as T & { error?: string } }
  }
}

// ── Small pieces ─────────────────────────────────────────────────────────────
function Card({ title, right, children, pad = true }: { title?: string; right?: React.ReactNode; children: React.ReactNode; pad?: boolean }) {
  return (
    <section style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, minWidth: 0 }}>
      {(title || right) && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 16px 0', flexWrap: 'wrap' }}><h2 style={{ fontSize: 15, fontWeight: 600, color: C.ink, margin: 0 }}>{title}</h2>{right}</div>}
      <div style={pad ? { padding: 16 } : undefined}>{children}</div>
    </section>
  )
}
function Btn({ children, onClick, kind = 'primary', disabled, small, type = 'button' }: { children: React.ReactNode; onClick?: () => void; kind?: 'primary' | 'plain' | 'danger'; disabled?: boolean; small?: boolean; type?: 'button' | 'submit' }) {
  const s = kind === 'primary' ? { background: C.blue, color: '#fff', border: `1px solid ${C.blue}` } : kind === 'danger' ? { background: '#fff', color: C.red, border: '1px solid rgba(201,52,31,0.35)' } : { background: '#fff', color: C.blue, border: `1px solid ${C.line}` }
  return <button type={type} onClick={onClick} disabled={disabled} style={{ ...s, borderRadius: 10, minHeight: small ? 32 : 40, padding: small ? '0 10px' : '0 14px', fontSize: small ? 12.5 : 14, fontWeight: 600, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1, whiteSpace: 'nowrap', fontFamily: FONT }}>{children}</button>
}
function Note({ tone = 'gray', children }: { tone?: 'gray' | 'red' | 'green' | 'blue' | 'orange'; children: React.ReactNode }) {
  const m = { gray: ['#F5F5F7', C.sub], red: ['#FDECEA', C.red], green: ['#E8F6EC', C.green], blue: [C.blueSoft, '#0058B0'], orange: [C.orangeSoft, C.orange] }[tone]
  return <div role={tone === 'red' ? 'alert' : undefined} style={{ background: m[0], color: m[1], borderRadius: 10, padding: '10px 12px', fontSize: 13, lineHeight: 1.45 }}>{children}</div>
}
function Tile({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: 16 }}><div style={{ fontSize: 12.5, color: C.sub }}>{label}</div><div style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', color: warn ? C.orange : C.ink, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{value}</div>{sub && <div style={{ fontSize: 12.5, color: C.sub, marginTop: 4 }}>{sub}</div>}</div>
}
const inputStyle: React.CSSProperties = { width: '100%', border: `1px solid rgba(0,0,0,0.14)`, borderRadius: 10, minHeight: 40, padding: '0 12px', fontSize: 14, color: C.ink, background: '#fff', fontFamily: FONT, boxSizing: 'border-box' }
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label style={{ display: 'block' }}><div style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 6 }}>{label}</div>{children}{hint && <div style={{ fontSize: 12, color: C.sub, marginTop: 5, lineHeight: 1.4 }}>{hint}</div>}</label>
}
function TierTag({ tier }: { tier: Tier }) {
  return <span style={{ ...TIER_STYLE[tier], display: 'inline-flex', padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{TIER_LABEL[tier]}</span>
}

// ── Lock screen ──────────────────────────────────────────────────────────────
function CodeBoxes({ onDone, busy, label }: { onDone: (code: string) => void; busy: boolean; label: string }) {
  const [code, setCode] = useState('')
  return (
    <form onSubmit={e => { e.preventDefault(); if (code.length === 6) onDone(code) }} style={{ display: 'grid', gap: 16, width: '100%' }}>
      <label style={{ display: 'block' }}>
        <span style={{ position: 'absolute', left: -9999 }}>{label}</span>
        <input autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} aria-label={label}
          style={{ ...inputStyle, minHeight: 56, fontSize: 28, fontWeight: 600, letterSpacing: '0.5em', textAlign: 'center', paddingLeft: '0.5em' }} />
      </label>
      <Btn type="submit" disabled={busy || code.length !== 6}>{busy ? 'Checking…' : label.startsWith('New') ? 'Save my code' : 'Unlock Finance'}</Btn>
    </form>
  )
}

function LockScreen({ status, onUnlocked, me }: { status: Row; onUnlocked: () => void; me: string }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'red' | 'green' | 'gray'; text: string } | null>(null)
  const firstCode = status.state === 'no_code' && status.owner
  const submit = async (code: string) => {
    setBusy(true); setMsg(null)
    if (firstCode) {
      const r = await api('/api/finance/codes', { method: 'POST', body: JSON.stringify({ email: me, code }) })
      if (!r.ok) { setMsg({ tone: 'red', text: r.data.error ?? 'Couldn’t save your code.' }); setBusy(false); return }
    }
    const r = await api('/api/finance/unlock', { method: 'POST', body: JSON.stringify({ code }) })
    setBusy(false)
    if (r.ok) { onUnlocked(); return }
    const left = (r.data as Row).tries_left
    setMsg({ tone: 'red', text: `${r.data.error ?? 'Couldn’t unlock.'}${typeof left === 'number' ? ` ${left} ${left === 1 ? 'try' : 'tries'} left.` : ''}` })
    if (r.status === 423) onUnlocked() // reload status to show the locked-out screen
  }
  const title = status.state === 'locked_out' ? 'Finance is locked for now' : firstCode ? 'Set your Finance code' : status.state === 'no_code' ? 'You don’t have a Finance code' : 'Finance is locked'
  const sub = status.state === 'locked_out' ? `Too many wrong tries. Try again after ${new Date(status.until).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}. The owner has been told in the Finance log.`
    : firstCode ? 'You’re the owner. Pick a 6-digit code — you’ll use it every time you open Finance, and you can then set codes for other senior admins.'
      : status.state === 'no_code' ? 'Ask the owner to set one for you. Finance needs it on top of your Nexus sign-in.'
        : 'Enter your 6-digit senior admin code to see cash, bills and payroll.'
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 16px' }}>
      <div style={{ background: C.card, borderRadius: 16, padding: '36px 32px', boxShadow: '0 1px 2px rgba(0,0,0,.04), 0 10px 30px -14px rgba(0,0,0,.22)', width: '100%', maxWidth: 420, display: 'grid', gap: 18, justifyItems: 'center', textAlign: 'center' }}>
        <span aria-hidden style={{ width: 52, height: 52, borderRadius: 14, background: C.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
        </span>
        <div><h2 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>{title}</h2><div style={{ color: C.sub, fontSize: 13, marginTop: 6, lineHeight: 1.45 }}>{sub}</div></div>
        {(status.state === 'locked' || firstCode) && <CodeBoxes onDone={submit} busy={busy} label={firstCode ? 'New 6-digit code' : '6-digit code'} />}
        {msg && <div style={{ width: '100%' }}><Note tone={msg.tone}>{msg.text}</Note></div>}
        <div style={{ fontSize: 12.5, color: C.sub, textAlign: 'left', borderTop: `1px solid ${C.line}`, paddingTop: 14, display: 'grid', gap: 6, width: '100%' }}>
          <div>· Locks again after 15 minutes without use (owner can change it).</div>
          <div>· 5 wrong tries locks you out for 30 minutes.</div>
          <div>· Every unlock and every change is logged.</div>
        </div>
      </div>
    </div>
  )
}

// ── Cash outlook ─────────────────────────────────────────────────────────────
function BarChart({ buckets, floor, monthly }: { buckets: Row[]; floor: number; monthly: boolean }) {
  const W = 1000, H = 280, base = 240, top = 30, left = 52
  const vals = buckets.map(b => Number(b.end_balance) || 0)
  const max = Math.max(floor, ...vals, 1)
  const min = Math.min(0, ...vals)
  const span = max - min || 1
  const y = (v: number) => base - ((v - min) / span) * (base - top)
  const slot = (W - left - 10) / buckets.length
  const bw = Math.min(56, slot * 0.72)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Projected balance by ${monthly ? 'month' : 'week'}, lowest ${money(Math.min(...vals))}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <g fontFamily={FONT} fontSize="11" fill={C.sub}>
        <line x1={left} y1={y(0)} x2={W - 10} y2={y(0)} stroke="rgba(0,0,0,.15)" />
        <text x="0" y={y(max) + 4}>{short(max)}</text>
        {min < 0 && <text x="0" y={y(min) + 4}>{short(min)}</text>}
        {buckets.map((b, i) => {
          const v = Number(b.end_balance) || 0
          const x = left + i * slot + (slot - bw) / 2
          const y0 = y(Math.max(v, 0)), y1 = y(Math.min(v, 0))
          const label = monthly ? String(b.label).split(' ')[0] : String(b.label).replace('Week of ', '')
          return (
            <g key={b.start}>
              <rect x={x} y={y0} width={bw} height={Math.max(1, y1 - y0)} rx="4" fill={b.below_floor || v < 0 ? C.orangeBar : C.blue}><title>{`${b.label}: ${money(v)}`}</title></rect>
              {(b.below_floor || i === 0 || i === buckets.length - 1) && <text x={x + bw / 2} y={y0 - 6} textAnchor="middle" fill={b.below_floor ? C.orange : C.ink} fontWeight={b.below_floor ? 600 : 400}>{short(v)}</text>}
              <text x={x + bw / 2} y={base + 22} textAnchor="middle">{label}</text>
            </g>
          )
        })}
        {floor > 0 && <line x1={left} y1={y(floor)} x2={W - 10} y2={y(floor)} stroke={C.ink} strokeWidth="1.5" strokeDasharray="6 5" />}
      </g>
    </svg>
  )
}

function OutlookSection({ data, refresh, busy }: { data: Row; refresh: () => void; busy: boolean }) {
  const [view, setView] = useState<'weeks' | 'months'>('weeks')
  const buckets: Row[] = view === 'weeks' ? data.weeks : data.months
  const lowest = view === 'weeks' ? data.lowest_week : data.lowest_month
  const [pick, setPick] = useState<number | null>(null)
  const idx = pick ?? Math.max(0, buckets.findIndex(b => lowest && b.label === lowest.label))
  const sel = buckets[idx]
  const weeksIn = (data.weeks as Row[]).reduce((s, w) => s + (Number(w.in) || 0), 0)
  const weeksOut = (data.weeks as Row[]).reduce((s, w) => s + (Number(w.out) || 0), 0)
  const below = buckets.filter(b => b.below_floor)
  const share = data.share ?? {}
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div role="group" aria-label="View" style={{ display: 'inline-flex', background: 'rgba(0,0,0,.05)', borderRadius: 9, padding: 2 }}>
          {(['weeks', 'months'] as const).map(v => <button key={v} type="button" aria-pressed={view === v} onClick={() => { setView(v); setPick(null) }} style={{ border: 0, background: view === v ? '#fff' : 'transparent', boxShadow: view === v ? '0 1px 2px rgba(0,0,0,.12)' : 'none', fontFamily: FONT, fontSize: 13, fontWeight: view === v ? 600 : 500, minHeight: 32, padding: '0 12px', borderRadius: 7, color: C.ink, cursor: 'pointer' }}>{v === 'weeks' ? '13 weeks' : '12 months'}</button>)}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span style={{ fontSize: 12, color: C.sub }}>From QuickBooks + Nexus · {new Date(data.as_of).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span><Btn kind="plain" small onClick={refresh} disabled={busy}>{busy ? 'Refreshing…' : 'Refresh'}</Btn></div>
      </div>
      {below.length > 0 && <Note tone="orange"><b>{below.length === 1 ? `Tight: ${below[0].label}` : `Tight: ${below.length} ${view === 'weeks' ? 'weeks' : 'months'} under your floor`}.</b> Lowest point {money(lowest?.balance)} ({lowest?.label}), {money(data.floor - (lowest?.balance ?? 0))} under your {money(data.floor)} floor.</Note>}
      {data.floor <= 0 && <Note>Set a cash floor in Settings so tight weeks are flagged.</Note>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <Tile label="Cash today" value={money(data.cash_today)} sub={`${(data.cash_accounts ?? []).length} bank account${(data.cash_accounts ?? []).length === 1 ? '' : 's'} in QuickBooks`} />
        <Tile label={`Lowest in ${view === 'weeks' ? '13 weeks' : '12 months'}`} value={money(lowest?.balance)} sub={lowest?.label} warn={!!lowest && data.floor > 0 && lowest.balance < data.floor} />
        <Tile label="Coming in · 13 weeks" value={money(weeksIn)} />
        <Tile label="Going out · 13 weeks" value={money(weeksOut)} />
      </div>
      <Card title={`Projected balance, end of each ${view === 'weeks' ? 'week' : 'month'}`} right={<span style={{ fontSize: 12.5, color: C.sub }}>Orange = under the floor · dashed line = floor</span>}>
        <BarChart buckets={buckets} floor={data.floor} monthly={view === 'months'} />
        <div role="group" aria-label="Pick a period" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
          {buckets.map((b, i) => <button key={b.start} type="button" aria-pressed={i === idx} onClick={() => setPick(i)} style={{ minHeight: 32, padding: '0 10px', borderRadius: 16, border: `1px solid ${i === idx ? C.ink : C.line}`, background: i === idx ? C.ink : '#fff', color: i === idx ? '#fff' : b.below_floor ? C.orange : '#3A3A3C', fontFamily: FONT, fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}>{view === 'weeks' ? String(b.label).replace('Week of ', '') : String(b.label).split(' ')[0]}</button>)}
        </div>
      </Card>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
        <Card title={sel ? `${sel.label} · ends at ${money(sel.end_balance)}` : 'Pick a period'} pad={false}>
          {!sel || (sel.items ?? []).length === 0 ? <div style={{ padding: 16, color: C.sub, fontSize: 14 }}>Nothing moves in this period.</div> : (
            <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
              <thead><tr>{['Date', 'Item', 'How sure', 'Amount'].map((h, i) => <th key={h} style={{ textAlign: i === 3 ? 'right' : 'left', fontWeight: 500, color: C.sub, fontSize: 12, padding: '10px 14px', borderBottom: `1px solid ${C.line}` }}>{h}</th>)}</tr></thead>
              <tbody>{(sel.items as Row[]).map((it, i) => (
                <tr key={`${it.source}-${it.ref ?? i}-${it.date}`}>
                  <td style={{ padding: '9px 14px', borderBottom: `1px solid rgba(0,0,0,.055)`, whiteSpace: 'nowrap' }}>{dateLabel(it.date)}</td>
                  <td style={{ padding: '9px 14px', borderBottom: `1px solid rgba(0,0,0,.055)` }}>{it.label}</td>
                  <td style={{ padding: '9px 14px', borderBottom: `1px solid rgba(0,0,0,.055)`, color: C.sub, whiteSpace: 'nowrap' }}>{it.certainty === 'known' ? 'Known' : it.certainty === 'expected' ? 'Expected' : 'Estimate'}</td>
                  <td style={{ padding: '9px 14px', borderBottom: `1px solid rgba(0,0,0,.055)`, textAlign: 'right', whiteSpace: 'nowrap', color: it.amount < 0 ? C.ink : C.green }}>{it.amount < 0 ? '−' : '+'}{money(Math.abs(it.amount))}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </Card>
        <Card title="How sure is this?">
          {([['known', 'Known: bills, payroll, recurring costs, POs', '#0071E3'], ['expected', 'Expected: invoices not late yet, monthly site billing', '#5AA0EE'], ['estimated', 'Estimate: invoices already late (counted next week)', '#A9CCF5']] as const).map(([k, label, color]) => (
            <div key={k} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span>{label}</span><span style={{ fontWeight: 600 }}>{Math.round((Number(share[k]) || 0) * 100)}%</span></div>
              <div style={{ height: 8, background: 'rgba(0,0,0,.06)', borderRadius: 4, marginTop: 6 }}><div style={{ height: '100%', width: `${Math.round((Number(share[k]) || 0) * 100)}%`, background: color, borderRadius: 4 }} /></div>
            </div>
          ))}
          {(data.left_out ?? []).length > 0 && <div style={{ fontSize: 13, color: C.sub, borderTop: `1px solid ${C.line}`, paddingTop: 12 }}><b style={{ color: C.ink }}>Left out:</b> {(data.left_out as Row[]).length} invoice{(data.left_out as Row[]).length === 1 ? '' : 's'} over 60 days late ({money((data.left_out as Row[]).reduce((s, x) => s + x.amount, 0))}), e.g. {(data.left_out as Row[]).slice(0, 2).map(x => `${x.label} ${money(x.amount)}`).join(', ')}.</div>}
          {(data.gaps ?? []).length > 0 && <div style={{ fontSize: 13, color: C.sub, marginTop: 10, display: 'grid', gap: 4 }}>{(data.gaps as string[]).map(g => <div key={g}>· {g}</div>)}</div>}
        </Card>
      </div>
    </div>
  )
}

// ── Pay plan (read-only list + vendor tier) ──────────────────────────────────
function PayPlanSection({ data, onTier }: { data: Row; onTier: (vendorId: string, name: string, tier: Tier) => Promise<void> }) {
  const [filter, setFilter] = useState<Tier | 'all'>('all')
  const bills: Row[] = data.pay_plan ?? []
  const shown = filter === 'all' ? bills : bills.filter(b => b.tier === filter)
  const in28 = bills.filter(b => b.days_to_due <= 28)
  const overdue = bills.filter(b => b.overdue)
  const count = (t: Tier) => bills.filter(b => b.tier === t).length
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <Tile label="Open bills" value={money(bills.reduce((s, b) => s + b.balance, 0))} sub={`${bills.length} in QuickBooks`} />
        <Tile label="Due in the next 4 weeks" value={money(in28.reduce((s, b) => s + b.balance, 0))} sub={`${in28.length} bills`} />
        <Tile label="Past due" value={money(overdue.reduce((s, b) => s + b.balance, 0))} sub={`${overdue.length} bills`} warn={overdue.length > 0} />
      </div>
      <Note tone="blue">Set each vendor’s tier once and new bills from that vendor follow it. Suggested pay dates come in the next update — for now this is the list in due-date order.</Note>
      <Card pad={false}>
        <div role="group" aria-label="Filter by tier" style={{ padding: '14px 16px', display: 'flex', gap: 8, flexWrap: 'wrap', borderBottom: `1px solid ${C.line}` }}>
          {([['all', `All ${bills.length}`], ['must_pay', `Must pay on time ${count('must_pay')}`], ['keeps_running', `Keeps sites running ${count('keeps_running')}`], ['flexible', `Flexible ${count('flexible')}`]] as const).map(([k, label]) => (
            <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)} style={{ minHeight: 32, padding: '0 12px', borderRadius: 16, border: `1px solid ${filter === k ? C.ink : 'rgba(0,0,0,.12)'}`, background: filter === k ? C.ink : '#fff', color: filter === k ? '#fff' : '#3A3A3C', fontFamily: FONT, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>{label}</button>
          ))}
        </div>
        {shown.length === 0 ? <div style={{ padding: 16, color: C.sub, fontSize: 14 }}>No open bills{filter !== 'all' ? ' in this tier' : ''}.</div> : (
          <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
            <thead><tr>{['Vendor', 'Bill', 'Due', 'Amount', 'Tier'].map((h, i) => <th key={h} style={{ textAlign: i === 3 ? 'right' : 'left', fontWeight: 500, color: C.sub, fontSize: 12, padding: '10px 14px', borderBottom: `1px solid ${C.line}`, whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
            <tbody>{shown.map(b => (
              <tr key={b.qbo_id}>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(0,0,0,.055)', fontWeight: 600 }}>{b.vendor}</td>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(0,0,0,.055)', color: C.sub }}>{b.doc ?? '—'}</td>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(0,0,0,.055)', whiteSpace: 'nowrap', color: b.overdue ? C.orange : C.ink, fontWeight: b.overdue ? 600 : 400 }}>{dateLabel(b.due_date)}{b.overdue ? ` · ${-b.days_to_due} d late` : ''}</td>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(0,0,0,.055)', textAlign: 'right' }}>{money(b.balance)}</td>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(0,0,0,.055)' }}>
                  {b.vendor_id ? (
                    <label><span style={{ position: 'absolute', left: -9999 }}>Tier for {b.vendor}</span>
                      <select value={b.tier} onChange={e => void onTier(b.vendor_id, b.vendor, e.target.value as Tier)} style={{ ...inputStyle, minHeight: 32, width: 'auto', fontSize: 13 }}>
                        {(Object.keys(TIER_LABEL) as Tier[]).map(t => <option key={t} value={t}>{TIER_LABEL[t]}</option>)}
                      </select></label>
                  ) : <TierTag tier={b.tier} />}
                </td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>
    </div>
  )
}

// ── Settings ─────────────────────────────────────────────────────────────────
function SettingsSection({ onSaved }: { onSaved: () => void }) {
  const [s, setS] = useState<Row | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ tone: 'green' | 'red'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { void (async () => { const r = await api('/api/finance/settings'); if (r.ok) setS((r.data as Row).settings); else setErr(r.data.error ?? 'Couldn’t load settings.') })() }, [])
  if (err) return <Note tone="red">{err}</Note>
  if (!s) return <div style={{ color: C.sub, fontSize: 14 }}>Loading…</div>
  const set = (k: string, v: unknown) => setS(p => ({ ...(p ?? {}), [k]: v }))
  const costs: Row[] = s.recurring_costs ?? []
  const setCost = (i: number, k: string, v: unknown) => set('recurring_costs', costs.map((c, j) => (j === i ? { ...c, [k]: v } : c)))
  const save = async () => {
    setBusy(true); setMsg(null)
    const r = await api('/api/finance/settings', { method: 'PUT', body: JSON.stringify({
      cash_floor: Number(s.cash_floor) || 0, idle_minutes: Number(s.idle_minutes) || 15, collect_lag_days: Number(s.collect_lag_days) || 0,
      payroll_amount: Number(s.payroll_amount) || 0, payroll_frequency: s.payroll_frequency, payroll_next_date: s.payroll_next_date || null,
      recurring_costs: costs.filter(c => String(c.name ?? '').trim()).map(c => ({ name: c.name, amount: Number(c.amount) || 0, day: Number(c.day) || 1, tier: c.tier ?? 'flexible' })),
    }) })
    setBusy(false)
    if (r.ok) { setMsg({ tone: 'green', text: 'Saved. The outlook is updated.' }); onSaved() } else setMsg({ tone: 'red', text: r.data.error ?? 'Couldn’t save.' })
  }
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 860 }}>
      <Card title="Cash floor & lock">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <Field label="Cash floor" hint="Weeks that end below this show in orange."><input type="number" min={0} step={1000} value={s.cash_floor ?? 0} onChange={e => set('cash_floor', e.target.value)} style={inputStyle} /></Field>
          <Field label="Lock after (minutes idle)" hint="5–60."><input type="number" min={5} max={60} value={s.idle_minutes ?? 15} onChange={e => set('idle_minutes', e.target.value)} style={inputStyle} /></Field>
          <Field label="Days to collect monthly billing" hint="How long after the 1st site billing usually arrives."><input type="number" min={0} max={120} value={s.collect_lag_days ?? 15} onChange={e => set('collect_lag_days', e.target.value)} style={inputStyle} /></Field>
        </div>
      </Card>
      <Card title="Payroll">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <Field label="Amount per run" hint="Include employer taxes."><input type="number" min={0} step={100} value={s.payroll_amount ?? 0} onChange={e => set('payroll_amount', e.target.value)} style={inputStyle} /></Field>
          <Field label="How often"><select value={s.payroll_frequency ?? 'biweekly'} onChange={e => set('payroll_frequency', e.target.value)} style={inputStyle}><option value="weekly">Every week</option><option value="biweekly">Every other week</option><option value="semimonthly">15th and last day</option><option value="monthly">Once a month</option></select></Field>
          <Field label="Next pay date"><input type="date" value={s.payroll_next_date ?? ''} onChange={e => set('payroll_next_date', e.target.value)} style={inputStyle} /></Field>
        </div>
      </Card>
      <Card title="Recurring costs" right={<Btn kind="plain" small onClick={() => set('recurring_costs', [...costs, { name: '', amount: '', day: 1, tier: 'flexible' }])}>Add a cost</Btn>}>
        <div style={{ fontSize: 12.5, color: C.sub, marginBottom: 12 }}>Only costs that aren’t entered in QuickBooks as bills ahead of time (rent on autopay, card charges). Anything already a QuickBooks bill is counted from there.</div>
        {costs.length === 0 ? <div style={{ color: C.sub, fontSize: 14 }}>None yet.</div> : costs.map((c, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 2fr) minmax(100px, 1fr) 90px minmax(150px, 1.4fr) auto', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <input aria-label="Name" placeholder="Name" value={c.name ?? ''} onChange={e => setCost(i, 'name', e.target.value)} style={inputStyle} />
            <input aria-label="Monthly amount" type="number" min={0} placeholder="Amount" value={c.amount ?? ''} onChange={e => setCost(i, 'amount', e.target.value)} style={inputStyle} />
            <input aria-label="Day of month" type="number" min={1} max={31} value={c.day ?? 1} onChange={e => setCost(i, 'day', e.target.value)} style={inputStyle} />
            <select aria-label="Tier" value={c.tier ?? 'flexible'} onChange={e => setCost(i, 'tier', e.target.value)} style={inputStyle}>{(Object.keys(TIER_LABEL) as Tier[]).map(t => <option key={t} value={t}>{TIER_LABEL[t]}</option>)}</select>
            <Btn kind="danger" small onClick={() => set('recurring_costs', costs.filter((_, j) => j !== i))}>Remove</Btn>
          </div>
        ))}
      </Card>
      {msg && <Note tone={msg.tone}>{msg.text}</Note>}
      <div><Btn onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</Btn></div>
    </div>
  )
}

// ── Codes (owner) ────────────────────────────────────────────────────────────
function CodesSection({ me, onSelfReset }: { me: string; onSelfReset: () => void }) {
  const [people, setPeople] = useState<Row[] | null>(null)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState<{ tone: 'green' | 'red'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => { const r = await api('/api/finance/codes'); if (r.ok) setPeople((r.data as Row).people ?? []); else setMsg({ tone: 'red', text: r.data.error ?? 'Couldn’t load.' }) }, [])
  useEffect(() => { void load() }, [load])
  const save = async () => {
    setBusy(true); setMsg(null)
    const r = await api('/api/finance/codes', { method: 'POST', body: JSON.stringify({ email, code }) })
    setBusy(false)
    if (!r.ok) { setMsg({ tone: 'red', text: r.data.error ?? 'Couldn’t save.' }); return }
    const self = email.trim().toLowerCase() === me.toLowerCase()
    setMsg({ tone: 'green', text: self ? 'Your code changed. Enter the new one.' : `Code saved for ${email}. Tell them in person or by phone — never by email or text.` })
    setEmail(''); setCode('')
    if (self) { onSelfReset(); return }
    void load()
  }
  const remove = async (e: string) => {
    if (!window.confirm(`Remove Finance access for ${e}?`)) return
    const r = await api('/api/finance/codes', { method: 'DELETE', body: JSON.stringify({ email: e }) })
    if (r.ok) void load(); else setMsg({ tone: 'red', text: r.data.error ?? 'Couldn’t remove.' })
  }
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 860 }}>
      <Card title="Set or reset a code">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, alignItems: 'end' }}>
          <Field label="Their Nexus email" hint="Must be a Gate Guard corporate admin."><input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} /></Field>
          <Field label="6-digit code" hint="Resetting signs them out of Finance."><input inputMode="numeric" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} style={inputStyle} /></Field>
          <div><Btn onClick={save} disabled={busy || !email.trim() || code.length !== 6}>{busy ? 'Saving…' : 'Save code'}</Btn></div>
        </div>
      </Card>
      {msg && <Note tone={msg.tone}>{msg.text}</Note>}
      <Card title="Who can open Finance" pad={false}>
        {!people ? <div style={{ padding: 16, color: C.sub, fontSize: 14 }}>Loading…</div> : people.length === 0 ? <div style={{ padding: 16, color: C.sub, fontSize: 14 }}>Nobody yet.</div> : (
          <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr>{['Person', 'Status', 'Last unlock', ''].map(h => <th key={h} style={{ textAlign: 'left', fontWeight: 500, color: C.sub, fontSize: 12, padding: '10px 14px', borderBottom: `1px solid ${C.line}` }}>{h}</th>)}</tr></thead>
            <tbody>{people.map(p => {
              const lockedOut = p.locked_until && new Date(p.locked_until).getTime() > Date.now()
              return (
                <tr key={p.email}>
                  <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(0,0,0,.055)' }}><div style={{ fontWeight: 600 }}>{p.name ?? p.email}</div><div style={{ color: C.sub }}>{p.email}</div></td>
                  <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(0,0,0,.055)', color: !p.active ? C.sub : lockedOut ? C.orange : C.ink }}>{!p.active ? 'Removed' : lockedOut ? 'Locked out (wrong tries)' : 'Active'}</td>
                  <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(0,0,0,.055)', color: C.sub }}>{p.last_unlock_at ? new Date(p.last_unlock_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Never'}</td>
                  <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(0,0,0,.055)', textAlign: 'right' }}>{p.active && p.email.toLowerCase() !== me.toLowerCase() && <Btn kind="danger" small onClick={() => remove(p.email)}>Remove</Btn>}</td>
                </tr>
              )
            })}</tbody>
          </table></div>
        )}
      </Card>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export function FinancePage({ onClose, myEmail }: { onClose: () => void; myEmail: string }) {
  const [status, setStatus] = useState<Row | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [section, setSection] = useState<Section>('outlook')
  const [outlook, setOutlook] = useState<Row | null>(null)
  const [oErr, setOErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(Date.now())

  const loadStatus = useCallback(async () => {
    const r = await api('/api/finance/session')
    if (r.ok) { setStatus(r.data); setErr(null) } else { setStatus(null); setErr(r.status === 403 ? 'Finance is for Gate Guard senior admins only.' : r.data.error ?? 'Couldn’t check Finance.') }
  }, [])
  const relock = useCallback(() => { setOutlook(null); void loadStatus() }, [loadStatus])
  const loadOutlook = useCallback(async (refresh = false) => {
    setBusy(true); setOErr(null)
    const r = await api(`/api/finance/outlook${refresh ? '?refresh=1' : ''}`)
    setBusy(false)
    if (r.status === 401) { relock(); return }
    if (r.ok) { setOutlook(r.data); void loadStatus() } else setOErr(r.data.error ?? 'Couldn’t build the outlook.')
  }, [relock, loadStatus])

  useEffect(() => { void loadStatus() }, [loadStatus])
  const unlocked = status?.state === 'unlocked'
  useEffect(() => { if (unlocked && !outlook) void loadOutlook() }, [unlocked]) // eslint-disable-line react-hooks/exhaustive-deps
  // Idle lock: when the server-side session would expire, show the lock screen.
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t) }, [])
  const expiresAt = unlocked ? new Date(status!.expires_at).getTime() : 0
  useEffect(() => { if (unlocked && expiresAt && now >= expiresAt) relock() }, [now, expiresAt, unlocked, relock])
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])

  const lockNow = async () => { await api('/api/finance/lock', { method: 'POST' }); relock() }
  const setTier = async (vendorId: string, name: string, tier: Tier) => {
    const r = await api('/api/finance/settings', { method: 'PUT', body: JSON.stringify({ vendor: { id: vendorId, name, tier } }) })
    if (r.status === 401) { relock(); return }
    if (r.ok) void loadOutlook(); else setOErr(r.data.error ?? 'Couldn’t save the tier.')
  }
  const minsLeft = unlocked ? Math.max(0, Math.ceil((expiresAt - now) / 60000)) : 0
  const tabs = useMemo(() => [
    { id: 'outlook' as const, label: 'Cash outlook' }, { id: 'payplan' as const, label: 'Pay plan' }, { id: 'settings' as const, label: 'Settings' },
    ...(status?.owner ? [{ id: 'codes' as const, label: 'Codes' }] : []),
  ], [status?.owner])

  return (
    <div role="dialog" aria-modal="true" aria-label="Finance" style={{ position: 'fixed', inset: 0, zIndex: 120, background: C.bg, overflowY: 'auto', fontFamily: FONT, color: C.ink, WebkitFontSmoothing: 'antialiased' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 2, background: 'rgba(245,245,247,0.86)', backdropFilter: 'saturate(180%) blur(20px)', borderBottom: `1px solid ${C.line}` }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '12px 16px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button type="button" onClick={onClose} style={{ border: 'none', background: 'none', color: C.blue, fontSize: 15, cursor: 'pointer', padding: 0, fontFamily: FONT }}>‹ Admin</button>
            <div style={{ flex: 1 }} />
            {unlocked && <span style={{ fontSize: 12.5, color: '#0058B0', background: C.blueSoft, borderRadius: 8, padding: '4px 8px', fontWeight: 600 }}>Unlocked · locks in {minsLeft} min</span>}
            {unlocked && <Btn kind="plain" small onClick={lockNow}>Lock now</Btn>}
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.015em', margin: '6px 0 2px' }}>Finance</h1>
          <div style={{ fontSize: 13, color: C.sub, marginBottom: unlocked ? 10 : 14 }}>Cash coming in and going out, and when to pay what. Senior admins only.</div>
          {unlocked && (
            <div role="tablist" aria-label="Finance sections" style={{ display: 'flex', gap: 22, overflowX: 'auto' }}>
              {tabs.map(t => <button key={t.id} type="button" role="tab" aria-selected={section === t.id} onClick={() => setSection(t.id)} style={{ border: 'none', background: 'none', padding: '8px 0 10px', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: section === t.id ? C.ink : C.sub, borderBottom: `2px solid ${section === t.id ? C.blue : 'transparent'}`, whiteSpace: 'nowrap', fontFamily: FONT }}>{t.label}</button>)}
            </div>
          )}
        </div>
      </div>
      <main style={{ maxWidth: 1180, margin: '0 auto', padding: '20px 16px 60px', display: 'grid', gap: 16 }}>
        {err ? <Note tone="red">{err}</Note> : !status ? <div style={{ color: C.sub, fontSize: 14 }}>Checking…</div> : !unlocked ? (
          <LockScreen status={status} me={myEmail} onUnlocked={() => void loadStatus()} />
        ) : section === 'settings' ? <SettingsSection onSaved={() => void loadOutlook(true)} />
          : section === 'codes' ? <CodesSection me={myEmail} onSelfReset={relock} />
            : oErr ? <Note tone="red">{oErr} <button type="button" onClick={() => loadOutlook(true)} style={{ color: C.blue, background: 'none', border: 'none', fontWeight: 600, cursor: 'pointer' }}>Try again</button></Note>
              : !outlook ? <div style={{ color: C.sub, fontSize: 14 }}>Reading QuickBooks and Nexus…</div>
                : section === 'payplan' ? <PayPlanSection data={outlook} onTier={setTier} />
                  : <OutlookSection data={outlook} refresh={() => loadOutlook(true)} busy={busy} />}
      </main>
    </div>
  )
}
