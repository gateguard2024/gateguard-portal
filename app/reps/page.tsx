"use client";

import { useEffect, useState } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { AISearch } from "@/components/ai/AISearch";
import {
  Users,
  TrendingUp,
  Clock,
  Plus,
  ChevronRight,
  Info,
  Layers,
  Star,
} from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { DollarSign } = require("lucide-react") as any;

const REPS = [
  {
    name: "Russel Feldman",
    tier: "Senior Rep",
    parent: null,
    deals: 12,
    pipeline: "$186K",
    rate: "10%",
    earnedMtd: "$2,840",
    status: "Active",
  },
  {
    name: "Sarah Chen",
    tier: "Senior Rep",
    parent: null,
    deals: 9,
    pipeline: "$143K",
    rate: "10%",
    earnedMtd: "$2,180",
    status: "Active",
  },
  {
    name: "Marcus Webb",
    tier: "Rep",
    parent: "Russel Feldman",
    deals: 8,
    pipeline: "$124K",
    rate: "8%",
    earnedMtd: "$1,640",
    status: "Active",
  },
  {
    name: "Jordan Hill",
    tier: "Rep",
    parent: "Sarah Chen",
    deals: 6,
    pipeline: "$89K",
    rate: "8%",
    earnedMtd: "$1,260",
    status: "Active",
  },
  {
    name: "Alex Torres",
    tier: "Rep",
    parent: "Russel Feldman",
    deals: 4,
    pipeline: "$62K",
    rate: "8%",
    earnedMtd: "$840",
    status: "Active",
  },
  {
    name: "Kim Nguyen",
    tier: "Sub-Rep",
    parent: "Marcus Webb",
    deals: 3,
    pipeline: "$44K",
    rate: "5%",
    earnedMtd: "$480",
    status: "Active",
  },
  {
    name: "Devon Park",
    tier: "Sub-Rep",
    parent: "Jordan Hill",
    deals: 2,
    pipeline: "$31K",
    rate: "5%",
    earnedMtd: "$320",
    status: "Active",
  },
  {
    name: "Casey Mills",
    tier: "Rep",
    parent: null,
    deals: 1,
    pipeline: "$18K",
    rate: "8%",
    earnedMtd: "$0",
    status: "Inactive",
  },
];

const PAYOUTS = [
  { name: "Sarah Chen", period: "Apr 2026", amount: "$2,180", status: "Paid" },
  { name: "Marcus Webb", period: "Apr 2026", amount: "$1,640", status: "Paid" },
  { name: "Jordan Hill", period: "Apr 2026", amount: "$1,260", status: "Paid" },
  { name: "Russel Feldman", period: "May 2026", amount: "$2,840", status: "Pending" },
  { name: "Alex Torres", period: "May 2026", amount: "$840", status: "Pending" },
  { name: "Kim Nguyen", period: "May 2026", amount: "$480", status: "Pending" },
];

function TierBadge({ tier }: { tier: string }) {
  if (tier === "Senior Rep") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-400/10 text-brand-400">
        Senior Rep
      </span>
    );
  }
  if (tier === "Rep") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-400/10 text-violet-400">
        Rep
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-400/10 text-emerald-400">
      Sub-Rep
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "Active") {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-400 text-[11px] font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
        Active
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground text-[11px] font-medium">
      <span className="w-1.5 h-1.5 rounded-full bg-border inline-block" />
      Inactive
    </span>
  );
}

