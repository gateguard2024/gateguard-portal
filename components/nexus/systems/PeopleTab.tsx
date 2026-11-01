'use client'
/**
 * Systems → People: Brivo residents & admins (search, new user, group, mobile
 * pass send/revoke, suspend), a full user card (edit, groups, credentials incl.
 * fobs, recent activity) and time-boxed visitor passes.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { type Any, Card, Dot, DOT, Field, GREEN, MUTED, Note, NotConnected, RED, Sheet, fmtWhen, getJson, send, type SiteCtx } from './shared'

const nameOf = (u: Any) => (u.name ?? `${u.firstName ?? ''} ${u.lastName ?? ''}`).trim() || u.email || 'User'

export function PeopleTab({ ctx, onActivity, guestRequest }: { ctx: SiteCtx; onActivity: (who: string) => void; guestRequest?: number }) {
  const { siteId, isCorporate, notify, openSetup } = ctx
  const [data, setData] = useState<{ users: Any[]; groups: Any[] } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState('')
  const [creating, setCreating] = useState(false)
  const [guest, setGuest] = useState(false)
  const [card, setCard] = useState<string | null>(null)

  const load = useCallback(async () => {
    const r = await getJson(`/api/brivo/users?site_id=${siteId}&groups=1`)
    setData({ users: Array.isArray(r.data.users) ? r.data.users : [], groups: Array.isArray(r.data.groups) ? r.data.groups : [] })
    setErr(r.data.error ? String(r.data.error) : r.ok ? null : 'Couldn’t load people from Brivo.')
  }, [siteId])
  useEffect(() => { void load() }, [load])
  // "Visitor pass" quick action.
  useEffect(() => { if (guestRequest) setGuest(true) }, [guestRequest])

  async function act(u: Any, action: 'resend-pass' | 'revoke-pass' | 'suspend', extra?: Any) {
    const q2: Any = { 'resend-pass': `Send a Mobile Pass invite to ${nameOf(u)}?`, 'revoke-pass': `Turn off ${nameOf(u)}’s Mobile Pass?`, suspend: `${extra?.suspended ? 'Suspend' : 'Reactivate'} ${nameOf(u)}?${extra?.suspended ? ' They lose all access.' : ''}` }
    if (!window.confirm(q2[action])) return
    setBusy(`${u.id}:${action}`)
    const url = action === 'suspend' ? `/api/brivo/users/${u.id}/suspend` : `/api/brivo/users/${u.id}/${action}`
    const r = await send(url, 'POST', { site_id: siteId, email: u.email ?? null, name: nameOf(u), ...extra })
    setBusy('')
    if (!r.ok) { notify(r.data.error || 'Didn’t work.', false); return }
    notify(action === 'resend-pass' ? `Pass sent to ${nameOf(u)}.` : action === 'revoke-pass' ? `Pass turned off for ${nameOf(u)}.` : `${nameOf(u)} ${extra?.suspended ? 'suspended' : 'reactivated'}.`)
    void load()
  }

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    const all = data?.users ?? []
    return (t ? all.filter(u => `${nameOf(u)} ${u.email ?? ''} ${u.phone ?? ''} ${u.unitNumber ?? ''} ${(u.groupNames ?? []).join(' ')}`.toLowerCase().includes(t)) : all).slice(0, 150)
  }, [data, q])

  const notConnected = err && !(data?.users.length) && /no brivo login|outside your access|not connected/i.test(err)
  const noAccess = err && /no door access/i.test(err)

  return (
    <div className="sy-stack">
      <Card title={`Residents & admins${data?.users.length ? ` (${data.users.length})` : ''}`} sub="From Brivo. Tap a name for their card."
        right={data && !notConnected && !noAccess ? <div className="sy-acts"><button type="button" className="sy-b line sm" onClick={() => setGuest(true)}>Visitor pass</button><button type="button" className="sy-b pri sm" onClick={() => setCreating(true)}>New person</button></div> : undefined}>
        {data == null ? <div className="sy-empty">Loading people…</div>
          : noAccess ? <Note>You don’t have door access at this property, so its people are hidden.</Note>
          : notConnected ? <NotConnected what="Brivo (access control)" isCorporate={isCorporate} onSetup={openSetup} />
          : err && !data.users.length ? <Note tone="orange">People can’t be listed right now: {err}</Note>
          : <>
            <input className="sy-in" value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, email, unit, group" aria-label="Search people" style={{ marginBottom: 6 }} />
            {!shown.length ? <div className="sy-empty">No one matches.</div> : <div className="sy-feed">{shown.map(u => {
              const off = u.active === false
              return (
                <div key={u.id} className="sy-row" style={{ flexWrap: 'wrap' }}>
                  <div className="main" style={{ minWidth: 180 }}>
                    <button type="button" onClick={() => setCard(String(u.id))} style={{ border: 0, background: 'none', padding: 0, font: 'inherit', fontSize: 14, fontWeight: 500, color: 'inherit', cursor: 'pointer', textAlign: 'left' }}>{nameOf(u)}</button>
                    {off && <span className="sy-pill" style={{ marginLeft: 8, color: RED }}>Suspended</span>}
                    <div className="m">{[u.email ?? 'No email', u.phone, u.unitNumber ? `Unit ${u.unitNumber}` : null, (u.groupNames ?? []).slice(0, 2).join(', ')].filter(Boolean).join(' · ')}</div>
                  </div>
                  <button type="button" className="sy-b line sm" onClick={() => act(u, 'resend-pass')} disabled={!!busy}>Send pass</button>
                  <button type="button" className="sy-b line sm" onClick={() => act(u, 'suspend', { suspended: !off })} disabled={!!busy} style={{ color: off ? GREEN : RED }}>{off ? 'Reactivate' : 'Suspend'}</button>
                  <button type="button" className="sy-b line sm" onClick={() => setCard(String(u.id))}>Open</button>
                </div>
              )
            })}</div>}
            {(data.users.length > shown.length) && <div className="sy-empty">Showing {shown.length} of {data.users.length} — search to narrow down.</div>}
          </>}
      </Card>

      {creating && data && <NewPerson ctx={ctx} groups={data.groups} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); void load() }} />}
      {guest && <VisitorPass ctx={ctx} groups={data?.groups ?? []} onClose={() => setGuest(false)} onSaved={() => { setGuest(false); void load() }} />}
      {card && data && <UserCard ctx={ctx} userId={card} listUser={data.users.find(u => String(u.id) === card)} groups={data.groups} onClose={() => setCard(null)} onChanged={() => void load()} onActivity={n => { setCard(null); onActivity(n) }} onRevokePass={u => act(u, 'revoke-pass')} />}
    </div>
  )
}

function NewPerson({ ctx, groups, onClose, onSaved }: { ctx: SiteCtx; groups: Any[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ firstName: '', lastName: '', email: '', unit: '', groupId: '' })
  const [busy, setBusy] = useState(false)
  async function save() {
    if (!f.firstName.trim() || !f.lastName.trim()) { ctx.notify('First and last name are required.', false); return }
    setBusy(true)
    const r = await send('/api/brivo/users', 'POST', { site_id: ctx.siteId, firstName: f.firstName.trim(), lastName: f.lastName.trim(), email: f.email.trim() || null, unit: f.unit.trim() || null, groupId: f.groupId || null })
    setBusy(false)
    if (!r.ok) { ctx.notify(r.data.error || 'Couldn’t create them in Brivo.', false); return }
    ctx.notify(`${f.firstName} ${f.lastName} added.`); onSaved()
  }
  return (
    <Sheet title="New person" sub="Creates them in Brivo. Add an email so you can send a Mobile Pass." onClose={onClose} width={480}>
      <div className="sy-grid2" style={{ gap: 10 }}>
        <Field label="First name"><input className="sy-in" value={f.firstName} onChange={e => setF({ ...f, firstName: e.target.value })} /></Field>
        <Field label="Last name"><input className="sy-in" value={f.lastName} onChange={e => setF({ ...f, lastName: e.target.value })} /></Field>
        <Field label="Email"><input className="sy-in" type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Unit"><input className="sy-in" value={f.unit} onChange={e => setF({ ...f, unit: e.target.value })} /></Field>
      </div>
      <Field label="Access group"><select className="sy-in" value={f.groupId} onChange={e => setF({ ...f, groupId: e.target.value })}><option value="">No group</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></Field>
      <button type="button" className="sy-b pri" onClick={save} disabled={busy}>{busy ? 'Adding…' : 'Add person'}</button>
    </Sheet>
  )
}

function VisitorPass({ ctx, groups, onClose, onSaved }: { ctx: SiteCtx; groups: Any[]; onClose: () => void; onSaved: () => void }) {
  const [g, setG] = useState({ firstName: '', lastName: '', email: '', from: '', to: '', groupId: '' })
  const [busy, setBusy] = useState(false)
  async function issue() {
    if (!g.firstName.trim() || !g.lastName.trim() || !g.email.trim()) { ctx.notify('Name and email are required.', false); return }
    if (g.from && g.to && new Date(g.to) <= new Date(g.from)) { ctx.notify('“Until” has to be after “From”.', false); return }
    setBusy(true)
    const r = await send('/api/brivo/guests', 'POST', { site_id: ctx.siteId, firstName: g.firstName.trim(), lastName: g.lastName.trim(), email: g.email.trim(), from: g.from ? new Date(g.from).toISOString() : null, to: g.to ? new Date(g.to).toISOString() : null, group_id: g.groupId || null })
    setBusy(false)
    if (!r.ok) { ctx.notify(r.data.error || 'Couldn’t send the pass.', false); return }
    ctx.notify(`Visitor pass sent to ${g.firstName}.`); onSaved()
  }
  return (
    <Sheet title="Visitor pass" sub="Emails a Brivo Mobile Pass that only works between these times." onClose={onClose} width={480}>
      <div className="sy-grid2" style={{ gap: 10 }}>
        <Field label="First name"><input className="sy-in" value={g.firstName} onChange={e => setG({ ...g, firstName: e.target.value })} /></Field>
        <Field label="Last name"><input className="sy-in" value={g.lastName} onChange={e => setG({ ...g, lastName: e.target.value })} /></Field>
      </div>
      <Field label="Email"><input className="sy-in" type="email" value={g.email} onChange={e => setG({ ...g, email: e.target.value })} /></Field>
      <div className="sy-grid2" style={{ gap: 10 }}>
        <Field label="From"><input className="sy-in" type="datetime-local" value={g.from} onChange={e => setG({ ...g, from: e.target.value })} /></Field>
        <Field label="Until"><input className="sy-in" type="datetime-local" value={g.to} onChange={e => setG({ ...g, to: e.target.value })} /></Field>
      </div>
      <Field label="Access group (optional)"><select className="sy-in" value={g.groupId} onChange={e => setG({ ...g, groupId: e.target.value })}><option value="">Default</option>{groups.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
      <button type="button" className="sy-b pri" onClick={issue} disabled={busy}>{busy ? 'Sending…' : 'Send visitor pass'}</button>
    </Sheet>
  )
}

function UserCard({ ctx, userId, listUser, groups, onClose, onChanged, onActivity, onRevokePass }: { ctx: SiteCtx; userId: string; listUser?: Any; groups: Any[]; onClose: () => void; onChanged: () => void; onActivity: (n: string) => void; onRevokePass: (u: Any) => void }) {
  const { siteId, notify } = ctx
  const { user } = useUser()
  const meta = (user?.publicMetadata as Any) ?? {}
  const canManage = meta.org_tier === 'corporate' || meta.role === 'admin' || meta.role === 'supervisor'
  const [detail, setDetail] = useState<{ user: Any; credentials: Any[]; groups: Any[]; activity: Any[] } | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [form, setForm] = useState({ firstName: listUser?.firstName ?? '', lastName: listUser?.lastName ?? '', email: listUser?.email ?? '', phone: listUser?.phone ?? '' })
  const [busy, setBusy] = useState('')
  const [fob, setFob] = useState<string | null>(null)

  const refresh = useCallback(async (resetForm = false) => {
    const r = await getJson(`/api/brivo/users/${userId}?site_id=${siteId}`)
    if (r.data.user) {
      setDetail({ user: r.data.user, credentials: r.data.credentials ?? [], groups: r.data.groups ?? [], activity: r.data.activity ?? [] })
      if (resetForm) setForm({ firstName: r.data.user.firstName ?? '', lastName: r.data.user.lastName ?? '', email: r.data.user.emails?.[0]?.address ?? listUser?.email ?? '', phone: r.data.user.phoneNumbers?.[0]?.number ?? listUser?.phone ?? '' })
    } else setLoadErr(r.data.error || 'Couldn’t load this person.')
  }, [userId, siteId, listUser])
  useEffect(() => { void refresh(true) }, [refresh])
  const nm = () => `${form.firstName} ${form.lastName}`.trim()

  async function save() {
    setBusy('save')
    const r = await send(`/api/brivo/users/${userId}`, 'PATCH', { site_id: siteId, ...form })
    setBusy('')
    if (!r.ok) { notify(r.data.error || 'Couldn’t save.', false); return }
    notify('Saved.'); onChanged()
  }
  async function cred(action: 'issue-pass' | 'assign-fob' | 'revoke' | 'reinstate', extra?: Any) {
    if (action === 'revoke' && !window.confirm('Turn this credential off? It stops opening doors.')) return
    setBusy(action + (extra?.credential_id ?? ''))
    const r = await send(`/api/brivo/users/${userId}/credentials`, 'POST', { site_id: siteId, action, name: nm(), email: form.email || null, ...extra })
    setBusy('')
    if (!r.ok) { notify(r.data.error || 'Didn’t work.', false); return }
    notify(action === 'issue-pass' ? 'Mobile Pass sent.' : action === 'assign-fob' ? 'Fob assigned.' : action === 'revoke' ? 'Credential turned off.' : 'Credential turned back on.')
    if (action === 'assign-fob') setFob(null)
    await refresh()
  }
  async function group(add: boolean, g: Any) {
    setBusy('g' + g.id)
    const r = await send(`/api/brivo/users/${userId}/group`, add ? 'POST' : 'DELETE', { site_id: siteId, group_id: g.id, group_name: g.name, name: nm() })
    setBusy('')
    if (!r.ok) { notify(r.data.error || 'Didn’t work.', false); return }
    notify(add ? `Added to ${g.name}.` : `Removed from ${g.name}.`); await refresh(); onChanged()
  }

  const assigned: Any[] = detail?.groups ?? (listUser?.groupNames ?? []).map((n: string) => ({ id: '', name: n }))
  const ids = new Set(assigned.map(g => String(g.id)))
  const addable = groups.filter(g => !ids.has(String(g.id)))
  return (
    <Sheet title={nm() || 'Person'} sub={listUser?.unitNumber ? `Unit ${listUser.unitNumber}` : 'Resident / admin'} onClose={onClose} width={560}>
      {loadErr && <Note tone="orange">{loadErr}</Note>}
      <div className="sy-grid2" style={{ gap: 10 }}>
        {(['firstName', 'lastName', 'email', 'phone'] as const).map(k => (
          <Field key={k} label={{ firstName: 'First name', lastName: 'Last name', email: 'Email', phone: 'Phone' }[k]}>
            <input className="sy-in" value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} readOnly={!canManage} style={canManage ? undefined : { background: '#F5F5F7' }} />
          </Field>
        ))}
      </div>
      {canManage && <div><button type="button" className="sy-b pri sm" onClick={save} disabled={busy === 'save'}>{busy === 'save' ? 'Saving…' : 'Save changes'}</button></div>}

      <div>
        <span className="sy-lbl">Access groups</span>
        <div className="sy-chips">
          {detail == null && !loadErr ? <span className="sy-empty">Loading…</span>
            : !assigned.length ? <span className="sy-empty">No groups</span>
            : assigned.map((g, i) => (
              <span key={g.id || i} className="sy-pill" style={{ fontSize: 12, padding: '4px 8px' }}>
                {g.name}
                {canManage && g.id && <button type="button" aria-label={`Remove from ${g.name}`} onClick={() => group(false, g)} disabled={busy === 'g' + g.id} style={{ border: 0, background: 'none', padding: 0, color: RED, cursor: 'pointer', fontSize: 13, lineHeight: 1 }}>×</button>}
              </span>
            ))}
        </div>
        {canManage && addable.length > 0 && <select className="sy-in" value="" onChange={e => { const g = addable.find(x => String(x.id) === e.target.value); if (g) void group(true, g) }} style={{ marginTop: 8 }} aria-label="Add to group"><option value="">Add to a group…</option>{addable.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select>}
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="sy-lbl" style={{ margin: 0 }}>Credentials</span>
          {canManage && <div className="sy-acts">
            <button type="button" className="sy-b line sm" onClick={() => cred('issue-pass')} disabled={!!busy}>Send Mobile Pass</button>
            <button type="button" className="sy-b line sm" onClick={() => setFob(f => f == null ? '' : null)} disabled={!!busy}>Assign fob</button>
          </div>}
        </div>
        {canManage && fob != null && (
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <input className="sy-in" value={fob} onChange={e => setFob(e.target.value)} placeholder="Card / fob number" inputMode="numeric" aria-label="Fob number" />
            <button type="button" className="sy-b pri sm" style={{ height: 36 }} onClick={() => fob.trim() && cred('assign-fob', { card_number: fob.trim() })} disabled={!fob.trim() || busy === 'assign-fob'}>Assign</button>
          </div>
        )}
        <div style={{ marginTop: 6 }}>
          {detail == null ? <div className="sy-empty">{loadErr ? '' : 'Loading…'}</div>
            : !detail.credentials.length ? <div className="sy-empty">No credentials yet.</div>
            : detail.credentials.map(c => (
              <div key={c.id} className="sy-row">
                <Dot c={c.active ? DOT.green : DOT.gray} />
                <div className="main"><div className="t" style={{ fontSize: 13 }}>{c.label}</div><div className="m">{c.isPass ? 'Mobile Pass' : 'Card / fob'} · {c.active ? 'On' : 'Off'}</div></div>
                {canManage && (c.active
                  ? <button type="button" className="sy-b warn sm" onClick={() => cred('revoke', { credential_id: c.id })} disabled={busy === 'revoke' + c.id}>Turn off</button>
                  : <button type="button" className="sy-b go sm" onClick={() => cred('reinstate', { credential_id: c.id })} disabled={busy === 'reinstate' + c.id}>Turn on</button>)}
              </div>
            ))}
          {!canManage && listUser && <button type="button" className="sy-b warn sm" onClick={() => onRevokePass(listUser)} style={{ marginTop: 6 }}>Turn off Mobile Pass</button>}
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="sy-lbl" style={{ margin: 0 }}>Recent activity</span>
          <button type="button" className="sy-b line sm" onClick={() => onActivity(nm())}>Full log</button>
        </div>
        <div style={{ marginTop: 6 }}>
          {detail == null ? null : !detail.activity.length ? <div className="sy-empty">Nothing recent.</div>
            : detail.activity.slice(0, 10).map((e, i) => <div key={i} style={{ fontSize: 13, padding: '5px 0', borderTop: i ? '1px solid rgba(0,0,0,.06)' : 0 }}>{e.summary ?? e.eventDescription ?? 'Access event'}<span style={{ color: MUTED }}>{e.occurred ? ` · ${fmtWhen(e.occurred)}` : ''}</span></div>)}
        </div>
      </div>
    </Sheet>
  )
}
