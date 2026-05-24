"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { TopBar } from "@/components/layout/TopBar";
import {
  RefreshCw, Calendar, ArrowRight, Plus,
  TrendingUp, Users, CheckCircle2, Zap,
  Phone, Mail, ClipboardList, X, ChevronDown,
} from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { CalendarClock, StickyNote, UserPlus, UserCheck, Building2, Star } = require("lucide-react") as any;
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────
type Stage =
  | "meet_present"
  | "survey_request"
  | "propose"
  | "negotiate"
  | "won"
  | "lost";

interface Opportunity {
  id: string;
  name: string;
  account_name: string;
  stage: Stage;
  amount: number;
  close_date: string;
  owner_name: string;
  owner_initials: string;
  won_at?: string;
  created_at: string;
}

interface OpportunitiesResponse {
  records: Opportunity[];
  grouped: Record<Stage, { label: string; records: Opportunity[]; total: number }>;
  pipelineTotal: number;
  counts: { open: number; won: number; lost: number };
}

interface Lead {
  id: string;
  contact_name: string;
  property_name: string;
  email: string;
  phone?: string;
  source?: string;
  created_at: string;
  assigned_dealer?: string;
}

interface Activity {
  id: string;
  type: "call" | "email" | "meeting" | "task" | "note";
  subject: string;
  due_at: string;
  completed_at?: string | null;
  opportunity_name?: string;
}

// ── Stage Config ──────────────────────────────────────────────────────────
const STAGE_CONFIG: Record<
  Stage,
  { label: string; dot: string; pill: string }
> = {
  meet_present: {
    label: "Meet & Present",
    dot: "bg-blue-400",
    pill: "bg-blue-100 text-blue-700",
  },
  survey_request: {
    label: "Survey Request",
    dot: "bg-violet-400",
    pill: "bg-violet-100 text-violet-700",
  },
  propose: {
    label: "Propose",
    dot: "bg-amber-400",
    pill: "bg-amber-100 text-amber-700",
  },
  negotiate: {
    label: "Negotiate",
    dot: "bg-orange-400",
    pill: "bg-orange-100 text-orange-700",
  },
  won: {
    label: "Closed Won",
    dot: "bg-emerald-500",
    pill: "bg-emerald-100 text-emerald-700",
  },
  lost: {
    label: "Lost",
    dot: "bg-red-400",
    pill: "bg-red-100 text-red-600",
  },
};

const ACTIVE_STAGES: Stage[] = [
  "meet_present",
  "survey_request",
  "propose",
  "negotiate",
];

