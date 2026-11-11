'use client';

// PackagesTab — Systems → a property → Packages (Part 14 · package room).
//   Everyone with door access: today's numbers, Needs attention, every waiting box (search, filter,
//   timeline), office log, pickup at the desk, staff hold, return, waive fee, Service mode.
//   Setup (Gate Guard corporate or the dealer's admin): create the room, devices (Jetson / room
//   controller / door panel), day sections + LED ranges, fees, setup checklist → Go live,
//   and bench test data.
// API: /api/sites/[id]/packages · rules: lib/packages.ts · tables: migration 225.
// Pickup is always allowed — storage fees post to the resident's account, they never hold a box.
import React, { useCallback, useEffect, useState } from 'react';
import { type Any, type SiteCtx, getJson, send, Card, Dot, Note, Field, Sheet, DOT, MUTED, BLUE, GREEN, ORANGE, RED } from '@/components/nexus/systems/shared';

const TZ = 'America/New_York';
const money = (c: number) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`;
function when(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const day = d.toLocaleDateString('en-CA', { timeZone: TZ });
  const today = new Date().toLocaleDateString('en-CA', { timeZone: TZ });
  const t = d.toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).toLowerCase();
  if (day === today) return t;
  return `${d.toLocaleDateString('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric' })}, ${t}`;
}
const STATUS_DOT: Record<string, string> = { received: DOT.blue, notified: DOT.blue, unsorted: DOT.orange, staff_hold: DOT.gray, flagged: DOT.red, picked_up: DOT.green, returned: DOT.gray, abandoned: DOT.red };
const ROOM_STATUS: Record<string, { label: string; dot: string }> = { setup: { label: 'Setting up', dot: DOT.orange }, live: { label: 'Live', dot: DOT.green }, offline: { label: 'Offline', dot: DOT.gray } };
const KIND_LABEL: Record<string, string> = { day: 'Day section', oversized: 'Oversized (floor)', cold: 'Cold (fridge)', staff: 'Staff hold', unsorted: 'Unsorted (yellow)' };
const ENTRY: Record<string, string> = { label_scan: 'Scanned a label', amazon_key: 'Amazon Key', usps_key: 'USPS key', keypad: 'Keypad code', call: 'Opened on a call', app: 'Resident app', qr: 'QR code', text_code: 'Text code', key: 'Key', service: 'Service mode' };

const Swatch = ({ c, label }: { c?: string; label?: string }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}>
    <span aria-hidden style={{ width: 10, height: 22, borderRadius: 3, background: c || '#C7C7CC', flex: 'none' }} />{label}
  </span>
);

export function PackagesTab({ ctx }: { ctx: SiteCtx }) {
  const { siteId, notify } = ctx;
  const [data, setData] = useState<Any | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [filter, setFilter] = useState('waiting');
  const [q, setQ] = useState('');
  const [qLive, setQLive] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<null | 'log' | 'setup' | 'service' | 'new'>(null);
  const [detail, setDetail] = useState<string | null>(null);

  const load = useCallback(async () => {
    const p = new URLSearchParams({ filter }); if (roomId) p.set('room', roomId); if (qLive) p.set('q', qLive);
    const r = await getJson(`/api/sites/${siteId}/packages?${p}`);
    if (r.ok) { setData(r.data); setErr(null); } else setErr(r.data.error || 'Could not load packages.');
  }, [siteId, roomId, filter, qLive]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const t = setTimeout(() => setQLive(q), 300); return () => clearTimeout(t); }, [q]);
  useEffect(() => { const t = setInterval(() => { if (!document.hidden) void load(); }, 30000); return () => clearInterval(t); }, [load]);

  const act = useCallback(async (action: string, body: Any = {}, ok?: string) => {
    setBusy(true);
    const r = await send(`/api/sites/${siteId}/packages`, 'POST', { action, room_id: data?.room?.id, ...body });
    setBusy(false);
    if (!r.ok) { notify(r.data.error || 'That didn’t work.', false); return null; }
    if (ok) notify(ok);
    void load();
    return r.data;
  }, [siteId, data?.room?.id, notify, load]);

  if (err) return <Note tone="red">{err}</Note>;
  if (!data) return <div className="sy-empty">Loading packages…</div>;
  if (data.needs_migration) return <Note tone="orange">Package rooms need database migration 225. Run it on this database, then reload.</Note>;

  const canSetup = !!data.can_setup;
  if (!data.room) {
    return (
      <Card title="Package room" sub="Photographed in, watched on the shelf, tied to the household that took it.">
        <div style={{ display: 'grid', gap: 12 }}>
          <div className="sy-empty">No package room at this property yet.{data.units ? ` ${data.units} units — about ${Math.round(data.units / 50 * 12)} ft of 5-ft shelving.` : ''}</div>
          {canSetup ? <div><button type="button" className="sy-b pri" onClick={() => setOpen('new')}>Set up a package room</button></div>
            : <Note>Ask Gate Guard or your admin to set up the package room.</Note>}
        </div>
        {open === 'new' && <NewRoomSheet onClose={() => setOpen(null)} onCreate={async name => { const d = await act('create_room', { name }, 'Package room created'); if (d?.room) { setRoomId(d.room.id); setOpen('setup'); } }} />}
      </Card>
    );
  }

  const room = data.room as Any; const ov = data.overview as Any; const fees = data.fees as Any;
  const rs = ROOM_STATUS[room.status] ?? ROOM_STATUS.setup;
  const today = data.today_section as Any | null;
  const steps = (data.checklist_steps ?? []) as Any[];
  const done = (room.checklist ?? {}) as Any;
  const left = steps.filter(s => !done[s.key]).length;
  const tiles = [
    { l: 'Waiting', v: String(ov.waiting), s: ov.oldest_days ? `Oldest ${ov.oldest_days} day${ov.oldest_days === 1 ? '' : 's'}` : 'All fresh', dot: DOT.blue, f: 'waiting' },
    { l: 'Delivered today', v: String(ov.delivered_today), s: today ? `Today = ${today.name}` : 'No day sections', dot: DOT.blue, f: 'today' },
    { l: 'Picked up today', v: String(ov.picked_up_today), s: 'Logged when they leave', dot: DOT.green, f: 'picked_up' },
    { l: 'Needs attention', v: String(ov.needs_attention), s: ov.needs_attention ? `${ov.aging} waiting ${fees.free_days}+ days` : 'Nothing open', dot: ov.needs_attention ? DOT.orange : DOT.green, color: ov.needs_attention ? ORANGE : undefined, f: 'aging' },
    { l: 'Fees building', v: money(ov.fees_accruing_cents), s: `${fees.free_days} days free, then ${money(fees.daily_fee_cents)}/day`, dot: DOT.gray, f: 'aging' },
  ];

  return (
    <div className="sy-stack">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {(data.rooms ?? []).length > 1
            ? <select className="sy-in" style={{ width: 'auto' }} value={room.id} onChange={e => setRoomId(e.target.value)} aria-label="Package room">{(data.rooms as Any[]).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
            : <strong style={{ fontSize: 16 }}>{room.name}</strong>}
          <span className="sy-pill"><Dot c={rs.dot} />{rs.label}</span>
          {room.service_on && <span className="sy-pill" style={{ background: '#FFF4E5', color: ORANGE }}>Service until {when(room.service_until)}</span>}
          {room.edge_device_id && <span className="sy-pill">{room.edge_device_id}</span>}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="sy-b line" onClick={() => setOpen('service')}>{room.service_on ? 'Service mode on' : 'Service mode'}</button>
          <button type="button" className="sy-b line" onClick={() => setOpen('log')}>Log a package</button>
          {canSetup && <button type="button" className="sy-b line" onClick={() => setOpen('setup')}>Room setup</button>}
          {canSetup && <button type="button" className="sy-b line" onClick={() => setOpen('new')}>Add a room</button>}
        </div>
      </div>

      <div className="sy-kpis" style={{ marginBottom: 0 }}>
        {tiles.map(t => (
          <button key={t.l} type="button" className="sy-kpi" onClick={() => { setQ(''); setFilter(t.f); }}>
            <div className="l"><Dot c={t.dot} />{t.l}</div>
            <div className="v" style={{ color: t.color }}>{t.v}</div>
            <div className="s">{t.s}</div>
          </button>
        ))}
      </div>

      {room.status !== 'live' && (
        <Card title={room.status === 'offline' ? 'Room is offline' : `Setup checklist · ${steps.length - left} of ${steps.length} done`}
          sub={room.status === 'offline' ? 'Residents and staff can’t use it until it’s back online.' : 'Finish every step, then go live. Until then the property portal shows it as “Being set up”.'}
          right={canSetup && <button type="button" className="sy-b pri sm" disabled={busy || (left > 0 && room.status !== 'offline')} onClick={() => act('go_live', {}, 'Package room is live')}>{room.status === 'offline' ? 'Bring back online' : 'Go live'}</button>}>
          <div>
            {steps.map(s => {
              const d = done[s.key];
              return (
                <div key={s.key} className="sy-row">
                  <input type="checkbox" id={`pk-step-${s.key}`} checked={!!d} disabled={!canSetup || busy} onChange={e => act('check', { key: s.key, done: e.target.checked })} style={{ width: 18, height: 18, accentColor: GREEN }} />
                  <label htmlFor={`pk-step-${s.key}`} className="main" style={{ cursor: canSetup ? 'pointer' : 'default' }}>
                    <div className="t">{s.label}</div>
                    <div className="m">{d ? `Done ${when(d.at)} · ${d.by}` : s.help}</div>
                  </label>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className="sy-split">
        <Card title="Packages" sub={qLive ? `Search results for “${qLive}”` : filter === 'waiting' ? 'Everything still in the room' : filter === 'today' ? 'Delivered today' : filter === 'picked_up' ? 'Picked up in the last 2 days' : `Waiting ${fees.free_days}+ days`}
          right={<input className="sy-in" style={{ width: 220 }} placeholder="Name, unit or tracking" value={q} onChange={e => setQ(e.target.value)} aria-label="Search packages" />}>
          <div className="sy-chips" style={{ marginBottom: 8 }}>
            {[['waiting', 'Waiting'], ['today', 'Today'], ['picked_up', 'Picked up'], ['aging', `${fees.free_days}+ days`]].map(([k, l]) => (
              <button key={k} type="button" className="sy-chip" aria-pressed={!qLive && filter === k} onClick={() => { setQ(''); setFilter(k); }}>{l}</button>
            ))}
          </div>
          <div className="sy-feed">
            {(data.packages as Any[]).length === 0 && <div className="sy-empty">{qLive ? 'No packages match.' : 'No packages here.'}</div>}
            {(data.packages as Any[]).map(p => (
              <button key={p.id} type="button" className="sy-row" onClick={() => setDetail(p.id)} style={{ width: '100%', background: 'none', border: 0, borderTop: '1px solid rgba(0,0,0,0.08)', font: 'inherit', color: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
                <span aria-hidden style={{ width: 10, height: 34, borderRadius: 3, background: p.section?.color || '#E5E5EA', flex: 'none' }} />
                <div className="main">
                  <div className="t">{p.unit ? `Unit ${p.unit}` : 'No unit yet'}{p.recipient_name ? ` · ${p.recipient_name}` : ''}</div>
                  <div className="m">{[p.carrier, when(p.received_at), p.section?.name, p.size === 'oversized' ? 'oversized' : null, ...(p.flags ?? [])].filter(Boolean).join(' · ')}</div>
                </div>
                {p.fee_now > 0 && <span className="sy-pill" style={{ color: ORANGE }}>{money(p.fee_now)}</span>}
                <span className="sy-pill"><Dot c={STATUS_DOT[p.status] ?? DOT.gray} />{p.status_label}{p.status !== 'picked_up' && p.days ? ` · ${p.days}d` : ''}</span>
              </button>
            ))}
          </div>
        </Card>

        <div className="sy-stack">
          <Card title="Needs attention" sub={ov.needs_attention ? undefined : 'Nothing open'}>
            {(data.exceptions as Any[]).length === 0 && (data.aging as Any[]).length === 0 && <div className="sy-empty">All clear.</div>}
            {(data.exceptions as Any[]).map(e => (
              <div key={e.id} className="sy-row">
                <Dot c={e.severity === 'alert' ? DOT.red : DOT.orange} />
                <div className="main"><div className="t">{e.title}</div><div className="m">{[e.label, when(e.created_at), e.detail].filter(Boolean).join(' · ')}</div></div>
                {e.package_id && <button type="button" className="sy-b line sm" onClick={() => setDetail(e.package_id)}>Open</button>}
                <button type="button" className="sy-b go sm" disabled={busy} onClick={() => act('resolve', { id: e.id, resolution: 'Handled in Nexus' }, 'Marked handled')}>Handled</button>
              </div>
            ))}
            {(data.aging as Any[]).slice(0, 8).map(p => (
              <button key={p.id} type="button" className="sy-row" onClick={() => setDetail(p.id)} style={{ width: '100%', background: 'none', border: 0, borderTop: '1px solid rgba(0,0,0,0.08)', font: 'inherit', color: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
                <Dot c={DOT.orange} />
                <div className="main"><div className="t">Unit {p.unit || '—'} · waiting {p.days} days</div><div className="m">{[p.recipient_name, p.section?.name, p.fee_now ? `${money(p.fee_now)} so far` : null].filter(Boolean).join(' · ')}</div></div>
              </button>
            ))}
          </Card>

          <Card title="Sections" sub={today ? `Drivers are filling ${today.name} today` : 'Add day sections in Room setup'}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 8 }}>
              {(data.sections as Any[]).map(s => (
                <div key={s.id} style={{ border: `1px solid ${today?.id === s.id ? BLUE : 'rgba(0,0,0,0.08)'}`, borderRadius: 10, padding: '8px 10px', boxShadow: today?.id === s.id ? '0 0 0 2px rgba(0,113,227,.15)' : undefined }}>
                  <Swatch c={s.color} label={s.name} />
                  <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>{s.waiting} waiting{s.kind !== 'day' ? ` · ${KIND_LABEL[s.kind].split(' (')[0].toLowerCase()}` : ''}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Recent visits" sub="Deliveries and pickups through the door">
            {(data.sessions as Any[]).length === 0 && <div className="sy-empty">No visits yet. The room’s Jetson reports each one.</div>}
            {(data.sessions as Any[]).map(s => {
              const short = s.kind === 'delivery' && s.boxes_seen != null && s.boxes_seen > s.boxes_scanned;
              return (
                <div key={s.id} className="sy-row">
                  <Dot c={short ? DOT.orange : DOT.blue} />
                  <div className="main">
                    <div className="t">{s.kind === 'delivery' ? `${s.carrier || 'Delivery'} · ${s.boxes_scanned} box${s.boxes_scanned === 1 ? '' : 'es'}` : s.kind === 'pickup' ? `Pickup${s.actor_name ? ` · ${s.actor_name}` : ''}` : s.kind === 'service' ? 'Service visit' : 'Staff'}</div>
                    <div className="m">{[when(s.started_at), ENTRY[s.entry_method] ?? s.entry_method, short ? `camera saw ${s.boxes_seen}` : null, s.source === 'test' ? 'test' : null].filter(Boolean).join(' · ')}</div>
                  </div>
                </div>
              );
            })}
          </Card>
        </div>
      </div>

      {open === 'log' && <LogSheet sections={data.sections} onClose={() => setOpen(null)} onSave={async b => { const d = await act('log_package', b, 'Package logged'); if (d) setOpen(null); }} busy={busy} />}
      {open === 'service' && <ServiceSheet room={room} busy={busy} onClose={() => setOpen(null)} onSet={async (minutes, note) => { const d = await act('service', { minutes, note }, minutes ? `Service mode on for ${minutes >= 60 ? `${minutes / 60} h` : `${minutes} min`}` : 'Service mode off'); if (d) setOpen(null); }} />}
      {open === 'setup' && canSetup && <SetupSheet room={room} data={data} isCorporate={ctx.isCorporate} busy={busy} act={act} onClose={() => setOpen(null)} />}
      {open === 'new' && <NewRoomSheet onClose={() => setOpen(null)} onCreate={async name => { const d = await act('create_room', { name }, 'Package room created'); if (d?.room) { setRoomId(d.room.id); setOpen('setup'); } }} />}
      {detail && <DetailSheet siteId={siteId} roomId={room.id} id={detail} busy={busy} act={act} onClose={() => setDetail(null)} />}
    </div>
  );
}

function NewRoomSheet({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string) => void }) {
  const [name, setName] = useState('Package Room');
  return (
    <Sheet title="New package room" sub="Each room gets its own Jetson and room controller." onClose={onClose} width={440}>
      <Field label="Room name"><input className="sy-in" id="pk-new-name" value={name} onChange={e => setName(e.target.value)} /></Field>
      <Note>Day sections are added for you (5 under 120 units, 8 above) plus Floor, Fridge, Staff hold and the yellow Unsorted shelf. You can change them in Room setup.</Note>
      <div><button type="button" className="sy-b pri" onClick={() => onCreate(name)}>Create room</button></div>
    </Sheet>
  );
}

function LogSheet({ sections, onClose, onSave, busy }: { sections: Any[]; onClose: () => void; onSave: (b: Any) => void; busy: boolean }) {
  const [f, setF] = useState<Any>({ recipient_name: '', unit: '', carrier: '', tracking: '', size: 'box', flags: [] as string[], staff_hold: false, section_id: '', notes: '' });
  const set = (k: string, v: unknown) => setF((p: Any) => ({ ...p, [k]: v }));
  const flag = (k: string) => set('flags', f.flags.includes(k) ? f.flags.filter((x: string) => x !== k) : [...f.flags, k]);
  return (
    <Sheet title="Log a package" sub="For a box taken at the office or entered by hand. It goes in today’s section unless you pick one." onClose={onClose} width={520}>
      <div className="sy-grid2">
        <Field label="Unit"><input className="sy-in" id="pk-log-unit" value={f.unit} onChange={e => set('unit', e.target.value)} autoFocus /></Field>
        <Field label="Name on the label"><input className="sy-in" id="pk-log-name" value={f.recipient_name} onChange={e => set('recipient_name', e.target.value)} /></Field>
        <Field label="Carrier"><select className="sy-in" id="pk-log-carrier" value={f.carrier} onChange={e => set('carrier', e.target.value)}><option value="">From tracking number</option>{['UPS', 'FedEx', 'USPS', 'Amazon', 'DHL', 'OnTrac', 'Veho', 'Other'].map(c => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Tracking number (optional)"><input className="sy-in" id="pk-log-tracking" value={f.tracking} onChange={e => set('tracking', e.target.value)} /></Field>
        <Field label="Size"><select className="sy-in" id="pk-log-size" value={f.size} onChange={e => set('size', e.target.value)}><option value="envelope">Envelope</option><option value="box">Box</option><option value="oversized">Oversized</option></select></Field>
        <Field label="Where it goes"><select className="sy-in" id="pk-log-section" value={f.section_id} onChange={e => set('section_id', e.target.value)}><option value="">Automatic</option>{sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
      </div>
      <div className="sy-chips">
        {[['cold', 'Cold'], ['medication', 'Medication'], ['signature', 'Signature'], ['damaged', 'Damaged']].map(([k, l]) => <button key={k} type="button" className="sy-chip" aria-pressed={f.flags.includes(k)} onClick={() => flag(k)}>{l}</button>)}
        <button type="button" className="sy-chip" aria-pressed={f.staff_hold} onClick={() => set('staff_hold', !f.staff_hold)}>Staff hold</button>
      </div>
      <Field label="Note (optional)"><textarea className="sy-in" id="pk-log-notes" rows={2} value={f.notes} onChange={e => set('notes', e.target.value)} /></Field>
      <div><button type="button" className="sy-b pri" disabled={busy || (!f.unit.trim() && !f.recipient_name.trim())} onClick={() => onSave({ ...f, section_id: f.section_id || undefined, carrier: f.carrier || undefined })}>Log package</button></div>
    </Sheet>
  );
}

function ServiceSheet({ room, busy, onClose, onSet }: { room: Any; busy: boolean; onClose: () => void; onSet: (minutes: number, note: string) => void }) {
  const [note, setNote] = useState('');
  return (
    <Sheet title="Service mode" sub="Unlocks the door for maintenance, pauses people-in-room alerts and holds package alerts. Cameras keep recording. Ends on its own." onClose={onClose} width={460}>
      {room.service_on ? <Note tone="orange">On until {when(room.service_until)}{room.service_by ? ` · started by ${room.service_by}` : ''}{room.service_note ? ` · ${room.service_note}` : ''}</Note> : null}
      <Field label="What’s the work? (optional)"><input className="sy-in" id="pk-svc-note" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. replacing a shelf light" /></Field>
      <div className="sy-chips">
        {[[15, '15 min'], [60, '1 hour'], [240, '4 hours']].map(([m, l]) => <button key={m} type="button" className="sy-b line" disabled={busy} onClick={() => onSet(Number(m), note)}>{l}</button>)}
        {room.service_on && <button type="button" className="sy-b warn" disabled={busy} onClick={() => onSet(0, '')}>End now</button>}
      </div>
      <div style={{ fontSize: 12, color: MUTED }}>The room’s Jetson picks this up on its next check-in.</div>
    </Sheet>
  );
}

function SetupSheet({ room, data, isCorporate, busy, act, onClose }: { room: Any; data: Any; isCorporate: boolean; busy: boolean; act: (a: string, b?: Any, ok?: string) => Promise<Any | null>; onClose: () => void }) {
  const fees = data.fees as Any;
  const [f, setF] = useState<Any>({ name: room.name, edge_device_id: room.edge_device_id ?? '', controller_id: room.controller_id ?? '', door_panel_id: room.door_panel_id ?? '', free_days: fees.free_days, daily: (fees.daily_fee_cents / 100).toFixed(2), cap: (fees.fee_cap_cents / 100).toFixed(2), share: (fees.property_share_cents / 100).toFixed(2), confirmed: !!fees.confirmed });
  const [secs, setSecs] = useState<Any[]>(() => (data.sections as Any[]).map(s => ({ ...s, led_start: s.led_start ?? '', led_end: s.led_end ?? '' })));
  const set = (k: string, v: unknown) => setF((p: Any) => ({ ...p, [k]: v }));
  const setSec = (i: number, k: string, v: unknown) => setSecs(p => p.map((s, j) => (j === i ? { ...s, [k]: v } : s)));
  const colors = (data.colors ?? []) as Any[];
  const cents = (v: string) => Math.round(Number(v || 0) * 100);
  return (
    <Sheet title="Room setup" sub={`${room.name} · devices, fees and sections`} onClose={onClose} width={720}>
      <section style={{ display: 'grid', gap: 10 }}>
        <strong style={{ fontSize: 14 }}>Room + devices</strong>
        <div className="sy-grid2">
          <Field label="Room name"><input className="sy-in" id="pk-s-name" value={f.name} onChange={e => set('name', e.target.value)} /></Field>
          <Field label="Jetson (Nexus Edge id)"><input className="sy-in" id="pk-s-edge" value={f.edge_device_id} onChange={e => set('edge_device_id', e.target.value)} placeholder="gge-00012" /></Field>
          <Field label="Room controller (ESP32)"><input className="sy-in" id="pk-s-ctl" value={f.controller_id} onChange={e => set('controller_id', e.target.value)} placeholder="ggc-00012" /></Field>
          <Field label="Door panel"><input className="sy-in" id="pk-s-panel" value={f.door_panel_id} onChange={e => set('door_panel_id', e.target.value)} placeholder="ggp-00012" /></Field>
        </div>
      </section>
      <section style={{ display: 'grid', gap: 10 }}>
        <strong style={{ fontSize: 14 }}>Storage fees</strong>
        {!fees.confirmed && <Note tone="orange">These are the starting numbers, not yet confirmed by Gate Guard. Pickup is always allowed — fees post to the resident’s account.</Note>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 10 }}>
          <Field label="Free days"><input className="sy-in" id="pk-s-free" type="number" min={0} value={f.free_days} onChange={e => set('free_days', e.target.value)} /></Field>
          <Field label="Then per day ($)"><input className="sy-in" id="pk-s-daily" type="number" min={0} step="0.5" value={f.daily} onChange={e => set('daily', e.target.value)} /></Field>
          <Field label="Cap per package ($)"><input className="sy-in" id="pk-s-cap" type="number" min={0} step="1" value={f.cap} onChange={e => set('cap', e.target.value)} /></Field>
          <Field label="Property share / day ($)"><input className="sy-in" id="pk-s-share" type="number" min={0} step="0.5" value={f.share} onChange={e => set('share', e.target.value)} /></Field>
        </div>
        {isCorporate && <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}><input type="checkbox" id="pk-s-confirmed" checked={!!f.confirmed} onChange={e => set('confirmed', e.target.checked)} />Fees confirmed by Gate Guard</label>}
        <div><button type="button" className="sy-b pri" disabled={busy} onClick={() => act('save_room', { name: f.name, edge_device_id: f.edge_device_id, controller_id: f.controller_id, door_panel_id: f.door_panel_id, fees: { free_days: Number(f.free_days), daily_fee_cents: cents(f.daily), fee_cap_cents: cents(f.cap), property_share_cents: cents(f.share), ...(isCorporate ? { confirmed: !!f.confirmed } : {}) } }, 'Room saved')}>Save room + fees</button></div>
      </section>
      <section style={{ display: 'grid', gap: 10 }}>
        <strong style={{ fontSize: 14 }}>Sections</strong>
        <div style={{ fontSize: 12, color: MUTED }}>Day sections rotate: each day’s deliveries fill the next empty one. LED range = the light strip addresses on that bay’s upright.</div>
        <div style={{ display: 'grid', gap: 6 }}>
          {secs.map((s, i) => (
            <div key={s.id ?? `n${i}`} style={{ display: 'grid', gridTemplateColumns: '28px minmax(0,1.3fr) minmax(0,1.3fr) 72px 72px 30px', gap: 6, alignItems: 'center' }}>
              <input type="color" aria-label={`${s.name} color`} value={s.color} onChange={e => setSec(i, 'color', e.target.value)} style={{ width: 28, height: 28, border: 0, padding: 0, background: 'none' }} />
              <input className="sy-in" aria-label="Section name" value={s.name} onChange={e => setSec(i, 'name', e.target.value)} />
              <select className="sy-in" aria-label="Kind" value={s.kind} onChange={e => setSec(i, 'kind', e.target.value)}>{Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              <input className="sy-in" aria-label="First LED" type="number" placeholder="LED from" value={s.led_start} onChange={e => setSec(i, 'led_start', e.target.value)} />
              <input className="sy-in" aria-label="Last LED" type="number" placeholder="to" value={s.led_end} onChange={e => setSec(i, 'led_end', e.target.value)} />
              <button type="button" className="sy-b line sm" aria-label={`Remove ${s.name}`} onClick={() => setSecs(p => p.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="sy-b line" onClick={() => { const used = new Set(secs.map(s => s.name)); const c = colors.find(x => !used.has(x.name)) ?? { name: `Section ${secs.length + 1}`, color: '#2F6FE0' }; setSecs(p => [...p, { name: c.name, color: c.color, kind: 'day', sort: p.filter(x => x.kind === 'day').length, led_start: '', led_end: '' }]); }}>Add a day section</button>
          <button type="button" className="sy-b pri" disabled={busy} onClick={() => act('save_sections', { sections: secs.map((s, i) => ({ ...s, sort: s.kind === 'day' ? i : 100 + i })) }, 'Sections saved')}>Save sections</button>
        </div>
      </section>
      <section style={{ display: 'grid', gap: 10 }}>
        <strong style={{ fontSize: 14 }}>Bench test data</strong>
        <div style={{ fontSize: 12, color: MUTED }}>Adds 7 sample packages, a UPS delivery and two Needs-attention items (marked test) so the property pages have something to show before the Jetson is connected.</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="sy-b line" disabled={busy} onClick={() => act('seed_test', {}, 'Test packages added')}>Add test packages</button>
          <button type="button" className="sy-b warn" disabled={busy} onClick={() => act('clear_test', {}, 'Test data removed')}>Remove test data</button>
          {room.status === 'live' && <button type="button" className="sy-b warn" disabled={busy} onClick={() => act('take_offline', {}, 'Room taken offline')}>Take room offline</button>}
          {room.status === 'setup' && isCorporate && <button type="button" className="sy-b line" disabled={busy} onClick={() => act('go_live', { override: true }, 'Room is live (checklist skipped)')}>Go live without checklist</button>}
        </div>
      </section>
    </Sheet>
  );
}

function DetailSheet({ siteId, roomId, id, busy, act, onClose }: { siteId: string; roomId: string; id: string; busy: boolean; act: (a: string, b?: Any, ok?: string) => Promise<Any | null>; onClose: () => void }) {
  const [d, setD] = useState<Any | null>(null);
  const [unit, setUnit] = useState(''); const [name, setName] = useState(''); const [note, setNote] = useState('');
  const load = useCallback(async () => {
    const r = await getJson(`/api/sites/${siteId}/packages?room=${roomId}&package=${id}`);
    if (r.ok) { setD(r.data); setUnit(r.data.package.unit ?? ''); setName(r.data.package.recipient_name ?? ''); }
  }, [siteId, roomId, id]);
  useEffect(() => { void load(); }, [load]);
  const run = async (a: string, b: Any = {}, ok?: string) => { const r = await act(a, { id, ...b }, ok); if (r) void load(); };
  const p = d?.package as Any | undefined;
  const gone = p && ['picked_up', 'returned'].includes(p.status);
  return (
    <Sheet title={p ? (p.unit ? `Unit ${p.unit}` : 'Unassigned package') : 'Package'} sub={p ? [p.recipient_name, p.carrier, p.tracking].filter(Boolean).join(' · ') : undefined} onClose={onClose} width={560}>
      {!p ? <div className="sy-empty">Loading…</div> : (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="sy-pill"><Dot c={STATUS_DOT[p.status] ?? DOT.gray} />{p.status_label}</span>
            {p.section && <span className="sy-pill"><span aria-hidden style={{ width: 8, height: 14, borderRadius: 2, background: p.section.color }} />{p.section.name}{p.spot ? ` · ${p.spot}` : ''}</span>}
            <span className="sy-pill">{p.days} day{p.days === 1 ? '' : 's'}</span>
            {p.fee_waived ? <span className="sy-pill">Fee waived</span> : p.fee_now > 0 ? <span className="sy-pill" style={{ color: ORANGE }}>{money(p.fee_now)}{p.status === 'picked_up' ? ' posted' : ' so far'}</span> : !gone ? <span className="sy-pill">Free until {when(p.free_until)}</span> : null}
            {(p.flags ?? []).map((x: string) => <span key={x} className="sy-pill" style={{ color: x === 'damaged' ? RED : undefined }}>{x}</span>)}
          </div>
          {(p.label_photo_url || p.shelf_photo_url) && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
              {p.label_photo_url && <img src={p.label_photo_url} alt="Shipping label" style={{ width: '100%', borderRadius: 10 }} />}
              {p.shelf_photo_url && <img src={p.shelf_photo_url} alt="Where it is on the shelf" style={{ width: '100%', borderRadius: 10 }} />}
            </div>
          )}
          {!gone && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="sy-b pri" disabled={busy} onClick={() => run('pickup', {}, 'Marked picked up')}>Picked up at the desk</button>
              {p.status === 'staff_hold' ? <button type="button" className="sy-b line" disabled={busy} onClick={() => run('release', {}, 'Released from staff hold')}>Release hold</button>
                : <button type="button" className="sy-b line" disabled={busy} onClick={() => run('hold', {}, 'On staff hold')}>Staff hold</button>}
              {!p.fee_waived && p.fee_now > 0 && <button type="button" className="sy-b line" disabled={busy} onClick={() => run('waive', {}, 'Fee waived')}>Waive fee</button>}
              <button type="button" className="sy-b warn" disabled={busy} onClick={() => run('return', {}, 'Marked returned to sender')}>Return to sender</button>
            </div>
          )}
          {!gone && (
            <div style={{ display: 'grid', gridTemplateColumns: '90px minmax(0,1fr) auto', gap: 8, alignItems: 'end' }}>
              <Field label="Unit"><input className="sy-in" id="pk-d-unit" value={unit} onChange={e => setUnit(e.target.value)} /></Field>
              <Field label="Name"><input className="sy-in" id="pk-d-name" value={name} onChange={e => setName(e.target.value)} /></Field>
              <button type="button" className="sy-b line" disabled={busy || !unit.trim()} onClick={() => run('assign', { unit, recipient_name: name }, 'Saved')}>Save</button>
            </div>
          )}
          <div>
            <strong style={{ fontSize: 14 }}>Timeline</strong>
            {(d!.events as Any[]).length === 0 && <div className="sy-empty">No history yet.</div>}
            {(d!.events as Any[]).map(e => (
              <div key={e.id} className="sy-row">
                <div className="main"><div className="t" style={{ fontSize: 13 }}>{e.kind.replace(/_/g, ' ').replace(/^./, (c: string) => c.toUpperCase())}{e.detail?.text ? ` — ${e.detail.text}` : ''}{e.detail?.fee_cents ? ` · ${money(e.detail.fee_cents)} to their account` : ''}</div><div className="m">{when(e.created_at)} · {e.actor}{e.detail?.via === 'portal' ? ' (property portal)' : ''}</div></div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 8 }}>
            <input className="sy-in" id="pk-d-note" placeholder="Add a note" value={note} onChange={e => setNote(e.target.value)} />
            <button type="button" className="sy-b line" disabled={busy || !note.trim()} onClick={async () => { await run('note', { text: note }); setNote(''); }}>Add</button>
          </div>
        </>
      )}
    </Sheet>
  );
}
