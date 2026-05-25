"use client";

import { useState } from "react";
import { CheckCircle2, Clock, Users, FileText, TrendingUp, AlertTriangle, Send, Search, ChevronDown } from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { BookOpen, GraduationCap, Brain, Target, BarChart3 } = require("lucide-react") as any;

// ─── Types ─────────────────────────────────────────────────────────────────────

type Track = {
  id: number;
  name: string;
  description: string;
  lessons: number;
  hours: number;
  status: "Live" | "Coming Soon";
};

type Learner = {
  id: string;
  name: string;
  role: string;
  completedCourses: number;
  gaps: string[];
  nextTrack: string;
};

type GeneratedModule = {
  id: string;
  title: string;
  generatedDate: string;
  lessonCount: number;
  status: "Draft" | "Under Review" | "Published";
};

// ─── Static Data ───────────────────────────────────────────────────────────────

const TRACKS: Track[] = [
  {
    id: 1,
    name: "Low Voltage Fundamentals",
    description: "Wire gauge, voltage drop, conduit fill, NEC code basics for access control installations",
    lessons: 8,
    hours: 4,
    status: "Live",
  },
  {
    id: 2,
    name: "Gate Systems",
    description: "DoorKing, LiftMaster, Viking, FAAC operators: installation, commissioning, troubleshooting",
    lessons: 12,
    hours: 6,
    status: "Live",
  },
  {
    id: 3,
    name: "Access Control (Brivo + HID)",
    description: "Brivo ACS300/6100, HID readers, credential management, door hardware",
    lessons: 10,
    hours: 5,
    status: "Live",
  },
  {
    id: 4,
    name: "IP Camera Systems",
    description: "Eagle Eye Networks, Axis, Hikvision: mounting, PoE, ONVIF, analytics configuration",
    lessons: 9,
    hours: 4.5,
    status: "Live",
  },
  {
    id: 5,
    name: "Network Infrastructure",
    description: "Ubiquiti UniFi, VLANs, PoE switches, fiber, wireless for multifamily",
    lessons: 11,
    hours: 5.5,
    status: "Live",
  },
  {
    id: 6,
    name: "MDU Internet Services",
    description: "Bulk internet agreements, ISP coordination, MDU unit-level provisioning, speed tiers",
    lessons: 7,
    hours: 3.5,
    status: "Coming Soon",
  },
  {
    id: 7,
    name: "DirecTV / SARA Plus",
    description: "SARA Plus API, CC/Order Entry, MDU bulk agreements, AT&T channel activation",
    lessons: 8,
    hours: 4,
    status: "Live",
  },
  {
    id: 8,
    name: "Smart Locks & Intercoms",
    description: "Schlage, Yale, Allegion, Doorbird, UniFi G3 Intercom: integration and troubleshooting",
    lessons: 6,
    hours: 3,
    status: "Coming Soon",
  },
  {
    id: 9,
    name: "CEDIA MDU Standards",
    description: "CEDIA EST009 standard, system documentation, wiring schematics, handoff procedures",
    lessons: 5,
    hours: 2.5,
    status: "Coming Soon",
  },
  {
    id: 10,
    name: "GateGuard Platform",
    description: "Using the dealer portal, /tech tool, site surveys, quoting, billing, NEXUS AI",
    lessons: 14,
    hours: 7,
    status: "Live",
  },
];

const LEARNERS: Learner[] = [
  {
    id: "1",
    name: "Mike Torres",
    role: "Field Tech",
    completedCourses: 3,
    gaps: ["IP Cameras", "Network"],
    nextTrack: "IP Camera Systems",
  },
  {
    id: "2",
    name: "Sarah Chen",
    role: "Sales Rep",
    completedCourses: 2,
    gaps: ["Gate Systems", "DirecTV"],
    nextTrack: "Gate Systems",
  },
  {
    id: "3",
    name: "James Park",
    role: "Lead Tech",
    completedCourses: 7,
    gaps: ["CEDIA MDU"],
    nextTrack: "CEDIA MDU Standards",
  },
  {
    id: "4",
    name: "Lisa Adams",
    role: "Dealer Admin",
    completedCourses: 4,
    gaps: ["Low Voltage", "Access Control"],
    nextTrack: "Low Voltage Fundamentals",
  },
  {
    id: "5",
    name: "Carlos Rivera",
    role: "Install Tech",
    completedCourses: 5,
    gaps: ["MDU Internet"],
    nextTrack: "MDU Internet Services",
  },
];

