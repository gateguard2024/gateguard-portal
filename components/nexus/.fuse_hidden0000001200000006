'use client';

// SiteIncidents — the site fault ledger + uptime tracker. Logs "gate stuck open",
// "camera down", etc. to the existing `incidents` table with a structured cause,
// tracks uptime %, time-since-last, MTTR and current downtime, and can promote a
// fault to a service work order. Manual entry today; the SAME endpoint is what the
// AI watcher + ggsoc.com will write to later (tagged by `source`).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { INCIDENT_CATEGORIES, INCIDENT_PRESETS, CATEGORY_BY_ID, causeLabel, categoryLabel, SEVERITY_META, type IncidentSeverity } from '@/lib/incident-taxonomy';

const TILE = { background: 'repeating-linear-gradient(90deg,rgba(255,255,255,0.04) 0 1px,transparent 1px 4px), linear-gradient(180deg,#2b3c52,#1e2a3a)', border: '1px solid rgba(140,170,200,0.22)', borderRadius: 14, padding: 12 } as const;
const WELL = 'linear-gradient(180deg,#22303f,#1a2532)';
const INPUT = { background: '#16232f', border: '1px solid rgba(140,170,200,0.28)', color: '#eaf2fb', borderRadius: 10, padding: '8px 10px', fontSize: 13, outline: 'none', width: '100%' } as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Incident = Record<string, any>;
type Stats = { openCount: number; resolvedCount: number; timeSinceLastMs: number | null; currentDowntimeMs: number; mttrMs: number | null; downtimeMs: number; uptimePct: number; windowDays: number };

function dur(ms: number | null | undefined): string {
  if (ms == null) return '—';
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}
function ago(ts: string | null | undefined): string {
  if (!ts) return '';
  const ms = Date.now() - Date.parse(ts);
  return Number.isNaN(ms) ? '' : dur(ms) + ' ago';
}

