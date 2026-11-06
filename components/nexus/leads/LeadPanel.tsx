'use client'

/**
 * LeadPanel — the light lead drawer for Nexus Leads.
 * Everything a rep does on a lead, in two taps: call / email, log a call with an
 * outcome, set the next step, mark info sent, size it (→ est. MRR + EMC), turn it
 * into a deal, see the timeline and every email with them from Nexus Mail.
 * Reads + writes through /api/nexus/opps/lead-window/[id] (same rules as before).
 */
import React, { useCallback, useEffect, useState } from 'react'
import { X, Loader2, Phone, Mail, MapPin, Check, Calendar, MessageSquare, Send, Trash2, MoreHorizontal, ExternalLink } from 'lucide-react'
import { M, N } from '@/components/nexus/mail/mailShared'
import MailApp from '@/components/nexus/mail/MailApp'
import { type LeadRow, ago, chip, dueText, initials, money, scoreColor, scoreLabel, tint } from '@/components/nexus/LeadsHub'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Flame, StickyNote, Target, Sparkles, UserCheck, Edit2 } = require('lucide-react') as any

type Activity = { id: string; type: string | null; subject: string | null; body: string | null; outcome: string | null; due_at: string | null; completed_at: string | null; created_at: string }
type Todo = { id: string; title: string | null; body: string | null; status: string | null; due_date: string | null; created_at: string }
type MailHit = { id: string; subject: string; preview: string; last_at: string; last_from_me: boolean; channel: string }
type Detail = { lead: Record<string, unknown>; activity: { activities: Activity[] }; todos: Todo[] }
type Tool = null | 'call' | 'note' | 'follow' | 'more' | 'edit'

const STEPS: { id: LeadRow['bucket']; label: string }[] = [
  { id: 'identified', label: 'Identified' }, { id: 'contacted', label: 'Contacted' }, { id: 'sent_info', label: 'Info sent' },
]
const OUTCOMES = ['Talked — interested', 'Left voicemail', 'No answer', 'Call back later', 'Not interested', 'Wrong number']
const ACT_COLOR: Record<string, string> = { call: '#22C1EE', email: '#4A8CFF', meeting: '#8B5CF6', note: '#94A3B8', task: '#F5A524', visit: '#10B981' }

