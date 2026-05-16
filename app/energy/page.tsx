"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Plus, Zap, AlertTriangle, Wrench, CheckCircle2,
  Building2, Activity, Settings,
} from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { TrendingDown, Cpu, DollarSign } = require('lucide-react') as any;

// ─── Types ───────────────────────────────────────────────────────────────────

type Grade = "A" | "B" | "C";
type AlertSeverity = "amber" | "red" | "blue";
type ChargerStatus = "Available" | "Charging" | "Fault" | "Offline";
type ThermostatMode = "Heat" | "Cool" | "Auto";
type DeviceStatus = "Online" | "Offline";

// ─── Mock Data ───────────────────────────────────────────────────────────────

const PROPERTIES: {
  id: string;
  name: string;
  grade: Grade;
  thermostats: number;
  evChargers: number;
  smartPlugs: number;
  savings: number;
  chart: number[];
}[] = [
  {
    id: "stonegate",
    name: "Stonegate Townhomes",
    grade: "A",
    thermostats: 12,
    evChargers: 8,
    smartPlugs: 4,
    savings: 340,
    chart: [62, 71, 58, 80, 74, 88, 76],
  },
  {
    id: "ashford",
    name: "Ashford Glen",
    grade: "B",
    thermostats: 8,
    evChargers: 6,
    smartPlugs: 0,
    savings: 210,
    chart: [48, 55, 50, 60, 57, 65, 59],
  },
  {
    id: "maple",
    name: "Maple Ridge HOA",
    grade: "B",
    thermostats: 4,
    evChargers: 4,
    smartPlugs: 2,
    savings: 185,
    chart: [40, 44, 38, 52, 47, 55, 50],
  },
  {
    id: "harbor",
    name: "Harbor View Apts",
    grade: "C",
    thermostats: 6,
    evChargers: 6,
    smartPlugs: 0,
    savings: 127,
    chart: [30, 28, 35, 25, 32, 29, 27],
  },
];

const ALERTS: {
  id: string;
  severity: AlertSeverity;
  message: string;
  action: string;
}[] = [
  {
    id: "a1",
    severity: "amber",
    message: "Harbor View — Thermostat Unit 312 offline for 48h",
    action: "Wrench",
  },
  {
    id: "a2",
    severity: "red",
    message: "Ashford Glen — EV Charger Bay 3 fault: overcurrent detected",
    action: "View",
  },
  {
    id: "a3",
    severity: "blue",
    message: "Stonegate — Grid demand peak in 2h — pre-cooling recommended",
    action: "Optimize",
  },
];

const EV_CHARGERS: {
  id: string;
  property: string;
  bay: string;
  model: string;
  status: ChargerStatus;
  vehicle?: string;
  unit?: string;
  kwh?: number;
  cost?: number;
  sessionsMonth: number;
  revenueMonth: number;
}[] = [
  { id: "c1", property: "Stonegate Townhomes", bay: "Bay 1", model: "ChargePoint CT4000", status: "Charging", vehicle: "Tesla Model 3", unit: "Unit 101", kwh: 18.4, cost: 4.14, sessionsMonth: 42, revenueMonth: 189 },
  { id: "c2", property: "Stonegate Townhomes", bay: "Bay 2", model: "ChargePoint CT4000", status: "Available", sessionsMonth: 38, revenueMonth: 171 },
  { id: "c3", property: "Stonegate Townhomes", bay: "Bay 3", model: "Tesla Wall Connector", status: "Charging", vehicle: "Ford F-150 Lightning", unit: "Unit 204", kwh: 31.2, cost: 7.02, sessionsMonth: 51, revenueMonth: 230 },
  { id: "c4", property: "Ashford Glen", bay: "Bay 1", model: "Eaton Level 2", status: "Available", sessionsMonth: 29, revenueMonth: 130 },
  { id: "c5", property: "Ashford Glen", bay: "Bay 2", model: "Eaton Level 2", status: "Fault", sessionsMonth: 14, revenueMonth: 63 },
  { id: "c6", property: "Ashford Glen", bay: "Bay 3", model: "Eaton Level 2", status: "Fault", sessionsMonth: 8, revenueMonth: 36 },
  { id: "c7", property: "Maple Ridge HOA", bay: "Bay 1", model: "ChargePoint CT4000", status: "Charging", vehicle: "Chevy Bolt EV", unit: "Unit 7", kwh: 22.8, cost: 5.13, sessionsMonth: 33, revenueMonth: 148 },
  { id: "c8", property: "Harbor View Apts", bay: "Bay 1", model: "Tesla Wall Connector", status: "Offline", sessionsMonth: 5, revenueMonth: 22 },
];

