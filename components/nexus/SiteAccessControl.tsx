'use client';

// SiteAccessControl — the dealer's live control + Brivo management panel for a
// property. Gate reset (Shelly), door unlock (Brivo), full user management
// (create, suspend/reactivate, assign group, send/resend/revoke Mobile Pass),
// time-boxed guest passes, and a filterable access Event Tracker. Every action
// calls an EXISTING scoped route; each section degrades gracefully if a vendor
// isn't connected. Physical actions confirm first and are audited server-side.
import React, { useCallback, useEffect, useMemo, useState } from 'react';

const TILE = { background: 'repeating-linear-gradient(90deg,rgba(255,255,255,0.04) 0 1px,transparent 1px 4px), linear-gradient(180deg,#2b3c52,#1e2a3a)', border: '1px solid rgba(140,170,200,0.22)', borderRadius: 14, padding: 12 } as const;
const WELL = 'linear-gradient(180deg,#22303f,#1a2532)';
const BTN = { borderRadius: 8, padding: '5px 11px', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' } as const;
const ICE = { ...BTN, background: '#22303f', border: '1px solid rgba(95,184,224,0.28)', color: '#9FD8EC' } as const;
const GO = { ...BTN, background: 'rgba(126,224,168,0.14)', border: '1px solid rgba(126,224,168,0.4)', color: '#7ee0a8' } as const;
const WARN = { ...BTN, background: 'rgba(242,99,126,0.12)', border: '1px solid rgba(242,99,126,0.4)', color: '#f2637e' } as const;
const INPUT = { background: '#16232f', border: '1px solid rgba(140,170,200,0.22)', color: '#eaf2fb', borderRadius: 10, padding: '8px 10px', fontSize: 13, outline: 'none' } as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = Record<string, any>;
type Tab = 'gate' | 'doors' | 'users' | 'guests' | 'events';
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'gate', label: 'Gate & relays', icon: '⛩' },
  { id: 'doors', label: 'Doors', icon: '🚪' },
  { id: 'users', label: 'Users', icon: '👥' },
  { id: 'guests', label: 'Guests', icon: '🎟' },
  { id: 'events', label: 'Event tracker', icon: '📜' },
];

async function post(url: string, body: Any) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Action failed');
  return j;
}

