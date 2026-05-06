"use client";
import { useState } from "react";
import {
  Satellite, TrendingUp, TrendingDown, Users, DollarSign,
  Activity, CheckCircle2, AlertCircle, Clock, ChevronRight,
  BarChart3, Zap, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── SYNTHETIC DEMO DATA ────────────────────────────────────────────────────
const kpis = [
  { label: "Active Dealers",   value: "47",      sub: "+3 this month",   trend: "up",   icon: Users },
  { label: "Total Activations",value: "1,284",   sub: "+112 vs last mo", trend: "up",   icon: Zap },
  { label: "Avg ARS%",         value: "91.4%",   sub: "Target: 90%+",    trend: "up",   icon: Activity },
  { label: "Avg ABP%",         value: "78.2%",   sub: "Target: 80%",     trend: "down", icon: BarChart3 },
  { label: "MRR (Channel)",    value: "$94,200",  sub: "+$6,400 MoM",     trend: "up",   icon: DollarSign },
  { label: "Est. Commission",  value: "$31,420",  sub: "This month",      trend: "up",   icon: TrendingUp },
];

const dealers = [
  { name: "Apex Low Voltage",       activations: 142, ars: 94.2, abp: 82.1, commission: 4_260, status: "elite",  trend: "up"   },
  { name: "SunState Tech Partners", activations: 118, ars: 92.8, abp: 80.4, commission: 3_540, status: "elite",  trend: "up"   },
  { name: "Gulf Coast A/V",         activations:  97, ars: 89.1, abp: 77.3, commission: 2_910, status: "active", trend: "flat" },
  { name: "Metro Access Solutions", activations:  84, ars: 88.4, abp: 75.8, commission: 2_520, status: "active", trend: "up"   },
  { name: "Lone Star Integrators",  activations:  76, ars: 91.7, abp: 79.2, commission: 2_280, status: "active", trend: "up"   },
  { name: "Coastal Connect LLC",    activations:  61, ars: 85.3, abp: 71.0, commission: 1_830, status: "watch",  trend: "down" },
  { name: "Peak Network Services",  activations:  54, ars: 83.9, abp: 68.4, commission: 1_620, status: "watch",  trend: "down" },
  { name: "Tri-County LV Group",    activations:  48, ars: 90.1, abp: 76.5, commission: 1_440, status: "active", trend: "flat" },
];

const recentActivations = [
  { dealer: "Apex Low Voltage",       property: "Sunset Ridge Apts",    units: 248, date: "May 4",  status: "complete" },
  { dealer: "SunState Tech Partners", property: "The Meridian — Bldg C",units: 192, date: "May 4",  status: "complete" },
  { dealer: "Metro Access Solutions", property: "Harbor Point Phase 2",  units: 176, date: "May 3",  status: "pending"  },
  { dealer: "Lone Star Integrators",  property: "Creekview Commons",     units: 144, date: "May 3",  status: "complete" },
  { dealer: "Gulf Coast A/V",         property: "Bayshore Residences",   units: 120, date: "May 2",  status: "complete" },
  { dealer: "Apex Low Voltage",       property: "Northgate Plaza — Ph1", units: 108, date: "May 2",  status: "complete" },
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
                  {["Dealer", "Activations", "ARS%", "ABP%", "Commission MTD", "Status", ""].map((h) => (
                    <th key={h} className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {dealers.map((d) => (
                  <tr key={d.name} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{d.name}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{d.activations}</td>
                    <td className="px-4 py-3">
                      <span className={cn("font-medium", d.ars >= 90 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
                        {d.ars}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("font-medium", d.abp >= 80 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
                        {d.abp}%
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      ${d.commission.toLocaleString()}
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
                  {["Dealer", "Property", "Units", "Date", "Status"].map((h) => (
                    <th key={h} className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {recentActivations.map((a, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{a.dealer}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{a.property}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{a.units}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{a.date}</td>
                    <td className="px-4 py-3">
                      {a.status === "complete"
                        ? <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                            <CheckCircle2 size={12} /> Complete
                          </span>
                        : <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 text-xs font-medium">
                            <Clock size={12} /> Pending
                          </span>
                      }
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
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "GateGuard Platform",   amount: "$31,420", note: "15% of channel MRR",  color: "#3B5BDB" },
                { label: "MSO Override",          amount: "$6,284",  note: "5% of channel MRR",   color: "#0B7285" },
                { label: "Sales Pro Pool",        amount: "$9,426",  note: "10% of channel MRR",  color: "#7C3AED" },
              ].map((c) => (
                <div key={c.label} className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <div className="w-8 h-1 rounded-full mb-3" style={{ background: c.color }} />
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{c.amount}</p>
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mt-1">{c.label}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{c.note}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 text-center pt-2">
              Commission calculations based on $94,200 channel MRR · May 2026 · Paid NET-30
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
