'use client'
/** The form on a unit's QR page — files a request about that exact unit (/api/request + unit). */
import React, { useState } from 'react'

const INK = '#1D1D1F', MUTED = '#6E6E73', BLUE = '#0071E3', RED = '#D70015', GREEN = '#1A7F37'
const QUICK = ['Won’t open', 'Won’t close', 'Stuck open', 'Making noise', 'Damaged', 'Something else']
const PRI = [{ v: 'normal', l: 'Can wait a few days' }, { v: 'high', l: 'Affecting residents today' }, { v: 'urgent', l: 'Safety issue / completely down' }]

export function QrRequestForm({ siteId, siteName, unitCode, unitLabel, assetId, gone }: { siteId: string; siteName: string; unitCode: string; unitLabel: string; assetId: string; gone?: boolean }) {
  const [what, setWhat] = useState('')
  const [details, setDetails] = useState('')
  const [pri, setPri] = useState('normal')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ref, setRef] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!what) { setErr('Pick what’s wrong.'); return }
    if (!phone.trim() && !email.trim()) { setErr('Add a phone number or email so we can reach you.'); return }
    setBusy(true); setErr(null)
    try {
      const r = await fetch('/api/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        site_id: siteId, unit: unitCode, title: `${what} — ${unitLabel}`, description: details.trim() || null, priority_requested: pri,
        contact_name: name.trim() || null, contact_phone: phone.trim() || null, contact_email: email.trim() || null,
      }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(d.error ?? 'That didn’t send. Try again.'); return }
      setRef(String(d.request?.id ?? '').slice(0, 8).toUpperCase())
    } catch { setErr('No connection — try again.') } finally { setBusy(false) }
  }

  const card: React.CSSProperties = { background: '#fff', borderRadius: 14, padding: 18, boxShadow: '0 1px 2px rgba(10,20,40,.06), 0 8px 24px rgba(10,20,40,.08)' }
  const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', fontSize: 16, padding: '11px 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.16)', background: '#fff', color: INK, fontFamily: 'inherit' }
  const lbl: React.CSSProperties = { display: 'grid', gap: 5, fontSize: 13, fontWeight: 600, color: MUTED }
  const staff = <a href={`/?tab=systems&site=${siteId}&asset=${assetId}`} style={{ display: 'inline-block', marginTop: 16, fontSize: 13, color: MUTED }}>Gate Guard staff: open this unit</a>

  if (ref) return (
    <section style={card}>
      <div style={{ fontSize: 13, fontWeight: 600, color: GREEN }}>Sent</div>
      <h1 style={{ fontSize: 22, fontWeight: 600, margin: '4px 0 6px' }}>Thanks — we’ve got it</h1>
      <p style={{ margin: 0, fontSize: 15, color: MUTED, lineHeight: 1.5 }}>Your request about <b style={{ color: INK, fontWeight: 600 }}>{unitLabel}</b> at {siteName} is in. Reference <b style={{ color: INK }}>{ref}</b>. We’ll reach out to schedule.</p>
      {staff}
    </section>
  )

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
      <section style={card}>
        <div style={{ fontSize: 13, color: MUTED }}>{siteName}</div>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: '2px 0 0', lineHeight: 1.25 }}>Report a problem with {unitLabel}</h1>
        {gone && <p style={{ margin: '8px 0 0', fontSize: 13.5, color: RED }}>This label is for a unit that was replaced. Your report still reaches the property’s service team.</p>}
      </section>
      <section style={{ ...card, display: 'grid', gap: 14 }}>
        <div role="group" aria-label="What’s wrong">
          <div style={{ fontSize: 13, fontWeight: 600, color: MUTED, marginBottom: 8 }}>What’s wrong?</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {QUICK.map((q) => <button key={q} type="button" aria-pressed={what === q} onClick={() => setWhat(q)}
              style={{ border: `1px solid ${what === q ? INK : 'rgba(0,0,0,0.16)'}`, background: what === q ? INK : '#fff', color: what === q ? '#fff' : INK, borderRadius: 999, padding: '9px 14px', fontSize: 15, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>{q}</button>)}
          </div>
        </div>
        <label style={lbl}>Anything else we should know? (optional)<textarea rows={3} value={details} onChange={(e) => setDetails(e.target.value)} style={{ ...inp, resize: 'vertical' }} /></label>
        <label style={lbl}>How soon?
          <select value={pri} onChange={(e) => setPri(e.target.value)} style={inp}>{PRI.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}</select>
        </label>
      </section>
      <section style={{ ...card, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: MUTED }}>How can we reach you?</div>
        <label style={lbl}>Name<input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} style={inp} /></label>
        <label style={lbl}>Phone<input type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} style={inp} /></label>
        <label style={lbl}>Email<input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inp} /></label>
      </section>
      {err && <div role="alert" style={{ color: RED, fontSize: 14 }}>{err}</div>}
      <button type="submit" disabled={busy} style={{ border: 0, borderRadius: 12, padding: 15, background: BLUE, color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: busy ? 0.6 : 1 }}>{busy ? 'Sending…' : 'Send to the service team'}</button>
      <div style={{ textAlign: 'center' }}>{staff}</div>
    </form>
  )
}
