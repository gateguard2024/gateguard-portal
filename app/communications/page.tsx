"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Phone,
  MessageSquare,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneCall,
  Copy,
  Plus,
  Edit2,
  Settings,
  CheckCircle2,
  XCircle,
  Clock,
  Check,
  Network,
  GitBranch,
  ArrowRight,
} from "lucide-react";

// ─── Mock Data ────────────────────────────────────────────────────────────────

const EXTENSIONS = [
  { ext: "100", label: "Main Reception", type: "Ring Group", active: true },
  { ext: "200", label: "SOC Emergency Line", type: "Direct", active: true },
  { ext: "300", label: "Sales (RF)", type: "Direct", active: true },
  { ext: "301", label: "Sales (Marcus)", type: "Direct", active: true },
  { ext: "302", label: "Sales (Jordan)", type: "Direct", active: true },
  { ext: "400", label: "Tech Support", type: "IVR", active: true },
  { ext: "401", label: "Dispatch", type: "Direct", active: true },
  { ext: "500", label: "Voicemail / After Hours", type: "Voicemail", active: false },
];

const SMS_TEMPLATES = [
  {
    id: 1,
    name: "Tech on the Way",
    body: "Hi {customer_name}, your GateGuard technician is on the way and will arrive in approximately {eta} minutes.",
    usedFor: "Dispatch",
    lastEdited: "3 days ago",
  },
  {
    id: 2,
    name: "Job Complete",
    body: "Your service at {property_name} is complete. Reference #{job_id}. Rate your experience: {link}",
    usedFor: "Maintenance",
    lastEdited: "1 week ago",
  },
  {
    id: 3,
    name: "Invoice Ready",
    body: "Your GateGuard invoice #{invoice_num} for ${amount} is ready. Pay online: {link}",
    usedFor: "Billing",
    lastEdited: "2 weeks ago",
  },
  {
    id: 4,
    name: "Renewal Reminder",
    body: "Hi {name}, your GateGuard contract at {property} renews on {date}. Questions? Reply or call (404) 555-0100.",
    usedFor: "Renewals",
    lastEdited: "1 month ago",
  },
  {
    id: 5,
    name: "Alarm Alert",
    body: "ALERT: Motion detected at {property} — {camera_name} at {time}. View: {link}",
    usedFor: "Security",
    lastEdited: "2 months ago",
  },
];

const CALL_LOG = [
  { direction: "in", number: "(678) 555-0234", name: "Stonegate Townhomes", duration: "4m 22s", status: "answered", time: "Today 9:15 AM" },
  { direction: "out", number: "(404) 555-0198", name: "Marcus Webb", duration: "2m 10s", status: "answered", time: "Today 8:58 AM" },
  { direction: "in", number: "Unknown", name: "Unmatched", duration: "0s", status: "missed", time: "Today 8:42 AM" },
  { direction: "in", number: "(770) 555-0156", name: "Ashford Glen", duration: "7m 44s", status: "answered", time: "Today 8:30 AM" },
  { direction: "out", number: "(404) 555-0312", name: "Jordan Hill", duration: "1m 05s", status: "answered", time: "Yesterday 5:44 PM" },
  { direction: "in", number: "(678) 555-0298", name: "Lakewood HOA", duration: "3m 18s", status: "voicemail", time: "Yesterday 4:20 PM" },
  { direction: "out", number: "(770) 555-0178", name: "Riverside Apts", duration: "5m 33s", status: "answered", time: "Yesterday 3:10 PM" },
  { direction: "in", number: "Unknown", name: "Unmatched", duration: "0s", status: "missed", time: "Yesterday 2:45 PM" },
  { direction: "in", number: "(404) 555-0445", name: "Peachtree Commons", duration: "9m 02s", status: "answered", time: "Yesterday 1:30 PM" },
  { direction: "out", number: "(678) 555-0189", name: "Danny Cruz", duration: "0m 45s", status: "answered", time: "Yesterday 11:15 AM" },
];

