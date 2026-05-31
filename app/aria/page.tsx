"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Cpu, Zap, Users, Radio, Target,
  Building2, User, MapPin, CheckCircle2,
  ExternalLink, Star, Copy, Send, Phone, MessageSquare,
  Loader2, Shield, Package, Wifi, AlertCircle,
  ChevronRight, TrendingUp, Globe, Clock, Download, Trash2, Check, Search, RefreshCw,
} from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { LayoutList, ArrowLeft, BarChart3, Edit2 } = require("lucide-react") as any;
// Silence "unused" warnings — kept for downstream visual refinements
void BarChart3; void Edit2;
import { cn } from "@/lib/utils";
import { TopBar } from "@/components/layout/TopBar";
import { supabase } from "@/lib/supabase";

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
  city?: string;
  state?: string;
  units: number;
  year_built: number;
  management_company: string;
  owner_entity: string;
  property_type: string;
  class: string;
  occupancy: string;
  phone?: string | null;
  isp_providers?: string[];
  video_providers?: string[];
  bulk_agreements?: BulkAgreement[];
  proptech?: PropTech;
  _fcc_verified?: boolean;
  _fcc_providers?: string[];
  lat?: number | null;
  lng?: number | null;
}

interface DecisionMaker {
  name: string;
  title: string;
  company: string;
  linkedin_slug: string;
  email: string;
  top_email_format: string;
  phone: string;
  phone_source?: 'direct' | 'office_main' | null;
  gatekeeper_tip?: string | null;
  tenure_years: number;
}

interface PainSignal {
  source: string;
  date: string;
  signal_type: string;
  quote: string;
  severity: "high" | "medium" | "low";
  url?: string;
}

interface OutreachMonth {
  theme: string;
  actions?: string[];
  goal?: string;
}

