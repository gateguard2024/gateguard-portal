'use client';

// Per-site vendor connections — Systems → Setup & keys. 🔒 CORPORATE ONLY: the
// caller only renders this for corporate users, and every endpoint it calls
// (/api/sites/[id]/integrations, /api/eagle-eye/connect, /api/unifi/cloud/sites)
// refuses non-corporate server-side. Credentials are encrypted server-side and
// never returned. UI-only field metadata — no secrets or server crypto here.
import React, { useCallback, useEffect, useState } from 'react';
import { type Any, BLUE, Dot, DOT, Field, MUTED, Note, getJson, send } from '@/components/nexus/systems/shared';

type Vendor = 'brivo' | 'eagle_eye' | 'shelly' | 'unifi';
type FieldDef = { key: string; label: string; secret?: boolean; placeholder?: string; advanced?: boolean };

const VENDORS: { vendor: Vendor; label: string; what: string; fields: FieldDef[] }[] = [
  { vendor: 'brivo', label: 'Brivo', what: 'Doors, people, door activity', fields: [
    { key: 'username', label: 'Brivo username' }, { key: 'password', label: 'Brivo password', secret: true },
    { key: 'api_key', label: 'API key', secret: true }, { key: 'client_id', label: 'Client ID' }, { key: 'client_secret', label: 'Client secret', secret: true },
    { key: 'site_id', label: 'Brivo site ID', placeholder: 'e.g. 123456' },
    { key: 'credential_value', label: 'Remote-unlock credential value', secret: true, placeholder: 'not needed for the Unlock button', advanced: true } ] },
  { vendor: 'eagle_eye', label: 'Eagle Eye', what: 'Cameras, recordings, camera events', fields: [
    { key: 'client_id', label: 'EEN client ID' }, { key: 'client_secret', label: 'EEN client secret', secret: true } ] },
  { vendor: 'shelly', label: 'Shelly', what: 'Relays, gate pulse, power', fields: [
    { key: 'auth_key', label: 'Cloud auth key', secret: true }, { key: 'server', label: 'Cloud server', placeholder: 'shelly-12-eu.shelly.cloud' },
    { key: 'device_tag', label: 'Property tag in device names', placeholder: 'defaults to the property name' } ] },
  { vendor: 'unifi', label: 'UniFi', what: 'Internet, network gear, clients', fields: [
    { key: 'cloud_api_key', label: 'Cloud API key (unifi.ui.com)', secret: true },
    { key: 'cloud_site_id', label: 'Cloud site ID', placeholder: 'or use “Find my UniFi sites”' },
    { key: 'cloud_host_id', label: 'Cloud host ID', advanced: true } ] },
];
type Status = { vendor: Vendor; configured: boolean; status: string | null; last_verified_at: string | null; last_error: string | null };

