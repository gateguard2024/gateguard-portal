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
  type: "todo" | "work_order" | "gcal";
  title: string;
  date: string;       // YYYY-MM-DD
  time?: string;      // HH:MM
  status: string;
  priority?: string;
  color: string;
  link?: string;
  gcal_event_id?: string;
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

type CalendarView = "week" | "month";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// ─── Color helpers ────────────────────────────────────────────────────────────

function colorForType(type: CalendarEvent["type"]): string {
  if (type === "work_order") return "#EA580C";
  if (type === "gcal")       return "#15803d";
  return "#6B7EFF";
}

function bgForType(type: CalendarEvent["type"]): string {
  if (type === "work_order") return "bg-orange-600";
  if (type === "gcal")       return "bg-emerald-700";
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

// ─── Rich event card (calendar cell) ─────────────────────────────────────────

function EventCard({
  event,
  onClick,
}: {
  event: CalendarEvent;
  onClick: (event: CalendarEvent, el: HTMLElement) => void;
}) {
  const color = colorForType(event.type);
  const isUrgent = event.priority === "urgent";
  const isPersonal = event.type === "gcal";

  return (
    <button
      className="w-full text-left rounded-lg overflow-hidden transition-opacity hover:opacity-85 focus:outline-none"
      style={{ backgroundColor: color }}
      onClick={(e) => onClick(event, e.currentTarget)}
      title={event.title}
    >
      <div className="px-2 py-1.5">
        <p className="text-white text-[10px] font-semibold leading-tight truncate">{event.title}</p>
        {event.time && (
          <p className="text-white/70 text-[9px] mt-0.5">{event.time}</p>
        )}
        <div className="flex items-center gap-1 mt-1 flex-wrap">
          {isUrgent && (
            <span className="text-[8px] font-bold bg-white/20 text-white px-1.5 py-0.5 rounded-full uppercase tracking-wide">
              Urgent
            </span>
          )}
          {isPersonal && (
            <span className="text-[8px] font-bold bg-white/20 text-white px-1.5 py-0.5 rounded-full uppercase tracking-wide">
              GCal
            </span>
          )}
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
}: {
  event: CalendarEvent;
  anchor: { top: number; left: number };
  onClose: () => void;
}) {
  const typeLabel =
    event.type === "todo"
      ? "To-Do"
      : event.type === "work_order"
      ? "Work Order"
      : "Google Calendar";

  const color = colorForType(event.type);

  return (
    <div
      className="fixed z-50 bg-white border border-border rounded-xl p-4 w-64"
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
          <button className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-foreground hover:bg-orange-50 transition-colors text-left">
            <CalendarDays size={12} className="text-orange-600 shrink-0" />
            View work order
          </button>
        )}
        <button className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-foreground hover:bg-accent transition-colors text-left">
          <RefreshCw size={12} className="text-muted-foreground shrink-0" />
          Reschedule
        </button>
        <button className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-foreground hover:bg-accent transition-colors text-left">
          <CalendarClock size={12} className="text-muted-foreground shrink-0" />
          Send message
        </button>
        {event.link && (
          <a
            href={event.link}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#6B7EFF] hover:bg-[#6B7EFF]/5 transition-colors"
          >
            Open detail →
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Sidebar section accordion ────────────────────────────────────────────────

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
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent transition-colors"
      >
        <ChevronDown
          size={13}
          className={`text-muted-foreground shrink-0 transition-transform duration-150 ${open ? "" : "-rotate-90"}`}
        />
        <span className="text-[11px] font-bold text-foreground uppercase tracking-wide flex-1 text-left">
          {label}
        </span>
        {count > 0 && (
          <span className="text-[9px] font-bold bg-[#6B7EFF]/10 text-[#6B7EFF] px-1.5 py-0.5 rounded-full">
            {count}
          </span>
        )}
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

// ─── Monday.com-style task card ───────────────────────────────────────────────

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
      className="mx-2.5 mb-1.5 rounded-lg border border-border bg-white hover:border-[#6B7EFF]/30 hover:bg-[#6B7EFF]/[0.02] transition-colors cursor-grab active:cursor-grabbing group"
      style={{ borderLeft: `3px solid ${accentColor}` }}
    >
      <div className="px-2.5 py-2">
        {/* Top row */}
        <div className="flex items-start gap-1.5 mb-1.5">
          <div className="w-3.5 h-3.5 rounded border border-border mt-0.5 shrink-0 flex items-center justify-center">
            <CheckCircle2 size={9} className="text-[#6B7EFF] opacity-0 group-hover:opacity-60 transition-opacity" />
          </div>
          <p className="text-xs font-medium text-foreground leading-tight flex-1 min-w-0">{name}</p>
          <GripVertical size={12} className="text-muted-foreground/40 group-hover:text-muted-foreground shrink-0 mt-0.5 transition-colors" />
        </div>
        {/* Sub label */}
        {sub && (
          <p className="text-[10px] text-muted-foreground mb-1.5 pl-5 truncate">{sub}</p>
        )}
        {/* Pills row */}
        <div className="flex items-center gap-1 flex-wrap pl-5">
          <StatusChip status={status} />
          {priority && <PriorityChip priority={priority} />}
          <EstBadge minutes={estimatedMinutes} />
          {/* Schedule button */}
          {schedulerOpen ? (
            <input
              type="date"
              autoFocus
              className="text-[9px] border border-[#6B7EFF] rounded px-1 py-0.5 focus:outline-none ml-auto"
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
      view === "week" ? nd.setDate(nd.getDate() - 7) : nd.setMonth(nd.getMonth() - 1);
      return nd;
    });
  }
  function goForward() {
    setCurrentDate((d) => {
      const nd = new Date(d);
      view === "week" ? nd.setDate(nd.getDate() + 7) : nd.setMonth(nd.getMonth() + 1);
      return nd;
    });
  }
  function goToday() {
    setCurrentDate(new Date());
  }

  // ── GCal sync ─────────────────────────────────────────────────────────────────
  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/calendar/google/sync", { method: "POST" });
      if (res.ok) {
        const d = await res.json() as { synced_at?: string };
        if (d.synced_at) setLastSynced(d.synced_at);
        await fetchEvents();
      }
    } finally {
      setSyncing(false);
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
                  <EventCard key={ev.id} event={ev} onClick={handleEventClick} />
                ))}
                {timed.map((ev) => (
                  <EventCard key={ev.id} event={ev} onClick={handleEventClick} />
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
                    <EventCard key={ev.id} event={ev} onClick={handleEventClick} />
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
              {(["week", "month"] as CalendarView[]).map((v) => (
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

            {/* Today button */}
            <button
              onClick={goToday}
              className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg bg-white hover:bg-accent transition-colors text-foreground"
            >
              Today
            </button>

            <div className="flex-1" />

            {/* GCal badge */}
            {gcalConnected ? (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                  Google connected
                </span>
                {lastSynced && (
                  <span className="text-[10px] text-muted-foreground hidden sm:inline">
                    {relativeSyncTime()}
                  </span>
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
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-white border border-border px-2.5 py-1 rounded-full">
                <Link2Off size={11} />
                Not connected
              </span>
            )}
          </div>

          {/* Calendar grid */}
          <div className="flex-1 bg-white border border-border rounded-xl overflow-hidden flex flex-col min-h-0">
            {loading ? (
              <div className="p-4"><SkeletonRow cols={7} rows={4} /></div>
            ) : (
              view === "week" ? renderWeekView() : renderMonthView()
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
            {gcalConnected && (
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-700 inline-block" />
                Google Calendar
              </span>
            )}
            <span className="text-[10px] ml-auto opacity-60">Drag sidebar cards onto calendar to schedule</span>
          </div>
        </div>

        {/* ── Right: workflow queue ──────────────────────────────────────────── */}
        <div className="w-80 border-l border-border bg-white flex flex-col">
          {/* Sidebar header */}
          <div className="px-4 py-3.5 border-b border-border">
            <div className="flex items-center gap-2 mb-0.5">
              <CalendarClock size={15} className="text-muted-foreground" />
              <span className="text-xs font-bold uppercase tracking-wide text-foreground">Workflow queue</span>
              {totalUnscheduled > 0 && (
                <span className="ml-auto text-[9px] font-bold bg-[#6B7EFF]/10 text-[#6B7EFF] px-1.5 py-0.5 rounded-full">
                  {totalUnscheduled}
                </span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground">Drag tasks onto the calendar to block time</p>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-4 py-1.5 border-b border-border bg-slate-50/60">
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">Item</span>
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">Status</span>
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">Est.</span>
          </div>

          <div className="flex-1 overflow-y-auto py-1">
            {unscheduledLoading ? (
              <div className="p-4"><SkeletonRow cols={2} rows={4} /></div>
            ) : totalUnscheduled === 0 ? (
              <EmptyState
                icon={<CheckCircle2 size={24} className="text-emerald-500" />}
                title="All caught up"
                description="No unscheduled to-dos, work orders, or open leads."
              />
            ) : (
              <>
                {/* To-Dos */}
                {unscheduledTodos.length > 0 && (
                  <SidebarSection label="To-Dos" count={unscheduledTodos.length}>
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
                  <SidebarSection label="Unscheduled work orders" count={unscheduledWOs.length}>
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
                  <SidebarSection label="Open leads" count={unscheduledLeads.length} defaultOpen={false}>
                    {unscheduledLeads.map((lead) => (
                      <a
                        key={lead.id}
                        href={`/crm/leads/${lead.id}`}
                        className="mx-2.5 mb-1.5 flex items-center gap-2 p-2.5 rounded-lg border border-border bg-white hover:border-[#6B7EFF]/30 hover:bg-[#6B7EFF]/5 transition-colors"
                        style={{ borderLeft: "3px solid #6B7EFF" }}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{lead.name}</p>
                          {lead.company && (
                            <p className="text-[10px] text-muted-foreground truncate">{lead.company}</p>
                          )}
                        </div>
                        <span className="text-[9px] font-bold bg-[#6B7EFF]/10 text-[#6B7EFF] px-1.5 py-0.5 rounded-full capitalize shrink-0">
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
          <div className="px-3 py-2.5 border-t border-border bg-white">
            <div className="flex items-center gap-2 bg-slate-50 border border-border rounded-lg px-2.5 py-1.5">
              <Plus size={12} className="text-muted-foreground shrink-0" />
              <input
                value={quickAdd}
                onChange={(e) => setQuickAdd(e.target.value)}
                placeholder="Quick add — e.g. &quot;Call John Thu 2pm&quot;"
                className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && quickAdd.trim()) {
                    // Future: parse natural language and create todo
                    setQuickAdd("");
                  }
                }}
              />
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
          />
        </>
      )}
    </div>
  );
}
