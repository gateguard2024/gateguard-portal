"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Zap, AlertTriangle, Building2, Globe, MapPin,
  Loader2, CheckCircle2, Check, Users, TrendingUp,
  ChevronRight, Clock, Search, RefreshCw,
} from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Radar, Flame, Target, Shield } = require("lucide-react") as any;
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScoutAlert {
  id: string;
  alert_type: "permit_expired" | "new_property_sale" | "competitor_news" | "pain_signal";
  title: string;
  summary: string;
  property_name: string;
  city: string;
  state: string;
  source_url: string | null;
  relevance_score: number;
  actioned: boolean;
  created_at: string;
}

// ── Alert type config ─────────────────────────────────────────────────────────

const ALERT_TYPES = {
  permit_expired:    { label: "Permit Flag",       bg: "bg-orange-50",  border: "border-orange-200", text: "text-orange-700",  badge: "bg-orange-100 text-orange-700 border-orange-200",  icon: AlertTriangle },
  new_property_sale: { label: "Property Sale",     bg: "bg-blue-50",    border: "border-blue-200",   text: "text-blue-700",    badge: "bg-blue-100 text-blue-700 border-blue-200",         icon: Building2     },
  competitor_news:   { label: "Competitor News",   bg: "bg-violet-50",  border: "border-violet-200", text: "text-violet-700",  badge: "bg-violet-100 text-violet-700 border-violet-200",   icon: Shield        },
  pain_signal:       { label: "Pain Signal",       bg: "bg-red-50",     border: "border-red-200",    text: "text-red-700",     badge: "bg-red-100 text-red-700 border-red-200",            icon: Flame         },
};

type FilterTab = "all" | "permit_expired" | "new_property_sale" | "competitor_news" | "pain_signal";

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs  = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (mins < 2)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hrs  < 24) return `${hrs}h ago`;
  return `${days}d ago`;
}

function RelevanceBar({ score }: { score: number }) {
  const pct = Math.round((score / 10) * 100);
  const color =
    score >= 8 ? "#EF4444" :
    score >= 5 ? "#F59E0B" :
    "#9CA3AF";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-[10px] font-bold tabular-nums" style={{ color }}>{score}/10</span>
    </div>
  );
}

// ── Demo alerts (shown before first scan) ─────────────────────────────────────

