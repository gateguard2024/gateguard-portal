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
 *   • Phase 4: hands-free voice — Talk: listen → Lexi answers out loud → listens again.
 *     Say "confirm" / "skip" for actions, "undo", or "stop". Uses the browser's own
 *     speech (Web Speech API), so there's no extra cost or account. Read-aloud toggle too.
 *   • Phase 3: "I noticed…" list (/api/lexi/nudges) with Ask / Open / Later, and the
 *     weekday morning-brief email switch + "Send me one now" (/api/lexi/brief).
 *   • Nightly review: "Close out today · plan tomorrow" card + full-screen review
 *     (EveningReview.tsx, /api/lexi/evening). Opens from the evening text via ?review=evening.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { T, FONT } from '@/components/nexus/tasks/shared'
import { BrainPanel, RecordingPanel } from '@/components/nexus/lexi/LexiPanels'
import { LexiChart, type LexiChartData } from '@/components/nexus/lexi/LexiChart'
import { EveningCard, EveningReview } from '@/components/nexus/lexi/EveningReview'
import { ExecPlans } from '@/components/nexus/lexi/ExecPlans'

type Card = { kind: string; id: string; title: string; sub?: string; href?: string; tone?: 'red' | 'orange' | 'green' | 'blue' }
type RevertPayload = { operation: 'delete' | 'update'; table: string; id: string; data?: Record<string, unknown> }
type Did = { ok: boolean; summary: string; message?: string; revertPayload?: RevertPayload | null; undone?: boolean; at: number }
type Pending = { toolName: string; toolArgs: Record<string, unknown>; summary: string; reasoning?: string; riskLevel: 'medium' | 'high'; state?: 'waiting' | 'running' | 'done' | 'skipped' | 'failed'; result?: string; revertPayload?: RevertPayload | null }
type Msg = { id: string; role: 'user' | 'assistant'; text: string; cards: Card[]; charts?: LexiChartData[]; did: Did[]; pending: Pending | null; status?: string; error?: string; streaming?: boolean }
type Conv = { id: string; title: string | null; updated_at: string }
type Brief = { name?: string; email?: string; emailBrief?: boolean; settingsError?: string; tasks: number; today: number; unassigned: number; overdue: number; stalled: number; incidents: number; expiring: number; error?: string }
type Nudge = { key: string; tone: 'red' | 'orange' | 'blue'; kind: string; title: string; detail: string; ask: string; href?: string }

