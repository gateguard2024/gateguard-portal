"use client";

import { useState } from "react";
import Link from "next/link";
import { TopBar } from "@/components/layout/TopBar";
import {
  ChevronLeft, MapPin, Building2, User, Phone, Mail,
  Hash, Calendar, Clock, CheckCircle2, Circle, Plus,
  AlertCircle, ArrowRight, FileText, Paperclip, Edit2,
  MessageSquare, PhoneCall, Video, StickyNote, CheckSquare,
  MoreHorizontal, Flame, TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Mock lead data ─────────────────────────────────────────────────────────
const LEAD = {
  id: "2",
  name: "Park View HOA",
  contact: "Sandra Kim",
  title: "Property Manager",
  email: "sandra.kim@parkviewhoa.com",
  phone: "(404) 555-0142",
  company: "",
  propertyType: "HOA",
  units: 120,
  location: "Marietta, GA",
  address: "240 Park View Blvd, Marietta, GA 30060",
  stage: "contacted" as const,
  source: "Web",
  rep: "Russel Feldman",
  repInitials: "RF",
  lockDaysLeft: 74,
  lockExpires: "July 9, 2026",
  estSetup: undefined as number | undefined,
  estMrr: undefined as number | undefined,
  notes: "Interested in full access control package. HOA board meeting scheduled for May 15 — Sandra will present GateGuard to board before any commitment. Competing with LiftMaster dealer locally.",
  createdAt: "April 20, 2026",
  lastActivity: "Yesterday",
};

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
    id: "a1", type: "call", subject: "Intro call — 18 min",
    body: "Sandra confirmed they've had break-in incidents at two gates. Looking for camera + access control combo. Will loop in HOA board president before moving forward.",
    author: "Russel Feldman", authorInitials: "RF", timestamp: "Yesterday, 2:14 PM",
  },
  {
    id: "a2", type: "email", subject: "Sent capability deck",
    body: "Emailed GateGuard capabilities overview and case study for similar HOA (Ashford Glen, 312 units).",
    author: "Russel Feldman", authorInitials: "RF", timestamp: "Yesterday, 2:45 PM",
  },
  {
    id: "a3", type: "task", subject: "Follow up after board meeting",
    body: "Board meeting is May 15. Follow up May 16 to get reaction.",
    author: "Russel Feldman", authorInitials: "RF", timestamp: "Yesterday, 3:00 PM",
    completed: false, dueAt: "May 16, 2026",
  },
  {
    id: "a4", type: "note", subject: "Competitor intel",
    body: "LiftMaster dealer is quoting them but only offers gate control — no cameras, no cloud dashboard. We have a clear differentiator story here.",
    author: "Russel Feldman", authorInitials: "RF", timestamp: "April 20, 2026",
  },
];

