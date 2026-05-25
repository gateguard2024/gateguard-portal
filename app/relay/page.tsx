"use client";

import { useState } from "react";
import { CheckCircle2, Clock, AlertTriangle, Users, Send, Activity, TrendingUp, MessageSquare, ArrowRight } from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Headphones, PhoneCall, ShieldCheck, BarChart3, BookOpen, Brain, RotateCcw } = require("lucide-react") as any;

// ─── Types ─────────────────────────────────────────────────────────────────────

type Priority = "P1" | "P2" | "P3" | "P4";
type Classification = "gate_offline" | "camera_down" | "access_error" | "billing" | "general";
type TicketStatus = "open" | "resolving" | "resolved" | "escalated";

type Ticket = {
  id: string;
  subject: string;
  property: string;
  priority: Priority;
  classification: Classification;
  confidence: number;
  status: TicketStatus;
  age: string;
};

type SLARow = {
  priority: Priority;
  target: string;
  compliance: number;
  color: string;
};

type BreachedTicket = {
  id: string;
  subject: string;
  target: string;
  actual: string;
  breachBy: string;
};

type AutoResolveRule = {
  id: string;
  name: string;
  match: string;
  action: string;
  threshold: number;
  enabled: boolean;
  alwaysOn?: boolean;
};

type KBFeedEntry = {
  id: string;
  summary: string;
  resolution: string;
  article: string;
};

// ─── Static Data ───────────────────────────────────────────────────────────────

const INITIAL_TICKETS: Ticket[] = [
  {
    id: "TK-4821",
    subject: "Front gate won't open after power surge",
    property: "Sunset Commons",
    priority: "P1",
    classification: "gate_offline",
    confidence: 91,
    status: "open",
    age: "18 min",
  },
  {
    id: "TK-4820",
    subject: "Camera 3 showing black screen",
    property: "Riverview Apts",
    priority: "P2",
    classification: "camera_down",
    confidence: 86,
    status: "open",
    age: "34 min",
  },
  {
    id: "TK-4819",
    subject: "Resident fob not working at side entrance",
    property: "Harbor Point",
    priority: "P3",
    classification: "access_error",
    confidence: 78,
    status: "open",
    age: "1h 12m",
  },
  {
    id: "TK-4818",
    subject: "Question about last month's invoice",
    property: "Oakdale HOA",
    priority: "P4",
    classification: "billing",
    confidence: 95,
    status: "open",
    age: "2h 5m",
  },
  {
    id: "TK-4817",
    subject: "Exit gate sensor triggering randomly",
    property: "Parkview Residences",
    priority: "P2",
    classification: "gate_offline",
    confidence: 82,
    status: "open",
    age: "3h 40m",
  },
  {
    id: "TK-4816",
    subject: "Intercom not ringing resident units",
    property: "The Meridian",
    priority: "P3",
    classification: "general",
    confidence: 63,
    status: "escalated",
    age: "5h 20m",
  },
];

const SLA_DATA: SLARow[] = [
  { priority: "P1", target: "< 4h",  compliance: 94, color: "#ef4444" },
  { priority: "P2", target: "< 8h",  compliance: 87, color: "#f97316" },
  { priority: "P3", target: "< 24h", compliance: 96, color: "#f59e0b" },
  { priority: "P4", target: "< 72h", compliance: 99, color: "#94a3b8" },
];

const BREACHED_TICKETS: BreachedTicket[] = [
  {
    id: "TK-4801",
    subject: "Gate motor overheating alarm",
    target: "4h (P1)",
    actual: "5h 12m",
    breachBy: "+1h 12m",
  },
  {
    id: "TK-4788",
    subject: "Access panel offline after firmware update",
    target: "8h (P2)",
    actual: "9h 44m",
    breachBy: "+1h 44m",
  },
  {
    id: "TK-4774",
    subject: "Multiple residents locked out",
    target: "4h (P1)",
    actual: "4h 52m",
    breachBy: "+52m",
  },
];

