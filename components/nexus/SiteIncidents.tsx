'use client';

// SiteIncidents — the site fault ledger + uptime tracker (Systems → Faults).
// Logs "gate stuck open", "camera down", etc. to the `incidents` table with a
// structured cause, tracks uptime %, time since last, MTTR and current downtime,
// and can send a tech (promote to a work order). Manual entry today; the SAME
// endpoint is what the AI watcher + ggsoc.com will write to (tagged by `source`).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { INCIDENT_CATEGORIES, INCIDENT_PRESETS, CATEGORY_BY_ID, causeLabel, categoryLabel, type IncidentSeverity } from '@/lib/incident-taxonomy';
import { type Any, Card, Dot, DOT, Field, GREEN, MUTED, Note, RED, Sheet, dur, getJson, send, type Notify } from '@/components/nexus/systems/shared';

type Stats = { openCount: number; resolvedCount: number; timeSinceLastMs: number | null; currentDowntimeMs: number; mttrMs: number | null; downtimeMs: number; uptimePct: number; windowDays: number };
const SEV_DOT: Record<string, string> = { critical: DOT.red, high: DOT.red, medium: DOT.orange, low: DOT.gray };
const SEV_LABEL: Record<string, string> = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };
const ago = (ts?: string | null) => { if (!ts) return ''; const ms = Date.now() - Date.parse(ts); return Number.isNaN(ms) ? '' : `${dur(ms)} ago`; };

