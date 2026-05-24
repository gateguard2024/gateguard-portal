"use client";

import { useState, useEffect, useCallback } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { AISearch } from "@/components/ai/AISearch";
import { Clock, Star, Info, Loader2, RefreshCw, Users, ChevronDown, ChevronUp } from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Award, PhoneCall, TrendingUp: TrendingUpIcon, TrendingDown: TrendingDownIcon, LayoutGrid, List } = require("lucide-react") as any;
import { useUser } from "@clerk/nextjs";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScorecardEntry {
  org_id: string;
  name: string;
  org_tier: string;
  location: string;
  score: number;
  certified: boolean;
  metrics: {
    response_time_hrs: number;
    fcr_pct: number;
    compliance_pct: number;
    uptime_pct: number;
    nps_proxy: number;
    total_wos: number;
    completed_wos: number;
    total_permits: number;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number) {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-amber-400";
  return "text-red-400";
}

function scoreBg(score: number) {
  if (score >= 80) return "bg-emerald-400";
  if (score >= 60) return "bg-amber-400";
  return "bg-red-400";
}

function metricBarColor(value: number, isResponseTime = false) {
  if (isResponseTime) {
    if (value <= 2) return "bg-emerald-400";
    if (value <= 4) return "bg-amber-400";
    return "bg-red-400";
  }
  if (value >= 85) return "bg-emerald-400";
  if (value >= 70) return "bg-amber-400";
  return "bg-red-400";
}

/** Weak metric = lowest percentage-based metric */
function weakestMetric(m: ScorecardEntry["metrics"]): string {
  const candidates = [
    { label: "First-Call Resolution", value: m.fcr_pct },
    { label: "Compliance",            value: m.compliance_pct },
    { label: "On-Time Work Orders",   value: m.uptime_pct },
    { label: "NPS Score",             value: m.nps_proxy },
  ];
  candidates.sort((a, b) => a.value - b.value);
  return candidates[0]?.label ?? "Response Time";
}

/** Generate mock 6-month sparkline data (random walk around current value). */
function mockSparkline(current: number, maxVal = 100): number[] {
  // TODO: replace with dealer_scorecards historical table once migration 021 runs on prod.
  const out: number[] = [];
  let v = Math.max(10, current - 15);
  for (let i = 0; i < 6; i++) {
    v = Math.min(maxVal, Math.max(0, v + (Math.random() * 12 - 5)));
    out.push(Math.round(v));
  }
  out[5] = current; // ensure last point = current value
  return out;
}

/** Compute a mock trend (compare last point to first point of sparkline). */
function trendFromSparkline(values: number[]): number {
  return values[values.length - 1] - values[0];
}

// ─── Dealer Tier ──────────────────────────────────────────────────────────────

function dealerTier(score: number): { label: string; color: string; bg: string; icon: string } {
  if (score >= 95) return { label: 'Elite',      color: '#a855f7', bg: 'bg-purple-50',  icon: '💎' }
  if (score >= 85) return { label: 'Certified',  color: '#10b981', bg: 'bg-emerald-50', icon: '🏅' }
  if (score >= 75) return { label: 'Gold',       color: '#f59e0b', bg: 'bg-amber-50',   icon: '🥇' }
  if (score >= 60) return { label: 'Silver',     color: '#64748b', bg: 'bg-slate-100',  icon: '🥈' }
  return                  { label: 'Bronze',     color: '#b45309', bg: 'bg-orange-50',  icon: '🥉' }
}

function tierProgress(score: number): { current: string; next: string | null; pct: number; ptsToNext: number } {
  if (score >= 95) return { current: 'Elite',     next: null,        pct: 100,                          ptsToNext: 0 }
  if (score >= 85) return { current: 'Certified', next: 'Elite',     pct: ((score - 85) / 10) * 100,   ptsToNext: 95 - score }
  if (score >= 75) return { current: 'Gold',      next: 'Certified', pct: ((score - 75) / 10) * 100,   ptsToNext: 85 - score }
  if (score >= 60) return { current: 'Silver',    next: 'Gold',      pct: ((score - 60) / 15) * 100,   ptsToNext: 75 - score }
  return                  { current: 'Bronze',    next: 'Silver',    pct: (score / 60) * 100,           ptsToNext: 60 - score }
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const max   = Math.max(...values, 1);
  const min   = Math.min(...values);
  const range = max - min || 1;
  const points = values
    .map((v, i) => `${(i / (values.length - 1)) * 76},${28 - ((v - min) / range) * 24}`)
    .join(" ");
  return (
    <svg viewBox="0 0 76 28" className="w-16 h-6 opacity-70">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── ProgressBar ──────────────────────────────────────────────────────────────

function ProgressBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ─── Rank Badge ───────────────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-base">🥇</span>;
  if (rank === 2) return <span className="text-base">🥈</span>;
  if (rank === 3) return <span className="text-base">🥉</span>;
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-muted text-muted-foreground text-xs font-semibold">
      {rank}
    </span>
  );
}

// ─── Tier Badge ───────────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    corporate:       { label: "Corporate",  cls: "bg-brand-400/10 text-brand-400" },
    master_dealer:   { label: "MSO",        cls: "bg-violet-400/10 text-violet-400" },
    full_dealer:     { label: "Dealer",     cls: "bg-sky-400/10 text-sky-400" },
    service_dealer:  { label: "Service",    cls: "bg-emerald-400/10 text-emerald-400" },
    install_contractor: { label: "Install", cls: "bg-teal-400/10 text-teal-400" },
    sales_partner:   { label: "Sales",      cls: "bg-amber-400/10 text-amber-400" },
    client:          { label: "Client",     cls: "bg-orange-400/10 text-orange-400" },
  };
  const t = map[tier] ?? { label: tier, cls: "bg-muted text-muted-foreground" };
  return (
    <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide ${t.cls}`}>
      {t.label}
    </span>
  );
}

// ─── Scorecard Card (grid view) ────────────────────────────────────────────────

function ScorecardCard({ entry }: { entry: ScorecardEntry }) {
  const m = entry.metrics;
  const rtPct = Math.max(0, 100 - (m.response_time_hrs / 8) * 100);
  const quarter = `Q${Math.ceil((new Date().getMonth() + 1) / 3)} ${new Date().getFullYear()}`;

  // Sparkline data (mock historical)
  const sparklines = {
    rt:         mockSparkline(rtPct),
    fcr:        mockSparkline(m.fcr_pct),
    compliance: mockSparkline(m.compliance_pct),
    uptime:     mockSparkline(m.uptime_pct),
    nps:        mockSparkline(m.nps_proxy),
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{entry.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <TierBadge tier={entry.org_tier} />
            <p className="text-xs text-muted-foreground">{entry.location || "—"}</p>
          </div>
          {m.total_wos > 0 && (
            <p className="text-[10px] text-muted-foreground/60 mt-1">{m.total_wos} WOs · {m.total_permits} permits</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {entry.certified && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-400/10 text-brand-400 border border-brand-400/20">
              <Award size={10} /> GateGuard Certified
            </span>
          )}
          <div className="text-right">
            <p className={`text-2xl font-bold leading-tight ${scoreColor(entry.score)}`}>{entry.score}</p>
            <p className="text-[10px] text-muted-foreground">/ 100 · {quarter}</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {[
          { label: "Response Time", value: `${m.response_time_hrs} hr`, bar: rtPct,           color: metricBarColor(m.response_time_hrs, true), spark: sparklines.rt,         sparkColor: "#6B7EFF" },
          { label: "First-Call Resolution", value: `${m.fcr_pct}%`,    bar: m.fcr_pct,        color: metricBarColor(m.fcr_pct),                 spark: sparklines.fcr,        sparkColor: "#34d399" },
          { label: "Compliance",    value: `${m.compliance_pct}%`,       bar: m.compliance_pct, color: metricBarColor(m.compliance_pct),          spark: sparklines.compliance, sparkColor: "#34d399" },
          { label: "On-Time WOs",   value: `${m.uptime_pct}%`,           bar: m.uptime_pct,     color: metricBarColor(m.uptime_pct),              spark: sparklines.uptime,     sparkColor: "#34d399" },
          { label: "NPS Proxy",     value: String(m.nps_proxy),          bar: m.nps_proxy,      color: metricBarColor(m.nps_proxy),               spark: sparklines.nps,        sparkColor: "#fbbf24" },
        ].map(row => (
          <div key={row.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-muted-foreground">{row.label}</span>
              <div className="flex items-center gap-2">
                <Sparkline values={row.spark} color={row.sparkColor} />
                <span className="text-[11px] font-medium text-foreground">{row.value}</span>
              </div>
            </div>
            <ProgressBar value={row.bar} color={row.color} />
          </div>
        ))}
      </div>

      <div className="pt-1 border-t border-border">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] text-muted-foreground font-medium">Overall Score</span>
          <div className="flex items-center gap-2">
            {(() => {
              const tier = dealerTier(entry.score)
              return (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${tier.bg}`} style={{ color: tier.color }}>
                  {tier.icon} {tier.label}
                </span>
              )
            })()}
            <span className={`text-[11px] font-bold ${scoreColor(entry.score)}`}>{entry.score}/100</span>
          </div>
        </div>
        <ProgressBar value={entry.score} color={scoreBg(entry.score)} />
        {(() => {
          const tp = tierProgress(entry.score)
          if (!tp.next) return null
          return (
            <div className="mt-2 space-y-1">
              <div className="w-full h-1 bg-border rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-brand-400/60 transition-all" style={{ width: `${tp.pct}%` }} />
              </div>
              <p className="text-[10px] text-muted-foreground/70">{tp.ptsToNext} pt{tp.ptsToNext !== 1 ? 's' : ''} to {tp.next}</p>
            </div>
          )
        })()}
      </div>
    </div>
  );
}

