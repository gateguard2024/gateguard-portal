"use client";

import { useState } from "react";
import Link from "next/link";
import { TopBar } from "@/components/layout/TopBar";
import {
  LayoutGrid, List, Plus, Search, SlidersHorizontal,
  Building2, User, MapPin, DollarSign,
  Clock, ArrowRight, MoreHorizontal,
  AlertCircle, TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────
type Stage =
  | "new" | "contacted" | "qualifying"
  | "inquiry" | "site_walk" | "proposal" | "negotiation"
  | "won" | "lost";

type RecordType = "lead" | "opportunity";

interface CRMRecord {
  id: string;
  type: RecordType;
  name: string;
  company?: string;
  contact: string;
  propertyType: string;
  units?: number;
  location: string;
  stage: Stage;
  estSetup?: number;
  estMrr?: number;
  rep: string;
  repInitials: string;
  lastActivity: string;
  lockDaysLeft?: number;
  source?: string;
}

// ── Mock data ──────────────────────────────────────────────────────────────
const mockRecords: CRMRecord[] = [
  { id: "1", type: "lead", name: "Riverside Villas", company: "", contact: "Tom Nguyen", propertyType: "Multifamily", units: 84, location: "Atlanta, GA", stage: "new", rep: "J. Torres", repInitials: "JT", lastActivity: "2h ago", lockDaysLeft: 87, source: "Referral" },
  { id: "2", type: "lead", name: "Park View HOA", company: "", contact: "Sandra Kim", propertyType: "HOA", units: 120, location: "Marietta, GA", stage: "contacted", rep: "R. Feldman", repInitials: "RF", lastActivity: "Yesterday", lockDaysLeft: 74, source: "Web" },
  { id: "3", type: "lead", name: "Midtown Commons", company: "Elevation Realty", contact: "David Park", propertyType: "Multifamily", units: 210, location: "Atlanta, GA", stage: "qualifying", estSetup: 18000, estMrr: 2100, rep: "J. Torres", repInitials: "JT", lastActivity: "3h ago", lockDaysLeft: 61 },
  { id: "4", type: "opportunity", name: "Stonegate Townhomes", company: "Pegasus Residential", contact: "Maria Reyes", propertyType: "Multifamily", units: 95, location: "Smyrna, GA", stage: "inquiry", estSetup: 14200, estMrr: 1240, rep: "J. Torres", repInitials: "JT", lastActivity: "1h ago" },
  { id: "5", type: "opportunity", name: "The Monroe", company: "Elevation Realty", contact: "Chris Wade", propertyType: "Multifamily", units: 178, location: "Decatur, GA", stage: "site_walk", estSetup: 22500, estMrr: 1780, rep: "R. Feldman", repInitials: "RF", lastActivity: "Today" },
  { id: "6", type: "opportunity", name: "Ashford Glen", company: "Pegasus Residential", contact: "Maria Reyes", propertyType: "HOA", units: 312, location: "Dunwoody, GA", stage: "proposal", estSetup: 31000, estMrr: 3120, rep: "J. Torres", repInitials: "JT", lastActivity: "4h ago" },
  { id: "7", type: "opportunity", name: "Flint River Estates", company: "", contact: "Jason Bell", propertyType: "Multifamily", units: 64, location: "Macon, GA", stage: "proposal", estSetup: 9800, estMrr: 640, rep: "R. Feldman", repInitials: "RF", lastActivity: "2d ago" },
  { id: "8", type: "opportunity", name: "Elevate Eagles Landing", company: "Columbia Residential", contact: "Shawn Brooks", propertyType: "Multifamily", units: 148, location: "McDonough, GA", stage: "negotiation", estSetup: 19500, estMrr: 1480, rep: "R. Feldman", repInitials: "RF", lastActivity: "Yesterday" },
  { id: "9", type: "opportunity", name: "Pegasus at Buckhead", company: "Pegasus Residential", contact: "Maria Reyes", propertyType: "Multifamily", units: 412, location: "Atlanta, GA", stage: "won", estSetup: 48000, estMrr: 4120, rep: "J. Torres", repInitials: "JT", lastActivity: "Last week" },
];

// ── Pipeline columns ───────────────────────────────────────────────────────
const columns: { stage: Stage; label: string; color: string; dot: string }[] = [
  { stage: "new",         label: "New Lead",    color: "bg-slate-50 border-slate-200",  dot: "bg-slate-400" },
  { stage: "contacted",   label: "Contacted",   color: "bg-blue-50 border-blue-200",    dot: "bg-blue-400" },
  { stage: "qualifying",  label: "Qualifying",  color: "bg-indigo-50 border-indigo-200",dot: "bg-indigo-400" },
  { stage: "inquiry",     label: "Opportunity", color: "bg-violet-50 border-violet-200",dot: "bg-violet-400" },
  { stage: "site_walk",   label: "Site Walk",   color: "bg-amber-50 border-amber-200",  dot: "bg-amber-400" },
  { stage: "proposal",    label: "Proposal",    color: "bg-orange-50 border-orange-200",dot: "bg-orange-400" },
  { stage: "negotiation", label: "Negotiation", color: "bg-rose-50 border-rose-200",    dot: "bg-rose-400" },
  { stage: "won",         label: "Won",         color: "bg-emerald-50 border-emerald-200", dot: "bg-emerald-500" },
];

const stageLabel: Record<Stage, string> = {
  new: "New Lead", contacted: "Contacted", qualifying: "Qualifying",
  inquiry: "Opportunity", site_walk: "Site Walk", proposal: "Proposal",
  negotiation: "Negotiation", won: "Won", lost: "Lost",
};

const stagePill: Record<Stage, string> = {
  new:         "bg-slate-100 text-slate-600",
  contacted:   "bg-blue-100 text-blue-700",
  qualifying:  "bg-indigo-100 text-indigo-700",
  inquiry:     "bg-violet-100 text-violet-700",
  site_walk:   "bg-amber-100 text-amber-700",
  proposal:    "bg-orange-100 text-orange-700",
  negotiation: "bg-rose-100 text-rose-700",
  won:         "bg-emerald-100 text-emerald-700",
  lost:        "bg-red-100 text-red-600",
};

function fmt(n?: number) {
  if (!n) return "—";
  return n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n}`;
}

// ── Pipeline summary bar ───────────────────────────────────────────────────
function PipelineSummary({ records }: { records: CRMRecord[] }) {
  const active = records.filter(r => r.stage !== "won" && r.stage !== "lost");
  const totalSetup = active.reduce((s, r) => s + (r.estSetup || 0), 0);
  const totalMrr   = active.reduce((s, r) => s + (r.estMrr   || 0), 0);
  const leads = records.filter(r => r.type === "lead").length;
  const opps  = records.filter(r => r.type === "opportunity" && r.stage !== "won").length;
  const won   = records.filter(r => r.stage === "won").length;

  return (
    <div className="grid grid-cols-5 gap-3 mb-5">
      {[
        { label: "Active Leads",   value: leads,          icon: User,       color: "text-blue-600",    bg: "bg-blue-50" },
        { label: "Opportunities",  value: opps,           icon: TrendingUp, color: "text-violet-600",  bg: "bg-violet-50" },
        { label: "Won This Month", value: won,            icon: AlertCircle,color: "text-emerald-600", bg: "bg-emerald-50" },
        { label: "Pipeline Value", value: fmt(totalSetup),icon: DollarSign, color: "text-orange-600",  bg: "bg-orange-50" },
        { label: "Monthly MRR",    value: fmt(totalMrr),  icon: DollarSign, color: "text-brand-600",   bg: "bg-blue-50" },
      ].map(({ label, value, icon: Icon, color, bg }) => (
        <div key={label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", bg)}>
            <Icon size={16} className={color} />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground font-medium">{label}</p>
            <p className="text-lg font-semibold text-foreground leading-tight">{value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Kanban card ────────────────────────────────────────────────────────────
function KanbanCard({ record }: { record: CRMRecord }) {
  return (
    <div className="bg-white border border-border rounded-xl p-3.5 hover:border-brand-400/40 hover:shadow-sm transition-all group">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate leading-tight">{record.name}</p>
          {record.company && (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
              <Building2 size={10} className="shrink-0" />{record.company}
            </p>
          )}
        </div>
        <button className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-muted-foreground hover:text-foreground">
          <MoreHorizontal size={14} />
        </button>
      </div>

      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-2.5">
        <MapPin size={10} className="shrink-0" />
        <span className="truncate">{record.location}</span>
        {record.units && <span className="ml-auto shrink-0 font-medium text-foreground">{record.units}u</span>}
      </div>

      {(record.estSetup || record.estMrr) && (
        <div className="flex items-center gap-2 mb-2.5 text-[11px]">
          {record.estSetup && (
            <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">{fmt(record.estSetup)}</span>
          )}
          {record.estMrr && (
            <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">{fmt(record.estMrr)}/mo</span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-full bg-brand-400/15 border border-brand-400/20 flex items-center justify-center text-[9px] font-bold text-brand-400">
            {record.repInitials}
          </div>
          <span className="text-[10px] text-muted-foreground">{record.rep}</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock size={9} />
          {record.lastActivity}
        </div>
      </div>

      {record.lockDaysLeft !== undefined && (
        <div className={cn(
          "mt-2 flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg",
          record.lockDaysLeft > 30 ? "bg-emerald-50 text-emerald-600" :
          record.lockDaysLeft > 14 ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600"
        )}>
          <AlertCircle size={9} />
          Lock expires in {record.lockDaysLeft}d
        </div>
      )}
    </div>
  );
}

// ── Board view ─────────────────────────────────────────────────────────────
function BoardView({ records }: { records: CRMRecord[] }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-4 min-h-[520px]">
      {columns.map(col => {
        const colRecords = records.filter(r => r.stage === col.stage);
        const colValue = colRecords.reduce((s, r) => s + (r.estSetup || 0) + (r.estMrr || 0) * 12, 0);
        return (
          <div key={col.stage} className="shrink-0 w-[230px]">
            <div className={cn(
              "flex items-center justify-between px-3 py-2 rounded-t-xl border border-b-0",
              col.color
            )}>
              <div className="flex items-center gap-2">
                <div className={cn("w-2 h-2 rounded-full", col.dot)} />
                <span className="text-xs font-semibold text-foreground">{col.label}</span>
                <span className="text-[10px] text-muted-foreground bg-white/70 px-1.5 py-0.5 rounded-full font-medium">
                  {colRecords.length}
                </span>
              </div>
              {colValue > 0 && (
                <span className="text-[10px] text-muted-foreground font-medium">{fmt(colValue)}</span>
              )}
            </div>
            <div className={cn(
              "rounded-b-xl border border-t-0 p-2 space-y-2 min-h-[460px]",
              col.color
            )}>
              {colRecords.map(r => (
                <Link key={r.id} href={r.type === "lead" ? `/crm/leads/${r.id}` : `/crm/opportunities/${r.id}`}>
                  <KanbanCard record={r} />
                </Link>
              ))}
              <button className="w-full flex items-center justify-center gap-1.5 py-2 text-[11px] text-muted-foreground hover:text-foreground hover:bg-white/60 rounded-lg transition-colors border border-dashed border-border/60">
                <Plus size={11} /> Add
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── List view ──────────────────────────────────────────────────────────────
function ListView({ records }: { records: CRMRecord[] }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            {["Name / Company", "Stage", "Location", "Units", "Est. Setup", "MRR", "Rep", "Last Activity", ""].map(h => (
              <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.filter(r => r.stage !== "lost").map((r, i) => (
            <tr
              key={r.id}
              onClick={() => window.location.href = r.type === "lead" ? `/crm/leads/${r.id}` : `/crm/opportunities/${r.id}`}
              className={cn(
                "border-b border-border/60 hover:bg-accent/40 transition-colors cursor-pointer",
                i % 2 === 0 ? "" : "bg-muted/10"
              )}
            >
              <td className="px-4 py-3">
                <p className="font-semibold text-foreground text-sm">{r.name}</p>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  {r.company
                    ? <><Building2 size={10} />{r.company}</>
                    : <><User size={10} />{r.contact}</>
                  }
                </p>
              </td>
              <td className="px-4 py-3">
                <span className={cn("text-[11px] font-semibold px-2.5 py-1 rounded-full", stagePill[r.stage])}>
                  {stageLabel[r.stage]}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                <div className="flex items-center gap-1"><MapPin size={11} />{r.location}</div>
              </td>
              <td className="px-4 py-3 text-sm text-center text-muted-foreground">{r.units ?? "—"}</td>
              <td className="px-4 py-3 text-sm font-medium text-foreground">{fmt(r.estSetup)}</td>
              <td className="px-4 py-3 text-sm font-medium text-brand-400">{r.estMrr ? fmt(r.estMrr)+"/mo" : "—"}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-full bg-brand-400/15 border border-brand-400/20 flex items-center justify-center text-[9px] font-bold text-brand-400 shrink-0">
                    {r.repInitials}
                  </div>
                  <span className="text-xs text-muted-foreground">{r.rep}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                <div className="flex items-center gap-1"><Clock size={11} />{r.lastActivity}</div>
              </td>
              <td className="px-4 py-3">
                <button className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowRight size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function CRMPage() {
  const [view, setView]     = useState<"board" | "list">("board");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "leads" | "opportunities">("all");

  const filtered = mockRecords.filter(r => {
    const matchSearch = !search ||
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.company || "").toLowerCase().includes(search.toLowerCase()) ||
      r.contact.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === "all" ||
      (filter === "leads" && r.type === "lead") ||
      (filter === "opportunities" && r.type === "opportunity");
    return matchSearch && matchFilter;
  });

  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        title="CRM"
        subtitle="Leads, opportunities & pipeline"
        actions={
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-accent transition-colors text-foreground">
              <Plus size={13} /> New Lead
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-400 hover:bg-brand-500 text-white transition-colors gg-glow">
              <Plus size={13} /> New Opportunity
            </button>
          </div>
        }
      />

      <div className="flex-1 p-6">
        <PipelineSummary records={mockRecords} />

        {/* Toolbar */}
        <div className="flex items-center gap-3 mb-4">
          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search leads & opportunities…"
              className="w-full pl-8 pr-3 py-2 text-sm bg-card border border-border rounded-lg focus:border-brand-400/60 focus:outline-none transition-colors"
            />
          </div>

          {/* Filter tabs */}
          <div className="flex items-center bg-muted/60 rounded-lg p-0.5 border border-border">
            {(["all", "leads", "opportunities"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-all capitalize",
                  filter === f
                    ? "bg-white text-foreground shadow-sm border border-border"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          {/* View toggle */}
          <div className="flex items-center bg-muted/60 rounded-lg p-0.5 border border-border">
            <button
              onClick={() => setView("board")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                view === "board"
                  ? "bg-white text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid size={13} /> Board
            </button>
            <button
              onClick={() => setView("list")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                view === "list"
                  ? "bg-white text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <List size={13} /> List
            </button>
          </div>

          <button className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-border hover:bg-accent transition-colors text-muted-foreground">
            <SlidersHorizontal size={13} /> Filter
          </button>
        </div>

        {/* View */}
        {view === "board"
          ? <BoardView records={filtered} />
          : <ListView records={filtered} />
        }
      </div>
    </div>
  );
}
