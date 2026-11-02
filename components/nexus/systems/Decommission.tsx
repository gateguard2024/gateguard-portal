'use client';

// Property status — mark inactive, take offline (remove equipment), turn back on.
// CORPORATE ONLY (the API refuses everyone else). Engine: lib/decommission.ts, API /api/sites/[id]/decommission.
//   Inactive      billing stops, Gate Watch pauses, customer portal off, "final invoice" task made
//   Take offline  the same + a Removal job listing every device → mark where each went → close out
import React, { useCallback, useEffect, useState } from 'react';
import { type Any, getJson, send, Sheet, Note, Field, Dot, DOT, MUTED, GREEN, RED } from '@/components/nexus/systems/shared';

export const SITE_STATUS: Record<string, { label: string; dot: string }> = {
  active: { label: 'Active', dot: DOT.green },
  prospect: { label: 'Prospect', dot: DOT.blue },
  inactive: { label: 'Inactive', dot: DOT.gray },
  decommissioning: { label: 'Being taken offline', dot: DOT.orange },
  decommissioned: { label: 'Offline — equipment removed', dot: DOT.gray },
};
export const isInactive = (s: unknown) => ['inactive', 'decommissioning', 'decommissioned'].includes(String(s ?? ''));
export const statusOf = (s: unknown) => SITE_STATUS[String(s ?? 'active')] ?? { label: String(s), dot: DOT.gray };
const WHERE: { k: string; l: string }[] = [{ k: 'stock', l: 'Back to stock' }, { k: 'disposed', l: 'Thrown out' }, { k: 'left_on_site', l: 'Left with customer' }];
const whereLabel = (k?: string | null) => WHERE.find(w => w.k === k)?.l ?? '—';
const fmtDate = (d?: string | null) => (d ? new Date(d.length === 10 ? `${d}T12:00:00` : d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');

/** Gray strip shown on an inactive property (everyone sees it). */
export function InactiveBanner({ status, reason, onManage }: { status?: string | null; reason?: string | null; onManage?: () => void }) {
  if (!isInactive(status)) return null;
  const s = statusOf(status);
  return (
    <div className="sy-note" role="status" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, background: '#fff', color: '#1D1D1F', boxShadow: '0 1px 2px rgba(10,20,40,.06), 0 8px 24px rgba(10,20,40,.08)' }}>
      <Dot c={s.dot} />
      <div style={{ flex: 1, minWidth: 0 }}><b style={{ fontWeight: 600 }}>{s.label}.</b> <span style={{ color: MUTED }}>Not billed, Gate Watch paused.{reason ? ` ${reason}` : ''}</span></div>
      {onManage && <button type="button" className="sy-b line sm" onClick={onManage}>Manage</button>}
    </div>
  );
}

function Step({ n, title, done, children }: { n: number; title: string; done?: boolean; children?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '12px 0', borderTop: '1px solid rgba(0,0,0,.08)' }}>
      <div aria-hidden style={{ width: 24, height: 24, borderRadius: 12, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, background: done ? '#E8F6EC' : '#F2F2F7', color: done ? GREEN : MUTED }}>{done ? '✓' : n}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{title}{done && <span className="sy-pill" style={{ marginLeft: 8, color: GREEN, background: '#E8F6EC' }}>Done</span>}</div>
        {children && <div style={{ marginTop: 6, display: 'grid', gap: 8 }}>{children}</div>}
      </div>
    </div>
  );
}

