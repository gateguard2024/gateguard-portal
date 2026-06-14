'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Check,
  Wifi,
  WifiOff,
  Activity,
  Wrench,
  Shield,
  MapPin,
  Clock,
  FileText,
} from 'lucide-react';
// Vercel lucide cache quirk — load these via require()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Camera, DoorOpen, Cpu, Server, Radio, AlertCircle, ArrowLeft } = require('lucide-react') as any;
// --- Data Types ---
type Health = 'online' | 'warning' | 'offline';
type Device = {
  id: string;
  name: string;
  type: string;
  category: 'camera' | 'reader' | 'intercom' | 'gate' | 'network';
  health: Health;
  firmware?: string;
  last_seen?: string;
  issue?: string | null;
};
type SiteSystem = {
  id: string;
  site_name: string;
  address?: string | null;
  isp?: string | null;
  device_total: number;
  online: number;
  offline: number;
  warning: number;
  last_checked: string;
  devices: Device[];
  activity: { at: string; text: string }[];
};
// --- Data: real API with mock fallback ---
const loadSystems = async (): Promise<SiteSystem[]> => {
  try {
    const res = await fetch('/api/nexus/systems', { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json.sites)) return json.sites as SiteSystem[];
    }
  } catch {
    /* fall through to preview */
  }
  return mockSystems();
};
const mockSystems = async (): Promise<SiteSystem[]> => {
  const now = Date.now();
  const minsAgo = (m: number) => new Date(now - m * 60000).toISOString();
  const hoursAgo = (h: number) => new Date(now - h * 3600000).toISOString();
  return [
    {
      id: 'sys-1', site_name: 'Avalon Heights', address: '123 Heights Blvd, Cityville', isp: 'Comcast Business (Fiber)',
      device_total: 4, online: 4, offline: 0, warning: 0, last_checked: minsAgo(2),
      devices: [
        { id: 'd1', name: 'Front Gate Camera', type: 'Hikvision Dome', category: 'camera', health: 'online', firmware: 'v2.1.4', last_seen: minsAgo(1) },
        { id: 'd2', name: 'Main Entrance Reader', type: 'HID Signo', category: 'reader', health: 'online', firmware: 'v1.0.2', last_seen: minsAgo(2) },
        { id: 'd3', name: 'Lobby Intercom', type: 'ButterflyMX 8"', category: 'intercom', health: 'online', firmware: 'v3.5', last_seen: minsAgo(1) },
        { id: 'd4', name: 'Main NVR', type: 'UniFi Protect', category: 'network', health: 'online', firmware: 'v3.0.1', last_seen: minsAgo(5) },
      ],
      activity: [{ at: hoursAgo(2), text: 'System health check passed' }, { at: hoursAgo(24), text: 'Firmware updated on Front Gate Camera' }],
    },
    {
      id: 'sys-2', site_name: 'The Beacon', address: '789 Harbor Drive, Portside', isp: 'Spectrum Enterprise',
      device_total: 3, online: 1, offline: 1, warning: 1, last_checked: minsAgo(5),
      devices: [
        { id: 'd5', name: 'Parking Camera 1', type: 'Verkada Dome', category: 'camera', health: 'warning', firmware: 'v1.2', last_seen: minsAgo(15), issue: 'High latency detected' },
        { id: 'd6', name: 'North Gate Operator', type: 'LiftMaster', category: 'gate', health: 'offline', firmware: 'v4.1', last_seen: hoursAgo(2), issue: 'Controller unresponsive' },
        { id: 'd7', name: 'Lobby Reader', type: 'Salto', category: 'reader', health: 'online', firmware: 'v2.2', last_seen: minsAgo(1) },
      ],
      activity: [{ at: hoursAgo(2), text: 'North Gate Operator went offline' }, { at: hoursAgo(3), text: 'High latency reported on Parking Camera 1' }],
    },
    {
      id: 'sys-3', site_name: 'Sunrise Estates', address: '100 Sunrise Way, Suburbia', isp: 'AT&T Fiber',
      device_total: 2, online: 2, offline: 0, warning: 0, last_checked: minsAgo(1),
      devices: [
        { id: 'd8', name: 'Pool Gate Reader', type: 'Brivo', category: 'reader', health: 'online', firmware: 'v1.1', last_seen: minsAgo(1) },
        { id: 'd9', name: 'Clubhouse Intercom', type: 'Aiphone', category: 'intercom', health: 'online', firmware: 'v2.0', last_seen: minsAgo(3) },
      ],
      activity: [{ at: hoursAgo(12), text: 'Daily health check completed' }],
    },
  ];
};
// --- Theme & Helpers ---
const glassPanel = { backgroundColor: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)' };
const glassAction = { backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' };
const textPrimary = { color: 'rgba(255,255,255,0.9)' };
const textSecondary = { color: 'rgba(255,255,255,0.5)' };
const textFaint = { color: 'rgba(255,255,255,0.34)' };
const brandBlue = '#6B7EFF';
const brandCyan = '#00C8FF';
const colorOnline = '#34D399';
const colorWarning = '#FBBF24';
const colorOffline = '#F87171';
const getHealthColor = (health: Health) => {
  if (health === 'online') return colorOnline;
  if (health === 'warning') return colorWarning;
  return colorOffline;
};
const getHealthLabel = (site: SiteSystem) => {
  if (site.offline > 0) return 'Offline Issues';
  if (site.warning > 0) return 'Needs Attention';
  return 'All Good';
};
const getHealthIcon = (health: Health) => {
  if (health === 'online') return <Check size={14} />;
  if (health === 'warning') return <AlertCircle size={14} />;
  return <WifiOff size={14} />;
};
const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'camera': return <Camera size={16} />;
    case 'reader': return <Shield size={16} />;
    case 'intercom': return <Radio size={16} />;
    case 'gate': return <DoorOpen size={16} />;
    case 'network': return <Server size={16} />;
    default: return <Cpu size={16} />;
  }
};
const formatRelativeTime = (isoString: string) => {
  if (!isoString) return '—';
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays}d ago`;
};
// --- Components ---
export default function SystemsExplorer() {
  const router = useRouter();
  const [sites, setSites] = useState<SiteSystem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    loadSystems().then(data => {
      setSites(data);
      setIsLoading(false);
    });
  }, []);
  const handleAction = (actionName: string, id: string) => {
    if (actionName === 'open_site') { router.push(`/sites/${id}`); return; }
    if (actionName === 'new_wo') { router.push(`/maintenance?site=${id}`); return; }
    if (actionName === 'view_design') { router.push(`/design/floor-plans?site=${id}`); return; }
    console.log(`Action: ${actionName} on ID: ${id}`);
  };
  const filteredSites = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return sites.filter(s =>
      s.site_name.toLowerCase().includes(q) ||
      (s.address && s.address.toLowerCase().includes(q))
    );
  }, [searchQuery, sites]);
  const selectedSite = useMemo(() => {
    return sites.find(s => s.id === selectedId) || null;
  }, [selectedId, sites]);
  const globalStats = useMemo(() => {
    return sites.reduce((acc, site) => ({
      total: acc.total + site.device_total,
      online: acc.online + site.online,
      warning: acc.warning + site.warning,
      offline: acc.offline + site.offline,
    }), { total: 0, online: 0, warning: 0, offline: 0 });
  }, [sites]);
  // --- Detail Pane Renderer ---
  const renderDetailPane = (site: SiteSystem) => {
    const overallHealthColor = site.offline > 0 ? colorOffline : site.warning > 0 ? colorWarning : colorOnline;
    const overallHealthLabel = getHealthLabel(site);

    const groupedDevices = site.devices.reduce((acc, dev) => {
      if (!acc[dev.category]) acc[dev.category] = [];
      acc[dev.category].push(dev);
      return acc;
    }, {} as Record<string, Device[]>);
    const issues = site.devices.filter(d => d.health !== 'online');
    return (
      <div className="flex flex-col lg:flex-row gap-6 p-4 md:p-6 w-full max-w-6xl mx-auto h-full">

        {/* MAIN CONTENT AREA */}
        <div className="flex-1 flex flex-col gap-6 overflow-y-auto hide-scrollbar pb-16">

          {/* 1. Big Top Card */}
          <div className="rounded-3xl p-6 relative overflow-hidden" style={glassPanel}>
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl opacity-10 pointer-events-none" style={{ backgroundColor: overallHealthColor, transform: 'translate(30%, -30%)' }} />

            <div className="flex items-center gap-2 mb-3 relative z-10">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: textSecondary.color }}>
                System
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase flex items-center gap-1.5" style={{ backgroundColor: `${overallHealthColor}1A`, color: overallHealthColor }}>
                {getHealthIcon(site.offline > 0 ? 'offline' : site.warning > 0 ? 'warning' : 'online')}
                {overallHealthLabel}
              </span>
            </div>

            <h2 className="text-3xl font-semibold tracking-tight mb-2 relative z-10" style={textPrimary}>
              {site.site_name}
            </h2>

            <div className="flex items-center gap-2 text-sm relative z-10" style={textSecondary}>
              <MapPin size={16} />
              <span>{site.address || 'No address provided'}</span>
            </div>
          </div>
          {/* 2. Four Quick Facts Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total Devices', val: site.device_total, color: textPrimary.color },
              { label: 'Online', val: site.online, color: colorOnline },
              { label: 'Offline / Warn', val: site.offline + site.warning, color: site.offline > 0 ? colorOffline : site.warning > 0 ? colorWarning : textPrimary.color },
              { label: 'Last Checked', val: formatRelativeTime(site.last_checked), color: textPrimary.color }
            ].map((fact, i) => (
              <div key={i} className="rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-1" style={glassPanel}>
                <div className="text-xl md:text-2xl font-semibold mt-1" style={{ color: fact.color }}>{fact.val}</div>
                <div className="text-[10px] font-bold uppercase tracking-wider mt-0.5" style={textSecondary}>{fact.label}</div>
              </div>
            ))}
          </div>
          {/* 3. Human Detail Blocks */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Devices by Category Block */}
            <div className="rounded-2xl p-5 md:col-span-2" style={glassPanel}>
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={textPrimary}>
                <Cpu size={16} style={{ color: brandCyan }} /> Installed Devices
              </h3>

              <div className="flex flex-col gap-6">
                {Object.entries(groupedDevices).map(([category, devs]) => (
                  <div key={category}>
                    <h4 className="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={textSecondary}>
                      {getCategoryIcon(category)} {category}s
                    </h4>
                    <div className="flex flex-col gap-2">
                      {devs.map(dev => {
                        const hColor = getHealthColor(dev.health);
                        return (
                          <div key={dev.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl gap-3" style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-sm truncate" style={textPrimary}>{dev.name}</div>
                              <div className="text-xs mt-0.5 truncate" style={textSecondary}>{dev.type} {dev.firmware && `• ${dev.firmware}`}</div>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <div className="text-xs text-right" style={textFaint}>Seen {formatRelativeTime(dev.last_seen || '')}</div>
                              <div className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ backgroundColor: `${hColor}1A`, color: hColor }}>
                                {getHealthIcon(dev.health)} {dev.health}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {site.devices.length === 0 && (
                  <div className="text-sm" style={textFaint}>No device details available.</div>
                )}
              </div>
            </div>
            {/* Open Issues Block */}
            <div className="rounded-2xl p-5" style={glassPanel}>
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={textPrimary}>
                <AlertCircle size={16} style={{ color: colorOffline }} /> Open Issues
              </h3>
              {issues.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {issues.map(iss => (
                    <div key={iss.id} className="pb-3 border-b last:border-0 last:pb-0" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                      <div className="text-sm font-medium mb-1 flex items-center gap-2" style={textPrimary}>
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getHealthColor(iss.health) }} />
                        {iss.name}
                      </div>
                      <div className="text-xs" style={textSecondary}>{iss.issue || 'Unknown issue reported'}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm flex items-center gap-2" style={{ color: colorOnline }}>
                  <Check size={16} /> All systems operational.
                </div>
              )}
            </div>
            {/* Connectivity Block */}
            <div className="rounded-2xl p-5 flex flex-col" style={glassPanel}>
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={textPrimary}>
                <Wifi size={16} style={{ color: brandBlue }} /> Connectivity
              </h3>
              <div className="flex-1 flex flex-col justify-center gap-2">
                <div className="text-xs uppercase tracking-wider font-semibold" style={textSecondary}>Primary ISP</div>
                <div className="text-lg font-medium" style={textPrimary}>{site.isp || 'Unknown Provider'}</div>
                <div className="text-sm flex items-center gap-2 mt-1" style={{ color: colorOnline }}>
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Network online
                </div>
              </div>
            </div>
            {/* Activity Block */}
            <div className="rounded-2xl p-5 md:col-span-2" style={glassPanel}>
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={textPrimary}>
                <Activity size={16} style={textSecondary} /> Recent Activity
              </h3>
              <div className="flex flex-col gap-3">
                {site.activity.map((act, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} />
                    <div>
                      <div className="text-sm" style={textPrimary}>{act.text}</div>
                      <div className="text-xs mt-0.5" style={textFaint}>{formatRelativeTime(act.at)}</div>
                    </div>
                  </div>
                ))}
                {site.activity.length === 0 && (
                  <div className="text-sm" style={textFaint}>No recent system activity.</div>
                )}
              </div>
            </div>
          </div>
        </div>
        {/* 4. Right Action Rail */}
        <div className="w-full lg:w-64 flex-shrink-0 flex flex-col gap-3 pb-16">
          <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={textSecondary}>Actions</div>

          <button onClick={() => handleAction('new_wo', site.id)} className="w-full rounded-2xl p-3.5 flex items-center gap-3 text-sm font-medium transition-colors hover:bg-white/5" style={glassAction}>
            <Wrench size={18} style={{ color: brandBlue }} />
            <span style={textPrimary}>Create Work Order</span>
          </button>

          <button onClick={() => handleAction('open_site', site.id)} className="w-full rounded-2xl p-3.5 flex items-center gap-3 text-sm font-medium transition-colors hover:bg-white/5" style={glassAction}>
            <MapPin size={18} style={{ color: brandCyan }} />
            <span style={textPrimary}>Open Site</span>
          </button>
          <button onClick={() => handleAction('run_health_check', site.id)} className="w-full rounded-2xl p-3.5 flex items-center gap-3 text-sm font-medium transition-colors hover:bg-white/5" style={glassPanel}>
            <Activity size={18} style={textSecondary} />
            <span style={textPrimary}>Run Health Check</span>
          </button>
          <button onClick={() => handleAction('view_design', site.id)} className="w-full rounded-2xl p-3.5 flex items-center gap-3 text-sm font-medium transition-colors hover:bg-white/5" style={glassPanel}>
            <Cpu size={18} style={textSecondary} />
            <span style={textPrimary}>View Design</span>
          </button>
          <button onClick={() => handleAction('add_note', site.id)} className="w-full rounded-2xl p-3.5 flex items-center gap-3 text-sm font-medium transition-colors hover:bg-white/5" style={glassPanel}>
            <FileText size={18} style={textSecondary} />
            <span style={textPrimary}>Add Note</span>
          </button>
        </div>
      </div>
    );
  };
  return (
    <div className="flex w-full h-[100dvh] pb-28 font-sans overflow-hidden bg-black/40">

      {/* LEFT PANE: Search & List */}
      <div
        className={`w-full md:w-[420px] flex-shrink-0 flex-col border-r h-full ${selectedId ? 'hidden md:flex' : 'flex'}`}
        style={{ borderColor: 'rgba(255,255,255,0.08)' }}
      >
        {/* Header & Global Stats Area */}
        <div className="p-5 flex flex-col gap-4 shrink-0">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight mb-1" style={textPrimary}>Systems</h1>
            <p className="text-xs leading-relaxed" style={textSecondary}>
              Every installed device, and whether it&apos;s online.
            </p>
          </div>
          {/* Health Summary Strip (Grid) */}
          {!isLoading && (
            <div className="grid grid-cols-4 gap-2">
              <div className="rounded-xl p-2.5 flex flex-col items-center justify-center text-center" style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
                <div className="text-xs mb-1" style={textFaint}>Total</div>
                <div className="text-lg font-semibold" style={textPrimary}>{globalStats.total}</div>
              </div>
              <div className="rounded-xl p-2.5 flex flex-col items-center justify-center text-center" style={{ backgroundColor: 'rgba(52,211,153,0.05)' }}>
                <div className="text-xs mb-1" style={{ color: colorOnline }}>Online</div>
                <div className="text-lg font-semibold" style={{ color: colorOnline }}>{globalStats.online}</div>
              </div>
              <div className="rounded-xl p-2.5 flex flex-col items-center justify-center text-center" style={{ backgroundColor: 'rgba(251,191,36,0.05)' }}>
                <div className="text-xs mb-1" style={{ color: colorWarning }}>Warn</div>
                <div className="text-lg font-semibold" style={{ color: colorWarning }}>{globalStats.warning}</div>
              </div>
              <div className="rounded-xl p-2.5 flex flex-col items-center justify-center text-center" style={{ backgroundColor: 'rgba(248,113,113,0.05)' }}>
                <div className="text-xs mb-1" style={{ color: colorOffline }}>Offline</div>
                <div className="text-lg font-semibold" style={{ color: colorOffline }}>{globalStats.offline}</div>
              </div>
            </div>
          )}
          {/* Search Box */}
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-2xl" style={glassPanel}>
            <Search size={16} style={textSecondary} />
            <input
              type="text"
              placeholder="Search sites or devices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-sm w-full placeholder:text-white/30"
              style={textPrimary}
            />
          </div>
        </div>
        {/* Results List */}
        <div className="flex-1 overflow-y-auto px-3 pb-4 hide-scrollbar">
          {isLoading ? (
            <div className="p-8 text-center text-sm" style={textSecondary}>Loading systems...</div>
          ) : filteredSites.length === 0 ? (
            <div className="p-8 text-center text-sm" style={textSecondary}>No sites found.</div>
          ) : (
            filteredSites.map((site) => {
              const isSelected = selectedId === site.id;
              const overallColor = site.offline > 0 ? colorOffline : site.warning > 0 ? colorWarning : colorOnline;
              const onlinePct = site.device_total > 0 ? (site.online / site.device_total) * 100 : 0;
              const warningPct = site.device_total > 0 ? (site.warning / site.device_total) * 100 : 0;
              const offlinePct = site.device_total > 0 ? (site.offline / site.device_total) * 100 : 0;

              return (
                <button
                  key={site.id}
                  onClick={() => setSelectedId(site.id)}
                  className="w-full text-left p-4 rounded-2xl mb-2 flex flex-col gap-3 transition-all"
                  style={{
                    backgroundColor: isSelected ? 'rgba(255,255,255,0.06)' : glassPanel.backgroundColor,
                    border: isSelected ? '1px solid rgba(255,255,255,0.15)' : glassPanel.border,
                  }}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-base truncate mb-0.5" style={textPrimary}>{site.site_name}</div>
                      <div className="text-xs truncate" style={textSecondary}>{site.address || 'No address'}</div>
                    </div>
                    <div
                      className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider flex-shrink-0"
                      style={{ backgroundColor: `${overallColor}1A`, color: overallColor }}
                    >
                      {getHealthLabel(site)}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 mt-1">
                    {/* Visual Health Bar */}
                    <div className="w-full h-1.5 rounded-full flex overflow-hidden bg-white/5">
                      <div style={{ width: `${onlinePct}%`, backgroundColor: colorOnline }} />
                      <div style={{ width: `${warningPct}%`, backgroundColor: colorWarning }} />
                      <div style={{ width: `${offlinePct}%`, backgroundColor: colorOffline }} />
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-medium" style={textSecondary}>
                      <div className="flex items-center gap-2">
                        <span style={{ color: colorOnline }}>{site.online} online</span>
                        {(site.warning > 0 || site.offline > 0) && (
                          <span style={{ color: site.offline > 0 ? colorOffline : colorWarning }}>
                            • {site.warning + site.offline} issue{site.warning + site.offline > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <div style={textFaint}>{site.device_total} total</div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
      {/* RIGHT PANE: Detail View */}
      <div className={`flex-1 flex-col h-full relative ${!selectedId ? 'hidden md:flex items-center justify-center' : 'flex'}`}>

        {/* Mobile Back Header */}
        {selectedId && (
          <div className="md:hidden flex items-center px-4 py-3 border-b flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <button onClick={() => setSelectedId(null)} className="flex items-center gap-2 text-sm font-medium" style={textPrimary}>
              <ArrowLeft size={18} /> Back to list
            </button>
          </div>
        )}
        {!selectedSite ? (
          <div className="text-center p-8 hidden md:block">
            <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4" style={glassPanel}>
              <Cpu size={24} style={textSecondary} />
            </div>
            <h3 className="text-lg font-medium mb-1" style={textPrimary}>Select a site</h3>
            <p className="text-sm" style={textSecondary}>View installed devices and system health.</p>
          </div>
        ) : (
          renderDetailPane(selectedSite)
        )}
      </div>
    </div>
  );
}
