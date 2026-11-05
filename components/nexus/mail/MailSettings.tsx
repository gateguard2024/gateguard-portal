'use client'
import React, { useEffect, useState } from 'react'
import { Mail, Plus, Trash2, RefreshCw, Send, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { M, ago, api, type Account } from './mailShared'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { ArrowLeft } = require('lucide-react') as any

type Channel = { id: string; channel_type: 'gmail' | 'smtp'; display_name: string; email: string | null; smtp_host: string | null; connected: boolean; last_synced_at: string | null }

export default function MailSettings({ onBack, accounts, onChanged }: { onBack: () => void; accounts: Account[]; onChanged: () => void }) {
  const [channels, setChannels] = useState<Channel[] | null>(null)
  const [sig, setSig] = useState('')
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
    void api<{ signature?: string }>('/api/nexus/messages/signature').then((r) => setSig(r.data.signature ?? ''))
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
                      : <><CheckCircle2 size={12} style={{ color: M.green }} /> Live · synced {ago(h?.last_synced_at ?? c.last_synced_at)}{h && !h.can_modify ? ' · reconnect to sync read/archive back to Gmail' : ''}</>}
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

        <div style={box}>
          <div style={{ fontSize: 15, fontWeight: 600, color: M.ink, marginBottom: 4 }}>Signature</div>
          <div style={{ fontSize: 12.5, color: M.ink3, marginBottom: 10 }}>Added to the bottom of every email you send from Nexus.</div>
          <textarea value={sig} onChange={(e) => setSig(e.target.value)} rows={5} placeholder={'Russel Feldman\nCEO, Gate Guard\n(555) 123-4567'} style={{ ...inp, resize: 'vertical' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
            <button type="button" style={primary} onClick={async () => {
              const r = await api('/api/nexus/messages/signature', { method: 'PUT', json: { signature: sig } })
              setSigMsg(r.ok ? 'Saved' : (r.data.error ?? 'Could not save'))
              setTimeout(() => setSigMsg(null), 2000)
            }}>Save signature</button>
            {sigMsg && <span style={{ fontSize: 12.5, color: M.ink3 }}>{sigMsg}</span>}
          </div>
        </div>

        <div style={{ ...box, fontSize: 12.5, color: M.ink3, lineHeight: 1.6 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: M.ink, marginBottom: 6 }}>Keyboard shortcuts</div>
          {[['c', 'New email'], ['j / k', 'Next / previous'], ['Enter', 'Open'], ['r / a / f', 'Reply / Reply all / Forward'], ['e', 'Archive'], ['#', 'Trash'], ['s', 'Star'], ['u', 'Mark unread'], ['h', 'Snooze'], ['/', 'Search'], ['⌘ Enter', 'Send'], ['Esc', 'Close']].map(([k, l]) => (
            <div key={k} style={{ display: 'flex', gap: 10 }}><span style={{ width: 80, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color: M.ink2 }}>{k}</span>{l}</div>
          ))}
        </div>
      </div>
    </div>
  )
}