export function SiteStatusSheet({ siteId, siteName, onClose, onChanged, openSetup }: { siteId: string; siteName?: string; onClose: () => void; onChanged?: (status: string, reason?: string | null) => void; openSetup?: () => void }) {
  const [d, setD] = useState<Any | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [mode, setMode] = useState<'inactive' | 'offline'>('inactive');
  const [reason, setReason] = useState('');
  const [lastDay, setLastDay] = useState('');
  const [jobDate, setJobDate] = useState('');
  const [confirmOn, setConfirmOn] = useState(false);

  const load = useCallback(async () => {
    const r = await getJson(`/api/sites/${siteId}/decommission`);
    if (r.ok) { setD(r.data); setErr(null); } else setErr(r.data.error || 'Couldn’t load this property’s status.');
  }, [siteId]);
  useEffect(() => { void load(); }, [load]);

  const act = async (key: string, body: Any, done: string) => {
    setBusy(key); setMsg(null);
    const r = await send(`/api/sites/${siteId}/decommission`, 'POST', body);
    setBusy(null);
    if (!r.ok) { setMsg({ t: r.data.error || 'That didn’t save.', ok: false }); return false; }
    setD(r.data);
    setMsg({ t: r.data.warning ? `${done} ${r.data.warning}` : done, ok: !r.data.warning });
    onChanged?.(r.data.site?.status ?? 'active', r.data.site?.inactive_reason ?? null);
    return true;
  };

  const site = d?.site;
  const status: string = site?.status ?? 'active';
  const s = statusOf(status);
  const dc: Any = d?.decommission ?? {};
  const installed: Any[] = d?.installed ?? [];
  const removed: Any[] = d?.removed ?? [];
  const offlineFlow = status === 'decommissioning' || status === 'decommissioned';

  return (
    <Sheet title="Property status" sub={site?.name || siteName} onClose={onClose} width={620} locked={!!busy}>
      {err && <Note tone="red">{err}</Note>}
      {!d && !err && <div className="sy-empty">Loading…</div>}
      {msg && <Note tone={msg.ok ? 'green' : 'red'}>{msg.t}</Note>}

      {site && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Dot c={s.dot} /><b style={{ fontSize: 15, fontWeight: 600 }}>{s.label}</b>
          {site.inactive_at && <span style={{ fontSize: 12, color: MUTED }}>since {fmtDate(site.inactive_at)}{site.inactive_by ? ` · ${site.inactive_by}` : ''}</span>}
        </div>
      )}

      {/* ── Active: choose what to do ─────────────────────────────── */}
      {site && !isInactive(status) && (
        <>
          <div className="sy-chips" role="radiogroup" aria-label="What do you want to do?">
            <button type="button" className="sy-chip" role="radio" aria-pressed={mode === 'inactive'} aria-checked={mode === 'inactive'} onClick={() => setMode('inactive')}>Mark inactive</button>
            <button type="button" className="sy-chip" role="radio" aria-pressed={mode === 'offline'} aria-checked={mode === 'offline'} onClick={() => setMode('offline')}>Take offline &amp; remove equipment</button>
          </div>
          <Note>
            {mode === 'inactive'
              ? 'Pause this property. Monthly billing stops, Gate Watch and the customer portal turn off. Equipment and logins stay — you can turn it back on any time.'
              : 'The customer is leaving. Everything “Mark inactive” does, plus a job to remove each device and a record of where it went. Nothing is deleted.'}
          </Note>
          <Field label="Why?"><textarea className="sy-in" rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Contract ended, switched providers, property sold" /></Field>
          <Field label="Last day of service (optional)"><input className="sy-in" type="date" value={lastDay} onChange={e => setLastDay(e.target.value)} style={{ maxWidth: 200 }} /></Field>
          <Note tone="blue">You’ll get a task to send the final invoice (or a credit).</Note>
          <div><button type="button" className={`sy-b ${mode === 'offline' ? 'warn' : 'pri'}`} disabled={!reason.trim() || !!busy} onClick={() => void act('go', { action: 'deactivate', reason, last_day: lastDay || null, take_offline: mode === 'offline' }, mode === 'offline' ? 'Started. Next: make the removal job.' : 'Marked inactive.')}>
            {busy === 'go' ? 'Saving…' : mode === 'offline' ? 'Start taking offline' : 'Mark inactive'}
          </button></div>
        </>
      )}

      {/* ── Inactive / taking offline: the steps ──────────────────── */}
      {site && isInactive(status) && (
        <div>
          {site.inactive_reason && <div style={{ fontSize: 13, color: MUTED, marginBottom: 4 }}>Reason: {site.inactive_reason}{site.last_service_date ? ` · Last day ${fmtDate(site.last_service_date)}` : ''}</div>}
          <Step n={1} title="Turned off" done>
            <div style={{ fontSize: 13, color: MUTED }}>
              Monthly billing stopped · Gate Watch {d.watches.total ? (d.watches.on ? `${d.watches.on} still on` : 'paused') : '— none set up'} · Customer portal {d.portals.total ? (d.portals.live ? `${d.portals.live} still live` : 'off') : '— none'}
            </div>
          </Step>
          <Step n={2} title="Send the final invoice or credit" done={d.billingTodo?.status === 'done'}>
            <div style={{ fontSize: 13, color: MUTED }}>
              {d.billingTodo ? <>Task: {d.billingTodo.title}{d.billingTodo.assigned_to_name ? ` · ${d.billingTodo.assigned_to_name}` : ''}{d.billingTodo.due_date ? ` · due ${fmtDate(d.billingTodo.due_date)}` : ''}</> : 'No task was made — send it from Money.'}
            </div>
          </Step>

          {!offlineFlow && (
            <div style={{ borderTop: '1px solid rgba(0,0,0,.08)', paddingTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: MUTED, flex: 1, minWidth: 200 }}>Customer leaving for good? Take it offline to remove the equipment.</span>
              <button type="button" className="sy-b warn sm" disabled={!!busy} onClick={() => void act('offline', { action: 'deactivate', reason: site.inactive_reason || 'Taken offline', last_day: site.last_service_date, take_offline: true }, 'Started. Next: make the removal job.')}>Take offline</button>
            </div>
          )}

          {offlineFlow && (
            <>
              <Step n={3} title="Removal job" done={!!d.job && ['completed', 'closed', 'done'].includes(String(d.job.status))}>
                {d.job ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 13 }}>
                    <span className="sy-pill">{d.job.wo_number || 'Job'}</span>
                    <span style={{ color: MUTED }}>{String(d.job.status).replace(/_/g, ' ')}{d.job.scheduled_date ? ` · ${fmtDate(d.job.scheduled_date)}` : ''}{d.job.assignee_name ? ` · ${d.job.assignee_name}` : ' · no tech yet'}</span>
                    <a className="sy-b blue sm" href={`/?tab=jobs&job=${d.job.id}`}>Open job</a>
                  </div>
                ) : status === 'decommissioned' ? <div style={{ fontSize: 13, color: MUTED }}>Closed out without a job.</div> : (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <Field label="Visit date (optional)"><input className="sy-in" type="date" value={jobDate} onChange={e => setJobDate(e.target.value)} style={{ width: 180 }} /></Field>
                    <button type="button" className="sy-b pri" disabled={!!busy} onClick={() => void act('job', { action: 'removal_job', date: jobDate || null }, 'Removal job made — assign a tech in Jobs.')}>{busy === 'job' ? 'Making…' : `Make removal job (${installed.length} device${installed.length === 1 ? '' : 's'})`}</button>
                  </div>
                )}
              </Step>

              <Step n={4} title={`Remove the equipment${installed.length ? ` — ${installed.length} left` : ''}`} done={!installed.length}>
                {!installed.length && !removed.length && <div style={{ fontSize: 13, color: MUTED }}>No equipment is on record for this property.</div>}
                {installed.map(a => (
                  <div key={a.id} className="sy-row" style={{ flexWrap: 'wrap' }}>
                    <div className="main"><div className="t">{a.product_name || 'Device'}</div><div className="m">{[a.location_note, a.serial_number && `SN ${a.serial_number}`].filter(Boolean).join(' · ') || a.product_category || ''}</div></div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {WHERE.map(w => <button key={w.k} type="button" className="sy-b line sm" disabled={!!busy} onClick={() => void act(`d${a.id}`, { action: 'device', asset_id: a.id, to: w.k }, `${a.product_name || 'Device'}: ${w.l.toLowerCase()}.`)}>{w.l}</button>)}
                    </div>
                  </div>
                ))}
                {removed.length > 0 && (
                  <details>
                    <summary style={{ fontSize: 13, color: MUTED, cursor: 'pointer' }}>{removed.length} removed</summary>
                    {removed.map(a => (
                      <div key={a.id} className="sy-row">
                        <div className="main"><div className="t">{a.product_name || 'Device'}</div><div className="m">{whereLabel(a.removed_to)}{a.removed_by ? ` · ${a.removed_by}` : ''}{a.removed_at ? ` · ${fmtDate(a.removed_at)}` : ''}</div></div>
                        {status !== 'decommissioned' && <button type="button" className="sy-b line sm" disabled={!!busy} onClick={() => void act(`u${a.id}`, { action: 'device', asset_id: a.id, to: null }, 'Put back on the installed list.')}>Undo</button>}
                      </div>
                    ))}
                  </details>
                )}
              </Step>

              <Step n={5} title="Remove the vendor logins">
                <div style={{ fontSize: 13, color: MUTED }}>Brivo, Eagle Eye, UniFi, Shelly and Edge logins are kept until you remove them. Also cancel the property’s accounts with those vendors.</div>
                {openSetup && <div><button type="button" className="sy-b line sm" onClick={openSetup}>Open Setup &amp; keys</button></div>}
              </Step>

              <Step n={6} title="Close out" done={status === 'decommissioned'}>
                {status === 'decommissioned'
                  ? <div style={{ fontSize: 13, color: MUTED }}>Closed {fmtDate(dc.closed_at)}. Kept for history and reports.</div>
                  : <div><button type="button" className="sy-b pri sm" disabled={!!busy || installed.length > 0} onClick={() => void act('close', { action: 'close_out' }, 'Closed out — the property is offline.')}>{installed.length ? `Mark where the ${installed.length} device${installed.length === 1 ? '' : 's'} went first` : 'Close out'}</button></div>}
              </Step>
            </>
          )}

          <div style={{ borderTop: '1px solid rgba(0,0,0,.08)', paddingTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {!confirmOn
              ? <button type="button" className="sy-b go sm" disabled={!!busy} onClick={() => setConfirmOn(true)}>Turn back on</button>
              : <>
                <span style={{ fontSize: 13, color: RED, flex: 1, minWidth: 200 }}>Billing starts again, Gate Watch and the portal turn back on.{removed.length ? ' Removed equipment stays removed.' : ''}</span>
                <button type="button" className="sy-b line sm" onClick={() => setConfirmOn(false)}>Cancel</button>
                <button type="button" className="sy-b go sm" disabled={!!busy} onClick={() => void act('on', { action: 'reactivate' }, 'Turned back on.').then(() => setConfirmOn(false))}>{busy === 'on' ? 'Saving…' : 'Yes, turn it on'}</button>
              </>}
          </div>
        </div>
      )}
    </Sheet>
  );
}

export default SiteStatusSheet;
