"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonRow } from "@/components/ui/SkeletonRow";
import {
  ChevronLeft, ChevronRight, RefreshCw, CheckCircle2, Clock,
  ChevronDown, Plus,
} from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { CalendarDays, CalendarClock, Link2Off, GripVertical, Timer, Zap } = require("lucide-react") as any;

// ─── Types ────────────────────────────────────────────────────────────────────

interface CalendarEvent {
  id: string;
  type: "todo" | "work_order" | "work_order_phase" | "pm_schedule" | "gcal" | "crm_activity" | "tracker_task";
  title: string;
  date: string;       // YYYY-MM-DD
  time?: string;      // HH:MM
  status: string;
  priority?: string;
  color: string;
  link?: string;
  gcal_event_id?: string;
  opportunity_name?: string;
}

interface UnscheduledTodo {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date?: string | null;
  estimated_minutes?: number | null;
}

interface UnscheduledWO {
  id: string;
  title: string;
  status: string;
  site_name?: string | null;
  priority?: string | null;
  estimated_minutes?: number | null;
}

interface UnscheduledLead {
  id: string;
  name: string;
  company?: string | null;
  stage: string;
}

type CalendarView = "day" | "week" | "month";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// ─── Color helpers ────────────────────────────────────────────────────────────

function colorForType(type: CalendarEvent["type"]): string {
  if (type === "work_order")       return "#EA580C";
  if (type === "work_order_phase") return "#C2410C";
  if (type === "pm_schedule")      return "#0B7285";
  if (type === "gcal")             return "#15803d";
  if (type === "crm_activity")     return "#7C3AED";
  if (type === "tracker_task")    return "#8B5CF6";
  return "#6B7EFF";
}

function bgForType(type: CalendarEvent["type"]): string {
  if (type === "work_order")       return "bg-orange-600";
  if (type === "work_order_phase") return "bg-orange-700";
  if (type === "pm_schedule")      return "bg-teal-700";
  if (type === "gcal")             return "bg-emerald-700";
  if (type === "crm_activity")     return "bg-violet-700";
  if (type === "tracker_task")    return "bg-violet-500";
  return "bg-[#6B7EFF]";
}

// ─── Priority pill ────────────────────────────────────────────────────────────

function PriorityChip({ priority }: { priority?: string }) {
  const map: Record<string, string> = {
    urgent: "bg-red-100 text-red-700 border border-red-200",
    high:   "bg-orange-100 text-orange-700 border border-orange-200",
    medium: "bg-amber-100 text-amber-700 border border-amber-200",
    low:    "bg-slate-100 text-slate-600 border border-slate-200",
  };
  const label = (priority ?? "medium").toLowerCase();
  return (
    <span className={`inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${map[label] ?? map.medium}`}>
      {label}
    </span>
  );
}

// ─── Status pill ──────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: string }) {
  const s = status.toLowerCase().replace(/_/g, " ");
  const map: Record<string, string> = {
    blocked:     "bg-red-100 text-red-700",
    working:     "bg-emerald-100 text-emerald-700",
    "in progress":"bg-blue-100 text-blue-700",
    new:         "bg-slate-100 text-slate-600",
    open:        "bg-slate-100 text-slate-600",
    pending:     "bg-amber-100 text-amber-700",
    scheduled:   "bg-emerald-100 text-emerald-700",
  };
  return (
    <span className={`inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${map[s] ?? "bg-slate-100 text-slate-600"}`}>
      {s}
    </span>
  );
}

// ─── Estimated time badge ─────────────────────────────────────────────────────

function EstBadge({ minutes }: { minutes?: number | null }) {
  if (!minutes) return <span className="text-[9px] text-muted-foreground bg-slate-100 px-1.5 py-0.5 rounded-full">—</span>;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const label = h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
  return (
    <span className="text-[9px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-full whitespace-nowrap">
      {label}
    </span>
  );
}

// ─── Avatar stack (decorative, uses event id as seed) ────────────────────────

const AVATAR_COLORS = ["#6B7EFF","#EA580C","#15803d","#854F0B","#185FA5","#993556"];

function AvatarStack({ seed, count = 2 }: { seed: string; count?: number }) {
  const avatars = Array.from({ length: Math.min(count, 3) }, (_, i) => {
    const code = seed.charCodeAt(i % seed.length) + i;
    const bg   = AVATAR_COLORS[code % AVATAR_COLORS.length];
    const initials = String.fromCharCode(65 + (code % 26));
    return { bg, initials };
  });
  return (
    <div className="flex -space-x-1.5">
      {avatars.map((a, i) => (
        <div
          key={i}
          className="w-4 h-4 rounded-full border border-white/40 flex items-center justify-center text-[7px] font-bold text-white shrink-0"
          style={{ backgroundColor: a.bg, zIndex: 3 - i }}
        >
          {a.initials}
        </div>
      ))}
    </div>
  );
}

// ─── Rich event card (calendar cell) ─────────────────────────────────────────