const THERMOSTATS: {
  id: string;
  unit: string;
  model: string;
  currentTemp: number;
  setPoint: number;
  mode: ThermostatMode;
  status: DeviceStatus;
  lastSeen: string;
}[] = [
  { id: "t1", unit: "Unit 101", model: "Ecobee SmartThermostat", currentTemp: 72, setPoint: 70, mode: "Cool", status: "Online", lastSeen: "2 min ago" },
  { id: "t2", unit: "Unit 102", model: "Nest Learning 4th Gen", currentTemp: 74, setPoint: 72, mode: "Cool", status: "Online", lastSeen: "1 min ago" },
  { id: "t3", unit: "Unit 201", model: "Honeywell T9", currentTemp: 69, setPoint: 70, mode: "Heat", status: "Online", lastSeen: "5 min ago" },
  { id: "t4", unit: "Unit 202", model: "Ecobee SmartThermostat", currentTemp: 71, setPoint: 72, mode: "Auto", status: "Online", lastSeen: "3 min ago" },
  { id: "t5", unit: "Unit 312", model: "Nest Learning 4th Gen", currentTemp: 0, setPoint: 70, mode: "Auto", status: "Offline", lastSeen: "48h ago" },
  { id: "t6", unit: "Unit 401", model: "Honeywell T9", currentTemp: 73, setPoint: 72, mode: "Cool", status: "Online", lastSeen: "Just now" },
];