function dateIn(days: number): string {
  const d = new Date(); d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function nextMonday(): string { const d = new Date(); const add = ((8 - d.getDay()) % 7) || 7; return dateIn(add) }

export function LeadPanel({ lead, canReassign, onClose, onChanged, onConvert, onToast, onRemoved, onStage }: {
  lead: LeadRow; canReassign: boolean
  onClose: () => void; onChanged: () => Promise<void> | void; onConvert: () => Promise<void> | void
  onToast: (t: string) => void; onRemoved: () => void; onStage: (b: LeadRow['bucket']) => Promise<void> | void
}) {
  const [detail, setDetail] = useState<Detail | null>(null)
  const [mail, setMail] = useState<MailHit[] | null>(null)
  const [tool, setTool] = useState<Tool>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [openThread, setOpenThread] = useState<string | null>(null)

  // forms
  const [callOutcome, setCallOutcome] = useState(OUTCOMES[0])
  const [callNote, setCallNote] = useState('')
  const [callNext, setCallNext] = useState<string>('')
  const [note, setNote] = useState('')
  const [fTitle, setFTitle] = useState('Follow up call')
  const [fDate, setFDate] = useState(dateIn(2))
  const [size, setSize] = useState({ units: '', cameras: '', entry_points: '', mrr: '' })
  const [info, setInfo] = useState({ contact_name: '', company_name: '', email: '', phone: '', location: '', source: '' })
  const [users, setUsers] = useState<{ id: string; full_name: string; email: string }[] | null>(null)
  const [confirmDel, setConfirmDel] = useState(false)

  const load = useCallback(async () => {
    const r = await fetch(`/api/nexus/opps/lead-window/${lead.id}`, { cache: 'no-store' })
    const d = await r.json().catch(() => null)
    if (r.ok && d?.success) setDetail(d)
  }, [lead.id])

  useEffect(() => {
    setDetail(null); setMail(null); setTool(null); setErr(null); setConfirmDel(false)
    setSize({ units: lead.units?.toString() ?? '', cameras: lead.cameras?.toString() ?? '', entry_points: lead.entry_points?.toString() ?? '', mrr: '' })
    setInfo({ contact_name: lead.contact ?? '', company_name: lead.company ?? '', email: lead.email ?? '', phone: lead.phone ?? '', location: lead.location ?? '', source: lead.source ?? '' })
    void load()
    const term = lead.email || lead.contact || ''
    if (term) {
      fetch(`/api/nexus/messages/threads?folder=all&q=${encodeURIComponent(term)}&limit=6`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null)).then((d) => setMail(Array.isArray(d?.conversations) ? d.conversations : [])).catch(() => setMail([]))
    } else setMail([])
  }, [lead.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function act(action: string, body: Record<string, unknown>, done: string): Promise<boolean> {
    setBusy(action); setErr(null)
    try {
      const r = await fetch(`/api/nexus/opps/lead-window/${lead.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...body }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || d?.success === false) { setErr(d?.message ?? 'That didn’t save.'); return false }
      onToast(done)
      await Promise.all([load(), onChanged()])
      return true
    } finally { setBusy(null) }
  }

  async function saveCall() {
    const summary = [callOutcome, callNote.trim()].filter(Boolean).join(' — ')
    if (!(await act('log_call', { summary, outcome: callOutcome }, 'Call logged'))) return
    if (callNext) await act('schedule_followup', { title: /voicemail|no answer|call back/i.test(callOutcome) ? 'Call again' : 'Follow up', due_date: callNext }, 'Next step set')
    if (/^Talked/.test(callOutcome) && lead.bucket === 'identified') await onStage('contacted')
    setCallNote(''); setCallNext(''); setTool(null)
  }

  const sizedMrr = (() => {
    if (size.mrr.trim()) return Number(size.mrr) || 0
    const u = Number(size.units) || 0, c = Number(size.cameras) || 0
    return u || c ? u * 10 + c * 100 : null
  })()

  async function openUsers() {
    setTool(tool === 'more' ? null : 'more')
    if (canReassign && !users) {
      const d = await fetch('/api/admin/users', { cache: 'no-store' }).then((r) => r.json()).catch(() => null)
      setUsers(Array.isArray(d?.users) ? d.users : [])
    }
  }
  async function del() {
    setBusy('delete')
    const r = await fetch('/api/trash', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ table: 'leads', ids: [lead.id], action: 'delete' }) })
    setBusy(null)
    if (!r.ok) { setErr('Couldn’t delete that lead.'); return }
    onToast('Lead moved to trash'); onRemoved()
  }

  if (openThread) {
    return <div style={{ position: 'fixed', inset: 0, zIndex: 110 }}><MailApp onClose={() => setOpenThread(null)} closeLabel="Back to lead" initialFolder="all" initialThreadId={openThread} /></div>
  }

  const t = tint(lead.name)
  const sc = scoreColor(lead.score)
  const stepIdx = STEPS.findIndex((s) => s.id === lead.bucket)
  const timeline = [
    ...(detail?.activity.activities ?? []).map((a) => ({ id: a.id, kind: (a.type ?? 'note').toLowerCase(), title: a.subject || a.type || 'Activity', body: a.body, at: a.completed_at ?? a.created_at, upcoming: !!a.due_at && !a.completed_at, due: a.due_at })),
    ...(detail?.todos ?? []).map((d) => ({ id: d.id, kind: 'task', title: d.title || 'Task', body: d.body, at: d.created_at, upcoming: d.status !== 'done' && !!d.due_date, due: d.due_date, done: d.status === 'done' })),
  ].sort((a, b) => String(b.at).localeCompare(String(a.at)))

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#F7F9FC', fontFamily: M.font, color: M.ink }}>
      {/* header */}
      <div style={{ padding: '16px 18px 14px', background: '#fff', borderBottom: `1px solid ${N.cardLine}` }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span aria-hidden style={{ width: 46, height: 46, borderRadius: 46, background: `linear-gradient(140deg, ${t}, ${t}B3)`, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 650, flexShrink: 0, boxShadow: `0 6px 14px -6px ${t}` }}>{initials(lead.name)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 650, letterSpacing: '-0.01em', lineHeight: 1.25 }}>{lead.name}</h2>
            <div style={{ fontSize: 13, color: M.ink3, marginTop: 3 }}>{[lead.contact && `${lead.contact}${lead.title ? `, ${lead.title}` : ''}`, lead.company && lead.company !== lead.name ? lead.company : null].filter(Boolean).join(' · ') || 'No contact yet'}</div>
            {lead.location && <div style={{ fontSize: 12.5, color: M.ink3, marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={12} /> {lead.location}</div>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close lead" style={{ border: 0, background: '#EEF1F6', color: M.ink2, width: 30, height: 30, borderRadius: 8, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
        </div>

        {/* score */}
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', borderRadius: 11, background: `${sc}12`, border: `1px solid ${sc}33` }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 20, fontWeight: 700, color: sc, fontVariantNumeric: 'tabular-nums' }}>{lead.score >= 70 && <Flame size={17} />}{lead.score}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 650, color: sc }}>{scoreLabel(lead.score)} lead</div>
            <div style={{ fontSize: 12, color: M.ink2 }}>{lead.why.length ? lead.why.join(' · ') : 'Add size and contact info to raise the score.'}</div>
          </div>
        </div>

        {/* stage stepper */}
        <div role="group" aria-label="Stage" style={{ display: 'flex', gap: 4, marginTop: 12 }}>
          {STEPS.map((s, i) => {
            const done = i <= stepIdx
            return (
              <button key={s.id} type="button" onClick={() => void onStage(s.id)} aria-pressed={s.id === lead.bucket}
                style={{ flex: 1, fontSize: 12, fontWeight: 600, padding: '7px 4px', border: 0, cursor: 'pointer', fontFamily: M.font, borderRadius: i === 0 ? '8px 3px 3px 8px' : '3px',
                  background: done ? N.accent : '#E7ECF3', color: done ? '#fff' : M.ink3 }}>
                {i < stepIdx && <Check size={11} style={{ verticalAlign: -1, marginRight: 3 }} />}{s.label}
              </button>
            )
          })}
          <button type="button" onClick={() => void onConvert()} disabled={!!busy}
            style={{ flex: 1.2, fontSize: 12, fontWeight: 650, padding: '7px 4px', border: 0, cursor: 'pointer', fontFamily: M.font, borderRadius: '3px 8px 8px 3px', background: N.brand, color: '#fff' }}>
            Make it a deal →
          </button>
        </div>

        {/* contact */}
        <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
          {lead.phone ? <a href={`tel:${lead.phone}`} style={contactBtn('#10B981')}><Phone size={14} /> Call</a> : <span style={{ ...contactBtn('#94A3B8'), opacity: 0.55 }} title="No phone yet"><Phone size={14} /> No phone</span>}
          {lead.email ? <a href={`mailto:${lead.email}`} style={contactBtn('#4A8CFF')}><Mail size={14} /> Email</a> : <span style={{ ...contactBtn('#94A3B8'), opacity: 0.55 }} title="No email yet"><Mail size={14} /> No email</span>}
          {lead.phone && <a href={`sms:${lead.phone}`} style={contactBtn('#22C1EE')}><MessageSquare size={14} /> Text</a>}
          <a href={`/aria?q=${encodeURIComponent([lead.name, lead.location].filter(Boolean).join(' '))}`} style={contactBtn('#8B5CF6')}><Sparkles size={14} /> {lead.researched ? 'ARIA intel' : 'Research'}</a>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 14px 30px' }}>
        {err && <div role="alert" style={{ marginBottom: 10, padding: '8px 11px', borderRadius: 9, background: '#FDECEA', color: M.red, fontSize: 12.5 }}>{err}</div>}

        {/* next step */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span aria-hidden style={tile(lead.overdue ? '#F04438' : lead.next_step ? '#4A8CFF' : '#F5A524')}><Target size={15} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: M.ink3 }}>Next step</div>
              {lead.next_step
                ? <div style={{ fontSize: 14, fontWeight: 600, color: lead.overdue ? '#C4302B' : M.ink }}>{lead.next_step.title} · {dueText(lead.next_step.due)}</div>
                : <div style={{ fontSize: 14, fontWeight: 600, color: '#9A5B00' }}>None set — every lead needs one</div>}
            </div>
            <button type="button" onClick={() => setTool(tool === 'follow' ? null : 'follow')} style={smallBtn}>{lead.next_step ? 'Add' : 'Set one'}</button>
          </div>
          {tool === 'follow' && (
            <div style={{ marginTop: 10 }}>
              <input aria-label="What to do" value={fTitle} onChange={(e) => setFTitle(e.target.value)} style={inputS} />
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', margin: '8px 0' }}>
                {[['Tomorrow', dateIn(1)], ['In 2 days', dateIn(2)], ['Next Monday', nextMonday()], ['In a week', dateIn(7)], ['In 2 weeks', dateIn(14)]].map(([l, d]) => (
                  <button key={l} type="button" onClick={() => setFDate(d)} aria-pressed={fDate === d} style={pickChip(fDate === d)}>{l}</button>
                ))}
                <input type="date" aria-label="Date" value={fDate} onChange={(e) => setFDate(e.target.value)} style={{ ...inputS, width: 150, padding: '4px 8px' }} />
              </div>
              <FormBtns busy={busy === 'schedule_followup'} onCancel={() => setTool(null)} onSave={async () => { if (await act('schedule_followup', { title: fTitle || 'Follow up', due_date: fDate }, 'Next step set')) setTool(null) }} label="Save next step" />
            </div>
          )}
        </Card>

        {/* quick actions */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, margin: '10px 0' }}>
          <QA label="Log call" color="#22C1EE" icon={<Phone size={16} />} on={tool === 'call'} onClick={() => setTool(tool === 'call' ? null : 'call')} />
          <QA label="Note" color="#94A3B8" icon={<StickyNote size={16} />} on={tool === 'note'} onClick={() => setTool(tool === 'note' ? null : 'note')} />
          <QA label="Info sent" color="#10B981" icon={<Send size={16} />} busy={busy === 'send_info'} onClick={async () => { if (await act('send_info', {}, 'Marked info sent')) await onStage('sent_info') }} />
          <QA label="Visited" color="#8B5CF6" icon={<MapPin size={16} />} busy={busy === 'log_visit'} onClick={() => act('log_visit', {}, 'Site visit logged')} />
        </div>

        {tool === 'call' && (
          <Card>
            <div style={label}>How did it go?</div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
              {OUTCOMES.map((o) => <button key={o} type="button" onClick={() => setCallOutcome(o)} aria-pressed={callOutcome === o} style={pickChip(callOutcome === o)}>{o}</button>)}
            </div>
            <textarea aria-label="Call notes" value={callNote} onChange={(e) => setCallNote(e.target.value)} placeholder="What did they say? (optional)" rows={3} style={{ ...inputS, resize: 'vertical' }} />
            <div style={{ ...label, marginTop: 8 }}>Next step</div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
              {[['None', ''], ['Tomorrow', dateIn(1)], ['In 2 days', dateIn(2)], ['Next week', dateIn(7)]].map(([l, d]) => <button key={l} type="button" onClick={() => setCallNext(d)} aria-pressed={callNext === d} style={pickChip(callNext === d)}>{l}</button>)}
            </div>
            <FormBtns busy={busy === 'log_call' || busy === 'schedule_followup'} onCancel={() => setTool(null)} onSave={saveCall} label="Log call" />
          </Card>
        )}
        {tool === 'note' && (
          <Card>
            <textarea aria-label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note…" rows={3} style={{ ...inputS, resize: 'vertical' }} autoFocus />
            <div style={{ marginTop: 8 }}><FormBtns busy={busy === 'add_note'} onCancel={() => setTool(null)} onSave={async () => { if (!note.trim()) return; if (await act('add_note', { note }, 'Note saved')) { setNote(''); setTool(null) } }} label="Save note" /></div>
          </Card>
        )}

        {/* sizing */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
            <span aria-hidden style={tile('#10B981')}><Sparkles size={15} /></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: M.ink3 }}>Size it</div>
              <div style={{ fontSize: 14, fontWeight: 650 }}>{sizedMrr == null ? 'Add units / cameras' : `${money(sizedMrr)}/mo · EMC ${money(sizedMrr * 0.1)}/mo`}</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {([['units', 'Units'], ['cameras', 'Cameras'], ['entry_points', 'Entry pts'], ['mrr', '$/mo (override)']] as const).map(([k, l]) => (
              <label key={k} style={{ fontSize: 11, color: M.ink3, fontWeight: 600 }}>{l}
                <input inputMode="numeric" value={size[k]} onChange={(e) => setSize((s) => ({ ...s, [k]: e.target.value.replace(/[^\d.]/g, '') }))} placeholder={k === 'mrr' && sizedMrr != null ? String(sizedMrr) : ''} style={{ ...inputS, marginTop: 3, padding: '6px 8px' }} />
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 9 }}>
            <span style={{ fontSize: 11.5, color: M.ink3, flex: 1 }}>Units × $10 + cameras × $100. EMC = 10%.</span>
            <button type="button" disabled={busy === 'update_details'} style={smallBtn}
              onClick={() => act('update_details', { unit_count: size.units, cameras: size.cameras, entry_points: size.entry_points, ...(sizedMrr != null ? { mrr: sizedMrr, pcr: Math.round(sizedMrr * 0.1 * 100) / 100 } : {}) }, 'Sizing saved')}>
              {busy === 'update_details' ? <Loader2 size={13} className="animate-spin" /> : 'Save'}
            </button>
          </div>
        </Card>

        {/* emails with them */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
            <span aria-hidden style={tile('#4A8CFF')}><Mail size={15} /></span>
            <div style={{ flex: 1, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: M.ink3 }}>Emails &amp; texts with them</div>
          </div>
          {mail == null ? <div style={{ padding: 8, color: M.ink3 }}><Loader2 size={14} className="animate-spin" /></div>
            : mail.length === 0 ? <div style={{ fontSize: 12.5, color: M.ink3, padding: '4px 2px' }}>{lead.email || lead.contact ? 'Nothing in Nexus Mail yet.' : 'Add an email to see your conversations here.'}</div>
            : mail.map((m) => (
              <button key={m.id} type="button" onClick={() => setOpenThread(m.id)} style={{ display: 'block', width: '100%', textAlign: 'left', border: 0, background: 'transparent', padding: '7px 4px', borderTop: `1px solid ${N.cardLine}`, cursor: 'pointer', fontFamily: M.font }}>
                <div style={{ display: 'flex', gap: 6, fontSize: 13, fontWeight: 600, color: M.ink }}><span style={{ flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{m.subject}</span><span style={{ fontSize: 11.5, color: M.ink3, fontWeight: 500 }}>{ago(m.last_at)}</span></div>
                <div style={{ fontSize: 12, color: M.ink3, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{m.last_from_me ? 'You: ' : ''}{m.preview}</div>
              </button>
            ))}
        </Card>

        {/* timeline */}
        <Card>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: M.ink3, marginBottom: 8 }}>Timeline · {lead.touches} touch{lead.touches === 1 ? '' : 'es'} · added {ago(lead.created_at)}</div>
          {!detail ? <div style={{ color: M.ink3 }}><Loader2 size={14} className="animate-spin" /></div>
            : timeline.length === 0 ? <div style={{ fontSize: 12.5, color: M.ink3 }}>Nothing yet. Log your first call above.</div>
            : timeline.slice(0, 30).map((e) => {
              const c = ACT_COLOR[e.kind] ?? '#94A3B8'
              return (
                <div key={`${e.kind}-${e.id}`} style={{ display: 'flex', gap: 9, padding: '6px 0' }}>
                  <span aria-hidden style={{ width: 8, height: 8, borderRadius: 8, background: c, marginTop: 6, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: M.ink }}>{e.title}{e.upcoming && e.due && <span style={{ ...chip, marginLeft: 6, color: '#0B5CAD', background: 'rgba(74,140,255,0.12)' }}>due {dueText(String(e.due).slice(0, 10))}</span>}</div>
                    {e.body && <div style={{ fontSize: 12.5, color: M.ink2, whiteSpace: 'pre-wrap', marginTop: 1 }}>{e.body}</div>}
                    <div style={{ fontSize: 11.5, color: M.ink4 }}>{new Date(e.at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
                  </div>
                </div>
              )
            })}
        </Card>

        {/* details */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
            <div style={{ flex: 1, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: M.ink3 }}>Details</div>
            <button type="button" onClick={() => setTool(tool === 'edit' ? null : 'edit')} style={{ ...smallBtn, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Edit2 size={12} /> {tool === 'edit' ? 'Cancel' : 'Edit'}</button>
          </div>
          {tool === 'edit' ? (
            <div style={{ display: 'grid', gap: 6 }}>
              {([['contact_name', 'Contact name'], ['company_name', 'Company / management'], ['email', 'Email'], ['phone', 'Phone'], ['location', 'Address / city'], ['source', 'Source']] as const).map(([k, l]) => (
                <label key={k} style={{ fontSize: 11, color: M.ink3, fontWeight: 600 }}>{l}<input value={info[k]} onChange={(e) => setInfo((s) => ({ ...s, [k]: e.target.value }))} style={{ ...inputS, marginTop: 3 }} /></label>
              ))}
              <FormBtns busy={busy === 'update_details'} onCancel={() => setTool(null)} onSave={async () => { if (await act('update_details', info, 'Details saved')) setTool(null) }} label="Save details" />
            </div>
          ) : (
            <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: '110px 1fr', rowGap: 5, fontSize: 13 }}>
              {([['Contact', lead.contact], ['Company', lead.company], ['Email', lead.email], ['Phone', lead.phone], ['Location', lead.location], ['Source', lead.source], ['Type', lead.lead_type], ['Rep', lead.owner]] as const).map(([k, v]) => (
                <React.Fragment key={k}><dt style={{ color: M.ink3 }}>{k}</dt><dd style={{ margin: 0, color: v ? M.ink : M.ink4 }}>{v || '—'}</dd></React.Fragment>
              ))}
            </dl>
          )}
        </Card>

        {/* more */}
        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
          <button type="button" onClick={() => void openUsers()} style={{ ...smallBtn, display: 'inline-flex', alignItems: 'center', gap: 5 }}><MoreHorizontal size={14} /> More</button>
          <a href={`/crm/leads/${lead.id}`} style={{ ...smallBtn, display: 'inline-flex', alignItems: 'center', gap: 5, textDecoration: 'none' }}><ExternalLink size={13} /> Full record</a>
        </div>
        {tool === 'more' && (
          <Card>
            {canReassign && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ ...label, display: 'flex', alignItems: 'center', gap: 5 }}><UserCheck size={13} /> Assign to</div>
                {users == null ? <Loader2 size={14} className="animate-spin" /> : (
                  <select aria-label="Assign to" defaultValue="" onChange={async (e) => { const u = users.find((x) => x.id === e.target.value); if (u) await act('reassign_lead', { assignee_id: u.id, assignee_name: u.full_name || u.email }, `Assigned to ${u.full_name || u.email}`) }} style={inputS}>
                    <option value="" disabled>{lead.owner ? `Now: ${lead.owner}` : 'Pick a teammate…'}</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
                  </select>
                )}
              </div>
            )}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button type="button" disabled={busy === 'update_status'} onClick={async () => { if (await act('update_status', { stage: 'lost' }, 'Marked lost')) onRemoved() }} style={{ ...smallBtn, color: '#9A5B00' }}>Mark lost</button>
              {!confirmDel
                ? <button type="button" onClick={() => setConfirmDel(true)} style={{ ...smallBtn, color: M.red, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Trash2 size={13} /> Delete</button>
                : <button type="button" onClick={() => void del()} disabled={busy === 'delete'} style={{ ...smallBtn, background: M.red, color: '#fff' }}>{busy === 'delete' ? 'Deleting…' : 'Yes, delete this lead'}</button>}
            </div>
          </Card>
        )}
        <div style={{ fontSize: 11, color: M.ink4, marginTop: 14, display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={11} /> Added {new Date(lead.created_at).toLocaleDateString()}</div>
      </div>
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return <div style={{ background: '#fff', border: `1px solid ${N.cardLine}`, borderRadius: 12, boxShadow: N.cardShadow, padding: '11px 12px', marginBottom: 10 }}>{children}</div>
}
function QA({ label: l, color, icon, onClick, on, busy }: { label: string; color: string; icon: React.ReactNode; onClick: () => void; on?: boolean; busy?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={busy} aria-pressed={on}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '10px 4px', borderRadius: 11, cursor: 'pointer', fontFamily: M.font, fontSize: 12, fontWeight: 600, color: M.ink,
        background: '#fff', border: `1px solid ${on ? color : N.cardLine}`, boxShadow: on ? `0 0 0 3px ${color}22` : N.cardShadow }}>
      <span style={tile(color)}>{busy ? <Loader2 size={15} className="animate-spin" /> : icon}</span>{l}
    </button>
  )
}
function FormBtns({ busy, onCancel, onSave, label: l }: { busy: boolean; onCancel: () => void; onSave: () => void; label: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
      <button type="button" onClick={onCancel} style={smallBtn}>Cancel</button>
      <button type="button" onClick={onSave} disabled={busy} style={{ ...smallBtn, background: N.brand, color: '#fff', border: 0, display: 'inline-flex', alignItems: 'center', gap: 5 }}>{busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} {l}</button>
    </div>
  )
}
const tile = (c: string): React.CSSProperties => ({ width: 30, height: 30, borderRadius: 9, background: `${c}1C`, color: c, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 })
const contactBtn = (c: string): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: c, background: `${c}14`, border: `1px solid ${c}33`, borderRadius: 9, padding: '6px 11px', textDecoration: 'none', fontFamily: M.font })
const smallBtn: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, color: M.ink2, background: '#EEF1F6', border: `1px solid ${N.cardLine}`, borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontFamily: M.font }
const inputS: React.CSSProperties = { width: '100%', boxSizing: 'border-box', fontSize: 13.5, padding: '7px 10px', borderRadius: 9, border: `1px solid ${M.lineStrong}`, background: '#fff', color: M.ink, fontFamily: M.font, outline: 'none' }
const label: React.CSSProperties = { fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: M.ink3, marginBottom: 6 }
const pickChip = (on: boolean): React.CSSProperties => ({ fontSize: 12, fontWeight: 600, padding: '4px 9px', borderRadius: 20, cursor: 'pointer', fontFamily: M.font, border: `1px solid ${on ? N.accent : M.lineStrong}`, background: on ? 'rgba(74,140,255,0.12)' : '#fff', color: on ? '#0B5CAD' : M.ink2 })
