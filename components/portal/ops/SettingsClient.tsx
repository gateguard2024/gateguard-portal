'use client'

/**
 * SettingsClient — property portal → Settings → Managers. The people who can
 * CONTROL this portal (open gates, lockdown, packages, residents…) with their own
 * personal PIN. Gate Guard adds the first manager; after that managers add and
 * manage each other here. API /api/portal/[slug]/managers (signed-in manager only).
 * Nobody can turn off or remove themselves.
 */
import { useCallback, useEffect, useState } from 'react'
import { OpsShell, useOpsManager, C } from '@/components/portal/ops/OpsShell'
import { OK_CSS, Sheet, Dot, DOT, call, day, useToast, type Any } from '@/components/portal/ops/opsKit'

const onlyDigits = (s: string) => s.replace(/\D/g, '').slice(0, 8)

function PinField({ value, onChange, label = 'Personal PIN (4–8 digits)' }: { value: string; onChange: (v: string) => void; label?: string }) {
  return <label><span className="ok-lbl">{label}</span><input className="ok-in" inputMode="numeric" autoComplete="new-password" type="password" value={value} onChange={e => onChange(onlyDigits(e.target.value))} /></label>
}

function AddSheet({ slug, onClose, onDone }: { slug: string; onClose: () => void; onDone: (name: string) => void }) {
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [pin, setPin] = useState(''); const [pin2, setPin2] = useState('')
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false)
  const save = async () => {
    if (!name.trim()) return setErr('Enter their name.')
    if (pin.length < 4) return setErr('The PIN must be 4 to 8 digits.')
    if (pin !== pin2) return setErr('The two PINs don’t match.')
    setBusy(true); setErr(null)
    const r = await call(`/api/portal/${slug}/managers`, { method: 'POST', body: JSON.stringify({ name, email: email || null, pin }) })
    setBusy(false)
    if (!r.ok) return setErr(r.data.error || 'Could not add them.')
    onDone(name.trim())
  }
  return (
    <Sheet title="Add a manager" sub="They sign in with this PIN to open gates, lock down, and manage residents and packages." onClose={onClose}>
      <label><span className="ok-lbl">Name</span><input className="ok-in" value={name} onChange={e => setName(e.target.value)} autoFocus /></label>
      <label><span className="ok-lbl">Email (optional)</span><input className="ok-in" type="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
      <PinField value={pin} onChange={setPin} />
      <PinField value={pin2} onChange={setPin2} label="Type the PIN again" />
      <div className="ok-note">Give them the PIN in person or by phone. Each person needs their own — it shows who did what.</div>
      {err && <div className="ok-note red">{err}</div>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="ok-btn" onClick={onClose}>Cancel</button>
        <button type="button" className="ok-btn pri" onClick={save} disabled={busy}>{busy ? 'Adding…' : 'Add manager'}</button>
      </div>
    </Sheet>
  )
}

function PersonSheet({ slug, m, isMe, onClose, onDone }: { slug: string; m: Any; isMe: boolean; onClose: () => void; onDone: (msg: string, gone?: boolean) => void }) {
  const [name, setName] = useState(m.name ?? ''); const [email, setEmail] = useState(m.email ?? '')
  const [pin, setPin] = useState(''); const [pin2, setPin2] = useState('')
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [sure, setSure] = useState(false)
  const patch = async (body: Any, msg: string) => {
    setBusy(true); setErr(null)
    const r = await call(`/api/portal/${slug}/managers`, { method: 'PATCH', body: JSON.stringify({ manager_id: m.id, ...body }) })
    setBusy(false)
    if (!r.ok) return setErr(r.data.error || 'Could not save.')
    onDone(msg)
  }
  const saveDetails = () => { if (!name.trim()) return setErr('Name can’t be blank.'); void patch({ name, email: email || null }, 'Saved') }
  const savePin = () => { if (pin.length < 4) return setErr('The PIN must be 4 to 8 digits.'); if (pin !== pin2) return setErr('The two PINs don’t match.'); void patch({ pin }, isMe ? 'Your PIN is changed' : `New PIN set for ${m.name}`) }
  const remove = async () => {
    setBusy(true); setErr(null)
    const r = await call(`/api/portal/${slug}/managers`, { method: 'DELETE', body: JSON.stringify({ manager_id: m.id }) })
    setBusy(false)
    if (!r.ok) return setErr(r.data.error || 'Could not remove them.')
    onDone(`${m.name} removed`, true)
  }
  return (
    <Sheet title={isMe ? `${m.name} (you)` : m.name} sub={`Added ${day(m.created_at)}${m.created_by ? ` by ${m.created_by}` : ''}`} onClose={onClose}>
      <label><span className="ok-lbl">Name</span><input className="ok-in" value={name} onChange={e => setName(e.target.value)} /></label>
      <label><span className="ok-lbl">Email</span><input className="ok-in" type="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button type="button" className="ok-btn" onClick={saveDetails} disabled={busy}>Save details</button></div>

      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, display: 'grid', gap: 10 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{isMe ? 'Change my PIN' : 'Give a new PIN'}</div>
        <PinField value={pin} onChange={setPin} label="New PIN (4–8 digits)" />
        <PinField value={pin2} onChange={setPin2} label="Type it again" />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button type="button" className="ok-btn pri" onClick={savePin} disabled={busy}>Set PIN</button></div>
      </div>

      {!isMe && (
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" className="ok-btn" onClick={() => patch({ active: !m.active }, m.active ? `${m.name} turned off` : `${m.name} turned on`)} disabled={busy}>{m.active ? 'Turn off (can’t sign in)' : 'Turn back on'}</button>
          <div style={{ flex: 1 }} />
          {!sure ? <button type="button" className="ok-btn" style={{ color: C.alert }} onClick={() => setSure(true)} disabled={busy}>Remove…</button>
            : <><span style={{ fontSize: 13, color: C.ink2 }}>Remove {m.name} for good?</span><button type="button" className="ok-btn" onClick={() => setSure(false)}>No</button><button type="button" className="ok-btn" style={{ background: C.alert, borderColor: C.alert, color: '#fff' }} onClick={remove} disabled={busy}>Remove</button></>}
        </div>
      )}
      {err && <div className="ok-note red">{err}</div>}
    </Sheet>
  )
}