const SMART_PLUGS: {
  id: string;
  location: string;
  device: string;
  status: DeviceStatus;
  kwh: number;
}[] = [
  { id: "p1", location: "Lobby", device: "Kasa EP25 Smart Plug", status: "Online", kwh: 3.2 },
  { id: "p2", location: "Gym", device: "Kasa EP25 Smart Plug", status: "Online", kwh: 8.7 },
  { id: "p3", location: "Mail Room", device: "TP-Link HS300", status: "Online", kwh: 1.4 },
  { id: "p4", location: "Clubhouse", device: "TP-Link HS300", status: "Offline", kwh: 0 },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const gradeConfig: Record<Grade, { bg: string; text: string; border: string }> = {
  A: { bg: "bg-emerald-50",  text: "text-emerald-700", border: "border-emerald-200" },
  B: { bg: "bg-blue-50",     text: "text-blue-700",    border: "border-blue-200"    },
  C: { bg: "bg-amber-50",    text: "text-amber-700",   border: "border-amber-200"   },
};

const alertConfig: Record<AlertSeverity, { bg: string; border: string; iconColor: string; badge: string; badgeText: string }> = {
  amber: { bg: "bg-amber-50",  border: "border-amber-200", iconColor: "text-amber-500", badge: "bg-amber-100 text-amber-700",  badgeText: "Warning" },
  red:   { bg: "bg-red-50",    border: "border-red-200",   iconColor: "text-red-500",   badge: "bg-red-100 text-red-700",      badgeText: "Critical" },
  blue:  { bg: "bg-blue-50",   border: "border-blue-200",  iconColor: "text-blue-500",  badge: "bg-blue-100 text-blue-700",    badgeText: "Info" },
};

const chargerStatusConfig: Record<ChargerStatus, { dot: string; text: string; bg: string }> = {
  Available: { dot: "bg-emerald-400",              text: "text-emerald-700", bg: "bg-emerald-50"  },
  Charging:  { dot: "bg-blue-500 animate-pulse",   text: "text-blue-700",   bg: "bg-blue-50"     },
  Fault:     { dot: "bg-red-500",                  text: "text-red-700",    bg: "bg-red-50"      },
  Offline:   { dot: "bg-gray-400",                 text: "text-gray-600",   bg: "bg-gray-100"    },
};

// ─── Mini Bar Chart ───────────────────────────────────────────────────────────

function MiniBarChart({ values }: { values: number[] }) {
  const max = Math.max(...values);
  return (
    <div className="flex items-end gap-0.5 h-8">
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm bg-[#2563EB]/20 hover:bg-[#2563EB]/40 transition-colors"
          style={{ height: `${Math.round((v / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  iconBg,
  iconColor,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center gap-3">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", iconBg)}>
        <Icon size={17} className={iconColor} />
      </div>
      <div>
        <p className="text-xl font-bold text-slate-900 leading-tight">{value}</p>
        <p className="text-xs font-semibold text-slate-700">{label}</p>
        {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EnergyPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "ev" | "devices">("overview");

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "ev",       label: "EV Charging" },
    { key: "devices",  label: "Smart Devices" },
  ] as const;

  // EV status counts
  const evCounts = {
    Available: EV_CHARGERS.filter((c) => c.status === "Available").length,
    Charging:  EV_CHARGERS.filter((c) => c.status === "Charging").length,
    Fault:     EV_CHARGERS.filter((c) => c.status === "Fault").length,
    Offline:   EV_CHARGERS.filter((c) => c.status === "Offline").length,
  };

  return (
    <div className="min-h-full bg-[#f0f2f5]">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Energy Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">Smart building controls across your portfolio.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-sm font-medium transition-colors shadow-sm shadow-blue-200">
          <Plus size={15} /> Add Device
        </button>
      </div>

      <div className="p-6 space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-5 gap-4">
          <StatCard label="Properties Enrolled"    value="12"      icon={Building2}   iconBg="bg-blue-50"    iconColor="text-blue-600" />
          <StatCard label="Devices Online"          value="148"     icon={Cpu}         iconBg="bg-indigo-50"  iconColor="text-indigo-600" />
          <StatCard label="Est. Monthly Savings"    value="$2,840"  sub="+vs baseline" icon={TrendingDown}    iconBg="bg-emerald-50"  iconColor="text-emerald-600" />
          <StatCard label="EV Chargers Active"      value="24"      icon={Zap}         iconBg="bg-amber-50"   iconColor="text-amber-600" />
          <StatCard label="Alerts"                  value="3"       sub="Needs action" icon={AlertTriangle}   iconBg="bg-red-50"      iconColor="text-red-600" />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1 w-fit shadow-sm">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
                activeTab === t.key
                  ? "bg-[#2563EB] text-white shadow"
                  : "text-slate-500 hover:text-slate-800 hover:bg-gray-50"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Overview Tab ── */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Portfolio Property Cards */}
            <div className="grid grid-cols-2 gap-4">
              {PROPERTIES.map((prop) => {
                const gc = gradeConfig[prop.grade];
                return (
                  <div key={prop.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:border-blue-300 transition-colors">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">{prop.name}</h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {prop.thermostats} thermostats · {prop.evChargers} EV chargers · {prop.smartPlugs} smart plugs
                        </p>
                      </div>
                      <span className={cn("px-2.5 py-1 rounded-lg text-sm font-extrabold border", gc.bg, gc.text, gc.border)}>
                        {prop.grade}
                      </span>
                    </div>

                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <DollarSign size={13} className="text-emerald-500" />
                          <span className="text-sm font-bold text-emerald-700">${prop.savings}/mo savings</span>
                        </div>
                        <p className="text-[11px] text-slate-400">vs. unmanaged baseline</p>
                      </div>
                      <div className="flex-1 max-w-[120px]">
                        <p className="text-[10px] text-slate-400 mb-1 text-right">7-day usage</p>
                        <MiniBarChart values={prop.chart} />
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
                      <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-slate-600 hover:bg-gray-50 hover:border-blue-300 hover:text-blue-600 transition-colors">
                        <Settings size={12} /> Manage
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Alerts */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100">
                <AlertTriangle size={14} className="text-amber-500" />
                <h2 className="text-sm font-bold text-slate-900">Active Alerts</h2>
                <span className="ml-auto text-xs bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full">3</span>
              </div>
              <div className="divide-y divide-gray-50">
                {ALERTS.map((alert) => {
                  const ac = alertConfig[alert.severity];
                  return (
                    <div key={alert.id} className={cn("flex items-center gap-4 px-5 py-3.5", ac.bg)}>
                      <AlertTriangle size={16} className={ac.iconColor} />
                      <div className="flex-1">
                        <p className="text-sm text-slate-800 font-medium">{alert.message}</p>
                        <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full mt-1 inline-block", ac.badge)}>
                          {ac.badgeText}
                        </span>
                      </div>
                      <button className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                        alert.severity === "red"
                          ? "bg-red-600 text-white border-red-600 hover:bg-red-700"
                          : alert.severity === "amber"
                          ? "bg-amber-500 text-white border-amber-500 hover:bg-amber-600"
                          : "bg-[#2563EB] text-white border-[#2563EB] hover:bg-[#1d4ed8]"
                      )}>
                        {alert.action === "Wrench" ? <Wrench size={13} /> : null}
                        {alert.action !== "Wrench" ? alert.action : ""}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── EV Charging Tab ── */}
        {activeTab === "ev" && (
          <div className="space-y-5">
            {/* Summary */}
            <div className="grid grid-cols-4 gap-4">
              {(["Available", "Charging", "Fault", "Offline"] as ChargerStatus[]).map((s) => {
                const sc = chargerStatusConfig[s];
                return (
                  <div key={s} className={cn("bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center gap-3")}>
                    <span className={cn("w-3 h-3 rounded-full shrink-0", sc.dot)} />
                    <div>
                      <p className="text-xl font-bold text-slate-900">{evCounts[s]}</p>
                      <p className="text-xs text-slate-500 font-medium">{s}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Revenue summary banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 flex items-center gap-4">
              <Zap size={18} className="text-blue-600 shrink-0" />
              <div>
                <p className="text-sm font-bold text-slate-800">24 chargers across 4 properties</p>
                <p className="text-xs text-slate-500 mt-0.5">Revenue this month from per-kWh resident billing</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-2xl font-extrabold text-[#2563EB]">$1,240</p>
                <p className="text-xs text-blue-500 font-medium">April 2026</p>
              </div>
            </div>

            {/* Charger Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100">
                <Zap size={14} className="text-[#2563EB]" />
                <h2 className="text-sm font-bold text-slate-900">Charger Inventory</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      {["Property / Bay", "Model", "Status", "Current Session", "Sessions (mo)", "Revenue (mo)"].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5 text-slate-500 font-semibold uppercase tracking-wide text-[11px]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {EV_CHARGERS.map((c) => {
                      const sc = chargerStatusConfig[c.status];
                      return (
                        <tr key={c.id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-800">{c.property}</p>
                            <p className="text-slate-400">{c.bay}</p>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{c.model}</td>
                          <td className="px-4 py-3">
                            <span className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-semibold", sc.bg, sc.text)}>
                              <span className={cn("w-1.5 h-1.5 rounded-full", sc.dot)} />
                              {c.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {c.status === "Charging" ? (
                              <div>
                                <p className="font-medium text-slate-700">{c.vehicle}</p>
                                <p className="text-slate-400">{c.unit} · {c.kwh} kWh · ${c.cost?.toFixed(2)}</p>
                              </div>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-600 font-medium">{c.sessionsMonth}</td>
                          <td className="px-4 py-3">
                            <span className="font-bold text-emerald-700">${c.revenueMonth}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── Smart Devices Tab ── */}
        {activeTab === "devices" && (
          <div className="space-y-6">
            {/* Thermostat Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Activity size={14} className="text-[#2563EB]" />
                  <h2 className="text-sm font-bold text-slate-900">Thermostats — Stonegate Townhomes</h2>
                </div>
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-xs font-medium transition-colors">
                  <Plus size={12} /> Add Device
                </button>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {["Unit", "Model", "Current Temp", "Set Point", "Mode", "Status", "Last Seen"].map((h) => (
                      <th key={h} className="text-left px-4 py-2.5 text-slate-500 font-semibold uppercase tracking-wide text-[11px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {THERMOSTATS.map((t) => (
                    <tr key={t.id} className="border-b border-gray-50 hover:bg-blue-50/20 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-800">{t.unit}</td>
                      <td className="px-4 py-3 text-slate-600">{t.model}</td>
                      <td className="px-4 py-3">
                        {t.status === "Online" ? (
                          <span className="font-bold text-slate-800">{t.currentTemp}°F</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{t.setPoint}°F</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[11px] font-semibold",
                          t.mode === "Cool" ? "bg-blue-50 text-blue-700"
                          : t.mode === "Heat" ? "bg-orange-50 text-orange-700"
                          : "bg-gray-100 text-gray-600"
                        )}>
                          {t.mode}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 text-[11px] font-semibold",
                          t.status === "Online" ? "text-emerald-600" : "text-red-500"
                        )}>
                          <span className={cn("w-1.5 h-1.5 rounded-full", t.status === "Online" ? "bg-emerald-400" : "bg-red-400")} />
                          {t.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{t.lastSeen}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Smart Plug Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Zap size={14} className="text-amber-500" />
                  <h2 className="text-sm font-bold text-slate-900">Smart Plugs — Stonegate Townhomes</h2>
                </div>
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-xs font-medium transition-colors">
                  <Plus size={12} /> Add Device
                </button>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {["Location", "Device", "Status", "Today's kWh"].map((h) => (
                      <th key={h} className="text-left px-4 py-2.5 text-slate-500 font-semibold uppercase tracking-wide text-[11px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SMART_PLUGS.map((p) => (
                    <tr key={p.id} className="border-b border-gray-50 hover:bg-blue-50/20 transition-colors last:border-b-0">
                      <td className="px-4 py-3 font-semibold text-slate-800">{p.location}</td>
                      <td className="px-4 py-3 text-slate-600">{p.device}</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 text-[11px] font-semibold",
                          p.status === "Online" ? "text-emerald-600" : "text-slate-400"
                        )}>
                          <span className={cn("w-1.5 h-1.5 rounded-full", p.status === "Online" ? "bg-emerald-400" : "bg-gray-300")} />
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {p.status === "Online" ? (
                          <span className="font-bold text-slate-700">{p.kwh} kWh</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