export function SiteAccessControl({ siteId }: { siteId: string }) {
  const [tab, setTab] = useState<Tab>('gate');
  const [flash, setFlash] = useState<{ msg: string; ok: boolean } | null>(null);
  const [eventUser, setEventUser] = useState('');
  const notify = (msg: string, ok = true) => { setFlash({ msg, ok }); setTimeout(() => setFlash(null), 3500); };

  // Brivo users + groups fetched once, shared by Users + Guests.
  const [brivo, setBrivo] = useState<{ users: Any[]; groups: Any[] } | null>(null);
  const [brivoErr, setBrivoErr] = useState(false);
  const [brivoMsg, setBrivoMsg] = useState<string>('');
  const loadBrivo = useCallback(() => {
    setBrivoMsg('');
    fetch(`/api/brivo/users?site_id=${siteId}&groups=1`, { cache: 'no-store' }).then(r => r.json())
      .then(j => {
        if (j?.error) setBrivoMsg(String(j.error));
        if (Array.isArray(j.users)) setBrivo({ users: j.users, groups: j.groups ?? [] });
        else { setBrivo({ users: [], groups: [] }); setBrivoErr(true); }
      })
      .catch(() => { setBrivo({ users: [], groups: [] }); setBrivoErr(true); });
  }, [siteId]);
  useEffect(() => { if ((tab === 'users' || tab === 'guests') && !brivo) loadBrivo(); }, [tab, brivo, loadBrivo]);

  return (
    <div style={{ background: WELL, border: '1px solid rgba(140,170,200,0.18)', borderRadius: 16, padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        <div>
          <div style={{ color: '#9FD8EC', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Access &amp; control</div>
          <div style={{ color: '#98abbd', fontSize: 12 }}>Reset a gate, unlock a door, manage users &amp; passes, read door activity.</div>
        </div>
        {flash && <span style={{ fontSize: 11.5, fontWeight: 600, color: flash.ok ? '#7ee0a8' : '#f2637e' }}>{flash.msg}</span>}
      </div>

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', background: '#16232f', border: '1px solid rgba(140,170,200,0.18)', borderRadius: 12, padding: 3, marginBottom: 12 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ borderRadius: 9, padding: '5px 11px', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', border: 'none', background: tab === t.id ? 'rgba(95,184,224,0.2)' : 'transparent', color: tab === t.id ? '#bfe6ff' : '#8ba0b4' }}>
            <span aria-hidden>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {tab === 'gate' && <GateRelays siteId={siteId} notify={notify} />}
      {tab === 'doors' && <Doors siteId={siteId} notify={notify} />}
      {tab === 'users' && <Users siteId={siteId} data={brivo} err={brivoErr} msg={brivoMsg} reload={loadBrivo} notify={notify} onActivity={(n) => { setEventUser(n); setTab('events'); }} />}
      {tab === 'guests' && <Guests siteId={siteId} groups={brivo?.groups ?? []} err={brivoErr} notify={notify} onIssued={loadBrivo} />}
      {tab === 'events' && <Activity siteId={siteId} userFilter={eventUser} setUserFilter={setEventUser} />}
    </div>
  );
}

function Loader() { return <div style={{ fontSize: 12, color: '#7f96ab', padding: '10px 2px' }}>Loading…</div>; }
function NotConnected({ what }: { what: string }) { return <div style={{ fontSize: 11.5, color: '#6f8397', padding: '10px 2px' }}>{what} isn’t connected for this site (or you don’t have access). A corporate admin can connect it under Setup &amp; keys.</div>; }

function GateRelays({ siteId, notify }: { siteId: string; notify: (m: string, ok?: boolean) => void }) {
  const [relays, setRelays] = useState<Any[] | null>(null);
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState('');
  const load = useCallback(() => { fetch(`/api/shelly/relays?site_id=${siteId}`, { cache: 'no-store' }).then(r => r.json()).then(j => { if (Array.isArray(j.relays)) setRelays(j.relays); else { setRelays([]); if (j.error) setErr(true); } }).catch(() => setErr(true)); }, [siteId]);
  useEffect(() => { load(); }, [load]);
  async function act(r: Any, kind: 'pulse' | 'on' | 'off') {
    const name = r.name ?? 'Relay';
    if (!confirm(`${kind === 'pulse' ? 'Pulse (reset)' : kind === 'on' ? 'Turn ON' : 'Turn OFF'} “${name}”?`)) return;
    setBusy(`${r.id}:${kind}`);
    try { const body: Any = { site_id: siteId, channel: r.channel ?? 0, name, confirm: true }; if (kind === 'pulse') body.pulse = 1; else body.on = kind === 'on'; await post(`/api/shelly/relays/${r.id}`, body); notify(`${name}: ${kind === 'pulse' ? 'pulsed' : kind}`); }
    catch (e) { notify(e instanceof Error ? e.message : 'Failed', false); } finally { setBusy(''); }
  }
  if (err && !relays?.length) return <NotConnected what="Shelly relays" />;
  if (relays == null) return <Loader />;
  if (relays.length === 0) return <div style={{ fontSize: 11.5, color: '#6f8397', padding: '10px 2px' }}>No relays found at this site.</div>;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))', gap: 8 }}>
      {relays.map(r => (
        <div key={`${r.id}:${r.channel ?? 0}`} style={TILE}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: (r.on ?? r.ison) ? '#7ee0a8' : '#6f8397' }} />
            <span style={{ color: '#eaf2fb', fontSize: 13, fontWeight: 600 }}>{r.name ?? 'Relay'}</span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={() => act(r, 'pulse')} disabled={!!busy} style={{ ...GO, opacity: busy ? 0.5 : 1 }}>⟳ Reset / pulse</button>
            <button onClick={() => act(r, 'on')} disabled={!!busy} style={{ ...ICE, opacity: busy ? 0.5 : 1 }}>On</button>
            <button onClick={() => act(r, 'off')} disabled={!!busy} style={{ ...ICE, opacity: busy ? 0.5 : 1 }}>Off</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function Doors({ siteId, notify }: { siteId: string; notify: (m: string, ok?: boolean) => void }) {
  const [doors, setDoors] = useState<Any[] | null>(null);
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState('');
  useEffect(() => { fetch(`/api/brivo/doors?site_id=${siteId}`, { cache: 'no-store' }).then(r => r.json()).then(j => { if (Array.isArray(j.doors)) setDoors(j.doors); else { setDoors([]); setErr(true); } }).catch(() => setErr(true)); }, [siteId]);
  async function unlock(d: Any) {
    if (!confirm(`Unlock “${d.name ?? 'door'}” now?`)) return;
    setBusy(String(d.id));
    try { await post(`/api/brivo/doors/${d.id}`, { site_id: siteId, confirm: true, name: d.name }); notify(`${d.name ?? 'Door'} unlocked`); }
    catch (e) { notify(e instanceof Error ? e.message : 'Failed', false); } finally { setBusy(''); }
  }
  if (err && !doors?.length) return <NotConnected what="Brivo access control" />;
  if (doors == null) return <Loader />;
  if (doors.length === 0) return <div style={{ fontSize: 11.5, color: '#6f8397', padding: '10px 2px' }}>No doors found at this site.</div>;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))', gap: 8 }}>
      {doors.map(d => (
        <div key={d.id} style={{ ...TILE, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ color: '#eaf2fb', fontSize: 13, fontWeight: 600 }}>{d.name ?? 'Door'}</span>
          <button onClick={() => unlock(d)} disabled={!!busy} style={{ ...GO, opacity: busy ? 0.5 : 1 }}>🔓 Unlock</button>
        </div>
      ))}
    </div>
  );
}

function name(u: Any) { return (u.name ?? `${u.firstName ?? ''} ${u.lastName ?? ''}`).trim() || u.email || 'User'; }

function Users({ siteId, data, err, msg, reload, notify, onActivity }: { siteId: string; data: { users: Any[]; groups: Any[] } | null; err: boolean; msg?: string; reload: () => void; notify: (m: string, ok?: boolean) => void; onActivity: (n: string) => void }) {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [nu, setNu] = useState({ firstName: '', lastName: '', email: '', unit: '', groupId: '' });

  async function act(u: Any, action: 'resend-pass' | 'revoke-pass' | 'suspend', extra?: Any) {
    const labels: Any = { 'resend-pass': `Send / resend a Mobile Pass to ${name(u)}?`, 'revoke-pass': `Revoke the Mobile Pass of ${name(u)}?`, suspend: `${extra?.suspended ? 'Suspend' : 'Reactivate'} ${name(u)}?` };
    if (!confirm(labels[action])) return;
    setBusy(`${u.id}:${action}`);
    try {
      const url = action === 'suspend' ? `/api/brivo/users/${u.id}/suspend` : `/api/brivo/users/${u.id}/${action}`;
      await post(url, { site_id: siteId, email: u.email ?? null, name: name(u), ...extra });
      notify(action === 'resend-pass' ? `Pass sent to ${name(u)}` : action === 'revoke-pass' ? `Pass revoked for ${name(u)}` : `${name(u)} ${extra?.suspended ? 'suspended' : 'reactivated'}`);
      reload();
    } catch (e) { notify(e instanceof Error ? e.message : 'Failed', false); } finally { setBusy(''); }
  }
  async function assignGroup(u: Any, groupId: string, groupName: string) {
    if (!groupId) return;
    setBusy(`${u.id}:group`);
    try { await post(`/api/brivo/users/${u.id}/group`, { site_id: siteId, group_id: groupId, group_name: groupName, name: name(u) }); notify(`${name(u)} added to ${groupName}`); reload(); }
    catch (e) { notify(e instanceof Error ? e.message : 'Failed', false); } finally { setBusy(''); }
  }
  async function create() {
    if (!nu.firstName.trim() || !nu.lastName.trim()) { notify('First and last name required', false); return; }
    setBusy('create');
    try {
      await post('/api/brivo/users', { site_id: siteId, firstName: nu.firstName, lastName: nu.lastName, email: nu.email || null, unit: nu.unit || null, groupId: nu.groupId || null });
      notify(`Created ${nu.firstName} ${nu.lastName}`); setNu({ firstName: '', lastName: '', email: '', unit: '', groupId: '' }); setShowCreate(false); reload();
    } catch (e) { notify(e instanceof Error ? e.message : 'Failed', false); } finally { setBusy(''); }
  }

  if (data == null) return <Loader />;
  if (msg && data.users.length === 0) return (
    <div style={{ fontSize: 12, color: '#fbbf24', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 12, padding: '12px 14px', lineHeight: 1.5 }}>
      <div style={{ fontWeight: 700, color: '#f6d68a', marginBottom: 4 }}>Residents &amp; admins can’t be listed yet</div>
      {msg}
    </div>
  );
  if (err && !data.users.length) return <NotConnected what="Brivo access control" />;
  const groups: Any[] = data.groups ?? [];
  const shown = (q ? data.users.filter(u => `${name(u)} ${u.email ?? ''} ${u.unitNumber ?? ''}`.toLowerCase().includes(q.toLowerCase())) : data.users).slice(0, 80);

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search residents & admins…" style={{ ...INPUT, flex: 1, minWidth: 160 }} />
        <button onClick={() => setShowCreate(s => !s)} style={{ ...ICE, padding: '8px 14px' }}>{showCreate ? 'Close' : '＋ New user'}</button>
      </div>

      {showCreate && (
        <div style={{ ...TILE, marginBottom: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px,1fr))', gap: 8, marginBottom: 8 }}>
            <input value={nu.firstName} onChange={e => setNu({ ...nu, firstName: e.target.value })} placeholder="First name" style={INPUT} />
            <input value={nu.lastName} onChange={e => setNu({ ...nu, lastName: e.target.value })} placeholder="Last name" style={INPUT} />
            <input value={nu.email} onChange={e => setNu({ ...nu, email: e.target.value })} placeholder="Email (for pass)" style={INPUT} />
            <input value={nu.unit} onChange={e => setNu({ ...nu, unit: e.target.value })} placeholder="Unit #" style={INPUT} />
            <select value={nu.groupId} onChange={e => setNu({ ...nu, groupId: e.target.value })} style={{ ...INPUT, padding: '8px 8px' }}>
              <option value="" style={{ background: '#111a24' }}>No group</option>
              {groups.map(g => <option key={g.id} value={g.id} style={{ background: '#111a24' }}>{g.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={create} disabled={busy === 'create'} style={{ ...GO, opacity: busy === 'create' ? 0.5 : 1 }}>{busy === 'create' ? 'Creating…' : 'Create user'}</button>
          </div>
        </div>
      )}

      {shown.length === 0 ? <div style={{ fontSize: 11.5, color: '#6f8397', padding: '6px 2px' }}>No users match.</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 360, overflowY: 'auto' }}>
          {shown.map(u => (
            <div key={u.id} style={{ ...TILE, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ color: '#eaf2fb', fontSize: 12.5, fontWeight: 600 }}>{name(u)} {u.active === false && <span style={{ color: '#f2637e', fontSize: 9.5, fontWeight: 700 }}>· SUSPENDED</span>}</div>
                <div style={{ color: '#98abbd', fontSize: 10.5 }}>{u.email ?? 'no email'}{u.unitNumber ? ` · Unit ${u.unitNumber}` : ''}</div>
              </div>
              <select defaultValue="" onChange={e => { const g = groups.find(x => x.id === e.target.value); if (g) assignGroup(u, g.id, g.name); e.currentTarget.selectedIndex = 0; }} style={{ ...INPUT, padding: '5px 6px', fontSize: 11 }} title="Assign to group">
                <option value="" style={{ background: '#111a24' }}>+ Group</option>
                {groups.map(g => <option key={g.id} value={g.id} style={{ background: '#111a24' }}>{g.name}</option>)}
              </select>
              <button onClick={() => act(u, 'resend-pass')} disabled={!!busy} style={{ ...ICE, opacity: busy ? 0.5 : 1 }}>Send / resend pass</button>
              <button onClick={() => act(u, 'revoke-pass')} disabled={!!busy} style={{ ...WARN, opacity: busy ? 0.5 : 1 }}>Revoke</button>
              <button onClick={() => act(u, 'suspend', { suspended: u.active !== false })} disabled={!!busy} style={{ ...(u.active === false ? GO : WARN), opacity: busy ? 0.5 : 1 }}>{u.active === false ? 'Reactivate' : 'Suspend'}</button>
              <button onClick={() => onActivity(name(u))} style={ICE}>Activity →</button>
            </div>
          ))}
        </div>
      )}
      <div style={{ fontSize: 9.5, color: '#6f8397', marginTop: 8 }}>Send/resend issues a fresh Brivo Mobile Pass invite. Revoke turns the pass off. Suspend blocks all access.</div>
    </div>
  );
}

