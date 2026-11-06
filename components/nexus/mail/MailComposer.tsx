'use client'
import React, { useEffect, useRef, useState } from 'react'
import { X, Send, Loader2 } from 'lucide-react'
import { M, api, fileSize, fileToBase64 } from './mailShared'
import { SignatureEditor } from './MailSettings'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Paperclip, Bold, Italic, Underline, List, Link2, Sparkles } = require('lucide-react') as any

export type OutgoingEmail = {
  channel_id: string
  thread_id?: string
  forward?: boolean
  to: string
  cc?: string
  bcc?: string
  subject?: string
  html: string
  text: string
  closing?: string               // "Thank you," etc. — goes right above the signature
  attachments?: { filename: string; content: string; contentType: string; size: number }[]
}

export type ComposerSeed = {
  key: string                    // which draft this is (thread id + mode, or "new")
  mode: 'new' | 'reply' | 'replyAll' | 'forward'
  to: string
  cc?: string
  subject: string
  threadId?: string
  forwardHtml?: string           // the email being forwarded (shown under your note)
  html?: string                  // restore (after Undo)
  attachments?: OutgoingEmail['attachments']
}

const MAX_FILES = 2.5 * 1024 * 1024
const draftKey = (k: string) => `gg_mail_draft_${k}`

function readDraft(k: string): string {
  try { return localStorage.getItem(draftKey(k)) ?? '' } catch { return '' }
}
function writeDraft(k: string, html: string) {
  try { if (html && html !== '<br>') localStorage.setItem(draftKey(k), html); else localStorage.removeItem(draftKey(k)) } catch { /* private mode */ }
}
// The signature is added on send; show it under the box so you know it's there.
let sigCache: Promise<string> | null = null
const loadSignature = () => (sigCache ??= api<{ signature?: string }>('/api/nexus/messages/signature').then((r) => r.data.signature ?? '').catch(() => ''))
// Settings saved a new signature → the next composer reads it fresh.
export function resetSignatureCache() { sigCache = null }
const CLOSINGS = ['Thank you,', 'Thanks,', 'Sincerely,', 'Best regards,', 'Regards,', 'Respectfully,', 'Best,', '']
const sigIsHtml = (s: string) => /<\s*(img|div|p|br|table|span|a|b|strong|i|em|font)\b/i.test(s)

export function clearDraft(k: string) { try { localStorage.removeItem(draftKey(k)) } catch { /* ignore */ } }

