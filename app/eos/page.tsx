"use client";

import { useState } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { cn } from "@/lib/utils";
import {
  CheckCircle2, Circle, Clock, AlertTriangle, TrendingUp,
  TrendingDown, Minus, Plus, X, ChevronRight, Users,
  Calendar, Target, Layers,
} from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Timer, Flag } = require("lucide-react") as any;

// ─── Types ────────────────────────────────────────────────────────────────────

type RockStatus = "On Track" | "At Risk" | "Off Track" | "Complete";
type IssuePriority = "Critical" | "High" | "Normal";
type IssueType = "Company" | "Department" | "People";
type IssueStatus = "In Progress" | "Resolved" | "This Meeting" | "Parking Lot" | "Open";

interface Rock {
  id: number;
  name: string;
  owner: string;
  status: RockStatus;
  progress: number;
  due: string;
}

interface Measurable {
  id: number;
  name: string;
  owner: string;
  goal: string;
  thisWeek: string;
  lastWeek: string;
  unit?: string;
}

interface Issue {
  id: number;
  description: string;
  type: IssueType;
  owner: string;
  priority: IssuePriority;
  created: string;
  status: IssueStatus;
}

interface TodoItem {
  id: number;
  text: string;
  owner: string;
  due: string;
  meeting: string;
  done: boolean;
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

const initialRocks: Rock[] = [
  { id: 1, name: "Go live on portal.gateguard.co (beta → production)", owner: "Russel Feldman", status: "On Track", progress: 70, due: "Jun 30" },
  { id: 2, name: "CRM Phase 2 complete — all buttons wired, no dead UI", owner: "Russel Feldman", status: "On Track", progress: 40, due: "Jun 30" },
  { id: 3, name: "GateCard v2 launched at 10 active properties", owner: "Russel Feldman", status: "At Risk", progress: 20, due: "Jun 30" },
  { id: 4, name: "DirecTV channel: First 5 dealer signups through ATLAS", owner: "Russel Feldman", status: "On Track", progress: 50, due: "Jun 30" },
  { id: 5, name: "PE investor one-sheet + pitch deck finalized", owner: "Russel Feldman", status: "Off Track", progress: 10, due: "Jun 30" },
  { id: 6, name: "Hire first full-time developer", owner: "Russel Feldman", status: "Off Track", progress: 5, due: "Jun 30" },
];

const measurables: Measurable[] = [
  { id: 1, name: "New Opportunities Created", owner: "RF", goal: "3/wk", thisWeek: "2", lastWeek: "4" },
  { id: 2, name: "Proposals Sent", owner: "RF", goal: "2/wk", thisWeek: "1", lastWeek: "3" },
  { id: 3, name: "Closed Won Revenue", owner: "RF", goal: "$50K/mo", thisWeek: "—", lastWeek: "—" },
  { id: 4, name: "Active Dealer Partners", owner: "RF", goal: "50", thisWeek: "12", lastWeek: "12" },
  { id: 5, name: "Properties Installed (YTD)", owner: "RF", goal: "50", thisWeek: "8", lastWeek: "8" },
  { id: 6, name: "Tech Tool Sessions", owner: "RF", goal: "20/wk", thisWeek: "—", lastWeek: "—" },
  { id: 7, name: "Show Leads Assigned", owner: "RF", goal: "5/wk", thisWeek: "3", lastWeek: "2" },
  { id: 8, name: "Portal Uptime", owner: "RF", goal: "99.9%", thisWeek: "99.9%", lastWeek: "99.9%" },
];

const initialIssues: Issue[] = [
  { id: 1, description: "CRM page crashes on load — grouped type mismatch", type: "Company", owner: "RF", priority: "High", created: "May 12", status: "In Progress" },
  { id: 2, description: "No way to create opportunities from UI until this week", type: "Company", owner: "RF", priority: "High", created: "May 10", status: "Resolved" },
  { id: 3, description: "EOS One is separate from portal — creates context switching", type: "Company", owner: "RF", priority: "Normal", created: "May 14", status: "This Meeting" },
  { id: 4, description: "ISP provider page load fails when switching — Clerk refresh needed", type: "Company", owner: "RF", priority: "High", created: "May 13", status: "In Progress" },
  { id: 5, description: "No PE investor materials exist yet", type: "Company", owner: "RF", priority: "Critical", created: "May 1", status: "This Meeting" },
  { id: 6, description: "Hire: need first FT developer to ship faster", type: "People", owner: "RF", priority: "Critical", created: "Apr 15", status: "Parking Lot" },
];

const initialTodos: TodoItem[] = [
  { id: 1, text: "Fix CRM /crm page crash — grouped type", owner: "RF", due: "May 15", meeting: "L10 5/16", done: true },
  { id: 2, text: "Push migration 009 to Supabase beta", owner: "RF", due: "May 16", meeting: "L10 5/16", done: false },
  { id: 3, text: "Add sidebar user popout for session refresh", owner: "RF", due: "May 15", meeting: "L10 5/16", done: true },
  { id: 4, text: "Build PE investor one-sheet draft", owner: "RF", due: "May 22", meeting: "L10 5/23", done: false },
  { id: 5, text: "Run migration 009 on beta Supabase", owner: "RF", due: "May 16", meeting: "L10 5/16", done: false },
  { id: 6, text: "Finalize Q2 Rocks with team", owner: "RF", due: "May 23", meeting: "L10 5/23", done: false },
];

const meetingRatings = [8, 9, 8, 10, 9, 8];

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-white border border-border rounded-xl p-5", className)}>
      {title && <h3 className="text-sm font-semibold text-foreground mb-3">{title}</h3>}
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
  if (value === "—") return <div className="w-2 h-2 rounded-full bg-slate-300" />;
  const goalNum = parseFloat(goal.replace(/[^0-9.]/g, ""));
  const valueNum = parseFloat(value.replace(/[^0-9.]/g, ""));
  if (isNaN(goalNum) || isNaN(valueNum)) return <div className="w-2 h-2 rounded-full bg-slate-300" />;
  return (
    <div className={cn("w-2 h-2 rounded-full", valueNum >= goalNum ? "bg-emerald-500" : "bg-red-500")} />
  );
}

