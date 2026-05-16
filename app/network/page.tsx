"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Plus, Wifi, Shield, AlertTriangle, CheckCircle2,
  XCircle, Clock, Wrench, Activity, RefreshCw,
  Filter, Building2, ChevronRight,
  Globe, Hash,
} from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Map, Network, RotateCcw, DollarSign, SlidersHorizontal, AlertCircle, Cpu } = require('lucide-react') as any;

// ─── Types ───────────────────────────────────────────────────────────────────

type NetworkStatus = "Healthy" | "Degraded" | "Down";
type Tier = "Basic" | "Standard" | "Premium";
type DeviceType = "Switch" | "AP" | "Firewall";
type TicketPriority = "P1" | "P2" | "P3";
type TicketStatus = "Open" | "In Progress" | "Escalated";

// ─── Mock Data ────────────────────────────────────────────────────────────────

const PROPERTIES: {
  id: string;
  name: string;
  tier: Tier;
  price: number;
  status: NetworkStatus;
  switches: number;
  aps: number;
  firewalls: number;
  uptime: string;
  lastIncident: string;
  dlMbps: number;
  dlMax: number;
  ulMbps: number;
  ulMax: number;
}[] = [
  { id: "stonegate",  name: "Stonegate Townhomes",  tier: "Premium",  price: 499, status: "Healthy",  switches: 3, aps: 8,  firewalls: 1, uptime: "99.9%", lastIncident: "No incidents",  dlMbps: 245, dlMax: 500, ulMbps: 340, ulMax: 500 },
  { id: "ashford",    name: "Ashford Glen",          tier: "Standard", price: 399, status: "Healthy",  switches: 2, aps: 6,  firewalls: 1, uptime: "99.8%", lastIncident: "3 days ago",    dlMbps: 178, dlMax: 500, ulMbps: 210, ulMax: 500 },
  { id: "maple",      name: "Maple Ridge HOA",       tier: "Basic",    price: 299, status: "Healthy",  switches: 1, aps: 4,  firewalls: 1, uptime: "99.6%", lastIncident: "1 week ago",    dlMbps: 67,  dlMax: 200, ulMbps: 89,  ulMax: 200 },
  { id: "camden",     name: "Camden Crossing",       tier: "Standard", price: 399, status: "Degraded", switches: 2, aps: 6,  firewalls: 1, uptime: "98.1%", lastIncident: "Today",         dlMbps: 156, dlMax: 500, ulMbps: 210, ulMax: 500 },
  { id: "harbor",     name: "Harbor View Apts",      tier: "Premium",  price: 499, status: "Healthy",  switches: 3, aps: 8,  firewalls: 1, uptime: "99.7%", lastIncident: "5 days ago",    dlMbps: 312, dlMax: 500, ulMbps: 420, ulMax: 500 },
  { id: "northgate",  name: "Northgate Plaza",       tier: "Standard", price: 399, status: "Healthy",  switches: 2, aps: 4,  firewalls: 1, uptime: "100%",  lastIncident: "None",          dlMbps: 89,  dlMax: 500, ulMbps: 120, ulMax: 500 },
  { id: "lakewood",   name: "Lakewood HOA",          tier: "Basic",    price: 299, status: "Healthy",  switches: 1, aps: 3,  firewalls: 1, uptime: "99.4%", lastIncident: "2 weeks ago",   dlMbps: 45,  dlMax: 200, ulMbps: 56,  ulMax: 200 },
  { id: "riverside",  name: "Riverside Apts",        tier: "Standard", price: 399, status: "Down",     switches: 2, aps: 5,  firewalls: 1, uptime: "96.2%", lastIncident: "Today",         dlMbps: 0,   dlMax: 500, ulMbps: 0,   ulMax: 500 },
  { id: "peachtree",  name: "Peachtree Commons",     tier: "Premium",  price: 499, status: "Healthy",  switches: 3, aps: 10, firewalls: 1, uptime: "99.8%", lastIncident: "4 days ago",    dlMbps: 287, dlMax: 500, ulMbps: 380, ulMax: 500 },
];

