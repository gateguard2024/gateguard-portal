'use client'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Trash2, Loader2, Download, ClipboardList, MoreHorizontal, X } from 'lucide-react'
import MailComposer, { type ComposerSeed, type OutgoingEmail } from './MailComposer'
import { M, api, emailDoc, fileSize, fullTime, initials, personLabel, snoozeOptions, splitQuoted, splitQuotedText, tintFor, type MailMessage, type ThreadDetail, type ThreadRow } from './mailShared'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Flag, Archive, ArrowLeft, Paperclip, Reply, ReplyAll, Forward, Sparkles, MailOpen, AlarmClock, Inbox } = require('lucide-react') as any

export type ThreadAction = 'read' | 'unread' | 'archive' | 'inbox' | 'star' | 'unstar' | 'trash' | 'untrash' | 'snooze' | 'unsnooze'

// One email's body, isolated in a frame that grows to fit.
function EmailFrame({ html, text }: { html: string; text: string }) {
  const ref = useRef<HTMLIFrameElement>(null)
  const [h, setH] = useState(60)
  const fit = useCallback(() => {
    const d = ref.current?.contentDocument
    if (d?.body) setH(Math.min(20000, Math.max(30, d.documentElement.scrollHeight, d.body.scrollHeight)))
  }, [])
  useEffect(() => {
    const f = ref.current
    if (!f) return
    let ro: ResizeObserver | null = null
    const onLoad = () => {
      fit()
      const d = f.contentDocument
      if (d?.body && typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(fit); ro.observe(d.body) }
      d?.querySelectorAll('img').forEach((im) => im.addEventListener('load', fit))
    }
    f.addEventListener('load', onLoad)
    return () => { f.removeEventListener('load', onLoad); ro?.disconnect() }
  }, [fit, html, text])
  return (
    <iframe ref={ref} title="Email" srcDoc={emailDoc(html, text)}
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      style={{ width: '100%', height: h, border: 0, display: 'block', background: '#fff' }} />
  )
}

function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  const t = tintFor(name)
  return <span aria-hidden style={{ width: size, height: size, borderRadius: size, background: `${t}1A`, color: t, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 600, flexShrink: 0 }}>{initials(name)}</span>
}

