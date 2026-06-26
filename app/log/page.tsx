'use client'
// Quick Log — one frictionless capture inbox. Phone-first, add to home screen.
// Capture (text + voice, works offline) → Inbox triage (Done / To-Do / Attach).
// Everything writes to the portal: capture_log, then todos / crm_activities.
import { useCallback, useEffect, useRef, useState } from 'react'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Mic, Check, Plus, Link2, Phone, Lightbulb, StickyNote, X, Loader2, Inbox, Search } = require('lucide-react') as any

type Cap = { id: string; body: string; kind: string; about?: string | null; status: string; source: string; linked_type?: string | null; created_at: string }
type Hit = { type: string; id: string; label: string; sub?: string }

const KINDS = [
  { v: 'call', label: 'Call', Icon: Phone },
  { v: 'todo', label: 'To-do', Icon: StickyNote },
  { v: 'idea', label: 'Idea', Icon: Lightbulb },
] as const

const BG = '#0B1728', PANEL = '#131B2E', LINE = '#1E2A45', TXT = '#F8FAFC', MUT = '#94A3B8', BRAND = '#6B7EFF', GREEN = '#34D399', AMBER = '#FBBF24'
const QKEY = 'qlog_offline_queue'

function timeOf(s: string) { try { return new Date(s).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' }) } catch { return '' } }
function kindColor(k: string) { return k === 'call' ? BRAND : k === 'idea' ? AMBER : k === 'todo' ? '#C7D0FF' : MUT }

export default function QuickLogPage() {
  const [view, setView] = useState<'capture' | 'inbox'>('capture')
  const [text, setText] = useState('')
  const [kind, setKind] = useState<string>('')
  const [recording, setRecording] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [items, setItems] = useState<Cap[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [attachFor, setAttachFor] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recog = useRef<any>(null)
  const boxRef = useRef<HTMLTextAreaElement | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/capture?status=all').then(x => x.json())
      setItems(Array.isArray(r.records) ? r.records : [])
    } catch { /* offline — keep what we have */ }
  }, [])

  const flushQueue = useCallback(async () => {
    let queue: { body: string; source: string; kind?: string }[] = []
    try { queue = JSON.parse(localStorage.getItem(QKEY) || '[]') } catch { queue = [] }
    if (!queue.length) return
    const left: typeof queue = []
    for (const it of queue) {
      try {
        const r = await fetch('/api/capture', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(it) })
        if (!r.ok) left.push(it)
      } catch { left.push(it) }
    }
    localStorage.setItem(QKEY, JSON.stringify(left))
    if (left.length === 0) void load()
  }, [load])

  useEffect(() => { void flushQueue(); void load() }, [flushQueue, load])
  useEffect(() => {
    const on = () => { void flushQueue() }
    window.addEventListener('online', on)
    return () => window.removeEventListener('online', on)
  }, [flushQueue])

  async function save(source: 'text' | 'voice' = 'text') {
    const body = text.trim()
    if (!body) return
    setSaving(true); setMsg(null)
    const payload = { body, source, kind: kind || undefined }
    try {
      const r = await fetch('/api/capture', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!r.ok) throw new Error()
      setMsg('Logged ✓'); setText(''); setKind(''); void load()
    } catch {
      // Offline → queue it so nothing is ever lost.
      let queue: unknown[] = []
      try { queue = JSON.parse(localStorage.getItem(QKEY) || '[]') } catch { queue = [] }
      queue.push(payload); localStorage.setItem(QKEY, JSON.stringify(queue))
      setMsg('Saved offline — will sync'); setText(''); setKind('')
    } finally { setSaving(false); setTimeout(() => setMsg(null), 2500) }
  }

  function toggleMic() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (globalThis as any).webkitSpeechRecognition || (globalThis as any).SpeechRecognition
    if (!SR) { setMsg('Voice needs Chrome — type it instead'); setTimeout(() => setMsg(null), 2500); return }
    if (recording) { recog.current?.stop(); setRecording(false); return }
    const r = new SR(); r.continuous = true; r.interimResults = true; r.lang = 'en-US'
    let base = text
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onresult = (e: any) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) base += (base ? ' ' : '') + t; else interim += t
      }
      setText(base + (interim ? ' ' + interim : ''))
    }
    r.onend = () => { setRecording(false); setText(base) }
    recog.current = r; r.start(); setRecording(true)
  }

  async function act(id: string, payload: Record<string, unknown>) {
    setBusyId(id); setMsg(null)
    try {
      const r = await fetch(`/api/capture/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || d.error) throw new Error(d.error || 'Failed')
      setAttachFor(null); setQ(''); setHits([]); await load()
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Could not update'); setTimeout(() => setMsg(null), 3000) }
    finally { setBusyId(null) }
  }

  useEffect(() => {
    if (!attachFor || q.trim().length < 2) { setHits([]); return }
    const t = setTimeout(async () => {
      try { const r = await fetch(`/api/capture/search?q=${encodeURIComponent(q)}`).then(x => x.json()); setHits(r.results ?? []) } catch { setHits([]) }
    }, 250)
    return () => clearTimeout(t)
  }, [q, attachFor])

  const open = items.filter(i => i.status === 'open')
  const today = open.slice(0, 12)

  const chip = (active: boolean) => ({ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'center', flex: 1, fontSize: 13, padding: '8px 0', borderRadius: 999, cursor: 'pointer', background: active ? 'rgba(107,126,255,0.18)' : 'rgba(255,255,255,0.05)', border: `1px solid ${active ? 'rgba(107,126,255,0.5)' : LINE}`, color: active ? '#C7D0FF' : MUT }) as const
  const actBtn = (bg: string, bd: string, c: string) => ({ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 12, padding: '9px 0', borderRadius: 10, cursor: 'pointer', background: bg, border: `1px solid ${bd}`, color: c }) as const

  return (
    <div style={{ minHeight: '100dvh', background: BG, color: TXT, padding: '16px 14px 40px', maxWidth: 520, margin: '0 auto', fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ width: 26, height: 26, borderRadius: 7, background: BRAND, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: BG, fontWeight: 800 }}>Q</span>
          <span style={{ fontSize: 18, fontWeight: 700 }}>Quick Log</span>
        </div>
        <div style={{ display: 'flex', gap: 6, background: PANEL, border: `1px solid ${LINE}`, borderRadius: 999, padding: 3 }}>
          <button onClick={() => setView('capture')} style={{ fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 999, border: 0, cursor: 'pointer', background: view === 'capture' ? BRAND : 'transparent', color: view === 'capture' ? BG : MUT }}>Capture</button>
          <button onClick={() => setView('inbox')} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 999, border: 0, cursor: 'pointer', background: view === 'inbox' ? BRAND : 'transparent', color: view === 'inbox' ? BG : MUT }}>
            <Inbox size={13} /> Inbox{open.length ? ` · ${open.length}` : ''}
          </button>
        </div>
      </div>

      {msg && <div style={{ marginBottom: 12, fontSize: 13, padding: '9px 12px', borderRadius: 10, background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.3)', color: '#6EE7B7' }}>{msg}</div>}

      {view === 'capture' && (<>
        <textarea ref={boxRef} value={text} onChange={e => setText(e.target.value)} autoFocus placeholder="What's on your mind? Type or tap the mic…"
          style={{ width: '100%', boxSizing: 'border-box', minHeight: 120, resize: 'vertical', background: PANEL, border: `1px solid ${LINE}`, borderRadius: 14, color: TXT, fontSize: 16, lineHeight: 1.5, padding: 14, outline: 'none' }} />
        <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
          {KINDS.map(k => <button key={k.v} onClick={() => setKind(kind === k.v ? '' : k.v)} style={chip(kind === k.v)}><k.Icon size={14} /> {k.label}</button>)}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={toggleMic} aria-label="Voice" style={{ width: 56, height: 56, flexShrink: 0, borderRadius: '50%', border: recording ? `2px solid ${GREEN}` : 0, cursor: 'pointer', background: recording ? 'rgba(52,211,153,0.2)' : BRAND, color: recording ? GREEN : BG, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <Mic size={26} />
          </button>
          <button onClick={() => save(recording ? 'voice' : 'text')} disabled={saving || !text.trim()} style={{ flex: 1, fontSize: 16, fontWeight: 700, padding: '17px 0', borderRadius: 14, border: 0, cursor: text.trim() ? 'pointer' : 'default', background: text.trim() ? GREEN : 'rgba(255,255,255,0.08)', color: text.trim() ? '#04201A' : MUT, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {saving ? <Loader2 size={18} /> : <Check size={18} />} Save
          </button>
        </div>
        {recording && <div style={{ marginTop: 10, fontSize: 12, color: GREEN, textAlign: 'center' }}>Listening… tap the mic to stop.</div>}

        {today.length > 0 && <>
          <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#64748B', margin: '20px 0 8px' }}>Today</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {today.map(it => (
              <div key={it.id} style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 12, padding: 11 }}>
                <div style={{ fontSize: 14 }}>{it.body}</div>
                <div style={{ fontSize: 11, color: MUT, marginTop: 4 }}><span style={{ color: kindColor(it.kind), textTransform: 'capitalize' }}>{it.kind}</span> · {timeOf(it.created_at)}</div>
              </div>
            ))}
          </div>
        </>}
      </>)}

      {view === 'inbox' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {open.length === 0 && <div style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 14, padding: 18, textAlign: 'center', color: MUT, fontSize: 14 }}>Inbox zero. Nothing to sort 🎉</div>}
          {open.map(it => (
            <div key={it.id} style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 14, padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: kindColor(it.kind), textTransform: 'capitalize' }}>{it.kind}</span>
                <span style={{ fontSize: 11, color: '#64748B' }}>· {timeOf(it.created_at)}</span>
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.5 }}>{it.body}</div>

              {attachFor === it.id ? (
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: BG, border: `1px solid ${LINE}`, borderRadius: 10, padding: '8px 10px' }}>
                    <Search size={15} color={MUT} />
                    <input value={q} onChange={e => setQ(e.target.value)} autoFocus placeholder="Search a lead, opportunity, or job…" style={{ flex: 1, background: 'transparent', border: 0, outline: 'none', color: TXT, fontSize: 14 }} />
                    <button onClick={() => { setAttachFor(null); setQ(''); setHits([]) }} aria-label="Cancel" style={{ background: 'transparent', border: 0, color: MUT, cursor: 'pointer' }}><X size={16} /></button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                    {hits.map(h => (
                      <button key={`${h.type}-${h.id}`} disabled={busyId === it.id} onClick={() => act(it.id, { action: 'attach', linked_type: h.type, linked_id: h.id, label: h.label })}
                        style={{ textAlign: 'left', background: 'rgba(255,255,255,0.04)', border: `1px solid ${LINE}`, borderRadius: 10, padding: '9px 11px', cursor: 'pointer', color: TXT }}>
                        <div style={{ fontSize: 13 }}>{h.label} <span style={{ fontSize: 10, color: MUT, textTransform: 'capitalize' }}>· {h.type.replace('_', ' ')}</span></div>
                        {h.sub && <div style={{ fontSize: 11, color: MUT, marginTop: 2 }}>{h.sub}</div>}
                      </button>
                    ))}
                    {q.trim().length >= 2 && (
                      <button disabled={busyId === it.id} onClick={() => act(it.id, { action: 'attach', linked_type: 'new_lead', label: q.trim() })}
                        style={{ textAlign: 'left', background: 'rgba(107,126,255,0.12)', border: '1px solid rgba(107,126,255,0.4)', borderRadius: 10, padding: '9px 11px', cursor: 'pointer', color: '#C7D0FF' }}>
                        <Plus size={13} /> New lead: “{q.trim()}” — and log this to it
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                  <button disabled={busyId === it.id} onClick={() => act(it.id, { action: 'done' })} style={actBtn('rgba(52,211,153,0.16)', 'rgba(52,211,153,0.4)', '#6EE7B7')}><Check size={13} /> Done</button>
                  <button disabled={busyId === it.id} onClick={() => act(it.id, { action: 'make_todo' })} style={actBtn('rgba(107,126,255,0.16)', 'rgba(107,126,255,0.4)', '#C7D0FF')}><StickyNote size={13} /> To-do</button>
                  <button disabled={busyId === it.id} onClick={() => { setAttachFor(it.id); setQ(''); setHits([]) }} style={actBtn('rgba(255,255,255,0.05)', LINE, MUT)}><Link2 size={13} /> Attach</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
