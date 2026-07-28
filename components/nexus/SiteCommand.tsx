'use client';

// SiteCommand — the dealer's main interface with a single property. Composes the
// proven per-site widgets (cameras, doors, activity, network, relays, controllers,
// credentials) and adds a top intelligence strip + faults/uptime + quick tools.
// Reuses every existing widget as-is (no rewrites) so nothing regresses.
import React, { useCallback, useEffect, useState } from 'react';
import { Settings } from 'lucide-react';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Camera, DoorOpen, TrendingUp, Zap, LockOpen, Key, AlertTriangle, History, Wifi, Cpu, RotateCcw } = require('lucide-react') as any;
import { SiteSecurity } from '@/components/nexus/SiteSecurity';
import { SiteDoors } from '@/components/nexus/SiteDoors';
import { SiteRelays } from '@/components/nexus/SiteRelays';
import { SiteNetwork } from '@/components/nexus/SiteNetwork';
import { SitePanels } from '@/components/nexus/SitePanels';
import { SiteActivity } from '@/components/nexus/SiteActivity';
import { SiteConnections } from '@/components/nexus/SiteConnections';
import { SiteIncidents } from '@/components/nexus/SiteIncidents';
import { SiteAccessControl } from '@/components/nexus/SiteAccessControl';
import { GateReboots } from '@/components/nexus/GateReboots';
import { SiteCameraEvents } from '@/components/nexus/SiteCameraEvents';
import { SiteNetworkDevices } from '@/components/nexus/SiteNetworkDevices';

const TILE = { background: 'repeating-linear-gradient(90deg,rgba(255,255,255,0.04) 0 1px,transparent 1px 4px), linear-gradient(180deg,#2b3c52,#1e2a3a)', border: '1px solid rgba(140,170,200,0.22)', borderRadius: 14, padding: 12 } as const;
const WELL = 'linear-gradient(180deg,#22303f,#1a2532)';

type Summary = {
  devices: { camera: number; gate: number; reader: number; intercom: number; network: number; total: number; online: number; offline: number; attention: number; camerasOnline: number; gatesOnline: number };
  doors: { total: number; panelsLive: number };
  faults: { open: number; uptimePct: number; timeSinceLastMs: number | null };
  eventsToday: number;
  healthScore: number;
  vendors: Record<string, boolean>;
};

