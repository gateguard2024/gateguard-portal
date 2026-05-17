"use client";

import { TopBar } from "@/components/layout/TopBar";
import { AISearch } from "@/components/ai/AISearch";
import { Clock, Star, Info } from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Award, PhoneCall } = require("lucide-react") as any;

interface DealerData {
  name: string;
  location: string;
  certified: boolean;
  score: number;
  responseTime: string;
  responseTimeRaw: number; // hours, lower is better (max 8)
  fcr: number;
  nps: number;
  renewalRate: number;
  uptime: number;
}

const DEALERS: DealerData[] = [
  {
    name: "GateGuard Direct",
    location: "Atlanta, GA",
    certified: true,
    score: 94,
    responseTime: "0.8 hr",
    responseTimeRaw: 0.8,
    fcr: 96,
    nps: 88,
    renewalRate: 98,
    uptime: 99.2,
  },
  {
    name: "Southeast Security Group",
    location: "Atlanta, GA",
    certified: true,
    score: 89,
    responseTime: "1.2 hr",
    responseTimeRaw: 1.2,
    fcr: 91,
    nps: 81,
    renewalRate: 96,
    uptime: 98.1,
  },
  {
    name: "Columbia Residential Tech",
    location: "Columbia, SC",
    certified: true,
    score: 84,
    responseTime: "1.9 hr",
    responseTimeRaw: 1.9,
    fcr: 88,
    nps: 74,
    renewalRate: 94,
    uptime: 97.4,
  },
  {
    name: "Peach State Access",
    location: "Macon, GA",
    certified: false,
    score: 71,
    responseTime: "3.1 hr",
    responseTimeRaw: 3.1,
    fcr: 82,
    nps: 61,
    renewalRate: 88,
    uptime: 94.2,
  },
  {
    name: "Coastal Access Solutions",
    location: "Savannah, GA",
    certified: false,
    score: 67,
    responseTime: "4.2 hr",
    responseTimeRaw: 4.2,
    fcr: 78,
    nps: 58,
    renewalRate: 85,
    uptime: 93.8,
  },
  {
    name: "Metro Install Group",
    location: "Charlotte, NC",
    certified: false,
    score: 52,
    responseTime: "6.8 hr",
    responseTimeRaw: 6.8,
    fcr: 71,
    nps: 44,
    renewalRate: 79,
    uptime: 91.0,
  },
];

function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-amber-400";
  return "text-red-400";
}

function scoreBg(score: number): string {
  if (score >= 80) return "bg-emerald-400";
  if (score >= 60) return "bg-amber-400";
  return "bg-red-400";
}

function metricBarColor(value: number, isResponseTime = false): string {
  // For response time: lower is better
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
  // Response time bar: invert — 0 hr = 100%, 8 hr = 0%
  const rtPct = Math.max(0, 100 - (dealer.responseTimeRaw / 8) * 100);
  const rtBarColor = metricBarColor(dealer.responseTimeRaw, true);

  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{dealer.name}</p>
          <p className="text-xs text-muted-foreground">{dealer.location}</p>
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
              {dealer.score}
            </p>
            <p className="text-[10px] text-muted-foreground">/ 100 · Q2 2026</p>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="space-y-2.5">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-muted-foreground">Response Time</span>
            <span className="text-[11px] font-medium text-foreground">{dealer.responseTime}</span>
          </div>
          <ProgressBar value={rtPct} max={100} color={rtBarColor} />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-muted-foreground">First-Call Resolution</span>
            <span className="text-[11px] font-medium text-foreground">{dealer.fcr}%</span>
          </div>
          <ProgressBar
            value={dealer.fcr}
            color={metricBarColor(dealer.fcr)}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-muted-foreground">NPS Score</span>
            <span className="text-[11px] font-medium text-foreground">{dealer.nps}</span>
          </div>
          <ProgressBar
            value={dealer.nps}
            color={metricBarColor(dealer.nps)}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-muted-foreground">Renewal Rate</span>
            <span className="text-[11px] font-medium text-foreground">{dealer.renewalRate}%</span>
          </div>
          <ProgressBar
            value={dealer.renewalRate}
            color={metricBarColor(dealer.renewalRate)}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-muted-foreground">Camera Uptime</span>
            <span className="text-[11px] font-medium text-foreground">{dealer.uptime}%</span>
          </div>
          <ProgressBar
            value={dealer.uptime}
            color={metricBarColor(dealer.uptime)}
          />
        </div>
      </div>

      {/* Score bar */}
      <div className="pt-1 border-t border-border">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] text-muted-foreground font-medium">Overall Score</span>
          <span className={`text-[11px] font-bold ${scoreColor(dealer.score)}`}>
            {dealer.score}/100
          </span>
        </div>
        <ProgressBar value={dealer.score} color={scoreBg(dealer.score)} />
      </div>
    </div>
  );
}

export default function ScorecardPage() {
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
              <p className="text-2xl font-bold text-foreground">72</p>
              <p className="text-xs text-muted-foreground">Network Avg NPS</p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-brand-400/10">
              <Clock size={16} className="text-brand-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">2.4 hrs</p>
              <p className="text-xs text-muted-foreground">Avg Response Time</p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-400/10">
              <PhoneCall size={16} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">87%</p>
              <p className="text-xs text-muted-foreground">First-Call Resolution</p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-brand-400/10">
              <Award size={16} className="text-brand-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">3 of 8</p>
              <p className="text-xs text-muted-foreground">Certified Dealers</p>
            </div>
          </div>
        </div>

        {/* Dealer Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {DEALERS.map((dealer) => (
            <DealerCard key={dealer.name} dealer={dealer} />
          ))}
        </div>

        {/* Footer Note */}
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-brand-400/5 border border-brand-400/15">
          <Info size={14} className="text-brand-400 shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Dealers scoring{" "}
            <span className="font-semibold text-foreground">80+</span> for 2
            consecutive quarters earn{" "}
            <span className="font-semibold text-brand-400">GateGuard Certified</span>{" "}
            status and receive priority lead routing.
          </p>
        </div>
      </div>
    </div>
  );
}
