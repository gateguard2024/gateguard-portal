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
  high:   { bg: "bg-rose-50/50",   border: "border-rose-200",   text: "text-rose-600",   badge: "bg-rose-100 text-rose-600" },
  medium: { bg: "bg-amber-50/50", border: "border-amber-200", text: "text-amber-600", badge: "bg-amber-100 text-amber-600" },
  low:    { bg: "bg-slate-50/50",  border: "border-slate-200",  text: "text-slate-600",  badge: "bg-slate-100 text-slate-600" },
};

const URGENCY_PILL: Record<string, string> = {
  critical: "bg-rose-100 text-rose-700",
  high:     "bg-orange-100 text-orange-700",
  medium:   "bg-amber-100 text-amber-700",
  low:      "bg-slate-100 text-slate-700",
};

type DetailTab = 'property' | 'dm' | 'intel' | 'scout';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name?: string) {
  if (!name) return '?';
  return name.split(" ").filter(Boolean).map(n => n[0]).join("").slice(0, 2).toUpperCase() || '?';
}

function ScoreGauge({ score }: { score: number }) {
  const pct = (score / 10) * 100;
  const color = score >= 8 ? "#10B981" : score >= 6 ? "#F59E0B" : "#6B7EFF";
  return (
    <div className="flex items-center gap-4">
      <div className="flex-1">
        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden shadow-inner">
          <div className="h-full rounded-full transition-all duration-1000 relative"
            style={{ width: `${pct}%`, background: `linear-gradient(90deg, #6B7EFF, ${color})` }}>
              <div className="absolute inset-0 bg-white/20 w-full h-full" style={{ animation: 'shimmer 2s infinite' }} />
            </div>
        </div>
      </div>
      <span className="text-2xl font-mono font-bold tabular-nums tracking-tighter" style={{ color }}>
        {score}<span className="text-sm text-slate-300 font-sans">/10</span>
      </span>
    </div>
  );
}

function formatAge(iso: string) {
  if (!iso) return 'Unknown';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function daysUntil(iso: string) {
  if (!iso) return 0;
  return Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 86400000));
}

