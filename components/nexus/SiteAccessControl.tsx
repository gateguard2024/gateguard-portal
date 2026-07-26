'use client';

// SiteAccessControl — the dealer's live control panel for a property. One place to
// pulse/reset a gate (Shelly), unlock a door (Brivo), send/resend/revoke a resident
// or admin's Mobile Pass (Brivo), and read recent door activity. Every action calls
// an EXISTING scoped route; each section degrades gracefully if that vendor isn't
// connected. Physical actions confirm first and are audited server-side.
import React, { useCallback, useEffect, useState } from 'react';

const TILE = { background: 'repeating-linear-gradient(90deg,rgba(255,255,255,0.04) 0 1px,transparent 1px 4px), linear-gradient(180deg,#2b3c52,#1e2a3a)', border: '1px solid rgba(140,170,200,0.22)', borderRadius: 14, padding: 12 } as const;
const WELL = 'linear-gradient(180deg,#22303f,#1a2532)';
const BTN = { borderRadius: 8, padding: '5px 11px', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' } as const;
const ICE = { ...BTN, background: '#22303f', border: '1px solid rgba(95,184,224,0.28)', color: '#9FD8EC' } as const;
const GO = { ...BTN, background: 'rgba(126,224,168,0.14)', border: '1px solid rgba(126,224,168,0.4)', color: '#7ee0a8' } as const;
const WARN = { ...BTN, background: 'rgba(242,99,126,0.12)', border: '1px solid rgba(242,99,126,0.4)', color: '#f2637e' } as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = Record<string, any>;
type Tab = 'gate' | 'doors' | 'passes' | 'activity';
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'gate', label: 'Gate & relays', icon: '⛩' },
  { id: 'doors', label: 'Doors', icon: '🚪' },
  { id: 'passes', label: 'Passes', icon: '🔑' },
  { id: 'activity', label: 'Door activity', icon: '📜' },
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
  const notify = (msg: string, ok = true) => { setFlash({ msg, ok }); setTimeout(() => setFlash(null), 3500); };

  return (
    <div style={{ background: WELL, border: '1px solid rgba(140,170,200,0.18)', borderRadius: 16, padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        <div>
          <div style={{ color: '#9FD8EC', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Access &amp; control</div>
          <div style={{ color: '#98abbd', fontSize: 12 }}>Reset a gate, unlock a door, send or revoke passes, read door activity.</div>
        </div>
        {flash && <span style={{ fontSize: 11.5, fontWeight: 600, color: flash.ok ? '#7ee0a8' : '#f2637e' }}>{flash.msg}</span>}
      </div>

      <div style={{ display: 'inline-flex', gap: 4, background: '#16232f', border: '1px solid rgba(140,170,200,0.18)', borderRadius: 12, padding: 3, marginBottom: 12 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ borderRadius: 9, padding: '5px 11px', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', border: 'none', background: tab === t.id ? 'rgba(95,184,224,0.2)' : 'transparent', color: tab === t.id ? '#bfe6ff' : '#8ba0b4' }}>
            <span aria-hidden>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {tab === 'gate' && <GateRelays siteId={siteId} notify={notify} />}
      {tab === 'doors' && <Doors siteId={siteId} notify={notify} />}
      {tab === 'passes' && <Passes siteId={siteId} notify={notify} />}
      {tab === 'activity' && <Activity siteId={siteId} />}
    </div>
  );
}

function Loader() { return <div style={{ fontSize: 12, color: '#7f96ab', padding: '10px 2px' }}>Loading…</div>; }
function NotConnected({ what }: { what: string }) { return <div style={{ fontSize: 11.5, color: '#6f8397', padding: '10px 2px' }}>{what} isn’t connected for this site (or you don’t have access). A corporate admin can connect it under Setup &amp; keys.</div>; }

function GateRelays({ siteId, notify }: { siteId: string; notify: (m: string, ok?: boolean) => void }) {
  const [relays, setRelays] = useState<Any[] | null>(null);
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState<string>('');
  const load = useCallback(() => { fetch(`/api/shelly/relays?site_id=${siteId}`, { cache: 'no-store' }).then(r => r.json()).then(j => { if (Array.isArray(j.relays)) setRelays(j.relays); else { setRelays([]); if (j.error) setErr(true); } }).catch(() => setErr(true)); }, [siteId]);
  useEffect(() => { load(); }, [load]);

  async function act(r: Any, kind: 'pulse' | 'on' | 'off') {
    const name = r.name ?? 'Relay';
    if (!confirm(`${kind === 'pulse' ? 'Pulse (reset)' : kind === 'on' ? 'Turn ON' : 'Turn OFF'} “${name}”?`)) return;
    setBusy(`${r.id}:${kind}`);
    try {
      const body: Any = { site_id: siteId, channel: r.channel ?? 0, name, confirm: true };
      if (kind === 'pulse') body.pulse = 1; else body.on = kind === 'on';
      await post(`/api/shelly/relays/${r.id}`, body);
      notify(`${name}: ${kind === 'pulse' ? 'pulsed' : kind}`);
    } catch (e) { notify(e instanceof Error ? e.message : 'Failed', false); } finally { setBusy(''); }
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

function Passes({ siteId, notify }: { siteId: string; notify: (m: string, ok?: boolean) => void }) {
  const [users, setUsers] = useState<Any[] | null>(null);
  const [err, setErr] = useState(false);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState('');
  useEffect(() => { fetch(`/api/brivo/users?site_id=${siteId}`, { cache: 'no-store' }).then(r => r.json()).then(j => { if (Array.isArray(j.users)) setUsers(j.users); else { setUsers([]); setErr(true); } }).catch(() => setErr(true)); }, [siteId]);

  const name = (u: Any) => (u.name ?? `${u.firstName ?? ''} ${u.lastName ?? ''}`).trim() || u.email || 'User';
  async function pass(u: Any, action: 'resend-pass' | 'revoke-pass') {
    const verb = action === 'resend-pass' ? 'Send / resend a Mobile Pass to' : 'Revoke the Mobile Pass of';
    if (!confirm(`${verb} ${name(u)}?`)) return;
    setBusy(`${u.id}:${action}`);
    try {
      await post(`/api/brivo/users/${u.id}/${action}`, { site_id: siteId, email: u.email ?? null, name: name(u) });
      notify(action === 'resend-pass' ? `Pass sent to ${name(u)}` : `Pass revoked for ${name(u)}`);
    } catch (e) { notify(e instanceof Error ? e.message : 'Failed', false); } finally { setBusy(''); }
  }

  if (err && !users?.length) return <NotConnected what="Brivo access control" />;
  if (users == null) return <Loader />;
  const shown = (q ? users.filter(u => `${name(u)} ${u.email ?? ''}`.toLowerCase().includes(q.toLowerCase())) : users).slice(0, 60);
  return (
    <div>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search residents & admins…" style={{ width: '100%', background: '#16232f', border: '1px solid rgba(140,170,200,0.22)', color: '#eaf2fb', borderRadius: 10, padding: '8px 10px', fontSize: 13, outline: 'none', marginBottom: 8 }} />
      {shown.length === 0 ? <div style={{ fontSize: 11.5, color: '#6f8397', padding: '6px 2px' }}>No users match.</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
          {shown.map(u => (
            <div key={u.id} style={{ ...TILE, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ color: '#eaf2fb', fontSize: 12.5, fontWeight: 600 }}>{name(u)}</div>
                <div style={{ color: '#98abbd', fontSize: 10.5 }}>{u.email ?? 'no email on file'}{u.unit ? ` · Unit ${u.unit}` : ''}</div>
              </div>
              <button onClick={() => pass(u, 'resend-pass')} disabled={!!busy} style={{ ...ICE, opacity: busy ? 0.5 : 1 }}>Send / resend pass</button>
              <button onClick={() => pass(u, 'revoke-pass')} disabled={!!busy} style={{ ...WARN, opacity: busy ? 0.5 : 1 }}>Revoke</button>
            </div>
          ))}
        </div>
      )}
      <div style={{ fontSize: 9.5, color: '#6f8397', marginTop: 8 }}>Send/resend issues a fresh Brivo Mobile Pass invite by email. Revoke turns off their pass.</div>
    </div>
  );
}

function Activity({ siteId }: { siteId: string }) {
  const [events, setEvents] = useState<Any[] | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => { fetch(`/api/brivo/events?site_id=${siteId}`, { cache: 'no-store' }).then(r => r.json()).then(j => { if (Array.isArray(j.events)) setEvents(j.events); else { setEvents([]); setErr(true); } }).catch(() => setErr(true)); }, [siteId]);

  if (err && !events?.length) return <NotConnected what="Brivo access control" />;
  if (events == null) return <Loader />;
  if (events.length === 0) return <div style={{ fontSize: 11.5, color: '#6f8397', padding: '10px 2px' }}>No recent door activity.</div>;
  const fmt = (t: string) => { const d = new Date(t); return isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 320, overflowY: 'auto' }}>
      {events.slice(0, 60).map((e, i) => {
        const label = e.summary ?? e.eventDescription ?? e.eventType ?? e.name ?? 'Access event';
        const who = e.actorName ?? e.userName ?? e.objectName ?? '';
        const when = e.occurred ?? e.eventOccurred ?? e.created ?? e.timestamp;
        const denied = /denied|reject|fail/i.test(String(label));
        return (
          <div key={e.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, padding: '5px 0', borderBottom: '1px solid rgba(140,170,200,0.08)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: denied ? '#f2637e' : '#7ee0a8', flexShrink: 0 }} />
            <span style={{ color: '#e2ebf4' }}>{String(label)}</span>
            {who && <span style={{ color: '#98abbd' }}>· {who}</span>}
            {when && <span style={{ color: '#7f96ab', marginLeft: 'auto' }}>{fmt(String(when))}</span>}
          </div>
        );
      })}
    </div>
  );
}
