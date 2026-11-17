'use client'

/**
 * /move-in/[token] — resident move-in setup (Part 3). Public; the token is the credential.
 * Phone-first, GateGuard brand (navy header, logo blue) — matches the "mi-photo" design board.
 * Steps: 1 Confirm details, 2 Your photo, 3 Who gets access, 4 Optional services (placeholder until Shop
 * products are set), 5 Review & pay (Stripe Checkout, or no payment when the property pays / collects /
 * a code covers it), 6 Done (access on + key-ready email).
 */

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'

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
  household: Person[]
  vehicles: Car[]
  fee: { cents: number; paidBy: 'resident' | 'property' | 'property_collects' | 'partial'; chargePer: 'lease' | 'person'; termMonths: number }
  quote: { people: number; grossCents: number; propertyCoversCents: number; codeOffCents: number; dueCents: number; lines: Array<{ label: string; cents: number }> }
  code: string | null
  paymentStatus: string
}

function money(cents: number) {
  const v = Math.abs(cents) / 100
  return `${cents < 0 ? '−' : ''}$${v.toFixed(v % 1 === 0 ? 0 : 2)}`
}

interface Person { first_name?: string; last_name?: string; email?: string; phone?: string; include?: boolean; from_lease?: boolean }
interface Car { make?: string; model?: string; color?: string; plate?: string; state?: string }

function fmtPhone(d: string) {
  const x = d.replace(/\D/g, '').slice(-10)
  return x.length === 10 ? `(${x.slice(0, 3)}) ${x.slice(3, 6)}-${x.slice(6)}` : d
}

export default function MoveInPage() {
  // useSearchParams (Stripe return) needs a Suspense boundary in the App Router.
  return <Suspense fallback={<Shell eyebrow="" title="Loading…" progress={0}><div style={{ height: 200 }} /></Shell>}><MoveIn /></Suspense>
}

