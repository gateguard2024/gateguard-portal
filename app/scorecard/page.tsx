"use client";

import { useState, useEffect, useCallback } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { AISearch } from "@/components/ai/AISearch";
import { Clock, Star, Info, Loader2, RefreshCw } from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Award, PhoneCall } = require("lucide-react") as any;

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

function ProgressBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function ScorecardCard({ entry }: { entry: ScorecardEntry }) {
  const m = entry.metrics;
  const rtPct = Math.max(0, 100 - (m.response_time_hrs / 8) * 100);
  const now = new Date();
  const quarter = `Q${Math.ceil((now.getMonth() + 1) / 3)} ${now.getFullYear()}`;

  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{entry.name}</p>
          <p className="text-xs text-muted-foreground">{entry.location || "—"}</p>
          {m.total_wos > 0 && (
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">{m.total_wos} WOs · {m.total_permits} permits tracked</p>
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

      <div className="space-y-2.5">
        {[
          { label: "Response Time", value: `${m.response_time_hrs} hr`, bar: rtPct, color: metricBarColor(m.response_time_hrs, true), isRT: true },
          { label: "First-Call Resolution", value: `${m.fcr_pct}%`, bar: m.fcr_pct, color: metricBarColor(m.fcr_pct), isRT: false },
          { label: "Compliance",    value: `${m.compliance_pct}%`, bar: m.compliance_pct, color: metricBarColor(m.compliance_pct), isRT: false },
          { label: "On-Time WOs",   value: `${m.uptime_pct}%`, bar: m.uptime_pct, color: metricBarColor(m.uptime_pct), isRT: false },
          { label: "NPS Proxy",     value: String(m.nps_proxy), bar: m.nps_proxy, color: metricBarColor(m.nps_proxy), isRT: false },
        ].map(row => (
          <div key={row.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-muted-foreground">{row.label}</span>
              <span className="text-[11px] font-medium text-foreground">{row.value}</span>
            </div>
            <ProgressBar value={row.bar} color={row.color} />
          </div>
        ))}
      </div>

      <div className="pt-1 border-t border-border">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] text-muted-foreground font-medium">Overall Score</span>
          <span className={`text-[11px] font-bold ${scoreColor(entry.score)}`}>{entry.score}/100</span>
        </div>
        <ProgressBar value={entry.score} color={scoreBg(entry.score)} />
      </div>
    </div>
  );
}

export default function ScorecardPage() {
  const [scorecards, setScorecards] = useState<ScorecardEntry[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch("/api/scorecard");
      const data = await res.json();
      setScorecards(data.scorecards ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const certifiedCount  = scorecards.filter(s => s.certified).length;
  const avgScore        = scorecards.length
    ? Math.round(scorecards.reduce((s, e) => s + e.score, 0) / scorecards.length)
    : 0;
  const avgRT           = scorecards.length
    ? (scorecards.reduce((s, e) => s + e.metrics.response_time_hrs, 0) / scorecards.length).toFixed(1)
    : "—";
  const avgFCR          = scorecards.length
    ? Math.round(scorecards.reduce((s, e) => s + e.metrics.fcr_pct, 0) / scorecards.length)
    : 0;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <TopBar
        title="Dealer Scorecard"
        subtitle="Performance ratings across the GateGuard dealer network"
        actions={
          <button onClick={load} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-accent transition-colors">
            <RefreshCw size={12} /> Refresh
          </button>
        }
      />

      <div className="flex-1 p-6 space-y-6 max-w-screen-xl mx-auto w-full">
        <AISearch placeholder='Try "show dealers below 70 score" or "certified dealers by NPS"' />

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Star,     iconCls: "text-brand-400",   bg: "bg-brand-400/10",   value: loading ? "—" : String(avgScore), label: "Network Avg Score" },
            { icon: Clock,    iconCls: "text-brand-400",   bg: "bg-brand-400/10",   value: loading ? "—" : `${avgRT} hrs`,  label: "Avg Response Time" },
            { icon: PhoneCall,iconCls: "text-emerald-400", bg: "bg-emerald-400/10", value: loading ? "—" : `${avgFCR}%`,    label: "Avg FCR" },
            { icon: Award,    iconCls: "text-brand-400",   bg: "bg-brand-400/10",   value: loading ? "—" : `${certifiedCount} of ${scorecards.length}`, label: "Certified Dealers" },
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

        {/* States */}
        {loading && (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <Loader2 size={18} className="animate-spin" /> Computing scorecards…
          </div>
        )}

        {!loading && error && (
          <div className="flex items-center justify-center py-16 gap-3">
            <span className="text-sm text-destructive">{error}</span>
            <button onClick={load} className="flex items-center gap-1.5 text-xs border border-border rounded-lg px-3 py-1.5 text-muted-foreground hover:text-foreground hover:bg-accent">
              <RefreshCw size={12} /> Retry
            </button>
          </div>
        )}

        {!loading && !error && scorecards.length === 0 && (
          <div className="text-center py-16 text-muted-foreground text-sm">
            <Award size={32} className="mx-auto mb-3 opacity-30" />
            <p>No dealer data yet. Add dealers and work orders to see scorecards.</p>
          </div>
        )}

        {!loading && !error && scorecards.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {scorecards.map(entry => (
              <ScorecardCard key={entry.org_id} entry={entry} />
            ))}
          </div>
        )}

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
