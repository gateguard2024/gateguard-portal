'use client';

// SiteCameraEvents — Eagle Eye historical camera events (motion, license-plate,
// tamper, line-cross, device status) for a property, filterable by type. Read-only;
// hides gracefully when Eagle Eye isn't connected. 'cameras' scope enforced server-side.
import React, { useEffect, useMemo, useState } from 'react';

const WELL = 'linear-gradient(180deg,#22303f,#1a2532)';
const INPUT = { background: '#16232f', border: '1px solid rgba(140,170,200,0.22)', color: '#eaf2fb', borderRadius: 10, padding: '7px 9px', fontSize: 12.5, outline: 'none' } as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EEvent = Record<string, any>;

const ALERT = /tamper|intrusion|loiter/i;
function glyph(label: string) {
  if (/plate|lpr/i.test(label)) return '🚗';
  if (/tamper/i.test(label)) return '🛑';
  if (/intrusion/i.test(label)) return '🚨';
  if (/line/i.test(label)) return '↔';
  if (/loiter/i.test(label)) return '🕒';
  if (/device|status/i.test(label)) return '📡';
  return '🏃';
}

export function SiteCameraEvents({ siteId }: { siteId: string }) {
  const [events, setEvents] = useState<EEvent[] | null>(null);
  const [err, setErr] = useState(false);
  const [type, setType] = useState('');
  const [hours, setHours] = useState(24);

  useEffect(() => {
    let cancelled = false;
    setEvents(null); setErr(false);
    // Live: fetch now, then refresh every 20s in place (no loading flash).
    const run = () => fetch(`/api/eagle-eye/events?site_id=${siteId}&hours=${hours}`, { cache: 'no-store' }).then(r => r.json())
      .then(j => { if (cancelled) return; if (Array.isArray(j.events)) { setEvents(j.events); setErr(false); } else { setEvents(e => e ?? []); setErr(true); } })
      .catch(() => { if (!cancelled) { setEvents(e => e ?? []); setErr(true); } });
    run();
    const id = setInterval(run, 20000);
    return () => { cancelled = true; clearInterval(id); };
  }, [siteId, hours]);

  const types = useMemo(() => Array.from(new Set((events ?? []).map(e => e.label))).slice(0, 20), [events]);
  const shown = useMemo(() => (events ?? []).filter(e => !type || e.label === type).slice(0, 120), [events, type]);
  const fmt = (t: string) => { const d = new Date(t); return isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); };

  if (err && !events?.length) return null; // not connected → hide (cameras wall already covers status)
  return (
    <div style={{ background: WELL, border: '1px solid rgba(140,170,200,0.18)', borderRadius: 16, padding: 12, marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        <div style={{ color: '#9FD8EC', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Camera events · Eagle Eye</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <select value={type} onChange={e => setType(e.target.value)} style={{ ...INPUT, padding: '6px 7px' }}>
            <option value="" style={{ background: '#111a24' }}>All types</option>
            {types.map(t => <option key={t} value={t} style={{ background: '#111a24' }}>{t}</option>)}
          </select>
          <select value={hours} onChange={e => setHours(Number(e.target.value))} style={{ ...INPUT, padding: '6px 7px' }}>
            <option value={6} style={{ background: '#111a24' }}>Last 6h</option>
            <option value={24} style={{ background: '#111a24' }}>Last 24h</option>
            <option value={72} style={{ background: '#111a24' }}>Last 3d</option>
            <option value={168} style={{ background: '#111a24' }}>Last 7d</option>
          </select>
        </div>
      </div>
      {events == null ? <div style={{ fontSize: 12, color: '#9FD8EC', padding: '8px 2px' }}>Loading events…</div>
        : shown.length === 0 ? <div style={{ fontSize: 11.5, color: '#9FD8EC', padding: '8px 2px' }}>No camera events in this window.</div>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 300, overflowY: 'auto' }}>
            {shown.map((e, i) => {
              const alert = ALERT.test(e.label);
              return (
                <div key={e.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, padding: '5px 0', borderBottom: '1px solid rgba(140,170,200,0.08)' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: alert ? '#f87171' : '#7ee0a8', flexShrink: 0 }} />
                  <span aria-hidden>{glyph(e.label)}</span>
                  <span style={{ color: '#e2ebf4' }}>{e.label}{e.ongoing ? ' · ongoing' : ''}</span>
                  {e.cameraName && <span style={{ color: '#c3d3e2' }}>· {e.cameraName}</span>}
                  {e.when && <span style={{ color: '#9FD8EC', marginLeft: 'auto' }}>{fmt(e.when)}</span>}
                </div>
              );
            })}
          </div>}
    </div>
  );
}
