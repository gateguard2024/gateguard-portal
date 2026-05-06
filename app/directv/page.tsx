"use client";
import { useState } from "react";
import {
  Tv as Satellite, TrendingUp, TrendingDown, Users, DollarSign,
  Activity, CheckCircle2, Clock, ChevronRight,
  BarChart3, Zap, RefreshCw, MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DTV_DEALERS, DTV_ACTIVATIONS, ATLAS_KPIS, DTV_COMMISSION_SUMMARY,
} from "@/lib/demo-data";

// ── KPI cards built from shared constants ─────────────────────────────────
const kpis = [
  { label: "Active Dealers",   value: String(ATLAS_KPIS.active_dealers),                sub: "+3 this month",                      trend: "up",   icon: Users      },
  { label: "Total Activations",value: ATLAS_KPIS.activations_mtd.toLocaleString(),      sub: "+112 vs last mo",                    trend: "up",   icon: Zap        },
  { label: "Avg ARS%",         value: `${ATLAS_KPIS.ars_pct}%`,                         sub: `Target: ${ATLAS_KPIS.ars_target}%+`, trend: "up",   icon: Activity   },
  { label: "Avg ABP%",         value: `${ATLAS_KPIS.abp_pct}%`,                         sub: `Target: ${ATLAS_KPIS.abp_target}%`,  trend: "down", icon: BarChart3  },
  { label: "MRR (Channel)",    value: `$${ATLAS_KPIS.mrr.toLocaleString()}`,             sub: "+$6,400 MoM",                        trend: "up",   icon: DollarSign },
  { label: "Est. Commission",  value: `$${ATLAS_KPIS.commission_mtd.toLocaleString()}`,  sub: "This month",                         trend: "up",   icon: TrendingUp },
];

type Tab = "overview" | "dealers" | "activations" | "commissions";

const statusBadge: Record<string, { label: string; cls: string }> = {
  elite:  { label: "Elite",  cls: "bg-indigo-900/40 text-indigo-300 border border-indigo-700/40" },
  active: { label: "Active", cls: "bg-emerald-900/40 text-emerald-300 border border-emerald-700/40" },
  watch:  { label: "Watch",  cls: "bg-amber-900/40 text-amber-300 border border-amber-700/40" },
};

