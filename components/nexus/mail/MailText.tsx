'use client'
// Texts & calls (RingCentral) inside Nexus Mail: a Messages-style conversation —
// bubbles for texts, a line for each call, a player for voicemail — and a box to text back.
import React, { useEffect, useRef, useState } from 'react'
import { Phone, Send, Loader2, X } from 'lucide-react'
import { M, api, fullTime, type MailMessage } from './mailShared'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { PhoneMissed, PhoneIncoming, PhoneOutgoing, Voicemail } = require('lucide-react') as any

export function prettyPhone(n: string | null | undefined): string {
  const m = String(n ?? '').match(/^\+1(\d{3})(\d{3})(\d{4})$/)
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : String(n ?? '')
}
const sameDay = (a: string, b: string) => new Date(a).toDateString() === new Date(b).toDateString()

export function ChatView({ messages }: { messages: MailMessage[] }) {
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [messages.length])
  return (
    <div style={{ padding: '12px 20px 4px', display: 'flex', flexDirection: 'column', gap: 6, fontFamily: M.font }}>
      {messages.map((m, i) => {
        const showDay = i === 0 || !sameDay(messages[i - 1].at, m.at)
        const day = showDay ? <div style={{ textAlign: 'center', fontSize: 11.5, color: M.ink3, margin: '10px 0 4px' }}>{fullTime(m.at)}</div> : null
        const out = m.direction === 'out'
        if (m.channel === 'call') {
          const vm = /^voicemail/i.test(m.body)
          const missed = /^missed/i.test(m.body)
          const Icon = vm ? Voicemail : missed ? PhoneMissed : out ? PhoneOutgoing : PhoneIncoming
          const audio = m.attachments.find((a) => /audio/.test(a.mime_type))
          return (
            <React.Fragment key={m.id}>
              {day}
              <div style={{ alignSelf: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 12, background: M.side, maxWidth: '90%' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, color: missed ? M.red : M.ink2, fontWeight: 500 }}>
                  <Icon size={15} /> {m.body.split('\n')[0]} <span style={{ color: M.ink3, fontWeight: 400 }}>· {new Date(m.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                </span>
                {audio?.view_url && <audio controls preload="none" src={audio.view_url} style={{ width: 260, height: 34 }} aria-label="Play voicemail" />}
                {vm && m.body.includes('\n') && <span style={{ fontSize: 12.5, color: M.ink2, maxWidth: 420, textAlign: 'center' }}>{m.body.split('\n').slice(1).join(' ')}</span>}
              </div>
            </React.Fragment>
          )
        }
        const pics = m.attachments.filter((a) => /^image\//.test(a.mime_type) && a.view_url)
        return (
          <React.Fragment key={m.id}>
            {day}
            <div style={{ alignSelf: out ? 'flex-end' : 'flex-start', maxWidth: '78%', display: 'flex', flexDirection: 'column', alignItems: out ? 'flex-end' : 'flex-start', gap: 3 }}>
              {pics.map((p, k) => <a key={k} href={p.view_url!} target="_blank" rel="noreferrer"><img src={p.view_url!} alt="Picture" style={{ maxWidth: 240, borderRadius: 14, display: 'block' }} /></a>)}
              {m.body && (
                <div style={{ padding: '8px 12px', borderRadius: 18, borderBottomRightRadius: out ? 6 : 18, borderBottomLeftRadius: out ? 18 : 6, background: out ? (m.failed ? '#FDECEA' : M.blue) : '#E9E9EB', color: out && !m.failed ? '#fff' : M.ink, fontSize: 14.5, lineHeight: 1.4, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.body}</div>
              )}
              <span style={{ fontSize: 11, color: m.failed ? M.red : M.ink4 }}>{m.failed ? 'Not delivered' : new Date(m.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
            </div>
          </React.Fragment>
        )
      })}
      <div ref={end} />
    </div>
  )
}

export function TextBox({ channelId, threadId, to, onSent, autoFocus }: { channelId: string | null; threadId?: string; to?: string; onSent: (threadId?: string) => void; autoFocus?: boolean }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const send = async () => {
    const t = text.trim()
    if (!t || busy) return
    if (!channelId) { setErr('Connect RingCentral in Mail settings.'); return }
    setBusy(true); setErr(null)
    const r = await api<{ ok?: boolean; thread_id?: string }>('/api/nexus/messages/send', { method: 'POST', json: { kind: 'text', channel_id: channelId, thread_id: threadId, to, text: t } })
    setBusy(false)
    if (!r.ok || r.data.ok === false) { setErr(r.data.error ?? 'Didn’t send.'); return }
    setText('')
    onSent(r.data.thread_id)
  }
  return (
    <div style={{ fontFamily: M.font }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, border: `1px solid ${M.lineStrong}`, borderRadius: 20, padding: '6px 6px 6px 14px', background: '#fff' }}>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} autoFocus={autoFocus} aria-label="Text message"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }}
          placeholder="Text message" style={{ flex: 1, resize: 'none', border: 0, outline: 'none', fontSize: 14.5, lineHeight: 1.4, padding: '5px 0', maxHeight: 140, fontFamily: M.font, background: 'transparent' }} />
        <span style={{ fontSize: 11, color: text.length > 160 ? M.orange : M.ink4, alignSelf: 'center' }}>{text.length > 120 ? `${text.length}/1000` : ''}</span>
        <button type="button" onClick={() => void send()} disabled={!text.trim() || busy} aria-label="Send text"
          style={{ width: 32, height: 32, borderRadius: 32, border: 0, background: text.trim() ? M.blue : M.ink4, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
        </button>
      </div>
      {err && <div role="alert" style={{ fontSize: 12.5, color: M.red, marginTop: 6 }}>{err}</div>}
    </div>
  )
}

export function NewTextModal({ channelId, fromNumber, onClose, onSent }: { channelId: string | null; fromNumber?: string | null; onClose: () => void; onSent: (threadId?: string) => void }) {
  const [to, setTo] = useState('')
  return (
    <div style={{ background: '#fff', border: `1px solid ${M.lineStrong}`, borderRadius: 12, boxShadow: '0 8px 28px rgba(0,0,0,0.12)', fontFamily: M.font, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', borderBottom: `1px solid ${M.line}` }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: M.ink }}><Phone size={13} style={{ verticalAlign: -2 }} /> New text{fromNumber ? <span style={{ fontWeight: 400, color: M.ink3 }}> · from {prettyPhone(fromNumber)}</span> : null}</span>
        <button type="button" onClick={onClose} aria-label="Close" style={{ width: 26, height: 26, border: 0, background: 'none', color: M.ink2, cursor: 'pointer' }}><X size={15} /></button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderBottom: `1px solid ${M.line}` }}>
        <span style={{ fontSize: 13, color: M.ink3, width: 30 }}>To</span>
        <input autoFocus value={to} onChange={(e) => setTo(e.target.value)} placeholder="(404) 555-0123" aria-label="Phone number" inputMode="tel"
          style={{ flex: 1, border: 0, outline: 'none', fontSize: 14, fontFamily: M.font }} />
      </div>
      <div style={{ padding: 12 }}>
        <TextBox channelId={channelId} to={to} onSent={(id) => { onSent(id); onClose() }} />
      </div>
    </div>
  )
}