const RECENT_GENERATIONS: GeneratedModule[] = [
  {
    id: "g1",
    title: "Brivo ACS300 Relay Output Troubleshooting",
    generatedDate: "May 24, 2026",
    lessonCount: 4,
    status: "Published",
  },
  {
    id: "g2",
    title: "MDU Bulk Internet Agreement Negotiation Tactics",
    generatedDate: "May 22, 2026",
    lessonCount: 3,
    status: "Under Review",
  },
  {
    id: "g3",
    title: "Gate Loop Detector Installation Best Practices",
    generatedDate: "May 19, 2026",
    lessonCount: 5,
    status: "Draft",
  },
];

// ─── Stats data ────────────────────────────────────────────────────────────────

const STATS = [
  { label: "Active Learners",      value: "47",  icon: Users,       color: "#6B7EFF" },
  { label: "Courses Published",    value: "6",   icon: BookOpen,    color: "#0891B2" },
  { label: "Avg Completion Rate",  value: "68%", icon: TrendingUp,  color: "#059669" },
  { label: "Certifications Issued",value: "23",  icon: GraduationCap, color: "#7C3AED" },
];

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: "Live" | "Coming Soon" }) {
  if (status === "Live") {
    return (
      <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        Live
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">
      <Clock size={9} />
      Coming Soon
    </span>
  );
}

function ModuleStatusBadge({ status }: { status: GeneratedModule["status"] }) {
  const map = {
    Draft:        "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
    "Under Review": "bg-amber-500/15 text-amber-400 border-amber-500/25",
    Published:    "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${map[status]}`}>
      {status}
    </span>
  );
}

// ─── Tab: Curriculum ──────────────────────────────────────────────────────────

function CurriculumTab() {
  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-bold text-white">Multifamily Training Tracks</h3>
          <p className="text-xs text-white/50 mt-0.5">10 tracks · 90 lessons · 45 total hours</p>
        </div>
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold transition-colors">
          <Brain size={12} />
          Generate Track
        </button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {TRACKS.map(track => (
          <div key={track.id} className="bg-white/3 border border-white/8 rounded-xl p-4 hover:border-white/15 transition-colors">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] font-black text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded px-1.5 py-0.5 shrink-0">
                  #{track.id}
                </span>
                <span className="text-sm font-bold text-white truncate">{track.name}</span>
              </div>
              <StatusBadge status={track.status} />
            </div>
            <p className="text-xs text-white/50 leading-relaxed mb-3">{track.description}</p>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1 text-[11px] text-white/40">
                <FileText size={10} />
                {track.lessons} lessons
              </span>
              <span className="flex items-center gap-1 text-[11px] text-white/40">
                <Clock size={10} />
                {track.hours}h
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tab: Learning Gaps ───────────────────────────────────────────────────────

function LearningGapsTab() {
  const [toastId, setToastId] = useState<string | null>(null);

  const handleAssign = (id: string) => {
    setToastId(id);
    setTimeout(() => setToastId(null), 2500);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-bold text-white">AI-Identified Learning Gaps</h3>
          <p className="text-xs text-white/50 mt-0.5">SAGE analyzes completion history to surface gaps per learner</p>
        </div>
      </div>

      {toastId && (
        <div className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-sm font-semibold">
          <CheckCircle2 size={14} />
          Track assigned successfully
        </div>
      )}

      <div className="bg-white/3 border border-white/8 rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/8">
              <th className="text-left px-4 py-3 text-white/40 font-semibold">Learner</th>
              <th className="text-left px-4 py-3 text-white/40 font-semibold">Role</th>
              <th className="text-left px-4 py-3 text-white/40 font-semibold hidden md:table-cell">Completed</th>
              <th className="text-left px-4 py-3 text-white/40 font-semibold">Identified Gaps</th>
              <th className="text-left px-4 py-3 text-white/40 font-semibold hidden lg:table-cell">Recommended Next</th>
              <th className="text-right px-4 py-3 text-white/40 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {LEARNERS.map((learner, i) => (
              <tr key={learner.id} className={i < LEARNERS.length - 1 ? "border-b border-white/5" : ""}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-[10px] font-bold text-indigo-400 shrink-0">
                      {learner.name.split(" ").map(n => n[0]).join("")}
                    </div>
                    <span className="font-semibold text-white">{learner.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/8 text-white/60 font-medium">
                    {learner.role}
                  </span>
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-white/50">
                  {learner.completedCourses} courses
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {learner.gaps.map(gap => (
                      <span key={gap} className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/20 font-medium">
                        {gap}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell text-white/60 text-[11px]">
                  {learner.nextTrack}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleAssign(learner.id)}
                    className="px-3 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-400 text-[11px] font-semibold border border-indigo-500/20 transition-colors"
                  >
                    Assign Track
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Tab: Content Pipeline ────────────────────────────────────────────────────

function ContentPipelineTab() {
  const [topic, setTopic] = useState("");
  const [role, setRole] = useState("Field Tech");
  const [source, setSource] = useState("GateGuard KB");
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  const handleGenerate = () => {
    if (!topic.trim()) return;
    setGenerating(true);
    setTimeout(() => {
      setGenerating(false);
      setGenerated(true);
      setTimeout(() => setGenerated(false), 3000);
    }, 2200);
  };

  return (
    <div className="space-y-6">
      {/* Generate form */}
      <div className="bg-white/3 border border-white/8 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Brain size={14} className="text-indigo-400" />
          <h3 className="text-sm font-bold text-white">Generate New Module</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div className="md:col-span-3">
            <label className="block text-[11px] font-semibold text-white/50 mb-1.5 uppercase tracking-wide">Topic</label>
            <input
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="e.g. Viking G5 gate operator fault codes"
              className="w-full h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-400/50 transition-colors"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-white/50 mb-1.5 uppercase tracking-wide">Target Role</label>
            <div className="relative">
              <select
                value={role}
                onChange={e => setRole(e.target.value)}
                className="w-full h-9 px-3 pr-8 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-indigo-400/50 appearance-none transition-colors"
              >
                <option>Field Tech</option>
                <option>Sales Rep</option>
                <option>Dealer Admin</option>
                <option>All</option>
              </select>
              <ChevronDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-white/50 mb-1.5 uppercase tracking-wide">Source Material</label>
            <div className="relative">
              <select
                value={source}
                onChange={e => setSource(e.target.value)}
                className="w-full h-9 px-3 pr-8 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-indigo-400/50 appearance-none transition-colors"
              >
                <option>GateGuard KB</option>
                <option>CEDIA Standards</option>
                <option>Manufacturer Manuals</option>
                <option>Custom</option>
              </select>
              <ChevronDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
            </div>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleGenerate}
              disabled={!topic.trim() || generating}
              className="w-full h-9 flex items-center justify-center gap-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
            >
              {generating ? (
                <>
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating…
                </>
              ) : generated ? (
                <>
                  <CheckCircle2 size={13} />
                  Generated!
                </>
              ) : (
                <>
                  <Brain size={13} />
                  Generate
                </>
              )}
            </button>
          </div>
        </div>

        <p className="text-[11px] text-white/30">
          SAGE will pull relevant content from the selected source material and structure it into a ready-to-review lesson module.
        </p>
      </div>

      {/* Recent generations */}
      <div>
        <h3 className="text-sm font-bold text-white mb-3">Recent Generations</h3>
        <div className="space-y-3">
          {RECENT_GENERATIONS.map(mod => (
            <div key={mod.id} className="flex items-center gap-4 bg-white/3 border border-white/8 rounded-xl px-4 py-3 hover:border-white/15 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center shrink-0">
                <BookOpen size={14} className="text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{mod.title}</p>
                <p className="text-[11px] text-white/40 mt-0.5">{mod.generatedDate} · {mod.lessonCount} lessons</p>
              </div>
              <ModuleStatusBadge status={mod.status} />
              <button className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-[11px] font-semibold transition-colors shrink-0">
                Review
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = "curriculum" | "gaps" | "pipeline";

export default function SagePage() {
  const [activeTab, setActiveTab] = useState<Tab>("curriculum");

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "curriculum", label: "Curriculum", icon: BookOpen },
    { id: "gaps",       label: "Learning Gaps", icon: Target },
    { id: "pipeline",   label: "Content Pipeline", icon: Brain },
  ];

  return (
    <div className="min-h-screen bg-[#EEF2FF]">
      {/* Header */}
      <div className="bg-[#0B1728] px-6 pt-6 pb-0">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-black tracking-tight text-white">SAGE</h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500 text-white">v1.1</span>
            </div>
            <p className="text-sm text-white/50">Adaptive Training Intelligence</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" style={{ boxShadow: "0 0 5px #34d399" }} />
            <span className="text-xs text-white/40 font-medium">Active</span>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/5 rounded-t-xl overflow-hidden mb-0">
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
        {activeTab === "curriculum" && <CurriculumTab />}
        {activeTab === "gaps"       && <LearningGapsTab />}
        {activeTab === "pipeline"   && <ContentPipelineTab />}
      </div>
    </div>
  );
}
