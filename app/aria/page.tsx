"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Cpu, Zap, Users, Radio, Target,
  Building2, User, MapPin, CheckCircle2,
  ExternalLink, Star, Copy, Send,
  Loader2, Shield, Package, Wifi, AlertCircle,
  ChevronRight, TrendingUp, Globe, Clock, Download, Trash2, Check, Search, RefreshCw,
} from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { LayoutList, ArrowLeft } = require("lucide-react") as any;
import { cn } from "@/lib/utils";
import { TopBar } from "@/components/layout/TopBar";

// ── Types ─────────────────────────────────────────────────────────────────────

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

interface BulkAgreement {
  provider: string;
  service_type: 'internet' | 'video' | 'bundled';
  agreement_type: 'exclusive' | 'bulk' | 'preferred' | 'unknown';
  expiry_estimate: string;
  confidence: 'confirmed' | 'high' | 'medium' | 'low';
  source_url?: string;
  source_snippet?: string;
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
  top_email_format: string;
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

interface ScoutBrief {
  primary_contact: string;
  outreach_angle: 'contract_window' | 'proptech_pain' | 'acquisition' | 'tech_displacement' | 'sara_bridge' | 'upgrade_path' | 'lease_up' | 'general';
  contract_window_urgency: 'critical' | 'high' | 'medium' | 'low' | 'none';
  key_data_points: string[];
}

interface DecisionMakerChainItem {
  name: string;
  title: string;
  company: string;
  role_type: 'owner' | 'asset_manager' | 'regional_manager' | 'property_manager' | 'unknown';
  linkedin_slug?: string;
  email: string;
  top_email_format: string;
  phone?: string;
  notes?: string;
  dm_hooks?: string[];
}

interface Ownership {
  owner_entity: string;
  owner_type: string;
  portfolio_size?: string;
  acquisition_year?: string;
  hold_period?: string;
  capex_signal?: string;
  dnb_duns?: string;
}

interface Prospect {
  property: Property;
  decision_maker: DecisionMaker;
  decision_maker_chain?: DecisionMakerChainItem[];
  ownership?: Ownership;
  pain_signals: PainSignal[];
  profile: Profile;
  scout_brief: ScoutBrief;
}

interface ResearchResult {
  mode: string;
  query_interpretation: string;
  prospects: Prospect[];
  fccVerified?: boolean;
  webIntelligence?: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PHASES = [
  { id: 1, name: "Property Intel",  icon: Building2, sources: ["Property Records", "Market Filings", "Public Database"] },
  { id: 2, name: "Decision Maker",  icon: Users,     sources: ["Professional Network", "Contact Intelligence", "Org Mapping"] },
  { id: 3, name: "Intent Signals",  icon: Radio,     sources: ["Resident Intelligence", "Market Signals", "Contract Indicators"] },
  { id: 4, name: "AI Profiling",    icon: Cpu,       sources: ["Signal Synthesis", "Buy Score Model"] },
  { id: 5, name: "Intel Synthesis", icon: Star,      sources: ["28 OSINT Sources", "Contract DB", "SEC EDGAR"] },
];

const PHASE_DURATIONS = [0, 3500, 4500, 5000, 4000];

const SYNTHESIS_STEPS = [
  "Querying OSINT sources...",
  "Searching SEC EDGAR filings...",
  "Cross-referencing Wayback CDX...",
  "Mining county recorder indexes...",
  "Checking UCC-1 filings...",
  "Scanning contract PDF database...",
  "Correlating prior findings...",
  "Synthesizing intelligence...",
  "Building SCOUT handoff packet...",
];

const EXAMPLE_QUERIES = [
  "Multifamily communities in Atlanta with gate access complaints",
  "Properties managed by Lincoln Property Co in Dallas",
  "350+ unit apartments in Phoenix — DirecTV MDU opportunity",
  "Lease-up communities in Denver needing access control",
  "Greystar properties near Nashville with resident complaints",
];

const SOURCE_DISPLAY: Record<string, string> = {
  'listing-site': 'Property Listing', 'LISTING-SITE': 'Property Listing',
  'social': 'Resident Review', 'REDDIT/REVIEW': 'Resident Review',
  'county-deed': 'Public Record', 'COUNTY-DEED': 'Public Record',
  'isp-partnership': 'Market Intelligence', 'ISP-PARTNERSHIP': 'Market Intelligence',
  'commercial-re': 'Financial Filing', 'OFFERING-MEMO': 'Financial Filing',
  'hoa-rfp': 'Property Document', 'HOA-MINUTES/RFP': 'Property Document',
  'linkedin-mdu': 'Industry Signal', 'LINKEDIN-MDU-REP': 'Industry Signal',
  'locator-site': 'Property Review', 'LOCATOR-REVIEW': 'Property Review',
  'forced-service': 'Resident Complaint', 'FORCED-SERVICE': 'Resident Complaint',
  'web': 'ARIA Verified', 'WEB': 'ARIA Verified',
  'dm-hierarchy': 'DM Hierarchy', 'DM-HIERARCHY': 'DM Hierarchy',
};
function displaySource(raw: string | undefined): string {
  if (!raw) return 'ARIA Verified';
  return SOURCE_DISPLAY[raw] ?? 'ARIA Verified';
}

const SIGNAL_ICONS: Record<string, React.ElementType> = {
  gate_access: Shield, package_theft: Package, internet: Wifi,
  intercom: Radio, visitor_management: Users, mdu_tv: Globe,
};

const SIGNAL_SEVERITY: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  high:   { bg: "bg-red-50",   border: "border-red-200",   text: "text-red-700",   badge: "bg-red-100 text-red-600" },
  medium: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", badge: "bg-amber-100 text-amber-600" },
  low:    { bg: "bg-blue-50",  border: "border-blue-200",  text: "text-blue-700",  badge: "bg-blue-100 text-blue-600" },
};

const URGENCY_PILL: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  high:     "bg-orange-100 text-orange-700",
  medium:   "bg-amber-100 text-amber-700",
  low:      "bg-blue-100 text-blue-700",
};

type DetailTab = 'property' | 'dm' | 'intel' | 'scout';

// ── Helpers ───────────────────────────────────────────────────────────────────

function ScoreGauge({ score }: { score: number }) {
  const pct = (score / 10) * 100;
  const color = score >= 8 ? "#22C55E" : score >= 6 ? "#F59E0B" : "#6B7EFF";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-1000"
            style={{ width: `${pct}%`, background: `linear-gradient(90deg, #6B7EFF, ${color})` }} />
        </div>
      </div>
      <span className="text-xl font-bold tabular-nums" style={{ color }}>
        {score}<span className="text-xs text-gray-400 font-normal">/10</span>
      </span>
    </div>
  );
}

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

// ── Score color helper ────────────────────────────────────────────────────────

