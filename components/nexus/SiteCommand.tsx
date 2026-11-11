'use client';

// SiteCommand — one property's systems (Systems tab → a location). Light Apple look.
//   Status tiles: health · cameras · doors · uptime/faults · door events today
//   Quick actions: unlock a door · reset a gate · visitor pass · report a fault · cameras
//   Tabs: Live · Doors & gates · People · Packages · Activity · Faults · Network · Controllers · Setup (checklist + steps)
// The same panel (SitePanel) is used on the Operations site page via SiteSystems.
// 🔒 "Setup & keys" (vendor logins) renders ONLY for corporate users — and every
// credential endpoint refuses non-corporate server-side. Never loosen this.
// Status button (Active / Inactive / Take offline) is corporate-only too (systems/Decommission.tsx).
// "Property portal" (the manager's /portal/<address>: on/off, code, cameras, gates) is corporate-only (systems/PropertyPortal.tsx).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CSS, type Any, getJson, Sheet, useFlash, DOT, Dot, GREEN, RED, ORANGE, type SiteCtx } from '@/components/nexus/systems/shared';
import { LiveTab } from '@/components/nexus/systems/LiveTab';
import { DoorsTab } from '@/components/nexus/systems/DoorsTab';
import { PeopleTab } from '@/components/nexus/systems/PeopleTab';
import { ActivityTab } from '@/components/nexus/systems/ActivityTab';
import { NetworkTab } from '@/components/nexus/systems/NetworkTab';
import { SetupTab } from '@/components/nexus/systems/SetupTab';
import { PackagesTab } from '@/components/nexus/systems/PackagesTab';
import { SiteIncidents } from '@/components/nexus/SiteIncidents';
import { SitePanels } from '@/components/nexus/SitePanels';
import { SiteConnections } from '@/components/nexus/SiteConnections';
import { InactiveBanner, SiteStatusSheet, statusOf } from '@/components/nexus/systems/Decommission';
import { PropertyPortalSetup } from '@/components/nexus/systems/PropertyPortal';
import { todayET, etDateOf } from '@/lib/tz';

type Tab = 'live' | 'doors' | 'people' | 'packages' | 'activity' | 'faults' | 'network' | 'controllers' | 'setup';
const TABS: { id: Tab; label: string }[] = [
  { id: 'live', label: 'Live' }, { id: 'doors', label: 'Doors & gates' }, { id: 'people', label: 'People' }, { id: 'packages', label: 'Packages' },
  { id: 'activity', label: 'Activity' }, { id: 'faults', label: 'Faults' }, { id: 'network', label: 'Network' }, { id: 'controllers', label: 'Controllers' },
  { id: 'setup', label: 'Setup' },
];
type Summary = { devices?: Any; doors?: Any; faults?: { open: number; uptimePct: number; timeSinceLastMs: number | null }; eventsToday?: number; healthScore?: number };

const ICONS: Record<string, React.ReactNode> = {
  unlock: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 7.8-1.2" /></svg>,
  gate: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></svg>,
  pass: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="9" cy="8" r="4" /><path d="M2 21a7 7 0 0 1 14 0" /><path d="M19 8v6M16 11h6" /></svg>,
  fault: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 3 2 21h20L12 3z" /><path d="M12 10v4M12 17.5v.5" /></svg>,
  cam: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="2" y="6" width="14" height="12" rx="2" /><path d="m16 10 6-3v10l-6-3" /></svg>,
};

function readTab(): Tab { try { const t = localStorage.getItem('gg_systems_tab') as Tab | null; return t && TABS.some(x => x.id === t) ? t : 'live'; } catch { return 'live'; } }

