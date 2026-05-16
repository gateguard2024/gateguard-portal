"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import {
  ChevronRight, Check, Phone, Mail,
  ClipboardList, StickyNote, Plus, X, Pencil,
  ExternalLink, Wrench, FileText, Zap,
  ChevronLeft, Trash2, RefreshCw, AlertCircle,
} from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { CalendarClock } = require("lucide-react") as any;
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────
type Stage =
  | "meet_present"
  | "survey_request"
  | "propose"
  | "negotiate"
  | "won"
  | "lost";

type ActivityType = "call" | "email" | "meeting" | "task" | "note";
type Tab = "details" | "activity";

interface Contact {
  id: string;
  name: string;
  title?: string;
  phone?: string;
  email?: string;
  role?: string;
}

interface Activity {
  id: string;
  type: ActivityType;
  subject: string;
  body?: string;
  outcome?: string;
  duration_mins?: number;
  due_at?: string;
  created_at: string;
  completed_at?: string | null;
  created_by_name?: string;
  opportunity_name?: string;
}

interface StageHistoryItem {
  id: string;
  stage: Stage;
  amount?: number;
  changed_at: string;
  changed_by?: string;
}

interface Opportunity {
  id: string;
  name: string;
  account_name: string;
  stage: Stage;
  amount: number;
  close_date?: string;
  description?: string;
  owner_name?: string;
  owner_initials?: string;
  site_contact_name?: string;
  site_contact_phone?: string;
  site_contact_email?: string;
  next_step?: string;
  probability?: number;
  forecast_category?: string;
  units?: number;
  vehicle_gates?: number;
  pedestrian_gates?: number;
  amenity_doors?: number;
  existing_cameras?: number;
  new_cameras?: number;
  est_deposit?: number;
  monthly_per_unit?: number;
  monthly_total?: number;
  est_mrr?: number;
  directv_package?: string;
  isp_service?: string;
  mdu_contract_expiry?: string;
  quote_url?: string;
  contacts: Contact[];
  activities: Activity[];
  stage_history: StageHistoryItem[];
  created_at: string;
  won_at?: string;
}

// ── Stage Config ──────────────────────────────────────────────────────────
const STAGE_CONFIG: Record<
  Stage,
  { label: string; dot: string; pill: string; guidance: string }
> = {
  meet_present: {
    label: "Meet & Present",
    dot: "bg-blue-400",
    pill: "bg-blue-100 text-blue-700",
    guidance:
      "Schedule an on-site visit. Understand their current pain points. Has a demo been shown?",
  },
  survey_request: {
    label: "Survey Request",
    dot: "bg-violet-400",
    pill: "bg-violet-100 text-violet-700",
    guidance:
      "Conduct the site walk via the /tech Survey tool. Capture full device inventory and auto-generate SOW.",
  },
  propose: {
    label: "Propose",
    dot: "bg-amber-400",
    pill: "bg-amber-100 text-amber-700",
    guidance:
      "Send the quote. Does it cover the complete solution? Present how GateGuard solves their specific problems.",
  },
  negotiate: {
    label: "Negotiate",
    dot: "bg-orange-400",
    pill: "bg-orange-100 text-orange-700",
    guidance:
      'Make the offer. Address objections. Share the Elevate Model: residents fund it at $150/yr each.',
  },
  won: {
    label: "Closed Won",
    dot: "bg-emerald-500",
    pill: "bg-emerald-100 text-emerald-700",
    guidance:
      "🎉 Closed! Create the work order and schedule kickoff within 48 hours.",
  },
  lost: {
    label: "Lost",
    dot: "bg-red-400",
    pill: "bg-red-100 text-red-600",
    guidance: "",
  },
};

const AI_TIPS: Record<Stage, { tip: string; showAria?: boolean }> = {
  meet_present: {
    tip: "Reference their specific property. ARIA can mine public reviews for pain signals.",
    showAria: true,
  },
  survey_request: {
    tip: "Use /tech Site Survey to capture the full device inventory. It auto-generates your SOW.",
    showAria: true,
  },
  propose: {
    tip: "The Elevate Model closes deals: 100 units × $150/yr = $15K/yr resident revenue. Net profit after GG cost: $10K+/yr.",
    showAria: false,
  },
  negotiate: {
    tip: "Counter 'too expensive' with: 'Residents fund it at $150/yr. Your net after GG cost is under $3/unit/mo.'",
    showAria: false,
  },
  won: {
    tip: "Create the work order now. Strike while momentum is hot. Kickoff within 48 hours drives 3x install success rate.",
    showAria: false,
  },
  lost: {
    tip: "Log the loss reason to train the pipeline. Every lost deal teaches the next win.",
    showAria: false,
  },
};