function Inner({ slug }: { slug: string }) {
  const { manager, requireSignIn } = useOpsManager()
  const [d, setD] = useState<Any | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [open, setOpen] = useState<Any | null>(null)
  const [toast, show] = useToast()
  const load = useCallback(async () => {
    if (!manager) { setD(null); return }
    const r = await call(`/api/portal/${slug}/managers`)
    setD(r.ok ? r.data : null); setErr(r.ok ? null : (r.data.error || 'Could not load managers.'))
  }, [slug, manager])
  useEffect(() => { void load() }, [load])

  const meId = d?.me?.id
  const list: Any[] = d?.managers ?? []
  return (
    <div className="ok-wrap">
      <style dangerouslySetInnerHTML={{ __html: OK_CSS }} />
      <div className="ok-card">
        <div className="ok-hd">
          <div><h3>Managers</h3><div className="sub">People who can open gates, lock down the site, and manage residents and packages — each with their own PIN.</div></div>
          {manager && <button type="button" className="ok-btn pri" onClick={() => setAdding(true)}>Add a manager</button>}
        </div>
        {!manager ? (
          <div className="ok-empty" style={{ display: 'grid', gap: 10, justifyItems: 'center' }}>
            <div>Sign in with your personal PIN to see and add managers.</div>
            <button type="button" className="ok-btn pri" onClick={requireSignIn}>Sign in</button>
          </div>
        ) : err ? <div className="ok-note red">{err}</div> : !d ? <div className="ok-empty">Loading…</div> : (
          <div className="ok-tw"><table className="ok-tbl">
            <thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Added</th><th /></tr></thead>
            <tbody>{list.map(m => (
              <tr key={m.id} className="click" tabIndex={0} onClick={() => setOpen(m)} onKeyDown={e => { if (e.key === 'Enter') setOpen(m) }}>
                <td style={{ fontWeight: 600 }}>{m.name}{m.id === meId ? <span style={{ color: C.ink3, fontWeight: 400 }}> · you</span> : null}</td>
                <td style={{ color: C.ink2 }}>{m.email || '—'}</td>
                <td><span className="ok-pill"><Dot c={m.active ? DOT.green : DOT.gray} />{m.active ? 'Can sign in' : 'Turned off'}</span></td>
                <td style={{ color: C.ink3 }}>{day(m.created_at)}</td>
                <td style={{ textAlign: 'right' }}><span className="ok-btn sm">{m.id === meId ? 'My PIN' : 'Manage'}</span></td>
              </tr>))}</tbody>
          </table></div>
        )}
        <div style={{ fontSize: 12.5, color: C.ink3, marginTop: 10 }}>Forgot your PIN? Ask another manager to set a new one, or call Gate Guard.</div>
      </div>
      {adding && <AddSheet slug={slug} onClose={() => setAdding(false)} onDone={n => { setAdding(false); show(`${n} added — they can sign in now`); void load() }} />}
      {open && <PersonSheet slug={slug} m={open} isMe={open.id === meId} onClose={() => setOpen(null)} onDone={msg => { setOpen(null); show(msg); void load() }} />}
      {toast}
    </div>
  )
}

export default function SettingsClient({ slug, displayName }: { slug: string; displayName: string }) {
  return <OpsShell slug={slug} displayName={displayName} active="settings"><Inner slug={slug} /></OpsShell>
}
