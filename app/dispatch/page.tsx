"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  RefreshCw, Plus, Zap, Users, Navigation, CheckCircle2,
  MapPin, Clock, Wrench, Camera, DoorOpen, Radio, X, ChevronDown, AlertTriangle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Priority   = "urgent" | "normal" | "scheduled";
type JobType    = "Install" | "Repair" | "PM" | "Site Walk";
type JobStatus  = "Pending" | "Assigned" | "In Progress" | "Done";
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
}

interface Tech {
  id:           string;
  name:         string;
  initials:     string;
  role:         string;
  status:       TechStatus;
  currentJobId: string | null;
  phone?:       string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const COLUMNS: { status: JobStatus; label: string; accent: string; bg: string }[] = [
  { status: "Pending",     label: "Pending",     accent: "border-slate-300", bg: "bg-slate-50"  },
  { status: "Assigned",    label: "Assigned",    accent: "border-blue-300",  bg: "bg-blue-50"   },
  { status: "In Progress", label: "In Progress", accent: "border-amber-300", bg: "bg-amber-50"  },
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

// ─── New Job Slide-Over ───────────────────────────────────────────────────────

interface NewJobProps {
  open:    boolean;
  onClose: () => void;
  onSaved: (job: Job) => void;
  techs:   Tech[];
}

function NewJobSlideOver({ open, onClose, onSaved, techs }: NewJobProps) {
  const [form, setForm] = useState({
    customer_name: "",
    job_type:      "Repair" as JobType,
    assignee_id:   "",
    assignee_name: "",
    priority:      "medium",
    scheduled_date: "",
    notes:         "",
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
    if (!form.customer_name.trim()) { setError("Property / customer name is required."); return; }
    setSaving(true); setError("");
    try {
      const res  = await fetch("/api/dispatch", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, assignee_id: form.assignee_id || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");

      // Map to Job shape for local state
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
      });
      onClose();
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
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Property / Customer *</label>
            <input
              value={form.customer_name}
              onChange={e => set("customer_name", e.target.value)}
              placeholder="e.g. Stonegate Townhomes"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
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
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Notes</label>
            <textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={3}
              placeholder="Access codes, parking info, special instructions…"
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

// ─── Job Card ─────────────────────────────────────────────────────────────────

function JobCard({ job, onStatusChange }: { job: Job; onStatusChange: (id: string, status: string) => void }) {
  const typeConf = jobTypeConfig[job.jobType] ?? jobTypeConfig.Repair;
  const NEXT_STATUS: Record<JobStatus, JobStatus | null> = {
    Pending:     "Assigned",
    Assigned:    "In Progress",
    "In Progress": "Done",
    Done:        null,
  };
  const next = NEXT_STATUS[job.status];

  return (
    <div className={cn(
      "bg-white rounded-xl border-l-4 shadow-sm p-3.5 space-y-2.5 hover:shadow-md transition-shadow",
      job.priority === "urgent"    ? "border-l-red-500"
      : job.priority === "normal" ? "border-l-amber-400"
      : "border-l-emerald-400"
    )}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-mono text-slate-400">{job.woNumber}</p>
          <p className="text-sm font-semibold text-slate-800 leading-tight">{job.property}</p>
        </div>
        <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0", typeConf.color)}>
          {jobTypeIcon[job.jobType]}
          {typeConf.label}
        </span>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <Users size={11} />
        <span className={cn(job.assignedTech ? "text-slate-600" : "text-slate-400 italic")}>
          {job.assignedTech ?? "Unassigned"}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Clock size={11} />
          <span>{job.eta}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn("w-2 h-2 rounded-full", priorityDot[job.priority])} title={job.priority} />
          <span className="text-[10px] text-slate-400 capitalize">{job.priority}</span>
        </div>
      </div>

      {next && (
        <button
          onClick={() => onStatusChange(job.id, next)}
          className="w-full text-[11px] font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg py-1.5 transition-colors"
        >
          → Move to {next}
        </button>
      )}
    </div>
  );
}

// ─── Tech Row ─────────────────────────────────────────────────────────────────

function TechRow({ tech, jobs, onStatusChange }: { tech: Tech; jobs: Job[]; onStatusChange: (id: string, status: TechStatus) => void }) {
  const conf = techStatusConfig[tech.status];
  const currentJob = jobs.find(j => j.id === tech.currentJobId);
  const TECH_STATUSES: TechStatus[] = ["Available", "On Site", "Driving", "Offline"];

  return (
    <div className="flex items-center gap-3 py-3 px-4 hover:bg-slate-50 transition-colors">
      <div className={cn(
        "w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0",
        tech.status === "Offline" ? "bg-slate-400" : "bg-[#2563EB]"
      )}>
        {tech.initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">{tech.name}</p>
        <p className="text-[11px] text-slate-400">{tech.role}</p>
        {currentJob && (
          <p className="text-[10px] text-slate-400 truncate">{currentJob.property}</p>
        )}
      </div>
      <div className="text-right shrink-0">
        <select
          value={tech.status}
          onChange={e => onStatusChange(tech.id, e.target.value as TechStatus)}
          className={cn("appearance-none text-[11px] font-medium px-2 py-0.5 rounded-full cursor-pointer border-0 outline-none", conf.badge)}
        >
          {TECH_STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DispatchPage() {
  const [jobs,      setJobs]      = useState<Job[]>([]);
  const [techs,     setTechs]     = useState<Tech[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [newJobOpen, setNewJobOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/dispatch");
      const json = await res.json();
      setJobs(json.jobs  ?? []);
      setTechs(json.techs ?? []);
    } catch {
      // fall through
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleJobStatusChange = async (id: string, newStatus: JobStatus) => {
    // Map UI status → DB status
    const dbStatus: Record<JobStatus, string> = {
      Pending:     "open",
      Assigned:    "scheduled",
      "In Progress": "in_progress",
      Done:        "completed",
    };
    await fetch(`/api/maintenance/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: dbStatus[newStatus] }),
    });
    setJobs(prev => prev.map(j => j.id === id ? { ...j, status: newStatus } : j));
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

  const handleJobSaved = (job: Job) => {
    setJobs(prev => [job, ...prev]);
  };

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  const activeJobs      = jobs.filter(j => j.status !== "Done").length;
  const availableTechs  = techs.filter(t => t.status === "Available").length;
  const inTransit       = techs.filter(t => t.status === "Driving").length;
  const completedToday  = jobs.filter(j => j.status === "Done").length;

  const stats = [
    { label: "Active Jobs",      value: String(activeJobs),                   icon: Zap,          color: "text-blue-600",   bg: "bg-blue-50"   },
    { label: "Available Techs",  value: `${availableTechs}/${techs.length}`,   icon: Users,        color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "In Transit",       value: String(inTransit),                    icon: Navigation,   color: "text-amber-600",  bg: "bg-amber-50"  },
    { label: "Completed Today",  value: String(completedToday),               icon: CheckCircle2, color: "text-violet-600", bg: "bg-violet-50" },
  ];

  return (
    <div className="min-h-screen bg-[#f0f2f5] p-6 space-y-6">
      <NewJobSlideOver
        open={newJobOpen}
        onClose={() => setNewJobOpen(false)}
        onSaved={handleJobSaved}
        techs={techs}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dispatcher</h1>
          <p className="text-sm text-slate-500 mt-0.5">{today}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
          >
            <RefreshCw size={15} className={cn(loading && "animate-spin")} />
            Refresh
          </button>
          <button
            onClick={() => setNewJobOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#2563EB] rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus size={15} />
            New Job
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-slate-500 font-medium">{s.label}</span>
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", s.bg)}>
                <s.icon size={16} className={s.color} />
              </div>
            </div>
            <p className={cn("text-3xl font-bold", s.color)}>
              {loading ? "—" : s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Main Board */}
      <div className="flex gap-5 items-start">
        {/* Kanban Board */}
        <div className="flex-[2] min-w-0">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
              <RefreshCw size={16} className="animate-spin mr-2" /> Loading jobs…
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              {COLUMNS.map((col) => {
                const colJobs = jobs.filter(j => j.status === col.status);
                return (
                  <div key={col.status} className="space-y-2">
                    <div className={cn(
                      "flex items-center justify-between px-3 py-2 rounded-lg border",
                      col.bg, col.accent
                    )}>
                      <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                        {col.label}
                      </span>
                      <span className="text-xs font-bold text-slate-500 bg-white/70 rounded-full px-2 py-0.5 border border-slate-200">
                        {colJobs.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {colJobs.map(job => (
                        <JobCard
                          key={job.id}
                          job={job}
                          onStatusChange={(id, s) => handleJobStatusChange(id, s as JobStatus)}
                        />
                      ))}
                      {colJobs.length === 0 && (
                        <div className="text-center text-[11px] text-slate-400 py-4">No jobs</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Tech Roster */}
        <div className="flex-[1] min-w-0 bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3.5 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-800">Tech Roster</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {loading ? "…" : `${techs.length} technicians`}
            </p>
          </div>
          <div className="divide-y divide-slate-50">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-slate-400 text-sm">
                <RefreshCw size={14} className="animate-spin mr-1.5" /> Loading…
              </div>
            ) : techs.length === 0 ? (
              <div className="text-center text-sm text-slate-400 py-8">No technicians</div>
            ) : (
              techs.map(tech => (
                <TechRow
                  key={tech.id}
                  tech={tech}
                  jobs={jobs}
                  onStatusChange={handleTechStatusChange}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Map View */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <MapPin size={15} className="text-[#2563EB]" />
          <h2 className="text-sm font-semibold text-slate-800">Map View</h2>
        </div>
        <div className="h-48 bg-slate-100 flex flex-col items-center justify-center gap-2">
          <MapPin size={24} className="text-slate-300" />
          <p className="text-sm text-slate-400 font-medium">
            Live dispatch map — Mapbox integration coming soon
          </p>
        </div>
      </div>
    </div>
  );
}