const stagePill: Record<string, string> = {
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

const stageLabel: Record<string, string> = {
  new: "New Lead", contacted: "Contacted", qualifying: "Qualifying",
  inquiry: "Opportunity", site_walk: "Site Walk", proposal: "Proposal",
  negotiation: "Negotiation", won: "Won", lost: "Lost",
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

// ── Dealer lock countdown ──────────────────────────────────────────────────
function LockBadge({ daysLeft, expires }: { daysLeft: number; expires: string }) {
  const color =
    daysLeft > 30 ? "border-emerald-200 bg-emerald-50 text-emerald-700" :
    daysLeft > 14 ? "border-amber-200 bg-amber-50 text-amber-700" :
                    "border-red-200 bg-red-50 text-red-700";
  const iconColor =
    daysLeft > 30 ? "text-emerald-500" :
    daysLeft > 14 ? "text-amber-500" : "text-red-500";

  const pct = Math.min(100, Math.round((daysLeft / 90) * 100));
  const barColor =
    daysLeft > 30 ? "bg-emerald-400" :
    daysLeft > 14 ? "bg-amber-400" : "bg-red-400";

  return (
    <div className={cn("rounded-xl border p-4", color)}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <AlertCircle size={14} className={iconColor} />
          <span className="text-xs font-semibold">Dealer Lock</span>
        </div>
        <span className="text-xs font-bold">{daysLeft}d remaining</span>
      </div>
      <div className="w-full h-1.5 rounded-full bg-black/10 mb-2">
        <div
          className={cn("h-full rounded-full transition-all", barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[11px] opacity-80">Expires {expires}</p>
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
      {/* Log activity bar */}
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
            <button
              className="px-3 py-1.5 text-xs font-medium bg-brand-400 text-white rounded-lg hover:bg-brand-500 transition-colors"
            >
              Save {actType}
            </button>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="space-y-3">
        {activities.map((act, i) => {
          const Icon = activityIcon[act.type];
          const isTask = act.type === "task";
          return (
            <div key={act.id} className="flex gap-3">
              {/* Timeline line */}
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
                    <p className="text-[12px] text-muted-foreground leading-relaxed mb-2">
                      {act.body}
                    </p>
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
export default function LeadDetailPage() {
  const lead = LEAD;

  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        title={lead.name}
        subtitle="Lead detail"
        actions={
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-accent transition-colors text-muted-foreground">
              <Edit2 size={12} /> Edit
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-red-200 hover:bg-red-50 transition-colors text-red-500">
              Mark Lost
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-400 hover:bg-brand-500 text-white transition-colors gg-glow">
              <TrendingUp size={13} /> Convert to Opportunity
            </button>
          </div>
        }
      />

      <div className="flex-1 p-6">
        {/* Back breadcrumb */}
        <Link
          href="/crm"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-5 transition-colors group"
        >
          <ChevronLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
          Back to Pipeline
        </Link>

        {/* Page header */}
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
            <Building2 size={22} className="text-blue-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h2 className="text-xl font-bold text-foreground">{lead.name}</h2>
              <span className={cn("text-[11px] font-semibold px-2.5 py-1 rounded-full", stagePill[lead.stage])}>
                {stageLabel[lead.stage]}
              </span>
              <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-500">
                {lead.source}
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1"><MapPin size={11} />{lead.address}</span>
              <span className="flex items-center gap-1"><Hash size={11} />{lead.units} units · {lead.propertyType}</span>
              <span className="flex items-center gap-1"><Calendar size={11} />Created {lead.createdAt}</span>
            </div>
          </div>
        </div>

        {/* Body: left col + right col */}
        <div className="grid grid-cols-3 gap-5">

          {/* ── Left col: Activity feed (2/3 width) ───────────────────── */}
          <div className="col-span-2 space-y-5">

            {/* Notes */}
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">Notes</h3>
                <button className="text-[11px] text-brand-400 hover:text-brand-500 font-medium flex items-center gap-1 transition-colors">
                  <Edit2 size={11} /> Edit
                </button>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{lead.notes}</p>
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

          {/* ── Right col: Details sidebar (1/3 width) ───────────────── */}
          <div className="space-y-4">

            {/* Dealer lock */}
            <LockBadge daysLeft={lead.lockDaysLeft} expires={lead.lockExpires} />

            {/* Contact card */}
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Primary Contact</h3>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-full bg-brand-400/15 border border-brand-400/20 flex items-center justify-center text-sm font-bold text-brand-400">
                  {lead.contact.split(" ").map(n => n[0]).join("")}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{lead.contact}</p>
                  <p className="text-[11px] text-muted-foreground">{lead.title}</p>
                </div>
              </div>
              <div className="space-y-2">
                <a href={`mailto:${lead.email}`} className="flex items-center gap-2 text-[12px] text-muted-foreground hover:text-brand-400 transition-colors group">
                  <div className="w-6 h-6 rounded-md bg-accent flex items-center justify-center shrink-0 group-hover:bg-brand-400/10">
                    <Mail size={11} />
                  </div>
                  {lead.email}
                </a>
                <a href={`tel:${lead.phone}`} className="flex items-center gap-2 text-[12px] text-muted-foreground hover:text-brand-400 transition-colors group">
                  <div className="w-6 h-6 rounded-md bg-accent flex items-center justify-center shrink-0 group-hover:bg-brand-400/10">
                    <Phone size={11} />
                  </div>
                  {lead.phone}
                </a>
              </div>
            </div>

            {/* Lead details */}
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Lead Details</h3>
              <div className="space-y-2.5">
                {[
                  { label: "Property Type", value: lead.propertyType },
                  { label: "Units",         value: `${lead.units} units` },
                  { label: "Location",      value: lead.location },
                  { label: "Source",        value: lead.source },
                  { label: "Assigned Rep",  value: lead.rep },
                  { label: "Est. Setup",    value: lead.estSetup ? `$${lead.estSetup.toLocaleString()}` : "TBD" },
                  { label: "Est. MRR",      value: lead.estMrr ? `$${lead.estMrr.toLocaleString()}/mo` : "TBD" },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-muted-foreground">{label}</span>
                    <span className="text-[12px] font-medium text-foreground text-right">{value}</span>
                  </div>
                ))}
              </div>
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
                  Create Quote
                </button>
                <button className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg hover:bg-accent transition-colors text-foreground text-left">
                  <div className="w-6 h-6 rounded-md bg-emerald-50 flex items-center justify-center">
                    <TrendingUp size={11} className="text-emerald-500" />
                  </div>
                  Convert to Opportunity
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
              <div className="text-center py-4">
                <Paperclip size={20} className="text-border mx-auto mb-2" />
                <p className="text-[11px] text-muted-foreground">No attachments yet</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
