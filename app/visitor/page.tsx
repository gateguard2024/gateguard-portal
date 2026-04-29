"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { TopBar } from "@/components/layout/TopBar";
import {
  Plus,
  Eye,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  Camera,
  Phone,
  Mail,
  RefreshCw,
  ChevronDown,
  Filter,
  Search,
  DoorOpen,
  Hash,
  User,
  Calendar,
  X,
  Edit2,
  Grid3X3,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type EntryMethod = "QR Scan" | "Fob" | "App" | "Intercom Call";
type EntryResult = "Admitted" | "Denied" | "Waiting";
type VisitorType = "Contractor" | "Delivery" | "Guest" | "Pre-registered";
type ContactMethod = "App" | "Call" | "SMS";

interface VisitorLog {
  id: string;
  time: string;
  property: string;
  gate: string;
  visitor: string;
  isPreReg: boolean;
  method: EntryMethod;
  result: EntryResult;
}

interface PreRegistration {
  id: string;
  name: string;
  timeWindow: string;
  property: string;
  unit: string;
  type: VisitorType;
  autoAdmit: boolean;
  notes: string;
}

interface QREntry {
  id: string;
  property: string;
  lastScanned: string;
  scansToday: number;
}

interface DirectoryEntry {
  id: string;
  unit: string;
  residents: string;
  contact: ContactMethod;
  visible: boolean;
  lastUpdated: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const VISITOR_LOGS: VisitorLog[] = [
  { id: "v01", time: "2:34 PM", property: "Stonegate", gate: "Gate A", visitor: "Amazon", isPreReg: true, method: "QR Scan", result: "Admitted" },
  { id: "v02", time: "2:28 PM", property: "Ashford Glen", gate: "Main", visitor: "John Martinez", isPreReg: false, method: "Intercom Call", result: "Admitted" },
  { id: "v03", time: "2:15 PM", property: "Stonegate", gate: "Gate A", visitor: "Unknown Visitor", isPreReg: false, method: "Fob", result: "Admitted" },
  { id: "v04", time: "1:55 PM", property: "Maple Ridge", gate: "Main", visitor: "Sarah Lee", isPreReg: false, method: "QR Scan", result: "Admitted" },
  { id: "v05", time: "1:44 PM", property: "Stonegate", gate: "Gate B", visitor: "Unknown Visitor", isPreReg: false, method: "Intercom Call", result: "Denied" },
  { id: "v06", time: "1:32 PM", property: "Harbor View", gate: "Main", visitor: "FedEx", isPreReg: true, method: "QR Scan", result: "Admitted" },
  { id: "v07", time: "1:20 PM", property: "Ashford Glen", gate: "Main", visitor: "Unknown Visitor", isPreReg: false, method: "Intercom Call", result: "Waiting" },
  { id: "v08", time: "12:58 PM", property: "Stonegate", gate: "Gate A", visitor: "Miguel Torres", isPreReg: false, method: "App", result: "Admitted" },
  { id: "v09", time: "12:45 PM", property: "Northgate Plaza", gate: "Main", visitor: "Visitor Badge", isPreReg: false, method: "QR Scan", result: "Admitted" },
  { id: "v10", time: "12:30 PM", property: "Stonegate", gate: "Gate A", visitor: "USPS", isPreReg: true, method: "QR Scan", result: "Admitted" },
  { id: "v11", time: "12:15 PM", property: "Maple Ridge", gate: "Main", visitor: "Unknown Visitor", isPreReg: false, method: "Fob", result: "Denied" },
  { id: "v12", time: "11:58 AM", property: "Ashford Glen", gate: "Main", visitor: "Carlos Rivera", isPreReg: false, method: "Intercom Call", result: "Admitted" },
];

const PRE_REGISTRATIONS: PreRegistration[] = [
  { id: "pr01", name: "Amazon Delivery", timeWindow: "Today 8:00 AM – 8:00 PM", property: "Stonegate", unit: "All Units", type: "Delivery", autoAdmit: true, notes: "Package deliveries only" },
  { id: "pr02", name: "HVAC Tech (Mike W.)", timeWindow: "Tomorrow 10:00 AM – 2:00 PM", property: "Ashford Glen", unit: "Unit 204", type: "Contractor", autoAdmit: false, notes: "Contractor badge required" },
  { id: "pr03", name: "Party Guests (Rivera)", timeWindow: "Sat 6:00 PM – 11:00 PM", property: "Stonegate", unit: "Unit 118", type: "Guest", autoAdmit: false, notes: "Up to 15 guests" },
  { id: "pr04", name: "Plumber (Bluewave)", timeWindow: "Tomorrow 9:00 AM – 12:00 PM", property: "Maple Ridge", unit: "Unit 302", type: "Contractor", autoAdmit: false, notes: "Emergency repair" },
  { id: "pr05", name: "FedEx / UPS", timeWindow: "Daily 7:00 AM – 7:00 PM", property: "Harbor View", unit: "All Units", type: "Delivery", autoAdmit: true, notes: "Recurring auto-admit" },
  { id: "pr06", name: "Catering Co.", timeWindow: "Sat 3:00 PM – 10:00 PM", property: "Northgate Plaza", unit: "Clubhouse", type: "Guest", autoAdmit: false, notes: "Event setup crew" },
];

const QR_ENTRIES: QREntry[] = [
  { id: "qr01", property: "Stonegate Townhomes – Gate A", lastScanned: "2 min ago", scansToday: 14 },
  { id: "qr02", property: "Stonegate Townhomes – Gate B", lastScanned: "38 min ago", scansToday: 6 },
  { id: "qr03", property: "Ashford Glen – Main Entrance", lastScanned: "8 min ago", scansToday: 9 },
  { id: "qr04", property: "Harbor View – Front Gate", lastScanned: "1h ago", scansToday: 5 },
];

const DIRECTORY_ENTRIES: DirectoryEntry[] = [
  { id: "d01", unit: "101", residents: "James & Patricia Holloway", contact: "App", visible: true, lastUpdated: "Apr 12" },
  { id: "d02", unit: "102", residents: "Marcus Chen", contact: "Call", visible: true, lastUpdated: "Mar 28" },
  { id: "d03", unit: "103", residents: "Angela Reyes", contact: "SMS", visible: false, lastUpdated: "Apr 1" },
  { id: "d04", unit: "104", residents: "Tom & Lisa Park", contact: "App", visible: true, lastUpdated: "Apr 18" },
  { id: "d05", unit: "105", residents: "David Okafor", contact: "Call", visible: true, lastUpdated: "Mar 15" },
  { id: "d06", unit: "106", residents: "Samantha Wu", contact: "App", visible: true, lastUpdated: "Apr 22" },
  { id: "d07", unit: "107", residents: "Vacant", contact: "App", visible: false, lastUpdated: "Feb 10" },
  { id: "d08", unit: "108", residents: "Roberto & Nina Flores", contact: "SMS", visible: true, lastUpdated: "Apr 25" },
];

const PROPERTIES = ["All Properties", "Stonegate", "Ashford Glen", "Maple Ridge", "Harbor View", "Northgate Plaza"];
const TABS = ["Live Log", "Pre-registration", "Directory Management"] as const;
type TabType = typeof TABS[number];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  accent,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  accent: "default" | "green" | "blue" | "red";
  icon: React.ElementType;
}) {
  const colors = {
    default: "text-foreground",
    green: "text-emerald-600",
    blue: "text-blue-600",
    red: "text-red-600",
  };
  return (
    <div className="bg-white border border-border rounded-xl px-4 py-3 flex items-center gap-3 flex-1">
      <div className={cn("p-2 rounded-lg", {
        "bg-slate-100": accent === "default",
        "bg-emerald-50": accent === "green",
        "bg-blue-50": accent === "blue",
        "bg-red-50": accent === "red",
      })}>
        <Icon size={16} className={colors[accent]} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("text-lg font-bold leading-tight", colors[accent])}>{value}</p>
      </div>
    </div>
  );
}