export default function MailComposer({ seed, channelId, fromEmail, onQueue, onClose, compact }: {
  seed: ComposerSeed
  channelId: string | null
  fromEmail?: string
  onQueue: (email: OutgoingEmail, seed: ComposerSeed) => void
  onClose: () => void
  compact?: boolean
}) {
  const [to, setTo] = useState(seed.to)
  const [cc, setCc] = useState(seed.cc ?? '')
  const [bcc, setBcc] = useState('')
  const [showCc, setShowCc] = useState(!!seed.cc)
  const [subject, setSubject] = useState(seed.subject)
  const [files, setFiles] = useState<NonNullable<OutgoingEmail['attachments']>>(seed.attachments ?? [])
  const [err, setErr] = useState<string | null>(null)
  const [aiOpen, setAiOpen] = useState(false)
  const [aiNote, setAiNote] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [empty, setEmpty] = useState(true)
  const [signature, setSignature] = useState('')
  const [sigReady, setSigReady] = useState(false)
  const [sigEdit, setSigEdit] = useState(false)
  const [sigMsg, setSigMsg] = useState<string | null>(null)
  // Closing line above the signature — your last choice is remembered.
  const [closing, setClosing] = useState<string>(() => { try { return localStorage.getItem('gg_mail_closing') ?? 'Thank you,' } catch { return 'Thank you,' } })
  const [closingCustom, setClosingCustom] = useState(false)
  const pickClosing = (v: string) => { setClosing(v); try { localStorage.setItem('gg_mail_closing', v) } catch { /* ignore */ } }
  useEffect(() => { void loadSignature().then((s) => { setSignature(s); setSigReady(true) }) }, [])
  const saveSignature = async (html: string) => {
    const clean = html.replace(/<br\s*\/?>|&nbsp;|\s/gi, '') ? html : ''
    const r = await api<{ error?: string }>('/api/nexus/messages/signature', { method: 'PUT', json: { signature: clean } })
    if (!r.ok) { setSigMsg(r.data.error ?? 'Could not save'); return }
    sigCache = Promise.resolve(clean)
    setSignature(clean); setSigEdit(false); setSigMsg(null)
  }
  const ed = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!ed.current) return
    ed.current.innerHTML = seed.html ?? readDraft(seed.key)
    setEmpty(!(ed.current.innerText ?? '').trim())
    if (seed.mode !== 'new' || seed.to) ed.current.focus()
  }, [seed.key, seed.html, seed.mode, seed.to])

  const cmd = (c: string, v?: string) => { ed.current?.focus(); document.execCommand(c, false, v) }
  const addLink = () => { const u = window.prompt('Link address'); if (u && /^https?:\/\//i.test(u)) cmd('createLink', u) }

  const onInput = () => {
    const html = ed.current?.innerHTML ?? ''
    setEmpty(!(ed.current?.innerText ?? '').trim())
    writeDraft(seed.key, html)
  }

  const addFiles = async (list: FileList | null) => {
    if (!list) return
    const next = [...files]
    for (const f of Array.from(list)) {
      const total = next.reduce((a, x) => a + x.size, 0) + f.size
      if (total > MAX_FILES) { setErr(`Files can be ${fileSize(MAX_FILES)} total. For bigger files, share a link.`); break }
      next.push({ filename: f.name, contentType: f.type || 'application/octet-stream', size: f.size, content: await fileToBase64(f) })
    }
    setFiles(next)
  }

  const lexi = async () => {
    if (!seed.threadId) return
    setAiBusy(true); setErr(null)
    const r = await api<{ text?: string }>('/api/nexus/messages/ai', { method: 'POST', json: { thread_id: seed.threadId, action: 'draft', note: aiNote } })
    setAiBusy(false)
    if (!r.ok || !r.data.text) { setErr(r.data.error ?? 'Lexi could not write that.'); return }
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const html = r.data.text.split(/\n{2,}/).map((p) => `<div>${esc(p).replace(/\n/g, '<br>')}</div><div><br></div>`).join('')
    if (ed.current) { ed.current.innerHTML = html; onInput() }
    setAiOpen(false); setAiNote('')
  }

  const send = () => {
    setErr(null)
    if (!channelId) { setErr('Connect Gmail first (Settings).'); return }
    if (!to.trim()) { setErr('Who is this going to?'); return }
    const noteHtml = ed.current?.innerHTML ?? ''
    const noteText = (ed.current?.innerText ?? '').trim()
    if (!noteText && !files.length && seed.mode !== 'forward') { setErr('Write something first.'); return }
    if (seed.mode === 'new' && !subject.trim() && !window.confirm('Send without a subject?')) return
    const html = seed.forwardHtml ? `${noteHtml}<br><br>${seed.forwardHtml}` : noteHtml
    onQueue({
      channel_id: channelId,
      thread_id: seed.threadId,
      forward: seed.mode === 'forward' || undefined,
      to, cc: cc || undefined, bcc: bcc || undefined,
      subject: subject || undefined,
      html, text: noteText, closing: closing.trim() || undefined,
      attachments: files.length ? files : undefined,
    }, { ...seed, to, cc, subject, html: noteHtml, attachments: files })
    clearDraft(seed.key)
  }

  const onKey = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); send() }
    if (e.key === 'Escape') { e.stopPropagation(); onClose() }
  }

  const fieldRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', borderBottom: `1px solid ${M.line}` }
  const fieldLbl: React.CSSProperties = { fontSize: 13, color: M.ink3, width: 44, flexShrink: 0 }
  const input: React.CSSProperties = { flex: 1, minWidth: 0, border: 0, outline: 'none', background: 'transparent', fontSize: 13.5, color: M.ink, fontFamily: M.font }
  const tool: React.CSSProperties = { width: 30, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, color: M.ink2, background: 'transparent', border: 0, cursor: 'pointer' }
  const title = seed.mode === 'new' ? 'New email' : seed.mode === 'forward' ? 'Forward' : seed.mode === 'replyAll' ? 'Reply all' : 'Reply'

  return (
    <div onKeyDown={onKey} style={{ background: '#fff', border: `1px solid ${M.lineStrong}`, borderRadius: 12, boxShadow: '0 8px 28px rgba(0,0,0,0.10)', fontFamily: M.font, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0, height: compact ? undefined : '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', borderBottom: `1px solid ${M.line}` }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: M.ink }}>{title}{fromEmail ? <span style={{ fontWeight: 400, color: M.ink3 }}> · from {fromEmail}</span> : null}</span>
        <button type="button" onClick={onClose} aria-label="Close" style={{ ...tool, width: 26, height: 26 }}><X size={15} /></button>
      </div>
      <div style={fieldRow}>
        <span style={fieldLbl}>To</span>
        <input aria-label="To" value={to} onChange={(e) => setTo(e.target.value)} placeholder="name@company.com, …" style={input} autoFocus={seed.mode === 'new' || seed.mode === 'forward'} />
        {!showCc && <button type="button" onClick={() => setShowCc(true)} style={{ fontSize: 12.5, color: M.blue, background: 'none', border: 0, cursor: 'pointer' }}>Cc / Bcc</button>}
      </div>
      {showCc && <>
        <div style={fieldRow}><span style={fieldLbl}>Cc</span><input aria-label="Cc" value={cc} onChange={(e) => setCc(e.target.value)} style={input} /></div>
        <div style={fieldRow}><span style={fieldLbl}>Bcc</span><input aria-label="Bcc" value={bcc} onChange={(e) => setBcc(e.target.value)} style={input} /></div>
      </>}
      {(seed.mode === 'new' || seed.mode === 'forward') && (
        <div style={fieldRow}><span style={fieldLbl}>Subject</span><input aria-label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} style={{ ...input, fontWeight: 500 }} /></div>
      )}
      <div style={{ position: 'relative', flex: 1, minHeight: compact ? 120 : 200, overflowY: 'auto' }}>
        {empty && <div style={{ position: 'absolute', left: 14, top: 12, fontSize: 14, color: M.ink4, pointerEvents: 'none' }}>{seed.mode === 'forward' ? 'Add a note (optional)…' : 'Write your email…'}  ⌘↵ to send</div>}
        <div ref={ed} contentEditable suppressContentEditableWarning onInput={onInput} aria-label="Message"
          style={{ padding: '12px 14px', minHeight: compact ? 120 : 200, outline: 'none', fontSize: 14.5, lineHeight: 1.55, color: M.ink }} />
        <div style={{ margin: '0 14px', paddingTop: 8, borderTop: `1px dashed ${M.line}`, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {closingCustom
            ? <input aria-label="Closing" autoFocus value={closing} onChange={(e) => pickClosing(e.target.value)} onBlur={() => setClosingCustom(false)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setClosingCustom(false) } }}
                placeholder="Your closing…" style={{ fontSize: 14, color: M.ink, border: `1px solid ${M.lineStrong}`, borderRadius: 6, padding: '2px 6px', width: 200, fontFamily: 'inherit' }} />
            : <select aria-label="Closing" value={CLOSINGS.includes(closing) ? closing : '__custom'} onChange={(e) => { if (e.target.value === '__edit') setClosingCustom(true); else if (e.target.value !== '__custom') pickClosing(e.target.value) }}
                title="Closing line — goes right above your signature"
                style={{ fontSize: 14, color: closing ? M.ink : M.ink4, border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit', appearance: 'auto' }}>
                {CLOSINGS.map((c) => <option key={c} value={c}>{c || 'No closing'}</option>)}
                {!CLOSINGS.includes(closing) && <option value="__custom">{closing}</option>}
                <option value="__edit">Write my own…</option>
              </select>}
        </div>
        {signature && (
          <div style={{ margin: '0 14px 12px', paddingTop: 2, position: 'relative' }}>
            <div aria-label="Your signature" title="Added when you send" style={{ opacity: 0.7, fontSize: 13, color: M.ink2, pointerEvents: 'none' }}
              {...(sigIsHtml(signature) ? { dangerouslySetInnerHTML: { __html: signature } } : { children: <span style={{ whiteSpace: 'pre-wrap' }}>{signature}</span> })} />
            <button type="button" onClick={() => setSigEdit(true)} style={{ position: 'absolute', top: 6, right: 0, fontSize: 12, color: M.blue, background: '#fff', border: 0, cursor: 'pointer', padding: '2px 4px' }}>Edit signature</button>
          </div>
        )}
        {!signature && sigReady && (
          <div style={{ margin: '0 14px 12px', paddingTop: 4, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: M.ink3 }}>
            No signature yet.
            <button type="button" onClick={() => setSigEdit(true)} style={{ fontSize: 12.5, fontWeight: 600, color: M.blue, background: 'none', border: 0, cursor: 'pointer', padding: 0 }}>+ Add signature</button>
          </div>
        )}
        {sigEdit && (
          <div role="dialog" aria-modal="true" aria-label="Signature" onClick={() => setSigEdit(false)} style={{ position: 'fixed', inset: 0, zIndex: 130, background: 'rgba(8,13,22,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 620, maxHeight: '90dvh', overflowY: 'auto', position: 'relative' }}>
              <button type="button" aria-label="Close signature" onClick={() => setSigEdit(false)} style={{ position: 'absolute', top: 12, right: 12, zIndex: 1, border: 0, background: M.side, borderRadius: 8, width: 28, height: 28, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: M.ink2 }}><X size={15} /></button>
              <SignatureEditor initial={signature} loaded onSave={saveSignature} msg={sigMsg} />
            </div>
          </div>
        )}
        {seed.forwardHtml && <div style={{ margin: '0 14px 12px', padding: '8px 12px', borderLeft: `2px solid ${M.lineStrong}`, fontSize: 12.5, color: M.ink3 }}>The original email is added below your note.</div>}
      </div>
      {files.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 14px 10px' }}>
          {files.map((f, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, padding: '5px 8px', borderRadius: 7, background: M.side, color: M.ink2 }}>
              <Paperclip size={12} />{f.filename}<span style={{ color: M.ink4 }}>{fileSize(f.size)}</span>
              <button type="button" aria-label={`Remove ${f.filename}`} onClick={() => setFiles(files.filter((_, k) => k !== i))} style={{ border: 0, background: 'none', cursor: 'pointer', color: M.ink3, display: 'inline-flex' }}><X size={12} /></button>
            </span>
          ))}
        </div>
      )}
      {aiOpen && (
        <div style={{ display: 'flex', gap: 8, padding: '8px 14px', borderTop: `1px solid ${M.line}`, background: '#FAFAFC' }}>
          <Sparkles size={15} style={{ color: M.blue, marginTop: 7, flexShrink: 0 }} />
          <input autoFocus value={aiNote} onChange={(e) => setAiNote(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void lexi() } }}
            placeholder="What should it say? (optional) — e.g. “yes, Tuesday at 10 works”" style={{ ...input, padding: '6px 0' }} />
          <button type="button" onClick={() => void lexi()} disabled={aiBusy} style={{ fontSize: 13, fontWeight: 600, color: '#fff', background: M.blue, border: 0, borderRadius: 8, padding: '6px 12px', cursor: 'pointer', opacity: aiBusy ? 0.6 : 1 }}>
            {aiBusy ? 'Writing…' : 'Write it'}
          </button>
        </div>
      )}
      {err && <div role="alert" style={{ padding: '8px 14px', fontSize: 12.5, color: M.red, borderTop: `1px solid ${M.line}` }}>{err}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '8px 10px', borderTop: `1px solid ${M.line}` }}>
        <button type="button" onClick={send} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 600, color: '#fff', background: M.blue, border: 0, borderRadius: 8, padding: '7px 14px', cursor: 'pointer', marginRight: 6 }}>
          <Send size={14} /> Send
        </button>
        <button type="button" title="Bold" aria-label="Bold" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd('bold')} style={tool}><Bold size={15} /></button>
        <button type="button" title="Italic" aria-label="Italic" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd('italic')} style={tool}><Italic size={15} /></button>
        <button type="button" title="Underline" aria-label="Underline" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd('underline')} style={tool}><Underline size={15} /></button>
        <button type="button" title="Bullet list" aria-label="Bullet list" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd('insertUnorderedList')} style={tool}><List size={15} /></button>
        <button type="button" title="Link" aria-label="Add link" onMouseDown={(e) => e.preventDefault()} onClick={addLink} style={tool}><Link2 size={15} /></button>
        <button type="button" title="Attach files" aria-label="Attach files" onClick={() => fileRef.current?.click()} style={tool}><Paperclip size={15} /></button>
        <input ref={fileRef} type="file" multiple hidden onChange={(e) => { void addFiles(e.target.files); e.target.value = '' }} />
        {seed.threadId && seed.mode !== 'forward' && (
          <button type="button" onClick={() => setAiOpen((o) => !o)} style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: M.blue, background: M.blueSoft, border: 0, borderRadius: 8, padding: '6px 11px', cursor: 'pointer' }}>
            {aiBusy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Write with Lexi
          </button>
        )}
      </div>
    </div>
  )
}
