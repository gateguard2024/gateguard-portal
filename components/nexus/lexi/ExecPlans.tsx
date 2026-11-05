'use client'
/**
 * Executive Lexi — "Waiting on your OK" (only shows for the Executive Lexi user;
 * /api/lexi/plans answers { exec:false } for everyone else, and this renders nothing).
 * Each plan: certainty, dollars, measure, due → open for the problem, steps, evidence,
 * assumptions, risks and what approving creates → Approve / Change / No.
 * Approved plans ask "How did it go?" so Lexi's track record stays honest.
 */
import { useCallback, useEffect, useState } from 'react'
import { T, FONT } from '@/components/nexus/tasks/shared'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

const CSS = `
.xp{background:#fff;border-radius:16px;box-shadow:0 1px 2px rgba(10,20,40,.06),0 8px 24px rgba(10,20,40,.08);margin-bottom:16px;overflow:hidden;font-family:${FONT};color:${T.ink}}
.xp .hd2{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:14px 18px 10px}
.xp .hd2 b{font-size:16px;font-weight:600}
.xp .hd2 .s{font-size:12.5px;color:${T.ink3};margin-top:2px}
.xp-row{border-top:1px solid ${T.line};padding:12px 18px}
.xp-top{display:flex;align-items:flex-start;gap:12px;cursor:pointer;background:none;border:0;padding:0;width:100%;text-align:left;font:inherit;color:inherit}
.xp-top .t{font-size:15px;font-weight:600;line-height:1.35}
.xp-top .m{font-size:12.5px;color:${T.ink3};margin-top:3px}
.xp-pct{flex:none;min-width:48px;height:26px;border-radius:7px;background:#E8F6EC;color:#1A6B32;font-size:12.5px;font-weight:600;display:flex;align-items:center;justify-content:center;font-variant-numeric:tabular-nums}
.xp-body{margin:10px 0 0 60px;font-size:13.5px;line-height:1.5;color:${T.ink2}}
.xp-body h4{margin:10px 0 3px;font-size:12px;font-weight:600;color:${T.ink3};text-transform:uppercase;letter-spacing:.04em}
.xp-body ul,.xp-body ol{margin:0;padding-left:18px}.xp-body li{margin:2px 0}
.xp-acts{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 0 60px}
.xp-b{display:inline-flex;align-items:center;justify-content:center;height:32px;padding:0 12px;border-radius:9px;border:0;font:600 12.5px ${FONT};cursor:pointer;white-space:nowrap}
.xp-b.pri{background:${T.blue};color:#fff}.xp-b.line{background:#fff;border:1px solid ${T.line2};color:${T.ink}}.xp-b.dark{background:rgba(0,0,0,.04);color:${T.ink}}
.xp-b:disabled{opacity:.5;cursor:default}
.xp-note{margin:8px 0 0 60px;display:flex;gap:8px;flex-wrap:wrap}
.xp-note textarea{flex:1 1 260px;min-height:60px;border:1px solid ${T.line2};border-radius:10px;padding:8px 10px;font:400 14px ${FONT};color:${T.ink};resize:vertical}
.xp-msg{margin:8px 0 0 60px;font-size:13px;padding:8px 10px;border-radius:9px;background:#E8F6EC;color:#1A6B32}
.xp-msg.bad{background:#FFECEC;color:${T.red}}
.xp-sub{font-size:13px;font-weight:600;color:${T.ink3};padding:12px 18px 4px;border-top:1px solid ${T.line}}
.xp-small{display:flex;align-items:center;gap:10px;padding:8px 18px;font-size:13.5px}
.xp-small .t{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.xp-small .x{font-size:12px;color:${T.ink3};white-space:nowrap}
.xp-mk{display:block;padding:8px 18px;text-decoration:none;color:inherit}
.xp-mk:hover{background:#FAFAFB}
.xp-mk .t{font-size:13.5px;font-weight:600}
.xp-mk .s{font-size:12.5px;color:${T.ink3};margin-top:1px}
.xp-empty{padding:4px 18px 14px;font-size:14px;color:${T.ink3}}
@media (max-width:640px){.xp-body,.xp-acts,.xp-note,.xp-msg{margin-left:0}.xp-acts .xp-b{flex:1}}
`
const money = (n: unknown) => (n == null || n === '' || !Number.isFinite(Number(n)) ? null : `$${Math.round(Number(n)).toLocaleString()}`)
const day = (d?: string | null) => (d ? new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : null)
const WS_LABEL: Record<string, string> = { sales: 'Sales', upsell: 'Customer upsell', collections: 'Collections', dealers: 'Dealers', nexus: 'Nexus product', fleet: 'Gate Watch & Edge' }
const ACT_LABEL: Record<string, string> = { rock: 'Rock', issue: 'Issue', eos_todo: 'EOS To-Do', task: 'Task' }
const list = (v: unknown) => (Array.isArray(v) ? v.filter(Boolean).map(String) : [])

