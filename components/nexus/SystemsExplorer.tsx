'use client';

// Systems (bottom-bar tab) — pick a location, then see ALL of that property's live
// systems via the per-site widget dashboard (cameras, doors, access activity, network,
// relays, controllers). Pulls real locations from the same source as Operations Hub.
import React, { useEffect, useMemo, useState } from 'react';
import { Search, MapPin, Shield } from 'lucide-react';
import { useUser } from '@clerk/nextjs';
import { SiteSystems } from '@/components/nexus/SiteSystems';
// Vercel lucide cache quirk — load via require()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { ArrowLeft } = require('lucide-react') as any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Site = Record<string, any>;

export function SystemsExplorer() {
  const { user } = useUser();
  const isCorporate = ((user?.publicMetadata as Record<string, unknown> | undefined)?.org_tier) === 'corporate';

  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [openSite, setOpenSite] = useState<Site | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch('/api/sites?limit=300', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setSites(Array.isArray(d) ? d : (d.sites ?? d.records ?? [])))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const shown = useMemo(() => sites.filter(s =>
    !q || `${s.name ?? ''} ${s.address ?? ''} ${s.city ?? ''} ${s.state ?? ''}`.toLowerCase().includes(q.toLowerCase())
  ), [sites, q]);

  // A site is selected → show its full widget dashboard.
  if (openSite) {
    return (
      <div style={{ width: '100%', maxWidth: 1100, margin: '0 auto', padding: '8px 4px 140px' }}>
        <button onClick={() => setOpenSite(null)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 14, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.8)', borderRadius: 999, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <ArrowLeft size={15} /> All locations
        </button>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#7DE5FF' }}>Systems</div>
          <h1 style={{ margin: '4px 0 0', fontSize: 24, color: 'white' }}>{openSite.name || 'Site'}</h1>
          {(openSite.address || openSite.city) && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{[openSite.address, openSite.city, openSite.state].filter(Boolean).join(', ')}</div>}
        </div>
        <SiteSystems siteId={openSite.id} isCorporate={isCorporate} />
      </div>
    );
  }

  const card = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 14, cursor: 'pointer', textAlign: 'left' as const, color: 'white' };

  return (
    <div style={{ width: '100%', maxWidth: 1100, margin: '0 auto', padding: '8px 4px 140px' }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#7DE5FF' }}>Systems</div>
        <h1 style={{ margin: '4px 0 2px', fontSize: 26, color: 'white', display: 'flex', alignItems: 'center', gap: 10 }}><Shield size={22} color="#7DE5FF" /> Site Systems</h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', margin: 0 }}>Pick a location to watch its cameras, unlock doors, and manage every system.</p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '10px 12px', marginBottom: 14 }}>
        <Search size={16} color="rgba(255,255,255,0.4)" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search your locations…" style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'white', fontSize: 14 }} />
      </div>

      {loading ? <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Loading your locations…</div>
        : shown.length === 0 ? <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{sites.length === 0 ? 'No locations yet — add a site in Operations Hub.' : `No locations match “${q}”.`}</div>
        : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 12 }}>
            {shown.map(s => (
              <button key={s.id} onClick={() => setOpenSite(s)} style={card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MapPin size={15} color="#7DE5FF" />
                  <span style={{ fontSize: 14.5, fontWeight: 600 }}>{s.name || 'Unnamed site'}</span>
                </div>
                {(s.address || s.city) && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>{[s.address, s.city, s.state].filter(Boolean).join(', ')}</div>}
                <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>{s.units ? `${s.units} units · ` : ''}Tap to open systems →</div>
              </button>
            ))}
          </div>}
    </div>
  );
}

export default SystemsExplorer;