/* ─── Commission model data ──────────────────────────────── */
const COMMISSION_MODEL = [
  { tier: 'Master Agent',       rate: '$0.50', color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200', note: 'Fixed, off top. Active during onboarding; historical thereafter.' },
  { tier: 'Master Dealer',      rate: '$0.50', color: 'text-brand-400',  bg: 'bg-brand-50',  border: 'border-brand-200',  note: 'Fixed, off top. Portfolio-level account owner.' },
  { tier: 'Sales Partner',      rate: '$1.00', color: 'text-sky-600',    bg: 'bg-sky-50',    border: 'border-sky-200',    note: 'Configurable. Default $1.00/unit. Lifetime on deals they close.' },
  { tier: 'Service Dealer',     rate: '$3.00', color: 'text-emerald-600',bg: 'bg-emerald-50',border: 'border-emerald-200',note: 'Configurable. Default $3.00/unit. Ongoing service relationship.' },
  { tier: 'Install Contractor', rate: '$0.00', color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200',  note: 'No recurring. Paid from one-time setup fees only.' },
]

export default function RepsPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <TopBar
        title="Reps & Commissions"
        subtitle="Sales rep network, pipeline, and payout tracking"
        actions={
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-400 text-white text-xs font-semibold hover:bg-brand-500 transition-colors">
            <Plus size={13} />
            Add Rep
          </button>
        }
      />

      <div className="flex-1 p-6 space-y-6 max-w-screen-xl mx-auto w-full">
        {/* Live data notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-2">
          <Info size={15} className="text-blue-500 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700">
            <span className="font-semibold">Note:</span> Rep network and commission data below is placeholder. Live data wiring (from the <code className="font-mono bg-blue-100 px-1 py-0.5 rounded text-[10px]">commission_config</code> and <code className="font-mono bg-blue-100 px-1 py-0.5 rounded text-[10px]">organizations</code> tables) is on the roadmap — run migration 017 and wire the reps table to see live rates.
          </p>
        </div>

        {/* Commission model breakdown */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
            <DollarSign size={15} className="text-brand-400" />
            <h2 className="text-sm font-semibold">Dealer Commission Model — $5.00 Dealer Pool / Unit / Month</h2>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-5 gap-3">
            {COMMISSION_MODEL.map(m => (
              <div key={m.tier} className={`rounded-lg border ${m.border} ${m.bg} p-3`}>
                <div className={`text-lg font-bold ${m.color}`}>{m.rate}</div>
                <div className="text-xs font-semibold text-slate-700 mt-0.5">{m.tier}</div>
                <div className="text-[10px] text-slate-500 mt-1 leading-snug">{m.note}</div>
              </div>
            ))}
          </div>
          <div className="px-5 py-3 border-t border-border bg-background/30">
            <p className="text-[10px] text-muted-foreground">
              Property pays $10/unit/month · GateGuard keeps $5.00 gross margin · Dealer pool: $5.00 distributed per config above.
              Add-ons (Video Monitoring, Callbox, LPR, Kiosk): 50/50 GateGuard/Dealer split.
              Door Surcharge: ($200 × units) ÷ 12/month → 100% GateGuard.
            </p>
          </div>
        </div>

        {/* AI Search */}
        <AISearch placeholder='Try "show top reps by pipeline" or "pending payouts this month"' />

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-brand-400/10">
              <Users size={16} className="text-brand-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">14</p>
              <p className="text-xs text-muted-foreground">Total Reps</p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-brand-400/10">
              <TrendingUp size={16} className="text-brand-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">$412K</p>
              <p className="text-xs text-muted-foreground">Active Pipeline</p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-400/10">
              <DollarSign size={16} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">$18,240</p>
              <p className="text-xs text-muted-foreground">Commissions This Month</p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-400/10">
              <Clock size={16} className="text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">$6,820</p>
              <p className="text-xs text-muted-foreground">Pending Payouts</p>
            </div>
          </div>
        </div>

        {/* Reps Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
            <Users size={15} className="text-brand-400" />
            <h2 className="text-sm font-semibold">Rep Network</h2>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-background/30">
                {["Rep Name", "Tier", "Parent Rep", "Deals Won", "Pipeline Value", "Commission Rate", "Earned MTD", "Status"].map(
                  (h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-2.5 text-muted-foreground font-medium whitespace-nowrap"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {REPS.map((rep) => (
                <tr
                  key={rep.name}
                  className="border-b border-border/50 hover:bg-accent/30 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">
                    {rep.parent && (
                      <ChevronRight size={11} className="inline text-muted-foreground mr-1" />
                    )}
                    {rep.name}
                  </td>
                  <td className="px-4 py-3">
                    <TierBadge tier={rep.tier} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {rep.parent ?? <span className="text-border">—</span>}
                  </td>
                  <td className="px-4 py-3 text-foreground">{rep.deals}</td>
                  <td className="px-4 py-3 text-foreground font-medium">{rep.pipeline}</td>
                  <td className="px-4 py-3 text-muted-foreground">{rep.rate}</td>
                  <td className="px-4 py-3 font-semibold text-foreground">{rep.earnedMtd}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={rep.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Commission Payouts */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
            <DollarSign size={15} className="text-brand-400" />
            <h2 className="text-sm font-semibold">Commission Payouts</h2>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-background/30">
                {["Rep", "Period", "Amount", "Status"].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-2.5 text-muted-foreground font-medium"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PAYOUTS.map((p, i) => (
                <tr
                  key={i}
                  className="border-b border-border/50 hover:bg-accent/30 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-foreground">{p.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.period}</td>
                  <td className="px-4 py-3 font-semibold text-foreground">{p.amount}</td>
                  <td className="px-4 py-3">
                    {p.status === "Paid" ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-400/10 text-emerald-400">
                        Paid
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-400/10 text-amber-400">
                        Pending
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