export function ExecPlans({ onAsk, onOpenConv }: { onAsk: (text: string) => void; onOpenConv?: (id: string) => void }) {
  const [d, setD] = useState<Row | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [noteFor, setNoteFor] = useState<{ id: string; kind: 'change' | 'reject' } | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ id: string; text: string; bad?: boolean } | null>(null)
  const [thinking, setThinking] = useState(false)
  const [thinkMsg, setThinkMsg] = useState<string | null>(null)
  const [briefing, setBriefing] = useState(false)

  const load = useCallback(() => fetch('/api/lexi/plans').then(r => (r.ok ? r.json() : null)).then(x => setD(x)).catch(() => setD(null)), [])
  useEffect(() => { void load() }, [load])

  async function post(body: Row) {
    const r = await fetch('/api/lexi/plans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null)
    const j = r ? await r.json().catch(() => ({})) : { error: 'Couldn’t reach Nexus.' }
    return { ok: !!r?.ok, j }
  }
  async function decide(id: string, action: 'approve' | 'change' | 'reject', n?: string) {
    setBusy(id); setMsg(null)
    const { ok, j } = await post({ id, action, note: n })
    setBusy(null)
    setMsg({ id, text: j.message || j.error || (ok ? 'Done.' : 'That didn’t go through.'), bad: !ok })
    if (ok) {
      setNoteFor(null); setNote('')
      await load()
      if (action === 'change') onAsk(`Revise the plan "${(d?.plans ?? []).find((p: Row) => p.id === id)?.title ?? ''}". My note: ${n}`)
    }
  }
  async function rate(id: string, outcome: 'worked' | 'partly' | 'did_not') {
    setBusy(id)
    const { ok, j } = await post({ id, action: 'outcome', outcome })
    setBusy(null)
    setMsg({ id, text: j.message || j.error, bad: !ok })
    if (ok) await load()
  }
  async function think() {
    setThinking(true); setThinkMsg(null)
    const { ok, j } = await post({ action: 'think' })
    setThinking(false)
    setThinkMsg(ok ? (j.saved ? `Lexi brought ${j.saved} new plan${j.saved === 1 ? '' : 's'}.` : (j.notes?.[0] ? `Nothing cleared 90% yet — ${String(j.notes[0]).slice(0, 240)}` : 'Nothing cleared 90% yet.')) : (j.error || 'Lexi couldn’t finish that.'))
    if (ok) await load()
  }

  async function briefNow() {
    setBriefing(true); setThinkMsg(null)
    const { ok, j } = await post({ action: 'brief' })
    setBriefing(false)
    if (ok && j.conversationId) onOpenConv?.(j.conversationId)
    else setThinkMsg(j.error || 'Lexi couldn’t write the brief.')
  }

  if (!d || !d.exec) return null
  const plans = (d.plans ?? []) as Row[]
  const pending = plans.filter(p => p.status === 'pending' || p.status === 'changes')
  const toRate = plans.filter(p => p.status === 'approved' && !p.outcome && p.due_date && String(p.due_date) <= new Date().toISOString().slice(0, 10)).slice(0, 4)
  const recent = plans.filter(p => p.status === 'approved' || p.status === 'rejected').slice(0, 4)
  const rec = (d.record ?? {}) as Row
  const market = (d.market ?? []) as Row[]
  const work = (d.work ?? []) as Row[]

  return (
    <section className="xp" aria-label="Waiting on your OK">
      <style>{CSS}</style>
      <div className="hd2">
        <div>
          <b>Waiting on your OK{pending.length ? ` (${pending.length})` : ''}</b>
          <div className="s">Plans Lexi is 90%+ sure of. Briefs at 8, 12 and 5.{rec.rated ? ` Track record: ${rec.hit_rate_pct}% of rated plans worked (${rec.rated} rated).` : rec.approved ? ` ${rec.approved} approved so far.` : ''}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {onOpenConv && <button type="button" className="xp-b pri" onClick={briefNow} disabled={briefing}>{briefing ? 'Writing…' : 'Brief me now'}</button>}
          <button type="button" className="xp-b line" onClick={think} disabled={thinking}>{thinking ? 'Thinking…' : 'Think now'}</button>
        </div>
      </div>
      {thinkMsg && <div className="xp-msg" style={{ margin: '0 18px 10px' }}>{thinkMsg}</div>}
      {d.error && <div className="xp-msg bad" style={{ margin: '0 18px 10px' }}>{d.error}</div>}
      {!pending.length && !d.error && <div className="xp-empty">Nothing waiting. Lexi brings plans each weekday morning and when something big comes up — or tap Think now.</div>}

      {pending.map(p => {
        const isOpen = open === p.id
        const acts = (Array.isArray(p.actions) ? p.actions : []) as Row[]
        const nf = noteFor && noteFor.id === p.id ? noteFor : null
        const pm = msg && msg.id === p.id ? msg : null
        return (
          <div key={p.id} className="xp-row">
            <button type="button" className="xp-top" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : p.id)}>
              <span className="xp-pct">{p.confidence}%</span>
              <span style={{ minWidth: 0 }}>
                <div className="t">{p.title}</div>
                <div className="m">{[p.workstream ? WS_LABEL[p.workstream] ?? p.workstream : null, money(p.impact_usd), p.measure, p.due_date ? `by ${day(p.due_date)}` : null, p.owner, p.status === 'changes' ? 'you asked for changes' : null].filter(Boolean).join(' · ')}</div>
              </span>
            </button>
            {isOpen && <div className="xp-body">
              {p.problem && <p style={{ margin: 0 }}>{p.problem}</p>}
              {list(p.plan_steps).length > 0 && <><h4>The plan</h4><ol>{list(p.plan_steps).map((s, i) => <li key={i}>{s}</li>)}</ol></>}
              {list(p.evidence).length > 0 && <><h4>Why Lexi is {p.confidence}% sure</h4><ul>{list(p.evidence).map((s, i) => <li key={i}>{s}</li>)}</ul></>}
              {list(p.assumptions).length > 0 && <><h4>Assumes</h4><ul>{list(p.assumptions).map((s, i) => <li key={i}>{s}</li>)}</ul></>}
              {list(p.risks).length > 0 && <><h4>Risks</h4><ul>{list(p.risks).map((s, i) => <li key={i}>{s}</li>)}</ul></>}
              {p.impact_note && <><h4>The dollars</h4><p style={{ margin: 0 }}>{p.impact_note}</p></>}
              {acts.length > 0 && <><h4>Approving creates</h4><ul>{acts.map((a, i) => <li key={i}>{ACT_LABEL[a.type] ?? a.type}: {a.text}{a.owner ? ` — ${a.owner}` : ''}{a.due_date ? ` (${day(a.due_date)})` : ''}</li>)}</ul></>}
              {p.decision_note && <><h4>Your note</h4><p style={{ margin: 0 }}>{p.decision_note}</p></>}
            </div>}
            <div className="xp-acts">
              <button type="button" className="xp-b pri" disabled={busy === p.id} onClick={() => void decide(p.id, 'approve')}>{busy === p.id ? 'Working…' : 'Approve'}</button>
              <button type="button" className="xp-b line" disabled={busy === p.id} onClick={() => { setNoteFor({ id: p.id, kind: 'change' }); setNote('') }}>Change</button>
              <button type="button" className="xp-b line" disabled={busy === p.id} onClick={() => { setNoteFor({ id: p.id, kind: 'reject' }); setNote('') }}>No</button>
              <button type="button" className="xp-b dark" onClick={() => onAsk(`Walk me through the plan "${p.title}" — what would make you more sure, and what's the first step this week?`)}>Ask Lexi</button>
              {!isOpen && <button type="button" className="xp-b dark" onClick={() => setOpen(p.id)}>Details</button>}
            </div>
            {nf && <div className="xp-note">
              <textarea autoFocus value={note} onChange={e => setNote(e.target.value)} placeholder={nf.kind === 'change' ? 'What should Lexi change?' : 'Why not? (optional — helps Lexi learn)'} aria-label={nf.kind === 'change' ? 'What to change' : 'Why not'} />
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <button type="button" className="xp-b pri" disabled={busy === p.id || (nf.kind === 'change' && !note.trim())} onClick={() => void decide(p.id, nf.kind, note.trim() || undefined)}>{nf.kind === 'change' ? 'Send back' : 'Say no'}</button>
                <button type="button" className="xp-b line" onClick={() => setNoteFor(null)}>Cancel</button>
              </div>
            </div>}
            {pm && <div className={`xp-msg${pm.bad ? ' bad' : ''}`}>{pm.text}</div>}
          </div>
        )
      })}

      {work.length > 0 && <>
        <div className="xp-sub">What I’m working on</div>
        {work.slice(0, 8).map(w => <button key={w.id} type="button" className="xp-mk" style={{ border: 0, background: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', font: 'inherit' }} onClick={() => onAsk(`Where are you on "${w.title}"? What do you need from me?`)}>
          <div className="t">{w.title}{w.status === 'waiting' ? ' · waiting' : ''}</div>
          <div className="s">{[WS_LABEL[w.workstream] ?? w.workstream, w.next_step ? `Next: ${w.next_step}` : null].filter(Boolean).join(' · ')}</div>
        </button>)}
      </>}

      {toRate.length > 0 && <>
        <div className="xp-sub">How did these go?</div>
        {toRate.map(p => <div key={p.id} className="xp-small">
          <span className="t">{p.title}</span>
          <button type="button" className="xp-b line" disabled={busy === p.id} onClick={() => void rate(p.id, 'worked')}>Worked</button>
          <button type="button" className="xp-b line" disabled={busy === p.id} onClick={() => void rate(p.id, 'partly')}>Partly</button>
          <button type="button" className="xp-b line" disabled={busy === p.id} onClick={() => void rate(p.id, 'did_not')}>Didn’t</button>
        </div>)}
      </>}

      {recent.length > 0 && <>
        <div className="xp-sub">Recently decided</div>
        {recent.map(p => <div key={p.id} className="xp-small">
          <span className="lx-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: p.status === 'approved' ? '#34C759' : '#C7C7CC', flex: 'none' }} />
          <span className="t">{p.title}</span>
          <span className="x">{p.status === 'approved' ? (p.outcome ? { worked: 'Worked', partly: 'Partly worked', did_not: 'Didn’t work' }[p.outcome as string] : 'Approved') : 'Said no'}</span>
        </div>)}
      </>}

      {market.length > 0 && <>
        <div className="xp-sub">In the market</div>
        {market.slice(0, 3).map(n => <a key={n.url} className="xp-mk" href={n.url} target="_blank" rel="noreferrer">
          <div className="t">{n.headline}</div>
          <div className="s">{n.why_it_matters}{n.source ? ` — ${n.source}` : ''}</div>
        </a>)}
        <div style={{ height: 8 }} />
      </>}
    </section>
  )
}