const DEVICES: {
  id: string;
  property: string;
  type: DeviceType;
  model: string;
  ip: string;
  mac: string;
  status: "Online" | "Offline" | "Warning";
  lastSeen: string;
  uptime: string;
}[] = [
  { id: "d01",  property: "Stonegate Townhomes", type: "Firewall", model: "Fortinet FortiGate 60F",    ip: "10.10.1.1",   mac: "00:09:0F:AA:11:22", status: "Online",  lastSeen: "Just now",   uptime: "99.9%" },
  { id: "d02",  property: "Stonegate Townhomes", type: "Switch",   model: "Cisco Catalyst 2960-X",     ip: "10.10.1.2",   mac: "00:1A:A1:BB:22:33", status: "Online",  lastSeen: "Just now",   uptime: "99.9%" },
  { id: "d03",  property: "Stonegate Townhomes", type: "Switch",   model: "Cisco Catalyst 2960-X",     ip: "10.10.1.3",   mac: "00:1A:A1:BB:22:44", status: "Online",  lastSeen: "2 min ago",  uptime: "99.8%" },
  { id: "d04",  property: "Stonegate Townhomes", type: "AP",       model: "Ubiquiti UniFi U6 Pro",     ip: "10.10.1.10",  mac: "78:45:58:CC:11:AA", status: "Online",  lastSeen: "1 min ago",  uptime: "99.7%" },
  { id: "d05",  property: "Stonegate Townhomes", type: "AP",       model: "Ubiquiti UniFi U6 Pro",     ip: "10.10.1.11",  mac: "78:45:58:CC:11:BB", status: "Online",  lastSeen: "1 min ago",  uptime: "99.7%" },
  { id: "d06",  property: "Ashford Glen",        type: "Firewall", model: "Fortinet FortiGate 60F",    ip: "10.20.1.1",   mac: "00:09:0F:BB:33:44", status: "Online",  lastSeen: "3 min ago",  uptime: "99.8%" },
  { id: "d07",  property: "Ashford Glen",        type: "Switch",   model: "Meraki MS120-8FP",          ip: "10.20.1.2",   mac: "88:15:44:DD:55:66", status: "Online",  lastSeen: "3 min ago",  uptime: "99.8%" },
  { id: "d08",  property: "Ashford Glen",        type: "AP",       model: "Cisco Meraki MR46",         ip: "10.20.1.10",  mac: "88:15:44:EE:77:11", status: "Online",  lastSeen: "4 min ago",  uptime: "99.6%" },
  { id: "d09",  property: "Camden Crossing",     type: "Firewall", model: "Fortinet FortiGate 80F",    ip: "10.30.1.1",   mac: "00:09:0F:CC:44:55", status: "Warning", lastSeen: "8 min ago",  uptime: "98.1%" },
  { id: "d10",  property: "Camden Crossing",     type: "Switch",   model: "Cisco Catalyst 2960-X",     ip: "10.30.1.2",   mac: "00:1A:A1:DD:33:55", status: "Warning", lastSeen: "8 min ago",  uptime: "98.1%" },
  { id: "d11",  property: "Camden Crossing",     type: "AP",       model: "Ubiquiti UniFi U6 Lite",    ip: "10.30.1.10",  mac: "78:45:58:FF:22:CC", status: "Warning", lastSeen: "9 min ago",  uptime: "97.9%" },
  { id: "d12",  property: "Riverside Apts",      type: "Firewall", model: "Fortinet FortiGate 60F",    ip: "10.40.1.1",   mac: "00:09:0F:DD:55:66", status: "Offline", lastSeen: "2h ago",     uptime: "96.2%" },
  { id: "d13",  property: "Riverside Apts",      type: "Switch",   model: "Meraki MS125-24P",          ip: "10.40.1.2",   mac: "88:15:44:FF:66:77", status: "Offline", lastSeen: "2h ago",     uptime: "96.2%" },
  { id: "d14",  property: "Harbor View Apts",    type: "Firewall", model: "Fortinet FortiGate 100F",   ip: "10.50.1.1",   mac: "00:09:0F:EE:66:77", status: "Online",  lastSeen: "Just now",   uptime: "99.7%" },
  { id: "d15",  property: "Peachtree Commons",   type: "AP",       model: "Cisco Meraki MR56",         ip: "10.60.1.15",  mac: "88:15:44:AA:99:BB", status: "Online",  lastSeen: "2 min ago",  uptime: "99.8%" },
];

