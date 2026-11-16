'use client'

/**
 * /move-in/[token] — resident move-in setup (Part 3). Public; the token is the credential.
 * Phone-first, GateGuard brand (navy header, logo blue) — matches the "mi-photo" design board.
 * Built so far: 1 Confirm details, 2 Your photo. Next: 3 Who gets access, 4 Services, 5 Review & pay, 6 Done.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'

const BLUE = '#1665D8'
const BLUE_BRIGHT = '#3D8DF0'
const NAVY = '#0A192F'
const INK = '#1D1D1F'
const INK2 = '#6E6E73'
const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, system-ui, sans-serif'

type Step = 'details' | 'photo' | 'access' | 'services' | 'review' | 'done'
const ORDER: Step[] = ['details', 'photo', 'access', 'services', 'review', 'done']
const TITLES: Record<Step, string> = {
  details: 'Confirm your details',
  photo: 'Add your photo',
  access: 'Who gets access',
  services: 'Optional services',
  review: 'Review and pay',
  done: 'You’re all set',
}

interface View {
  kind: 'move_in' | 'renewal'
  propertyName: string
  officePhone: string | null
  email: string
  firstName: string | null
  lastName: string | null
  phone: string | null
  unit: string | null
  moveInDate: string | null
  step: Step
  status: string
  hasPhoto: boolean
}

function fmtPhone(d: string) {
  const x = d.replace(/\D/g, '').slice(-10)
  return x.length === 10 ? `(${x.slice(0, 3)}) ${x.slice(3, 6)}-${x.slice(6)}` : d
}

export default function MoveInPage() {
  const { token } = useParams<{ token: string }>()
  const [view, setView] = useState<View | null>(null)
  const [fatal, setFatal] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/move-in/${token}`, { cache: 'no-store' })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return setFatal(j.error ?? 'not_found')
    setView(j)
  }, [token])
  useEffect(() => { load() }, [load])

  const patch = async (body: Record<string, unknown>) => {
    setBusy(true); setErr(null)
    const res = await fetch(`/api/move-in/${token}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const j = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setErr(j.error ?? 'Something went wrong. Please try again.'); return false }
    setView(j); return true
  }

  if (fatal) return <Shell eyebrow="" title={fatal === 'expired' ? 'This link has expired' : fatal === 'cancelled' ? 'This link is no longer active' : 'We couldn’t find this link'} progress={0}>
    <p style={sub}>Please contact your leasing office and ask them to send a new set-up link.</p>
  </Shell>
  if (!view) return <Shell eyebrow="" title="Loading…" progress={0}><div style={{ height: 200 }} /></Shell>

  const step: Step = view.status === 'complete' ? 'done' : view.step
  const idx = ORDER.indexOf(step)
  const eyebrow = `STEP ${idx + 1} OF ${ORDER.length} · ${view.propertyName.toUpperCase()}`

  return (
    <Shell eyebrow={eyebrow} title={TITLES[step]} progress={(idx + 1) / ORDER.length}>
      {step === 'details' && <Details view={view} busy={busy} onSave={(d) => patch({ action: 'details', ...d })} />}
      {step === 'photo' && (
        <Photo
          token={token}
          busy={busy}
          setBusy={setBusy}
          onDone={load}
          onSkip={() => patch({ action: 'skip_photo' })}
          onBack={() => patch({ action: 'goto', step: 'details' })}
          setErr={setErr}
        />
      )}
      {['access', 'services', 'review'].includes(step) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
          <div style={{ background: '#F2F5FA', borderRadius: 12, padding: 16, color: INK2, fontSize: 15, lineHeight: 1.5 }}>
            Thanks{view.firstName ? `, ${view.firstName}` : ''}! The next steps — who gets access, optional services and payment — are being finished now.
            We’ll email you when they’re ready. Your details{view.hasPhoto ? ' and photo are' : ' are'} saved.
          </div>
          <button type="button" style={btn} onClick={() => patch({ action: 'goto', step: 'photo' })} disabled={busy}>Back</button>
        </div>
      )}
      {step === 'done' && <p style={sub}>Check your email for the GateGuard app link. Sign in with {view.email} and your phone is your key.</p>}
      {err && <div role="alert" style={{ color: '#C4180F', fontSize: 14, textAlign: 'center' }}>{err}</div>}
      <p style={{ ...sub, fontSize: 12, marginTop: 8 }}>
        Questions? {view.officePhone ? <>Call the leasing office at <a href={`tel:${view.officePhone}`} style={{ color: BLUE }}>{view.officePhone}</a>.</> : 'Contact your leasing office.'}
      </p>
    </Shell>
  )
}

function Details({ view, busy, onSave }: { view: View; busy: boolean; onSave: (d: { firstName: string; lastName: string; phone: string }) => void }) {
  const [firstName, setFirst] = useState(view.firstName ?? '')
  const [lastName, setLast] = useState(view.lastName ?? '')
  const [phone, setPhone] = useState(view.phone ? fmtPhone(view.phone) : '')
  return (
    <form style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%' }} onSubmit={(e) => { e.preventDefault(); onSave({ firstName, lastName, phone }) }}>
      <p style={{ ...sub, textAlign: 'left', margin: 0 }}>We filled in what we have from your lease{view.unit ? ` for unit ${view.unit}` : ''}. Fix anything that’s wrong.</p>
      <Field label="First name" value={firstName} onChange={setFirst} autoComplete="given-name" />
      <Field label="Last name" value={lastName} onChange={setLast} autoComplete="family-name" />
      <Field label="Mobile phone" value={phone} onChange={setPhone} autoComplete="tel" inputMode="tel" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={label}>Email</span>
        <div style={{ ...input, background: '#F5F5F7', color: INK2, display: 'flex', alignItems: 'center' }}>{view.email}</div>
        <span style={{ fontSize: 12, color: INK2 }}>You’ll sign in to the app with this email. To change it, contact the leasing office.</span>
      </div>
      <button type="submit" style={{ ...btn, ...btnPri, marginTop: 6 }} disabled={busy}>{busy ? 'Saving…' : 'Continue'}</button>
    </form>
  )
}

function Photo({ token, busy, setBusy, onDone, onSkip, onBack, setErr }: {
  token: string; busy: boolean; setBusy: (b: boolean) => void; onDone: () => void; onSkip: () => void; onBack: () => void; setErr: (e: string | null) => void
}) {
  const camRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const pick = (f?: File | null) => {
    if (!f) return
    setErr(null); setFile(f)
    setPreview((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(f) })
  }
  const upload = async () => {
    if (!file) return
    setBusy(true); setErr(null)
    const fd = new FormData(); fd.append('photo', file)
    const res = await fetch(`/api/move-in/${token}/photo`, { method: 'POST', body: fd })
    const j = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) return setErr(j.error ?? 'Upload failed. Please try again.')
    onDone()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, width: '100%' }}>
      <div style={{ width: 168, height: 168, borderRadius: '50%', border: preview ? 'none' : '2px dashed #B8C4D6', background: '#F2F5FA', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {preview
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={preview} alt="Your photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="1.6" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>}
      </div>
      <p style={{ ...sub, maxWidth: 300 }}>Helps the office and gate staff recognize you. <b style={{ color: INK }}>Only staff can see it</b> — never other residents.</p>
      <input ref={camRef} type="file" accept="image/*" capture="user" hidden onChange={(e) => pick(e.target.files?.[0])} />
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" hidden onChange={(e) => pick(e.target.files?.[0])} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
        {file ? (
          <>
            <button type="button" style={{ ...btn, ...btnPri }} onClick={upload} disabled={busy}>{busy ? 'Uploading…' : 'Use this photo'}</button>
            <button type="button" style={btn} onClick={() => camRef.current?.click()} disabled={busy}>Retake</button>
          </>
        ) : (
          <>
            <button type="button" style={{ ...btn, ...btnPri }} onClick={() => camRef.current?.click()} disabled={busy}>Take a photo</button>
            <button type="button" style={btn} onClick={() => fileRef.current?.click()} disabled={busy}>Upload a photo</button>
          </>
        )}
      </div>
      <button type="button" onClick={onSkip} disabled={busy} style={{ background: 'none', border: 0, color: BLUE, fontWeight: 600, fontSize: 15, minHeight: 44, cursor: 'pointer', fontFamily: FONT }}>Skip for now</button>
      <p style={{ ...sub, fontSize: 12, margin: 0 }}>You can change it any time in the GateGuard app → Account.</p>
      <button type="button" onClick={onBack} disabled={busy} style={{ background: 'none', border: 0, color: INK2, fontSize: 14, minHeight: 44, cursor: 'pointer', fontFamily: FONT }}>‹ Back</button>
    </div>
  )
}

function Field({ label: l, value, onChange, autoComplete, inputMode }: { label: string; value: string; onChange: (v: string) => void; autoComplete?: string; inputMode?: 'tel' | 'text' }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={label}>{l}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} inputMode={inputMode} style={input} />
    </label>
  )
}

function Shell({ eyebrow, title, progress, children }: { eyebrow: string; title: string; progress: number; children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#F5F5F7', fontFamily: FONT, color: INK, letterSpacing: '-0.01em' }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <div style={{ background: NAVY, color: '#fff', padding: '28px 20px 44px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, letterSpacing: '.12em' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-sm.png" width={22} height={22} alt="" />GATEGUARD
          </div>
          {eyebrow && <div style={{ fontSize: 12, letterSpacing: '.08em', color: 'rgba(255,255,255,.7)' }}>{eyebrow}</div>}
          <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,.18)', overflow: 'hidden' }}>
            <span style={{ display: 'block', height: '100%', width: `${Math.round(progress * 100)}%`, background: BLUE_BRIGHT, transition: 'width .3s' }} />
          </div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600, letterSpacing: '-.02em' }}>{title}</h1>
        </div>
        <main style={{ background: '#fff', borderRadius: '22px 22px 0 0', marginTop: -22, padding: '28px 20px 34px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, minHeight: 'calc(100vh - 160px)', boxSizing: 'border-box' }}>
          {children}
        </main>
      </div>
    </div>
  )
}

const sub: React.CSSProperties = { color: INK2, fontSize: 14, textAlign: 'center', lineHeight: 1.45 }
const label: React.CSSProperties = { fontSize: 12, color: INK2, fontWeight: 500 }
const input: React.CSSProperties = { minHeight: 48, padding: '0 14px', borderRadius: 12, border: '1px solid rgba(0,0,0,.14)', fontSize: 16, fontFamily: FONT, color: INK, boxSizing: 'border-box', width: '100%' }
const btn: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: 52, borderRadius: 12, border: '1px solid rgba(0,0,0,.12)', background: '#fff', color: INK, fontFamily: FONT, fontSize: 16, fontWeight: 600, cursor: 'pointer' }
const btnPri: React.CSSProperties = { background: BLUE, borderColor: BLUE, color: '#fff' }
