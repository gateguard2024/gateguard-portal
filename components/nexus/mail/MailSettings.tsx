'use client'
import React, { useEffect, useRef, useState } from 'react'
import { Mail, Plus, Trash2, RefreshCw, Send, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { M, ago, api, type Account } from './mailShared'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { ArrowLeft, Bold, Italic, Link2, Image: ImageIcon } = require('lucide-react') as any

type Channel = { id: string; channel_type: 'gmail' | 'smtp'; display_name: string; email: string | null; smtp_host: string | null; connected: boolean; last_synced_at: string | null }

export default function MailSettings({ onBack, accounts, onChanged }: { onBack: () => void; accounts: Account[]; onChanged: () => void }) {
  const [channels, setChannels] = useState<Channel[] | null>(null)
  const [sig, setSig] = useState('')
  const [sigLoaded, setSigLoaded] = useState(false)
  const [sigMsg, setSigMsg] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [smtpOpen, setSmtpOpen] = useState(false)
  const [smtp, setSmtp] = useState({ display_name: '', host: '', port: '587', secure: false, user: '', pass: '', from_address: '' })

  const load = async () => {
    const r = await api<{ channels?: Channel[] }>('/api/nexus/messages/channels')
    setChannels(r.data.channels ?? [])
  }
  useEffect(() => {
    void load()
    void api<{ signature?: string }>('/api/nexus/messages/signature').then((r) => { setSig(r.data.signature ?? ''); setSigLoaded(true) })
    // Back from Google with a result in the URL.
    const p = new URLSearchParams(window.location.search)
    if (p.get('gmail_connected')) setMsg('Gmail connected. Your mail is syncing now.')
    if (p.get('gmail_error')) setMsg(`Gmail didn’t connect (${p.get('gmail_error')}). Try again.`)
  }, [])

  const health = (id: string) => accounts.find((a) => a.id === id)
  const act = async (key: string, fn: () => Promise<string>) => { setBusy(key); setMsg(await fn()); setBusy(null); await load(); onChanged() }

  const box: React.CSSProperties = { background: '#fff', border: `1px solid ${M.line}`, borderRadius: 12, padding: 16, marginBottom: 14 }
  const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: M.ink, background: '#fff', border: `1px solid ${M.lineStrong}`, borderRadius: 8, padding: '6px 11px', cursor: 'pointer', fontFamily: M.font }
  const primary: React.CSSProperties = { ...btn, color: '#fff', background: M.blue, border: 0 }
  const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', fontSize: 13.5, padding: '8px 10px', borderRadius: 8, border: `1px solid ${M.lineStrong}`, outline: 'none', fontFamily: M.font }

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: M.side, fontFamily: M.font }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '18px 18px 60px' }}>
        <button type="button" onClick={onBack} style={{ ...btn, border: 0, background: 'none', padding: '6px 0', color: M.blue }}><ArrowLeft size={16} /> Back to mail</button>
        <h2 style={{ fontSize: 22, fontWeight: 600, color: M.ink, margin: '10px 0 14px' }}>Mail settings</h2>
        {msg && <div role="status" style={{ ...box, padding: '10px 14px', fontSize: 13, color: M.ink2 }}>{msg}</div>}

        <div style={box}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: M.ink }}>Email accounts</div>
            <a href="/api/nexus/messages/google/connect" style={{ ...primary, textDecoration: 'none' }}><Plus size={14} /> Connect Gmail</a>
          </div>
          {!channels ? <Loader2 size={16} className="animate-spin" style={{ color: M.ink3 }} /> : channels.length === 0 ? (
            <div style={{ fontSize: 13, color: M.ink3, lineHeight: 1.5 }}>No email connected yet. Connect your Gmail (Google Workspace) account — your inbox, sent mail, read/unread and archive all stay in step with Gmail.</div>
          ) : channels.map((c) => {
            const h = health(c.id)
            const bad = !!h?.last_error || (c.channel_type === 'gmail' && !c.connected)
            return (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: `1px solid ${M.line}`, flexWrap: 'wrap' }}>
                <Mail size={18} style={{ color: M.ink3 }} />
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: M.ink }}>{c.email ?? c.display_name}</div>
                  <div style={{ fontSize: 12, color: bad ? M.red : M.ink3, display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                    {c.channel_type === 'smtp' ? `Send only · ${c.smtp_host}` : bad
                      ? <><AlertTriangle size={12} /> {h?.last_error ?? 'Not connected'}</>
                      : <><CheckCircle2 size={12} style={{ color: M.green }} /> Live · synced {ago(h?.last_synced_at ?? c.last_synced_at)}{h?.gmail_inbox_unread != null ? ` · Gmail inbox: ${h.gmail_inbox_unread} unread (checked ${ago(h.checked_at ?? null)})` : ''}{h && !h.can_modify ? ' · reconnect to sync read/archive back to Gmail' : ''}</>}
                  </div>
                </div>
                {c.channel_type === 'gmail' && (bad || (h && !h.can_modify)) && <a href="/api/nexus/messages/google/connect" style={{ ...primary, textDecoration: 'none' }}>Reconnect</a>}
                {c.channel_type === 'gmail' && !bad && (
                  <button type="button" style={btn} disabled={busy !== null} onClick={() => void act(`r${c.id}`, async () => {
                    const r = await api<{ fetched?: number; error?: string }>('/api/nexus/messages/sync', { method: 'POST', json: { channel_id: c.id, full: true, force: true, backfill: true } })
                    return r.ok ? `Re-synced — ${r.data.fetched ?? 0} new.` : `Sync problem: ${r.data.error}`
                  })}>{busy === `r${c.id}` ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Re-sync</button>
                )}
                <button type="button" style={btn} disabled={busy !== null} onClick={() => void act(`t${c.id}`, async () => {
                  const r = await api<{ ok?: boolean; sent_to?: string; error?: string }>('/api/nexus/messages/channels/test', { method: 'POST', json: { channel_id: c.id } })
                  return r.data.ok ? `Test email sent to ${r.data.sent_to}.` : `Test failed: ${r.data.error}`
                })}><Send size={13} /> Test</button>
                <button type="button" style={{ ...btn, color: M.red }} disabled={busy !== null} onClick={() => { if (window.confirm(`Disconnect ${c.email ?? c.display_name}? Its mail leaves Nexus.`)) void act(`d${c.id}`, async () => { await api(`/api/nexus/messages/channels?id=${encodeURIComponent(c.id)}`, { method: 'DELETE' }); return 'Disconnected.' }) }}><Trash2 size={13} /></button>
              </div>
            )
          })}
          <button type="button" onClick={() => setSmtpOpen((o) => !o)} style={{ ...btn, border: 0, padding: '8px 0 0', color: M.blue, background: 'none' }}>{smtpOpen ? 'Hide' : 'Add another mailbox (SMTP, send only)'}</button>
          {smtpOpen && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
              {([['display_name', 'Name'], ['from_address', 'From address'], ['host', 'SMTP server'], ['port', 'Port'], ['user', 'Username'], ['pass', 'Password']] as const).map(([k, l]) => (
                <label key={k}><span style={{ fontSize: 12, color: M.ink3 }}>{l}</span>
                  <input type={k === 'pass' ? 'password' : 'text'} value={String(smtp[k])} onChange={(e) => setSmtp({ ...smtp, [k]: e.target.value })} style={inp} /></label>
              ))}
              <label style={{ fontSize: 13, color: M.ink2, display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={smtp.secure} onChange={(e) => setSmtp({ ...smtp, secure: e.target.checked })} /> SSL (port 465)</label>
              <button type="button" style={primary} onClick={() => void act('smtp', async () => {
                const r = await api('/api/nexus/messages/channels', { method: 'POST', json: { ...smtp, port: Number(smtp.port) } })
                if (r.ok) { setSmtpOpen(false); return 'Mailbox added.' }
                return r.data.error ?? 'Could not add that mailbox.'
              })}>Save mailbox</button>
            </div>
          )}
        </div>

        <RingCentralCard onChanged={onChanged} />

        <SignatureEditor initial={sig} loaded={sigLoaded} onSave={async (html) => {
          const r = await api('/api/nexus/messages/signature', { method: 'PUT', json: { signature: html } })
          setSigMsg(r.ok ? 'Saved' : (r.data.error ?? 'Could not save'))
          setTimeout(() => setSigMsg(null), 2500)
        }} msg={sigMsg} />

        <div style={{ ...box, fontSize: 12.5, color: M.ink3, lineHeight: 1.6 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: M.ink, marginBottom: 6 }}>Keyboard shortcuts</div>
          {[['c', 'New email'], ['j / k', 'Next / previous'], ['Enter', 'Open'], ['r / a / f', 'Reply / Reply all / Forward'], ['e', 'Archive'], ['#', 'Trash'], ['s', 'Flag'], ['x', 'Select'], ['Shift-click', 'Select a range'], ['u', 'Mark unread'], ['h', 'Snooze'], ['/', 'Search'], ['⌘ Enter', 'Send'], ['Esc', 'Close']].map(([k, l]) => (
            <div key={k} style={{ display: 'flex', gap: 10 }}><span style={{ width: 80, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color: M.ink2 }}>{k}</span>{l}</div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Signature with formatting + a logo or photo. Pictures are shrunk in the browser
// (max 320 px wide) and kept with the signature; they go out as inline images.
const isHtml = (s: string) => /<\s*(img|div|p|br|table|span|a|b|strong|i|em|font)\b/i.test(s)
const textToHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')

function shrinkImage(file: File, maxW: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width)
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale)
      const g = c.getContext('2d')!
      const keepAlpha = /png|gif|webp/.test(file.type)
      if (!keepAlpha) { g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height) }
      g.drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      resolve(c.toDataURL(keepAlpha ? 'image/png' : 'image/jpeg', 0.9))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Not a picture')) }
    img.src = url
  })
}

