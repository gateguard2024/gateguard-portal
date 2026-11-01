'use client'

/**
 * Lexi side panels (Phase 2).
 *   BrainPanel      — what Lexi remembers: "Just for me" + the shared company Brain.
 *   RecordingPanel  — a meeting / call recording (audio via Plaud, or pasted text)
 *                     → summary, to-dos, CRM note, follow-up email. To-dos and the
 *                     note are created through /api/assistant/execute (undoable).
 */
import { useEffect, useState, type ReactNode } from 'react'
import { T, FONT } from '@/components/nexus/tasks/shared'

type BrainRow = { id: string; scope: 'company' | 'personal'; category: string; title: string | null; body: string; created_by_name: string | null; updated_at: string }
type Link = { type: 'opportunity' | 'site'; id: string; label: string }
type Todo = { title: string; due_date: string | null; owner: string | null }
type Rec = { id: string | null; title: string; summary: string; decisions: string[]; todos: Todo[]; crm_note: string; follow_up: { to: string | null; subject: string; body: string } | null; links: Link[] }

const CATS: { k: string; l: string }[] = [{ k: 'fact', l: 'Fact' }, { k: 'pricing', l: 'Pricing' }, { k: 'policy', l: 'Policy' }, { k: 'script', l: 'Script' }, { k: 'voice', l: 'How we write' }, { k: 'preference', l: 'Preference' }]
const catLabel = (k: string) => CATS.find(c => c.k === k)?.l ?? k

export const PANEL_CSS = `
.lp{position:fixed;inset:0;z-index:120;background:rgba(15,23,42,.42);display:flex;justify-content:flex-end;font-family:${FONT};color:${T.ink};letter-spacing:-.01em}
.lp *{box-sizing:border-box}
.lp .p{width:min(560px,100%);height:100%;background:#fff;display:flex;flex-direction:column}
.lp .hd{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:16px 18px;border-bottom:1px solid ${T.line}}
.lp .hd b{font-size:17px;font-weight:600}
.lp .bd{flex:1;overflow-y:auto;padding:16px 18px calc(24px + env(safe-area-inset-bottom));display:grid;gap:14px;align-content:start}
.lp .help{font-size:13px;color:${T.ink3};line-height:1.45}
.lp .seg{display:flex;gap:2px;padding:3px;border-radius:10px;background:#EEF0F4;width:max-content}
.lp .seg button{border:0;background:none;padding:6px 12px;border-radius:8px;font:500 13px ${FONT};color:${T.ink2};cursor:pointer}
.lp .seg button[aria-selected=true]{background:#fff;color:${T.ink};font-weight:600;box-shadow:0 1px 2px rgba(0,0,0,.08)}
.lp .box{border:1px solid ${T.line};border-radius:12px;padding:12px;display:grid;gap:8px}
.lp input,.lp select,.lp textarea{font:400 14px ${FONT};color:${T.ink};border:1px solid ${T.line2};border-radius:10px;padding:9px 10px;background:#fff;width:100%}
.lp textarea{resize:vertical;line-height:1.45}
.lp .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.lp .btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:36px;padding:0 14px;border-radius:10px;border:0;font:600 13px ${FONT};cursor:pointer;white-space:nowrap;background:${T.blue};color:#fff}
.lp .btn.line{background:#fff;border:1px solid ${T.line2};color:${T.ink}}
.lp .btn:disabled{opacity:.5;cursor:default}
.lp .item{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border-radius:12px;background:#F5F5F7}
.lp .item .t{font-size:14px;line-height:1.4;flex:1;min-width:0;white-space:pre-wrap;word-break:break-word}
.lp .item .m{font-size:12px;color:${T.ink3};margin-top:2px}
.lp .item .x{border:0;background:none;color:${T.ink3};cursor:pointer;font-size:18px;line-height:1;padding:0 4px}
.lp .tag{display:inline-block;font-size:11px;font-weight:600;color:${T.ink3};text-transform:uppercase;letter-spacing:.04em;margin-right:6px}
.lp h3{margin:0;font-size:13px;font-weight:600;color:${T.ink3};text-transform:uppercase;letter-spacing:.04em}
.lp .ok{padding:8px 12px;border-radius:10px;background:#E8F6EC;color:#1A6B32;font-size:13px}
.lp .bad{padding:8px 12px;border-radius:10px;background:#FFECEC;color:${T.red};font-size:13px}
.lp .spin{width:12px;height:12px;border-radius:50%;border:2px solid #D6E4FF;border-top-color:${T.blue};animation:lp-rot .8s linear infinite;display:inline-block}
@keyframes lp-rot{to{transform:rotate(360deg)}}
.lp .todo{display:flex;gap:10px;align-items:center;padding:8px 10px;border-radius:10px;background:#F5F5F7}
.lp .todo input[type=checkbox]{width:18px;height:18px;flex:none}
.lp .todo input[type=date]{width:150px;flex:none;padding:5px 8px;font-size:13px}
.lp .todo .t{flex:1;min-width:0;font-size:14px}
@media (max-width:640px){.lp .todo{flex-wrap:wrap}.lp .todo input[type=date]{width:100%}}
`

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])
  return <div className="lp" onClick={onClose}>
    <style>{PANEL_CSS}</style>
    <div className="p" role="dialog" aria-label={title} onClick={e => e.stopPropagation()}>
      <div className="hd"><b>{title}</b><button type="button" className="btn line" onClick={onClose}>Close</button></div>
      <div className="bd">{children}</div>
    </div>
  </div>
}