// ─── Dealer Self-View ─────────────────────────────────────────────────────────

function DealerSelfView({ entry }: { entry: ScorecardEntry }) {
  const [openSection, setOpenSection] = useState<string | null>(null);
  const m           = entry.metrics;
  const quarter     = `Q${Math.ceil((new Date().getMonth() + 1) / 3)} ${new Date().getFullYear()}`;
  const pointsAway  = Math.max(0, 80 - entry.score);
  const weakest     = weakestMetric(m);

  const tips: Record<string, string> = {
    "First-Call Resolution": "Focus on resolving issues during the first service visit. Review unresolved tickets and identify recurring failure points.",
    "Compliance":            "Audit your permit expiry dates weekly. Set a calendar reminder 30 days before each expiry to start renewal.",
    "On-Time Work Orders":   "Review work orders that missed SLA. Look for scheduling gaps or parts availability issues causing delays.",
    "NPS Score":             "Send a brief satisfaction survey after each completed work order. Quick follow-up is the easiest NPS booster.",
    "Response Time":         "Aim for sub-2-hour acknowledgment on all new work orders. Triage open tickets each morning.",
  };

  const explanations: Record<string, string> = {
    "Response Time":        "How quickly your team acknowledges and begins work on new service requests. Target: under 2 hours.",
    "First-Call Resolution":"Percentage of work orders resolved in a single visit. Higher is better. Target: 80%+.",
    "Compliance":           "Percentage of permits and licenses that are current and not expired. Target: 100%.",
    "On-Time WOs":          "Percentage of work orders completed by their scheduled due date. Target: 85%+.",
    "NPS Proxy":            "Estimated net promoter score based on completion quality and resolution rates. Target: 70+.",
  };

  const metrics = [
    { label: "Response Time", value: `${m.response_time_hrs} hrs`, explanation: explanations["Response Time"] },
    { label: "First-Call Resolution", value: `${m.fcr_pct}%`, explanation: explanations["First-Call Resolution"] },
    { label: "Compliance", value: `${m.compliance_pct}%`, explanation: explanations["Compliance"] },
    { label: "On-Time WOs", value: `${m.uptime_pct}%`, explanation: explanations["On-Time WOs"] },
    { label: "NPS Proxy", value: String(m.nps_proxy), explanation: explanations["NPS Proxy"] },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Large score display */}
      <div className="bg-card border border-border rounded-xl p-8 flex flex-col items-center gap-4 text-center">
        <p className={`text-7xl font-bold leading-none ${scoreColor(entry.score)}`}>{entry.score}</p>
        <p className="text-base text-muted-foreground">out of 100 · {quarter}</p>

        {/* Dealer tier badge */}
        {(() => {
          const tier = dealerTier(entry.score)
          return (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${tier.bg}`} style={{ color: tier.color }}>
              {tier.icon} {tier.label} Tier
            </span>
          )
        })()}

        {entry.certified ? (
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-brand-400/10 text-brand-400 border border-brand-400/20">
            <Award size={14} /> GateGuard Certified
          </span>
        ) : (
          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">
              You are <span className="font-bold text-foreground">{pointsAway} point{pointsAway !== 1 ? "s" : ""}</span> away from{" "}
              <span className="font-semibold text-brand-400">GateGuard Certified</span>
            </p>
            <div className="w-48 h-2 bg-border rounded-full overflow-hidden mx-auto">
              <div className="h-full bg-brand-400 rounded-full" style={{ width: `${entry.score}%` }} />
            </div>
          </div>
        )}

        {/* Tier progress bar */}
        {(() => {
          const tp = tierProgress(entry.score)
          if (!tp.next) return null
          return (
            <div className="w-56 space-y-1">
              <div className="w-full h-1 bg-border rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-brand-400/60 transition-all" style={{ width: `${tp.pct}%` }} />
              </div>
              <p className="text-[11px] text-muted-foreground">{tp.ptsToNext} pt{tp.ptsToNext !== 1 ? 's' : ''} to {tp.next}</p>
            </div>
          )
        })()}
      </div>

      {/* Per-metric expandable sections */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border">
          <p className="text-sm font-semibold">What This Means — Per Metric</p>
        </div>
        {metrics.map(metric => {
          const isOpen = openSection === metric.label;
          return (
            <div key={metric.label} className="border-b border-border/50 last:border-0">
              <button
                onClick={() => setOpenSection(isOpen ? null : metric.label)}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-accent/20 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-foreground">{metric.label}</span>
                  <span className="text-sm font-bold text-foreground">{metric.value}</span>
                </div>
                {isOpen ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
              </button>
              {isOpen && (
                <div className="px-5 pb-4 text-xs text-muted-foreground leading-relaxed bg-muted/20">
                  {metric.explanation}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Improvement tip */}
      <div className="bg-card border border-brand-400/20 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-brand-400/10 shrink-0">
            <TrendingUpIcon size={16} className="text-brand-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground mb-1">Top Improvement Area: {weakest}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{tips[weakest] ?? "Focus on consistent service quality across all metrics."}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Leaderboard Table ────────────────────────────────────────────────────────

type SortKey = "score" | "response_time_hrs" | "fcr_pct" | "compliance_pct" | "uptime_pct" | "nps_proxy";

function LeaderboardTable({ entries }: { entries: ScorecardEntry[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = [...entries].sort((a, b) => {
    let av: number, bv: number;
    if (sortKey === "score") {
      av = a.score; bv = b.score;
    } else {
      av = a.metrics[sortKey]; bv = b.metrics[sortKey];
    }
    return sortDir === "desc" ? bv - av : av - bv;
  });

  // Compute trend for each entry
  function trend(entry: ScorecardEntry): number {
    return trendFromSparkline(mockSparkline(entry.score));
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return null;
    return sortDir === "desc"
      ? <ChevronDown size={11} className="text-brand-400" />
      : <ChevronUp   size={11} className="text-brand-400" />;
  }

  const thCls = "px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap cursor-pointer hover:text-foreground transition-colors select-none";
  const tdCls = "px-4 py-3 text-sm align-middle";

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className={`${thCls} w-10 text-center`}>#</th>
              <th className={thCls} onClick={() => handleSort("score")}>
                <span className="inline-flex items-center gap-1">Dealer <SortIcon k="score" /></span>
              </th>
              <th className={`${thCls} text-center`} onClick={() => handleSort("score")}>
                <span className="inline-flex items-center gap-1">Score <SortIcon k="score" /></span>
              </th>
              <th className={thCls} onClick={() => handleSort("response_time_hrs")}>
                <span className="inline-flex items-center gap-1">Resp. Time <SortIcon k="response_time_hrs" /></span>
              </th>
              <th className={thCls} onClick={() => handleSort("fcr_pct")}>
                <span className="inline-flex items-center gap-1">FCR <SortIcon k="fcr_pct" /></span>
              </th>
              <th className={thCls} onClick={() => handleSort("compliance_pct")}>
                <span className="inline-flex items-center gap-1">Compliance <SortIcon k="compliance_pct" /></span>
              </th>
              <th className={thCls} onClick={() => handleSort("uptime_pct")}>
                <span className="inline-flex items-center gap-1">On-Time <SortIcon k="uptime_pct" /></span>
              </th>
              <th className={thCls} onClick={() => handleSort("nps_proxy")}>
                <span className="inline-flex items-center gap-1">NPS <SortIcon k="nps_proxy" /></span>
              </th>
              <th className={thCls}>Trend</th>
              <th className={`${thCls} text-right`}>Certified</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((entry, idx) => {
              const t        = trend(entry);
              const positive = t >= 0;
              return (
                <tr
                  key={entry.org_id}
                  className="border-b border-border/50 last:border-0 hover:bg-accent/30 transition-colors"
                >
                  <td className={`${tdCls} text-center`}>
                    <RankBadge rank={idx + 1} />
                  </td>
                  <td className={tdCls}>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-foreground">{entry.name}</p>
                        {(() => {
                          const tier = dealerTier(entry.score)
                          return (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${tier.bg}`} style={{ color: tier.color }}>
                              {tier.icon} {tier.label}
                            </span>
                          )
                        })()}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <TierBadge tier={entry.org_tier} />
                        {entry.location && <span className="text-[10px] text-muted-foreground">{entry.location}</span>}
                      </div>
                    </div>
                  </td>
                  <td className={`${tdCls} text-center`}>
                    <span className={`text-base font-bold ${scoreColor(entry.score)}`}>{entry.score}</span>
                  </td>
                  <td className={tdCls}>
                    <span className={entry.metrics.response_time_hrs <= 2 ? "text-emerald-400 font-medium" : entry.metrics.response_time_hrs <= 4 ? "text-amber-400 font-medium" : "text-red-400 font-medium"}>
                      {entry.metrics.response_time_hrs} hr
                    </span>
                  </td>
                  <td className={tdCls}>
                    <div className="flex items-center gap-2">
                      <span className="text-foreground">{entry.metrics.fcr_pct}%</span>
                      <div className="w-12 h-1.5 bg-border rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${metricBarColor(entry.metrics.fcr_pct)}`} style={{ width: `${entry.metrics.fcr_pct}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className={tdCls}>
                    <div className="flex items-center gap-2">
                      <span className="text-foreground">{entry.metrics.compliance_pct}%</span>
                      <div className="w-12 h-1.5 bg-border rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${metricBarColor(entry.metrics.compliance_pct)}`} style={{ width: `${entry.metrics.compliance_pct}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className={tdCls}>
                    <div className="flex items-center gap-2">
                      <span className="text-foreground">{entry.metrics.uptime_pct}%</span>
                      <div className="w-12 h-1.5 bg-border rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${metricBarColor(entry.metrics.uptime_pct)}`} style={{ width: `${entry.metrics.uptime_pct}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className={tdCls}>
                    <span className="text-foreground">{entry.metrics.nps_proxy}</span>
                  </td>
                  <td className={tdCls}>
                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${positive ? "text-emerald-400" : "text-red-400"}`}>
                      {positive ? <TrendingUpIcon size={12} /> : <TrendingDownIcon size={12} />}
                      {positive ? "+" : ""}{t}
                    </span>
                  </td>
                  <td className={`${tdCls} text-right`}>
                    {entry.certified ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-400/10 text-brand-400">
                        <Award size={9} /> Certified
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type ViewMode = "leaderboard" | "cards";

export default function ScorecardPage() {
  const { user, isLoaded } = useUser();
  const [scorecards, setScorecards] = useState<ScorecardEntry[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [viewMode,   setViewMode]   = useState<ViewMode>("leaderboard");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch("/api/scorecard");
      const data = await res.json() as { scorecards?: ScorecardEntry[] };
      setScorecards(data.scorecards ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Determine if this is a dealer-only view
  const isDealer = isLoaded && user &&
    (user.publicMetadata?.role === "dealer" || user.publicMetadata?.org_tier === "full_dealer");

  const certifiedCount = scorecards.filter(s => s.certified).length;
  const avgScore       = scorecards.length
    ? Math.round(scorecards.reduce((s, e) => s + e.score, 0) / scorecards.length)
    : 0;
  const avgRT          = scorecards.length
    ? (scorecards.reduce((s, e) => s + e.metrics.response_time_hrs, 0) / scorecards.length).toFixed(1)
    : "—";
  const avgFCR         = scorecards.length
    ? Math.round(scorecards.reduce((s, e) => s + e.metrics.fcr_pct, 0) / scorecards.length)
    : 0;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <TopBar
        title="Dealer Scorecard"
        subtitle="Performance ratings across the GateGuard dealer network"
        actions={
          <div className="flex items-center gap-2">
            {/* View toggle — only show for admins/corporate */}
            {!isDealer && (
              <div className="flex items-center border border-border rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode("leaderboard")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "leaderboard" ? "bg-brand-400 text-white" : "text-muted-foreground hover:text-foreground hover:bg-accent/30"}`}
                >
                  <List size={12} /> Leaderboard
                </button>
                <button
                  onClick={() => setViewMode("cards")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "cards" ? "bg-brand-400 text-white" : "text-muted-foreground hover:text-foreground hover:bg-accent/30"}`}
                >
                  <LayoutGrid size={12} /> Cards
                </button>
              </div>
            )}
            <button
              onClick={() => void load()}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-accent transition-colors"
            >
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
        }
      />

      <div className="flex-1 p-6 space-y-6 max-w-screen-xl mx-auto w-full">
        {!isDealer && (
          <AISearch placeholder='Try "show dealers below 70 score" or "certified dealers by NPS"' />
        )}

        {/* Stat Cards — only for admin/corporate */}
        {!isDealer && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: Star,      iconCls: "text-brand-400",   bg: "bg-brand-400/10",   value: loading ? "—" : String(avgScore),   label: "Network Avg Score" },
              { icon: Clock,     iconCls: "text-brand-400",   bg: "bg-brand-400/10",   value: loading ? "—" : `${avgRT} hrs`,     label: "Avg Response Time" },
              { icon: PhoneCall, iconCls: "text-emerald-400", bg: "bg-emerald-400/10", value: loading ? "—" : `${avgFCR}%`,       label: "Avg FCR" },
              { icon: Users,     iconCls: "text-brand-400",   bg: "bg-brand-400/10",   value: loading ? "—" : `${certifiedCount} of ${scorecards.length}`, label: "Certified Dealers" },
            ].map(card => (
              <div key={card.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                <div className={`p-2.5 rounded-lg ${card.bg}`}>
                  <card.icon size={16} className={card.iconCls} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{card.value}</p>
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <Loader2 size={18} className="animate-spin" /> Computing scorecards…
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="flex items-center justify-center py-16 gap-3">
            <span className="text-sm text-destructive">{error}</span>
            <button onClick={() => void load()} className="flex items-center gap-1.5 text-xs border border-border rounded-lg px-3 py-1.5 text-muted-foreground hover:text-foreground hover:bg-accent">
              <RefreshCw size={12} /> Retry
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && scorecards.length === 0 && (
          <div className="text-center py-16 text-muted-foreground text-sm">
            <Award size={32} className="mx-auto mb-3 opacity-30" />
            <p>No dealer data yet. Add dealers and work orders to see scorecards.</p>
          </div>
        )}

        {/* ── Dealer Self-View ─────────────────────────────────────────── */}
        {!loading && !error && isDealer && scorecards.length > 0 && (
          <DealerSelfView entry={scorecards[0]} />
        )}

        {/* ── Admin/Corporate Views ────────────────────────────────────── */}
        {!loading && !error && !isDealer && scorecards.length > 0 && (
          <>
            {viewMode === "leaderboard" && (
              <LeaderboardTable entries={scorecards} />
            )}
            {viewMode === "cards" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {scorecards.map(entry => (
                  <ScorecardCard key={entry.org_id} entry={entry} />
                ))}
              </div>
            )}
          </>
        )}

        {/* Info footer */}
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-brand-400/5 border border-brand-400/15">
          <Info size={14} className="text-brand-400 shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Dealers scoring <span className="font-semibold text-foreground">80+</span> earn{" "}
            <span className="font-semibold text-brand-400">GateGuard Certified</span> status and receive priority lead routing.
            Score weights: Response Time 25% · FCR 25% · Compliance 20% · On-Time WOs 20% · NPS 10%.
          </p>
        </div>
      </div>
    </div>
  );
}
