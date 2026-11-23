'use client'

/**
 * SequencesAdmin — Leads → Sequences (admins). Make and edit email sequences:
 * each email has the day it goes (days after the rep presses Start), a subject, a
 * message with fill-in fields ({first_name}, {property} …) and whether it goes as a
 * reply in the same email. Turning one off stops new leads starting it.
 * API: /api/nexus/sequences (rules in lib/lead-sequences.ts).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { X, Plus, Loader2, Trash2 } from 'lucide-react'

type Step = { step_no?: number; day_offset: number; subject: string; body: string; same_thread: boolean }
type Seq = { id: string; name: string; description: string | null; active: boolean; org_id: string | null; can_edit: boolean; steps: Step[] }
type Draft = { id: string | null; name: string; description: string; active: boolean; steps: Step[] }

const C = { ink: '#1D1D1F', ink2: '#3A3A3C', ink3: '#6E6E73', line: 'rgba(0,0,0,.08)', blue: '#0071E3', green: '#1A7F37', red: '#D70015', bg: '#F5F5F7' }
const VAR_HELP: Record<string, string> = { first_name: 'Contact first name', contact_name: 'Contact full name', property: 'Property', company: 'Company', units: 'Units', city: 'City', rep_name: 'Your name', rep_first: 'Your first name' }
const blank = (): Draft => ({ id: null, name: '', description: '', active: true, steps: [{ day_offset: 0, subject: '', body: 'Hi {first_name},\n\n', same_thread: true }] })

const CSS = `
.sqa{position:fixed;inset:0;z-index:130;background:rgba(0,0,0,.35);display:flex;align-items:stretch;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter",sans-serif;color:${C.ink}}
.sqa-win{background:${C.bg};width:min(1100px,100%);margin:24px;border-radius:14px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.3)}
.sqa-hd{display:flex;align-items:center;gap:10px;padding:12px 16px;background:#fff;border-bottom:1px solid ${C.line}}
.sqa-hd h2{margin:0;font-size:17px;font-weight:600;flex:1}
.sqa-body{flex:1;min-height:0;display:grid;grid-template-columns:300px minmax(0,1fr)}
.sqa-list{border-right:1px solid ${C.line};overflow:auto;padding:10px;background:#fff}
.sqa-item{display:block;width:100%;text-align:left;border:0;background:none;border-radius:10px;padding:9px 10px;cursor:pointer;font-family:inherit;margin-bottom:2px}
.sqa-item:hover{background:${C.bg}}
.sqa-item[aria-current=true]{background:rgba(0,113,227,.08)}
.sqa-ed{overflow:auto;padding:16px}
.sqa-card{background:#fff;border-radius:12px;border:1px solid ${C.line};padding:12px 14px;margin-bottom:10px}
.sqa-in{width:100%;box-sizing:border-box;font-size:14px;padding:8px 10px;border-radius:9px;border:1px solid rgba(0,0,0,.14);font-family:inherit;outline:none;background:#fff;color:${C.ink}}
.sqa-in:focus{border-color:${C.blue}}
.sqa-lb{display:block;font-size:12px;color:${C.ink3};margin:0 0 3px}
.sqa-btn{min-height:34px;padding:0 12px;border-radius:9px;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(0,0,0,.14);background:#fff;color:${C.ink2}}
.sqa-btn.pri{border:0;background:${C.blue};color:#fff}
.sqa-btn.red{color:${C.red};border-color:rgba(215,0,21,.35)}
.sqa-chip{border:1px solid rgba(0,0,0,.12);background:#fff;border-radius:6px;font-size:11.5px;padding:2px 7px;cursor:pointer;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:${C.ink2}}
.sqa-chip:hover{border-color:${C.blue};color:${C.blue}}
.sqa-back{display:none}
@media (max-width:760px){.sqa-win{margin:0;border-radius:0}.sqa-body{grid-template-columns:1fr}.sqa-body.editing .sqa-list{display:none}.sqa-body:not(.editing) .sqa-ed{display:none}.sqa-back{display:inline-flex}}
`

export function SequencesAdmin({ onClose }: { onClose: () => void }) {
  const [list, setList] = useState<Seq[] | null>(null)
  const [vars, setVars] = useState<string[]>(Object.keys(VAR_HELP))
  const [err, setErr] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [canEdit, setCanEdit] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const bodyRefs = useRef<Record<number, HTMLTextAreaElement | null>>({})

  const load = useCallback(async () => {
    const r = await fetch('/api/nexus/sequences', { cache: 'no-store' })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) { setErr(j?.error ?? 'Could not load sequences.'); setList([]); return [] as Seq[] }
    setErr(null); setList(j.sequences ?? []); if (Array.isArray(j.vars)) setVars(j.vars)
    return (j.sequences ?? []) as Seq[]
  }, [])
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  }, [onClose])

  const open = (s: Seq) => { setSaved(null); setErr(null); setCanEdit(s.can_edit); setDraft({ id: s.id, name: s.name, description: s.description ?? '', active: s.active, steps: s.steps.map((x) => ({ day_offset: x.day_offset, subject: x.subject ?? '', body: x.body ?? '', same_thread: x.same_thread !== false })) }) }
  const setStep = (i: number, patch: Partial<Step>) => setDraft((d) => (d ? { ...d, steps: d.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) } : d))
  const insertVar = (i: number, v: string) => {
    const el = bodyRefs.current[i]
    const token = `{${v}}`
    if (!el || !draft) { setStep(i, { body: (draft?.steps[i].body ?? '') + token }); return }
    const a = el.selectionStart ?? el.value.length, b = el.selectionEnd ?? a
    const next = el.value.slice(0, a) + token + el.value.slice(b)
    setStep(i, { body: next })
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + token.length, a + token.length) })
  }

  async function save() {
    if (!draft) return
    setBusy('save'); setErr(null); setSaved(null)
    try {
      const payload = { name: draft.name, description: draft.description, active: draft.active, steps: draft.steps.map((s, i) => ({ day_offset: i === 0 ? 0 : s.day_offset, subject: s.subject, body: s.body, same_thread: i === 0 ? true : s.same_thread })) }
      const r = await fetch('/api/nexus/sequences', { method: draft.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft.id ? { id: draft.id, ...payload } : payload) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(j?.error ?? 'Could not save.'); return }
      const all = await load()
      const s = all.find((x) => x.id === j.sequence?.id)
      if (s) open(s)
      setSaved('Saved')
    } finally { setBusy(null) }
  }
  async function toggleActive() {
    if (!draft?.id) { setDraft((d) => (d ? { ...d, active: !d.active } : d)); return }
    setBusy('active'); setErr(null)
    try {
      const r = await fetch('/api/nexus/sequences', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: draft.id, active: !draft.active }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(j?.error ?? 'Could not change it.'); return }
      setDraft((d) => (d ? { ...d, active: !d.active } : d)); setSaved(draft.active ? 'Turned off — leads already in it keep going' : 'Turned on'); void load()
    } finally { setBusy(null) }
  }

  const ro = !canEdit
  return (
    <div className="sqa" role="dialog" aria-modal="true" aria-label="Email sequences" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="sqa-win">
        <div className="sqa-hd">
          {draft && <button type="button" className="sqa-btn sqa-back" onClick={() => setDraft(null)}>‹ Sequences</button>}
          <h2>Email sequences</h2>
          <button type="button" className="sqa-btn" onClick={onClose} aria-label="Close"><X size={15} /></button>
        </div>
        <div className={`sqa-body${draft ? ' editing' : ''}`}>
          <nav className="sqa-list" aria-label="Sequences">
            <button type="button" className="sqa-btn pri" style={{ width: '100%', justifyContent: 'center', marginBottom: 10 }} onClick={() => { setSaved(null); setErr(null); setCanEdit(true); setDraft(blank()) }}><Plus size={14} /> New sequence</button>
            {list == null ? <div style={{ padding: 16, color: C.ink3 }}><Loader2 size={16} className="animate-spin" /></div>
              : list.length === 0 ? <div style={{ padding: 10, fontSize: 13, color: C.ink3 }}>No sequences yet.</div>
              : list.map((s) => (
                <button key={s.id} type="button" className="sqa-item" aria-current={draft?.id === s.id} onClick={() => open(s)}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: s.active ? C.ink : C.ink3 }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: C.ink3 }}>{s.steps.length} email{s.steps.length === 1 ? '' : 's'} · {s.steps.length ? `${s.steps[s.steps.length - 1].day_offset} days` : '—'}{!s.active ? ' · Off' : ''}{s.org_id == null ? ' · Gate Guard' : ''}</div>
                </button>
              ))}
          </nav>
          <div className="sqa-ed">
            {!draft ? (
              <div style={{ color: C.ink3, fontSize: 14, padding: '30px 10px', maxWidth: 520 }}>
                Pick a sequence to edit, or make a new one. Each email goes from the rep’s own Gmail on its day (weekdays 8–5 Eastern), and the sequence stops by itself when the lead replies, it bounces, or the lead is Lost or Won.
                {err && <div role="alert" style={{ marginTop: 12, color: C.red }}>{err}</div>}
              </div>
            ) : (
              <>
                <div className="sqa-card">
                  <label className="sqa-lb" htmlFor="sqa-name">Name</label>
                  <input id="sqa-name" className="sqa-in" value={draft.name} readOnly={ro} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. New lead (4 emails)" style={{ marginBottom: 8 }} />
                  <label className="sqa-lb" htmlFor="sqa-desc">What it’s for (optional)</label>
                  <input id="sqa-desc" className="sqa-in" value={draft.description} readOnly={ro} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Shown to reps when they pick a sequence" />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                    <span style={{ flex: 1, fontSize: 13, color: draft.active ? C.green : C.ink3, fontWeight: 600 }}>{draft.active ? 'On — reps can start it' : 'Off — reps can’t start it'}</span>
                    {!ro && <button type="button" className="sqa-btn" disabled={!!busy} onClick={() => void toggleActive()}>{busy === 'active' && <Loader2 size={13} className="animate-spin" />}{draft.active ? 'Turn off' : 'Turn on'}</button>}
                  </div>
                </div>

                {draft.steps.map((s, i) => (
                  <div key={i} className="sqa-card" aria-label={`Email ${i + 1}`}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                      <b style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>Email {i + 1}</b>
                      {i === 0
                        ? <span style={{ fontSize: 12.5, color: C.ink3 }}>Day 0 — when the rep presses Start</span>
                        : <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.ink2 }}>Day
                            <input type="number" min={1} max={365} className="sqa-in" style={{ width: 72, padding: '5px 8px' }} readOnly={ro} value={s.day_offset} aria-label={`Email ${i + 1} day`} onChange={(e) => setStep(i, { day_offset: Math.max(0, Math.round(Number(e.target.value) || 0)) })} />
                          </label>}
                      {i > 0 && !ro && <button type="button" className="sqa-btn red" aria-label={`Remove email ${i + 1}`} onClick={() => setDraft({ ...draft, steps: draft.steps.filter((_, j) => j !== i) })}><Trash2 size={13} /></button>}
                    </div>
                    {i > 0 && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: C.ink2, marginBottom: 8 }}>
                        <input type="checkbox" checked={s.same_thread} disabled={ro} onChange={(e) => setStep(i, { same_thread: e.target.checked })} style={{ width: 16, height: 16, accentColor: C.blue }} />
                        Send as a reply in the same email (recommended)
                      </label>
                    )}
                    <label className="sqa-lb" htmlFor={`sqa-sub-${i}`}>Subject{i > 0 && s.same_thread ? ' (leave empty to keep “Re: …” of email 1)' : ''}</label>
                    <input id={`sqa-sub-${i}`} className="sqa-in" readOnly={ro} value={s.subject} onChange={(e) => setStep(i, { subject: e.target.value })} placeholder={i > 0 && s.same_thread ? 'Re: (email 1’s subject)' : 'Subject'} style={{ marginBottom: 8 }} />
                    <label className="sqa-lb" htmlFor={`sqa-body-${i}`}>Message</label>
                    <textarea id={`sqa-body-${i}`} ref={(el) => { bodyRefs.current[i] = el }} className="sqa-in" readOnly={ro} rows={7} value={s.body} onChange={(e) => setStep(i, { body: e.target.value })} style={{ resize: 'vertical', lineHeight: 1.45 }} />
                    {!ro && (
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
                        <span style={{ fontSize: 11.5, color: C.ink3 }}>Insert:</span>
                        {vars.map((v) => <button key={v} type="button" className="sqa-chip" title={VAR_HELP[v] ?? v} onClick={() => insertVar(i, v)}>{`{${v}}`}</button>)}
                      </div>
                    )}
                  </div>
                ))}
                {!ro && draft.steps.length < 10 && (
                  <button type="button" className="sqa-btn" style={{ marginBottom: 12 }} onClick={() => setDraft({ ...draft, steps: [...draft.steps, { day_offset: (draft.steps[draft.steps.length - 1]?.day_offset ?? 0) + 3, subject: '', body: 'Hi {first_name},\n\n', same_thread: true }] })}><Plus size={14} /> Add an email</button>
                )}
                <div style={{ fontSize: 12.5, color: C.ink3, marginBottom: 12 }}>Every email gets the rep’s signature and a short line: “If this isn’t a fit, just reply "stop"…”. Editing changes the emails leads haven’t had yet.</div>
                {err && <div role="alert" style={{ marginBottom: 10, padding: '8px 10px', borderRadius: 9, background: '#FDECEA', color: C.red, fontSize: 13 }}>{err}</div>}
                {saved && <div role="status" style={{ marginBottom: 10, fontSize: 13, color: C.green, fontWeight: 600 }}>{saved}</div>}
                {ro
                  ? <div style={{ fontSize: 13, color: C.ink3 }}>View only — only an admin of the company that owns this sequence can change it.</div>
                  : <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', position: 'sticky', bottom: 0, background: C.bg, padding: '8px 0' }}>
                      <button type="button" className="sqa-btn" onClick={() => setDraft(null)}>Cancel</button>
                      <button type="button" className="sqa-btn pri" disabled={!!busy || !draft.name.trim()} onClick={() => void save()}>{busy === 'save' && <Loader2 size={13} className="animate-spin" />}{draft.id ? 'Save changes' : 'Create sequence'}</button>
                    </div>}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
