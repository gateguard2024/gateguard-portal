'use client'

/**
 * Sales board · deal panel (right side; expands to full page).
 * Every CRM field is here even when the card stays short. Fields save on blur/change.
 * Stage changes go through MoveDialog (onMoveRequest) so we always capture why.
 */
import { useCallback, useEffect, useState } from 'react'
import { ACT_TYPES, STAGES, fmtDate, localISO, money, stageIndex, type Deal } from './salesShared'
import { DealFields, Field } from './DealFields'
import { startProposal } from './proposal'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>
type Detail = { deal: Row; card: Deal; activities: Row[]; contacts: Row[]; jobs: Row[]; reps: { id: string; name: string }[]; can: { edit: boolean; reassign: boolean; money: boolean } }

const ACT_ICON: Record<string, string> = { call: '☎', email: '✉', meeting: '◷', visit: '⌂', site_walk: '⌂', task: '✓', note: '✎', stage_change: '→', demo: '▶' }

export function DealPanel({ dealId, onClose, onMoveRequest, onChanged, onOpenFull, onRestored }: {
  dealId: string; onClose: () => void
  onMoveRequest: (deal: Deal, to: string) => void
  onChanged: (card: Deal) => void
  onOpenFull: (id: string) => void
  onRestored: () => void
}) {
  const [d, setD] = useState<Detail | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [step, setStep] = useState({ type: 'call', subject: '', date: localISO(), done: false })

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/sales/deals/${dealId}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? 'Could not load the deal.')
      setD(data as Detail); setErr(null)
      return data as Detail
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not load the deal.'); return null }
  }, [dealId])
  useEffect(() => { setD(null); void load() }, [load])

  const save = useCallback(async (k: string, v: unknown) => {
    try {
      const res = await fetch(`/api/sales/deals/${dealId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [k]: v }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? 'Could not save.')
      setD(prev => (prev ? { ...prev, deal: data.deal, card: data.card } : prev))
      onChanged(data.card as Deal); setErr(null)
      void load()
      return true
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not save.'); return false }
  }, [dealId, load, onChanged])

  const act = useCallback(async (body: Row) => {
    try {
      const res = await fetch(`/api/sales/deals/${dealId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? 'Could not save.')
      const fresh = await load(); setErr(null)
      if (fresh?.card) onChanged(fresh.card) // keeps the board card's next-step chip current
      return true
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not save.'); return false }
  }, [dealId, load, onChanged])

  const contactCall = useCallback(async (method: 'POST' | 'PATCH' | 'DELETE', body?: Row, contactId?: string) => {
    const url = `/api/crm/opportunities/${dealId}/contacts${method === 'DELETE' ? `?contactId=${contactId}` : ''}`
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setErr(data?.error ?? 'Could not save the contact.'); return false }
    await load(); return true
  }, [dealId, load])

  const panelCls = 'dp'
  if (!d) return (
    <aside className={panelCls} aria-label="Deal">
      <div className="dp-top"><span className="sb-sub">{err ?? 'Loading deal…'}</span><span style={{ flex: 1 }} /><button type="button" className="dp-x" onClick={onClose} aria-label="Close">✕</button></div>
    </aside>
  )

  const { deal, card } = d
  const closed = card.tab === 'won' || card.tab === 'lost'
  const si = stageIndex(card.stage)
  const openSteps = d.activities.filter(a => !a.completed_at && a.due_at).sort((a, b) => String(a.due_at).localeCompare(String(b.due_at)))
  const history = d.activities.filter(a => a.completed_at || !a.due_at)

  const head = (
    <>
      <div className="dp-top">
        <span className="sb-key" style={{ marginLeft: 0 }}>{card.key}</span>
        <span className="sb-sub">· {card.tab === 'won' ? 'Won' : card.tab === 'lost' ? 'Lost' : card.stage_label}</span>
        <span style={{ flex: 1 }} />
        <button type="button" className="dp-x" onClick={() => onOpenFull(deal.id)} aria-label="Open full page" title="Open full deal page">⤢</button>
        <button type="button" className="dp-x" onClick={onClose} aria-label="Close">✕</button>
      </div>
      <Field label="Deal name" k="name" value={deal.name} onSave={save} />
      <div className="sb-sub" style={{ marginTop: -4 }}>{[card.account, card.units ? `${card.units.toLocaleString()} units` : null, card.city].filter(Boolean).join(' · ')}</div>
      {closed && (
        <div className={`dp-banner ${card.tab}`}>
          {card.tab === 'won' ? `Won ${fmtDate(card.won_at)}` : `Lost ${fmtDate(card.lost_at)} — ${card.lost_reason ?? 'no reason'}${card.lost_competitor ? ` (to ${card.lost_competitor})` : ''}`}
          {' · '}pick a stage below to reopen it.
        </div>
      )}
      {card.tab === 'archived' && (
        <div className="dp-banner archived" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ flex: 1 }}>Archived — hidden from the board.</span>
          <button type="button" className="sb-btn sm" onClick={async () => { if (await act({ action: 'unarchive' })) onRestored() }}>Restore</button>
        </div>
      )}
      <div className="dp-stages" role="group" aria-label="Stage">
        {STAGES.map((s, i) => (
          <button key={s.key} type="button" className={!closed && i <= si ? 'on' : ''} aria-current={!closed && s.key === card.stage ? 'step' : undefined}
            onClick={() => { if (closed || s.key !== card.stage) onMoveRequest(card, s.key) }} title={`Move to ${s.label}`}>{s.short}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {card.tab !== 'won' && <button type="button" className="sb-btn green" style={{ flex: 1 }} onClick={() => onMoveRequest(card, 'won')}>Mark won</button>}
        {card.tab !== 'lost' && <button type="button" className="sb-btn" style={{ flex: 1, color: '#D70015' }} onClick={() => onMoveRequest(card, 'lost')}>Mark lost</button>}
        <button type="button" className="sb-btn" style={{ flex: 1 }} onClick={async () => { const r = await startProposal(deal, d.contacts); if (!r.ok) setErr(r.error); else void load() }}>New proposal</button>
      </div>
      {err && <div className="sb-err" role="alert">{err}</div>}
    </>
  )

  const steps_ = (
    <section className="dp-sec"><h4>Next steps</h4>
      {openSteps.length === 0 && <div className="sb-act none" style={{ marginBottom: 8 }}>! No next step planned</div>}
      {openSteps.map(a => {
        const late = a.due_at && new Date(a.due_at).getTime() < Date.now() && localISO(new Date(a.due_at)) < localISO()
        return (
          <div key={a.id} className="dp-row">
            <span className={`sb-act ${late ? 'late' : localISO(new Date(a.due_at)) === localISO() ? 'today' : 'ok'}`}>{late ? 'Overdue' : fmtDate(a.due_at)}</span>
            <span style={{ flex: 1, minWidth: 0 }}><b style={{ fontWeight: 500 }}>{a.subject}</b> <span className="sb-sub">· {a.type}</span></span>
            <button type="button" className="sb-link sm" onClick={() => void act({ action: 'complete_activity', activity_id: a.id })}>Done</button>
            <button type="button" className="sb-link sm r" aria-label={`Delete ${a.subject}`} onClick={() => void act({ action: 'delete_activity', activity_id: a.id })}>✕</button>
          </div>
        )
      })}
      <form className="dp-add" onSubmit={async e => {
        e.preventDefault()
        if (!step.subject.trim()) return
        const ok = await act({ action: 'add_activity', type: step.type, subject: step.subject, due_at: step.done ? null : `${step.date}T09:00:00`, done: step.done })
        if (ok) setStep({ ...step, subject: '' })
      }}>
        <select className="sb-in" value={step.type} onChange={e => setStep({ ...step, type: e.target.value })} aria-label="Type">
          {ACT_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}<option value="note">Note</option>
        </select>
        <input className="sb-in" style={{ flex: 1, minWidth: 140 }} placeholder={step.done ? 'What happened? (logs it as done)' : 'Schedule a call, email, visit or task…'} value={step.subject} onChange={e => setStep({ ...step, subject: e.target.value })} aria-label="Step" />
        {!step.done && <input className="sb-in" type="date" value={step.date} onChange={e => setStep({ ...step, date: e.target.value })} aria-label="Due" />}
        <label className="sb-sub" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><input type="checkbox" checked={step.done} onChange={e => setStep({ ...step, done: e.target.checked })} />Already done</label>
        <button type="submit" className="sb-btn pri sm" disabled={!step.subject.trim()}>{step.done ? 'Log' : 'Add'}</button>
      </form>
    </section>
  )

  const related_ = (
    <section className="dp-sec"><h4>Related</h4>
      {d.jobs.map(j => <div key={j.id} className="dp-row"><span className="sb-pill late-stage">Job</span><span style={{ flex: 1 }}>{j.wo_number ? `${j.wo_number} · ` : ''}{j.title}</span><span className="sb-sub">{j.status}</span><a className="sb-link sm" href={`/maintenance/${j.id}`}>Open</a></div>)}
      {deal.quote_url && <div className="dp-row"><span className="sb-pill mid">Quote</span><span style={{ flex: 1 }}>{deal.quote_status ?? 'Attached'}{deal.quote_total ? ` · ${money(deal.quote_total, false)}` : ''}</span><a className="sb-link sm" href={deal.quote_url} target="_blank" rel="noreferrer">Open</a></div>}
      {deal.lead_id && <div className="dp-row"><span className="sb-pill early">Lead</span><span style={{ flex: 1 }}>Came from a lead</span><a className="sb-link sm" href={`/crm/leads/${deal.lead_id}`}>Open</a></div>}
      <button type="button" className="sb-link" onClick={() => onOpenFull(deal.id)}>Open full deal page (timeline, quotes, files) →</button>
    </section>
  )

  const history_ = (
    <section className="dp-sec"><h4>Activity</h4>
      {history.length === 0 && <div className="sb-sub">Nothing yet.</div>}
      <ol className="dp-hist">
        {history.slice(0, 25).map(a => (
          <li key={a.id}>
            <span className="dp-ic" aria-hidden="true">{ACT_ICON[a.type] ?? '•'}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <b style={{ fontWeight: a.type === 'stage_change' ? 600 : 500 }}>{a.subject ?? a.type}</b>
              {a.body && <span style={{ display: 'block', color: '#3A3A3C' }}>{a.body}</span>}
              <span className="sb-sub" style={{ display: 'block' }}>{a.created_by_name ?? 'Someone'} · {new Date(a.completed_at ?? a.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  )

  return (
    <aside className={panelCls} aria-label={`Deal: ${card.name}`}>
      <div className="dp-body">{head}{steps_}
        <DealFields dealId={dealId} d={d} save={save} contactCall={contactCall} onChanged={onChanged} reload={load} setErr={setErr} />
        {related_}{history_}</div>
    </aside>
  )
}