const CSS = `
.lx{color:${T.ink};font-family:${FONT};letter-spacing:-.01em;width:100%;max-width:1100px;margin:0 auto;padding:0 4px calc(170px + env(safe-area-inset-bottom))}
.lx-end{height:1px;scroll-margin-bottom:calc(190px + env(safe-area-inset-bottom))}
.lx *{box-sizing:border-box}
.lx-hd{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin:6px 0 18px}
.lx-hi{display:flex;align-items:center;gap:16px;min-width:0}
.lx-hd h1{margin:0;color:#fff;font-size:30px;font-weight:600;letter-spacing:-.025em;line-height:1.15}
.lx-hd .sub{margin-top:4px;color:rgba(255,255,255,.7);font-size:14px}
.lx-acts{display:flex;gap:8px;flex-wrap:wrap}
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
.lx-ico.on{background:#EEF4FF;border-color:#D6E4FF;color:${T.blue}}
.lx-orb.listen{animation:lx-listen 1.2s ease-in-out infinite}
.lx-orb.speak{animation:lx-speak .45s ease-in-out infinite alternate}
@keyframes lx-listen{0%,100%{box-shadow:0 0 18px rgba(74,140,255,.45),0 0 0 0 rgba(74,140,255,.5)}50%{box-shadow:0 0 30px rgba(74,140,255,.8),0 0 0 10px rgba(74,140,255,0)}}
@keyframes lx-speak{from{transform:scale(.97)}to{transform:scale(1.07)}}
.lx-voice{position:sticky;bottom:calc(160px + env(safe-area-inset-bottom));z-index:3;display:flex;align-items:center;gap:12px;margin:0 14px 8px;padding:10px 12px;border-radius:14px;background:#EEF4FF;border:1px solid #D6E4FF;font-size:14px}
.lx-voice b{font-weight:600}
.lx-voice .h{font-size:13px;color:${T.ink2};overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lx-vorb{width:40px;height:40px;border-radius:50%;border:0;flex:none;cursor:pointer;background:radial-gradient(circle at 35% 30%,#fff 0,#9fd4ff 18%,#4A8CFF 52%,#6B4CFF 100%)}
.lx-vorb.listening{animation:lx-listen 1.2s ease-in-out infinite}
.lx-vorb.speaking{animation:lx-speak .45s ease-in-out infinite alternate}
.lx-vorb.thinking{animation:lx-think 1.1s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.lx-orb.listen,.lx-orb.speak,.lx-vorb{animation:none!important}}
.lx-ico:disabled{opacity:.45;cursor:default}
.lx-hist{position:fixed;inset:0;z-index:120;background:rgba(15,23,42,.42);display:flex;justify-content:flex-end}
.lx-hist .p{width:min(380px,100%);height:100%;background:#fff;padding:18px;overflow-y:auto;font-family:${FONT}}
.lx-hist .row{display:flex;align-items:center;gap:8px;padding:10px 8px;border-radius:10px;cursor:pointer}
.lx-hist .row:hover{background:#F5F5F7}
.lx-hist .row .t{flex:1;min-width:0;font-size:14px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lx-hist .row .d{font-size:12px;color:${T.ink3}}
.lx-hist .row button{border:0;background:none;color:${T.ink3};cursor:pointer;font-size:16px;padding:2px 6px}
.lx-note{font-size:12px;color:${T.ink3};text-align:center;padding:6px 0 0}
.lx-notice{background:#fff;border-radius:16px;box-shadow:0 1px 2px rgba(10,20,40,.06),0 8px 24px rgba(10,20,40,.08);margin-bottom:16px;overflow:hidden}
.lx-notice .hd2{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:14px 18px 10px}
.lx-notice .hd2 b{font-size:16px;font-weight:600}
.lx-nrow{display:flex;align-items:center;gap:12px;padding:11px 18px;border-top:1px solid ${T.line}}
.lx-nrow .k{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.04em}
.lx-nrow .t{font-size:14.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lx-nrow .s{font-size:12.5px;color:${T.ink3};overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lx-nrow .a{display:flex;gap:6px;flex:none}
.lx-nrow .a .lx-btn{height:32px;padding:0 11px;font-size:12.5px}
.lx-more{border:0;background:none;color:${T.blue};font:600 13px ${FONT};cursor:pointer;padding:10px 18px;border-top:1px solid ${T.line};width:100%;text-align:left}
.lx-mail{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 18px;border-top:1px solid ${T.line};background:#FAFAFB;font-size:13px;color:${T.ink2}}
.lx-sw{position:relative;width:40px;height:24px;border-radius:12px;border:0;cursor:pointer;flex:none;transition:background .15s}
.lx-sw i{position:absolute;top:2px;left:2px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .15s}
.lx-sw[aria-checked=true] i{transform:translateX(16px)}
@media (max-width:640px){.lx-nrow{flex-wrap:wrap}.lx-nrow .a{width:100%}.lx-nrow .a .lx-btn{flex:1}}
@media (max-width:640px){.lx-hd h1{font-size:24px}.lx-orb{width:44px;height:44px}.lx-acts{width:100%}.lx-acts .lx-btn{flex:1 1 auto;padding:0 10px}.lx-u{max-width:90%}}
`