export function SiteIncidents({ siteId }: { siteId: string }) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [logOpen, setLogOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const j = await fetch(`/api/incidents?site_id=${siteId}`, { cache: 'no-store' }).then(r => r.json());
      setIncidents(Array.isArray(j.incidents) ? j.incidents : []);
      setStats(j.stats ?? null);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [siteId]);
  useEffect(() => { void load(); }, [load]);

  const open = useMemo(() => incidents.filter(i => i.status === 'open' || i.status === 'investigating'), [incidents]);
  const recent = useMemo(() => incidents.filter(i => i.status === 'resolved' || i.status === 'closed').slice(0, 6), [incidents]);

  async function patch(id: string, body: Record<string, unknown>) {
    await fetch(`/api/incidents/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    await load();
  }

  const healthColor = !stats ? '#9FD8EC' : stats.uptimePct >= 99 ? '#7ee0a8' : stats.uptimePct >= 95 ? '#fbbf24' : '#f2637e';

  return (
    <div style={{ background: WELL, border: '1px solid rgba(140,170,200,0.18)', borderRadius: 16, padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9FD8EC' }}>Faults &amp; uptime</div>
          <div style={{ fontSize: 12, color: '#98abbd' }}>Track outages, downtime and why systems went down.</div>
        </div>
        <button onClick={() => setLogOpen(true)} style={{ background: '#26374a', border: '1px solid rgba(95,184,224,0.3)', color: '#cfe0f0', borderRadius: 10, padding: '8px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>＋ Log issue</button>
      </div>

      {/* Uptime stat tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px,1fr))', gap: 8, marginBottom: 12 }}>
        <Stat label={`Uptime · ${stats?.windowDays ?? 90}d`} value={stats ? `${stats.uptimePct}%` : '—'} color={healthColor} />
        <Stat label="Open faults" value={stats?.openCount ?? 0} color={open.length ? '#f2637e' : '#7ee0a8'} />
        <Stat label="Since last" value={dur(stats?.timeSinceLastMs)} sub="incident" color="#9FD8EC" />
        <Stat label="Current down" value={dur(stats?.currentDowntimeMs || null)} sub={open.length ? 'active' : 'none'} color={open.length ? '#fbbf24' : '#7f96ab'} />
        <Stat label="Avg fix (MTTR)" value={dur(stats?.mttrMs)} color="#9FD8EC" />
      </div>

      {/* Open faults */}
      {loading ? <div style={{ fontSize: 12, color: '#7f96ab', padding: '8px 0' }}>Loading faults…</div>
        : open.length === 0 ? <div style={{ fontSize: 12, color: '#7ee0a8', padding: '10px 0' }}>✓ All systems operational — no open faults.</div>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {open.map(i => <FaultRow key={i.id} inc={i} onResolve={() => patch(i.id, { status: 'resolved' })} onConvert={() => patch(i.id, { action: 'convert_to_wo' })} />)}
          </div>}

      {/* Recently resolved */}
      {recent.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7f96ab', marginBottom: 6 }}>Recently resolved</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {recent.map(i => {
              const down = i.resolved_at && i.started_at ? Date.parse(i.resolved_at) - Date.parse(i.started_at) : null;
              return (
                <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7ee0a8' }} />
                  <span style={{ color: '#c3d3e2' }}>{i.title}</span>
                  <span style={{ color: '#7f96ab' }}>· {categoryLabel(i.category)}{i.cause ? ` · ${causeLabel(i.category, i.cause)}` : ''}</span>
                  <span style={{ color: '#7f96ab', marginLeft: 'auto' }}>down {dur(down)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {logOpen && <LogModal siteId={siteId} onClose={() => setLogOpen(false)} onSaved={() => { setLogOpen(false); void load(); }} />}
    </div>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div style={TILE}>
      <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#7f96ab' }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 800, color, lineHeight: 1.1, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: '#7f96ab' }}>{sub}</div>}
    </div>
  );
}

function FaultRow({ inc, onResolve, onConvert }: { inc: Incident; onResolve: () => void; onConvert: () => void }) {
  const sev = SEVERITY_META[(inc.severity as IncidentSeverity)] ?? SEVERITY_META.medium;
  return (
    <div style={{ ...TILE, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: sev.color, boxShadow: `0 0 8px ${sev.color}` }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#eaf2fb' }}>{inc.title}</div>
        <div style={{ fontSize: 10.5, color: '#98abbd' }}>
          {categoryLabel(inc.category)}{inc.cause ? ` · ${causeLabel(inc.category, inc.cause)}` : ''} · down {ago(inc.started_at)}
          {inc.source && inc.source !== 'manual' ? ` · via ${inc.source}` : ''}
          {inc.work_order_id ? ' · WO created' : ''}
        </div>
      </div>
      <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: sev.color, border: `1px solid ${sev.color}66`, borderRadius: 999, padding: '2px 8px' }}>{sev.label}</span>
      {!inc.work_order_id && <button onClick={onConvert} style={{ background: '#22303f', border: '1px solid rgba(95,184,224,0.28)', color: '#9FD8EC', borderRadius: 8, padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Send tech</button>}
      <button onClick={onResolve} style={{ background: 'rgba(126,224,168,0.14)', border: '1px solid rgba(126,224,168,0.4)', color: '#7ee0a8', borderRadius: 8, padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Resolve</button>
    </div>
  );
}

function LogModal({ siteId, onClose, onSaved }: { siteId: string; onClose: () => void; onSaved: () => void }) {
  const [category, setCategory] = useState<string>('gate');
  const [cause, setCause] = useState<string>('');
  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState<IncidentSeverity>('high');
  const [description, setDescription] = useState('');
  const [startedAt, setStartedAt] = useState('');
  const [busy, setBusy] = useState(false);

  const causes = CATEGORY_BY_ID[category]?.causes ?? [];

  function applyPreset(p: typeof INCIDENT_PRESETS[number]) {
    setCategory(p.category); setCause(p.cause); setSeverity(p.severity);
    if (!title) setTitle(p.label);
  }

  async function save() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await fetch('/api/incidents', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site_id: siteId, title: title.trim(), category, cause: cause || null, severity, description: description || null, started_at: startedAt ? new Date(startedAt).toISOString() : undefined }) });
      onSaved();
    } catch { /* ignore */ } finally { setBusy(false); }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 95, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 460, maxHeight: '88dvh', overflowY: 'auto', background: 'linear-gradient(180deg,#1d2a39,#141d28)', border: '1px solid rgba(140,170,200,0.28)', borderRadius: 22, padding: 18, boxShadow: '0 30px 70px rgba(0,0,0,0.6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#5FB8E0' }}>Site fault</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#eaf2fb' }}>Log an issue</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#98abbd', fontSize: 12, cursor: 'pointer' }}>Close</button>
        </div>

        {/* Presets */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {INCIDENT_PRESETS.map(p => (
            <button key={p.key} onClick={() => applyPreset(p)} style={{ background: '#16232f', border: '1px solid rgba(140,170,200,0.22)', color: '#c3d3e2', borderRadius: 999, padding: '5px 11px', fontSize: 11.5, cursor: 'pointer' }}>{p.label}</button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="What happened? (e.g. Main gate stuck open)" style={INPUT} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#7f96ab', marginBottom: 4 }}>System</div>
              <select value={category} onChange={e => { setCategory(e.target.value); setCause(''); }} style={{ ...INPUT, padding: '8px 8px' }}>
                {INCIDENT_CATEGORIES.map(cat => <option key={cat.id} value={cat.id} style={{ background: '#111a24' }}>{cat.label}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#7f96ab', marginBottom: 4 }}>Why it's down</div>
              <select value={cause} onChange={e => setCause(e.target.value)} style={{ ...INPUT, padding: '8px 8px' }}>
                <option value="" style={{ background: '#111a24' }}>Select cause…</option>
                {causes.map(x => <option key={x.id} value={x.id} style={{ background: '#111a24' }}>{x.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#7f96ab', marginBottom: 4 }}>Severity</div>
              <select value={severity} onChange={e => setSeverity(e.target.value as IncidentSeverity)} style={{ ...INPUT, padding: '8px 8px' }}>
                <option value="low" style={{ background: '#111a24' }}>Low</option>
                <option value="medium" style={{ background: '#111a24' }}>Medium</option>
                <option value="high" style={{ background: '#111a24' }}>High</option>
                <option value="critical" style={{ background: '#111a24' }}>Critical</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#7f96ab', marginBottom: 4 }}>Down since</div>
              <input type="datetime-local" value={startedAt} onChange={e => setStartedAt(e.target.value)} style={{ ...INPUT, padding: '7px 8px' }} />
            </div>
          </div>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Notes (optional)" style={{ ...INPUT, resize: 'vertical' }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#98abbd', fontSize: 12.5, cursor: 'pointer', padding: '8px 10px' }}>Cancel</button>
          <button onClick={save} disabled={busy || !title.trim()} style={{ background: '#26374a', border: '1px solid rgba(140,170,200,0.3)', color: '#cfe0f0', borderRadius: 10, padding: '8px 16px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', opacity: busy || !title.trim() ? 0.4 : 1 }}>{busy ? 'Logging…' : 'Log fault'}</button>
        </div>
        <div style={{ fontSize: 9.5, color: '#6f8397', marginTop: 8 }}>Logged to the site ledger. Later, the AI watcher and GGSOC will file these automatically.</div>
      </div>
    </div>
  );
}
