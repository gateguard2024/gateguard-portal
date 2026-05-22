"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Cpu, Zap, Users, Radio, Target, Mail,
  Building2, User, MapPin, CheckCircle2,
  ExternalLink, Star, Copy, Send,
  Loader2, Shield, Package, Wifi, AlertCircle,
  ChevronRight, TrendingUp, Globe, Clock, Download, Trash2, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SavedSearch {
  id: string;
  query: string;
  query_interpretation: string | null;
  imported_count: number;
  imported_at: string | null;
  expires_at: string;
  created_at: string;
  results: {
    prospects: Array<{
      property: { name: string; units: number; address: string };
      decision_maker: { name: string; title: string };
      profile: { buy_score: number };
    }>;
  };
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface BulkAgreement {
  provider: string;
  service_type: 'internet' | 'video' | 'bundled';
  agreement_type: 'exclusive' | 'bulk' | 'preferred' | 'unknown';
  expiry_estimate: string;
  confidence: 'high' | 'medium' | 'low';
}

interface PropTech {
  gate_operators?: string[];
  access_control?: string[];
  intercoms?: string[];
  cameras?: string[];
  smart_locks?: string[];
  resident_apps?: string[];
  package_solutions?: string[];
  tech_generation?: 'legacy' | 'modern' | 'hybrid';
  sara_signals?: boolean;
  replacement_window?: string;
  displacement_targets?: string[];
}

interface Property {
  name: string;
  address: string;
  units: number;
  year_built: number;
  management_company: string;
  owner_entity: string;
  property_type: string;
  class: string;
  occupancy: string;
  isp_providers?: string[];
  video_providers?: string[];
  bulk_agreements?: BulkAgreement[];
  proptech?: PropTech;
  _fcc_verified?: boolean;
  _fcc_providers?: string[];
}

interface DecisionMaker {
  name: string;
  title: string;
  company: string;
  linkedin_slug: string;
  email: string;
  email_confidence: number;
  phone: string;
  tenure_years: number;
}

interface PainSignal {
  source: string;
  date: string;
  signal_type: string;
  quote: string;
  severity: "high" | "medium" | "low";
}

interface Profile {
  buy_score: number;
  urgency: string;
  primary_concern: string;
  current_vendor: string;
  contract_window: string;
  communication_style: string;
}

interface EmailVariant {
  angle: string;
  subject: string;
  body: string;
  predicted_reply_rate: number;
  tone: string;
}

interface Prospect {
  property: Property;
  decision_maker: DecisionMaker;
  pain_signals: PainSignal[];
  profile: Profile;
  email_variants: EmailVariant[];
  generic_reply_rate: number;
}

interface ResearchResult {
  mode: string;
  query_interpretation: string;
  prospects: Prospect[];
  fccVerified?: boolean;
}

interface DeepIntelSource {
  title: string;
  url: string;
  excerpt: string;
  score: number;
}

interface DeepIntelResult {
  isp_providers: string[];
  video_providers: string[];
  bulk_agreements: BulkAgreement[];
  proptech?: PropTech;
  key_finding: string;
  confidence: 'high' | 'medium' | 'low';
  atlas_opportunity?: boolean;
  edgar_signal?: boolean;
  permit_signal?: boolean;
  sources: DeepIntelSource[];
  intelligence_sources?: {
    edgar: boolean;
    puc: boolean;
    permits: boolean;
    isp_press: boolean;
    listing_sites: boolean;
  };
  ownership?: {
    owner_entity?: string;
    owner_type?: string;
    portfolio_size?: string;
    acquisition_year?: string;
    capex_signal?: string;
    sec_filing_ref?: string;
    asset_manager?: {
      name?: string;
      title?: string;
      company?: string;
      linkedin_slug?: string;
      email?: string;
      email_confidence?: number;
    };
  };
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PHASES = [
  {
    id: 1, name: "Property Intel", icon: Building2,
    sources: ["FCC Broadband Map", "County Assessor", "CoStar"],
    detail: "Unit count, ownership, ISP/video providers, bulk agreements",
  },
  {
    id: 2, name: "Decision Maker", icon: Users,
    sources: ["LinkedIn", "Hunter.io", "Apollo.io"],
    detail: "Identifying PM name, email, tenure",
  },
  {
    id: 3, name: "Intent Signals", icon: Radio,
    sources: ["Reddit", "ApartmentList", "Google Reviews"],
    detail: "Mining pain points from public posts",
  },
  {
    id: 4, name: "AI Profiling", icon: Cpu,
    sources: ["Signal synthesis", "Buy score model"],
    detail: "Building psychographic profile",
  },
  {
    id: 5, name: "Campaign Gen", icon: Star,
    sources: ["Claude AI", "A/B variants"],
    detail: "Generating 3 personalized email variants",
  },
];

const PHASE_MS = 1500;

const EXAMPLE_QUERIES = [
  "Multifamily communities in Atlanta with gate access complaints",
  "Properties managed by Lincoln Property Co in Dallas",
  "350+ unit apartments in Phoenix — DirecTV MDU opportunity",
  "Lease-up communities in Denver needing access control",
  "Greystar properties near Nashville with resident complaints",
];

const SIGNAL_ICONS: Record<string, React.ElementType> = {
  gate_access: Shield,
  package_theft: Package,
  internet: Wifi,
  intercom: Radio,
  visitor_management: Users,
  mdu_tv: Globe,
};

const SIGNAL_SEVERITY: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  high:   { bg: "bg-red-50",    border: "border-red-200",   text: "text-red-700",   badge: "bg-red-100 text-red-600" },
  medium: { bg: "bg-amber-50",  border: "border-amber-200", text: "text-amber-700", badge: "bg-amber-100 text-amber-600" },
  low:    { bg: "bg-blue-50",   border: "border-blue-200",  text: "text-blue-700",  badge: "bg-blue-100 text-blue-600" },
};

const URGENCY_PILL: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  high:     "bg-orange-100 text-orange-700",
  medium:   "bg-amber-100 text-amber-700",
  low:      "bg-blue-100 text-blue-700",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function ScoreGauge({ score }: { score: number }) {
  const pct = (score / 10) * 100;
  const color = score >= 8 ? "#22C55E" : score >= 6 ? "#F59E0B" : "#6B7EFF";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{ width: `${pct}%`, background: `linear-gradient(90deg, #6B7EFF, ${color})` }}
          />
        </div>
      </div>
      <span className="text-2xl font-bold tabular-nums" style={{ color }}>
        {score}<span className="text-sm text-gray-400 font-normal">/10</span>
      </span>
    </div>
  );
}