function EventCard({
  event,
  onClick,
  onDragStartEvent,
}: {
  event: CalendarEvent;
  onClick: (event: CalendarEvent, el: HTMLElement) => void;
  onDragStartEvent?: (event: CalendarEvent) => void;
}) {
  const { MoreHorizontal } = require("lucide-react") as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const color = colorForType(event.type);
  const isDraggable = event.type === "todo" || event.type === "work_order";
  const badgeLabel = event.priority === "urgent"
    ? "Urgent"
    : event.type === "gcal"
    ? "Personal"
    : event.type === "work_order"
    ? "Work Order"
    : event.type === "work_order_phase"
    ? "WO Phase"
    : event.type === "pm_schedule"
    ? "PM"
    : event.type === "crm_activity"
    ? "CRM"
    : null;

  return (
    <button
      draggable={isDraggable}
      onDragStart={isDraggable ? (e) => { e.stopPropagation(); onDragStartEvent?.(event); } : undefined}
      className="w-full text-left rounded-lg overflow-hidden transition-opacity hover:opacity-90 focus:outline-none"
      style={{ backgroundColor: color, cursor: isDraggable ? "grab" : "pointer" }}
      onClick={(e) => onClick(event, e.currentTarget)}
      title={event.title}
    >
      <div className="px-2 pt-1.5 pb-1">
        {/* Title */}
        <p className="text-white text-[10px] font-semibold leading-tight truncate">{event.title}</p>
        {/* Time */}
        {event.time && (
          <p className="text-white/70 text-[9px] mt-0.5">{event.time}</p>
        )}
        {/* Badge */}
        {badgeLabel && (
          <div className="mt-1">
            <span className="text-[8px] font-bold bg-white/25 text-white px-1.5 py-0.5 rounded-full uppercase tracking-wide">
              {badgeLabel}
            </span>
          </div>
        )}
        {/* Footer: avatars + menu */}
        <div className="flex items-center justify-between mt-1.5">
          <AvatarStack seed={event.id} count={2} />
          <div
            className="w-4 h-4 rounded flex items-center justify-center opacity-60 hover:opacity-100 hover:bg-white/20 transition-all"
            onClick={(e) => { e.stopPropagation(); onClick(event, e.currentTarget as HTMLElement); }}
          >
            <MoreHorizontal size={10} className="text-white" />
          </div>
        </div>
      </div>
    </button>
  );
}

// ─── Event popover ────────────────────────────────────────────────────────────