export function SiteConnections({ siteId, onChanged }: { siteId: string; onChanged?: () => void }) {
  const [statuses, setStatuses] = useState<Status[] | null>(null);
  const [keyOk, setKeyOk] = useState(true);
  const [open, setOpen] = useState<Vendor | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [cloudSites, setCloudSites] = useState<Any[]>([]);
  const [adv, setAdv] = useState(false);

  const load = useCallback(async () => {
    const r = await getJson(`/api/sites/${siteId}/integrations`);
    if (!r.ok) { setMsg({ t: r.data.error || 'Couldn’t load connections.', ok: false }); setStatuses([]); return; }
    setStatuses(r.data.integrations ?? []); setKeyOk(r.data.key_configured !== false);
  }, [siteId]);
  useEffect(() => { void load(); }, [load]);

  const statusOf = (v: Vendor) => (statuses ?? []).find(s => s.vendor === v);
  const chip = (s?: Status) => !s?.configured ? { t: 'Not set up', c: DOT.gray } : s.status === 'verified' ? { t: 'Working', c: DOT.green } : s.status === 'error' ? { t: 'Error', c: DOT.red } : { t: 'Saved, not tested', c: DOT.orange };

  async function save(vendor: Vendor) {
    if (!Object.values(form).some(v => v.trim())) { setMsg({ t: 'Fill in at least one field.', ok: false }); return; }
    setBusy(true); setMsg(null);
    const r = await send(`/api/sites/${siteId}/integrations`, 'PUT', { vendor, credentials: form });
    setBusy(false);
    if (!r.ok || !r.data.ok) { setMsg({ t: r.data.error || 'Couldn’t save.', ok: false }); return; }
    setMsg({ t: vendor === 'eagle_eye' ? 'Saved. Now tap “Connect Eagle Eye” to approve access.' : 'Saved. Tap Test to check it.', ok: true });
    setForm({}); if (vendor !== 'eagle_eye') setOpen(null); await load(); onChanged?.();
  }
  async function test(vendor: Vendor) {
    setBusy(true); setMsg(null);
    const r = await send(`/api/sites/${siteId}/integrations`, 'POST', { action: 'test', vendor });
    setBusy(false);
    setMsg(r.data.verified ? { t: 'Connection works.', ok: true } : { t: r.data.note || r.data.error || 'Test finished — check the status.', ok: !!r.ok && !r.data.error });
    await load(); onChanged?.();
  }
  async function remove(vendor: Vendor, label: string) {
    if (!window.confirm(`Remove the ${label} login for this property? Its systems stop showing until it’s added again.`)) return;
    setBusy(true); setMsg(null);
    const r = await send(`/api/sites/${siteId}/integrations?vendor=${vendor}`, 'DELETE');
    setBusy(false);
    if (!r.ok || !r.data.ok) { setMsg({ t: r.data.error || 'Couldn’t remove.', ok: false }); return; }
    setMsg({ t: `${label} removed.`, ok: true }); setOpen(null); await load(); onChanged?.();
  }
  async function findUniFiSites() {
    setBusy(true); setMsg(null);
    if (Object.values(form).some(v => v.trim())) {
      const s = await send(`/api/sites/${siteId}/integrations`, 'PUT', { vendor: 'unifi', credentials: form });
      if (!s.ok) { setBusy(false); setMsg({ t: s.data.error || 'Couldn’t save the key.', ok: false }); return; }
    }
    const r = await getJson(`/api/unifi/cloud/sites?site_id=${siteId}`);
    setBusy(false);
    if (r.data.sites?.length) { setCloudSites(r.data.sites); void load(); }
    else { setCloudSites([]); setMsg({ t: r.data.error || 'No UniFi sites came back for this key — check the Cloud API key.', ok: false }); }
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <Note>Each property’s own logins. Stored encrypted and never shown again — to change one, enter it again. Only Gate Guard corporate can see this.</Note>
      {!keyOk && <Note tone="red">The server’s encryption key (CREDENTIALS_ENC_KEY) isn’t set, so saving is off until it is.</Note>}
      {msg && <Note tone={msg.ok ? 'green' : 'red'}>{msg.t}</Note>}
      {statuses == null ? <div className="sy-empty">Loading…</div> : VENDORS.map(({ vendor, label, what, fields }) => {
        const s = statusOf(vendor); const c = chip(s); const isOpen = open === vendor;
        return (
          <div key={vendor} style={{ border: '1px solid rgba(0,0,0,.1)', borderRadius: 12, padding: 12 }}>
            <div className="sy-row" style={{ padding: 0, borderTop: 0 }}>
              <div className="main"><div className="t">{label}</div><div className="m">{what}</div></div>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: MUTED }}><Dot c={c.c} />{c.t}</span>
              <button type="button" className="sy-b line sm" onClick={() => { setOpen(isOpen ? null : vendor); setForm({}); setMsg(null); setCloudSites([]); setAdv(false); }}>{isOpen ? 'Cancel' : s?.configured ? 'Change' : 'Set up'}</button>
            </div>
            {s?.last_error && !isOpen && <div style={{ fontSize: 12, color: '#D70015', marginTop: 6 }}>{s.last_error}</div>}
            {isOpen && (
              <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                {fields.filter(f => !f.advanced || adv).map(f => (
                  <Field key={f.key} label={f.label}>
                    <input className="sy-in" type={f.secret ? 'password' : 'text'} autoComplete="new-password" placeholder={f.placeholder ?? ''} value={form[f.key] ?? ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
                  </Field>
                ))}
                {fields.some(f => f.advanced) && <button type="button" onClick={() => setAdv(v => !v)} style={{ justifySelf: 'start', border: 0, background: 'none', padding: 0, color: BLUE, font: 'inherit', fontSize: 13, cursor: 'pointer' }}>{adv ? 'Hide optional fields' : 'Optional fields'}</button>}
                {vendor === 'unifi' && <div style={{ display: 'grid', gap: 8 }}>
                  <button type="button" className="sy-b line sm" style={{ justifySelf: 'start' }} onClick={findUniFiSites} disabled={busy}>{busy ? 'Looking…' : 'Find my UniFi sites'}</button>
                  {cloudSites.length > 0 && <select className="sy-in" aria-label="UniFi site" value={form.cloud_site_id ?? ''} onChange={e => { const x = cloudSites.find(y => y.site_id === e.target.value); setForm(p => ({ ...p, cloud_site_id: e.target.value, cloud_host_id: x?.host_id ?? p.cloud_host_id ?? '' })); }}>
                    <option value="">Pick this property’s UniFi site…</option>
                    {cloudSites.map(x => <option key={x.site_id} value={x.site_id}>{x.name}{x.host_name ? ` · ${x.host_name}` : ''}</option>)}
                  </select>}
                </div>}
                <div className="sy-acts">
                  <button type="button" className="sy-b pri sm" onClick={() => save(vendor)} disabled={busy || !keyOk}>{busy ? 'Saving…' : 'Save'}</button>
                  {s?.configured && vendor !== 'eagle_eye' && <button type="button" className="sy-b line sm" onClick={() => test(vendor)} disabled={busy}>Test</button>}
                  {s?.configured && vendor === 'eagle_eye' && <button type="button" className="sy-b line sm" onClick={() => { window.location.href = `/api/eagle-eye/connect?site_id=${siteId}`; }}>{s.status === 'verified' ? 'Reconnect Eagle Eye' : 'Connect Eagle Eye'}</button>}
                  {s?.configured && <button type="button" className="sy-b warn sm" style={{ marginLeft: 'auto' }} onClick={() => remove(vendor, label)} disabled={busy}>Remove</button>}
                </div>
              </div>
            )}
          </div>
        );
      })}
      <SiteQuickBooks siteId={siteId} />
    </div>
  );
}

