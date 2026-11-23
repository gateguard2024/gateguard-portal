'use client'

/**
 * SequenceCard — the lead's email sequence, on the lead panel and the full lead page.
 *   No sequence → "Start a sequence" → pick one → email 1 filled in for this lead (edit it)
 *   → "Start & send email 1". Emails go from YOUR Gmail; later ones go by themselves
 *   (weekdays 8–5 ET) and stop when they reply, it bounces, or the lead is Lost / Won.
 *   Running → which email is next and when, with Pause / Resume, Skip next, Stop.
 * API: /api/nexus/leads/[id]/sequence (rules in lib/lead-sequences.ts).
 */
import React, { useCallback, useEffect, useState } from 'react'
import { Loader2, Check } from 'lucide-react'

type Email = { step_no: number; day_offset: number; subject: string; reply: boolean; state: 'sent' | 'next' | 'later' | 'skipped' | 'not_sent'; sent_at: string | null }
type Run = {
  id: string; name: string; status: 'active' | 'paused' | 'finished' | 'stopped'; sent: number; total: number; next_send_at: string | null
  started_at: string; sender_name: string | null; to_email: string; last_error: string | null; pause_text: string | null; stop_text: string | null; stopped_at: string | null
  emails: Email[]
}
type SeqOpt = { id: string; name: string; description: string | null; emails: number; days: number }
type Data = { run: Run | null; sequences: SeqOpt[]; gmail: boolean; gmail_address: string | null; email: string | null; do_not_email: boolean; block: string | null; block_text: string | null; sent_today: number; daily_cap: number }
type Preview = { subject: string; body: string; missing: string[]; emails: { step_no: number; day_offset: number; subject: string; reply: boolean }[] }

const C = { ink: '#1D1D1F', ink2: '#3A3A3C', ink3: '#6E6E73', line: 'rgba(0,0,0,.08)', blue: '#0071E3', green: '#1A7F37', orange: '#B25000', red: '#D70015', bg: '#F5F5F7' }
const MISSING_LABEL: Record<string, string> = { first_name: 'contact’s first name', contact_name: 'contact name', property: 'property name', company: 'company', units: 'unit count', city: 'city', rep_name: 'your name', rep_first: 'your name' }

