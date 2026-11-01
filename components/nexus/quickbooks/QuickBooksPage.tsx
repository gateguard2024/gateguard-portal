'use client'
/**
 * QuickBooks — Gate Guard corporate only (Admin → QuickBooks, or /?view=admin&qb=1).
 *
 * One full-screen page, five sections:
 *   Money      cash, who owes us (by age), bills we owe, profit this month / last / YTD
 *   Setup      connect, start date, default item, accounts, auto-sync switches
 *   Customers  link each property to a QuickBooks customer (auto-match / create / pick)
 *   Products   link catalog items to QuickBooks items
 *   Activity   sync now, what was sent / received, problems with the reason
 *
 * Every number comes from /api/integrations/quickbooks/* (all corporate-only server-side).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>
type Section = 'money' | 'setup' | 'customers' | 'products' | 'activity'

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", Inter, system-ui, sans-serif'
const C = { bg: '#F5F5F7', card: '#FFFFFF', line: 'rgba(0,0,0,0.08)', ink: '#1D1D1F', sub: '#6E6E73', faint: '#86868B', blue: '#0071E3', blueSoft: 'rgba(0,113,227,0.08)', green: '#1A7F37', orange: '#B25000', red: '#C9341F' }
const money = (n: unknown, cents = false) => {
  const v = Number(n)
  if (!isFinite(v)) return '—'
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: cents ? 2 : 0, minimumFractionDigits: cents ? 2 : 0 })
}
const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Never')

async function api<T = Row>(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  try {
    const r = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } })
    const data = await r.json().catch(() => ({}))
    return { ok: r.ok, status: r.status, data }
  } catch (e) {
    return { ok: false, status: 0, data: { error: e instanceof Error ? e.message : 'Network error' } as T & { error?: string } }
  }
}

// ── Small pieces ─────────────────────────────────────────────────────────────
function Card({ title, right, children, pad = true }: { title?: string; right?: React.ReactNode; children: React.ReactNode; pad?: boolean }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12 }}>
      {(title || right) && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 16px 0' }}><div style={{ fontSize: 15, fontWeight: 600, color: C.ink }}>{title}</div>{right}</div>}
      <div style={pad ? { padding: 16 } : undefined}>{children}</div>
    </div>
  )
}
function Btn({ children, onClick, kind = 'primary', disabled, small }: { children: React.ReactNode; onClick?: () => void; kind?: 'primary' | 'plain' | 'danger'; disabled?: boolean; small?: boolean }) {
  const s = kind === 'primary' ? { background: C.blue, color: '#fff', border: `1px solid ${C.blue}` } : kind === 'danger' ? { background: '#fff', color: C.red, border: `1px solid rgba(201,52,31,0.35)` } : { background: '#fff', color: C.blue, border: `1px solid ${C.line}` }
  return <button type="button" onClick={onClick} disabled={disabled} style={{ ...s, borderRadius: 10, padding: small ? '6px 10px' : '9px 14px', fontSize: small ? 12 : 13, fontWeight: 600, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1, whiteSpace: 'nowrap', fontFamily: FONT }}>{children}</button>
}
function Dot({ tone }: { tone: 'green' | 'orange' | 'red' | 'gray' }) {
  const c = tone === 'green' ? '#30D158' : tone === 'orange' ? '#FF9F0A' : tone === 'red' ? '#FF453A' : '#C7C7CC'
  return <span aria-hidden style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: c, flex: 'none' }} />
}
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label style={{ display: 'block' }}><div style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 6 }}>{label}</div>{children}{hint && <div style={{ fontSize: 12, color: C.sub, marginTop: 5, lineHeight: 1.4 }}>{hint}</div>}</label>
}
const inputStyle: React.CSSProperties = { width: '100%', border: `1px solid ${C.line}`, borderRadius: 10, padding: '9px 10px', fontSize: 14, color: C.ink, background: '#fff', fontFamily: FONT }
function Select({ value, onChange, options, placeholder }: { value: string | null | undefined; onChange: (v: string) => void; options: { id: string; name: string }[]; placeholder: string }) {
  return <select value={value ?? ''} onChange={e => onChange(e.target.value)} style={inputStyle}><option value="">{placeholder}</option>{options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
}
function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
      <div><div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>{label}</div>{hint && <div style={{ fontSize: 12, color: C.sub, marginTop: 3, lineHeight: 1.4 }}>{hint}</div>}</div>
      <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} style={{ flex: 'none', width: 46, height: 28, borderRadius: 14, border: 'none', background: on ? '#34C759' : '#E5E5EA', position: 'relative', cursor: 'pointer' }}>
        <span style={{ position: 'absolute', top: 2, left: on ? 20 : 2, width: 24, height: 24, borderRadius: 12, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', transition: 'left .15s' }} />
      </button>
    </div>
  )
}
function Note({ tone = 'gray', children }: { tone?: 'gray' | 'red' | 'green' | 'blue'; children: React.ReactNode }) {
  const m = { gray: ['#F5F5F7', C.sub], red: ['#FDECEA', C.red], green: ['#E8F6EC', C.green], blue: [C.blueSoft, C.blue] }[tone]
  return <div role={tone === 'red' ? 'alert' : undefined} style={{ background: m[0], color: m[1], borderRadius: 10, padding: '10px 12px', fontSize: 13, lineHeight: 1.45 }}>{children}</div>
}

// ── Money ────────────────────────────────────────────────────────────────────
function MoneySection({ connected }: { connected: boolean }) {
  const [data, setData] = useState<Row | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [report, setReport] = useState<{ view: string; rep: Row | null; err?: string } | null>(null)
  const load = useCallback(async (refresh = false) => {
    setBusy(true); setErr(null)
    const r = await api(`/api/integrations/quickbooks/reports?view=overview${refresh ? '&refresh=1' : ''}`)
    if (r.ok) setData(r.data); else setErr(r.data.error ?? 'Couldn’t read QuickBooks.')
    setBusy(false)
  }, [])
  useEffect(() => { if (connected) void load() }, [connected, load])
  const open = async (view: string) => {
    setReport({ view, rep: null })
    const r = await api(`/api/integrations/quickbooks/reports?view=${view}`)
    setReport(r.ok ? { view, rep: r.data } : { view, rep: null, err: r.data.error ?? 'Couldn’t load the report.' })
  }
  if (!connected) return <Note>Connect QuickBooks in Setup to see cash, money owed and profit here.</Note>
  if (err) return <Note tone="red">{err} <button type="button" onClick={() => load(true)} style={{ color: C.blue, background: 'none', border: 'none', fontWeight: 600, cursor: 'pointer' }}>Try again</button></Note>
  if (!data) return <div style={{ color: C.sub, fontSize: 14 }}>Reading QuickBooks…</div>
  const ar = data.receivable ?? {}
  const buckets = [
    { label: 'Not due yet', v: ar.current }, { label: '1–30 days late', v: ar.d1_30 }, { label: '31–60 days late', v: ar.d31_60 },
    { label: '61–90 days late', v: ar.d61_90 }, { label: 'Over 90 days late', v: ar.over90 },
  ]
  const maxB = Math.max(1, ...buckets.map(b => Number(b.v) || 0))
  const late = (Number(ar.d1_30) || 0) + (Number(ar.d31_60) || 0) + (Number(ar.d61_90) || 0) + (Number(ar.over90) || 0)
  const pnl = data.pnl ?? {}
  const delta = (Number(pnl.thisMonth?.net) || 0) - (Number(pnl.lastMonth?.net) || 0)
  const tiles = [
    { label: 'Cash in the bank', value: money(data.cash?.total), sub: `${(data.cash?.accounts ?? []).length} account${(data.cash?.accounts ?? []).length === 1 ? '' : 's'}` },
    { label: 'Customers owe us', value: money(ar.total), sub: late > 0 ? `${money(late)} is late` : 'Nothing late', tone: late > 0 ? 'orange' as const : 'green' as const },
    { label: 'We owe (bills)', value: money(data.payable?.total), sub: 'Open bills in QuickBooks' },
    { label: 'Profit this month', value: money(pnl.thisMonth?.net), sub: `${delta >= 0 ? '+' : '−'}${money(Math.abs(delta))} vs last month (so far)` },
  ]
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12, color: C.sub }}>From QuickBooks · updated {when(data.asOf)}</div>
        <Btn kind="plain" small onClick={() => load(true)} disabled={busy}>{busy ? 'Refreshing…' : 'Refresh'}</Btn>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
        {tiles.map(t => (
          <div key={t.label} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 13, color: C.sub }}>{t.label}</div>
            <div style={{ fontSize: 28, fontWeight: 600, color: C.ink, marginTop: 4, letterSpacing: '-0.01em' }}>{t.value}</div>
            <div style={{ fontSize: 12, color: C.sub, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>{t.tone && <Dot tone={t.tone} />}{t.sub}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <Card title="Money owed to us, by age" right={<Btn kind="plain" small onClick={() => open('ar')}>Full report</Btn>}>
          <div style={{ display: 'grid', gap: 10 }}>
            {buckets.map(b => (
              <div key={b.label} title={`${b.label}: ${money(b.v, true)}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: C.ink }}><span>{b.label}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{money(b.v)}</span></div>
                <div style={{ height: 6, background: '#F2F2F7', borderRadius: 3, marginTop: 5 }}><div style={{ width: `${Math.max(Number(b.v) > 0 ? 2 : 0, (Number(b.v) || 0) / maxB * 100)}%`, height: 6, borderRadius: 3, background: C.blue }} /></div>
              </div>
            ))}
          </div>
          {(ar.late ?? []).length > 0 && <>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginTop: 18, marginBottom: 6 }}>Most late</div>
            {(ar.late as Row[]).map(l => <div key={l.customer} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, padding: '7px 0', borderTop: `1px solid ${C.line}` }}><span style={{ color: C.ink }}>{l.customer}</span><span style={{ color: C.sub, fontVariantNumeric: 'tabular-nums' }}>{money(l.overdue)} late of {money(l.total)}</span></div>)}
          </>}
        </Card>
        <Card title="Profit & loss" right={<Btn kind="plain" small onClick={() => open('pnl')}>Full report</Btn>}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
            <thead><tr style={{ color: C.sub, textAlign: 'right' }}><th style={{ textAlign: 'left', fontWeight: 500, padding: '0 0 8px' }}></th><th style={{ fontWeight: 500 }}>This month</th><th style={{ fontWeight: 500 }}>Last month</th><th style={{ fontWeight: 500 }}>This year</th></tr></thead>
            <tbody>
              {([['Income', 'income'], ['Expenses', 'expenses'], ['Profit', 'net']] as const).map(([lab, k]) => (
                <tr key={k} style={{ borderTop: `1px solid ${C.line}`, fontWeight: k === 'net' ? 600 : 400, color: C.ink }}>
                  <td style={{ padding: '9px 0' }}>{lab}</td><td style={{ textAlign: 'right' }}>{money(pnl.thisMonth?.[k])}</td><td style={{ textAlign: 'right' }}>{money(pnl.lastMonth?.[k])}</td><td style={{ textAlign: 'right' }}>{money(pnl.ytd?.[k])}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}><Btn kind="plain" small onClick={() => open('ap')}>Bills we owe</Btn><Btn kind="plain" small onClick={() => open('balance')}>Balance sheet</Btn></div>
          {(data.cash?.accounts ?? []).length > 0 && <>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginTop: 18, marginBottom: 6 }}>Bank accounts</div>
            {(data.cash.accounts as Row[]).map(a => <div key={a.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '7px 0', borderTop: `1px solid ${C.line}` }}><span style={{ color: C.ink }}>{a.name}</span><span style={{ color: C.sub, fontVariantNumeric: 'tabular-nums' }}>{money(a.balance, true)}</span></div>)}
          </>}
        </Card>
      </div>
      {report && <ReportSheet view={report.view} rep={report.rep} err={report.err} onClose={() => setReport(null)} />}
    </div>
  )
}

function ReportSheet({ view, rep, err, onClose }: { view: string; rep: Row | null; err?: string; onClose: () => void }) {
  const names: Record<string, string> = { pnl: 'Profit & loss — this month', ar: 'Money owed to us', ap: 'Bills we owe', balance: 'Balance sheet' }
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])
  return (
    <div role="dialog" aria-modal="true" aria-label={names[view] ?? 'Report'} onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 130, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: 'min(860px, 100%)', maxHeight: '86vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: `1px solid ${C.line}` }}>
          <div><div style={{ fontSize: 16, fontWeight: 600, color: C.ink }}>{names[view] ?? 'Report'}</div>{rep?.period && <div style={{ fontSize: 12, color: C.sub }}>{rep.period}</div>}</div>
          <Btn kind="plain" small onClick={onClose}>Done</Btn>
        </div>
        <div style={{ overflow: 'auto', padding: 16 }}>
          {err ? <Note tone="red">{err}</Note> : !rep ? <div style={{ color: C.sub, fontSize: 14 }}>Loading…</div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
              <thead><tr>{['', ...(rep.columns as string[])].map((c, i) => <th key={i} style={{ textAlign: i ? 'right' : 'left', color: C.sub, fontWeight: 500, padding: '0 8px 8px', position: 'sticky', top: 0, background: '#fff' }}>{c}</th>)}</tr></thead>
              <tbody>{(rep.rows as Row[]).map((r, i) => (
                <tr key={i} style={{ borderTop: `1px solid ${C.line}`, fontWeight: r.kind === 'data' ? 400 : 600, color: C.ink }}>
                  <td style={{ padding: `7px 8px 7px ${8 + r.depth * 14}px` }}>{r.label}</td>
                  {(r.values as (number | string | null)[]).map((v, j) => <td key={j} style={{ textAlign: 'right', padding: '7px 8px' }}>{typeof v === 'number' ? money(v, true) : v ?? ''}</td>)}
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Setup ────────────────────────────────────────────────────────────────────
const SERVICE_TYPES: { key: string; label: string }[] = [
  { key: 'video_monitoring', label: 'Video monitoring' }, { key: 'access_plan', label: 'Access plan' }, { key: 'one_time', label: 'One-time charge' },
  { key: 'service_call', label: 'Service call' }, { key: 'labor', label: 'Labor' }, { key: 'equipment', label: 'Equipment' },
]
function SetupSection({ status, reload }: { status: Row; reload: () => void }) {
  const [look, setLook] = useState<Row | null>(null)
  const [lookErr, setLookErr] = useState<string | null>(null)
  const [s, setS] = useState<Row>(status.settings ?? {})
  const [msg, setMsg] = useState<{ tone: 'red' | 'green'; text: string } | null>(null)
  const [saving, setSaving] = useState(false)
  useEffect(() => { setS(status.settings ?? {}) }, [status.settings])
  useEffect(() => {
    if (!status.connected) return
    void api('/api/integrations/quickbooks/lookups').then(r => (r.ok ? setLook(r.data) : setLookErr(r.data.error ?? 'Couldn’t load accounts and items from QuickBooks.')))
  }, [status.connected])
  const save = async (patch: Row) => {
    setSaving(true); setMsg(null)
    const r = await api('/api/integrations/quickbooks/status', { method: 'PATCH', body: JSON.stringify(patch) })
    setSaving(false)
    if (!r.ok) { setMsg({ tone: 'red', text: r.data.error ?? 'Couldn’t save.' }); return false }
    setMsg({ tone: 'green', text: 'Saved.' }); reload(); return true
  }
  const disconnect = async () => {
    if (!window.confirm('Disconnect QuickBooks? Sync stops. Links and history are kept — you can reconnect any time.')) return
    const r = await api('/api/integrations/quickbooks/status', { method: 'DELETE' })
    if (!r.ok) setMsg({ tone: 'red', text: r.data.error ?? 'Couldn’t disconnect.' }); else reload()
  }
  const reconnectDays = status.reconnectBy ? Math.ceil((new Date(status.reconnectBy).getTime() - Date.now()) / 86400000) : null
  const dirty = JSON.stringify(s) !== JSON.stringify(status.settings ?? {})
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 820 }}>
      <Card title="Connection">
        {!status.keysConfigured ? <Note tone="red">The QuickBooks app keys aren’t set on the server yet (QBO_CLIENT_ID, QBO_CLIENT_SECRET, QBO_REDIRECT_URI). Add them in Vercel, then come back.</Note>
          : status.connected ? (
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: C.ink }}><Dot tone="green" /><b style={{ fontWeight: 600 }}>{status.company ?? 'QuickBooks company'}</b><span style={{ color: C.sub }}>· {status.environment === 'sandbox' ? 'Sandbox (test company)' : 'Live'}</span></div>
              {reconnectDays != null && reconnectDays < 21 && <Note tone="red">QuickBooks sign-in expires in {Math.max(0, reconnectDays)} day{reconnectDays === 1 ? '' : 's'}. Tap Reconnect to keep syncing.</Note>}
              {!status.webhookConfigured && <Note>Instant updates from QuickBooks are off (QBO_WEBHOOK_VERIFIER isn’t set). Changes still come back every 15 minutes.</Note>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><Btn kind="plain" onClick={() => { window.location.href = '/api/integrations/quickbooks/connect' }}>Reconnect</Btn><Btn kind="danger" onClick={disconnect}>Disconnect</Btn></div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ fontSize: 14, color: C.sub, lineHeight: 1.5 }}>Sign in to Gate Guard’s QuickBooks once. Nothing is sent until you finish setup and turn on automatic sync.</div>
              <div><Btn onClick={() => { window.location.href = '/api/integrations/quickbooks/connect' }}>Connect QuickBooks</Btn></div>
            </div>
          )}
      </Card>
      {status.connected && <>
        {lookErr && <Note tone="red">{lookErr}</Note>}
        <Card title="What goes to QuickBooks">
          <div style={{ display: 'grid', gap: 16 }}>
            <Field label="Start date" hint="Only invoices and commissions dated on or after this go to QuickBooks. Older ones stay in Nexus so nothing is entered twice.">
              <input type="date" value={s.sync_start_date ?? ''} onChange={e => setS({ ...s, sync_start_date: e.target.value || null })} style={inputStyle} />
            </Field>
            <Field label="Default QuickBooks item" hint="Used for any invoice line that isn’t matched to a product or a service type below.">
              <Select value={s.default_item_id} onChange={v => setS({ ...s, default_item_id: v || null })} options={look?.items ?? []} placeholder={look ? 'Pick an item…' : 'Loading…'} />
            </Field>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 6 }}>Items by service type <span style={{ color: C.sub, fontWeight: 400 }}>(optional)</span></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
                {SERVICE_TYPES.map(t => (
                  <div key={t.key}><div style={{ fontSize: 12, color: C.sub, marginBottom: 4 }}>{t.label}</div>
                    <Select value={s.item_map?.[t.key]} onChange={v => setS({ ...s, item_map: { ...(s.item_map ?? {}), [t.key]: v } })} options={look?.items ?? []} placeholder="Use the default item" /></div>
                ))}
              </div>
            </div>
            <Field label="Income account for new items" hint="When you create a QuickBooks item from a catalog product, its sales post here.">
              <Select value={s.income_account_id} onChange={v => setS({ ...s, income_account_id: v || null })} options={look?.income ?? []} placeholder="Pick an income account…" />
            </Field>
            <Field label="Where payments land" hint="Leave blank to use Undeposited Funds (QuickBooks’ default).">
              <Select value={s.deposit_account_id} onChange={v => setS({ ...s, deposit_account_id: v || null })} options={look?.deposit ?? []} placeholder="Undeposited Funds" />
            </Field>
          </div>
        </Card>
        <Card title="Dealer commissions">
          <div style={{ display: 'grid', gap: 16 }}>
            <Toggle on={!!s.sync_commissions} onChange={v => setS({ ...s, sync_commissions: v })} label="Send approved commissions as QuickBooks bills" hint="Each approved dealer commission becomes a bill to that dealer (created as a vendor if needed). When the bill is paid in QuickBooks, the commission is marked paid here." />
            {s.sync_commissions && <Field label="Expense account for commissions"><Select value={s.commission_account_id} onChange={v => setS({ ...s, commission_account_id: v || null })} options={look?.expense ?? []} placeholder="Pick an expense account…" /></Field>}
          </div>
        </Card>
        <Card title="Automatic sync">
          <div style={{ display: 'grid', gap: 16 }}>
            <Toggle on={!!s.auto_create_customers} onChange={v => setS({ ...s, auto_create_customers: v })} label="Create missing customers" hint="If an invoice’s property isn’t linked yet, create it as a QuickBooks customer instead of stopping." />
            <Toggle on={!!s.auto_sync} onChange={v => setS({ ...s, auto_sync: v })} label="Sync automatically" hint="Every 15 minutes (and right away when an invoice is paid): new invoices and payments go to QuickBooks. Changes made in QuickBooks always come back, even with this off." />
          </div>
        </Card>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', position: 'sticky', bottom: 0, padding: '10px 0', background: C.bg }}>
          <Btn onClick={() => save({ ...s })} disabled={saving || !dirty}>{saving ? 'Saving…' : 'Save settings'}</Btn>
          {dirty && <Btn kind="plain" onClick={() => setS(status.settings ?? {})}>Undo changes</Btn>}
          {msg && <span role="status" style={{ fontSize: 13, color: msg.tone === 'red' ? C.red : C.green }}>{msg.text}</span>}
        </div>
      </>}
    </div>
  )
}

// ── Matching (customers + products) ──────────────────────────────────────────
function MatchSection({ kind, connected, onChanged }: { kind: 'sites' | 'products'; connected: boolean; onChanged: () => void }) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [options, setOptions] = useState<{ id: string; name: string }[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'unlinked' | 'suggested' | 'linked' | 'all'>('unlinked')
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ tone: 'red' | 'green'; text: string } | null>(null)
  const noun = kind === 'sites' ? { one: 'property', many: 'properties', qb: 'customer' } : { one: 'product', many: 'products', qb: 'item' }
  const load = useCallback(async () => {
    setErr(null)
    const r = await api(`/api/integrations/quickbooks/mapping?kind=${kind}`)
    if (r.ok) { setRows(r.data.rows ?? []); setOptions(r.data.options ?? []) } else setErr(r.data.error ?? 'Couldn’t load.')
  }, [kind])
  useEffect(() => { if (connected) void load() }, [connected, load])
  const post = async (body: Row, label: string) => {
    setBusy(label); setMsg(null)
    const r = await api('/api/integrations/quickbooks/mapping', { method: 'POST', body: JSON.stringify({ kind, ...body }) })
    setBusy(null)
    const d = r.data
    if (!r.ok) setMsg({ tone: 'red', text: d.error ?? (d.errors ?? [])[0] ?? 'Didn’t work.' })
    else {
      const n = d.saved ?? d.created ?? 0
      const extra = (d.errors ?? []).length ? ` ${(d.errors as string[]).length} couldn’t: ${(d.errors as string[])[0]}` : ''
      setMsg({ tone: extra ? 'red' : 'green', text: `${n} ${n === 1 ? noun.one : noun.many} ${body.action === 'create' ? 'created in QuickBooks and linked' : 'linked'}.${d.more ? ' More left — run it again.' : ''}${extra}` })
    }
    await load(); onChanged()
  }
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    return (rows ?? []).filter(r => (filter === 'all' || (filter === 'linked' ? !!r.qbo_id : filter === 'suggested' ? !r.qbo_id && !!r.suggestion : !r.qbo_id)) && (!t || `${r.name} ${r.sub ?? ''} ${r.qbo_name ?? ''}`.toLowerCase().includes(t)))
  }, [rows, q, filter])
  if (!connected) return <Note>Connect QuickBooks in Setup first.</Note>
  if (err) return <Note tone="red">{err}</Note>
  if (!rows) return <div style={{ color: C.sub, fontSize: 14 }}>Loading {noun.many} and QuickBooks {noun.qb}s…</div>
  const counts = { linked: rows.filter(r => r.qbo_id).length, suggested: rows.filter(r => !r.qbo_id && r.suggestion).length, unlinked: rows.filter(r => !r.qbo_id).length }
  const unlinkedShown = shown.filter(r => !r.qbo_id).slice(0, 100)
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Note tone="blue">{kind === 'sites'
        ? 'Each property is billed to one QuickBooks customer. Link the ones that already exist in QuickBooks; Create makes a new customer with the property’s name and address.'
        : 'Link catalog products to QuickBooks items so invoice lines post to the right item. Unlinked lines use your default item.'}</Note>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ fontSize: 14, color: C.ink }}><b style={{ fontWeight: 600 }}>{counts.linked}</b> of {rows.length} linked</div>
        <div style={{ flex: 1 }} />
        <Btn onClick={() => post({ action: 'auto' }, 'auto')} disabled={!!busy || !counts.suggested}>{busy === 'auto' ? 'Linking…' : `Link ${counts.suggested} exact match${counts.suggested === 1 ? '' : 'es'}`}</Btn>
        <Btn kind="plain" onClick={() => { if (window.confirm(`Create ${unlinkedShown.length} new QuickBooks ${noun.qb}${unlinkedShown.length === 1 ? '' : 's'} for the unlinked ${noun.many} shown?`)) void post({ action: 'create', ids: unlinkedShown.map(r => r.id) }, 'create') }} disabled={!!busy || !unlinkedShown.length}>{busy === 'create' ? 'Creating…' : `Create ${unlinkedShown.length} in QuickBooks`}</Btn>
      </div>
      {msg && <Note tone={msg.tone}>{msg.text}</Note>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={`Search ${noun.many}`} aria-label={`Search ${noun.many}`} style={{ ...inputStyle, flex: '1 1 220px', width: 'auto' }} />
        <div role="tablist" style={{ display: 'flex', background: '#E9E9EE', borderRadius: 10, padding: 2 }}>
          {([['unlinked', `Not linked ${counts.unlinked}`], ['suggested', `Suggested ${counts.suggested}`], ['linked', `Linked ${counts.linked}`], ['all', 'All']] as const).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={filter === k} onClick={() => setFilter(k)} style={{ border: 'none', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: filter === k ? '#fff' : 'transparent', color: filter === k ? C.ink : C.sub, boxShadow: filter === k ? '0 1px 2px rgba(0,0,0,0.12)' : 'none', fontFamily: FONT }}>{l}</button>
          ))}
        </div>
      </div>
      <Card pad={false}>
        {!shown.length ? <div style={{ padding: 16, color: C.sub, fontSize: 14 }}>Nothing here.</div> : shown.slice(0, 300).map((r, i) => (
          <div key={r.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.1fr) auto', gap: 12, alignItems: 'center', padding: '10px 16px', borderTop: i ? `1px solid ${C.line}` : 'none' }}>
            <div style={{ minWidth: 0 }}><div style={{ fontSize: 14, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>{r.sub && <div style={{ fontSize: 12, color: C.sub }}>{r.sub}</div>}</div>
            <div style={{ minWidth: 0 }}>
              <select aria-label={`QuickBooks ${noun.qb} for ${r.name}`} value={r.qbo_id ?? ''} disabled={!!busy} onChange={e => post({ links: [{ id: r.id, qbo_id: e.target.value || null }] }, r.id)} style={{ ...inputStyle, padding: '7px 8px', fontSize: 13, color: r.qbo_id ? C.ink : C.sub }}>
                <option value="">{r.suggestion ? `Not linked — suggested: ${r.suggestion.name}` : 'Not linked'}</option>
                {r.qbo_id && !options.some(o => o.id === String(r.qbo_id)) && <option value={r.qbo_id}>{r.qbo_name ?? 'Linked'}</option>}
                {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {!r.qbo_id && r.suggestion && <Btn small onClick={() => post({ links: [{ id: r.id, qbo_id: r.suggestion.id }] }, r.id)} disabled={!!busy}>Link</Btn>}
              {!r.qbo_id && !r.suggestion && <Btn small kind="plain" onClick={() => post({ action: 'create', ids: [r.id] }, r.id)} disabled={!!busy}>{busy === r.id ? '…' : 'Create'}</Btn>}
              {r.qbo_id && <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.green }}><Dot tone="green" />Linked</span>}
            </div>
          </div>
        ))}
        {shown.length > 300 && <div style={{ padding: 12, fontSize: 12, color: C.sub, borderTop: `1px solid ${C.line}` }}>Showing 300 of {shown.length} — search to narrow it down.</div>}
      </Card>
    </div>
  )
}

// ── Activity ─────────────────────────────────────────────────────────────────
function ActivitySection({ status, reload }: { status: Row; reload: () => void }) {
  const [d, setD] = useState<Row | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'red' | 'green'; text: string } | null>(null)
  const load = useCallback(async () => { const r = await api('/api/integrations/quickbooks/sync'); if (r.ok) setD(r.data) }, [])
  useEffect(() => { if (status.connected) void load() }, [status.connected, load])
  const run = async () => {
    setBusy(true); setMsg(null)
    const r = await api('/api/integrations/quickbooks/sync', { method: 'POST' })
    setBusy(false)
    if (!r.ok) setMsg({ tone: 'red', text: r.data.error ?? 'Sync didn’t run.' })
    else {
      const p = r.data.pulled ?? {}, s = r.data.pushed ?? {}
      setMsg({ tone: (p.errors || s.errors) ? 'red' : 'green', text: `Sent ${s.invoices ?? 0} invoice(s), ${s.payments ?? 0} payment(s), ${s.bills ?? 0} commission bill(s). Received ${p.invoices ?? 0} invoice update(s), ${p.created ?? 0} new, ${p.bills ?? 0} bill update(s).${(p.errors || s.errors) ? ` ${(p.errors ?? 0) + (s.errors ?? 0)} problem(s) — see below.` : ''}${r.data.more ? ' More waiting — tap again.' : ''}` })
    }
    await load(); reload()
  }
  if (!status.connected) return <Note>Connect QuickBooks in Setup first.</Note>
  const c = status.counts ?? {}
  const waiting = [
    { label: 'Invoices waiting to send', v: c.invoicesWaiting }, { label: 'Payments waiting to send', v: c.paymentsWaiting },
    { label: 'Commissions waiting', v: status.settings?.sync_commissions ? c.commissionsWaiting : null }, { label: 'Invoices with a problem', v: c.invoiceProblems, bad: true },
  ].filter(x => x.v != null)
  const probs = [...((d?.invoiceProblems ?? []) as Row[]).map(p => ({ k: `i${p.id}`, title: `Invoice ${p.invoice_number ?? ''}`.trim(), sub: money(p.total, true), err: p.qb_sync_error })), ...((d?.commissionProblems ?? []) as Row[]).map(p => ({ k: `c${p.id}`, title: `Commission ${p.pay_period ?? ''}`.trim(), sub: money(p.amount, true), err: p.qb_sync_error }))]
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Btn onClick={run} disabled={busy}>{busy ? 'Syncing…' : 'Sync now'}</Btn>
        <div style={{ fontSize: 13, color: C.sub }}>Last sync {when(status.lastSyncAt)} · {status.settings?.auto_sync ? 'automatic every 15 min' : 'automatic sync is off (changes from QuickBooks still come in)'}</div>
      </div>
      {msg && <Note tone={msg.tone}>{msg.text}</Note>}
      {status.settings?.auto_sync === false && !status.settings?.sync_start_date && <Note>Sync now only brings changes in from QuickBooks until you pick a start date in Setup.</Note>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
        {waiting.map(w => <div key={w.label} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14 }}><div style={{ fontSize: 12, color: C.sub }}>{w.label}</div><div style={{ fontSize: 24, fontWeight: 600, color: w.bad && Number(w.v) > 0 ? C.red : C.ink, marginTop: 2 }}>{w.v}</div></div>)}
      </div>
      {probs.length > 0 && <Card title="Problems to fix">{probs.map((p, i) => <div key={p.k} style={{ padding: '9px 0', borderTop: i ? `1px solid ${C.line}` : 'none' }}><div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, color: C.ink }}><Dot tone="red" />{p.title}<span style={{ color: C.sub, fontSize: 12 }}>{p.sub}</span></div><div style={{ fontSize: 13, color: C.sub, marginTop: 3, marginLeft: 16 }}>{p.err}</div></div>)}</Card>}
      <Card title="Recent activity">
        {!d ? <div style={{ color: C.sub, fontSize: 14 }}>Loading…</div> : !(d.log ?? []).length ? <div style={{ color: C.sub, fontSize: 14 }}>Nothing yet.</div> : (d.log as Row[]).map((l, i) => (
          <div key={l.id} style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) auto', gap: 10, alignItems: 'baseline', padding: '8px 0', borderTop: i ? `1px solid ${C.line}` : 'none', fontSize: 13 }}>
            <Dot tone={l.status === 'error' ? 'red' : l.status === 'skipped' ? 'gray' : 'green'} />
            <div style={{ minWidth: 0 }}><span style={{ color: C.ink }}>{l.direction === 'to_qb' ? 'Sent' : 'Received'} {l.entity}</span>{l.message && <span style={{ color: C.sub }}> — {l.message}</span>}</div>
            <div style={{ color: C.faint, fontSize: 12, whiteSpace: 'nowrap' }}>{when(l.created_at)}</div>
          </div>
        ))}
      </Card>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export function QuickBooksPage({ onClose, notice }: { onClose: () => void; notice?: { ok: boolean; reason?: string | null } | null }) {
  const [status, setStatus] = useState<Row | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [section, setSection] = useState<Section>('money')
  const load = useCallback(async () => {
    const r = await api('/api/integrations/quickbooks/status')
    if (r.ok) { setStatus(r.data); setErr(null) } else setErr(r.status === 403 ? 'QuickBooks is for Gate Guard corporate only.' : r.data.error ?? 'Couldn’t load QuickBooks status.')
  }, [])
  useEffect(() => { void load() }, [load])
  useEffect(() => { if (status && !status.connected) setSection('setup') }, [status?.connected]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('[role="dialog"][aria-label]:not([data-qb-root])')) onClose() }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])
  const c = status?.counts ?? {}
  const tabs: { id: Section; label: string; badge?: number }[] = [
    { id: 'money', label: 'Money' }, { id: 'setup', label: 'Setup' },
    { id: 'customers', label: 'Customers', badge: status?.connected && c.sitesTotal != null ? Math.max(0, c.sitesTotal - (c.sitesLinked ?? 0)) : undefined },
    { id: 'products', label: 'Products' },
    { id: 'activity', label: 'Activity', badge: status?.connected ? c.invoiceProblems || undefined : undefined },
  ]
  return (
    <div role="dialog" aria-modal="true" aria-label="QuickBooks" data-qb-root style={{ position: 'fixed', inset: 0, zIndex: 120, background: C.bg, overflowY: 'auto', fontFamily: FONT, color: C.ink, WebkitFontSmoothing: 'antialiased' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 2, background: 'rgba(245,245,247,0.86)', backdropFilter: 'saturate(180%) blur(20px)', borderBottom: `1px solid ${C.line}` }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '12px 16px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button type="button" onClick={onClose} style={{ border: 'none', background: 'none', color: C.blue, fontSize: 15, cursor: 'pointer', padding: 0, fontFamily: FONT }}>‹ Admin</button>
            <div style={{ flex: 1 }} />
            {status && <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.sub }}><Dot tone={status.connected ? 'green' : 'gray'} />{status.connected ? (status.company ?? 'Connected') : 'Not connected'}</div>}
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.015em', margin: '6px 0 2px' }}>QuickBooks</h1>
          <div style={{ fontSize: 13, color: C.sub, marginBottom: 10 }}>Gate Guard’s books, kept in step with Nexus. Corporate only.</div>
          <div role="tablist" aria-label="QuickBooks sections" style={{ display: 'flex', gap: 22, overflowX: 'auto' }}>
            {tabs.map(t => (
              <button key={t.id} type="button" role="tab" aria-selected={section === t.id} onClick={() => setSection(t.id)} style={{ border: 'none', background: 'none', padding: '8px 0 10px', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: section === t.id ? C.ink : C.sub, borderBottom: `2px solid ${section === t.id ? C.blue : 'transparent'}`, whiteSpace: 'nowrap', fontFamily: FONT }}>
                {t.label}{t.badge ? <span style={{ marginLeft: 6, fontSize: 11, color: C.sub, background: '#E9E9EE', borderRadius: 6, padding: '1px 6px' }}>{t.badge}</span> : null}
              </button>
            ))}
          </div>
        </div>
      </div>
      <main style={{ maxWidth: 1180, margin: '0 auto', padding: '20px 16px 60px', display: 'grid', gap: 16 }}>
        {notice && (notice.ok ? <Note tone="green">QuickBooks is connected. Finish Setup, match customers, then turn on automatic sync.</Note> : <Note tone="red">QuickBooks didn’t connect{notice.reason ? `: ${notice.reason}` : '.'} Try Connect again.</Note>)}
        {err ? <Note tone="red">{err}</Note> : !status ? <div style={{ color: C.sub, fontSize: 14 }}>Loading…</div> : (
          section === 'money' ? <MoneySection connected={!!status.connected} />
            : section === 'setup' ? <SetupSection status={status} reload={load} />
              : section === 'customers' ? <MatchSection key="sites" kind="sites" connected={!!status.connected} onChanged={load} />
                : section === 'products' ? <MatchSection key="products" kind="products" connected={!!status.connected} onChanged={load} />
                  : <ActivitySection status={status} reload={load} />
        )}
      </main>
    </div>
  )
}
