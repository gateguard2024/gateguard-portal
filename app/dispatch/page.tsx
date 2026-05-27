"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import {
  RefreshCw, Plus, Zap, Users, Navigation, CheckCircle2,
  MapPin, Clock, Wrench, Camera, DoorOpen, Radio, X, ChevronDown, AlertTriangle,
  Calendar, ChevronLeft, ChevronRight, Phone, FileText, ExternalLink,
} from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { List, Search, Route } = require("lucide-react") as any;
import { SkeletonRow }  from '@/components/ui/SkeletonRow'
import { TopBar }       from '@/components/layout/TopBar'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Copy, LayoutList, LayoutGrid, Flame } = require('lucide-react') as any;
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";

// ─── Types ────────────────────────────────────────────────────────────────────

type Priority   = "urgent" | "normal" | "scheduled";
type JobType    = "Install" | "Repair" | "PM" | "Site Walk";
type JobStatus  = "Pending" | "Assigned" | "En Route" | "On Site" | "In Progress" | "Done";
type TechStatus = "Available" | "On Site" | "Driving" | "Offline";

interface Job {
  id:              string;
  property:        string;
  jobType:         JobType;
  assignedTech:    string | null;
  assignedTechId:  string | null;
  eta:             string;
  priority:        Priority;
  status:          JobStatus;
  woNumber:        string;
  title:           string;
  notes:           string | null;
  site_id:         string | null;
}

interface SiteOption {
  id:       string;
  name:     string;
  address:  string;
  city:     string;
  state:    string;
}

type TechSchedule =
  | { type: 'recurring'; days: number[]; start_hour: number; end_hour: number }
  | { type: 'dates'; dates: string[] }