interface OutreachPlan {
  month_1?: OutreachMonth;
  month_2?: OutreachMonth;
  month_3?: OutreachMonth;
  month_4?: OutreachMonth;
  month_5?: OutreachMonth;
  month_6?: OutreachMonth;
  total_touches?: number;
  primary_channel?: string;
  key_milestone?: string;
  expected_close_quarter?: string;
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

interface ScoutQueue {
  property: { name: string; address: string; city: string; state: string; units: number; class: string; management_company: string; owner_entity: string; old_name: string | null };
  pain_angles: Array<{ type: string; quote: string; severity: string }>;
  connectivity: { isp_providers: string[]; bulk_detected: boolean; provider_confirmed: boolean; bulk_agreements: BulkAgreement[]; video_providers?: string[]; roe_detected?: boolean; roe_expiry_year?: number; contract_urgency?: string; contract_window?: string };
  proptech: { gate_operators: string[]; access_control: string[]; tech_generation: string; intercoms?: string[]; cameras?: string[]; smart_locks?: string[]; displacement_targets?: string[]; sara_signals?: boolean };
  contact_chain: DecisionMakerChainItem[];
  behavioral_profile?: Record<string, string>;
  pitch_strategy?: { primary_hook?: string; secondary_hooks?: string[]; avoid?: string[] };
  outreach_plan?: OutreachPlan;
  outreach_sequence?: Array<{ touch: number; channel: string; message: string; timing: string }>;
  market_context?: Record<string, string>;
  objection_flags?: Record<string, boolean>;
  key_finding?: string;
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
  phone_source?: 'direct' | 'office_main' | null;
  gatekeeper_tip?: string | null;
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
  scout_queue?: ScoutQueue;
  behavioral_profile?: Record<string, string>;
  pitch_strategy?: { primary_hook?: string; secondary_hooks?: string[]; avoid?: string[] };
  freshness_score?: number;
  buying_trends?: string;
  outreach_plan?: OutreachPlan;
}

interface SocialPost {
  platform: string;
  date: string;
  quote: string;
  tech_mentioned: string[];
  signal_type: string;
  severity: 'high' | 'medium' | 'low';
  url?: string;
  source?: 'social_search';
}

interface CrossRefNote {
  provider: string;
  note: string;
  confidence: 'high' | 'medium' | 'low';
  evidence_count: number;
  type: string;
}

interface SocialSearchResult {
  social_posts: SocialPost[];
  cross_reference_notes: CrossRefNote[];
  property_phone?: string | null;
}

interface ResearchResult {
  mode: string;
  query_interpretation: string;
  prospects: Prospect[];
  fccVerified?: boolean;
  webIntelligence?: boolean;
}

interface Candidate {
  name: string;
  address: string;
  city: string;
  state: string;
  units?: number;
  year_built?: number;
  property_class?: string;
  management_company?: string;
  isp_signal?: string;
  bulk_detected?: boolean;
  pain_brief?: string;
  buy_score_estimate?: number;
}

type ViewMode = 'idle' | 'running' | 'candidates' | 'result';

// ── Constants ─────────────────────────────────────────────────────────────────

const PHASES = [
  { id: 1, name: "Listing Sites",   icon: Building2, sources: ["apartments.com", "RentCafe", "Zillow"] },
  { id: 2, name: "Property Intel",  icon: MapPin,    sources: ["County Records", "FCC Broadband", "SEC EDGAR"] },
  { id: 3, name: "Contact Chain",   icon: Users,     sources: ["LinkedIn", "Apollo", "NinjaPear"] },
  { id: 4, name: "Signal Analysis", icon: Radio,     sources: ["Reddit", "Review Sites", "Pain Signals"] },
  { id: 5, name: "AI Synthesis",    icon: Cpu,       sources: ["Claude Sonnet", "SCOUT Handoff"] },
];

const PHASE_DURATIONS = [0, 4000, 5000, 5000, 4000];

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

// Fixed particle positions for the 2035 pipeline animation (no Math.random in render)
const PIPELINE_PARTICLES = [
  { x: 5,  y: 12, s: 1.5, d: 0    },
  { x: 18, y: 7,  s: 1,   d: 0.5  },
  { x: 29, y: 25, s: 2,   d: 1    },
  { x: 42, y: 15, s: 1,   d: 1.5  },
  { x: 55, y: 6,  s: 1.5, d: 0.3  },
  { x: 68, y: 20, s: 1,   d: 0.8  },
  { x: 79, y: 10, s: 2,   d: 1.2  },
  { x: 90, y: 28, s: 1.5, d: 0.2  },
  { x: 95, y: 8,  s: 1,   d: 0.9  },
  { x: 9,  y: 72, s: 1.5, d: 0.4  },
  { x: 22, y: 85, s: 1,   d: 0.7  },
  { x: 37, y: 65, s: 2,   d: 1.3  },
  { x: 50, y: 90, s: 1,   d: 0.6  },
  { x: 63, y: 75, s: 1.5, d: 1.1  },
  { x: 76, y: 60, s: 2,   d: 0.1  },
  { x: 84, y: 80, s: 1,   d: 0.95 },
  { x: 92, y: 70, s: 1.5, d: 1.4  },
  { x: 14, y: 50, s: 1,   d: 0.35 },
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

type DetailTab = 'property' | 'proptech' | 'dm' | 'intel' | 'social' | 'scout';

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
  const [mobileTab, setMobileTab]           = useState<'list' | 'property' | 'proptech' | 'dm' | 'scout'>('list');
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
  const [pendingRerun, setPendingRerun]     = useState(false);
  const [candidates, setCandidates]         = useState<Candidate[]>([]);
  const [queryInterpretation, setQueryInterpretation] = useState('');
  const [viewMode, setViewMode]             = useState<ViewMode>('idle');
  const [socialResults, setSocialResults]   = useState<SocialSearchResult | null>(null);
  const [socialLoading, setSocialLoading]   = useState(false);
  const [cacheStatus, setCacheStatus]       = useState<'fresh' | 'stale' | 're-enriching' | null>(null);
  const [cacheAgeHours, setCacheAgeHours]   = useState<number | null>(null);
  const [propertyId, setPropertyId]         = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Suppress unused warning — viewMode reserved for richer state tracking
  void viewMode;

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
    if (!query.trim() || (phase >= 1 && phase <= 5)) return;
    setError(null);
    setResults(null);
    setCandidates([]);
    setQueryInterpretation('');
    setSavedSearchId(null);
    setSelectedProspect(0);
    setActiveTab('property');
    setViewMode('running');
    setSocialResults(null);
    setSocialLoading(false);
    setCacheStatus(null);
    setCacheAgeHours(null);
    setPropertyId(null);

    // ── SWR fast-path: check Intel DB cache first ──────────────────────────
    try {
      const cacheRes = await fetch(`/api/aria/cache?query=${encodeURIComponent(query.trim())}`);
      if (cacheRes.ok) {
        const cacheData = await cacheRes.json();
        if (cacheData.hit && cacheData.prospects?.length > 0) {
          // Cache hit — show result instantly (<200ms)
          setResults({ mode: 'deep', query_interpretation: query.trim(), prospects: cacheData.prospects });
          setViewMode('result');
          setPhase(6);
          const ageHours: number = cacheData.cache_age_hours ?? 9999;
          setCacheAgeHours(ageHours);
          setPropertyId(cacheData.property_id ?? null);
          if (ageHours < 14 * 24) {
            setCacheStatus('fresh');
          } else {
            // Stale — show cached data, fire Inngest background re-enrichment
            setCacheStatus('stale');
            fetch('/api/aria/enrich', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query: query.trim() }),
            }).then(r => { if (r.ok) setCacheStatus('re-enriching'); }).catch(() => {});
          }
          if (cacheData.savedSearchId) setSavedSearchId(cacheData.savedSearchId);
          return;
        }
      }
    } catch { /* cache miss — fall through to full pipeline */ }

    // ── Full pipeline (cache miss) ─────────────────────────────────────────
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

      // Candidate response — show grid of properties to research
      if (data.type === 'candidates') {
        setCandidates(data.candidates ?? []);
        setQueryInterpretation(data.query_interpretation ?? '');
        setViewMode('candidates');
        setPhase(0);
        return;
      }

      setResults(data);
      setViewMode('result');
      setPhase(6);
      setCacheStatus('fresh');
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
      setViewMode('idle');
      setPhase(0);
    }
  }, [query, phase]);

  // Drill into a specific candidate from the candidate grid
  const searchCandidate = useCallback((c: Candidate) => {
    const q = `${c.name} ${c.city} ${c.state}`.trim();
    setQuery(q);
    setCandidates([]);
    setQueryInterpretation('');
    setViewMode('idle');
    setPhase(0);
    setPendingRerun(true);
  }, []);

  // Trigger re-run after state reset (used by "Fetch Latest Intel" in IntelDBPanel)
  useEffect(() => {
    if (pendingRerun && phase === 0) {
      setPendingRerun(false);
      runARIA();
    }
  }, [pendingRerun, phase, runARIA]);

  // Re-enriching: Supabase Realtime subscription — instant push when Inngest job completes
  useEffect(() => {
    if (cacheStatus !== 're-enriching' || !propertyId || !query) return;

    const snapshotAgeHours = cacheAgeHours;

    async function applyFreshResult() {
      try {
        const r = await fetch(`/api/aria/cache?query=${encodeURIComponent(query)}`);
        if (!r.ok) return;
        const d = await r.json();
        if (d.hit && d.prospects?.length > 0) {
          setResults({ mode: 'deep', query_interpretation: query, prospects: d.prospects });
          setCacheStatus('fresh');
          setCacheAgeHours(d.cache_age_hours ?? null);
        }
      } catch { /* ignore */ }
    }

    // Primary: Supabase Realtime — fires the instant the row is upserted by the deep route
    const channel = supabase
      .channel(`aria-prop-${propertyId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'aria_properties', filter: `id=eq.${propertyId}` },
        () => { void applyFreshResult(); }
      )
      .subscribe();

    // Fallback: light poll every 30s in case Realtime isn't enabled for this table
    const poll = setInterval(async () => {
      try {
        const r = await fetch(`/api/aria/cache?query=${encodeURIComponent(query)}`);
        if (!r.ok) return;
        const d = await r.json();
        if (d.hit && d.cache_age_hours !== null && (snapshotAgeHours === null || d.cache_age_hours < snapshotAgeHours - 0.5)) {
          void applyFreshResult();
          clearInterval(poll);
        }
      } catch { /* ignore */ }
    }, 30_000);

    // Stop both after 3 minutes
    const timeout = setTimeout(() => { clearInterval(poll); void supabase.removeChannel(channel); }, 180_000);

    return () => {
      void supabase.removeChannel(channel);
      clearInterval(poll);
      clearTimeout(timeout);
    };
  }, [cacheStatus, propertyId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Engine 2 — social search fires automatically once Engine 1 completes
  useEffect(() => {
    if (phase !== 6 || !results) return;
    const p = results.prospects?.[0];
    if (!p?.property?.name) return;
    const prop = p.property;
    // Derive city/state: prefer explicit fields → scout_queue → parse from address
    const sq = p.scout_queue;
    const city  = prop.city  || sq?.property?.city  || prop.address?.split(',').slice(-3,-2)[0]?.trim() || '';
    const state = prop.state || sq?.property?.state || prop.address?.split(',').slice(-2,-1)[0]?.trim() || '';
    if (!city) return; // need at least city for social search to be meaningful
    setSocialResults(null);
    setSocialLoading(true);
    fetch('/api/aria/social', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        property_name:      prop.name,
        city,
        state,
        management_company: prop.management_company ?? '',
        isp_providers:      prop.isp_providers      ?? [],
        video_providers:    prop.video_providers     ?? [],
        bulk_agreements:    prop.bulk_agreements     ?? [],
        gate_operators:     prop.proptech?.gate_operators  ?? [],
        access_control:     prop.proptech?.access_control  ?? [],
      }),
    })
      .then(r => r.ok ? r.json() : { social_posts: [], cross_reference_notes: [] })
      .then(d => setSocialResults(d))
      .catch(() => setSocialResults({ social_posts: [], cross_reference_notes: [] }))
      .finally(() => setSocialLoading(false));
  }, [phase, results]);

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
    setCandidates([]);
    setQueryInterpretation('');
    setViewMode('result');
    setPhase(6);
    setSavedSearchId(s.id);
    setSelectedProspect(0);
    setActiveTab('property');
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
      {/* Cache freshness badge */}
      {cacheStatus === 'fresh' && cacheAgeHours !== null && isDone && (
        <div className="hidden lg:flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/60">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
          {cacheAgeHours < 1 ? 'Just fetched' : cacheAgeHours < 24 ? `Cached · ${Math.floor(cacheAgeHours)}h ago` : `Cached · ${Math.floor(cacheAgeHours / 24)}d ago`}
        </div>
      )}
      {cacheStatus === 'stale' && cacheAgeHours !== null && isDone && (
        <div className="hidden lg:flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200/60">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
          Stale · {Math.floor(cacheAgeHours / 24)}d ago
        </div>
      )}
      {cacheStatus === 're-enriching' && isDone && (
        <div className="hidden lg:flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-lg text-[#6B7EFF] border border-[#6B7EFF]/20" style={{ background: 'rgba(107,126,255,0.05)' }}>
          <Loader2 size={9} className="animate-spin shrink-0" />
          Re-enriching...
        </div>
      )}
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
            onClick={() => { setQuery(s.query); setPhase(0); setResults(null); setSavedSearchId(null); setPendingRerun(true); }}
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
              <p className="text-xs text-slate-400 mt-0.5 font-medium">{p.property?.address?.split(',').slice(-2).join(',').trim()}</p>
            </div>
            
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-2xl p-2 pr-4 shadow-sm">
                 <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-mono font-bold shadow-inner" style={scoreBg(score)}>
                    {score}
                 </div>
                 <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Buy Score</span>
                    <span className="text-xs font-bold text-slate-800 capitalize">{p.profile?.urgency || 'medium'} Urgency</span>
                 </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 pb-0">
          <div className="flex gap-2 mb-[-1px]">
            {([
              { key: 'property', label: 'Property' },
              { key: 'proptech', label: 'PropTech', badge: [p.property?.proptech?.gate_operators, p.property?.proptech?.access_control, p.property?.proptech?.cameras, p.property?.proptech?.intercoms].filter(a => a?.length).length || null },
              { key: 'dm',       label: 'Decision Matrix' },
              { key: 'intel',    label: 'AI Intel', badge: p.pain_signals?.length > 0 ? p.pain_signals.length : null },
              { key: 'social',   label: 'Community', badge: ((p.pain_signals?.length ?? 0) + (socialResults?.social_posts?.length ?? 0)) || null },
              { key: 'scout',    label: 'SCOUT', greenBadge: true },
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
                <span className={`font-bold capitalize ${val != null && val !== '' && val !== 'null' ? 'text-slate-800' : 'text-slate-300'}`}>
                  {val != null && val !== '' && val !== 'null' ? String(val) : '—'}
                </span>
              </div>
            ))}
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Management</p>
                <p className="text-xs font-bold text-slate-700 mt-1">{p.property?.management_company || '—'}</p>
              </div>
              {p.property?.phone && (
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Leasing Office Phone</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Phone size={11} className="text-emerald-500 shrink-0" />
                    <a href={`tel:${p.property.phone}`} className="text-xs font-bold text-emerald-700 hover:underline">{p.property.phone}</a>
                    <button onClick={() => navigator.clipboard.writeText(p.property?.phone ?? '')} className="ml-1 text-slate-400 hover:text-[#6B7EFF] transition-colors">
                      <Copy size={10} />
                    </button>
                  </div>
                </div>
              )}
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Owner entity</p>
                <p className="text-[11px] text-slate-500 mt-1">{p.property?.owner_entity || '—'}</p>
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

        <div className="col-span-2 flex items-center gap-2 p-3 rounded-xl border border-[#6B7EFF]/20 bg-[#6B7EFF]/5 cursor-pointer hover:bg-[#6B7EFF]/10 transition-colors"
          onClick={() => setActiveTab('proptech')}>
          <Package size={14} className="text-[#6B7EFF]" />
          <span className="text-xs font-bold text-[#6B7EFF]">View PropTech Architecture →</span>
          {p.property?.proptech?.sara_signals && (
            <span className="ml-auto text-[9px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-600 border border-purple-100">🎯 SARA Opportunity</span>
          )}
        </div>

        {/* ── Location + Street View ─────────────────────────────────────────── */}
        {p.property?.address && (
          <div className="col-span-2 bg-white/80 rounded-2xl border border-slate-200/60 overflow-hidden shadow-sm">
            <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-slate-100">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Location</p>
                <p className="text-sm font-bold text-slate-800 mt-0.5 flex items-center gap-1.5">
                  <MapPin size={12} className="text-[#6B7EFF] shrink-0" />
                  {p.property.address}
                </p>
              </div>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.property.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-bold text-[#6B7EFF] hover:underline flex items-center gap-1 shrink-0"
              >
                Open in Maps ↗
              </a>
            </div>
            {/* Google Maps embed — supports click-to-street-view */}
            <div className="w-full h-64 relative">
              <iframe
                title="Property Location"
                width="100%"
                height="100%"
                style={{ border: 0, display: 'block' }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src={`https://maps.google.com/maps?q=${encodeURIComponent(p.property.address)}&output=embed&z=17`}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── DM tab ────────────────────────────────────────────────────────────────
  function DMTab({ p }: { p: Prospect }) {
    const [crmImporting, setCrmImporting] = useState(false);
    const [crmImported, setCrmImported] = useState(false);

    async function importToCRM() {
      if (!savedSearchId || crmImporting) return;
      setCrmImporting(true);
      try {
        const r = await fetch(`/api/aria/searches/${savedSearchId}/import`, { method: 'POST' });
        const d = await r.json();
        if (!d.error) {
          setCrmImported(true);
          setImportResult(prev => ({ ...prev, [savedSearchId]: { created: d.created, skipped: d.skipped } }));
        }
      } catch { /* fail silently */ } finally {
        setCrmImporting(false);
      }
    }

    const roleMeta: Record<string, { label: string; bg: string; text: string; border: string }> = {
      owner:            { label: 'Owner / PE',     bg: 'bg-purple-50/80', text: 'text-purple-700', border: 'border-purple-200/60' },
      asset_manager:    { label: 'Asset Manager',  bg: 'bg-[#6B7EFF]/5', text: 'text-[#6B7EFF]', border: 'border-[#6B7EFF]/20' },
      regional_manager: { label: 'Regional VP',    bg: 'bg-emerald-50/80', text: 'text-emerald-700', border: 'border-emerald-200/60' },
      property_manager: { label: 'Property Mgr',  bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200/60' },
      unknown:          { label: 'Contact',        bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200/60' },
    };

    // Separate chain into property-level (pm, regional) vs ownership-level (owner, asset)
    const chain = p.decision_maker_chain ?? [];
    const propertyLevelRoles = ['property_manager', 'regional_manager', 'unknown'];
    const ownershipLevelRoles = ['owner', 'asset_manager'];
    const propertyContacts = chain.filter(c => propertyLevelRoles.includes(c.role_type));
    const ownershipContacts = chain.filter(c => ownershipLevelRoles.includes(c.role_type));

    const ContactCard = ({ dm, idx }: { dm: DecisionMakerChainItem; idx: number }) => {
      const meta = roleMeta[dm.role_type] ?? roleMeta.unknown;
      return (
        <div className={cn("rounded-xl border p-4 bg-white shadow-sm transition-all hover:shadow-md", meta.border)}>
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
          {(dm.top_email_format || dm.email || dm.phone) && (
            <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
              {(dm.top_email_format || dm.email) && (
                <p className="font-mono text-[10px] text-slate-600 bg-slate-50 px-2 py-1 rounded w-fit border border-slate-100">{dm.top_email_format || dm.email}</p>
              )}
              {dm.phone && (
                <div className="group relative">
                  <div className="flex items-center gap-1.5">
                    <Phone size={11} className={dm.phone_source === 'office_main' ? 'text-amber-400 shrink-0' : 'text-emerald-500 shrink-0'} />
                    <span className={`font-mono text-[10px] font-bold ${dm.phone_source === 'office_main' ? 'text-amber-700' : 'text-slate-700'}`}>{dm.phone}</span>
                    {dm.phone_source === 'office_main' && (
                      <span className="text-[8px] font-bold uppercase text-amber-600 bg-amber-50 border border-amber-200/60 px-1.5 py-0.5 rounded">
                        Office · Ask for {dm.name?.split(' ')[0]}
                      </span>
                    )}
                  </div>
                  {/* Gatekeeper tip tooltip */}
                  {dm.gatekeeper_tip && (
                    <div className="hidden group-hover:block absolute z-50 left-0 bottom-full mb-2 w-72 bg-slate-900 text-white text-[10px] leading-relaxed rounded-xl p-3 shadow-xl border border-slate-700/60">
                      <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">📞 Gatekeeper Strategy</p>
                      <p className="text-slate-200">{dm.gatekeeper_tip}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {dm.dm_hooks && dm.dm_hooks.length > 0 && dm.dm_hooks[0] !== 'no recent social activity found' && (
            <div className="mt-3 space-y-1.5 bg-slate-50/50 p-3 rounded-lg border border-slate-100">
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">AI Hooks ({dm.dm_hooks.length})</p>
              {(dm.dm_hooks || []).map((hook, hi) => (
                <p key={hi} className="text-[10px] text-slate-600 leading-relaxed font-medium">
                  <span className={cn("font-bold mr-1.5", meta.text)}>↳</span>{hook}
                </p>
              ))}
            </div>
          )}
          {dm.notes && (
            <div className="mt-2 px-3 py-2 rounded-lg bg-amber-50/30 border border-amber-100">
              <p className="text-[10px] text-amber-800 italic leading-relaxed">{dm.notes}</p>
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
    };

    return (
      <div className="space-y-5 max-w-4xl animate-in fade-in slide-in-from-bottom-2 duration-500">

        {/* Primary contact card + CRM import */}
        <div className="bg-white/80 rounded-2xl border border-slate-200/60 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Primary Contact</p>
            {savedSearchId && !crmImported && !importResult[savedSearchId] && (
              <button onClick={importToCRM} disabled={crmImporting}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-white font-bold disabled:opacity-60 shadow-sm transition-all hover:opacity-90"
                style={{ background: '#6B7EFF' }}>
                {crmImporting ? <Loader2 size={11} className="animate-spin" /> : <><Download size={11} /> Import to CRM</>}
              </button>
            )}
            {(crmImported || importResult[savedSearchId ?? '']?.created >= 0) && (
              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                <CheckCircle2 size={12} /> Added to CRM
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 mb-5">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-sm"
              style={{ background: "linear-gradient(135deg, #6B7EFF 0%, #3B4FCC 100%)" }}>
              {getInitials(p.decision_maker?.name)}
            </div>
            <div>
              <p className="text-base font-bold text-slate-900 tracking-tight">{p.decision_maker?.name || '—'}</p>
              <p className="text-xs font-medium text-slate-500 mt-0.5">{p.decision_maker?.title || 'Contact pending'}</p>
              <p className="text-[11px] text-slate-400">{p.decision_maker?.company || p.property?.management_company || '—'}</p>
            </div>
          </div>
          <div className="space-y-3 text-xs border-t border-slate-100 pt-4 bg-slate-50/50 -mx-5 px-5 -mb-5 pb-5 rounded-b-2xl">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Verified Email Route</p>
              <p className="font-mono text-slate-800 text-[11px] break-all bg-white px-2 py-1 rounded border border-slate-200/60 w-fit shadow-sm">
                {p.decision_maker?.top_email_format || p.decision_maker?.email || 'N/A'}
              </p>
            </div>
            <div className="group relative">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">
                  {p.decision_maker?.phone_source === 'office_main' ? (
                    <span className="flex items-center gap-1">
                      <span>📞</span>
                      <span>Office Main Line</span>
                      <span className="text-[9px] text-amber-500 font-bold">(Ask for {p.decision_maker?.name?.split(' ')[0]})</span>
                    </span>
                  ) : 'Direct Line'}
                </span>
                <span className={`font-mono font-bold text-xs ${p.decision_maker?.phone_source === 'office_main' ? 'text-amber-700' : 'text-slate-700'}`}>
                  {p.decision_maker?.phone || 'N/A'}
                </span>
              </div>
              {/* Gatekeeper tip — visible on hover when phone is office line */}
              {p.decision_maker?.gatekeeper_tip && (
                <div className="hidden group-hover:block absolute z-50 right-0 top-full mt-2 w-80 bg-slate-900 text-white text-[10px] leading-relaxed rounded-xl p-3 shadow-xl border border-slate-700/60">
                  <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">📞 Gatekeeper Strategy</p>
                  <p className="text-slate-200">{p.decision_maker.gatekeeper_tip}</p>
                </div>
              )}
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

        {/* Property-Level Contacts */}
        {propertyContacts.length > 0 && (
          <div className="bg-white/80 rounded-2xl border border-slate-200/60 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Property Level</p>
              <span className="text-[9px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md ml-auto">{propertyContacts.length} contacts</span>
            </div>
            <p className="text-[10px] text-slate-400 mb-3 font-medium">On-site management: property managers, regional VPs — your primary outreach targets</p>
            <div className="space-y-3">
              {propertyContacts.map((dm, idx) => <ContactCard key={idx} dm={dm} idx={idx} />)}
            </div>
          </div>
        )}

        {/* Ownership-Level Contacts */}
        {ownershipContacts.length > 0 && (
          <div className="bg-white/80 rounded-2xl border border-slate-200/60 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-purple-400" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Ownership Level</p>
              <span className="text-[9px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md ml-auto">{ownershipContacts.length} contacts</span>
            </div>
            <p className="text-[10px] text-slate-400 mb-3 font-medium">
              {p.ownership?.owner_entity && <span className="font-bold text-slate-600">{p.ownership.owner_entity}</span>}
              {p.ownership?.portfolio_size && <span> · {p.ownership.portfolio_size} portfolio</span>}
              {' '}— asset managers, PE principals, key budget decision makers
            </p>
            <div className="space-y-3">
              {ownershipContacts.map((dm, idx) => <ContactCard key={idx} dm={dm} idx={idx} />)}
            </div>
          </div>
        )}

        {/* Fallback: show all if not separated */}
        {propertyContacts.length === 0 && ownershipContacts.length === 0 && chain.length > 0 && (
          <div className="bg-white/80 rounded-2xl border border-slate-200/60 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Corporate Hierarchy</p>
              <span className="ml-auto text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">{chain.length} Nodes</span>
            </div>
            <div className="space-y-3">
              {chain.map((dm, idx) => <ContactCard key={idx} dm={dm} idx={idx} />)}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── PropTech Architecture tab ─────────────────────────────────────────────
  function PropTechTab({ p }: { p: Prospect }) {
    const pt = p.property?.proptech ?? {};
    const agreements = p.property?.bulk_agreements ?? [];
    const videoAgreements = agreements.filter((a: BulkAgreement) => a.service_type === 'video' || a.service_type === 'bundled');
    const internetAgreements = agreements.filter((a: BulkAgreement) => a.service_type === 'internet' || a.service_type === 'bundled');

    const AgreementCard = ({ a }: { a: BulkAgreement }) => (
      <div className={cn("rounded-xl border p-4 shadow-sm",
        a.agreement_type === 'exclusive' ? 'bg-amber-50/30 border-amber-200/60' :
        a.agreement_type === 'bulk' ? 'bg-emerald-50/30 border-emerald-200/60' : 'bg-slate-50 border-slate-200/60'
      )}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-slate-900">{a.provider}</span>
          <div className="flex items-center gap-2">
            <span className={cn("text-[9px] font-bold uppercase px-2 py-0.5 rounded-md",
              a.confidence === 'confirmed' ? 'bg-emerald-100 text-emerald-700' :
              a.confidence === 'high' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'
            )}>{a.confidence}</span>
            <span className={cn("text-[9px] font-bold uppercase px-2 py-0.5 rounded-md",
              a.agreement_type === 'exclusive' ? 'bg-amber-100 text-amber-700' :
              a.agreement_type === 'bulk' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
            )}>{a.agreement_type}</span>
          </div>
        </div>
        {a.expiry_estimate && a.expiry_estimate !== 'unknown' && (
          <div className="flex items-center gap-1.5 mt-1">
            <Clock size={12} className="text-amber-500" />
            <span className="text-xs font-bold text-amber-700">Est. expiry: {a.expiry_estimate}</span>
          </div>
        )}
        {a.source_snippet && (
          <p className="text-[10px] text-slate-500 mt-2 leading-relaxed italic border-t border-slate-100 pt-2">&ldquo;{a.source_snippet.slice(0, 120)}...&rdquo;</p>
        )}
      </div>
    );

    const TechCategory = ({ label, emoji, items, chipClass }: { label: string; emoji: string; items?: string[]; chipClass: string }) => {
      if (!items?.length) return null;
      return (
        <div className="space-y-2">
          <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">{emoji} {label}</p>
          <div className="flex flex-wrap gap-2">
            {items.map(item => (
              <span key={item} className={cn("text-[11px] px-3 py-1.5 rounded-lg font-bold border shadow-sm", chipClass)}>{item}</span>
            ))}
          </div>
        </div>
      );
    };

    const hasVideoAgreements = videoAgreements.length > 0;
    const hasInternetAgreements = internetAgreements.length > 0;
    const hasTechStack = [pt.gate_operators, pt.access_control, pt.intercoms, pt.cameras, pt.smart_locks, pt.resident_apps, pt.package_solutions].some(a => a?.length);
    const hasDisplacementTargets = (pt.displacement_targets?.length ?? 0) > 0;
    const noData = !hasVideoAgreements && !hasInternetAgreements && !hasTechStack;

    if (noData) return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
        <Package size={32} className="opacity-20" />
        <p className="text-sm font-medium">No PropTech data found for this property</p>
        <p className="text-xs text-slate-400">Run a deeper search or check Intel tab for signals</p>
      </div>
    );

    return (
      <div className="space-y-6 max-w-5xl animate-in fade-in slide-in-from-bottom-2 duration-500">

        {/* Video Agreements */}
        {(hasVideoAgreements || p.property?.video_providers?.length) && (
          <div className="bg-white/80 rounded-2xl border border-slate-200/60 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Globe size={15} className="text-violet-500" />
              <p className="text-xs font-bold uppercase tracking-widest text-slate-700">Video Agreements</p>
              {hasVideoAgreements && <span className="ml-auto text-[10px] font-mono bg-violet-50 text-violet-600 border border-violet-100 px-2 py-0.5 rounded-md">{videoAgreements.length} detected</span>}
            </div>
            {hasVideoAgreements ? (
              <div className="space-y-3">
                {videoAgreements.map((a, i) => <AgreementCard key={i} a={a} />)}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(p.property?.video_providers || []).map(v => (
                  <span key={v} className="text-[11px] px-3 py-1.5 rounded-lg font-bold border bg-violet-50/80 text-violet-700 border-violet-200/60 shadow-sm">{v}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Internet Agreements */}
        {(hasInternetAgreements || p.property?.isp_providers?.length) && (
          <div className="bg-white/80 rounded-2xl border border-slate-200/60 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Wifi size={15} className="text-emerald-500" />
              <p className="text-xs font-bold uppercase tracking-widest text-slate-700">Internet Agreements</p>
              <div className="flex items-center gap-2 ml-auto">
                {p.property?._fcc_verified
                  ? <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-100 text-emerald-600">FCC Verified</span>
                  : <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-amber-50 border border-amber-100 text-amber-600">AI Estimated</span>}
                {hasInternetAgreements && <span className="text-[10px] font-mono bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-0.5 rounded-md">{internetAgreements.length} detected</span>}
              </div>
            </div>
            {hasInternetAgreements ? (
              <div className="space-y-3">
                {internetAgreements.map((a, i) => <AgreementCard key={i} a={a} />)}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(p.property?.isp_providers || []).map(v => (
                  <span key={v} className={cn("text-[11px] px-3 py-1.5 rounded-lg font-bold border shadow-sm",
                    p.property?._fcc_verified ? "bg-emerald-50/80 text-emerald-700 border-emerald-200/60" : "bg-blue-50/80 text-blue-700 border-blue-200/60"
                  )}>{v}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Gates & Access Control */}
        {(pt.gate_operators?.length || pt.access_control?.length || pt.intercoms?.length) && (
          <div className="bg-white/80 rounded-2xl border border-slate-200/60 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Shield size={15} className="text-orange-500" />
              <p className="text-xs font-bold uppercase tracking-widest text-slate-700">Gates &amp; Access Control</p>
              {pt.tech_generation && (
                <span className={cn("ml-auto text-[9px] font-bold px-2 py-0.5 rounded-md capitalize",
                  pt.tech_generation === 'legacy' ? 'bg-rose-50 text-rose-600 border border-rose-100' :
                  pt.tech_generation === 'modern' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                                                    'bg-amber-50 text-amber-600 border border-amber-100'
                )}>{pt.tech_generation} Generation</span>
              )}
            </div>
            <div className="space-y-4">
              <TechCategory label="Gate Operators" emoji="🚧" items={pt.gate_operators} chipClass="bg-orange-50/80 text-orange-700 border-orange-200/60" />
              <TechCategory label="Access Control" emoji="🔑" items={pt.access_control} chipClass="bg-blue-50/80 text-blue-700 border-blue-200/60" />
              <TechCategory label="Intercoms" emoji="📟" items={pt.intercoms} chipClass="bg-violet-50/80 text-violet-700 border-violet-200/60" />
            </div>
            {pt.replacement_window && (
              <div className="mt-4 rounded-xl px-4 py-3 bg-amber-50/50 border border-amber-200/60 flex items-start gap-2">
                <Clock size={13} className="text-amber-500 mt-0.5" />
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-amber-700/80 mb-0.5">Estimated Replacement Window</p>
                  <p className="text-xs font-medium text-amber-900">{pt.replacement_window}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Cameras & Security */}
        {pt.cameras?.length && (
          <div className="bg-white/80 rounded-2xl border border-slate-200/60 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Radio size={15} className="text-slate-500" />
              <p className="text-xs font-bold uppercase tracking-widest text-slate-700">Cameras &amp; Security</p>
            </div>
            <TechCategory label="Camera Systems" emoji="📷" items={pt.cameras} chipClass="bg-slate-50/80 text-slate-700 border-slate-200/60" />
          </div>
        )}

        {/* SmartRent & other tech */}
        {(pt.smart_locks?.length || pt.resident_apps?.length || pt.package_solutions?.length) && (
          <div className="bg-white/80 rounded-2xl border border-slate-200/60 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Package size={15} className="text-indigo-500" />
              <p className="text-xs font-bold uppercase tracking-widest text-slate-700">SmartRent &amp; Other Tech</p>
              {(pt.resident_apps?.some((a: string) => a.toLowerCase().includes('smartrent')) || pt.smart_locks?.some((a: string) => a.toLowerCase().includes('smartrent'))) && (
                <span className="ml-auto text-[9px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600 border border-indigo-100">SmartRent Detected</span>
              )}
            </div>
            <div className="space-y-4">
              <TechCategory label="Smart Locks" emoji="🔒" items={pt.smart_locks} chipClass="bg-emerald-50/80 text-emerald-700 border-emerald-200/60" />
              <TechCategory label="Resident App" emoji="📱" items={pt.resident_apps} chipClass="bg-indigo-50/80 text-indigo-700 border-indigo-200/60" />
              <TechCategory label="Package Solutions" emoji="📦" items={pt.package_solutions} chipClass="bg-amber-50/80 text-amber-700 border-amber-200/60" />
            </div>
          </div>
        )}

        {/* AI Recommendations */}
        {(hasDisplacementTargets || p.pitch_strategy || pt.sara_signals) && (
          <div className="bg-white rounded-2xl border border-[#6B7EFF]/20 p-5 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#6B7EFF] to-[#A78BFA]" />
            <div className="flex items-center gap-2 mb-4">
              <Zap size={15} className="text-[#6B7EFF]" />
              <p className="text-xs font-bold uppercase tracking-widest text-[#6B7EFF]">AI Recommendations</p>
              {pt.sara_signals && <span className="ml-auto text-[9px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-600 border border-purple-100">🎯 SARA Opportunity</span>}
            </div>

            {hasDisplacementTargets && (
              <div className="mb-4">
                <p className="text-[10px] font-bold text-slate-500 mb-2 flex items-center gap-1.5"><Target size={11} className="text-rose-500" /> GateGuard Displacement Targets</p>
                <div className="flex flex-wrap gap-2">
                  {(pt.displacement_targets || []).map((t: string) => (
                    <span key={t} className="text-[11px] px-3 py-1.5 rounded-lg font-bold bg-white text-rose-600 border border-rose-200 shadow-sm">{t}</span>
                  ))}
                </div>
              </div>
            )}

            {p.pitch_strategy?.primary_hook && (
              <div className="rounded-xl bg-amber-50/50 border border-amber-200/60 px-4 py-3 mb-3">
                <p className="text-[9px] font-bold uppercase tracking-widest text-amber-700/80 mb-1.5">Recommended Opening Hook</p>
                <p className="text-sm text-amber-900 leading-relaxed font-medium italic">&ldquo;{p.pitch_strategy.primary_hook}&rdquo;</p>
              </div>
            )}

            {p.pitch_strategy?.secondary_hooks && p.pitch_strategy.secondary_hooks.length > 0 && (
              <div className="space-y-2">
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Secondary Angles</p>
                {p.pitch_strategy.secondary_hooks.slice(0, 3).map((hook, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-xs text-slate-600">
                    <span className="font-mono font-bold text-[#6B7EFF] mt-0.5 shrink-0">[{i+2}]</span>
                    <span className="font-medium leading-relaxed">{hook}</span>
                  </div>
                ))}
              </div>
            )}

            {p.pitch_strategy?.avoid && p.pitch_strategy.avoid.length > 0 && (
              <div className="mt-4 pt-3 border-t border-slate-100">
                <p className="text-[9px] font-bold uppercase tracking-widest text-rose-500 mb-2">Avoid Mentioning</p>
                <div className="flex flex-wrap gap-1.5">
                  {p.pitch_strategy.avoid.map((a, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-md bg-rose-50 text-rose-600 border border-rose-100 font-medium">{a}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Social evidence footnotes from Engine 2 cross-reference */}
            {(socialResults?.cross_reference_notes?.length ?? 0) > 0 && (
              <div className="mt-4 pt-3 border-t border-slate-100">
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#6B7EFF] mb-2 flex items-center gap-1">
                  <Globe size={9} /> Social Evidence
                </p>
                <div className="space-y-1.5">
                  {(socialResults!.cross_reference_notes).map((n, i) => (
                    <div key={i} className="flex items-start gap-2 text-[10px] text-slate-600">
                      <span className={cn("shrink-0 mt-0.5 font-bold px-1.5 py-0.5 rounded text-[9px] border",
                        n.type === 'confirmation'  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        n.type === 'contradiction' ? 'bg-red-50 text-red-700 border-red-200' :
                        n.type === 'new_finding'   ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                     'bg-slate-100 text-slate-600 border-slate-200'
                      )}>{n.provider}</span>
                      <span className="font-medium leading-relaxed">{n.note}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Intel tab ─────────────────────────────────────────────────────────────
  function IntelTab({ p }: { p: Prospect }) {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 12);
    const recentSignals = (p.pain_signals || []).filter(sig => {
      if (!sig.date || sig.date === 'unknown') return true;
      const d = new Date(sig.date);
      return isNaN(d.getTime()) || d >= cutoff;
    });
    const olderSignals = (p.pain_signals || []).filter(sig => {
      if (!sig.date || sig.date === 'unknown') return false;
      const d = new Date(sig.date);
      return !isNaN(d.getTime()) && d < cutoff;
    });
    const [showOlder, setShowOlder] = useState(false);
    const filteredSignals = showOlder ? [...recentSignals, ...olderSignals] : recentSignals;
    const totalSignals = p.pain_signals?.length ?? 0;
    const hiddenCount = olderSignals.length;

    return (
      <div className="space-y-6 max-w-4xl animate-in fade-in slide-in-from-bottom-2 duration-500">

        {/* AI Synthesis Block */}
        <div className="ai-border-glow active bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-5">
            <Cpu size={16} className="text-[#A78BFA]" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#A78BFA]">ARIA Synthesis</h3>
            {p.freshness_score != null && (
              <span className="ml-auto text-[10px] font-mono bg-[#6B7EFF]/10 text-[#6B7EFF] border border-[#6B7EFF]/20 px-2 py-0.5 rounded-md">
                Freshness {p.freshness_score}/10
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-6">
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Target size={12}/> Primary Vulnerability</p>
              <p className="text-sm text-slate-800 leading-relaxed font-medium">{p.profile?.primary_concern || 'None detected'}</p>
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Clock size={12}/> Contract Window</p>
              <p className={`text-sm leading-relaxed font-medium ${p.profile?.contract_window ? 'text-slate-800' : 'text-slate-300'}`}>
                {p.profile?.contract_window || 'Not detected'}
              </p>
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Globe size={12}/> Incumbent Vendor</p>
              <p className={`text-sm leading-relaxed font-medium ${p.profile?.current_vendor ? 'text-slate-800' : 'text-slate-300'}`}>
                {p.profile?.current_vendor || 'Not detected'}
              </p>
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Users size={12}/> Comm Style</p>
              <p className="text-sm text-slate-800 leading-relaxed font-medium capitalize">{p.profile?.communication_style?.replace(/-/g, " ") || 'Email'}</p>
            </div>

            {p.buying_trends && (
              <div className="col-span-2 space-y-1.5 pt-2 border-t border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><TrendingUp size={12}/> Buying Trends</p>
                <p className="text-sm text-slate-700 leading-relaxed font-medium">{p.buying_trends}</p>
              </div>
            )}

            {p.behavioral_profile && Object.keys(p.behavioral_profile).length > 0 && (
              <div className="col-span-2 space-y-2 pt-2 border-t border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Users size={12}/> Behavioral Profile</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  {Object.entries(p.behavioral_profile).map(([key, val]) => (
                    <div key={key}>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">{key.replace(/_/g, ' ')}</p>
                      <p className="text-xs font-medium text-slate-700 leading-relaxed">{String(val)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Intent Signals / Anomalies — last 12 months, max 12 */}
        <div>
          <div className="flex items-center justify-between mb-4 px-1">
            <div className="flex items-center gap-2">
              <Radio size={16} className="text-rose-500" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-700">Intent Signals</h3>
              <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">Last 12 months</span>
            </div>
            <div className="flex items-center gap-2">
              {hiddenCount > 0 && (
                <button onClick={() => setShowOlder(v => !v)}
                  className="text-[10px] font-bold text-[#6B7EFF] hover:text-[#3B4FCC] transition-colors underline underline-offset-2">
                  {showOlder ? 'Hide older' : `+${hiddenCount} older`}
                </button>
              )}
              <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
                {filteredSignals.length} total
              </span>
            </div>
          </div>

          {filteredSignals.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <Radio size={24} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">No recent signals detected in the last 12 months</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSignals.map((sig, i) => {
                const Icon = SIGNAL_ICONS[sig.signal_type] || AlertCircle;
                const sev = SIGNAL_SEVERITY[sig.severity] ?? SIGNAL_SEVERITY.low;
                return (
                  <div key={i} className={cn("rounded-xl border bg-white shadow-sm p-4 relative overflow-hidden group", sev.border)}>
                    <div className={cn("absolute left-0 top-0 bottom-0 w-1", sev.bg)} />
                    <div className="flex items-start gap-4">
                      <div className={cn("p-2 rounded-lg bg-slate-50 border", sev.text, sev.border.replace('200', '100'))}>
                         <Icon size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className={cn("text-[10px] font-bold uppercase tracking-wider", sev.text)}>{displaySource(sig.source)}</span>
                          <span className="text-[10px] font-mono text-slate-400">• {sig.date}</span>
                          <span className={cn("ml-auto text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider shadow-sm border", sev.badge, sev.border.replace('200','100'))}>{sig.severity} Alert</span>
                        </div>
                        <p className="text-sm text-slate-700 leading-relaxed font-medium">&ldquo;{sig.quote}&rdquo;</p>
                        {sig.url && (
                          <a href={sig.url} target="_blank" rel="noopener noreferrer"
                            className="mt-1.5 inline-flex items-center gap-1 text-[9px] font-mono text-slate-400 hover:text-[#6B7EFF] transition-colors truncate max-w-xs">
                            <ExternalLink size={9} className="shrink-0" />
                            {sig.url.replace(/^https?:\/\//, '').split('/').slice(0,2).join('/')}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function isSocialSource(sig: PainSignal): boolean {
    const src = (sig.source || '').toLowerCase();
    const url = (sig.url  || '').toLowerCase();
    return ['social','reddit','review','google','yelp','facebook','twitter','x.com','listing-site','listing','apartment','rentcafe','rent.com','apartmentlist'].some(k => src.includes(k) || url.includes(k));
  }

  function getPlatformMeta(sig: PainSignal): { name: string; bg: string; text: string; border: string } {
    const url = (sig.url  || '').toLowerCase();
    const src = (sig.source || '').toLowerCase();
    if (url.includes('reddit')     || src.includes('reddit'))     return { name: 'Reddit',         bg: 'bg-orange-50',  text: 'text-orange-700', border: 'border-orange-200/60' };
    if (url.includes('google')     || src.includes('google'))     return { name: 'Google Reviews',  bg: 'bg-blue-50',    text: 'text-blue-700',   border: 'border-blue-200/60'   };
    if (url.includes('yelp')       || src.includes('yelp'))       return { name: 'Yelp',            bg: 'bg-rose-50',    text: 'text-rose-700',   border: 'border-rose-200/60'   };
    if (url.includes('facebook')   || src.includes('facebook'))   return { name: 'Facebook',        bg: 'bg-indigo-50',  text: 'text-indigo-700', border: 'border-indigo-200/60' };
    if (url.includes('twitter')    || url.includes('x.com') || src.includes('twitter')) return { name: 'Twitter/X', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200/60' };
    if (url.includes('apartments') || src.includes('listing'))    return { name: 'Apartments.com',  bg: 'bg-red-50',     text: 'text-red-700',    border: 'border-red-200/60'    };
    if (url.includes('rentcafe')   || url.includes('rent.com') || url.includes('apartmentlist')) return { name: 'Listing Site', bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200/60' };
    return { name: 'Resident Review', bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200/60' };
  }

  const TECH_SIGNAL_TYPES = new Set(['internet_complaint', 'access_complaint', 'gate_complaint', 'tech_complaint', 'wifi_complaint', 'intercom_complaint', 'lock_complaint', 'package_complaint', 'camera_complaint', 'fob_complaint']);
  const TECH_KEYWORDS = ['gate', 'fob', 'access', 'intercom', 'internet', 'wifi', 'wi-fi', 'smart lock', 'package locker', 'camera', 'buzzer', 'key card', 'app', 'entry', 'callbox', 'call box', 'liftmaster', 'doorking', 'linear', 'aiphone'];

  function isTechSignal(sig: PainSignal): boolean {
    if (TECH_SIGNAL_TYPES.has(sig.signal_type)) return true;
    const q = (sig.quote || '').toLowerCase();
    return TECH_KEYWORDS.some(k => q.includes(k));
  }

  // ── Community tab ─────────────────────────────────────────────────────────
  function SocialTab({ p }: { p: Prospect }) {
    const [expandedE2, setExpandedE2] = useState<Set<number>>(new Set());
    const toggleE2 = (i: number) => setExpandedE2(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
    const QUOTE_PREVIEW_LEN = 220;

    const SEV_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

    const allSocial = (p.pain_signals || [])
      .sort((a, b) => {
        const s = (SEV_ORDER[a.severity] ?? 2) - (SEV_ORDER[b.severity] ?? 2);
        if (s !== 0) return s;
        const da = a.date && a.date !== 'unknown' ? new Date(a.date).getTime() : 0;
        const db = b.date && b.date !== 'unknown' ? new Date(b.date).getTime() : 0;
        return db - da;
      });

    // Tech-specific posts first, everything else after
    const techPosts  = allSocial.filter(isTechSignal);
    const otherPosts = allSocial.filter(s => !isTechSignal(s));
    const prioritized = [...techPosts, ...otherPosts];
    const shown = prioritized.slice(0, 5);
    const extra = prioritized.length - shown.length;

    const e2Posts  = socialResults?.social_posts      ?? [];
    const e2Notes  = socialResults?.cross_reference_notes ?? [];
    const propPhone = socialResults?.property_phone ?? null;
    const hasAny   = shown.length > 0 || e2Posts.length > 0 || socialLoading || propPhone;

    if (!hasAny) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
          <MessageSquare size={32} className="opacity-20" />
          <p className="text-sm font-bold text-slate-500">No signals found for this property</p>
          <p className="text-xs font-medium text-center max-w-xs">Run a fresh ARIA search — social searches, listing reviews, and pain signals populate here.</p>
        </div>
      );
    }

    const totalCount = prioritized.length + e2Posts.length;

    return (
      <div className="space-y-5 max-w-3xl animate-in fade-in slide-in-from-bottom-2 duration-500">

        {/* Header */}
        <div className="flex items-start justify-between px-1">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <MessageSquare size={15} className="text-rose-500" />
              Community Temperature
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5 font-medium">What people are saying — Reddit, Google Reviews, listing sites, resident forums</p>
          </div>
          <div className="flex items-center gap-2">
            {techPosts.length > 0 && (
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 border border-rose-200/60">{techPosts.length} tech complaints</span>
            )}
            <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">{totalCount} total</span>
            {socialLoading && (
              <span className="flex items-center gap-1 text-[10px] text-[#6B7EFF] font-bold">
                <Loader2 size={11} className="animate-spin" /> Social search…
              </span>
            )}
          </div>
        </div>

        {/* Property phone — surfaced from Engine 2 social search */}
        {propPhone && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-50/60 border border-emerald-200/60 shadow-sm">
            <Phone size={14} className="text-emerald-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-700/70 mb-0.5">Property / Leasing Office</p>
              <p className="text-sm font-bold text-emerald-900 tracking-wide">{propPhone}</p>
            </div>
            <button
              onClick={() => { navigator.clipboard.writeText(propPhone); }}
              className="p-1.5 rounded-lg bg-white border border-emerald-200 text-emerald-600 hover:bg-emerald-50 transition-colors"
              title="Copy phone number"
            >
              <Copy size={12} />
            </button>
          </div>
        )}

        {/* Cross-reference notes from Engine 2 */}
        {e2Notes.length > 0 && (
          <div className="rounded-2xl bg-gradient-to-br from-blue-50/60 to-indigo-50/40 border border-blue-200/60 p-4 shadow-sm">
            <p className="text-[9px] font-bold uppercase tracking-widest text-blue-600 mb-3 flex items-center gap-1.5">
              <Zap size={10} /> AI Cross-Reference — Engine 1 × Social Search
            </p>
            <div className="space-y-2">
              {e2Notes.map((note, i) => (
                <div key={i} className={cn("rounded-xl px-3.5 py-2.5 text-xs flex items-start gap-2.5 border",
                  note.type === 'confirmation'  ? 'bg-emerald-50/80 border-emerald-200/60 text-emerald-900' :
                  note.type === 'contradiction' ? 'bg-red-50/80 border-red-200/60 text-red-900' :
                  note.type === 'new_finding'   ? 'bg-amber-50/80 border-amber-200/60 text-amber-900' :
                                                  'bg-white border-slate-200/60 text-slate-800'
                )}>
                  <span className="shrink-0 mt-0.5 font-bold text-[10px] px-1.5 py-0.5 rounded-md border"
                    style={{ background: note.type === 'confirmation' ? '#D1FAE5' : note.type === 'contradiction' ? '#FEE2E2' : note.type === 'new_finding' ? '#FEF3C7' : '#F1F5F9',
                             color: note.type === 'confirmation' ? '#065F46' : note.type === 'contradiction' ? '#991B1B' : note.type === 'new_finding' ? '#92400E' : '#475569',
                             borderColor: note.type === 'confirmation' ? '#A7F3D0' : note.type === 'contradiction' ? '#FECACA' : note.type === 'new_finding' ? '#FDE68A' : '#CBD5E1',
                           }}>
                    {note.provider}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium leading-relaxed">{note.note}</span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] font-mono opacity-60">{note.type.replace('_',' ')} · {note.confidence} confidence · {note.evidence_count} post{note.evidence_count !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Post cards */}
        {shown.map((sig, i) => {
          const plat = getPlatformMeta(sig);
          const sev  = SIGNAL_SEVERITY[sig.severity] ?? SIGNAL_SEVERITY.low;
          const Icon = SIGNAL_ICONS[sig.signal_type] || AlertCircle;
          const isTech = isTechSignal(sig);
          const isLong = sig.quote.length > QUOTE_PREVIEW_LEN;
          // Engine 1 cards use a separate expanded set keyed by 'e1-{i}'
          const e1Key = 1000 + i;
          const isExpanded = expandedE2.has(e1Key);
          const displayText = isLong && !isExpanded
            ? sig.quote.slice(0, QUOTE_PREVIEW_LEN) + '…'
            : sig.quote;
          return (
            <div key={i} className={cn("rounded-2xl bg-white shadow-sm overflow-hidden relative border", sev.border)}>
              {/* Severity stripe */}
              <div className={cn("absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl", sev.bg)} />

              <div className="p-5 pl-6">
                {/* Post header */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded-full border", plat.bg, plat.text, plat.border)}>
                      {plat.name}
                    </span>
                    {isTech && (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200/60">⚡ Tech Complaint</span>
                    )}
                    <span className="text-[10px] font-mono text-slate-400">
                      {sig.date && sig.date !== 'unknown' ? sig.date : 'Date unknown'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider border", sev.badge, sev.border.replace('200','100'))}>{sig.severity}</span>
                    <div className={cn("p-1.5 rounded-lg bg-white border", sev.text, sev.border.replace('200','100'))}>
                      <Icon size={13} />
                    </div>
                  </div>
                </div>

                {/* The quote — styled as a social post, collapsible if long */}
                <blockquote className="relative pl-5">
                  <span className="absolute left-0 top-[-4px] text-3xl leading-none text-slate-200 font-serif select-none" aria-hidden>&ldquo;</span>
                  <p className="text-sm text-slate-800 leading-relaxed font-medium">{displayText}</p>
                </blockquote>
                {isLong && (
                  <button
                    onClick={() => toggleE2(e1Key)}
                    className="mt-2 ml-5 text-[10px] font-bold text-[#6B7EFF] hover:underline underline-offset-2"
                  >
                    {isExpanded ? '▲ Show less' : '▼ Show full post'}
                  </button>
                )}

                {/* Source link */}
                {sig.url && (
                  <a href={sig.url} target="_blank" rel="noopener noreferrer"
                    className="mt-4 flex items-center gap-1.5 text-[10px] font-mono text-slate-400 hover:text-[#6B7EFF] transition-colors border-t border-slate-100 pt-3 group">
                    <ExternalLink size={10} className="shrink-0 group-hover:text-[#6B7EFF]" />
                    <span className="truncate">{sig.url.replace(/^https?:\/\//, '')}</span>
                  </a>
                )}
              </div>
            </div>
          );
        })}

        {/* Overflow notice */}
        {extra > 0 && (
          <p className="text-center text-[11px] text-slate-400 font-medium py-2">
            +{extra} more signals in the{' '}
            <button onClick={() => setActiveTab('intel')} className="text-[#6B7EFF] font-bold hover:underline underline-offset-2">
              AI Intel tab
            </button>
          </p>
        )}

        {/* ── Engine 2: Social Search (last 6 months) ── */}
        {(e2Posts.length > 0 || socialLoading) && (
          <div className="pt-2">
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#6B7EFF]/30 to-transparent" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#6B7EFF] flex items-center gap-1">
                <Globe size={10} /> Social Search — Last 6 Months
              </span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#6B7EFF]/30 to-transparent" />
            </div>

            {socialLoading && e2Posts.length === 0 && (
              <div className="flex items-center justify-center gap-2 py-8 text-[#6B7EFF]">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-xs font-bold">Searching Reddit, Google Reviews, Yelp…</span>
              </div>
            )}

            {e2Posts.map((post, i) => {
              const SEV_COLORS = {
                high:   { bg: 'bg-red-400',    border: 'border-red-200',   badge: 'bg-red-50 text-red-600',      text: 'text-red-500' },
                medium: { bg: 'bg-amber-400',  border: 'border-amber-200', badge: 'bg-amber-50 text-amber-600',  text: 'text-amber-500' },
                low:    { bg: 'bg-slate-300',  border: 'border-slate-200', badge: 'bg-slate-100 text-slate-500', text: 'text-slate-400' },
              };
              const sc = SEV_COLORS[post.severity] ?? SEV_COLORS.low;
              return (
                <div key={i} className={cn("rounded-2xl bg-white shadow-sm overflow-hidden relative border mb-4", sc.border)}>
                  <div className={cn("absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl", sc.bg)} />
                  <div className="p-5 pl-6">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border bg-[#6B7EFF]/10 text-[#4F46E5] border-[#6B7EFF]/25">
                          {post.platform}
                        </span>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200/60">📡 Social Search</span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {post.date && post.date !== 'unknown' ? post.date : 'Date unknown'}
                        </span>
                      </div>
                      <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider border shrink-0", sc.badge, sc.border.replace('200','100'))}>{post.severity}</span>
                    </div>

                    {post.tech_mentioned?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {post.tech_mentioned.map((t, j) => (
                          <span key={j} className="text-[9px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200 font-mono">{t}</span>
                        ))}
                      </div>
                    )}

                    {(() => {
                      const isLong = post.quote.length > QUOTE_PREVIEW_LEN;
                      const isExpanded = expandedE2.has(i);
                      const displayText = isLong && !isExpanded
                        ? post.quote.slice(0, QUOTE_PREVIEW_LEN) + '…'
                        : post.quote;
                      return (
                        <div>
                          <blockquote className="relative pl-5">
                            <span className="absolute left-0 top-[-4px] text-3xl leading-none text-slate-200 font-serif select-none" aria-hidden>&ldquo;</span>
                            <p className="text-sm text-slate-800 leading-relaxed font-medium">{displayText}</p>
                          </blockquote>
                          {isLong && (
                            <button
                              onClick={() => toggleE2(i)}
                              className="mt-2 ml-5 text-[10px] font-bold text-[#6B7EFF] hover:underline underline-offset-2"
                            >
                              {isExpanded ? '▲ Show less' : '▼ Show full post'}
                            </button>
                          )}
                        </div>
                      );
                    })()}

                    {post.url && (
                      <a href={post.url} target="_blank" rel="noopener noreferrer"
                        className="mt-4 flex items-center gap-1.5 text-[10px] font-mono text-slate-400 hover:text-[#6B7EFF] transition-colors border-t border-slate-100 pt-3 group">
                        <ExternalLink size={10} className="shrink-0 group-hover:text-[#6B7EFF]" />
                        <span className="truncate">{post.url.replace(/^https?:\/\//, '')}</span>
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── SCOUT tab ─────────────────────────────────────────────────────────────
  function ScoutTab({ p }: { p: Prospect }) {
    const sq = p.scout_queue;
    const sb = p.scout_brief;

    if (!sq && !sb) return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-300 gap-3">
        <Send size={32} className="opacity-20" />
        <p className="text-sm font-medium">No SCOUT context available for this target</p>
      </div>
    );

    const copyPayload = () => {
      const payload = sq
        ? JSON.stringify(sq, null, 2)
        : `SCOUT Brief\n\nContact: ${sb?.primary_contact}\nAngle: ${sb?.outreach_angle?.replace(/_/g, ' ')}\nUrgency: ${sb?.contract_window_urgency}\n\n${(sb?.key_data_points || []).map((pt, i) => `[${i+1}] ${pt}`).join('\n')}`;
      navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    return (
      <div className="space-y-5 max-w-4xl animate-in fade-in slide-in-from-bottom-2 duration-500">

        {/* Header bar */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
          <div className="bg-slate-50/50 border-b border-slate-100 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-emerald-500" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-700">SCOUT Context Queue</h3>
            </div>
            <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">Status: Ready</span>
          </div>

          <div className="px-6 py-4 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#6B7EFF]/10 border border-[#6B7EFF]/20">
              <Target size={12} className="text-[#6B7EFF]" />
              <span className="text-[11px] font-bold text-[#6B7EFF] tracking-wide">
                {(sb?.outreach_angle || 'General').replace(/_/g, ' ').toUpperCase()}
              </span>
            </div>
            <span className={cn("text-[11px] font-bold px-3 py-1.5 rounded-lg uppercase tracking-wide border",
              URGENCY_PILL[sb?.contract_window_urgency ?? ''] || "bg-slate-100 text-slate-600 border-slate-200")}>
              {sb?.contract_window_urgency || 'medium'} urgency
            </span>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={copyPayload}
                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold shadow-sm transition-colors">
                <Copy size={12} /> {copied ? "Copied!" : "Copy JSON"}
              </button>
            </div>
          </div>
        </div>

        {/* Property context block */}
        {sq?.property && (
          <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
              <span className="font-mono text-[#6B7EFF]">[PROPERTY]</span> Identity Context
            </p>
            <div className="grid grid-cols-3 gap-4 text-xs">
              {[
                { label: 'Name', val: sq.property.name },
                { label: 'Units', val: sq.property.units },
                { label: 'Class', val: sq.property.class },
                { label: 'Management', val: sq.property.management_company },
                { label: 'Owner', val: sq.property.owner_entity },
                { label: 'Formerly', val: sq.property.old_name },
              ].filter(r => r.val).map(({ label, val }) => (
                <div key={label}>
                  <p className="text-slate-400 text-[9px] uppercase font-bold">{label}</p>
                  <p className="font-bold text-slate-800 mt-0.5 truncate">{String(val)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Connectivity context */}
        {sq?.connectivity && (sq.connectivity.isp_providers?.length || sq.connectivity.bulk_detected) && (
          <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
              <span className="font-mono text-emerald-600">[CONNECTIVITY]</span> Internet Signal
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              {sq.connectivity.isp_providers.map(isp => (
                <span key={isp} className="text-[11px] px-3 py-1.5 rounded-lg font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">{isp}</span>
              ))}
              {sq.connectivity.bulk_detected && (
                <span className="text-[11px] px-3 py-1.5 rounded-lg font-bold bg-amber-50 text-amber-700 border border-amber-200/60">Bulk Agreement Detected</span>
              )}
              {sq.connectivity.provider_confirmed && (
                <span className="text-[11px] px-3 py-1.5 rounded-lg font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">Provider Confirmed</span>
              )}
            </div>
          </div>
        )}

        {/* Pain angles */}
        {sq?.pain_angles && sq.pain_angles.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
              <span className="font-mono text-rose-500">[PAIN_ANGLES]</span> Top Vulnerability Signals
            </p>
            <div className="bg-slate-900 rounded-xl p-4 font-mono text-[11px] leading-relaxed overflow-x-auto">
              {sq.pain_angles.slice(0, 6).map((sig, i) => (
                <div key={i} className="flex items-start gap-3 mb-2 last:mb-0">
                  <span className="text-[#6B7EFF] shrink-0">[{i+1}]</span>
                  <span className={sig.severity === 'high' ? 'text-rose-300' : sig.severity === 'medium' ? 'text-amber-300' : 'text-slate-400'}>
                    <span className="text-slate-500">{sig.type}:</span> {sig.quote}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PropTech context */}
        {sq?.proptech && (sq.proptech.gate_operators?.length || sq.proptech.access_control?.length) && (
          <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
              <span className="font-mono text-orange-500">[PROPTECH]</span> Gate &amp; Access Stack
            </p>
            <div className="flex flex-wrap gap-2">
              {[...(sq.proptech.gate_operators || []), ...(sq.proptech.access_control || [])].map(t => (
                <span key={t} className="text-[11px] px-3 py-1.5 rounded-lg font-bold bg-orange-50 text-orange-700 border border-orange-200/60">{t}</span>
              ))}
              {sq.proptech.tech_generation && (
                <span className="text-[11px] px-3 py-1.5 rounded-lg font-bold bg-slate-100 text-slate-600 border border-slate-200 capitalize">{sq.proptech.tech_generation} gen</span>
              )}
            </div>
          </div>
        )}

        {/* Contact chain */}
        {sq?.contact_chain && sq.contact_chain.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
              <span className="font-mono text-violet-500">[CONTACTS]</span> Outreach Chain ({sq.contact_chain.length} nodes)
            </p>
            <div className="space-y-2">
              {sq.contact_chain.slice(0, 4).map((c, i) => (
                <div key={i} className="flex items-center gap-3 text-xs bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                  <span className="font-mono text-[#6B7EFF] text-[10px]">[{i+1}]</span>
                  <span className="font-bold text-slate-900">{c.name || '—'}</span>
                  <span className="text-slate-500 capitalize">{(c.role_type || 'unknown').replace('_', ' ')}</span>
                  {(c.top_email_format || c.email) && (
                    <span className="ml-auto font-mono text-slate-500 text-[10px]">{c.top_email_format || c.email}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Key Finding */}
        {sq?.key_finding && (
          <div className="bg-amber-50/50 rounded-2xl border border-amber-200/60 p-5 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700/80 mb-2 flex items-center gap-1.5">
              <span className="font-mono text-amber-600">[KEY_FINDING]</span> Primary Intelligence
            </p>
            <p className="text-sm text-amber-900 leading-relaxed font-medium">{sq.key_finding}</p>
          </div>
        )}

        {/* Behavioral Profile (from scout_queue) */}
        {sq?.behavioral_profile && Object.keys(sq.behavioral_profile).length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
              <span className="font-mono text-violet-500">[PROFILE]</span> Behavioral Intelligence
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {Object.entries(sq.behavioral_profile).map(([key, val]) => (
                <div key={key}>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">{key.replace(/_/g, ' ')}</p>
                  <p className="text-xs font-medium text-slate-700">{String(val)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Objection Flags */}
        {sq?.objection_flags && Object.values(sq.objection_flags).some(Boolean) && (
          <div className="bg-white rounded-2xl border border-rose-200/60 p-5 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
              <span className="font-mono text-rose-500">[OBJECTIONS]</span> Flags to Prepare For
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(sq.objection_flags).filter(([, v]) => v).map(([key]) => (
                <span key={key} className="text-[11px] px-3 py-1.5 rounded-lg font-bold bg-rose-50 text-rose-700 border border-rose-200/60 capitalize">
                  {key.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 6-Month Outreach Plan */}
        {(sq?.outreach_plan || p.outreach_plan) && (() => {
          const plan = sq?.outreach_plan ?? p.outreach_plan;
          if (!plan) return null;
          const months = ([1,2,3,4,5,6] as const).map(n => ({ n, data: plan[`month_${n}` as keyof OutreachPlan] as OutreachMonth | undefined })).filter(m => m.data);
          if (months.length === 0) return null;
          return (
            <div className="bg-white rounded-2xl border border-[#6B7EFF]/20 p-5 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#6B7EFF] to-[#A78BFA]" />
              <div className="flex items-start justify-between mb-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#6B7EFF] flex items-center gap-1.5">
                  <span className="font-mono">[CAMPAIGN]</span> 6-Month Outreach Plan
                </p>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  {plan.primary_channel && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#6B7EFF]/10 text-[#6B7EFF] border border-[#6B7EFF]/20 capitalize">{plan.primary_channel}</span>
                  )}
                  {plan.total_touches != null && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">{plan.total_touches} touches</span>
                  )}
                  {plan.expected_close_quarter && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100">Close: {plan.expected_close_quarter}</span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                {months.map(({ n, data }) => data && (
                  <div key={n} className="rounded-xl border border-slate-200/60 p-3 bg-slate-50/50 hover:bg-white hover:shadow-sm transition-all">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-[9px] font-mono font-bold text-white bg-[#6B7EFF] px-1.5 py-0.5 rounded">M{n}</span>
                      <span className="text-[11px] font-bold text-slate-800 leading-tight">{data.theme}</span>
                    </div>
                    {(data.actions || []).length > 0 && (
                      <ul className="space-y-1 mb-2">
                        {(data.actions || []).map((action, ai) => (
                          <li key={ai} className="text-[10px] text-slate-600 flex items-start gap-1">
                            <span className="text-[#6B7EFF] shrink-0 mt-0.5 font-bold">›</span>
                            <span>{action}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {data.goal && (
                      <p className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 mt-1">{data.goal}</p>
                    )}
                  </div>
                ))}
              </div>
              {plan.key_milestone && (
                <div className="pt-3 border-t border-slate-100 flex items-start gap-2">
                  <Target size={13} className="text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs font-medium text-slate-700"><span className="font-bold text-amber-700">Key Milestone:</span> {plan.key_milestone}</p>
                </div>
              )}
            </div>
          );
        })()}

        {/* Outreach Sequence — individual touches */}
        {sq?.outreach_sequence && sq.outreach_sequence.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
              <span className="font-mono text-emerald-600">[SEQUENCE]</span> Recommended Touch Sequence ({sq.outreach_sequence.length} touches)
            </p>
            <div className="space-y-2">
              {sq.outreach_sequence.map((touch, i) => (
                <div key={i} className="flex items-start gap-3 bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <div className="w-6 h-6 rounded-full bg-[#6B7EFF] flex items-center justify-center text-white text-[10px] font-mono font-bold shrink-0">
                    {touch.touch ?? i+1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-bold text-slate-700 capitalize">{(touch.channel || 'email').replace('_', ' ')}</span>
                      {touch.timing && <span className="text-[9px] font-mono text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-100">{touch.timing}</span>}
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">{touch.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Key data points fallback from scout_brief */}
        {!sq && sb?.key_data_points && sb.key_data_points.length > 0 && (
          <div className="bg-slate-50/80 rounded-xl p-6 border border-slate-200/60 shadow-inner relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#6B7EFF] to-[#A78BFA]" />
            <p className="text-[10px] font-bold text-slate-500 mb-4 uppercase tracking-widest flex items-center gap-2">
              <Cpu size={12} className="text-[#6B7EFF]"/> Key Intel
            </p>
            <div className="space-y-4">
              {sb.key_data_points.map((point, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="text-[11px] font-mono font-bold text-[#6B7EFF] mt-0.5">[{i + 1}]</span>
                  <p className="text-[13px] font-medium text-slate-700 leading-relaxed">{point}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-1">
          {savedSearchId && !importResult[savedSearchId] && (
            <button onClick={() => importSearch(savedSearchId)} disabled={importing === savedSearchId}
              className="flex items-center gap-2 text-xs px-5 py-2.5 rounded-lg text-white font-bold transition-all hover:opacity-90 disabled:opacity-60 shadow-sm"
              style={{ background: "#6B7EFF" }}>
              {importing === savedSearchId ? <Loader2 size={14} className="animate-spin" /> : <><Download size={14} /> Import to Queue</>}
            </button>
          )}
          {savedSearchId && (importResult[savedSearchId]?.created ?? 0) >= 0 && !scoutResult[savedSearchId] && (
            <button onClick={() => launchScout(savedSearchId)} disabled={scoutLoading === savedSearchId}
              className="ai-border-glow active flex items-center gap-2 text-xs px-6 py-2.5 rounded-lg text-white font-bold transition-all hover:scale-105 disabled:opacity-60 shadow-[0_4px_14px_0_rgba(16,185,129,0.39)]"
              style={{ background: "linear-gradient(to right, #10B981, #059669)" }}>
              {scoutLoading === savedSearchId ? <Loader2 size={14} className="animate-spin" /> : <><Zap size={14} /> INITIALIZE SCOUT</>}
            </button>
          )}
          {savedSearchId && scoutResult[savedSearchId] && (
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 bg-emerald-50 px-4 py-2.5 rounded-lg border border-emerald-100">
              <CheckCircle2 size={14} /> Sequence Deployed ({scoutResult[savedSearchId].sent} sent)
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Pipeline panel — 2035 holographic HUD ────────────────────────────────
  function PipelinePanel() {
    return (
      <div className="flex flex-col h-full overflow-hidden relative select-none"
        style={{ background: 'radial-gradient(ellipse at 50% 25%, #0a1628 0%, #050c1a 55%, #000208 100%)' }}>

        {/* Perspective grid */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true"
          style={{ backgroundImage: 'linear-gradient(rgba(107,126,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(107,126,255,0.035) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />

        {/* Top scan line */}
        <div className="absolute top-0 left-0 right-0 h-px pointer-events-none" aria-hidden="true"
          style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(107,126,255,0.9) 50%, transparent 100%)', animation: 'aria-shimmer 2.4s ease-in-out infinite' }} />

        {/* Corner brackets — HUD aesthetic */}
        <div className="absolute top-4 left-4 w-8 h-8 pointer-events-none" aria-hidden="true">
          <div className="absolute top-0 left-0 w-full h-px" style={{ background: 'rgba(107,126,255,0.35)' }} />
          <div className="absolute top-0 left-0 h-full w-px" style={{ background: 'rgba(107,126,255,0.35)' }} />
        </div>
        <div className="absolute top-4 right-4 w-8 h-8 pointer-events-none" aria-hidden="true">
          <div className="absolute top-0 right-0 w-full h-px" style={{ background: 'rgba(107,126,255,0.35)' }} />
          <div className="absolute top-0 right-0 h-full w-px" style={{ background: 'rgba(107,126,255,0.35)' }} />
        </div>
        <div className="absolute bottom-4 left-4 w-8 h-8 pointer-events-none" aria-hidden="true">
          <div className="absolute bottom-0 left-0 w-full h-px" style={{ background: 'rgba(107,126,255,0.35)' }} />
          <div className="absolute bottom-0 left-0 h-full w-px" style={{ background: 'rgba(107,126,255,0.35)' }} />
        </div>
        <div className="absolute bottom-4 right-4 w-8 h-8 pointer-events-none" aria-hidden="true">
          <div className="absolute bottom-0 right-0 w-full h-px" style={{ background: 'rgba(107,126,255,0.35)' }} />
          <div className="absolute bottom-0 right-0 h-full w-px" style={{ background: 'rgba(107,126,255,0.35)' }} />
        </div>

        {/* Floating particles */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          {PIPELINE_PARTICLES.map((pt, i) => (
            <div key={i} className="absolute rounded-full"
              style={{ left: `${pt.x}%`, top: `${pt.y}%`, width: `${pt.s}px`, height: `${pt.s}px`, background: `rgba(107,126,255,${pt.s > 1.5 ? 0.5 : 0.3})`, boxShadow: `0 0 ${pt.s * 3}px rgba(107,126,255,0.4)`, animation: `aria-pulse ${2 + pt.d}s ease-in-out infinite`, animationDelay: `${pt.d}s` }} />
          ))}
        </div>

        {/* Main content */}
        <div className="relative z-10 flex flex-col items-center justify-center h-full gap-10 px-8 py-10">

          {/* Central ARIA logo with orbital rings */}
          <div className="relative flex items-center justify-center" style={{ width: '148px', height: '148px' }}>
            {/* Ring 1 — fast inner */}
            <div className="absolute rounded-full" style={{ width: '72px', height: '72px', border: '1px solid rgba(107,126,255,0.3)', animation: 'spin 7s linear infinite' }}>
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full"
                style={{ background: '#6B7EFF', boxShadow: '0 0 10px 4px rgba(107,126,255,0.7)' }} />
            </div>
            {/* Ring 2 — medium reverse */}
            <div className="absolute rounded-full" style={{ width: '104px', height: '104px', border: '1px solid rgba(167,139,250,0.15)', animation: 'spin 13s linear infinite reverse' }}>
              <div className="absolute top-1/2 -right-1 -translate-y-1/2 w-1.5 h-1.5 rounded-full"
                style={{ background: '#A78BFA', boxShadow: '0 0 7px 2px rgba(167,139,250,0.6)' }} />
            </div>
            {/* Ring 3 — slow outer */}
            <div className="absolute rounded-full" style={{ width: '140px', height: '140px', border: '1px solid rgba(107,126,255,0.07)', animation: 'spin 21s linear infinite' }} />

            {/* Core logo */}
            <div className="relative z-10 w-16 h-16 rounded-2xl flex flex-col items-center justify-center gap-0.5"
              style={{ background: 'linear-gradient(145deg, #0d2150 0%, #1a3470 45%, #6B7EFF 100%)', boxShadow: '0 0 35px rgba(107,126,255,0.4), 0 0 70px rgba(107,126,255,0.12), inset 0 1px 0 rgba(255,255,255,0.12)', border: '1px solid rgba(107,126,255,0.3)' }}>
              <span className="text-white font-bold text-base tracking-tighter leading-none" style={{ textShadow: '0 0 18px rgba(107,126,255,1)' }}>AR</span>
              <span className="text-[7px] font-bold tracking-[0.2em] leading-none" style={{ color: 'rgba(165,180,252,0.6)' }}>IA</span>
            </div>
          </div>

          {/* Phase nodes row */}
          <div className="w-full max-w-md">
            <div className="flex items-start">
              {PHASES.map((p, idx) => {
                const status = phase > p.id ? 'done' : phase === p.id ? 'running' : 'queued';
                const Icon = p.icon;
                const isLast = idx === PHASES.length - 1;
                return (
                  <div key={p.id} className={cn('flex items-center min-w-0', isLast ? '' : 'flex-1')}>
                    {/* Node */}
                    <div className="flex flex-col items-center gap-2 shrink-0">
                      <div className="relative">
                        {status === 'running' && (
                          <div className="absolute -inset-3 rounded-full pointer-events-none"
                            style={{ background: 'radial-gradient(circle, rgba(107,126,255,0.22) 0%, transparent 70%)', animation: 'aria-pulse 1.4s ease-in-out infinite' }} />
                        )}
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-700"
                          style={{
                            background: status === 'done' ? 'linear-gradient(135deg, #065f46, #059669)' :
                                        status === 'running' ? 'linear-gradient(135deg, #1a3470, #6B7EFF)' :
                                        'rgba(255,255,255,0.03)',
                            border: `1px solid ${status === 'done' ? 'rgba(16,185,129,0.55)' : status === 'running' ? 'rgba(107,126,255,0.75)' : 'rgba(255,255,255,0.07)'}`,
                            boxShadow: status === 'running' ? '0 0 18px rgba(107,126,255,0.5), 0 0 40px rgba(107,126,255,0.15), inset 0 1px 0 rgba(255,255,255,0.1)' :
                                       status === 'done' ? '0 0 12px rgba(16,185,129,0.3)' : 'none',
                          }}>
                          {status === 'done' ? (
                            <Check size={13} style={{ color: '#6ee7b7' }} />
                          ) : status === 'running' ? (
                            <Loader2 size={13} className="animate-spin" style={{ color: '#c7d2fe' }} />
                          ) : (
                            <Icon size={13} style={{ color: 'rgba(255,255,255,0.2)' }} />
                          )}
                        </div>
                      </div>
                      <span className="text-[8px] font-bold uppercase tracking-widest text-center leading-tight w-14 truncate"
                        style={{ color: status === 'done' ? '#34D399' : status === 'running' ? '#818CF8' : 'rgba(255,255,255,0.18)' }}>
                        {p.name}
                      </span>
                    </div>

                    {/* Connector beam */}
                    {!isLast && (
                      <div className="flex-1 h-px relative overflow-hidden self-start mt-[18px] mx-0.5">
                        <div className="absolute inset-0" style={{ background: 'rgba(255,255,255,0.05)' }} />
                        {phase > p.id && (
                          <div className="absolute inset-0"
                            style={{ background: 'linear-gradient(90deg, rgba(16,185,129,0.6), rgba(16,185,129,0.2))' }} />
                        )}
                        {phase === p.id && p.id < 5 && (
                          <div className="absolute inset-0"
                            style={{ background: 'linear-gradient(90deg, rgba(107,126,255,0.8) 0%, rgba(107,126,255,0.05) 100%)', animation: `aria-fill ${PHASE_DURATIONS[p.id]}ms ease-in-out forwards` }} />
                        )}
                        {phase === p.id && p.id === 5 && (
                          <div className="absolute inset-0"
                            style={{ background: 'linear-gradient(90deg, #6B7EFF, #A78BFA, #6B7EFF)', backgroundSize: '200% 100%', animation: 'aria-shimmer 1.4s ease-in-out infinite' }} />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Status readout */}
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2.5 px-5 py-2.5 rounded-full"
              style={{ background: 'rgba(107,126,255,0.07)', border: '1px solid rgba(107,126,255,0.18)', backdropFilter: 'blur(8px)' }}>
              <span className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: '#6B7EFF', boxShadow: '0 0 8px rgba(107,126,255,1)', animation: 'aria-pulse 0.9s ease-in-out infinite' }} />
              <span className="text-[10px] font-mono tracking-wide"
                style={{ color: 'rgba(165,180,252,0.85)' }}>
                {phase === 5
                  ? SYNTHESIS_STEPS[synthStep]
                  : phase > 0
                    ? `[${PHASES[phase - 1]?.name?.toUpperCase() ?? 'SYS'}] — Acquiring telemetry...`
                    : 'Initializing ARIA engine...'}
              </span>
            </div>
            <div className="text-[8px] font-mono text-center tracking-widest uppercase"
              style={{ color: 'rgba(255,255,255,0.12)' }}>
              {phase === 5 ? 'Claude Sonnet · Synthesis Mode Active' : 'ARIA Intelligence Engine · v7.3'}
            </div>
          </div>

        </div>
      </div>
    );
  }

  // ── Candidate grid panel ──────────────────────────────────────────────────
  function CandidateGrid() {
    if (candidates.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3 px-8 text-center">
          <Search size={32} className="opacity-20" />
          <p className="text-sm font-bold text-slate-500">No matching properties found</p>
          <p className="text-xs font-medium">Try a more specific query — include a city, state, or property name.</p>
          <button
            onClick={() => { setCandidates([]); setQueryInterpretation(''); setViewMode('idle'); }}
            className="mt-3 flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold transition-colors"
          >
            <ArrowLeft size={12} /> New Search
          </button>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="bg-white border-b border-slate-200/60 px-6 py-4 shadow-sm z-10">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <button
                  onClick={() => { setCandidates([]); setQueryInterpretation(''); setViewMode('idle'); }}
                  className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 hover:text-slate-800 transition-colors"
                >
                  <ArrowLeft size={12} /> New Search
                </button>
              </div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Found {candidates.length} {candidates.length === 1 ? 'property' : 'properties'} matching your search
              </h2>
              {queryInterpretation && (
                <p className="text-xs text-slate-500 mt-1 font-medium">{queryInterpretation}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-6xl mx-auto">
            {candidates.map((c, i) => {
              const score = c.buy_score_estimate ?? 5;
              return (
                <div
                  key={`${c.name}-${i}`}
                  className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:border-[#6B7EFF] hover:shadow-md transition-all duration-200 relative group"
                >
                  <div className="absolute top-4 right-4">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-mono font-bold shadow-sm"
                      style={scoreBg(score)}
                    >
                      {score}
                    </div>
                  </div>

                  <div className="pr-12">
                    <h3 className="text-lg font-bold text-slate-900 leading-tight">{c.name}</h3>
                    <p className="text-sm text-slate-500 mt-1 flex items-center gap-1.5">
                      <MapPin size={12} className="shrink-0 opacity-70" />
                      <span className="truncate">
                        {[c.address, c.city, c.state].filter(Boolean).join(', ') || `${c.city || ''}, ${c.state || ''}`}
                      </span>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 mt-3">
                    {c.units && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                        {c.units} units
                      </span>
                    )}
                    {c.year_built && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                        {c.year_built}
                      </span>
                    )}
                    {c.property_class && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                        Class {c.property_class}
                      </span>
                    )}
                  </div>

                  {c.management_company && (
                    <div className="flex items-center gap-1.5 mt-3 text-xs">
                      <Building2 size={11} className="text-slate-400" />
                      <span className="font-bold text-slate-700">{c.management_company}</span>
                    </div>
                  )}

                  {(c.isp_signal || c.bulk_detected) && (
                    <div className="flex items-center gap-1.5 mt-2 text-xs flex-wrap">
                      <Wifi size={11} className="text-emerald-500" />
                      {c.isp_signal && (
                        <span className="font-medium text-slate-700">{c.isp_signal}</span>
                      )}
                      {c.bulk_detected && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                          BULK DETECTED
                        </span>
                      )}
                    </div>
                  )}

                  {c.pain_brief && (
                    <div className="mt-3 rounded-lg bg-amber-50/50 border border-amber-200/60 px-3 py-2">
                      <p className="text-[11px] text-amber-900 italic leading-relaxed">
                        &ldquo;{c.pain_brief}&rdquo;
                      </p>
                    </div>
                  )}

                  <button
                    onClick={() => searchCandidate(c)}
                    className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-white text-xs font-bold transition-all shadow-sm hover:opacity-90"
                    style={{ background: '#6B7EFF' }}
                  >
                    <Zap size={12} /> Research This Property
                    <ChevronRight size={12} />
                  </button>
                </div>
              );
            })}
          </div>
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
                      onClick={() => { setQuery(dbSelected.property_name); setDbView(false); setPhase(0); setResults(null); setSavedSearchId(null); setPendingRerun(true); }}
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
              style={{ background: isRunning ? "#94a3b8" : "linear-gradient(135deg, #0d2150 0%, #1a3a7c 45%, #6B7EFF 100%)" }}
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
                  onClick={() => { setPhase(0); setResults(null); setQuery(""); setSavedSearchId(null); setCandidates([]); setQueryInterpretation(''); setViewMode('idle'); }}
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
        <div className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: 'rgba(248, 250, 252, 0.95)' }}>
          {dbView ? (
            <IntelDBPanel />
          ) : isRunning ? (
            <PipelinePanel />
          ) : candidates.length > 0 ? (
            <CandidateGrid />
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
                {activeTab === 'proptech' && <PropTechTab p={prospect} />}
                {activeTab === 'dm'       && <DMTab p={prospect} />}
                {activeTab === 'intel'    && <IntelTab p={prospect} />}
                {activeTab === 'social'   && <SocialTab p={prospect} />}
                {activeTab === 'scout'    && <ScoutTab p={prospect} />}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full relative overflow-hidden"
              style={{ background: 'radial-gradient(ellipse at 50% 70%, #0d2150 0%, #060e28 38%, #020810 68%, #000306 100%)' }}>
              {/* Pulsing rings */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
                {[1, 2, 3].map(i => (
                  <div key={i} className="absolute rounded-full border border-[#6B7EFF]/10"
                    style={{ width: `${i * 160}px`, height: `${i * 160}px`, animation: `aria-pulse ${2 + i * 0.6}s ease-in-out infinite`, animationDelay: `${i * 0.35}s` }} />
                ))}
              </div>
              <div className="relative z-10 flex flex-col items-center gap-6 px-8">
                {/* ARIA logo */}
                <div className="w-20 h-20 rounded-3xl flex items-center justify-center font-bold text-2xl relative overflow-hidden"
                  style={{ background: 'linear-gradient(135deg, #0d2150 0%, #1e3a7c 50%, #6B7EFF 100%)', boxShadow: '0 0 40px rgba(107,126,255,0.3), 0 20px 40px rgba(0,0,0,0.5)' }}>
                  <span className="text-white tracking-tight select-none" style={{ textShadow: '0 0 20px rgba(107,126,255,0.9)' }}>AR</span>
                  <div className="absolute bottom-0 left-0 right-0 h-1/2" style={{ background: 'linear-gradient(to top, rgba(107,126,255,0.2), transparent)' }} />
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-white tracking-tight">ARIA Intelligence Engine</p>
                  <p className="text-sm font-medium text-slate-400 mt-1.5 max-w-xs leading-relaxed">
                    Search any property, management company, or market — ARIA will profile it.
                  </p>
                </div>
                <div className="flex items-center gap-6 mt-2 pt-5 border-t border-white/10 text-[11px] font-bold text-slate-500">
                  <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> FCC Broadband</span>
                  <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#6B7EFF]" /> SEC EDGAR</span>
                  <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-purple-400" /> 14 Sources</span>
                </div>
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
              style={{ background: isRunning ? "#94a3b8" : "linear-gradient(135deg, #0d2150 0%, #1a3a7c 45%, #6B7EFF 100%)" }}>
              {isRunning ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isRunning ? (
            <div className="p-4"><PipelinePanel /></div>
          ) : candidates.length > 0 ? (
            <CandidateGrid />
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
                {(['property', 'proptech', 'dm', 'intel', 'social', 'scout'] as DetailTab[]).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={cn("whitespace-nowrap px-5 py-3 text-xs font-bold capitalize border-b-2 transition-colors",
                      activeTab === tab ? "border-[#6B7EFF] text-[#6B7EFF]" : "border-transparent text-slate-400")}>
                    {tab === 'dm' ? 'DM' : tab === 'proptech' ? 'PropTech' : tab === 'social' ? 'Community' : tab}
                  </button>
                ))}
              </div>
              <div className="p-4">
                {activeTab === 'property' && <PropertyTab p={prospect} />}
                {activeTab === 'proptech' && <PropTechTab p={prospect} />}
                {activeTab === 'dm'       && <DMTab p={prospect} />}
                {activeTab === 'intel'    && <IntelTab p={prospect} />}
                {activeTab === 'social'   && <SocialTab p={prospect} />}
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
        @keyframes aria-pulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50%       { transform: scale(1.08); opacity: 1; }
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