/** The panel: status, quick actions and tabs for one property. */
export function SitePanel({ siteId, isCorporate, initialSetup, setupRequest }: { siteId: string; isCorporate: boolean; initialSetup?: boolean; setupRequest?: number }) {
  const [flash, notify] = useFlash();
  const [tab, setTabState] = useState<Tab>('live');
  useEffect(() => { setTabState(readTab()); }, []);
  const setTab = useCallback((t: Tab) => { setTabState(t); try { localStorage.setItem('gg_systems_tab', t); } catch { /* private mode */ } }, []);
  const [setup, setSetup] = useState(!!initialSetup && isCorporate);
  useEffect(() => { if (setupRequest && isCorporate) setSetup(true); }, [setupRequest, isCorporate]);
  const openSetup = useCallback(() => { if (isCorporate) setSetup(true); }, [isCorporate]);
  const ctx: SiteCtx = useMemo(() => ({ siteId, isCorporate, notify, openSetup }), [siteId, isCorporate, notify, openSetup]);

  // ── Shared data (loaded once, used by tiles + tabs) ────────────────────────
  const [summary, setSummary] = useState<Summary | null>(null);
  const [cams, setCams] = useState<Any[] | null>(null); const [camErr, setCamErr] = useState<string | null>(null);
  const [doors, setDoors] = useState<Any[] | null>(null); const [doorErr, setDoorErr] = useState<string | null>(null);
  const [camMap, setCamMap] = useState<Record<string, Any>>({});
  const [relays, setRelays] = useState<Any[] | null>(null); const [relayErr, setRelayErr] = useState<string | null>(null);
  const [events, setEvents] = useState<Any[] | null>(null); const [eventErr, setEventErr] = useState<string | null>(null);
  const [net, setNet] = useState<Any | null | undefined>(undefined);
  const [gateSum, setGateSum] = useState<Any | null>(null); // Gate Watch: the watched gates are THE gate count
  const [who, setWho] = useState('');
  const [faultReq, setFaultReq] = useState(0);
  const [guestReq, setGuestReq] = useState(0);

  const loadSummary = useCallback(async () => { const r = await getJson(`/api/sites/${siteId}/command-summary`); if (r.ok) setSummary(r.data as Summary); }, [siteId]);
  const loadCams = useCallback(async () => {
    const r = await getJson(`/api/eagle-eye/cameras?site_id=${siteId}`);
    setCams(Array.isArray(r.data.cameras) ? r.data.cameras : []); setCamErr(r.ok ? null : (r.data.error || 'Cameras unavailable.'));
  }, [siteId]);
  const loadDoors = useCallback(async () => {
    const [d, m] = await Promise.all([getJson(`/api/brivo/doors?site_id=${siteId}`), getJson(`/api/sites/${siteId}/door-cameras`)]);
    setDoors(Array.isArray(d.data.doors) ? d.data.doors : []); setDoorErr(d.ok ? null : (d.data.error || 'Doors unavailable.'));
    const map: Record<string, Any> = {}; for (const x of (m.data.mappings ?? []) as Any[]) map[String(x.door_id)] = x; setCamMap(map);
  }, [siteId]);
  const loadRelays = useCallback(async () => {
    const r = await getJson(`/api/shelly/relays?site_id=${siteId}`);
    setRelays(Array.isArray(r.data.relays) ? r.data.relays : []); setRelayErr(r.ok ? null : (r.data.error || 'Relays unavailable.'));
  }, [siteId]);
  const loadGates = useCallback(async () => { const r = await getJson(`/api/sites/${siteId}/gates`); setGateSum(r.ok ? (r.data.summary ?? null) : null); }, [siteId]);
  const loadEvents = useCallback(async () => {
    const r = await getJson(`/api/brivo/events?site_id=${siteId}`);
    setEvents(Array.isArray(r.data.events) ? r.data.events : []); setEventErr(r.ok ? null : (r.data.error || 'Door events unavailable.'));
  }, [siteId]);

  useEffect(() => {
    setSummary(null); setCams(null); setDoors(null); setRelays(null); setEvents(null); setNet(undefined); setGateSum(null);
    void loadSummary(); void loadCams(); void loadDoors(); void loadRelays(); void loadEvents(); void loadGates();
  }, [loadSummary, loadCams, loadDoors, loadRelays, loadEvents, loadGates]);
  // Door events stay live (tiles + Activity tab): every 20s while the page is visible.
  useEffect(() => { const t = setInterval(() => { if (!document.hidden) void loadEvents(); }, 20000); return () => clearInterval(t); }, [loadEvents]);
  // Network is only fetched when someone opens it.
  useEffect(() => {
    if (tab !== 'network' || net !== undefined) return;
    void getJson(`/api/unifi/cloud/overview?site_id=${siteId}`).then(r => setNet(r.ok && r.data?.connected ? r.data : null));
  }, [tab, net, siteId]);

  const setRelayState = useCallback((id: string, ch: number, on: boolean) => setRelays(p => (p ?? []).map(r => String(r.id) === id && Number(r.channel ?? 0) === ch ? { ...r, on, ison: on } : r)), []);
  const [setupRound, setSetupRound] = useState(0);
  const afterSetup = useCallback(() => { setSetupRound(n => n + 1); void loadCams(); void loadDoors(); void loadRelays(); void loadEvents(); setNet(undefined); }, [loadCams, loadDoors, loadRelays, loadEvents]);

  // ── Tiles ──────────────────────────────────────────────────────────────────
  const camTotal = cams?.length ?? 0;
  const camOff = (cams ?? []).filter(c => c.online === false).length;
  const today = todayET();
  const eventsToday = events ? events.filter(e => e.created_at && etDateOf(e.created_at) === today).length : null;
  const openFaults = summary?.faults?.open ?? 0;
  const health = camTotal > 0
    ? Math.max(0, Math.round(((camTotal - camOff) / camTotal) * 100 - openFaults * 4))
    : (summary?.healthScore ?? null);
  const hColor = health == null ? undefined : health >= 85 ? GREEN : health >= 60 ? ORANGE : RED;
  const tiles: { l: string; v: string; s: string; dot?: string; color?: string; go?: Tab }[] = [
    { l: 'Health', v: health == null ? '—' : String(health), s: health == null ? 'Not enough data' : health >= 85 ? 'Good' : health >= 60 ? 'Keep an eye on it' : 'Needs attention', color: hColor, dot: health == null ? DOT.gray : health >= 85 ? DOT.green : health >= 60 ? DOT.orange : DOT.red, go: 'faults' },
    { l: 'Cameras', v: cams == null ? '—' : camTotal ? `${camTotal - camOff}/${camTotal}` : '—', s: cams == null ? 'Loading…' : !camTotal ? 'None connected' : camOff ? `${camOff} offline` : 'All online', dot: camOff ? DOT.orange : DOT.blue, go: 'live' },
    gateSum?.watched
      // Gates = the ones Gate Watch is on for. Stuck open = down.
      ? { l: 'Gates', v: `${gateSum.watched - gateSum.down}/${gateSum.watched}`, s: gateSum.down ? `${gateSum.down} down (stuck open)` : gateSum.up_pct != null ? `${gateSum.up_pct}% up · 30 days` : 'All up', color: gateSum.down ? RED : undefined, dot: gateSum.down ? DOT.red : DOT.green, go: 'doors' }
      : { l: 'Doors & gates', v: doors == null ? '—' : String(doors.length), s: doors == null ? 'Loading…' : doorErr && !doors.length ? 'Brivo not connected' : 'From Brivo', dot: DOT.blue, go: 'doors' },
    { l: 'Uptime · 90 days', v: summary?.faults ? `${summary.faults.uptimePct}%` : '—', s: openFaults ? `${openFaults} open fault${openFaults === 1 ? '' : 's'}` : 'No open faults', dot: openFaults ? DOT.red : DOT.green, go: 'faults' },
    { l: 'Door events today', v: eventsToday == null ? '—' : String(eventsToday), s: eventErr && !(events ?? []).length ? 'Not available' : 'Live from Brivo', dot: DOT.blue, go: 'activity' },
  ];
  const go = (t: Tab, then?: () => void) => { setTab(t); if (then) setTimeout(then, 60); };
  const quick: { k: string; label: string; run: () => void }[] = [
    { k: 'unlock', label: 'Unlock a door', run: () => go('doors') },
    { k: 'gate', label: 'Reset a gate', run: () => go('doors', () => document.getElementById('sy-reboots')?.scrollIntoView({ behavior: 'smooth', block: 'start' })) },
    { k: 'pass', label: 'Visitor pass', run: () => go('people', () => setGuestReq(n => n + 1)) },
    { k: 'fault', label: 'Report a fault', run: () => go('faults', () => setFaultReq(n => n + 1)) },
    { k: 'cam', label: 'Watch cameras', run: () => go('live') },
  ];

  return (
    <>
      <div className="sy-kpis" aria-label="Property status">
        {tiles.map(t => (
          <button key={t.l} type="button" className="sy-kpi" onClick={() => t.go && setTab(t.go)}>
            <div className="l">{t.dot && <Dot c={t.dot} />}{t.l}</div>
            <div className="v" style={{ color: t.color }}>{t.v}</div>
            <div className="s">{t.s}</div>
          </button>
        ))}
      </div>
      <div className="sy-quick">
        {quick.map(q => <button key={q.k} type="button" className="sy-q" onClick={q.run}><span className="ic">{ICONS[q.k]}</span>{q.label}</button>)}
      </div>
      <div className="sy-tabs" role="tablist" aria-label="Systems">
        {TABS.map(t => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}{t.id === 'faults' && openFaults > 0 && <span className="n">{openFaults}</span>}
          </button>
        ))}
      </div>

      <div role="tabpanel" aria-label={TABS.find(x => x.id === tab)?.label}>
        {tab === 'live' && <LiveTab ctx={ctx} cams={cams} camErr={camErr} doors={doors} camMap={camMap} reloadDoors={loadDoors} />}
        {tab === 'doors' && <DoorsTab ctx={ctx} doors={doors} doorErr={doorErr} camMap={camMap} cams={cams} relays={relays} relayErr={relayErr} reloadDoors={loadDoors} reloadRelays={loadRelays} setRelayState={setRelayState} />}
        {tab === 'people' && <PeopleTab ctx={ctx} guestRequest={guestReq} onActivity={n => { setWho(n); setTab('activity'); }} />}
        {tab === 'packages' && <PackagesTab ctx={ctx} />}
        {tab === 'activity' && <ActivityTab ctx={ctx} brivoEvents={events} brivoErr={eventErr} who={who} setWho={setWho} />}
        {tab === 'faults' && <SiteIncidents siteId={siteId} notify={notify} onChanged={loadSummary} logRequest={faultReq} />}
        {tab === 'network' && <NetworkTab ctx={ctx} ov={net} />}
        {tab === 'controllers' && <SitePanels siteId={siteId} isCorporate={isCorporate} notify={notify} />}
        {tab === 'setup' && <SetupTab key={setupRound} ctx={ctx} cams={cams} doors={doors} doorErr={doorErr} relays={relays} camMap={camMap} onGo={setTab} />}
      </div>

      {setup && isCorporate && (
        <Sheet title="Setup & keys" sub="Corporate only — this property’s vendor logins." onClose={() => { setSetup(false); afterSetup(); }} width={640}>
          <SiteConnections siteId={siteId} />
        </Sheet>
      )}
      {flash}
    </>
  );
}

