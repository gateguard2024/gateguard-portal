"use client";

import { useState, useEffect } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { AISearch } from "@/components/ai/AISearch";
import { Award, Clock, Star, Info, Loader2 } from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { PhoneCall } = require('lucide-react') as any;

interface DealerData {
  id:              string;
  name:            string;
  location:        string;
  tier:            string;
  tier_label:      string | null;
  certified:       boolean;
  score:           number | null;
  responseTimeRaw: number | null;   // hours, lower is better
  completionRate:  number | null;   // % of WOs completed
  site_count:      number;
  total_wos:       number;
}

function scoreColor(score: number | null): string {
  if (score === null) return "text-muted-foreground";
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-amber-400";
  return "text-red-400";
}

function scoreBg(score: number | null): string {
  if (score === null) return "bg-muted";
  if (score >= 80) return "bg-emerald-400";
  if (score >= 60) return "bg-amber-400";
  return "bg-red-400";
}

function metricBarColor(value: number, isResponseTime = false): string {
  if (isResponseTime) {
    if (value <= 2) return "bg-emerald-400";
    if (value <= 4) return "bg-amber-400";
    return "bg-red-400";
  }
  if (value >= 85) return "bg-emerald-400";
  if (value >= 70) return "bg-amber-400";
  return "bg-red-400";
}

