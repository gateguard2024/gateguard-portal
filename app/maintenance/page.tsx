"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { AISearch } from "@/components/ai/AISearch";
import {
  Plus, Wrench, CheckCircle2, Clock, AlertTriangle, Calendar,
  User, X, ChevronDown, RefreshCw, Trash2, ChevronRight,
} from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Edit2 } = require('lucide-react') as any;
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type WOStatus   = "open" | "in_progress" | "scheduled" | "completed" | "cancelled";
type WOPriority = "urgent" | "high" | "medium" | "low";
type JobType    = "Install" | "Repair" | "PM" | "Site Walk";

interface WorkOrder {
  id: string;
  wo_number: string;
  title: string;
  description?: string;
  customer_name: string;
  assignee_id?: string;
  assignee_name?: string;
  priority: WOPriority;
  status: WOStatus;
  job_type: JobType;
  scheduled_date?: string;
  due_date?: string;
  completed_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

interface Technician {
  id: string;
  name: string;
  initials: string;
  role: string;
}

// ── Config ────────────────────────────────────────────────────────────────────

const priorityConfig: Record<WOPriority, { bg: string; text: string; label: string }> = {
  urgent: { bg: "bg-red-500/10",    text: "text-red-400",    label: "Urgent" },
  high:   { bg: "bg-red-500/10",    text: "text-red-400",    label: "High"   },
  medium: { bg: "bg-amber-500/10",  text: "text-amber-400",  label: "Medium" },
  low:    { bg: "bg-slate-500/10",  text: "text-slate-400",  label: "Low"    },
};

const statusConfig: Record<WOStatus, { label: string; icon: React.ElementType; bg: string; text: string }> = {
  open:        { label: "Open",        icon: Clock,          bg: "bg-blue-500/10",    text: "text-blue-400"    },
  in_progress: { label: "In Progress", icon: Wrench,         bg: "bg-amber-500/10",   text: "text-amber-400"   },
  scheduled:   { label: "Scheduled",   icon: Calendar,       bg: "bg-violet-500/10",  text: "text-violet-400"  },
  completed:   { label: "Completed",   icon: CheckCircle2,   bg: "bg-emerald-500/10", text: "text-emerald-400" },
  cancelled:   { label: "Cancelled",   icon: X,              bg: "bg-slate-500/10",   text: "text-slate-400"   },
};

const JOB_TYPES: JobType[] = ["Install", "Repair", "PM", "Site Walk"];
const PRIORITIES: { value: WOPriority; label: string }[] = [
  { value: "urgent", label: "🔴 Urgent" },
  { value: "high",   label: "🟠 High"   },
  { value: "medium", label: "🔵 Medium" },
  { value: "low",    label: "⚪ Low"    },
];
const STATUSES: { value: WOStatus; label: string }[] = [
  { value: "open",        label: "Open"        },
  { value: "in_progress", label: "In Progress" },
  { value: "scheduled",   label: "Scheduled"   },
  { value: "completed",   label: "Completed"   },
  { value: "cancelled",   label: "Cancelled"   },
];

// ── New Work Order Form ───────────────────────────────────────────────────────

interface NewWOFormProps {
  open: boolean;
  onClose: () => void;
  onSaved: (wo: WorkOrder) => void;
  techs: Technician[];
  editing?: WorkOrder | null;
}

function WorkOrderSlideOver({ open, onClose, onSaved, techs, editing }: NewWOFormProps) {
  const [form, setForm] = useState({
    title:          editing?.title           ?? "",
    customer_name:  editing?.customer_name   ?? "",
    job_type:       (editing?.job_type       ?? "Repair") as JobType,
    priority:       (editing?.priority       ?? "medium") as WOPriority,
    status:         (editing?.status         ?? "open")   as WOStatus,
    assignee_id:    editing?.assignee_id     ?? "",
    assignee_name:  editing?.assignee_name   ?? "",
    due_date:       editing?.due_date        ?? "",
    scheduled_date: editing?.scheduled_date  ?? "",
    notes:          editing?.notes           ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  // Reset form when editing target changes
  useEffect(() => {
    setForm({
      title:          editing?.title          ?? "",
      customer_name:  editing?.customer_name  ?? "",
      job_type:       (editing?.job_type      ?? "Repair") as JobType,
      priority:       (editing?.priority      ?? "medium") as WOPriority,
      status:         (editing?.status        ?? "open")   as WOStatus,
      assignee_id:    editing?.assignee_id    ?? "",
      assignee_name:  editing?.assignee_name  ?? "",
      due_date:       editing?.due_date       ?? "",
      scheduled_date: editing?.scheduled_date ?? "",
      notes:          editing?.notes          ?? "",
    });
    setError("");
  }, [editing]);

  if (!open) return null;

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleTechChange = (techId: string) => {
    const tech = techs.find(t => t.id === techId);
    setForm(f => ({ ...f, assignee_id: techId, assignee_name: tech?.name ?? "" }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.customer_name.trim()) {
      setError("Title and customer are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const url    = editing ? `/api/maintenance/${editing.id}` : "/api/maintenance";
      const method = editing ? "PATCH" : "POST";
      const res  = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          assignee_id:   form.assignee_id   || null,
          assignee_name: form.assignee_name || null,
          due_date:      form.due_date      || null,
          scheduled_date: form.scheduled_date || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      onSaved(json.work_order);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-[480px] bg-card border-l border-border z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-sm font-bold text-foreground">
              {editing ? "Edit Work Order" : "New Work Order"}
            </h2>
            {editing && (
              <p className="text-xs text-muted-foreground font-mono mt-0.5">{editing.wo_number}</p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Work Order Title *
            </label>
            <input
              value={form.title}
              onChange={e => set("title", e.target.value)}
              placeholder="e.g. Camera offline — Main Gate"
              className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 bg-background"
            />
          </div>

          {/* Customer */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Customer / Property *
            </label>
            <input
              value={form.customer_name}
              onChange={e => set("customer_name", e.target.value)}
              placeholder="e.g. Stonegate Townhomes"
              className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 bg-background"
            />
          </div>

          {/* Job Type + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Job Type
              </label>
              <div className="relative">
                <select
                  value={form.job_type}
                  onChange={e => set("job_type", e.target.value)}
                  className="w-full appearance-none border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 bg-background pr-8"
                >
                  {JOB_TYPES.map(jt => <option key={jt}>{jt}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Priority
              </label>
              <div className="relative">
                <select
                  value={form.priority}
                  onChange={e => set("priority", e.target.value)}
                  className="w-full appearance-none border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 bg-background pr-8"
                >
                  {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Status
            </label>
            <div className="relative">
              <select
                value={form.status}
                onChange={e => set("status", e.target.value)}
                className="w-full appearance-none border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 bg-background pr-8"
              >
                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {/* Assignee */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Assigned Tech
            </label>
            <div className="relative">
              <select
                value={form.assignee_id}
                onChange={e => handleTechChange(e.target.value)}
                className="w-full appearance-none border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 bg-background pr-8"
              >
                <option value="">— Unassigned —</option>
                {techs.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.role})</option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {/* Due Date + Scheduled Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Due Date
              </label>
              <input
                type="date"
                value={form.due_date}
                onChange={e => set("due_date", e.target.value)}
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 bg-background"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Scheduled Date
              </label>
              <input
                type="date"
                value={form.scheduled_date}
                onChange={e => set("scheduled_date", e.target.value)}
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 bg-background"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Notes
            </label>
            <textarea
              value={form.notes}
              onChange={e => set("notes", e.target.value)}
              rows={3}
              placeholder="Details, access codes, parking notes…"
              className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 bg-background resize-none"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-500 text-xs bg-red-500/10 rounded-xl px-3 py-2">
              <AlertTriangle size={13} /> {error}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="border-t border-border p-4 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit as unknown as React.MouseEventHandler<HTMLButtonElement>}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition-colors disabled:opacity-50 shadow-lg shadow-brand-500/20"
          >
            {saving ? "Saving…" : editing ? "Save Changes" : "Create Work Order"}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MaintenancePage() {
  const router = useRouter();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [techs, setTechs]           = useState<Technician[]>([]);
  const [loading, setLoading]       = useState(true);
  const [slideOpen, setSlideOpen]   = useState(false);
  const [editing, setEditing]       = useState<WorkOrder | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [deleting, setDeleting]     = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [woRes, techRes] = await Promise.all([
        fetch("/api/maintenance"),
        fetch("/api/dispatch/technicians"),
      ]);
      const woJson   = await woRes.json();
      const techJson = await techRes.json();
      setWorkOrders(woJson.work_orders ?? []);
      setTechs(techJson.technicians ?? []);
    } catch {
      // silently fall through — page shows empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSaved = (wo: WorkOrder) => {
    setWorkOrders(prev => {
      const idx = prev.findIndex(w => w.id === wo.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = wo;
        return next;
      }
      return [wo, ...prev];
    });
  };

  const handleStatusChange = async (wo: WorkOrder, newStatus: WOStatus) => {
    const res  = await fetch(`/api/maintenance/${wo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    const json = await res.json();
    if (res.ok) handleSaved(json.work_order);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this work order? This cannot be undone.")) return;
    setDeleting(id);
    try {
      await fetch(`/api/maintenance/${id}`, { method: "DELETE" });
      setWorkOrders(prev => prev.filter(w => w.id !== id));
    } finally {
      setDeleting(null);
    }
  };

  const filtered = filterStatus === "all"
    ? workOrders
    : workOrders.filter(w => w.status === filterStatus);

  const counts = {
    open:        workOrders.filter(w => w.status === "open").length,
    in_progress: workOrders.filter(w => w.status === "in_progress").length,
    scheduled:   workOrders.filter(w => w.status === "scheduled").length,
    completed:   workOrders.filter(w => w.status === "completed").length,
  };

  return (
    <div className="flex flex-col min-h-full">
      <TopBar title="Maintenance" subtitle="Work Orders & Asset Management" />

      <WorkOrderSlideOver
        open={slideOpen}
        onClose={() => { setSlideOpen(false); setEditing(null); }}
        onSaved={handleSaved}
        techs={techs}
        editing={editing}
      />

      <div className="flex-1 p-6 space-y-5">
        {/* Toolbar */}
        <div className="flex items-center gap-3">
          <AISearch
            placeholder='Try "show overdue work orders" or "schedule annual maintenance for Angel Oak"'
            className="flex-1"
          />
          <button
            onClick={fetchData}
            className="p-2.5 rounded-xl border border-border hover:bg-accent transition-colors"
            title="Refresh"
          >
            <RefreshCw size={14} className={cn("text-muted-foreground", loading && "animate-spin")} />
          </button>
          <button
            onClick={() => { setEditing(null); setSlideOpen(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors shadow-lg shadow-brand-500/20"
          >
            <Plus size={16} /> New Work Order
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {([
            { label: "Open",        value: counts.open,        color: "text-blue-400",    bg: "bg-blue-500/10",    icon: Clock,        key: "open"        },
            { label: "In Progress", value: counts.in_progress, color: "text-amber-400",   bg: "bg-amber-500/10",   icon: Wrench,       key: "in_progress" },
            { label: "Scheduled",   value: counts.scheduled,   color: "text-violet-400",  bg: "bg-violet-500/10",  icon: Calendar,     key: "scheduled"   },
            { label: "Completed",   value: counts.completed,   color: "text-emerald-400", bg: "bg-emerald-500/10", icon: CheckCircle2, key: "completed"   },
          ] as const).map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.key}
                onClick={() => setFilterStatus(filterStatus === s.key ? "all" : s.key)}
                className={cn(
                  "bg-card border border-border rounded-xl p-4 flex items-center gap-3 transition-all text-left",
                  filterStatus === s.key ? "ring-2 ring-brand-500/40 border-brand-500/40" : "hover:border-border/60"
                )}
              >
                <div className={`p-2.5 rounded-lg ${s.bg}`}>
                  <Icon size={16} className={s.color} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {loading ? "—" : s.value}
                  </p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Work Orders table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
            <div className="flex items-center gap-2">
              <Wrench size={15} className="text-brand-400" />
              <h2 className="text-sm font-semibold">Work Orders</h2>
              {filterStatus !== "all" && (
                <button
                  onClick={() => setFilterStatus("all")}
                  className="flex items-center gap-1 ml-1 text-[11px] text-brand-400 hover:text-brand-500"
                >
                  <span className="capitalize">{filterStatus.replace("_", " ")}</span>
                  <X size={10} />
                </button>
              )}
            </div>
            <span className="text-xs text-muted-foreground">{filtered.length} work orders</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
              <RefreshCw size={16} className="animate-spin mr-2" /> Loading work orders…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Wrench size={32} className="mb-3 opacity-20" />
              <p className="text-sm font-medium">No work orders found</p>
              <p className="text-xs mt-1">Click "New Work Order" to create one</p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-background/30">
                  {["WO #", "Title", "Customer", "Assignee", "Priority", "Status", "Due", "Actions"].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-muted-foreground font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((wo) => {
                  const pc = priorityConfig[wo.priority] ?? priorityConfig.medium;
                  const sc = statusConfig[wo.status]     ?? statusConfig.open;
                  const StatusIcon = sc.icon;
                  const isOverdue  = wo.status !== "completed" && wo.due_date && new Date(wo.due_date) < new Date();

                  return (
                    <tr
                      key={wo.id}
                      onClick={() => router.push(`/maintenance/${wo.id}`)}
                      className="border-b border-border/50 hover:bg-accent/30 transition-colors cursor-pointer group"
                    >
                      <td className="px-4 py-3 font-mono text-brand-400">{wo.wo_number}</td>
                      <td className="px-4 py-3 font-medium text-foreground max-w-[200px] truncate">{wo.title}</td>
                      <td className="px-4 py-3 text-muted-foreground">{wo.customer_name}</td>
                      <td className="px-4 py-3">
                        {wo.assignee_name ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-brand-900 flex items-center justify-center text-[10px] text-brand-300 font-semibold">
                              {wo.assignee_name.split(" ").map(n => n[0]).join("")}
                            </div>
                            <span className="text-muted-foreground">{wo.assignee_name}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/50 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${pc.bg} ${pc.text}`}>
                          {pc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="relative">
                          <select
                            value={wo.status}
                            onChange={e => handleStatusChange(wo, e.target.value as WOStatus)}
                            onClick={e => e.stopPropagation()}
                            className={cn(
                              "appearance-none pl-6 pr-2 py-0.5 rounded-full text-[11px] font-medium cursor-pointer border-0 outline-none",
                              sc.bg, sc.text
                            )}
                          >
                            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                          </select>
                          <StatusIcon size={10} className={cn("absolute left-1.5 top-1/2 -translate-y-1/2 pointer-events-none", sc.text)} />
                        </div>
                      </td>
                      <td className={cn("px-4 py-3", isOverdue ? "text-red-400 font-medium" : "text-muted-foreground")}>
                        {wo.due_date ? new Date(wo.due_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={e => { e.stopPropagation(); setEditing(wo); setSlideOpen(true); }}
                            className="p-1.5 rounded-lg hover:bg-brand-500/10 text-brand-400 transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); handleDelete(wo.id); }}
                            disabled={deleting === wo.id}
                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400 transition-colors disabled:opacity-50"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                          <span className="ml-1 text-xs text-brand-400 font-medium flex items-center gap-0.5">
                            View <ChevronRight size={12} />
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
