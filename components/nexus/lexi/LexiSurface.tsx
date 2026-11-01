'use client'

/**
 * LexiSurface — the Nexus AI tab (center logo in the bottom bar).
 *
 * Light look like Sales / Operations: greeting on the navy band, white cards.
 *   • Today's brief: tap a card to ask Lexi about it.
 *   • Chat that streams from /api/lexi/chat (NDJSON events), shows the records
 *     Lexi found as cards, low-risk actions with Undo (30s), and bigger actions
 *     as a Confirm card (runs via /api/assistant/execute).
 *   • History from /api/lexi/conversations.
 *   • Mic: browser dictation where supported.
 *   • Phase 2: Brain panel (what Lexi remembers) and Recording panel (meeting →
 *     notes, to-dos, deal note, follow-up email). Drafted replies get a Copy button.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { T, FONT } from '@/components/nexus/tasks/shared'
import { BrainPanel, RecordingPanel } from '@/components/nexus/lexi/LexiPanels'

type Card = { kind: string; id: string; title: string; sub?: string; href?: string; tone?: 'red' | 'orange' | 'green' | 'blue' }
type RevertPayload = { operation: 'delete' | 'update'; table: string; id: string; data?: Record<string, unknown> }
type Did = { ok: boolean; summary: string; message?: string; revertPayload?: RevertPayload | null; undone?: boolean; at: number }
type Pending = { toolName: string; toolArgs: Record<string, unknown>; summary: string; reasoning?: string; riskLevel: 'medium' | 'high'; state?: 'waiting' | 'running' | 'done' | 'skipped' | 'failed'; result?: string; revertPayload?: RevertPayload | null }
type Msg = { id: string; role: 'user' | 'assistant'; text: string; cards: Card[]; did: Did[]; pending: Pending | null; status?: string; error?: string; streaming?: boolean }
type Conv = { id: string; title: string | null; updated_at: string }
type Brief = { name?: string; tasks: number; today: number; unassigned: number; overdue: number; stalled: number; incidents: number; expiring: number; error?: string }

const CSS = `
.lx{color:${T.ink};font-family:${FONT};letter-spacing:-.01em;width:100%;max-width:1100px;margin:0 auto;padding:0 4px calc(170px + env(safe-area-inset-bottom))}
.lx-end{height:1px;scroll-margin-bottom:calc(190px + env(safe-area-inset-bottom))}
.lx *{box-sizing:border-box}
.lx-hd{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin:6px 0 18px}
.lx-hi{display:flex;align-items:center;gap:16px;min-width:0}
.lx-hd h1{margin:0;color:#fff;font-size:30px;font-weight:600;letter-spacing:-.025em;line-height:1.15}
.lx-hd .sub{margin-top:4px;color:rgba(255,255,255,.7);font-size:14px}
.lx-acts{display:flex;gap:8px}
.lx-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:36px;padding:0 14px;border-radius:10px;border:0;font:600 13px ${FONT};cursor:pointer;white-space:nowrap}
.lx-btn.dark{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);color:#fff;font-weight:500}
.lx-btn.pri{background:${T.blue};color:#fff}.lx-btn.pri:hover{background:${T.blueDark}}
.lx-btn.line{background:#fff;border:1px solid ${T.line2};color:${T.ink}}
.lx-btn:disabled{opacity:.5;cursor:default}
.lx-orb{width:56px;height:56px;border-radius:50%;flex:none;position:relative;background:radial-gradient(circle at 35% 30%,#fff 0,#9fd4ff 18%,#4A8CFF 52%,#6B4CFF 100%);box-shadow:0 0 28px rgba(74,140,255,.55),inset 0 0 12px rgba(255,255,255,.4);animation:lx-breathe 4.5s ease-in-out infinite}
.lx-orb.busy{animation:lx-think 1.1s ease-in-out infinite}
.lx-orb::after{content:'';position:absolute;inset:-6px;border-radius:50%;border:1px solid rgba(159,212,255,.35);animation:lx-ring 4.5s ease-in-out infinite}
@keyframes lx-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
@keyframes lx-think{0%,100%{transform:scale(.96);filter:brightness(1)}50%{transform:scale(1.08);filter:brightness(1.25)}}
@keyframes lx-ring{0%,100%{opacity:.35;transform:scale(1)}50%{opacity:.8;transform:scale(1.08)}}
@media (prefers-reduced-motion:reduce){.lx-orb,.lx-orb::after{animation:none}}
.lx-brief{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:16px}
.lx-stat{text-align:left;border:0;cursor:pointer;background:#fff;border-radius:14px;padding:12px 14px;box-shadow:0 1px 2px rgba(10,20,40,.06),0 8px 24px rgba(10,20,40,.08);font:inherit;color:inherit}
.lx-stat:hover{transform:translateY(-1px)}
.lx-stat .l{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:500;color:${T.ink3}}
.lx-stat .v{font-size:24px;font-weight:600;letter-spacing:-.02em;margin-top:2px}
.lx-stat .s{font-size:12px;color:${T.ink3}}
.lx-dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex:none}
.lx-chat{background:#fff;border-radius:16px;box-shadow:0 1px 2px rgba(10,20,40,.06),0 8px 24px rgba(10,20,40,.08);display:flex;flex-direction:column;min-height:420px}
.lx-thread{flex:1;padding:18px 18px 8px;display:flex;flex-direction:column;gap:14px}
.lx-empty{padding:28px 10px 8px;text-align:center;color:${T.ink3};font-size:14px}
.lx-empty b{display:block;color:${T.ink};font-size:17px;font-weight:600;margin-bottom:4px}
.lx-u{align-self:flex-end;max-width:80%;background:${T.blue};color:#fff;padding:9px 13px;border-radius:16px 16px 4px 16px;font-size:14.5px;line-height:1.45;white-space:pre-wrap;word-break:break-word}
.lx-a{align-self:stretch;display:flex;gap:10px}
.lx-a .av{width:26px;height:26px;border-radius:50%;flex:none;margin-top:1px;background:radial-gradient(circle at 35% 30%,#fff 0,#9fd4ff 18%,#4A8CFF 52%,#6B4CFF 100%)}
.lx-a .body{flex:1;min-width:0;font-size:14.5px;line-height:1.55}
.lx-a .body p{margin:0 0 8px}.lx-a .body p:last-child{margin-bottom:0}
.lx-a .body ul,.lx-a .body ol{margin:0 0 8px;padding-left:20px}.lx-a .body li{margin:2px 0}
.lx-status{display:flex;align-items:center;gap:8px;font-size:13px;color:${T.ink3}}
.lx-spin{width:12px;height:12px;border-radius:50%;border:2px solid #D6E4FF;border-top-color:${T.blue};animation:lx-rot .8s linear infinite}
@keyframes lx-rot{to{transform:rotate(360deg)}}
.lx-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px;margin-top:10px}
.lx-card{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border-radius:12px;background:#F5F5F7;text-decoration:none;color:inherit;min-width:0}
.lx-card:hover{background:#EDEDF0}
.lx-card .k{font-size:11px;font-weight:600;color:${T.ink3};text-transform:uppercase;letter-spacing:.04em}
.lx-card .t{font-size:13.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lx-card .s{font-size:12px;color:${T.ink3};overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lx-did{display:flex;align-items:center;gap:10px;margin-top:10px;padding:9px 12px;border-radius:10px;background:#E8F6EC;color:#1A6B32;font-size:13px;font-weight:500}
.lx-did.bad{background:#FFECEC;color:${T.red}}
.lx-did.undone{background:#F5F5F7;color:${T.ink3}}
.lx-did button{margin-left:auto;border:0;background:none;color:${T.blue};font:600 13px ${FONT};cursor:pointer}
.lx-confirm{margin-top:10px;border-radius:12px;padding:12px 14px;background:#EEF4FF;border:1px solid #D6E4FF}
.lx-confirm.high{background:#FFF4E5;border-color:#FFD8A8}
.lx-confirm .h{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:600;color:#0058B0;text-transform:uppercase;letter-spacing:.04em}
.lx-confirm.high .h{color:${T.orange}}
.lx-confirm .w{font-size:14.5px;font-weight:600;margin-top:4px}
.lx-confirm .r{font-size:13px;color:${T.ink2};margin-top:2px}
.lx-confirm .b{display:flex;gap:8px;margin-top:10px}
.lx-err{margin-top:8px;padding:9px 12px;border-radius:10px;background:#FFECEC;color:${T.red};font-size:13px}
.lx-chips{display:flex;gap:6px;flex-wrap:wrap;padding:0 18px 10px}
.lx-chip{border:1px solid ${T.line2};background:#fff;border-radius:999px;padding:6px 12px;font:500 13px ${FONT};color:${T.ink2};cursor:pointer}
.lx-chip:hover{background:#F5F5F7}
.lx-comp{position:sticky;bottom:calc(92px + env(safe-area-inset-bottom));z-index:2;display:flex;gap:8px;align-items:flex-end;padding:12px 14px;border-top:1px solid ${T.line};background:#fff;border-radius:0 0 16px 16px}
.lx-comp textarea{flex:1;resize:none;max-height:160px;min-height:42px;padding:10px 12px;border:1px solid ${T.line2};border-radius:12px;font:400 15px ${FONT};color:${T.ink};line-height:1.4;background:#fff}
.lx-comp textarea:focus{outline:2px solid ${T.blue};outline-offset:-1px;border-color:transparent}
.lx-ico{width:42px;height:42px;border-radius:12px;border:1px solid ${T.line2};background:#fff;color:${T.ink2};display:flex;align-items:center;justify-content:center;cursor:pointer;flex:none}
.lx-ico.send{background:${T.blue};border-color:${T.blue};color:#fff}
.lx-ico.rec{background:#FFECEC;border-color:#F5C2C2;color:${T.red}}
.lx-ico:disabled{opacity:.45;cursor:default}
.lx-hist{position:fixed;inset:0;z-index:120;background:rgba(15,23,42,.42);display:flex;justify-content:flex-end}
.lx-hist .p{width:min(380px,100%);height:100%;background:#fff;padding:18px;overflow-y:auto;font-family:${FONT}}
.lx-hist .row{display:flex;align-items:center;gap:8px;padding:10px 8px;border-radius:10px;cursor:pointer}
.lx-hist .row:hover{background:#F5F5F7}
.lx-hist .row .t{flex:1;min-width:0;font-size:14px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lx-hist .row .d{font-size:12px;color:${T.ink3}}
.lx-hist .row button{border:0;background:none;color:${T.ink3};cursor:pointer;font-size:16px;padding:2px 6px}
.lx-note{font-size:12px;color:${T.ink3};text-align:center;padding:6px 0 0}
@media (max-width:640px){.lx-hd h1{font-size:24px}.lx-orb{width:44px;height:44px}.lx-acts{width:100%}.lx-acts .lx-btn{flex:1}.lx-u{max-width:90%}}
`

const KIND_LABEL: Record<string, string> = { deal: 'Deal', work_order: 'Job', site: 'Site', task: 'Task', lead: 'Lead', customer: 'Customer', thread: 'Email', event: 'Calendar', manual: 'Manual' }
const TONE: Record<string, string> = { red: '#FF3B30', orange: '#FF9F0A', green: '#34C759', blue: '#0071E3' }
const CHIPS = ['Brief me on today', 'Who’s waiting on me in email?', 'What jobs are overdue?', 'Which deals are stalled?', 'Remember that I like short answers', 'How do I send a proposal?', 'Make me a task to call Marbella tomorrow']
const uid = () => Math.random().toString(36).slice(2)
const greet = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening' }

// Tiny, safe markdown: paragraphs, - / 1. lists, **bold**. No HTML.
function Md({ text }: { text: string }) {
  const inline = (s: string, k: string) => s.split(/(\*\*[^*]+\*\*)/g).map((part, i) => part.startsWith('**') && part.endsWith('**') ? <b key={`${k}-${i}`} style={{ fontWeight: 600 }}>{part.slice(2, -2)}</b> : <span key={`${k}-${i}`}>{part}</span>)
  const blocks = text.replace(/\r/g, '').split(/\n{2,}/)
  return <>{blocks.map((b, bi) => {
    const lines = b.split('\n').filter(l => l.trim())
    if (lines.length && lines.every(l => /^\s*[-*•]\s+/.test(l))) return <ul key={bi}>{lines.map((l, i) => <li key={i}>{inline(l.replace(/^\s*[-*•]\s+/, ''), `${bi}-${i}`)}</li>)}</ul>
    if (lines.length && lines.every(l => /^\s*\d+[.)]\s+/.test(l))) return <ol key={bi}>{lines.map((l, i) => <li key={i}>{inline(l.replace(/^\s*\d+[.)]\s+/, ''), `${bi}-${i}`)}</li>)}</ol>
    return <p key={bi}>{lines.map((l, i) => <span key={i}>{i > 0 && <br />}{inline(l.replace(/^#+\s*/, ''), `${bi}-${i}`)}</span>)}</p>
  })}</>
}

