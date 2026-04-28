"use client";

import { useState } from "react";
import Link from "next/link";
import { TopBar } from "@/components/layout/TopBar";
import {
  ChevronLeft, MapPin, Building2, Hash, Calendar,
  Clock, CheckCircle2, Circle, Plus, AlertCircle,
  FileText, Paperclip, Edit2, Mail, Phone,
  PhoneCall, Video, StickyNote, CheckSquare,
  MoreHorizontal, TrendingUp, ChevronRight,
  DollarSign, Target,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Mock opportunity ───────────────────────────────────────────────────────
const OPP = {
  id: "6",
  name: "Ashford Glen",
  company: "Pegasus Residential",
  contact: "Maria Reyes",
  title: "VP of Property Management",
  email: "maria.reyes@pegasusresidential.com",
  phone: "(404) 555-0199",
  propertyType: "HOA",
  units: 312,
  location: "Dunwoody, GA",
  address: "1100 Ashford Glen Dr, Dunwoody, GA 30338",
  stage: "proposal" as const,
  estSetup: 31000,
  estMrr: 3120,
  rep: "J. Torres",
  repInitials: "JT",
  closeDate: "June 15, 2026",
  leadSource: "Referral — Pegasus (Stonegate Townhomes)",
  quoteNumber: "GG-2026-007",
  notes: "Pegasus portfolio property — Maria manages 4 sites. Won Stonegate (95u) last month, now pitching full campus. Board approved security upgrade budget of $35K. Currently evaluating two other vendors. We are the only full-stack solution (cameras + access).",
  createdAt: "April 15, 2026",
  lastActivity: "4h ago",
};

const PIPELINE_STAGES = [
  { key: "inquiry",     label: "Inquiry" },
  { key: "site_walk",   label: "Site Walk" },
  { key: "proposal",    label: "Proposal" },
  { key: "negotiation", label: "Negotiation" },
  { key: "won",         label: "Won" },
];

type ActivityEntry = {
  id: string;
  type: "call" | "email" | "meeting" | "note" | "task";
  subject: string;
  body?: string;
  author: string;
  authorInitials: string;
  timestamp: string;
  completed?: boolean;
  dueAt?: string;
};

const ACTIVITIES: ActivityEntry[] = [
  {
    id: "b1", type: "meeting", subject: "On-site walkthrough completed",
    body: "Toured all three gate entry points and the pedestrian access corridor. HOA manager wants cameras at north + south entry plus all mailbox clusters. Two LiftMaster gates will need adapters.",
    author: "J. Torres", authorInitials: "JT", timestamp: "April 22, 2026, 3:30 PM",
  },
  {
    id: "b2", type: "note", subject: "Quote GG-2026-007 sent",
    body: "Sent formal proposal: 4 gates, 8 cameras (LPR at entries), cloud dashboard, 24-mo contract. Total setup $31K, MRR $3,120.",
    author: "J. Torres", authorInitials: "JT", timestamp: "April 24, 2026",
  },
  {
    id: "b3", type: "task", subject: "Follow up on proposal decision",
    body: "Maria said board meeting on May 12. Follow up May 13.",
    author: "J. Torres", authorInitials: "JT", timestamp: "April 24, 2026",
    completed: false, dueAt: "May 13, 2026",
  },
  {
    id: "b4", type: "email", subject: "Answered pricing questions",
    body: "Maria asked about reducing gate count to 3 to hit $28K target. Provided revised scenario — still within budget if LPR dropped on north entry.",
    author: "J. Torres", authorInitials: "JT", timestamp: "April 26, 2026",
  },
];

const stageOrder = ["inquiry", "site_walk", "proposal", "negotiation", "won"];

const stagePillColors: Record<string, string> = {
  inquiry:     "bg-violet-100 text-violet-700",
  site_walk:   "bg-amber-100 text-amber-700",
  proposal:    "bg-orange-100 text-orange-700",
  negotiation: "bg-rose-100 text-rose-700",
  won:         "bg-emerald-100 text-emerald-700",
  lost:        "bg-red-100 text-red-600",
};

const activityIcon: Record<ActivityEntry["type"], React.ElementType> = {
  call:    PhoneCall,
  email:   Mail,
  meeting: Video,
  note:    StickyNote,
  task:    CheckSquare,
};

const activityColor: Record<ActivityEntry["type"], string> = {
  call:    "bg-blue-50 text-blue-600 border-blue-200",
  email:   "bg-violet-50 text-violet-600 border-violet-200",
  meeting: "bg-amber-50 text-amber-600 border-amber-200",
  note:    "bg-slate-50 text-slate-500 border-slate-200",
  task:    "bg-emerald-50 text-emerald-600 border-emerald-200",
};

// ── Stage progress bar ─────────────────────────────────────────────────────
function StageBar({ current }: { current: string }) {
  const currentIdx = stageOrder.indexOf(current);
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Pipeline Stage</h3>
      <div className="flex items-center gap-0">
        {PIPELINE_STAGES.map((s, i) => {
          const idx = stageOrder.indexOf(s.key);
          const isActive = s.key === current;
          const isDone   = idx < currentIdx;
          const isLast   = i === PIPELINE_STAGES.length - 1;
          return (
            <div key={s.key} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center flex-1">
                <div className={cn(
                  "w-6 h-6 rounded-full border-2 flex items-center justify-center mb-1 transition-colors",
                  isActive ? "border-brand-400 bg-brand-400" :
                  isDone   ? "border-emerald-400 bg-emerald-400" :
                             "border-border bg-white"
                )}>
                  {isDone
                    ? <CheckCircle2 size={12} className="text-white" />
                    : isActive
                    ? <div className="w-2 h-2 rounded-full bg-white" />
                    : <div className="w-2 h-2 rounded-full bg-border" />
                  }
                </div>
                <span className={cn(
                  "text-[9px] font-medium text-center leading-tight",
                  isActive ? "text-brand-400" : isDone ? "text-emerald-600" : "text-muted-foreground"
                )}>
                  {s.label}
                </span>
              </div>
              {!isLast && (
                <div className={cn(
                  "h-0.5 flex-1 mx-1 mb-4 rounded-full",
                  idx < currentIdx ? "bg-emerald-300" : "bg-border"
                )} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Activity feed ──────────────────────────────────────────────────────────
function ActivityFeed({ activities }: { activities: ActivityEntry[] }) {
  const [newNote, setNewNote]     = useState("");
  const [showInput, setShowInput] = useState(false);
  const [actType, setActType]     = useState<ActivityEntry["type"]>("note");

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs font-medium text-muted-foreground mr-1">Log:</span>
        {(["call","email","meeting","note","task"] as ActivityEntry["type"][]).map(t => {
          const Icon = activityIcon[t];
          return (
            <button
              key={t}
              onClick={() => { setActType(t); setShowInput(true); }}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border transition-all capitalize",
                actType === t && showInput
                  ? activityColor[t]
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              <Icon size={11} /> {t}
            </button>
          );
        })}
      </div>

      {showInput && (
        <div className="mb-5 bg-card border border-border rounded-xl p-4">
          <input
            autoFocus
            placeholder={`Add ${actType} details…`}
            value={newNote}
            onChange={e => setNewNote(e.target.value)}
            className="w-full text-sm bg-transparent outline-none placeholder:text-muted-foreground mb-3"
          />
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={() => { setShowInput(false); setNewNote(""); }}
              className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded-lg border border-border hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button className="px-3 py-1.5 text-xs font-medium bg-brand-400 text-white rounded-lg hover:bg-brand-500 transition-colors">
              Save {actType}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {activities.map((act, i) => {
          const Icon = activityIcon[act.type];
          const isTask = act.type === "task";
          return (
            <div key={act.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className={cn(
                  "w-7 h-7 rounded-lg border flex items-center justify-center shrink-0",
                  activityColor[act.type]
                )}>
                  <Icon size={12} />
                </div>
                {i < activities.length - 1 && (
                  <div className="w-px flex-1 bg-border/60 mt-1" />
                )}
              </div>
              <div className="flex-1 min-w-0 pb-4">
                <div className="bg-card border border-border rounded-xl p-3.5 group">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      {isTask && (
                        <button className="shrink-0">
                          {act.completed
                            ? <CheckCircle2 size={14} className="text-emerald-500" />
                            : <Circle size={14} className="text-muted-foreground" />
                          }
                        </button>
                      )}
                      <p className={cn(
                        "text-sm font-semibold text-foreground",
                        isTask && act.completed && "line-through text-muted-foreground"
                      )}>
                        {act.subject}
                      </p>
                    </div>
                    <button className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-muted-foreground hover:text-foreground">
                      <MoreHorizontal size={13} />
                    </button>
                  </div>
                  {act.body && (
                    <p className="text-[12px] text-muted-foreground leading-relaxed mb-2">{act.body}</p>
                  )}
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <div className="w-4 h-4 rounded-full bg-brand-400/15 flex items-center justify-center text-[8px] font-bold text-brand-400">
                        {act.authorInitials}
                      </div>
                      {act.author}
                    </div>
                    <span>·</span>
                    <div className="flex items-center gap-1"><Clock size={9} />{act.timestamp}</div>
                    {act.dueAt && (
                      <>
                        <span>·</span>
                        <div className="flex items-center gap-1 text-amber-600">
                          <Calendar size={9} />Due {act.dueAt}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function OpportunityDetailPage() {
  const opp = OPP;

  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        title={opp.name}
        subtitle="Opportunity detail"
        actions={
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-accent transition-colors text-muted-foreground">
              <Edit2 size={12} /> Edit
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-red-200 hover:bg-red-50 transition-colors text-red-500">
              Mark Lost
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white transition-colors">
              <CheckCircle2 size={13} /> Mark Won
            </button>
          </div>
        }
      />

      <div className="flex-1 p-6">
        <Link
          href="/crm"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-5 transition-colors group"
        >
          <ChevronLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
          Back to Pipeline
        </Link>

        {/* Page header */}
        <div className="flex items-start gap-4 mb-5">
          <div className="w-12 h-12 rounded-xl bg-violet-50 border border-violet-200 flex items-center justify-center shrink-0">
            <Target size={22} className="text-violet-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h2 className="text-xl font-bold text-foreground">{opp.name}</h2>
              <span className={cn("text-[11px] font-semibold px-2.5 py-1 rounded-full", stagePillColors[opp.stage])}>
                {opp.stage.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}
              </span>
              {opp.company && (
                <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 flex items-center gap-1">
                  <Building2 size={10} />{opp.company}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1"><MapPin size={11} />{opp.address}</span>
              <span className="flex items-center gap-1"><Hash size={11} />{opp.units} units · {opp.propertyType}</span>
              <span className="flex items-center gap-1"><Calendar size={11} />Target close {opp.closeDate}</span>
            </div>
          </div>

          {/* Value badges */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-center px-4 py-2 bg-slate-50 border border-border rounded-xl">
              <p className="text-[10px] text-muted-foreground mb-0.5">Est. Setup</p>
              <p className="text-base font-bold text-foreground">${opp.estSetup.toLocaleString()}</p>
            </div>
            <div className="text-center px-4 py-2 bg-blue-50 border border-blue-200 rounded-xl">
              <p className="text-[10px] text-muted-foreground mb-0.5">Est. MRR</p>
              <p className="text-base font-bold text-brand-400">${opp.estMrr.toLocaleString()}<span className="text-xs font-normal text-muted-foreground">/mo</span></p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="grid grid-cols-3 gap-5">

          {/* ── Left: Activity ──────────────────────────────────────── */}
          <div className="col-span-2 space-y-5">

            {/* Stage bar */}
            <StageBar current={opp.stage} />

            {/* Notes */}
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">Notes</h3>
                <button className="text-[11px] text-brand-400 hover:text-brand-500 font-medium flex items-center gap-1 transition-colors">
                  <Edit2 size={11} /> Edit
                </button>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{opp.notes}</p>
            </div>

            {/* Activity */}
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground">Activity</h3>
                <span className="text-[11px] text-muted-foreground">{ACTIVITIES.length} entries</span>
              </div>
              <ActivityFeed activities={ACTIVITIES} />
            </div>
          </div>

          {/* ── Right: Details ──────────────────────────────────────── */}
          <div className="space-y-4">

            {/* Contact card */}
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Primary Contact</h3>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-full bg-brand-400/15 border border-brand-400/20 flex items-center justify-center text-sm font-bold text-brand-400">
                  {opp.contact.split(" ").map(n => n[0]).join("")}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{opp.contact}</p>
                  <p className="text-[11px] text-muted-foreground">{opp.title}</p>
                </div>
              </div>
              <div className="space-y-2">
                <a href={`mailto:${opp.email}`} className="flex items-center gap-2 text-[12px] text-muted-foreground hover:text-brand-400 transition-colors group">
                  <div className="w-6 h-6 rounded-md bg-accent flex items-center justify-center shrink-0 group-hover:bg-brand-400/10">
                    <Mail size={11} />
                  </div>
                  {opp.email}
                </a>
                <a href={`tel:${opp.phone}`} className="flex items-center gap-2 text-[12px] text-muted-foreground hover:text-brand-400 transition-colors group">
                  <div className="w-6 h-6 rounded-md bg-accent flex items-center justify-center shrink-0 group-hover:bg-brand-400/10">
                    <Phone size={11} />
                  </div>
                  {opp.phone}
                </a>
              </div>
              {opp.company && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-[11px] text-muted-foreground mb-1">Company</p>
                  <div className="flex items-center gap-2">
                    <Building2 size={12} className="text-muted-foreground" />
                    <span className="text-[12px] font-medium text-foreground">{opp.company}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Opp details */}
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Opportunity Details</h3>
              <div className="space-y-2.5">
                {[
                  { label: "Property Type", value: opp.propertyType },
                  { label: "Units",         value: `${opp.units} units` },
                  { label: "Location",      value: opp.location },
                  { label: "Source",        value: opp.leadSource },
                  { label: "Assigned Rep",  value: opp.rep },
                  { label: "Target Close",  value: opp.closeDate },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-start justify-between gap-2">
                    <span className="text-[11px] text-muted-foreground shrink-0">{label}</span>
                    <span className="text-[12px] font-medium text-foreground text-right">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Linked quote */}
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Linked Quote</h3>
              <Link
                href="/quotes"
                className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-brand-400/40 hover:bg-accent/50 transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center shrink-0">
                  <FileText size={14} className="text-orange-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground">{opp.quoteNumber}</p>
                  <p className="text-[11px] text-muted-foreground">Sent · ${opp.estSetup.toLocaleString()} setup</p>
                </div>
                <ChevronRight size={13} className="text-muted-foreground group-hover:text-brand-400 transition-colors" />
              </Link>
            </div>

            {/* Quick actions */}
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Quick Actions</h3>
              <div className="space-y-1.5">
                <button className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg hover:bg-accent transition-colors text-foreground text-left">
                  <div className="w-6 h-6 rounded-md bg-blue-50 flex items-center justify-center">
                    <PhoneCall size={11} className="text-blue-500" />
                  </div>
                  Log a Call
                </button>
                <button className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg hover:bg-accent transition-colors text-foreground text-left">
                  <div className="w-6 h-6 rounded-md bg-violet-50 flex items-center justify-center">
                    <Mail size={11} className="text-violet-500" />
                  </div>
                  Send Email
                </button>
                <button className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg hover:bg-accent transition-colors text-foreground text-left">
                  <div className="w-6 h-6 rounded-md bg-orange-50 flex items-center justify-center">
                    <FileText size={11} className="text-orange-500" />
                  </div>
                  Revise Quote
                </button>
                <button className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg hover:bg-emerald-50 transition-colors text-emerald-700 text-left border border-dashed border-emerald-200">
                  <div className="w-6 h-6 rounded-md bg-emerald-50 flex items-center justify-center">
                    <CheckCircle2 size={11} className="text-emerald-500" />
                  </div>
                  Mark Won — Create Customer
                </button>
              </div>
            </div>

            {/* Attachments */}
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Attachments</h3>
                <button className="text-[11px] text-brand-400 hover:text-brand-500 font-medium flex items-center gap-1">
                  <Plus size={11} /> Add
                </button>
              </div>
              {/* Mock proposal attachment */}
              <div className="flex items-center gap-3 p-2.5 rounded-lg border border-border hover:bg-accent/50 transition-colors cursor-pointer group">
                <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center shrink-0">
                  <FileText size={13} className="text-orange-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{opp.quoteNumber}_Proposal.pdf</p>
                  <p className="text-[10px] text-muted-foreground">Proposal · 2.4 MB</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
