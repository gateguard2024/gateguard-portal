'use client';

// Systems (bottom-bar tab) — pick a location, then see ALL of that property's live
// systems via the per-site widget dashboard (cameras, doors, access activity, network,
// relays, controllers). Pulls real locations from the same source as Operations Hub.
// Steel console frame to match Operations / Sales / Admin.
import React, { useEffect, useMemo, useState } from 'react';
import { Search, MapPin, Shield } from 'lucide-react';
import { useUser } from '@clerk/nextjs';
import { SiteCommand } from '@/components/nexus/SiteCommand';
// Vercel lucide cache quirk — load via require()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { ArrowLeft } = require('lucide-react') as any;

// ---- Steel console tokens (identical to Operations / Sales / Admin) ----
const FRAME_STYLE: React.CSSProperties = { background: 'repeating-linear-gradient(90deg,rgba(255,255,255,0.05) 0 1px,transparent 1px 4px), linear-gradient(180deg,#5a6c84,#45556a)', border: '1px solid rgba(10,16,24,0.4)', boxShadow: '0 26px 54px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -2px 2px rgba(0,0,0,0.4)', borderRadius: 32, padding: 22 };
const TILE_BG = 'repeating-linear-gradient(90deg,rgba(255,255,255,0.04) 0 1px,transparent 1px 4px), linear-gradient(180deg,#2b3c52,#1e2a3a)';
const WELL = 'linear-gradient(180deg,#22303f,#1a2532)';
const steelBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, background: '#22303f', border: '1px solid rgba(95,184,224,0.28)', color: '#9FD8EC', borderRadius: 12, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' };

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

  // A site is selected → show its full widget dashboard inside the steel frame.
  if (openSite) {
    return (
      <section style={{ width: '100%', maxWidth: 1160, margin: '0 auto', padding: '24px 12px 140px' }}>
        <div style={FRAME_STYLE}>
          <button onClick={() => setOpenSite(null)} style={{ ...steelBtn, marginBottom: 14 }}>
            <ArrowLeft size={15} /> All locations
          </button>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.24em', textTransform: 'uppercase', color: '#2f4a63' }}>Systems</div>
            <h1 style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 600, color: '#152535' }}>{openSite.name || 'Site'}</h1>
            {(openSite.address || openSite.city) && <div style={{ fontSize: 13, color: '#37485c' }}>{[openSite.address, openSite.city, openSite.state].filter(Boolean).join(', ')}</div>}
          </div>
          <SiteCommand siteId={openSite.id} isCorporate={isCorporate} />
        </div>
      </section>
    );
  }

  const card: React.CSSProperties = { background: TILE_BG, border: '1px solid rgba(140,170,200,0.22)', boxShadow: '0 14px 30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.14)', borderRadius: 16, padding: 14, cursor: 'pointer', textAlign: 'left', color: 'white' };

  return (
    <section style={{ width: '100%', maxWidth: 1160, margin: '0 auto', padding: '24px 12px 140px' }}>
      <div style={FRAME_STYLE}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.24em', textTransform: 'uppercase', color: '#2f4a63' }}>Systems</div>
          <h1 style={{ margin: '4px 0 2px', fontSize: 24, fontWeight: 600, color: '#152535', display: 'flex', alignItems: 'center', gap: 10 }}><Shield size={20} color="#2f7fb8" /> Site Systems</h1>
          <p style={{ fontSize: 13, color: '#37485c', margin: 0 }}>Pick a location to watch its cameras, unlock doors, and manage every system.</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: WELL, border: '1px solid rgba(140,170,200,0.22)', borderRadius: 12, padding: '10px 12px', marginBottom: 16 }}>
          <Search size={16} color="#9FD8EC" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search your locations…" style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#eaf2fb', fontSize: 14 }} />
        </div>

        {loading ? <div style={{ fontSize: 13, color: '#37485c' }}>Loading your locations…</div>
          : shown.length === 0 ? <div style={{ fontSize: 13, color: '#37485c' }}>{sites.length === 0 ? 'No locations yet — add a site in Operations Hub.' : `No locations match “${q}”.`}</div>
          : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 12 }}>
              {shown.map(s => (
                <button key={s.id} onClick={() => setOpenSite(s)} style={card}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MapPin size={15} color="#5FB8E0" />
                    <span style={{ fontSize: 14.5, fontWeight: 600, color: '#eaf2fb' }}>{s.name || 'Unnamed site'}</span>
                  </div>
                  {(s.address || s.city) && <div style={{ fontSize: 12, color: '#c3d3e2', marginTop: 4 }}>{[s.address, s.city, s.state].filter(Boolean).join(', ')}</div>}
                  <div style={{ fontSize: 11.5, color: '#9FD8EC', marginTop: 8 }}>{s.units ? `${s.units} units · ` : ''}Tap to open systems →</div>
                </button>
              ))}
            </div>}
      </div>
    </section>
  );
}

export default SystemsExplorer;