const KIND_LABEL: Record<string, string> = { product: 'Product', deal: 'Deal', work_order: 'Job', site: 'Site', task: 'Task', lead: 'Lead', customer: 'Customer', thread: 'Email', event: 'Calendar', manual: 'Manual' }
const TONE: Record<string, string> = { red: '#FF3B30', orange: '#FF9F0A', green: '#34C759', blue: '#0071E3' }
const CHIPS = ['Brief me on today', 'Who’s waiting on me in email?', 'Show my pipeline by rep', 'Is the Marbella gate working?', 'What jobs are overdue?', 'Remember that I like short answers', 'How do I send a proposal?']
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
  const [nudges, setNudges] = useState<Nudge[] | null>(null)
  const [showAllNudges, setShowAllNudges] = useState(false)
  const [mailMsg, setMailMsg] = useState<string | null>(null)
  const [mailBusy, setMailBusy] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const loadConvRef = useRef<(id: string) => Promise<void>>(async () => {})
  // The nightly text links to /?tab=lexi&review=evening — open the review straight away.
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search)
      // Executive Lexi briefs link to /?tab=lexi&conv=<id> — open that chat so he can answer it.
      const conv = p.get('conv')
      if (conv && /^[0-9a-f-]{36}$/i.test(conv)) {
        void loadConvRef.current(conv)
        p.delete('conv'); const q2 = p.toString()
        window.history.replaceState({}, '', q2 ? `/?${q2}` : '/')
        return
      }
      if (p.get('review') !== 'evening') return
      p.delete('review'); const qs = p.toString()
      window.history.replaceState({}, '', qs ? `/?${qs}` : '/')
      setReviewOpen(true)
    } catch { /* file:// previews */ }
  }, [])
  const recRef = useRef<{ stop: () => void } | null>(null)
  // ── Voice (Phase 4) ─────────────────────────────────────────────────────────
  const [voice, setVoice] = useState(false)
  const [vstate, setVstate] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle')
  const [vHeard, setVHeard] = useState('')
  const [vNote, setVNote] = useState<string | null>(null)
  const [speakReplies, setSpeakReplies] = useState(false)
  const voiceRef = useRef(false)
  const replyRef = useRef<{ text: string; pending: boolean; error: string | null }>({ text: '', pending: false, error: null })
  const msgsRef = useRef<Msg[]>([])
  const sendRef = useRef<(t: string) => Promise<void>>(async () => {})
  const quietRef = useRef(0)
  const speakRepliesRef = useRef(false)
  useEffect(() => { try { const v = localStorage.getItem('lexi_speak') === '1'; setSpeakReplies(v); speakRepliesRef.current = v } catch { /* ignore */ } }, [])
  const endRef = useRef<HTMLDivElement | null>(null)
  const taRef = useRef<HTMLTextAreaElement | null>(null)
  const [, tick] = useState(0)
  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window
  const canDictate = typeof window !== 'undefined' && !!((window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition)

  useEffect(() => {
    fetch('/api/lexi/brief').then(async r => {
      const d = await r.json().catch(() => ({}))
      if (r.status === 403) { setLocked(d?.error || 'Lexi is in early access.'); return }
      if (!r.ok) { setBrief({ tasks: 0, today: 0, unassigned: 0, overdue: 0, stalled: 0, incidents: 0, expiring: 0, error: d?.error || 'Couldn’t load your brief.' }); return }
      setBrief(d)
    }).catch(() => setBrief({ tasks: 0, today: 0, unassigned: 0, overdue: 0, stalled: 0, incidents: 0, expiring: 0, error: 'Couldn’t load your brief.' }))
  }, [])
  useEffect(() => {
    fetch('/api/lexi/nudges').then(r => (r.ok ? r.json() : { nudges: [] })).then(d => setNudges(Array.isArray(d?.nudges) ? d.nudges : [])).catch(() => setNudges([]))
  }, [])
  async function snooze(n: Nudge, days: number) {
    setNudges(ns => (ns ?? []).filter(x => x.key !== n.key))
    const r = await fetch('/api/lexi/nudges', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: n.key, days }) }).catch(() => null)
    if (!r?.ok) { setNudges(ns => [n, ...(ns ?? [])]); setMailMsg('Couldn’t hide that one. Try again.') }
  }
  async function toggleBriefEmail() {
    if (!brief || mailBusy) return
    const on = !brief.emailBrief
    setMailBusy(true); setMailMsg(null); setBrief(b => (b ? { ...b, emailBrief: on } : b))
    const r = await fetch('/api/lexi/brief', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emailBrief: on }) }).catch(() => null)
    const d = r ? await r.json().catch(() => ({})) : {}
    if (!r?.ok) { setBrief(b => (b ? { ...b, emailBrief: !on } : b)); setMailMsg(d?.error || 'That didn’t save. Try again.') }
    else setMailMsg(on ? `You’ll get it at ${brief.email || 'your email'} every weekday at 6:30am.` : 'Morning email turned off.')
    setMailBusy(false)
  }
  async function sendBriefNow() {
    if (mailBusy) return
    setMailBusy(true); setMailMsg('Sending…')
    const r = await fetch('/api/lexi/brief', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send' }) }).catch(() => null)
    const d = r ? await r.json().catch(() => ({})) : {}
    setMailMsg(r?.ok ? `Sent to ${d?.sentTo || 'your email'}.` : d?.error || 'It didn’t send. Try again.')
    setMailBusy(false)
  }
  // Undo windows count down.
  useEffect(() => { const t = setInterval(() => tick(n => n + 1), 1000); return () => clearInterval(t) }, [])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [msgs])

  const patchLast = (fn: (m: Msg) => Msg) => setMsgs(ms => ms.length ? [...ms.slice(0, -1), fn(ms[ms.length - 1])] : ms)
  useEffect(() => { msgsRef.current = msgs }, [msgs])

  const send = useCallback(async (raw: string) => {
    const text = raw.trim()
    if (!text || busy) return
    setInput('')
    const history = msgs.filter(m => m.text).slice(-12).map(m => ({ role: m.role, content: m.text }))
    setMsgs(ms => [...ms, { id: uid(), role: 'user', text, cards: [], did: [], pending: null }, { id: uid(), role: 'assistant', text: '', cards: [], did: [], pending: null, status: 'Thinking', streaming: true }])
    setBusy(true)
    try {
      replyRef.current = { text: '', pending: false, error: null }
      if (voiceRef.current) setVstate('thinking')
      const r = await fetch('/api/lexi/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text, conversationId: convId, history, voice: voiceRef.current }) })
      if (!r.ok || !r.body) {
        const d = await r.json().catch(() => ({}))
        patchLast(m => ({ ...m, streaming: false, status: undefined, error: d?.error || `Lexi couldn’t answer (${r.status}).` }))
        replyRef.current.error = d?.error || 'Lexi couldn’t answer.'
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
          else if (ev.type === 'text') { replyRef.current.text += String(ev.delta ?? ''); patchLast(m => ({ ...m, text: m.text + String(ev.delta ?? ''), status: undefined })) }
          else if (ev.type === 'tool') patchLast(m => ({ ...m, status: String(ev.label ?? 'Looking that up') }))
          else if (ev.type === 'cards') patchLast(m => ({ ...m, cards: [...m.cards, ...((ev.items as Card[]) ?? [])] }))
          else if (ev.type === 'chart' && ev.chart) patchLast(m => ({ ...m, charts: [...(m.charts ?? []), ev.chart as LexiChartData] }))
          else if (ev.type === 'did') patchLast(m => ({ ...m, did: [...m.did, { ok: !!ev.ok, summary: String(ev.summary ?? ''), message: ev.message as string | undefined, revertPayload: (ev.revertPayload as RevertPayload) ?? null, at: Date.now() }] }))
          else if (ev.type === 'pending') { replyRef.current.pending = true; patchLast(m => ({ ...m, pending: { ...(ev.action as Pending), state: 'waiting' } })) }
          else if (ev.type === 'error') { replyRef.current.error = String(ev.error ?? 'Something went wrong.'); patchLast(m => ({ ...m, error: String(ev.error ?? 'Something went wrong.') })) }
          else if (ev.type === 'done' && ev.conversationId) setConvId(String(ev.conversationId))
        }
      }
    } catch {
      patchLast(m => ({ ...m, error: 'Lost the connection. Try again.' }))
      replyRef.current.error = 'Lost the connection.'
    } finally {
      patchLast(m => ({ ...m, streaming: false, status: undefined }))
      setBusy(false)
      if (!voiceRef.current) setTimeout(() => taRef.current?.focus(), 50)
      // Voice: read the answer out loud, then listen again.
      const rr = replyRef.current
      if (voiceRef.current || speakRepliesRef.current) {
        const said = rr.error ? rr.error : spoken(rr.text) || (rr.pending ? 'I’ve got that ready.' : 'Done.')
        speak(rr.pending ? `${said} Say confirm, or skip.` : said, () => { if (voiceRef.current) listen() })
      }
    }
  }, [busy, convId, msgs])
  useEffect(() => { sendRef.current = send }, [send])

  async function confirm(mi: number) {
    const p = msgsRef.current[mi]?.pending
    if (!p || p.state !== 'waiting') return false
    setMsgs(ms => ms.map((m, i) => i === mi && m.pending ? { ...m, pending: { ...m.pending, state: 'running' } } : m))
    const r = await fetch('/api/assistant/execute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ toolName: p.toolName, toolArgs: p.toolArgs }) }).catch(() => null)
    const d = r ? await r.json().catch(() => ({})) : {}
    const ok = !!r?.ok && d?.success !== false
    setMsgs(ms => ms.map((m, i) => i === mi && m.pending ? { ...m, pending: { ...m.pending, state: ok ? 'done' : 'failed', result: ok ? (d?.message || 'Done.') : (d?.error || 'That didn’t go through.'), revertPayload: ok ? d?.revertPayload ?? null : null }, did: ok ? [...m.did, { ok: true, summary: m.pending.summary, message: d?.message, revertPayload: d?.revertPayload ?? null, at: Date.now() }] : m.did } : m))
    return ok ? true : String(d?.error || 'That didn’t go through.')
  }
  const skip = (mi: number) => setMsgs(ms => ms.map((m, i) => i === mi && m.pending ? { ...m, pending: { ...m.pending, state: 'skipped' } } : m))

  async function undo(mi: number, di: number) {
    const d = msgsRef.current[mi]?.did[di]
    if (!d?.revertPayload) return false
    const r = await fetch('/api/assistant/revert', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revertPayload: d.revertPayload }) }).catch(() => null)
    const ok = !!r?.ok
    setMsgs(ms => ms.map((m, i) => i === mi ? { ...m, did: m.did.map((x, j) => j === di ? { ...x, undone: ok, message: ok ? 'Undone.' : 'Couldn’t undo that.' } : x) } : m))
    return ok
  }

  // ── Voice helpers ───────────────────────────────────────────────────────────
  // What to say: the reply without markdown, link text, or long lists; the cards stay on screen.
  function spoken(md: string): string {
    const plain = md.replace(/\*\*|__|`/g, '').replace(/^#+\s*/gm, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/^\s*[-*•]\s+/gm, '').replace(/\n{2,}/g, '. ').replace(/\n/g, ', ').replace(/\s+/g, ' ').replace(/([.!?:])\s*[.,]\s/g, '$1 ').trim()
    if (plain.length <= 420) return plain
    const cut = plain.slice(0, 420); const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '))
    return `${end > 120 ? cut.slice(0, end + 1) : cut}… The rest is on screen.`
  }
  function pickVoice(): SpeechSynthesisVoice | null {
    const vs = window.speechSynthesis.getVoices().filter(v => /^en(-|_)?US/i.test(v.lang) || /^en/i.test(v.lang))
    return vs.find(v => /Samantha|Ava|Allison|Aria|Jenny|Google US English|Natural/i.test(v.name)) ?? vs.find(v => /^en-US/i.test(v.lang)) ?? vs[0] ?? null
  }
  function speak(text: string, after?: () => void) {
    if (!canSpeak || !text) { after?.(); return }
    try {
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text)
      const v = pickVoice(); if (v) u.voice = v
      u.rate = 1.05; u.pitch = 1
      u.onend = () => { setVstate(s => (s === 'speaking' ? 'idle' : s)); after?.() }
      u.onerror = () => { setVstate(s => (s === 'speaking' ? 'idle' : s)); after?.() }
      setVstate('speaking')
      window.speechSynthesis.speak(u)
    } catch { after?.() }
  }
  function listen() {
    if (!voiceRef.current) return
    const W = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec }
    const Ctor = W.SpeechRecognition || W.webkitSpeechRecognition
    if (!Ctor) { setVNote('This browser can’t listen. Try Chrome or Safari.'); stopVoice(); return }
    const r = new Ctor()
    r.lang = 'en-US'; r.interimResults = true; r.continuous = false
    let finalText = ''
    r.onresult = (e: SpeechEvt) => { let t = ''; for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript; finalText = t; setVHeard(t) }
    r.onend = () => {
      recRef.current = null
      if (!voiceRef.current) return
      const t = finalText.trim()
      if (!t) {
        // Silence: try a couple more times, then pause so the mic isn't left open.
        if (++quietRef.current >= 3) { setVNote('Voice paused — tap Talk to start again.'); stopVoice(); return }
        listen(); return
      }
      quietRef.current = 0
      void handleUtterance(t)
    }
    r.onerror = (ev?: { error?: string }) => {
      if (ev?.error === 'not-allowed' || ev?.error === 'service-not-allowed') { setVNote('Microphone is blocked — allow it in the browser to talk to Lexi.'); stopVoice() }
    }
    recRef.current = r; setVHeard(''); setVstate('listening')
    try { r.start() } catch { /* already started */ }
  }
  async function handleUtterance(t: string) {
    const said = t.toLowerCase().replace(/[.!?,]/g, '').trim()
    if (/^(stop|stop listening|that's all|that is all|goodbye|bye|never ?mind|exit)$/.test(said)) { stopVoice(); speak('Okay.'); return }
    const ms = msgsRef.current
    const mi = ms.length - 1
    const waiting = mi >= 0 && ms[mi].pending?.state === 'waiting'
    if (waiting && /^(confirm|yes|yeah|yep|do it|go ahead|ok|okay|sure)( please| it)?$/.test(said)) {
      setVstate('thinking')
      const r = await confirm(mi)
      speak(r === true ? 'Done.' : `That didn’t go through. ${r || ''}`, () => listen()); return
    }
    if (waiting && /^(skip|no|nope|cancel|don't|do not)( it| that)?$/.test(said)) { skip(mi); speak('Skipped.', () => listen()); return }
    if (/^undo( that)?$/.test(said)) {
      for (let i = ms.length - 1; i >= 0; i--) {
        const di = ms[i].did.map((d, j) => (d.revertPayload && !d.undone ? j : -1)).filter(j => j >= 0).pop()
        if (di != null) { const ok = await undo(i, di); speak(ok ? 'Undone.' : 'I couldn’t undo that.', () => listen()); return }
      }
      speak('There’s nothing to undo.', () => listen()); return
    }
    await sendRef.current(t)
  }
  function startVoice() {
    setVNote(null); quietRef.current = 0
    voiceRef.current = true; setVoice(true)
    // Speaking once inside the tap unlocks audio on iPhone.
    speak(msgsRef.current.length ? 'I’m listening.' : `Hi${brief?.name ? ` ${brief.name}` : ''}, I’m listening.`, () => listen())
  }
  function stopVoice() {
    voiceRef.current = false; setVoice(false); setVstate('idle'); setVHeard('')
    try { recRef.current?.stop() } catch { /* ignore */ }
    recRef.current = null
  }
  function interrupt() {
    // Tap while Lexi talks: stop talking and listen.
    try { window.speechSynthesis.cancel() } catch { /* ignore */ }
    if (voiceRef.current) listen()
  }
  function toggleSpeakReplies() {
    const v = !speakReplies; setSpeakReplies(v); speakRepliesRef.current = v
    try { localStorage.setItem('lexi_speak', v ? '1' : '0') } catch { /* ignore */ }
    if (!v) try { window.speechSynthesis.cancel() } catch { /* ignore */ }
  }
  useEffect(() => () => { voiceRef.current = false; try { recRef.current?.stop(); window.speechSynthesis?.cancel() } catch { /* ignore */ } }, [])

  function newChat() { setMsgs([]); setConvId(null); setInput(''); taRef.current?.focus() }
  async function openHistory() {
    setHistOpen(true); setConvs(null)
    const r = await fetch('/api/lexi/conversations').catch(() => null)
    const d = r ? await r.json().catch(() => ({})) : {}
    setConvs(Array.isArray(d?.conversations) ? d.conversations : [])
  }
  loadConvRef.current = (id: string) => loadConv(id)
  async function loadConv(id: string) {
    setHistOpen(false)
    const r = await fetch(`/api/lexi/conversations?id=${id}`).catch(() => null)
    const d = r ? await r.json().catch(() => ({})) : {}
    if (!r?.ok) return
    setConvId(id)
    setMsgs(((d.messages ?? []) as { role: 'user' | 'assistant'; content: string; cards?: { cards?: Card[]; charts?: LexiChartData[] } | null }[]).map(m => ({ id: uid(), role: m.role, text: m.content, cards: m.cards?.cards ?? [], charts: m.cards?.charts ?? [], did: [], pending: null })))
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
        <div className={`lx-orb${vstate === 'listening' ? ' listen' : vstate === 'speaking' ? ' speak' : busyNow ? ' busy' : ''}`} aria-hidden />
        <div style={{ minWidth: 0 }}>
          <h1>{greet()}{brief?.name ? `, ${brief.name}` : ''}</h1>
          <div className="sub">I’m Lexi. Ask me anything about Gate Guard — or tell me what to do.</div>
        </div>
      </div>
      <div className="lx-acts">
        {canDictate && canSpeak && <button type="button" className={`lx-btn ${voice ? 'pri' : 'dark'}`} onClick={() => (voice ? stopVoice() : startVoice())} aria-pressed={voice}>{voice ? 'Stop talking' : 'Talk'}</button>}
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

    {/* Executive Lexi: plans waiting for the CEO's OK (renders nothing for everyone else). */}
    {msgs.length === 0 && <ExecPlans onAsk={t => void send(t)} onOpenConv={id => void loadConv(id)} />}
    {msgs.length === 0 && brief && !brief.error && <section className="lx-notice" aria-label="I noticed">
      <div className="hd2">
        <b>I noticed{nudges && nudges.length ? ` · ${nudges.length}` : ''}</b>
        <span style={{ fontSize: 12.5, color: T.ink3 }}>Things that need you, most urgent first</span>
      </div>
      {nudges === null ? <div className="lx-nrow"><span className="lx-status"><span className="lx-spin" />Looking…</span></div>
        : nudges.length === 0 ? <div className="lx-nrow" style={{ color: T.ink3, fontSize: 14 }}>Nothing needs you right now. Nice.</div>
        : (showAllNudges ? nudges : nudges.slice(0, 5)).map(n => <div key={n.key} className="lx-nrow">
          <span className="lx-dot" style={{ background: TONE[n.tone] }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="k" style={{ color: n.tone === 'red' ? T.red : n.tone === 'orange' ? T.orange : T.blue }}>{n.kind}</div>
            <div className="t">{n.title}</div>
            <div className="s">{n.detail}</div>
          </div>
          <div className="a">
            <button type="button" className="lx-btn pri" onClick={() => send(n.ask)} disabled={busy}>Ask Lexi</button>
            {n.href && <a className="lx-btn line" href={n.href} style={{ textDecoration: 'none' }}>Open</a>}
            <button type="button" className="lx-btn line" onClick={() => void snooze(n, 1)} title="Hide until tomorrow">Later</button>
          </div>
        </div>)}
      {nudges && nudges.length > 5 && <button type="button" className="lx-more" onClick={() => setShowAllNudges(v => !v)}>{showAllNudges ? 'Show fewer' : `Show all ${nudges.length}`}</button>}
      <div className="lx-mail">
        <button type="button" role="switch" aria-checked={!!brief.emailBrief} aria-label="Email me this brief every weekday at 6:30am" className="lx-sw" onClick={toggleBriefEmail} disabled={mailBusy || !!brief.settingsError} style={{ background: brief.emailBrief ? '#34C759' : '#D1D1D6' }}><i /></button>
        <span style={{ flex: 1, minWidth: 180 }}>Email me this brief every weekday at 6:30am</span>
        <button type="button" className="lx-btn line" style={{ height: 32 }} onClick={sendBriefNow} disabled={mailBusy}>Send me one now</button>
        {(mailMsg || brief.settingsError) && <span role="status" style={{ width: '100%', fontSize: 12.5, color: /n’t|not|Couldn|didn/i.test(mailMsg ?? brief.settingsError ?? '') ? T.red : T.green }}>{mailMsg || brief.settingsError}</span>}
      </div>
    </section>}

    {msgs.length === 0 && brief && !brief.error && <EveningCard onOpen={() => setReviewOpen(true)} />}

    <section className="lx-chat" aria-label="Chat with Lexi">
      <div className="lx-thread">
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
              {(m.charts ?? []).map((c, ci) => <LexiChart key={ci} chart={c} />)}
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
      {(voice || vNote) && <div className="lx-voice" role="status" aria-live="polite">
        {voice && <button type="button" className={`lx-vorb ${vstate}`} onClick={interrupt} aria-label={vstate === 'speaking' ? 'Stop talking and listen' : 'Listen'} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          {voice ? <><b>{vstate === 'listening' ? 'Listening…' : vstate === 'thinking' ? 'Thinking…' : vstate === 'speaking' ? 'Speaking — tap the circle to interrupt' : 'Ready'}</b>
            <div className="h">{vHeard ? `“${vHeard}”` : 'Say what you need. “Confirm”, “skip”, “undo” and “stop” work too.'}</div></>
            : <div className="h">{vNote}</div>}
        </div>
        {voice ? <button type="button" className="lx-btn line" onClick={stopVoice}>Stop</button> : <button type="button" className="lx-btn line" onClick={() => setVNote(null)}>OK</button>}
      </div>}
      <form className="lx-comp" onSubmit={e => { e.preventDefault(); void send(input) }}>
        <textarea ref={taRef} rows={1} value={input} placeholder={rec ? 'Listening…' : 'Ask Lexi anything…'} aria-label="Message Lexi"
          onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(160, e.target.scrollHeight)}px` }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(input) } }} />
        {canSpeak && <button type="button" className={`lx-ico${speakReplies ? ' on' : ''}`} onClick={toggleSpeakReplies} aria-pressed={speakReplies} aria-label={speakReplies ? 'Stop reading replies aloud' : 'Read replies aloud'} title={speakReplies ? 'Reading replies aloud' : 'Read replies aloud'}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><path d="M11 5 6 9H3v6h3l5 4V5z" />{speakReplies ? <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /> : <path d="m16 9 5 6M21 9l-5 6" />}</svg>
        </button>}
        {canDictate && <button type="button" className={`lx-ico${rec ? ' rec' : ''}`} onClick={toggleMic} aria-label={rec ? 'Stop listening' : 'Speak'} title={rec ? 'Stop' : 'Speak'}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
        </button>}
        <button type="submit" className="lx-ico send" disabled={!input.trim() || busy} aria-label="Send">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden><path d="M12 19V5M5 12l7-7 7 7" /></svg>
        </button>
      </form>
    </section>
    <div className="lx-note">Lexi can make mistakes. Small changes can be undone for 30 seconds; bigger ones always ask first.</div>

    {reviewOpen && <EveningReview onClose={() => setReviewOpen(false)} onAsk={t => { setReviewOpen(false); void send(t) }} />}
    {panel === 'brain' && <BrainPanel onClose={() => setPanel(null)} />}
    {panel === 'recording' && <RecordingPanel canAct={(brief as { canAct?: boolean } | null)?.canAct !== false} onClose={() => setPanel(null)} />}

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
type SpeechRec = { lang: string; interimResults: boolean; continuous: boolean; onresult: (e: SpeechEvt) => void; onend: () => void; onerror: (e?: { error?: string }) => void; start: () => void; stop: () => void }

export default LexiSurface