function jump(id: string) {
  const el = typeof document !== 'undefined' ? document.getElementById(id) : null;
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function SiteCommand({ siteId, isCorporate }: { siteId: string; isCorporate: boolean }) {
  const [showSetup, setShowSetup] = useState(false);
  const [s, setS] = useState<Summary | null>(null);
  const [showReboot, setShowReboot] = useState(false);
  // Live vendor truth for the strip (lazy — after the fast local summary paints).
  const [live, setLive] = useState<{ cameras?: { online: number; total: number }; doors?: number; eventsToday?: number }>({});

  const load = useCallback(async () => {
    try { const j = await fetch(`/api/sites/${siteId}/command-summary`, { cache: 'no-store' }).then(r => r.json()); if (j && j.devices) setS(j); } catch { /* ignore */ }
  }, [siteId]);
  useEffect(() => { void load(); }, [load]);

  // Pull REAL counts from Eagle Eye (cameras) + Brivo (doors, today's events).
  // Each is independent and failure-tolerant — a card just keeps the local value.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [camR, doorR, evR] = await Promise.allSettled([
        fetch(`/api/eagle-eye/cameras?site_id=${siteId}`, { cache: 'no-store' }).then(r => r.json()),
        fetch(`/api/brivo/doors?site_id=${siteId}`, { cache: 'no-store' }).then(r => r.json()),
        fetch(`/api/brivo/events?site_id=${siteId}`, { cache: 'no-store' }).then(r => r.json()),
      ]);
      if (cancelled) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const next: { cameras?: { online: number; total: number }; doors?: number; eventsToday?: number } = {};
      if (camR.status === 'fulfilled' && Array.isArray(camR.value?.cameras)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cams = camR.value.cameras as any[];
        next.cameras = { total: cams.length, online: cams.filter(c => c.online !== false).length };
      }
      if (doorR.status === 'fulfilled' && Array.isArray(doorR.value?.doors)) next.doors = doorR.value.doors.length;
      if (evR.status === 'fulfilled' && Array.isArray(evR.value?.events)) {
        const today = new Date().toDateString();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        next.eventsToday = (evR.value.events as any[]).filter(e => e.occurred && new Date(e.occurred).toDateString() === today).length;
      }
      setLive(next);
    })();
    return () => { cancelled = true; };
  }, [siteId]);

  const gear = { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, borderRadius: 12, padding: '7px 14px', cursor: 'pointer', background: '#22303f', border: '1px solid rgba(95,184,224,0.28)', color: '#9FD8EC' } as const;
  // Prefer LIVE vendor counts; fall back to the fast local summary until they land.
  const camOnline = live.cameras ? live.cameras.online : (s ? s.devices.camerasOnline : null);
  const camTotal  = live.cameras ? live.cameras.total  : (s ? s.devices.camera : null);
  const camerasDown = (camOnline != null && camTotal != null) ? Math.max(0, camTotal - camOnline) : 0;
  const doorCount = live.doors != null ? live.doors : (s ? (s.doors.total || s.devices.gate) : null);
  const eventsTodayVal = live.eventsToday != null ? live.eventsToday : (s ? s.eventsToday : null);
  const hs = (live.cameras && live.cameras.total > 0)
    ? Math.max(0, Math.round((live.cameras.online / live.cameras.total) * 100 - (s?.faults.open ?? 0) * 4))
    : (s?.healthScore ?? null);
  const hsColor = hs == null ? '#9FD8EC' : hs >= 85 ? '#7ee0a8' : hs >= 60 ? '#fbbf24' : '#f87171';
  const R = 23, C = 2 * Math.PI * R, filled = hs != null ? (hs / 100) * C : 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: { label: string; icon: any; color: string; onClick: () => void }[] = [
    { label: 'Unlock door', icon: LockOpen, color: '#7ee0a8', onClick: () => jump('sec-access') },
    { label: 'Open / reset gate', icon: RotateCcw, color: '#5FB8E0', onClick: () => setShowReboot(true) },
    { label: 'Cameras', icon: Camera, color: '#9FD8EC', onClick: () => jump('sec-cameras') },
    { label: 'Access & passes', icon: Key, color: '#fbbf24', onClick: () => jump('sec-access') },
    { label: 'Report a fault', icon: AlertTriangle, color: '#f87171', onClick: () => jump('sec-faults') },
    { label: 'Activity log', icon: History, color: '#8FD3EC', onClick: () => jump('sec-access') },
  ];

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* Corporate setup gear */}
      {isCorporate && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={() => setShowSetup(v => !v)} style={gear}><Settings size={14} /> {showSetup ? 'Hide setup' : 'Setup & keys'}</button>
        </div>
      )}
      {isCorporate && showSetup && <SiteConnections siteId={siteId} />}

      {/* Intelligence strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 10 }}>
        <div style={{ ...TILE, display: 'flex', alignItems: 'center', gap: 12 }}>
          <svg width="52" height="52" viewBox="0 0 52 52">
            <circle cx="26" cy="26" r={R} fill="none" stroke="#12202c" strokeWidth="6" />
            {hs != null && hs > 0 && <circle cx="26" cy="26" r={R} fill="none" stroke={hsColor} strokeWidth="6" strokeDasharray={`${filled} ${C - filled}`} strokeLinecap="round" transform="rotate(-90 26 26)" />}
            <text x="26" y="30" textAnchor="middle" fontSize="13" fontWeight="700" fill="#eaf2fb">{hs ?? '—'}</text>
          </svg>
          <div>
            <div style={{ color: '#9FD8EC', fontSize: 11 }}>Site health</div>
            <div style={{ color: hsColor, fontSize: 12, fontWeight: 600 }}>{hs == null ? '—' : hs >= 85 ? 'Good' : hs >= 60 ? 'Watch' : 'Attention'}</div>
            <div style={{ color: '#9FD8EC', fontSize: 10 }}>{s ? `${s.faults.open} open fault${s.faults.open === 1 ? '' : 's'}` : '…'}</div>
          </div>
        </div>
        <StripTile icon={Camera} label="Cameras" value={camTotal != null ? `${camOnline}/${camTotal}` : '—'} sub={camerasDown ? `${camerasDown} down` : 'all online'} subColor={camerasDown ? '#f87171' : '#7ee0a8'} />
        <StripTile icon={DoorOpen} label="Doors / gates" value={doorCount != null ? String(doorCount) : '—'} sub={live.doors != null ? 'live · Brivo' : (s ? `${s.doors.panelsLive} controllers live` : '')} subColor="#c3d3e2" />
        <StripTile icon={TrendingUp} label="Uptime · 90d" value={s ? `${s.faults.uptimePct}%` : '—'} sub={live.cameras ? `${live.cameras.online} cam online${live.doors != null ? ` · ${live.doors} doors` : ''}` : (s ? `${s.devices.online}/${s.devices.total} devices online` : '')} subColor="#c3d3e2" />
        <StripTile icon={Zap} label="Events today" value={eventsTodayVal != null ? String(eventsTodayVal) : '—'} sub={live.eventsToday != null ? 'live · Brivo access' : 'access + system'} subColor="#9FD8EC" />
      </div>

      {/* Quick tools */}
      <div style={{ background: WELL, border: '1px solid rgba(140,170,200,0.18)', borderRadius: 16, padding: 12 }}>
        <div style={{ color: '#9FD8EC', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Quick tools</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px,1fr))', gap: 8 }}>
          {tools.map(t => (
            <button key={t.label} onClick={t.onClick} style={{ ...TILE, textAlign: 'center', cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'center' }} aria-hidden><t.icon size={19} style={{ color: t.color }} /></div>
              <div style={{ color: '#e2ebf4', fontSize: 11.5, marginTop: 4 }}>{t.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Live access & control — gate reset, door unlock, passes, door activity */}
      <div id="sec-access"><SiteAccessControl siteId={siteId} /></div>

      {/* Faults & uptime (built) */}
      <div id="sec-faults"><SiteIncidents siteId={siteId} /></div>

      {/* Widgets — reused as-is, each under a defining section header. */}
      <div id="sec-cameras">
        <SectionHead icon={Camera} title="Cameras" desc="Live security — Eagle Eye" />
        <SiteSecurity siteId={siteId} />
        <SiteCameraEvents siteId={siteId} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 14 }}>
        <div id="sec-doors">
          <SectionHead icon={DoorOpen} title="Doors" desc="Access points — Brivo" />
          <SiteDoors siteId={siteId} />
        </div>
        <div id="sec-activity">
          <SectionHead icon={History} title="Activity" desc="Recent access events" />
          <SiteActivity siteId={siteId} />
        </div>
      </div>

      {/* Network — UniFi. Own defining section per request. */}
      <div id="sec-network">
        <SectionHead icon={Wifi} title="Network" desc="Internet, clients & gear health — UniFi" accent="#5FB8E0" />
        <SiteNetwork siteId={siteId} />
        <SiteNetworkDevices siteId={siteId} />
      </div>

      <div id="sec-relays">
        <SectionHead icon={Zap} title="Relays & power" desc="Gate relays & smart switches — Shelly" />
        <SiteRelays siteId={siteId} />
      </div>

      <div id="sec-panels">
        <SectionHead icon={Cpu} title="Controllers & doors" desc="Panels, door programming & provisioning" />
        <SitePanels siteId={siteId} isCorporate={isCorporate} />
      </div>

      {/* Gate re-boot — opened from the “Open / reset gate” quick tool */}
      {showReboot && (
        <div onClick={() => setShowReboot(false)} style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(4,10,20,0.62)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '48px 16px', overflowY: 'auto' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 'min(760px, 96vw)', position: 'relative' }}>
            <button onClick={() => setShowReboot(false)} style={{ position: 'absolute', top: -34, right: 0, background: 'transparent', border: 'none', color: '#c3d3e2', fontSize: 13, cursor: 'pointer' }}>✕ Close</button>
            <GateReboots siteId={siteId} isCorporate={isCorporate} />
          </div>
        </div>
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SectionHead({ icon: Icon, title, desc, accent = '#9FD8EC' }: { icon: any; title: string; desc: string; accent?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', marginBottom: 10, background: WELL, border: '1px solid rgba(140,170,200,0.18)', borderLeft: `3px solid ${accent}`, borderRadius: 12 }}>
      <Icon size={16} style={{ color: accent }} aria-hidden />
      <div>
        <div style={{ color: '#eaf2fb', fontSize: 13, fontWeight: 700, letterSpacing: '0.01em' }}>{title}</div>
        <div style={{ color: '#c3d3e2', fontSize: 10.5 }}>{desc}</div>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function StripTile({ icon: Icon, label, value, sub, subColor }: { icon: any; label: string; value: string; sub: string; subColor: string }) {
  return (
    <div style={TILE}>
      <div style={{ color: '#9FD8EC', fontSize: 11, display: 'flex', alignItems: 'center', gap: 5 }}><Icon size={13} aria-hidden /> {label}</div>
      <div style={{ color: '#eaf2fb', fontSize: 22, fontWeight: 700, lineHeight: 1.1, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ color: subColor, fontSize: 10, marginTop: 1 }}>{sub}</div>}
    </div>
  );
}
