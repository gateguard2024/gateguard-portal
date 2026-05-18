"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { TopBar } from "@/components/layout/TopBar";
import {
  ChevronLeft, MapPin, Building2, Phone, Mail,
  Hash, Calendar, Clock, CheckCircle2, Plus,
  FileText,
  MoreHorizontal, TrendingUp, X, ChevronDown, Trash2,
} from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Circle, AlertCircle, Paperclip, Edit2, PhoneCall, Video, StickyNote, CheckSquare } = require('lucide-react') as any;
// Save not in lucide-react 0.383.0 — use a fallback icon
const SaveIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
  </svg>
);
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Lead {
  id: string;
  name: string;
  contact: string;
  title: string;
  email: string;
  phone: string;
  company: string;
  propertyType: string;
  units: number | null;
  location: string;
  address: string;
  stage: string;
  source: string;
  rep: string;
  repInitials: string;
  lockDaysLeft: number | null;
  lockExpires: string | null;
  estSetup: number | null;
  estMrr: number | null;
  notes: string;
  createdAt: string;
  lastActivity: string;
}

interface ActivityEntry {
  id: string;
  type: "call" | "email" | "meeting" | "note" | "task";
  subject: string;
  body?: string;
  created_by_name?: string;
  created_at: string;
  completed_at?: string | null;
  due_at?: string | null;
  outcome?: string | null;
}

// ── Static config ──────────────────────────────────────────────────────────────
const STAGES = [
  { value: "new",         label: "New Lead"     },
  { value: "contacted",   label: "Contacted"    },
  { value: "qualifying",  label: "Qualifying"   },
  { value: "site_walk",   label: "Site Walk"    },
  { value: "proposal",    label: "Proposal"     },
  { value: "negotiation", label: "Negotiation"  },
  { value: "won",         label: "Won"          },
  { value: "lost",        label: "Lost"         },
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

// ── Fallback lead ──────────────────────────────────────────────────────────────
const EMPTY_LEAD: Lead = {
  id: "", name: "", contact: "", title: "Property Manager",
  email: "", phone: "", company: "", propertyType: "Multifamily",
  units: null, location: "", address: "", stage: "new", source: "Web",
  rep: "Russel Feldman", repInitials: "RF",
  lockDaysLeft: null, lockExpires: null,
  estSetup: null, estMrr: null,
  notes: "", createdAt: "", lastActivity: "",
};

// ── Dealer Lock Badge ──────────────────────────────────────────────────────────
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
        <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[11px] opacity-80">Expires {expires}</p>
    </div>
  );
}