const TICKETS: {
  id: string;
  num: string;
  property: string;
  issue: string;
  priority: TicketPriority;
  opened: string;
  tech: string;
  status: TicketStatus;
}[] = [
  {
    id: "tk1",
    num: "NET-2026-041",
    property: "Riverside Apts",
    issue: "Complete network outage — all devices unreachable. ISP circuit down, awaiting technician dispatch.",
    priority: "P1",
    opened: "Today, 7:14 AM",
    tech: "James T.",
    status: "Escalated",
  },
  {
    id: "tk2",
    num: "NET-2026-040",
    property: "Camden Crossing",
    issue: "Network degraded — core switch showing high CPU utilization (94%). Intermittent packet loss on distribution ring.",
    priority: "P1",
    opened: "Today, 9:02 AM",
    tech: "Maria L.",
    status: "In Progress",
  },
  {
    id: "tk3",
    num: "NET-2026-038",
    property: "Ashford Glen",
    issue: "AP-04 in Building C rebooting every ~4h. Likely firmware bug; update scheduled for tonight's maintenance window.",
    priority: "P2",
    opened: "3 days ago",
    tech: "Carlos R.",
    status: "In Progress",
  },
  {
    id: "tk4",
    num: "NET-2026-035",
    property: "Lakewood HOA",
    issue: "Firewall SSL certificate expiring in 7 days. Renewal submitted; pending CA validation.",
    priority: "P3",
    opened: "5 days ago",
    tech: "James T.",
    status: "Open",
  },
];

// ─── Recentevents for detail panel ───────────────────────────────────────────

const STONEGATE_EVENTS = [
  { time: "Today 10:22 AM", msg: "All devices reporting healthy", type: "ok" },
  { time: "Today 8:41 AM",  msg: "Scheduled config backup completed",   type: "ok" },
  { time: "Yesterday",      msg: "Firmware update applied to 3 APs",    type: "info" },
  { time: "Apr 25",         msg: "Brief DHCP renewal spike resolved",    type: "warn" },
  { time: "Apr 22",         msg: "Monthly bandwidth report generated",   type: "info" },
];

// 7-day bandwidth chart values (download Mbps)
const BW_CHART = [198, 220, 245, 211, 265, 230, 245];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const statusConfig: Record<NetworkStatus, { dot: string; text: string; bg: string; border: string; label: string }> = {
  Healthy:  { dot: "bg-emerald-400",              text: "text-emerald-700", bg: "bg-emerald-50",  border: "border-emerald-200", label: "Healthy"  },
  Degraded: { dot: "bg-amber-400 animate-pulse",  text: "text-amber-700",  bg: "bg-amber-50",    border: "border-amber-200",   label: "Degraded" },
  Down:     { dot: "bg-red-500 animate-pulse",    text: "text-red-700",    bg: "bg-red-50",      border: "border-red-200",     label: "Down"     },
};

const tierConfig: Record<Tier, { bg: string; text: string; border: string }> = {
  Basic:    { bg: "bg-slate-100",   text: "text-slate-600",  border: "border-slate-200"  },
  Standard: { bg: "bg-blue-50",     text: "text-blue-700",   border: "border-blue-200"   },
  Premium:  { bg: "bg-violet-50",   text: "text-violet-700", border: "border-violet-200" },
};

const priorityConfig: Record<TicketPriority, { bg: string; text: string; border: string }> = {
  P1: { bg: "bg-red-50",    text: "text-red-700",    border: "border-red-200"    },
  P2: { bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-200"  },
  P3: { bg: "bg-slate-100", text: "text-slate-600",  border: "border-slate-200"  },
};

const ticketStatusConfig: Record<TicketStatus, { bg: string; text: string }> = {
  "Open":        { bg: "bg-blue-50",   text: "text-blue-700"  },
  "In Progress": { bg: "bg-amber-50",  text: "text-amber-700" },
  "Escalated":   { bg: "bg-red-100",   text: "text-red-700"   },
};

const deviceStatusConfig: Record<string, { dot: string; text: string }> = {
  Online:  { dot: "bg-emerald-400", text: "text-emerald-600" },
  Warning: { dot: "bg-amber-400",   text: "text-amber-600"   },
  Offline: { dot: "bg-red-400",     text: "text-red-600"     },
};

function BandwidthBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden min-w-[60px]">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] text-slate-500 font-medium shrink-0 w-14 text-right">{value} Mbps</span>
    </div>
  );
}

