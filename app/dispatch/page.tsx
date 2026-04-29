"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  RefreshCw,
  Plus,
  Zap,
  Users,
  Navigation,
  CheckCircle2,
  MapPin,
  Clock,
  Wrench,
  Camera,
  DoorOpen,
  Radio,
} from "lucide-react";

// ─── Mock Data ────────────────────────────────────────────────────────────────

type Priority = "urgent" | "normal" | "scheduled";
type JobType = "Install" | "Repair" | "PM" | "Site Walk";
type JobStatus = "Pending" | "Assigned" | "In Progress" | "Done";
type TechStatus = "Available" | "On Site" | "Driving" | "Offline";

interface Job {
  id: string;
  property: string;
  jobType: JobType;
  assignedTech: string | null;
  eta: string;
  priority: Priority;
  status: JobStatus;
}

interface Tech {
  id: string;
  name: string;
  initials: string;
  role: string;
  status: TechStatus;
  currentJob: string | null;
}

const MOCK_JOBS: Job[] = [
  {
    id: "j1",
    property: "Stonegate Townhomes",
    jobType: "Install",
    assignedTech: "Marcus Webb",
    eta: "9:30 AM",
    priority: "urgent",
    status: "Pending",
  },
  {
    id: "j2",
    property: "Ashford Glen",
    jobType: "Repair",
    assignedTech: null,
    eta: "ASAP",
    priority: "urgent",
    status: "Pending",
  },
  {
    id: "j3",
    property: "Peachtree Commons",
    jobType: "PM",
    assignedTech: "Jordan Hill",
    eta: "11:00 AM",
    priority: "normal",
    status: "Assigned",
  },
  {
    id: "j4",
    property: "Lakewood HOA",
    jobType: "Install",
    assignedTech: "Danny Cruz",
    eta: "1:30 PM",
    priority: "normal",
    status: "Assigned",
  },
  {
    id: "j5",
    property: "Riverside Apts",
    jobType: "Install",
    assignedTech: "Marcus Webb",
    eta: "On Site",
    priority: "urgent",
    status: "In Progress",
  },
  {
    id: "j6",
    property: "Summit Ridge",
    jobType: "Repair",
    assignedTech: "Jordan Hill",
    eta: "ETA 45 min",
    priority: "normal",
    status: "In Progress",
  },
  {
    id: "j7",
    property: "Broadstone Park",
    jobType: "Repair",
    assignedTech: "Danny Cruz",
    eta: "Done 8:15 AM",
    priority: "normal",
    status: "Done",
  },
  {
    id: "j8",
    property: "Oakwood Terrace",
    jobType: "Site Walk",
    assignedTech: "Marcus Webb",
    eta: "Done 7:50 AM",
    priority: "scheduled",
    status: "Done",
  },
];

const MOCK_TECHS: Tech[] = [
  {
    id: "t1",
    name: "Marcus Webb",
    initials: "MW",
    role: "Lead Tech",
    status: "On Site",
    currentJob: "Riverside Apts",
  },
  {
    id: "t2",
    name: "Jordan Hill",
    initials: "JH",
    role: "Installer",
    status: "Driving",
    currentJob: "ETA 45 min",
  },
  {
    id: "t3",
    name: "Danny Cruz",
    initials: "DC",
    role: "Installer",
    status: "Available",
    currentJob: null,
  },
  {
    id: "t4",
    name: "Priya Sharma",
    initials: "PS",
    role: "Lead Tech",
    status: "On Site",
    currentJob: "Summit Ridge",
  },
  {
    id: "t5",
    name: "Carlos Vega",
    initials: "CV",
    role: "Tech",
    status: "Offline",
    currentJob: null,
  },
  {
    id: "t6",
    name: "Alex Kim",
    initials: "AK",
    role: "Installer",
    status: "Available",
    currentJob: null,
  },
];