const INITIAL_RULES: AutoResolveRule[] = [
  {
    id: "r1",
    name: "Gate Offline",
    match: "gate, offline, won't open, stuck",
    action: "Auto-reply with power-cycle steps + KB link",
    threshold: 85,
    enabled: true,
  },
  {
    id: "r2",
    name: "Camera Offline",
    match: "camera, no feed, black screen",
    action: "Auto-reply with PoE reboot steps",
    threshold: 80,
    enabled: true,
  },
  {
    id: "r3",
    name: "Access Denied Error",
    match: "door, fob, credential, denied",
    action: "Auto-reply with Brivo credential check steps",
    threshold: 75,
    enabled: true,
  },
  {
    id: "r4",
    name: "Billing Question",
    match: "invoice, payment, charge",
    action: "Route to billing team + auto-acknowledge",
    threshold: 90,
    enabled: false,
  },
  {
    id: "r5",
    name: "After Hours Escalation",
    match: "P1/P2 received outside 8am–6pm",
    action: "Page on-call tech via SMS immediately",
    threshold: 100,
    enabled: true,
    alwaysOn: true,
  },
];

const KB_FEED: KBFeedEntry[] = [
  {
    id: "f1",
    summary: "DK6050 gate stuck closed after power outage — manual release procedure",
    resolution: "Disengaged emergency release lever, power-cycled controller, re-synced limits",
    article: "KB-0184",
  },
  {
    id: "f2",
    summary: "Eagle Eye camera showing black screen — PoE switch port negotiation failure",
    resolution: "Disabled/re-enabled PoE on UniFi switch port; camera recovered within 30s",
    article: "KB-0185",
  },
  {
    id: "f3",
    summary: "Brivo ACS300 credential denied for valid fob — card format mismatch after panel firmware update",
    resolution: "Re-enrolled credential with updated 26-bit Wiegand format in Brivo admin",
    article: "KB-0186",
  },
  {
    id: "f4",
    summary: "Viking G5 loop detector false-triggering — EMI from HVAC unit on same circuit",
    resolution: "Isolated loop detector to dedicated 24VAC transformer; false triggers stopped",
    article: "KB-0187",
  },
];

const STATS = [
  { label: "Open Tickets",        value: "14",  icon: MessageSquare, color: "#6B7EFF" },
  { label: "Auto-Resolved Today", value: "31",  icon: CheckCircle2,  color: "#059669" },
  { label: "Escalation Rate",     value: "8%",  icon: AlertTriangle, color: "#f97316" },
  { label: "Avg Resolution Time", value: "2.4h",icon: Clock,         color: "#0891B2" },
];

// ─── Sub-components ────────────────────────────────────────────────────────────