function scoreBg(score: number) {
  if (score >= 8) return { background: '#22c55e' };
  if (score >= 6) return { background: '#f59e0b' };
  return { background: '#6B7EFF' };
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ARIAPage() {
  const [query, setQuery]                   = useState("");
  const [phase, setPhase]                   = useState(0);
  const [synthStep, setSynthStep]           = useState(0);
  const [results, setResults]               = useState<ResearchResult | null>(null);
  const [error, setError]                   = useState<string | null>(null);
  const [selectedProspect, setSelectedProspect] = useState(0);
  const [activeTab, setActiveTab]           = useState<DetailTab>('property');
  const [mobileTab, setMobileTab]           = useState<'list' | 'property' | 'dm' | 'scout'>('list');
  const [copied, setCopied]                 = useState(false);
  const [savedSearchId, setSavedSearchId]   = useState<string | null>(null);
  const [savedSearches, setSavedSearches]   = useState<SavedSearch[]>([]);
  const [importing, setImporting]           = useState<string | null>(null);
  const [importResult, setImportResult]     = useState<Record<string, { created: number; skipped: number }>>({});
  const [scoutLoading, setScoutLoading]     = useState<string | null>(null);
  const [scoutResult, setScoutResult]       = useState<Record<string, { sent: number; skipped: number; errors: number }>>({});
  const [deleting, setDeleting]             = useState<string | null>(null);
  const [usageStats, setUsageStats]         = useState<{
    my_searches: { total: number; base: number; deep: number; this_week: number; this_month: number };
    my_org:      { org_name: string | null; total: number; this_month: number; top_users: { user_name: string; count: number }[] };
    hierarchy:   { org_id: string; org_name: string; org_tier: string; own_count: number; child_count: number; total_count: number; depth: number }[];
    corporate_total: number;
  } | null>(null);
  const [dbTotal, setDbTotal]               = useState<number>(0);
  const [dbView, setDbView]                 = useState(false);
  const [dbProps, setDbProps]               = useState<any[]>([]);
  const [dbLoading, setDbLoading]           = useState(false);
  const [dbSearch, setDbSearch]             = useState('');
  const [dbFilter, setDbFilter]             = useState<'all'|'critical'|'expiring'|'sara'>('all');
  const [dbSelected, setDbSelected]         = useState<any | null>(null);
  const [savingNote, setSavingNote]         = useState(false);
  const [noteText, setNoteText]             = useState('');
  const [noteStage, setNoteStage]           = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Load saved searches, usage stats, and DB total on mount
  useEffect(() => {
    fetch('/api/aria/searches')
      .then(r => r.ok ? r.json() : { searches: [] })
      .then(d => setSavedSearches(d.searches ?? []))
      .catch(() => {});
    fetch('/api/aria/usage')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && !d.error) setUsageStats(d); })
      .catch(() => {});
    fetch('/api/aria/properties?limit=1')
      .then(r => r.ok ? r.json() : { total: 0 })
      .then(d => setDbTotal(d.total ?? 0))
      .catch(() => {});
  }, []);

  const loadDbProperties = useCallback(async (search = '', filter: typeof dbFilter = 'all') => {
    setDbLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100', order_by: 'last_researched_at' });
      if (search) params.set('search', search);
      if (filter === 'critical') params.set('urgency', 'critical');
      if (filter === 'sara')     params.set('sara', 'true');
      if (filter === 'expiring') { params.set('expiry_before', String(new Date().getFullYear() + 2)); params.set('expiry_after', String(new Date().getFullYear())); }
      const r = await fetch(`/api/aria/properties?${params}`);
      const d = await r.json();
      setDbProps(d.properties ?? []);
      setDbTotal(d.total ?? 0);
    } catch { /* fail silently */ } finally {
      setDbLoading(false);
    }
  }, []);

  async function savePropertyNote() {
    if (!dbSelected) return;
    setSavingNote(true);
    try {
      const body: Record<string, string> = {};
      if (noteText)  body.sales_notes  = noteText;
      if (noteStage) body.sales_stage  = noteStage;
      const r = await fetch(`/api/aria/properties/${dbSelected.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!d.error) {
        setDbSelected(d);
        setDbProps(prev => prev.map(p => p.id === d.id ? d : p));
        setNoteText('');
        setNoteStage('');
      }
    } catch { /* fail silently */ } finally {
      setSavingNote(false);
    }
  }

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  const runARIA = useCallback(async () => {
    if (!query.trim() || phase > 0) return;
    setError(null);
    setResults(null);
    setSavedSearchId(null);
    setSelectedProspect(0);
    setActiveTab('property');
    setPhase(1);

    const apiPromise = fetch('/api/aria/research/deep', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: query.trim() }),
    }).then(async r => {
      const text = await r.text();
      try { return JSON.parse(text); }
      catch { throw new Error(`Server error (${r.status}) — ${text.slice(0, 120)}`); }
    });

    for (let p = 1; p <= 4; p++) {
      setPhase(p);
      await sleep(PHASE_DURATIONS[p]);
    }

    setPhase(5);
    setSynthStep(0);
    const synthInterval = setInterval(() => {
      setSynthStep(s => (s + 1) % SYNTHESIS_STEPS.length);
    }, 2800);

    try {
      const data = await apiPromise;
      clearInterval(synthInterval);
      if (data.error) throw new Error(data.error);
      setResults(data);
      setPhase(6);
      if (data.savedSearchId) {
        setSavedSearchId(data.savedSearchId);
        fetch('/api/aria/searches')
          .then(r => r.ok ? r.json() : { searches: [] })
          .then(d => setSavedSearches(d.searches ?? []))
          .catch(() => {});
      }
    } catch (e: any) {
      clearInterval(synthInterval);
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
      setSavedSearches(prev => prev.map(s => s.id === id
        ? { ...s, imported_count: (s.imported_count ?? 0) + d.created, imported_at: new Date().toISOString() }
        : s
      ));
    } catch {
      setImportResult(prev => ({ ...prev, [id]: { created: -1, skipped: 0 } }));
    } finally {
      setImporting(null);
    }
  }

  async function launchScout(searchId: string) {
    setScoutLoading(searchId);
    try {
      const importRes = await fetch(`/api/aria/searches/${searchId}/import`, { method: 'POST' });
      const importData = await importRes.json();
      const leadIds = importData.lead_ids ?? [];
      if (leadIds.length === 0) throw new Error('No leads found for this search');
      const scoutRes = await fetch('/api/aria/scout/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_ids: leadIds }),
      });
      const scoutData = await scoutRes.json();
      if (scoutData.error) throw new Error(scoutData.error);
      setScoutResult(prev => ({ ...prev, [searchId]: { sent: scoutData.sent, skipped: scoutData.skipped, errors: scoutData.errors } }));
    } catch {
      setScoutResult(prev => ({ ...prev, [searchId]: { sent: -1, skipped: 0, errors: 1 } }));
    } finally {
      setScoutLoading(null);
    }
  }

  async function deleteSearch(id: string) {
    setDeleting(id);
    try {
      await fetch(`/api/aria/searches/${id}`, { method: 'DELETE' });
      setSavedSearches(prev => prev.filter(s => s.id !== id));
    } catch { /* fail silently */ } finally {
      setDeleting(null);
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
    setActiveTab('property');
  }

  function copyEmail(subject: string, body: string) {
    navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const isRunning = phase >= 1 && phase <= 5;
  const isDone    = phase === 6;
  const prospect  = results?.prospects[selectedProspect];

  // ── TopBar actions ─────────────────────────────────────────────────────────
  const topbarActions = (
    <div className="flex items-center gap-2">
      {/* Intelligence DB toggle */}
      <button
        onClick={() => {
          if (!dbView) { setDbView(true); loadDbProperties(); }
          else setDbView(false);
        }}
        className={cn(
          "hidden lg:flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium border transition-all",
          dbView
            ? "bg-[#6B7EFF] text-white border-[#6B7EFF]"
            : "bg-white text-gray-600 border-gray-200 hover:border-[#6B7EFF]/50"
        )}
      >
        <Globe size={11} />
        Intel DB
        {dbTotal > 0 && (
          <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full",
            dbView ? "bg-white/20 text-white" : "bg-[#6B7EFF]/10 text-[#6B7EFF]")}>
            {dbTotal}
          </span>
        )}
      </button>
      {usageStats && !dbView && (
        <div className="hidden lg:flex items-center gap-3 mr-2 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <TrendingUp size={11} className="text-[#6B7EFF]" />
            <span className="font-bold text-gray-700">{usageStats.my_searches.total}</span> mine
          </span>
          {usageStats.corporate_total > 0 && (
            <span className="flex items-center gap-1">
              <span className="font-bold text-gray-700">{usageStats.corporate_total}</span> network
            </span>
          )}
        </div>
      )}
      {isDone && savedSearchId && (
        <>
          {!importResult[savedSearchId] && (
            <button
              onClick={() => importSearch(savedSearchId)}
              disabled={importing === savedSearchId}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-white font-medium disabled:opacity-60"
              style={{ background: "#6B7EFF" }}
            >
              {importing === savedSearchId
                ? <Loader2 size={11} className="animate-spin" />
                : <><Download size={11} /> Import leads</>}
            </button>
          )}
          {importResult[savedSearchId] && (importResult[savedSearchId].created ?? 0) >= 0 && !scoutResult[savedSearchId] && (
            <button
              onClick={() => launchScout(savedSearchId)}
              disabled={scoutLoading === savedSearchId}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-white font-medium disabled:opacity-60"
              style={{ background: "#10B981" }}
            >
              {scoutLoading === savedSearchId
                ? <Loader2 size={11} className="animate-spin" />
                : <><Zap size={11} /> SCOUT</>}
            </button>
          )}
        </>
      )}
    </div>
  );

  // ── Left panel: prospect list item ────────────────────────────────────────
  function ProspectListItem({ p, i }: { p: any; i: number }) {
    const score = p.profile?.buy_score ?? 0;
    return (
      <button
        onClick={() => { setSelectedProspect(i); setActiveTab('property'); }}
        className={cn(
          "w-full text-left p-3 rounded-xl border transition-all mb-2",
          selectedProspect === i && isDone
            ? "border-[#6B7EFF]/60 bg-[#6B7EFF]/5"
            : "border-gray-200 bg-white hover:border-[#6B7EFF]/30 hover:bg-gray-50"
        )}
      >
        <div className="flex items-start gap-2 mb-1.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shrink-0 mt-0.5"
            style={scoreBg(score)}>
            {score}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-900 leading-tight truncate">{p.property?.name}</p>
            <p className="text-[10px] text-gray-400 mt-0.5 truncate">{p.property?.address?.split(',').slice(0,2).join(',')}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1 mt-1">
          {p.property?.units && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{p.property.units} units</span>
          )}
          {p.property?.class && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">Class {p.property.class}</span>
          )}
          {p.property?.proptech?.sara_signals && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-semibold">SARA</span>
          )}
          {p.profile?.urgency === 'critical' && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-semibold">Critical</span>
          )}
          {p.profile?.urgency === 'high' && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-600 font-semibold">High</span>
          )}
        </div>
      </button>
    );
  }

  // ── Saved search row ──────────────────────────────────────────────────────
  function SavedSearchRow({ s }: { s: SavedSearch }) {
    const res = importResult[s.id];
    const alreadyImported = s.imported_count > 0 || (res?.created ?? 0) > 0;
    const prospects = s.results?.prospects ?? [];
    const expDays = daysUntil(s.expires_at);
    return (
      <div className="flex items-start gap-2 p-2.5 rounded-lg hover:bg-gray-50 group transition-colors">
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => restoreSearch(s)}>
          <p className="text-[11px] font-medium text-gray-800 leading-tight truncate">{s.query}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="text-[10px] text-gray-400">{formatAge(s.created_at)}</span>
            <span className="text-[10px] text-gray-300">·</span>
            <span className="text-[10px] text-gray-500">{prospects.length} targets</span>
            {alreadyImported && <span className="text-[9px] font-semibold text-emerald-600">✓ imported</span>}
            {expDays <= 3 && <span className="text-[9px] text-amber-500">⚠ {expDays}d</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
          <button
            onClick={() => { setQuery(s.query); setTimeout(() => runARIA(), 50); }}
            title="Re-run with fresh data"
            disabled={isRunning}
            className="text-gray-300 hover:text-[#6B7EFF] p-1 rounded transition-colors disabled:opacity-30"
          >
            <RefreshCw size={10} />
          </button>
          <button
            onClick={() => deleteSearch(s.id)}
            disabled={deleting === s.id}
            className="text-gray-300 hover:text-red-400 p-1 rounded transition-colors disabled:opacity-40"
          >
            {deleting === s.id ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
          </button>
        </div>
      </div>
    );
  }

  // ── Property tab ──────────────────────────────────────────────────────────
  function PropertyTab({ p }: { p: Prospect }) {
    const pt = p.property.proptech ?? {};
    const hasStack = [pt.gate_operators, pt.access_control, pt.intercoms, pt.cameras,
      pt.smart_locks, pt.resident_apps, pt.package_solutions].some(a => a?.length);

    const categories = [
      { label: 'Gates',          emoji: '🚧', key: 'gate_operators' as keyof PropTech,    chipClass: 'bg-orange-50 text-orange-700 border-orange-200' },
      { label: 'Access Control', emoji: '🔑', key: 'access_control' as keyof PropTech,    chipClass: 'bg-blue-50 text-blue-700 border-blue-200' },
      { label: 'Intercoms',      emoji: '📟', key: 'intercoms' as keyof PropTech,         chipClass: 'bg-violet-50 text-violet-700 border-violet-200' },
      { label: 'Cameras',        emoji: '📷', key: 'cameras' as keyof PropTech,           chipClass: 'bg-slate-50 text-slate-700 border-slate-200' },
      { label: 'Smart Locks',    emoji: '🔒', key: 'smart_locks' as keyof PropTech,       chipClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
      { label: 'Resident App',   emoji: '📱', key: 'resident_apps' as keyof PropTech,     chipClass: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
      { label: 'Packages',       emoji: '📦', key: 'package_solutions' as keyof PropTech, chipClass: 'bg-amber-50 text-amber-700 border-amber-200' },
    ];

    return (
      <div className="grid grid-cols-2 gap-4">
        {/* Property details */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Property details</p>
          <div className="space-y-2">
            {[
              { label: "Units",      val: p.property.units },
              { label: "Type",       val: p.property.property_type },
              { label: "Class",      val: `Class ${p.property.class}` },
              { label: "Year built", val: p.property.year_built },
              { label: "Occupancy",  val: p.property.occupancy },
            ].map(({ label, val }) => (
              <div key={label} className="flex items-center justify-between text-xs">
                <span className="text-gray-400">{label}</span>
                <span className="font-medium text-gray-800 capitalize">{val}</span>
              </div>
            ))}
            <div className="pt-2 border-t border-gray-100 space-y-1">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Management</p>
                <p className="text-xs font-medium text-gray-700 mt-0.5">{p.property.management_company}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Owner entity</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{p.property.owner_entity}</p>
              </div>
              {p.ownership?.dnb_duns && p.ownership.dnb_duns !== 'unknown' && (
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">D&B DUNS</p>
                  <p className="font-mono text-[10px] text-gray-600 mt-0.5 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                    {p.ownership.dnb_duns}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Financial + connectivity */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Financial &amp; connectivity</p>
          {p.ownership && (
            <div className="space-y-2 mb-3">
              {[
                { label: "Owner type",     val: p.ownership.owner_type },
                { label: "Portfolio",      val: p.ownership.portfolio_size },
                { label: "Acquired",       val: p.ownership.acquisition_year },
                { label: "Hold period",    val: p.ownership.hold_period },
                { label: "CapEx signal",   val: p.ownership.capex_signal },
              ].filter(x => x.val).map(({ label, val }) => (
                <div key={label} className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">{label}</span>
                  <span className="font-medium text-gray-800 capitalize text-right max-w-[120px] truncate">{val}</span>
                </div>
              ))}
            </div>
          )}

          {/* Connectivity */}
          <div className="border-t border-gray-100 pt-3">
            <div className="flex items-center gap-1.5 mb-2">
              <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Connectivity</p>
              {p.property._fcc_verified
                ? <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">FCC 477</span>
                : <span className="text-[9px] text-amber-600 font-medium">AI-est.</span>}
            </div>
            {p.property.isp_providers?.length ? (
              <div className="mb-2">
                <p className="text-[9px] text-gray-400 mb-1">ISP</p>
                <div className="flex flex-wrap gap-1">
                  {p.property.isp_providers.map((isp: string) => (
                    <span key={isp} className={cn("text-[9px] px-1.5 py-0.5 rounded font-medium border",
                      p.property._fcc_verified
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-blue-50 text-blue-700 border-blue-100"
                    )}>{isp}</span>
                  ))}
                </div>
              </div>
            ) : null}
            {p.property.video_providers?.length ? (
              <div className="mb-2">
                <p className="text-[9px] text-gray-400 mb-1">Video/TV</p>
                <div className="flex flex-wrap gap-1">
                  {p.property.video_providers.map((vid: string) => (
                    <span key={vid} className="text-[9px] bg-violet-50 text-violet-700 border border-violet-100 px-1.5 py-0.5 rounded font-medium">{vid}</span>
                  ))}
                </div>
              </div>
            ) : null}
            {p.property.bulk_agreements?.length ? (
              <div className="space-y-1.5">
                {p.property.bulk_agreements.map((a: BulkAgreement & { evidence?: string }, i: number) => (
                  <div key={i} className={cn("rounded-lg px-2 py-1.5 border text-[9px]",
                    a.agreement_type === 'exclusive' ? 'bg-amber-50 border-amber-200' :
                    a.agreement_type === 'bulk'      ? 'bg-emerald-50 border-emerald-200' :
                                                       'bg-gray-50 border-gray-200'
                  )}>
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-gray-800">{a.provider}</span>
                      <span className={cn("text-[8px] font-bold uppercase px-1 py-0.5 rounded",
                        a.agreement_type === 'exclusive' ? 'bg-amber-200 text-amber-800' :
                        a.agreement_type === 'bulk'      ? 'bg-emerald-200 text-emerald-800' :
                                                           'bg-gray-200 text-gray-600'
                      )}>{a.agreement_type}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-gray-500">
                      <span className="capitalize">{a.service_type}</span>
                      {a.expiry_estimate && a.expiry_estimate !== 'unknown' && (
                        <><span>·</span><span className="text-amber-600 font-semibold">📅 {a.expiry_estimate}</span></>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {/* PropTech stack — full width */}
        {(hasStack || pt.tech_generation || pt.sara_signals) && (
          <div className="col-span-2 bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-violet-700">PropTech stack</p>
              <div className="flex-1" />
              {pt.sara_signals
                ? <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">🎯 SARA Signal</span>
                : pt.tech_generation
                  ? <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize",
                      pt.tech_generation === 'legacy' ? 'bg-red-100 text-red-700' :
                      pt.tech_generation === 'modern' ? 'bg-emerald-100 text-emerald-700' :
                                                        'bg-amber-100 text-amber-700'
                    )}>{pt.tech_generation}</span>
                  : null}
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {categories.map(cat => {
                const items = pt[cat.key] as string[] | undefined;
                if (!items?.length) return null;
                return (
                  <div key={cat.key}>
                    <p className="text-[9px] text-gray-400 mb-1">{cat.emoji} {cat.label}</p>
                    <div className="flex flex-wrap gap-1">
                      {items.map((item: string) => (
                        <span key={item} className={cn("text-[9px] px-1.5 py-0.5 rounded font-medium border", cat.chipClass)}>{item}</span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            {pt.replacement_window && (
              <div className="mt-3 rounded-lg px-2.5 py-2 bg-amber-50 border border-amber-200">
                <p className="text-[9px] text-amber-800">Replacement window: {pt.replacement_window}</p>
              </div>
            )}
            {pt.displacement_targets?.length ? (
              <div className="mt-2 rounded-lg px-2.5 py-2 border border-red-200 bg-red-50">
                <p className="text-[9px] font-bold uppercase tracking-widest text-red-600 mb-1.5">GateGuard can replace:</p>
                <div className="flex flex-wrap gap-1">
                  {pt.displacement_targets.map((t: string) => (
                    <span key={t} className="text-[9px] px-1.5 py-0.5 rounded font-medium bg-red-100 text-red-700 border border-red-200">{t}</span>
                  ))}
                </div>
              </div>
            ) : null}
            {pt.sara_signals && (
              <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-50 border border-purple-200">
                <Shield size={13} className="text-purple-600 shrink-0" />
                <p className="text-[10px] text-purple-800">SARA Bridge eligible — DoorKing + DirecTV MDU detected. Migration opportunity flagged.</p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── DM tab ────────────────────────────────────────────────────────────────
  function DMTab({ p }: { p: Prospect }) {
    const roleMeta: Record<string, { label: string; bg: string; text: string; border: string }> = {
      owner:            { label: 'Owner / PE',     bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
      asset_manager:    { label: 'Asset Manager',  bg: 'bg-[#6B7EFF]/5', text: 'text-[#6B7EFF]', border: 'border-[#6B7EFF]/25' },
      regional_manager: { label: 'Regional VP',    bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
      property_manager: { label: 'Property Mgr',  bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' },
      unknown:          { label: 'Contact',        bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' },
    };

    return (
      <div className="space-y-4">
        {/* Primary DM */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Primary contact</p>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
              style={{ background: "linear-gradient(135deg, #6B7EFF 0%, #3B4FCC 100%)" }}>
              {p.decision_maker.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">{p.decision_maker.name}</p>
              <p className="text-[11px] text-gray-500">{p.decision_maker.title}</p>
              <p className="text-[10px] text-gray-400">{p.decision_maker.company}</p>
            </div>
          </div>
          <div className="space-y-2 text-xs border-t border-gray-100 pt-3">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">Best email format</p>
              <p className="font-mono text-gray-700 text-[10px] break-all leading-relaxed">
                {p.decision_maker.top_email_format || p.decision_maker.email}
              </p>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Phone</span>
              <span className="font-mono text-gray-700 text-[10px]">{p.decision_maker.phone}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Tenure</span>
              <span className="text-gray-700 font-medium">{p.decision_maker.tenure_years}y</span>
            </div>
          </div>
          {p.decision_maker.linkedin_slug && (
            <a href={`https://linkedin.com/in/${p.decision_maker.linkedin_slug}`} target="_blank" rel="noopener noreferrer"
              className="mt-3 flex items-center gap-1.5 text-[11px] font-medium" style={{ color: "#6B7EFF" }}>
              <ExternalLink size={10} /> View LinkedIn
            </a>
          )}
        </div>

        {/* DM Chain */}
        {p.decision_maker_chain && p.decision_maker_chain.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Decision maker hierarchy</p>
              <span className="ml-auto text-[10px] text-gray-400">{p.decision_maker_chain.length} contacts</span>
            </div>
            <div className="space-y-2.5">
              {p.decision_maker_chain.map((dm, idx) => {
                const meta = roleMeta[dm.role_type] ?? roleMeta.unknown;
                return (
                  <div key={idx} className={cn("rounded-xl border p-3", meta.bg, meta.border)}>
                    <div className="flex items-start gap-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-[10px] shrink-0"
                        style={{ background: dm.role_type === 'owner' ? 'linear-gradient(135deg, #7C3AED, #5B21B6)' : dm.role_type === 'asset_manager' ? 'linear-gradient(135deg, #6B7EFF, #3B4FCC)' : 'linear-gradient(135deg, #10B981, #059669)' }}>
                        {dm.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-xs font-bold text-gray-900 truncate">{dm.name}</p>
                          <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full border", meta.bg, meta.text, meta.border)}>{meta.label}</span>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-0.5 truncate">{dm.title}</p>
                        <p className="text-[9px] text-gray-400 truncate">{dm.company}</p>
                      </div>
                    </div>
                    {(dm.top_email_format || dm.email) && (
                      <div className="mt-2 pt-2 border-t border-gray-200/60">
                        <p className="font-mono text-[9px] text-gray-500 break-all">{dm.top_email_format || dm.email}</p>
                      </div>
                    )}
                    {dm.dm_hooks && dm.dm_hooks.length > 0 && dm.dm_hooks[0] !== 'no recent social activity found' && (
                      <div className="mt-2 space-y-1">
                        {dm.dm_hooks.slice(0, 2).map((hook, hi) => (
                          <p key={hi} className="text-[9px] text-gray-500 italic leading-relaxed">
                            <span className={cn("font-bold not-italic mr-1", meta.text)}>→</span>{hook}
                          </p>
                        ))}
                      </div>
                    )}
                    {dm.linkedin_slug && (
                      <a href={`https://linkedin.com/in/${dm.linkedin_slug}`} target="_blank" rel="noopener noreferrer"
                        className={cn("mt-1.5 flex items-center gap-1 text-[9px] font-medium", meta.text)}>
                        <ExternalLink size={8} /> LinkedIn
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Intel tab ─────────────────────────────────────────────────────────────
  function IntelTab({ p }: { p: Prospect }) {
    return (
      <div className="space-y-4">
        {/* Buy score + profile */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">ARIA profile</p>
            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full capitalize",
              URGENCY_PILL[p.profile.urgency] || "bg-gray-100 text-gray-600")}>
              {p.profile.urgency} urgency
            </span>
          </div>
          <ScoreGauge score={p.profile.buy_score} />
          <div className="mt-4 grid grid-cols-2 gap-3">
            {[
              { label: "Primary concern",  val: p.profile.primary_concern },
              { label: "Current vendor",   val: p.profile.current_vendor },
              { label: "Contract window",  val: p.profile.contract_window },
              { label: "Comm style",       val: p.profile.communication_style?.replace(/-/g, " ") },
            ].map(({ label, val }) => val ? (
              <div key={label}>
                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
                <p className="text-xs text-gray-700 mt-0.5 capitalize">{val}</p>
              </div>
            ) : null)}
          </div>
        </div>

        {/* Pain signals */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Intent signals</p>
            <span className="ml-auto text-[10px] text-gray-400">{p.pain_signals.length} found</span>
          </div>
          <div className="space-y-2.5">
            {p.pain_signals.map((sig, i) => {
              const Icon = SIGNAL_ICONS[sig.signal_type] || AlertCircle;
              const sev = SIGNAL_SEVERITY[sig.severity] ?? SIGNAL_SEVERITY.low;
              return (
                <div key={i} className={cn("rounded-xl border p-3", sev.bg, sev.border)}>
                  <div className="flex items-start gap-2">
                    <Icon size={13} className={cn("mt-0.5 shrink-0", sev.text)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={cn("text-[10px] font-bold", sev.text)}>{displaySource(sig.source)}</span>
                        <span className="text-[9px] text-gray-400">· {sig.date}</span>
                        <span className={cn("ml-auto text-[8px] font-bold px-1.5 py-0.5 rounded uppercase", sev.badge)}>{sig.severity}</span>
                      </div>
                      <p className={cn("text-[11px] leading-relaxed italic", sev.text)}>&ldquo;{sig.quote}&rdquo;</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── SCOUT tab ─────────────────────────────────────────────────────────────
  function ScoutTab({ p }: { p: Prospect }) {
    if (!p.scout_brief) return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
        <Send size={24} className="opacity-30" />
        <p className="text-sm">No SCOUT brief available</p>
      </div>
    );

    return (
      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Send size={13} className="text-emerald-600" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">SCOUT handoff packet</p>
            <span className="ml-auto text-[10px] text-gray-400">Ready for campaign</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap mb-4">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#6B7EFF]/8 border border-[#6B7EFF]/20">
              <Target size={11} className="text-[#6B7EFF]" />
              <span className="text-[11px] font-semibold text-[#6B7EFF] capitalize">
                {p.scout_brief.outreach_angle.replace(/_/g, ' ')}
              </span>
            </div>
            <span className={cn("text-[10px] font-bold px-2 py-1 rounded-full capitalize",
              URGENCY_PILL[p.scout_brief.contract_window_urgency] || "bg-gray-100 text-gray-600")}>
              {p.scout_brief.contract_window_urgency} window
            </span>
            <span className="text-[10px] text-gray-400 ml-auto">
              Primary: {p.scout_brief.primary_contact}
            </span>
          </div>

          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-2.5">Key intel points</p>
            <div className="space-y-2">
              {p.scout_brief.key_data_points.map((point, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="w-4 h-4 rounded-full bg-[#6B7EFF]/10 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[9px] font-bold text-[#6B7EFF]">{i + 1}</span>
                  </div>
                  <p className="text-[11px] text-gray-700 leading-relaxed">{point}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-3">
            <button
              onClick={() => {
                const text = `SCOUT Brief\n\nPrimary Contact: ${p.scout_brief.primary_contact}\nAngle: ${p.scout_brief.outreach_angle.replace(/_/g, ' ')}\nContract Window: ${p.scout_brief.contract_window_urgency}\n\nKey Intel:\n${p.scout_brief.key_data_points.map((pt, i) => `${i+1}. ${pt}`).join('\n')}`;
                navigator.clipboard.writeText(text);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors font-medium"
            >
              <Copy size={12} />
              {copied ? "Copied!" : "Copy brief"}
            </button>
            {savedSearchId && !importResult[savedSearchId] && (
              <button
                onClick={() => importSearch(savedSearchId)}
                disabled={importing === savedSearchId}
                className="flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-lg text-white font-medium disabled:opacity-60"
                style={{ background: "#6B7EFF" }}
              >
                {importing === savedSearchId ? <Loader2 size={11} className="animate-spin" /> : <><Download size={11} /> Import & queue</>}
              </button>
            )}
            {savedSearchId && (importResult[savedSearchId]?.created ?? 0) >= 0 && !scoutResult[savedSearchId] && (
              <button
                onClick={() => launchScout(savedSearchId)}
                disabled={scoutLoading === savedSearchId}
                className="flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-lg text-white font-medium disabled:opacity-60"
                style={{ background: "#10B981" }}
              >
                {scoutLoading === savedSearchId ? <Loader2 size={11} className="animate-spin" /> : <><Zap size={11} /> Launch SCOUT</>}
              </button>
            )}
            {savedSearchId && scoutResult[savedSearchId] && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                <Check size={11} /> SCOUT launched · {scoutResult[savedSearchId].sent} sent
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Detail header ─────────────────────────────────────────────────────────
  function DetailHeader({ p }: { p: Prospect }) {
    const score = p.profile?.buy_score ?? 0;
    return (
      <div className="border-b border-gray-200 bg-white px-5 pt-4 pb-0">
        <div className="flex items-start gap-3 mb-3">
          <div>
            <h2 className="text-sm font-bold text-gray-900 leading-snug">{p.property.name}</h2>
            <p className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1">
              <MapPin size={9} className="shrink-0" />
              {p.property.address}
            </p>
          </div>
          <div className="flex items-center gap-2 ml-auto shrink-0">
            <span className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[11px] font-bold"
              style={scoreBg(score)}>{score}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {p.property.class && <span className="text-[9px] px-2 py-0.5 rounded-full border border-gray-200 text-gray-500">Class {p.property.class}</span>}
          {p.property.units && <span className="text-[9px] px-2 py-0.5 rounded-full border border-gray-200 text-gray-500">{p.property.units} units</span>}
          {p.property.year_built && <span className="text-[9px] px-2 py-0.5 rounded-full border border-gray-200 text-gray-500">Built {p.property.year_built}</span>}
          {p.property.proptech?.sara_signals && (
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-100 border border-purple-200 text-purple-700 font-semibold">SARA Bridge eligible</span>
          )}
          {p.profile.urgency && (
            <span className={cn("text-[9px] px-2 py-0.5 rounded-full font-semibold capitalize",
              URGENCY_PILL[p.profile.urgency] || "bg-gray-100 text-gray-600")}>
              {p.profile.urgency} urgency
            </span>
          )}
        </div>
        {/* Tab bar */}
        <div className="flex gap-0 -mb-px">
          {([
            { key: 'property', label: 'Property' },
            { key: 'dm',       label: 'Decision maker' },
            { key: 'intel',    label: 'Intel', badge: p.pain_signals?.length > 0 ? p.pain_signals.length : null },
            { key: 'scout',    label: 'SCOUT', greenBadge: true },
          ] as { key: DetailTab; label: string; badge?: number | null; greenBadge?: boolean }[]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "px-4 py-2 text-xs font-medium border-b-2 transition-colors relative",
                activeTab === tab.key
                  ? "border-[#6B7EFF] text-[#6B7EFF]"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              )}
            >
              {tab.label}
              {tab.badge != null && (
                <span className="ml-1.5 text-[9px] font-bold bg-red-500 text-white rounded-full px-1.5 py-0.5">{tab.badge}</span>
              )}
              {tab.greenBadge && (
                <span className="ml-1.5 text-[9px] font-bold bg-emerald-500 text-white rounded-full px-1.5 py-0.5">✓</span>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Pipeline panel ────────────────────────────────────────────────────────
  function PipelinePanel() {
    return (
      <div className="flex flex-col items-center justify-center h-full px-8 py-12">
        <div className="w-full max-w-sm space-y-3">
          <div className="flex items-center gap-2 mb-5">
            <Loader2 size={14} className="text-[#6B7EFF] animate-spin" />
            <span className="text-xs font-semibold text-gray-600">Running ARIA Intelligence Pipeline...</span>
          </div>
          {PHASES.map((p) => {
            const Icon = p.icon;
            const status = phase > p.id ? "done" : phase === p.id ? "running" : "queued";
            return (
              <div key={p.id} className={cn(
                "rounded-xl border p-3 transition-all duration-500",
                status === "done"    ? "border-emerald-200 bg-emerald-50/60" :
                status === "running" ? "border-[#6B7EFF]/30 bg-[#6B7EFF]/5" :
                                       "border-gray-100 bg-gray-50/80"
              )}>
                <div className="flex items-center gap-2.5">
                  <div className={cn("w-5 h-5 rounded-lg flex items-center justify-center",
                    status === "done" ? "bg-emerald-500" : status === "running" ? "bg-[#6B7EFF]" : "bg-gray-300")}>
                    {status === "done"    ? <CheckCircle2 size={10} className="text-white" /> :
                     status === "running" ? <Loader2 size={10} className="text-white animate-spin" /> :
                                           <Icon size={10} className="text-white" />}
                  </div>
                  <span className={cn("text-xs font-semibold flex-1",
                    status === "done" ? "text-emerald-700" : status === "running" ? "text-[#6B7EFF]" : "text-gray-400")}>
                    {p.name}
                  </span>
                  {status === "running" && p.id === 5 && (
                    <span className="text-[10px] text-[#6B7EFF] font-medium">{SYNTHESIS_STEPS[synthStep]}</span>
                  )}
                  {status === "done" && <CheckCircle2 size={12} className="text-emerald-500" />}
                </div>
                <div className="mt-2 h-0.5 bg-gray-200 rounded-full overflow-hidden">
                  {status === "done" && <div className="h-full w-full bg-emerald-400 rounded-full" />}
                  {status === "running" && p.id < 5 && (
                    <div className="h-full bg-[#6B7EFF] rounded-full"
                      style={{ animation: `aria-fill ${PHASE_DURATIONS[p.id]}ms ease-in-out forwards` }} />
                  )}
                  {status === "running" && p.id === 5 && (
                    <div className="h-full rounded-full w-full"
                      style={{ background: "linear-gradient(90deg, #6B7EFF 0%, #9BA8FF 50%, #6B7EFF 100%)",
                               backgroundSize: "200% 100%", animation: "aria-shimmer 1.6s ease-in-out infinite" }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Intelligence DB panel ─────────────────────────────────────────────────
  function IntelDBPanel() {
    const STAGES: Record<string, { label: string; color: string }> = {
      prospect:    { label: 'Prospect',     color: 'bg-gray-100 text-gray-600' },
      contacted:   { label: 'Contacted',    color: 'bg-blue-100 text-blue-700' },
      proposal:    { label: 'Proposal',     color: 'bg-violet-100 text-violet-700' },
      negotiation: { label: 'Negotiating',  color: 'bg-amber-100 text-amber-700' },
      won:         { label: 'Won',          color: 'bg-emerald-100 text-emerald-700' },
      lost:        { label: 'Lost',         color: 'bg-red-100 text-red-600' },
      'no-contact':{ label: 'No contact',   color: 'bg-gray-100 text-gray-400' },
    };

    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header + filters */}
        <div className="bg-white border-b border-gray-200 px-5 py-3">
          <div className="flex items-center gap-3 mb-3">
            <Globe size={14} className="text-[#6B7EFF]" />
            <h2 className="text-sm font-bold text-gray-900">Intelligence Database</h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#6B7EFF]/10 text-[#6B7EFF] font-bold">{dbTotal} properties</span>
            <span className="ml-auto text-[10px] text-gray-400">Grows automatically — never deleted</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5">
              <Search size={12} className="text-gray-400 shrink-0" />
              <input
                value={dbSearch}
                onChange={e => { setDbSearch(e.target.value); loadDbProperties(e.target.value, dbFilter); }}
                placeholder="Search properties, management companies..."
                className="flex-1 text-xs bg-transparent text-gray-800 placeholder:text-gray-400 outline-none"
              />
            </div>
            {(['all','critical','expiring','sara'] as const).map(f => (
              <button key={f} onClick={() => { setDbFilter(f); loadDbProperties(dbSearch, f); }}
                className={cn("text-[11px] px-2.5 py-1.5 rounded-lg border font-medium capitalize transition-all",
                  dbFilter === f ? "bg-[#6B7EFF] text-white border-[#6B7EFF]" : "bg-white text-gray-500 border-gray-200 hover:border-[#6B7EFF]/40"
                )}>
                {f === 'expiring' ? '📅 Expiring' : f === 'sara' ? '🎯 SARA' : f === 'critical' ? '🔴 Critical' : 'All'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Property list */}
          <div className="w-72 border-r border-gray-200 bg-white overflow-y-auto shrink-0">
            {dbLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={20} className="text-[#6B7EFF] animate-spin" />
              </div>
            ) : dbProps.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2 px-4 text-center">
                <Globe size={24} className="opacity-30" />
                <p className="text-sm font-medium">No properties yet</p>
                <p className="text-xs">Run ARIA searches — every discovered property is saved here automatically.</p>
              </div>
            ) : (
              <div className="p-2">
                {dbProps.map(p => {
                  const stageInfo = STAGES[p.sales_stage] ?? STAGES.prospect;
                  return (
                    <button key={p.id}
                      onClick={() => { setDbSelected(p); setNoteText(p.sales_notes ?? ''); setNoteStage(p.sales_stage ?? 'prospect'); }}
                      className={cn(
                        "w-full text-left p-3 rounded-xl border mb-1.5 transition-all",
                        dbSelected?.id === p.id ? "border-[#6B7EFF]/50 bg-[#6B7EFF]/5" : "border-gray-200 hover:border-[#6B7EFF]/30"
                      )}>
                      <div className="flex items-start gap-2">
                        <div className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                          style={scoreBg(p.buy_score ?? 0)}>{p.buy_score ?? '?'}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-semibold text-gray-900 truncate leading-tight">{p.property_name}</p>
                          <p className="text-[9px] text-gray-400 truncate mt-0.5">{(p.address ?? '').split(',').slice(0,2).join(',')}</p>
                          <div className="flex items-center gap-1 mt-1 flex-wrap">
                            <span className={cn("text-[8px] font-medium px-1.5 py-0.5 rounded-full", stageInfo.color)}>{stageInfo.label}</span>
                            {p.sara_signals && <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-purple-100 text-purple-700">SARA</span>}
                            {p.contract_expiry_year && <span className="text-[8px] text-amber-600 font-medium">📅 {p.contract_expiry_year}</span>}
                            {p.times_researched > 1 && <span className="text-[8px] text-gray-400">{p.times_researched}× researched</span>}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Property detail */}
          <div className="flex-1 overflow-y-auto p-5">
            {!dbSelected ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                <p className="text-sm">Select a property to view intel + update sales notes</p>
              </div>
            ) : (
              <div className="space-y-4 max-w-2xl">
                {/* Header */}
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-start gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">{dbSelected.property_name}</h3>
                      <p className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1">
                        <MapPin size={9} /> {dbSelected.address}
                      </p>
                    </div>
                    <div className="ml-auto flex flex-col items-end gap-1">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                        style={scoreBg(dbSelected.buy_score ?? 0)}>{dbSelected.buy_score ?? '?'}</div>
                      <span className="text-[9px] text-gray-400">{formatAge(dbSelected.last_researched_at)}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {dbSelected.management_company && <span className="text-[9px] px-2 py-0.5 rounded-full border border-gray-200 text-gray-600">{dbSelected.management_company}</span>}
                    {dbSelected.owner_entity && <span className="text-[9px] px-2 py-0.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700">{dbSelected.owner_entity}</span>}
                    {dbSelected.sara_signals && <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200 font-semibold">🎯 SARA Bridge</span>}
                    {dbSelected.contract_expiry_year && (
                      <span className={cn("text-[9px] px-2 py-0.5 rounded-full border font-semibold",
                        dbSelected.contract_expiry_year <= new Date().getFullYear() + 1
                          ? "bg-red-50 border-red-200 text-red-700"
                          : "bg-amber-50 border-amber-200 text-amber-700"
                      )}>📅 Contract exp. ~{dbSelected.contract_expiry_year}</span>
                    )}
                    {dbSelected.times_researched > 1 && <span className="text-[9px] px-2 py-0.5 rounded-full border border-gray-200 text-gray-500">{dbSelected.times_researched}× researched</span>}
                  </div>
                </div>

                {/* Connectivity */}
                {((dbSelected.isp_providers?.length ?? 0) > 0 || (dbSelected.video_providers?.length ?? 0) > 0) && (
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Connectivity intel</p>
                    {dbSelected.isp_providers?.length > 0 && (
                      <div className="mb-2">
                        <p className="text-[9px] text-gray-400 mb-1">ISP</p>
                        <div className="flex flex-wrap gap-1">
                          {dbSelected.isp_providers.map((isp: string) => <span key={isp} className="text-[10px] px-2 py-0.5 rounded font-medium bg-blue-50 text-blue-700 border border-blue-100">{isp}</span>)}
                        </div>
                      </div>
                    )}
                    {dbSelected.video_providers?.length > 0 && (
                      <div>
                        <p className="text-[9px] text-gray-400 mb-1">Video</p>
                        <div className="flex flex-wrap gap-1">
                          {dbSelected.video_providers.map((v: string) => <span key={v} className="text-[10px] px-2 py-0.5 rounded font-medium bg-violet-50 text-violet-700 border border-violet-100">{v}</span>)}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* PropTech */}
                {(dbSelected.gate_operators?.length > 0 || dbSelected.access_control?.length > 0 || dbSelected.intercoms?.length > 0 || dbSelected.cameras?.length > 0) && (
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-violet-700 mb-3">PropTech stack</p>
                    <div className="flex flex-wrap gap-x-6 gap-y-2">
                      {[
                        { label: '🚧 Gates',  arr: dbSelected.gate_operators,  cls: 'bg-orange-50 text-orange-700 border-orange-200' },
                        { label: '🔑 Access', arr: dbSelected.access_control,   cls: 'bg-blue-50 text-blue-700 border-blue-200' },
                        { label: '📟 Intercom', arr: dbSelected.intercoms,      cls: 'bg-violet-50 text-violet-700 border-violet-200' },
                        { label: '📷 Cameras', arr: dbSelected.cameras,         cls: 'bg-slate-50 text-slate-700 border-slate-200' },
                      ].filter(x => x.arr?.length > 0).map(cat => (
                        <div key={cat.label}>
                          <p className="text-[9px] text-gray-400 mb-1">{cat.label}</p>
                          <div className="flex flex-wrap gap-1">
                            {cat.arr.map((v: string) => <span key={v} className={cn("text-[9px] px-1.5 py-0.5 rounded font-medium border", cat.cls)}>{v}</span>)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sales cycle updater */}
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Sales notes</p>
                  <div className="flex items-center gap-2 mb-3">
                    <p className="text-xs text-gray-500 shrink-0">Stage:</p>
                    <select
                      value={noteStage || dbSelected.sales_stage || 'prospect'}
                      onChange={e => setNoteStage(e.target.value)}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 outline-none focus:border-[#6B7EFF]"
                    >
                      {Object.entries(STAGES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                    {dbSelected.last_contacted_at && (
                      <span className="text-[10px] text-gray-400 ml-auto">Last contact: {formatAge(dbSelected.last_contacted_at)}</span>
                    )}
                  </div>
                  <textarea
                    value={noteText !== '' ? noteText : (dbSelected.sales_notes ?? '')}
                    onChange={e => setNoteText(e.target.value)}
                    placeholder="Add sales notes, meeting outcomes, key intel from prospect calls..."
                    rows={4}
                    className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2.5 text-gray-700 placeholder:text-gray-400 resize-none outline-none focus:border-[#6B7EFF] mb-2"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={savePropertyNote}
                      disabled={savingNote}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-white font-medium disabled:opacity-60"
                      style={{ background: '#6B7EFF' }}
                    >
                      {savingNote ? <Loader2 size={11} className="animate-spin" /> : <><Check size={11} /> Save notes</>}
                    </button>
                    <button
                      onClick={() => { setQuery(dbSelected.property_name); setDbView(false); setTimeout(() => runARIA(), 100); }}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                    >
                      <RefreshCw size={11} /> Re-research
                    </button>
                  </div>
                </div>

                {/* Pitch strategy if available */}
                {dbSelected.pitch_strategy?.primary_hook && (
                  <div className="bg-white rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700 mb-2">Recommended pitch hook</p>
                    <p className="text-xs text-amber-900 leading-relaxed italic">&ldquo;{dbSelected.pitch_strategy.primary_hook}&rdquo;</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-full" style={{ background: '#F8FAFC' }}>
      <TopBar
        title="ARIA"
        subtitle="Account Research Intelligence Agent"
        actions={topbarActions}
      />

      {/* ── Desktop split layout ────────────────────────────────────────── */}
      <div className="hidden lg:flex flex-1 overflow-hidden" style={{ height: 'calc(100vh - 57px)' }}>

        {/* Left panel */}
        <div className="flex flex-col border-r border-gray-200 bg-white shrink-0" style={{ width: 260 }}>
          {/* Search area */}
          <div className="p-3 border-b border-gray-100">
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 mb-2">
              <Search size={13} className="text-gray-400 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !isRunning && runARIA()}
                placeholder="Property, area, or company..."
                className="flex-1 bg-transparent text-xs text-gray-800 placeholder:text-gray-400 outline-none"
                disabled={isRunning}
              />
              {isRunning && <Loader2 size={11} className="text-[#6B7EFF] animate-spin shrink-0" />}
            </div>
            <button
              onClick={runARIA}
              disabled={isRunning || !query.trim()}
              className="w-full py-2 rounded-xl text-white text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all"
              style={{ background: isRunning ? "#9CA3AF" : "#6B7EFF" }}
            >
              {isRunning ? <><Loader2 size={11} className="animate-spin" /> Running...</> : <><Zap size={11} /> Launch ARIA</>}
            </button>
          </div>

          {/* Results list OR saved searches */}
          <div className="flex-1 overflow-y-auto">
            {isDone && results && results.prospects.length > 0 ? (
              <div className="p-2.5">
                <div className="flex items-center gap-1.5 mb-2 px-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{results.prospects.length} targets found</span>
                  {results.query_interpretation && (
                    <span className="ml-auto text-[9px] text-[#6B7EFF] font-medium truncate max-w-[120px]">ARIA Intelligence</span>
                  )}
                </div>
                {results.prospects.map((p, i) => (
                  <ProspectListItem key={i} p={p} i={i} />
                ))}
                <button
                  onClick={() => { setPhase(0); setResults(null); setQuery(""); setSavedSearchId(null); }}
                  className="w-full mt-1 py-2 text-[11px] text-gray-400 hover:text-[#6B7EFF] transition-colors flex items-center justify-center gap-1"
                >
                  <ArrowLeft size={11} /> New search
                </button>
              </div>
            ) : (
              <div className="p-2.5">
                {!isRunning && savedSearches.length > 0 && (
                  <>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-1 mb-1">Recent searches</p>
                    {savedSearches.map(s => <SavedSearchRow key={s.id} s={s} />)}
                    <div className="my-2 border-t border-gray-100" />
                  </>
                )}
                {!isRunning && (
                  <div className="px-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Try an example</p>
                    {EXAMPLE_QUERIES.map((q, i) => (
                      <button key={i} onClick={() => { setQuery(q); inputRef.current?.focus(); }}
                        className="block w-full text-left text-[10px] px-2 py-1.5 rounded-lg text-gray-500 hover:bg-[#6B7EFF]/5 hover:text-[#6B7EFF] transition-all leading-tight mb-1">
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {dbView ? (
            <IntelDBPanel />
          ) : isRunning ? (
            <PipelinePanel />
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="max-w-sm bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                <AlertCircle size={16} className="text-red-500 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-700">Research failed</p>
                  <p className="text-xs text-red-600 mt-0.5">{error}</p>
                </div>
              </div>
            </div>
          ) : prospect ? (
            <div className="flex flex-col h-full overflow-hidden">
              <DetailHeader p={prospect} />
              <div className="flex-1 overflow-y-auto p-4">
                {activeTab === 'property' && <PropertyTab p={prospect} />}
                {activeTab === 'dm'       && <DMTab p={prospect} />}
                {activeTab === 'intel'    && <IntelTab p={prospect} />}
                {activeTab === 'scout'    && <ScoutTab p={prospect} />}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-lg"
                style={{ background: "linear-gradient(135deg, #6B7EFF 0%, #3B4FCC 100%)" }}>AR</div>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-600">ARIA — Lead Intelligence Engine</p>
                <p className="text-xs text-gray-400 mt-1">Enter a search on the left to begin</p>
              </div>
              <div className="flex items-center gap-4 mt-4 text-[10px]">
                <span className="flex items-center gap-1"><CheckCircle2 size={11} className="text-emerald-500" /> FCC Broadband data</span>
                <span className="flex items-center gap-1"><CheckCircle2 size={11} className="text-emerald-500" /> SEC EDGAR filings</span>
                <span className="flex items-center gap-1"><CheckCircle2 size={11} className="text-emerald-500" /> 28 OSINT sources</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile layout ───────────────────────────────────────────────── */}
      <div className="lg:hidden flex flex-col flex-1" style={{ paddingBottom: '56px' }}>
        {/* Mobile search bar — always visible */}
        <div className="bg-white border-b border-gray-200 p-3">
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
              <Search size={13} className="text-gray-400 shrink-0" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !isRunning && runARIA()}
                placeholder="Property or area..."
                className="flex-1 bg-transparent text-xs text-gray-800 placeholder:text-gray-400 outline-none"
                disabled={isRunning}
              />
            </div>
            <button onClick={runARIA} disabled={isRunning || !query.trim()}
              className="px-3 py-2 rounded-xl text-white text-xs font-semibold flex items-center gap-1 disabled:opacity-50"
              style={{ background: isRunning ? "#9CA3AF" : "#6B7EFF" }}>
              {isRunning ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
            </button>
          </div>
        </div>

        {/* Mobile content */}
        <div className="flex-1 overflow-y-auto">
          {isRunning ? (
            <div className="p-4"><PipelinePanel /></div>
          ) : error ? (
            <div className="p-4">
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                <AlertCircle size={16} className="text-red-500 shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          ) : mobileTab === 'list' ? (
            <div className="p-3">
              {isDone && results ? (
                <>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-1 mb-2">{results.prospects.length} targets</p>
                  {results.prospects.map((p, i) => (
                    <button key={i} onClick={() => { setSelectedProspect(i); setMobileTab('property'); }}
                      className="w-full text-left p-3 rounded-xl border border-gray-200 bg-white mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold"
                          style={scoreBg(p.profile?.buy_score ?? 0)}>{p.profile?.buy_score ?? 0}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-900 truncate">{p.property?.name}</p>
                          <p className="text-[10px] text-gray-400 truncate">{p.property?.address?.split(',').slice(0,2).join(',')}</p>
                        </div>
                        <ChevronRight size={14} className="text-gray-300" />
                      </div>
                    </button>
                  ))}
                </>
              ) : (
                <>
                  {savedSearches.length > 0 && (
                    <>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-1 mb-1">Recent searches</p>
                      {savedSearches.map(s => <SavedSearchRow key={s.id} s={s} />)}
                      <div className="my-3 border-t border-gray-100" />
                    </>
                  )}
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-1 mb-2">Try an example</p>
                  {EXAMPLE_QUERIES.map((q, i) => (
                    <button key={i} onClick={() => setQuery(q)}
                      className="block w-full text-left text-xs px-3 py-2 rounded-lg text-gray-500 hover:bg-[#6B7EFF]/5 hover:text-[#6B7EFF] transition-all mb-1.5">
                      {q}
                    </button>
                  ))}
                </>
              )}
            </div>
          ) : prospect ? (
            <div>
              <div className="bg-white border-b border-gray-200 p-3">
                <button onClick={() => setMobileTab('list')} className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                  <ArrowLeft size={12} /> Back to list
                </button>
                <p className="text-sm font-bold text-gray-900">{prospect.property.name}</p>
                <p className="text-[11px] text-gray-500">{prospect.property.address}</p>
              </div>
              {/* Mobile tabs */}
              <div className="bg-white border-b border-gray-200 flex">
                {(['property', 'dm', 'intel', 'scout'] as DetailTab[]).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={cn("flex-1 py-2.5 text-[10px] font-medium capitalize border-b-2 transition-colors",
                      activeTab === tab ? "border-[#6B7EFF] text-[#6B7EFF]" : "border-transparent text-gray-400")}>
                    {tab === 'dm' ? 'DM' : tab}
                  </button>
                ))}
              </div>
              <div className="p-3">
                {activeTab === 'property' && <PropertyTab p={prospect} />}
                {activeTab === 'dm'       && <DMTab p={prospect} />}
                {activeTab === 'intel'    && <IntelTab p={prospect} />}
                {activeTab === 'scout'    && <ScoutTab p={prospect} />}
              </div>
            </div>
          ) : null}
        </div>

        {/* Mobile bottom nav */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex" style={{ height: 56 }}>
          {([
            { key: 'list',     label: 'Leads',    icon: LayoutList },
            { key: 'property', label: 'Property',  icon: Building2 },
            { key: 'dm',       label: 'Contact',  icon: User },
            { key: 'scout',    label: 'SCOUT',    icon: Send },
          ] as { key: string; label: string; icon: React.ElementType }[]).map(tab => {
            const Icon = tab.icon;
            const isMobileActive = (tab.key === 'list' ? mobileTab === 'list' : activeTab === tab.key && mobileTab !== 'list');
            return (
              <button key={tab.key}
                onClick={() => {
                  if (tab.key === 'list') { setMobileTab('list'); }
                  else {
                    setActiveTab(tab.key as DetailTab);
                    if (isDone && prospect) setMobileTab(tab.key as any);
                  }
                }}
                className={cn("flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors",
                  isMobileActive ? "text-[#6B7EFF]" : "text-gray-400")}>
                <Icon size={18} />
                <span className="text-[9px] font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Animation keyframes */}
      <style>{`
        @keyframes aria-fill {
          from { width: 0%; }
          to   { width: 100%; }
        }
        @keyframes aria-shimmer {
          0%   { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
      `}</style>
    </div>
  );
}