// ── Edit Lead Modal ────────────────────────────────────────────────────────────
function EditLeadModal({ lead, open, onClose, onSaved }: {
  lead: Lead; open: boolean; onClose: () => void; onSaved: (l: Partial<Lead>) => void;
}) {
  const [form, setForm] = useState({
    stage:    lead.stage    ?? "new",
    estSetup: lead.estSetup ? String(lead.estSetup) : "",
    estMrr:   lead.estMrr   ? String(lead.estMrr)   : "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      stage:    lead.stage    ?? "new",
      estSetup: lead.estSetup ? String(lead.estSetup) : "",
      estMrr:   lead.estMrr   ? String(lead.estMrr)   : "",
    });
  }, [lead]);

  if (!open) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        stage:    form.stage,
        estSetup: form.estSetup ? parseInt(form.estSetup, 10) : null,
        estMrr:   form.estMrr   ? parseInt(form.estMrr,   10) : null,
      };
      await fetch(`/api/crm/leads/${lead.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      onSaved(payload);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] bg-card border border-border rounded-2xl shadow-2xl z-50">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-bold">Edit Lead</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent"><X size={14} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Stage</label>
            <div className="relative">
              <select value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))}
                className="w-full appearance-none border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 bg-background pr-8">
                {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Est. Setup ($)</label>
              <input type="number" value={form.estSetup} onChange={e => setForm(f => ({ ...f, estSetup: e.target.value }))}
                placeholder="0" className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 bg-background" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Est. MRR ($/mo)</label>
              <input type="number" value={form.estMrr} onChange={e => setForm(f => ({ ...f, estMrr: e.target.value }))}
                placeholder="0" className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 bg-background" />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground bg-slate-50 border border-border rounded-lg px-3 py-2">
            Notes are logged individually via the Activity feed — use the Note button there.
          </p>
        </div>
        <div className="border-t border-border p-4 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-accent transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition-colors disabled:opacity-50 shadow-lg shadow-brand-500/20">
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Activity Feed ──────────────────────────────────────────────────────────────
function ActivityFeed({
  leadId, activities, onActivityAdded, triggerOpen,
}: {
  leadId: string;
  activities: ActivityEntry[];
  onActivityAdded: (a: ActivityEntry) => void;
  triggerOpen?: boolean;
}) {
  const [actType,   setActType]   = useState<ActivityEntry["type"]>("note");
  const [showInput, setShowInput] = useState(false);
  const [subject,   setSubject]   = useState("");
  const [body,      setBody]      = useState("");
  const [dueAt,     setDueAt]     = useState("");
  const [outcome,   setOutcome]   = useState("");
  const [saving,    setSaving]    = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Open the form when parent signals via triggerOpen prop
  useEffect(() => {
    if (triggerOpen) {
      setShowInput(true);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [triggerOpen]);

  const openActivity = (type: ActivityEntry["type"]) => {
    setActType(type);
    setShowInput(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSave = async () => {
    if (!subject.trim()) return;
    setSaving(true);
    try {
      const res  = await fetch(`/api/crm/leads/${leadId}/activities`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: actType,
          subject: subject.trim(),
          body: body.trim() || null,
          due_at: dueAt || null,
          outcome: outcome.trim() || null,
        }),
      });
      const json = await res.json();
      if (res.ok && json.activity) {
        onActivityAdded({
          id:             json.activity.id,
          type:           json.activity.type,
          subject:        json.activity.subject,
          body:           json.activity.body,
          created_by_name: json.activity.created_by_name ?? "Russel Feldman",
          created_at:     json.activity.created_at,
          completed_at:   null,
          due_at:         json.activity.due_at,
        });
        setShowInput(false);
        setSubject(""); setBody(""); setDueAt(""); setOutcome("");
      } else {
        alert(json.error ?? "Failed to save activity — please try again.");
        return;
      }
      setShowInput(false);
      setSubject("");
      setBody("");
      setDueAt("");
      setOutcome("");
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSave();
    if (e.key === "Escape") { setShowInput(false); setSubject(""); setBody(""); setOutcome(""); }
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleString("en-US", {
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });
  };

  return (
    <div>
      {/* Log activity bar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-xs font-medium text-muted-foreground mr-1">Log:</span>
        {(["call","email","meeting","note","task"] as ActivityEntry["type"][]).map(t => {
          const Icon = activityIcon[t];
          return (
            <button key={t}
              onClick={() => openActivity(t)}
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
            ref={inputRef}
            placeholder={
              actType === "call"    ? "Call summary (duration, outcome…)"
              : actType === "email" ? "Email subject or summary"
              : actType === "task"  ? "What needs to happen?"
              : actType === "meeting" ? "Meeting summary"
              : "Add a note…"
            }
            value={subject}
            onChange={e => setSubject(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full text-sm bg-transparent outline-none placeholder:text-muted-foreground mb-2 font-medium"
          />
          <textarea
            placeholder="Additional details (optional)…"
            value={body}
            onChange={e => setBody(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            className="w-full text-sm bg-transparent outline-none placeholder:text-muted-foreground resize-none mb-3"
          />
          {actType === "task" && (
            <div className="mb-3 flex items-center gap-2">
              <label className="text-[11px] text-muted-foreground">Due:</label>
              <input type="date" value={dueAt} onChange={e => setDueAt(e.target.value)}
                className="text-[11px] border border-border rounded-lg px-2 py-1 bg-background" />
            </div>
          )}
          {(actType === "call" || actType === "meeting") && (
            <input
              placeholder="What was the outcome?"
              value={outcome}
              onChange={e => setOutcome(e.target.value)}
              className="w-full text-sm bg-transparent outline-none placeholder:text-muted-foreground mb-3 border-b border-border pb-1"
            />
          )}
          <div className="flex items-center gap-2 justify-end">
            <button onClick={() => { setShowInput(false); setSubject(""); setBody(""); setOutcome(""); }}
              className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded-lg border border-border hover:bg-accent transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} disabled={!subject.trim() || saving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-brand-400 text-white rounded-lg hover:bg-brand-500 transition-colors disabled:opacity-40">
              <SaveIcon size={11} /> {saving ? "Saving…" : `Save ${actType}`}
            </button>
          </div>
        </div>
      )}

      {/* Timeline */}
      {activities.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <StickyNote size={24} className="mx-auto mb-2 opacity-20" />
          <p className="text-sm">No activity yet — log a call, email, or note to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((act, i) => {
            const Icon    = activityIcon[act.type] ?? StickyNote;
            const isTask  = act.type === "task";
            const isDone  = !!act.completed_at;
            return (
              <div key={act.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={cn("w-7 h-7 rounded-lg border flex items-center justify-center shrink-0", activityColor[act.type])}>
                    <Icon size={12} />
                  </div>
                  {i < activities.length - 1 && <div className="w-px flex-1 bg-border/60 mt-1" />}
                </div>
                <div className="flex-1 min-w-0 pb-4">
                  <div className="bg-card border border-border rounded-xl p-3.5 group">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        {isTask && (
                          <div className="shrink-0">
                            {isDone
                              ? <CheckCircle2 size={14} className="text-emerald-500" />
                              : <Circle size={14} className="text-muted-foreground" />}
                          </div>
                        )}
                        <p className={cn("text-sm font-semibold text-foreground", isTask && isDone && "line-through text-muted-foreground")}>
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
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
                      {act.created_by_name && (
                        <div className="flex items-center gap-1">
                          <div className="w-4 h-4 rounded-full bg-brand-400/15 flex items-center justify-center text-[8px] font-bold text-brand-400">
                            {act.created_by_name.split(" ").map((n: string) => n[0]).join("")}
                          </div>
                          {act.created_by_name}
                        </div>
                      )}
                      <span>·</span>
                      <div className="flex items-center gap-1"><Clock size={9} />{formatTime(act.created_at)}</div>
                      {act.due_at && (
                        <>
                          <span>·</span>
                          <div className="flex items-center gap-1 text-amber-600">
                            <Calendar size={9} />Due {new Date(act.due_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
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
      )}
    </div>
  );
}

// ── Convert to Opportunity Modal ───────────────────────────────────────────────
const OPP_TYPES = [
  { value: "master_agent",    label: "Master Agent",             desc: "Regional partner managing multiple dealers" },
  { value: "mso",             label: "MSO — Master System Operator", desc: "Large dealer group, multiple markets" },
  { value: "dealer",          label: "Dealer",                   desc: "Authorized GateGuard dealer" },
  { value: "install_partner", label: "Installation Partner",     desc: "Contractor handling installs" },
  { value: "service_partner", label: "Service Partner",          desc: "Ongoing service & maintenance" },
  { value: "sales_partner",   label: "Sales Partner",            desc: "Commission-based rep / referral" },
  { value: "property",        label: "Property",                 desc: "Multifamily property needing install/service" },
  { value: "company",         label: "Company",                  desc: "Commercial business customer" },
];

function ConvertModal({ lead, open, converting, onClose, onConvert }: {
  lead: Lead; open: boolean; converting: boolean;
  onClose: () => void; onConvert: (type: string) => void;
}) {
  const [selected, setSelected] = useState("dealer");
  useEffect(() => { if (open) setSelected("dealer"); }, [open]);
  if (!open) return null;

  const sel = OPP_TYPES.find(t => t.value === selected);

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] bg-card border border-border rounded-2xl shadow-2xl z-50">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-sm font-bold">Convert to Opportunity</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Select what type of opportunity this lead represents</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent"><X size={14} /></button>
        </div>
        <div className="p-5">
          {/* Lead summary */}
          <div className="flex items-center gap-3 p-3 bg-accent/50 rounded-xl border border-border mb-4">
            <div className="w-8 h-8 rounded-lg bg-brand-400/15 flex items-center justify-center text-xs font-bold text-brand-400">
              {lead.contact?.split(" ").map(n => n[0]).join("") ?? "?"}
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{lead.name}</p>
              <p className="text-[11px] text-muted-foreground">{lead.contact}{lead.email ? ` · ${lead.email}` : ""}</p>
            </div>
          </div>

          {/* Type grid */}
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Opportunity Type</p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {OPP_TYPES.map(t => (
              <button
                key={t.value}
                onClick={() => setSelected(t.value)}
                className={cn(
                  "text-left p-3 rounded-xl border transition-all",
                  selected === t.value
                    ? "border-brand-400 bg-brand-400/8 ring-1 ring-brand-400/30"
                    : "border-border hover:border-border/60 hover:bg-accent/40"
                )}
              >
                <p className={cn("text-xs font-semibold mb-0.5", selected === t.value ? "text-brand-500" : "text-foreground")}>{t.label}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">{t.desc}</p>
              </button>
            ))}
          </div>

          {sel && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-blue-50 border border-blue-200 mb-4">
              <TrendingUp size={13} className="text-blue-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-700 leading-relaxed">
                This creates a <strong>{sel.label}</strong> opportunity pre-filled with {lead.name}&apos;s contact info and linked back to this lead — so any documents you send stay connected through the full lifecycle.
              </p>
            </div>
          )}
        </div>
        <div className="border-t border-border p-4 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-accent transition-colors">
            Cancel
          </button>
          <button
            onClick={() => onConvert(selected)}
            disabled={converting}
            className="flex-1 py-2.5 rounded-xl bg-brand-400 hover:bg-brand-500 text-white text-sm font-semibold transition-colors disabled:opacity-50 shadow-lg shadow-brand-400/20 flex items-center justify-center gap-2"
          >
            <TrendingUp size={13} />
            {converting ? "Converting…" : "Convert to Opportunity"}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id     = params?.id as string;

  const [lead,       setLead]       = useState<Lead>(EMPTY_LEAD);
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [editOpen,           setEditOpen]           = useState(false);
  const [convertOpen,        setConvertOpen]        = useState(false);
  const [converting,         setConverting]         = useState(false);
  const [marking,            setMarking]            = useState(false);
  const [toast,              setToast]              = useState<{ msg: string; ok: boolean } | null>(null);
  const [triggerLogActivity, setTriggerLogActivity] = useState(false);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/crm/leads/${id}`).then(r => r.json()),
      fetch(`/api/crm/leads/${id}/activities`).then(r => r.json()),
    ]).then(([leadData, actData]) => {
      if (!leadData.error) {
        setLead({ ...EMPTY_LEAD, ...leadData });
      }
      if (actData.activities) {
        setActivities(actData.activities);
      }
    }).catch(console.warn).finally(() => setLoading(false));
  }, [id]);

  const handleLeadSaved = (updates: Partial<Lead>) => {
    setLead(prev => ({ ...prev, ...updates }));
    showToast("Lead updated.");
  };

  const handleActivityAdded = (a: ActivityEntry) => {
    setActivities(prev => [a, ...prev]);
    showToast("Activity logged.");
  };

  const handleMarkLost = async () => {
    if (!confirm("Mark this lead as Lost?")) return;
    setMarking(true);
    try {
      await fetch(`/api/crm/leads/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: "lost" }),
      });
      setLead(prev => ({ ...prev, stage: "lost" }));
      showToast("Lead marked as Lost.");
    } finally {
      setMarking(false);
    }
  };

  const handleConvert = async (oppType: string) => {
    setConverting(true);
    try {
      const res  = await fetch("/api/crm/opportunities", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:               lead.name,
          account_name:       lead.company || lead.name,
          site_contact_name:  lead.contact,
          site_contact_email: lead.email,
          site_contact_phone: lead.phone,
          units:              lead.units,
          // split "City, ST" → property_city / property_state
          property_city:      lead.location?.split(',')?.[0]?.trim() ?? null,
          property_state:     lead.location?.split(',')?.[1]?.trim() ?? null,
          stage:              "meet_present",
          opp_type:           oppType,
          source:             lead.source,
          est_setup:          lead.estSetup,
          est_mrr:            lead.estMrr,
          description:        lead.notes || null,
          lead_id:            lead.id.replace(/^show_/, ''),
        }),
      });
      const json = await res.json();
      if (res.ok && json.id) {
        showToast("Converted! Redirecting to opportunity…");
        setTimeout(() => router.push(`/crm/opportunities/${json.id}`), 1200);
      } else {
        showToast(json.error ?? "Conversion failed.", false);
      }
    } finally {
      setConverting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Permanently delete this lead? This cannot be undone.")) return;
    await fetch(`/api/crm/leads/${id}`, { method: "DELETE" });
    router.push("/crm");
  };

  const handleCreateQuote = () => {
    router.push(`/quotes/new?customer=${encodeURIComponent(lead.name)}`);
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-full">
        <TopBar title="Loading…" subtitle="Lead detail" />
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          Loading lead…
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Toast */}
      {toast && (
        <div className={cn(
          "fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-lg text-sm font-semibold animate-in fade-in slide-in-from-bottom-2",
          toast.ok ? "bg-emerald-600 text-white" : "bg-red-500 text-white"
        )}>
          {toast.msg}
        </div>
      )}

      <EditLeadModal
        lead={lead}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={handleLeadSaved}
      />

      <ConvertModal
        lead={lead}
        open={convertOpen}
        converting={converting}
        onClose={() => setConvertOpen(false)}
        onConvert={async (type) => {
          await handleConvert(type);
          setConvertOpen(false);
        }}
      />

      <TopBar
        title={lead.name || "Lead Detail"}
        subtitle="Lead detail"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-accent transition-colors text-muted-foreground"
            >
              <Edit2 size={12} /> Edit
            </button>
            <button
              onClick={handleMarkLost}
              disabled={marking || lead.stage === "lost"}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-red-200 hover:bg-red-50 transition-colors text-red-500 disabled:opacity-40"
            >
              Mark Lost
            </button>
            <button
              onClick={() => setConvertOpen(true)}
              disabled={converting || lead.stage === "won" || lead.stage === "lost"}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-400 hover:bg-brand-500 text-white transition-colors disabled:opacity-40 gg-glow"
            >
              <TrendingUp size={13} />
              {converting ? "Converting…" : "Convert to Opportunity"}
            </button>
          </div>
        }
      />

      <div className="flex-1 p-6">
        <Link href="/crm" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-5 transition-colors group">
          <ChevronLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
          Back to Pipeline
        </Link>

        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
            <Building2 size={22} className="text-blue-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h2 className="text-xl font-bold text-foreground">{lead.name}</h2>
              <select
                value={lead.stage}
                onChange={async e => {
                  const stage = e.target.value;
                  setLead(prev => ({ ...prev, stage }));
                  await fetch(`/api/crm/leads/${id}`, {
                    method: "PATCH", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ stage }),
                  });
                  showToast(`Stage updated to ${stageLabel[stage] ?? stage}`);
                }}
                className={cn(
                  "appearance-none text-[11px] font-semibold px-2.5 py-1 rounded-full cursor-pointer border-0 outline-none",
                  stagePill[lead.stage] ?? "bg-slate-100 text-slate-600"
                )}
              >
                {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-500">
                {lead.source}
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
              {lead.address && <span className="flex items-center gap-1"><MapPin size={11} />{lead.address}</span>}
              {lead.units   && <span className="flex items-center gap-1"><Hash size={11} />{lead.units} units · {lead.propertyType}</span>}
              {lead.createdAt && <span className="flex items-center gap-1"><Calendar size={11} />Created {lead.createdAt}</span>}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="grid grid-cols-3 gap-5">
          {/* ── Left col ──────────────────────────────────────────────────── */}
          <div className="col-span-2 space-y-5">
            {/* Activity */}
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground">Activity</h3>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">{activities.length} entries</span>
                  <button
                    onClick={() => setTriggerLogActivity(v => !v)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-brand-400 hover:bg-brand-500 text-white rounded-lg transition-colors"
                  >
                    <Plus size={11} />
                    Log Activity
                  </button>
                </div>
              </div>
              <ActivityFeed
                leadId={id}
                activities={activities}
                onActivityAdded={handleActivityAdded}
                triggerOpen={triggerLogActivity}
              />
            </div>
          </div>

          {/* ── Right col ─────────────────────────────────────────────────── */}
          <div className="space-y-4">
            {/* Dealer lock */}
            {lead.lockDaysLeft != null && lead.lockExpires && (
              <LockBadge daysLeft={lead.lockDaysLeft} expires={lead.lockExpires} />
            )}

            {/* Contact */}
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Primary Contact</h3>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-full bg-brand-400/15 border border-brand-400/20 flex items-center justify-center text-sm font-bold text-brand-400">
                  {lead.contact?.split(" ").map(n => n[0]).join("") ?? "?"}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{lead.contact}</p>
                  <p className="text-[11px] text-muted-foreground">{lead.title}</p>
                </div>
              </div>
              <div className="space-y-2">
                {lead.email && (
                  <a href={`mailto:${lead.email}`} className="flex items-center gap-2 text-[12px] text-muted-foreground hover:text-brand-400 transition-colors group">
                    <div className="w-6 h-6 rounded-md bg-accent flex items-center justify-center shrink-0 group-hover:bg-brand-400/10">
                      <Mail size={11} />
                    </div>
                    {lead.email}
                  </a>
                )}
                {lead.phone && (
                  <a href={`tel:${lead.phone}`} className="flex items-center gap-2 text-[12px] text-muted-foreground hover:text-brand-400 transition-colors group">
                    <div className="w-6 h-6 rounded-md bg-accent flex items-center justify-center shrink-0 group-hover:bg-brand-400/10">
                      <Phone size={11} />
                    </div>
                    {lead.phone}
                  </a>
                )}
              </div>
            </div>

            {/* Lead details */}
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Lead Details</h3>
              <div className="space-y-2.5">
                {[
                  { label: "Property Type", value: lead.propertyType },
                  { label: "Units",         value: lead.units ? `${lead.units} units` : "—" },
                  { label: "Location",      value: lead.location || "—" },
                  { label: "Source",        value: lead.source },
                  { label: "Assigned Rep",  value: lead.rep },
                  { label: "Est. Setup",    value: lead.estSetup != null ? `$${lead.estSetup.toLocaleString()}` : "TBD" },
                  { label: "Est. MRR",      value: lead.estMrr   != null ? `$${lead.estMrr.toLocaleString()}/mo` : "TBD" },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-muted-foreground">{label}</span>
                    <span className="text-[12px] font-medium text-foreground text-right">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Quick Actions</h3>
              <div className="space-y-1.5">
                {[
                  { label: "Log a Call",              icon: PhoneCall,  bg: "bg-blue-50",    color: "text-blue-500",    onClick: () => {
                    document.dispatchEvent(new CustomEvent("lead:log", { detail: "call" }));
                  }},
                  { label: "Send Email",              icon: Mail,        bg: "bg-violet-50",  color: "text-violet-500",  onClick: () => lead.email && window.open(`mailto:${lead.email}`) },
                  { label: "Create Quote",            icon: FileText,    bg: "bg-orange-50",  color: "text-orange-500",  onClick: handleCreateQuote },
                  { label: "Convert to Opportunity",  icon: TrendingUp,  bg: "bg-emerald-50", color: "text-emerald-500", onClick: () => setConvertOpen(true),
                    disabled: converting || lead.stage === "won" || lead.stage === "lost" },
                  { label: "Delete Lead",             icon: Trash2,      bg: "bg-red-50",     color: "text-red-500",     onClick: handleDelete },
                ].map(({ label, icon: Icon, bg, color, onClick, disabled }) => (
                  <button
                    key={label}
                    onClick={onClick}
                    disabled={disabled}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg hover:bg-accent transition-colors text-foreground text-left disabled:opacity-40"
                  >
                    <div className={cn("w-6 h-6 rounded-md flex items-center justify-center", bg)}>
                      <Icon size={11} className={color} />
                    </div>
                    {label}
                  </button>
                ))}
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
