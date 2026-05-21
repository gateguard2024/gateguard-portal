"use client";

import { useState, useRef, useCallback } from "react";
import {
  Cpu, Zap, Users, Radio, Target, Mail,
  Building2, User, MapPin, CheckCircle2,
  ExternalLink, Star, Copy, Send,
  Loader2, Shield, Package, Wifi, AlertCircle,
  ChevronRight, TrendingUp, Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

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
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PHASES = [
  {
    id: 1, name: "Property Intel", icon: Building2,
    sources: ["County Assessor", "CoStar", "Google Maps"],
    detail: "Pulling unit count, ownership, class rating",
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

export default function ARIAPage() {
  const [query, setQuery]                   = useState("");
  const [phase, setPhase]                   = useState(0); // 0=idle 1-5=animating 6=done
  const [results, setResults]               = useState<ResearchResult | null>(null);
  const [error, setError]                   = useState<string | null>(null);
  const [selectedProspect, setSelectedProspect] = useState(0);
  const [selectedEmail, setSelectedEmail]   = useState(0);
  const [copied, setCopied]                 = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  const runARIA = useCallback(async () => {
    if (!query.trim() || phase > 0) return;
    setError(null);
    setResults(null);
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
        // Vercel returned a non-JSON error (e.g. 504 timeout HTML)
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
    } catch (e: any) {
      setError(e.message || "Research failed — check ANTHROPIC_API_KEY and try again");
      setPhase(0);
    }
  }, [query, phase]);

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

          {/* Stats strip */}
          <div className="flex gap-8 shrink-0">
            {[
              { label: "Targets Enriched", value: "1,847", icon: Building2 },
              { label: "Campaigns Sent",   value: "312",   icon: Mail      },
              { label: "Avg Reply Rate",   value: "21.4%", icon: TrendingUp },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <p className="text-lg font-bold text-gray-900 tabular-nums">{value}</p>
                <p className="text-[11px] text-gray-400">{label}</p>
              </div>
            ))}
          </div>
        </div>

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
                  </div>

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

            {/* New search CTA */}
            <div className="flex justify-center pt-2 pb-4">
              <button
                onClick={() => {
                  setPhase(0);
                  setResults(null);
                  setQuery("");
                  setTimeout(() => inputRef.current?.focus(), 100);
                }}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#6B7EFF] transition-colors font-medium"
              >
                <Zap size={14} /> Run another ARIA search
              </button>
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