interface Tech {
  id:                    string;
  name:                  string;
  initials:              string;
  role:                  string;
  status:                TechStatus;
  currentJobId:          string | null;
  phone?:                string;
  email?:                string;
  employment_type?:      'employee' | 'contractor';
  can_access_portal?:    boolean;
  portal_invite_sent_at?: string | null;
  schedule?:             TechSchedule | null;
  tech_code?:            string | null;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const COLUMNS: { status: JobStatus; label: string; accent: string; bg: string }[] = [
  { status: "Pending",     label: "Pending",     accent: "border-slate-300",  bg: "bg-slate-50"   },
  { status: "Assigned",    label: "Assigned",    accent: "border-blue-300",   bg: "bg-blue-50"    },
  { status: "En Route",    label: "En Route",    accent: "border-sky-300",    bg: "bg-sky-50"     },
  { status: "On Site",     label: "On Site",     accent: "border-cyan-300",   bg: "bg-cyan-50"    },
  { status: "In Progress", label: "In Progress", accent: "border-amber-300",  bg: "bg-amber-50"   },
  { status: "Done",        label: "Done",        accent: "border-emerald-300", bg: "bg-emerald-50" },
];

const jobTypeConfig: Record<JobType, { label: string; color: string }> = {
  Install:     { label: "Install",   color: "bg-blue-100 text-blue-700"   },
  Repair:      { label: "Repair",    color: "bg-rose-100 text-rose-700"   },
  PM:          { label: "PM",        color: "bg-violet-100 text-violet-700" },
  "Site Walk": { label: "Site Walk", color: "bg-teal-100 text-teal-700"   },
};

const jobTypeIcon: Record<JobType, React.ReactNode> = {
  Install:     <DoorOpen size={12} />,
  Repair:      <Wrench   size={12} />,
  PM:          <Radio    size={12} />,
  "Site Walk": <Camera   size={12} />,
};

const priorityDot: Record<Priority, string> = {
  urgent:    "bg-red-500",
  normal:    "bg-amber-400",
  scheduled: "bg-emerald-500",
};

const techStatusConfig: Record<TechStatus, { label: string; badge: string; dot: string }> = {
  Available: { label: "Available", badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  "On Site": { label: "On Site",   badge: "bg-blue-100 text-blue-700",       dot: "bg-blue-500"   },
  Driving:   { label: "Driving",   badge: "bg-amber-100 text-amber-700",     dot: "bg-amber-500"  },
  Offline:   { label: "Offline",   badge: "bg-slate-100 text-slate-500",     dot: "bg-slate-400"  },
};

const JOB_TYPES: JobType[] = ["Install", "Repair", "PM", "Site Walk"];

// ─── Site Picker ─────────────────────────────────────────────────────────────

function SitePicker({ value, onChange }: { value: { id: string; name: string } | null; onChange: (s: SiteOption | null) => void }) {
  const [query,   setQuery]   = useState("");
  const [results, setResults] = useState<SiteOption[]>([]);
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/sites?q=${encodeURIComponent(query)}&limit=8`);
        const json = await res.json();
        const sites = (json.sites ?? json ?? []) as Array<{ id: string; name: string; address?: string; city?: string; state?: string }>;
        setResults(sites.map(s => ({
          id:      s.id,
          name:    s.name,
          address: s.address ?? "",
          city:    s.city    ?? "",
          state:   s.state   ?? "",
        })));
      } catch { setResults([]); }
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const selectSite = (s: SiteOption) => {
    onChange(s);
    setQuery("");
    setOpen(false);
  };

  const clear = () => { onChange(null); setQuery(""); };

  return (
    <div ref={ref} className="relative">
      {value ? (
        <div className="flex items-center justify-between border border-emerald-300 bg-emerald-50 rounded-xl px-3 py-2.5">
          <div>
            <p className="text-sm font-semibold text-slate-800">{value.name}</p>
          </div>
          <button type="button" onClick={clear} className="p-0.5 rounded hover:bg-emerald-100 text-slate-400 hover:text-slate-600">
            <X size={13} />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder="Search properties…"
            className="w-full border border-slate-200 rounded-xl pl-8 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>
      )}
      {open && !value && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-56 overflow-y-auto">
          {loading && <div className="text-xs text-slate-400 px-3 py-2">Searching…</div>}
          {!loading && query.trim() && results.length === 0 && (
            <div className="text-xs text-slate-400 px-3 py-2">No properties found. Type a name to search.</div>
          )}
          {results.map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => selectSite(s)}
              className="w-full text-left px-3 py-2.5 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0"
            >
              <p className="text-sm font-medium text-slate-800">{s.name}</p>
              {(s.city || s.address) && (
                <p className="text-[11px] text-slate-400">{[s.address, s.city, s.state].filter(Boolean).join(", ")}</p>
              )}
            </button>
          ))}
          {!loading && !query.trim() && (
            <div className="text-xs text-slate-400 px-3 py-3 text-center">Start typing to search properties</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Job Detail Slide-Over ────────────────────────────────────────────────────

const priorityLabel: Record<Priority, string> = {
  urgent:    "🔴 Urgent",
  normal:    "🔵 Normal",
  scheduled: "⚪ Scheduled",
};

function JobDetailSlideOver({ job, techs, onClose, onStatusChange }: {
  job:            Job;
  techs:          Tech[];
  onClose:        () => void;
  onStatusChange: (id: string, status: JobStatus) => void;
}) {
  const tech = techs.find(t => t.id === job.assignedTechId);
  const typeConf = jobTypeConfig[job.jobType] ?? jobTypeConfig.Repair;

  const NEXT_STATUS: Record<JobStatus, JobStatus | null> = {
    Pending:       "Assigned",
    Assigned:      "En Route",
    "En Route":    "On Site",
    "On Site":     "In Progress",
    "In Progress": "Done",
    Done:          null,
  };
  const next = NEXT_STATUS[job.status];

  const statusColors: Record<JobStatus, string> = {
    Pending:       "bg-slate-100 text-slate-600",
    Assigned:      "bg-blue-100 text-blue-700",
    "En Route":    "bg-sky-100 text-sky-700",
    "On Site":     "bg-cyan-100 text-cyan-700",
    "In Progress": "bg-amber-100 text-amber-700",
    Done:          "bg-emerald-100 text-emerald-700",
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-[460px] bg-white border-l border-slate-200 z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <p className="text-[10px] font-mono text-slate-400 mb-0.5">{job.woNumber}</p>
            <h2 className="text-sm font-bold text-slate-900 leading-tight">{job.title || job.property}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors mt-0.5">
            <X size={14} className="text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Status + badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full", statusColors[job.status])}>
              {job.status}
            </span>
            <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full", typeConf.color)}>
              {jobTypeIcon[job.jobType]}{typeConf.label}
            </span>
            <span className="text-[11px] text-slate-500">{priorityLabel[job.priority]}</span>
          </div>

          {/* Property */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-1">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Property</p>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">{job.property}</p>
              {job.site_id && (
                <a
                  href={`/sites/${job.site_id}`}
                  className="inline-flex items-center gap-1 text-[11px] text-[#6B7EFF] hover:underline"
                >
                  <ExternalLink size={11} />
                  View Site
                </a>
              )}
            </div>
          </div>

          {/* Scheduled */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Scheduled</p>
              <div className="flex items-center gap-1.5 text-sm text-slate-700">
                <Clock size={12} className="text-slate-400" />
                {job.eta === "TBD" ? <span className="text-slate-400 italic">TBD</span> : job.eta}
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Job Type</p>
              <p className="text-sm text-slate-700">{job.jobType}</p>
            </div>
          </div>

          {/* Assigned Tech */}
          {tech ? (
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Assigned Technician</p>
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0",
                  tech.status === "Offline" ? "bg-slate-400" : "bg-[#2563EB]"
                )}>
                  {tech.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{tech.name}</p>
                  <p className="text-[11px] text-slate-400">{tech.role}</p>
                </div>
                {tech.phone && (
                  <a href={`tel:${tech.phone}`} className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
                    <Phone size={13} className="text-slate-500" />
                  </a>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
              No technician assigned yet
            </div>
          )}

          {/* Notes */}
          {job.notes && (
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Notes / Access Info</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{job.notes}</p>
            </div>
          )}

          {/* View full WO link */}
          <a
            href={`/maintenance/${job.id}`}
            className="flex items-center gap-2 text-sm text-[#6B7EFF] hover:underline font-medium"
          >
            <FileText size={14} />
            Open Full Work Order
          </a>
        </div>

        {/* Footer — status advance */}
        <div className="border-t border-slate-100 p-4 flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
            Close
          </button>
          {next && (
            <button
              onClick={() => { onStatusChange(job.id, next); onClose(); }}
              className="flex-1 py-2.5 rounded-xl bg-[#2563EB] text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              → Move to {next}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ─── New Job Slide-Over ───────────────────────────────────────────────────────

interface NewJobProps {
  open:    boolean;
  onClose: () => void;
  onSaved: (job: Job) => void;
  techs:   Tech[];
}

function NewJobSlideOver({ open, onClose, onSaved, techs }: NewJobProps) {
  const [selectedSite, setSelectedSite] = useState<SiteOption | null>(null);
  const [form, setForm] = useState({
    job_type:       "Repair" as JobType,
    assignee_id:    "",
    assignee_name:  "",
    priority:       "medium",
    scheduled_date: "",
    notes:          "",
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  if (!open) return null;

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleTechChange = (id: string) => {
    const tech = techs.find(t => t.id === id);
    setForm(f => ({ ...f, assignee_id: id, assignee_name: tech?.name ?? "" }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSite) { setError("Please select a property."); return; }
    setSaving(true); setError("");
    try {
      const res  = await fetch("/api/dispatch", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          customer_name: selectedSite.name,
          site_id:       selectedSite.id,
          assignee_id:   form.assignee_id || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");

      const dbWO = json.job;
      const mapPriority = (p: string): Priority => {
        if (p === "urgent" || p === "high") return "urgent";
        if (p === "medium") return "normal";
        return "scheduled";
      };
      onSaved({
        id:             dbWO.id,
        property:       dbWO.customer_name,
        jobType:        dbWO.job_type as JobType,
        assignedTech:   dbWO.assignee_name,
        assignedTechId: dbWO.assignee_id,
        eta:            dbWO.scheduled_date ?? "TBD",
        priority:       mapPriority(dbWO.priority),
        status:         dbWO.assignee_id ? "Assigned" : "Pending",
        woNumber:       dbWO.wo_number,
        title:          dbWO.title,
        notes:          dbWO.notes ?? null,
        site_id:        dbWO.site_id ?? selectedSite.id,
      });
      onClose();
      setSelectedSite(null);
      setForm({ job_type: "Repair", assignee_id: "", assignee_name: "", priority: "medium", scheduled_date: "", notes: "" });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-[420px] bg-white border-l border-slate-200 z-50 flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900">New Job</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <X size={14} className="text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Property *</label>
            <SitePicker value={selectedSite} onChange={setSelectedSite} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Job Type</label>
              <div className="relative">
                <select value={form.job_type} onChange={e => set("job_type", e.target.value)}
                  className="w-full appearance-none border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 pr-8">
                  {JOB_TYPES.map(jt => <option key={jt}>{jt}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Priority</label>
              <div className="relative">
                <select value={form.priority} onChange={e => set("priority", e.target.value)}
                  className="w-full appearance-none border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 pr-8">
                  <option value="urgent">🔴 Urgent</option>
                  <option value="high">🟠 High</option>
                  <option value="medium">🔵 Medium</option>
                  <option value="low">⚪ Low</option>
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Assign Tech</label>
            <div className="relative">
              <select value={form.assignee_id} onChange={e => handleTechChange(e.target.value)}
                className="w-full appearance-none border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 pr-8">
                <option value="">— Unassigned —</option>
                {techs.map(t => <option key={t.id} value={t.id}>{t.name} ({t.role})</option>)}
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Scheduled Date</label>
            <input type="date" value={form.scheduled_date} onChange={e => set("scheduled_date", e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Notes / Access Info</label>
            <textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={3}
              placeholder="Access codes, parking info, gate combos, special instructions…"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none" />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-500 text-xs bg-red-50 rounded-xl px-3 py-2">
              <AlertTriangle size={13} /> {error}
            </div>
          )}
        </form>

        <div className="border-t border-slate-100 p-4 flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit as unknown as React.MouseEventHandler<HTMLButtonElement>}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-[#2563EB] text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50">
            {saving ? "Saving…" : "Create Job"}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Quick Assign Popover ────────────────────────────────────────────────────

function QuickAssignPopover({ techs, onAssign, onClose }: {
  techs:    Tech[];
  onAssign: (techId: string, techName: string) => void;
  onClose:  () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const available = techs.filter(t => t.status !== "Offline");
  const offline   = techs.filter(t => t.status === "Offline");

  return (
    <div ref={ref}
      className="absolute top-full left-0 mt-1 w-52 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden"
    >
      <div className="px-3 py-2 border-b border-slate-100">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Assign Tech</p>
      </div>
      <div className="max-h-48 overflow-y-auto">
        {available.length === 0 && offline.length === 0 && (
          <p className="text-xs text-slate-400 px-3 py-3 italic">No technicians in roster</p>
        )}
        {available.map(t => (
          <button key={t.id} type="button"
            onClick={() => { onAssign(t.id, t.name); onClose(); }}
            className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors flex items-center gap-2"
          >
            <div className="w-6 h-6 rounded-full bg-[#2563EB] text-white flex items-center justify-center text-[9px] font-bold shrink-0">
              {t.initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-800 truncate">{t.name}</p>
              <p className="text-[10px] text-emerald-600">{t.status}</p>
            </div>
          </button>
        ))}
        {offline.length > 0 && available.length > 0 && (
          <div className="px-3 py-1 border-t border-slate-100">
            <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Offline</p>
          </div>
        )}
        {offline.map(t => (
          <button key={t.id} type="button"
            onClick={() => { onAssign(t.id, t.name); onClose(); }}
            className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors flex items-center gap-2 opacity-60"
          >
            <div className="w-6 h-6 rounded-full bg-slate-400 text-white flex items-center justify-center text-[9px] font-bold shrink-0">
              {t.initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-700 truncate">{t.name}</p>
              <p className="text-[10px] text-slate-400">Offline</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Job Card ─────────────────────────────────────────────────────────────────

function JobCard({ job, techs, onStatusChange, onSelect, onAssign, isDragging }: {
  job:            Job;
  techs:          Tech[];
  onStatusChange: (id: string, status: string) => void;
  onSelect:       (job: Job) => void;
  onAssign:       (jobId: string, techId: string, techName: string) => void;
  isDragging?:    boolean;
}) {
  const [showAssign, setShowAssign] = useState(false);
  const typeConf = jobTypeConfig[job.jobType] ?? jobTypeConfig.Repair;
  const assignedTechObj = techs.find(t => t.id === job.assignedTechId);

  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: job.id });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    opacity: isDragging ? 0.4 : 1,
  } : undefined;

  // Computed days-until label
  const daysLabel = (() => {
    if (!job.eta || job.eta === "TBD") return null;
    const match = job.eta.match(/(\d{4}-\d{2}-\d{2})/);
    if (!match) return null;
    const diff = Math.round((new Date(match[1]).getTime() - Date.now()) / 86400000);
    if (diff < 0)  return { text: `${Math.abs(diff)}d overdue`, cls: "text-red-500" };
    if (diff === 0) return { text: "Today", cls: "text-emerald-600 font-semibold" };
    if (diff === 1) return { text: "Tomorrow", cls: "text-amber-600 font-semibold" };
    return { text: `in ${diff}d`, cls: "text-slate-400" };
  })();

  const isUrgentUnassigned = job.priority === "urgent" && !job.assignedTechId;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-white rounded-xl border-l-4 shadow-sm p-3.5 space-y-2.5 cursor-grab active:cursor-grabbing",
        "hover:shadow-md transition-all select-none relative",
        job.priority === "urgent"    ? "border-l-red-500"
        : job.priority === "normal" ? "border-l-amber-400"
        : "border-l-emerald-400",
        isDragging && "opacity-30 shadow-lg scale-[1.02]"
      )}
      {...attributes}
      {...listeners}
    >
      {/* Urgent + unassigned pulse ring */}
      {isUrgentUnassigned && (
        <span className="absolute -top-1 -right-1 w-3 h-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
        </span>
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-mono text-slate-400">{job.woNumber}</p>
          <p className="text-sm font-semibold text-slate-800 leading-tight truncate">{job.property}</p>
          {job.title && job.title !== job.property && (
            <p className="text-[11px] text-slate-500 truncate">{job.title}</p>
          )}
        </div>
        <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0", typeConf.color)}>
          {jobTypeIcon[job.jobType]}
          {typeConf.label}
        </span>
      </div>

      {/* Tech row */}
      <div className="flex items-center gap-2">
        {assignedTechObj ? (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-[#2563EB] text-white flex items-center justify-center text-[9px] font-bold shrink-0">
              {assignedTechObj.initials}
            </div>
            <span className="text-xs text-slate-700 font-medium">{assignedTechObj.name}</span>
          </div>
        ) : (
          <div className="relative">
            <button
              type="button"
              onPointerDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); setShowAssign(v => !v); }}
              className="inline-flex items-center gap-1 text-[11px] text-[#6B7EFF] hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg px-2 py-1 transition-colors font-medium"
            >
              <Users size={10} />
              Assign Tech
            </button>
            {showAssign && (
              <QuickAssignPopover
                techs={techs}
                onAssign={(techId, techName) => {
                  onAssign(job.id, techId, techName);
                  setShowAssign(false);
                }}
                onClose={() => setShowAssign(false)}
              />
            )}
          </div>
        )}
      </div>

      {/* Date + priority */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Clock size={10} />
          {daysLabel ? (
            <span className={daysLabel.cls}>{daysLabel.text}</span>
          ) : (
            <span className="italic">No date</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn("w-2 h-2 rounded-full", priorityDot[job.priority])} title={job.priority} />
          <span className="text-[10px] text-slate-400 capitalize">{job.priority}</span>
        </div>
      </div>

      {job.notes && (
        <p className="text-[11px] text-slate-400 truncate">{job.notes}</p>
      )}

      {/* View / advance buttons */}
      <div className="flex gap-1.5">
        <button
          type="button"
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onSelect(job); }}
          className="flex-1 text-[11px] font-medium text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg py-1.5 transition-colors"
        >
          Details
        </button>
        {job.status !== "Done" && (
          <button
            type="button"
            onPointerDown={e => e.stopPropagation()}
            onClick={e => {
              e.stopPropagation();
              const NEXT: Record<JobStatus, JobStatus | null> = {
                Pending: "Assigned", Assigned: "En Route", "En Route": "On Site", "On Site": "In Progress", "In Progress": "Done", Done: null,
              };
              const next = NEXT[job.status];
              if (next) onStatusChange(job.id, next);
            }}
            className="flex-1 text-[11px] font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg py-1.5 transition-colors"
          >
            → Advance
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Droppable Column ─────────────────────────────────────────────────────────

function DroppableColumn({ status, label, accent, bg, children, count }: {
  status:   JobStatus;
  label:    string;
  accent:   string;
  bg:       string;
  children: React.ReactNode;
  count:    number;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: status });
  return (
    <div ref={setNodeRef} className={cn("space-y-2 rounded-xl transition-colors", isOver && "ring-2 ring-[#6B7EFF]/40 ring-offset-1")}>
      <div className={cn(
        "flex items-center justify-between px-3 py-2 rounded-lg border",
        bg, accent
      )}>
        <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">{label}</span>
        <span className="text-xs font-bold text-slate-500 bg-white/70 rounded-full px-2 py-0.5 border border-slate-200">{count}</span>
      </div>
      <div className="space-y-2 min-h-[60px]">
        {children}
      </div>
    </div>
  );
}

// ─── Tech Row ─────────────────────────────────────────────────────────────────

// ─── Schedule helpers ─────────────────────────────────────────────────────────

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Compute Available/Offline from schedule — never overrides On Site / Driving */
function computeScheduleStatus(tech: Tech, now: Date): TechStatus {
  if (tech.status === 'On Site' || tech.status === 'Driving') return tech.status;
  if (!tech.schedule) return tech.status;

  if (tech.schedule.type === 'recurring') {
    const day  = now.getDay();
    const hour = now.getHours() + now.getMinutes() / 60;
    const working = tech.schedule.days.includes(day)
      && hour >= tech.schedule.start_hour
      && hour <  tech.schedule.end_hour;
    return working ? 'Available' : 'Offline';
  }

  if (tech.schedule.type === 'dates') {
    const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    return tech.schedule.dates.includes(today) ? 'Available' : 'Offline';
  }

  return tech.status;
}

function fmt12(h: number) {
  const ampm = h < 12 ? 'am' : 'pm';
  const h12  = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}${ampm}`;
}

// ─── Schedule Editor Modal ────────────────────────────────────────────────────

function ScheduleEditorModal({ tech, onClose, onSave }: {
  tech:    Tech;
  onClose: () => void;
  onSave:  (schedule: TechSchedule | null) => void;
}) {
  const isContractor = tech.employment_type === 'contractor';

  // Recurring state (employee default)
  const initRecurring = tech.schedule?.type === 'recurring'
    ? tech.schedule
    : { type: 'recurring' as const, days: [1,2,3,4,5], start_hour: 8, end_hour: 17 };
  const [selDays, setSelDays] = useState<number[]>(initRecurring.days);
  const [startH,  setStartH]  = useState(initRecurring.start_hour);
  const [endH,    setEndH]    = useState(initRecurring.end_hour);

  // Dates state (contractor default)
  const initDates = tech.schedule?.type === 'dates' ? tech.schedule.dates : [];
  const [dates,    setDates]    = useState<string[]>(initDates);
  const [dateInput,setDateInput] = useState('');

  const [saving, setSaving] = useState(false);

  function toggleDay(d: number) {
    setSelDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort((a,b)=>a-b));
  }

  function addDate() {
    if (dateInput && !dates.includes(dateInput)) {
      setDates(prev => [...prev, dateInput].sort());
    }
    setDateInput('');
  }

  function removeDate(d: string) { setDates(prev => prev.filter(x => x !== d)); }

  async function handleSave() {
    setSaving(true);
    let schedule: TechSchedule | null;
    if (isContractor) {
      schedule = dates.length > 0 ? { type: 'dates', dates } : null;
    } else {
      schedule = { type: 'recurring', days: selDays, start_hour: startH, end_hour: endH };
    }
    try {
      await fetch(`/api/dispatch/technicians/${tech.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ schedule }),
      });
      onSave(schedule);
    } finally {
      setSaving(false);
      onClose();
    }
  }

  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <h2 className="text-sm font-bold text-slate-800">{tech.name}</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {isContractor ? 'Committed availability days' : 'Weekly work schedule'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100">
            <X size={14} className="text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {!isContractor ? (
            /* ── Employee: recurring weekly ── */
            <>
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Working Days</p>
                <div className="flex gap-1.5 flex-wrap">
                  {DAY_LABELS.map((label, i) => (
                    <button
                      key={i}
                      onClick={() => toggleDay(i)}
                      className={cn(
                        'w-9 h-9 rounded-lg text-[11px] font-semibold transition-colors',
                        selDays.includes(i)
                          ? 'bg-[#2563EB] text-white'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Start</p>
                  <select
                    value={startH}
                    onChange={e => setStartH(Number(e.target.value))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white"
                  >
                    {hours.map(h => <option key={h} value={h}>{fmt12(h)}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">End</p>
                  <select
                    value={endH}
                    onChange={e => setEndH(Number(e.target.value))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white"
                  >
                    {hours.filter(h => h > startH).map(h => <option key={h} value={h}>{fmt12(h)}</option>)}
                  </select>
                </div>
              </div>
              <div className="text-[11px] text-slate-400 bg-slate-50 rounded-lg px-3 py-2">
                Status auto-sets to <span className="font-semibold text-emerald-600">Available</span> {selDays.map(d => DAY_LABELS[d]).join(', ')} {fmt12(startH)}–{fmt12(endH)}, <span className="font-semibold text-slate-500">Offline</span> otherwise
              </div>
            </>
          ) : (
            /* ── Contractor: committed dates ── */
            <>
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Add Committed Dates</p>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={dateInput}
                    onChange={e => setDateInput(e.target.value)}
                    className="flex-1 text-sm border border-slate-200 rounded-lg px-2.5 py-1.5"
                  />
                  <button
                    onClick={addDate}
                    disabled={!dateInput}
                    className="px-3 py-1.5 text-sm bg-[#2563EB] text-white rounded-lg hover:bg-blue-700 disabled:opacity-40"
                  >
                    Add
                  </button>
                </div>
              </div>
              {dates.length > 0 ? (
                <div className="space-y-1">
                  {dates.map(d => (
                    <div key={d} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg">
                      <span className="text-sm text-slate-700">{new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' })}</span>
                      <button onClick={() => removeDate(d)} className="p-0.5 rounded hover:bg-red-50 text-slate-300 hover:text-red-400">
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 italic">No dates committed yet — status stays Offline</p>
              )}
              <div className="text-[11px] text-slate-400 bg-slate-50 rounded-lg px-3 py-2">
                Status auto-sets to <span className="font-semibold text-emerald-600">Available</span> on committed dates, <span className="font-semibold text-slate-500">Offline</span> on all other days
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex-shrink-0 border-t border-slate-100 pt-4 flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-[#2563EB] text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Schedule'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 border border-slate-200 text-slate-600 rounded-lg py-2 text-sm hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tech Streak ──────────────────────────────────────────────────────────────

/** Deterministic streak from tech id (demo until real streak data is wired) */
function techStreak(techId: string): number {
  let h = 0
  for (let i = 0; i < techId.length; i++) h = (h * 31 + techId.charCodeAt(i)) & 0xffffffff
  return Math.abs(h) % 13 // 0-12
}

function TechRow({ tech, jobs, onStatusChange, onInvite, canDelete, onDelete, onEditSchedule, hasLiveGPS, onGenerateCode }: {
  tech:             Tech;
  jobs:             Job[];
  onStatusChange:   (id: string, status: TechStatus) => void;
  onInvite:         (tech: Tech) => void;
  canDelete:        boolean;
  onDelete:         (id: string) => void;
  onEditSchedule:   (tech: Tech) => void;
  hasLiveGPS?:      boolean;
  onGenerateCode?:  (techId: string) => void;
}) {
  const conf = techStatusConfig[tech.status] ?? techStatusConfig['Offline'];
  const currentJob = jobs.find(j => j.id === tech.currentJobId);
  const TECH_STATUSES: TechStatus[] = ["Available", "On Site", "Driving", "Offline"];
  const isContractor = tech.employment_type === 'contractor';
  const hasPortalAccess = tech.can_access_portal;

  // Schedule summary chip
  let scheduleLabel = '';
  if (tech.schedule?.type === 'recurring') {
    const s = tech.schedule;
    scheduleLabel = s.days.map((d: number) => DAY_LABELS[d]).join('/') + ' ' + fmt12(s.start_hour) + '–' + fmt12(s.end_hour);
  } else if (tech.schedule?.type === 'dates') {
    const n = tech.schedule.dates.length;
    scheduleLabel = `${n} day${n !== 1 ? 's' : ''} committed`;
  }

  return (
    <div className="py-3 px-4 hover:bg-slate-50 transition-colors group">
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <div className={cn(
            "w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white",
            tech.status === "Offline" ? "bg-slate-400" : "bg-[#6B7EFF]"
          )}>
            {tech.initials}
          </div>
          {isContractor && (
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-amber-400 border-2 border-white flex items-center justify-center text-[7px] font-bold text-white" title="Contractor">C</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-slate-800 truncate">{tech.name}</p>
            {hasPortalAccess && (
              <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-400" title="Has portal access" />
            )}
            {hasLiveGPS && (
              <span className="relative shrink-0 flex h-2 w-2" title="Live GPS active">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            )}
            {techStreak(tech.id) > 0 && (
              <span className="flex items-center gap-0.5 text-[11px] font-semibold" title={`${techStreak(tech.id)} consecutive on-time jobs`}>
                <span>🔥</span>
                <span style={{ color: '#f97316' }}>{techStreak(tech.id)}</span>
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400">{tech.role}{isContractor ? ' · Contractor' : ''}</p>
          {scheduleLabel && (
            <p className="text-[10px] text-slate-400 truncate">{scheduleLabel}</p>
          )}
          {currentJob && (
            <p className="text-[10px] text-slate-400 truncate">{currentJob.property}</p>
          )}
        </div>
        <div className="text-right shrink-0 space-y-1">
          <div className="flex items-center gap-1 justify-end">
            <select
              value={tech.status}
              onChange={e => onStatusChange(tech.id, e.target.value as TechStatus)}
              className={cn("appearance-none text-[11px] font-medium px-2 py-0.5 rounded-full cursor-pointer border-0 outline-none", conf.badge)}
            >
              {TECH_STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
            <button
              onClick={() => onEditSchedule(tech)}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-blue-50 text-slate-300 hover:text-blue-400"
              title={tech.schedule ? 'Edit schedule' : 'Set schedule'}
            >
              <Calendar size={11} />
            </button>
            {canDelete && (
              <button
                onClick={() => {
                  if (confirm(`Remove ${tech.name} from the roster?`)) onDelete(tech.id);
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-red-50 text-slate-300 hover:text-red-400"
                title="Remove technician"
              >
                <X size={11} />
              </button>
            )}
          </div>
          {!hasPortalAccess && tech.email && (
            <button
              onClick={() => onInvite(tech)}
              className="text-[10px] text-[#6B7EFF] hover:underline w-full text-right"
            >
              Send portal invite →
            </button>
          )}
          {hasPortalAccess && (
            <p className="text-[10px] text-emerald-600 w-full text-right">Portal ✓</p>
          )}
        </div>
      </div>

      {/* /tech access code row */}
      <div className="mt-2 flex items-center gap-2 bg-slate-50 rounded-lg px-2.5 py-1.5 border border-slate-100">
        <span className="text-[9px] font-medium text-slate-400 shrink-0">/tech</span>
        {tech.tech_code ? (
          <>
            <span className="font-mono text-[10px] text-slate-700 flex-1 tracking-widest">{tech.tech_code}</span>
            <button
              onClick={() => { void navigator.clipboard.writeText(tech.tech_code ?? '') }}
              className="p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
              title="Copy code"
            >
              <Copy size={10} />
            </button>
            <button
              onClick={() => onGenerateCode?.(tech.id)}
              className="text-[9px] font-medium text-[#6B7EFF] hover:underline shrink-0"
            >
              Regen
            </button>
          </>
        ) : (
          <>
            <span className="text-[9px] italic text-slate-400 flex-1">No code set</span>
            <button
              onClick={() => onGenerateCode?.(tech.id)}
              className="text-[9px] font-semibold text-[#6B7EFF] hover:underline shrink-0"
            >
              Generate →
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Calendar Helpers ─────────────────────────────────────────────────────────

/** Returns the Monday of the week containing `d`. */
function getMondayOf(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay(); // 0=Sun … 6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Returns an array of 7 Date objects Mon→Sun starting from monday. */
function weekDays(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

/** Format a Date as "YYYY-MM-DD" (local time). */
function toISO(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Extract "YYYY-MM-DD" from a job's eta or scheduled_date string. Returns null if none found. */
function jobDateKey(eta: string): string | null {
  if (!eta || eta === "TBD") return null;
  // ISO date substring e.g. "2025-05-20" or "2025-05-20T09:00"
  const match = eta.match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

const chipColors: Record<JobType, string> = {
  Install:     "bg-blue-100 text-blue-800 border-blue-200",
  Repair:      "bg-rose-100 text-rose-800 border-rose-200",
  PM:          "bg-violet-100 text-violet-800 border-violet-200",
  "Site Walk": "bg-teal-100 text-teal-800 border-teal-200",
};

// ─── Calendar View ────────────────────────────────────────────────────────────

interface CalendarViewProps {
  jobs:  Job[];
  techs: Tech[];
  weekStart: Date;
  onPrev:    () => void;
  onNext:    () => void;
  onToday:   () => void;
}

function CalendarView({ jobs, techs, weekStart, onPrev, onNext, onToday }: CalendarViewProps) {
  const days    = weekDays(weekStart);
  const todayKey = toISO(new Date());

  // jobs with no date OR no assigned tech
  const unscheduled = jobs.filter(j => {
    const dk = jobDateKey(j.eta);
    return !dk || !j.assignedTechId;
  });

  // build lookup: techId → dayKey → Job[]
  const cellMap: Record<string, Record<string, Job[]>> = {};
  for (const tech of techs) cellMap[tech.id] = {};
  for (const job of jobs) {
    const dk = jobDateKey(job.eta);
    if (!dk || !job.assignedTechId) continue;
    if (!cellMap[job.assignedTechId]) cellMap[job.assignedTechId] = {};
    if (!cellMap[job.assignedTechId][dk]) cellMap[job.assignedTechId][dk] = [];
    cellMap[job.assignedTechId][dk].push(job);
  }

  const weekLabel = days[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })
    + " – "
    + days[6].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const TECH_COL_W = "160px";
  const DAY_COL_W  = "1fr";

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Calendar toolbar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <button
            onClick={onPrev}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Previous week"
          >
            <ChevronLeft size={15} className="text-slate-500" />
          </button>
          <span className="text-sm font-semibold text-slate-800 min-w-[200px] text-center">
            {weekLabel}
          </span>
          <button
            onClick={onNext}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Next week"
          >
            <ChevronRight size={15} className="text-slate-500" />
          </button>
        </div>
        <button
          onClick={onToday}
          className="text-xs font-medium text-[#6B7EFF] hover:text-blue-700 border border-[#6B7EFF]/30 rounded-lg px-3 py-1.5 hover:bg-[#6B7EFF]/5 transition-colors"
        >
          This Week
        </button>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <div
          style={{
            display:               "grid",
            gridTemplateColumns:   `${TECH_COL_W} repeat(7, ${DAY_COL_W})`,
            minWidth:              "900px",
          }}
        >
          {/* Header row */}
          {/* empty corner */}
          <div className="border-b border-r border-slate-100 bg-slate-50 px-3 py-2" />
          {days.map((day) => {
            const key     = toISO(day);
            const isToday = key === todayKey;
            return (
              <div
                key={key}
                className={cn(
                  "border-b border-r border-slate-100 px-2 py-2 text-center",
                  isToday ? "bg-[#6B7EFF]" : "bg-slate-50"
                )}
              >
                <p className={cn("text-[10px] font-semibold uppercase tracking-wide",
                  isToday ? "text-white/80" : "text-slate-400")}>
                  {day.toLocaleDateString("en-US", { weekday: "short" })}
                </p>
                <p className={cn("text-sm font-bold",
                  isToday ? "text-white" : "text-slate-700")}>
                  {day.getDate()}
                </p>
              </div>
            );
          })}

          {/* Tech rows */}
          {techs.length === 0 ? (
            <div
              className="col-span-8 text-center text-sm text-slate-400 py-10"
              style={{ gridColumn: "1 / -1" }}
            >
              No technicians in roster
            </div>
          ) : (
            techs.map((tech) => {
              const conf = techStatusConfig[tech.status];
              return [
                // Tech header cell
                <div
                  key={`th-${tech.id}`}
                  className="border-b border-r border-slate-100 bg-white px-3 py-2.5 flex items-center gap-2"
                >
                  <div className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0",
                    tech.status === "Offline" ? "bg-slate-400" : "bg-[#2563EB]"
                  )}>
                    {tech.initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate leading-tight">{tech.name}</p>
                    <span className={cn("inline-block text-[9px] font-medium px-1.5 py-0.5 rounded-full mt-0.5", conf.badge)}>
                      {conf.label}
                    </span>
                  </div>
                </div>,
                // Day cells for this tech
                ...days.map((day) => {
                  const dk       = toISO(day);
                  const isToday  = dk === todayKey;
                  const cellJobs = cellMap[tech.id]?.[dk] ?? [];
                  return (
                    <div
                      key={`td-${tech.id}-${dk}`}
                      className={cn(
                        "border-b border-r border-slate-100 px-1.5 py-1.5 min-h-[72px] align-top",
                        isToday ? "bg-[#6B7EFF]/4" : "bg-white",
                        "hover:bg-slate-50 transition-colors"
                      )}
                    >
                      {cellJobs.map((job) => {
                        const chip = chipColors[job.jobType] ?? chipColors.Repair;
                        const href = job.id ? `/maintenance/${job.id}` : undefined;
                        const Tag  = href ? "a" : "div";
                        return (
                          <Tag
                            key={job.id}
                            href={href}
                            className={cn(
                              "flex items-center gap-1 text-[10px] font-medium px-1.5 py-1 rounded border mb-1 truncate",
                              chip,
                              href ? "cursor-pointer hover:opacity-80" : "cursor-default"
                            )}
                            title={`${job.woNumber} · ${job.property}`}
                          >
                            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", priorityDot[job.priority])} />
                            <span className="truncate">{job.woNumber} {job.property}</span>
                          </Tag>
                        );
                      })}
                    </div>
                  );
                }),
              ];
            })
          )}
        </div>
      </div>

      {/* Unscheduled strip */}
      {unscheduled.length > 0 && (
        <div className="border-t border-slate-100 px-5 py-3 bg-slate-50">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Unscheduled / Unassigned ({unscheduled.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {unscheduled.map((job) => {
              const chip = chipColors[job.jobType] ?? chipColors.Repair;
              const href = job.id ? `/maintenance/${job.id}` : undefined;
              const Tag  = href ? "a" : "div";
              return (
                <Tag
                  key={job.id}
                  href={href}
                  className={cn(
                    "flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border",
                    chip,
                    href ? "cursor-pointer hover:opacity-80" : "cursor-default"
                  )}
                  title={`${job.woNumber} · ${job.property} · ${job.assignedTech ?? "Unassigned"}`}
                >
                  <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", priorityDot[job.priority])} />
                  {job.woNumber} {job.property}
                  {!job.assignedTechId && (
                    <span className="text-slate-400 italic ml-1">· unassigned</span>
                  )}
                </Tag>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

// Normalize raw DB status string → TechStatus union
function mapTechStatus(s: string): TechStatus {
  if (s === 'available') return 'Available';
  if (s === 'on_site')   return 'On Site';
  if (s === 'driving')   return 'Driving';
  return 'Offline';
}

export default function DispatchPage() {
  const { user } = useUser();
  const role = (user?.publicMetadata?.role as string) ?? '';
  const canDeleteTech = ['admin', 'supervisor', 'corporate'].includes(role);

  const [jobs,        setJobs]        = useState<Job[]>([]);
  const [techs,       setTechs]       = useState<Tech[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [newJobOpen,  setNewJobOpen]  = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [viewMode,    setViewMode]    = useState<"board" | "calendar">("board");
  const [boardLayout, setBoardLayout] = useState<"list" | "board">(() => {
    if (typeof window !== 'undefined') return (localStorage.getItem('gg_dispatch_layout') as 'list' | 'board') ?? 'list'
    return 'list'
  });
  const [mobileTab,   setMobileTab]   = useState<"jobs" | "schedule" | "roster">("jobs");
  const [weekStart,   setWeekStart]   = useState<Date>(() => getMondayOf(new Date()));
  const [showAddTech, setShowAddTech]     = useState(false);
  const [newTechForm, setNewTechForm]     = useState({ name: '', role: 'Tech', phone: '', email: '', employment_type: 'employee' });
  const [addTechSaving, setAddTechSaving] = useState(false);
  const [addTechError, setAddTechError]   = useState<string | null>(null);
  const [invitingTech, setInvitingTech]   = useState<Tech | null>(null);
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteMsg, setInviteMsg]         = useState<string | null>(null);
  const [scheduleTech, setScheduleTech]   = useState<Tech | null>(null);
  const [activeJobId,  setActiveJobId]    = useState<string | null>(null);
  const [showMap,      setShowMap]        = useState(true);
  const [fleetLocations, setFleetLocations] = useState<Array<{
    tech_id: string; name: string; initials: string; status: string;
    lat: number; lng: number; event_type: string; work_order_id: string | null;
    wo_title: string | null; updated_at: string;
  }>>([]);
  const [optimizing,      setOptimizing]      = useState(false);
  const [optimizeResults, setOptimizeResults] = useState<Array<{
    wo_id: string; wo_title: string; assigned_tech_id: string;
    assigned_tech_name: string; reason: string; estimated_drive_mins: number;
  }> | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handlePrevWeek  = () => setWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() - 7); return d; });
  const handleNextWeek  = () => setWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() + 7); return d; });
  const handleThisWeek  = () => setWeekStart(getMondayOf(new Date()));

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/dispatch");
      const json = await res.json();
      // Ensure notes + site_id are always present on Job objects
      const jobs = (json.jobs ?? []).map((j: Job & { notes?: string | null; site_id?: string | null }) => ({
        ...j,
        notes:   j.notes   ?? null,
        site_id: j.site_id ?? null,
      }));
      setJobs(jobs);
      // Auto-compute Available/Offline from schedule on page load
      const now = new Date();
      const techs = (json.techs ?? []).map((t: Tech) => ({
        ...t,
        status: computeScheduleStatus(t, now),
      }));
      setTechs(techs);
    } catch {
      // fall through
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Fleet GPS polling (every 30 seconds) ──────────────────────────
  useEffect(() => {
    const poll = async () => {
      try {
        const res  = await fetch('/api/dispatch/fleet');
        const json = await res.json();
        if (json.fleet) setFleetLocations(json.fleet);
      } catch { /* non-fatal */ }
    };
    void poll();
    const interval = setInterval(() => { void poll(); }, 30_000);
    return () => clearInterval(interval);
  }, []);

  // ── Mapbox map init ────────────────────────────────────────────────
  useEffect(() => {
    if (!showMap || !mapContainerRef.current) return;

    // GPS coordinates sourced from live fleet API (fleetLocations state)
    // Falls back to a spread of demo coords when no live GPS exists

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return;

    // Load Mapbox GL JS from CDN
    const loadMapbox = async () => {
      if (!(window as any).mapboxgl) {
        // Load CSS
        const link = document.createElement('link');
        link.rel  = 'stylesheet';
        link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css';
        document.head.appendChild(link);

        // Load JS
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js';
          script.onload = () => resolve();
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      const mapboxgl = (window as any).mapboxgl;
      if (mapRef.current || !mapContainerRef.current) return;

      mapboxgl.accessToken = token;
      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style:     'mapbox://styles/mapbox/dark-v11',
        center:    [-98.5795, 39.8283], // center of USA
        zoom:      3.5,
      });
      mapRef.current = map;

      map.on('load', () => {
        // Add tech markers — use real GPS if available, else demo coords
        const demoFallback: [number, number][] = [
          [-87.6298, 41.8781], [-104.9903, 39.7392], [-118.2437, 34.0522],
          [-73.9857, 40.7484], [-95.3698, 29.7604],
        ];
        techs.forEach((tech, idx) => {
          const gpsEntry = fleetLocations.find(f => f.tech_id === tech.id);
          const coords: [number, number] = gpsEntry
            ? [gpsEntry.lng, gpsEntry.lat]
            : (demoFallback[idx % 5] ?? [-98.5795, 39.8283]);
          const dotColor = tech.status === 'Available' ? '#10b981'
            : tech.status === 'On Site'   ? '#3b82f6'
            : tech.status === 'Driving'   ? '#f59e0b'
            : '#94a3b8';

          const el = document.createElement('div');
          el.style.cssText = `
            width: 32px; height: 32px; border-radius: 50%;
            background: ${dotColor}; border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.4);
            display: flex; align-items: center; justify-content: center;
            font-size: 10px; font-weight: 700; color: white; cursor: pointer;
          `;
          el.textContent = tech.initials;

          const currentJob = jobs.find(j => j.id === tech.currentJobId);
          const popupHtml = `
            <div style="font-family: system-ui; font-size: 12px; padding: 2px;">
              <p style="font-weight: 700; color: #0f172a; margin: 0 0 2px;">${tech.name}</p>
              <p style="color: #64748b; margin: 0 0 2px;">${tech.role}</p>
              <p style="color: ${dotColor}; font-weight: 600; margin: 0;">${tech.status}${currentJob ? ` · ${currentJob.property}` : ''}</p>
            </div>
          `;

          new mapboxgl.Marker({ element: el })
            .setLngLat(coords)
            .setPopup(new mapboxgl.Popup({ offset: 20 }).setHTML(popupHtml))
            .addTo(map);
        });
      });
    };

    void loadMapbox();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMap, techs.length, fleetLocations.length]);

  const handleJobStatusChange = async (id: string, newStatus: JobStatus) => {
    // Map UI status → DB status
    const dbStatus: Record<JobStatus, string> = {
      Pending:       "open",
      Assigned:      "scheduled",
      "En Route":    "in_route",
      "On Site":     "on_site",
      "In Progress": "in_progress",
      Done:          "completed",
    };
    await fetch(`/api/maintenance/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: dbStatus[newStatus] }),
    });
    setJobs(prev => prev.map(j => j.id === id ? { ...j, status: newStatus } : j));
  };

  const handleAssignTech = async (jobId: string, techId: string, techName: string) => {
    // Optimistic update: assign tech + auto-move to Assigned
    setJobs(prev => prev.map(j => j.id === jobId
      ? { ...j, assignedTechId: techId, assignedTech: techName, status: "Assigned" }
      : j
    ));
    await fetch(`/api/maintenance/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignee_id: techId, assignee_name: techName, status: "scheduled" }),
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveJobId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const jobId    = String(active.id);
    const newStatus = over.id as JobStatus;
    const job       = jobs.find(j => j.id === jobId);
    if (!job || job.status === newStatus) return;
    await handleJobStatusChange(jobId, newStatus);
  };

  const handleTechStatusChange = async (id: string, status: TechStatus) => {
    const dbStatus: Record<TechStatus, string> = {
      Available: "available",
      "On Site": "on_site",
      Driving:   "driving",
      Offline:   "offline",
    };
    await fetch(`/api/dispatch/technicians/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: dbStatus[status] }),
    });
    setTechs(prev => prev.map(t => t.id === id ? { ...t, status } : t));
  };

  const handleAddTech = async () => {
    if (!newTechForm.name.trim()) { setAddTechError('Name is required'); return; }
    setAddTechSaving(true); setAddTechError(null);
    try {
      const res = await fetch('/api/dispatch/technicians', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTechForm),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? 'Failed'); }
      const { technician: raw } = await res.json();
      // Normalize raw Supabase row → Tech interface (status is snake_case from DB)
      const technician: Tech = {
        id:                   raw.id,
        name:                 raw.name,
        initials:             raw.initials,
        role:                 raw.role,
        status:               mapTechStatus(raw.status),
        currentJobId:         raw.current_job_id ?? null,
        phone:                raw.phone ?? undefined,
        email:                raw.email ?? undefined,
        employment_type:      raw.employment_type ?? 'employee',
        can_access_portal:    raw.can_access_portal ?? false,
        portal_invite_sent_at: raw.portal_invite_sent_at ?? null,
        tech_code:            raw.tech_code ?? null,
      };
      setTechs(prev => [...prev, technician]);
      setShowAddTech(false);
      setNewTechForm({ name: '', role: 'Tech', phone: '', email: '', employment_type: 'employee' });
    } catch (err: unknown) {
      setAddTechError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setAddTechSaving(false);
    }
  };

  const handleDeleteTech = async (id: string) => {
    try {
      const res = await fetch(`/api/dispatch/technicians/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        alert(e.error ?? 'Failed to remove technician');
        return;
      }
      setTechs(prev => prev.filter(t => t.id !== id));
    } catch {
      alert('Failed to remove technician');
    }
  };

  const handleScheduleSaved = (techId: string, schedule: TechSchedule | null) => {
    const now = new Date();
    setTechs(prev => prev.map(t => {
      if (t.id !== techId) return t;
      const updated = { ...t, schedule };
      return { ...updated, status: computeScheduleStatus(updated, now) };
    }));
  };

  const handleSendInvite = async () => {
    if (!invitingTech) return;
    setInviteSending(true); setInviteMsg(null);
    try {
      const res = await fetch(`/api/dispatch/technicians/${invitingTech.id}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed');
      setInviteMsg(`✓ ${json.message}`);
      // Mark the tech as invited in local state
      setTechs(prev => prev.map(t => t.id === invitingTech.id ? { ...t, can_access_portal: true } : t));
      setTimeout(() => setInvitingTech(null), 2000);
    } catch (err: unknown) {
      setInviteMsg(`✗ ${err instanceof Error ? err.message : 'Failed to send invite'}`);
    } finally {
      setInviteSending(false);
    }
  };

  const handleJobSaved = (job: Job) => {
    setJobs(prev => [job, ...prev]);
  };

  const handleGenerateTechCode = async (techId: string) => {
    const tech = techs.find(t => t.id === techId);
    if (!tech) return;
    // Build code: GG-{INITIALS}-{4 random digits}
    const digits = String(Math.floor(1000 + Math.random() * 9000));
    const code   = `GG-${tech.initials}-${digits}`;
    try {
      await fetch(`/api/dispatch/technicians/${techId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tech_code: code }),
      });
      setTechs(prev => prev.map(t => t.id === techId ? { ...t, tech_code: code } : t));
    } catch {
      // non-fatal — show nothing, user can retry
    }
  };

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  const activeJobs      = jobs.filter(j => j.status !== "Done").length;
  const availableTechs  = techs.filter(t => t.status === "Available").length;
  const inTransit       = techs.filter(t => t.status === "Driving").length;
  const completedToday  = jobs.filter(j => j.status === "Done").length;

  const stats = [
    { label: "Active Jobs",      value: String(activeJobs),                   icon: Zap,          color: "text-[#6B7EFF]",   bg: "bg-[#6B7EFF]/10" },
    { label: "Available Techs",  value: `${availableTechs}/${techs.length}`,   icon: Users,        color: "text-emerald-600", bg: "bg-emerald-50"   },
    { label: "In Transit",       value: String(inTransit),                    icon: Navigation,   color: "text-amber-600",   bg: "bg-amber-50"     },
    { label: "Completed Today",  value: String(completedToday),               icon: CheckCircle2, color: "text-violet-600",  bg: "bg-violet-50"    },
  ];

  return (
    <div className="flex flex-col min-h-full bg-[#F8FAFC]">
      <NewJobSlideOver
        open={newJobOpen}
        onClose={() => setNewJobOpen(false)}
        onSaved={handleJobSaved}
        techs={techs}
      />
      {selectedJob && (
        <JobDetailSlideOver
          job={selectedJob}
          techs={techs}
          onClose={() => setSelectedJob(null)}
          onStatusChange={(id, status) => {
            handleJobStatusChange(id, status);
            setSelectedJob(prev => prev ? { ...prev, status } : null);
          }}
        />
      )}

      {/* Portal Invite Modal */}
      {invitingTech && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => !inviteSending && setInvitingTech(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-slate-900">Send Portal Invite</h2>
                <button onClick={() => setInvitingTech(null)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
              </div>
              <p className="text-sm text-slate-600 mb-1">
                Sending invite to <span className="font-semibold">{invitingTech.name}</span>
              </p>
              <p className="text-xs text-slate-400 mb-4">
                They will receive a Clerk sign-up email at <span className="font-mono">{invitingTech.email}</span> and can log into the portal to view and update their assigned work orders.
              </p>
              {inviteMsg && (
                <p className={`text-xs mb-3 font-medium ${inviteMsg.startsWith('✓') ? 'text-emerald-600' : 'text-red-600'}`}>{inviteMsg}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleSendInvite}
                  disabled={inviteSending}
                  className="flex-1 text-sm bg-[#6B7EFF] text-white py-2 rounded-lg font-medium hover:bg-indigo-600 disabled:opacity-50"
                >
                  {inviteSending ? 'Sending…' : 'Send Invite'}
                </button>
                <button
                  onClick={() => setInvitingTech(null)}
                  disabled={inviteSending}
                  className="flex-1 text-sm border border-slate-200 text-slate-600 py-2 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Schedule Editor Modal */}
      {scheduleTech && (
        <ScheduleEditorModal
          tech={scheduleTech}
          onClose={() => setScheduleTech(null)}
          onSave={schedule => {
            handleScheduleSaved(scheduleTech.id, schedule);
            setScheduleTech(null);
          }}
        />
      )}

      {/* Header — matches site TopBar pattern */}
      <TopBar
        title="Dispatcher"
        subtitle={today}
        actions={
          <div className="flex items-center gap-2">
            {/* Board / Calendar toggle */}
            <div className="hidden lg:flex items-center bg-white/10 border border-white/15 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode("board")}
                className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors",
                  viewMode === "board" ? "bg-[#6B7EFF] text-white" : "text-slate-300 hover:text-white")}
              >
                <List size={14} /> Board
              </button>
              <button
                onClick={() => setViewMode("calendar")}
                className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors",
                  viewMode === "calendar" ? "bg-[#6B7EFF] text-white" : "text-slate-300 hover:text-white")}
              >
                <Calendar size={14} /> Calendar
              </button>
            </div>
            {viewMode === "board" && (
              <button
                onClick={() => { setShowMap(v => !v); if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } }}
                className={cn("hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors",
                  showMap ? "bg-[#6B7EFF] text-white border-[#6B7EFF]" : "bg-white/10 text-slate-300 border-white/15 hover:text-white")}
              >
                <MapPin size={14} /> Map
              </button>
            )}
            {viewMode === "board" && (
              <button
                onClick={async () => {
                  setOptimizing(true); setOptimizeResults(null);
                  try { const res = await fetch('/api/dispatch/optimize', { method: 'POST' }); const json = await res.json(); setOptimizeResults(json.suggestions ?? []); }
                  catch { setOptimizeResults([]); } finally { setOptimizing(false); }
                }}
                disabled={optimizing}
                className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-60"
              >
                <Route size={14} /> {optimizing ? "Optimizing…" : "Optimize"}
              </button>
            )}
            <button onClick={fetchData} className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-white/10 text-slate-300 border border-white/15 rounded-lg hover:text-white transition-colors">
              <RefreshCw size={14} className={cn(loading && "animate-spin")} />
            </button>
            <button
              onClick={() => setNewJobOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-[#6B7EFF] rounded-lg hover:bg-[#5a6df0] transition-colors"
            >
              <Plus size={14} /> New Job
            </button>
          </div>
        }
      />

      {/* Mobile tab bar */}
      <div className="lg:hidden flex border-b border-border bg-card">
        {(["jobs","schedule","roster"] as const).map(tab => (
          <button key={tab} onClick={() => setMobileTab(tab)}
            className={cn("flex-1 py-2.5 text-xs font-semibold capitalize transition-colors border-b-2",
              mobileTab === tab ? "border-[#6B7EFF] text-[#6B7EFF]" : "border-transparent text-muted-foreground")}
          >{tab}</button>
        ))}
      </div>

      <div className="p-4 lg:p-6 space-y-4 lg:space-y-6 flex-1">

      {/* Stat Cards */}
      <div className={cn("grid gap-3 lg:gap-4", mobileTab === "jobs" || mobileTab === "schedule" ? "grid-cols-2 lg:grid-cols-4" : "hidden lg:grid lg:grid-cols-4")}>
        {stats.map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-3 lg:p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-muted-foreground">{s.label}</span>
              <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", s.bg)}>
                <s.icon size={14} className={s.color} />
              </div>
            </div>
            <p className="text-xl lg:text-2xl font-bold text-foreground leading-tight">
              {loading ? "—" : s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Optimize Results Panel */}
      {optimizeResults !== null && (
        <div className="bg-white rounded-xl border border-emerald-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-emerald-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Route size={14} className="text-emerald-600" />
              <h2 className="text-sm font-semibold text-slate-800">Route Optimization Suggestions</h2>
              <span className="text-[10px] text-slate-400">{optimizeResults.length} suggestion{optimizeResults.length !== 1 ? "s" : ""}</span>
            </div>
            <button onClick={() => setOptimizeResults(null)} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          </div>
          {optimizeResults.length === 0 ? (
            <div className="px-5 py-6 text-center text-sm text-slate-400">
              All jobs are already optimally assigned. No changes suggested.
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {optimizeResults.map((s, i) => (
                <div key={i} className="px-5 py-3 flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{s.wo_title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{s.reason}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-semibold text-emerald-600">{s.assigned_tech_name}</p>
                    {s.estimated_drive_mins > 0 && (
                      <p className="text-[10px] text-slate-400">~{s.estimated_drive_mins} min drive</p>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      void handleAssignTech(s.wo_id, s.assigned_tech_id, s.assigned_tech_name);
                    }}
                    className="shrink-0 px-3 py-1.5 text-xs font-medium text-white bg-[#2563EB] rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Apply
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Content — Board or Calendar */}
      {viewMode === "calendar" ? (
        loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
            <RefreshCw size={16} className="animate-spin mr-2" /> Loading…
          </div>
        ) : (
          <CalendarView
            jobs={jobs}
            techs={techs}
            weekStart={weekStart}
            onPrev={handlePrevWeek}
            onNext={handleNextWeek}
            onToday={handleThisWeek}
          />
        )
      ) : (
        <div className={cn("flex gap-5 items-start", mobileTab === "roster" && "lg:flex hidden")}>
          {/* Kanban Board + Map column */}
          <div className={cn("min-w-0 flex flex-col gap-5", mobileTab === "jobs" ? "flex-1 lg:flex-[2]" : "hidden lg:flex lg:flex-[2]")}>
          {/* Kanban / List Panel */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {/* Panel header with List/Board toggle */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">Work Orders</h2>
              <div className="flex items-center gap-3">
                <span className="hidden lg:block text-[11px] text-muted-foreground">{jobs.filter(j=>j.status!=='Done').length} active</span>
                <div className="flex items-center bg-muted rounded-lg p-0.5 gap-0.5">
                  <button
                    onClick={() => { setBoardLayout('list'); localStorage.setItem('gg_dispatch_layout','list'); }}
                    className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                      boardLayout === 'list' ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                  >
                    <LayoutList size={12} /> List
                  </button>
                  <button
                    onClick={() => { setBoardLayout('board'); localStorage.setItem('gg_dispatch_layout','board'); }}
                    className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                      boardLayout === 'board' ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                  >
                    <LayoutGrid size={12} /> Board
                  </button>
                </div>
              </div>
            </div>

            {/* Filter pills (mobile: shown here; desktop: shown in panel) */}
            <div className="flex gap-2 px-4 py-2.5 border-b border-border overflow-x-auto">
              {(['All','Pending','Assigned','En Route','On Site','In Progress','Done'] as const).map(f => {
                const count = f === 'All' ? jobs.length : jobs.filter(j => j.status === f).length;
                return (
                  <button key={f} className={cn(
                    "flex-shrink-0 text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-colors whitespace-nowrap",
                    f === 'All' ? "bg-[#6B7EFF] text-white border-[#6B7EFF]" : "bg-card text-muted-foreground border-border hover:border-[#6B7EFF]/40"
                  )}>
                    {f} <span className="opacity-70">({count})</span>
                  </button>
                );
              })}
            </div>

            {loading ? (
              <SkeletonRow rows={5} cols={4} />
            ) : boardLayout === 'list' ? (
              /* ── LIST VIEW ──────────────────────────────────── */
              <div className="divide-y divide-border">
                {jobs.map(job => {
                  const priorityStripe = job.priority === 'urgent' ? 'border-l-red-500' : job.priority === 'normal' ? 'border-l-amber-400' : 'border-l-emerald-400';
                  const statusColors: Record<string,string> = {
                    Pending:      'bg-slate-100 text-slate-600',
                    Assigned:     'bg-blue-50 text-blue-700',
                    'En Route':   'bg-violet-50 text-violet-700',
                    'On Site':    'bg-amber-50 text-amber-700',
                    'In Progress':'bg-orange-50 text-orange-700',
                    Done:         'bg-emerald-50 text-emerald-700',
                  };
                  const assignedTech = techs.find(t => t.id === job.assignedTechId);
                  const isDone = job.status === 'Done';
                  return (
                    <div key={job.id}
                      className={cn("flex items-center gap-3 px-4 py-3 border-l-[3px] hover:bg-muted/50 cursor-pointer transition-colors", priorityStripe, isDone && "opacity-60")}
                      onClick={() => setSelectedJob(job)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-mono text-[10px] text-muted-foreground">{job.woNumber}</span>
                          {job.priority === 'urgent' && <span className="text-[9px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">Urgent</span>}
                        </div>
                        <p className="text-sm font-medium text-foreground truncate">{job.property}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-medium",jobTypeConfig[job.jobType]?.color ?? 'bg-slate-100 text-slate-600')}>{job.jobType}</span>
                          {job.eta && job.eta !== 'TBD' && <span className="text-[10px] text-muted-foreground">{job.eta}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {assignedTech ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-6 h-6 rounded-full bg-[#6B7EFF]/10 text-[#6B7EFF] text-[9px] font-bold flex items-center justify-center">{assignedTech.initials}</div>
                            <span className="hidden lg:block text-xs text-muted-foreground">{assignedTech.name.split(' ')[0]}</span>
                          </div>
                        ) : (
                          <button
                            className="text-[10px] text-[#6B7EFF] font-medium hover:underline"
                            onClick={e => { e.stopPropagation(); }}
                          >Assign</button>
                        )}
                        <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", statusColors[job.status] ?? 'bg-slate-100 text-slate-600')}>{job.status}</span>
                      </div>
                    </div>
                  );
                })}
                {jobs.length === 0 && (
                  <div className="py-12 text-center text-sm text-muted-foreground">No work orders</div>
                )}
              </div>
            ) : (
              /* ── BOARD VIEW (3 columns: Open / Active / Done) ── */
              <div className="p-3 grid grid-cols-3 gap-3">
                {[
                  { label: 'Open',   statuses: ['Pending','Assigned'] as JobStatus[],                    accentColor: '#f59e0b' },
                  { label: 'Active', statuses: ['En Route','On Site','In Progress'] as JobStatus[],       accentColor: '#6B7EFF' },
                  { label: 'Done',   statuses: ['Done'] as JobStatus[],                                   accentColor: '#10b981' },
                ].map(group => {
                  const groupJobs = jobs.filter(j => group.statuses.includes(j.status));
                  return (
                    <div key={group.label}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</span>
                        <span className="text-[10px] font-medium text-muted-foreground bg-muted border border-border rounded-full px-2 py-0.5">{groupJobs.length}</span>
                      </div>
                      <div className="h-0.5 rounded-full mb-3" style={{background: group.accentColor}} />
                      {groupJobs.map(job => {
                        const priorityBorder = job.priority === 'urgent' ? 'border-l-red-500' : job.priority === 'normal' ? 'border-l-amber-400' : 'border-l-emerald-400';
                        const assignedTech = techs.find(t => t.id === job.assignedTechId);
                        return (
                          <div key={job.id}
                            className={cn("bg-card border border-border rounded-lg p-2.5 mb-2 border-l-[3px] cursor-pointer hover:border-[#6B7EFF]/30 transition-colors", priorityBorder)}
                            onClick={() => setSelectedJob(job)}
                          >
                            <p className="font-mono text-[9px] text-muted-foreground mb-1">{job.woNumber}</p>
                            <p className="text-xs font-semibold text-foreground mb-1.5 leading-tight">{job.property}</p>
                            <div className="flex items-center justify-between">
                              {assignedTech ? (
                                <div className="flex items-center gap-1">
                                  <div className="w-4 h-4 rounded-full bg-[#6B7EFF]/10 text-[#6B7EFF] text-[8px] font-bold flex items-center justify-center">{assignedTech.initials}</div>
                                  <span className="text-[9px] text-muted-foreground">{assignedTech.name.split(' ')[0]}</span>
                                </div>
                              ) : <span className="text-[9px] text-muted-foreground">Unassigned</span>}
                              <span className={cn("text-[9px] font-medium px-1.5 py-0.5 rounded",jobTypeConfig[job.jobType]?.color)}>{job.jobType}</span>
                            </div>
                          </div>
                        );
                      })}
                      {groupJobs.length === 0 && (
                        <div className="border-2 border-dashed border-border rounded-lg py-6 text-center text-[10px] text-muted-foreground/50">Empty</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>{/* end board/list panel */}


          {/* Mapbox Map Panel */}
          {showMap && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-[#6B7EFF]" />
                  <h2 className="text-sm font-semibold text-slate-800">Tech Locations</h2>
                </div>
                {!process.env.NEXT_PUBLIC_MAPBOX_TOKEN && (
                  <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 font-medium">
                    Add NEXT_PUBLIC_MAPBOX_TOKEN to enable
                  </span>
                )}
              </div>
              <div ref={mapContainerRef} className="h-72 bg-slate-900" />
              <div className="px-4 py-2 border-t border-slate-100 flex items-center gap-3">
                {(["Available", "On Site", "Driving", "Offline"] as const).map(s => (
                  <div key={s} className="flex items-center gap-1.5">
                    <span className={cn("w-2.5 h-2.5 rounded-full", {
                      "bg-emerald-500": s === "Available",
                      "bg-blue-500":    s === "On Site",
                      "bg-amber-400":   s === "Driving",
                      "bg-slate-400":   s === "Offline",
                    })} />
                    <span className="text-[10px] text-slate-500">{s}</span>
                  </div>
                ))}
                <span className="ml-auto text-[10px] text-slate-400 italic">
                  {fleetLocations.length > 0 ? "Live GPS — techs check in via the field tool" : "Demo coords — techs check in via the field tool"}
                </span>
              </div>
            </div>
          )}
          </div>{/* end flex-[2] flex-col */}

          {/* Tech Roster — mobile: full screen on Roster tab; desktop: right sidebar */}
          <div className={cn("min-w-0 bg-card border border-border rounded-xl overflow-hidden", mobileTab === "roster" ? "flex-1 lg:flex-[1]" : "hidden lg:block lg:flex-[1]")}>
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Tech Roster</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {loading ? "…" : `${techs.length} technician${techs.length !== 1 ? 's' : ''}`}
                </p>
              </div>
              <button
                onClick={() => { setShowAddTech(true); setAddTechError(null); }}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#6B7EFF] text-white hover:bg-[#5a6df0] transition-colors"
                title="Add technician"
              >
                <Plus size={14} />
              </button>
            </div>

            {/* Leaderboard — this week */}
            {!loading && techs.length > 0 && (
              <div>
                <div className="px-4 py-2 bg-muted/50 border-b border-border">
                  <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">This week's leaderboard</p>
                </div>
                {[...techs]
                  .sort((a, b) => techStreak(b.id) - techStreak(a.id))
                  .slice(0, 3)
                  .map((tech, i) => {
                    const rankColors = ['text-amber-500', 'text-slate-400', 'text-amber-700'];
                    const jobCount   = (techStreak(tech.id) * 1.4 + 3) | 0;
                    return (
                      <div key={tech.id} className={cn("flex items-center gap-2.5 px-4 py-2.5 border-b border-border/50", i === 0 && "bg-amber-50/40 dark:bg-amber-950/10")}>
                        <span className={cn("text-sm font-bold w-4 text-center", rankColors[i])}>{i + 1}</span>
                        <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0", tech.status === 'Offline' ? 'bg-slate-400' : 'bg-[#6B7EFF]')}>
                          {tech.initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">{tech.name}</p>
                          <p className="text-[10px] text-muted-foreground">{tech.role}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-[#6B7EFF]">{jobCount}</p>
                          <p className="text-[9px] text-muted-foreground">jobs</p>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <Flame size={11} className="text-orange-400" />
                          <span className="text-[10px] font-semibold text-orange-400">{techStreak(tech.id)}d</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* Add tech form */}
            {showAddTech && (
              <div className="px-4 py-3 border-b border-border bg-muted/30">
                <p className="text-xs font-semibold text-foreground mb-2">Add to roster</p>
                <div className="space-y-2">
                  <input
                    className="w-full text-sm border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#6B7EFF] bg-card"
                    placeholder="Full name *"
                    value={newTechForm.name}
                    onChange={e => setNewTechForm(f => ({ ...f, name: e.target.value }))}
                  />
                  <select
                    className="w-full text-sm border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#6B7EFF] bg-card"
                    value={newTechForm.role}
                    onChange={e => setNewTechForm(f => ({ ...f, role: e.target.value }))}
                  >
                    <option value="Owner">Owner</option>
                    <option value="Operations Manager">Operations Manager</option>
                    <option value="Lead Tech">Lead Tech</option>
                    <option value="Tech">Tech</option>
                    <option value="Apprentice">Apprentice</option>
                  </select>
                  <input
                    className="w-full text-sm border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#6B7EFF] bg-card"
                    placeholder="Phone"
                    value={newTechForm.phone}
                    onChange={e => setNewTechForm(f => ({ ...f, phone: e.target.value }))}
                  />
                  <input
                    className="w-full text-sm border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#6B7EFF] bg-card"
                    placeholder="Email (for portal invite)"
                    value={newTechForm.email}
                    onChange={e => setNewTechForm(f => ({ ...f, email: e.target.value }))}
                  />
                  <select
                    className="w-full text-sm border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#6B7EFF] bg-card"
                    value={newTechForm.employment_type}
                    onChange={e => setNewTechForm(f => ({ ...f, employment_type: e.target.value }))}
                  >
                    <option value="employee">Employee</option>
                    <option value="contractor">Contractor</option>
                  </select>
                  {addTechError && <p className="text-xs text-red-500">{addTechError}</p>}
                  <div className="flex gap-2">
                    <button onClick={handleAddTech} disabled={addTechSaving}
                      className="flex-1 text-xs bg-[#6B7EFF] text-white py-1.5 rounded-lg font-medium hover:bg-[#5a6df0] disabled:opacity-50">
                      {addTechSaving ? 'Adding…' : 'Add to Roster'}
                    </button>
                    <button onClick={() => { setShowAddTech(false); setNewTechForm({ name: '', role: 'Tech', phone: '', email: '', employment_type: 'employee' }); }}
                      className="flex-1 text-xs border border-border text-muted-foreground py-1.5 rounded-lg hover:bg-muted">
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="px-3 py-1.5 bg-muted/50 border-b border-border">
              <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">Access codes · /tech login</p>
            </div>

            <div className="divide-y divide-border">
              {loading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                  <RefreshCw size={14} className="animate-spin mr-1.5" /> Loading…
                </div>
              ) : techs.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-8">
                  <p>No technicians yet</p>
                  <button onClick={() => setShowAddTech(true)} className="text-xs text-[#6B7EFF] hover:underline mt-1">Add your first tech →</button>
                </div>
              ) : (
                techs.map(tech => (
                  <TechRow
                    key={tech.id}
                    tech={tech}
                    jobs={jobs}
                    onStatusChange={handleTechStatusChange}
                    onInvite={tech => { setInvitingTech(tech); setInviteMsg(null); }}
                    canDelete={canDeleteTech}
                    onDelete={handleDeleteTech}
                    onEditSchedule={t => setScheduleTech(t)}
                    hasLiveGPS={fleetLocations.some(f => f.tech_id === tech.id && new Date(f.updated_at).getTime() > Date.now() - 15 * 60 * 1000)}
                    onGenerateCode={handleGenerateTechCode}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}

      </div>{/* end p-4/p-6 wrapper */}
    </div>
  );
}
