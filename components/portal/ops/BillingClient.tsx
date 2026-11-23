'use client'

/**
 * BillingClient — property portal → Billing. The property's real invoices from
 * Gate Guard (Nexus + QuickBooks): what's owed, what's late, what's due next,
 * paid in 90 days; every invoice with its lines and a Pay button when there's a
 * pay link. API /api/portal/[slug]/billing (lib/portal-billing.ts). View = portal code.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { OpsShell, C } from '@/components/portal/ops/OpsShell'
import { OK_CSS, Sheet, Dot, DOT, call, day, money, type Any } from '@/components/portal/ops/opsKit'

const STATUS: Record<string, { label: string; dot: string }> = {
  paid: { label: 'Paid', dot: DOT.green }, open: { label: 'Open', dot: DOT.blue },
  partial: { label: 'Partly paid', dot: DOT.blue }, overdue: { label: 'Past due', dot: DOT.red },
}

export function InvoiceSheet({ slug, inv, onClose }: { slug: string; inv: Any; onClose: () => void }) {
  const [lines, setLines] = useState<Any[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => { void call(`/api/portal/${slug}/billing?invoice=${inv.id}`).then(r => { if (r.ok) setLines(r.data.lines ?? []); else setErr(r.data.error || 'Could not load this invoice.') }) }, [slug, inv.id])
  const st = STATUS[inv.status] ?? STATUS.open
  return (
    <Sheet title={`Invoice ${inv.number}`} sub={`Issued ${day(inv.issue_date)} · Due ${day(inv.due_date)}`} onClose={onClose} width={620}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="ok-pill"><Dot c={st.dot} />{st.label}{inv.days_late > 0 ? ` · ${inv.days_late} days` : ''}</span>
        {inv.from_quickbooks && <span className="ok-pill">QuickBooks</span>}
      </div>
      {err && <div className="ok-note red">{err}</div>}
      {!lines && !err ? <div className="ok-empty">Loading…</div> : lines && (
        lines.length ? (
          <div className="ok-tw"><table className="ok-tbl">
            <thead><tr><th>Item</th><th style={{ textAlign: 'right' }}>Qty</th><th style={{ textAlign: 'right' }}>Price</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
            <tbody>{lines.map((l, i) => <tr key={i}><td>{l.description}</td><td style={{ textAlign: 'right' }}>{l.qty}</td><td style={{ textAlign: 'right' }}>{money(l.unit_price)}</td><td style={{ textAlign: 'right' }}>{money(l.amount)}</td></tr>)}</tbody>
          </table></div>
        ) : <div className="ok-empty">No line detail on this invoice.</div>
      )}
      <div style={{ display: 'grid', gap: 6, justifyContent: 'end', textAlign: 'right', fontSize: 14 }}>
        <div>Total <b style={{ marginLeft: 12 }}>{money(inv.total)}</b></div>
        <div style={{ color: C.ink3 }}>Paid <span style={{ marginLeft: 12 }}>{money(inv.paid)}</span></div>
        <div style={{ fontSize: 16 }}>Balance <b style={{ marginLeft: 12 }}>{money(inv.balance)}</b></div>
      </div>
      {inv.notes && <div className="ok-note">{inv.notes}</div>}
      {inv.balance > 0 && (inv.pay_url
        ? <a className="ok-btn pri" href={inv.pay_url} target="_blank" rel="noopener noreferrer" style={{ justifySelf: 'end' }}>Pay {money(inv.balance)}</a>
        : <div className="ok-note">Online payment isn’t set up for this invoice yet — call Gate Guard to pay by card or ACH.</div>)}
    </Sheet>
  )
}

function Inner({ slug }: { slug: string }) {
  const [d, setD] = useState<Any | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [show, setShow] = useState<'open' | 'all'>('open')
  const [open, setOpen] = useState<Any | null>(null)
  const load = useCallback(async () => {
    const r = await call(`/api/portal/${slug}/billing`)
    setD(r.data); setErr(r.ok ? null : (r.data.error || 'Could not load billing.'))
  }, [slug])
  useEffect(() => { void load() }, [load])
  const invoices: Any[] = useMemo(() => (d?.invoices ?? []).filter((i: Any) => show === 'all' || i.balance > 0), [d, show])
  const openCount = (d?.invoices ?? []).filter((i: Any) => i.balance > 0).length

  return (
    <div className="ok-wrap">
      <style dangerouslySetInnerHTML={{ __html: OK_CSS }} />
      <div className="ok-kpis">
        <div className="ok-kpi"><div className="ok-k"><Dot c={DOT.blue} />Balance</div><div className="ok-num">{d ? money(d.balance ?? 0) : '—'}</div><div className="ok-s">{d ? `${openCount} open invoice${openCount === 1 ? '' : 's'}` : ' '}</div></div>
        <div className="ok-kpi"><div className="ok-k"><Dot c={(d?.overdue ?? 0) > 0 ? DOT.red : DOT.green} />Past due</div><div className="ok-num" style={{ color: (d?.overdue ?? 0) > 0 ? C.alert : undefined }}>{d ? money(d.overdue ?? 0) : '—'}</div><div className="ok-s">{(d?.overdue ?? 0) > 0 ? 'Please pay these first' : 'Nothing late'}</div></div>
        <div className="ok-kpi"><div className="ok-k"><Dot c={DOT.gray} />Next due</div><div className="ok-num">{d?.due_next ? money(d.due_next.amount) : '—'}</div><div className="ok-s">{d?.due_next ? day(d.due_next.date) : 'Nothing coming up'}</div></div>
        <div className="ok-kpi"><div className="ok-k"><Dot c={DOT.green} />Paid · 90 days</div><div className="ok-num">{d ? money(d.paid_90 ?? 0) : '—'}</div><div className="ok-s">Thank you</div></div>
      </div>

      <div className="ok-card">
        <div className="ok-hd">
          <div><h3>Invoices</h3><div className="sub">From Gate Guard for this property. Open one to see what it’s for and pay it.</div></div>
          <div className="ok-seg" role="group" aria-label="Show">
            <button type="button" aria-pressed={show === 'open'} onClick={() => setShow('open')}>Open</button>
            <button type="button" aria-pressed={show === 'all'} onClick={() => setShow('all')}>All</button>
          </div>
        </div>
        {err && <div className="ok-note red">{err}</div>}
        {!d ? <div className="ok-empty">Loading…</div> : !invoices.length ? (
          <div className="ok-empty">{show === 'open' ? 'You’re all paid up.' : 'No invoices yet.'}</div>
        ) : (
          <div className="ok-tw"><table className="ok-tbl">
            <thead><tr><th>Invoice</th><th>Issued</th><th>Due</th><th>Status</th><th style={{ textAlign: 'right' }}>Total</th><th style={{ textAlign: 'right' }}>Balance</th><th /></tr></thead>
            <tbody>{invoices.map(i => {
              const st = STATUS[i.status] ?? STATUS.open
              return (
                <tr key={i.id} className="click" onClick={() => setOpen(i)} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') setOpen(i) }}>
                  <td style={{ fontWeight: 600 }}>{i.number}</td>
                  <td style={{ color: C.ink3 }}>{day(i.issue_date)}</td>
                  <td style={{ color: C.ink3 }}>{day(i.due_date)}</td>
                  <td><span className="ok-pill"><Dot c={st.dot} />{st.label}{i.days_late > 0 ? ` · ${i.days_late}d` : ''}</span></td>
                  <td style={{ textAlign: 'right' }}>{money(i.total)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{money(i.balance)}</td>
                  <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                    {i.balance > 0 && i.pay_url && <a className="ok-btn sm pri" href={i.pay_url} target="_blank" rel="noopener noreferrer">Pay</a>}
                  </td>
                </tr>
              )
            })}</tbody>
          </table></div>
        )}
        <div style={{ fontSize: 12.5, color: C.ink3, marginTop: 10 }}>Questions about a bill? Use Service → Request service, or call Gate Guard.</div>
      </div>
      {open && <InvoiceSheet slug={slug} inv={open} onClose={() => setOpen(null)} />}
    </div>
  )
}

export default function BillingClient({ slug, displayName }: { slug: string; displayName: string }) {
  return <OpsShell slug={slug} displayName={displayName} active="billing"><Inner slug={slug} /></OpsShell>
}