function ProgressBar({
  value,
  max = 100,
  color,
}: {
  value: number;
  max?: number;
  color: string;
}) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full ${color} transition-all`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function DealerCard({ dealer }: { dealer: DealerData }) {
  const rtPct     = dealer.responseTimeRaw !== null
    ? Math.max(0, 100 - (dealer.responseTimeRaw / 8) * 100)
    : 0;
  const rtBarColor = dealer.responseTimeRaw !== null
    ? metricBarColor(dealer.responseTimeRaw, true)
    : "bg-muted";
  const rtLabel    = dealer.responseTimeRaw !== null
    ? `${dealer.responseTimeRaw} hrs`
    : "No data";

  const score = dealer.score ?? 0;

  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{dealer.name}</p>
          <p className="text-xs text-muted-foreground">
            {dealer.tier_label ?? dealer.tier}
            {dealer.location ? ` · ${dealer.location}` : ''}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {dealer.certified && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-400/10 text-brand-400 border border-brand-400/20">
              <Award size={10} />
              GateGuard Certified
            </span>
          )}
          <div className="text-right">
            <p className={`text-2xl font-bold leading-tight ${scoreColor(dealer.score)}`}>
              {dealer.score !== null ? dealer.score : '—'}
            </p>
            <p className="text-[10px] text-muted-foreground">/ 100</p>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="space-y-2.5">
        {dealer.responseTimeRaw !== null && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-muted-foreground">Avg Response Time</span>
              <span className="text-[11px] font-medium text-foreground">{rtLabel}</span>
            </div>
            <ProgressBar value={rtPct} max={100} color={rtBarColor} />
          </div>
        )}

        {dealer.completionRate !== null && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-muted-foreground">WO Completion Rate</span>
              <span className="text-[11px] font-medium text-foreground">{dealer.completionRate}%</span>
            </div>
            <ProgressBar
              value={dealer.completionRate}
              color={metricBarColor(dealer.completionRate)}
            />
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-muted-foreground">Properties</span>
            <span className="text-[11px] font-medium text-foreground">{dealer.site_count}</span>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-muted-foreground">Total Work Orders</span>
            <span className="text-[11px] font-medium text-foreground">{dealer.total_wos}</span>
          </div>
        </div>
      </div>

      {/* Score bar */}
      {dealer.score !== null && (
        <div className="pt-1 border-t border-border">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-muted-foreground font-medium">Overall Score</span>
            <span className={`text-[11px] font-bold ${scoreColor(dealer.score)}`}>
              {dealer.score}/100
            </span>
          </div>
          <ProgressBar value={score} color={scoreBg(dealer.score)} />
        </div>
      )}

      {dealer.score === null && (
        <div className="pt-1 border-t border-border">
          <p className="text-[11px] text-muted-foreground">No work order data yet — score pending</p>
        </div>
      )}
    </div>
  );
}

export default function ScorecardPage() {
  const [dealers, setDealers] = useState<DealerData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/scorecard')
      .then(r => r.json())
      .then(data => {
        const mapped: DealerData[] = (data.scorecards ?? []).map((s: any) => ({
          id:              s.id,
          name:            s.name,
          location:        s.location ?? '',
          tier:            s.tier ?? '',
          tier_label:      s.tier_label ?? null,
          certified:       s.certified ?? false,
          score:           s.score ?? null,
          responseTimeRaw: s.avg_response_hrs ?? null,
          completionRate:  s.completion_rate ?? null,
          site_count:      s.site_count ?? 0,
          total_wos:       s.total_wos ?? 0,
        }))
        setDealers(mapped)
      })
      .catch(err => console.error('[scorecard] fetch error:', err))
      .finally(() => setLoading(false))
  }, [])

  const certifiedCount = dealers.filter(d => d.certified).length
  const avgResponse    = dealers.filter(d => d.responseTimeRaw !== null).length > 0
    ? (dealers.filter(d => d.responseTimeRaw !== null)
        .reduce((a, d) => a + (d.responseTimeRaw ?? 0), 0) /
       dealers.filter(d => d.responseTimeRaw !== null).length).toFixed(1)
    : null
  const avgCompletion  = dealers.filter(d => d.completionRate !== null).length > 0
    ? Math.round(dealers.filter(d => d.completionRate !== null)
        .reduce((a, d) => a + (d.completionRate ?? 0), 0) /
       dealers.filter(d => d.completionRate !== null).length)
    : null

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <TopBar title="Dealer Scorecard" subtitle="Performance ratings across the GateGuard dealer network" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={28} className="animate-spin text-brand-400" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <TopBar
        title="Dealer Scorecard"
        subtitle="Performance ratings across the GateGuard dealer network"
      />

      <div className="flex-1 p-6 space-y-6 max-w-screen-xl mx-auto w-full">
        {/* AI Search */}
        <AISearch placeholder='Try "show dealers below 70 score" or "certified dealers by NPS"' />

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-brand-400/10">
              <Star size={16} className="text-brand-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{avgCompletion !== null ? `${avgCompletion}%` : '—'}</p>
              <p className="text-xs text-muted-foreground">Avg Completion Rate</p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-brand-400/10">
              <Clock size={16} className="text-brand-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{avgResponse !== null ? `${avgResponse} hrs` : '—'}</p>
              <p className="text-xs text-muted-foreground">Avg Response Time</p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-400/10">
              <PhoneCall size={16} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{dealers.length}</p>
              <p className="text-xs text-muted-foreground">Total Dealer Orgs</p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-brand-400/10">
              <Award size={16} className="text-brand-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{certifiedCount} of {dealers.length}</p>
              <p className="text-xs text-muted-foreground">Certified Dealers</p>
            </div>
          </div>
        </div>

        {/* Dealer Grid */}
        {dealers.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground text-sm">
            No dealer organizations found. Add orgs via the admin panel to populate this scorecard.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {dealers.map((dealer) => (
              <DealerCard key={dealer.id} dealer={dealer} />
            ))}
          </div>
        )}

        {/* Footer Note */}
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-brand-400/5 border border-brand-400/15">
          <Info size={14} className="text-brand-400 shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Dealers scoring{" "}
            <span className="font-semibold text-foreground">80+</span> earn{" "}
            <span className="font-semibold text-brand-400">GateGuard Certified</span>{" "}
            status and receive priority lead routing. Score is computed from WO completion rate and average response time.
          </p>
        </div>
      </div>
    </div>
  );
}