function EventPopover({
  event,
  anchor,
  onClose,
  onReschedule,
  onUnschedule,
}: {
  event: CalendarEvent;
  anchor: { top: number; left: number };
  onClose: () => void;
  onReschedule: (id: string, type: CalendarEvent["type"], newDate: string) => Promise<void>;
  onUnschedule: (id: string, type: CalendarEvent["type"]) => Promise<void>;
}) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const typeLabel =
    event.type === "todo"            ? "To-Do"
    : event.type === "work_order"    ? "Work Order"
    : event.type === "work_order_phase" ? "WO Phase"
    : event.type === "pm_schedule"   ? "PM Schedule"
    : event.type === "crm_activity"  ? "CRM Activity"
    : event.type === "tracker_task"  ? "Tracker Task"
    : "Google Calendar";

  const color = colorForType(event.type);
  const canMove = event.type === "todo" || event.type === "work_order";

  async function handleReschedule(date: string) {
    if (!date) return;
    setSaving(true);
    await onReschedule(event.id, event.type, date);
    setSaving(false);
    onClose();
  }

  async function handleUnschedule() {
    setSaving(true);
    await onUnschedule(event.id, event.type);
    setSaving(false);
    onClose();
  }

  return (
    <div
      className="fixed z-50 bg-white border border-border rounded-xl p-4 w-64 shadow-lg"
      style={{ top: anchor.top, left: anchor.left }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span
              className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full text-white"
              style={{ backgroundColor: color }}
            >
              {typeLabel}
            </span>
            {event.priority && <PriorityChip priority={event.priority} />}
          </div>
          <p className="text-sm font-semibold text-foreground leading-tight">{event.title}</p>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm p-0.5 shrink-0 leading-none">
          ✕
        </button>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
        <Clock size={11} />
        <span>{event.date}{event.time ? ` · ${event.time}` : ""}</span>
      </div>

      {/* Status */}
      <div className="flex items-center gap-1.5 mb-3">
        <StatusChip status={event.status} />
      </div>

      {/* Actions */}
      <div className="border-t border-border pt-3 space-y-1">
        {event.type === "todo" && (
          <button className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-foreground hover:bg-[#6B7EFF]/8 transition-colors text-left">
            <Zap size={12} className="text-[#6B7EFF] shrink-0" />
            Add to L10 meeting
          </button>
        )}
        {event.type === "work_order" && (
          <a
            href={event.link ?? "/dispatch"}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-foreground hover:bg-orange-50 transition-colors"
          >
            <CalendarDays size={12} className="text-orange-600 shrink-0" />
            View work order
          </a>
        )}
        {event.type === "crm_activity" && (
          <a
            href={event.link ?? "/crm"}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-foreground hover:bg-violet-50 transition-colors"
          >
            <span style={{ color: "#7C3AED", flexShrink: 0 }}>↗</span>
            {event.opportunity_name ? `View: ${event.opportunity_name}` : "View opportunity"}
          </a>
        )}
        {event.link && event.type === "todo" && (
          <a
            href={event.link}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#6B7EFF] hover:bg-[#6B7EFF]/5 transition-colors"
          >
            Open detail →
          </a>
        )}

        {/* Reschedule — only for todos + work orders */}
        {canMove && !showDatePicker && (
          <button
            onClick={() => setShowDatePicker(true)}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-foreground hover:bg-accent transition-colors text-left"
          >
            <RefreshCw size={12} className="text-muted-foreground shrink-0" />
            Reschedule to different date
          </button>
        )}
        {canMove && showDatePicker && (
          <div className="px-2.5 py-2 rounded-lg bg-accent">
            <p className="text-[10px] text-muted-foreground mb-1.5 font-medium">Pick a new date:</p>
            <input
              type="date"
              defaultValue={event.date}
              autoFocus
              className="w-full text-xs border border-border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]"
              onChange={(e) => { if (e.target.value) void handleReschedule(e.target.value); }}
              disabled={saving}
            />
            <button
              onClick={() => setShowDatePicker(false)}
              className="text-[10px] text-muted-foreground mt-1 hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Unschedule — move back to sidebar queue */}
        {canMove && (
          <button
            onClick={() => { void handleUnschedule(); }}
            disabled={saving}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors text-left"
          >
            <Link2Off size={12} className="shrink-0" />
            {saving ? "Saving…" : "Remove from calendar"}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Sidebar section accordion (dark) ────────────────────────────────────────

function SidebarSection({
  label,
  count,
  defaultOpen = true,
  children,
}: {
  label: string;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 transition-colors"
      >
        <ChevronDown
          size={13}
          className={`text-white/40 shrink-0 transition-transform duration-150 ${open ? "" : "-rotate-90"}`}
        />
        <span className="text-[11px] font-bold text-white/80 uppercase tracking-wide flex-1 text-left">
          {label}
        </span>
        {count > 0 && (
          <span className="text-[9px] font-bold bg-[#6B7EFF]/30 text-[#a8b4ff] px-1.5 py-0.5 rounded-full">
            {count}
          </span>
        )}
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

// ─── Monday.com-style task card (dark sidebar version) ───────────────────────

function StatusChipDark({ status }: { status: string }) {
  const s = status.toLowerCase().replace(/_/g, " ");
  const map: Record<string, string> = {
    blocked:      "bg-red-500/20 text-red-300 border border-red-500/30",
    working:      "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
    "in progress":"bg-blue-500/20 text-blue-300 border border-blue-500/30",
    new:          "bg-white/10 text-white/60 border border-white/10",
    open:         "bg-white/10 text-white/60 border border-white/10",
    pending:      "bg-amber-500/20 text-amber-300 border border-amber-500/30",
    scheduled:    "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
  };
  return (
    <span className={`inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${map[s] ?? "bg-white/10 text-white/60"}`}>
      {s}
    </span>
  );
}

function PriorityChipDark({ priority }: { priority?: string }) {
  const map: Record<string, string> = {
    urgent: "bg-red-500/20 text-red-300 border border-red-500/30",
    high:   "bg-orange-500/20 text-orange-300 border border-orange-500/30",
    medium: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
    low:    "bg-white/10 text-white/40 border border-white/10",
  };
  const label = (priority ?? "medium").toLowerCase();
  return (
    <span className={`inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${map[label] ?? map.medium}`}>
      {label}
    </span>
  );
}

function EstBadgeDark({ minutes }: { minutes?: number | null }) {
  if (!minutes) return <span className="text-[9px] text-white/30">—</span>;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const label = h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
  return (
    <span className="text-[9px] font-semibold text-white/50 whitespace-nowrap">{label}</span>
  );
}

function TaskCard({
  name,
  sub,
  status,
  priority,
  estimatedMinutes,
  accentColor = "#6B7EFF",
  onDragStart,
  onSchedule,
  schedulerOpen,
  onScheduleChange,
  onScheduleBlur,
}: {
  name: string;
  sub?: string;
  status: string;
  priority?: string;
  estimatedMinutes?: number | null;
  accentColor?: string;
  onDragStart: () => void;
  onSchedule: () => void;
  schedulerOpen: boolean;
  onScheduleChange: (date: string) => void;
  onScheduleBlur: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="mx-2.5 mb-1.5 rounded-lg cursor-grab active:cursor-grabbing group transition-all hover:brightness-110"
      style={{
        backgroundColor: "#151f2e",
        borderLeft: `3px solid ${accentColor}`,
        border: `0.5px solid rgba(255,255,255,0.08)`,
        borderLeftWidth: "3px",
        borderLeftColor: accentColor,
      }}
    >
      <div className="px-2.5 py-2">
        {/* Top row */}
        <div className="flex items-start gap-1.5 mb-1.5">
          <div className="w-3.5 h-3.5 rounded border border-white/20 mt-0.5 shrink-0 flex items-center justify-center">
            <CheckCircle2 size={9} className="text-[#6B7EFF] opacity-0 group-hover:opacity-60 transition-opacity" />
          </div>
          <p className="text-[11px] font-medium text-white/90 leading-tight flex-1 min-w-0">{name}</p>
          <GripVertical size={12} className="text-white/20 group-hover:text-white/50 shrink-0 mt-0.5 transition-colors" />
        </div>
        {/* Sub */}
        {sub && <p className="text-[10px] text-white/40 mb-1.5 pl-5 truncate">{sub}</p>}
        {/* Pills */}
        <div className="flex items-center gap-1.5 flex-wrap pl-5">
          <StatusChipDark status={status} />
          {priority && <PriorityChipDark priority={priority} />}
          <EstBadgeDark minutes={estimatedMinutes} />
          {schedulerOpen ? (
            <input
              type="date"
              autoFocus
              className="text-[9px] border border-[#6B7EFF]/50 rounded px-1 py-0.5 bg-[#0C111D] text-white focus:outline-none ml-auto"
              onChange={(e) => { if (e.target.value) onScheduleChange(e.target.value); }}
              onBlur={onScheduleBlur}
            />
          ) : (
            <button
              onClick={onSchedule}
              className="text-[9px] font-semibold ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ color: accentColor }}
            >
              Schedule →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CalendarPageWrapper() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ color: "#6B7EFF" }}>Loading…</div></div>}>
      <CalendarPage />
    </Suspense>
  );
}

function CalendarPage() {
  const searchParams = useSearchParams();

  const [view, setView]                       = useState<CalendarView>("week");
  const [currentDate, setCurrentDate]         = useState(() => new Date());
  const [events, setEvents]                   = useState<CalendarEvent[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [syncing, setSyncing]                 = useState(false);
  const [gcalConnected, setGcalConnected]     = useState(false);
  const [lastSynced, setLastSynced]           = useState<string | null>(null);
  const [activeEvent, setActiveEvent]         = useState<CalendarEvent | null>(null);
  const [popoverAnchor, setPopoverAnchor]     = useState<{ top: number; left: number } | null>(null);
  const [syncError, setSyncError]             = useState<string | null>(null);
  const [quickAddSaving, setQuickAddSaving]   = useState(false);

  // Unscheduled panel
  const [unscheduledTodos, setUnscheduledTodos]   = useState<UnscheduledTodo[]>([]);
  const [unscheduledWOs, setUnscheduledWOs]       = useState<UnscheduledWO[]>([]);
  const [unscheduledLeads, setUnscheduledLeads]   = useState<UnscheduledLead[]>([]);
  const [unscheduledLoading, setUnscheduledLoading] = useState(true);

  // Inline date pickers
  const [pickerTodoId, setPickerTodoId] = useState<string | null>(null);
  const [pickerWoId, setPickerWoId]     = useState<string | null>(null);

  // Quick-add
  const [quickAdd, setQuickAdd] = useState("");

  // Drag-drop
  const dragItem = useRef<{ type: "todo" | "wo"; id: string } | null>(null);

  // ── Show connected banner if redirected back from OAuth ─────────────────────
  const connectedParam = searchParams.get("connected");
  useEffect(() => {
    if (connectedParam === "true") setGcalConnected(true);
  }, [connectedParam]);

  // ── Fetch events ─────────────────────────────────────────────────────────────
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const year  = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const res   = await fetch(`/api/calendar/events?year=${year}&month=${month}`);
      if (!res.ok) throw new Error("Failed");
      const data  = await res.json() as { events: CalendarEvent[] };
      setEvents(data.events ?? []);
      if ((data.events ?? []).some((e: CalendarEvent) => e.type === "gcal")) {
        setGcalConnected(true);
      }
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [currentDate]);

  // ── Fetch unscheduled ─────────────────────────────────────────────────────────
  const fetchUnscheduled = useCallback(async () => {
    setUnscheduledLoading(true);
    try {
      const [todosRes, wosRes, leadsRes] = await Promise.all([
        fetch("/api/todos?unscheduled=true&limit=20"),
        fetch("/api/maintenance?unscheduled=true&limit=20"),
        fetch("/api/crm/leads?unscheduled=true&limit=20"),
      ]);
      if (todosRes.ok) {
        const d = await todosRes.json() as { records?: UnscheduledTodo[] };
        setUnscheduledTodos((d.records ?? []).filter((t) => !t.due_date));
      }
      if (wosRes.ok) {
        const d = await wosRes.json() as { records?: UnscheduledWO[] };
        setUnscheduledWOs(d.records ?? []);
      }
      if (leadsRes.ok) {
        const d = await leadsRes.json() as { records?: UnscheduledLead[] };
        setUnscheduledLeads(
          (d.records ?? []).filter((l) => !["closed_won", "closed_lost"].includes(l.stage))
        );
      }
    } catch {
      // Non-critical
    } finally {
      setUnscheduledLoading(false);
    }
  }, []);

  useEffect(() => { void fetchEvents(); },      [fetchEvents]);
  useEffect(() => { void fetchUnscheduled(); }, [fetchUnscheduled]);

  // Check GCal status
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/calendar/google/status");
        if (res.ok) {
          const d = await res.json() as { connected?: boolean; last_synced?: string };
          if (d.connected)  setGcalConnected(true);
          if (d.last_synced) setLastSynced(d.last_synced);
        }
      } catch { /* ignore */ }
    })();
  }, []);

  // ── Navigation ────────────────────────────────────────────────────────────────
  function goBack() {
    setCurrentDate((d) => {
      const nd = new Date(d);
      if (view === "day")   nd.setDate(nd.getDate() - 1);
      else if (view === "week") nd.setDate(nd.getDate() - 7);
      else nd.setMonth(nd.getMonth() - 1);
      return nd;
    });
  }
  function goForward() {
    setCurrentDate((d) => {
      const nd = new Date(d);
      if (view === "day")   nd.setDate(nd.getDate() + 1);
      else if (view === "week") nd.setDate(nd.getDate() + 7);
      else nd.setMonth(nd.getMonth() + 1);
      return nd;
    });
  }
  function goToday() {
    setCurrentDate(new Date());
  }

  // ── GCal sync ─────────────────────────────────────────────────────────────────
  async function handleSync() {
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch("/api/calendar/google/sync", { method: "POST" });
      const d   = await res.json() as { synced_at?: string; error?: string; diagnostics?: string[] };
      if (res.ok) {
        if (d.synced_at) setLastSynced(d.synced_at);
        await fetchEvents();
      } else {
        const detail = d.diagnostics ? `${d.error} (${d.diagnostics.slice(-1)[0]})` : d.error;
        setSyncError(detail ?? "Sync failed — check Google Calendar credentials in Vercel env vars.");
      }
    } catch {
      setSyncError("Network error during sync.");
    } finally {
      setSyncing(false);
    }
  }

  // ── Reschedule / Unschedule calendar events ───────────────────────────────────
  async function rescheduleEvent(id: string, type: CalendarEvent["type"], newDate: string) {
    try {
      if (type === "todo") {
        await fetch(`/api/todos/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ due_date: newDate }),
        });
      } else if (type === "work_order") {
        await fetch(`/api/maintenance/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scheduled_date: newDate }),
        });
      }
      await fetchEvents();
    } catch { /* ignore */ }
  }

  async function unscheduleEvent(id: string, type: CalendarEvent["type"]) {
    try {
      if (type === "todo") {
        await fetch(`/api/todos/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ due_date: null }),
        });
      } else if (type === "work_order") {
        await fetch(`/api/maintenance/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scheduled_date: null }),
        });
      }
      await Promise.all([fetchEvents(), fetchUnscheduled()]);
    } catch { /* ignore */ }
  }

  // ── Quick-add todo ────────────────────────────────────────────────────────────
  async function handleQuickAdd() {
    const title = quickAdd.trim();
    if (!title) return;
    setQuickAddSaving(true);
    try {
      await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, status: "open", priority: "medium" }),
      });
      setQuickAdd("");
      await fetchUnscheduled();
    } catch { /* ignore */ } finally {
      setQuickAddSaving(false);
    }
  }

  // ── Event popover ─────────────────────────────────────────────────────────────
  function handleEventClick(event: CalendarEvent, el: HTMLElement) {
    setActiveEvent(event);
    const rect = el.getBoundingClientRect();
    const top  = Math.min(rect.bottom + 8, window.innerHeight - 260);
    const left = Math.min(rect.left, window.innerWidth - 272);
    setPopoverAnchor({ top, left });
  }

  // ── Schedule helpers ──────────────────────────────────────────────────────────
  async function setTodoDate(id: string, date: string) {
    try {
      await fetch(`/api/todos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ due_date: date }),
      });
      setUnscheduledTodos((prev) => prev.filter((t) => t.id !== id));
      setPickerTodoId(null);
      await fetchEvents();
    } catch { /* ignore */ }
  }

  async function setWODate(id: string, date: string) {
    try {
      await fetch(`/api/maintenance/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduled_date: date }),
      });
      setUnscheduledWOs((prev) => prev.filter((w) => w.id !== id));
      setPickerWoId(null);
      await fetchEvents();
    } catch { /* ignore */ }
  }

  // ── Drag-and-drop ─────────────────────────────────────────────────────────────
  function handleDragStart(type: "todo" | "wo", id: string) {
    dragItem.current = { type, id };
  }

  function handleDragStartEvent(event: CalendarEvent) {
    // Dragging an event already on the calendar — treat same as sidebar drag
    if (event.type === "todo")       dragItem.current = { type: "todo", id: event.id };
    if (event.type === "work_order") dragItem.current = { type: "wo",   id: event.id };
  }

  async function handleDropOnDay(dateStr: string) {
    const item = dragItem.current;
    if (!item) return;
    if (item.type === "todo") await setTodoDate(item.id, dateStr);
    if (item.type === "wo")   await setWODate(item.id, dateStr);
    dragItem.current = null;
  }

  // ── Week / month helpers ──────────────────────────────────────────────────────
  function getWeekDays(): Date[] {
    const d      = new Date(currentDate);
    const day    = d.getDay();
    const sunday = new Date(d.setDate(d.getDate() - day));
    return Array.from({ length: 7 }, (_, i) => {
      const dd = new Date(sunday);
      dd.setDate(sunday.getDate() + i);
      return dd;
    });
  }

  function getMonthCells(): (Date | null)[] {
    const year     = currentDate.getFullYear();
    const month    = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }

  function toDateStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function isToday(d: Date): boolean {
    const t = new Date();
    return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
  }

  function eventsForDate(dateStr: string): CalendarEvent[] {
    return events.filter((e) => e.date === dateStr);
  }

  function getHeaderLabel(): string {
    if (view === "month") {
      return `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    }
    const days  = getWeekDays();
    const start = days[0];
    const end   = days[6];
    if (start.getMonth() === end.getMonth()) {
      return `${MONTH_NAMES[start.getMonth()]} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`;
    }
    return `${MONTH_NAMES[start.getMonth()]} ${start.getDate()} – ${MONTH_NAMES[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
  }

  function relativeSyncTime(): string {
    if (!lastSynced) return "";
    const diff = Math.floor((Date.now() - new Date(lastSynced).getTime()) / 1000);
    if (diff < 60)   return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  }

  const totalUnscheduled = unscheduledTodos.length + unscheduledWOs.length + unscheduledLeads.length;

  // ── Day view ──────────────────────────────────────────────────────────────────
  function renderDayView() {
    const dateStr   = toDateStr(currentDate);
    const dayEvents = eventsForDate(dateStr);
    const hours     = Array.from({ length: 24 }, (_, i) => i);
    return (
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="border-b border-border bg-white sticky top-0 z-10 py-3 px-4">
          <p className="text-sm font-bold text-foreground">{DAY_NAMES[currentDate.getDay()]}, {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getDate()}</p>
        </div>
        <div className="relative">
          {hours.map((h) => {
            const label = h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`;
            const hStr  = String(h).padStart(2, "0") + ":00";
            const hourEvents = dayEvents.filter((e) => e.time && e.time.startsWith(String(h).padStart(2, "0")));
            return (
              <div key={h} className="flex border-b border-border min-h-[52px]">
                <div className="w-16 shrink-0 px-2 py-1 text-[10px] text-muted-foreground text-right">{label}</div>
                <div className="flex-1 px-2 py-1 space-y-1"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => { void handleDropOnDay(dateStr); }}
                >
                  {hourEvents.map((ev) => (
                    <EventCard key={ev.id} event={ev} onClick={handleEventClick} onDragStartEvent={handleDragStartEvent} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Week view ─────────────────────────────────────────────────────────────────
  function renderWeekView() {
    const weekDays    = getWeekDays();
    const hasAnyEvent = weekDays.some((d) => eventsForDate(toDateStr(d)).length > 0);

    return (
      <div className="flex-1 min-h-0 overflow-auto">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-border bg-white sticky top-0 z-10">
          {weekDays.map((day, i) => {
            const today = isToday(day);
            return (
              <div
                key={i}
                className="py-2.5 px-2 text-center border-r border-border last:border-r-0"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { void handleDropOnDay(toDateStr(day)); }}
              >
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                  {DAY_NAMES[day.getDay()]}
                </p>
                <div className={`w-7 h-7 flex items-center justify-center mx-auto mt-1 rounded-full text-sm font-bold transition-colors ${
                  today ? "bg-[#6B7EFF] text-white" : "text-foreground"
                }`}>
                  {day.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Event rows */}
        <div className="grid grid-cols-7">
          {weekDays.map((day, i) => {
            const dateStr  = toDateStr(day);
            const dayEvents = eventsForDate(dateStr);
            const allDay   = dayEvents.filter((e) => !e.time);
            const timed    = dayEvents.filter((e) => !!e.time);
            const today    = isToday(day);

            return (
              <div
                key={i}
                className={`min-h-[200px] border-r border-b border-border last:border-r-0 p-1.5 space-y-1 ${today ? "bg-[#6B7EFF]/[0.02]" : ""}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { void handleDropOnDay(dateStr); }}
              >
                {allDay.map((ev) => (
                  <EventCard key={ev.id} event={ev} onClick={handleEventClick} onDragStartEvent={handleDragStartEvent} />
                ))}
                {timed.map((ev) => (
                  <EventCard key={ev.id} event={ev} onClick={handleEventClick} onDragStartEvent={handleDragStartEvent} />
                ))}
              </div>
            );
          })}
        </div>

        {!loading && !hasAnyEvent && (
          <div className="py-8">
            <EmptyState
              icon={<CalendarDays size={28} className="text-muted-foreground" />}
              title="No events this week"
              description="To-dos and work orders scheduled for this week will appear here."
            />
          </div>
        )}
      </div>
    );
  }

  // ── Month view ────────────────────────────────────────────────────────────────
  function renderMonthView() {
    const cells = getMonthCells();

    return (
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="grid grid-cols-7 border-b border-border bg-white sticky top-0 z-10">
          {DAY_NAMES.map((name) => (
            <div key={name} className="py-2 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wide border-r border-border last:border-r-0">
              {name}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {cells.map((cell, idx) => {
            if (!cell) {
              return (
                <div key={`empty-${idx}`} className="min-h-[110px] bg-slate-50/60 border-r border-b border-border last:border-r-0" />
              );
            }
            const dateStr   = toDateStr(cell);
            const dayEvents = eventsForDate(dateStr);
            const visible   = dayEvents.slice(0, 3);
            const overflow  = dayEvents.length - 3;
            const today     = isToday(cell);

            return (
              <div
                key={dateStr}
                className={`min-h-[110px] border-r border-b border-border last:border-r-0 p-1.5 ${today ? "bg-[#6B7EFF]/[0.02]" : ""}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { void handleDropOnDay(dateStr); }}
              >
                <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold mb-1 ${
                  today ? "bg-[#6B7EFF] text-white" : "text-foreground"
                }`}>
                  {cell.getDate()}
                </div>
                <div className="space-y-0.5">
                  {visible.map((ev) => (
                    <EventCard key={ev.id} event={ev} onClick={handleEventClick} onDragStartEvent={handleDragStartEvent} />
                  ))}
                  {overflow > 0 && (
                    <p className="text-[9px] font-medium text-muted-foreground px-1">+{overflow} more</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-[#F8FAFC]">
      <TopBar
        title="Calendar"
        subtitle="Your schedule, to-dos, and work orders in one view"
      />

      {/* Sync error banner */}
      {syncError && (
        <div className="mx-6 mt-4 flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <span className="text-red-500 text-sm shrink-0">⚠</span>
          <p className="text-sm text-red-700 flex-1">{syncError}</p>
          <button onClick={() => setSyncError(null)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
        </div>
      )}

      {/* GCal connection banner */}
      {!gcalConnected && (
        <div className="mx-6 mt-4 flex items-center gap-3 bg-[#6B7EFF]/5 border border-[#6B7EFF]/20 rounded-xl px-4 py-3">
          <CalendarDays size={16} className="text-[#6B7EFF] shrink-0" />
          <p className="text-sm text-foreground flex-1">
            Connect Google Calendar to sync your events and enable CalDAV messaging links.
          </p>
          <a
            href="/api/calendar/google/connect"
            className="text-sm font-medium bg-[#6B7EFF] text-white px-3 py-1.5 rounded-lg hover:bg-[#5a6ee0] transition-colors"
          >
            Connect
          </a>
        </div>
      )}

      <div className="flex flex-1 min-h-0 gap-0">
        {/* ── Left: calendar ────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-h-0 p-6 pr-3 gap-4">
          {/* Header toolbar */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* View toggle */}
            <div className="flex items-center bg-white border border-border rounded-lg p-0.5">
              {(["day", "week", "month"] as CalendarView[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors capitalize ${
                    view === v ? "bg-[#6B7EFF] text-white" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>

            {/* Nav */}
            <div className="flex items-center gap-1.5">
              <button onClick={goBack} className="p-1.5 rounded-lg hover:bg-accent transition-colors border border-border">
                <ChevronLeft size={14} className="text-muted-foreground" />
              </button>
              <span className="text-sm font-semibold text-foreground min-w-[200px] text-center select-none">
                {getHeaderLabel()}
              </span>
              <button onClick={goForward} className="p-1.5 rounded-lg hover:bg-accent transition-colors border border-border">
                <ChevronRight size={14} className="text-muted-foreground" />
              </button>
            </div>

            {/* Go to Today button */}
            <button
              onClick={goToday}
              className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg bg-white hover:bg-accent transition-colors text-foreground"
            >
              Go to Today
            </button>

            <div className="flex-1" />

            {/* GCal badge */}
            {gcalConnected ? (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-2 text-xs font-semibold bg-white border border-border px-2.5 py-1.5 rounded-lg shadow-sm">
                  {/* Google G */}
                  <svg width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  <span className="text-foreground">Connected</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                </span>
                {lastSynced && (
                  <span className="text-[10px] text-muted-foreground hidden sm:inline">{relativeSyncTime()}</span>
                )}
                <button
                  onClick={() => { void handleSync(); }}
                  disabled={syncing}
                  className="p-1.5 rounded-lg hover:bg-accent transition-colors border border-border"
                  title="Sync Google Calendar"
                >
                  <RefreshCw size={14} className={`text-muted-foreground ${syncing ? "animate-spin" : ""}`} />
                </button>
              </div>
            ) : (
              <a
                href="/api/calendar/google/connect"
                className="flex items-center gap-2 text-xs font-semibold bg-white border border-border px-2.5 py-1.5 rounded-lg shadow-sm hover:bg-accent transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Connect Google
              </a>
            )}
          </div>

          {/* Calendar grid */}
          <div className="flex-1 bg-white border border-border rounded-xl overflow-hidden flex flex-col min-h-0">
            {loading ? (
              <div className="p-4"><SkeletonRow cols={7} rows={4} /></div>
            ) : (
              view === "day" ? renderDayView() : view === "week" ? renderWeekView() : renderMonthView()
            )}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#6B7EFF] inline-block" />
              To-Dos
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-orange-600 inline-block" />
              Work Orders
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-orange-700 inline-block" />
              WO Phases
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-teal-700 inline-block" />
              PM Schedule
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-violet-700 inline-block" />
              CRM Activities
            </span>
            {gcalConnected && (
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-700 inline-block" />
                Google Calendar
              </span>
            )}
            <span className="text-[10px] ml-auto opacity-60">Drag sidebar cards onto calendar to schedule</span>
          </div>
        </div>

        {/* ── Right: workflow queue (dark) ──────────────────────────────────── */}
        <div className="w-80 border-l border-white/10 flex flex-col" style={{ backgroundColor: "#0C111D" }}>
          {/* Sidebar header */}
          <div className="px-4 py-3.5 border-b border-white/10">
            <div className="flex items-center gap-2 mb-0.5">
              <CalendarClock size={15} className="text-white/40" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-white/90">Workflow Queue &amp; Task Inbox</span>
              {totalUnscheduled > 0 && (
                <span className="ml-auto text-[9px] font-bold bg-[#6B7EFF]/30 text-[#a8b4ff] px-1.5 py-0.5 rounded-full shrink-0">
                  {totalUnscheduled}
                </span>
              )}
            </div>
            <p className="text-[10px] text-white/40 mt-0.5">Drag tasks onto the calendar to block time.</p>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-4 py-1.5 border-b border-white/10">
            <span className="text-[9px] font-bold text-white/30 uppercase tracking-wider">Status</span>
            <span className="text-[9px] font-bold text-white/30 uppercase tracking-wider">Priority</span>
            <span className="text-[9px] font-bold text-white/30 uppercase tracking-wider">Est. Time</span>
            <span className="text-[9px] font-bold text-white/30 uppercase tracking-wider">Drag</span>
          </div>

          <div className="flex-1 overflow-y-auto py-1">
            {unscheduledLoading ? (
              <div className="p-4"><SkeletonRow cols={2} rows={4} /></div>
            ) : totalUnscheduled === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 gap-3">
                <div className="w-10 h-10 rounded-full border-2 border-emerald-500/40 flex items-center justify-center">
                  <CheckCircle2 size={20} className="text-emerald-500" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-white/80">All caught up</p>
                  <p className="text-[11px] text-white/40 mt-0.5 max-w-[200px]">No unscheduled to-dos, work orders, or open leads.</p>
                </div>
              </div>
            ) : (
              <>
                {/* To-Dos */}
                {unscheduledTodos.length > 0 && (
                  <SidebarSection label="Task Inbox" count={unscheduledTodos.length}>
                    {unscheduledTodos.map((todo) => (
                      <TaskCard
                        key={todo.id}
                        name={todo.title}
                        status={todo.status}
                        priority={todo.priority}
                        estimatedMinutes={todo.estimated_minutes}
                        accentColor="#6B7EFF"
                        onDragStart={() => handleDragStart("todo", todo.id)}
                        onSchedule={() => setPickerTodoId(todo.id)}
                        schedulerOpen={pickerTodoId === todo.id}
                        onScheduleChange={(date) => { void setTodoDate(todo.id, date); }}
                        onScheduleBlur={() => setPickerTodoId(null)}
                      />
                    ))}
                  </SidebarSection>
                )}

                {/* Work Orders */}
                {unscheduledWOs.length > 0 && (
                  <SidebarSection label="Workflow Queue" count={unscheduledWOs.length}>
                    {unscheduledWOs.map((wo) => (
                      <TaskCard
                        key={wo.id}
                        name={wo.title}
                        sub={wo.site_name ?? undefined}
                        status={wo.status}
                        priority={wo.priority ?? undefined}
                        estimatedMinutes={wo.estimated_minutes}
                        accentColor="#EA580C"
                        onDragStart={() => handleDragStart("wo", wo.id)}
                        onSchedule={() => setPickerWoId(wo.id)}
                        schedulerOpen={pickerWoId === wo.id}
                        onScheduleChange={(date) => { void setWODate(wo.id, date); }}
                        onScheduleBlur={() => setPickerWoId(null)}
                      />
                    ))}
                  </SidebarSection>
                )}

                {/* Open Leads */}
                {unscheduledLeads.length > 0 && (
                  <SidebarSection label="Active Leads" count={unscheduledLeads.length} defaultOpen={false}>
                    {unscheduledLeads.map((lead) => (
                      <a
                        key={lead.id}
                        href={`/crm/leads/${lead.id}`}
                        className="mx-2.5 mb-1.5 flex items-center gap-2 p-2.5 rounded-lg transition-all hover:brightness-110"
                        style={{ backgroundColor: "#151f2e", borderLeft: "3px solid #6B7EFF", border: "0.5px solid rgba(255,255,255,0.08)", borderLeftWidth: "3px", borderLeftColor: "#6B7EFF" }}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-medium text-white/90 truncate">{lead.name}</p>
                          {lead.company && (
                            <p className="text-[10px] text-white/40 truncate">{lead.company}</p>
                          )}
                        </div>
                        <span className="text-[9px] font-bold bg-[#6B7EFF]/30 text-[#a8b4ff] px-1.5 py-0.5 rounded-full capitalize shrink-0">
                          {lead.stage.replace(/_/g, " ")}
                        </span>
                      </a>
                    ))}
                  </SidebarSection>
                )}
              </>
            )}
          </div>

          {/* Quick-add bar */}
          <div className="px-3 py-2.5 border-t border-white/10" style={{ backgroundColor: "#0C111D" }}>
            <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5" style={{ backgroundColor: "#151f2e", border: "0.5px solid rgba(255,255,255,0.1)" }}>
              <Plus size={12} className={`shrink-0 ${quickAddSaving ? "text-[#6B7EFF] animate-spin" : "text-white/30"}`} />
              <input
                value={quickAdd}
                onChange={(e) => setQuickAdd(e.target.value)}
                placeholder={`Add task — type name, press Enter`}
                className="flex-1 bg-transparent text-xs text-white/80 placeholder:text-white/25 outline-none"
                disabled={quickAddSaving}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { void handleQuickAdd(); }
                }}
              />
              {quickAdd.trim() && (
                <button
                  onClick={() => { void handleQuickAdd(); }}
                  disabled={quickAddSaving}
                  className="text-[9px] font-bold text-[#6B7EFF] hover:text-[#a8b4ff] transition-colors"
                >
                  Add
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Event popover */}
      {activeEvent && popoverAnchor && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => { setActiveEvent(null); setPopoverAnchor(null); }}
          />
          <EventPopover
            event={activeEvent}
            anchor={popoverAnchor}
            onClose={() => { setActiveEvent(null); setPopoverAnchor(null); }}
            onReschedule={rescheduleEvent}
            onUnschedule={unscheduleEvent}
          />
        </>
      )}
    </div>
  );
}
