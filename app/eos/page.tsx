"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { cn } from "@/lib/utils";
import {
  CheckCircle2, Circle, Clock, TrendingUp,
  TrendingDown, Minus, Plus, X, ChevronRight, Users,
  Calendar, Target, Send, Zap, ChevronDown, Loader2,
} from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Timer, Flag, Pencil } = require("lucide-react") as any;

// ─── Types ────────────────────────────────────────────────────────────────────

interface CoachMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

type EOSSection =
  | "core_values"
  | "core_focus"
  | "ten_year_target"
  | "marketing_strategy"
  | "three_year_picture"
  | "one_year_plan"
  | "rocks"
  | "issues"
  | "scorecard"
  | "l10";

const EOS_SECTIONS: { key: EOSSection; label: string; emoji: string }[] = [
  { key: "core_values",        label: "Core Values",       emoji: "💎" },
  { key: "core_focus",         label: "Core Focus",        emoji: "🎯" },
  { key: "ten_year_target",    label: "10-Year Target",    emoji: "🚀" },
  { key: "marketing_strategy", label: "Marketing Strategy",emoji: "📣" },
  { key: "three_year_picture", label: "3-Year Picture",    emoji: "🖼️" },
  { key: "one_year_plan",      label: "1-Year Plan",       emoji: "📅" },
  { key: "rocks",              label: "Rocks",             emoji: "🪨" },
  { key: "issues",             label: "Issues (IDS)",      emoji: "🔥" },
];

type RockStatus = "On Track" | "At Risk" | "Off Track" | "Complete";
type IssuePriority = "Critical" | "High" | "Normal";
type IssueType = "Company" | "Department" | "People";
type IssueStatus = "In Progress" | "Resolved" | "This Meeting" | "Parking Lot" | "Open";

interface Rock {
  id: string;
  name: string;
  owner: string;
  status: RockStatus;
  progress: number;
  due_date: string | null;
  quarter: string;
  is_company_rock: boolean;
}

interface ScorecardEntry {
  id: string;
  scorecard_id: string;
  week_of: string;
  value: string;
}

interface Measurable {
  id: string;
  name: string;
  owner: string;
  goal: string;
  unit: string;
  sort_order: number;
  entries: ScorecardEntry[];
}

interface Issue {
  id: string;
  description: string;
  type: IssueType;
  owner: string;
  priority: IssuePriority;
  created_at: string;
  status: IssueStatus;
}