function SignatureEditor({ initial, loaded, onSave, msg }: { initial: string; loaded: boolean; onSave: (html: string) => Promise<void>; msg: string | null }) {
  const ed = useRef<HTMLDivElement>(null)
  const file = useRef<HTMLInputElement>(null)
  const [width, setWidth] = useState(200)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => { if (loaded && ed.current) ed.current.innerHTML = isHtml(initial) ? initial : textToHtml(initial) }, [loaded, initial])
  const cmd = (c: string, v?: string) => { ed.current?.focus(); document.execCommand(c, false, v) }
  const addImage = async (f: File | undefined) => {
    if (!f) return
    setErr(null)
    if (!/^image\/(png|jpe?g|gif|webp)$/.test(f.type)) { setErr('Use a PNG or JPG picture.'); return }
    try {
      const data = await shrinkImage(f, 320)
      ed.current?.focus()
      document.execCommand('insertHTML', false, `<img src="${data}" alt="Gate Guard" width="${width}" style="width:${width}px;max-width:100%;height:auto;display:block;margin:6px 0">`)
    } catch { setErr('Could not read that picture.') }
  }
  const resizeImages = (w: number) => {
    setWidth(w)
    ed.current?.querySelectorAll('img').forEach((im) => { im.setAttribute('width', String(w)); (im as HTMLImageElement).style.width = `${w}px` })
  }
  const tool: React.CSSProperties = { width: 30, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, color: M.ink2, background: 'transparent', border: 0, cursor: 'pointer' }
  const hasImg = !!ed.current?.querySelector('img')
  return (
    <div style={{ background: '#fff', border: `1px solid ${M.line}`, borderRadius: 12, padding: 16, marginBottom: 14 }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: M.ink, marginBottom: 4 }}>Signature</div>
      <div style={{ fontSize: 12.5, color: M.ink3, marginBottom: 10 }}>Added to the bottom of every email you send from Nexus. Add your logo or photo with the picture button — or paste your signature from Gmail.</div>
      <div style={{ border: `1px solid ${M.lineStrong}`, borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '4px 6px', borderBottom: `1px solid ${M.line}`, background: '#FAFAFC', flexWrap: 'wrap' }}>
          <button type="button" aria-label="Bold" title="Bold" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd('bold')} style={tool}><Bold size={15} /></button>
          <button type="button" aria-label="Italic" title="Italic" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd('italic')} style={tool}><Italic size={15} /></button>
          <button type="button" aria-label="Add link" title="Link" onMouseDown={(e) => e.preventDefault()} onClick={() => { const u = window.prompt('Link (https://…)'); if (u && /^(https?:|mailto:|tel:)/i.test(u)) cmd('createLink', u) }} style={tool}><Link2 size={15} /></button>
          <button type="button" aria-label="Add logo or picture" title="Add logo or picture" onMouseDown={(e) => e.preventDefault()} onClick={() => file.current?.click()} style={{ ...tool, width: 'auto', padding: '0 9px', gap: 6, fontSize: 12.5 }}><ImageIcon size={15} /> Add logo / picture</button>
          <input ref={file} type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden onChange={(e) => { void addImage(e.target.files?.[0]); e.target.value = '' }} />
          <label style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: M.ink3 }}>
            Picture size
            <input type="range" min={60} max={320} step={10} value={width} onChange={(e) => resizeImages(Number(e.target.value))} aria-label="Picture size" />
          </label>
        </div>
        <div ref={ed} contentEditable suppressContentEditableWarning aria-label="Signature" data-has-img={hasImg ? '1' : '0'}
          style={{ minHeight: 110, padding: '10px 12px', outline: 'none', fontSize: 14, lineHeight: 1.5, color: M.ink }} />
      </div>
      {err && <div role="alert" style={{ fontSize: 12.5, color: M.red, marginTop: 8 }}>{err}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
        <button type="button" disabled={busy} onClick={async () => { setBusy(true); await onSave(ed.current?.innerHTML ?? ''); setBusy(false) }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: '#fff', background: M.blue, border: 0, borderRadius: 8, padding: '7px 13px', cursor: 'pointer', fontFamily: M.font }}>{busy ? 'Saving…' : 'Save signature'}</button>
        {msg && <span style={{ fontSize: 12.5, color: M.ink3 }}>{msg}</span>}
      </div>
    </div>
  )
}