function ReplyRateBanner({ variant, generic }: { variant: EmailVariant; generic: number }) {
  const lift = Math.round(((variant.predicted_reply_rate / generic) - 1) * 100);
  return (
    <div
      className="rounded-2xl p-5 flex items-center gap-8"
      style={{ background: "linear-gradient(135deg, #6B7EFF 0%, #3B4FCC 100%)" }}
    >
      <div>
        <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest mb-1">ARIA Predicted Reply Rate</p>
        <p className="text-4xl font-bold text-white tabular-nums">{variant.predicted_reply_rate}%</p>
      </div>
      <div className="text-white/30 text-3xl font-light">vs</div>
      <div>
        <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest mb-1">Generic Cold Outreach</p>
        <p className="text-4xl font-bold text-white/40 tabular-nums">{generic}%</p>
      </div>
      <div className="flex-1" />
      <div className="text-right">
        <div className="flex items-center gap-1.5 justify-end">
          <TrendingUp size={16} className="text-emerald-300" />
          <span className="text-2xl font-bold text-emerald-300">+{lift}%</span>
        </div>
        <p className="text-white/50 text-xs mt-0.5">better conversion</p>
        <p className="text-white/30 text-[10px] mt-1">vs industry avg 1-3%</p>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

function formatAge(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function daysUntil(iso: string) {
  return Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 86400000));
}

export default function ARIAPage() {
  const [query, setQuery]                   = useState("");
  const [phase, setPhase]                   = useState(0); // 0=idle 1-5=animating 6=done
  const [results, setResults]               = useState<ResearchResult | null>(null);
  const [error, setError]                   = useState<string | null>(null);
  const [selectedProspect, setSelectedProspect] = useState(0);
  const [selectedEmail, setSelectedEmail]   = useState(0);
  const [copied, setCopied]                 = useState(false);
  const [savedSearchId, setSavedSearchId]   = useState<string | null>(null);
  const [savedSearches, setSavedSearches]   = useState<SavedSearch[]>([]);
  const [importing, setImporting]           = useState<string | null>(null); // id being imported
  const [importResult, setImportResult]     = useState<Record<string, { created: number; skipped: number }>>({});
  const [showHistory, setShowHistory]       = useState(true);
  const [scoutLoading, setScoutLoading]     = useState<string | null>(null); // search id being scouted
  const [scoutResult, setScoutResult]       = useState<Record<string, { sent: number; skipped: number; errors: number }>>({});
  const [deepLoading, setDeepLoading]       = useState(false);
  const [deepIntel, setDeepIntel]           = useState<DeepIntelResult | null>(null);
  const [deepError, setDeepError]           = useState<string | null>(null);
  const [usageStats, setUsageStats]         = useState<{
    my_searches: { total: number; base: number; deep: number; this_week: number; this_month: number };
    my_org:      { org_name: string | null; total: number; this_month: number; top_users: { user_name: string; count: number }[] };
    hierarchy:   { org_id: string; org_name: string; org_tier: string; own_count: number; child_count: number; total_count: number; depth: number }[];
    corporate_total: number;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load saved searches + usage stats on mount
  useEffect(() => {
    fetch('/api/aria/searches')
      .then(r => r.ok ? r.json() : { searches: [] })
      .then(d => setSavedSearches(d.searches ?? []))
      .catch(() => {});
    fetch('/api/aria/usage')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && !d.error) setUsageStats(d); })
      .catch(() => {});
  }, []);

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  async function runDeepIntel(prospect: Prospect) {
    setDeepLoading(true);
    setDeepError(null);
    setDeepIntel(null);
    try {
      const addrParts = (prospect.property.address ?? '').split(',').map((s: string) => s.trim());
      const r = await fetch('/api/aria/research/deep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_name:      prospect.property.name,
          address:            prospect.property.address,
          management_company: prospect.property.management_company,
          city:               addrParts[1] ?? '',
          state:              addrParts[2]?.split(' ')[1] ?? '',
        }),
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setDeepIntel(d);
    } catch (e: any) {
      setDeepError(e.message || 'Deep intel failed');
    } finally {
      setDeepLoading(false);
    }
  }

  const runARIA = useCallback(async () => {
    if (!query.trim() || phase > 0) return;
    setError(null);
    setResults(null);
    setSavedSearchId(null);
    setDeepIntel(null);
    setDeepError(null);
    setSelectedProspect(0);
    setSelectedEmail(0);
    setPhase(1);

    // Fire API in parallel with animation
    const apiPromise = fetch("/api/aria/research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: query.trim() }),
    }).then(async r => {
      const text = await r.text();
      try {
        return JSON.parse(text);
      } catch {
        throw new Error(`Server error (${r.status}) — ${text.slice(0, 120)}`);
      }
    });

    // Animate each phase
    for (let p = 1; p <= 5; p++) {
      setPhase(p);
      await sleep(PHASE_MS);
    }

    try {
      const data = await apiPromise;
      if (data.error) throw new Error(data.error);
      setResults(data);
      setPhase(6);
      if (data.savedSearchId) {
        setSavedSearchId(data.savedSearchId);
        // Refresh history
        fetch('/api/aria/searches')
          .then(r => r.ok ? r.json() : { searches: [] })
          .then(d => setSavedSearches(d.searches ?? []))
          .catch(() => {});
      }
    } catch (e: any) {
      setError(e.message || "Research failed — check ANTHROPIC_API_KEY and try again");
      setPhase(0);
    }
  }, [query, phase]);

  async function importSearch(id: string) {
    setImporting(id);
    try {
      const r = await fetch(`/api/aria/searches/${id}/import`, { method: 'POST' });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setImportResult(prev => ({ ...prev, [id]: { created: d.created, skipped: d.skipped } }));
      // Update local saved searches list
      setSavedSearches(prev => prev.map(s => s.id === id
        ? { ...s, imported_count: (s.imported_count ?? 0) + d.created, imported_at: new Date().toISOString() }
        : s
      ));
    } catch (e: any) {
      setImportResult(prev => ({ ...prev, [id]: { created: -1, skipped: 0 } }));
    } finally {
      setImporting(null);
    }
  }

  async function launchScout(searchId: string) {
    setScoutLoading(searchId);
    try {
      // Step 1: get imported lead ids from this search (re-import returns lead_ids even for existing)
      const importRes = await fetch(`/api/aria/searches/${searchId}/import`, { method: 'POST' });
      const importData = await importRes.json();
      const leadIds = importData.lead_ids ?? [];
      if (leadIds.length === 0) throw new Error('No leads found for this search');

      // Step 2: launch SCOUT for those leads
      const scoutRes = await fetch('/api/aria/scout/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_ids: leadIds }),
      });
      const scoutData = await scoutRes.json();
      if (scoutData.error) throw new Error(scoutData.error);
      setScoutResult(prev => ({ ...prev, [searchId]: { sent: scoutData.sent, skipped: scoutData.skipped, errors: scoutData.errors } }));
    } catch (e: any) {
      setScoutResult(prev => ({ ...prev, [searchId]: { sent: -1, skipped: 0, errors: 1 } }));
    } finally {
      setScoutLoading(null);
    }
  }

  function restoreSearch(s: SavedSearch) {
    const prospects = s.results?.prospects ?? [];
    if (prospects.length === 0) return;
    setResults(s.results as any);
    setQuery(s.query);
    setPhase(6);
    setSavedSearchId(s.id);
    setSelectedProspect(0);
    setSelectedEmail(0);
    setDeepIntel(null);
    setDeepError(null);
    // Scroll to results
    setTimeout(() => window.scrollTo({ top: 400, behavior: 'smooth' }), 100);
  }

  function copyEmail(subject: string, body: string) {
    navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const isRunning = phase >= 1 && phase <= 5;
  const isDone    = phase === 6;
  const prospect  = results?.prospects[selectedProspect];
  const emailV    = prospect?.email_variants[selectedEmail];

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] p-6">
      <div className="max-w-7xl mx-auto space-y-5">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-lg"
              style={{ background: "linear-gradient(135deg, #6B7EFF 0%, #3B4FCC 100%)" }}
            >
              AR
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900">ARIA</h1>
                <span className="text-xl font-light text-gray-400">—</span>
                <h1 className="text-xl font-bold text-gray-900">Lead Intelligence Engine</h1>
                <span
                  className="text-[10px] font-bold px-2.5 py-0.5 rounded-full"
                  style={{ background: "#EEF0FF", color: "#6B7EFF" }}
                >
                  AI AGENT
                </span>
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: "#6B7EFF" }} />
                  <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "#6B7EFF" }} />
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">
                Researches properties · Discovers decision makers · Mines intent signals · Generates hyper-personalized campaigns
              </p>
            </div>
          </div>

          {/* Stats strip — live usage */}
          <div className="flex gap-6 shrink-0">
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900 tabular-nums">
                {usageStats ? usageStats.my_searches.total : '—'}
              </p>
              <p className="text-[11px] text-gray-400">My Searches</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900 tabular-nums">
                {usageStats ? usageStats.my_org.total : '—'}
              </p>
              <p className="text-[11px] text-gray-400">{usageStats?.my_org.org_name ?? 'My Org'}</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-[#6B7EFF] tabular-nums">
                {usageStats ? usageStats.corporate_total : '—'}
              </p>
              <p className="text-[11px] text-gray-400">Network Total</p>
            </div>
          </div>
        </div>

        {/* ── ARIA Usage Panel ────────────────────────────────────────── */}
        {usageStats && (usageStats.my_searches.total > 0 || usageStats.hierarchy.length > 0) && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <TrendingUp size={13} className="text-[#6B7EFF]" />
                <span className="text-sm font-semibold text-gray-800">ARIA Usage</span>
                <span className="text-[10px] font-bold bg-[#EEF0FF] text-[#6B7EFF] px-2 py-0.5 rounded-full">
                  {usageStats.corporate_total} total searches
                </span>
              </div>
              <span className="text-[11px] text-gray-400">Rolls up through org hierarchy</span>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* My stats */}
              <div className="rounded-xl bg-[#F8FAFC] border border-gray-100 p-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">My Activity</p>
                <div className="space-y-1.5">
                  {[
                    { label: 'Total searches', value: usageStats.my_searches.total },
                    { label: 'Base searches',  value: usageStats.my_searches.base },
                    { label: 'Deep intel',     value: usageStats.my_searches.deep },
                    { label: 'This week',      value: usageStats.my_searches.this_week },
                    { label: 'This month',     value: usageStats.my_searches.this_month },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-[11px] text-gray-500">{label}</span>
                      <span className="text-[12px] font-bold text-gray-800 tabular-nums">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Org stats + top users */}
              <div className="rounded-xl bg-[#F8FAFC] border border-gray-100 p-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                  {usageStats.my_org.org_name ?? 'My Organization'}
                </p>
                <div className="space-y-1.5 mb-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-500">Total searches</span>
                    <span className="text-[12px] font-bold text-gray-800 tabular-nums">{usageStats.my_org.total}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-500">This month</span>
                    <span className="text-[12px] font-bold text-gray-800 tabular-nums">{usageStats.my_org.this_month}</span>
                  </div>
                </div>
                {usageStats.my_org.top_users.length > 0 && (
                  <>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Top Users</p>
                    <div className="space-y-1">
                      {usageStats.my_org.top_users.map((u, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <span className="text-[11px] text-gray-600 truncate max-w-[120px]">{u.user_name}</span>
                          <span className="text-[11px] font-bold text-[#6B7EFF] tabular-nums">{u.count}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Hierarchy rollup */}
              <div className="rounded-xl bg-[#F8FAFC] border border-gray-100 p-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Network Rollup</p>
                {usageStats.hierarchy.length === 0 ? (
                  <p className="text-[11px] text-gray-400">No hierarchy data</p>
                ) : (
                  <div className="space-y-2">
                    {usageStats.hierarchy.map(h => (
                      <div key={h.org_id} style={{ paddingLeft: `${h.depth * 10}px` }}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="w-1 h-1 rounded-full bg-gray-300 shrink-0" />
                            <span className="text-[11px] text-gray-700 truncate max-w-[110px]">{h.org_name}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-[11px] font-bold text-[#6B7EFF] tabular-nums">{h.total_count}</span>
                            {h.child_count > 0 && (
                              <span className="text-[9px] text-gray-400">({h.own_count}+{h.child_count})</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="pt-1.5 mt-1.5 border-t border-gray-200 flex items-center justify-between">
                      <span className="text-[11px] font-bold text-gray-700">Network Total</span>
                      <span className="text-[13px] font-bold text-[#6B7EFF] tabular-nums">{usageStats.corporate_total}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Recent ARIA Searches ────────────────────────────────────── */}
        {savedSearches.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <Clock size={14} className="text-[#6B7EFF]" />
                <span className="text-sm font-semibold text-gray-800">Recent ARIA Searches</span>
                <span className="text-[10px] font-bold bg-[#EEF0FF] text-[#6B7EFF] px-2 py-0.5 rounded-full">
                  {savedSearches.length} saved · 30 days
                </span>
              </div>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {savedSearches.map(s => {
                const res = importResult[s.id];
                const alreadyImported = s.imported_count > 0 || (res?.created ?? 0) > 0;
                const prospects = s.results?.prospects ?? [];
                const expDays = daysUntil(s.expires_at);
                const scoutRes = scoutResult[s.id];
                return (
                  <div key={s.id} className="border border-gray-100 rounded-xl p-4 flex flex-col gap-3 hover:border-[#6B7EFF]/30 hover:shadow-sm transition-all bg-gray-50/40">
                    {/* Query text */}
                    <div>
                      <p className="text-sm font-semibold text-gray-800 line-clamp-2 leading-snug">{s.query}</p>
                      {s.query_interpretation && (
                        <p className="text-[11px] text-gray-400 mt-0.5 truncate">{s.query_interpretation}</p>
                      )}
                    </div>

                    {/* Meta row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] text-gray-400">{formatAge(s.created_at)}</span>
                      <span className="text-[10px] text-gray-300">·</span>
                      <span className="text-[10px] text-gray-500 font-medium">{prospects.length} prospect{prospects.length !== 1 ? 's' : ''}</span>
                      {alreadyImported && (
                        <>
                          <span className="text-[10px] text-gray-300">·</span>
                          <span className="text-[10px] text-emerald-600 font-medium">
                            {s.imported_count > 0 ? s.imported_count : (res?.created ?? 0)} imported
                          </span>
                        </>
                      )}
                      <span className="text-[10px] text-gray-300">·</span>
                      <span className={cn("text-[10px] font-medium", expDays <= 3 ? "text-amber-500" : "text-gray-400")}>
                        {expDays <= 3 ? `⚠ expires in ${expDays}d` : `expires in ${expDays}d`}
                      </span>
                    </div>

                    {/* Property name chips */}
                    {prospects.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {prospects.slice(0, 3).map((p, i) => (
                          <span key={i} className="text-[10px] bg-white border border-gray-200 text-gray-600 px-1.5 py-0.5 rounded">
                            {p.property.name}
                          </span>
                        ))}
                        {prospects.length > 3 && (
                          <span className="text-[10px] text-gray-400 px-1.5 py-0.5">+{prospects.length - 3} more</span>
                        )}
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      {/* Restore button — always shown if there are prospects */}
                      {prospects.length > 0 && (
                        <button
                          onClick={() => restoreSearch(s)}
                          className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg font-semibold border border-gray-200 bg-white text-gray-600 hover:border-[#6B7EFF]/50 hover:text-[#6B7EFF] transition-all"
                        >
                          ▶ View Results
                        </button>
                      )}

                      {/* Import button */}
                      {res ? (
                        <span className={cn(
                          "text-[11px] px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1",
                          res.created >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                        )}>
                          {res.created >= 0 ? <><Check size={10} /> {res.created} imported</> : "Error"}
                        </span>
                      ) : alreadyImported ? (
                        <span className="text-[11px] px-3 py-1.5 rounded-lg font-semibold bg-emerald-50 text-emerald-700 flex items-center gap-1">
                          <Check size={10} /> {s.imported_count} imported
                        </span>
                      ) : (
                        <button
                          onClick={() => importSearch(s.id)}
                          disabled={importing === s.id}
                          className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg text-white font-semibold transition-all shadow-sm disabled:opacity-60"
                          style={{ background: "linear-gradient(135deg, #6B7EFF 0%, #3B4FCC 100%)" }}
                        >
                          {importing === s.id
                            ? <><Loader2 size={10} className="animate-spin" /> Importing…</>
                            : <><Download size={10} /> Import to Leads</>}
                        </button>
                      )}

                      {/* SCOUT launch button — only if leads are imported and SCOUT not yet launched */}
                      {alreadyImported && !scoutRes && (
                        <button
                          onClick={() => launchScout(s.id)}
                          disabled={scoutLoading === s.id}
                          className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg text-white font-semibold transition-all shadow-sm disabled:opacity-60"
                          style={{ background: "linear-gradient(135deg, #10B981 0%, #059669 100%)" }}
                        >
                          {scoutLoading === s.id
                            ? <><Loader2 size={10} className="animate-spin" /> Launching…</>
                            : <><Zap size={10} /> Launch SCOUT</>}
                        </button>
                      )}

                      {/* SCOUT result */}
                      {scoutRes && (
                        <span className={cn(
                          "text-[11px] px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1",
                          scoutRes.sent >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                        )}>
                          {scoutRes.sent >= 0 ? <><Check size={10} /> {scoutRes.sent} sent</> : "SCOUT failed"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Search ──────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex gap-3">
            {/* Input */}
            <div
              className={cn(
                "flex-1 flex items-center gap-3 px-4 rounded-xl border bg-gray-50 transition-all",
                isRunning ? "border-[#6B7EFF]/40" : "border-gray-200 focus-within:border-[#6B7EFF]/60 focus-within:shadow-[0_0_0_3px_rgba(107,126,255,0.1)]"
              )}
            >
              <Cpu size={18} className={cn("shrink-0 transition-colors", isRunning ? "text-[#6B7EFF] animate-pulse" : "text-gray-400")} />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !isRunning && runARIA()}
                placeholder="Describe your target — property name, area, management company, or pain point..."
                className="flex-1 bg-transparent py-3.5 text-sm text-gray-800 placeholder:text-gray-400 outline-none"
                disabled={isRunning}
              />
              {isRunning && (
                <Loader2 size={15} className="text-[#6B7EFF] animate-spin shrink-0" />
              )}
            </div>

            {/* CTA */}
            <button
              onClick={runARIA}
              disabled={isRunning || !query.trim()}
              className="px-6 py-3.5 rounded-xl text-white font-semibold text-sm flex items-center gap-2 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              style={{
                background: isRunning
                  ? "#9CA3AF"
                  : "linear-gradient(135deg, #6B7EFF 0%, #3B4FCC 100%)",
                boxShadow: isRunning ? "none" : "0 4px 14px rgba(107,126,255,0.35)",
              }}
            >
              {isRunning ? (
                <><Loader2 size={15} className="animate-spin" /> Researching...</>
              ) : (
                <><Zap size={15} /> Launch ARIA</>
              )}
            </button>
          </div>

          {/* Example queries */}
          {!isRunning && !isDone && (
            <div className="mt-4">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Try an example</p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLE_QUERIES.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => { setQuery(q); inputRef.current?.focus(); }}
                    className="text-[11px] px-3 py-1.5 rounded-full border border-gray-200 text-gray-500 hover:border-[#6B7EFF]/50 hover:text-[#6B7EFF] hover:bg-[#6B7EFF]/5 transition-all bg-white"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Query interpretation */}
          {isDone && results?.query_interpretation && (
            <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
              <Cpu size={12} className="text-[#6B7EFF]" />
              <span>ARIA interpreted: <span className="font-medium text-gray-700">{results.query_interpretation}</span></span>
            </div>
          )}
        </div>

        {/* ── Pipeline ─────────────────────────────────────────────────── */}
        {(isRunning || isDone) && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-4">
              <span
                className="text-[10px] font-bold tracking-widest uppercase"
                style={{ color: "#6B7EFF" }}
              >
                Intelligence Pipeline
              </span>
              {isDone && (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                  <CheckCircle2 size={9} /> Complete
                </span>
              )}
              {isDone && savedSearchId && (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-brand-400 bg-brand-400/10 border border-brand-400/20 px-2 py-0.5 rounded-full">
                  <Clock size={9} /> Saved 30d
                </span>
              )}
              <div className="flex-1" />
              {isDone && results && (
                <span className="text-[11px] text-gray-500">
                  Found <span className="font-semibold text-gray-800">{results.prospects.length}</span> target{results.prospects.length > 1 ? "s" : ""}
                </span>
              )}
            </div>

            <div className="grid grid-cols-5 gap-3">
              {PHASES.map((p) => {
                const Icon = p.icon;
                const status =
                  phase > p.id ? "done" :
                  phase === p.id ? "running" :
                  "queued";

                return (
                  <div
                    key={p.id}
                    className={cn(
                      "rounded-xl border p-3.5 transition-all duration-500",
                      status === "done"    ? "border-emerald-200 bg-emerald-50/60" :
                      status === "running" ? "border-[#6B7EFF]/30 bg-[#6B7EFF]/5 shadow-sm" :
                                            "border-gray-100 bg-gray-50/80"
                    )}
                  >
                    {/* Phase header */}
                    <div className="flex items-center gap-2 mb-2.5">
                      <div
                        className={cn(
                          "w-6 h-6 rounded-lg flex items-center justify-center transition-all",
                          status === "done"    ? "bg-emerald-500" :
                          status === "running" ? "bg-[#6B7EFF]" :
                                                "bg-gray-300"
                        )}
                      >
                        {status === "done" ? (
                          <CheckCircle2 size={12} className="text-white" />
                        ) : status === "running" ? (
                          <Loader2 size={12} className="text-white animate-spin" />
                        ) : (
                          <Icon size={12} className="text-white" />
                        )}
                      </div>
                      <span
                        className={cn(
                          "text-[11px] font-semibold",
                          status === "done"    ? "text-emerald-700" :
                          status === "running" ? "text-[#6B7EFF]" :
                                                "text-gray-400"
                        )}
                      >
                        {p.name}
                      </span>
                    </div>

                    {/* Sources */}
                    <div className="space-y-1 mb-2.5">
                      {p.sources.map(s => (
                        <div key={s} className="flex items-center gap-1.5">
                          <div
                            className={cn(
                              "w-1 h-1 rounded-full transition-all",
                              status === "done"    ? "bg-emerald-400" :
                              status === "running" ? "bg-[#6B7EFF] animate-pulse" :
                                                    "bg-gray-300"
                            )}
                          />
                          <span className="text-[10px] text-gray-400">{s}</span>
                        </div>
                      ))}
                    </div>

                    {/* Progress bar */}
                    <div className="h-0.5 bg-gray-200 rounded-full overflow-hidden">
                      {status === "done" && (
                        <div className="h-full w-full rounded-full bg-emerald-400" />
                      )}
                      {status === "running" && (
                        <div
                          className="h-full rounded-full"
                          style={{
                            background: "#6B7EFF",
                            animation: "aria-fill 1.5s ease-in-out forwards",
                          }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Error ─────────────────────────────────────────────────────── */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle size={16} className="text-red-500 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-700">Research failed</p>
              <p className="text-xs text-red-600 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* ── Results ───────────────────────────────────────────────────── */}
        {isDone && results && (
          <div className="space-y-4">

            {/* Multi-prospect selector */}
            {results.prospects.length > 1 && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400 mb-3">
                  {results.prospects.length} Targets Identified — Select to Deep-Dive
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {results.prospects.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => { setSelectedProspect(i); setSelectedEmail(0); }}
                      className={cn(
                        "text-left p-4 rounded-xl border transition-all",
                        selectedProspect === i
                          ? "border-[#6B7EFF] bg-[#6B7EFF]/5 shadow-sm"
                          : "border-gray-200 hover:border-[#6B7EFF]/40 hover:bg-gray-50"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 leading-tight truncate">{p.property.name}</p>
                          <p className="text-[11px] text-gray-500 mt-0.5">{p.property.units} units · Class {p.property.class}</p>
                        </div>
                        <span
                          className={cn("shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full", URGENCY_PILL[p.profile.urgency] || "bg-gray-100 text-gray-600")}
                        >
                          {p.profile.buy_score}/10
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 truncate">{p.decision_maker.name} · {p.decision_maker.title}</p>
                      <div className="flex items-center gap-1 mt-2">
                        <div className={cn("w-1.5 h-1.5 rounded-full", p.profile.urgency === "critical" ? "bg-red-400" : p.profile.urgency === "high" ? "bg-orange-400" : "bg-amber-400")} />
                        <span className="text-[10px] text-gray-400 capitalize">{p.profile.urgency} urgency</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Main prospect detail */}
            {prospect && (
              <div className="grid grid-cols-12 gap-4">

                {/* ── Left: Property + DM + Profile ── */}
                <div className="col-span-4 space-y-4">

                  {/* Property Card */}
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Building2 size={13} style={{ color: "#6B7EFF" }} />
                      <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "#6B7EFF" }}>
                        Property
                      </span>
                    </div>
                    <h2 className="text-base font-bold text-gray-900 leading-snug">{prospect.property.name}</h2>
                    <p className="text-[11px] text-gray-500 mt-1 flex items-start gap-1">
                      <MapPin size={10} className="mt-0.5 shrink-0" />
                      {prospect.property.address}
                    </p>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 mt-4">
                      {[
                        { label: "Units",      val: prospect.property.units },
                        { label: "Built",      val: prospect.property.year_built },
                        { label: "Class",      val: `Class ${prospect.property.class}` },
                        { label: "Occupancy",  val: prospect.property.occupancy },
                        { label: "Type",       val: prospect.property.property_type },
                      ].map(({ label, val }) => (
                        <div key={label}>
                          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
                          <p className="text-xs font-semibold text-gray-800 mt-0.5 capitalize">{val}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-100 space-y-1">
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Management</p>
                        <p className="text-xs font-medium text-gray-700 mt-0.5">{prospect.property.management_company}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Owner Entity</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">{prospect.property.owner_entity}</p>
                      </div>
                    </div>

                    {/* Connectivity Intel — FCC baseline + Deep Intel */}
                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                      {/* Section header + Deep Intel button */}
                      <div className="flex items-center gap-1.5">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Connectivity Intel</p>
                        {deepIntel ? (
                          <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-50 border border-violet-200 text-violet-700">
                            <CheckCircle2 size={8} /> Deep Research
                          </span>
                        ) : prospect.property._fcc_verified ? (
                          <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">
                            <CheckCircle2 size={8} /> FCC 477
                          </span>
                        ) : (
                          <span className="text-[9px] text-amber-600 font-medium">⚠ AI-estimated</span>
                        )}
                        <div className="flex-1" />
                        {!deepIntel && (
                          <button
                            onClick={() => runDeepIntel(prospect)}
                            disabled={deepLoading}
                            className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg border transition-all disabled:opacity-50"
                            style={{
                              background: deepLoading ? '#F3F4F6' : '#F5F3FF',
                              borderColor: deepLoading ? '#E5E7EB' : '#DDD6FE',
                              color: deepLoading ? '#9CA3AF' : '#7C3AED',
                            }}
                          >
                            {deepLoading ? (
                              <><Loader2 size={9} className="animate-spin" /> Searching...</>
                            ) : (
                              <><Globe size={9} /> Deep Intel</>
                            )}
                          </button>
                        )}
                      </div>

                      {/* Deep intel key finding banner */}
                      {deepIntel?.key_finding && (
                        <div className={`rounded-lg px-2.5 py-2 border text-[10px] ${
                          deepIntel.atlas_opportunity
                            ? 'bg-amber-50 border-amber-200'
                            : 'bg-violet-50 border-violet-200'
                        }`}>
                          {deepIntel.atlas_opportunity && (
                            <div className="flex items-center gap-1 mb-1">
                              <span className="text-[9px] font-bold uppercase text-amber-700 bg-amber-200 px-1.5 py-0.5 rounded">🎯 ATLAS OPPORTUNITY</span>
                            </div>
                          )}
                          <p className={deepIntel.atlas_opportunity ? 'text-amber-800' : 'text-violet-800'}>
                            {deepIntel.key_finding}
                          </p>
                        </div>
                      )}

                      {/* Deep intel error */}
                      {deepError && (
                        <p className="text-[10px] text-red-500">{deepError}</p>
                      )}

                      {/* ISP providers — deep intel takes priority over FCC */}
                      {(() => {
                        const isps = deepIntel?.isp_providers?.length ? deepIntel.isp_providers : prospect.property.isp_providers;
                        const isDeep = !!deepIntel?.isp_providers?.length;
                        const isFCC = !isDeep && prospect.property._fcc_verified;
                        if (!isps?.length) return null;
                        return (
                          <div>
                            <div className="flex items-center gap-1 mb-1">
                              <p className="text-[9px] text-gray-400">ISP</p>
                              <span className={`text-[8px] font-medium ${isDeep ? 'text-violet-600' : isFCC ? 'text-emerald-600' : 'text-gray-400'}`}>
                                · {isDeep ? 'web-verified' : isFCC ? 'FCC data' : 'AI-estimated'}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {isps.map((p: string) => (
                                <span key={p} className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${
                                  isDeep ? 'bg-violet-50 text-violet-700 border-violet-200' :
                                  isFCC  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                           'bg-blue-50 text-blue-700 border-blue-100'
                                }`}>{p}</span>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Video providers */}
                      {(() => {
                        const vids = deepIntel?.video_providers?.length ? deepIntel.video_providers : prospect.property.video_providers;
                        if (!vids?.length) return null;
                        return (
                          <div>
                            <p className="text-[9px] text-gray-400 mb-1">Video / TV</p>
                            <div className="flex flex-wrap gap-1">
                              {vids.map((p: string) => (
                                <span key={p} className="text-[10px] bg-violet-50 text-violet-700 border border-violet-100 px-1.5 py-0.5 rounded font-medium">{p}</span>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Bulk agreements — deep intel takes priority */}
                      {(() => {
                        const agreements = deepIntel?.bulk_agreements?.length ? deepIntel.bulk_agreements : prospect.property.bulk_agreements;
                        if (!agreements?.length) return null;
                        return (
                          <div className="space-y-1.5">
                            {agreements.map((a: BulkAgreement & { evidence?: string }, i: number) => (
                              <div key={i} className={`rounded-lg px-2.5 py-2 border text-[10px] ${
                                a.agreement_type === 'exclusive' ? 'bg-amber-50 border-amber-200' :
                                a.agreement_type === 'bulk'      ? 'bg-emerald-50 border-emerald-200' :
                                                                   'bg-gray-50 border-gray-200'
                              }`}>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-semibold text-gray-800">{a.provider}</span>
                                  <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                    a.agreement_type === 'exclusive' ? 'bg-amber-200 text-amber-800' :
                                    a.agreement_type === 'bulk'      ? 'bg-emerald-200 text-emerald-800' :
                                                                       'bg-gray-200 text-gray-600'
                                  }`}>{a.agreement_type}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 text-gray-500">
                                  <span className="capitalize">{a.service_type}</span>
                                  {a.expiry_estimate && a.expiry_estimate !== 'unknown' && (
                                    <><span>·</span><span className="text-amber-600 font-medium">Expires ~{a.expiry_estimate}</span></>
                                  )}
                                  <span className="ml-auto text-[9px] opacity-60">{a.confidence} conf.</span>
                                </div>
                                {a.evidence && (
                                  <p className="mt-1 text-[9px] text-gray-400 italic">"{a.evidence}"</p>
                                )}
                              </div>
                            ))}
                          </div>
                        );
                      })()}

                      {/* Intelligence source badges — show which premium sources fired */}
                      {deepIntel?.intelligence_sources && (
                        <div className="pt-1.5 border-t border-gray-100">
                          <p className="text-[9px] text-gray-400 mb-1.5 uppercase font-bold tracking-widest">Intelligence Sources</p>
                          <div className="flex flex-wrap gap-1">
                            {deepIntel.intelligence_sources.edgar && (
                              <span className="flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700">
                                📋 SEC EDGAR
                              </span>
                            )}
                            {deepIntel.intelligence_sources.puc && (
                              <span className="flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-50 border border-purple-200 text-purple-700">
                                🏛 State PUC
                              </span>
                            )}
                            {deepIntel.intelligence_sources.permits && (
                              <span className="flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-50 border border-orange-200 text-orange-700">
                                🔨 City Permits
                              </span>
                            )}
                            {deepIntel.intelligence_sources.isp_press && (
                              <span className="flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-50 border border-cyan-200 text-cyan-700">
                                📡 ISP Press
                              </span>
                            )}
                            {deepIntel.intelligence_sources.listing_sites && (
                              <span className="flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700">
                                🏠 Listing Sites
                              </span>
                            )}
                            <span className="flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-gray-50 border border-gray-200 text-gray-600">
                              🌐 Web Search
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Ownership / Asset Manager card — appears when Deep Intel finds ownership data */}
                      {deepIntel?.ownership?.owner_entity && deepIntel.ownership.owner_entity !== 'Unknown' && (
                        <div className="pt-2 border-t border-gray-100">
                          <div className="flex items-center gap-1 mb-1.5">
                            <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Ownership Intel</p>
                            {deepIntel.edgar_signal && (
                              <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200">SEC VERIFIED</span>
                            )}
                          </div>
                          <div className="rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-2 space-y-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-[11px] font-bold text-slate-800">{deepIntel.ownership.owner_entity}</p>
                                {deepIntel.ownership.owner_type && deepIntel.ownership.owner_type !== 'unknown' && (
                                  <p className="text-[9px] text-slate-500 capitalize mt-0.5">{deepIntel.ownership.owner_type.replace(/_/g, ' ')}</p>
                                )}
                              </div>
                              {deepIntel.ownership.portfolio_size && (
                                <span className="text-[9px] text-slate-500 shrink-0">{deepIntel.ownership.portfolio_size}</span>
                              )}
                            </div>
                            {deepIntel.ownership.capex_signal && (
                              <div className="flex items-start gap-1">
                                <span className="text-amber-500 text-[10px]">⚡</span>
                                <p className="text-[9px] text-amber-700">{deepIntel.ownership.capex_signal}</p>
                              </div>
                            )}
                            {deepIntel.ownership.asset_manager?.name && (
                              <div className="pt-1.5 border-t border-slate-200">
                                <p className="text-[9px] font-bold text-[#6B7EFF] uppercase tracking-widest mb-0.5">📞 Call This Person</p>
                                <p className="text-[11px] font-semibold text-slate-800">{deepIntel.ownership.asset_manager.name}</p>
                                <p className="text-[10px] text-slate-500">{deepIntel.ownership.asset_manager.title} · {deepIntel.ownership.asset_manager.company}</p>
                                {deepIntel.ownership.asset_manager.email && (
                                  <p className="text-[9px] text-[#6B7EFF] mt-0.5 font-mono">{deepIntel.ownership.asset_manager.email}
                                    {deepIntel.ownership.asset_manager.email_confidence && (
                                      <span className="ml-1 text-gray-400">({Math.round((deepIntel.ownership.asset_manager.email_confidence ?? 0) * 100)}% conf)</span>
                                    )}
                                  </p>
                                )}
                                {deepIntel.ownership.sec_filing_ref && (
                                  <p className="text-[8px] text-gray-400 mt-0.5 italic">Source: {deepIntel.ownership.sec_filing_ref}</p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Sources list */}
                      {deepIntel?.sources && deepIntel.sources.length > 0 && (
                        <div className="pt-1.5 border-t border-gray-100">
                          <p className="text-[9px] text-gray-400 mb-1.5">Sources</p>
                          <div className="space-y-1">
                            {deepIntel.sources.slice(0, 5).map((s, i) => {
                              const sourceType = (s as any).type as string | undefined
                              const typeBadge: Record<string, string> = {
                                EDGAR: 'text-blue-600', PUC: 'text-purple-600',
                                CityPermit: 'text-orange-600', 'ISP-Press': 'text-cyan-600',
                                'listing-site': 'text-emerald-600',
                              }
                              return (
                                <a
                                  key={i}
                                  href={s.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-start gap-1.5 group"
                                >
                                  <ExternalLink size={8} className={`${typeBadge[sourceType ?? ''] ?? 'text-gray-300'} group-hover:text-[#6B7EFF] mt-0.5 shrink-0`} />
                                  <span className="text-[9px] text-gray-400 group-hover:text-[#6B7EFF] truncate leading-tight">{s.title}</span>
                                  {sourceType && typeBadge[sourceType] && (
                                    <span className={`text-[8px] font-bold shrink-0 ${typeBadge[sourceType]}`}>{sourceType}</span>
                                  )}
                                </a>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* PropTech Stack Card */}
                  {(() => {
                    const pt: PropTech = { ...(prospect.property.proptech ?? {}), ...(deepIntel?.proptech ?? {}) };
                    const hasAnyData = [pt.gate_operators, pt.access_control, pt.intercoms, pt.cameras, pt.smart_locks, pt.resident_apps, pt.package_solutions].some(a => a?.length);
                    if (!hasAnyData && !pt.tech_generation && !pt.sara_signals) return null;

                    const genColors: Record<string, string> = {
                      legacy: 'bg-red-100 text-red-700',
                      modern: 'bg-emerald-100 text-emerald-700',
                      hybrid: 'bg-amber-100 text-amber-700',
                    };

                    const categories: { label: string; emoji: string; key: keyof PropTech; chipClass: string }[] = [
                      { label: 'Gates',          emoji: '🚧', key: 'gate_operators',    chipClass: 'bg-orange-50 text-orange-700 border-orange-200' },
                      { label: 'Access Control', emoji: '🔑', key: 'access_control',    chipClass: 'bg-blue-50 text-blue-700 border-blue-200' },
                      { label: 'Intercoms',      emoji: '📟', key: 'intercoms',         chipClass: 'bg-violet-50 text-violet-700 border-violet-200' },
                      { label: 'Cameras',        emoji: '📷', key: 'cameras',           chipClass: 'bg-slate-50 text-slate-700 border-slate-200' },
                      { label: 'Smart Locks',    emoji: '🔒', key: 'smart_locks',       chipClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                      { label: 'Resident App',   emoji: '📱', key: 'resident_apps',     chipClass: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
                      { label: 'Packages',       emoji: '📦', key: 'package_solutions', chipClass: 'bg-amber-50 text-amber-700 border-amber-200' },
                    ];

                    return (
                      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                        <div className="flex items-center gap-2 mb-4">
                          <Cpu size={13} style={{ color: '#7C3AED' }} />
                          <span className="text-[10px] font-bold tracking-widest uppercase text-violet-700">PropTech Stack</span>
                          <div className="flex-1" />
                          {pt.sara_signals ? (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">🎯 SARA Signal</span>
                          ) : pt.tech_generation ? (
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize ${genColors[pt.tech_generation] ?? 'bg-gray-100 text-gray-600'}`}>
                              {pt.tech_generation}
                            </span>
                          ) : null}
                        </div>

                        <div className="space-y-2">
                          {categories.map(cat => {
                            const items = pt[cat.key] as string[] | undefined;
                            if (!items?.length) return null;
                            return (
                              <div key={cat.key}>
                                <p className="text-[9px] text-gray-400 mb-1">{cat.emoji} {cat.label}</p>
                                <div className="flex flex-wrap gap-1">
                                  {items.map((item: string) => (
                                    <span key={item} className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${cat.chipClass}`}>{item}</span>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {pt.replacement_window && (
                          <div className="mt-3 rounded-lg px-2.5 py-2 bg-amber-50 border border-amber-200">
                            <p className="text-[10px] text-amber-800">Replacement window: {pt.replacement_window}</p>
                          </div>
                        )}

                        {pt.displacement_targets && pt.displacement_targets.length > 0 && (
                          <div className="mt-3 rounded-lg px-2.5 py-2 border border-red-200 bg-red-50">
                            <p className="text-[9px] font-bold uppercase tracking-widest text-red-600 mb-1.5">GateGuard can replace:</p>
                            <div className="flex flex-wrap gap-1">
                              {pt.displacement_targets.map((t: string) => (
                                <span key={t} className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-red-100 text-red-700 border border-red-200">{t}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Decision Maker Card */}
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <User size={13} style={{ color: "#6B7EFF" }} />
                      <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "#6B7EFF" }}>
                        Decision Maker
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mb-4">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                        style={{ background: "linear-gradient(135deg, #6B7EFF 0%, #3B4FCC 100%)" }}
                      >
                        {prospect.decision_maker.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{prospect.decision_maker.name}</p>
                        <p className="text-[11px] text-gray-500">{prospect.decision_maker.title}</p>
                        <p className="text-[10px] text-gray-400">{prospect.decision_maker.company}</p>
                      </div>
                    </div>

                    <div className="space-y-2.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-400 shrink-0">Email</span>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-mono text-gray-700 text-[10px] truncate">{prospect.decision_maker.email}</span>
                          <span
                            className="shrink-0 text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                            style={{
                              background: prospect.decision_maker.email_confidence >= 80 ? "#D1FAE5" : "#FEF3C7",
                              color: prospect.decision_maker.email_confidence >= 80 ? "#065F46" : "#92400E",
                            }}
                          >
                            {prospect.decision_maker.email_confidence}%
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Phone</span>
                        <span className="font-mono text-gray-700 text-[10px]">{prospect.decision_maker.phone}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Tenure</span>
                        <span className="text-gray-700 font-medium">{prospect.decision_maker.tenure_years}y at property</span>
                      </div>
                    </div>

                    <a
                      href={`https://linkedin.com/in/${prospect.decision_maker.linkedin_slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 flex items-center gap-1.5 text-[11px] font-medium transition-colors"
                      style={{ color: "#6B7EFF" }}
                    >
                      <ExternalLink size={10} /> View LinkedIn Profile
                    </a>
                  </div>

                  {/* AI Profile */}
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Target size={13} style={{ color: "#6B7EFF" }} />
                      <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "#6B7EFF" }}>
                        ARIA Profile
                      </span>
                    </div>

                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Buy Score</p>
                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full capitalize", URGENCY_PILL[prospect.profile.urgency] || "bg-gray-100 text-gray-600")}>
                        {prospect.profile.urgency} urgency
                      </span>
                    </div>
                    <ScoreGauge score={prospect.profile.buy_score} />

                    <div className="mt-4 space-y-2.5 text-xs">
                      {[
                        { label: "Primary Concern",  val: prospect.profile.primary_concern },
                        { label: "Current Vendor",   val: prospect.profile.current_vendor },
                        { label: "Contract Window",  val: prospect.profile.contract_window },
                        { label: "Comm Style",       val: prospect.profile.communication_style.replace(/-/g, " ") },
                      ].map(({ label, val }) => (
                        <div key={label}>
                          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
                          <p className="text-xs text-gray-700 mt-0.5 capitalize">{val}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ── Right: Signals + Reply Rate + Emails ── */}
                <div className="col-span-8 space-y-4">

                  {/* Pain Signals */}
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Radio size={13} style={{ color: "#6B7EFF" }} />
                      <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "#6B7EFF" }}>
                        Intent Signals Found Online
                      </span>
                      <span className="ml-auto text-[10px] text-gray-400">
                        {prospect.pain_signals.length} signals detected
                      </span>
                    </div>
                    <div className="space-y-3">
                      {prospect.pain_signals.map((sig, i) => {
                        const Icon = SIGNAL_ICONS[sig.signal_type] || AlertCircle;
                        const sev = SIGNAL_SEVERITY[sig.severity] ?? SIGNAL_SEVERITY.low;
                        return (
                          <div key={i} className={cn("rounded-xl border p-4", sev.bg, sev.border)}>
                            <div className="flex items-start gap-3">
                              <Icon size={15} className={cn("mt-0.5 shrink-0", sev.text)} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                  <span className={cn("text-[11px] font-bold", sev.text)}>{sig.source}</span>
                                  <span className="text-[10px] text-gray-400">· {sig.date}</span>
                                  <span className={cn("ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded uppercase", sev.badge)}>
                                    {sig.severity}
                                  </span>
                                </div>
                                <p className={cn("text-xs leading-relaxed italic", sev.text)}>
                                  &ldquo;{sig.quote}&rdquo;
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Reply rate banner — updates with selected email variant */}
                  {emailV && (
                    <ReplyRateBanner variant={emailV} generic={prospect.generic_reply_rate} />
                  )}

                  {/* Email Variants */}
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Mail size={13} style={{ color: "#6B7EFF" }} />
                      <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "#6B7EFF" }}>
                        Personalized Campaign Variants
                      </span>
                      <span className="ml-auto text-[10px] text-gray-400">
                        Powered by Claude · A/B ready
                      </span>
                    </div>

                    {/* Variant tab pills */}
                    <div className="flex gap-2 mb-5">
                      {prospect.email_variants.map((v, i) => (
                        <button
                          key={i}
                          onClick={() => setSelectedEmail(i)}
                          className={cn(
                            "flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all border text-center",
                            selectedEmail === i
                              ? "border-[#6B7EFF] bg-[#6B7EFF]/8 text-[#6B7EFF] shadow-sm"
                              : "border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                          )}
                        >
                          <div className="font-bold">{v.angle}</div>
                          <div className={cn("text-[10px] mt-0.5 font-normal", selectedEmail === i ? "text-[#6B7EFF]/70" : "text-gray-400")}>
                            ~{v.predicted_reply_rate}% reply est.
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* Email preview */}
                    {emailV && (
                      <div className="rounded-xl border border-gray-100 bg-gray-50/80">
                        {/* Email header */}
                        <div className="px-5 py-4 border-b border-gray-100">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">Subject</p>
                              <p className="text-sm font-semibold text-gray-900 leading-snug">{emailV.subject}</p>
                            </div>
                            <span className="shrink-0 text-[10px] px-2.5 py-1 rounded-full bg-gray-200 text-gray-600 capitalize font-medium">
                              {emailV.tone}
                            </span>
                          </div>
                        </div>

                        {/* Email body */}
                        <div className="px-5 py-4">
                          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                            {emailV.body}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="px-5 py-3 border-t border-gray-100 flex items-center gap-2">
                          <button
                            onClick={() => copyEmail(emailV.subject, emailV.body)}
                            className="flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors font-medium"
                          >
                            <Copy size={12} />
                            {copied ? "Copied!" : "Copy Email"}
                          </button>
                          <button
                            className="flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-lg text-white font-semibold transition-all shadow-sm"
                            style={{ background: "linear-gradient(135deg, #6B7EFF 0%, #3B4FCC 100%)" }}
                          >
                            <Send size={12} /> Add to Sequence
                          </button>
                          <div className="flex-1" />
                          <span className="text-[10px] text-gray-400">
                            Signal source: {prospect.pain_signals[0]?.source ?? "multiple"}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            )}

            {/* New search CTA + Import */}
            <div className="flex items-center justify-center gap-4 pt-2 pb-4">
              <button
                onClick={() => {
                  setPhase(0);
                  setResults(null);
                  setQuery("");
                  setSavedSearchId(null);
                  setTimeout(() => inputRef.current?.focus(), 100);
                }}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#6B7EFF] transition-colors font-medium"
              >
                <Zap size={14} /> Run another search
              </button>
              {savedSearchId && !importResult[savedSearchId] && (
                <button
                  onClick={() => importSearch(savedSearchId)}
                  disabled={importing === savedSearchId}
                  className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl text-white font-semibold transition-all shadow-sm disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg, #6B7EFF 0%, #3B4FCC 100%)" }}
                >
                  {importing === savedSearchId
                    ? <><Loader2 size={13} className="animate-spin" /> Importing…</>
                    : <><Download size={13} /> Import to Leads</>}
                </button>
              )}
              {savedSearchId && importResult[savedSearchId] && (
                <span className={cn(
                  "flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl font-semibold",
                  importResult[savedSearchId].created >= 0
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                )}>
                  {importResult[savedSearchId].created >= 0
                    ? <><Check size={13} /> {importResult[savedSearchId].created} lead{importResult[savedSearchId].created !== 1 ? 's' : ''} imported
                        {importResult[savedSearchId].skipped > 0 && <span className="opacity-60 ml-1">({importResult[savedSearchId].skipped} skipped)</span>}</>
                    : <>Import failed</>}
                </span>
              )}
              {savedSearchId && (importResult[savedSearchId]?.created ?? 0) > 0 && !scoutResult[savedSearchId] && (
                <button
                  onClick={() => launchScout(savedSearchId)}
                  disabled={scoutLoading === savedSearchId}
                  className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl text-white font-semibold transition-all shadow-sm disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg, #10B981 0%, #059669 100%)" }}
                >
                  {scoutLoading === savedSearchId
                    ? <><Loader2 size={13} className="animate-spin" /> Launching SCOUT…</>
                    : <><Zap size={13} /> Launch SCOUT Campaign</>}
                </button>
              )}
              {savedSearchId && scoutResult[savedSearchId] && (
                <span className={cn(
                  "flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl font-semibold",
                  scoutResult[savedSearchId].sent >= 0
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                )}>
                  {scoutResult[savedSearchId].sent >= 0
                    ? <><Check size={13} /> SCOUT launched · {scoutResult[savedSearchId].sent} emails sent</>
                    : <>SCOUT failed</>}
                </span>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Animation keyframes */}
      <style>{`
        @keyframes aria-fill {
          from { width: 0%; }
          to   { width: 100%; }
        }
      `}</style>
    </div>
  );
}