const IVR_BRANCHES = [
  { key: "Press 1", label: "SOC Emergency", dest: "Ext. 200", color: "bg-red-50 border-red-200 text-red-800" },
  { key: "Press 2", label: "Sales", dest: "Ext. 300–302 (Ring Group)", color: "bg-blue-50 border-blue-200 text-blue-800" },
  { key: "Press 3", label: "Tech Support", dest: "Ext. 400", color: "bg-violet-50 border-violet-200 text-violet-800" },
  { key: "Press 4", label: "Billing", dest: "Ext. 500", color: "bg-amber-50 border-amber-200 text-amber-800" },
  { key: "After Hours", label: "Voicemail", dest: "SMS Alert to On-Call", color: "bg-slate-50 border-slate-200 text-slate-700" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  iconColor,
  accent,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  iconColor: string;
  accent?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4 shadow-sm">
      <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0", iconColor)}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs font-medium text-slate-500 mb-0.5">{label}</p>
        <p className={cn("text-2xl font-bold tabular-nums", accent ?? "text-slate-900")}>{value}</p>
      </div>
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    "Ring Group": "bg-blue-50 text-blue-700 border-blue-200",
    "Direct": "bg-slate-50 text-slate-700 border-slate-200",
    "IVR": "bg-violet-50 text-violet-700 border-violet-200",
    "Voicemail": "bg-amber-50 text-amber-700 border-amber-200",
  };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border", map[type] ?? "bg-slate-50 text-slate-700 border-slate-200")}>
      {type}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "answered") return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
      <CheckCircle2 className="w-3.5 h-3.5" /> Answered
    </span>
  );
  if (status === "missed") return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
      <XCircle className="w-3.5 h-3.5" /> Missed
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
      <Clock className="w-3.5 h-3.5" /> Voicemail
    </span>
  );
}

// ─── Tab: Phone System ────────────────────────────────────────────────────────