function ResultBadge({ result }: { result: EntryResult }) {
  if (result === "Admitted") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
        <CheckCircle2 size={11} /> Admitted
      </span>
    );
  }
  if (result === "Denied") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-xs font-medium">
        <XCircle size={11} /> Denied
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-medium">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
      Waiting
    </span>
  );
}

function MethodBadge({ method }: { method: EntryMethod }) {
  const styles: Record<EntryMethod, string> = {
    "QR Scan": "bg-violet-50 text-violet-700",
    "Fob": "bg-slate-100 text-slate-600",
    "App": "bg-blue-50 text-blue-700",
    "Intercom Call": "bg-orange-50 text-orange-700",
  };
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", styles[method])}>
      {method}
    </span>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={cn(
        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
        checked ? "bg-blue-600" : "bg-slate-200"
      )}
    >
      <span
        className={cn(
          "inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-4" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

// ─── Tab: Live Log ─────────────────────────────────────────────────────────────

function LiveLogTab() {
  const [property, setProperty] = useState("All Properties");

  const filtered = property === "All Properties"
    ? VISITOR_LOGS
    : VISITOR_LOGS.filter((v) => v.property === property);

  return (
    <div className="flex gap-4">
      {/* Left — Visitor Feed */}
      <div className="flex-[55] min-w-0">
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search visitors..."
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
            <div className="relative">
              <select
                value={property}
                onChange={(e) => setProperty(e.target.value)}
                className="appearance-none pl-3 pr-8 py-1.5 text-sm bg-slate-50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
              >
                {PROPERTIES.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-slate-50 transition-colors">
              <Filter size={12} /> Filter
            </button>
            <button className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-slate-50 transition-colors">
              <RefreshCw size={13} />
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-slate-50/50">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap">Time</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap">Location</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap">Visitor</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap">Method</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap">Result</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap">Snap</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap font-mono">{log.time}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <p className="text-xs font-medium text-foreground">{log.property}</p>
                      <p className="text-xs text-muted-foreground">{log.gate}</p>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-foreground">{log.visitor}</span>
                        {log.isPreReg && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-50 text-blue-600 font-medium">pre-reg</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <MethodBadge method={log.method} />
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <ResultBadge result={log.result} />
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="w-10 h-7 rounded bg-slate-200 flex items-center justify-center">
                        <Camera size={10} className="text-slate-400" />
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <button className="flex items-center gap-1 px-2 py-1 rounded-lg border border-border text-xs text-muted-foreground hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-colors whitespace-nowrap">
                        <Eye size={11} /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Right — Kiosk Preview */}
      <div className="flex-[45] min-w-0 space-y-4">
        <div className="bg-white border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Property Entry Kiosk</h3>

          {/* Phone mockup */}
          <div className="flex justify-center">
            <div className="w-52 bg-slate-900 rounded-[28px] p-2 shadow-xl">
              <div className="bg-white rounded-[20px] overflow-hidden">
                {/* Status bar */}
                <div className="bg-blue-600 px-4 pt-3 pb-4 text-white text-center">
                  <p className="text-[9px] font-medium opacity-75 mb-1">GATEGUARD VISITOR</p>
                  <p className="text-[13px] font-bold leading-tight">Stonegate Townhomes</p>
                  <p className="text-[9px] opacity-75 mt-0.5">Welcome — please scan or dial</p>
                </div>

                {/* QR code area */}
                <div className="px-4 py-3 border-b border-slate-100">
                  <div className="w-full aspect-square max-w-[120px] mx-auto bg-slate-100 rounded-xl flex flex-col items-center justify-center gap-1 border-2 border-dashed border-slate-300">
                    <div className="grid grid-cols-3 gap-0.5">
                      {Array.from({ length: 9 }).map((_, i) => (
                        <div
                          key={i}
                          className={cn("w-3 h-3 rounded-[2px]", i % 3 === 0 || i === 4 ? "bg-slate-700" : "bg-slate-300")}
                        />
                      ))}
                    </div>
                    <p className="text-[8px] text-slate-400 mt-1 text-center leading-tight">Scan for<br/>Directory</p>
                  </div>
                </div>

                {/* Keypad */}
                <div className="px-3 py-2">
                  <p className="text-[9px] text-slate-400 text-center mb-2">Or enter unit number</p>
                  <div className="bg-slate-100 rounded-lg px-3 py-1.5 text-center text-[11px] font-mono text-slate-600 mb-2">
                    _ _ _ _
                  </div>
                  <div className="grid grid-cols-3 gap-1 mb-2">
                    {[1,2,3,4,5,6,7,8,9,"*",0,"#"].map((k) => (
                      <button key={k} className="py-1 rounded bg-slate-200 text-[9px] font-semibold text-slate-700 hover:bg-slate-300 transition-colors">
                        {k}
                      </button>
                    ))}
                  </div>
                  <button className="w-full py-1.5 rounded-lg bg-blue-600 text-white text-[9px] font-semibold flex items-center justify-center gap-1">
                    <Phone size={8} /> Call Leasing Office
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Active QR Codes */}
        <div className="bg-white border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Active QR Codes</h3>
            <span className="text-xs text-muted-foreground">{QR_ENTRIES.length} active</span>
          </div>
          <div className="space-y-2 mb-3">
            {QR_ENTRIES.map((qr) => (
              <div key={qr.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50 border border-border">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{qr.property}</p>
                  <p className="text-[10px] text-muted-foreground">Last scanned: {qr.lastScanned}</p>
                </div>
                <div className="text-right ml-3">
                  <p className="text-sm font-bold text-foreground">{qr.scansToday}</p>
                  <p className="text-[10px] text-muted-foreground">today</p>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
            <Plus size={14} /> Generate New QR Code
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Pre-registration ────────────────────────────────────────────────────

function PreRegistrationTab() {
  const [autoAdmit, setAutoAdmit] = useState<Record<string, boolean>>(
    Object.fromEntries(PRE_REGISTRATIONS.map((p) => [p.id, p.autoAdmit]))
  );

  const typeBadge: Record<VisitorType, string> = {
    Contractor: "bg-amber-50 text-amber-700",
    Delivery: "bg-violet-50 text-violet-700",
    Guest: "bg-blue-50 text-blue-700",
    "Pre-registered": "bg-emerald-50 text-emerald-700",
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Upcoming Expected Visitors</h3>
            <p className="text-xs text-muted-foreground">Pre-registered visitors will be auto-processed at the gate</p>
          </div>
          <button className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
            <Plus size={14} /> Pre-register Visitor
          </button>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-slate-50/50">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Visitor / Name</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Time Window</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Property</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Unit / Host</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Type</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Auto-Admit</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Notes</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {PRE_REGISTRATIONS.map((reg) => (
              <tr key={reg.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center">
                      <User size={13} className="text-slate-500" />
                    </div>
                    <span className="text-sm font-medium text-foreground">{reg.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
                    <Calendar size={11} />
                    {reg.timeWindow}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-foreground">{reg.property}</td>
                <td className="px-4 py-3 text-sm text-foreground">{reg.unit}</td>
                <td className="px-4 py-3">
                  <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", typeBadge[reg.type])}>
                    {reg.type}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <ToggleSwitch
                    checked={autoAdmit[reg.id]}
                    onChange={() => setAutoAdmit((prev) => ({ ...prev, [reg.id]: !prev[reg.id] }))}
                  />
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground max-w-[160px] truncate">{reg.notes}</td>
                <td className="px-4 py-3">
                  <button className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors">
                    <X size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add form card */}
      <div className="bg-white border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">Quick Pre-registration</h3>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Visitor Name</label>
            <input type="text" placeholder="e.g. Amazon Delivery" className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Property</label>
            <select className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
              {PROPERTIES.slice(1).map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Visitor Type</label>
            <select className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
              {["Guest", "Delivery", "Contractor"].map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
          <Plus size={14} /> Save Pre-registration
        </button>
      </div>
    </div>
  );
}

// ─── Tab: Directory Management ────────────────────────────────────────────────

function DirectoryManagementTab() {
  const [selectedProperty, setSelectedProperty] = useState("Stonegate Townhomes");
  const [visible, setVisible] = useState<Record<string, boolean>>(
    Object.fromEntries(DIRECTORY_ENTRIES.map((d) => [d.id, d.visible]))
  );

  const contactIcon: Record<ContactMethod, React.ElementType> = {
    App: DoorOpen,
    Call: Phone,
    SMS: Mail,
  };

  const contactColor: Record<ContactMethod, string> = {
    App: "text-blue-600 bg-blue-50",
    Call: "text-emerald-600 bg-emerald-50",
    SMS: "text-violet-600 bg-violet-50",
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="relative">
              <select
                value={selectedProperty}
                onChange={(e) => setSelectedProperty(e.target.value)}
                className="appearance-none pl-3 pr-8 py-1.5 text-sm font-medium border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
              >
                {["Stonegate Townhomes", "Ashford Glen", "Maple Ridge", "Harbor View"].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
            <span className="text-xs text-muted-foreground">{DIRECTORY_ENTRIES.length} units</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-slate-50 transition-colors">
              <RefreshCw size={12} /> Sync from Resident List
            </button>
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors">
              <Plus size={12} /> Add Entry
            </button>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-slate-50/50">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Unit</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Resident Name(s)</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Contact Method</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Directory Visible</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Last Updated</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {DIRECTORY_ENTRIES.map((entry) => {
              const ContactIcon = contactIcon[entry.contact];
              return (
                <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Hash size={11} className="text-muted-foreground" />
                      <span className="text-sm font-semibold text-foreground">{entry.unit}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center">
                        <User size={11} className="text-slate-500" />
                      </div>
                      <span className={cn("text-sm", entry.residents === "Vacant" ? "text-muted-foreground italic" : "text-foreground")}>
                        {entry.residents}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium", contactColor[entry.contact])}>
                      <ContactIcon size={10} />
                      {entry.contact}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <ToggleSwitch
                      checked={visible[entry.id]}
                      onChange={() => setVisible((prev) => ({ ...prev, [entry.id]: !prev[entry.id] }))}
                    />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{entry.lastUpdated}</td>
                  <td className="px-4 py-3">
                    <button className="p-1.5 rounded-lg text-muted-foreground hover:text-blue-600 hover:bg-blue-50 transition-colors">
                      <Edit2 size={13} />
                    </button>
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

export default function VisitorPage() {
  const [activeTab, setActiveTab] = useState<TabType>("Live Log");

  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        title="Visitor Management"
        actions={
          <>
            <button className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-slate-50 transition-colors">
              QR Codes
            </button>
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
              <Plus size={15} /> Add Directory
            </button>
          </>
        }
      />

      <div className="flex-1 p-6 space-y-5">
        {/* Stats */}
        <div className="flex gap-3">
          <StatCard label="Visitor Logs Today" value="34" accent="default" icon={Users} />
          <StatCard label="Avg Wait Time" value="1m 12s" accent="green" icon={Clock} />
          <StatCard label="Pre-registered" value="8" accent="blue" icon={CheckCircle2} />
          <StatCard label="Denied Entry" value="2" accent="red" icon={XCircle} />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 border border-border rounded-xl p-1 w-fit">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
                activeTab === tab
                  ? "bg-white text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/60"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "Live Log" && <LiveLogTab />}
        {activeTab === "Pre-registration" && <PreRegistrationTab />}
        {activeTab === "Directory Management" && <DirectoryManagementTab />}
      </div>
    </div>
  );
}