function when(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const today = new Date(); const tmr = new Date(); tmr.setDate(today.getDate() + 1)
  const day = d.toDateString() === today.toDateString() ? 'Today' : d.toDateString() === tmr.toDateString() ? 'Tomorrow' : d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
  return `${day} · ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
}
const shortDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '')

export function SequenceCard({ leadId, onChanged, onToast }: { leadId: string; onChanged?: () => void; onToast?: (t: string) => void }) {
  const [d, setD] = useState<Data | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [pick, setPick] = useState<string | null>(null)
  const [pv, setPv] = useState<Preview | null>(null)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [confirmStop, setConfirmStop] = useState(false)

  const load = useCallback(async () => {
    const r = await fetch(`/api/nexus/leads/${leadId}/sequence`, { cache: 'no-store' })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) { setLoadErr(j?.error ?? 'Could not load the sequence.'); return }
    setLoadErr(null); setD(j as Data)
  }, [leadId])
  useEffect(() => { setD(null); setPicking(false); setPick(null); setPv(null); void load() }, [load])

  async function post(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action); setErr(null)
    try {
      const r = await fetch(`/api/nexus/leads/${leadId}/sequence`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...extra }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(j?.error ?? 'That didn’t work.'); return null }
      return j
    } finally { setBusy(null) }
  }
  async function act(action: string, extra: Record<string, unknown> = {}) {
    const j = await post(action, extra)
    if (!j) return
    if (j.message) onToast?.(j.message)
    setConfirmStop(false)
    await load(); onChanged?.()
  }
  async function choose(id: string) {
    setPick(id); setPv(null)
    const j = await post('preview', { sequence_id: id })
    if (j) { setPv(j as Preview); setSubject(j.subject); setBody(j.body) }
  }
  async function start() {
    if (!pick) return
    const j = await post('start', { sequence_id: pick, subject, body })
    if (!j) return
    onToast?.(j.message ?? 'Sequence started')
    setPicking(false); setPick(null); setPv(null)
    await load(); onChanged?.()
  }

  const box: React.CSSProperties = { background: '#fff', border: `1px solid ${C.line}`, borderRadius: 14, boxShadow: '0 1px 2px rgba(10,20,40,.05)', fontFamily: 'inherit', color: C.ink, overflow: 'hidden' }
  const head = (right?: React.ReactNode) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', borderBottom: `1px solid ${C.line}` }}>
      <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>Email sequence</span>{right}
    </div>
  )
  const btn = (primary = false, danger = false): React.CSSProperties => ({
    minHeight: 34, padding: '0 12px', borderRadius: 9, fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
    border: primary ? 0 : `1px solid ${danger ? 'rgba(215,0,21,.35)' : 'rgba(0,0,0,.14)'}`, background: primary ? C.blue : '#fff', color: primary ? '#fff' : danger ? C.red : C.ink2,
  })
  const pill = (text: string, color: string) => <span style={{ fontSize: 11.5, fontWeight: 600, color, background: `${color}14`, borderRadius: 6, padding: '2px 8px' }}>{text}</span>
  const errBox = err && <div role="alert" style={{ margin: '10px 14px 0', padding: '8px 10px', borderRadius: 9, background: '#FDECEA', color: C.red, fontSize: 12.5 }}>{err}</div>

  if (loadErr) return <section aria-label="Email sequence" style={box}>{head()}<div style={{ padding: 14, fontSize: 13, color: C.ink3 }}>{loadErr}</div></section>
  if (!d) return <section aria-label="Email sequence" style={box}>{head()}<div style={{ padding: 14, color: C.ink3 }}><Loader2 size={16} className="animate-spin" /></div></section>

  const run = d.run
  const live = run && (run.status === 'active' || run.status === 'paused')

  // ── Running / paused ──
  if (live && run) {
    const nextEmail = run.emails.find((e) => e.state === 'next')
    return (
      <section aria-label="Email sequence" style={box}>
        {head(run.status === 'active' ? pill('Running', C.green) : pill('Paused', C.orange))}
        <div style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{run.name}</div>
          <div style={{ fontSize: 12.5, color: C.ink3, marginTop: 2 }}>Email {Math.min(run.sent, run.total)} of {run.total} sent · from {run.sender_name ?? 'you'} to {run.to_email}</div>
          {run.status === 'active' && nextEmail && run.next_send_at && <div style={{ marginTop: 8, fontSize: 13, color: C.ink2 }}>Next: email {nextEmail.step_no} · <b style={{ fontWeight: 600 }}>{when(run.next_send_at)}</b></div>}
          {run.status === 'paused' && <div style={{ marginTop: 8, fontSize: 13, color: C.orange }}>{run.pause_text ?? 'Paused.'}{run.last_error && run.pause_text && /failed/.test(run.pause_text) ? ` Last error: ${run.last_error}` : ''}</div>}
          <ol aria-label="Emails in this sequence" style={{ listStyle: 'none', margin: '10px 0 0', padding: 0 }}>
            {run.emails.map((e) => (
              <li key={e.step_no} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 30, fontSize: 13, color: e.state === 'skipped' ? C.ink3 : C.ink }}>
                <span aria-hidden style={{ width: 18, height: 18, borderRadius: 18, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 700,
                  background: e.state === 'sent' ? C.green : e.state === 'next' ? C.blue : '#E5E5EA', color: e.state === 'sent' || e.state === 'next' ? '#fff' : C.ink3 }}>{e.state === 'sent' ? <Check size={11} /> : e.step_no}</span>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: e.state === 'skipped' ? 'line-through' : undefined }}>
                  {e.subject || (e.reply ? 'Reply in the same email' : `Email ${e.step_no}`)}
                </span>
                <span style={{ fontSize: 12, color: C.ink3, flex: 'none' }}>{e.state === 'sent' ? `Sent ${shortDate(e.sent_at)}` : e.state === 'skipped' ? 'Skipped' : e.state === 'next' ? 'Next' : `Day ${e.day_offset}`}</span>
              </li>
            ))}
          </ol>
        </div>
        {errBox}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '10px 14px 12px', borderTop: `1px solid ${C.line}` }}>
          {run.status === 'active'
            ? <button type="button" style={btn()} disabled={!!busy} onClick={() => void act('pause')}>{busy === 'pause' && <Loader2 size={13} className="animate-spin" />}Pause</button>
            : <button type="button" style={btn(true)} disabled={!!busy} onClick={() => void act('resume')}>{busy === 'resume' && <Loader2 size={13} className="animate-spin" />}Resume</button>}
          {nextEmail && <button type="button" style={btn()} disabled={!!busy} onClick={() => void act('skip')}>{busy === 'skip' && <Loader2 size={13} className="animate-spin" />}Skip email {nextEmail.step_no}</button>}
          <span style={{ flex: 1 }} />
          {confirmStop
            ? <><button type="button" style={btn(false, true)} disabled={!!busy} onClick={() => void act('stop')}>{busy === 'stop' && <Loader2 size={13} className="animate-spin" />}Yes, stop it</button><button type="button" style={btn()} onClick={() => setConfirmStop(false)}>Keep going</button></>
            : <button type="button" style={btn(false, true)} onClick={() => setConfirmStop(true)}>Stop</button>}
        </div>
      </section>
    )
  }

  // ── Not running ──
  const last = run && !live ? run : null
  const lastLine = last && (
    <div style={{ fontSize: 12.5, color: C.ink3, marginBottom: 10 }}>
      Last: <b style={{ fontWeight: 600, color: C.ink2 }}>{last.name}</b> — {last.status === 'finished' ? `finished, all ${last.total} sent` : `stopped (${last.stop_text ?? 'stopped'}) after ${last.sent} of ${last.total}`}{last.stopped_at ? ` · ${shortDate(last.stopped_at)}` : ''}
    </div>
  )

  let body_: React.ReactNode
  if (d.do_not_email) {
    body_ = (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ flex: 1, fontSize: 13, color: C.ink2 }}><b style={{ fontWeight: 600, color: C.red }}>Do not email.</b> They asked not to get emails, so no sequence can start.</span>
        <button type="button" style={btn()} disabled={!!busy} onClick={() => void act('do_not_email', { on: false })}>Allow email again</button>
      </div>
    )
  } else if (d.block) {
    body_ = <div style={{ fontSize: 13, color: C.ink3 }}>{d.block === 'no_email' ? 'Add an email address to this lead to start a sequence.' : d.block === 'won' ? 'This lead is Won — it’s an opportunity now.' : d.block === 'lost' ? 'This lead is Lost — bring it back to start a sequence.' : d.block_text}</div>
  } else if (!d.gmail) {
    body_ = <div style={{ fontSize: 13, color: C.ink2 }}>Sequences send from your own Gmail. Connect it in <b style={{ fontWeight: 600 }}>Mail → Settings</b>, then come back here.</div>
  } else if (!d.sequences.length) {
    body_ = <div style={{ fontSize: 13, color: C.ink3 }}>No sequences set up yet. An admin can add them in Leads → Sequences.</div>
  } else if (!picking) {
    body_ = (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ flex: 1, minWidth: 180, fontSize: 13, color: C.ink2 }}>Send a few short follow-up emails from your Gmail. It stops by itself when they reply.</span>
        <button type="button" style={btn(true)} onClick={() => setPicking(true)}>Start a sequence</button>
      </div>
    )
  } else {
    body_ = (
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: C.ink3, marginBottom: 6 }}>Pick a sequence</div>
        <div role="radiogroup" aria-label="Sequences" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {d.sequences.map((s) => (
            <button key={s.id} type="button" role="radio" aria-checked={pick === s.id} onClick={() => void choose(s.id)}
              style={{ textAlign: 'left', padding: '9px 11px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${pick === s.id ? C.blue : 'rgba(0,0,0,.12)'}`, background: pick === s.id ? 'rgba(0,113,227,.06)' : '#fff' }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: C.ink }}>{s.name}</div>
              <div style={{ fontSize: 12, color: C.ink3 }}>{s.emails} email{s.emails === 1 ? '' : 's'} over {s.days ? `${s.days} days` : 'one day'}{s.description ? ` · ${s.description}` : ''}</div>
            </button>
          ))}
        </div>
        {pick && !pv && busy === 'preview' && <div style={{ padding: 12, color: C.ink3 }}><Loader2 size={16} className="animate-spin" /></div>}
        {pv && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: C.ink3, marginBottom: 6 }}>Email 1 — goes now, check it</div>
            {pv.missing.length > 0 && <div style={{ fontSize: 12.5, color: C.orange, background: 'rgba(178,80,0,.08)', borderRadius: 8, padding: '6px 9px', marginBottom: 8 }}>This lead has no {pv.missing.map((m) => MISSING_LABEL[m] ?? m).join(', ')} — we used a general word. Check the wording.</div>}
            <label style={{ display: 'block', fontSize: 12, color: C.ink3, marginBottom: 3 }} htmlFor={`sq-sub-${leadId}`}>Subject</label>
            <input id={`sq-sub-${leadId}`} value={subject} onChange={(e) => setSubject(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', fontSize: 13.5, padding: '8px 10px', borderRadius: 9, border: '1px solid rgba(0,0,0,.14)', fontFamily: 'inherit', outline: 'none', marginBottom: 8 }} />
            <label style={{ display: 'block', fontSize: 12, color: C.ink3, marginBottom: 3 }} htmlFor={`sq-body-${leadId}`}>Message</label>
            <textarea id={`sq-body-${leadId}`} value={body} onChange={(e) => setBody(e.target.value)} rows={8} style={{ width: '100%', boxSizing: 'border-box', fontSize: 13.5, lineHeight: 1.45, padding: '8px 10px', borderRadius: 9, border: '1px solid rgba(0,0,0,.14)', fontFamily: 'inherit', outline: 'none', resize: 'vertical' }} />
            <div style={{ fontSize: 12, color: C.ink3, margin: '6px 0 10px' }}>To {d.email} from {d.gmail_address ?? 'your Gmail'}. Your signature and a short “reply stop” line are added. Then:{' '}
              {pv.emails.slice(1).map((e) => `day ${e.day_offset}`).join(', ') || 'no more emails'}{pv.emails.length > 1 ? ' (weekdays, 8–5 Eastern)' : ''}.</div>
            {d.sent_today >= d.daily_cap && <div style={{ fontSize: 12.5, color: C.orange, marginBottom: 8 }}>You’ve sent {d.daily_cap} sequence emails today — email 1 will go in the next sending window.</div>}
          </div>
        )}
        {errBox && <div style={{ margin: '0 -14px' }}>{errBox}</div>}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 10 }}>
          <button type="button" style={btn()} onClick={() => { setPicking(false); setPick(null); setPv(null); setErr(null) }}>Cancel</button>
          <button type="button" style={{ ...btn(true), opacity: pv && subject.trim() && body.trim() ? 1 : 0.5 }} disabled={!pv || !subject.trim() || !body.trim() || !!busy} onClick={() => void start()}>
            {busy === 'start' && <Loader2 size={13} className="animate-spin" />}{d.sent_today >= d.daily_cap ? 'Start sequence' : 'Start & send email 1'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <section aria-label="Email sequence" style={box}>
      {head()}
      <div style={{ padding: '12px 14px' }}>
        {lastLine}
        {body_}
      </div>
      {!picking && errBox}
      {!d.do_not_email && !d.block && (
        <div style={{ padding: '0 14px 10px', textAlign: 'right' }}>
          <button type="button" onClick={() => void act('do_not_email', { on: true })} disabled={!!busy}
            style={{ border: 0, background: 'none', color: C.ink3, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', padding: 4 }}>Mark Do not email</button>
        </div>
      )}
    </section>
  )
}