function MoveIn() {
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
  const search = useSearchParams()
  const sessionId = search.get('session_id')
  const [confirming, setConfirming] = useState(!!sessionId)

  useEffect(() => {
    if (!sessionId) { load(); return }
    // Back from Stripe: confirm the payment, then load. Retry a few times while Stripe settles.
    let tries = 0
    const confirm = async () => {
      const res = await fetch(`/api/move-in/${token}/pay/confirm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: sessionId }) })
      const j = await res.json().catch(() => ({}))
      if (j.pending && tries++ < 5) return setTimeout(confirm, 2000)
      if (!res.ok) setErr(j.error ?? 'We couldn’t confirm your payment yet. Refresh in a minute.')
      window.history.replaceState(null, '', `/move-in/${token}`)
      setConfirming(false)
      load()
    }
    confirm()
  }, [load, sessionId, token])

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
  if (!view || confirming) return <Shell eyebrow="" title={confirming ? 'Confirming your payment…' : 'Loading…'} progress={0}><div style={{ height: 200 }} /></Shell>

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
      {step === 'access' && (
        <Access
          view={view}
          busy={busy}
          onSave={(household, vehicles) => patch({ action: 'access', household, vehicles })}
          onBack={() => patch({ action: 'goto', step: 'photo' })}
        />
      )}
      {step === 'services' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
          <div style={{ background: '#F2F5FA', borderRadius: 12, padding: 16, color: INK2, fontSize: 15, lineHeight: 1.5 }}>
            Gate remotes, internet, unit security and more will be offered here. Nothing to add right now — you can shop any time in the GateGuard app.
          </div>
          <button type="button" style={{ ...btn, ...btnPri }} onClick={() => patch({ action: 'services' })} disabled={busy}>Continue</button>
          <button type="button" onClick={() => patch({ action: 'goto', step: 'access' })} disabled={busy} style={{ ...linkBtn, color: INK2, alignSelf: 'center' }}>‹ Back</button>
        </div>
      )}
      {step === 'review' && (
        <Review view={view} token={token} busy={busy} setBusy={setBusy} setErr={setErr} patch={patch} onDone={load} />
      )}
      {step === 'done' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, width: '100%' }}>
          <div style={{ width: 72, height: 72, borderRadius: 36, background: '#E8F7EE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#1E8E3E" strokeWidth="2.4" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          </div>
          <p style={{ ...sub, fontSize: 16, color: INK, margin: 0 }}>Your access is on{view.paymentStatus === 'paid' ? ' and your payment is received' : ''}.</p>
          <p style={sub}>We emailed you the GateGuard app link. Download it, sign in with <b style={{ color: INK }}>{view.email}</b> and your phone is your key. Everyone you added gets their own email.</p>
          <a href="https://gateguard.co/app" style={{ ...btn, ...btnPri, textDecoration: 'none' }}>Get the GateGuard app</a>
        </div>
      )}
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

const CROP = 260          // on-screen crop circle (px)
const OUT = 640           // saved photo size (px, square JPEG)

function Photo({ token, busy, setBusy, onDone, onSkip, onBack, setErr }: {
  token: string; busy: boolean; setBusy: (b: boolean) => void; onDone: () => void; onSkip: () => void; onBack: () => void; setErr: (e: string | null) => void
}) {
  const camRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [src, setSrc] = useState<string | null>(null)
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ dist: number; zoom: number } | null>(null)

  useEffect(() => () => { if (src) URL.revokeObjectURL(src) }, [src])

  const baseScale = nat ? CROP / Math.min(nat.w, nat.h) : 1
  const clamp = (p: { x: number; y: number }, z: number) => {
    if (!nat) return p
    const w = nat.w * baseScale * z, h = nat.h * baseScale * z
    return { x: Math.min(0, Math.max(CROP - w, p.x)), y: Math.min(0, Math.max(CROP - h, p.y)) }
  }
  const zoomTo = (z: number) => {
    const nz = Math.min(4, Math.max(1, z))
    const s1 = baseScale * zoom, s2 = baseScale * nz
    const cx = (CROP / 2 - pos.x) / s1, cy = (CROP / 2 - pos.y) / s1
    setPos(clamp({ x: CROP / 2 - cx * s2, y: CROP / 2 - cy * s2 }, nz))
    setZoom(nz)
  }

  const pick = (f?: File | null) => {
    if (!f) return
    if (!f.type.startsWith('image/')) return setErr('Please choose a photo.')
    setErr(null)
    const url = URL.createObjectURL(f)
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      const w = img.naturalWidth, h = img.naturalHeight, s = CROP / Math.min(w, h)
      setNat({ w, h }); setZoom(1); setPos({ x: (CROP - w * s) / 2, y: (CROP - h * s) / 2 })
      setSrc((old) => { if (old) URL.revokeObjectURL(old); return url })
    }
    img.onerror = () => { URL.revokeObjectURL(url); setErr('We couldn’t open that photo. Try a JPG or PNG.') }
    img.src = url
  }

  const onDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom }
    }
  }
  const onMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId)
    if (!prev) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()]
      zoomTo(pinch.current.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.dist))
    } else if (pointers.current.size === 1) {
      setPos((p) => clamp({ x: p.x + e.clientX - prev.x, y: p.y + e.clientY - prev.y }, zoom))
    }
  }
  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
  }

  const upload = async () => {
    const img = imgRef.current
    if (!img || !nat) return
    setBusy(true); setErr(null)
    const s = baseScale * zoom
    const canvas = document.createElement('canvas')
    canvas.width = OUT; canvas.height = OUT
    const ctx = canvas.getContext('2d')
    if (!ctx) { setBusy(false); return setErr('Your browser couldn’t prepare the photo.') }
    ctx.drawImage(img, -pos.x / s, -pos.y / s, CROP / s, CROP / s, 0, 0, OUT, OUT)
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.9))
    if (!blob) { setBusy(false); return setErr('Your browser couldn’t prepare the photo.') }
    const fd = new FormData(); fd.append('photo', new File([blob], 'photo.jpg', { type: 'image/jpeg' }))
    const res = await fetch(`/api/move-in/${token}/photo`, { method: 'POST', body: fd })
    const j = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) return setErr(j.error ?? 'Upload failed. Please try again.')
    onDone()
  }

  const s = baseScale * zoom
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, width: '100%' }}>
      <div
        onPointerDown={src ? onDown : undefined} onPointerMove={src ? onMove : undefined} onPointerUp={onUp} onPointerCancel={onUp}
        style={{ width: CROP, height: CROP, borderRadius: '50%', border: src ? 'none' : '2px dashed #B8C4D6', background: '#F2F5FA', overflow: 'hidden', position: 'relative', touchAction: 'none', cursor: src ? 'grab' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: src ? '0 0 0 3px #fff, 0 0 0 4px rgba(0,0,0,.12)' : 'none' }}
      >
        {src && nat
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={src} alt="Your photo" draggable={false} style={{ position: 'absolute', left: pos.x, top: pos.y, width: nat.w * s, height: nat.h * s, maxWidth: 'none', userSelect: 'none', pointerEvents: 'none' }} />
          : <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="1.6" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>}
      </div>

      {src ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', maxWidth: 300 }}>
            <button type="button" aria-label="Zoom out" onClick={() => zoomTo(zoom - 0.25)} style={roundBtn}>−</button>
            <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => zoomTo(Number(e.target.value))} aria-label="Zoom" style={{ flex: 1, accentColor: BLUE }} />
            <button type="button" aria-label="Zoom in" onClick={() => zoomTo(zoom + 0.25)} style={roundBtn}>+</button>
          </div>
          <p style={{ ...sub, fontSize: 13, margin: 0 }}>Drag to move · pinch or slide to zoom</p>
        </div>
      ) : (
        <p style={{ ...sub, maxWidth: 300 }}>Helps the office and gate staff recognize you. <b style={{ color: INK }}>Only staff can see it</b> — never other residents.</p>
      )}

      <input ref={camRef} type="file" accept="image/*" capture="user" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = '' }} />
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = '' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
        {src ? (
          <>
            <button type="button" style={{ ...btn, ...btnPri }} onClick={upload} disabled={busy}>{busy ? 'Saving…' : 'Use this photo'}</button>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" style={btn} onClick={() => camRef.current?.click()} disabled={busy}>Retake</button>
              <button type="button" style={btn} onClick={() => fileRef.current?.click()} disabled={busy}>Upload instead</button>
            </div>
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

function Access({ view, busy, onSave, onBack }: { view: View; busy: boolean; onSave: (h: Person[], v: Car[]) => void; onBack: () => void }) {
  const [people, setPeople] = useState<Person[]>(view.household.length ? view.household : [])
  const [cars, setCars] = useState<Car[]>(view.vehicles)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<Person>({})
  const [carDraft, setCarDraft] = useState<Car | null>(null)

  const toggle = (i: number) => setPeople((p) => p.map((x, j) => (j === i ? { ...x, include: !(x.include !== false) } : x)))
  const setField = (i: number, k: keyof Person, v: string) => setPeople((p) => p.map((x, j) => (j === i ? { ...x, [k]: v } : x)))
  const remove = (i: number) => setPeople((p) => p.filter((_, j) => j !== i))
  const addPerson = () => {
    if (!draft.first_name || !draft.last_name || !draft.email) return
    setPeople((p) => [...p, { ...draft, include: true, from_lease: false }]); setDraft({}); setAdding(false)
  }
  const addCar = () => {
    if (!carDraft?.plate) return
    setCars((c) => [...c, carDraft]); setCarDraft(null)
  }
  const included = people.filter((p) => p.include !== false).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
      <p style={{ ...sub, textAlign: 'left', margin: 0 }}>Everyone you choose gets their own key in the GateGuard app. They sign in with their own email.</p>

      <Card>
        <PersonRow name={`${view.firstName ?? ''} ${view.lastName ?? ''}`.trim() || 'You'} detail={`${view.email} · you`} right={<span style={{ fontSize: 13, color: '#1E8E3E', fontWeight: 600 }}>Included</span>} />
        {people.map((p, i) => {
          const on = p.include !== false
          const missing = on && !p.email
          return (
            <div key={i} style={{ borderTop: '1px solid rgba(0,0,0,.06)' }}>
              <PersonRow
                name={`${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Someone on your lease'}
                detail={p.email || (p.from_lease ? 'On your lease · add their email' : '')}
                right={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {!p.from_lease && <button type="button" onClick={() => remove(i)} style={linkBtn}>Remove</button>}
                    <Toggle on={on} onClick={() => toggle(i)} label={`Give ${p.first_name ?? 'this person'} access`} />
                  </div>
                }
              />
              {missing && (
                <div style={{ padding: '0 14px 14px' }}>
                  <input placeholder="Their email" type="email" value={p.email ?? ''} onChange={(e) => setField(i, 'email', e.target.value)} style={input} />
                </div>
              )}
            </div>
          )
        })}
      </Card>

      {adding ? (
        <Card>
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <input placeholder="First name" value={draft.first_name ?? ''} onChange={(e) => setDraft({ ...draft, first_name: e.target.value })} style={input} />
              <input placeholder="Last name" value={draft.last_name ?? ''} onChange={(e) => setDraft({ ...draft, last_name: e.target.value })} style={input} />
            </div>
            <input placeholder="Email (they sign in with this)" type="email" value={draft.email ?? ''} onChange={(e) => setDraft({ ...draft, email: e.target.value })} style={input} />
            <input placeholder="Mobile (optional)" inputMode="tel" value={draft.phone ?? ''} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} style={input} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" style={btn} onClick={() => { setAdding(false); setDraft({}) }}>Cancel</button>
              <button type="button" style={{ ...btn, ...btnPri }} onClick={addPerson} disabled={!draft.first_name || !draft.last_name || !draft.email}>Add</button>
            </div>
          </div>
        </Card>
      ) : (
        people.length < 6 && <button type="button" style={btn} onClick={() => setAdding(true)}>+ Add someone</button>
      )}

      <div style={{ ...label, marginTop: 6, letterSpacing: '.06em' }}>VEHICLES</div>
      <Card>
        {cars.length === 0 && !carDraft && <div style={{ padding: 14, color: INK2, fontSize: 14 }}>No vehicles yet. Adding your plate helps the gate camera and staff.</div>}
        {cars.map((c, i) => (
          <div key={i} style={{ borderTop: i ? '1px solid rgba(0,0,0,.06)' : 'none' }}>
            <PersonRow name={c.plate ?? ''} detail={[c.color, c.make, c.model, c.state].filter(Boolean).join(' · ')} right={<button type="button" onClick={() => setCars((x) => x.filter((_, j) => j !== i))} style={linkBtn}>Remove</button>} />
          </div>
        ))}
        {carDraft && (
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10, borderTop: cars.length ? '1px solid rgba(0,0,0,.06)' : 'none' }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <input placeholder="Plate" value={carDraft.plate ?? ''} onChange={(e) => setCarDraft({ ...carDraft, plate: e.target.value.toUpperCase() })} style={input} />
              <input placeholder="State" maxLength={2} value={carDraft.state ?? ''} onChange={(e) => setCarDraft({ ...carDraft, state: e.target.value.toUpperCase() })} style={{ ...input, width: 80 }} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <input placeholder="Make" value={carDraft.make ?? ''} onChange={(e) => setCarDraft({ ...carDraft, make: e.target.value })} style={input} />
              <input placeholder="Model" value={carDraft.model ?? ''} onChange={(e) => setCarDraft({ ...carDraft, model: e.target.value })} style={input} />
            </div>
            <input placeholder="Color" value={carDraft.color ?? ''} onChange={(e) => setCarDraft({ ...carDraft, color: e.target.value })} style={input} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" style={btn} onClick={() => setCarDraft(null)}>Cancel</button>
              <button type="button" style={{ ...btn, ...btnPri }} onClick={addCar} disabled={!carDraft.plate}>Add</button>
            </div>
          </div>
        )}
      </Card>
      {!carDraft && cars.length < 4 && <button type="button" style={btn} onClick={() => setCarDraft({})}>+ Add a vehicle</button>}

      <button type="button" style={{ ...btn, ...btnPri, marginTop: 6 }} disabled={busy || adding || !!carDraft} onClick={() => onSave(people, cars)}>
        {busy ? 'Saving…' : `Continue · ${included + 1} ${included ? 'people' : 'person'}`}
      </button>
      <button type="button" onClick={onBack} disabled={busy} style={{ ...linkBtn, color: INK2, alignSelf: 'center' }}>‹ Back</button>
    </div>
  )
}

