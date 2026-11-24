'use client'

/**
 * ResidentsClient — property portal → Residents. The real people with access at
 * this property, straight from its Brivo account (/api/portal/[slug]/users):
 * search, filter by access group, open a person to see their PINs / passes / fobs
 * and change them, add a resident. Viewing = portal access code; every change =
 * the manager's personal PIN (names a person, logged in site_events).
 * (Replaced the sample move-in / compliance / concession screen, Nov 23 2026.)
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { OpsShell, useOpsManager, C } from '@/components/portal/ops/OpsShell'
import { OK_CSS, Sheet, Dot, DOT, useToast, call, when, type Any } from '@/components/portal/ops/opsKit'

type Person = { id: string; firstName: string; lastName: string; email: string | null; phone: string | null; unitNumber: string | null; active: boolean; groupIds: string[]; groupNames: string[] }
type Group = { id: string; name: string }
const nameOf = (p: Person) => `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || 'No name'

function Inner({ slug }: { slug: string }) {
  const { manager, requireSignIn } = useOpsManager()
  const [toast, flash] = useToast()
  const [people, setPeople] = useState<Person[] | null>(null)
  const [groups, setGroups] = useState<Group[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [group, setGroup] = useState<string>('all')
  const [show, setShow] = useState<'active' | 'off' | 'all'>('active')
  const [open, setOpen] = useState<Person | null>(null)
  const [adding, setAdding] = useState(false)
  const [lastUsed, setLastUsed] = useState<Record<string, string> | null>(null)

  const load = useCallback(async () => {
    const r = await call(`/api/portal/${slug}/users?groups=1`)
    setPeople(Array.isArray(r.data.users) ? r.data.users : [])
    setGroups(Array.isArray(r.data.groups) ? r.data.groups : [])
    setLastUsed(r.data.last_used && typeof r.data.last_used === 'object' ? r.data.last_used : null)
    setErr(r.ok ? (r.data.needs_site_id ? 'This property’s Brivo site isn’t set yet — ask Gate Guard to finish its setup.' : null) : (r.data.error || 'Could not load residents from Brivo.'))
  }, [slug])
  useEffect(() => { void load() }, [load])

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (people ?? [])
      .filter(p => show === 'all' || (show === 'active' ? p.active !== false : p.active === false))
      .filter(p => group === 'all' || (p.groupIds ?? []).includes(group))
      .filter(p => !s || [nameOf(p), p.email ?? '', p.phone ?? '', p.unitNumber ?? ''].some(f => f.toLowerCase().includes(s)))
      .sort((a, b) => (a.unitNumber ?? '').localeCompare(b.unitNumber ?? '', undefined, { numeric: true }) || nameOf(a).localeCompare(nameOf(b)))
  }, [people, q, group, show])

  const total = people?.length ?? 0
  const active = (people ?? []).filter(p => p.active !== false).length
  const units = new Set((people ?? []).map(p => p.unitNumber).filter(Boolean)).size

  return (
    <div className="ok-wrap">
      <style dangerouslySetInnerHTML={{ __html: OK_CSS }} />
      <div className="ok-kpis">
        <div className="ok-kpi"><div className="ok-k"><Dot c={DOT.blue} />People</div><div className="ok-num">{people ? total : '—'}</div><div className="ok-s">In Brivo for this property</div></div>
        <div className="ok-kpi"><div className="ok-k"><Dot c={DOT.green} />Access on</div><div className="ok-num">{people ? active : '—'}</div><div className="ok-s">{people ? `${total - active} turned off` : ' '}</div></div>
        <div className="ok-kpi"><div className="ok-k"><Dot c={DOT.gray} />Units</div><div className="ok-num">{people ? units : '—'}</div><div className="ok-s">With at least one person</div></div>
        <div className="ok-kpi"><div className="ok-k"><Dot c={DOT.blue} />Access groups</div><div className="ok-num">{people ? groups.length : '—'}</div><div className="ok-s">What each person can open</div></div>
      </div>

      <div className="ok-card">
        <div className="ok-hd">
          <div><h3>Residents</h3><div className="sub">Live from Brivo. Open a person to add a gate PIN, send a mobile pass or turn access off.</div></div>
          <button type="button" className="ok-btn pri" onClick={() => manager ? setAdding(true) : requireSignIn()}>+ Add resident</button>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
          <input className="ok-in" style={{ maxWidth: 320 }} placeholder="Search name, unit, email or phone" value={q} onChange={e => setQ(e.target.value)} aria-label="Search residents" />
          <div className="ok-seg" role="group" aria-label="Show">
            {(['active', 'off', 'all'] as const).map(k => <button key={k} type="button" aria-pressed={show === k} onClick={() => setShow(k)}>{k === 'active' ? 'Access on' : k === 'off' ? 'Turned off' : 'Everyone'}</button>)}
          </div>
          {groups.length > 0 && (
            <select className="ok-in" style={{ maxWidth: 240 }} value={group} onChange={e => setGroup(e.target.value)} aria-label="Access group">
              <option value="all">All access groups</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          )}
        </div>
        {err && <div className="ok-note red" role="alert">{err}</div>}
        {!people ? <div className="ok-empty">Loading residents from Brivo…</div> : !list.length ? (
          <div className="ok-empty">{total ? 'Nobody matches that search.' : 'No residents in Brivo yet. Use “Add resident”.'}</div>
        ) : (
          <div className="ok-tw">
            <table className="ok-tbl">
              <thead><tr><th>Unit</th><th>Name</th><th>Contact</th><th>Access groups</th>{lastUsed && <th title="Last time they used a door or gate (last 30 days)">Last used</th>}<th>Status</th></tr></thead>
              <tbody>
                {list.map(p => (
                  <tr key={p.id} className="click" onClick={() => setOpen(p)} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') setOpen(p) }}>
                    <td style={{ fontWeight: 600 }}>{p.unitNumber || '—'}</td>
                    <td>{nameOf(p)}</td>
                    <td style={{ color: C.ink3 }}>{[p.email, p.phone].filter(Boolean).join(' · ') || '—'}</td>
                    <td style={{ color: C.ink2 }}>{(p.groupNames ?? []).join(', ') || '—'}</td>
                    {lastUsed && <td style={{ color: lastUsed[p.id] ? C.ink2 : C.ink3, whiteSpace: 'nowrap' }}>{lastUsed[p.id] ? when(lastUsed[p.id]) : 'Not in 30 days'}</td>}
                    <td><span className="ok-pill"><Dot c={p.active !== false ? DOT.green : DOT.gray} />{p.active !== false ? 'On' : 'Off'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!manager && <div style={{ fontSize: 12.5, color: C.ink3, marginTop: 10 }}>Sign in with your personal PIN to add people or change their access.</div>}
      </div>

      {open && <PersonSheet slug={slug} person={open} groups={groups} onClose={() => setOpen(null)} onChanged={load} flash={flash} />}
      {adding && <AddSheet slug={slug} groups={groups} onClose={() => setAdding(false)} onDone={() => { setAdding(false); void load() }} flash={flash} />}
      {toast}
    </div>
  )
}

function PersonSheet({ slug, person, groups, onClose, onChanged, flash }: { slug: string; person: Person; groups: Group[]; onClose: () => void; onChanged: () => void; flash: (t: string, ok?: boolean) => void }) {
  const { manager, requireSignIn } = useOpsManager()
  const [d, setD] = useState<Any | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState<'pin' | 'fob' | null>(null)
  const [pin, setPin] = useState('')
  const [card, setCard] = useState(''); const [fc, setFc] = useState('')
  const url = `/api/portal/${slug}/users/${person.id}`
  const load = useCallback(async () => {
    const r = await call(url)
    if (!r.ok) { setErr(r.data.error || 'Could not load this person.'); return }
    setD(r.data); setErr(null)
  }, [url])
  useEffect(() => { void load() }, [load])

  async function act(body: Any) {
    if (!manager) { requireSignIn(); return }
    setBusy(true)
    const r = await call(url, { method: 'POST', body: JSON.stringify({ ...body, name: nameOf(person), email: person.email }) })
    setBusy(false)
    if (!r.ok) { if (r.data.need_manager) requireSignIn(); flash(r.data.error || 'That didn’t work.', false); return }
    flash(r.data.summary || 'Done.'); setForm(null); setPin(''); setCard(''); setFc('')
    void load(); onChanged()
  }
  const inGroup = new Set((d?.groups ?? []).map((g: Any) => g.id))
  const creds: Any[] = d?.credentials ?? []
  const off = d?.suspended === true

  return (
    <Sheet title={nameOf(person)} sub={[person.unitNumber ? `Unit ${person.unitNumber}` : null, person.email, person.phone].filter(Boolean).join(' · ') || undefined} onClose={onClose} width={600}>
      {err && <div className="ok-note red">{err}</div>}
      {!d && !err ? <div className="ok-empty">Loading…</div> : d && (
        <>
          {off && <div className="ok-note orange">This person’s access is turned off. Nothing they carry opens a gate or door.</div>}
          <div>
            <div className="ok-hd" style={{ marginBottom: 4 }}>
              <h3 style={{ margin: 0, fontSize: 15 }}>How they get in</h3>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button type="button" className="ok-btn sm" disabled={busy} onClick={() => manager ? setForm(form === 'pin' ? null : 'pin') : requireSignIn()}>+ Gate PIN</button>
                <button type="button" className="ok-btn sm" disabled={busy || !person.email} title={person.email ? undefined : 'Needs an email in Brivo'} onClick={() => void act({ action: 'mobile_pass' })}>Send mobile pass</button>
                <button type="button" className="ok-btn sm" disabled={busy} onClick={() => manager ? setForm(form === 'fob' ? null : 'fob') : requireSignIn()}>+ Fob</button>
              </div>
            </div>
            {form === 'pin' && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', margin: '8px 0' }}>
                <label style={{ flex: '0 1 200px' }}><span className="ok-lbl">Gate PIN (4–8 digits)</span><input className="ok-in" inputMode="numeric" autoComplete="off" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} /></label>
                <button type="button" className="ok-btn pri" disabled={busy || !/^\d{4,8}$/.test(pin)} onClick={() => void act({ action: 'set_pin', pin })}>Add PIN</button>
              </div>
            )}
            {form === 'fob' && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', margin: '8px 0' }}>
                <label style={{ flex: '1 1 160px' }}><span className="ok-lbl">Card / fob number</span><input className="ok-in" value={card} onChange={e => setCard(e.target.value.trim())} /></label>
                <label style={{ flex: '0 1 140px' }}><span className="ok-lbl">Facility code (optional)</span><input className="ok-in" value={fc} onChange={e => setFc(e.target.value.trim())} /></label>
                <button type="button" className="ok-btn pri" disabled={busy || !card} onClick={() => void act({ action: 'add_fob', card_number: card, facility_code: fc || null })}>Add fob</button>
              </div>
            )}
            {!creds.length ? <div className="ok-empty">No PIN, pass or fob yet.</div> : creds.map(c => (
              <div key={c.id} className="ok-row">
                <div className="main"><div className="t">{c.isPass ? 'Mobile pass' : c.label}</div><div className="m">{c.type}</div></div>
                <span className="ok-pill"><Dot c={c.active ? DOT.green : DOT.gray} />{c.active ? 'On' : 'Off'}</span>
                <button type="button" className={`ok-btn sm${c.active ? ' warn' : ''}`} disabled={busy} onClick={() => void act({ action: c.active ? 'credential_off' : 'credential_on', credential_id: c.id })}>{c.active ? 'Turn off' : 'Turn on'}</button>
              </div>
            ))}
            <div style={{ fontSize: 12, color: C.ink3, marginTop: 6 }}>For safety we never show a PIN once it’s set. To change one, turn the old PIN off and add a new one.</div>
          </div>

          {groups.length > 0 && (
            <div>
              <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>What they can open</h3>
              <div className="ok-chips">
                {groups.map(g => {
                  const on = inGroup.has(g.id)
                  return <button key={g.id} type="button" className="ok-chip" aria-pressed={on} disabled={busy} onClick={() => void act({ action: on ? 'remove_group' : 'add_group', group_id: g.id, group_name: g.name })}>{g.name}</button>
                })}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" className={`ok-btn${off ? ' go' : ' warn'}`} disabled={busy} onClick={() => void act({ action: off ? 'reactivate' : 'suspend' })}>{off ? 'Turn access back on' : 'Turn off all access'}</button>
          </div>
        </>
      )}
    </Sheet>
  )
}

function AddSheet({ slug, groups, onClose, onDone, flash }: { slug: string; groups: Group[]; onClose: () => void; onDone: () => void; flash: (t: string, ok?: boolean) => void }) {
  const { requireSignIn } = useOpsManager()
  const [f, setF] = useState({ firstName: '', lastName: '', unit: '', email: '', phone: '', groupId: groups.length === 1 ? groups[0].id : '', pin: '', mobilePass: true, fob: '' })
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof f, v: string | boolean) => setF(x => ({ ...x, [k]: v }))
  const pinBad = !!f.pin && !/^\d{4,8}$/.test(f.pin)
  async function save() {
    setBusy(true)
    const r = await call(`/api/portal/${slug}/users`, { method: 'POST', body: JSON.stringify({
      firstName: f.firstName, lastName: f.lastName, unit: f.unit || null, email: f.email || null, phone: f.phone || null,
      groupId: f.groupId || null, pin: f.pin || null, mobilePass: f.mobilePass && !!f.email, fobCardNumber: f.fob || null,
    }) })
    setBusy(false)
    if (!r.ok) { if (r.data.need_manager) requireSignIn(); flash(r.data.error || 'Could not add them.', false); return }
    const failed = Object.entries((r.data.credentials ?? {}) as Record<string, string>).filter(([, v]) => v.startsWith('failed'))
    flash(failed.length ? `Added — but ${failed.map(([k]) => k.replace('_', ' ')).join(', ')} didn’t go through. Open them to try again.` : `${f.firstName} added.`, !failed.length)
    onDone()
  }
  return (
    <Sheet title="Add a resident" sub="They’re added to this property’s Brivo account." onClose={onClose} width={600}>
      <div className="ok-grid2">
        <label><span className="ok-lbl">First name</span><input className="ok-in" value={f.firstName} onChange={e => set('firstName', e.target.value)} autoFocus /></label>
        <label><span className="ok-lbl">Last name</span><input className="ok-in" value={f.lastName} onChange={e => set('lastName', e.target.value)} /></label>
        <label><span className="ok-lbl">Unit</span><input className="ok-in" value={f.unit} onChange={e => set('unit', e.target.value)} /></label>
        <label><span className="ok-lbl">Access group</span>
          <select className="ok-in" value={f.groupId} onChange={e => set('groupId', e.target.value)}>
            <option value="">{groups.length ? 'Pick what they can open' : 'No groups found'}</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </label>
        <label><span className="ok-lbl">Email</span><input className="ok-in" type="email" value={f.email} onChange={e => set('email', e.target.value)} /></label>
        <label><span className="ok-lbl">Phone</span><input className="ok-in" type="tel" value={f.phone} onChange={e => set('phone', e.target.value)} /></label>
      </div>
      <div className="ok-grid2">
        <label><span className="ok-lbl">Gate PIN (optional, 4–8 digits)</span><input className="ok-in" inputMode="numeric" autoComplete="off" value={f.pin} onChange={e => set('pin', e.target.value.replace(/\D/g, ''))} /></label>
        <label><span className="ok-lbl">Fob number (optional)</span><input className="ok-in" value={f.fob} onChange={e => set('fob', e.target.value.trim())} /></label>
      </div>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13.5 }}>
        <input type="checkbox" checked={f.mobilePass && !!f.email} disabled={!f.email} onChange={e => set('mobilePass', e.target.checked)} />
        Email them a Brivo mobile pass {f.email ? '' : '(needs an email)'}
      </label>
      {!f.groupId && <div className="ok-note orange">Without an access group they won’t be able to open anything yet.</div>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="ok-btn" onClick={onClose}>Cancel</button>
        <button type="button" className="ok-btn pri" disabled={busy || !f.firstName.trim() || !f.lastName.trim() || pinBad} onClick={() => void save()}>{busy ? 'Adding…' : 'Add resident'}</button>
      </div>
    </Sheet>
  )
}

export default function ResidentsClient({ slug, displayName }: { slug: string; displayName: string }) {
  return <OpsShell slug={slug} displayName={displayName} active="residents"><Inner slug={slug} /></OpsShell>
}