const ORDERED_STAGES: Stage[] = [
  "meet_present",
  "survey_request",
  "propose",
  "negotiate",
  "won",
];

// ── Helpers ───────────────────────────────────────────────────────────────
function fmt$(n: number | undefined | null): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function fmtDate(iso: string | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function activityTypeColor(type: ActivityType): string {
  switch (type) {
    case "call":    return "bg-blue-100 text-blue-600";
    case "email":   return "bg-violet-100 text-violet-600";
    case "meeting": return "bg-amber-100 text-amber-600";
    case "task":    return "bg-emerald-100 text-emerald-600";
    default:        return "bg-slate-100 text-slate-600";
  }
}

function ActivityIcon({ type, size = 14 }: { type: ActivityType; size?: number }) {
  switch (type) {
    case "call":    return <Phone size={size} />;
    case "email":   return <Mail size={size} />;
    case "meeting": return <CalendarClock size={size} />;
    case "task":    return <ClipboardList size={size} />;
    default:        return <StickyNote size={size} />;
  }
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function OpportunityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [opp, setOpp] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("details");

  // Edit slide-over
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    account_name: "",
    amount: "",
    close_date: "",
    stage: "" as Stage | "",
    description: "",
    next_step: "",
    probability: "",
    forecast_cat: "",
  });
  const [editSaving, setEditSaving] = useState(false);

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Activity forms
  const [showLogCall, setShowLogCall] = useState(false);
  const [showNewTask, setShowNewTask] = useState(false);
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [showEmail, setShowEmail] = useState(false);

  // Stage progression
  const [stageSaving, setStageSaving] = useState(false);

  // Follow
  const [following, setFollowing] = useState(false);
  const [followToast, setFollowToast] = useState(false);
  const handleFollow = () => {
    setFollowing(f => !f);
    setFollowToast(true);
    setTimeout(() => setFollowToast(false), 2000);
  };

  // Contact form
  const [showAddContact, setShowAddContact] = useState(false);
  const [contactForm, setContactForm] = useState({ name: "", title: "", phone: "", email: "", role: "" });
  const [savingContact, setSavingContact] = useState(false);

  // Activity forms state
  const [callForm, setCallForm] = useState({ subject: "", outcome: "Connected", duration: "", notes: "" });
  const [taskForm, setTaskForm] = useState({ subject: "", due_date: "", notes: "" });
  const [eventForm, setEventForm] = useState({ subject: "", date: "", time: "", notes: "" });
  const [emailForm, setEmailForm] = useState({ subject: "", body: "" });
  const [activitySaving, setActivitySaving] = useState(false);

  const fetchOpp = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/crm/opportunities/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setOpp(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchOpp();
  }, [id]);

  const advanceStage = async () => {
    if (!opp) return;
    const currentIdx = ORDERED_STAGES.indexOf(opp.stage);
    if (currentIdx === -1 || currentIdx >= ORDERED_STAGES.length - 1) return;
    const nextStage = ORDERED_STAGES[currentIdx + 1];
    setStageSaving(true);
    try {
      await fetch(`/api/crm/opportunities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: nextStage }),
      });
      await fetchOpp();
    } finally {
      setStageSaving(false);
    }
  };

  const submitActivity = async (
    type: ActivityType,
    payload: Record<string, unknown>
  ) => {
    setActivitySaving(true);
    try {
      await fetch(`/api/crm/opportunities/${id}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, created_by_name: "Russel Feldman", ...payload }),
      });
      await fetchOpp();
      setShowLogCall(false);
      setShowNewTask(false);
      setShowNewEvent(false);
      setShowEmail(false);
      setCallForm({ subject: "", outcome: "Connected", duration: "", notes: "" });
      setTaskForm({ subject: "", due_date: "", notes: "" });
      setEventForm({ subject: "", date: "", time: "", notes: "" });
      setEmailForm({ subject: "", body: "" });
    } finally {
      setActivitySaving(false);
    }
  };

  const saveContact = async () => {
    if (!contactForm.name.trim()) return;
    setSavingContact(true);
    try {
      await fetch(`/api/crm/opportunities/${id}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contactForm),
      });
      await fetchOpp();
      setShowAddContact(false);
      setContactForm({ name: "", title: "", phone: "", email: "", role: "" });
    } finally {
      setSavingContact(false);
    }
  };

  // Pre-fill edit form when slide-over opens
  useEffect(() => {
    if (showEdit && opp) {
      setEditForm({
        name: opp.name ?? "",
        account_name: opp.account_name ?? "",
        amount: opp.amount != null ? String(opp.amount) : "",
        close_date: opp.close_date ? opp.close_date.slice(0, 10) : "",
        stage: opp.stage ?? "",
        description: opp.description ?? "",
        next_step: opp.next_step ?? "",
        probability: opp.probability != null ? String(opp.probability) : "",
        forecast_cat: opp.forecast_category ?? "",
      });
    }
  }, [showEdit]);

  const saveEdit = async () => {
    setEditSaving(true);
    try {
      await fetch(`/api/crm/opportunities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name || undefined,
          account_name: editForm.account_name || undefined,
          amount: editForm.amount !== "" ? Number(editForm.amount) : undefined,
          close_date: editForm.close_date || undefined,
          stage: editForm.stage || undefined,
          description: editForm.description || undefined,
          next_step: editForm.next_step || undefined,
          probability: editForm.probability !== "" ? Number(editForm.probability) : undefined,
          forecast_category: editForm.forecast_cat || undefined,
        }),
      });
      await fetchOpp();
      setShowEdit(false);
    } finally {
      setEditSaving(false);
    }
  };

  const deleteOpp = async () => {
    setDeleting(true);
    try {
      await fetch(`/api/crm/opportunities/${id}`, { method: "DELETE" });
      router.push("/crm");
    } finally {
      setDeleting(false);
    }
  };

  // ── Loading & Error ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC]">
        <TopBar title="Opportunity" subtitle="Loading…" />
        <div className="px-6 py-6 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-white rounded-xl border border-border animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !opp) {
    return (
      <div className="min-h-screen bg-[#F8FAFC]">
        <TopBar title="Opportunity" />
        <div className="px-6 py-6">
          <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700">
            <AlertCircle size={16} />
            <span className="text-sm flex-1">{error ?? "Opportunity not found"}</span>
            <button onClick={fetchOpp} className="text-xs font-medium underline">
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const cfg = STAGE_CONFIG[opp.stage];
  const stageIdx = ORDERED_STAGES.indexOf(opp.stage);
  const canAdvance = opp.stage !== "won" && opp.stage !== "lost";
  const aiTip = AI_TIPS[opp.stage];

  // Sort activities newest first
  const sortedActivities = [...(opp.activities ?? [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Stage history newest first
  const sortedHistory = [...(opp.stage_history ?? [])].sort(
    (a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime()
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Top Bar */}
      <TopBar
        title={opp.name}
        subtitle="Opportunity Detail"
        actions={
          <div className="flex items-center gap-2">
            {followToast && (
              <span className="text-xs text-emerald-600 font-medium animate-in fade-in">
                {following ? "Following!" : "Unfollowed"}
              </span>
            )}
            <button
              onClick={handleFollow}
              className={cn(
                "px-3 py-1.5 text-sm border rounded-lg hover:bg-accent transition-colors",
                following ? "border-[#6B7EFF] text-[#6B7EFF] bg-[#6B7EFF]/5" : "border-border"
              )}
            >
              {following ? "✓ Following" : "Follow"}
            </button>
            <button
              onClick={() => setShowEdit(true)}
              className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-accent transition-colors flex items-center gap-1"
            >
              <Pencil size={12} />
              Edit
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-1"
            >
              <Trash2 size={12} />
              Delete
            </button>
          </div>
        }
      />

      {/* Breadcrumb + Meta */}
      <div className="bg-white border-b border-border px-6 py-4">
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
          <Link href="/crm/opportunities" className="hover:text-[#6B7EFF] transition-colors">
            Opportunities
          </Link>
          <ChevronRight size={12} />
          <span className="text-foreground font-medium truncate">{opp.name}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {opp.account_name && (
            <span className="text-sm text-[#6B7EFF] font-medium">{opp.account_name}</span>
          )}
          <span className="text-sm font-bold text-foreground">{fmt$(opp.amount)}</span>
          {opp.close_date && (
            <span className="text-sm text-muted-foreground">
              Close: {fmtDate(opp.close_date)}
            </span>
          )}
          {opp.owner_name && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <div className="w-5 h-5 rounded-full bg-[#6B7EFF]/20 border border-[#6B7EFF]/30 flex items-center justify-center text-[9px] font-bold text-[#6B7EFF]">
                {opp.owner_initials ?? opp.owner_name.slice(0, 2).toUpperCase()}
              </div>
              {opp.owner_name}
            </div>
          )}
        </div>
      </div>

      {/* Stage Progress Bar */}
      <div className="bg-white border-b border-border px-6 py-4">
        <div className="flex items-stretch gap-0 mb-3 rounded-lg overflow-hidden border border-border">
          {ORDERED_STAGES.map((s, i) => {
            const sCfg = STAGE_CONFIG[s];
            const isPast = i < stageIdx;
            const isCurrent = i === stageIdx;
            const isFuture = i > stageIdx;
            return (
              <div
                key={s}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 text-xs font-medium border-r last:border-r-0 border-border transition-colors",
                  isPast && "bg-emerald-50 text-emerald-700",
                  isCurrent && "bg-[#6B7EFF] text-white",
                  isFuture && "bg-white text-muted-foreground"
                )}
              >
                {isPast && <Check size={11} />}
                <span className="truncate hidden sm:inline">{sCfg.label}</span>
                <span className="sm:hidden truncate">{sCfg.label.split(" ")[0]}</span>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs italic text-muted-foreground max-w-lg">
            {cfg.guidance}
          </p>
          {canAdvance && (
            <button
              onClick={advanceStage}
              disabled={stageSaving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#6B7EFF] text-white rounded-lg hover:bg-[#5a6de8] disabled:opacity-50 transition-colors flex-shrink-0 ml-4"
            >
              {stageSaving ? (
                <RefreshCw size={12} className="animate-spin" />
              ) : (
                <ChevronRight size={12} />
              )}
              {stageSaving ? "Saving…" : "Mark Stage as Complete →"}
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 py-5 grid grid-cols-3 gap-6">
        {/* LEFT — col-span-2 */}
        <div className="col-span-2 space-y-5">
          {/* Tab Bar */}
          <div className="flex items-center gap-1 border-b border-border">
            {(["details", "activity"] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize",
                  activeTab === tab
                    ? "border-[#6B7EFF] text-[#6B7EFF]"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {tab === "activity" ? "Activity" : "Details"}
              </button>
            ))}
          </div>

          {/* ── DETAILS TAB ── */}
          {activeTab === "details" && (
            <div className="space-y-4">
              {/* About */}
              <DetailCard title="About">
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <FieldRow label="Opportunity Name" value={opp.name} />
                  <FieldRow label="Account Name" value={opp.account_name} />
                  <FieldRow label="Close Date" value={fmtDate(opp.close_date)} />
                  <FieldRow label="Amount" value={opp.amount != null ? fmt$(opp.amount) : undefined} />
                  <FieldRow label="Description" value={opp.description} className="col-span-2" />
                  <FieldRow label="Opportunity Owner" value={opp.owner_name} />
                  <FieldRow label="Site Point of Contact" value={opp.site_contact_name} />
                  <FieldRow label="Site Phone Number" value={opp.site_contact_phone} />
                  <FieldRow label="Site Contact E-Mail" value={opp.site_contact_email} />
                  <FieldRow label="Next Step" value={opp.next_step} className="col-span-2" />
                  <FieldRow label="Probability %" value={opp.probability != null ? `${opp.probability}%` : undefined} />
                  <FieldRow label="Forecast Category" value={opp.forecast_category} />
                  <FieldRow label="Stage" value={cfg.label} />
                </div>
              </DetailCard>

              {/* Property Specs */}
              <DetailCard title="Property Specs">
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <FieldRow label="Number of Units" value={opp.units != null ? String(opp.units) : undefined} />
                  <FieldRow label="Vehicle Gates" value={opp.vehicle_gates != null ? String(opp.vehicle_gates) : undefined} />
                  <FieldRow label="Pedestrian Gates" value={opp.pedestrian_gates != null ? String(opp.pedestrian_gates) : undefined} />
                  <FieldRow label="Amenity Doors" value={opp.amenity_doors != null ? String(opp.amenity_doors) : undefined} />
                  <FieldRow label="Existing Cameras" value={opp.existing_cameras != null ? String(opp.existing_cameras) : undefined} />
                  <FieldRow label="New Cameras" value={opp.new_cameras != null ? String(opp.new_cameras) : undefined} />
                </div>
              </DetailCard>

              {/* Financial Details */}
              <DetailCard title="Financial Details">
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <FieldRow label="Est. Deposit" value={opp.est_deposit != null ? fmt$(opp.est_deposit) : undefined} />
                  <FieldRow label="Monthly Per Unit" value={opp.monthly_per_unit != null ? fmt$(opp.monthly_per_unit) : undefined} />
                  <FieldRow label="Monthly Total" value={opp.monthly_total != null ? fmt$(opp.monthly_total) : undefined} />
                  <FieldRow label="Est. MRR" value={opp.est_mrr != null ? fmt$(opp.est_mrr) : undefined} />
                  <FieldRow label="DirecTV Package" value={opp.directv_package} />
                  <FieldRow label="ISP Service" value={opp.isp_service} />
                  <FieldRow label="MDU Contract Expiry" value={fmtDate(opp.mdu_contract_expiry)} />
                </div>
              </DetailCard>
            </div>
          )}

          {/* ── ACTIVITY TAB ── */}
          {activeTab === "activity" && (
            <div className="space-y-4">
              {/* Action buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <ActivityToggleBtn
                  icon={<Phone size={13} />}
                  label="Log a Call"
                  active={showLogCall}
                  onClick={() => { setShowLogCall(!showLogCall); setShowNewTask(false); setShowNewEvent(false); setShowEmail(false); }}
                />
                <ActivityToggleBtn
                  icon={<Mail size={13} />}
                  label="Email"
                  active={showEmail}
                  onClick={() => { setShowEmail(!showEmail); setShowLogCall(false); setShowNewTask(false); setShowNewEvent(false); }}
                />
                <ActivityToggleBtn
                  icon={<CalendarClock size={13} />}
                  label="New Event"
                  active={showNewEvent}
                  onClick={() => { setShowNewEvent(!showNewEvent); setShowLogCall(false); setShowNewTask(false); setShowEmail(false); }}
                />
                <ActivityToggleBtn
                  icon={<ClipboardList size={13} />}
                  label="New Task"
                  active={showNewTask}
                  onClick={() => { setShowNewTask(!showNewTask); setShowLogCall(false); setShowNewEvent(false); setShowEmail(false); }}
                />
              </div>

              {/* Log a Call form */}
              {showLogCall && (
                <ActivityFormCard title="Log a Call" onClose={() => setShowLogCall(false)}>
                  <Field label="Subject">
                    <input type="text" value={callForm.subject} onChange={e => setCallForm({...callForm, subject: e.target.value})} className={inputCls} placeholder="e.g. Intro call with Maria" />
                  </Field>
                  <Field label="Outcome">
                    <select value={callForm.outcome} onChange={e => setCallForm({...callForm, outcome: e.target.value})} className={inputCls}>
                      <option>Connected</option>
                      <option>Voicemail</option>
                      <option>No Answer</option>
                    </select>
                  </Field>
                  <Field label="Duration (mins)">
                    <input type="number" value={callForm.duration} onChange={e => setCallForm({...callForm, duration: e.target.value})} className={inputCls} placeholder="e.g. 15" />
                  </Field>
                  <Field label="Notes">
                    <textarea value={callForm.notes} onChange={e => setCallForm({...callForm, notes: e.target.value})} rows={3} className={cn(inputCls, "resize-none")} placeholder="What was discussed…" />
                  </Field>
                  <button
                    onClick={() => submitActivity("call", { subject: callForm.subject, outcome: callForm.outcome, duration_mins: callForm.duration ? parseInt(callForm.duration) : undefined, body: callForm.notes })}
                    disabled={activitySaving || !callForm.subject.trim()}
                    className="w-full py-2 text-sm font-medium bg-[#6B7EFF] text-white rounded-lg hover:bg-[#5a6de8] disabled:opacity-50 transition-colors"
                  >
                    {activitySaving ? "Saving…" : "Save Call"}
                  </button>
                </ActivityFormCard>
              )}

              {/* New Task form */}
              {showNewTask && (
                <ActivityFormCard title="New Task" onClose={() => setShowNewTask(false)}>
                  <Field label="Subject">
                    <input type="text" value={taskForm.subject} onChange={e => setTaskForm({...taskForm, subject: e.target.value})} className={inputCls} placeholder="e.g. Send proposal deck" />
                  </Field>
                  <Field label="Due Date">
                    <input type="date" value={taskForm.due_date} onChange={e => setTaskForm({...taskForm, due_date: e.target.value})} className={inputCls} />
                  </Field>
                  <Field label="Notes">
                    <textarea value={taskForm.notes} onChange={e => setTaskForm({...taskForm, notes: e.target.value})} rows={2} className={cn(inputCls, "resize-none")} placeholder="Additional context…" />
                  </Field>
                  <button
                    onClick={() => submitActivity("task", { subject: taskForm.subject, due_at: taskForm.due_date ? new Date(taskForm.due_date).toISOString() : undefined, body: taskForm.notes })}
                    disabled={activitySaving || !taskForm.subject.trim()}
                    className="w-full py-2 text-sm font-medium bg-[#6B7EFF] text-white rounded-lg hover:bg-[#5a6de8] disabled:opacity-50 transition-colors"
                  >
                    {activitySaving ? "Saving…" : "Create Task"}
                  </button>
                </ActivityFormCard>
              )}

              {/* New Event form */}
              {showNewEvent && (
                <ActivityFormCard title="New Event" onClose={() => setShowNewEvent(false)}>
                  <Field label="Subject">
                    <input type="text" value={eventForm.subject} onChange={e => setEventForm({...eventForm, subject: e.target.value})} className={inputCls} placeholder="e.g. Site walkthrough" />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Date">
                      <input type="date" value={eventForm.date} onChange={e => setEventForm({...eventForm, date: e.target.value})} className={inputCls} />
                    </Field>
                    <Field label="Time">
                      <input type="time" value={eventForm.time} onChange={e => setEventForm({...eventForm, time: e.target.value})} className={inputCls} />
                    </Field>
                  </div>
                  <Field label="Notes">
                    <textarea value={eventForm.notes} onChange={e => setEventForm({...eventForm, notes: e.target.value})} rows={2} className={cn(inputCls, "resize-none")} placeholder="Agenda or prep notes…" />
                  </Field>
                  <button
                    onClick={() => {
                      const due = eventForm.date ? new Date(`${eventForm.date}T${eventForm.time || "09:00"}`).toISOString() : undefined;
                      submitActivity("meeting", { subject: eventForm.subject, due_at: due, body: eventForm.notes });
                    }}
                    disabled={activitySaving || !eventForm.subject.trim()}
                    className="w-full py-2 text-sm font-medium bg-[#6B7EFF] text-white rounded-lg hover:bg-[#5a6de8] disabled:opacity-50 transition-colors"
                  >
                    {activitySaving ? "Saving…" : "Create Event"}
                  </button>
                </ActivityFormCard>
              )}

              {/* Email form */}
              {showEmail && (
                <ActivityFormCard title="Email" onClose={() => setShowEmail(false)}>
                  <Field label="Subject">
                    <input type="text" value={emailForm.subject} onChange={e => setEmailForm({...emailForm, subject: e.target.value})} className={inputCls} placeholder="e.g. GateGuard proposal for Ashford Glen" />
                  </Field>
                  <Field label="Body">
                    <textarea value={emailForm.body} onChange={e => setEmailForm({...emailForm, body: e.target.value})} rows={5} className={cn(inputCls, "resize-none")} placeholder="Email body…" />
                  </Field>
                  <button
                    onClick={() => submitActivity("email", { subject: emailForm.subject, body: emailForm.body })}
                    disabled={activitySaving || !emailForm.subject.trim()}
                    className="w-full py-2 text-sm font-medium bg-[#6B7EFF] text-white rounded-lg hover:bg-[#5a6de8] disabled:opacity-50 transition-colors"
                  >
                    {activitySaving ? "Saving…" : "Log Email"}
                  </button>
                </ActivityFormCard>
              )}

              {/* Activity Feed */}
              <div className="space-y-2">
                {sortedActivities.length === 0 ? (
                  <div className="text-center py-10 text-sm text-muted-foreground">
                    No activity yet. Log a call to get started.
                  </div>
                ) : (
                  sortedActivities.map((act) => (
                    <div
                      key={act.id}
                      className="flex items-start gap-3 px-4 py-3 bg-white rounded-xl border border-border"
                    >
                      <div
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                          activityTypeColor(act.type)
                        )}
                      >
                        <ActivityIcon type={act.type} size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">{act.subject}</p>
                        {act.body && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{act.body}</p>
                        )}
                        {act.outcome && (
                          <span className="inline-block mt-1 text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                            {act.outcome}
                          </span>
                        )}
                        {act.created_by_name && (
                          <p className="text-[10px] text-muted-foreground mt-1">{act.created_by_name}</p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0 font-mono">
                        {timeAgo(act.created_at)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — col-span-1 */}
        <div className="space-y-4">
          {/* Contact Roles */}
          <div className="bg-white rounded-xl border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">Contact Roles</h3>
              <button
                onClick={() => setShowAddContact(!showAddContact)}
                className="text-xs text-[#6B7EFF] hover:underline"
              >
                {showAddContact ? "Cancel" : "+ Add Contact"}
              </button>
            </div>

            {showAddContact && (
              <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-border space-y-2">
                <input type="text" placeholder="Full Name *" value={contactForm.name} onChange={e => setContactForm({...contactForm, name: e.target.value})} className={cn(inputCls, "text-xs py-1.5")} />
                <input type="text" placeholder="Title" value={contactForm.title} onChange={e => setContactForm({...contactForm, title: e.target.value})} className={cn(inputCls, "text-xs py-1.5")} />
                <input type="tel" placeholder="Phone" value={contactForm.phone} onChange={e => setContactForm({...contactForm, phone: e.target.value})} className={cn(inputCls, "text-xs py-1.5")} />
                <input type="email" placeholder="Email" value={contactForm.email} onChange={e => setContactForm({...contactForm, email: e.target.value})} className={cn(inputCls, "text-xs py-1.5")} />
                <select value={contactForm.role} onChange={e => setContactForm({...contactForm, role: e.target.value})} className={cn(inputCls, "text-xs py-1.5")}>
                  <option value="">Role…</option>
                  <option>Decision Maker</option>
                  <option>Property Manager</option>
                  <option>HOA President</option>
                  <option>Maintenance</option>
                  <option>Other</option>
                </select>
                <button
                  onClick={saveContact}
                  disabled={savingContact || !contactForm.name.trim()}
                  className="w-full py-1.5 text-xs font-medium bg-[#6B7EFF] text-white rounded-lg disabled:opacity-50"
                >
                  {savingContact ? "Saving…" : "Add Contact"}
                </button>
              </div>
            )}

            {(opp.contacts ?? []).length === 0 && !showAddContact ? (
              <p className="text-xs text-muted-foreground">No contacts added yet</p>
            ) : (
              <div className="space-y-2">
                {(opp.contacts ?? []).map((c) => (
                  <div key={c.id} className="flex items-start gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-100 border border-border flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0">
                      {(c.name ?? "?").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                      {c.title && <p className="text-xs text-muted-foreground truncate">{c.title}</p>}
                      {c.role && (
                        <span className="inline-block text-[10px] bg-[#6B7EFF]/10 text-[#6B7EFF] px-1.5 py-0.5 rounded-full mt-0.5">
                          {c.role}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stage History */}
          <div className="bg-white rounded-xl border border-border p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Stage History</h3>
            {sortedHistory.length === 0 ? (
              <p className="text-xs text-muted-foreground">No stage changes recorded</p>
            ) : (
              <div className="space-y-2">
                {sortedHistory.slice(0, 5).map((h) => {
                  const hCfg = STAGE_CONFIG[h.stage];
                  return (
                    <div key={h.id} className="flex items-start gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0",
                          hCfg.pill
                        )}
                      >
                        {hCfg.label}
                      </span>
                      <div className="flex-1 min-w-0">
                        {h.amount != null && (
                          <span className="text-xs text-muted-foreground">{fmt$(h.amount)}</span>
                        )}
                        <p className="text-[10px] text-muted-foreground font-mono">
                          {fmtDate(h.changed_at)}
                          {h.changed_by && ` · ${h.changed_by}`}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {sortedHistory.length > 5 && (
                  <button className="text-xs text-[#6B7EFF] hover:underline mt-1">
                    View all ({sortedHistory.length})
                  </button>
                )}
              </div>
            )}
          </div>

          {/* AI Sales Assistant */}
          <div className="bg-[#6B7EFF]/5 rounded-xl border border-[#6B7EFF]/40 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={14} className="text-[#6B7EFF]" />
              <h3 className="text-sm font-semibold text-[#6B7EFF]">AI Sales Assistant</h3>
            </div>
            <p className="text-xs text-foreground leading-relaxed">{aiTip.tip}</p>
            {aiTip.showAria && (
              <Link
                href="/aria"
                className="inline-flex items-center gap-1 mt-3 text-xs text-[#6B7EFF] hover:underline font-medium"
              >
                Run ARIA Research →
                <ExternalLink size={10} />
              </Link>
            )}
          </div>

          {/* Portal Links */}
          <div className="bg-white rounded-xl border border-border p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Portal Links</h3>
            <div className="space-y-1.5">
              {opp.quote_url ? (
                <a
                  href={opp.quote_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent transition-colors text-sm"
                >
                  <FileText size={14} className="text-[#6B7EFF]" />
                  <span className="text-foreground">View Quote</span>
                  <ExternalLink size={11} className="text-muted-foreground ml-auto" />
                </a>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm opacity-50 cursor-not-allowed">
                  <FileText size={14} className="text-muted-foreground" />
                  <span className="text-muted-foreground">View Quote</span>
                </div>
              )}

              <Link
                href="/tech"
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent transition-colors text-sm"
              >
                <Wrench size={14} className="text-[#6B7EFF]" />
                <span className="text-foreground">Site Survey</span>
                <ExternalLink size={11} className="text-muted-foreground ml-auto" />
              </Link>

              {opp.stage === "won" ? (
                <Link
                  href="/maintenance"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent transition-colors text-sm"
                >
                  <ClipboardList size={14} className="text-[#6B7EFF]" />
                  <span className="text-foreground">Work Order</span>
                  <ExternalLink size={11} className="text-muted-foreground ml-auto" />
                </Link>
              ) : (
                <div
                  title="Available after Closed Won"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm opacity-50 cursor-not-allowed"
                >
                  <ClipboardList size={14} className="text-muted-foreground" />
                  <span className="text-muted-foreground">Work Order</span>
                  <span className="text-[10px] text-muted-foreground ml-auto">Won only</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Edit Slide-Over ────────────────────────────────────────────── */}
      {showEdit && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setShowEdit(false)}
          />
          {/* Panel */}
          <div className="fixed inset-y-0 right-0 w-96 bg-white border-l border-border shadow-2xl z-50 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
              <h2 className="text-sm font-semibold text-foreground">Edit Opportunity</h2>
              <button
                onClick={() => setShowEdit(false)}
                className="p-1 hover:bg-accent rounded text-muted-foreground"
              >
                <X size={16} />
              </button>
            </div>
            {/* Fields */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <Field label="Opportunity Name">
                <input
                  type="text"
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  className={inputCls}
                  placeholder="e.g. Ashford Glen — Phase 2"
                />
              </Field>
              <Field label="Account Name">
                <input
                  type="text"
                  value={editForm.account_name}
                  onChange={e => setEditForm({ ...editForm, account_name: e.target.value })}
                  className={inputCls}
                  placeholder="e.g. Ashford Glen"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Amount ($)">
                  <input
                    type="number"
                    value={editForm.amount}
                    onChange={e => setEditForm({ ...editForm, amount: e.target.value })}
                    className={inputCls}
                    placeholder="0"
                    min={0}
                  />
                </Field>
                <Field label="Probability (%)">
                  <input
                    type="number"
                    value={editForm.probability}
                    onChange={e => setEditForm({ ...editForm, probability: e.target.value })}
                    className={inputCls}
                    placeholder="0–100"
                    min={0}
                    max={100}
                  />
                </Field>
              </div>
              <Field label="Close Date">
                <input
                  type="date"
                  value={editForm.close_date}
                  onChange={e => setEditForm({ ...editForm, close_date: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Stage">
                <select
                  value={editForm.stage}
                  onChange={e => setEditForm({ ...editForm, stage: e.target.value as Stage })}
                  className={inputCls}
                >
                  <option value="">Select stage…</option>
                  {(Object.keys(STAGE_CONFIG) as Stage[]).map(s => (
                    <option key={s} value={s}>{STAGE_CONFIG[s].label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Forecast Category">
                <input
                  type="text"
                  value={editForm.forecast_cat}
                  onChange={e => setEditForm({ ...editForm, forecast_cat: e.target.value })}
                  className={inputCls}
                  placeholder="e.g. Commit, Best Case, Pipeline"
                />
              </Field>
              <Field label="Next Step">
                <input
                  type="text"
                  value={editForm.next_step}
                  onChange={e => setEditForm({ ...editForm, next_step: e.target.value })}
                  className={inputCls}
                  placeholder="e.g. Send proposal deck by Friday"
                />
              </Field>
              <Field label="Description">
                <textarea
                  value={editForm.description}
                  onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                  rows={4}
                  className={cn(inputCls, "resize-none")}
                  placeholder="Additional context about this opportunity…"
                />
              </Field>
            </div>
            {/* Footer */}
            <div className="flex items-center gap-3 px-5 py-4 border-t border-border flex-shrink-0">
              <button
                onClick={() => setShowEdit(false)}
                className="flex-1 py-2 text-sm border border-border rounded-lg hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={editSaving || !editForm.name.trim()}
                className="flex-1 py-2 text-sm font-medium bg-[#6B7EFF] text-white rounded-lg hover:bg-[#5a6de8] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {editSaving && <RefreshCw size={13} className="animate-spin" />}
                {editSaving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Delete Confirmation Modal ──────────────────────────────────── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-border shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 size={16} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Delete this opportunity?</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  This cannot be undone. All associated contacts, activities, and stage history will be permanently removed.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 py-2 text-sm border border-border rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={deleteOpp}
                disabled={deleting}
                className="flex-1 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {deleting && <RefreshCw size={13} className="animate-spin" />}
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────
function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-border p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4 pb-2 border-b border-border">
        {title}
      </h3>
      {children}
    </div>
  );
}

function FieldRow({
  label,
  value,
  className,
}: {
  label: string;
  value?: string | null;
  className?: string;
}) {
  return (
    <div className={cn("group", className)}>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5 font-medium">
        {label}
      </p>
      <p className="text-sm text-foreground">{value ?? "—"}</p>
    </div>
  );
}

function ActivityToggleBtn({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg transition-colors",
        active
          ? "bg-[#6B7EFF] text-white border-[#6B7EFF]"
          : "border-border text-foreground hover:bg-accent"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function ActivityFormCard({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-[#6B7EFF]/30 p-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        <button onClick={onClose} className="p-0.5 hover:bg-accent rounded text-muted-foreground">
          <X size={14} />
        </button>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#6B7EFF] bg-white";