// ── Helpers ───────────────────────────────────────────────────────────────
function fmt$(n: number | undefined | null): string {
  if (n == null) return "$0";
  if (n >= 1_000_000) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function isThisMonth(iso: string | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function activityIcon(type: Activity["type"]) {
  switch (type) {
    case "call":
      return <Phone size={14} />;
    case "email":
      return <Mail size={14} />;
    case "meeting":
      return <CalendarClock size={14} />;
    case "task":
      return <ClipboardList size={14} />;
    default:
      return <ClipboardList size={14} />;
  }
}

// ── Component ─────────────────────────────────────────────────────────────
export default function CRMPage() {
  const [oppsData, setOppsData] = useState<OpportunitiesResponse | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [assignDealer, setAssignDealer] = useState<Record<string, string>>({});
  const [assigningInProgress, setAssigningInProgress] = useState<string | null>(null);
  const [canAssignLeads, setCanAssignLeads] = useState(false);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const newMenuRef = useRef<HTMLDivElement>(null);
  const [showLogActivity, setShowLogActivity] = useState(false);
  const [logForm, setLogForm] = useState({ type: "call" as "call"|"email"|"meeting"|"task"|"note", subject: "", due_at: "", notes: "" });
  const [logSaving, setLogSaving] = useState(false);
  const [showNewOpp,  setShowNewOpp]  = useState(false);
  const [newOppForm, setNewOppForm] = useState({
    name: "", account_name: "", amount: "", close_date: "", stage: "meet_present", description: "", org_id: ""
  });
  const [savingOpp, setSavingOpp] = useState(false);
  const [showNewLead, setShowNewLead] = useState(false);
  const [newLeadForm, setNewLeadForm] = useState({
    name: "", property_name: "", email: "", phone: "",
    source: "manual", city: "", state: "", property_type: "Multifamily",
    contact_title: "", units: "", notes: "",
  });
  const [savingLead, setSavingLead] = useState(false);
  const [assignableOrgs, setAssignableOrgs] = useState<{ id: string; name: string; org_tier: string; tier_label: string }[]>([]);
  const [assignableOrgsSelfOnly, setAssignableOrgsSelfOnly] = useState(true);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [oppsRes, leadsRes, actsRes, orgsRes] = await Promise.all([
        fetch("/api/crm/opportunities"),
        fetch("/api/crm/leads"),
        fetch("/api/crm/activities"),
        fetch("/api/crm/assignable-orgs"),
      ]);
      if (oppsRes.ok) setOppsData(await oppsRes.json());
      if (leadsRes.ok) setLeads(await leadsRes.json());
      if (actsRes.ok) setActivities(await actsRes.json());
      if (orgsRes.ok) {
        const orgsJson = await orgsRes.json();
        setCanAssignLeads(!orgsJson.selfOnly);
      }
    } finally {
      setLoading(false);
    }
  };

  // Close "+ New" menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) {
        setShowNewMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    fetchAll();
  }, []);

  const handleAssign = async (leadId: string) => {
    const dealer = assignDealer[leadId];
    if (!dealer?.trim()) return;
    setAssigningInProgress(leadId);
    try {
      await fetch(`/api/crm/leads/${leadId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealer }),
      });
      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId ? { ...l, assigned_dealer: dealer } : l
        )
      );
      setAssigningId(null);
    } finally {
      setAssigningInProgress(null);
    }
  };

  const handleLogActivity = async () => {
    if (!logForm.subject.trim()) return;
    setLogSaving(true);
    try {
      await fetch("/api/crm/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...logForm, created_by_name: "Russel Feldman" }),
      });
      setShowLogActivity(false);
      setLogForm({ type: "call", subject: "", due_at: "", notes: "" });
      fetchAll();
    } finally {
      setLogSaving(false);
    }
  };

  const openNewOppForm = async () => {
    setShowNewOpp(true);
    // Fetch orgs this user can assign to
    try {
      const res = await fetch("/api/crm/assignable-orgs");
      if (res.ok) {
        const json = await res.json();
        setAssignableOrgs(json.orgs ?? []);
        setAssignableOrgsSelfOnly(json.selfOnly ?? true);
        // Pre-select their own org (first in list)
        if (json.orgs?.length > 0 && !newOppForm.org_id) {
          setNewOppForm((f) => ({ ...f, org_id: json.orgs[0].id }));
        }
      }
    } catch {
      // silently ignore — org_id will be auto-stamped server-side
    }
  };

  const handleCreateOpp = async () => {
    if (!newOppForm.name.trim()) return;
    setSavingOpp(true);
    try {
      await fetch("/api/crm/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newOppForm,
          amount: newOppForm.amount ? parseFloat(newOppForm.amount) : null,
          org_id: newOppForm.org_id || undefined,
        }),
      });
      await fetchAll();
      setShowNewOpp(false);
      setNewOppForm({ name: "", account_name: "", amount: "", close_date: "", stage: "meet_present", description: "", org_id: "" });
    } finally {
      setSavingOpp(false);
    }
  };

  const handleCreateLead = async () => {
    if (!newLeadForm.name.trim()) return;
    setSavingLead(true);
    try {
      const res = await fetch("/api/crm/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newLeadForm,
          units: newLeadForm.units ? parseInt(newLeadForm.units, 10) : null,
        }),
      });
      if (res.ok) {
        await fetchAll();
        setShowNewLead(false);
        setNewLeadForm({ name: "", property_name: "", email: "", phone: "", source: "manual", city: "", state: "", property_type: "Multifamily", contact_title: "", units: "", notes: "" });
      }
    } finally {
      setSavingLead(false);
    }
  };

  // Derived data
  const allRecords = oppsData?.records ?? [];
  const grouped = oppsData?.grouped ?? ({} as Record<Stage, { label: string; records: Opportunity[]; total: number }>);
  const pipelineTotal = oppsData?.pipelineTotal ?? 0;
  const counts = oppsData?.counts ?? { open: 0, won: 0, lost: 0 };

  const wonThisMonth = allRecords.filter(
    (r) => r.stage === "won" && isThisMonth(r.won_at)
  );
  const wonThisMonthAmount = wonThisMonth.reduce((s, r) => s + (r.amount ?? 0), 0);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const upcomingActivities = activities.filter(
    (a) => !a.completed_at && new Date(a.due_at) <= tomorrow
  );

  const openOpps = allRecords
    .filter((r) => r.stage !== "won" && r.stage !== "lost")
    .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))
    .slice(0, 8);

  // Suppress unused warning
  void timeAgo;

  return (
    <div className="min-h-screen bg-[#C0C8CF]/50">
      <TopBar
        title="CRM"
        subtitle="Pipeline · Leads · Opportunities"
        actions={
          <div className="flex items-center gap-2">
            {/* + New dropdown */}
            <div className="relative" ref={newMenuRef}>
              <button
                onClick={() => setShowNewMenu((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-[#6B7EFF] text-white rounded-lg hover:bg-[#5a6de8] transition-colors"
              >
                <Plus size={14} />
                New
                <ChevronDown size={12} className={cn("transition-transform", showNewMenu && "rotate-180")} />
              </button>
              {showNewMenu && (
                <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-border rounded-xl shadow-lg z-50 py-1 overflow-hidden">
                  <button
                    onClick={() => { setShowNewMenu(false); setShowNewLead(true); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-slate-50 transition-colors"
                  >
                    <UserPlus size={15} className="text-rose-500" />
                    <div className="text-left">
                      <p className="font-medium">Lead</p>
                      <p className="text-[11px] text-muted-foreground">Add an inbound contact</p>
                    </div>
                  </button>
                  <div className="mx-3 border-t border-border/60" />
                  <button
                    onClick={() => { setShowNewMenu(false); openNewOppForm(); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-slate-50 transition-colors"
                  >
                    <Zap size={15} className="text-[#6B7EFF]" />
                    <div className="text-left">
                      <p className="font-medium">Opportunity</p>
                      <p className="text-[11px] text-muted-foreground">Add to your pipeline</p>
                    </div>
                  </button>
                  <Link
                    href="/customers?new=1"
                    onClick={() => setShowNewMenu(false)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-slate-50 transition-colors"
                  >
                    <Building2 size={15} className="text-emerald-500" />
                    <div className="text-left">
                      <p className="font-medium">Customer</p>
                      <p className="text-[11px] text-muted-foreground">Add a property account</p>
                    </div>
                  </Link>
                  <Link
                    href="/admin/dealers/new"
                    onClick={() => setShowNewMenu(false)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-slate-50 transition-colors"
                  >
                    <UserCheck size={15} className="text-sky-500" />
                    <div className="text-left">
                      <p className="font-medium">Dealer</p>
                      <p className="text-[11px] text-muted-foreground">Onboard a new dealer</p>
                    </div>
                  </Link>
                  <Link
                    href="/reps?new=1"
                    onClick={() => setShowNewMenu(false)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-slate-50 transition-colors"
                  >
                    <Star size={15} className="text-amber-500" />
                    <div className="text-left">
                      <p className="font-medium">Sales Rep</p>
                      <p className="text-[11px] text-muted-foreground">Add to your rep network</p>
                    </div>
                  </Link>
                </div>
              )}
            </div>
          </div>
        }
      />

      <div className="px-6 py-6 space-y-6">
        {/* ROW 1 — KPI Cards (all clickable / drillable) */}
        <div className="grid grid-cols-4 gap-4">
          <Link href="/crm/opportunities">
            <KpiCard
              icon={<TrendingUp size={18} className="text-[#6B7EFF]" />}
              label="Total Pipeline"
              value={loading ? "—" : fmt$(pipelineTotal)}
              sub="Click to view all opportunities"
              iconBg="bg-[#6B7EFF]/10"
              clickable
            />
          </Link>
          <Link href="/crm/opportunities">
            <KpiCard
              icon={<Zap size={18} className="text-amber-500" />}
              label="Open Opportunities"
              value={loading ? "—" : String(counts.open)}
              sub="Across all active stages"
              iconBg="bg-amber-50"
              clickable
            />
          </Link>
          <Link href="/crm/opportunities?stage=won">
            <KpiCard
              icon={<CheckCircle2 size={18} className="text-emerald-500" />}
              label="Closed Won (Month)"
              value={loading ? "—" : `${wonThisMonth.length} · ${fmt$(wonThisMonthAmount)}`}
              sub="Click to filter closed won"
              iconBg="bg-emerald-50"
              clickable
            />
          </Link>
          <Link href="/crm/leads">
            <KpiCard
              icon={<Users size={18} className="text-blue-500" />}
              label="Inbound Leads"
              value={loading ? "—" : String(leads.length)}
              sub="Events · Shows · Referrals · Web"
              iconBg="bg-blue-50"
              clickable
            />
          </Link>
        </div>

        {/* ROW 2 — Pipeline + Activity */}
        <div className="grid grid-cols-5 gap-4">
          {/* My Pipeline */}
          <div className="col-span-3 bg-white rounded-xl border border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground">My Pipeline</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={openNewOppForm}
                  className="px-3 py-1.5 text-xs bg-[#6B7EFF] text-white rounded-lg hover:bg-[#5a6de8] transition-colors font-medium"
                >
                  + New
                </button>
                <button
                  onClick={fetchAll}
                  className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground transition-colors"
                >
                  <RefreshCw size={14} />
                </button>
              </div>
            </div>

            <div className="space-y-1">
              {ACTIVE_STAGES.map((stage) => {
                const cfg = STAGE_CONFIG[stage];
                const stageRecords = grouped[stage]?.records ?? [];
                const total = stageRecords.reduce(
                  (s, r) => s + (r.amount ?? 0),
                  0
                );
                return (
                  <Link
                    key={stage}
                    href={`/crm/opportunities?stage=${stage}`}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent group transition-colors"
                  >
                    <span
                      className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", cfg.dot)}
                    />
                    <span className="flex-1 text-sm font-medium text-foreground">
                      {cfg.label}
                    </span>
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono">
                      {stageRecords.length}
                    </span>
                    <span className="text-sm font-semibold text-foreground w-20 text-right">
                      {fmt$(total)}
                    </span>
                    <ArrowRight
                      size={14}
                      className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                    />
                  </Link>
                );
              })}
            </div>

            <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Total open pipeline
              </span>
              <span className="text-base font-bold text-foreground">
                {loading ? "—" : fmt$(pipelineTotal)}
              </span>
            </div>
          </div>

          {/* Today's Activity */}
          <div className="col-span-2 bg-white rounded-xl border border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calendar size={15} className="text-muted-foreground" />
                <h2 className="font-semibold text-foreground">Today's Activity</h2>
              </div>
              <button
                onClick={() => setShowLogActivity(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-[#6B7EFF]/10 text-[#6B7EFF] rounded-lg hover:bg-[#6B7EFF]/20 transition-colors"
              >
                <Plus size={12} /> Log
              </button>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : upcomingActivities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center gap-2">
                <p className="text-2xl">🎯</p>
                <p className="text-sm text-muted-foreground">Nothing scheduled — go close some deals</p>
                <button
                  onClick={() => setShowLogActivity(true)}
                  className="mt-1 text-xs text-[#6B7EFF] hover:underline font-medium"
                >
                  + Log a call, meeting, or task
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingActivities.slice(0, 5).map((act) => (
                  <div
                    key={act.id}
                    className="flex items-start gap-2 px-2 py-2 rounded-lg hover:bg-accent"
                  >
                    <div className="w-6 h-6 rounded-full bg-[#6B7EFF]/10 flex items-center justify-center text-[#6B7EFF] flex-shrink-0 mt-0.5">
                      {activityIcon(act.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {act.subject}
                      </p>
                      {act.opportunity_name && (
                        <p className="text-xs text-muted-foreground truncate">
                          {act.opportunity_name}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap font-mono">
                      {new Date(act.due_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ROW 3 — Open Opps + Show Leads */}
        <div className="grid grid-cols-5 gap-4">
          {/* Open Opportunities Table */}
          <div className="col-span-3 bg-white rounded-xl border border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground">Open Opportunities</h2>
              <Link
                href="/crm/opportunities"
                className="text-xs text-[#6B7EFF] hover:underline font-medium"
              >
                View all →
              </Link>
            </div>

            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : openOpps.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No open opportunities
              </p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs font-medium text-muted-foreground pb-2">
                      Name
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground pb-2">
                      Stage
                    </th>
                    <th className="text-right text-xs font-medium text-muted-foreground pb-2">
                      Amount
                    </th>
                    <th className="text-right text-xs font-medium text-muted-foreground pb-2">
                      Close Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {openOpps.map((opp) => {
                    const cfg = STAGE_CONFIG[opp.stage];
                    return (
                      <tr
                        key={opp.id}
                        className="border-b border-border/50 last:border-0 hover:bg-slate-50 transition-colors"
                      >
                        <td className="py-2.5 pr-3">
                          <Link
                            href={`/crm/opportunities/${opp.id}`}
                            className="text-sm font-medium text-foreground hover:text-[#6B7EFF] transition-colors truncate block max-w-[180px]"
                          >
                            {opp.name}
                          </Link>
                          <span className="text-xs text-muted-foreground">
                            {opp.account_name}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                              cfg.pill
                            )}
                          >
                            {cfg.label}
                          </span>
                        </td>
                        <td className="py-2.5 text-right text-sm font-semibold text-foreground">
                          {fmt$(opp.amount)}
                        </td>
                        <td className="py-2.5 text-right text-xs text-muted-foreground font-mono">
                          {opp.close_date
                            ? new Date(opp.close_date).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* My Leads */}
          <div className="col-span-2 bg-white rounded-xl border border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                </span>
                <h2 className="font-semibold text-foreground">My Leads</h2>
                <span className="text-xs font-mono bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">
                  {leads.length} total
                </span>
              </div>
              <Link
                href="/crm/leads"
                className="text-xs text-[#6B7EFF] hover:underline font-medium"
              >
                View all →
              </Link>
            </div>

            {/* Source filter chips */}
            {!loading && leads.length > 0 && (
              <div className="flex gap-1.5 flex-wrap mb-3">
                {Array.from(new Set(leads.map(l => l.source).filter(Boolean))).slice(0,4).map(src => (
                  <span key={src} className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-medium">
                    {src}
                  </span>
                ))}
              </div>
            )}

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : leads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center gap-1">
                <Users size={24} className="text-slate-200 mb-1" />
                <p className="text-sm text-muted-foreground">No leads yet</p>
                <p className="text-xs text-muted-foreground">Leads from shows, web, referrals will appear here</p>
              </div>
            ) : (
              <div className="space-y-2">
                {leads.slice(0, 5).map((lead) => (
                  <Link
                    key={lead.id}
                    href={`/crm/leads/${lead.id}`}
                    className="block p-3 rounded-lg border border-border hover:bg-slate-50 hover:border-[#6B7EFF]/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {lead.contact_name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {lead.property_name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {lead.source && (
                            <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">{lead.source}</span>
                          )}
                          <p className="text-xs text-[#6B7EFF] truncate">{lead.email}</p>
                        </div>
                      </div>
                      {lead.assigned_dealer ? (
                        <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                          {lead.assigned_dealer}
                        </span>
                      ) : canAssignLeads ? (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            setAssigningId(assigningId === lead.id ? null : lead.id);
                          }}
                          className="text-xs border border-[#6B7EFF] text-[#6B7EFF] px-2 py-0.5 rounded-full hover:bg-[#6B7EFF]/10 transition-colors flex-shrink-0"
                        >
                          + Assign
                        </button>
                      ) : (
                        <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                          New
                        </span>
                      )}
                    </div>

                    {assigningId === lead.id && canAssignLeads && (
                      <div className="mt-2 flex gap-2" onClick={e => e.preventDefault()}>
                        <input
                          type="text"
                          placeholder="Dealer name…"
                          value={assignDealer[lead.id] ?? ""}
                          onChange={(e) =>
                            setAssignDealer((prev) => ({
                              ...prev,
                              [lead.id]: e.target.value,
                            }))
                          }
                          className="flex-1 text-xs border border-border rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]"
                        />
                        <button
                          onClick={() => handleAssign(lead.id)}
                          disabled={assigningInProgress === lead.id}
                          className="text-xs bg-[#6B7EFF] text-white px-2.5 py-1 rounded-lg hover:bg-[#5a6de8] disabled:opacity-50 transition-colors"
                        >
                          {assigningInProgress === lead.id ? "…" : "Assign"}
                        </button>
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Log Activity modal */}
      {showLogActivity && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setShowLogActivity(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <h2 className="font-semibold text-foreground">Log Activity</h2>
                <button onClick={() => setShowLogActivity(false)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><X size={16} /></button>
              </div>
              <div className="px-5 py-5 space-y-4">
                {/* Type picker */}
                <div className="grid grid-cols-5 gap-2">
                  {([
                    { type: "call",    icon: <Phone size={14} />,         label: "Call" },
                    { type: "email",   icon: <Mail size={14} />,          label: "Email" },
                    { type: "meeting", icon: <CalendarClock size={14} />, label: "Meeting" },
                    { type: "task",    icon: <ClipboardList size={14} />, label: "Task" },
                    { type: "note",    icon: <StickyNote size={14} />,    label: "Note" },
                  ] as const).map(({ type, icon, label }) => (
                    <button
                      key={type}
                      onClick={() => setLogForm(f => ({ ...f, type }))}
                      className={cn(
                        "flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-medium transition-all",
                        logForm.type === type
                          ? "border-[#6B7EFF] bg-[#6B7EFF]/10 text-[#6B7EFF]"
                          : "border-border text-muted-foreground hover:border-slate-300 hover:bg-slate-50"
                      )}
                    >
                      {icon}
                      {label}
                    </button>
                  ))}
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Subject <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    placeholder={logForm.type === "call" ? "Called re: Parkview follow-up…" : logForm.type === "meeting" ? "Site walk at Riverside Apts…" : "Subject…"}
                    value={logForm.subject}
                    onChange={e => setLogForm(f => ({ ...f, subject: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30"
                  />
                </div>
                {logForm.type !== "note" && (
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      {logForm.type === "task" ? "Due Date" : "Date & Time"}
                    </label>
                    <input
                      type="datetime-local"
                      value={logForm.due_at}
                      onChange={e => setLogForm(f => ({ ...f, due_at: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
                  <textarea
                    rows={2}
                    placeholder="Optional notes…"
                    value={logForm.notes}
                    onChange={e => setLogForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30 resize-none"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border">
                <button onClick={() => setShowLogActivity(false)} className="px-4 py-2 text-sm font-medium text-muted-foreground border border-border rounded-lg hover:bg-accent transition-colors">Cancel</button>
                <button
                  onClick={handleLogActivity}
                  disabled={logSaving || !logForm.subject.trim()}
                  className="px-4 py-2 text-sm font-medium bg-[#6B7EFF] text-white rounded-lg hover:bg-[#5a6de8] disabled:opacity-50 transition-colors"
                >
                  {logSaving ? "Saving…" : "Log Activity"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* New Lead slide-over */}
      {showNewLead && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setShowNewLead(false)} />
          <div className="fixed inset-y-0 right-0 w-96 bg-white border-l border-border shadow-2xl z-50 flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
              <div>
                <h2 className="font-semibold text-foreground">New Lead</h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">Add an inbound contact to the pipeline</p>
              </div>
              <button onClick={() => setShowNewLead(false)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Contact Name <span className="text-red-500">*</span></label>
                <input type="text" placeholder="First Last" value={newLeadForm.name}
                  onChange={e => setNewLeadForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Company / Property Name</label>
                <input type="text" placeholder="Acme Dealers · Parkview Estates" value={newLeadForm.property_name}
                  onChange={e => setNewLeadForm(f => ({ ...f, property_name: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Email</label>
                  <input type="email" placeholder="name@company.com" value={newLeadForm.email}
                    onChange={e => setNewLeadForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Phone</label>
                  <input type="tel" placeholder="(555) 000-0000" value={newLeadForm.phone}
                    onChange={e => setNewLeadForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Title / Role</label>
                <input type="text" placeholder="VP of Operations · Property Manager" value={newLeadForm.contact_title}
                  onChange={e => setNewLeadForm(f => ({ ...f, contact_title: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">City</label>
                  <input type="text" placeholder="Atlanta" value={newLeadForm.city}
                    onChange={e => setNewLeadForm(f => ({ ...f, city: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">State</label>
                  <input type="text" placeholder="GA" value={newLeadForm.state}
                    onChange={e => setNewLeadForm(f => ({ ...f, state: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Source</label>
                <select value={newLeadForm.source} onChange={e => setNewLeadForm(f => ({ ...f, source: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30 bg-white">
                  <option value="manual">Manual Entry</option>
                  <option value="referral">Referral</option>
                  <option value="web">Web</option>
                  <option value="show">Trade Show</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="cold_outreach">Cold Outreach</option>
                  <option value="inbound_call">Inbound Call</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
                <textarea rows={3} placeholder="How did they hear about us? Any context…" value={newLeadForm.notes}
                  onChange={e => setNewLeadForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30 resize-none" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border flex-shrink-0">
              <button onClick={() => setShowNewLead(false)}
                className="px-4 py-2 text-sm font-medium text-muted-foreground border border-border rounded-lg hover:bg-accent transition-colors">
                Cancel
              </button>
              <button onClick={handleCreateLead} disabled={savingLead || !newLeadForm.name.trim()}
                className="px-4 py-2 text-sm font-medium bg-rose-500 text-white rounded-lg hover:bg-rose-600 disabled:opacity-50 transition-colors">
                {savingLead ? "Saving…" : "Create Lead"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* New Opportunity slide-over */}
      {showNewOpp && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => setShowNewOpp(false)}
          />
          {/* Panel */}
          <div className="fixed inset-y-0 right-0 w-96 bg-white border-l border-border shadow-2xl z-50 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
              <h2 className="font-semibold text-foreground">New Opportunity</h2>
              <button
                onClick={() => setShowNewOpp(false)}
                className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form body */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Parkview Estates — Your GateGuard"
                  value={newOppForm.name}
                  onChange={(e) => setNewOppForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Account Name
                </label>
                <input
                  type="text"
                  placeholder="Property or company name"
                  value={newOppForm.account_name}
                  onChange={(e) => setNewOppForm((f) => ({ ...f, account_name: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Amount
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={newOppForm.amount}
                  onChange={(e) => setNewOppForm((f) => ({ ...f, amount: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Close Date
                </label>
                <input
                  type="date"
                  value={newOppForm.close_date}
                  onChange={(e) => setNewOppForm((f) => ({ ...f, close_date: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Stage
                </label>
                <select
                  value={newOppForm.stage}
                  onChange={(e) => setNewOppForm((f) => ({ ...f, stage: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30 bg-white"
                >
                  <option value="meet_present">Meet &amp; Present</option>
                  <option value="survey_request">Survey Request</option>
                  <option value="propose">Propose</option>
                  <option value="negotiate">Negotiate</option>
                </select>
              </div>

              {/* Assign to — only shown when user can assign beyond themselves */}
              {!assignableOrgsSelfOnly && assignableOrgs.length > 1 && (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Assign to <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={newOppForm.org_id}
                    onChange={(e) => setNewOppForm((f) => ({ ...f, org_id: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30 bg-white"
                  >
                    {assignableOrgs.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name} — {org.tier_label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Scoped to your network only
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={newOppForm.description}
                  onChange={(e) => setNewOppForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30 resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border flex-shrink-0">
              <button
                onClick={() => setShowNewOpp(false)}
                className="px-4 py-2 text-sm font-medium text-muted-foreground border border-border rounded-lg hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateOpp}
                disabled={savingOpp || !newOppForm.name.trim()}
                className="px-4 py-2 text-sm font-medium bg-[#6B7EFF] text-white rounded-lg hover:bg-[#5a6de8] disabled:opacity-50 transition-colors"
              >
                {savingOpp ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────
function KpiCard({
  icon,
  label,
  value,
  sub,
  iconBg,
  clickable,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  iconBg: string;
  clickable?: boolean;
}) {
  return (
    <div className={cn("bg-white rounded-xl border border-border p-5 transition-all", clickable && "hover:border-[#6B7EFF]/40 hover:shadow-sm cursor-pointer group")}>
      <div className="flex items-start justify-between mb-3">
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", iconBg)}>
          {icon}
        </div>
        {clickable && <ArrowRight size={13} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />}
      </div>
      <p className="text-2xl font-bold text-foreground leading-tight">{value}</p>
      <p className="text-sm font-medium text-foreground mt-0.5">{label}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
    </div>
  );
}

// Suppress unused import warnings
void UserPlus;
