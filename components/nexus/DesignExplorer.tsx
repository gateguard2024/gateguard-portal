'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, Layers, MapPin, Loader2, X } from 'lucide-react';
// Vercel lucide cache quirk — load these via require()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Building2, PenTool } = require('lucide-react') as any;

// ── Theme (dark glass) ──────────────────────────────────────────────────────
const BG = '#0B1728';
const CARD = '#131B2E';
const PANEL = '#0F1830';
const BORDER = 'rgba(255,255,255,0.1)';
const TEXT = '#F8FAFC';
const MUTED = '#94A3B8';
const BRAND = '#6B7EFF';
const CYAN = '#7DE5FF';

type Stage = 'floor_plan' | 'system_design' | 'as_built';

interface Site {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
}

interface PlanRow {
  id: string;
  name: string;
  site_id: string | null;
  status: string;
  device_count: number;
  updated_at: string;
}

interface SiteGroup {
  site: Site;
  plans: PlanRow[];
}

const STAGE_LABEL: Record<Stage, string> = {
  floor_plan: 'Floor Plan',
  system_design: 'System Design',
  as_built: 'As-Built',
};
const STAGE_COLOR: Record<Stage, string> = {
  floor_plan: BRAND,
  system_design: CYAN,
  as_built: '#34D399',
};
function stageOf(status: string): Stage {
  const s = (status ?? '').toLowerCase();
  if (s.includes('as') && s.includes('built')) return 'as_built';
  if (s.includes('system') || s.includes('design')) return 'system_design';
  return 'floor_plan';
}
function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function DesignExplorer() {
  const router = useRouter();
  const [sites, setSites] = useState<Site[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);
  const [newName, setNewName] = useState('New Design');
  const [pickerQuery, setPickerQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, pRes] = await Promise.all([
        fetch('/api/sites?limit=200', { cache: 'no-store' }),
        fetch('/api/design/plans', { cache: 'no-store' }),
      ]);
      const sJson = sRes.ok ? await sRes.json() : { sites: [] };
      const pJson = pRes.ok ? await pRes.json() : { plans: [] };
      setSites(Array.isArray(sJson.sites) ? sJson.sites : []);
      setPlans(Array.isArray(pJson.plans) ? pJson.plans : []);
    } catch {
      /* leave empty — never fake demo data */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Group plans under their site; only show sites that have plans OR match search.
  const groups: SiteGroup[] = useMemo(() => {
    const byId = new Map<string, Site>(sites.map((s) => [s.id, s]));
    const map = new Map<string, PlanRow[]>();
    for (const p of plans) {
      if (!p.site_id) continue;
      if (!map.has(p.site_id)) map.set(p.site_id, []);
      map.get(p.site_id)!.push(p);
    }
    const out: SiteGroup[] = [];
    for (const [sid, ps] of map.entries()) {
      const site = byId.get(sid);
      if (!site) continue;
      out.push({ site, plans: ps.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1)) });
    }
    out.sort((a, b) => {
      const at = a.plans[0]?.updated_at ?? '';
      const bt = b.plans[0]?.updated_at ?? '';
      return at < bt ? 1 : -1;
    });
    const q = query.trim().toLowerCase();
    if (!q) return out;
    return out.filter(
      (g) =>
        g.site.name.toLowerCase().includes(q) ||
        (g.site.address ?? '').toLowerCase().includes(q)
    );
  }, [sites, plans, query]);

  const pickerSites = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    const list = q
      ? sites.filter(
          (s) =>
            s.name.toLowerCase().includes(q) || (s.address ?? '').toLowerCase().includes(q)
        )
      : sites;
    return list.slice(0, 60);
  }, [sites, pickerQuery]);

  const createDesign = async (site: Site) => {
    setCreating(site.id);
    try {
      const res = await fetch('/api/design/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site_id: site.id, name: newName || 'New Design', status: 'floor_plan' }),
      });
      const json = await res.json();
      if (res.ok && json.plan?.id) {
        router.push(`/design/floor-plans?plan=${json.plan.id}`);
      } else {
        alert(json.error || 'Failed to create design');
        setCreating(null);
      }
    } catch {
      alert('Network error creating design');
      setCreating(null);
    }
  };

  const openPlan = (id: string) => router.push(`/design/floor-plans?plan=${id}`);

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: BG, color: TEXT }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-6 py-5 border-b shrink-0"
        style={{ borderColor: BORDER }}
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `linear-gradient(135deg, ${BRAND}, ${CYAN})` }}
        >
          <PenTool size={18} color="#0B1728" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold tracking-tight" style={{ color: TEXT }}>
            Design Studio
          </h1>
          <p className="text-xs" style={{ color: MUTED }}>
            System diagrams, floor plans &amp; as-builts — per property
          </p>
        </div>
        <div className="relative hidden sm:block">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: MUTED }}
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search properties…"
            className="pl-9 pr-3 py-2 rounded-xl text-sm outline-none w-56"
            style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}`, color: TEXT }}
          />
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold shrink-0"
          style={{ backgroundColor: BRAND, color: '#0B1728' }}
        >
          <Plus size={16} /> New design
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-24" style={{ color: MUTED }}>
            <Loader2 size={22} className="animate-spin mr-2" /> Loading designs…
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}
            >
              <Layers size={24} style={{ color: MUTED }} />
            </div>
            <p className="text-sm font-medium" style={{ color: TEXT }}>
              No designs yet
            </p>
            <p className="text-xs mt-1 mb-5" style={{ color: MUTED }}>
              Start a system diagram or floor plan for one of your properties.
            </p>
            <button
              onClick={() => setShowNew(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ backgroundColor: BRAND, color: '#0B1728' }}
            >
              <Plus size={16} /> New design
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 max-w-7xl mx-auto">
            {groups.map((g) => (
              <div
                key={g.site.id}
                className="rounded-2xl p-4 flex flex-col"
                style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}` }}
                  >
                    <Building2 size={16} style={{ color: CYAN }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold truncate" style={{ color: TEXT }}>
                      {g.site.name}
                    </h3>
                    <div className="flex items-center gap-1 text-xs mt-0.5" style={{ color: MUTED }}>
                      <MapPin size={11} />
                      <span className="truncate">
                        {[g.site.address, g.site.city, g.site.state].filter(Boolean).join(', ') ||
                          'No address'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  {g.plans.map((p) => {
                    const stage = stageOf(p.status);
                    const color = STAGE_COLOR[stage];
                    return (
                      <button
                        key={p.id}
                        onClick={() => openPlan(p.id)}
                        className="w-full text-left rounded-xl px-3 py-2.5 flex items-center gap-3 transition-colors hover:brightness-125"
                        style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}` }}
                      >
                        <Layers size={15} style={{ color }} />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate" style={{ color: TEXT }}>
                            {p.name}
                          </div>
                          <div className="text-[11px]" style={{ color: MUTED }}>
                            {p.device_count} element{p.device_count === 1 ? '' : 's'} ·{' '}
                            {relTime(p.updated_at)}
                          </div>
                        </div>
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide shrink-0"
                          style={{ backgroundColor: `${color}22`, color }}
                        >
                          {STAGE_LABEL[stage]}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => {
                    setNewName('New Design');
                    createDesign(g.site);
                  }}
                  disabled={creating === g.site.id}
                  className="mt-3 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium transition-colors hover:brightness-125 disabled:opacity-50"
                  style={{ backgroundColor: 'transparent', border: `1px dashed ${BORDER}`, color: MUTED }}
                >
                  {creating === g.site.id ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Plus size={13} />
                  )}
                  Add drawing
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New design — site picker modal */}
      {showNew && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          onClick={() => !creating && setShowNew(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl flex flex-col max-h-[80vh]"
            style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between px-5 py-4 border-b"
              style={{ borderColor: BORDER }}
            >
              <h2 className="text-sm font-semibold" style={{ color: TEXT }}>
                New design — choose a property
              </h2>
              <button onClick={() => !creating && setShowNew(false)} style={{ color: MUTED }}>
                <X size={18} />
              </button>
            </div>
            <div className="px-5 pt-4">
              <label className="text-[11px] font-medium" style={{ color: MUTED }}>
                Drawing name
              </label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full mt-1 mb-3 px-3 py-2 rounded-lg text-sm outline-none"
                style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}`, color: TEXT }}
              />
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: MUTED }}
                />
                <input
                  value={pickerQuery}
                  onChange={(e) => setPickerQuery(e.target.value)}
                  placeholder="Search properties…"
                  className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none"
                  style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}`, color: TEXT }}
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3 flex flex-col gap-1.5">
              {pickerSites.length === 0 ? (
                <p className="text-xs text-center py-8" style={{ color: MUTED }}>
                  No properties found.
                </p>
              ) : (
                pickerSites.map((s) => (
                  <button
                    key={s.id}
                    disabled={!!creating}
                    onClick={() => createDesign(s)}
                    className="w-full text-left rounded-lg px-3 py-2.5 flex items-center gap-3 transition-colors hover:brightness-125 disabled:opacity-50"
                    style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}` }}
                  >
                    <Building2 size={15} style={{ color: CYAN }} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate" style={{ color: TEXT }}>
                        {s.name}
                      </div>
                      <div className="text-[11px] truncate" style={{ color: MUTED }}>
                        {[s.address, s.city, s.state].filter(Boolean).join(', ') || 'No address'}
                      </div>
                    </div>
                    {creating === s.id && (
                      <Loader2 size={14} className="animate-spin" style={{ color: BRAND }} />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