const DEMO_ALERTS: ScoutAlert[] = [
  {
    id: "demo-1",
    alert_type: "pain_signal",
    title: "Multiple gate failure complaints — Brookfield Crossing",
    summary: "3 Google reviews in the last 60 days mention gate stuck open, fob not working, and 'management won't fix it.' Strong active pain signal.",
    property_name: "Brookfield Crossing Apartments",
    city: "Atlanta",
    state: "GA",
    source_url: "https://www.google.com/maps",
    relevance_score: 9,
    actioned: false,
    created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
  },
  {
    id: "demo-2",
    alert_type: "permit_expired",
    title: "Gate permit filed 2021 — likely approaching end-of-life",
    summary: "A gate permit for Riverside Glen was pulled in Feb 2021. Average gate operator lifespan is 4-6 years of heavy use. This property is likely entering replacement window.",
    property_name: "Riverside Glen",
    city: "Nashville",
    state: "TN",
    source_url: null,
    relevance_score: 7,
    actioned: false,
    created_at: new Date(Date.now() - 5 * 3600000).toISOString(),
  },
  {
    id: "demo-3",
    alert_type: "new_property_sale",
    title: "Landmark Partners acquires 340-unit complex in Buckhead",
    summary: "New owner typically replaces management company within 6 months and issues capital improvement RFPs. Early outreach window is now.",
    property_name: "Buckhead Commons",
    city: "Atlanta",
    state: "GA",
    source_url: "https://atlanta.bizjournals.com",
    relevance_score: 8,
    actioned: false,
    created_at: new Date(Date.now() - 18 * 3600000).toISOString(),
  },
  {
    id: "demo-4",
    alert_type: "competitor_news",
    title: "ButterflyMX outage reports in Charlotte metro",
    summary: "Multiple apartment Reddit threads report ButterflyMX access outages. Residents locked out. Property managers actively frustrated. Displacement opportunity.",
    property_name: "Various Charlotte Properties",
    city: "Charlotte",
    state: "NC",
    source_url: "https://reddit.com/r/Charlotte",
    relevance_score: 8,
    actioned: false,
    created_at: new Date(Date.now() - 24 * 3600000).toISOString(),
  },
  {
    id: "demo-5",
    alert_type: "pain_signal",
    title: "SmartRent integration broken — Peachtree Landing",
    summary: "App store reviews and a resident forum post confirm SmartRent lost connectivity after last software update. Access control non-functional for 3 days.",
    property_name: "Peachtree Landing",
    city: "Atlanta",
    state: "GA",
    source_url: null,
    relevance_score: 9,
    actioned: false,
    created_at: new Date(Date.now() - 36 * 3600000).toISOString(),
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SCOUTPage() {
  const [alerts, setAlerts]     = useState<ScoutAlert[]>(DEMO_ALERTS);
  const [filter, setFilter]     = useState<FilterTab>("all");
  const [scanning, setScanning] = useState(false);
  const [scanCity, setScanCity] = useState("Atlanta");
  const [scanState, setScanState] = useState("GA");
  const [scanResult, setScanResult] = useState<{ new_alerts: number } | null>(null);
  const [scanError, setScanError]   = useState<string | null>(null);
  const [isDemo, setIsDemo]         = useState(true);
  const [creatingLead, setCreatingLead] = useState<string | null>(null);
  const [leadCreated, setLeadCreated]   = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");

  const runScan = useCallback(async () => {
    if (scanning) return;
    setScanning(true);
    setScanResult(null);
    setScanError(null);
    try {
      const res = await fetch("/api/scout/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city: scanCity, state: scanState }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setScanResult({ new_alerts: data.new_alerts });
      if (data.alerts && data.alerts.length > 0) {
        setAlerts(prev => [...data.alerts, ...prev.filter(a => !a.id.startsWith("demo-"))]);
        setIsDemo(false);
      }
    } catch (e: any) {
      setScanError(e.message ?? "Scan failed");
    } finally {
      setScanning(false);
    }
  }, [scanning, scanCity, scanState]);

  async function createLead(alert: ScoutAlert) {
    if (creatingLead === alert.id) return;
    setCreatingLead(alert.id);
    try {
      const res = await fetch("/api/crm/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: alert.property_name,
          source: "SCOUT",
          notes: `SCOUT Alert (${ALERT_TYPES[alert.alert_type]?.label}): ${alert.summary}`,
          city: alert.city,
          state: alert.state,
        }),
      });
      if (res.ok) {
        setLeadCreated(prev => ({ ...prev, [alert.id]: true }));
      }
    } catch {
      // silent
    } finally {
      setCreatingLead(null);
    }
  }

  // Compute stats
  const hot     = alerts.filter(a => a.relevance_score >= 8).length;
  const permits = alerts.filter(a => a.alert_type === "permit_expired").length;
  const sales   = alerts.filter(a => a.alert_type === "new_property_sale").length;

  const filtered = alerts.filter(a => {
    const matchesTab    = filter === "all" || a.alert_type === filter;
    const matchesSearch = !search || a.title.toLowerCase().includes(search.toLowerCase()) || a.property_name.toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const FILTER_TABS: { key: FilterTab; label: string }[] = [
    { key: "all",              label: "All" },
    { key: "permit_expired",   label: "Permit Flags" },
    { key: "pain_signal",      label: "Pain Signals" },
    { key: "new_property_sale", label: "Property Sales" },
    { key: "competitor_news",  label: "Competitor" },
  ];

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] p-6">
      <div className="max-w-7xl mx-auto space-y-5">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-lg"
            style={{ background: "linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)" }}
          >
            SC
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-gray-900">SCOUT — Market Intelligence</h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "#F3E8FF", color: "#7C3AED" }}>AI AGENT</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">v1.1</span>
              {!scanning && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: "#7C3AED" }} />
                  <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "#7C3AED" }} />
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">Scans permit records · Monitors competitor pain · Detects new property sales · Feeds ARIA handoff packets</p>
          </div>
        </div>

        {/* ── Stats bar ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Total Alerts",   value: alerts.length,  color: "#7C3AED", icon: Radar        },
            { label: "Hot Signals",    value: hot,            color: "#EF4444", icon: Flame        },
            { label: "Permit Flags",   value: permits,        color: "#F59E0B", icon: AlertTriangle },
            { label: "Property Sales", value: sales,          color: "#3B82F6", icon: Building2    },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${stat.color}18` }}
              >
                <stat.icon size={16} style={{ color: stat.color }} />
              </div>
              <div>
                <p className="text-2xl font-black tabular-nums" style={{ color: stat.color }}>{stat.value}</p>
                <p className="text-[10px] text-gray-400 font-medium">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Scan controls ─────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <MapPin size={13} className="text-gray-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Territory</span>
            </div>
            <input
              value={scanCity}
              onChange={e => setScanCity(e.target.value)}
              placeholder="City"
              className="h-9 w-36 px-3 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-800 focus:outline-none focus:border-[#7C3AED]/50 focus:bg-white transition-all"
            />
            <input
              value={scanState}
              onChange={e => setScanState(e.target.value)}
              placeholder="State (e.g. GA)"
              className="h-9 w-28 px-3 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-800 focus:outline-none focus:border-[#7C3AED]/50 focus:bg-white transition-all"
            />
            <button
              onClick={runScan}
              disabled={scanning}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-white font-semibold text-sm shadow-sm transition-all disabled:opacity-50 ml-auto"
              style={{
                background: scanning ? "#9CA3AF" : "linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)",
                boxShadow: scanning ? "none" : "0 4px 14px rgba(124,58,237,0.35)",
              }}
            >
              {scanning ? (
                <><Loader2 size={14} className="animate-spin" /> Scanning…</>
              ) : (
                <><Radar size={14} /> Run Scout Scan</>
              )}
            </button>
          </div>

          {/* Scan result / error feedback */}
          {scanResult && (
            <div className="mt-3 flex items-center gap-2 text-sm text-emerald-600 font-medium">
              <CheckCircle2 size={14} />
              Scan complete — {scanResult.new_alerts} new alert{scanResult.new_alerts !== 1 ? "s" : ""} added
            </div>
          )}
          {scanError && (
            <div className="mt-3 flex items-center gap-2 text-sm text-red-600">
              <AlertTriangle size={14} />
              {scanError}
            </div>
          )}

          {isDemo && (
            <p className="mt-3 text-[10px] text-gray-400 italic">Showing demo alerts — run a scan to load real market intelligence for your territory.</p>
          )}
        </div>

        {/* ── Filter tabs + search ───────────────────────────────────── */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 bg-white rounded-xl border border-gray-200 shadow-sm p-1">
            {FILTER_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                  filter === tab.key
                    ? "text-white shadow-sm"
                    : "text-gray-500 hover:bg-gray-100",
                )}
                style={filter === tab.key ? { background: "linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)" } : {}}
              >
                {tab.label}
                {tab.key !== "all" && (
                  <span className="ml-1.5 text-[9px] opacity-70">
                    {alerts.filter(a => a.alert_type === tab.key).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-1 max-w-xs bg-white rounded-xl border border-gray-200 shadow-sm px-3 py-2">
            <Search size={13} className="text-gray-400 shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search alerts…"
              className="flex-1 bg-transparent text-sm text-gray-800 placeholder:text-gray-400 outline-none"
            />
          </div>

          <span className="text-xs text-gray-400 ml-auto">{filtered.length} alert{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {/* ── Alert feed ────────────────────────────────────────────── */}
        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center">
                <Radar size={20} className="text-gray-300" />
              </div>
              <p className="text-sm font-semibold text-gray-500">No alerts match this filter</p>
              <p className="text-xs text-gray-400">Run a scan or adjust the filter.</p>
            </div>
          )}

          {filtered.map(alert => {
            const cfg = ALERT_TYPES[alert.alert_type] ?? ALERT_TYPES.pain_signal;
            const TypeIcon = cfg.icon;
            const isHot = alert.relevance_score >= 8;
            const alreadyCreated = leadCreated[alert.id];

            return (
              <div
                key={alert.id}
                className={cn(
                  "bg-white rounded-2xl border shadow-sm p-5 transition-all",
                  alert.actioned ? "border-gray-100 opacity-60" : "border-gray-200 hover:shadow-md",
                )}
              >
                <div className="flex items-start gap-4">

                  {/* Icon */}
                  <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", cfg.bg, cfg.border, "border")}>
                    <TypeIcon size={16} className={cfg.text} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 flex-wrap mb-1">
                      <h3 className="text-sm font-bold text-gray-900 leading-snug flex-1">{alert.title}</h3>
                      {isHot && (
                        <span className="shrink-0 text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 flex items-center gap-1">
                          <Flame size={8} /> HOT
                        </span>
                      )}
                      <span className={cn("shrink-0 text-[9px] font-bold px-2 py-0.5 rounded-full border", cfg.badge)}>
                        {cfg.label}
                      </span>
                    </div>

                    <p className="text-xs text-gray-600 leading-relaxed mb-3">{alert.summary}</p>

                    {/* Meta row */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-1 text-[10px] text-gray-400">
                        <Building2 size={10} />
                        {alert.property_name}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-gray-400">
                        <MapPin size={10} />
                        {[alert.city, alert.state].filter(Boolean).join(", ")}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-gray-400">
                        <Clock size={10} />
                        {timeAgo(alert.created_at)}
                      </div>
                    </div>

                    {/* Relevance bar */}
                    <div className="mt-3">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">Relevance Score</p>
                      <RelevanceBar score={alert.relevance_score} />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 shrink-0">
                    {alert.source_url && (
                      <a
                        href={alert.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[10px] text-[#7C3AED] font-medium hover:underline"
                      >
                        <Globe size={10} />
                        Source
                      </a>
                    )}
                    <button
                      onClick={() => createLead(alert)}
                      disabled={!!alreadyCreated || creatingLead === alert.id}
                      className={cn(
                        "flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg font-semibold transition-all disabled:opacity-60",
                        alreadyCreated
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "text-white",
                      )}
                      style={alreadyCreated ? {} : { background: "linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)" }}
                    >
                      {creatingLead === alert.id ? (
                        <Loader2 size={10} className="animate-spin" />
                      ) : alreadyCreated ? (
                        <><Check size={10} /> Lead Created</>
                      ) : (
                        <>+ Create Lead</>
                      )}
                    </button>
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
