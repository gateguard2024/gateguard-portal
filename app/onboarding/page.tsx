"use client";

import { useState } from "react";
import {
  Plus, FileCheck, Package, Calendar, Wrench, Camera, Shield,
  Globe, Mail, CheckCircle2, Circle, AlertTriangle, Clock,
  Building2, Users, ChevronRight, CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types & Data ────────────────────────────────────────────────────────────

type OnboardingStatus = "In Progress" | "Stuck" | "Completed";
type PropertyType = "Multifamily" | "HOA" | "Commercial";

interface OnboardingRecord {
  id: string;
  customer: string;
  propertyType: PropertyType;
  startedDate: string;
  progress: number;
  currentStep: string;
  currentStepIndex: number;
  daysSinceUpdate: number;
  status: OnboardingStatus;
  completedDate?: string;
  assignedRep: string;
  targetCompletion: string;
  notes?: string;
}

const STEPS = [
  { label: "Contract Signed",       icon: FileCheck  },
  { label: "Equipment Ordered",     icon: Package    },
  { label: "Install Scheduled",     icon: Calendar   },
  { label: "Install Complete",      icon: Wrench     },
  { label: "EagleEye Provisioned",  icon: Camera     },
  { label: "Brivo Provisioned",     icon: Shield     },
  { label: "Customer Portal Live",  icon: Globe      },
  { label: "Welcome Email Sent",    icon: Mail       },
];

const records: OnboardingRecord[] = [
  {
    id: "ONB-001",
    customer: "Camden Crossing Apts",
    propertyType: "Multifamily",
    startedDate: "Apr 1, 2026",
    progress: 75,
    currentStep: "EagleEye Provisioned",
    currentStepIndex: 4,
    daysSinceUpdate: 1,
    status: "In Progress",
    assignedRep: "Russel Feldman",
    targetCompletion: "May 5, 2026",
    notes: "EagleEye credentials being provisioned. NVR online.",
  },
  {
    id: "ONB-002",
    customer: "Westbridge Commons",
    propertyType: "HOA",
    startedDate: "Apr 5, 2026",
    progress: 50,
    currentStep: "Install Complete",
    currentStepIndex: 3,
    daysSinceUpdate: 2,
    status: "In Progress",
    assignedRep: "Marcus Webb",
    targetCompletion: "May 12, 2026",
    notes: "Install completed Apr 14. Awaiting software provisioning.",
  },
  {
    id: "ONB-003",
    customer: "Harbor View Phase 2",
    propertyType: "Multifamily",
    startedDate: "Apr 8, 2026",
    progress: 25,
    currentStep: "Install Scheduled",
    currentStepIndex: 2,
    daysSinceUpdate: 12,
    status: "Stuck",
    assignedRep: "Jordan Hill",
    targetCompletion: "May 15, 2026",
    notes: "Contractor canceled. Rescheduling needed — no response from PM.",
  },
  {
    id: "ONB-004",
    customer: "Northgate Plaza",
    propertyType: "Commercial",
    startedDate: "Apr 10, 2026",
    progress: 62,
    currentStep: "Brivo Provisioned",
    currentStepIndex: 5,
    daysSinceUpdate: 1,
    status: "In Progress",
    assignedRep: "Sarah Chen",
    targetCompletion: "May 8, 2026",
    notes: "Brivo integration in progress. API keys issued.",
  },
  {
    id: "ONB-005",
    customer: "Maple Ridge HOA",
    propertyType: "HOA",
    startedDate: "Apr 12, 2026",
    progress: 12,
    currentStep: "Equipment Ordered",
    currentStepIndex: 1,
    daysSinceUpdate: 8,
    status: "Stuck",
    assignedRep: "Marcus Webb",
    targetCompletion: "May 20, 2026",
    notes: "Equipment on backorder. Waiting for supplier ETA.",
  },
  {
    id: "ONB-006",
    customer: "Riverfront Commons",
    propertyType: "Multifamily",
    startedDate: "Mar 15, 2026",
    progress: 100,
    currentStep: "Welcome Email Sent",
    currentStepIndex: 7,
    daysSinceUpdate: 0,
    status: "Completed",
    completedDate: "Apr 2, 2026",
    assignedRep: "Russel Feldman",
    targetCompletion: "Apr 5, 2026",
    notes: "Completed ahead of schedule. Customer very satisfied.",
  },
  {
    id: "ONB-007",
    customer: "Summit Pointe",
    propertyType: "Commercial",
    startedDate: "Mar 20, 2026",
    progress: 100,
    currentStep: "Welcome Email Sent",
    currentStepIndex: 7,
    daysSinceUpdate: 0,
    status: "Completed",
    completedDate: "Apr 8, 2026",
    assignedRep: "Sarah Chen",
    targetCompletion: "Apr 10, 2026",
    notes: "All systems live. Customer portal credentials sent.",
  },
  {
    id: "ONB-008",
    customer: "Ashford Lakes",
    propertyType: "HOA",
    startedDate: "Mar 25, 2026",
    progress: 100,
    currentStep: "Welcome Email Sent",
    currentStepIndex: 7,
    daysSinceUpdate: 0,
    status: "Completed",
    completedDate: "Apr 15, 2026",
    assignedRep: "Jordan Hill",
    targetCompletion: "Apr 18, 2026",
    notes: "Smooth onboarding. All 8 steps completed on time.",
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const propertyTypeBadge: Record<PropertyType, string> = {
  Multifamily: "bg-blue-50 text-blue-700 border-blue-100",
  HOA:         "bg-purple-50 text-purple-700 border-purple-100",
  Commercial:  "bg-amber-50 text-amber-700 border-amber-100",
};

const statusConfig: Record<OnboardingStatus, { color: string; bg: string; border: string; icon: any }> = {
  "In Progress": { color: "text-blue-700",    bg: "bg-blue-50",   border: "border-blue-100",   icon: Clock        },
  "Stuck":       { color: "text-red-600",     bg: "bg-red-50",    border: "border-red-100",    icon: AlertTriangle },
  "Completed":   { color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-100", icon: CheckCircle2 },
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: OnboardingStatus }) {
  const cfg = statusConfig[status];
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border", cfg.color, cfg.bg, cfg.border)}>
      <Icon size={10} />
      {status}
    </span>
  );
}

function ProgressBar({ value, status }: { value: number; status: OnboardingStatus }) {
  const barColor =
    status === "Completed"  ? "bg-emerald-500" :
    status === "Stuck"      ? "bg-red-400"     :
    "bg-[#2563EB]";
  return (
    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
      <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${value}%` }} />
    </div>
  );
}

function DetailPanel({ record, onNoteChange, noteValue }: {
  record: OnboardingRecord;
  onNoteChange: (v: string) => void;
  noteValue: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="bg-[#0f1c3f] px-5 py-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-bold text-white">{record.customer}</h3>
            <div className="flex items-center gap-2 mt-1.5">
              <span className={cn("text-[11px] px-2 py-0.5 rounded-full font-semibold border", propertyTypeBadge[record.propertyType])}>
                {record.propertyType}
              </span>
              <StatusBadge status={record.status} />
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-white">{record.progress}%</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Complete</p>
          </div>
        </div>
        <div className="mt-3 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full",
              record.status === "Completed" ? "bg-emerald-400" :
              record.status === "Stuck"     ? "bg-red-400"     :
              "bg-[#2563EB]"
            )}
            style={{ width: `${record.progress}%` }}
          />
        </div>
      </div>

      {/* Meta */}
      <div className="grid grid-cols-2 gap-0 border-b border-slate-100 text-xs">
        {[
          { label: "Assigned Rep",      value: record.assignedRep     },
          { label: "Started",           value: record.startedDate     },
          { label: "Target Completion", value: record.targetCompletion },
          { label: record.completedDate ? "Completed" : "Onboarding ID", value: record.completedDate ?? record.id },
        ].map((m, i) => (
          <div key={m.label} className={cn("px-4 py-3", i % 2 === 0 ? "border-r border-slate-100" : "")}>
            <p className="text-slate-400 font-medium uppercase tracking-wide text-[10px]">{m.label}</p>
            <p className="font-semibold text-slate-800 mt-0.5">{m.value}</p>
          </div>
        ))}
      </div>

      {/* Step tracker */}
      <div className="px-4 py-4 flex-1 overflow-y-auto">
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-3">Onboarding Checklist</p>
        <div className="space-y-1">
          {STEPS.map((step, i) => {
            const StepIcon = step.icon;
            const isDone    = i < record.currentStepIndex;
            const isCurrent = i === record.currentStepIndex && record.status !== "Completed";
            const isUpcoming = i > record.currentStepIndex && record.status !== "Completed";
            const allDone   = record.status === "Completed";

            return (
              <div
                key={step.label}
                className={cn(
                  "flex items-center gap-3 p-2.5 rounded-lg transition-colors",
                  (isDone || allDone)  ? "bg-emerald-50/60" :
                  isCurrent            ? "bg-blue-50 border border-blue-100" :
                  "bg-transparent"
                )}
              >
                {/* Step icon circle */}
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0",
                  (isDone || allDone)  ? "bg-emerald-100" :
                  isCurrent            ? "bg-[#2563EB]"   :
                  "bg-slate-100"
                )}>
                  {(isDone || allDone) ? (
                    <CheckCircle size={14} className="text-emerald-600" />
                  ) : (
                    <StepIcon size={13} className={isCurrent ? "text-white" : "text-slate-400"} />
                  )}
                </div>

                {/* Label */}
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-xs font-semibold leading-tight",
                    (isDone || allDone) ? "text-emerald-700 line-through decoration-emerald-300" :
                    isCurrent           ? "text-[#2563EB]" :
                    "text-slate-400"
                  )}>
                    {step.label}
                  </p>
                </div>

                {/* Status */}
                {(isDone || allDone) && (
                  <span className="text-[10px] text-emerald-600 font-semibold flex-shrink-0">Done</span>
                )}
                {isCurrent && (
                  <span className="text-[10px] text-[#2563EB] font-bold flex-shrink-0 animate-pulse">Active</span>
                )}
                {isUpcoming && (
                  <span className="text-[10px] text-slate-300 font-medium flex-shrink-0">—</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Notes + action */}
      <div className="border-t border-slate-100 p-4 space-y-3">
        <div>
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block mb-1.5">Notes</label>
          <textarea
            value={noteValue}
            onChange={(e) => onNoteChange(e.target.value)}
            rows={3}
            placeholder="Add a note or update..."
            className="w-full px-3 py-2 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]/40 placeholder:text-slate-300"
          />
        </div>
        {record.status !== "Completed" && (
          <button className="w-full py-2.5 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2">
            <ChevronRight size={14} />
            Update Step
          </button>
        )}
        {record.status === "Completed" && (
          <div className="flex items-center justify-center gap-2 py-2 rounded-lg bg-emerald-50 border border-emerald-100">
            <CheckCircle2 size={14} className="text-emerald-600" />
            <span className="text-xs font-semibold text-emerald-700">Onboarding Completed · {record.completedDate}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const [selectedId, setSelectedId] = useState<string>("ONB-001");
  const [notes, setNotes] = useState<Record<string, string>>(
    Object.fromEntries(records.map((r) => [r.id, r.notes ?? ""]))
  );

  const selected = records.find((r) => r.id === selectedId) ?? records[0];

  const summaryStats = [
    { label: "In Progress",           value: records.filter((r) => r.status === "In Progress").length, color: "text-blue-600",    bg: "bg-blue-50",    border: "border-blue-100",   icon: Clock         },
    { label: "Stuck / Overdue",       value: records.filter((r) => r.status === "Stuck").length,       color: "text-red-600",     bg: "bg-red-50",     border: "border-red-100",    icon: AlertTriangle },
    { label: "Completed This Month",  value: records.filter((r) => r.status === "Completed").length,   color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100", icon: CheckCircle2  },
    { label: "Avg Days to Complete",  value: "18",                                                      color: "text-slate-600",   bg: "bg-slate-100",  border: "border-slate-200",  icon: Calendar      },
  ];

  return (
    <div className="min-h-full bg-[#f0f2f5]">
      {/* Page header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Onboarding</h1>
          <p className="text-sm text-slate-500 mt-0.5">Track new customer setup from contract to go-live</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white text-sm font-semibold transition-colors shadow-sm shadow-blue-200">
          <Plus size={15} />
          New Onboarding
        </button>
      </div>

      <div className="p-6 space-y-5">
        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-4">
          {summaryStats.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className={cn("bg-white rounded-xl border shadow-sm p-4 flex items-center gap-3", s.border)}>
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", s.bg)}>
                  <Icon size={16} className={s.color} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{s.value}</p>
                  <p className="text-xs text-slate-500 font-medium mt-0.5 leading-tight">{s.label}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Main content: list + detail panel */}
        <div className="flex gap-5 items-start">
          {/* Left: onboarding list */}
          <div className="flex-1 min-w-0 space-y-2.5">
            {records.map((r) => {
              const isSelected = r.id === selectedId;
              const sc = statusConfig[r.status];

              return (
                <div
                  key={r.id}
                  onClick={() => setSelectedId(r.id)}
                  className={cn(
                    "bg-white rounded-xl border shadow-sm p-4 cursor-pointer transition-all",
                    isSelected
                      ? "border-[#2563EB]/40 ring-2 ring-[#2563EB]/10 shadow-md"
                      : "border-slate-200 hover:border-slate-300 hover:shadow"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-slate-900 truncate">{r.customer}</h3>
                        <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold border flex-shrink-0", propertyTypeBadge[r.propertyType])}>
                          {r.propertyType}
                        </span>
                        <StatusBadge status={r.status} />
                      </div>

                      <div className="flex items-center gap-4 mt-1.5 text-[11px] text-slate-400">
                        <span>Started {r.startedDate}</span>
                        {r.completedDate && (
                          <span className="text-emerald-600 font-medium">Completed {r.completedDate}</span>
                        )}
                        {r.status !== "Completed" && (
                          <span className={cn(
                            "font-medium flex items-center gap-1",
                            r.daysSinceUpdate > 7 ? "text-red-500" : "text-slate-400"
                          )}>
                            <Clock size={10} />
                            {r.daysSinceUpdate === 0 ? "Updated today" : `${r.daysSinceUpdate}d no update`}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p className={cn(
                        "text-lg font-bold",
                        r.status === "Completed" ? "text-emerald-600" :
                        r.status === "Stuck"     ? "text-red-500"     :
                        "text-[#2563EB]"
                      )}>
                        {r.progress}%
                      </p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3">
                    <ProgressBar value={r.progress} status={r.status} />
                  </div>

                  {/* Current step */}
                  {r.status !== "Completed" && (
                    <div className="mt-2.5 flex items-center gap-2 text-[11px] text-slate-500">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#2563EB] flex-shrink-0" />
                      <span className="font-medium">Current step:</span>
                      <span className="text-slate-700 font-semibold">{r.currentStep}</span>
                      <span className="text-slate-300 ml-auto font-medium">Step {r.currentStepIndex + 1}/8</span>
                    </div>
                  )}
                  {r.status === "Completed" && (
                    <div className="mt-2.5 flex items-center gap-2 text-[11px] text-emerald-600 font-semibold">
                      <CheckCircle2 size={12} />
                      All 8 steps complete
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right: detail panel */}
          <div className="w-80 flex-shrink-0">
            <DetailPanel
              record={selected}
              noteValue={notes[selected.id] ?? ""}
              onNoteChange={(v) => setNotes((prev) => ({ ...prev, [selected.id]: v }))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