export function SiteIncidents({ siteId, notify, onChanged, logRequest }: { siteId: string; notify?: Notify; onChanged?: () => void; logRequest?: number }) {
  const [incidents, setIncidents] = useState<Any[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const say: Notify = useCallback((m, ok = true) => { if (notify) notify(m, ok); else if (!ok) setErr(m); }, [notify]);

  const load = useCallback(async () => {
    const r = await getJson(`/api/incidents?site_id=${siteId}`);
    if (!r.ok) { setErr(r.data.error || 'Couldn’t load faults.'); setIncidents(i => i ?? []); return; }
    setErr(null);
    setIncidents(Array.isArray(r.data.incidents) ? r.data.incidents : []);
    setStats(r.data.stats ?? null);
  }, [siteId]);
  useEffect(() => { void load(); }, [load]);
  // "Report a problem" quick action opens the log sheet.
  useEffect(() => { if (logRequest) setLogOpen(true); }, [logRequest]);

  const open = useMemo(() => (incidents ?? []).filter(i => i.status === 'open' || i.status === 'investigating'), [incidents]);
  const recent = useMemo(() => (incidents ?? []).filter(i => i.status === 'resolved' || i.status === 'closed').slice(0, 8), [incidents]);

  async function patch(i: Any, body: Any, done: string) {
    if (body.action === 'convert_to_wo' && !window.confirm(`Create a service work order for “${i.title}”?`)) return;
    setBusy(i.id);
    const r = await send(`/api/incidents/${i.id}`, 'PATCH', body);
    setBusy(null);
    if (!r.ok) { say(r.data.error || 'Didn’t save.', false); return; }
    say(done); await load(); onChanged?.();
  }

  const up = stats?.uptimePct;
  const tiles = [
    { l: `Uptime · ${stats?.windowDays ?? 90} days`, v: up != null ? `${up}%` : '—', c: up == null ? undefined : up >= 99 ? GREEN : up >= 95 ? '#B25000' : RED },
    { l: 'Open faults', v: String(open.length), c: open.length ? RED : undefined },
    { l: 'Since last fault', v: dur(stats?.timeSinceLastMs) },
    { l: 'Down right now', v: open.length ? dur(stats?.currentDowntimeMs || null) : 'None' },
    { l: 'Average fix time', v: dur(stats?.mttrMs) },
  ];

  return (
    <div className="sy-stack">
      <div className="sy-kpis" style={{ marginBottom: 0 }}>
        {tiles.map(t => <div key={t.l} className="sy-kpi"><div className="l">{t.l}</div><div className="v" style={{ color: t.c }}>{incidents == null ? '—' : t.v}</div></div>)}
      </div>
      <Card title="Open faults" sub="What’s down, why, and for how long." right={<button type="button" className="sy-b pri sm" onClick={() => setLogOpen(true)}>Log a fault</button>}>
        {err && <div style={{ marginBottom: 8 }}><Note tone="red">{err}</Note></div>}
        {incidents == null ? <div className="sy-empty">Loading…</div>
          : !open.length ? <div className="sy-empty" style={{ color: GREEN }}>All systems working — no open faults.</div>
          : open.map(i => (
            <div key={i.id} className="sy-row" style={{ flexWrap: 'wrap' }}>
              <Dot c={SEV_DOT[i.severity] ?? DOT.orange} />
              <div className="main" style={{ minWidth: 200 }}>
                <div className="t">{i.title}</div>
                <div className="m">{[SEV_LABEL[i.severity] ?? 'Medium', categoryLabel(i.category), i.cause ? causeLabel(i.category, i.cause) : null, `down ${ago(i.started_at)}`, i.source && i.source !== 'manual' ? `via ${i.source}` : null, i.work_order_id ? 'tech sent' : null].filter(Boolean).join(' · ')}</div>
              </div>
              {!i.work_order_id && <button type="button" className="sy-b line sm" onClick={() => patch(i, { action: 'convert_to_wo' }, 'Work order created.')} disabled={busy === i.id}>Send a tech</button>}
              <button type="button" className="sy-b go sm" onClick={() => patch(i, { status: 'resolved' }, 'Marked fixed.')} disabled={busy === i.id}>Fixed</button>
            </div>
          ))}
      </Card>
      {recent.length > 0 && (
        <Card title="Recently fixed">
          {recent.map(i => {
            const down = i.resolved_at && i.started_at ? Date.parse(i.resolved_at) - Date.parse(i.started_at) : null;
            return (
              <div key={i.id} className="sy-row">
                <Dot c={DOT.green} />
                <div className="main"><div className="t" style={{ fontSize: 13 }}>{i.title}</div><div className="m">{[categoryLabel(i.category), i.cause ? causeLabel(i.category, i.cause) : null].filter(Boolean).join(' · ')}</div></div>
                <span style={{ fontSize: 12, color: MUTED, whiteSpace: 'nowrap' }}>down {dur(down)}</span>
              </div>
            );
          })}
        </Card>
      )}
      {logOpen && <LogSheet siteId={siteId} onClose={() => setLogOpen(false)} onSaved={() => { setLogOpen(false); say('Fault logged.'); void load(); onChanged?.(); }} onError={m => say(m, false)} />}
    </div>
  );
}

function LogSheet({ siteId, onClose, onSaved, onError }: { siteId: string; onClose: () => void; onSaved: () => void; onError: (m: string) => void }) {
  const [category, setCategory] = useState<string>('gate');
  const [cause, setCause] = useState('');
  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState<IncidentSeverity>('high');
  const [description, setDescription] = useState('');
  const [startedAt, setStartedAt] = useState('');
  const [busy, setBusy] = useState(false);
  const causes = CATEGORY_BY_ID[category]?.causes ?? [];

  async function save() {
    if (!title.trim()) return;
    setBusy(true);
    const r = await send('/api/incidents', 'POST', { site_id: siteId, title: title.trim(), category, cause: cause || null, severity, description: description.trim() || null, started_at: startedAt ? new Date(startedAt).toISOString() : undefined });
    setBusy(false);
    if (!r.ok) { onError(r.data.error || 'Couldn’t log the fault.'); return; }
    onSaved();
  }
  return (
    <Sheet title="Log a fault" sub="Goes on this property’s fault history and uptime." onClose={onClose} width={500}>
      <div className="sy-chips">
        {INCIDENT_PRESETS.map(p => <button key={p.key} type="button" className="sy-chip" onClick={() => { setCategory(p.category); setCause(p.cause); setSeverity(p.severity); if (!title) setTitle(p.label); }}>{p.label}</button>)}
      </div>
      <Field label="What happened?"><input className="sy-in" value={title} onChange={e => setTitle(e.target.value)} placeholder="Main gate stuck open" /></Field>
      <div className="sy-grid2" style={{ gap: 10 }}>
        <Field label="System"><select className="sy-in" value={category} onChange={e => { setCategory(e.target.value); setCause(''); }}>{INCIDENT_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></Field>
        <Field label="Why it’s down"><select className="sy-in" value={cause} onChange={e => setCause(e.target.value)}><option value="">Not sure</option>{causes.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}</select></Field>
        <Field label="How bad"><select className="sy-in" value={severity} onChange={e => setSeverity(e.target.value as IncidentSeverity)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></Field>
        <Field label="Down since"><input className="sy-in" type="datetime-local" value={startedAt} onChange={e => setStartedAt(e.target.value)} /></Field>
      </div>
      <Field label="Notes (optional)"><textarea className="sy-in" rows={2} value={description} onChange={e => setDescription(e.target.value)} /></Field>
      <button type="button" className="sy-b pri" onClick={save} disabled={busy || !title.trim()}>{busy ? 'Logging…' : 'Log fault'}</button>
    </Sheet>
  );
}