// This property's QuickBooks customer (bulk matching lives in Admin → QuickBooks).
function SiteQuickBooks({ siteId }: { siteId: string }) {
  const [data, setData] = useState<{ connected: boolean; current: { id: string; name: string } | null; customers: { id: string; name: string }[] } | null>(null);
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const load = useCallback(async () => { const r = await getJson(`/api/sites/${siteId}/qbo-customer`); if (r.ok) { setData(r.data as never); setPick(r.data?.current?.id ?? ''); } }, [siteId]);
  useEffect(() => { void load(); }, [load]);
  async function save() {
    setBusy(true); setMsg(null);
    const r = await send(`/api/sites/${siteId}/qbo-customer`, 'POST', { qbo_customer_id: pick || null, qbo_customer_name: data?.customers.find(c => c.id === pick)?.name ?? null });
    setBusy(false);
    if (r.ok && r.data.ok) { setMsg({ t: 'Saved.', ok: true }); void load(); } else setMsg({ t: r.data.error || 'Couldn’t save.', ok: false });
  }
  if (!data) return null;
  return (
    <div style={{ border: '1px solid rgba(0,0,0,.1)', borderRadius: 12, padding: 12, display: 'grid', gap: 10 }}>
      <div className="sy-row" style={{ padding: 0, borderTop: 0 }}>
        <div className="main"><div className="t">QuickBooks</div><div className="m">Which QuickBooks customer this property is billed to</div></div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: MUTED }}><Dot c={data.connected ? DOT.green : DOT.gray} />{data.connected ? (data.current ? data.current.name : 'Not linked') : 'Not connected'}</span>
      </div>
      {!data.connected ? <a className="sy-b line sm" style={{ justifySelf: 'start' }} href="/?view=admin&qb=1">Set up QuickBooks</a> : (
        <div style={{ display: 'flex', gap: 8 }}>
          <select className="sy-in" aria-label="QuickBooks customer" value={pick} onChange={e => setPick(e.target.value)}><option value="">Not linked</option>{data.customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <button type="button" className="sy-b pri sm" style={{ height: 36 }} onClick={save} disabled={busy}>{busy ? '…' : 'Save'}</button>
        </div>
      )}
      {msg && <div style={{ fontSize: 12, color: msg.ok ? '#1A7F37' : '#D70015' }}>{msg.t}</div>}
    </div>
  );
}