export default function DirectTVPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const tabs: { id: Tab; label: string }[] = [
    { id: "overview",     label: "Overview"     },
    { id: "dealers",      label: "Dealer Table" },
    { id: "activations",  label: "Activations"  },
    { id: "commissions",  label: "Commissions"  },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          {/* ATLAS agent badge */}
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0"
            style={{ background: "#3B5BDB" }}
          >
            AT
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">ATLAS — DirecTV Channel</h1>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: "#EEF0FF", color: "#3B5BDB" }}>
                AI Agent
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Activations · ARS% · ABP% · Commissions — powered by GateGuard Nexus
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <RefreshCw size={12} />
            Refresh
          </button>
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between mb-2">
                <Icon size={14} className="text-gray-400" />
                {k.trend === "up"
                  ? <TrendingUp size={12} className="text-emerald-500" />
                  : k.trend === "down"
                  ? <TrendingDown size={12} className="text-red-400" />
                  : null}
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{k.value}</p>
              <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{k.label}</p>
              <p className={cn("text-[10px] mt-1 font-medium",
                k.trend === "up" ? "text-emerald-500" : k.trend === "down" ? "text-red-400" : "text-gray-400"
              )}>{k.sub}</p>
            </div>
          );
        })}
      </div>

      {/* ARS / ABP summary bar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Channel Performance vs. DirecTV Targets</h2>
          <span className="text-xs text-gray-400">May 2026</span>
        </div>
        <div className="space-y-4">
          {[
            { label: "ARS% (Activation Rate to Shipped)", value: 91.4, target: 90, color: "#3B5BDB" },
            { label: "ABP% (Avg Boxes Per Activation)",  value: 78.2, target: 80, color: "#0B7285" },
          ].map((m) => (
            <div key={m.label}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-gray-600 dark:text-gray-300">{m.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">Target: {m.target}%</span>
                  <span className={cn("text-sm font-bold", m.value >= m.target ? "text-emerald-500" : "text-amber-500")}>
                    {m.value}%
                  </span>
                </div>
              </div>
              <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${m.value}%`, background: m.value >= m.target ? "#10b981" : m.color }}
                />
              </div>
              {/* target marker */}
              <div className="relative h-0" style={{ marginTop: "-8px" }}>
                <div
                  className="absolute w-0.5 h-3 bg-gray-400 dark:bg-gray-500"
                  style={{ left: `${m.target}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="border-b border-gray-200 dark:border-gray-700 flex">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "px-5 py-3 text-sm font-medium transition-colors border-b-2",
                tab === t.id
                  ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab: Overview */}
        {tab === "overview" && (
          <div className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Monthly activation trend (simple bar chart) */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-4">
                  Monthly Activations
                </h3>
                <div className="flex items-end gap-2 h-32">
                  {[
                    { m: "Nov", v: 820  },
                    { m: "Dec", v: 890  },
                    { m: "Jan", v: 940  },
                    { m: "Feb", v: 1020 },
                    { m: "Mar", v: 1100 },
                    { m: "Apr", v: 1172 },
                    { m: "May", v: 1284 },
                  ].map((d) => (
                    <div key={d.m} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[9px] text-gray-400 font-medium">{d.v.toLocaleString()}</span>
                      <div
                        className="w-full rounded-t"
                        style={{
                          height: `${(d.v / 1284) * 100}%`,
                          background: d.m === "May" ? "#3B5BDB" : "#E0E7FF",
                        }}
                      />
                      <span className="text-[9px] text-gray-400">{d.m}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Status breakdown */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-4">
                  Dealer Status Breakdown
                </h3>
                <div className="space-y-3">
                  {[
                    { label: "Elite",  count: 2,  color: "#3B5BDB", pct: 4  },
                    { label: "Active", count: 36, color: "#10b981", pct: 77 },
                    { label: "Watch",  count: 9,  color: "#f59e0b", pct: 19 },
                  ].map((s) => (
                    <div key={s.label} className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                      <span className="text-xs text-gray-600 dark:text-gray-300 w-12">{s.label}</span>
                      <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full">
                        <div className="h-full rounded-full" style={{ width: `${s.pct}%`, background: s.color }} />
                      </div>
                      <span className="text-xs font-medium text-gray-900 dark:text-white w-6 text-right">{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Dealer Table */}
        {tab === "dealers" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  {["Dealer", "Location", "Act. MTD", "ARS%", "ABP%", "Commission MTD", "Status", ""].map((h) => (
                    <th key={h} className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {DTV_DEALERS.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{d.name}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                      <span className="flex items-center gap-1"><MapPin size={10} />{d.city}, {d.state}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{d.activations_mtd}</td>
                    <td className="px-4 py-3">
                      <span className={cn("font-medium", d.ars_pct >= 90 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
                        {d.ars_pct}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("font-medium", d.abp_pct >= 75 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
                        {d.abp_pct}%
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      ${d.commission_mtd.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", statusBadge[d.status].cls)}>
                        {statusBadge[d.status].label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <ChevronRight size={14} className="text-gray-400" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab: Activations */}
        {tab === "activations" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  {["Order ID", "Customer", "Package", "Install Type", "Dealer", "Date", "ARS", "ABP", "Commission"].map((h) => (
                    <th key={h} className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {DTV_ACTIVATIONS.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">{a.id}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 dark:text-white">{a.customer}</p>
                      <p className="text-[10px] text-gray-400">{a.city}, {a.state}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">
                        {a.package}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{a.install_type}</td>
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300">{a.dealer_name}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{a.date}</td>
                    <td className="px-4 py-3">
                      {a.ars
                        ? <CheckCircle2 size={14} className="text-emerald-500" />
                        : <Clock size={14} className="text-amber-400" />}
                    </td>
                    <td className="px-4 py-3">
                      {a.abp
                        ? <CheckCircle2 size={14} className="text-emerald-500" />
                        : <Clock size={14} className="text-amber-400" />}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      ${a.commission.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab: Commissions */}
        {tab === "commissions" && (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-2">
              {[
                { label: "Activations Commission", amount: DTV_COMMISSION_SUMMARY.activations_commission, note: "Base per-activation",  color: "#3B5BDB" },
                { label: "ABP Bonus",               amount: DTV_COMMISSION_SUMMARY.abp_bonus,              note: "Avg boxes exceeded",  color: "#0B7285" },
                { label: "ARS Bonus",               amount: DTV_COMMISSION_SUMMARY.ars_bonus,              note: "ARS target exceeded", color: "#2F9E44" },
                { label: "Total Payout",            amount: DTV_COMMISSION_SUMMARY.total_payout,           note: `+${DTV_COMMISSION_SUMMARY.pct_change.toFixed(1)}% vs last month`, color: "#7C3AED" },
              ].map((c) => (
                <div key={c.label} className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <div className="w-8 h-1 rounded-full mb-3" style={{ background: c.color }} />
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">${c.amount.toLocaleString()}</p>
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mt-1">{c.label}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{c.note}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 text-center pt-2">
              Commission calculations based on ${ATLAS_KPIS.mrr.toLocaleString()} channel MRR · May 2026 · Paid NET-30
            </p>
          </div>
        )}
      </div>

      {/* ATLAS footer note */}
      <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
        <div className="w-4 h-4 rounded flex items-center justify-center text-white font-bold text-[8px]" style={{ background: "#3B5BDB" }}>AT</div>
        <span>ATLAS is monitoring 47 active dealers · Last synced May 4, 2026 at 11:52 PM · Next sync in 4 hours</span>
      </div>

    </div>
  );
}