function PhoneSystemTab() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Main number */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Main Line</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#2563EB]/10 flex items-center justify-center">
              <Phone className="w-5 h-5 text-[#2563EB]" />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">(404) 555-0100</p>
              <p className="text-sm text-slate-500">GateGuard Main Line</p>
            </div>
          </div>
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      {/* Extensions table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-900">Extensions</p>
        </div>
        <div className="divide-y divide-slate-100">
          {EXTENSIONS.map((ext) => (
            <div key={ext.ext} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors">
              <div className="w-14 flex-shrink-0">
                <span className="text-sm font-bold text-slate-900">Ext. {ext.ext}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{ext.label}</p>
              </div>
              <TypeBadge type={ext.type} />
              <div className="flex items-center gap-1.5 w-20 flex-shrink-0">
                <span className={cn("w-2 h-2 rounded-full flex-shrink-0", ext.active ? "bg-emerald-500" : "bg-slate-300")} />
                <span className={cn("text-xs", ext.active ? "text-emerald-700" : "text-slate-400")}>
                  {ext.active ? "Active" : "Inactive"}
                </span>
              </div>
              <button className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0">
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="px-5 py-4 border-t border-slate-100">
          <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1d4ed8] transition-colors">
            <Plus className="w-4 h-4" />
            Add Extension
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: SMS Templates ───────────────────────────────────────────────────────

function SmsTemplatesTab() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{SMS_TEMPLATES.length} templates</p>
        <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1d4ed8] transition-colors">
          <Plus className="w-4 h-4" />
          New Template
        </button>
      </div>
      <div className="grid gap-3">
        {SMS_TEMPLATES.map((t) => (
          <div key={t.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:border-slate-300 transition-colors group">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-sm font-semibold text-slate-900">{t.name}</p>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-[#2563EB]/10 text-[#2563EB] border border-[#2563EB]/20">
                    {t.usedFor}
                  </span>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed line-clamp-2">{t.body}</p>
              </div>
              <button className="flex-shrink-0 opacity-0 group-hover:opacity-100 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all">
                <Edit2 className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" />
                  {t.body.split(" ").length} words
                </span>
                <span>{t.body.match(/\{[^}]+\}/g)?.length ?? 0} variables</span>
              </div>
              <span className="text-xs text-slate-400">Edited {t.lastEdited}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tab: Call Log ────────────────────────────────────────────────────────────

function CallLogTab() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60">
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Dir.</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Number</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Name / Property</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Duration</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {CALL_LOG.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50 transition-colors">
                <td className="px-5 py-3.5">
                  {row.direction === "in" ? (
                    <span title="Inbound" className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-blue-50 text-blue-600">
                      <PhoneIncoming className="w-3.5 h-3.5" />
                    </span>
                  ) : (
                    <span title="Outbound" className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 text-slate-500">
                      <PhoneOutgoing className="w-3.5 h-3.5" />
                    </span>
                  )}
                </td>
                <td className="px-4 py-3.5 font-medium text-slate-800 whitespace-nowrap">
                  {row.number === "Unknown" ? (
                    <span className="text-slate-400 italic">Unknown</span>
                  ) : row.number}
                </td>
                <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                  {row.name === "Unmatched" ? (
                    <span className="text-slate-400 italic">Unmatched</span>
                  ) : row.name}
                </td>
                <td className="px-4 py-3.5 tabular-nums text-slate-600 whitespace-nowrap">{row.duration}</td>
                <td className="px-4 py-3.5 whitespace-nowrap">
                  <StatusBadge status={row.status} />
                </td>
                <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">{row.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Tab: IVR Routing ─────────────────────────────────────────────────────────

function IvrRoutingTab() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Visual call flow for (404) 555-0100</p>
        <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
          <Edit2 className="w-4 h-4" />
          Edit IVR Flow
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
        {/* Root node */}
        <div className="flex flex-col items-center">
          <div className="bg-[#2563EB] text-white rounded-xl px-6 py-4 flex items-center gap-3 shadow-md w-72 justify-center">
            <PhoneCall className="w-5 h-5 flex-shrink-0" />
            <div className="text-center">
              <p className="text-xs font-semibold opacity-80 uppercase tracking-wide">Incoming Call</p>
              <p className="text-base font-bold">(404) 555-0100</p>
            </div>
          </div>

          {/* Connector down */}
          <div className="w-0.5 h-6 bg-slate-300" />
          <div className="w-3 h-3 rounded-full bg-slate-300" />
          <div className="w-0.5 h-2 bg-slate-300" />

          {/* Horizontal spread */}
          <div className="relative w-full max-w-4xl">
            {/* Horizontal line */}
            <div className="absolute top-0 left-[10%] right-[10%] h-0.5 bg-slate-300" />

            {/* Branch columns */}
            <div className="flex justify-between gap-2 pt-0">
              {IVR_BRANCHES.map((branch, i) => (
                <div key={i} className="flex flex-col items-center flex-1">
                  {/* Vertical drop from horizontal line */}
                  <div className="w-0.5 h-6 bg-slate-300" />
                  <div
                    className={cn(
                      "rounded-xl border p-3 w-full text-center",
                      branch.color
                    )}
                  >
                    <p className="text-xs font-bold mb-1">{branch.key}</p>
                    <p className="text-sm font-semibold leading-tight mb-1">{branch.label}</p>
                    <div className="flex items-center justify-center gap-1 mt-2">
                      <ArrowRight className="w-3 h-3 opacity-60" />
                      <p className="text-xs opacity-80 font-medium">{branch.dest}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-100 flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <div className="w-3 h-3 rounded-sm bg-red-100 border border-red-200" />
            Emergency / Priority
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <div className="w-3 h-3 rounded-sm bg-blue-100 border border-blue-200" />
            Ring Group
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <div className="w-3 h-3 rounded-sm bg-violet-100 border border-violet-200" />
            Department Queue
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <div className="w-3 h-3 rounded-sm bg-amber-100 border border-amber-200" />
            Billing / After Hours
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <div className="w-3 h-3 rounded-sm bg-slate-100 border border-slate-200" />
            Fallback / Voicemail
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS = ["Phone System", "SMS Templates", "Call Log", "IVR Routing"] as const;
type Tab = typeof TABS[number];

export default function CommunicationsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Phone System");

  return (
    <div className="min-h-screen bg-slate-100 p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">Communications</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
          </div>
          <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm">
            <Settings className="w-4 h-4" />
            Settings
          </button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Calls Today" value={47} icon={PhoneCall} iconColor="bg-[#2563EB]/10 text-[#2563EB]" />
          <StatCard label="SMS Sent Today" value={23} icon={MessageSquare} iconColor="bg-violet-100 text-violet-600" />
          <StatCard label="Active Lines" value={8} icon={Network} iconColor="bg-emerald-100 text-emerald-600" />
          <StatCard label="Missed Calls" value={3} icon={XCircle} iconColor="bg-red-100 text-red-500" accent="text-red-600" />
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex border-b border-slate-200 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-5 py-3.5 text-sm font-medium whitespace-nowrap transition-colors relative",
                  activeTab === tab
                    ? "text-[#2563EB] border-b-2 border-[#2563EB] -mb-px bg-white"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                )}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="p-5">
            {activeTab === "Phone System" && <PhoneSystemTab />}
            {activeTab === "SMS Templates" && <SmsTemplatesTab />}
            {activeTab === "Call Log" && <CallLogTab />}
            {activeTab === "IVR Routing" && <IvrRoutingTab />}
          </div>
        </div>
      </div>
    </div>
  );
}