function Guests({ siteId, groups, err, notify, onIssued }: { siteId: string; groups: Any[]; err: boolean; notify: (m: string, ok?: boolean) => void; onIssued: () => void }) {
  const [g, setG] = useState({ firstName: '', lastName: '', email: '', from: '', to: '', groupId: '' });
  const [busy, setBusy] = useState(false);
  async function issue() {
    if (!g.firstName.trim() || !g.lastName.trim() || !g.email.trim()) { notify('Name and email required', false); return; }
    setBusy(true);
    try {
      await post('/api/brivo/guests', { site_id: siteId, firstName: g.firstName, lastName: g.lastName, email: g.email, from: g.from ? new Date(g.from).toISOString() : null, to: g.to ? new Date(g.to).toISOString() : null, group_id: g.groupId || null });
      notify(`Visitor pass sent to ${g.firstName}`); setG({ firstName: '', lastName: '', email: '', from: '', to: '', groupId: '' }); onIssued();
    } catch (e) { notify(e instanceof Error ? e.message : 'Failed', false); } finally { setBusy(false); }
  }
  if (err) return <NotConnected what="Brivo access control" />;
  return (
    <div style={TILE}>
      <div style={{ color: '#9FD8EC', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Issue a visitor pass</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 8, marginBottom: 8 }}>
        <input value={g.firstName} onChange={e => setG({ ...g, firstName: e.target.value })} placeholder="First name" style={INPUT} />
        <input value={g.lastName} onChange={e => setG({ ...g, lastName: e.target.value })} placeholder="Last name" style={INPUT} />
        <input value={g.email} onChange={e => setG({ ...g, email: e.target.value })} placeholder="Guest email" style={INPUT} />
        <select value={g.groupId} onChange={e => setG({ ...g, groupId: e.target.value })} style={{ ...INPUT, padding: '8px 8px' }}>
          <option value="" style={{ background: '#111a24' }}>Access group (optional)</option>
          {groups.map(gr => <option key={gr.id} value={gr.id} style={{ background: '#111a24' }}>{gr.name}</option>)}
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <div><div style={{ fontSize: 9.5, textTransform: 'uppercase', color: '#7f96ab', marginBottom: 3 }}>Valid from</div><input type="datetime-local" value={g.from} onChange={e => setG({ ...g, from: e.target.value })} style={{ ...INPUT, width: '100%' }} /></div>
        <div><div style={{ fontSize: 9.5, textTransform: 'uppercase', color: '#7f96ab', marginBottom: 3 }}>Valid to</div><input type="datetime-local" value={g.to} onChange={e => setG({ ...g, to: e.target.value })} style={{ ...INPUT, width: '100%' }} /></div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={issue} disabled={busy} style={{ ...GO, opacity: busy ? 0.5 : 1 }}>{busy ? 'Issuing…' : '🎟 Send visitor pass'}</button>
      </div>
      <div style={{ fontSize: 9.5, color: '#6f8397', marginTop: 8 }}>Creates the guest in Brivo and emails a time-boxed Mobile Pass. They’ll appear in Users and the Event tracker.</div>
    </div>
  );
}