function Review({ view, token, busy, setBusy, setErr, patch, onDone }: {
  view: View; token: string; busy: boolean; setBusy: (b: boolean) => void; setErr: (e: string | null) => void
  patch: (b: Record<string, unknown>) => Promise<boolean>; onDone: () => void
}) {
  const [code, setCode] = useState('')
  const [showCode, setShowCode] = useState(false)
  const q = view.quote
  const included = view.household.filter((h) => h.include !== false && h.email)
  const residentPays = view.fee.paidBy === 'resident' || view.fee.paidBy === 'partial'

  const finish = async () => {
    setBusy(true); setErr(null)
    const res = await fetch(`/api/move-in/${token}/pay`, { method: 'POST' })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) { setBusy(false); return setErr(j.error ?? 'Something went wrong. Please try again.') }
    if (j.url) { window.location.href = j.url; return }   // Stripe Checkout
    setBusy(false); onDone()
  }

  const Line = ({ l, r, bold }: { l: string; r: string; bold?: boolean }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', fontSize: bold ? 17 : 15, fontWeight: bold ? 600 : 400 }}>
      <span style={{ color: bold ? INK : INK2 }}>{l}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{r}</span>
    </div>
  )
  const Sum = ({ l, v, step }: { l: string; v: string; step: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 52, padding: '6px 14px', borderTop: '1px solid rgba(0,0,0,.06)' }}>
      <div style={{ minWidth: 0 }}><div style={{ fontSize: 13, color: INK2 }}>{l}</div><div style={{ fontSize: 15, fontWeight: 600 }}>{v}</div></div>
      <button type="button" style={linkBtn} onClick={() => patch({ action: 'goto', step })} disabled={busy}>Edit</button>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
      <Card>
        <div style={{ padding: '12px 14px 6px', fontSize: 12, color: INK2, letterSpacing: '.06em' }}>{view.propertyName.toUpperCase()}{view.unit ? ` · UNIT ${view.unit}` : ''}</div>
        <Sum l="You" v={`${view.firstName ?? ''} ${view.lastName ?? ''}`.trim()} step="details" />
        <Sum l="Photo" v={view.hasPhoto ? 'Added' : 'Skipped — add it later in the app'} step="photo" />
        <Sum l={`Access · ${included.length + 1} ${included.length ? 'people' : 'person'}`} v={['You', ...included.map((h) => h.first_name ?? '')].join(', ')} step="access" />
        <Sum l="Vehicles" v={view.vehicles.length ? view.vehicles.map((c) => c.plate).join(', ') : 'None'} step="access" />
      </Card>

      <Card>
        <div style={{ padding: '6px 14px' }}>
          {q.lines.map((l, i) => <Line key={i} l={l.label} r={money(l.cents)} />)}
          {q.lines.length === 0 && <Line l="Parking & access" r="Included" />}
          <div style={{ borderTop: '1px solid rgba(0,0,0,.08)', marginTop: 4 }} />
          <Line l="Due today" r={money(q.dueCents)} bold />
        </div>
        {view.fee.paidBy === 'property_collects' && (
          <div style={{ padding: '0 14px 12px', fontSize: 13, color: INK2 }}>Your community adds this fee to your lease charges. Nothing to pay here.</div>
        )}
      </Card>

      {residentPays && q.grossCents > 0 && (
        view.code ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14 }}>
            <span style={{ color: '#1E8E3E', fontWeight: 600 }}>Code {view.code} applied</span>
            <button type="button" style={linkBtn} onClick={() => patch({ action: 'remove_code' })} disabled={busy}>Remove</button>
          </div>
        ) : showCode ? (
          <form style={{ display: 'flex', gap: 10 }} onSubmit={async (e) => { e.preventDefault(); if (await patch({ action: 'code', code })) setShowCode(false) }}>
            <input placeholder="Redemption code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoCapitalize="characters" style={input} />
            <button type="submit" style={{ ...btn, width: 110 }} disabled={busy || !code.trim()}>Apply</button>
          </form>
        ) : (
          <button type="button" style={{ ...linkBtn, alignSelf: 'flex-start' }} onClick={() => setShowCode(true)}>Have a redemption code?</button>
        )
      )}

      <button type="button" style={{ ...btn, ...btnPri, marginTop: 4 }} onClick={finish} disabled={busy}>
        {busy ? 'One moment…' : q.dueCents > 0 ? `Pay ${money(q.dueCents)}` : 'Finish setup'}
      </button>
      {q.dueCents > 0 && <p style={{ ...sub, fontSize: 12, margin: 0 }}>Secure checkout by Stripe · card, Apple Pay or Google Pay · covers {view.fee.termMonths} months · no refunds.</p>}
      <button type="button" onClick={() => patch({ action: 'goto', step: 'services' })} disabled={busy} style={{ ...linkBtn, color: INK2, alignSelf: 'center' }}>‹ Back</button>
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return <div style={{ width: '100%', border: '1px solid rgba(0,0,0,.08)', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>{children}</div>
}

function PersonRow({ name, detail, right }: { name: string; detail?: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 60, padding: '10px 14px', boxSizing: 'border-box' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 16 }}>{name}</div>
        {detail && <div style={{ color: INK2, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detail}</div>}
      </div>
      {right}
    </div>
  )
}

function Toggle({ on, onClick, label: l }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={l} onClick={onClick}
      style={{ width: 51, height: 31, borderRadius: 16, border: 0, padding: 0, background: on ? '#34C759' : '#E5E5EA', position: 'relative', cursor: 'pointer', flex: 'none' }}>
      <span style={{ position: 'absolute', top: 2, left: on ? 22 : 2, width: 27, height: 27, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)', transition: 'left .2s' }} />
    </button>
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
const linkBtn: React.CSSProperties = { background: 'none', border: 0, color: BLUE, fontWeight: 600, fontSize: 14, minHeight: 44, cursor: 'pointer', fontFamily: FONT }
const roundBtn: React.CSSProperties = { width: 44, height: 44, borderRadius: 22, border: '1px solid rgba(0,0,0,.12)', background: '#fff', fontSize: 22, lineHeight: '20px', color: INK, cursor: 'pointer', flex: 'none' }
const btnPri: React.CSSProperties = { background: BLUE, borderColor: BLUE, color: '#fff' }
