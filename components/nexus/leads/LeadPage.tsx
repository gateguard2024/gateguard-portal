'use client'

/**
 * Lead page — the full-screen lead record, same look as a deal's page (DealPage).
 *   Header: name, who / where / rep, Call · Email · Text · ARIA · Not now · Make it an opportunity
 *   Status: Open · Contacting · Stuck · Lost (LeadStatusBar — Stuck / Lost ask why); Won once it's an opportunity
 *   Numbers: score, est. $/mo, next step, last touch, touches, added, rep
 *   Left:   details (edit) + sizing      Middle: log call / note / follow-up + coming up + timeline
 *   Right:  emails & texts with them (Nexus Mail) · why the score · related opportunities / surveys / files
 * Data: GET /api/nexus/leads?id=<id> (scored row, any status) + GET /api/nexus/opps/lead-window/<id>.
 * Every change goes through POST /api/nexus/opps/lead-window/<id> (same rules as the panel).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { SALES_CSS } from '@/components/nexus/sales/salesCss'
import { PAGE_CSS } from '@/components/nexus/sales/DealPage'
import MailApp from '@/components/nexus/mail/MailApp'
import { type LeadRow, ago, dueText, money, scoreColor, scoreLabel } from '@/components/nexus/LeadsHub'
import { OUTCOMES, SNOOZE_REASONS, dateIn, nextMonday, snoozeDate } from '@/components/nexus/leads/LeadPanel'
import { LeadStatusBar, leadStatusOf, statusMeta, type LeadStatusId } from '@/components/nexus/leads/LeadStatus'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>
type MailHit = { id: string; subject: string; preview: string; last_at: string; last_from_me: boolean }
type Tab = 'call' | 'note' | 'follow'

const ICON: Record<string, string> = { call: '☎', email: '✉', meeting: '◷', visit: '⌂', task: '✓', note: '✎' }
const LEAD_CSS = `
.lpg-st{max-width:640px}
.lpg-ban{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:10px 14px;border-radius:12px;font-size:13.5px}
.lpg-ban.lost{background:rgba(255,255,255,.08);color:#E5E9F0;border:1px solid rgba(255,255,255,.16)}
.lpg-ban.snz{background:rgba(255,255,255,.08);color:#E5E9F0;border:1px solid rgba(255,255,255,.16)}
.lpg-ban.deal{background:rgba(48,209,88,.12);color:#E5F8EA;border:1px solid rgba(48,209,88,.35)}
.lpg-dl{display:grid;grid-template-columns:110px 1fr;row-gap:7px;font-size:13px;margin:0}
.lpg-dl dt{color:#6E6E73}.lpg-dl dd{margin:0;min-width:0;overflow-wrap:anywhere}
.lpg-sz{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
.lpg-sz label{font-size:11.5px;color:#6E6E73;font-weight:600}
.lpg-why{display:flex;gap:6px;flex-wrap:wrap;padding:12px 16px}
.lpg-why span{font-size:12px;font-weight:600;padding:3px 9px;border-radius:20px;background:#F2F2F7;color:#3A3A3C}
.lpg-mail{display:block;width:100%;text-align:left;border:0;background:none;padding:9px 16px;border-top:1px solid rgba(0,0,0,.05);cursor:pointer;font:inherit;color:inherit}
.lpg-mail:hover{background:#F7F8FA}
`

export function LeadPage({ leadId, canReassign, onClose, onOpenDeal }: {
  leadId: string; canReassign: boolean
  onClose: () => void; onOpenDeal: (dealId: string) => void
}) {
  const [lead, setLead] = useState<LeadRow | null>(null)
  const [detail, setDetail] = useState<Row | null>(null)
  const [mail, setMail] = useState<MailHit[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [thread, setThread] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('call')
  const [outcome, setOutcome] = useState(OUTCOMES[0])
  const [text, setText] = useState('')
  const [next, setNext] = useState('')
  const [fTitle, setFTitle] = useState('Follow up call')
  const [fDate, setFDate] = useState(dateIn(2))
  const [editing, setEditing] = useState(false)
  const [info, setInfo] = useState({ contact_name: '', company_name: '', email: '', phone: '', location: '', source: '' })
  const [size, setSize] = useState({ units: '', cameras: '', entry_points: '', mrr: '' })
  const [snz, setSnz] = useState(false)
  const [snzMonths, setSnzMonths] = useState(6)
  const [snzReason, setSnzReason] = useState('')
  const [users, setUsers] = useState<{ id: string; full_name: string; email: string }[] | null>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)

  const flash = (t: string) => { setToast(t); window.setTimeout(() => setToast((x) => (x === t ? null : x)), 3000) }

  const load = useCallback(async () => {
    const [a, b] = await Promise.all([
      fetch(`/api/nexus/leads?id=${leadId}`, { cache: 'no-store' }).then(async (r) => ({ ok: r.ok, status: r.status, d: await r.json().catch(() => ({})) })),
      fetch(`/api/nexus/opps/lead-window/${leadId}`, { cache: 'no-store' }).then(async (r) => (r.ok ? r.json() : null)).catch(() => null),
    ])
    if (!a.ok) { if (a.status === 404) setMissing(true); else setErr(a.d?.error ?? 'Could not load this lead.'); return }
    const l = a.d.lead as LeadRow
    setLead(l)
    if (b?.success) setDetail(b)
    return l
  }, [leadId])

  useEffect(() => {
    void load().then((l) => {
      if (!l) return
      setInfo({ contact_name: l.contact ?? '', company_name: l.company ?? '', email: l.email ?? '', phone: l.phone ?? '', location: l.location ?? '', source: l.source ?? '' })
      setSize({ units: l.units?.toString() ?? '', cameras: l.cameras?.toString() ?? '', entry_points: l.entry_points?.toString() ?? '', mrr: '' })
      const term = l.email || l.contact || ''
      if (!term) { setMail([]); return }
      fetch(`/api/nexus/messages/threads?folder=all&q=${encodeURIComponent(term)}&limit=8`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null)).then((d) => setMail(Array.isArray(d?.conversations) ? d.conversations : [])).catch(() => setMail([]))
    })
  }, [load])

  async function act(action: string, body: Record<string, unknown>, done: string): Promise<boolean> {
    setBusy(action); setErr(null)
    try {
      const r = await fetch(`/api/nexus/opps/lead-window/${leadId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...body }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || d?.success === false) { setErr(d?.message ?? 'That didn’t save.'); return false }
      flash(done)
      await load()
      return true
    } finally { setBusy(null) }
  }
  const setStatus = (st: LeadStatusId, reason?: string) =>
    act('set_status', { status: st, reason }, st === 'lost' ? 'Marked lost — it’s off your lists' : `Marked ${statusMeta(st).label}`)

  async function convert() {
    setBusy('deal'); setErr(null)
    try {
      const r = await fetch(`/api/nexus/opps/lead-window/${leadId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create_opportunity' }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d?.opportunityId) { setErr(d?.message ?? 'Couldn’t make the opportunity.'); return }
      onOpenDeal(String(d.opportunityId))
    } finally { setBusy(null) }
  }

  async function saveComposer() {
    if (tab === 'call') {
      const summary = [outcome, text.trim()].filter(Boolean).join(' — ')
      if (!(await act('log_call', { summary, outcome }, 'Call logged'))) return
      if (next) await act('schedule_followup', { title: /voicemail|no answer|call back/i.test(outcome) ? 'Call again' : 'Follow up', due_date: next }, 'Next step set')
      if (/^Talked/.test(outcome) && lead && leadStatusOf(lead) === 'open') await act('set_status', { status: 'contacting' }, 'Call logged — now Contacting')
      setText(''); setNext('')
    } else if (tab === 'note') {
      if (!text.trim()) return
      if (await act('add_note', { note: text }, 'Note saved')) setText('')
    } else {
      if (await act('schedule_followup', { title: fTitle || 'Follow up', due_date: fDate }, 'Next step set')) setFTitle('Follow up call')
    }
  }

  async function openAssign() {
    if (users) return
    const d = await fetch('/api/admin/users', { cache: 'no-store' }).then((r) => r.json()).catch(() => null)
    setUsers(Array.isArray(d?.users) ? d.users : [])
  }

  const shell = (inner: React.ReactNode) => createPortal(
    <div className="sb-root dpg" role="dialog" aria-modal="true" aria-label="Lead">
      <style dangerouslySetInnerHTML={{ __html: SALES_CSS + PAGE_CSS + LEAD_CSS }} />
      <div className="sb-main">{inner}</div>
      {thread && <div style={{ position: 'fixed', inset: 0, zIndex: 130 }}><MailApp onClose={() => setThread(null)} closeLabel="Back to lead" initialFolder="all" initialThreadId={thread} /></div>}
      {toast && <div className="sb-toast" role="status">{toast}</div>}
    </div>,
    document.body,
  )

  if (missing) return shell(<>
    <div><button type="button" className="sb-back" onClick={onClose}>‹ Back to leads</button></div>
    <div className="dpg-card" style={{ padding: 24 }}>This lead was deleted or isn’t yours to see.</div>
  </>)
  if (!lead) return shell(<>
    <div><button type="button" className="sb-back" onClick={onClose}>‹ Back to leads</button></div>
    {err ? <div className="sb-err" role="alert">{err}</div> : <div style={{ color: '#C9D2E0', padding: 30 }}>Loading the lead…</div>}
  </>)

  const status = leadStatusOf(lead)
  const sc = scoreColor(lead.score)
  const L = (detail?.lead ?? {}) as Row
  const acts: Row[] = detail?.activity?.activities ?? []
  const todos: Row[] = detail?.todos ?? []
  const today = dateIn(0)
  const upcoming = [
    ...acts.filter((a) => a.due_at && !a.completed_at).map((a) => ({ id: `a-${a.id}`, title: a.subject || 'Follow up', due: String(a.due_at).slice(0, 10), kind: a.type ?? 'task' })),
    ...todos.filter((t) => t.status !== 'done' && t.due_date).map((t) => ({ id: `t-${t.id}`, title: t.title || 'Task', due: String(t.due_date), kind: 'task' })),
  ].sort((a, b) => a.due.localeCompare(b.due))
  const timeline = [
    ...acts.filter((a) => !(a.due_at && !a.completed_at)).map((a) => ({ id: `a-${a.id}`, kind: String(a.type ?? 'note').toLowerCase(), title: a.subject || a.type || 'Activity', body: a.body as string | null, at: String(a.completed_at ?? a.created_at) })),
    ...todos.filter((t) => t.status === 'done').map((t) => ({ id: `t-${t.id}`, kind: 'task', title: `✓ ${t.title || 'Task'}`, body: t.body as string | null, at: String(t.updated_at ?? t.created_at) })),
  ].sort((a, b) => b.at.localeCompare(a.at))
  const opps: Row[] = detail?.opportunities ?? []
  const surveys: Row[] = detail?.surveys ?? []
  const files: Row[] = detail?.attachments ?? []
  const sizedMrr = size.mrr.trim() ? Number(size.mrr) || 0 : (Number(size.units) || Number(size.cameras)) ? (Number(size.units) || 0) * 10 + (Number(size.cameras) || 0) * 100 : null
  const dealId = lead.opportunity_id ?? L.opportunity_id ?? null
  const lostReason = status === 'lost' ? (acts.find((a) => /^Status: Lost/.test(String(a.subject ?? '')))?.body ?? null) : null
  let lastDay = ''

  return shell(<>
    <div><button type="button" className="sb-back" onClick={onClose}>‹ Back to leads</button></div>
    <div className="dpg-hd">
      <div style={{ minWidth: 0 }}>
        <div className="dpg-key">LEAD · {statusMeta(status).label.toUpperCase()}{lead.source ? ` · ${String(lead.source).toUpperCase()}` : ''}{lead.lead_type ? ` · ${String(lead.lead_type).toUpperCase()}` : ''}</div>
        <h1>{lead.name}</h1>
        <div className="dpg-sub">
          {[lead.contact && `${lead.contact}${lead.title ? `, ${lead.title}` : ''}`, lead.company && lead.company !== lead.name ? lead.company : null, lead.location].filter(Boolean).join(' · ') || 'No contact yet'}
          {' · '}Rep <b>{lead.owner ?? '—'}</b> · Added {new Date(lead.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} ({ago(lead.created_at)})
        </div>
      </div>
      <div className="dpg-acts">
        {lead.phone && <a className="dpg-dark" href={`tel:${lead.phone}`}>☎ Call</a>}
        {lead.email && <a className="dpg-dark" href={`mailto:${lead.email}`}>✉ Email</a>}
        {lead.phone && <a className="dpg-dark" href={`sms:${lead.phone}`}>💬 Text</a>}
        <a className="dpg-dark" href={`/aria?q=${encodeURIComponent([lead.name, lead.location].filter(Boolean).join(' '))}`}>{lead.researched ? 'ARIA intel' : 'Research in ARIA'}</a>
        {!lead.snoozed_until && status !== 'lost' && status !== 'won' && <button type="button" className="dpg-dark" onClick={() => setSnz(!snz)}>Not now…</button>}
        {dealId
          ? <button type="button" className="dpg-dark g" onClick={() => onOpenDeal(String(dealId))}>Open the opportunity →</button>
          : <button type="button" className="dpg-dark b" disabled={busy === 'deal'} onClick={() => void convert()}>{busy === 'deal' ? 'Making the opportunity…' : 'Make it an opportunity →'}</button>}
      </div>
    </div>

    {!dealId && <div className="lpg-st"><LeadStatusBar status={status} reason={lead.stuck_reason} onSet={setStatus} size="lg" dark /></div>}

    {status === 'lost' && <div className="lpg-ban lost">This lead is <b>Lost</b>{lostReason ? ` — ${lostReason.replace(/^Lost — /, '')}` : ''}. It’s off your lists; pick Open or Contacting above to bring it back.</div>}
    {lead.snoozed_until && (
      <div className="lpg-ban snz">
        <span style={{ flex: 1 }}><b>Not now</b> — comes back {new Date(`${lead.snoozed_until}T00:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}{lead.snooze_reason ? ` · ${lead.snooze_reason}` : ''}</span>
        <button type="button" className="dpg-dark" disabled={busy === 'snooze'} onClick={() => void act('snooze', { months: 0 }, 'Back on the list')}>Bring back now</button>
      </div>
    )}
    {dealId && <div className="lpg-ban deal"><span style={{ flex: 1 }}>This lead is <b>Won</b> — it became an opportunity. It’s off your working lists and in Leads → Won; work it from the opportunity page.</span><button type="button" className="dpg-dark g" onClick={() => onOpenDeal(String(dealId))}>Open the opportunity →</button></div>}
    {snz && (
      <div className="dpg-card" style={{ padding: 14, maxWidth: 640 }}>
        <div className="dpg-ut">Not now — bring it back in</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>{[3, 6, 12].map((m) => <button key={m} type="button" className="sb-chip" aria-pressed={snzMonths === m} onClick={() => setSnzMonths(m)}>{m} months</button>)}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>{SNOOZE_REASONS.map((r) => <button key={r} type="button" className="sb-chip" aria-pressed={snzReason === r} onClick={() => setSnzReason(snzReason === r ? '' : r)}>{r}</button>)}</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="sb-btn" onClick={() => setSnz(false)}>Cancel</button>
          <button type="button" className="sb-btn pri" disabled={busy === 'snooze'} onClick={async () => { if (await act('snooze', { months: snzMonths, reason: snzReason }, `Not now — back ${snoozeDate(snzMonths)}`)) setSnz(false) }}>Snooze until {snoozeDate(snzMonths)}</button>
        </div>
      </div>
    )}

    <div className="dpg-kpis">
      <div className="dpg-k"><div className="l">Score</div><div className="v" style={{ color: sc }}>{lead.score}</div><div className="s">{scoreLabel(lead.score)} lead</div></div>
      <div className="dpg-k"><div className="l">Est. monthly</div><div className="v">{lead.mrr != null ? `${money(lead.mrr)}/mo` : '—'}</div><div className="s">{lead.mrr != null ? `EMC ${money(lead.mrr * 0.1)}/mo` : 'size it below'}</div></div>
      <div className="dpg-k"><div className="l">Next step</div><div className="v" style={{ fontSize: 15 }}>{lead.next_step ? lead.next_step.title : 'None set'}</div><div className={`s${lead.overdue || !lead.next_step ? ' r' : ''}`}>{lead.next_step ? dueText(lead.next_step.due) : 'every lead needs one'}</div></div>
      <div className="dpg-k"><div className="l">Last touch</div><div className="v">{ago(lead.last_touch)}</div><div className="s">{lead.touches} touch{lead.touches === 1 ? '' : 'es'}</div></div>
      <div className="dpg-k"><div className="l">Status</div><div className="v" style={{ color: statusMeta(status).color }}>{statusMeta(status).label}</div><div className="s">{status === 'stuck' && lead.stuck_since ? `since ${ago(lead.stuck_since)}` : lead.bucket === 'sent_info' ? 'info sent' : statusMeta(status).hint}</div></div>
      <div className="dpg-k"><div className="l">Size</div><div className="v">{lead.units != null ? `${lead.units} units` : '—'}</div><div className="s">{[lead.cameras != null && `${lead.cameras} cameras`, lead.entry_points != null && `${lead.entry_points} entries`].filter(Boolean).join(' · ') || 'not sized'}</div></div>
      <div className="dpg-k"><div className="l">Rep</div><div className="v" style={{ fontSize: 15 }}>{lead.owner ?? 'Unassigned'}</div><div className="s">{lead.source ? `from ${lead.source}` : ' '}</div></div>
    </div>

    {err && <div className="sb-err" role="alert">{err} <button type="button" className="sb-link sm" onClick={() => setErr(null)}>Dismiss</button></div>}

    <div className="dpg-grid">
      {/* left — details + sizing */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="dpg-card">
          <div className="dpg-ch">About this lead<button type="button" onClick={() => setEditing(!editing)}>{editing ? 'Cancel' : 'Edit'}</button></div>
          <div className="dp-body">
            {editing ? (
              <div style={{ display: 'grid', gap: 8 }}>
                {([['contact_name', 'Contact name'], ['company_name', 'Company / management'], ['email', 'Email'], ['phone', 'Phone'], ['location', 'Address / city'], ['source', 'Source']] as const).map(([k, l]) => (
                  <label key={k} style={{ fontSize: 11.5, color: '#6E6E73', fontWeight: 600 }}>{l}<input className="sb-in" style={{ marginTop: 3 }} value={info[k]} onChange={(e) => setInfo((s) => ({ ...s, [k]: e.target.value }))} /></label>
                ))}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button type="button" className="sb-btn pri" disabled={busy === 'update_details'} onClick={async () => { if (await act('update_details', info, 'Details saved')) setEditing(false) }}>Save details</button></div>
              </div>
            ) : (
              <dl className="lpg-dl">
                {([['Contact', lead.contact], ['Title', lead.title], ['Company', lead.company], ['Property', lead.property], ['Email', lead.email], ['Phone', lead.phone], ['Location', lead.location], ['Source', lead.source], ['Type', lead.lead_type]] as const).map(([k, v]) => (
                  <React.Fragment key={k}><dt>{k}</dt><dd style={{ color: v ? '#1D1D1F' : '#AEAEB2' }}>{v || '—'}</dd></React.Fragment>
                ))}
              </dl>
            )}
            {canReassign && (
              <label style={{ display: 'block', marginTop: 14, fontSize: 11.5, color: '#6E6E73', fontWeight: 600 }}>Assigned to
                <select className="sb-in" style={{ width: '100%', marginTop: 3 }} defaultValue="" onFocus={() => void openAssign()}
                  onChange={async (e) => { const u = users?.find((x) => x.id === e.target.value); if (u) await act('reassign_lead', { assignee_id: u.id, assignee_name: u.full_name || u.email }, `Assigned to ${u.full_name || u.email}`) }}>
                  <option value="" disabled>{lead.owner ? `Now: ${lead.owner}` : 'Pick a teammate…'}</option>
                  {(users ?? []).map((u) => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
                </select>
              </label>
            )}
          </div>
        </div>
        <div className="dpg-card">
          <div className="dpg-ch">Size it<span className="sb-sub">{sizedMrr == null ? 'units × $10 + cameras × $100' : `${money(sizedMrr)}/mo · EMC ${money(sizedMrr * 0.1)}/mo`}</span></div>
          <div className="dp-body">
            <div className="lpg-sz">
              {([['units', 'Units'], ['cameras', 'Cameras'], ['entry_points', 'Entry points'], ['mrr', '$/mo (override)']] as const).map(([k, l]) => (
                <label key={k}>{l}<input className="sb-in" style={{ marginTop: 3 }} inputMode="numeric" value={size[k]} placeholder={k === 'mrr' && sizedMrr != null ? String(sizedMrr) : ''}
                  onChange={(e) => setSize((s) => ({ ...s, [k]: e.target.value.replace(/[^\d.]/g, '') }))} /></label>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
              <button type="button" className="sb-btn" disabled={busy === 'update_details'}
                onClick={() => act('update_details', { unit_count: size.units, cameras: size.cameras, entry_points: size.entry_points, ...(sizedMrr != null ? { mrr: sizedMrr, pcr: Math.round(sizedMrr * 0.1 * 100) / 100 } : {}) }, 'Sizing saved')}>Save sizing</button>
            </div>
          </div>
        </div>
      </div>

      {/* middle — composer + coming up + timeline */}
      <div className="dpg-card">
        <div className="dpg-comp">
          <div className="dpg-tabs" role="tablist" aria-label="Add to the timeline">
            {([['call', 'Log call'], ['note', 'Note'], ['follow', 'Next step']] as const).map(([t, l]) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} aria-pressed={tab === t} onClick={() => setTab(t)}>{l}</button>
            ))}
            <span style={{ flex: 1 }} />
            <button type="button" className="sb-btn sm" disabled={busy === 'send_info'} onClick={() => void act('send_info', {}, 'Marked info sent')}>✓ Info sent</button>
            <button type="button" className="sb-btn sm" disabled={busy === 'log_visit'} onClick={() => void act('log_visit', {}, 'Site visit logged')}>⌂ Visited</button>
          </div>
          {tab === 'call' && <div className="dpg-row2">{OUTCOMES.map((o) => <button key={o} type="button" className="sb-chip" aria-pressed={outcome === o} onClick={() => setOutcome(o)}>{o}</button>)}</div>}
          {tab === 'follow' ? (
            <>
              <input className="sb-in" value={fTitle} onChange={(e) => setFTitle(e.target.value)} aria-label="What to do" />
              <div className="dpg-row2">
                {[['Tomorrow', dateIn(1)], ['In 2 days', dateIn(2)], ['Next Monday', nextMonday()], ['In a week', dateIn(7)], ['In 2 weeks', dateIn(14)]].map(([l, d]) => <button key={l} type="button" className="sb-chip" aria-pressed={fDate === d} onClick={() => setFDate(d)}>{l}</button>)}
                <input className="sb-in" type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} aria-label="Date" />
              </div>
            </>
          ) : (
            <textarea ref={composerRef} className="sb-in" rows={3} value={text} onChange={(e) => setText(e.target.value)} aria-label="Details"
              placeholder={tab === 'call' ? 'What did they say? (optional)' : 'Write a note…'}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void saveComposer() }} />
          )}
          <div className="dpg-row2">
            {tab === 'call' && (
              <select className="sb-in" value={next} onChange={(e) => setNext(e.target.value)} aria-label="Next step">
                <option value="">No next step</option><option value={dateIn(1)}>Call again tomorrow</option><option value={dateIn(2)}>Follow up in 2 days</option><option value={dateIn(7)}>Follow up next week</option>
              </select>
            )}
            <span style={{ flex: 1 }} />
            <button type="button" className="sb-btn pri" disabled={!!busy} onClick={() => void saveComposer()}>{busy ? 'Saving…' : tab === 'call' ? 'Log call' : tab === 'note' ? 'Save note' : 'Set next step'}</button>
          </div>
        </div>

        {upcoming.length > 0 && (
          <div className="dpg-up">
            <div className="dpg-ut">Coming up · {upcoming.length}</div>
            {upcoming.map((u) => (
              <div key={u.id} className="dp-row" style={{ background: '#fff', border: '1px solid rgba(0,0,0,.06)' }}>
                <span className={`sb-act ${u.due < today ? 'late' : u.due === today ? 'today' : 'ok'}`}>{u.due < today ? 'Overdue' : dueText(u.due)}</span>
                <span style={{ flex: 1, minWidth: 0 }}>{u.title} <span className="sb-sub">· {u.kind}</span></span>
              </div>
            ))}
          </div>
        )}

        <div className="dpg-tl">
          {!detail && <div className="sb-sub" style={{ padding: '16px 0' }}>Loading the timeline…</div>}
          {detail && timeline.length === 0 && <div className="sb-sub" style={{ padding: '16px 0' }}>Nothing yet. Log your first call above.</div>}
          {timeline.slice(0, 60).map((t) => {
            const day = new Date(t.at).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
            const head = day !== lastDay ? <div className="dpg-day">{day}</div> : null
            lastDay = day
            return (
              <div key={t.id}>
                {head}
                <div className="dpg-ev">
                  <span className="dp-ic" aria-hidden="true">{ICON[t.kind] ?? '•'}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <b>{t.title}</b><span className="m"> · {new Date(t.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                    {t.body && <div className="body">{t.body}</div>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* right — mail, score, related */}
      <div className="dpg-right" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="dpg-card">
          <div className="dpg-ch">Emails &amp; texts with them</div>
          {mail == null ? <div className="sb-sub" style={{ padding: 16 }}>Looking in Nexus Mail…</div>
            : mail.length === 0 ? <div className="sb-sub" style={{ padding: 16 }}>{lead.email || lead.contact ? 'Nothing in Nexus Mail yet.' : 'Add an email to see your conversations here.'}</div>
            : mail.map((m) => (
              <button key={m.id} type="button" className="lpg-mail" onClick={() => setThread(m.id)}>
                <div style={{ display: 'flex', gap: 8, fontWeight: 600, fontSize: 13 }}><span style={{ flex: 1, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{m.subject}</span><span className="sb-sub">{ago(m.last_at)}</span></div>
                <div className="sb-sub" style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{m.last_from_me ? 'You: ' : ''}{m.preview}</div>
              </button>
            ))}
        </div>

        <div className="dpg-card">
          <div className="dpg-ch">Why it scores {lead.score}</div>
          <div className="lpg-why">{lead.why.length ? lead.why.map((w) => <span key={w}>{w}</span>) : <span>Add size and contact info to raise it</span>}</div>
        </div>

        <div className="dpg-card">
          <div className="dpg-ch">Related</div>
          {opps.map((o) => <div key={o.id} className="dpg-rel"><span className="sb-pill late-stage">Opportunity</span><span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name || o.account_name || 'Opportunity'}{o.stage ? ` · ${o.stage}` : ''}</span><button type="button" className="sb-link sm" style={{ marginLeft: 'auto' }} onClick={() => onOpenDeal(String(o.id))}>Open</button></div>)}
          {surveys.map((s) => <div key={s.id} className="dpg-rel"><span className="sb-pill mid">Survey</span>{s.survey_number ?? 'Site survey'}{s.survey_date ? ` · ${s.survey_date}` : ''}<a href="/survey">Open</a></div>)}
          {files.map((f) => <div key={f.id} className="dpg-rel"><span className="sb-pill early">File</span><span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.file_name}</span><a href={f.url} target="_blank" rel="noreferrer">Open</a></div>)}
          {!opps.length && !surveys.length && !files.length && <div className="sb-sub" style={{ padding: 16 }}>Nothing linked yet.</div>}
        </div>
      </div>
    </div>
  </>)
}

export default LeadPage
