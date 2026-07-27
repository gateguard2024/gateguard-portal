'use client';

// SiteNetworkDevices — the UniFi Network device + client roster for a property,
// from the cloud Site Manager API (read-only monitoring). Device restart/PoE
// power-cycle require a console-level Integration key + connector proxy (corporate
// setup, not the read key we use here) — flagged as a follow-up, not wired blind.
import React, { useEffect, useState } from 'react';

const WELL = 'linear-gradient(180deg,#22303f,#1a2532)';
const TILE = { background: 'repeating-linear-gradient(90deg,rgba(255,255,255,0.04) 0 1px,transparent 1px 4px), linear-gradient(180deg,#2b3c52,#1e2a3a)', border: '1px solid rgba(140,170,200,0.22)', borderRadius: 12, padding: 10 } as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = Record<string, any>;
const uptime = (s: number | null | undefined) => s == null ? '' : s >= 86400 ? `${Math.floor(s / 86400)}d` : s >= 3600 ? `${Math.floor(s / 3600)}h` : `${Math.floor(s / 60)}m`;

export function SiteNetworkDevices({ siteId }: { siteId: string }) {
  const [ov, setOv] = useState<Any | null | undefined>(undefined);
  const [clients, setClients] = useState<Any[] | null>(null);
  const [showClients, setShowClients] = useState(false);

  useEffect(() => {
    fetch(`/api/unifi/cloud/overview?site_id=${siteId}`, { cache: 'no-store' }).then(r => r.json())
      .then(j => setOv(j && j.connected ? j : null)).catch(() => setOv(null));
  }, [siteId]);
  useEffect(() => {
    if (!showClients || clients) return;
    fetch(`/api/unifi/clients?site_id=${siteId}`, { cache: 'no-store' }).then(r => r.json())
      .then(j => setClients(Array.isArray(j.clients) ? j.clients : [])).catch(() => setClients([]));
  }, [showClients, clients, siteId]);

  if (ov === undefined) return <div style={{ fontSize: 12, color: '#9FD8EC', padding: '8px 2px' }}>Loading devices…</div>;
  if (!ov) return null; // not connected → SiteNetwork already shows the prompt
  const devices: Any[] = ov.devices ?? [];
  const health = ov.health ?? { online: 0, total: 0 };

  return (
    <div style={{ background: WELL, border: '1px solid rgba(140,170,200,0.18)', borderRadius: 16, padding: 12, marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        <div style={{ color: '#9FD8EC', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Network devices · UniFi</div>
        <span style={{ fontSize: 11, color: '#c3d3e2' }}>{health.online}/{health.total} online</span>
      </div>

      {devices.length === 0 ? <div style={{ fontSize: 11.5, color: '#9FD8EC', padding: '6px 2px' }}>No devices reported.</div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 8 }}>
          {devices.map((d, i) => (
            <div key={d.mac ?? d.name ?? i} style={{ ...TILE, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.online ? '#7ee0a8' : '#f2637e', flexShrink: 0 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ color: '#eaf2fb', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name ?? d.model ?? 'Device'}</div>
                <div style={{ color: '#c3d3e2', fontSize: 10 }}>{[d.model, d.version ? `v${d.version}` : null, d.uptime_s ? `up ${uptime(d.uptime_s)}` : null].filter(Boolean).join(' · ')}</div>
              </div>
              {d.clients != null && <span style={{ fontSize: 10.5, color: '#9FD8EC' }}>{d.clients} cl</span>}
            </div>
          ))}
        </div>
      )}

      <button onClick={() => setShowClients(v => !v)} style={{ marginTop: 10, background: '#22303f', border: '1px solid rgba(95,184,224,0.28)', color: '#9FD8EC', borderRadius: 9, padding: '6px 12px', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>
        {showClients ? 'Hide clients' : `Show connected clients (${ov.clients?.total ?? 0})`}
      </button>
      {showClients && (
        clients == null ? <div style={{ fontSize: 11.5, color: '#9FD8EC', marginTop: 8 }}>Loading clients…</div>
          : clients.length === 0 ? <div style={{ fontSize: 11.5, color: '#9FD8EC', marginTop: 8 }}>No clients reported.</div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 8, maxHeight: 240, overflowY: 'auto' }}>
              {clients.slice(0, 200).map((c, i) => (
                <div key={c.mac ?? i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, padding: '3px 0', borderBottom: '1px solid rgba(140,170,200,0.07)' }}>
                  <span style={{ fontSize: 10 }} aria-hidden>{c.wired ? '🔌' : '📶'}</span>
                  <span style={{ color: '#e2ebf4' }}>{c.name || c.mac}</span>
                  {c.ip && <span style={{ color: '#9FD8EC', marginLeft: 'auto' }}>{c.ip}</span>}
                </div>
              ))}
            </div>
      )}
      <div style={{ fontSize: 9.5, color: '#9FD8EC', marginTop: 8 }}>Live monitoring via UniFi Site Manager. Device reboot / PoE power-cycle needs a console Integration key (corporate setup) — coming next.</div>
    </div>
  );
}