function scoreBg(score: number) {
  if (score >= 8) return { background: 'linear-gradient(135deg, #10B981, #059669)' };
  if (score >= 6) return { background: 'linear-gradient(135deg, #F59E0B, #D97706)' };
  return { background: 'linear-gradient(135deg, #6B7EFF, #4F46E5)' };
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
      setError(e.message || "Research failed — check API configuration and try again");
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
  const prospect  = results?.prospects?.[selectedProspect];

  // ── TopBar actions ─────────────────────────────────────────────────────────
  const topbarActions = (
    <div className="flex items-center gap-2">
      <button
        onClick={() => {
          if (!dbView) { setDbView(true); loadDbProperties(); }
          else setDbView(false);
        }}
        className={cn(
          "hidden lg:flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-bold border transition-all shadow-sm",
          dbView
            ? "bg-[#6B7EFF] text-white border-[#6B7EFF]"
            : "bg-white text-slate-600 border-slate-200 hover:border-[#6B7EFF]/50"
        )}
      >
        <Globe size={11} />
        Intel DB
        {dbTotal > 0 && (
          <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-md",
            dbView ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500")}>
            {dbTotal}
          </span>
        )}
      </button>
      {usageStats && !dbView && (
        <div className="hidden lg:flex items-center gap-3 mr-2 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <TrendingUp size={11} className="text-[#6B7EFF]" />
            <span className="font-bold text-slate-700">{usageStats.my_searches.total}</span> mine
          </span>
          {usageStats.corporate_total > 0 && (
            <span className="flex items-center gap-1">
              <span className="font-bold text-slate-700">{usageStats.corporate_total}</span> network
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
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-white font-bold disabled:opacity-60 shadow-sm"
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
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-white font-bold disabled:opacity-60 shadow-sm"
              style={{ background: "linear-gradient(to right, #10B981, #059669)" }}
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
    const isActive = selectedProspect === i && isDone;
    
    return (
      <button
        onClick={() => { setSelectedProspect(i); setActiveTab('property'); }}
        className={cn(
          "w-full text-left p-3.5 rounded-xl transition-all duration-300 mb-3 relative overflow-hidden group",
          isActive
            ? "bg-white shadow-[0_8px_30px_rgb(107,126,255,0.12)] border border-[#6B7EFF]/20"
            : "bg-white/60 border border-slate-200/60 hover:bg-white hover:shadow-sm hover:border-slate-300"
        )}
      >
        {isActive && (
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#6B7EFF] to-[#A78BFA]" />
        )}
        
        <div className="flex items-start gap-3 mb-2">
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-mono font-bold shrink-0 shadow-sm transition-transform",
            isActive ? "scale-110" : "group-hover:scale-105"
          )}
            style={scoreBg(score)}>
            {score}
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <p className={cn("text-xs font-bold leading-tight truncate transition-colors", isActive ? "text-[#6B7EFF]" : "text-slate-800")}>
              {p.property?.name}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5 truncate flex items-center gap-1">
              <MapPin size={10} className="opacity-70" /> {p.property?.address?.split(',').slice(0,2).join(',')}
            </p>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-1.5 mt-2 pl-11">
          {p.property?.units && (
            <span className="text-[9px] font-mono px-2 py-0.5 rounded-md bg-slate-100/80 text-slate-500 border border-slate-200/50">{p.property.units} U</span>
          )}
          {p.property?.proptech?.sara_signals && (
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-600 border border-purple-100">SARA</span>
          )}
          {p.profile?.urgency && p.profile.urgency !== 'low' && (
            <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider border",
              p.profile.urgency === 'critical' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-orange-50 text-orange-600 border-orange-100'
            )}>{p.profile.urgency}</span>
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
      <div className="flex items-start gap-2 p-2.5 rounded-lg hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200/60 group transition-all mb-1">
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => restoreSearch(s)}>
          <p className="text-[11px] font-bold text-slate-700 leading-tight truncate">{s.query}</p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className="text-[10px] text-slate-400 font-mono">{formatAge(s.created_at)}</span>
            <span className="text-[10px] text-slate-300">·</span>
            <span className="text-[10px] text-slate-500 font-medium">{prospects.length} targets</span>
            {alreadyImported && <span className="text-[9px] font-bold text-emerald-600">✓ imported</span>}
            {expDays <= 3 && <span className="text-[9px] text-amber-500 font-bold">⚠ {expDays}d</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
          <button
            onClick={() => { setQuery(s.query); setTimeout(() => runARIA(), 50); }}
            title="Re-run with fresh data"
            disabled={isRunning}
            className="text-slate-400 hover:text-[#6B7EFF] p-1 rounded transition-colors disabled:opacity-30"
          >
            <RefreshCw size={12} />
          </button>
          <button
            onClick={() => deleteSearch(s.id)}
            disabled={deleting === s.id}
            className="text-slate-400 hover:text-rose-500 p-1 rounded transition-colors disabled:opacity-40"
          >
            {deleting === s.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
          </button>
        </div>
      </div>
    );
  }

  // ── Detail header ─────────────────────────────────────────────────────────
  function DetailHeader({ p }: { p: Prospect }) {
    const score = p.profile?.buy_score ?? 0;
    
    return (
      <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 sticky top-0 z-10">
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Shield size={14} className="text-[#6B7EFF]" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#6B7EFF]">Target Acquired</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">{p.property?.name}</h2>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 font-medium">
                <MapPin size={12} /> {p.property?.address}
              </p>
            </div>
            
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-2xl p-2 pr-4 shadow-sm">
                 <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-mono font-bold shadow-inner" style={scoreBg(score)}>
                    {score}
                 </div>
                 <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Buy Score</span>
                    <span className="text-xs font-bold text-slate-800 capitalize">{p.profile?.urgency || 'Unknown'} Urgency</span>
                 </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 pb-0">
          <div className="flex gap-2 mb-[-1px]">
            {([
              { key: 'property', label: 'Property Telemetry' },
              { key: 'dm',       label: 'Decision Matrix' },
              { key: 'intel',    label: 'AI Intel', badge: p.pain_signals?.length > 0 ? p.pain_signals.length : null },
              { key: 'scout',    label: 'SCOUT Handoff', greenBadge: true },
            ] as { key: DetailTab; label: string; badge?: number | null; greenBadge?: boolean }[]).map(tab => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "px-4 py-2.5 text-xs font-bold transition-all relative rounded-t-lg",
                    isActive
                      ? "text-[#6B7EFF] bg-white border-t border-l border-r border-slate-200/60 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.02)]"
                      : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {tab.label}
                    {tab.badge != null && (
                      <span className="flex items-center justify-center h-4 min-w-[16px] px-1 text-[9px] font-mono text-white bg-rose-500 rounded-full shadow-sm">{tab.badge}</span>
                    )}
                    {tab.greenBadge && (
                      <span className="flex items-center justify-center h-4 w-4 text-[10px] text-white bg-emerald-500 rounded-full shadow-sm"><Check size={10}/></span>
                    )}
                  </div>
                  {isActive && <div className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-white z-10" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── Property tab ──────────────────────────────────────────────────────────
  function PropertyTab({ p }: { p: Prospect }) {
    const pt = p.property?.proptech ?? {};
    const hasStack = [pt.gate_operators, pt.access_control, pt.intercoms, pt.cameras,
      pt.smart_locks, pt.resident_apps, pt.package_solutions].some(a => a?.length);

    const categories = [
      { label: 'Gates',          emoji: '🚧', key: 'gate_operators' as keyof PropTech,    chipClass: 'bg-orange-50/80 text-orange-700 border-orange-200/60' },
      { label: 'Access Control', emoji: '🔑', key: 'access_control' as keyof PropTech,    chipClass: 'bg-blue-50/80 text-blue-700 border-blue-200/60' },
      { label: 'Intercoms',      emoji: '📟', key: 'intercoms' as keyof PropTech,         chipClass: 'bg-violet-50/80 text-violet-700 border-violet-200/60' },
      { label: 'Cameras',        emoji: '📷', key: 'cameras' as keyof PropTech,           chipClass: 'bg-slate-50/80 text-slate-700 border-slate-200/60' },
      { label: 'Smart Locks',    emoji: '🔒', key: 'smart_locks' as keyof PropTech,       chipClass: 'bg-emerald-50/80 text-emerald-700 border-emerald-200/60' },
      { label: 'Resident App',   emoji: '📱', key: 'resident_apps' as keyof PropTech,     chipClass: 'bg-indigo-50/80 text-indigo-700 border-indigo-200/60' },
      { label: 'Packages',       emoji: '📦', key: 'package_solutions' as keyof PropTech, chipClass: 'bg-amber-50/80 text-amber-700 border-amber-200/60' },
    ];

    return (
      <div className="grid grid-cols-2 gap-5 max-w-5xl animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="bg-white/80 rounded-2xl border border-slate-200/60 p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">Property Telemetry</p>
          <div className="space-y-3">
            {[
              { label: "Units",      val: p.property?.units },
              { label: "Type",       val: p.property?.property_type },
              { label: "Class",      val: p.property?.class ? `Class ${p.property.class}` : null },
              { label: "Year built", val: p.property?.year_built },
              { label: "Occupancy",  val: p.property?.occupancy },
            ].map(({ label, val }) => (
              <div key={label} className="flex items-center justify-between text-xs">
                <span className="text-slate-400">{label}</span>
                <span className="font-bold text-slate-800 capitalize">{val || 'Unknown'}</span>
              </div>
            ))}
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Management</p>
                <p className="text-xs font-bold text-slate-700 mt-1">{p.property?.management_company || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Owner entity</p>
                <p className="text-[11px] text-slate-500 mt-1">{p.property?.owner_entity || 'Unknown'}</p>
              </div>
              {p.ownership?.dnb_duns && p.ownership.dnb_duns !== 'unknown' && (
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">D&B DUNS</p>
                  <p className="font-mono text-[11px] text-slate-600 mt-1 flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded w-fit border border-slate-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                    {p.ownership.dnb_duns}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white/80 rounded-2xl border border-slate-200/60 p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">Financial &amp; Connectivity</p>
          {p.ownership && (
            <div className="space-y-3 mb-4">
              {[
                { label: "Owner type",     val: p.ownership.owner_type },
                { label: "Portfolio",      val: p.ownership.portfolio_size },
                { label: "Acquired",       val: p.ownership.acquisition_year },
                { label: "Hold period",    val: p.ownership.hold_period },
                { label: "CapEx signal",   val: p.ownership.capex_signal },
              ].filter(x => x.val).map(({ label, val }) => (
                <div key={label} className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">{label}</span>
                  <span className="font-bold text-slate-800 capitalize text-right max-w-[140px] truncate">{val}</span>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-slate-100 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Connectivity Hub</p>
              {p.property?._fcc_verified
                ? <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-100 text-emerald-600">FCC Verified</span>
                : <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-md bg-amber-50 border border-amber-100 text-amber-600">AI Estimated</span>}
            </div>
            {p.property?.isp_providers?.length ? (
              <div className="mb-3">
                <p className="text-[9px] font-mono text-slate-400 mb-1.5">ISP</p>
                <div className="flex flex-wrap gap-1.5">
                  {(p.property.isp_providers || []).map((isp: string) => (
                    <span key={isp} className={cn("text-[10px] px-2 py-1 rounded-md font-bold border",
                      p.property?._fcc_verified
                        ? "bg-emerald-50/50 text-emerald-700 border-emerald-200/60"
                        : "bg-blue-50/50 text-blue-700 border-blue-200/60"
                    )}>{isp}</span>
                  ))}
                </div>
              </div>
            ) : null}
            {p.property?.video_providers?.length ? (
              <div className="mb-3">
                <p className="text-[9px] font-mono text-slate-400 mb-1.5">Video</p>
                <div className="flex flex-wrap gap-1.5">
                  {(p.property.video_providers || []).map((vid: string) => (
                    <span key={vid} className="text-[10px] bg-violet-50/50 text-violet-700 border border-violet-200/60 px-2 py-1 rounded-md font-bold">{vid}</span>
                  ))}
                </div>
              </div>
            ) : null}
            {p.property?.bulk_agreements?.length ? (
              <div className="space-y-2 mt-2">
                {(p.property.bulk_agreements || []).map((a: BulkAgreement & { evidence?: string }, i: number) => (
                  <div key={i} className={cn("rounded-xl px-3 py-2 border shadow-sm",
                    a.agreement_type === 'exclusive' ? 'bg-amber-50/30 border-amber-200/60' :
                    a.agreement_type === 'bulk'      ? 'bg-emerald-50/30 border-emerald-200/60' :
                                                       'bg-slate-50/50 border-slate-200/60'
                  )}>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-xs font-bold text-slate-800">{a.provider}</span>
                      <span className={cn("text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md",
                        a.agreement_type === 'exclusive' ? 'bg-amber-100 text-amber-700' :
                        a.agreement_type === 'bulk'      ? 'bg-emerald-100 text-emerald-700' :
                                                           'bg-slate-200 text-slate-600'
                      )}>{a.agreement_type}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                      <span className="capitalize">{a.service_type}</span>
                      {a.expiry_estimate && a.expiry_estimate !== 'unknown' && (
                        <><span>·</span><span className="text-amber-600 font-bold bg-amber-50 px-1 rounded">Exp: {a.expiry_estimate}</span></>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {(hasStack || pt.tech_generation || pt.sara_signals) && (
          <div className="col-span-2 bg-white/80 rounded-2xl border border-slate-200/60 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#6B7EFF]">PropTech Stack Architecture</p>
              <div className="flex-1" />
              {pt.sara_signals
                ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-600 border border-purple-100 shadow-sm">🎯 SARA Opportunity</span>
                : pt.tech_generation
                  ? <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-md capitalize shadow-sm border",
                      pt.tech_generation === 'legacy' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                      pt.tech_generation === 'modern' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                        'bg-amber-50 text-amber-600 border-amber-100'
                    )}>{pt.tech_generation} Generation</span>
                  : null}
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-4">
              {categories.map(cat => {
                const items = pt[cat.key] as string[] | undefined;
                if (!items?.length) return null;
                return (
                  <div key={cat.key}>
                    <p className="text-[10px] font-mono text-slate-400 mb-2">{cat.emoji} {cat.label}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(items || []).map((item: string) => (
                        <span key={item} className={cn("text-[10px] px-2 py-1 rounded-md font-bold border shadow-sm", cat.chipClass)}>{item}</span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            {pt.replacement_window && (
              <div className="mt-5 rounded-xl px-4 py-3 bg-amber-50/50 border border-amber-200/60 flex items-start gap-2">
                <Clock size={14} className="text-amber-500 mt-0.5" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700/80 mb-0.5">Est. Replacement Window</p>
                  <p className="text-xs font-medium text-amber-900">{pt.replacement_window}</p>
                </div>
              </div>
            )}
            {pt.displacement_targets?.length ? (
              <div className="mt-3 rounded-xl px-4 py-3 border border-rose-200/60 bg-rose-50/30">
                <p className="text-[10px] font-bold uppercase tracking-widest text-rose-600 mb-2 flex items-center gap-1.5"><Target size={12}/> GateGuard Targets</p>
                <div className="flex flex-wrap gap-1.5">
                  {(pt.displacement_targets || []).map((t: string) => (
                    <span key={t} className="text-[10px] px-2 py-1 rounded-md font-bold bg-white text-rose-600 border border-rose-100 shadow-sm">{t}</span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    );
  }

  // ── DM tab ────────────────────────────────────────────────────────────────
  function DMTab({ p }: { p: Prospect }) {
    const roleMeta: Record<string, { label: string; bg: string; text: string; border: string }> = {
      owner:            { label: 'Owner / PE',     bg: 'bg-purple-50/80', text: 'text-purple-700', border: 'border-purple-200/60' },
      asset_manager:    { label: 'Asset Manager',  bg: 'bg-[#6B7EFF]/5', text: 'text-[#6B7EFF]', border: 'border-[#6B7EFF]/20' },
      regional_manager: { label: 'Regional VP',    bg: 'bg-emerald-50/80', text: 'text-emerald-700', border: 'border-emerald-200/60' },
      property_manager: { label: 'Property Mgr',  bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200/60' },
      unknown:          { label: 'Contact',        bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200/60' },
    };

    return (
      <div className="space-y-5 max-w-4xl animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="bg-white/80 rounded-2xl border border-slate-200/60 p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">Primary Contact</p>
          <div className="flex items-center gap-4 mb-5">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-sm"
              style={{ background: "linear-gradient(135deg, #6B7EFF 0%, #3B4FCC 100%)" }}>
              {getInitials(p.decision_maker?.name)}
            </div>
            <div>
              <p className="text-base font-bold text-slate-900 tracking-tight">{p.decision_maker?.name || 'Unknown'}</p>
              <p className="text-xs font-medium text-slate-500 mt-0.5">{p.decision_maker?.title || 'Unknown Title'}</p>
              <p className="text-[11px] text-slate-400">{p.decision_maker?.company || 'Unknown Company'}</p>
            </div>
          </div>
          <div className="space-y-3 text-xs border-t border-slate-100 pt-4 bg-slate-50/50 -mx-5 px-5 -mb-5 pb-5 rounded-b-2xl">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Verified Email Route</p>
              <p className="font-mono text-slate-800 text-[11px] break-all bg-white px-2 py-1 rounded border border-slate-200/60 w-fit shadow-sm">
                {p.decision_maker?.top_email_format || p.decision_maker?.email || 'N/A'}
              </p>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Direct Line</span>
              <span className="font-mono text-slate-700 font-bold">{p.decision_maker?.phone || 'N/A'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Estimated Tenure</span>
              <span className="text-slate-800 font-bold bg-white px-2 py-0.5 rounded border border-slate-200/60 shadow-sm">{p.decision_maker?.tenure_years || 0}y</span>
            </div>
            {p.decision_maker?.linkedin_slug && (
              <div className="pt-2">
                <a href={`https://linkedin.com/in/${p.decision_maker.linkedin_slug}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 text-[11px] font-bold bg-[#0A66C2] text-white py-2 rounded-lg shadow-sm hover:bg-[#084e96] transition-colors">
                  <ExternalLink size={12} /> View Professional Profile
                </a>
              </div>
            )}
          </div>
        </div>

        {p.decision_maker_chain && p.decision_maker_chain.length > 0 && (
          <div className="bg-white/80 rounded-2xl border border-slate-200/60 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Corporate Hierarchy</p>
              <span className="ml-auto text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">{p.decision_maker_chain.length} Nodes</span>
            </div>
            <div className="space-y-3">
              {(p.decision_maker_chain || []).map((dm, idx) => {
                const meta = roleMeta[dm.role_type] ?? roleMeta.unknown;
                return (
                  <div key={idx} className={cn("rounded-xl border p-4 bg-white shadow-sm transition-all hover:shadow-md", meta.border)}>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-[10px] shrink-0 shadow-sm"
                        style={{ background: dm.role_type === 'owner' ? 'linear-gradient(135deg, #7C3AED, #5B21B6)' : dm.role_type === 'asset_manager' ? 'linear-gradient(135deg, #6B7EFF, #3B4FCC)' : 'linear-gradient(135deg, #10B981, #059669)' }}>
                        {getInitials(dm.name)}
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <p className="text-sm font-bold text-slate-900 truncate">{dm.name || 'Unknown'}</p>
                          <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-md border shadow-sm", meta.bg, meta.text, meta.border)}>{meta.label}</span>
                        </div>
                        <p className="text-xs font-medium text-slate-500 truncate">{dm.title}</p>
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">{dm.company}</p>
                      </div>
                    </div>
                    {(dm.top_email_format || dm.email) && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <p className="font-mono text-[10px] text-slate-600 bg-slate-50 px-2 py-1 rounded w-fit border border-slate-100">{dm.top_email_format || dm.email}</p>
                      </div>
                    )}
                    {dm.dm_hooks && dm.dm_hooks.length > 0 && dm.dm_hooks[0] !== 'no recent social activity found' && (
                      <div className="mt-3 space-y-1.5 bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">AI Hooks</p>
                        {(dm.dm_hooks || []).slice(0, 2).map((hook, hi) => (
                          <p key={hi} className="text-[10px] text-slate-600 leading-relaxed font-medium">
                            <span className={cn("font-bold mr-1.5", meta.text)}>↳</span>{hook}
                          </p>
                        ))}
                      </div>
                    )}
                    {dm.linkedin_slug && (
                      <a href={`https://linkedin.com/in/${dm.linkedin_slug}`} target="_blank" rel="noopener noreferrer"
                        className={cn("mt-3 flex items-center gap-1.5 text-[10px] font-bold w-fit px-2 py-1 rounded-md transition-colors", meta.bg, meta.text)}>
                        <ExternalLink size={10} /> LinkedIn Profile
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
      <div className="space-y-6 max-w-4xl animate-in fade-in slide-in-from-bottom-2 duration-500">
        
        {/* AI Synthesis Block */}
        <div className="ai-border-glow active bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-5">
            <Cpu size={16} className="text-[#A78BFA]" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#A78BFA]">ARIA Synthesis</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-x-8 gap-y-6">
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Target size={12}/> Primary Vulnerability</p>
              <p className="text-sm text-slate-800 leading-relaxed font-medium">{p.profile?.primary_concern || 'None detected'}</p>
            </div>
            
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Clock size={12}/> Contract Window</p>
              <p className="text-sm text-slate-800 leading-relaxed font-medium">{p.profile?.contract_window || 'Unknown'}</p>
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Globe size={12}/> Incumbent Vendor</p>
              <p className="text-sm text-slate-800 leading-relaxed font-medium">{p.profile?.current_vendor || 'Unknown'}</p>
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Users size={12}/> Comm Style</p>
              <p className="text-sm text-slate-800 leading-relaxed font-medium capitalize">{p.profile?.communication_style?.replace(/-/g, " ") || 'Email'}</p>
            </div>
          </div>
        </div>

        {/* Intent Signals / Anomalies */}
        <div>
          <div className="flex items-center justify-between mb-4 px-1">
            <div className="flex items-center gap-2">
              <Radio size={16} className="text-rose-500" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-700">Intent Signals Detected</h3>
            </div>
            <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-1 rounded-md">{p.pain_signals?.length || 0} Anomalies</span>
          </div>

          <div className="space-y-3">
            {(p.pain_signals || []).map((sig, i) => {
              const Icon = SIGNAL_ICONS[sig.signal_type] || AlertCircle;
              const sev = SIGNAL_SEVERITY[sig.severity] ?? SIGNAL_SEVERITY.low;
              return (
                <div key={i} className={cn("rounded-xl border bg-white shadow-sm p-4 relative overflow-hidden group", sev.border)}>
                  <div className={cn("absolute left-0 top-0 bottom-0 w-1 opacity-50", sev.bg.replace('bg-', 'bg-gradient-to-b from-white to-'))} />
                  
                  <div className="flex items-start gap-4">
                    <div className={cn("p-2 rounded-lg bg-slate-50 border", sev.text, sev.border.replace('border-', 'border-').replace('200', '100'))}>
                       <Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={cn("text-[10px] font-bold uppercase tracking-wider", sev.text)}>{displaySource(sig.source)}</span>
                        <span className="text-[10px] font-mono text-slate-400">• {sig.date}</span>
                        <span className={cn("ml-auto text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider shadow-sm border", sev.badge, sev.border.replace('200','100'))}>{sig.severity} Alert</span>
                      </div>
                      <p className="text-sm text-slate-700 leading-relaxed font-medium">&ldquo;{sig.quote}&rdquo;</p>
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
      <div className="flex flex-col items-center justify-center py-16 text-slate-300 gap-3">
        <Send size={32} className="opacity-20" />
        <p className="text-sm font-medium">No SCOUT brief available for this target</p>
      </div>
    );

    return (
      <div className="space-y-6 max-w-4xl animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
          
          {/* Header */}
          <div className="bg-slate-50/50 border-b border-slate-100 px-6 py-4 flex items-center justify-between">
             <div className="flex items-center gap-2">
               <Zap size={16} className="text-emerald-500" />
               <h3 className="text-xs font-bold uppercase tracking-widest text-slate-700">Scout Handoff Payload</h3>
             </div>
             <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100 shadow-sm">Status: Ready</span>
          </div>

          <div className="p-6">
            {/* Meta Tags */}
            <div className="flex items-center gap-3 flex-wrap mb-6 pb-6 border-b border-slate-100">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#6B7EFF]/10 border border-[#6B7EFF]/20 shadow-sm">
                <Target size={12} className="text-[#6B7EFF]" />
                <span className="text-[11px] font-bold text-[#6B7EFF] tracking-wide">
                  {(p.scout_brief?.outreach_angle || 'General').replace(/_/g, ' ').toUpperCase()}
                </span>
              </div>
              <span className={cn("text-[11px] font-bold px-3 py-1.5 rounded-lg uppercase tracking-wide shadow-sm border",
                URGENCY_PILL[p.scout_brief?.contract_window_urgency] || "bg-slate-100 text-slate-600 border-slate-200")}>
                {p.scout_brief?.contract_window_urgency || 'unknown'} URGENCY
              </span>
              <div className="ml-auto flex items-center gap-2 text-[11px] font-mono text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                <User size={12} /> Target: <span className="text-slate-800 font-bold">{p.scout_brief?.primary_contact || 'Unknown'}</span>
              </div>
            </div>

            {/* Key Intel Terminal Block */}
            <div className="bg-[#0C111D] rounded-xl p-6 shadow-inner relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#6B7EFF] to-[#A78BFA] opacity-50" />
              <p className="text-[10px] font-mono text-slate-400 mb-4 uppercase tracking-widest flex items-center gap-2">
                <Cpu size={12} className="text-[#6B7EFF]"/> Injecting variables...
              </p>
              <div className="space-y-4">
                {(p.scout_brief?.key_data_points || []).map((point, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="text-[11px] font-mono text-emerald-400 mt-0.5">[{i + 1}]</span>
                    <p className="text-[13px] font-mono text-slate-300 leading-relaxed">{point}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={() => {
                  const text = `SCOUT Brief\n\nPrimary Contact: ${p.scout_brief?.primary_contact || 'Unknown'}\nAngle: ${(p.scout_brief?.outreach_angle || '').replace(/_/g, ' ')}\nContract Window: ${p.scout_brief?.contract_window_urgency || 'Unknown'}\n\nKey Intel:\n${(p.scout_brief?.key_data_points || []).map((pt, i) => `${i+1}. ${pt}`).join('\n')}`;
                  navigator.clipboard.writeText(text);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="flex items-center gap-2 text-xs px-4 py-2.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors font-bold shadow-sm"
              >
                <Copy size={14} /> {copied ? "Copied!" : "Copy Payload"}
              </button>
              
              <div className="flex-1" />

              {savedSearchId && !importResult[savedSearchId] && (
                <button
                  onClick={() => importSearch(savedSearchId)}
                  disabled={importing === savedSearchId}
                  className="flex items-center gap-2 text-xs px-5 py-2.5 rounded-lg text-white font-bold transition-all hover:opacity-90 disabled:opacity-60 shadow-sm"
                  style={{ background: "#6B7EFF" }}
                >
                  {importing === savedSearchId ? <Loader2 size={14} className="animate-spin" /> : <><Download size={14} /> Import to Queue</>}
                </button>
              )}
              {savedSearchId && (importResult[savedSearchId]?.created ?? 0) >= 0 && !scoutResult[savedSearchId] && (
                <button
                  onClick={() => launchScout(savedSearchId)}
                  disabled={scoutLoading === savedSearchId}
                  className="ai-border-glow active flex items-center gap-2 text-xs px-6 py-2.5 rounded-lg text-white font-bold transition-all hover:scale-105 disabled:opacity-60 disabled:hover:scale-100 shadow-[0_4px_14px_0_rgba(16,185,129,0.39)]"
                  style={{ background: "linear-gradient(to right, #10B981, #059669)" }}
                >
                  {scoutLoading === savedSearchId ? <Loader2 size={14} className="animate-spin" /> : <><Zap size={14} /> INITIALIZE SCOUT</>}
                </button>
              )}
              {savedSearchId && scoutResult[savedSearchId] && (
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 bg-emerald-50 px-4 py-2.5 rounded-lg border border-emerald-100 shadow-sm">
                  <CheckCircle2 size={14} /> Sequence Deployed ({scoutResult[savedSearchId].sent} sent)
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Pipeline panel ────────────────────────────────────────────────────────
  function PipelinePanel() {
    return (
      <div className="flex flex-col items-center justify-center h-full px-8 py-12">
        <div className="w-full max-w-sm space-y-3">
          <div className="flex items-center gap-3 mb-6 bg-white px-4 py-3 rounded-xl border border-slate-200/60 shadow-sm">
            <Loader2 size={16} className="text-[#6B7EFF] animate-spin" />
            <span className="text-sm font-bold text-slate-700">Running Intelligence Pipeline...</span>
          </div>
          {PHASES.map((p) => {
            const Icon = p.icon;
            const status = phase > p.id ? "done" : phase === p.id ? "running" : "queued";
            return (
              <div key={p.id} className={cn(
                "rounded-xl border p-4 transition-all duration-500",
                status === "done"    ? "border-emerald-200/60 bg-emerald-50/30 shadow-sm" :
                status === "running" ? "border-[#6B7EFF]/30 bg-[#6B7EFF]/5 shadow-sm" :
                                       "border-slate-100 bg-slate-50/50 opacity-60"
              )}>
                <div className="flex items-center gap-3">
                  <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center shadow-sm",
                    status === "done" ? "bg-emerald-500" : status === "running" ? "bg-[#6B7EFF]" : "bg-slate-300")}>
                    {status === "done"    ? <CheckCircle2 size={12} className="text-white" /> :
                     status === "running" ? <Loader2 size={12} className="text-white animate-spin" /> :
                                           <Icon size={12} className="text-white" />}
                  </div>
                  <span className={cn("text-xs font-bold flex-1 tracking-wide",
                    status === "done" ? "text-emerald-700" : status === "running" ? "text-[#6B7EFF]" : "text-slate-400")}>
                    {p.name}
                  </span>
                  {status === "running" && p.id === 5 && (
                    <span className="text-[10px] text-[#6B7EFF] font-mono font-bold bg-white px-2 py-1 rounded-md border border-[#6B7EFF]/20">{SYNTHESIS_STEPS[synthStep]}</span>
                  )}
                  {status === "done" && <CheckCircle2 size={14} className="text-emerald-500" />}
                </div>
                <div className="mt-3 h-1 bg-slate-200/60 rounded-full overflow-hidden">
                  {status === "done" && <div className="h-full w-full bg-emerald-400 rounded-full" />}
                  {status === "running" && p.id < 5 && (
                    <div className="h-full bg-[#6B7EFF] rounded-full shadow-[0_0_8px_rgba(107,126,255,0.6)]"
                      style={{ animation: `aria-fill ${PHASE_DURATIONS[p.id]}ms ease-in-out forwards` }} />
                  )}
                  {status === "running" && p.id === 5 && (
                    <div className="h-full rounded-full w-full"
                      style={{ background: "linear-gradient(90deg, #6B7EFF 0%, #A78BFA 50%, #6B7EFF 100%)",
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
      prospect:    { label: 'Prospect',     color: 'bg-slate-100 text-slate-600' },
      contacted:   { label: 'Contacted',    color: 'bg-blue-100 text-blue-700' },
      proposal:    { label: 'Proposal',     color: 'bg-violet-100 text-violet-700' },
      negotiation: { label: 'Negotiating',  color: 'bg-amber-100 text-amber-700' },
      won:         { label: 'Won',          color: 'bg-emerald-100 text-emerald-700' },
      lost:        { label: 'Lost',         color: 'bg-rose-100 text-rose-600' },
      'no-contact':{ label: 'No contact',   color: 'bg-slate-100 text-slate-400' },
    };

    return (
      <div className="flex flex-col h-full overflow-hidden bg-white/50">
        <div className="bg-white border-b border-slate-200/60 px-6 py-4 shadow-sm z-10">
          <div className="flex items-center gap-3 mb-3">
            <Globe size={16} className="text-[#6B7EFF]" />
            <h2 className="text-base font-bold text-slate-900 tracking-tight">Intelligence Database</h2>
            <span className="text-[10px] px-2 py-1 rounded-md bg-[#6B7EFF]/10 border border-[#6B7EFF]/20 text-[#6B7EFF] font-bold font-mono">{dbTotal} logged</span>
            <span className="ml-auto text-[10px] font-medium text-slate-400">Autonomous Storage</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 bg-slate-50 border border-slate-200/60 rounded-xl px-3 py-2 focus-within:border-[#6B7EFF]/50 focus-within:bg-white transition-colors shadow-inner">
              <Search size={14} className="text-slate-400 shrink-0" />
              <input
                value={dbSearch}
                onChange={e => { setDbSearch(e.target.value); loadDbProperties(e.target.value, dbFilter); }}
                placeholder="Search telemetry..."
                className="flex-1 text-xs font-medium bg-transparent text-slate-800 placeholder:text-slate-400 outline-none"
              />
            </div>
            {(['all','critical','expiring','sara'] as const).map(f => (
              <button key={f} onClick={() => { setDbFilter(f); loadDbProperties(dbSearch, f); }}
                className={cn("text-[11px] px-4 py-2 rounded-xl font-bold capitalize transition-all shadow-sm",
                  dbFilter === f ? "bg-[#6B7EFF] text-white" : "bg-white text-slate-600 border border-slate-200/60 hover:bg-slate-50"
                )}>
                {f === 'expiring' ? '📅 Expiring' : f === 'sara' ? '🎯 SARA' : f === 'critical' ? '🔴 Critical' : 'All'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-80 border-r border-slate-200/60 bg-slate-50/30 overflow-y-auto shrink-0">
            {dbLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={20} className="text-[#6B7EFF] animate-spin" />
              </div>
            ) : dbProps.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3 px-4 text-center">
                <Globe size={32} className="opacity-20" />
                <p className="text-sm font-bold text-slate-500">No properties in DB</p>
                <p className="text-xs font-medium">Run ARIA to begin populating telemetry.</p>
              </div>
            ) : (
              <div className="p-3">
                {dbProps.map(p => {
                  const stageInfo = STAGES[p.sales_stage] ?? STAGES.prospect;
                  return (
                    <button key={p.id}
                      onClick={() => { setDbSelected(p); setNoteText(p.sales_notes ?? ''); setNoteStage(p.sales_stage ?? 'prospect'); }}
                      className={cn(
                        "w-full text-left p-3.5 rounded-xl border mb-2 transition-all group",
                        dbSelected?.id === p.id 
                           ? "border-[#6B7EFF]/50 bg-white shadow-md relative overflow-hidden" 
                           : "border-slate-200/60 bg-white/60 hover:bg-white hover:border-slate-300 hover:shadow-sm"
                      )}>
                      {dbSelected?.id === p.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#6B7EFF]" />}
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-mono font-bold shrink-0 shadow-sm"
                          style={scoreBg(p.buy_score ?? 0)}>{p.buy_score ?? '?'}</div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <p className="text-[11px] font-bold text-slate-900 truncate leading-tight">{p.property_name}</p>
                          <p className="text-[9px] font-medium text-slate-500 truncate mt-0.5">{(p.address ?? '').split(',').slice(0,2).join(',')}</p>
                          <div className="flex items-center gap-1 mt-2 flex-wrap">
                            <span className={cn("text-[8px] font-bold px-1.5 py-0.5 rounded-md", stageInfo.color)}>{stageInfo.label}</span>
                            {p.sara_signals && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-600 border border-purple-100">SARA</span>}
                            {p.contract_expiry_year && <span className="text-[8px] text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-100">Exp {p.contract_expiry_year}</span>}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-6 bg-transparent">
            {!dbSelected ? (
              <div className="flex items-center justify-center h-full text-slate-400">
                <p className="text-sm font-medium">Select a property to view deep intel</p>
              </div>
            ) : (
              <div className="space-y-5 max-w-3xl animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 tracking-tight">{dbSelected.property_name}</h3>
                      <p className="text-xs font-medium text-slate-500 mt-1 flex items-center gap-1.5">
                        <MapPin size={12} /> {dbSelected.address}
                      </p>
                    </div>
                    <div className="ml-auto flex flex-col items-end gap-1.5">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-mono font-bold text-sm shadow-inner"
                        style={scoreBg(dbSelected.buy_score ?? 0)}>{dbSelected.buy_score ?? '?'}</div>
                      <span className="text-[10px] font-mono text-slate-400">Updated {formatAge(dbSelected.last_researched_at)}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100">
                    {dbSelected.management_company && <span className="text-[10px] font-bold px-3 py-1 rounded-lg border border-slate-200/60 text-slate-600 bg-slate-50 shadow-sm">{dbSelected.management_company}</span>}
                    {dbSelected.owner_entity && <span className="text-[10px] font-bold px-3 py-1 rounded-lg border border-blue-200/60 bg-blue-50/50 text-blue-700 shadow-sm">{dbSelected.owner_entity}</span>}
                    {dbSelected.sara_signals && <span className="text-[10px] px-3 py-1 rounded-lg bg-purple-50 text-purple-700 border border-purple-100 font-bold shadow-sm">🎯 SARA Bridge</span>}
                    {dbSelected.contract_expiry_year && (
                      <span className={cn("text-[10px] px-3 py-1 rounded-lg border font-bold shadow-sm",
                        dbSelected.contract_expiry_year <= new Date().getFullYear() + 1
                          ? "bg-rose-50 border-rose-200/60 text-rose-700"
                          : "bg-amber-50 border-amber-200/60 text-amber-700"
                      )}>📅 Contract exp. ~{dbSelected.contract_expiry_year}</span>
                    )}
                  </div>
                </div>

                {/* Sales notes & Update */}
                <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-[#6B7EFF]" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">Pipeline Control</p>
                  <div className="flex items-center gap-3 mb-4">
                    <p className="text-xs font-bold text-slate-600 shrink-0">CRM Stage:</p>
                    <select
                      value={noteStage || dbSelected.sales_stage || 'prospect'}
                      onChange={e => setNoteStage(e.target.value)}
                      className="text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 text-slate-800 bg-slate-50 outline-none focus:border-[#6B7EFF] focus:bg-white transition-colors cursor-pointer shadow-sm"
                    >
                      {Object.entries(STAGES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                    {dbSelected.last_contacted_at && (
                      <span className="text-[10px] font-mono text-slate-400 ml-auto bg-slate-50 px-2 py-1 rounded border border-slate-100">Last contact: {formatAge(dbSelected.last_contacted_at)}</span>
                    )}
                  </div>
                  <textarea
                    value={noteText !== '' ? noteText : (dbSelected.sales_notes ?? '')}
                    onChange={e => setNoteText(e.target.value)}
                    placeholder="Input human intelligence, meeting notes, or disposition details..."
                    rows={4}
                    className="w-full text-sm font-medium border border-slate-200/60 rounded-xl px-4 py-3 text-slate-800 placeholder:text-slate-400 resize-none outline-none focus:border-[#6B7EFF] focus:ring-2 focus:ring-[#6B7EFF]/20 transition-all shadow-inner mb-4"
                  />
                  <div className="flex items-center gap-3">
                    <button
                      onClick={savePropertyNote}
                      disabled={savingNote}
                      className="flex items-center gap-2 text-xs px-5 py-2.5 rounded-lg text-white font-bold disabled:opacity-60 shadow-sm transition-all hover:scale-105"
                      style={{ background: '#6B7EFF' }}
                    >
                      {savingNote ? <Loader2 size={14} className="animate-spin" /> : <><Check size={14} /> Commit Update</>}
                    </button>
                    <button
                      onClick={() => { setQuery(dbSelected.property_name); setDbView(false); setTimeout(() => runARIA(), 100); }}
                      className="flex items-center gap-2 text-xs px-5 py-2.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-bold transition-all shadow-sm"
                    >
                      <RefreshCw size={14} /> Fetch Latest Intel
                    </button>
                  </div>
                </div>

                {dbSelected.pitch_strategy?.primary_hook && (
                  <div className="bg-amber-50/50 rounded-2xl border border-amber-200/60 p-6 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700/80 mb-2 flex items-center gap-1.5"><Target size={12}/> AI Recommended Hook</p>
                    <p className="text-sm text-amber-900 leading-relaxed font-medium italic">&ldquo;{dbSelected.pitch_strategy.primary_hook}&rdquo;</p>
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
        <div className="flex flex-col border-r border-slate-200/60 bg-slate-50/30 shrink-0" style={{ width: 280 }}>
          <div className="p-4 border-b border-slate-200/60 bg-white/50 backdrop-blur-sm">
            <div className="flex items-center gap-2 bg-white border border-slate-200/60 rounded-xl px-3 py-2.5 mb-3 shadow-inner focus-within:border-[#6B7EFF]/50 focus-within:ring-2 focus-within:ring-[#6B7EFF]/10 transition-all">
              <Search size={14} className="text-slate-400 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !isRunning && runARIA()}
                placeholder="Property, area, or company..."
                className="flex-1 bg-transparent text-xs font-medium text-slate-800 placeholder:text-slate-400 outline-none"
                disabled={isRunning}
              />
              {isRunning && <Loader2 size={12} className="text-[#6B7EFF] animate-spin shrink-0" />}
            </div>
            <button
              onClick={runARIA}
              disabled={isRunning || !query.trim()}
              className="w-full py-2.5 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-all shadow-sm hover:opacity-90"
              style={{ background: isRunning ? "#94a3b8" : "linear-gradient(135deg, #6B7EFF 0%, #4F46E5 100%)" }}
            >
              {isRunning ? <><Loader2 size={12} className="animate-spin" /> Synchronizing...</> : <><Zap size={12} /> Launch ARIA</>}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-4">
            {isDone && results && results.prospects.length > 0 ? (
              <div className="animate-in fade-in duration-300">
                <div className="flex items-center gap-2 mb-4 px-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{results.prospects.length} targets found</span>
                  {results.query_interpretation && (
                    <span className="ml-auto text-[9px] text-[#6B7EFF] font-bold truncate max-w-[120px] bg-[#6B7EFF]/10 px-2 py-0.5 rounded border border-[#6B7EFF]/20">ARIA Verified</span>
                  )}
                </div>
                {results.prospects.map((p, i) => (
                  <ProspectListItem key={i} p={p} i={i} />
                ))}
                <button
                  onClick={() => { setPhase(0); setResults(null); setQuery(""); setSavedSearchId(null); }}
                  className="w-full mt-4 py-2.5 text-[11px] font-bold text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                >
                  <ArrowLeft size={12} /> Clear Session
                </button>
              </div>
            ) : (
              <div className="animate-in fade-in duration-300">
                {!isRunning && savedSearches.length > 0 && (
                  <div className="mb-6">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-2 mb-3">Recent Memory</p>
                    {savedSearches.map(s => <SavedSearchRow key={s.id} s={s} />)}
                  </div>
                )}
                {!isRunning && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-2 mb-3">Suggested Operations</p>
                    {EXAMPLE_QUERIES.map((q, i) => (
                      <button key={i} onClick={() => { setQuery(q); inputRef.current?.focus(); }}
                        className="block w-full text-left text-[11px] font-medium px-3 py-2.5 rounded-xl text-slate-500 hover:bg-white hover:text-[#6B7EFF] hover:shadow-sm border border-transparent hover:border-slate-200/60 transition-all leading-snug mb-1.5">
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
        <div className="flex-1 flex flex-col overflow-hidden bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed" style={{ backgroundBlendMode: 'overlay', backgroundColor: 'rgba(248, 250, 252, 0.95)' }}>
          {dbView ? (
            <IntelDBPanel />
          ) : isRunning ? (
            <PipelinePanel />
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="max-w-md bg-white border border-rose-200/60 rounded-2xl p-6 flex items-start gap-4 shadow-sm">
                <div className="p-2 bg-rose-50 rounded-lg">
                   <AlertCircle size={20} className="text-rose-500" />
                </div>
                <div>
                  <p className="text-base font-bold text-slate-900 mb-1">Telemetry Error</p>
                  <p className="text-sm font-medium text-slate-500 leading-relaxed">{error}</p>
                </div>
              </div>
            </div>
          ) : prospect ? (
            <div className="flex flex-col h-full overflow-hidden">
              <DetailHeader p={prospect} />
              <div className="flex-1 overflow-y-auto p-6 lg:p-8">
                {activeTab === 'property' && <PropertyTab p={prospect} />}
                {activeTab === 'dm'       && <DMTab p={prospect} />}
                {activeTab === 'intel'    && <IntelTab p={prospect} />}
                {activeTab === 'scout'    && <ScoutTab p={prospect} />}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-5 text-slate-400">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg relative"
                style={{ background: "linear-gradient(135deg, #6B7EFF 0%, #3B4FCC 100%)" }}>
                  AR
                  <div className="absolute inset-0 rounded-2xl border border-white/20" />
              </div>
              <div className="text-center">
                <p className="text-base font-bold text-slate-800">ARIA Intelligence Engine</p>
                <p className="text-sm font-medium text-slate-500 mt-1">Awaiting operational parameters.</p>
              </div>
              <div className="flex items-center justify-center gap-6 mt-6 pt-6 border-t border-slate-200/60 text-[11px] font-bold text-slate-400">
                <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-[#6B7EFF]" /> FCC Broadband Data</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-[#6B7EFF]" /> SEC EDGAR Filings</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-[#6B7EFF]" /> 28 OSINT Sources</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile layout ───────────────────────────────────────────────── */}
      <div className="lg:hidden flex flex-col flex-1" style={{ paddingBottom: '56px' }}>
        <div className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 p-4 sticky top-0 z-20">
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 bg-slate-50 border border-slate-200/60 rounded-xl px-3 py-2.5 shadow-inner">
              <Search size={14} className="text-slate-400 shrink-0" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !isRunning && runARIA()}
                placeholder="Property or area..."
                className="flex-1 bg-transparent text-xs font-medium text-slate-800 placeholder:text-slate-400 outline-none"
                disabled={isRunning}
              />
            </div>
            <button onClick={runARIA} disabled={isRunning || !query.trim()}
              className="px-4 py-2.5 rounded-xl text-white text-xs font-bold flex items-center gap-1 disabled:opacity-50 shadow-sm"
              style={{ background: isRunning ? "#94a3b8" : "linear-gradient(135deg, #6B7EFF 0%, #4F46E5 100%)" }}>
              {isRunning ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isRunning ? (
            <div className="p-4"><PipelinePanel /></div>
          ) : error ? (
            <div className="p-4">
              <div className="bg-rose-50 border border-rose-200/60 rounded-xl p-4 flex items-center gap-3">
                <AlertCircle size={16} className="text-rose-500 shrink-0" />
                <p className="text-sm font-medium text-rose-700">{error}</p>
              </div>
            </div>
          ) : mobileTab === 'list' ? (
            <div className="p-4">
              {isDone && results ? (
                <>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-1 mb-3">{(results.prospects || []).length} targets found</p>
                  {(results.prospects || []).map((p, i) => (
                    <button key={i} onClick={() => { setSelectedProspect(i); setMobileTab('property'); }}
                      className="w-full text-left p-4 rounded-xl border border-slate-200/60 bg-white shadow-sm mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-mono font-bold shadow-sm"
                          style={scoreBg(p.profile?.buy_score ?? 0)}>{p.profile?.buy_score ?? 0}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">{p.property?.name}</p>
                          <p className="text-[10px] font-medium text-slate-500 truncate mt-0.5">{p.property?.address?.split(',').slice(0,2).join(',')}</p>
                        </div>
                        <ChevronRight size={16} className="text-slate-300" />
                      </div>
                    </button>
                  ))}
                </>
              ) : (
                <>
                  {savedSearches.length > 0 && (
                    <div className="mb-6">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-1 mb-2">Recent Memory</p>
                      {savedSearches.map(s => <SavedSearchRow key={s.id} s={s} />)}
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-1 mb-2">Suggested Operations</p>
                    {EXAMPLE_QUERIES.map((q, i) => (
                      <button key={i} onClick={() => setQuery(q)}
                        className="block w-full text-left text-xs font-medium px-4 py-3 rounded-xl border border-slate-200/60 bg-white shadow-sm text-slate-600 hover:text-[#6B7EFF] transition-all mb-2">
                        {q}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : prospect ? (
            <div>
              <div className="bg-white border-b border-slate-200/60 p-4 sticky top-0 z-10">
                <button onClick={() => setMobileTab('list')} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 mb-3">
                  <ArrowLeft size={14} /> Return to list
                </button>
                <p className="text-lg font-bold text-slate-900 tracking-tight">{prospect.property?.name}</p>
                <p className="text-xs font-medium text-slate-500 mt-0.5">{prospect.property?.address}</p>
              </div>
              <div className="bg-white border-b border-slate-200/60 flex overflow-x-auto no-scrollbar">
                {(['property', 'dm', 'intel', 'scout'] as DetailTab[]).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={cn("whitespace-nowrap px-5 py-3 text-xs font-bold capitalize border-b-2 transition-colors",
                      activeTab === tab ? "border-[#6B7EFF] text-[#6B7EFF]" : "border-transparent text-slate-400")}>
                    {tab === 'dm' ? 'Decision Maker' : tab}
                  </button>
                ))}
              </div>
              <div className="p-4">
                {activeTab === 'property' && <PropertyTab p={prospect} />}
                {activeTab === 'dm'       && <DMTab p={prospect} />}
                {activeTab === 'intel'    && <IntelTab p={prospect} />}
                {activeTab === 'scout'    && <ScoutTab p={prospect} />}
              </div>
            </div>
          ) : null}
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-slate-200/60 flex z-30 pb-safe" style={{ height: 64 }}>
          {([
            { key: 'list',     label: 'Leads',    icon: LayoutList },
            { key: 'property', label: 'Property', icon: Building2 },
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
                className={cn("flex-1 flex flex-col items-center justify-center gap-1 transition-colors",
                  isMobileActive ? "text-[#6B7EFF]" : "text-slate-400")}>
                <Icon size={20} />
                <span className="text-[10px] font-bold">{tab.label}</span>
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
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes gradient-xy {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .ai-border-glow {
          position: relative;
        }
        .ai-border-glow::before {
          content: "";
          position: absolute;
          inset: -1px;
          border-radius: inherit;
          background: linear-gradient(90deg, #6B7EFF, #A78BFA, #6B7EFF);
          background-size: 200% 200%;
          animation: gradient-xy 3s ease infinite;
          z-index: -1;
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        .ai-border-glow:hover::before, .ai-border-glow.active::before {
          opacity: 1;
        }
        /* Utilities */
        .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}