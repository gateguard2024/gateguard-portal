'use client';

// Systems (bottom-bar tab) — pick a property, then see and run everything there:
// cameras, doors & gates, people, activity, faults, network, controllers
// (SiteCommand). Light Apple look like the other converted tabs.
import React, { useEffect, useMemo, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { SiteCommand } from '@/components/nexus/SiteCommand';
import { CSS, type Any, getJson, Note, Dot } from '@/components/nexus/systems/shared';
import { isInactive, statusOf } from '@/components/nexus/systems/Decommission';

const RECENT_KEY = 'gg_systems_recent';
const readRecent = (): string[] => { try { const v = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); return Array.isArray(v) ? v.map(String).slice(0, 4) : []; } catch { return []; } };

export function SystemsExplorer() {
  const { user } = useUser();
  const isCorporate = ((user?.publicMetadata as Record<string, unknown> | undefined)?.org_tier) === 'corporate';
  const [sites, setSites] = useState<Any[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [openSite, setOpenSite] = useState<Any | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [showInactive, setShowInactive] = useState(false); // inactive / offline properties are hidden unless asked for

  useEffect(() => {
    setRecent(readRecent());
    void getJson('/api/sites?limit=500').then(r => {
      const d = r.data;
      setSites(Array.isArray(d) ? d : (d.sites ?? d.records ?? []));
      if (!r.ok) setErr(d.error || 'Couldn’t load your properties.');
    });
  }, []);

  const open = (s: Any) => {
    setOpenSite(s);
    const next = [String(s.id), ...readRecent().filter(x => x !== String(s.id))].slice(0, 4);
    setRecent(next);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* private mode */ }
    window.scrollTo({ top: 0 });
  };

  // Deep link: /?tab=systems&site=<id> (Lexi, Events, Catalog, Calendar…) opens that property.
  useEffect(() => {
    if (!sites || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get('site');
    if (!id) return;
    params.delete('site');
    const qs = params.toString();
    try { window.history.replaceState({}, '', qs ? `/?${qs}` : '/'); } catch { /* file:// previews */ }
    open(sites.find(s => String(s.id) === id) ?? { id, name: 'Property' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sites]);

  const inactiveCount = useMemo(() => (sites ?? []).filter(s => isInactive(s.status)).length, [sites]);
  const sorted = useMemo(() => [...(sites ?? [])].filter(s => showInactive || !!q.trim() || !isInactive(s.status)).sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''))), [sites, showInactive, q]); // a search finds inactive ones too
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? sorted.filter(s => `${s.name ?? ''} ${s.address ?? ''} ${s.city ?? ''} ${s.state ?? ''}`.toLowerCase().includes(t)) : sorted;
  }, [sorted, q]);
  const recentSites = useMemo(() => q ? [] : recent.map(id => sorted.find(s => String(s.id) === id)).filter(Boolean) as Any[], [recent, sorted, q]);

  if (openSite) return <SiteCommand siteId={openSite.id} site={openSite} isCorporate={isCorporate} onBack={() => setOpenSite(null)}
    onStatusChange={st => { setOpenSite(o => (o ? { ...o, status: st } : o)); setSites(p => (p ?? []).map(x => String(x.id) === String(openSite.id) ? { ...x, status: st } : x)); }} />;

  const SiteBtn = ({ s }: { s: Any }) => (
    <button type="button" className="sy-site" onClick={() => open(s)}>
      <div className="t">{s.name || 'Unnamed property'}</div>
      <div className="m">{[s.address, s.city, s.state].filter(Boolean).join(', ') || 'No address'}</div>
      {isInactive(s.status) && <div className="m" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}><Dot c={statusOf(s.status).dot} />{statusOf(s.status).label}</div>}
      <div className="go">{s.units ? `${s.units} units · ` : ''}Open systems ›</div>
    </button>
  );

  return (
    <div className="sy">
      <style>{CSS}</style>
      <header className="sy-hd">
        <div>
          <h1>Systems</h1>
          <div className="sub">Pick a property to watch cameras, open doors and gates, and manage everything installed there.</div>
        </div>
      </header>
      <input className="sy-in" style={{ height: 44, fontSize: 15, borderRadius: 12, marginBottom: 16, border: 0, boxShadow: '0 1px 2px rgba(10,20,40,.06), 0 8px 24px rgba(10,20,40,.08)' }} value={q} onChange={e => setQ(e.target.value)} placeholder={sites ? `Search ${sites.length} properties` : 'Search properties'} aria-label="Search properties" />
      {err && <div style={{ marginBottom: 12 }}><Note tone="red">{err}</Note></div>}
      {sites == null ? <div className="sy-empty" style={{ color: 'rgba(255,255,255,.8)' }}>Loading your properties…</div>
        : !sites.length ? <Note>No properties yet — add one in Operations.</Note>
        : <>
          {recentSites.length > 0 && <>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.85)', margin: '0 0 8px' }}>Recently opened</div>
            <div className="sy-sites" style={{ marginBottom: 20 }}>{recentSites.map(s => <SiteBtn key={`r${s.id}`} s={s} />)}</div>
          </>}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, margin: '0 0 8px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.85)' }}>{q ? `${shown.length} match${shown.length === 1 ? '' : 'es'}` : showInactive ? 'All properties' : 'Active properties'}</div>
            {inactiveCount > 0 && <button type="button" className="sy-b dark sm" aria-pressed={showInactive} onClick={() => setShowInactive(v => !v)}>{showInactive ? 'Hide inactive' : `Show inactive (${inactiveCount})`}</button>}
          </div>
          {!shown.length ? <Note>No properties match “{q}”.</Note> : <div className="sy-sites">{shown.map(s => <SiteBtn key={s.id} s={s} />)}</div>}
        </>}
    </div>
  );
}

export default SystemsExplorer;