function Activity({ siteId, userFilter, setUserFilter }: { siteId: string; userFilter: string; setUserFilter: (s: string) => void }) {
  const [events, setEvents] = useState<Any[] | null>(null);
  const [err, setErr] = useState(false);
  const [type, setType] = useState('');
  const [deniedOnly, setDeniedOnly] = useState(false);
  useEffect(() => { fetch(`/api/brivo/events?site_id=${siteId}`, { cache: 'no-store' }).then(r => r.json()).then(j => { if (Array.isArray(j.events)) setEvents(j.events); else { setEvents([]); setErr(true); } }).catch(() => setErr(true)); }, [siteId]);

  const label = (e: Any) => String(e.summary ?? e.eventDescription ?? e.eventType ?? e.name ?? 'Access event');
  const who = (e: Any) => String(e.actorName ?? e.userName ?? e.objectName ?? '');
  const device = (e: Any) => String(e.deviceName ?? e.objectName ?? e.accessPointName ?? '');
  const types = useMemo(() => Array.from(new Set((events ?? []).map(label))).slice(0, 30), [events]);
  const shown = useMemo(() => (events ?? []).filter(e => {
    if (type && label(e) !== type) return false;
    if (deniedOnly && !/denied|reject|fail/i.test(label(e))) return false;
    if (userFilter && !who(e).toLowerCase().includes(userFilter.toLowerCase())) return false;
    return true;
  }).slice(0, 100), [events, type, deniedOnly, userFilter]);

  if (err && !events?.length) return <NotConnected what="Brivo access control" />;
  if (events == null) return <Loader />;
  const fmt = (t: string) => { const d = new Date(t); return isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); };
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
        <input value={userFilter} onChange={e => setUserFilter(e.target.value)} placeholder="Filter by user…" style={{ ...INPUT, flex: 1, minWidth: 130 }} />
        <select value={type} onChange={e => setType(e.target.value)} style={{ ...INPUT, padding: '8px 8px' }}>
          <option value="" style={{ background: '#111a24' }}>All events</option>
          {types.map(t => <option key={t} value={t} style={{ background: '#111a24' }}>{t}</option>)}
        </select>
        <button onClick={() => setDeniedOnly(v => !v)} style={{ ...BTN, background: deniedOnly ? 'rgba(242,99,126,0.16)' : '#22303f', border: `1px solid ${deniedOnly ? 'rgba(242,99,126,0.5)' : 'rgba(140,170,200,0.22)'}`, color: deniedOnly ? '#f2637e' : '#9FD8EC' }}>Denied only</button>
        {(userFilter || type || deniedOnly) && <button onClick={() => { setUserFilter(''); setType(''); setDeniedOnly(false); }} style={{ ...BTN, background: 'transparent', border: 'none', color: '#8ba0b4' }}>Clear</button>}
      </div>
      {shown.length === 0 ? <div style={{ fontSize: 11.5, color: '#6f8397', padding: '10px 2px' }}>No events match.</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 360, overflowY: 'auto' }}>
          {shown.map((e, i) => {
            const when = e.occurred ?? e.eventOccurred ?? e.created ?? e.timestamp;
            const denied = /denied|reject|fail/i.test(label(e));
            return (
              <div key={e.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, padding: '5px 0', borderBottom: '1px solid rgba(140,170,200,0.08)' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: denied ? '#f2637e' : '#7ee0a8', flexShrink: 0 }} />
                <span style={{ color: '#e2ebf4' }}>{label(e)}</span>
                {who(e) && <span style={{ color: '#98abbd' }}>· {who(e)}</span>}
                {device(e) && <span style={{ color: '#7f96ab' }}>· {device(e)}</span>}
                {when && <span style={{ color: '#7f96ab', marginLeft: 'auto' }}>{fmt(String(when))}</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
