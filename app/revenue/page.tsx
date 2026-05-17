"use client";

import { useState, useEffect } from "react";
import {
  TrendingUp, Download, Users, Building2, CheckCircle2, AlertTriangle,
} from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { DollarSign, ArrowUpRight, TrendingDown, BarChart3 } = require('lucide-react') as any;
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface RevenueMetrics {
  total_mrr: number;
  total_arr: number;
  active_properties: number;
  invoices_this_month: number;
  invoices_paid_this_month: number;
}

interface MonthBucket {
  month: string;
  value: number;
}

const reps = [
  { name: "Russel Feldman", deals: 12, pipeline: "$186K", won: "$28,400", commission: "$2,840", pct: 35 },
  { name: "Sarah Chen",     deals: 9,  pipeline: "$143K", won: "$21,800", commission: "$2,180", pct: 27 },
  { name: "Marcus Webb",    deals: 8,  pipeline: "$124K", won: "$18,200", commission: "$1,820", pct: 22 },
  { name: "Jordan Hill",    deals: 6,  pipeline: "$89K",  won: "$12,600", commission: "$1,260", pct: 16 },
];

const TARGET = 36;
const MAX_VAL = 42;

// ─── Component ───────────────────────────────────────────────────────────────

export default function RevenuePage() {
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const [metrics, setMetrics] = useState<RevenueMetrics | null>(null);
  const [mrrData, setMrrData] = useState<MonthBucket[]>([]);

  useEffect(() => {
    fetch('/api/revenue')
      .then(r => r.json())
      .then(json => {
        if (json.metrics) setMetrics(json.metrics);
        if (json.by_month) setMrrData(json.by_month);
      })
      .catch(() => { /* keep placeholder */ });
  }, []);

  const fmtCurrency = (n: number) =>
    n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${n.toLocaleString()}`;

  const kpis = [
    {
      label: "MRR",
      value: metrics ? fmtCurrency(metrics.total_mrr) : "$—",
      sub: "Active contracts",
      icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100"
    },
    {
      label: "ARR",
      value: metrics ? fmtCurrency(metrics.total_arr) : "$—",
      sub: "Annualized run-rate",
      icon: BarChart3, color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-100"
    },
    {
      label: "Invoiced MTD",
      value: metrics ? fmtCurrency(metrics.invoices_this_month) : "$—",
      sub: "This calendar month",
      icon: ArrowUpRight, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100"
    },
    {
      label: "Collected MTD",
      value: metrics ? fmtCurrency(metrics.invoices_paid_this_month) : "$—",
      sub: "Paid invoices this month",
      icon: CheckCircle2, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100"
    },
    {
      label: "Net Rev Retention",
      value: "—",
      sub: "Target: 95%",
      icon: TrendingDown, color: "text-red-500", bg: "bg-red-50", border: "border-red-100"
    },
    {
      label: "Active Properties",
      value: metrics ? String(metrics.active_properties) : "—",
      sub: "Across all tiers",
      icon: Building2, color: "text-slate-600", bg: "bg-slate-100", border: "border-slate-200"
    },
  ];

  // Use live data if available, else placeholder for chart shape
  const chartData: MonthBucket[] = mrrData.length > 0 ? mrrData : [
    { month: "...", value: 0 },
  ];

  const targetPct = ((TARGET / MAX_VAL) * 100).toFixed(2);

  return (
    <div className="min-h-full bg-[#f0f2f5]">
      {/* Page header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Revenue</h1>
          <p className="text-sm text-slate-500 mt-0.5">Commissions, MRR trends, and pipeline performance</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-700">
            Apr 2025 — Apr 2026
          </div>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-sm font-medium text-slate-700 transition-colors shadow-sm">
            <Download size={14} />
            Export
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* KPI cards */}
        <div className="grid grid-cols-6 gap-4">
          {kpis.map((k) => {
            const Icon = k.icon;
            return (
              <div
                key={k.label}
                className={cn(
                  "bg-white rounded-xl border p-4 shadow-sm flex flex-col gap-2",
                  k.border
                )}
              >
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", k.bg)}>
                  <Icon size={15} className={k.color} />
                </div>
                <p className="text-lg font-bold text-slate-900 leading-tight">{k.value}</p>
                <div>
                  <p className="text-xs font-semibold text-slate-700">{k.label}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{k.sub}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* MRR Trend chart */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-sm font-bold text-slate-900">MRR Trend</h2>
              <p className="text-xs text-slate-400 mt-0.5">12-month view · Jan–Dec 2025</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#2563EB] opacity-80 inline-block" />
                Actual MRR
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-5 border-t-2 border-dashed border-amber-400 inline-block" />
                Target ($36K)
              </span>
            </div>
          </div>

          {/* Chart area */}
          <div className="relative">
            {/* Y-axis labels */}
            <div className="absolute left-0 top-0 bottom-8 flex flex-col justify-between text-[10px] text-slate-400 text-right w-8">
              {[42, 35, 28, 21, 14, 7, 0].map((v) => (
                <span key={v}>${v}K</span>
              ))}
            </div>

            {/* Chart body */}
            <div className="ml-10 relative">
              {/* Target dashed line */}
              <div
                className="absolute left-0 right-0 border-t-2 border-dashed border-amber-400 z-10 pointer-events-none"
                style={{ bottom: `calc(${targetPct}% + 2rem)` }}
              />

              {/* Bars */}
              <div className="flex items-end gap-1.5 h-56 pb-0 border-b border-gray-100">
                {chartData.map((d, i) => {
                  const heightPct = (d.value / MAX_VAL) * 100;
                  const isHovered = hoveredBar === i;
                  const isAboveTarget = d.value >= TARGET;
                  return (
                    <div
                      key={d.month}
                      className="flex-1 flex flex-col items-center justify-end h-full cursor-pointer group"
                      onMouseEnter={() => setHoveredBar(i)}
                      onMouseLeave={() => setHoveredBar(null)}
                      title={`${d.month}: $${d.value}K`}
                    >
                      {/* Tooltip */}
                      {isHovered && (
                        <div className="mb-1 px-2 py-1 bg-slate-800 text-white text-[11px] rounded-md whitespace-nowrap shadow-lg z-20 pointer-events-none">
                          ${d.value}K
                        </div>
                      )}
                      <div
                        className={cn(
                          "w-full rounded-t-md transition-all duration-150",
                          isAboveTarget ? "bg-[#2563EB]" : "bg-[#2563EB]/60",
                          isHovered ? "opacity-100 brightness-110" : "opacity-80"
                        )}
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Month labels */}
              <div className="flex gap-1.5 mt-2">
                {chartData.map((d) => (
                  <div key={d.month} className="flex-1 text-center text-[10px] text-slate-400 font-medium">
                    {d.month}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Pipeline by Rep + Commission Summary */}
        <div className="grid grid-cols-5 gap-5">
          {/* Pipeline by Rep table */}
          <div className="col-span-3 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100">
              <Users size={14} className="text-blue-600" />
              <h2 className="text-sm font-bold text-slate-900">Pipeline by Rep</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {["Rep Name", "Active Deals", "Pipeline Value", "Won MTD", "Commission Owed"].map((h) => (
                    <th key={h} className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reps.map((r, i) => (
                  <tr
                    key={r.name}
                    className={cn(
                      "border-b border-gray-50 hover:bg-blue-50/40 transition-colors",
                      i === reps.length - 1 && "border-b-0"
                    )}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-[#2563EB]/10 flex items-center justify-center text-[11px] font-bold text-[#2563EB]">
                          {r.name.split(" ").map((n) => n[0]).join("")}
                        </div>
                        <span className="font-medium text-slate-800 text-sm">{r.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-xs font-bold text-slate-700">
                        {r.deals}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-slate-800">{r.pipeline}</td>
                    <td className="px-5 py-3.5">
                      <span className="text-emerald-700 font-semibold">{r.won}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg">
                        <DollarSign size={11} />
                        {r.commission.replace("$", "")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Commission Summary */}
          <div className="col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col gap-5">
            <div className="flex items-center gap-2">
              <DollarSign size={14} className="text-blue-600" />
              <h2 className="text-sm font-bold text-slate-900">Commission Summary</h2>
            </div>

            <div className="bg-[#2563EB]/5 rounded-xl p-4 border border-[#2563EB]/10">
              <p className="text-2xl font-bold text-slate-900">$8,100</p>
              <p className="text-xs text-slate-500 mt-0.5">Total commissions owed</p>
              <div className="mt-3 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-400" />
                <p className="text-xs font-semibold text-slate-700">
                  Next payout: <span className="text-[#2563EB]">May 1, 2026</span>
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Breakdown by Rep</p>
              {reps.map((r) => (
                <div key={r.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700 truncate pr-2">{r.name.split(" ")[0]} {r.name.split(" ")[1][0]}.</span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 font-semibold">{r.commission}</span>
                      <span className="text-slate-400 w-8 text-right">{r.pct}%</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#2563EB] rounded-full transition-all"
                      style={{ width: `${r.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Churn & Retention */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown size={14} className="text-slate-600" />
            <h2 className="text-sm font-bold text-slate-900">Churn &amp; Retention</h2>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {/* Churned */}
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                <TrendingDown size={18} className="text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">2</p>
                <p className="text-xs font-semibold text-red-500 mt-0.5">Churned This Month</p>
                <p className="text-[11px] text-red-400 mt-0.5">−$2,100 MRR impact</p>
              </div>
            </div>

            {/* At-risk */}
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <AlertTriangle size={18} className="text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600">3</p>
                <p className="text-xs font-semibold text-amber-600 mt-0.5">At-Risk Properties</p>
                <p className="text-[11px] text-amber-500 mt-0.5">Needs follow-up this week</p>
              </div>
            </div>

            {/* Healthy */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 size={18} className="text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-600">26</p>
                <p className="text-xs font-semibold text-emerald-600 mt-0.5">Healthy Properties</p>
                <p className="text-[11px] text-emerald-500 mt-0.5">84% of active base</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
