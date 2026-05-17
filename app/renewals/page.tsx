"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Download,
  Calendar,
  AlertCircle,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  Clock,
  Send,
  ChevronDown,
  Filter,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ActionStatus = "Action Needed" | "On Track";
type RenewalBucket = "30" | "60" | "90";

interface Renewal {
  id: string;
  property: string;
  mrr: string;
  contractEnd: string;
  repInitials: string;
  repName: string;
  status: ActionStatus;
  note?: string;
  bucket: RenewalBucket;
}

interface DbRenewal {
  id: string;
  title: string;
  mrr: number;
  end_date?: string | null;
  assigned_rep?: string | null;
  renewal_status: string;
  bucket: string;
  client_name?: string | null;
  site_name?: string | null;
}

function dbRenewalToUi(db: DbRenewal): Renewal {
  const repRaw = db.assigned_rep ?? '';
  const repInitials = repRaw.length <= 3 ? repRaw.toUpperCase() : repRaw.split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase();
  const repName = repRaw || '—';
  const actionStatus: ActionStatus = db.renewal_status === 'action_needed' ? 'Action Needed' : 'On Track';
  const bucket: RenewalBucket = db.bucket === '30' ? '30' : db.bucket === '60' ? '60' : '90';
  const endDate = db.end_date ? new Date(db.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';

  return {
    id: db.id,
    property: db.client_name ?? db.site_name ?? db.title,
    mrr: `$${(db.mrr ?? 0).toLocaleString()}/mo`,
    contractEnd: endDate,
    repInitials,
    repName,
    status: actionStatus,
    bucket,
  };
}

const ALL_STATUSES: (ActionStatus | "All")[] = ["All", "Action Needed", "On Track"];

const BUCKETS: {
  key: RenewalBucket;
  label: string;
  header: string;
  headerBg: string;
  headerText: string;
  border: string;
  bg: string;
  countColor: string;
}[] = [
  {
    key: "30",
    label: "Next 30 Days",
    header: "Next 30 Days",
    headerBg: "bg-red-500",
    headerText: "text-white",
    border: "border-red-200",
    bg: "bg-red-50/40",
    countColor: "bg-red-100 text-red-700",
  },
  {
    key: "60",
    label: "31–60 Days",
    header: "31–60 Days",
    headerBg: "bg-amber-500",
    headerText: "text-white",
    border: "border-amber-200",
    bg: "bg-amber-50/40",
    countColor: "bg-amber-100 text-amber-700",
  },
  {
    key: "90",
    label: "61–90 Days",
    header: "61–90 Days",
    headerBg: "bg-emerald-500",
    headerText: "text-white",
    border: "border-emerald-200",
    bg: "bg-emerald-50/40",
    countColor: "bg-emerald-100 text-emerald-700",
  },
];

const repAvatarColor: Record<string, string> = {
  RF: "bg-[#2563EB]",
  MW: "bg-violet-600",
  JH: "bg-teal-600",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function RenewalCard({ renewal }: { renewal: Renewal }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 space-y-3 hover:shadow-md transition-shadow">
      {/* Property + MRR */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800 leading-tight">{renewal.property}</p>
        <span className="inline-flex items-center gap-1 text-[12px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full shrink-0">
          <DollarSign size={10} />
          {renewal.mrr.replace("$", "")}
        </span>
      </div>

      {/* End Date */}
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <Calendar size={11} />
        <span>Expires {renewal.contractEnd}</span>
      </div>

      {/* Rep */}
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white",
            repAvatarColor[renewal.repInitials] ?? "bg-slate-400"
          )}
        >
          {renewal.repInitials}
        </div>
        <span className="text-xs text-slate-500">{renewal.repName}</span>
      </div>

      {/* Status + Note */}
      <div className="flex items-center gap-2 flex-wrap">
        {renewal.status === "Action Needed" ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-100">
            <AlertCircle size={11} />
            Action Needed
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
            <CheckCircle2 size={11} />
            On Track
          </span>
        )}
        {renewal.note && (
          <span className="text-[10px] text-slate-400 italic">{renewal.note}</span>
        )}
      </div>

      {/* Reach Out Button */}
      <button className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#2563EB] bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-lg transition-colors">
        <Send size={11} />
        Reach Out
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RenewalsPage() {
  const [repFilter, setRepFilter] = useState("All Reps");
  const [statusFilter, setStatusFilter] = useState<ActionStatus | "All">("All");
  const [repDropdownOpen, setRepDropdownOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [renewals, setRenewals] = useState<Renewal[]>([]);
  const [, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/renewals')
      .then(r => r.json())
      .then(json => {
        if (json.renewals && json.renewals.length > 0) {
          setRenewals(json.renewals.map(dbRenewalToUi));
        }
      })
      .catch(() => { /* keep empty — page still renders with no data */ })
      .finally(() => setLoading(false));
  }, []);

  // Build rep list dynamically from live renewals
  const ALL_REPS = ["All Reps", ...Array.from(new Set(renewals.map(r => r.repName).filter(n => n && n !== '—')))];

  const count30 = renewals.filter(r => r.bucket === '30').length;
  const count60 = renewals.filter(r => r.bucket === '60').length;
  const count90 = renewals.filter(r => r.bucket === '90').length;

  const stats = [
    {
      label: "Renewing in 30 Days",
      value: String(count30),
      sub: "Urgent",
      icon: AlertCircle,
      color: "text-red-600",
      bg: "bg-red-50",
      border: "border-red-100",
    },
    {
      label: "Renewing in 60 Days",
      value: String(count30 + count60),
      sub: "Attention",
      icon: Clock,
      color: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-amber-100",
    },
    {
      label: "Renewing in 90 Days",
      value: String(count30 + count60 + count90),
      sub: "On Radar",
      icon: Calendar,
      color: "text-yellow-600",
      bg: "bg-yellow-50",
      border: "border-yellow-100",
    },
    {
      label: "Total Upcoming",
      value: String(count30 + count60 + count90),
      sub: "Next 90 days",
      icon: TrendingUp,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-emerald-100",
    },
  ];

  const filteredRenewals = renewals.filter((r) => {
    const matchesRep = repFilter === "All Reps" || r.repName === repFilter;
    const matchesStatus = statusFilter === "All" || r.status === statusFilter;
    return matchesRep && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-[#f0f2f5] p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Renewals</h1>
          <p className="text-sm text-slate-500 mt-0.5">Contract renewal pipeline</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Date Range Selector (mock) */}
          <div className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg shadow-sm">
            <Calendar size={14} className="text-slate-400" />
            <span>Apr 2026 — Apr 2027</span>
            <ChevronDown size={13} className="text-slate-400" />
          </div>
          <button className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm">
            <Download size={14} />
            Export
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className={cn(
              "bg-white rounded-xl border shadow-sm p-5",
              s.border
            )}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-slate-500 font-medium">{s.label}</span>
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", s.bg)}>
                <s.icon size={16} className={s.color} />
              </div>
            </div>
            <div className="flex items-end gap-2">
              <p className={cn("text-3xl font-bold", s.color)}>{s.value}</p>
              <span className="text-sm text-slate-400 mb-0.5">{s.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Filter size={14} />
          <span className="font-medium">Filters:</span>
        </div>

        {/* Rep Filter */}
        <div className="relative">
          <button
            onClick={() => {
              setRepDropdownOpen(!repDropdownOpen);
              setStatusDropdownOpen(false);
            }}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
          >
            {repFilter}
            <ChevronDown size={13} className="text-slate-400" />
          </button>
          {repDropdownOpen && (
            <div className="absolute top-full mt-1 left-0 z-10 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden min-w-[140px]">
              {ALL_REPS.map((rep) => (
                <button
                  key={rep}
                  onClick={() => {
                    setRepFilter(rep);
                    setRepDropdownOpen(false);
                  }}
                  className={cn(
                    "w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors",
                    repFilter === rep ? "text-[#2563EB] font-semibold" : "text-slate-700"
                  )}
                >
                  {rep}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Status Filter */}
        <div className="relative">
          <button
            onClick={() => {
              setStatusDropdownOpen(!statusDropdownOpen);
              setRepDropdownOpen(false);
            }}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
          >
            {statusFilter === "All" ? "All Statuses" : statusFilter}
            <ChevronDown size={13} className="text-slate-400" />
          </button>
          {statusDropdownOpen && (
            <div className="absolute top-full mt-1 left-0 z-10 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden min-w-[160px]">
              {ALL_STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setStatusFilter(s);
                    setStatusDropdownOpen(false);
                  }}
                  className={cn(
                    "w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors",
                    statusFilter === s ? "text-[#2563EB] font-semibold" : "text-slate-700"
                  )}
                >
                  {s === "All" ? "All Statuses" : s}
                </button>
              ))}
            </div>
          )}
        </div>

        {(repFilter !== "All Reps" || statusFilter !== "All") && (
          <button
            onClick={() => {
              setRepFilter("All Reps");
              setStatusFilter("All");
            }}
            className="text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2"
          >
            Clear filters
          </button>
        )}

        <span className="ml-auto text-xs text-slate-400">
          {filteredRenewals.length} of {renewals.length} renewals
        </span>
      </div>

      {/* Kanban Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {BUCKETS.map((bucket) => {
          const cards = filteredRenewals.filter((r) => r.bucket === bucket.key);
          return (
            <div key={bucket.key} className="space-y-3">
              {/* Column Header */}
              <div
                className={cn(
                  "flex items-center justify-between px-4 py-3 rounded-xl",
                  bucket.headerBg
                )}
              >
                <span className={cn("text-sm font-bold", bucket.headerText)}>{bucket.header}</span>
                <span
                  className={cn(
                    "text-xs font-bold px-2.5 py-0.5 rounded-full bg-white/20",
                    bucket.headerText
                  )}
                >
                  {cards.length}
                </span>
              </div>

              {/* Cards */}
              <div className="space-y-3">
                {cards.length > 0 ? (
                  cards.map((renewal) => <RenewalCard key={renewal.id} renewal={renewal} />)
                ) : (
                  <div className="bg-white rounded-xl border border-slate-100 py-10 text-center text-slate-400">
                    <CheckCircle2 size={24} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No renewals match filters</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Renewed YTD Progress — shown when contracts exist */}
      {renewals.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <TrendingUp size={16} className="text-emerald-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Upcoming Renewals by Rep</h2>
              <p className="text-xs text-slate-400">Filtered to next 90 days</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ALL_REPS.filter(r => r !== "All Reps").map(rep => {
              const repRenewals = renewals.filter(r => r.repName === rep);
              return repRenewals.length > 0 ? (
                <div key={rep} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 font-medium">{rep}</span>
                    <span className="text-slate-800 font-semibold">{repRenewals.length} upcoming</span>
                  </div>
                  <div className="flex gap-1">
                    <span className="text-[10px] text-red-500 font-medium">{repRenewals.filter(r=>r.bucket==='30').length} urgent</span>
                    <span className="text-[10px] text-slate-300">·</span>
                    <span className="text-[10px] text-amber-500 font-medium">{repRenewals.filter(r=>r.bucket==='60').length} watch</span>
                    <span className="text-[10px] text-slate-300">·</span>
                    <span className="text-[10px] text-emerald-500 font-medium">{repRenewals.filter(r=>r.bucket==='90').length} on radar</span>
                  </div>
                </div>
              ) : null;
            })}
          </div>
        </div>
      )}
    </div>
  );
}