// ── Brain ────────────────────────────────────────────────────────────────────
export function BrainPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'personal' | 'company'>('personal')
  const [data, setData] = useState<{ company: BrainRow[]; personal: BrainRow[]; canEditCompany: boolean } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [form, setForm] = useState({ body: '', title: '', category: 'preference' })
  const [busy, setBusy] = useState(false)

  const load = () => fetch('/api/lexi/brain').then(async r => {
    const d = await r.json().catch(() => ({}))
    if (!r.ok) { setErr(d?.error || 'Couldn’t load the Brain.'); setData({ company: [], personal: [], canEditCompany: false }); return }
    setErr(null); setData(d)
  }).catch(() => setErr('Couldn’t load the Brain.'))
  useEffect(() => { void load() }, [])
  useEffect(() => { setForm(f => ({ ...f, category: tab === 'personal' ? 'preference' : 'fact' })) }, [tab])

  async function add() {
    if (!form.body.trim() || busy) return
    setBusy(true); setErr(null)
    const r = await fetch('/api/lexi/brain', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, scope: tab }) }).catch(() => null)
    const d = r ? await r.json().catch(() => ({})) : {}
    setBusy(false)
    if (!r?.ok) { setErr(d?.error || 'That didn’t save. Try again.'); return }
    setForm(f => ({ ...f, body: '', title: '' })); void load()
  }
  async function del(id: string) {
    const r = await fetch(`/api/lexi/brain?id=${id}`, { method: 'DELETE' }).catch(() => null)
    if (!r?.ok) { const d = r ? await r.json().catch(() => ({})) : {}; setErr(d?.error || 'Couldn’t remove that.'); return }
    void load()
  }

  const rows = data ? (tab === 'personal' ? data.personal : data.company) : null
  const canAdd = tab === 'personal' || !!data?.canEditCompany
  return <Sheet title="Lexi’s Brain" onClose={onClose}>
    <div className="help">What Lexi remembers in every chat. You can also just tell Lexi: “remember that I like short answers” or “remember our install labor rate is $95/hr for everyone”.</div>
    <div className="seg" role="tablist">
      <button type="button" role="tab" aria-selected={tab === 'personal'} onClick={() => setTab('personal')}>Just for me{data ? ` (${data.personal.length})` : ''}</button>
      <button type="button" role="tab" aria-selected={tab === 'company'} onClick={() => setTab('company')}>Company{data ? ` (${data.company.length})` : ''}</button>
    </div>
    {tab === 'company' && <div className="help">Shared with everyone at your company: pricing, policies, call scripts and how we write. {data?.canEditCompany ? 'You can edit it.' : 'Admins and supervisors edit it.'}</div>}
    {err && <div className="bad" role="alert">{err}</div>}
    {canAdd && <div className="box">
      <textarea rows={3} placeholder={tab === 'personal' ? 'e.g. Keep answers short. I work out of the Atlanta office.' : 'e.g. Standard install labor is $95/hr; after-hours is $140/hr.'} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} aria-label="What to remember" />
      <div className="row">
        <input style={{ flex: '1 1 180px', width: 'auto' }} placeholder="Short label (optional)" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} aria-label="Label" />
        <select style={{ flex: '0 0 auto', width: 'auto' }} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} aria-label="Type">{CATS.map(c => <option key={c.k} value={c.k}>{c.l}</option>)}</select>
        <button type="button" className="btn" onClick={add} disabled={busy || !form.body.trim()}>{busy ? 'Saving…' : 'Add'}</button>
      </div>
    </div>}
    {rows === null ? <div className="help"><span className="spin" /> Loading…</div>
      : rows.length === 0 ? <div className="help">{tab === 'personal' ? 'Nothing yet.' : 'The company Brain is empty.'}</div>
      : <div style={{ display: 'grid', gap: 8 }}>{rows.map(r => <div key={r.id} className="item">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="t"><span className="tag">{catLabel(r.category)}</span>{r.title ? <b style={{ fontWeight: 600 }}>{r.title}: </b> : null}{r.body}</div>
          <div className="m">{r.created_by_name ? `${r.created_by_name} · ` : ''}{new Date(r.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
        </div>
        {(tab === 'personal' || data?.canEditCompany) && <button type="button" className="x" aria-label="Remove" title="Remove" onClick={() => void del(r.id)}>×</button>}
      </div>)}</div>}
  </Sheet>
}

// ── Recording ────────────────────────────────────────────────────────────────
type Done = { tasks?: number; note?: boolean; copied?: boolean; error?: string }
export function RecordingPanel({ onClose, canAct = true }: { onClose: () => void; canAct?: boolean }) {
  const [mode, setMode] = useState<'audio' | 'text'>('audio')
  const [file, setFile] = useState<File | null>(null)
  const [text, setText] = useState('')
  const [title, setTitle] = useState('')
  const [step, setStep] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [rec, setRec] = useState<Rec | null>(null)
  const [pick, setPick] = useState<boolean[]>([])
  const [dues, setDues] = useState<(string | null)[]>([])
  const [link, setLink] = useState<string>('')
  const [done, setDone] = useState<Done>({})
  const [working, setWorking] = useState(false)
  const [past, setPast] = useState<{ id: string; title: string | null; created_at: string; result: Rec | null }[] | null>(null)

  useEffect(() => { fetch('/api/lexi/recording').then(r => r.json()).then(d => setPast(Array.isArray(d?.recordings) ? d.recordings : [])).catch(() => setPast([])) }, [])

  function show(r: Rec) {
    setRec(r); setPick(r.todos.map(() => true)); setDues(r.todos.map(t => t.due_date)); setLink(r.links[0] ? `${r.links[0].type}:${r.links[0].id}` : ''); setDone({})
  }

  async function process() {
    setErr(null)
    let transcript = text.trim()
    try {
      if (mode === 'audio') {
        if (!file) { setErr('Choose an audio file first.'); return }
        setStep('Transcribing the audio (up to 2 minutes)…')
        const fd = new FormData(); fd.append('audio', file)
        const r = await fetch('/api/plaud/transcribe', { method: 'POST', body: fd })
        const d = await r.json().catch(() => ({}))
        if (!r.ok || !d?.transcript) throw new Error(d?.error ? `Transcription failed: ${d.error}` : 'Transcription failed.')
        transcript = String(d.transcript)
      }
      if (transcript.length < 40) { setErr('That’s too short — paste the full transcript.'); setStep(null); return }
      setStep('Lexi is reading it…')
      const r = await fetch('/api/lexi/recording', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transcript, title }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d?.recording) throw new Error(d?.error || 'Lexi couldn’t read that recording.')
      show(d.recording as Rec)
      if (d.saved === false && d.saveError) setErr(`Notes are ready, but weren’t saved to history: ${d.saveError}`)
    } catch (e) { setErr(e instanceof Error ? e.message : 'Something went wrong.') }
    setStep(null)
  }

  const linked = rec?.links.find(l => `${l.type}:${l.id}` === link) ?? null
  async function exec(toolName: string, toolArgs: Record<string, unknown>) {
    const r = await fetch('/api/assistant/execute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ toolName, toolArgs }) }).catch(() => null)
    const d = r ? await r.json().catch(() => ({})) : {}
    return !!r?.ok && d?.success !== false
  }
  async function addTasks() {
    if (!rec || working) return
    setWorking(true)
    let n = 0, failed = 0
    for (let i = 0; i < rec.todos.length; i++) {
      if (!pick[i]) continue
      const ok = await exec('create_todo', {
        title: rec.todos[i].title, due_date: dues[i] || null,
        notes: `From recording: ${rec.title}${rec.todos[i].owner ? ` (said by ${rec.todos[i].owner})` : ''}`,
        reasoning: 'Action item from a recorded meeting.',
        ...(linked ? { linked_type: linked.type, linked_id: linked.id, linked_label: linked.label.replace(/ \((deal|property)\)$/, '') } : {}),
      })
      if (ok) n++; else failed++
    }
    setDone(d => ({ ...d, tasks: (d.tasks ?? 0) + n, error: failed ? `${failed} task${failed > 1 ? 's' : ''} didn’t save.` : undefined }))
    setPick(p => p.map(() => false))
    setWorking(false)
  }
  async function logNote() {
    if (!rec || !linked || linked.type !== 'opportunity' || working) return
    setWorking(true)
    const ok = await exec('log_crm_activity', { type: 'meeting', subject: `Meeting notes: ${rec.title}`, body: rec.crm_note, opportunity_id: linked.id, reasoning: 'Notes from a recorded meeting.' })
    setDone(d => ({ ...d, note: ok || d.note, error: ok ? d.error : 'The note didn’t save. Try again.' }))
    setWorking(false)
  }
  function copyEmail() {
    if (!rec?.follow_up) return
    const t = `${rec.follow_up.subject ? `Subject: ${rec.follow_up.subject}\n\n` : ''}${rec.follow_up.body}`
    navigator.clipboard?.writeText(t).then(() => setDone(d => ({ ...d, copied: true }))).catch(() => setDone(d => ({ ...d, error: 'Couldn’t copy — select the text instead.' })))
  }

  const picked = pick.filter(Boolean).length
  return <Sheet title="Recording → notes & to-dos" onClose={onClose}>
    {!rec ? <>
      <div className="help">Drop in a meeting or call recording (Plaud, your phone’s voice memo) or paste a transcript. Lexi writes the summary, the to-dos, a note for the deal and a follow-up email.</div>
      <div className="seg" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'audio'} onClick={() => setMode('audio')}>Audio file</button>
        <button type="button" role="tab" aria-selected={mode === 'text'} onClick={() => setMode('text')}>Paste transcript</button>
      </div>
      <input placeholder="Title (optional) — e.g. Marbella walk with the PM" value={title} onChange={e => setTitle(e.target.value)} aria-label="Title" />
      {mode === 'audio'
        ? <label className="box" style={{ cursor: 'pointer', textAlign: 'center' }}>
          <input type="file" accept="audio/*,.m4a,.mp3,.wav,.aac,.ogg,.webm" style={{ display: 'none' }} onChange={e => setFile(e.target.files?.[0] ?? null)} />
          <b style={{ fontWeight: 600, fontSize: 14 }}>{file ? file.name : 'Choose an audio file'}</b>
          <span className="help">{file ? `${(file.size / 1048576).toFixed(1)} MB · tap to change` : 'm4a, mp3, wav — short recordings work best. For a long meeting, paste the Plaud transcript instead.'}</span>
        </label>
        : <textarea rows={10} placeholder="Paste the transcript here (from the Plaud app: Export → Text)." value={text} onChange={e => setText(e.target.value)} aria-label="Transcript" />}
      {err && <div className="bad" role="alert">{err}</div>}
      <button type="button" className="btn" onClick={process} disabled={!!step || (mode === 'audio' ? !file : text.trim().length < 40)}>{step ? <><span className="spin" /> {step}</> : 'Turn it into notes'}</button>
      {past && past.length > 0 && <>
        <h3 style={{ marginTop: 6 }}>Recent</h3>
        <div style={{ display: 'grid', gap: 6 }}>{past.slice(0, 8).map(p => <button key={p.id} type="button" className="item" style={{ border: 0, cursor: p.result ? 'pointer' : 'default', textAlign: 'left', font: 'inherit' }} onClick={() => p.result && show({ ...p.result, id: p.id })}>
          <span className="t">{p.title || 'Recording'}</span><span className="m">{new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
        </button>)}</div>
      </>}
    </> : <>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <b style={{ fontSize: 18, fontWeight: 600 }}>{rec.title}</b>
        <button type="button" className="btn line" onClick={() => { setRec(null); setFile(null); setText(''); setTitle(''); setErr(null) }}>New recording</button>
      </div>
      {err && <div className="bad" role="alert">{err}</div>}
      <div style={{ fontSize: 14.5, lineHeight: 1.55 }}>{rec.summary}</div>
      {rec.decisions.length > 0 && <><h3>Decided</h3><ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.5 }}>{rec.decisions.map((d, i) => <li key={i}>{d}</li>)}</ul></>}

      <h3>About</h3>
      <select value={link} onChange={e => setLink(e.target.value)} aria-label="What this recording is about">
        <option value="">Not linked</option>
        {rec.links.map(l => <option key={`${l.type}:${l.id}`} value={`${l.type}:${l.id}`}>{l.label}</option>)}
      </select>
      {rec.links.length === 0 && <div className="help">Lexi didn’t find a matching deal or property. Tasks will be added unlinked.</div>}

      <h3>To-dos ({rec.todos.length})</h3>
      {rec.todos.length === 0 ? <div className="help">No action items found.</div> : <div style={{ display: 'grid', gap: 6 }}>
        {rec.todos.map((t, i) => <label key={i} className="todo">
          <input type="checkbox" checked={!!pick[i]} onChange={e => setPick(p => p.map((v, j) => (j === i ? e.target.checked : v)))} />
          <span className="t">{t.title}{t.owner ? <span style={{ color: T.ink3 }}> · {t.owner}</span> : null}</span>
          <input type="date" value={dues[i] ?? ''} onChange={e => setDues(ds => ds.map((v, j) => (j === i ? e.target.value || null : v)))} aria-label={`Due date for ${t.title}`} />
        </label>)}
        {canAct ? <div className="row"><button type="button" className="btn" onClick={addTasks} disabled={working || picked === 0}>{working ? 'Adding…' : `Add ${picked} task${picked === 1 ? '' : 's'}`}</button>{done.tasks ? <span className="ok">✓ {done.tasks} added to your tasks</span> : null}</div> : <div className="help">Your Lexi access is view-only — copy these into your tasks yourself.</div>}
      </div>}

      <h3>Note for the record</h3>
      <div className="item"><span className="t">{rec.crm_note}</span></div>
      {canAct && <div className="row">
        <button type="button" className="btn line" onClick={logNote} disabled={working || !linked || linked.type !== 'opportunity' || !!done.note}>{done.note ? 'Logged ✓' : 'Log to the deal'}</button>
        {(!linked || linked.type !== 'opportunity') && <span className="help">Pick a deal above to log this note.</span>}
      </div>}

      {rec.follow_up && <>
        <h3>Follow-up email</h3>
        <div className="item"><span className="t">{rec.follow_up.to ? <><b style={{ fontWeight: 600 }}>To:</b> {rec.follow_up.to}{'\n'}</> : null}{rec.follow_up.subject ? <><b style={{ fontWeight: 600 }}>Subject:</b> {rec.follow_up.subject}{'\n\n'}</> : null}{rec.follow_up.body}</span></div>
        <div className="row"><button type="button" className="btn line" onClick={copyEmail}>{done.copied ? 'Copied ✓' : 'Copy email'}</button></div>
      </>}
      {done.error && <div className="bad" role="alert">{done.error}</div>}
    </>}
  </Sheet>
}