const COLUMNS: { status: JobStatus; label: string; accent: string; bg: string }[] = [
  { status: "Pending", label: "Pending", accent: "border-slate-300", bg: "bg-slate-50" },
  { status: "Assigned", label: "Assigned", accent: "border-blue-300", bg: "bg-blue-50" },
  { status: "In Progress", label: "In Progress", accent: "border-amber-300", bg: "bg-amber-50" },
  { status: "Done", label: "Done", accent: "border-emerald-300", bg: "bg-emerald-50" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

const jobTypeConfig: Record<JobType, { label: string; color: string }> = {
  Install: { label: "Install", color: "bg-blue-100 text-blue-700" },
  Repair: { label: "Repair", color: "bg-rose-100 text-rose-700" },
  PM: { label: "PM", color: "bg-violet-100 text-violet-700" },
  "Site Walk": { label: "Site Walk", color: "bg-teal-100 text-teal-700" },
};

const jobTypeIcon: Record<JobType, React.ReactNode> = {
  Install: <DoorOpen size={12} />,
  Repair: <Wrench size={12} />,
  PM: <Radio size={12} />,
  "Site Walk": <Camera size={12} />,
};

const priorityDot: Record<Priority, string> = {
  urgent: "bg-red-500",
  normal: "bg-amber-400",
  scheduled: "bg-emerald-500",
};

const techStatusConfig: Record<TechStatus, { label: string; badge: string; dot: string }> = {
  Available: {
    label: "Available",
    badge: "bg-emerald-100 text-emerald-700",
    dot: "bg-emerald-500",
  },
  "On Site": {
    label: "On Site",
    badge: "bg-blue-100 text-blue-700",
    dot: "bg-blue-500",
  },
  Driving: {
    label: "Driving",
    badge: "bg-amber-100 text-amber-700",
    dot: "bg-amber-500",
  },
  Offline: {
    label: "Offline",
    badge: "bg-slate-100 text-slate-500",
    dot: "bg-slate-400",
  },
};

function JobCard({ job }: { job: Job }) {
  const typeConf = jobTypeConfig[job.jobType];
  const colConf = COLUMNS.find((c) => c.status === job.status)!;

  return (
    <div
      className={cn(
        "bg-white rounded-xl border-l-4 shadow-sm p-3.5 space-y-2.5 hover:shadow-md transition-shadow",
        job.priority === "urgent"
          ? "border-l-red-500"
          : job.priority === "normal"
          ? "border-l-amber-400"
          : "border-l-emerald-400"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800 leading-tight">{job.property}</p>
        <span
          className={cn(
            "inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0",
            typeConf.color
          )}
        >
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
          <span
            className={cn("w-2 h-2 rounded-full", priorityDot[job.priority])}
            title={job.priority}
          />
          <span className="text-[10px] text-slate-400 capitalize">{job.priority}</span>
        </div>
      </div>
    </div>
  );
}

function TechRow({ tech }: { tech: Tech }) {
  const conf = techStatusConfig[tech.status];
  return (
    <div className="flex items-center gap-3 py-3 px-4 hover:bg-slate-50 transition-colors">
      <div
        className={cn(
          "w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0",
          tech.status === "Offline" ? "bg-slate-400" : "bg-[#2563EB]"
        )}
      >
        {tech.initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">{tech.name}</p>
        <p className="text-[11px] text-slate-400">{tech.role}</p>
      </div>
      <div className="text-right shrink-0">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full",
            conf.badge
          )}
        >
          <span className={cn("w-1.5 h-1.5 rounded-full", conf.dot)} />
          {conf.label}
        </span>
        {tech.currentJob && (
          <p className="text-[10px] text-slate-400 mt-0.5">{tech.currentJob}</p>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DispatchPage() {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1200);
  };

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const stats = [
    { label: "Active Jobs", value: "12", icon: Zap, color: "text-blue-600", bg: "bg-blue-50" },
    {
      label: "Available Techs",
      value: "3/7",
      icon: Users,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "In Transit",
      value: "4",
      icon: Navigation,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: "Completed Today",
      value: "8",
      icon: CheckCircle2,
      color: "text-violet-600",
      bg: "bg-violet-50",
    },
  ];

  return (
    <div className="min-h-screen bg-[#f0f2f5] p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dispatcher</h1>
          <p className="text-sm text-slate-500 mt-0.5">{today}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
          >
            <RefreshCw size={15} className={cn(refreshing && "animate-spin")} />
            Refresh
          </button>
          <button className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#2563EB] rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
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
            <p className={cn("text-3xl font-bold", s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Main Board */}
      <div className="flex gap-5 items-start">
        {/* Kanban Board — 2/3 */}
        <div className="flex-[2] min-w-0 space-y-2">
          <div className="grid grid-cols-4 gap-3">
            {COLUMNS.map((col) => {
              const colJobs = MOCK_JOBS.filter((j) => j.status === col.status);
              return (
                <div key={col.status} className="space-y-2">
                  {/* Column Header */}
                  <div
                    className={cn(
                      "flex items-center justify-between px-3 py-2 rounded-lg border",
                      col.bg,
                      col.accent
                    )}
                  >
                    <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                      {col.label}
                    </span>
                    <span className="text-xs font-bold text-slate-500 bg-white/70 rounded-full px-2 py-0.5 border border-slate-200">
                      {colJobs.length}
                    </span>
                  </div>
                  {/* Cards */}
                  <div className="space-y-2">
                    {colJobs.map((job) => (
                      <JobCard key={job.id} job={job} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tech Roster — 1/3 */}
        <div className="flex-[1] min-w-0 bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3.5 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-800">Tech Roster</h2>
            <p className="text-xs text-slate-400 mt-0.5">6 technicians</p>
          </div>
          <div className="divide-y divide-slate-50">
            {MOCK_TECHS.map((tech) => (
              <TechRow key={tech.id} tech={tech} />
            ))}
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
            Live dispatch map — EagleEye + Google Maps integration coming soon
          </p>
        </div>
      </div>
    </div>
  );
}