function MessageCard({ m, expanded, onToggle, onReply, selfEmail }: { m: MailMessage; expanded: boolean; onToggle: () => void; onReply: (mode: 'reply' | 'replyAll' | 'forward', m: MailMessage) => void; selfEmail: string }) {
  const name = m.direction === 'out' ? 'You' : (m.from_name || m.from_address || 'Unknown')
  const [showQuoted, setShowQuoted] = useState(false)
  const html = m.body_html ? splitQuoted(m.body_html) : null
  const text = !m.body_html ? splitQuotedText(m.body) : null
  const hasQuoted = !!(html?.quoted || text?.quoted)
  const toLine = [...m.to, ...m.cc].map((p) => (p.address?.toLowerCase() === selfEmail ? 'me' : (p.name || p.address))).filter(Boolean).join(', ')
  if (!expanded) {
    return (
      <button type="button" onClick={onToggle} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', background: '#fff', border: 0, borderBottom: `1px solid ${M.line}`, textAlign: 'left', cursor: 'pointer', fontFamily: M.font }}>
        <Avatar name={m.from_name || m.from_address || '?'} size={28} />
        <span style={{ fontSize: 13.5, fontWeight: 600, color: M.ink, flexShrink: 0 }}>{name}</span>
        <span style={{ fontSize: 13, color: M.ink3, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', flex: 1 }}>{m.snippet || m.body.slice(0, 140)}</span>
        <span style={{ fontSize: 12, color: M.ink3, flexShrink: 0 }}>{fullTime(m.at)}</span>
      </button>
    )
  }
  return (
    <div style={{ background: '#fff', borderBottom: `1px solid ${M.line}` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '16px 20px 8px' }}>
        <Avatar name={m.from_name || m.from_address || '?'} />
        <button type="button" onClick={onToggle} style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 0, padding: 0, cursor: 'pointer', fontFamily: M.font }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: M.ink }}>{name}</span>
            {m.direction === 'in' && m.from_address && <span style={{ fontSize: 12.5, color: M.ink3 }}>{m.from_address}</span>}
          </div>
          {toLine && <div style={{ fontSize: 12.5, color: M.ink3, marginTop: 2, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>to {toLine}</div>}
        </button>
        <span style={{ fontSize: 12, color: M.ink3, flexShrink: 0, marginTop: 2 }}>{fullTime(m.at)}</span>
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          <button type="button" title="Reply" aria-label="Reply" onClick={() => onReply('reply', m)} style={iconBtn}><Reply size={15} /></button>
          <button type="button" title="Forward" aria-label="Forward" onClick={() => onReply('forward', m)} style={iconBtn}><Forward size={15} /></button>
        </div>
      </div>
      {m.failed && <div role="alert" style={{ margin: '0 20px 8px 66px', fontSize: 12.5, color: M.red }}>Didn’t send: {m.error}</div>}
      <div style={{ padding: '0 20px 6px 66px' }}>
        {m.channel === 'email'
          ? <EmailFrame html={html ? (showQuoted ? m.body_html : html.main) : ''} text={text ? (showQuoted ? m.body : text.main) : ''} />
          : <div style={{ fontSize: 14.5, lineHeight: 1.55, color: M.ink, whiteSpace: 'pre-wrap' }}>{m.body}</div>}
        {hasQuoted && (
          <button type="button" onClick={() => setShowQuoted((s) => !s)} title={showQuoted ? 'Hide earlier text' : 'Show earlier text'} style={{ margin: '4px 0 6px', fontSize: 12, color: M.ink3, background: M.side, border: 0, borderRadius: 6, padding: '1px 8px', cursor: 'pointer' }}>{showQuoted ? 'Hide earlier text' : '•••'}</button>
        )}
        {m.attachments.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '8px 0 12px' }}>
            {m.attachments.map((a, i) => (
              <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10, border: `1px solid ${M.line}`, background: '#FBFBFD', color: M.ink, maxWidth: 280 }}>
                <Paperclip size={15} style={{ color: M.ink3, flexShrink: 0 }} />
                {a.view_url
                  ? <a href={a.view_url} target="_blank" rel="noreferrer" style={{ minWidth: 0, textDecoration: 'none', color: M.ink }}>
                      <span style={{ display: 'block', fontSize: 13, fontWeight: 500, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{a.name}</span>
                      <span style={{ display: 'block', fontSize: 11.5, color: M.ink3 }}>{fileSize(a.size)}</span>
                    </a>
                  : <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 13, fontWeight: 500, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{a.name}</span>
                      <span style={{ display: 'block', fontSize: 11.5, color: M.ink3 }}>{fileSize(a.size)}</span>
                    </span>}
                {a.url && <a href={a.url} aria-label={`Download ${a.name}`} title="Download" style={{ color: M.ink3, display: 'inline-flex', flexShrink: 0 }}><Download size={14} /></a>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const iconBtn: React.CSSProperties = { width: 32, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: 0, background: 'transparent', color: M.ink2, cursor: 'pointer' }

export default function MailReader({ row, selfEmail, channelId, fromEmail, onAction, onBack, onQueue, onTodo, composeFor, onComposed, refreshKey }: {
  row: ThreadRow
  selfEmail: string
  channelId: string | null
  fromEmail?: string
  onAction: (a: ThreadAction, extra?: { until?: string }) => void
  onBack: () => void
  onQueue: (e: OutgoingEmail, seed: ComposerSeed) => void
  onTodo: () => void
  composeFor: { mode: 'reply' | 'replyAll' | 'forward'; restore?: ComposerSeed } | null
  onComposed: () => void
  refreshKey: number
}) {
  const [detail, setDetail] = useState<ThreadDetail | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [seed, setSeed] = useState<ComposerSeed | null>(null)
  const [summary, setSummary] = useState<string | null>(null)
  const [sumBusy, setSumBusy] = useState(false)
  const [snoozeOpen, setSnoozeOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const bottom = useRef<HTMLDivElement>(null)

  const load = useCallback(async (keepOpen: boolean) => {
    const r = await api<ThreadDetail>(`/api/nexus/messages/threads/${row.id}`)
    if (!r.ok) { setLoadErr(r.data.error ?? 'Could not open this conversation.'); return }
    setLoadErr(null)
    setDetail(r.data)
    if (!keepOpen) {
      // Open the newest email + anything unread; older ones fold up (Apple Mail style).
      const ms = r.data.messages
      setOpen(new Set(ms.filter((m, i) => i === ms.length - 1 || m.unread).map((m) => m.id)))
    }
  }, [row.id])

  useEffect(() => { setDetail(null); setSummary(null); setSeed(null); void load(false) }, [row.id, load])
  useEffect(() => { if (refreshKey) void load(true) }, [refreshKey, load])

  const startReply = useCallback((mode: 'reply' | 'replyAll' | 'forward', m?: MailMessage) => {
    const ms = detail?.messages ?? []
    const target = m ?? [...ms].reverse().find((x) => x.direction === 'in') ?? ms[ms.length - 1]
    if (!target) return
    const subj = detail?.thread.subject ?? row.subject
    let to = '', cc = ''
    if (mode !== 'forward') {
      if (target.direction === 'in') to = personLabel({ name: target.from_name, address: target.from_address })
      else to = target.to.map(personLabel).join(', ')
      if (mode === 'replyAll') {
        const mine = new Set([selfEmail, (target.from_address ?? '').toLowerCase()])
        const rest = [...target.to, ...target.cc].filter((p) => p.address && !mine.has(p.address.toLowerCase()) && !to.toLowerCase().includes(p.address.toLowerCase()))
        cc = rest.map(personLabel).join(', ')
      }
    }
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const forwardHtml = mode === 'forward'
      ? `<div style="color:#6E6E73">---------- Forwarded message ----------<br>From: ${esc(personLabel({ name: target.from_name, address: target.from_address }))}<br>Date: ${esc(fullTime(target.at))}<br>Subject: ${esc(target.subject || subj)}<br>To: ${esc(target.to.map(personLabel).join(', '))}</div><br>${target.body_html || esc(target.body).replace(/\n/g, '<br>')}`
      : undefined
    setSeed({ key: `${row.id}-${mode}`, mode, to, cc, subject: mode === 'forward' ? `Fwd: ${subj.replace(/^\s*(fwd?|re):\s*/i, '')}` : subj, threadId: row.id, forwardHtml })
    setTimeout(() => bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 50)
  }, [detail, row.id, row.subject, selfEmail])

  // Keyboard r / a / f from the app, or Undo putting a draft back.
  useEffect(() => {
    if (!composeFor || !detail) return
    if (composeFor.restore) setSeed(composeFor.restore)
    else startReply(composeFor.mode)
    onComposed()
  }, [composeFor, detail, startReply, onComposed])

  const summarize = async () => {
    setSumBusy(true)
    const r = await api<{ text?: string }>('/api/nexus/messages/ai', { method: 'POST', json: { thread_id: row.id, action: 'summary' } })
    setSumBusy(false)
    setSummary(r.ok && r.data.text ? r.data.text : (r.data.error ?? 'Lexi could not read this one.'))
  }

  const t = detail?.thread
  const starred = t?.starred ?? row.starred
  const archived = t?.archived ?? row.archived
  const trashed = t?.trashed ?? row.trashed
  const tb = (label: string, icon: React.ReactNode, onClick: () => void, extra?: React.CSSProperties) => (
    <button type="button" title={label} aria-label={label} onClick={onClick} style={{ ...iconBtn, ...extra }}>{icon}</button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: '#fff', fontFamily: M.font }}>
      {/* toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '8px 12px', borderBottom: `1px solid ${M.line}`, flexShrink: 0, position: 'relative' }}>
        <span className="inline-flex lg:hidden"><button type="button" onClick={onBack} aria-label="Back to list" style={iconBtn}><ArrowLeft size={18} /></button></span>
        {archived || trashed
          ? tb('Move to inbox', <Inbox size={17} />, () => onAction('inbox'))
          : tb('Archive (e)', <Archive size={17} />, () => onAction('archive'))}
        {tb(trashed ? 'Restore' : 'Trash (#)', <Trash2 size={17} />, () => onAction(trashed ? 'untrash' : 'trash'))}
        {tb('Mark unread (u)', <MailOpen size={17} />, () => onAction('unread'))}
        {tb(starred ? 'Unflag (s)' : 'Flag (s)', <Flag size={17} fill={starred ? M.flag : 'none'} style={{ color: starred ? M.flag : undefined }} />, () => onAction(starred ? 'unstar' : 'star'))}
        <div style={{ position: 'relative' }}>
          {tb('Snooze (h)', <AlarmClock size={17} />, () => setSnoozeOpen((o) => !o))}
          {snoozeOpen && (
            <div role="menu" style={menu}>
              <div style={{ fontSize: 11.5, color: M.ink3, padding: '6px 10px 4px' }}>Bring it back…</div>
              {snoozeOptions().map((o) => (
                <button key={o.label} type="button" role="menuitem" onClick={() => { setSnoozeOpen(false); onAction('snooze', { until: o.at.toISOString() }) }} style={menuItem}>{o.label}</button>
              ))}
              {t?.snoozed_until && <button type="button" role="menuitem" onClick={() => { setSnoozeOpen(false); onAction('unsnooze') }} style={{ ...menuItem, color: M.red }}>Cancel snooze</button>}
            </div>
          )}
        </div>
        <div style={{ width: 1, height: 18, background: M.line, margin: '0 6px' }} />
        {tb('Add to my to-dos', <ClipboardList size={17} />, onTodo)}
        <button type="button" onClick={() => void summarize()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: M.blue, background: M.blueSoft, border: 0, borderRadius: 8, padding: '6px 11px', cursor: 'pointer', marginLeft: 4 }}>
          {sumBusy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Summarize
        </button>
        <div style={{ marginLeft: 'auto', position: 'relative' }}>
          {tb('More', <MoreHorizontal size={17} />, () => setMoreOpen((o) => !o))}
          {moreOpen && (
            <div role="menu" style={{ ...menu, right: 0, left: 'auto' }}>
              <button type="button" role="menuitem" style={menuItem} onClick={() => { setMoreOpen(false); onAction('read') }}>Mark as read</button>
              <button type="button" role="menuitem" style={menuItem} onClick={() => { setMoreOpen(false); setOpen(new Set((detail?.messages ?? []).map((m) => m.id))) }}>Expand all</button>
              <button type="button" role="menuitem" style={menuItem} onClick={() => { setMoreOpen(false); window.print() }}>Print</button>
            </div>
          )}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <div style={{ padding: '18px 20px 10px' }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: M.ink, letterSpacing: '-0.01em', lineHeight: 1.3 }}>{t?.subject ?? row.subject}</h2>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {archived && !trashed && <span style={chip}>Archived</span>}
            {trashed && <span style={{ ...chip, color: M.red }}>In Trash</span>}
            {t?.snoozed_until && <span style={chip}>Snoozed until {fullTime(t.snoozed_until)}</span>}
            {row.bulk && <span style={chip}>Newsletter / notification</span>}
            {starred && <span style={{ ...chip, color: M.flag }}>Flagged</span>}
          </div>
        </div>
        {summary && (
          <div style={{ margin: '0 20px 12px', padding: '12px 14px', borderRadius: 12, background: '#F5F8FF', border: '1px solid rgba(0,113,227,0.16)', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: M.blue, marginBottom: 6 }}><Sparkles size={13} /> Lexi’s summary</div>
            <div style={{ fontSize: 13.5, color: M.ink, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{summary}</div>
            <button type="button" aria-label="Close summary" onClick={() => setSummary(null)} style={{ position: 'absolute', top: 8, right: 8, ...iconBtn, width: 24, height: 24 }}><X size={13} /></button>
          </div>
        )}
        {loadErr && <div role="alert" style={{ padding: 20, fontSize: 13.5, color: M.red }}>{loadErr}</div>}
        {!detail && !loadErr && <div style={{ padding: 40, textAlign: 'center', color: M.ink3 }}><Loader2 size={18} className="animate-spin" /></div>}
        <div style={{ borderTop: `1px solid ${M.line}` }}>
          {detail?.messages.map((m) => (
            <MessageCard key={m.id} m={m} selfEmail={selfEmail} expanded={open.has(m.id)}
              onToggle={() => setOpen((s) => { const n = new Set(s); if (n.has(m.id)) n.delete(m.id); else n.add(m.id); return n })}
              onReply={(mode, mm) => startReply(mode, mm)} />
          ))}
        </div>
        <div ref={bottom} style={{ padding: '14px 20px 24px' }}>
          {seed ? (
            <MailComposer compact seed={seed} channelId={channelId ?? row.channel_id} fromEmail={fromEmail}
              onQueue={(e, s) => { setSeed(null); onQueue(e, s) }} onClose={() => setSeed(null)} />
          ) : detail && row.channel === 'email' ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => startReply('reply')} style={replyBtn}><Reply size={15} /> Reply</button>
              <button type="button" onClick={() => startReply('replyAll')} style={replyBtn}><ReplyAll size={15} /> Reply all</button>
              <button type="button" onClick={() => startReply('forward')} style={replyBtn}><Forward size={15} /> Forward</button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

const chip: React.CSSProperties = { fontSize: 11.5, color: M.ink3, background: M.side, borderRadius: 6, padding: '2px 8px' }
const menu: React.CSSProperties = { position: 'absolute', top: 36, left: 0, zIndex: 30, minWidth: 220, background: '#fff', border: `1px solid ${M.line}`, borderRadius: 10, boxShadow: '0 12px 32px rgba(0,0,0,0.14)', padding: 4 }
const menuItem: React.CSSProperties = { display: 'block', width: '100%', textAlign: 'left', fontSize: 13, color: M.ink, background: 'none', border: 0, borderRadius: 6, padding: '7px 10px', cursor: 'pointer', fontFamily: M.font }
const replyBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13.5, fontWeight: 500, color: M.ink, background: '#fff', border: `1px solid ${M.lineStrong}`, borderRadius: 9, padding: '8px 14px', cursor: 'pointer', fontFamily: M.font }