// ─── Tab: V/TO ────────────────────────────────────────────────────────────────

function VTOTab({ rocks, issues }: { rocks: Rock[]; issues: Issue[] }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* LEFT — VISION */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1 h-5 rounded-full bg-[#6B7EFF]" />
          <h2 className="text-sm font-bold text-foreground tracking-wide uppercase">Vision</h2>
        </div>

        <SectionCard title="Core Values">
          <ol className="space-y-3">
            {[
              { n: 1, title: "Innovation Without Limits", desc: "We level up constantly. When we think we're the best, it's time to go further." },
              { n: 2, title: "Dealers First", desc: "Our dealers' success IS our success. We make them look elite." },
              { n: 3, title: "Hardware Is The Moat", desc: "We own the physical relationship. Software follows the gate." },
              { n: 4, title: "One Platform", desc: "We unify. No silos, no app fatigue, one system for everything multifamily." },
              { n: 5, title: "Radical Transparency", desc: "We tell the truth to owners, dealers, and each other." },
            ].map(v => (
              <li key={v.n} className="flex gap-3">
                <span className="w-5 h-5 rounded-full bg-[#6B7EFF] text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {v.n}
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{v.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{v.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </SectionCard>

        <SectionCard title="Core Focus">
          <div className="space-y-3">
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Purpose / Cause / Passion</p>
              <p className="text-sm text-foreground">"To become the central nervous system of multifamily real estate"</p>
            </div>
            <div className="border-t border-border pt-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Niche</p>
              <p className="text-sm text-foreground">"The only AI-powered access control platform that installs the hardware AND runs the software — turning every gate into a compounding business asset"</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="10-Year Target">
          <div className="flex items-start gap-3">
            <Target size={20} className="text-[#6B7EFF] shrink-0 mt-0.5" />
            <p className="text-sm text-foreground">$100M ARR — Installed in 50,000+ multifamily properties across the US. The dominant middleware platform between every property owner, resident, vendor, and service provider in multifamily.</p>
          </div>
        </SectionCard>

        <SectionCard title="Marketing Strategy">
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Target Market</p>
              <p className="text-foreground">Multifamily access control dealers <span className="text-muted-foreground">(tier 1)</span>, property owners/managers <span className="text-muted-foreground">(tier 2)</span></p>
            </div>
            <div className="border-t border-border pt-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Three Uniques</p>
              <ol className="space-y-1.5">
                {[
                  "We install the hardware ourselves — competitors don't",
                  "The only platform where the gate generates ancillary revenue for the property",
                  "AI diagnostic field tool so good our techs fix problems competitors can't even diagnose",
                ].map((u, i) => (
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
                {["Install", "Activate GateCard", "Enable Vendor Layer", "Turn on Revenue", "Add AI Intelligence"].map((step, i, arr) => (
                  <span key={step} className="flex items-center gap-1">
                    <span className="text-xs bg-slate-50 border border-border px-2 py-0.5 rounded font-medium text-foreground">{step}</span>
                    {i < arr.length - 1 && <ChevronRight size={12} className="text-muted-foreground" />}
                  </span>
                ))}
              </div>
            </div>
            <div className="border-t border-border pt-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Guarantee</p>
              <p className="text-foreground italic">"If our tech tool doesn't help your tech fix it, we fix it ourselves"</p>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* RIGHT — TRACTION */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1 h-5 rounded-full bg-emerald-500" />
          <h2 className="text-sm font-bold text-foreground tracking-wide uppercase">Traction</h2>
        </div>

        <SectionCard title="3-Year Picture (2029)">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Revenue", value: "$10M ARR" },
              { label: "Properties", value: "5,000 installed" },
              { label: "Dealer Partners", value: "500 active" },
              { label: "GateCard", value: "100% of installs" },
              { label: "AI Army", value: "All 8 agents active" },
            ].map(item => (
              <div key={item.label} className="bg-slate-50 rounded-lg p-3">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{item.label}</p>
                <p className="text-sm font-bold text-foreground mt-0.5">{item.value}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="1-Year Plan (2026)">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Revenue", value: "$2M ARR" },
              { label: "Properties", value: "500 installed" },
              { label: "Active Dealers", value: "50" },
              { label: "Beta Portal", value: "Live w/ real dealers" },
              { label: "CRM + Work Orders", value: "Fully operational" },
              { label: "GateCard", value: "50+ properties" },
            ].map(item => (
              <div key={item.label} className="bg-slate-50 rounded-lg p-3">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{item.label}</p>
                <p className="text-sm font-bold text-foreground mt-0.5">{item.value}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Q2 2026 Rocks</h3>
            <span className="text-[10px] text-muted-foreground">Due Jun 30 · <a href="#rocks" className="text-[#6B7EFF] hover:underline">See all →</a></span>
          </div>
          <div className="space-y-2">
            {rocks.map(rock => (
              <div key={rock.id} className="flex items-center gap-3">
                <RockStatusPill status={rock.status} />
                <p className="text-xs text-foreground flex-1 truncate">{rock.name}</p>
                <span className="text-xs text-muted-foreground">{rock.progress}%</span>
              </div>
            ))}
          </div>
        </SectionCard>

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
  );
}

// ─── Tab: Rocks ───────────────────────────────────────────────────────────────

function RocksTab() {
  const [rocks, setRocks] = useState<Rock[]>(initialRocks);
  const [adding, setAdding] = useState(false);
  const [newRock, setNewRock] = useState<Partial<Rock>>({ status: "On Track", progress: 0, due: "Jun 30", owner: "Russel Feldman" });

  const addRock = () => {
    if (!newRock.name) return;
    setRocks(prev => [...prev, { ...newRock, id: Date.now() } as Rock]);
    setAdding(false);
    setNewRock({ status: "On Track", progress: 0, due: "Jun 30", owner: "Russel Feldman" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground">Q2 2026 Rocks</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Due June 30, 2026 · {rocks.filter(r => r.status === "On Track" || r.status === "Complete").length}/{rocks.length} on track</p>
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
              {["Rock", "Owner", "Status", "Progress", "Due"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rocks.map(rock => (
              <tr key={rock.id} className="border-b border-border last:border-0 hover:bg-slate-50/50 transition-colors">
                <td className="px-4 py-3 font-medium text-foreground max-w-xs">{rock.name}</td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{rock.owner}</td>
                <td className="px-4 py-3"><RockStatusPill status={rock.status} /></td>
                <td className="px-4 py-3 w-40"><ProgressBar value={rock.progress} /></td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{rock.due}</td>
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
                      onChange={e => setNewRock(p => ({ ...p, due: e.target.value }))}
                    />
                    <button onClick={addRock} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><CheckCircle2 size={16} /></button>
                    <button onClick={() => setAdding(false)} className="p-1 text-muted-foreground hover:bg-slate-100 rounded"><X size={16} /></button>
                  </div>
                </td>
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

function ScorecardTab() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-foreground">Weekly Scorecard</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Week of May 12, 2026 · Updated each L10</p>
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
            {measurables.map(m => (
              <tr key={m.id} className="border-b border-border last:border-0 hover:bg-slate-50/50 transition-colors">
                <td className="px-4 py-3 font-medium text-foreground">{m.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{m.owner}</td>
                <td className="px-4 py-3 font-mono text-xs text-foreground bg-slate-50/50">{m.goal}</td>
                <td className="px-4 py-3">
                  <span className={cn(
                    "font-semibold",
                    m.thisWeek === "—" ? "text-muted-foreground" : "text-foreground"
                  )}>{m.thisWeek}</span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{m.lastWeek}</td>
                <td className="px-4 py-3">
                  <TrendIcon current={m.thisWeek} previous={m.lastWeek} />
                </td>
                <td className="px-4 py-3">
                  <GoalStatus goal={m.goal} value={m.thisWeek} />
                </td>
              </tr>
            ))}
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

function IssuesTab() {
  const [issues, setIssues] = useState<Issue[]>(initialIssues);

  const updateStatus = (id: number, status: IssueStatus) => {
    setIssues(prev => prev.map(i => i.id === id ? { ...i, status } : i));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground">Issues List (IDS)</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Identify · Discuss · Solve — the core of L10</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> {issues.filter(i => i.priority === "Critical").length} critical</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> {issues.filter(i => i.priority === "High").length} high</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" /> {issues.filter(i => i.priority === "Normal").length} normal</span>
        </div>
      </div>

      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-border">
              {["Issue", "Type", "Owner", "Priority", "Created", "IDS Status", "Action"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {issues.map(issue => (
              <tr key={issue.id} className={cn(
                "border-b border-border last:border-0 hover:bg-slate-50/50 transition-colors",
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
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{issue.created}</td>
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

function TodosTab() {
  const [todos, setTodos] = useState<TodoItem[]>(initialTodos);

  const toggle = (id: number) => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
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
      </div>

      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-border">
              {["", "To-Do", "Owner", "Due", "Meeting", "Status"].map((h, i) => (
                <th key={i} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {todos.map(todo => (
              <tr key={todo.id} className={cn(
                "border-b border-border last:border-0 hover:bg-slate-50/50 transition-colors",
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
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{todo.due}</td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{todo.meeting}</td>
                <td className="px-4 py-3">
                  {todo.done
                    ? <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Done ✓</span>
                    : <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">Open</span>
                  }
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
  { label: "IDS (Issues)", duration: 60, description: "The most important 60 minutes. Work through issues one at a time using Identify–Discuss–Solve", highlight: true },
  { label: "Conclude", duration: 5, description: "Recap To-Dos, cascade messages to the team, rate the meeting 1–10" },
];

function L10Tab() {
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

      {/* Agenda */}
      <div>
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

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS = ["V/TO", "Rocks", "Scorecard", "Issues", "To-Dos", "L10 Meeting"] as const;
type Tab = typeof TABS[number];

export default function EOSPage() {
  const [activeTab, setActiveTab] = useState<Tab>("V/TO");
  const [rocks] = useState<Rock[]>(initialRocks);
  const [issues] = useState<Issue[]>(initialIssues);

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
          </div>
        }
      />

      <div className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {/* Tab bar */}
        <div className="flex items-center gap-1 bg-white border border-border rounded-xl p-1 mb-6 w-fit">
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

        {/* Tab content */}
        {activeTab === "V/TO"       && <VTOTab rocks={rocks} issues={issues} />}
        {activeTab === "Rocks"      && <RocksTab />}
        {activeTab === "Scorecard"  && <ScorecardTab />}
        {activeTab === "Issues"     && <IssuesTab />}
        {activeTab === "To-Dos"     && <TodosTab />}
        {activeTab === "L10 Meeting" && <L10Tab />}
      </div>
    </div>
  );
}