export function SiteCommand({ siteId, isCorporate, site, onBack, onStatusChange }: { siteId: string; isCorporate: boolean; site?: Any; onBack?: () => void; onStatusChange?: (status: string) => void }) {
  const [setupReq, setSetupReq] = useState(0);
  // Active / inactive / taking offline (corporate manages it; everyone sees the banner).
  const [status, setStatus] = useState<string>(site?.status ?? 'active');
  const [reason, setReason] = useState<string | null>(site?.inactive_reason ?? null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [portalOpen, setPortalOpen] = useState(false);
  const [flash, notify] = useFlash();
  useEffect(() => { setStatus(site?.status ?? 'active'); setReason(site?.inactive_reason ?? null); }, [site?.status, site?.inactive_reason]);
  const st = statusOf(status);
  return (
    <div className="sy">
      <style>{CSS}</style>
      <header className="sy-hd">
        <div style={{ minWidth: 0 }}>
          {onBack && <button type="button" className="sy-back" onClick={onBack}>‹ All locations</button>}
          <h1>{site?.name || 'Property'}</h1>
          {(site?.address || site?.city) && <div className="sub">{[site.address, site.city, site.state].filter(Boolean).join(', ')}</div>}
        </div>
        {isCorporate && <div className="sy-acts">
          <button type="button" className="sy-b dark" onClick={() => setStatusOpen(true)} aria-label={`Property status: ${st.label}. Change`}><Dot c={st.dot} />{st.label}</button>
          <button type="button" className="sy-b dark" onClick={() => setPortalOpen(true)}>Property portal</button>
          <button type="button" className="sy-b dark" onClick={() => setSetupReq(n => n + 1)}>Setup &amp; keys</button>
        </div>}
      </header>
      <InactiveBanner status={status} reason={reason} onManage={isCorporate ? () => setStatusOpen(true) : undefined} />
      <SitePanel siteId={siteId} isCorporate={isCorporate} setupRequest={setupReq} />
      {statusOpen && isCorporate && (
        <SiteStatusSheet siteId={siteId} siteName={site?.name} onClose={() => setStatusOpen(false)}
          onChanged={(s, r) => { setStatus(s); setReason(r ?? null); onStatusChange?.(s); }}
          openSetup={() => { setStatusOpen(false); setSetupReq(n => n + 1); }} />
      )}
      {portalOpen && isCorporate && (
        <Sheet title="Property portal" sub={`${site?.name || 'This property'} — the portal its property manager signs in to. Corporate only.`} onClose={() => setPortalOpen(false)} width={640}>
          <PropertyPortalSetup siteId={siteId} siteName={site?.name} notify={notify} />
        </Sheet>
      )}
      {flash}
    </div>
  );
}