const PRIORITY_STYLES: Record<Priority, string> = {
  P1: "bg-red-500/20 text-red-400 border-red-500/30",
  P2: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  P3: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  P4: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

const CLASS_LABELS: Record<Classification, string> = {
  gate_offline:  "gate_offline",
  camera_down:   "camera_down",
  access_error:  "access_error",
  billing:       "billing",
  general:       "general",
};

const CLASS_COLORS: Record<Classification, string> = {
  gate_offline:  "bg-rose-500/15 text-rose-400 border-rose-500/20",
  camera_down:   "bg-purple-500/15 text-purple-400 border-purple-500/20",
  access_error:  "bg-amber-500/15 text-amber-400 border-amber-500/20",
  billing:       "bg-sky-500/15 text-sky-400 border-sky-500/20",
  general:       "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
};

function slaColor(pct: number) {
  if (pct >= 90) return "text-emerald-400";
  if (pct >= 70) return "text-amber-400";
  return "text-red-400";
}

// ─── Tab: Ticket Queue ────────────────────────────────────────────────────────

function TicketQueueTab() {
  const [tickets, setTickets] = useState<Ticket[]>(INITIAL_TICKETS);

  const handleAutoResolve = (id: string) => {
    setTickets(prev =>
      prev.map(t => t.id === id ? { ...t, status: "resolving" } : t)
    );
    setTimeout(() => {
      setTickets(prev =>
        prev.map(t => t.id === id ? { ...t, status: "resolved" } : t)
      );
    }, 1800);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-bold text-white">Live Support Queue</h3>
          <p className="text-xs text-white/50 mt-0.5">RELAY classifies and triages tickets as they arrive</p>
        </div>
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/8 hover:bg-white/12 text-white/70 text-xs font-semibold transition-colors border border-white/10">
          <RotateCcw size={11} />
          Refresh
        </button>
      </div>

      <div className="bg-white/3 border border-white/8 rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/8">
              <th className="text-left px-4 py-3 text-white/40 font-semibold">Ticket</th>
              <th className="text-left px-4 py-3 text-white/40 font-semibold">Subject</th>
              <th className="text-left px-4 py-3 text-white/40 font-semibold hidden md:table-cell">Property</th>
              <th className="text-left px-4 py-3 text-white/40 font-semibold">Priority</th>
              <th className="text-left px-4 py-3 text-white/40 font-semibold hidden lg:table-cell">Classification</th>
              <th className="text-left px-4 py-3 text-white/40 font-semibold hidden xl:table-cell">AI Confidence</th>
              <th className="text-left px-4 py-3 text-white/40 font-semibold">Status</th>
              <th className="text-right px-4 py-3 text-white/40 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket, i) => (
              <tr key={ticket.id} className={i < tickets.length - 1 ? "border-b border-white/5" : ""}>
                <td className="px-4 py-3">
                  <span className="font-mono text-[11px] text-white/50">{ticket.id}</span>
                </td>
                <td className="px-4 py-3 max-w-[200px]">
                  <p className="font-semibold text-white truncate">{ticket.subject}</p>
                  <p className="text-[10px] text-white/30 mt-0.5">{ticket.age} ago</p>
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-white/50 text-[11px]">{ticket.property}</td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${PRIORITY_STYLES[ticket.priority]}`}>
                    {ticket.priority}
                  </span>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded border font-mono ${CLASS_COLORS[ticket.classification]}`}>
                    {CLASS_LABELS[ticket.classification]}
                  </span>
                </td>
                <td className="px-4 py-3 hidden xl:table-cell">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden max-w-[60px]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${ticket.confidence}%`,
                          background: ticket.confidence >= 80 ? "#10b981" : ticket.confidence >= 65 ? "#f59e0b" : "#ef4444"
                        }}
                      />
                    </div>
                    <span className="text-[11px] text-white/50">{ticket.confidence}%</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {ticket.status === "resolved" ? (
                    <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
                      <CheckCircle2 size={10} /> Resolved
                    </span>
                  ) : ticket.status === "resolving" ? (
                    <span className="flex items-center gap-1 text-[10px] text-sky-400 font-semibold">
                      <span className="w-2 h-2 border-2 border-sky-400/40 border-t-sky-400 rounded-full animate-spin" />
                      Resolving…
                    </span>
                  ) : ticket.status === "escalated" ? (
                    <span className="flex items-center gap-1 text-[10px] text-rose-400 font-semibold">
                      <AlertTriangle size={10} /> Escalated
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] text-amber-400 font-semibold">
                      <Clock size={10} /> Open
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {ticket.status === "open" && ticket.confidence >= 80 ? (
                    <button
                      onClick={() => handleAutoResolve(ticket.id)}
                      className="px-3 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 text-[11px] font-semibold border border-rose-500/20 transition-colors"
                    >
                      Auto-Resolve
                    </button>
                  ) : ticket.status === "resolved" ? (
                    <span className="text-[11px] text-white/20 font-medium">Done</span>
                  ) : (
                    <button className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 text-[11px] font-semibold border border-white/10 transition-colors">
                      View
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Tab: SLA Tracker ────────────────────────────────────────────────────────

function SLATrackerTab() {
  const weekLabels = ["May 4", "May 11", "May 18", "May 25"];
  const weekData: Record<Priority, number[]> = {
    P1: [88, 91, 90, 94],
    P2: [79, 84, 86, 87],
    P3: [93, 95, 94, 96],
    P4: [98, 99, 98, 99],
  };
  const priorityColors: Record<Priority, string> = {
    P1: "#ef4444",
    P2: "#f97316",
    P3: "#f59e0b",
    P4: "#94a3b8",
  };

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {SLA_DATA.map(row => (
          <div key={row.priority} className="bg-white/3 border border-white/8 rounded-xl p-4 text-center">
            <div
              className="text-xl font-black mb-1"
              style={{ color: row.color }}
            >
              {row.priority}
            </div>
            <p className="text-[10px] text-white/40 mb-2">{row.target}</p>
            <div className={`text-2xl font-black ${slaColor(row.compliance)}`}>
              {row.compliance}%
            </div>
            <p className="text-[10px] text-white/30 mt-1">compliance</p>
            <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${row.compliance}%`,
                  background: row.compliance >= 90 ? "#10b981" : row.compliance >= 70 ? "#f59e0b" : "#ef4444"
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div className="bg-white/3 border border-white/8 rounded-xl p-5">
        <h3 className="text-sm font-bold text-white mb-4">Weekly SLA Compliance — Last 4 Weeks</h3>
        <div className="grid grid-cols-4 gap-3">
          {weekLabels.map((week, wi) => (
            <div key={week}>
              <p className="text-[10px] text-white/40 text-center mb-2">{week}</p>
              <div className="flex items-end justify-center gap-1 h-24">
                {(["P1", "P2", "P3", "P4"] as Priority[]).map(p => {
                  const val = weekData[p][wi];
                  const heightPct = (val / 100) * 100;
                  return (
                    <div key={p} className="flex flex-col items-center gap-1 flex-1">
                      <div className="w-full flex items-end justify-center" style={{ height: "80px" }}>
                        <div
                          className="w-full rounded-t-sm transition-all"
                          style={{
                            height: `${heightPct}%`,
                            background: priorityColors[p],
                            opacity: 0.75,
                          }}
                          title={`${p}: ${val}%`}
                        />
                      </div>
                      <span className="text-[8px] font-bold" style={{ color: priorityColors[p] }}>{p}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-white/8 flex items-center gap-4 flex-wrap">
          {(["P1", "P2", "P3", "P4"] as Priority[]).map(p => (
            <div key={p} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: priorityColors[p] }} />
              <span className="text-[10px] text-white/50">{p} · {SLA_DATA.find(s => s.priority === p)?.target}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Breach list */}
      <div>
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <AlertTriangle size={13} className="text-red-400" />
          Recent SLA Breaches
        </h3>
        <div className="space-y-2">
          {BREACHED_TICKETS.map(bt => (
            <div key={bt.id} className="flex items-center gap-4 bg-red-500/5 border border-red-500/15 rounded-xl px-4 py-3">
              <span className="font-mono text-[11px] text-red-400/70 shrink-0">{bt.id}</span>
              <p className="flex-1 text-sm text-white/70 truncate">{bt.subject}</p>
              <div className="flex items-center gap-3 shrink-0 text-[11px]">
                <span className="text-white/30">Target: <span className="text-white/60">{bt.target}</span></span>
                <span className="text-white/30">Actual: <span className="text-white/60">{bt.actual}</span></span>
                <span className="font-bold text-red-400">{bt.breachBy}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Auto-Resolve Rules ──────────────────────────────────────────────────

function AutoResolveRulesTab() {
  const [rules, setRules] = useState<AutoResolveRule[]>(INITIAL_RULES);

  const toggle = (id: string) => {
    setRules(prev => prev.map(r =>
      r.id === id && !r.alwaysOn ? { ...r, enabled: !r.enabled } : r
    ));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-bold text-white">Auto-Resolve Rules</h3>
          <p className="text-xs text-white/50 mt-0.5">Keyword classifier + confidence threshold triggers</p>
        </div>
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold transition-colors">
          + Add Rule
        </button>
      </div>

      <div className="space-y-3">
        {rules.map(rule => (
          <div key={rule.id} className={`bg-white/3 border rounded-xl p-4 transition-colors ${rule.enabled ? "border-white/10" : "border-white/5 opacity-60"}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <h4 className="text-sm font-bold text-white">{rule.name}</h4>
                  {rule.alwaysOn && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 uppercase tracking-wide">
                      Always On
                    </span>
                  )}
                  <span className="text-[10px] text-white/40 ml-auto">Threshold: {rule.threshold}%</span>
                </div>
                <p className="text-[11px] text-white/40 mb-1">
                  <span className="text-white/30">Match: </span>
                  <span className="font-mono text-white/50">{rule.match}</span>
                </p>
                <p className="text-[11px] text-white/50">
                  <ArrowRight size={9} className="inline mr-1 text-white/30" />
                  {rule.action}
                </p>
              </div>

              {/* Toggle */}
              <div className="shrink-0 mt-0.5">
                <button
                  onClick={() => toggle(rule.id)}
                  disabled={rule.alwaysOn}
                  className={`relative w-9 h-5 rounded-full transition-colors disabled:cursor-not-allowed ${
                    rule.enabled ? "bg-rose-500" : "bg-white/15"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      rule.enabled ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tab: Knowledge Feed ──────────────────────────────────────────────────────

function KnowledgeFeedTab() {
  const [verified, setVerified] = useState<Set<string>>(new Set());

  const handleVerify = (id: string) => {
    setVerified(prev => new Set([...prev, id]));
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-5 px-4 py-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-medium">
        <Brain size={13} />
        RELAY learns from every resolved ticket and adds successful resolutions to the KB automatically.
      </div>

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-white">Recently Added to KB</h3>
        <span className="text-[11px] text-white/40">{KB_FEED.length} entries this week</span>
      </div>

      <div className="space-y-3">
        {KB_FEED.map(entry => (
          <div key={entry.id} className="bg-white/3 border border-white/8 rounded-xl p-4 hover:border-white/15 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-mono font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded px-1.5 py-0.5 shrink-0">
                    {entry.article}
                  </span>
                  <p className="text-sm font-semibold text-white truncate">{entry.summary}</p>
                </div>
                <p className="text-[11px] text-white/50 leading-relaxed">
                  <span className="text-white/30">Resolution: </span>
                  {entry.resolution}
                </p>
              </div>
              <button
                onClick={() => handleVerify(entry.id)}
                disabled={verified.has(entry.id)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors border ${
                  verified.has(entry.id)
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25 cursor-default"
                    : "bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border-white/10"
                }`}
              >
                {verified.has(entry.id) ? (
                  <><CheckCircle2 size={11} /> Verified</>
                ) : (
                  <>Verify Resolution</>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = "queue" | "sla" | "rules" | "feed";

export default function RelayPage() {
  const [activeTab, setActiveTab] = useState<Tab>("queue");

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "queue", label: "Ticket Queue",        icon: MessageSquare },
    { id: "sla",   label: "SLA Tracker",         icon: Activity },
    { id: "rules", label: "Auto-Resolve Rules",  icon: ShieldCheck },
    { id: "feed",  label: "Knowledge Feed",      icon: BookOpen },
  ];

  return (
    <div className="min-h-screen bg-[#EEF2FF]">
      {/* Header */}
      <div className="bg-[#0B1728] px-6 pt-6 pb-0">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-black tracking-tight text-white">RELAY</h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500 text-white">v1.1</span>
            </div>
            <p className="text-sm text-white/50">Tier-1 Support Intelligence</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" style={{ boxShadow: "0 0 5px #34d399" }} />
            <span className="text-xs text-white/40 font-medium">Active</span>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/5 rounded-t-xl overflow-hidden">
          {STATS.map(stat => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="bg-[#0B1728] px-4 py-3 flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${stat.color}18`, border: `1px solid ${stat.color}30` }}
                >
                  <Icon size={14} style={{ color: stat.color }} />
                </div>
                <div>
                  <p className="text-base font-black text-white leading-none">{stat.value}</p>
                  <p className="text-[10px] text-white/40 mt-0.5">{stat.label}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mt-3">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors ${
                  activeTab === tab.id
                    ? "bg-[#EEF2FF] text-[#0B1728]"
                    : "text-white/50 hover:text-white/80"
                }`}
              >
                <Icon size={12} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div className="p-6">
        {activeTab === "queue" && <TicketQueueTab />}
        {activeTab === "sla"   && <SLATrackerTab />}
        {activeTab === "rules" && <AutoResolveRulesTab />}
        {activeTab === "feed"  && <KnowledgeFeedTab />}
      </div>
    </div>
  );
}