function MiniBwChart({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  return (
    <div className="space-y-1">
      <div className="flex items-end gap-1 h-10">
        {values.map((v, i) => (
          <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-0.5">
            <div
              className="w-full bg-[#2563EB]/20 hover:bg-[#2563EB]/40 rounded-sm transition-colors"
              style={{ height: `${Math.round((v / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-1">
        {days.map((d, i) => (
          <div key={i} className="flex-1 text-center text-[9px] text-slate-400">{d}</div>
        ))}
      </div>
    </div>
  );
}

// ─── Network Topology Diagram ─────────────────────────────────────────────────

function TopologyDiagram() {
  const box = "bg-white border-2 border-gray-300 rounded-lg px-3 py-2 text-center shadow-sm";
  const apBox = "bg-blue-50 border-2 border-blue-200 rounded-lg px-2 py-1.5 text-center";
  const line = "border-t-2 border-gray-200 flex-1";
  const vLine = "w-0.5 h-4 bg-gray-200 mx-auto";

  return (
    <div className="py-4 px-2 select-none">
      {/* Internet */}
      <div className="flex justify-center">
        <div className={cn(box, "border-indigo-300 bg-indigo-50")}>
          <Globe size={14} className="mx-auto text-indigo-500 mb-0.5" />
          <p className="text-[10px] font-bold text-indigo-700">Internet</p>
          <p className="text-[9px] text-indigo-400">ISP Gateway</p>
        </div>
      </div>
      <div className={vLine} />
      {/* Firewall */}
      <div className="flex justify-center">
        <div className={cn(box, "border-red-200 bg-red-50")}>
          <Shield size={14} className="mx-auto text-red-500 mb-0.5" />
          <p className="text-[10px] font-bold text-red-700">Firewall</p>
          <p className="text-[9px] text-red-400">FortiGate 60F</p>
        </div>
      </div>
      <div className={vLine} />
      {/* Core Switch */}
      <div className="flex justify-center">
        <div className={cn(box, "border-amber-200 bg-amber-50")}>
          <Network size={14} className="mx-auto text-amber-600 mb-0.5" />
          <p className="text-[10px] font-bold text-amber-700">Core Switch</p>
          <p className="text-[9px] text-amber-500">Cisco Cat 2960-X</p>
        </div>
      </div>
      <div className={vLine} />
      {/* Distribution */}
      <div className="flex items-start justify-center gap-6">
        <div className="flex flex-col items-center gap-1">
          <div className={vLine} />
          <div className={cn(box, "border-slate-300")}>
            <Network size={12} className="mx-auto text-slate-500 mb-0.5" />
            <p className="text-[10px] font-bold text-slate-700">Dist. SW 1</p>
          </div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className={vLine} />
          <div className={cn(box, "border-slate-300")}>
            <Network size={12} className="mx-auto text-slate-500 mb-0.5" />
            <p className="text-[10px] font-bold text-slate-700">Dist. SW 2</p>
          </div>
        </div>
      </div>
      <div className="flex justify-center gap-16 mt-1">
        <div className={vLine} />
        <div className={vLine} />
      </div>
      {/* APs */}
      <div className="flex items-start justify-around mt-0.5">
        {["AP-01", "AP-02", "AP-03", "AP-04", "AP-05"].map((ap) => (
          <div key={ap} className={apBox}>
            <Wifi size={11} className="mx-auto text-blue-500 mb-0.5" />
            <p className="text-[9px] font-bold text-blue-700">{ap}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function PropertyDetailPanel({ prop }: { prop: typeof PROPERTIES[0] }) {
  const sc = statusConfig[prop.status];
  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className={cn("w-2 h-2 rounded-full", sc.dot)} />
          <h3 className="text-sm font-bold text-slate-900">{prop.name}</h3>
        </div>
        <p className="text-xs text-slate-400">Premium · $499/mo · Uptime {prop.uptime}</p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold hover:bg-amber-100 transition-colors">
          <RotateCcw size={12} /> Remote Reboot
        </button>
        <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#2563EB] text-white text-xs font-semibold hover:bg-[#1d4ed8] transition-colors">
          <Activity size={12} /> Run Diagnostics
        </button>
      </div>

      {/* Topology */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50">
          <Network size={12} className="text-slate-400" />
          <p className="text-[11px] font-semibold text-slate-600">Network Topology</p>
        </div>
        <TopologyDiagram />
      </div>

      {/* 7-day Bandwidth */}
      <div className="border border-gray-200 rounded-xl p-3">
        <p className="text-[11px] font-semibold text-slate-600 mb-2">7-Day Bandwidth (Download)</p>
        <MiniBwChart values={BW_CHART} />
      </div>

      {/* Recent Events */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50">
          <Clock size={12} className="text-slate-400" />
          <p className="text-[11px] font-semibold text-slate-600">Recent Events</p>
        </div>
        <div className="divide-y divide-gray-50">
          {STONEGATE_EVENTS.map((ev, i) => (
            <div key={i} className="px-3 py-2 flex items-start gap-2">
              {ev.type === "ok"   && <CheckCircle2 size={12} className="text-emerald-400 mt-0.5 shrink-0" />}
              {ev.type === "warn" && <AlertTriangle size={12} className="text-amber-400 mt-0.5 shrink-0" />}
              {ev.type === "info" && <AlertCircle size={12} className="text-blue-400 mt-0.5 shrink-0" />}
              <div>
                <p className="text-[11px] text-slate-700">{ev.msg}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{ev.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Device list */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50">
          <Cpu size={12} className="text-slate-400" />
          <p className="text-[11px] font-semibold text-slate-600">Devices ({prop.switches + prop.aps + prop.firewalls})</p>
        </div>
        <div className="divide-y divide-gray-50">
          {[
            { label: `Firewall ×${prop.firewalls}`,  icon: Shield, color: "text-red-400"     },
            { label: `Switches ×${prop.switches}`,   icon: Network, color: "text-amber-500"  },
            { label: `Access Points ×${prop.aps}`,   icon: Wifi,    color: "text-blue-500"   },
          ].map(({ label, icon: Icon, color }) => (
            <div key={label} className="flex items-center gap-2 px-3 py-2">
              <Icon size={12} className={color} />
              <span className="text-[11px] text-slate-700">{label}</span>
              <span className="ml-auto flex items-center gap-1 text-[10px] text-emerald-600 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" /> Online
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon: Icon, iconBg, iconColor,
}: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; iconBg: string; iconColor: string;
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

export default function NetworkPage() {
  const [activeTab, setActiveTab] = useState<"properties" | "devices" | "tickets">("properties");
  const [selectedPropId, setSelectedPropId] = useState<string>("stonegate");
  const [deviceTypeFilter, setDeviceTypeFilter] = useState<DeviceType | "All">("All");
  const [devicePropFilter, setDevicePropFilter] = useState<string>("All");

  const tabs = [
    { key: "properties", label: "Properties" },
    { key: "devices",    label: "Devices"    },
    { key: "tickets",    label: "Tickets"    },
  ] as const;

  const selectedProp = PROPERTIES.find((p) => p.id === selectedPropId) ?? PROPERTIES[0];

  const filteredDevices = DEVICES.filter((d) => {
    const typeMatch = deviceTypeFilter === "All" || d.type === deviceTypeFilter;
    const propMatch = devicePropFilter === "All" || d.property === devicePropFilter;
    return typeMatch && propMatch;
  });

  const propNames = Array.from(new Set(DEVICES.map((d) => d.property)));

  return (
    <div className="min-h-full bg-[#f0f2f5]">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Managed Network</h1>
          <p className="text-sm text-slate-500 mt-0.5">Network infrastructure monitoring and management.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-sm font-medium text-slate-700 transition-colors shadow-sm">
            <Map size={14} /> Network Diagram
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-sm font-medium transition-colors shadow-sm shadow-blue-200">
            <Plus size={15} /> Add Property
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-5 gap-4">
          <StatCard label="Managed Networks"  value="9"       icon={Network}       iconBg="bg-blue-50"    iconColor="text-blue-600" />
          <StatCard label="Devices Online"     value="247/251" icon={Activity}      iconBg="bg-indigo-50"  iconColor="text-indigo-600" />
          <StatCard label="Network Uptime"     value="99.7%"   icon={CheckCircle2}  iconBg="bg-emerald-50" iconColor="text-emerald-600" />
          <StatCard label="Open Tickets"       value="4"       sub="Needs action"   icon={AlertTriangle}   iconBg="bg-amber-50"   iconColor="text-amber-600" />
          <StatCard label="MRR"                value="$4,410"  icon={DollarSign}    iconBg="bg-violet-50"  iconColor="text-violet-600" />
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

        {/* ── Properties Tab ── */}
        {activeTab === "properties" && (
          <div className="flex gap-5">
            {/* Left: table */}
            <div className="flex-1 min-w-0 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100">
                <Network size={14} className="text-[#2563EB]" />
                <h2 className="text-sm font-bold text-slate-900">Managed Properties</h2>
                <span className="ml-2 text-xs bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded-full">9</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      {["Property", "Status", "Devices", "Uptime", "Last Incident", "Bandwidth", ""].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5 text-slate-500 font-semibold uppercase tracking-wide text-[11px]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PROPERTIES.map((prop) => {
                      const sc = statusConfig[prop.status];
                      const tc = tierConfig[prop.tier];
                      const isSelected = selectedPropId === prop.id;
                      return (
                        <tr
                          key={prop.id}
                          onClick={() => setSelectedPropId(prop.id)}
                          className={cn(
                            "border-b border-gray-50 transition-colors cursor-pointer",
                            isSelected ? "bg-blue-50" : "hover:bg-gray-50"
                          )}
                        >
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-800">{prop.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border", tc.bg, tc.text, tc.border)}>
                                {prop.tier}
                              </span>
                              <span className="text-slate-400">${prop.price}/mo</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-semibold", sc.bg, sc.text, "border", sc.border)}>
                              <span className={cn("w-1.5 h-1.5 rounded-full", sc.dot)} />
                              {sc.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            <div className="space-y-0.5">
                              <p>{prop.switches} SW</p>
                              <p>{prop.aps} AP</p>
                              <p>{prop.firewalls} FW</p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn(
                              "font-bold text-sm",
                              prop.uptime === "100%" ? "text-emerald-600"
                              : parseFloat(prop.uptime) >= 99 ? "text-emerald-600"
                              : parseFloat(prop.uptime) >= 98 ? "text-amber-600"
                              : "text-red-600"
                            )}>
                              {prop.uptime}
                            </span>
                          </td>
                          <td className={cn(
                            "px-4 py-3 font-medium",
                            prop.lastIncident === "Today" ? "text-red-500"
                            : prop.lastIncident === "No incidents" || prop.lastIncident === "None" ? "text-emerald-600"
                            : "text-slate-500"
                          )}>
                            {prop.lastIncident}
                          </td>
                          <td className="px-4 py-3 min-w-[140px]">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1">
                                <span className="text-[9px] text-slate-400 w-3">↓</span>
                                <BandwidthBar value={prop.dlMbps} max={prop.dlMax} color="bg-[#2563EB]" />
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-[9px] text-slate-400 w-3">↑</span>
                                <BandwidthBar value={prop.ulMbps} max={prop.ulMax} color="bg-emerald-400" />
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <ChevronRight size={14} className={cn("transition-colors", isSelected ? "text-blue-500" : "text-slate-300")} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right: detail panel */}
            <div className="w-72 shrink-0">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sticky top-4 max-h-[calc(100vh-180px)] overflow-y-auto">
                <PropertyDetailPanel prop={selectedProp} />
              </div>
            </div>
          </div>
        )}

        {/* ── Devices Tab ── */}
        {activeTab === "devices" && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm">
                <Filter size={13} className="text-slate-400" />
                <select
                  value={deviceTypeFilter}
                  onChange={(e) => setDeviceTypeFilter(e.target.value as DeviceType | "All")}
                  className="text-xs text-slate-700 bg-transparent outline-none cursor-pointer"
                >
                  <option value="All">All Types</option>
                  <option value="Switch">Switch</option>
                  <option value="AP">Access Point</option>
                  <option value="Firewall">Firewall</option>
                </select>
              </div>
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm">
                <Building2 size={13} className="text-slate-400" />
                <select
                  value={devicePropFilter}
                  onChange={(e) => setDevicePropFilter(e.target.value)}
                  className="text-xs text-slate-700 bg-transparent outline-none cursor-pointer"
                >
                  <option value="All">All Properties</option>
                  {propNames.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <span className="text-xs text-slate-400 ml-auto">{filteredDevices.length} devices</span>
              <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-gray-200 text-xs font-medium text-slate-600 hover:bg-gray-50 shadow-sm transition-colors">
                <RefreshCw size={12} /> Refresh
              </button>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {["Property", "Type", "Model", "IP Address", "MAC Address", "Status", "Last Seen", "Uptime"].map((h) => (
                      <th key={h} className="text-left px-4 py-2.5 text-slate-500 font-semibold uppercase tracking-wide text-[11px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredDevices.map((d) => {
                    const ds = deviceStatusConfig[d.status];
                    return (
                      <tr key={d.id} className="border-b border-gray-50 hover:bg-blue-50/20 transition-colors last:border-b-0">
                        <td className="px-4 py-3 font-medium text-slate-800">{d.property}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold">
                            {d.type === "Firewall" && <Shield size={11} className="text-red-400" />}
                            {d.type === "Switch"   && <Network size={11} className="text-amber-500" />}
                            {d.type === "AP"       && <Wifi size={11} className="text-blue-500" />}
                            {d.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{d.model}</td>
                        <td className="px-4 py-3 font-mono text-slate-600">{d.ip}</td>
                        <td className="px-4 py-3 font-mono text-slate-400 text-[10px]">{d.mac}</td>
                        <td className="px-4 py-3">
                          <span className={cn("inline-flex items-center gap-1.5 font-semibold", ds.text)}>
                            <span className={cn("w-1.5 h-1.5 rounded-full", ds.dot)} />
                            {d.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400">{d.lastSeen}</td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            "font-semibold",
                            parseFloat(d.uptime) >= 99 ? "text-emerald-600"
                            : parseFloat(d.uptime) >= 98 ? "text-amber-600"
                            : "text-red-600"
                          )}>
                            {d.uptime}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Tickets Tab ── */}
        {activeTab === "tickets" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wrench size={14} className="text-slate-500" />
                <h2 className="text-sm font-bold text-slate-900">Open Network Tickets</h2>
                <span className="text-xs bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full">4 open</span>
              </div>
              <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-sm font-medium transition-colors shadow-sm shadow-blue-200">
                <Plus size={14} /> New Ticket
              </button>
            </div>

            <div className="space-y-3">
              {TICKETS.map((ticket) => {
                const pc = priorityConfig[ticket.priority];
                const ts = ticketStatusConfig[ticket.status];
                return (
                  <div key={ticket.id} className={cn(
                    "bg-white rounded-xl border shadow-sm p-5",
                    ticket.priority === "P1" ? "border-red-200" : ticket.priority === "P2" ? "border-amber-200" : "border-gray-200"
                  )}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className={cn("text-[11px] font-extrabold px-2 py-0.5 rounded border", pc.bg, pc.text, pc.border)}>
                            {ticket.priority}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400">{ticket.num}</span>
                          <span className="flex items-center gap-1 text-[11px] text-slate-500">
                            <Building2 size={10} /> {ticket.property}
                          </span>
                        </div>
                        <p className="text-sm text-slate-800 font-medium leading-snug">{ticket.issue}</p>
                      </div>
                      <div className="shrink-0 text-right space-y-1">
                        <span className={cn("inline-block text-[11px] font-semibold px-2 py-1 rounded-lg", ts.bg, ts.text)}>
                          {ticket.status}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-4 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1"><Clock size={10} /> Opened: {ticket.opened}</span>
                      <span className="flex items-center gap-1"><Hash size={10} /> Assigned: {ticket.tech}</span>
                      {ticket.priority === "P1" && (
                        <span className="ml-auto flex items-center gap-1 text-red-500 font-semibold">
                          <AlertTriangle size={10} /> Critical — SLA 4h
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