interface TodoItem {
  id: string;
  text: string;
  owner: string;
  due_date: string | null;
  meeting: string;
  done: boolean;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ title, children, className, action }: { title?: string; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return (
    <div className={cn("bg-white border border-border rounded-xl p-5", className)}>
      {title && (
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

function RockStatusPill({ status }: { status: RockStatus }) {
  const map: Record<RockStatus, string> = {
    "On Track": "bg-emerald-50 text-emerald-700 border border-emerald-200",
    "At Risk":  "bg-amber-50 text-amber-700 border border-amber-200",
    "Off Track":"bg-red-50 text-red-700 border border-red-200",
    "Complete": "bg-[#6B7EFF]/10 text-[#6B7EFF] border border-[#6B7EFF]/20",
  };
  return (
    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", map[status])}>
      {status}
    </span>
  );
}

function PriorityPill({ priority }: { priority: IssuePriority }) {
  const map: Record<IssuePriority, string> = {
    Critical: "bg-red-50 text-red-700 border border-red-200",
    High:     "bg-amber-50 text-amber-700 border border-amber-200",
    Normal:   "bg-blue-50 text-blue-700 border border-blue-200",
  };
  return (
    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", map[priority])}>
      {priority}
    </span>
  );
}

function IssueStatusPill({ status }: { status: IssueStatus }) {
  const map: Record<IssueStatus, string> = {
    "In Progress":  "bg-blue-50 text-blue-700 border border-blue-200",
    "Resolved":     "bg-emerald-50 text-emerald-700 border border-emerald-200",
    "This Meeting": "bg-purple-50 text-purple-700 border border-purple-200",
    "Parking Lot":  "bg-slate-100 text-slate-600 border border-slate-200",
    "Open":         "bg-slate-50 text-slate-600 border border-slate-200",
  };
  return (
    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", map[status])}>
      {status}
    </span>
  );
}

function ProgressBar({ value }: { value: number }) {
  const color = value >= 70 ? "bg-emerald-500" : value >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-muted-foreground w-7 text-right">{value}%</span>
    </div>
  );
}

function TrendIcon({ current, previous }: { current: string; previous: string }) {
  const cur = parseFloat(current.replace(/[^0-9.]/g, ""));
  const prev = parseFloat(previous.replace(/[^0-9.]/g, ""));
  if (isNaN(cur) || isNaN(prev) || current === "—" || previous === "—") {
    return <Minus size={14} className="text-muted-foreground" />;
  }
  if (cur > prev) return <TrendingUp size={14} className="text-emerald-500" />;
  if (cur < prev) return <TrendingDown size={14} className="text-red-500" />;
  return <Minus size={14} className="text-muted-foreground" />;
}

function GoalStatus({ goal, value }: { goal: string; value: string }) {
  if (value === "—" || value === "") return <div className="w-2 h-2 rounded-full bg-slate-300" />;
  const goalNum = parseFloat(goal.replace(/[^0-9.]/g, ""));
  const valueNum = parseFloat(value.replace(/[^0-9.]/g, ""));
  if (isNaN(goalNum) || isNaN(valueNum)) return <div className="w-2 h-2 rounded-full bg-slate-300" />;
  return (
    <div className={cn("w-2 h-2 rounded-full", valueNum >= goalNum ? "bg-emerald-500" : "bg-red-500")} />
  );
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

// ─── V/TO types & defaults ────────────────────────────────────────────────────

interface CVItem { n: number; title: string; desc: string }
interface KVItem { label: string; value: string }
interface VTOData {
  core_values:     CVItem[]
  purpose:         string
  niche:           string
  ten_year_target: string
  target_market:   string
  three_uniques:   string[]
  proven_process:  string[]
  guarantee:       string
  picture_3yr:     KVItem[]
  plan_1yr:        KVItem[]
}

const VTO_DEFAULTS: VTOData = {
  core_values: [
    { n: 1, title: "Innovation Without Limits", desc: "We level up constantly. When we think we're the best, it's time to go further." },
    { n: 2, title: "Dealers First",             desc: "Our dealers' success IS our success. We make them look elite." },
    { n: 3, title: "Hardware Is The Moat",      desc: "We own the physical relationship. Software follows the gate." },
    { n: 4, title: "One Platform",              desc: "We unify. No silos, no app fatigue, one system for everything multifamily." },
    { n: 5, title: "Radical Transparency",      desc: "We tell the truth to owners, dealers, and each other." },
  ],
  purpose:         '"To become the central nervous system of multifamily real estate"',
  niche:           '"The only AI-powered access control platform that installs the hardware AND runs the software — turning every gate into a compounding business asset"',
  ten_year_target: '$100M ARR — Installed in 50,000+ multifamily properties across the US. The dominant middleware platform between every property owner, resident, vendor, and service provider in multifamily.',
  target_market:   'Multifamily access control dealers (tier 1), property owners/managers (tier 2)',
  three_uniques:   [
    "We install the hardware ourselves — competitors don't",
    "The only platform where the gate generates ancillary revenue for the property",
    "AI diagnostic field tool so good our techs fix problems competitors can't even diagnose",
  ],
  proven_process:  ["Install", "Activate GateCard", "Enable Vendor Layer", "Turn on Revenue", "Add AI Intelligence"],
  guarantee:       '"If our tech tool doesn\'t help your tech fix it, we fix it ourselves"',
  picture_3yr: [
    { label: "Revenue",         value: "$10M ARR" },
    { label: "Properties",      value: "5,000 installed" },
    { label: "Dealer Partners", value: "500 active" },
    { label: "GateCard",        value: "100% of installs" },
    { label: "AI Army",         value: "All 8 agents active" },
  ],
  plan_1yr: [
    { label: "Revenue",           value: "$2M ARR" },
    { label: "Properties",        value: "500 installed" },
    { label: "Active Dealers",    value: "50" },
    { label: "Beta Portal",       value: "Live w/ real dealers" },
    { label: "CRM + Work Orders", value: "Fully operational" },
    { label: "GateCard",          value: "50+ properties" },
  ],
}

function mergeVTO(raw: Record<string, unknown> | null): VTOData {
  if (!raw) return {
    ...VTO_DEFAULTS,
    core_values:    [...VTO_DEFAULTS.core_values],
    three_uniques:  [...VTO_DEFAULTS.three_uniques],
    proven_process: [...VTO_DEFAULTS.proven_process],
    picture_3yr:    [...VTO_DEFAULTS.picture_3yr],
    plan_1yr:       [...VTO_DEFAULTS.plan_1yr],
  }
  return {
    core_values:     (Array.isArray(raw.core_values)    && (raw.core_values    as unknown[]).length > 0) ? raw.core_values    as CVItem[]  : VTO_DEFAULTS.core_values,
    purpose:         (raw.purpose         as string) || VTO_DEFAULTS.purpose,
    niche:           (raw.niche           as string) || VTO_DEFAULTS.niche,
    ten_year_target: (raw.ten_year_target as string) || VTO_DEFAULTS.ten_year_target,
    target_market:   (raw.target_market   as string) || VTO_DEFAULTS.target_market,
    three_uniques:   (Array.isArray(raw.three_uniques)  && (raw.three_uniques  as unknown[]).length > 0) ? raw.three_uniques  as string[]  : VTO_DEFAULTS.three_uniques,
    proven_process:  (Array.isArray(raw.proven_process) && (raw.proven_process as unknown[]).length > 0) ? raw.proven_process as string[]  : VTO_DEFAULTS.proven_process,
    guarantee:       (raw.guarantee       as string) || VTO_DEFAULTS.guarantee,
    picture_3yr:     (Array.isArray(raw.picture_3yr)    && (raw.picture_3yr    as unknown[]).length > 0) ? raw.picture_3yr    as KVItem[]  : VTO_DEFAULTS.picture_3yr,
    plan_1yr:        (Array.isArray(raw.plan_1yr)       && (raw.plan_1yr       as unknown[]).length > 0) ? raw.plan_1yr       as KVItem[]  : VTO_DEFAULTS.plan_1yr,
  }
}

// ─── Tab: V/TO ────────────────────────────────────────────────────────────────

function VTOTab({ rocks, issues, vtoInit }: { rocks: Rock[]; issues: Issue[]; vtoInit: Record<string, unknown> | null }) {
  const [vto, setVto]       = useState<VTOData>(() => mergeVTO(vtoInit))
  const [saving, setSaving] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)

  const patchVTO = async (section: string, updates: Partial<VTOData>) => {
    setSaving(section)
    setVto(prev => ({ ...prev, ...updates }))
    setEditing(null)
    try {
      await fetch('/api/eos/vto', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
    } finally {
      setSaving(null)
    }
  }

  const isEditing = (s: string) => editing === s
  const isSaving  = (s: string) => saving === s

  // Per-section draft state
  const [cvDraft,      setCvDraft]      = useState<CVItem[]>([])
  const [purposeDraft, setPurposeDraft] = useState('')
  const [nicheDraft,   setNicheDraft]   = useState('')
  const [tyDraft,      setTyDraft]      = useState('')
  const [tmDraft,      setTmDraft]      = useState('')
  const [tuDraft,      setTuDraft]      = useState<string[]>([])
  const [ppDraft,      setPpDraft]      = useState<string[]>([])
  const [gDraft,       setGDraft]       = useState('')
  const [p3Draft,      setP3Draft]      = useState<KVItem[]>([])
  const [p1Draft,      setP1Draft]      = useState<KVItem[]>([])

  const startEdit = (section: string) => {
    if (section === 'cv')    { setCvDraft(vto.core_values.map(v => ({ ...v }))); }
    if (section === 'focus') { setPurposeDraft(vto.purpose); setNicheDraft(vto.niche); }
    if (section === 'ty')    { setTyDraft(vto.ten_year_target); }
    if (section === 'ms')    { setTmDraft(vto.target_market); setTuDraft([...vto.three_uniques]); setPpDraft([...vto.proven_process]); setGDraft(vto.guarantee); }
    if (section === 'p3')    { setP3Draft(vto.picture_3yr.map(kv => ({ ...kv }))); }
    if (section === 'p1')    { setP1Draft(vto.plan_1yr.map(kv => ({ ...kv }))); }
    setEditing(section)
  }

  const EditBtn = ({ section }: { section: string }) => (
    <button
      onClick={() => startEdit(section)}
      className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
      title="Edit"
    >
      <Pencil size={13} />
    </button>
  )

  const SaveCancelBar = ({ section, onSave }: { section: string; onSave: () => void }) => (
    <div className="flex gap-2 pt-2">
      <button
        onClick={onSave}
        disabled={isSaving(section)}
        className="text-xs bg-[#6B7EFF] text-white px-3 py-1.5 rounded-lg font-medium hover:bg-[#5B6EEF] disabled:opacity-50 transition-colors"
      >
        {isSaving(section) ? 'Saving…' : 'Save'}
      </button>
      <button
        onClick={() => setEditing(null)}
        className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg border border-border transition-colors"
      >
        Cancel
      </button>
    </div>
  )

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* LEFT — VISION */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1 h-5 rounded-full bg-[#6B7EFF]" />
          <h2 className="text-sm font-bold text-foreground tracking-wide uppercase">Vision</h2>
        </div>

        {/* Core Values */}
        <SectionCard title="Core Values" action={!isEditing('cv') ? <EditBtn section="cv" /> : undefined}>
          {isEditing('cv') ? (
            <div className="space-y-3">
              {cvDraft.map((cv, idx) => (
                <div key={idx} className="flex gap-2 items-start border border-border rounded-lg p-2 bg-slate-50/50">
                  <span className="w-5 h-5 rounded-full bg-[#6B7EFF] text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-1.5">{idx + 1}</span>
                  <div className="flex-1 space-y-1">
                    <input
                      className="w-full text-sm border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#6B7EFF] bg-background"
                      value={cv.title}
                      placeholder="Value name"
                      onChange={e => setCvDraft(d => d.map((x, i) => i === idx ? { ...x, title: e.target.value } : x))}
                    />
                    <textarea
                      className="w-full text-xs border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#6B7EFF] resize-none bg-background"
                      rows={2}
                      value={cv.desc}
                      placeholder="Description"
                      onChange={e => setCvDraft(d => d.map((x, i) => i === idx ? { ...x, desc: e.target.value } : x))}
                    />
                  </div>
                  <button onClick={() => setCvDraft(d => d.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 mt-1.5 shrink-0">
                    <X size={14} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setCvDraft(d => [...d, { n: d.length + 1, title: '', desc: '' }])}
                className="flex items-center gap-1.5 text-xs text-[#6B7EFF] hover:underline"
              >
                <Plus size={12} /> Add value
              </button>
              <SaveCancelBar section="cv" onSave={() => patchVTO('cv', { core_values: cvDraft.map((cv, i) => ({ ...cv, n: i + 1 })) })} />
            </div>
          ) : (
            <ol className="space-y-3">
              {vto.core_values.map(v => (
                <li key={v.n} className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-[#6B7EFF] text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{v.n}</span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{v.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{v.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </SectionCard>

        {/* Core Focus */}
        <SectionCard title="Core Focus" action={!isEditing('focus') ? <EditBtn section="focus" /> : undefined}>
          {isEditing('focus') ? (
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Purpose / Cause / Passion</label>
                <textarea
                  className="w-full text-sm border border-border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#6B7EFF] resize-none bg-background"
                  rows={3}
                  value={purposeDraft}
                  onChange={e => setPurposeDraft(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Niche</label>
                <textarea
                  className="w-full text-sm border border-border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#6B7EFF] resize-none bg-background"
                  rows={3}
                  value={nicheDraft}
                  onChange={e => setNicheDraft(e.target.value)}
                />
              </div>
              <SaveCancelBar section="focus" onSave={() => patchVTO('focus', { purpose: purposeDraft, niche: nicheDraft })} />
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Purpose / Cause / Passion</p>
                <p className="text-sm text-foreground">{vto.purpose}</p>
              </div>
              <div className="border-t border-border pt-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Niche</p>
                <p className="text-sm text-foreground">{vto.niche}</p>
              </div>
            </div>
          )}
        </SectionCard>

        {/* 10-Year Target */}
        <SectionCard title="10-Year Target" action={!isEditing('ty') ? <EditBtn section="ty" /> : undefined}>
          {isEditing('ty') ? (
            <div className="space-y-3">
              <textarea
                className="w-full text-sm border border-border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#6B7EFF] resize-none bg-background"
                rows={4}
                value={tyDraft}
                onChange={e => setTyDraft(e.target.value)}
              />
              <SaveCancelBar section="ty" onSave={() => patchVTO('ty', { ten_year_target: tyDraft })} />
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <Target size={20} className="text-[#6B7EFF] shrink-0 mt-0.5" />
              <p className="text-sm text-foreground">{vto.ten_year_target}</p>
            </div>
          )}
        </SectionCard>

        {/* Marketing Strategy */}
        <SectionCard title="Marketing Strategy" action={!isEditing('ms') ? <EditBtn section="ms" /> : undefined}>
          {isEditing('ms') ? (
            <div className="space-y-4 text-sm">
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Target Market</label>
                <textarea className="w-full border border-border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#6B7EFF] resize-none bg-background" rows={2} value={tmDraft} onChange={e => setTmDraft(e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Three Uniques</label>
                {tuDraft.map((u, i) => (
                  <div key={i} className="flex gap-2 mt-1 items-center">
                    <span className="text-[#6B7EFF] font-bold shrink-0 w-4">{i + 1}.</span>
                    <input className="flex-1 border border-border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#6B7EFF] bg-background" value={u} onChange={e => setTuDraft(d => d.map((x, j) => j === i ? e.target.value : x))} />
                    <button onClick={() => setTuDraft(d => d.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 shrink-0"><X size={14} /></button>
                  </div>
                ))}
                <button onClick={() => setTuDraft(d => [...d, ''])} className="flex items-center gap-1 text-xs text-[#6B7EFF] hover:underline mt-1.5"><Plus size={12} /> Add unique</button>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Proven Process <span className="normal-case font-normal">(steps in order)</span></label>
                {ppDraft.map((step, i) => (
                  <div key={i} className="flex gap-2 mt-1 items-center">
                    <input className="flex-1 border border-border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#6B7EFF] bg-background" value={step} onChange={e => setPpDraft(d => d.map((x, j) => j === i ? e.target.value : x))} />
                    <button onClick={() => setPpDraft(d => d.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 shrink-0"><X size={14} /></button>
                  </div>
                ))}
                <button onClick={() => setPpDraft(d => [...d, ''])} className="flex items-center gap-1 text-xs text-[#6B7EFF] hover:underline mt-1.5"><Plus size={12} /> Add step</button>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Guarantee</label>
                <textarea className="w-full border border-border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#6B7EFF] resize-none bg-background" rows={2} value={gDraft} onChange={e => setGDraft(e.target.value)} />
              </div>
              <SaveCancelBar section="ms" onSave={() => patchVTO('ms', { target_market: tmDraft, three_uniques: tuDraft, proven_process: ppDraft, guarantee: gDraft })} />
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Target Market</p>
                <p className="text-foreground">{vto.target_market}</p>
              </div>
              <div className="border-t border-border pt-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Three Uniques</p>
                <ol className="space-y-1.5">
                  {vto.three_uniques.map((u, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-[#6B7EFF] font-bold shrink-0">{i + 1}.</span>
                      <span className="text-foreground">{u}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="border-t border-border pt-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Proven Process</p>
                <div className="flex items-center gap-1 flex-wrap">
                  {vto.proven_process.map((step, i, arr) => (
                    <span key={i} className="flex items-center gap-1">
                      <span className="text-xs bg-slate-50 border border-border px-2 py-0.5 rounded font-medium text-foreground">{step}</span>
                      {i < arr.length - 1 && <ChevronRight size={12} className="text-muted-foreground" />}
                    </span>
                  ))}
                </div>
              </div>
              <div className="border-t border-border pt-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Guarantee</p>
                <p className="text-foreground italic">{vto.guarantee}</p>
              </div>
            </div>
          )}
        </SectionCard>
      </div>

      {/* RIGHT — TRACTION */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1 h-5 rounded-full bg-emerald-500" />
          <h2 className="text-sm font-bold text-foreground tracking-wide uppercase">Traction</h2>
        </div>

        {/* 3-Year Picture */}
        <SectionCard title="3-Year Picture (2029)" action={!isEditing('p3') ? <EditBtn section="p3" /> : undefined}>
          {isEditing('p3') ? (
            <div className="space-y-3">
              {p3Draft.map((kv, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input className="flex-1 border border-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#6B7EFF] bg-background text-muted-foreground" placeholder="Label" value={kv.label} onChange={e => setP3Draft(d => d.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
                  <input className="flex-1 border border-border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#6B7EFF] bg-background font-semibold" placeholder="Value" value={kv.value} onChange={e => setP3Draft(d => d.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} />
                  <button onClick={() => setP3Draft(d => d.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 shrink-0"><X size={14} /></button>
                </div>
              ))}
              <button onClick={() => setP3Draft(d => [...d, { label: '', value: '' }])} className="flex items-center gap-1 text-xs text-[#6B7EFF] hover:underline"><Plus size={12} /> Add metric</button>
              <SaveCancelBar section="p3" onSave={() => patchVTO('p3', { picture_3yr: p3Draft })} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {vto.picture_3yr.map(item => (
                <div key={item.label} className="bg-slate-50 rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{item.label}</p>
                  <p className="text-sm font-bold text-foreground mt-0.5">{item.value}</p>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* 1-Year Plan */}
        <SectionCard title="1-Year Plan (2026)" action={!isEditing('p1') ? <EditBtn section="p1" /> : undefined}>
          {isEditing('p1') ? (
            <div className="space-y-3">
              {p1Draft.map((kv, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input className="flex-1 border border-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#6B7EFF] bg-background text-muted-foreground" placeholder="Label" value={kv.label} onChange={e => setP1Draft(d => d.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
                  <input className="flex-1 border border-border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#6B7EFF] bg-background font-semibold" placeholder="Value" value={kv.value} onChange={e => setP1Draft(d => d.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} />
                  <button onClick={() => setP1Draft(d => d.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 shrink-0"><X size={14} /></button>
                </div>
              ))}
              <button onClick={() => setP1Draft(d => [...d, { label: '', value: '' }])} className="flex items-center gap-1 text-xs text-[#6B7EFF] hover:underline"><Plus size={12} /> Add goal</button>
              <SaveCancelBar section="p1" onSave={() => patchVTO('p1', { plan_1yr: p1Draft })} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {vto.plan_1yr.map(item => (
                <div key={item.label} className="bg-slate-50 rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{item.label}</p>
                  <p className="text-sm font-bold text-foreground mt-0.5">{item.value}</p>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Q2 Rocks — read-only summary, data from live rocks */}
        <SectionCard>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Q2 2026 Rocks</h3>
            <span className="text-[10px] text-muted-foreground">Due Jun 30 · <a href="#rocks" className="text-[#6B7EFF] hover:underline">See all →</a></span>
          </div>
          {rocks.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No rocks yet — add them in the Rocks tab.</p>
          ) : (
            <div className="space-y-2">
              {rocks.map(rock => (
                <div key={rock.id} className="flex items-center gap-3">
                  <RockStatusPill status={rock.status} />
                  <p className="text-xs text-foreground flex-1 truncate">{rock.name}</p>
                  <span className="text-xs text-muted-foreground">{rock.progress}%</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Open Issues — read-only summary */}
        <SectionCard>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Open Issues</h3>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-foreground">{issues.filter(i => i.status !== "Resolved").length}</span>
              <div>
                <p className="text-[10px] text-muted-foreground">open</p>
                <p className="text-[10px] text-red-500 font-medium">{issues.filter(i => i.priority === "Critical" && i.status !== "Resolved").length} critical</p>
              </div>
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            {issues.filter(i => i.status !== "Resolved").slice(0, 3).map(issue => (
              <div key={issue.id} className="flex items-center gap-2">
                <PriorityPill priority={issue.priority} />
                <p className="text-xs text-foreground flex-1 truncate">{issue.description}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  )
}

// ─── Tab: Rocks ───────────────────────────────────────────────────────────────

function RocksTab({ rocks, setRocks }: { rocks: Rock[]; setRocks: React.Dispatch<React.SetStateAction<Rock[]>> }) {
  const [adding, setAdding] = useState(false);
  const [newRock, setNewRock] = useState<Partial<Rock & { due: string }>>({
    status: "On Track", progress: 0, due: "Jun 30", owner: "Russel Feldman",
  });
  const [saving, setSaving] = useState(false);

  const addRock = async () => {
    if (!newRock.name) return;
    setSaving(true);
    try {
      const res = await fetch("/api/eos/rocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newRock.name,
          owner: newRock.owner,
          quarter: "Q2-2026",
          status: newRock.status,
          progress: newRock.progress ?? 0,
          due_date: newRock.due ? newRock.due : null,
          is_company_rock: true,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setRocks(prev => [...prev, created]);
        setAdding(false);
        setNewRock({ status: "On Track", progress: 0, due: "Jun 30", owner: "Russel Feldman" });
      }
    } finally {
      setSaving(false);
    }
  };

  const updateRock = async (id: string, fields: Partial<Rock>) => {
    // Optimistic update
    setRocks(prev => prev.map(r => r.id === id ? { ...r, ...fields } : r));
    void (async () => {
      try {
        await fetch(`/api/eos/rocks/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fields),
        });
      } catch (_) { /* non-blocking */ }
    })();
  };

  const deleteRock = async (id: string) => {
    setRocks(prev => prev.filter(r => r.id !== id));
    void (async () => {
      try {
        await fetch(`/api/eos/rocks/${id}`, { method: "DELETE" });
      } catch (_) { /* non-blocking */ }
    })();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground">Q2 2026 Rocks</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Due June 30, 2026 · {rocks.filter(r => r.status === "On Track" || r.status === "Complete").length}/{rocks.length} on track
          </p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 text-sm bg-[#6B7EFF] text-white px-3 py-1.5 rounded-lg hover:bg-[#5B6EEF] transition-colors font-medium"
        >
          <Plus size={14} />
          Add Rock
        </button>
      </div>

      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-border">
              {["Rock", "Owner", "Status", "Progress", "Due", ""].map((h, i) => (
                <th key={i} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rocks.map(rock => (
              <tr key={rock.id} className="border-b border-border last:border-0 hover:bg-slate-50/50 transition-colors group">
                <td className="px-4 py-3 font-medium text-foreground max-w-xs">{rock.name}</td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{rock.owner}</td>
                <td className="px-4 py-3">
                  <select
                    className="text-xs border border-border rounded px-1.5 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30 cursor-pointer"
                    value={rock.status}
                    onChange={e => updateRock(rock.id, { status: e.target.value as RockStatus })}
                  >
                    {(["On Track", "At Risk", "Off Track", "Complete"] as RockStatus[]).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 w-40">
                  <div className="flex items-center gap-2">
                    <ProgressBar value={rock.progress} />
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={rock.progress}
                      onChange={e => updateRock(rock.id, { progress: Number(e.target.value) })}
                      className="w-16 accent-[#6B7EFF] cursor-pointer"
                    />
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDate(rock.due_date)}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => deleteRock(rock.id)}
                    className="p-1 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <X size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {adding && (
              <tr className="border-b border-border bg-blue-50/30">
                <td className="px-4 py-2">
                  <input
                    className="w-full border border-border rounded px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30"
                    placeholder="Rock description…"
                    value={newRock.name || ""}
                    onChange={e => setNewRock(p => ({ ...p, name: e.target.value }))}
                    autoFocus
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    className="w-full border border-border rounded px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30"
                    value={newRock.owner || ""}
                    onChange={e => setNewRock(p => ({ ...p, owner: e.target.value }))}
                  />
                </td>
                <td className="px-4 py-2">
                  <select
                    className="border border-border rounded px-2 py-1 text-xs bg-white focus:outline-none"
                    value={newRock.status}
                    onChange={e => setNewRock(p => ({ ...p, status: e.target.value as RockStatus }))}
                  >
                    {(["On Track", "At Risk", "Off Track", "Complete"] as RockStatus[]).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="w-16 border border-border rounded px-2 py-1 text-sm bg-white focus:outline-none"
                    value={newRock.progress || 0}
                    onChange={e => setNewRock(p => ({ ...p, progress: Number(e.target.value) }))}
                  />
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-1">
                    <input
                      className="w-20 border border-border rounded px-2 py-1 text-sm bg-white focus:outline-none"
                      value={newRock.due || ""}
                      placeholder="Jun 30"
                      onChange={e => setNewRock(p => ({ ...p, due: e.target.value }))}
                    />
                    <button
                      onClick={addRock}
                      disabled={saving}
                      className="p-1 text-emerald-600 hover:bg-emerald-50 rounded disabled:opacity-50"
                    >
                      <CheckCircle2 size={16} />
                    </button>
                    <button onClick={() => setAdding(false)} className="p-1 text-muted-foreground hover:bg-slate-100 rounded">
                      <X size={16} />
                    </button>
                  </div>
                </td>
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Summary chips */}
      <div className="flex items-center gap-3 flex-wrap">
        {(["On Track", "At Risk", "Off Track", "Complete"] as RockStatus[]).map(s => {
          const count = rocks.filter(r => r.status === s).length;
          if (!count) return null;
          return (
            <div key={s} className="flex items-center gap-1.5">
              <RockStatusPill status={s} />
              <span className="text-xs text-muted-foreground">{count} rock{count !== 1 ? "s" : ""}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Tab: Scorecard ───────────────────────────────────────────────────────────

function ScorecardTab({ measurables, setMeasurables }: { measurables: Measurable[]; setMeasurables: React.Dispatch<React.SetStateAction<Measurable[]>> }) {
  // Get current and previous week_of values
  const getWeekOf = (offsetWeeks = 0): string => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + 1 - offsetWeeks * 7); // Monday
    return d.toISOString().split("T")[0];
  };

  const thisWeekOf = getWeekOf(0);
  const lastWeekOf = getWeekOf(1);

  const getEntryValue = (m: Measurable, weekOf: string): string => {
    const entry = m.entries.find(e => e.week_of === weekOf);
    return entry?.value ?? "—";
  };

  const updateEntry = async (metricId: string, weekOf: string, value: string) => {
    // Optimistic update
    setMeasurables(prev => prev.map(m => {
      if (m.id !== metricId) return m;
      const existingIdx = m.entries.findIndex(e => e.week_of === weekOf);
      if (existingIdx >= 0) {
        const updated = [...m.entries];
        updated[existingIdx] = { ...updated[existingIdx], value };
        return { ...m, entries: updated };
      }
      return {
        ...m,
        entries: [{ id: `temp-${Date.now()}`, scorecard_id: metricId, week_of: weekOf, value }, ...m.entries],
      };
    }));

    void (async () => {
      try {
        await fetch("/api/eos/scorecard/entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scorecard_id: metricId, week_of: weekOf, value }),
        });
      } catch (_) { /* non-blocking */ }
    })();
  };

  const thisWeekLabel = new Date(thisWeekOf + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-foreground">Weekly Scorecard</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Week of {thisWeekLabel} · Updated each L10</p>
      </div>

      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-border">
              {["Measurable", "Owner", "Goal", "This Week", "Last Week", "Trend", ""].map((h, i) => (
                <th key={i} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {measurables.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground italic">
                  No scorecard metrics yet.
                </td>
              </tr>
            ) : measurables.map(m => {
              const thisWeek = getEntryValue(m, thisWeekOf);
              const lastWeek = getEntryValue(m, lastWeekOf);
              return (
                <tr key={m.id} className="border-b border-border last:border-0 hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{m.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.owner}</td>
                  <td className="px-4 py-3 font-mono text-xs text-foreground bg-slate-50/50">{m.goal}</td>
                  <td className="px-4 py-3">
                    <input
                      className="w-20 border border-border rounded px-2 py-0.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30"
                      value={thisWeek === "—" ? "" : thisWeek}
                      placeholder="—"
                      onChange={e => updateEntry(m.id, thisWeekOf, e.target.value)}
                    />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{lastWeek}</td>
                  <td className="px-4 py-3">
                    <TrendIcon current={thisWeek} previous={lastWeek} />
                  </td>
                  <td className="px-4 py-3">
                    <GoalStatus goal={m.goal} value={thisWeek} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> At or above goal</span>
        <span className="mx-2">·</span>
        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Below goal</span>
        <span className="mx-2">·</span>
        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300 inline-block" /> No data</span>
      </p>
    </div>
  );
}

// ─── Tab: Issues ──────────────────────────────────────────────────────────────

function IssuesTab({ issues, setIssues }: { issues: Issue[]; setIssues: React.Dispatch<React.SetStateAction<Issue[]>> }) {
  const [adding, setAdding] = useState(false);
  const [newIssue, setNewIssue] = useState<Partial<Issue>>({
    type: "Company", priority: "Normal", status: "Open", owner: "RF",
  });
  const [saving, setSaving] = useState(false);

  const updateStatus = async (id: string, status: IssueStatus) => {
    setIssues(prev => prev.map(i => i.id === id ? { ...i, status } : i));
    void (async () => {
      try {
        await fetch(`/api/eos/issues/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
      } catch (_) { /* non-blocking */ }
    })();
  };

  const deleteIssue = async (id: string) => {
    setIssues(prev => prev.filter(i => i.id !== id));
    void (async () => {
      try {
        await fetch(`/api/eos/issues/${id}`, { method: "DELETE" });
      } catch (_) { /* non-blocking */ }
    })();
  };

  const addIssue = async () => {
    if (!newIssue.description) return;
    setSaving(true);
    try {
      const res = await fetch("/api/eos/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newIssue),
      });
      if (res.ok) {
        const created = await res.json();
        setIssues(prev => [created, ...prev]);
        setAdding(false);
        setNewIssue({ type: "Company", priority: "Normal", status: "Open", owner: "RF" });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground">Issues List (IDS)</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Identify · Discuss · Solve — the core of L10</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> {issues.filter(i => i.priority === "Critical").length} critical</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> {issues.filter(i => i.priority === "High").length} high</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" /> {issues.filter(i => i.priority === "Normal").length} normal</span>
          </div>
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 text-sm bg-[#6B7EFF] text-white px-3 py-1.5 rounded-lg hover:bg-[#5B6EEF] transition-colors font-medium"
          >
            <Plus size={14} />
            Add Issue
          </button>
        </div>
      </div>

      {adding && (
        <div className="bg-blue-50/30 border border-blue-200 rounded-xl p-4 space-y-3">
          <h4 className="text-sm font-semibold text-foreground">New Issue</h4>
          <div className="grid grid-cols-1 gap-3">
            <input
              className="border border-border rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30"
              placeholder="Describe the issue…"
              value={newIssue.description || ""}
              onChange={e => setNewIssue(p => ({ ...p, description: e.target.value }))}
              autoFocus
            />
            <div className="flex gap-3">
              <select
                className="border border-border rounded px-2 py-1.5 text-xs bg-white focus:outline-none"
                value={newIssue.type}
                onChange={e => setNewIssue(p => ({ ...p, type: e.target.value as IssueType }))}
              >
                {(["Company", "Department", "People"] as IssueType[]).map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <select
                className="border border-border rounded px-2 py-1.5 text-xs bg-white focus:outline-none"
                value={newIssue.priority}
                onChange={e => setNewIssue(p => ({ ...p, priority: e.target.value as IssuePriority }))}
              >
                {(["Critical", "High", "Normal"] as IssuePriority[]).map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <input
                className="border border-border rounded px-2 py-1.5 text-sm bg-white focus:outline-none w-24"
                placeholder="Owner"
                value={newIssue.owner || ""}
                onChange={e => setNewIssue(p => ({ ...p, owner: e.target.value }))}
              />
              <button
                onClick={addIssue}
                disabled={saving || !newIssue.description}
                className="flex items-center gap-1.5 text-sm bg-[#6B7EFF] text-white px-3 py-1.5 rounded-lg hover:bg-[#5B6EEF] transition-colors font-medium disabled:opacity-50"
              >
                <CheckCircle2 size={14} />
                Save
              </button>
              <button onClick={() => setAdding(false)} className="p-1.5 text-muted-foreground hover:bg-slate-100 rounded">
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-border">
              {["Issue", "Type", "Owner", "Priority", "Created", "IDS Status", "Action", ""].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {issues.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground italic">
                  No issues yet — add one above.
                </td>
              </tr>
            ) : issues.map(issue => (
              <tr key={issue.id} className={cn(
                "border-b border-border last:border-0 hover:bg-slate-50/50 transition-colors group",
                issue.status === "Resolved" && "opacity-60"
              )}>
                <td className="px-4 py-3 font-medium text-foreground max-w-xs">
                  <span className={cn(issue.status === "Resolved" && "line-through text-muted-foreground")}>
                    {issue.description}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={cn(
                    "text-[10px] font-semibold px-2 py-0.5 rounded-full",
                    issue.type === "Company" ? "bg-slate-100 text-slate-600" :
                    issue.type === "People" ? "bg-purple-50 text-purple-700 border border-purple-200" :
                    "bg-orange-50 text-orange-700 border border-orange-200"
                  )}>
                    {issue.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{issue.owner}</td>
                <td className="px-4 py-3"><PriorityPill priority={issue.priority} /></td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDate(issue.created_at)}</td>
                <td className="px-4 py-3"><IssueStatusPill status={issue.status} /></td>
                <td className="px-4 py-3">
                  <select
                    className="text-xs border border-border rounded px-1.5 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30 cursor-pointer"
                    value={issue.status}
                    onChange={e => updateStatus(issue.id, e.target.value as IssueStatus)}
                  >
                    {(["Open", "This Meeting", "In Progress", "Parking Lot", "Resolved"] as IssueStatus[]).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => deleteIssue(issue.id)}
                    className="p-1 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <X size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* IDS Flow reminder */}
      <div className="bg-slate-50 border border-border rounded-xl p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">IDS Framework</p>
        <div className="flex items-center gap-4">
          {[
            { step: "I", label: "Identify", desc: "State the real issue, not the symptom" },
            { step: "D", label: "Discuss", desc: "All opinions heard, on topic only" },
            { step: "S", label: "Solve", desc: "Decide + assign To-Do or drop it" },
          ].map((s, i, arr) => (
            <div key={s.step} className="flex items-center gap-4">
              <div className="text-center">
                <div className="w-8 h-8 rounded-full bg-[#6B7EFF] text-white font-bold text-sm flex items-center justify-center mx-auto mb-1">
                  {s.step}
                </div>
                <p className="text-xs font-semibold text-foreground">{s.label}</p>
                <p className="text-[10px] text-muted-foreground max-w-24 text-center">{s.desc}</p>
              </div>
              {i < arr.length - 1 && <ChevronRight size={16} className="text-muted-foreground shrink-0" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Tab: To-Dos ──────────────────────────────────────────────────────────────

function TodosTab({ todos, setTodos }: { todos: TodoItem[]; setTodos: React.Dispatch<React.SetStateAction<TodoItem[]>> }) {
  const [adding, setAdding] = useState(false);
  const [newTodo, setNewTodo] = useState<Partial<TodoItem>>({ owner: "RF", meeting: "" });
  const [saving, setSaving] = useState(false);

  const toggle = async (id: string) => {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;
    const newDone = !todo.done;
    setTodos(prev => prev.map(t => t.id === id ? { ...t, done: newDone } : t));
    void (async () => {
      try {
        await fetch(`/api/eos/todos/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ done: newDone }),
        });
      } catch (_) { /* non-blocking */ }
    })();
  };

  const deleteTodo = async (id: string) => {
    setTodos(prev => prev.filter(t => t.id !== id));
    void (async () => {
      try {
        await fetch(`/api/eos/todos/${id}`, { method: "DELETE" });
      } catch (_) { /* non-blocking */ }
    })();
  };

  const addTodo = async () => {
    if (!newTodo.text) return;
    setSaving(true);
    try {
      const res = await fetch("/api/eos/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: newTodo.text,
          owner: newTodo.owner,
          due_date: newTodo.due_date ?? null,
          meeting: newTodo.meeting ?? "",
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setTodos(prev => [created, ...prev]);
        setAdding(false);
        setNewTodo({ owner: "RF", meeting: "" });
      }
    } finally {
      setSaving(false);
    }
  };

  const openCount = todos.filter(t => !t.done).length;
  const doneCount = todos.filter(t => t.done).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground">To-Do List</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{openCount} open · {doneCount} complete</p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 text-sm bg-[#6B7EFF] text-white px-3 py-1.5 rounded-lg hover:bg-[#5B6EEF] transition-colors font-medium"
        >
          <Plus size={14} />
          Add To-Do
        </button>
      </div>

      {adding && (
        <div className="bg-blue-50/30 border border-blue-200 rounded-xl p-4 space-y-3">
          <h4 className="text-sm font-semibold text-foreground">New To-Do</h4>
          <div className="grid grid-cols-1 gap-3">
            <input
              className="border border-border rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30"
              placeholder="What needs to get done?"
              value={newTodo.text || ""}
              onChange={e => setNewTodo(p => ({ ...p, text: e.target.value }))}
              autoFocus
            />
            <div className="flex gap-3">
              <input
                className="border border-border rounded px-2 py-1.5 text-sm bg-white focus:outline-none w-24"
                placeholder="Owner"
                value={newTodo.owner || ""}
                onChange={e => setNewTodo(p => ({ ...p, owner: e.target.value }))}
              />
              <input
                type="date"
                className="border border-border rounded px-2 py-1.5 text-sm bg-white focus:outline-none"
                value={newTodo.due_date || ""}
                onChange={e => setNewTodo(p => ({ ...p, due_date: e.target.value }))}
              />
              <input
                className="border border-border rounded px-2 py-1.5 text-sm bg-white focus:outline-none flex-1"
                placeholder="Meeting (e.g. L10 5/23)"
                value={newTodo.meeting || ""}
                onChange={e => setNewTodo(p => ({ ...p, meeting: e.target.value }))}
              />
              <button
                onClick={addTodo}
                disabled={saving || !newTodo.text}
                className="flex items-center gap-1.5 text-sm bg-[#6B7EFF] text-white px-3 py-1.5 rounded-lg hover:bg-[#5B6EEF] transition-colors font-medium disabled:opacity-50"
              >
                <CheckCircle2 size={14} />
                Save
              </button>
              <button onClick={() => setAdding(false)} className="p-1.5 text-muted-foreground hover:bg-slate-100 rounded">
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-border">
              {["", "To-Do", "Owner", "Due", "Meeting", "Status", ""].map((h, i) => (
                <th key={i} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {todos.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground italic">
                  No to-dos yet — add one above.
                </td>
              </tr>
            ) : todos.map(todo => (
              <tr key={todo.id} className={cn(
                "border-b border-border last:border-0 hover:bg-slate-50/50 transition-colors group",
                todo.done && "opacity-60"
              )}>
                <td className="pl-4 py-3 w-8">
                  <button
                    onClick={() => toggle(todo.id)}
                    className="text-muted-foreground hover:text-[#6B7EFF] transition-colors"
                  >
                    {todo.done
                      ? <CheckCircle2 size={18} className="text-emerald-500" />
                      : <Circle size={18} />
                    }
                  </button>
                </td>
                <td className="px-4 py-3 font-medium text-foreground">
                  <span className={cn(todo.done && "line-through text-muted-foreground")}>
                    {todo.text}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{todo.owner}</td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDate(todo.due_date)}</td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{todo.meeting}</td>
                <td className="px-4 py-3">
                  {todo.done
                    ? <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Done</span>
                    : <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">Open</span>
                  }
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => deleteTodo(todo.id)}
                    className="p-1 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <X size={14} />
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

// ─── Tab: L10 Meeting ─────────────────────────────────────────────────────────

const agendaItems = [
  { label: "Segue (Good News)", duration: 5, description: "Each person shares personal and professional good news" },
  { label: "Scorecard Review", duration: 5, description: "Review each measurable — red means issues, drop it to the issues list" },
  { label: "Rock Review", duration: 5, description: "On track or off track — no discussion, just status" },
  { label: "Customer / Employee Headlines", duration: 5, description: "Headlines only — customer praise, employee news, nothing major" },
  { label: "To-Do List Review", duration: 5, description: "Done or not done — 7-day actions, 90% completion rate is the goal" },
  { label: "IDS (Issues)", duration: 60, description: "The most important 60 minutes. Work through issues one at a time using Identify-Discuss-Solve", highlight: true },
  { label: "Conclude", duration: 5, description: "Recap To-Dos, cascade messages to the team, rate the meeting 1-10" },
];

const meetingRatings = [8, 9, 8, 10, 9, 8];

function L10Tab({ issues, todos }: { issues: Issue[]; todos: TodoItem[] }) {
  const openIssues = issues.filter(i => i.status !== "Resolved");
  const openTodos = todos.filter(t => !t.done);

  return (
    <div className="space-y-4">
      {/* Next meeting header */}
      <div className="bg-[#6B7EFF]/5 border border-[#6B7EFF]/20 rounded-xl p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-semibold text-[#6B7EFF] uppercase tracking-wider mb-1">Next L10 Meeting</p>
            <h2 className="text-lg font-bold text-foreground">Friday, May 22, 2026 at 6:00 AM</h2>
            <div className="flex items-center gap-3 mt-2">
              <div className="flex items-center gap-1.5">
                <Users size={13} className="text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Russel Feldman, Nicole Gagliardi</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock size={13} className="text-muted-foreground" />
                <span className="text-sm text-muted-foreground">90 min total</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Last Meeting Ratings</p>
            <div className="flex items-center gap-1.5 justify-end">
              {meetingRatings.map((r, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border",
                    r >= 9 ? "bg-emerald-50 border-emerald-200 text-emerald-700" :
                    r >= 7 ? "bg-blue-50 border-blue-200 text-blue-700" :
                    "bg-amber-50 border-amber-200 text-amber-700"
                  )}
                >
                  {r}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">avg: {(meetingRatings.reduce((a, b) => a + b, 0) / meetingRatings.length).toFixed(1)}/10</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Agenda */}
        <div className="lg:col-span-2">
          <h3 className="text-sm font-semibold text-foreground mb-3">Meeting Agenda</h3>
          <div className="space-y-2">
            {agendaItems.map((item, i) => (
              <div
                key={i}
                className={cn(
                  "bg-white border rounded-xl p-4 flex items-start gap-4",
                  item.highlight
                    ? "border-[#6B7EFF]/30 bg-[#6B7EFF]/3"
                    : "border-border"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-xl flex flex-col items-center justify-center shrink-0",
                  item.highlight ? "bg-[#6B7EFF] text-white" : "bg-slate-100 text-slate-600"
                )}>
                  <span className="text-sm font-bold leading-none">{item.duration}</span>
                  <span className="text-[9px] leading-none mt-0.5">min</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={cn("text-sm font-semibold", item.highlight ? "text-[#6B7EFF]" : "text-foreground")}>
                      {item.label}
                    </p>
                    {item.highlight && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#6B7EFF] text-white">
                        80% of value
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5">
                    <Timer size={12} />
                    Start
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live issues + todos for meeting prep */}
        <div className="space-y-4">
          <div className="bg-white border border-border rounded-xl p-4">
            <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <span>Issues for This Meeting</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                {openIssues.length}
              </span>
            </h4>
            {openIssues.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No open issues.</p>
            ) : (
              <div className="space-y-2">
                {openIssues.map(issue => (
                  <div key={issue.id} className="flex items-start gap-2">
                    <PriorityPill priority={issue.priority} />
                    <p className="text-xs text-foreground flex-1">{issue.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-border rounded-xl p-4">
            <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <span>Open To-Dos</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                {openTodos.length}
              </span>
            </h4>
            {openTodos.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">All to-dos complete!</p>
            ) : (
              <div className="space-y-2">
                {openTodos.map(todo => (
                  <div key={todo.id} className="flex items-start gap-2">
                    <Circle size={14} className="text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-foreground">{todo.text}</p>
                      <p className="text-[10px] text-muted-foreground">{todo.owner} · due {formatDate(todo.due_date)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cadence note */}
      <div className="bg-slate-50 border border-border rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Calendar size={16} className="text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground">Weekly Cadence</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Every Friday at 6:00 AM · Attendees: Russel Feldman, Nicole Gagliardi · 90 minutes
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              The L10 is the heartbeat of EOS execution. The meeting is rated every week — a score below 8 means the meeting itself goes on the issues list.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── AI EOS Coach Panel ───────────────────────────────────────────────────────

function CoachPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<EOSSection | null>(null);
  const [sectionPickerOpen, setSectionPickerOpen] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (messages.length) scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (open && !initialized) {
      setInitialized(true);
      startSession();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const startSession = async () => {
    setLoading(true);
    const initMessages: CoachMessage[] = [
      { role: "user", content: "Hi, I'd like to start an EOS coaching session.", timestamp: new Date() },
    ];
    setMessages(initMessages);
    await streamCoachResponse(initMessages);
  };

  const streamCoachResponse = async (msgs: CoachMessage[], section?: EOSSection | null) => {
    setLoading(true);
    let assistantText = "";

    try {
      const res = await fetch("/api/eos/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: msgs.map(m => ({ role: m.role, content: m.content })),
          section: section ?? activeSection,
        }),
      });

      if (!res.ok || !res.body) throw new Error("Coach unavailable");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const placeholder: CoachMessage = { role: "assistant", content: "", timestamp: new Date() };
      setMessages(prev => [...prev, placeholder]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantText += decoder.decode(value, { stream: true });
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { ...placeholder, content: assistantText };
          return updated;
        });
      }
    } catch {
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: "I'm having trouble connecting right now. Please try again.", timestamp: new Date() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg: CoachMessage = { role: "user", content: input.trim(), timestamp: new Date() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    await streamCoachResponse(updatedMessages);
  };

  const jumpToSection = async (section: EOSSection) => {
    setActiveSection(section);
    setSectionPickerOpen(false);
    const sectionInfo = EOS_SECTIONS.find(s => s.key === section);
    const jumpMsg: CoachMessage = {
      role: "user",
      content: `Let's work on the ${sectionInfo?.label ?? section} section of the V/TO.`,
      timestamp: new Date(),
    };
    const updatedMessages = [...messages, jumpMsg];
    setMessages(updatedMessages);
    await streamCoachResponse(updatedMessages, section);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const displayContent = (content: string) => content.replace(/```json[\s\S]*?```/g, "").trim();
  const hasJSON = (content: string) => /```json[\s\S]*?"action":\s*"update_vto"/.test(content);

  if (!open) return null;

  const currentSectionInfo = activeSection ? EOS_SECTIONS.find(s => s.key === activeSection) : null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex">
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto w-[420px] flex flex-col bg-white shadow-2xl border-l border-border h-full">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-gradient-to-r from-[#6B7EFF]/5 to-white shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#6B7EFF] flex items-center justify-center">
              <Zap size={14} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">EOS Coach</p>
              <p className="text-[10px] text-muted-foreground">Powered by Claude · EOS Implementer AI</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-muted-foreground">
            <X size={16} />
          </button>
        </div>

        <div className="px-4 py-2.5 border-b border-border shrink-0">
          <div className="relative">
            <button
              onClick={() => setSectionPickerOpen(prev => !prev)}
              className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 border border-border rounded-lg text-sm hover:bg-slate-100 transition-colors"
            >
              <span className="text-foreground font-medium">
                {currentSectionInfo
                  ? `${currentSectionInfo.emoji} ${currentSectionInfo.label}`
                  : "All Sections — Open Coaching"}
              </span>
              <ChevronDown size={14} className="text-muted-foreground" />
            </button>
            {sectionPickerOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-lg z-10 overflow-hidden">
                <button
                  onClick={() => { setActiveSection(null); setSectionPickerOpen(false); }}
                  className="w-full text-left px-3 py-2.5 text-sm hover:bg-slate-50 transition-colors border-b border-border text-muted-foreground"
                >
                  Open Coaching (no section)
                </button>
                {EOS_SECTIONS.map(s => (
                  <button
                    key={s.key}
                    onClick={() => jumpToSection(s.key)}
                    className={cn(
                      "w-full text-left px-3 py-2.5 text-sm hover:bg-slate-50 transition-colors",
                      activeSection === s.key && "bg-[#6B7EFF]/5 text-[#6B7EFF] font-medium"
                    )}
                  >
                    {s.emoji} {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.filter(m => !(m.role === "user" && m.content === "Hi, I'd like to start an EOS coaching session.")).map((msg, i) => (
            <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
              {msg.role === "assistant" && (
                <div className="w-6 h-6 rounded-full bg-[#6B7EFF] flex items-center justify-center shrink-0 mt-0.5 mr-2">
                  <Zap size={10} className="text-white" />
                </div>
              )}
              <div className={cn(
                "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                msg.role === "user"
                  ? "bg-[#6B7EFF] text-white rounded-tr-sm"
                  : "bg-slate-50 border border-border text-foreground rounded-tl-sm"
              )}>
                <div className="whitespace-pre-wrap">{displayContent(msg.content)}</div>
                {msg.role === "assistant" && hasJSON(msg.content) && (
                  <div className="mt-3 pt-3 border-t border-border/50">
                    <button className="flex items-center gap-1.5 text-xs text-[#6B7EFF] font-semibold hover:underline">
                      <CheckCircle2 size={12} />
                      Apply to V/TO
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex justify-start">
              <div className="w-6 h-6 rounded-full bg-[#6B7EFF] flex items-center justify-center mr-2 mt-0.5 shrink-0">
                <Zap size={10} className="text-white" />
              </div>
              <div className="bg-slate-50 border border-border rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex items-center gap-1.5">
                  {[0, 150, 300].map(delay => (
                    <div
                      key={delay}
                      className="w-2 h-2 rounded-full bg-[#6B7EFF]/40 animate-bounce"
                      style={{ animationDelay: `${delay}ms` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {messages.length <= 2 && !loading && (
          <div className="px-4 pb-2 shrink-0">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mb-2">Quick Start</p>
            <div className="flex flex-wrap gap-1.5">
              {[
                "Help me define our Core Values",
                "Build our 10-Year Target",
                "Let's do our 1-Year Plan",
                "IDS an issue I'm dealing with",
              ].map(prompt => (
                <button
                  key={prompt}
                  onClick={() => {
                    setInput(prompt);
                    inputRef.current?.focus();
                  }}
                  className="text-xs bg-slate-50 border border-border hover:bg-slate-100 text-slate-600 px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="px-4 py-3 border-t border-border shrink-0">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Talk to your EOS Coach... (Enter to send)"
              rows={2}
              disabled={loading}
              className="flex-1 resize-none border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30 bg-white placeholder:text-muted-foreground disabled:opacity-50"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="w-10 h-10 rounded-xl bg-[#6B7EFF] text-white flex items-center justify-center hover:bg-[#5B6EEF] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              <Send size={15} />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            AI coaching based on EOS methodology. Not a certified EOS Implementer.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS = ["V/TO", "Rocks", "Scorecard", "Issues", "To-Dos", "L10 Meeting"] as const;
type Tab = typeof TABS[number];

export default function EOSPage() {
  const [activeTab, setActiveTab] = useState<Tab>("V/TO");
  const [coachOpen, setCoachOpen] = useState(false);

  // ── Live data state ──
  const [rocks, setRocks] = useState<Rock[]>([]);
  const [measurables, setMeasurables] = useState<Measurable[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [vto, setVto] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Load all data on mount ──
  useEffect(() => {
    let cancelled = false;

    const loadAll = async () => {
      try {
        const [rocksRes, scorecardRes, issuesRes, todosRes, vtoRes] = await Promise.all([
          fetch("/api/eos/rocks"),
          fetch("/api/eos/scorecard"),
          fetch("/api/eos/issues"),
          fetch("/api/eos/todos"),
          fetch("/api/eos/vto"),
        ]);

        const [rocksData, scorecardData, issuesData, todosData] = await Promise.all([
          rocksRes.ok ? rocksRes.json() : [],
          scorecardRes.ok ? scorecardRes.json() : [],
          issuesRes.ok ? issuesRes.json() : [],
          todosRes.ok ? todosRes.json() : [],
        ]);
        const vtoData = vtoRes.ok && vtoRes.status !== 404 ? await vtoRes.json() : null;

        if (!cancelled) {
          setRocks(Array.isArray(rocksData) ? rocksData : []);
          setMeasurables(Array.isArray(scorecardData) ? scorecardData : []);
          setIssues(Array.isArray(issuesData) ? issuesData : []);
          setTodos(Array.isArray(todosData) ? todosData : []);
          setVto(vtoData);
          setLoading(false);
        }
      } catch (err) {
        console.error("EOS load error:", err);
        if (!cancelled) setLoading(false);
      }
    };

    void loadAll();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC]">
      <TopBar
        title="Operating System"
        subtitle="GateGuard EOS — Vision · Traction · Accountability"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-white border border-border px-3 py-1.5 rounded-lg">
              <Calendar size={13} />
              Next L10: Fri May 22, 6:00 AM
            </div>
            <div className="flex items-center gap-1.5 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg font-medium">
              <Flag size={13} />
              Q2 2026
            </div>
            <button
              onClick={() => setCoachOpen(true)}
              className="flex items-center gap-1.5 text-sm font-semibold bg-[#6B7EFF] text-white px-3 py-1.5 rounded-lg hover:bg-[#5B6EEF] transition-colors shadow-sm shadow-[#6B7EFF]/30"
            >
              <Zap size={13} />
              AI Coach
            </button>
          </div>
        }
      />

      <div className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {/* Tab bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-1 bg-white border border-border rounded-xl p-1 w-fit">
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "text-sm font-medium px-4 py-2 rounded-lg transition-all",
                  activeTab === tab
                    ? "bg-[#6B7EFF] text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          {activeTab === "V/TO" && (
            <button
              onClick={() => setCoachOpen(true)}
              className="flex items-center gap-2 text-xs text-[#6B7EFF] bg-[#6B7EFF]/5 border border-[#6B7EFF]/20 px-3 py-2 rounded-lg hover:bg-[#6B7EFF]/10 transition-colors"
            >
              <Zap size={12} />
              <span>Not sure what goes here? Let AI Coach help you build your V/TO</span>
            </button>
          )}
        </div>

        {/* Loading state */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={28} className="text-[#6B7EFF] animate-spin" />
              <p className="text-sm text-muted-foreground">Loading EOS data...</p>
            </div>
          </div>
        ) : (
          <>
            {activeTab === "V/TO"        && <VTOTab rocks={rocks} issues={issues} vtoInit={vto} />}
            {activeTab === "Rocks"       && <RocksTab rocks={rocks} setRocks={setRocks} />}
            {activeTab === "Scorecard"   && <ScorecardTab measurables={measurables} setMeasurables={setMeasurables} />}
            {activeTab === "Issues"      && <IssuesTab issues={issues} setIssues={setIssues} />}
            {activeTab === "To-Dos"      && <TodosTab todos={todos} setTodos={setTodos} />}
            {activeTab === "L10 Meeting" && <L10Tab issues={issues} todos={todos} />}
          </>
        )}
      </div>

      {/* Floating AI Coach button */}
      {!coachOpen && (
        <button
          onClick={() => setCoachOpen(true)}
          className="fixed bottom-6 right-6 flex items-center gap-2 bg-[#6B7EFF] text-white px-4 py-3 rounded-2xl shadow-lg shadow-[#6B7EFF]/30 hover:bg-[#5B6EEF] transition-all hover:scale-105 z-40 font-semibold text-sm"
        >
          <Zap size={16} />
          EOS Coach
        </button>
      )}

      <CoachPanel open={coachOpen} onClose={() => setCoachOpen(false)} />
    </div>
  );
}