// RingCentral: texts, calls and voicemail from your RingCentral number, in this inbox.
type RcState = { app_ready: boolean; connected: boolean; channel: null | { id: string; name: string | null; extension: string | null; numbers: { number: string; sms: boolean; label: string }[]; sms_from: string | null; last_synced_at: string | null; last_error: string | null } }
function RingCentralCard({ onChanged }: { onChanged: () => void }) {
  const [st, setSt] = useState<RcState | null>(null)
  const [jwt, setJwt] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const load = async () => { const r = await api<RcState>('/api/nexus/messages/ringcentral'); if (r.ok) setSt(r.data) }
  useEffect(() => { void load() }, [])
  const connect = async () => {
    setBusy(true); setMsg(null)
    const r = await api<{ ok?: boolean; name?: string; fetched?: number; warning?: string | null }>('/api/nexus/messages/ringcentral', { method: 'POST', json: { jwt } })
    setBusy(false)
    if (!r.ok) { setMsg(r.data.error ?? 'Could not connect.'); return }
    setJwt(''); setOpen(false)
    setMsg(`Connected as ${r.data.name}. ${r.data.fetched ?? 0} texts and calls brought in.${r.data.warning ? ` (${r.data.warning})` : ''}`)
    await load(); onChanged()
  }
  const pretty = (n: string) => { const m = n.match(/^\+1(\d{3})(\d{3})(\d{4})$/); return m ? `(${m[1]}) ${m[2]}-${m[3]}` : n }
  const ch = st?.channel
  const box: React.CSSProperties = { background: '#fff', border: `1px solid ${M.line}`, borderRadius: 12, padding: 16, marginBottom: 14 }
  return (
    <div style={box}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: M.ink }}>RingCentral — texts &amp; calls</div>
        {ch && <button type="button" onClick={() => setOpen((o) => !o)} style={{ fontSize: 12.5, color: M.blue, background: 'none', border: 0, cursor: 'pointer' }}>{open ? 'Cancel' : 'Replace login'}</button>}
      </div>
      {!st ? <Loader2 size={16} className="animate-spin" style={{ color: M.ink3 }} /> : ch ? (
        <>
          <div style={{ fontSize: 13, color: ch.last_error ? M.red : M.ink2, display: 'flex', alignItems: 'center', gap: 6 }}>
            {ch.last_error ? <AlertTriangle size={13} /> : <CheckCircle2 size={13} style={{ color: M.green }} />}
            {ch.last_error ?? `${ch.name ?? 'Connected'}${ch.extension ? ` · ext ${ch.extension}` : ''} · synced ${ago(ch.last_synced_at)}`}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 13, color: M.ink2, flexWrap: 'wrap' }}>
            Text from
            <select value={ch.sms_from ?? ''} onChange={async (e) => { const r = await api('/api/nexus/messages/ringcentral', { method: 'POST', json: { sms_from: e.target.value } }); setMsg(r.ok ? 'Saved.' : (r.data.error ?? 'Could not save')); await load(); onChanged() }}
              style={{ fontSize: 13, padding: '6px 8px', borderRadius: 8, border: `1px solid ${M.lineStrong}`, fontFamily: M.font }}>
              {!ch.sms_from && <option value="">Pick a number…</option>}
              {ch.numbers.filter((n) => n.sms).map((n) => <option key={n.number} value={n.number}>{pretty(n.number)}{n.label ? ` — ${n.label}` : ''}</option>)}
            </select>
            {ch.numbers.filter((n) => n.sms).length === 0 && <span style={{ color: M.orange }}>None of your RingCentral numbers can send texts yet (ask RingCentral to turn on SMS / register the number for texting).</span>}
          </label>
        </>
      ) : null}
      {st && (!ch || open) && (
        st.app_ready ? (
          <div style={{ marginTop: ch ? 12 : 4 }}>
            <ol style={{ margin: '0 0 10px 18px', padding: 0, fontSize: 12.5, color: M.ink2, lineHeight: 1.6 }}>
              <li>Go to <a href="https://developers.ringcentral.com/console" target="_blank" rel="noreferrer" style={{ color: M.blue }}>developers.ringcentral.com</a> and sign in with your RingCentral login.</li>
              <li>Open <b>Credentials</b> → <b>Create JWT</b>, allow it for the Gate Guard Nexus app, and copy it.</li>
              <li>Paste it here.</li>
            </ol>
            <textarea value={jwt} onChange={(e) => setJwt(e.target.value)} rows={3} placeholder="eyJ…" aria-label="RingCentral JWT"
              style={{ width: '100%', boxSizing: 'border-box', fontSize: 12.5, padding: '8px 10px', borderRadius: 8, border: `1px solid ${M.lineStrong}`, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }} />
            <button type="button" onClick={() => void connect()} disabled={busy || !jwt.trim()} style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: '#fff', background: M.blue, border: 0, borderRadius: 8, padding: '7px 13px', cursor: 'pointer', opacity: busy || !jwt.trim() ? 0.6 : 1, fontFamily: M.font }}>
              {busy ? <Loader2 size={13} className="animate-spin" /> : null} Connect RingCentral
            </button>
          </div>
        ) : (
          <div style={{ fontSize: 12.5, color: M.ink2, lineHeight: 1.6, marginTop: 4 }}>
            Almost ready — Gate Guard’s RingCentral app needs to be added once. In Vercel set <code>RINGCENTRAL_CLIENT_ID</code> and <code>RINGCENTRAL_CLIENT_SECRET</code> (and <code>CREDENTIALS_ENC_KEY</code> if it isn’t set), then come back here.
          </div>
        )
      )}
      {msg && <div role="status" style={{ fontSize: 12.5, color: M.ink2, marginTop: 8 }}>{msg}</div>}
    </div>
  )
}