export function LexiSurface() {
  const [brief, setBrief] = useState<Brief | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [convId, setConvId] = useState<string | null>(null)
  const [histOpen, setHistOpen] = useState(false)
  const [convs, setConvs] = useState<Conv[] | null>(null)
  const [locked, setLocked] = useState<string | null>(null)
  const [rec, setRec] = useState(false)
  const [panel, setPanel] = useState<'brain' | 'recording' | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const recRef = useRef<{ stop: () => void } | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)
  const taRef = useRef<HTMLTextAreaElement | null>(null)
  const [, tick] = useState(0)
  const canDictate = typeof window !== 'undefined' && !!((window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition)

  useEffect(() => {
    fetch('/api/lexi/brief').then(async r => {
      const d = await r.json().catch(() => ({}))
      if (r.status === 403) { setLocked(d?.error || 'Lexi is in early access.'); return }
      if (!r.ok) { setBrief({ tasks: 0, today: 0, unassigned: 0, overdue: 0, stalled: 0, incidents: 0, expiring: 0, error: d?.error || 'Couldn’t load your brief.' }); return }
      setBrief(d)
    }).catch(() => setBrief({ tasks: 0, today: 0, unassigned: 0, overdue: 0, stalled: 0, incidents: 0, expiring: 0, error: 'Couldn’t load your brief.' }))
  }, [])
  // Undo windows count down.
  useEffect(() => { const t = setInterval(() => tick(n => n + 1), 1000); return () => clearInterval(t) }, [])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [msgs])

  const patchLast = (fn: (m: Msg) => Msg) => setMsgs(ms => ms.length ? [...ms.slice(0, -1), fn(ms[ms.length - 1])] : ms)

  const send = useCallback(async (raw: string) => {
    const text = raw.trim()
    if (!text || busy) return
    setInput('')
    const history = msgs.filter(m => m.text).slice(-12).map(m => ({ role: m.role, content: m.text }))
    setMsgs(ms => [...ms, { id: uid(), role: 'user', text, cards: [], did: [], pending: null }, { id: uid(), role: 'assistant', text: '', cards: [], did: [], pending: null, status: 'Thinking', streaming: true }])
    setBusy(true)
    try {
      const r = await fetch('/api/lexi/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text, conversationId: convId, history }) })
      if (!r.ok || !r.body) {
        const d = await r.json().catch(() => ({}))
        patchLast(m => ({ ...m, streaming: false, status: undefined, error: d?.error || `Lexi couldn’t answer (${r.status}).` }))
        return
      }
      const reader = r.body.getReader()
      const dec = new TextDecoder()
      let buf = ''
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        let nl: number
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1)
          if (!line) continue
          let ev: Record<string, unknown>
          try { ev = JSON.parse(line) } catch { continue }
          if (ev.type === 'start' && ev.conversationId) setConvId(String(ev.conversationId))
          else if (ev.type === 'text') patchLast(m => ({ ...m, text: m.text + String(ev.delta ?? ''), status: undefined }))
          else if (ev.type === 'tool') patchLast(m => ({ ...m, status: String(ev.label ?? 'Looking that up') }))
          else if (ev.type === 'cards') patchLast(m => ({ ...m, cards: [...m.cards, ...((ev.items as Card[]) ?? [])] }))
          else if (ev.type === 'did') patchLast(m => ({ ...m, did: [...m.did, { ok: !!ev.ok, summary: String(ev.summary ?? ''), message: ev.message as string | undefined, revertPayload: (ev.revertPayload as RevertPayload) ?? null, at: Date.now() }] }))
          else if (ev.type === 'pending') patchLast(m => ({ ...m, pending: { ...(ev.action as Pending), state: 'waiting' } }))
          else if (ev.type === 'error') patchLast(m => ({ ...m, error: String(ev.error ?? 'Something went wrong.') }))
          else if (ev.type === 'done' && ev.conversationId) setConvId(String(ev.conversationId))
        }
      }
    } catch {
      patchLast(m => ({ ...m, error: 'Lost the connection. Try again.' }))
    } finally {
      patchLast(m => ({ ...m, streaming: false, status: undefined }))
      setBusy(false)
      setTimeout(() => taRef.current?.focus(), 50)
    }
  }, [busy, convId, msgs])

  async function confirm(mi: number) {
    const p = msgs[mi]?.pending
    if (!p || p.state !== 'waiting') return
    setMsgs(ms => ms.map((m, i) => i === mi && m.pending ? { ...m, pending: { ...m.pending, state: 'running' } } : m))
    const r = await fetch('/api/assistant/execute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ toolName: p.toolName, toolArgs: p.toolArgs }) }).catch(() => null)
    const d = r ? await r.json().catch(() => ({})) : {}
    const ok = !!r?.ok && d?.success !== false
    setMsgs(ms => ms.map((m, i) => i === mi && m.pending ? { ...m, pending: { ...m.pending, state: ok ? 'done' : 'failed', result: ok ? (d?.message || 'Done.') : (d?.error || 'That didn’t go through.'), revertPayload: ok ? d?.revertPayload ?? null : null }, did: ok ? [...m.did, { ok: true, summary: m.pending.summary, message: d?.message, revertPayload: d?.revertPayload ?? null, at: Date.now() }] : m.did } : m))
  }
  const skip = (mi: number) => setMsgs(ms => ms.map((m, i) => i === mi && m.pending ? { ...m, pending: { ...m.pending, state: 'skipped' } } : m))

  async function undo(mi: number, di: number) {
    const d = msgs[mi]?.did[di]
    if (!d?.revertPayload) return
    const r = await fetch('/api/assistant/revert', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revertPayload: d.revertPayload }) }).catch(() => null)
    const ok = !!r?.ok
    setMsgs(ms => ms.map((m, i) => i === mi ? { ...m, did: m.did.map((x, j) => j === di ? { ...x, undone: ok, message: ok ? 'Undone.' : 'Couldn’t undo that.' } : x) } : m))
  }

  function newChat() { setMsgs([]); setConvId(null); setInput(''); taRef.current?.focus() }
  async function openHistory() {
    setHistOpen(true); setConvs(null)
    const r = await fetch('/api/lexi/conversations').catch(() => null)
    const d = r ? await r.json().catch(() => ({})) : {}
    setConvs(Array.isArray(d?.conversations) ? d.conversations : [])
  }
  async function loadConv(id: string) {
    setHistOpen(false)
    const r = await fetch(`/api/lexi/conversations?id=${id}`).catch(() => null)
    const d = r ? await r.json().catch(() => ({})) : {}
    if (!r?.ok) return
    setConvId(id)
    setMsgs(((d.messages ?? []) as { role: 'user' | 'assistant'; content: string; cards?: { cards?: Card[] } | null }[]).map(m => ({ id: uid(), role: m.role, text: m.content, cards: m.cards?.cards ?? [], did: [], pending: null })))
  }
  async function delConv(id: string) {
    const r = await fetch(`/api/lexi/conversations?id=${id}`, { method: 'DELETE' }).catch(() => null)
    if (r?.ok) { setConvs(cs => (cs ?? []).filter(c => c.id !== id)); if (convId === id) newChat() }
  }

  function toggleMic() {
    if (rec) { recRef.current?.stop(); return }
    const W = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec }
    const Ctor = W.SpeechRecognition || W.webkitSpeechRecognition
    if (!Ctor) return
    const r = new Ctor()
    r.lang = 'en-US'; r.interimResults = true; r.continuous = false
    const base = input ? input.trim() + ' ' : ''
    r.onresult = (e: SpeechEvt) => { let t = ''; for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript; setInput(base + t) }
    r.onend = () => { setRec(false); recRef.current = null }
    r.onerror = () => { setRec(false); recRef.current = null }
    recRef.current = r; setRec(true); r.start()
  }

  if (locked) return <div className="lx"><style>{CSS}</style>
    <div className="lx-hd"><div className="lx-hi"><div className="lx-orb" /><div><h1>Lexi</h1><div className="sub">{locked}</div></div></div></div>
  </div>

  const stats = brief && !brief.error ? [
    { l: 'Jobs overdue', v: brief.overdue, s: 'Scheduled date passed', dot: '#FF3B30', ask: 'Which jobs are overdue, and what should I do about each?' },
    { l: 'Need a tech', v: brief.unassigned, s: 'Open, nobody assigned', dot: '#FF9F0A', ask: 'Which open jobs have no tech assigned?' },
    { l: 'Jobs today', v: brief.today, s: 'Scheduled for today', dot: '#0071E3', ask: 'What jobs are scheduled today?' },
    { l: 'Deals stalled', v: brief.stalled, s: 'Quiet 15+ days', dot: '#FF9F0A', ask: 'Which deals are stalled and what should I do next on each?' },
    { l: 'My tasks due', v: brief.tasks, s: 'Due today or overdue', dot: '#0071E3', ask: 'What tasks do I have due today or overdue?' },
    { l: 'Incidents open', v: brief.incidents, s: 'System problems', dot: '#FF3B30', ask: 'What system incidents are open right now?' },
  ] : []
  const busyNow = busy || msgs.some(m => m.streaming)

  return <div className="lx">
    <style>{CSS}</style>
    <header className="lx-hd">
      <div className="lx-hi">
        <div className={`lx-orb${busyNow ? ' busy' : ''}`} aria-hidden />
        <div style={{ minWidth: 0 }}>
          <h1>{greet()}{brief?.name ? `, ${brief.name}` : ''}</h1>
          <div className="sub">I’m Lexi. Ask me anything about Gate Guard — or tell me what to do.</div>
        </div>
      </div>
      <div className="lx-acts">
        <button type="button" className="lx-btn dark" onClick={() => setPanel('recording')}>Recording</button>
        <button type="button" className="lx-btn dark" onClick={() => setPanel('brain')}>Brain</button>
        <button type="button" className="lx-btn dark" onClick={openHistory}>History</button>
        <button type="button" className="lx-btn dark" onClick={newChat} disabled={!msgs.length}>New chat</button>
      </div>
    </header>

    {msgs.length === 0 && <div className="lx-brief" aria-label="Today">
      {brief === null && Array.from({ length: 6 }).map((_, i) => <div key={i} className="lx-stat" style={{ opacity: .6 }}><div className="l">Loading…</div><div className="v">—</div></div>)}
      {brief?.error && <div className="lx-stat" style={{ gridColumn: '1 / -1', color: T.red }}>{brief.error}</div>}
      {stats.map(s => <button key={s.l} type="button" className="lx-stat" onClick={() => send(s.ask)} title={s.ask}>
        <div className="l"><span className="lx-dot" style={{ background: s.dot }} />{s.l}</div>
        <div className="v">{s.v}</div>
        <div className="s">{s.s}</div>
      </button>)}
    </div>}

    <section className="lx-chat" aria-label="Chat with Lexi">
      <div className="lx-thread" aria-live="polite">
        {msgs.length === 0 && <div className="lx-empty"><b>What can I do for you?</b>Ask about deals, jobs, sites, your inbox or how to use Nexus — or tell me to make a task, a work order, a lead or a follow-up.</div>}
        {msgs.map((m, mi) => m.role === 'user'
          ? <div key={m.id} className="lx-u">{m.text}</div>
          : <div key={m.id} className="lx-a">
            <span className="av" aria-hidden />
            <div className="body">
              {m.text && <Md text={m.text} />}
              {!m.streaming && /draft( reply)?:/i.test(m.text) && <button type="button" className="lx-btn line" style={{ marginTop: 8, height: 32 }} onClick={() => {
                const draft = m.text.split(/draft( reply)?:/i).pop()!.replace(/\*\*/g, '').trim()
                navigator.clipboard?.writeText(draft).then(() => { setCopiedId(m.id); setTimeout(() => setCopiedId(c => (c === m.id ? null : c)), 1800) }).catch(() => {})
              }}>{copiedId === m.id ? 'Copied ✓' : 'Copy draft'}</button>}
              {m.status && <div className="lx-status"><span className="lx-spin" />{m.status}…</div>}
              {m.cards.length > 0 && <div className="lx-cards">
                {m.cards.map(c => <a key={`${c.kind}-${c.id}`} className="lx-card" href={c.href || '#'} target={c.href?.startsWith('http') ? '_blank' : undefined} rel="noreferrer" onClick={c.href ? undefined : e => e.preventDefault()}>
                  <span className="lx-dot" style={{ background: TONE[c.tone ?? 'blue'], marginTop: 6 }} />
                  <span style={{ minWidth: 0 }}><span className="k">{KIND_LABEL[c.kind] ?? c.kind}</span><span className="t" style={{ display: 'block' }}>{c.title}</span>{c.sub && <span className="s" style={{ display: 'block' }}>{c.sub}</span>}</span>
                </a>)}
              </div>}
              {m.did.map((d, di) => {
                const left = d.revertPayload && !d.undone ? Math.max(0, 30 - Math.floor((Date.now() - d.at) / 1000)) : 0
                return <div key={di} className={`lx-did${!d.ok ? ' bad' : d.undone ? ' undone' : ''}`}>
                  <span>{d.ok ? (d.undone ? 'Undone: ' : '✓ ') : 'Didn’t work: '}{d.summary}{!d.ok && d.message ? ` — ${d.message}` : ''}</span>
                  {d.ok && left > 0 && <button type="button" onClick={() => undo(mi, di)}>Undo ({left}s)</button>}
                </div>
              })}
              {m.pending && m.pending.state !== 'done' && <div className={`lx-confirm${m.pending.riskLevel === 'high' ? ' high' : ''}`}>
                <div className="h"><span className="lx-dot" style={{ background: m.pending.riskLevel === 'high' ? '#FF9F0A' : '#0071E3' }} />{m.pending.state === 'skipped' ? 'Skipped' : m.pending.state === 'failed' ? 'Didn’t go through' : 'Needs your OK'}</div>
                <div className="w">{m.pending.summary}</div>
                {m.pending.reasoning && <div className="r">{m.pending.reasoning}</div>}
                {m.pending.state === 'failed' && <div className="r" style={{ color: T.red }}>{m.pending.result}</div>}
                {(m.pending.state === 'waiting' || m.pending.state === 'running') && <div className="b">
                  <button type="button" className="lx-btn pri" onClick={() => confirm(mi)} disabled={m.pending.state === 'running'}>{m.pending.state === 'running' ? 'Working…' : 'Confirm'}</button>
                  <button type="button" className="lx-btn line" onClick={() => skip(mi)} disabled={m.pending.state === 'running'}>Skip</button>
                </div>}
              </div>}
              {m.error && <div className="lx-err">{m.error}</div>}
            </div>
          </div>)}
        <div ref={endRef} className="lx-end" />
      </div>
      {msgs.length === 0 && <div className="lx-chips">{CHIPS.map(c => <button key={c} type="button" className="lx-chip" onClick={() => send(c)}>{c}</button>)}</div>}
      <form className="lx-comp" onSubmit={e => { e.preventDefault(); void send(input) }}>
        <textarea ref={taRef} rows={1} value={input} placeholder={rec ? 'Listening…' : 'Ask Lexi anything…'} aria-label="Message Lexi"
          onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(160, e.target.scrollHeight)}px` }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(input) } }} />
        {canDictate && <button type="button" className={`lx-ico${rec ? ' rec' : ''}`} onClick={toggleMic} aria-label={rec ? 'Stop listening' : 'Speak'} title={rec ? 'Stop' : 'Speak'}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
        </button>}
        <button type="submit" className="lx-ico send" disabled={!input.trim() || busy} aria-label="Send">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden><path d="M12 19V5M5 12l7-7 7 7" /></svg>
        </button>
      </form>
    </section>
    <div className="lx-note">Lexi can make mistakes. Small changes can be undone for 30 seconds; bigger ones always ask first.</div>

    {panel === 'brain' && <BrainPanel onClose={() => setPanel(null)} />}
    {panel === 'recording' && <RecordingPanel onClose={() => setPanel(null)} />}

    {histOpen && <div className="lx-hist" onClick={() => setHistOpen(false)}>
      <div className="p" onClick={e => e.stopPropagation()} role="dialog" aria-label="Lexi history">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <b style={{ fontSize: 17, fontWeight: 600 }}>History</b>
          <button type="button" className="lx-btn line" onClick={() => setHistOpen(false)}>Close</button>
        </div>
        {convs === null ? <div className="lx-status"><span className="lx-spin" />Loading…</div>
          : convs.length === 0 ? <div style={{ color: T.ink3, fontSize: 14 }}>No saved chats yet.</div>
          : convs.map(c => <div key={c.id} className="row" onClick={() => loadConv(c.id)}>
            <span className="t">{c.title || 'Untitled chat'}</span>
            <span className="d">{new Date(c.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            <button type="button" aria-label="Delete chat" onClick={e => { e.stopPropagation(); void delConv(c.id) }}>×</button>
          </div>)}
      </div>
    </div>}
  </div>
}

// Minimal Web Speech types (not in the TS DOM lib everywhere).
type SpeechEvt = { results: ArrayLike<ArrayLike<{ transcript: string }>> }
type SpeechRec = { lang: string; interimResults: boolean; continuous: boolean; onresult: (e: SpeechEvt) => void; onend: () => void; onerror: () => void; start: () => void; stop: () => void }

export default LexiSurface
