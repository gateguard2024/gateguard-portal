'use client'

// Lock screen for a PIN-gated customer portal. Verifies the passcode, then reloads
// so the server renders the portal with a valid cookie.
import { useState } from 'react'

const T = {
  bg: '#0f1822', panel: 'linear-gradient(180deg,#1d2a39,#141d28)', well: '#0c1420',
  border: 'rgba(140,170,200,0.24)', accent: '#5FB8E0', ink: '#eaf2fb', ink2: '#c3d3e2', alarm: '#f87171',
}

export function PinGate({ slug, displayName }: { slug: string; displayName: string }) {
  const [pin, setPin] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    const r = await fetch(`/api/portal/${slug}/verify`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }),
    })
    if (r.ok) { window.location.reload(); return }
    const j = await r.json().catch(() => ({}))
    setErr(j.error || 'That code isn’t right.')
    setBusy(false)
  }

  return (
    <div style={{ minHeight: '100dvh', background: `radial-gradient(1100px 460px at 50% -8%, rgba(95,184,224,0.10), transparent 62%), ${T.bg}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', var(--font-dm-sans, system-ui), sans-serif", padding: 16 }}>
      <form onSubmit={submit} style={{ width: 'min(360px, 92vw)', background: T.panel, border: `1px solid ${T.border}`, borderRadius: 16, padding: 26, textAlign: 'center', boxShadow: 'inset 0 1px 0 rgba(190,215,240,0.06)' }}>
        <div style={{ fontSize: 24, marginBottom: 6 }}>🔒</div>
        <div style={{ color: T.ink, fontSize: 18, fontWeight: 600 }}>{displayName}</div>
        <div style={{ color: T.ink2, fontSize: 13, margin: '4px 0 18px' }}>Enter your access code to continue</div>
        <input
          value={pin} onChange={e => setPin(e.target.value)} type="password" inputMode="numeric" autoFocus placeholder="Access code"
          style={{ width: '100%', textAlign: 'center', letterSpacing: '0.3em', background: T.well, border: `1px solid ${T.border}`, borderRadius: 10, padding: '12px', color: T.ink, fontSize: 16, outline: 'none', boxSizing: 'border-box' }}
        />
        {err && <div style={{ color: T.alarm, fontSize: 12, marginTop: 10 }}>{err}</div>}
        <button type="submit" disabled={busy || !pin} style={{ width: '100%', marginTop: 14, background: T.accent, border: 'none', color: '#08192b', borderRadius: 10, padding: '11px', fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: busy || !pin ? 0.5 : 1 }}>
          {busy ? 'Checking…' : 'Unlock portal'}
        </button>
      </form>
    </div>
  )
}
