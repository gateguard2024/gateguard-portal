"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonRow } from "@/components/ui/SkeletonRow";
import { ChevronLeft, ChevronRight, RefreshCw, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { CalendarDays, CalendarClock, Link2Off, Grid3X3 } = require("lucide-react") as any;

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
}

interface UnscheduledWO {
  id: string;
  title: string;
  status: string;
  site_name?: string | null;
  priority?: string | null;
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

// ─── Priority badge ───────────────────────────────────────────────────────────

function PriorityChip({ priority }: { priority?: string }) {
  const map: Record<string, string> = {
    urgent: "bg-red-100 text-red-700",
    high:   "bg-orange-100 text-orange-700",
    medium: "bg-amber-100 text-amber-700",
    low:    "bg-slate-100 text-slate-600",
  };
  const label = priority ?? "medium";
  return (
    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${map[label] ?? map.medium}`}>
      {label}
    </span>
  );
}

// ─── Event chip (calendar cell) ───────────────────────────────────────────────

function EventChip({
  event,
  onClick,
}: {
  event: CalendarEvent;
  onClick: (event: CalendarEvent, el: HTMLElement) => void;
}) {
  return (
    <button
      className="w-full text-left px-1.5 py-0.5 rounded text-[10px] font-medium truncate text-white transition-opacity hover:opacity-80"
      style={{ backgroundColor: event.color }}
      onClick={(e) => onClick(event, e.currentTarget)}
      title={event.title}
    >
      {event.time && <span className="opacity-80 mr-1">{event.time}</span>}
      {event.title}
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
  const typeLabel = event.type === "todo" ? "To-Do" : event.type === "work_order" ? "Work Order" : "Google Calendar";
  return (
    <div
      className="fixed z-50 bg-white border border-border rounded-xl shadow-xl p-4 w-64"
      style={{ top: anchor.top, left: anchor.left }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">{typeLabel}</p>
          <p className="text-sm font-semibold text-foreground leading-tight">{event.title}</p>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xs p-1">
          ✕
        </button>
      </div>
      <div className="space-y-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Clock size={11} />
          {event.date}{event.time ? ` at ${event.time}` : ""}
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle2 size={11} />
          Status: <span className="capitalize">{event.status.replace(/_/g, " ")}</span>
        </div>
        {event.priority && (
          <div className="flex items-center gap-1.5 mt-1">
            <PriorityChip priority={event.priority} />
          </div>
        )}
      </div>
      {event.link && (
        <a
          href={event.link}
          className="mt-3 flex items-center gap-1.5 text-xs font-medium text-[#6B7EFF] hover:underline"
        >
          Open detail →
        </a>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const searchParams = useSearchParams();

  const [view, setView] = useState<CalendarView>("week");
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [gcalConnected, setGcalConnected] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [activeEvent, setActiveEvent] = useState<CalendarEvent | null>(null);
  const [popoverAnchor, setPopoverAnchor] = useState<{ top: number; left: number } | null>(null);

  // Unscheduled panel
  const [unscheduledTodos, setUnscheduledTodos] = useState<UnscheduledTodo[]>([]);
  const [unscheduledWOs, setUnscheduledWOs] = useState<UnscheduledWO[]>([]);
  const [unscheduledLeads, setUnscheduledLeads] = useState<UnscheduledLead[]>([]);
  const [unscheduledLoading, setUnscheduledLoading] = useState(true);

  // Inline date pickers
  const [pickerTodoId, setPickerTodoId] = useState<string | null>(null);
  const [pickerWoId, setPickerWoId] = useState<string | null>(null);

  // Drag-drop
  const dragItem = useRef<{ type: "todo" | "wo"; id: string } | null>(null);

  // ── Show connected banner if redirected back from OAuth ─────────────────────
  const connectedParam = searchParams.get("connected");
  useEffect(() => {
    if (connectedParam === "true") {
      setGcalConnected(true);
    }
  }, [connectedParam]);

  // ── Fetch events for current month/year ──────────────────────────────────────
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const year  = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const res   = await fetch(`/api/calendar/events?year=${year}&month=${month}`);
      if (!res.ok) throw new Error("Failed to fetch events");
      const data = await res.json() as { events: CalendarEvent[] };
      setEvents(data.events ?? []);
      // Check if any GCal events → means connected
      if ((data.events ?? []).some((e: CalendarEvent) => e.type === "gcal")) {
        setGcalConnected(true);
      }
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [currentDate]);

  // ── Fetch unscheduled items ───────────────────────────────────────────────────
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
          (d.records ?? []).filter(
            (l) => !["closed_won", "closed_lost"].includes(l.stage)
          )
        );
      }
    } catch {
      // Non-critical — leave empty
    } finally {
      setUnscheduledLoading(false);
    }
  }, []);

  useEffect(() => { void fetchEvents(); }, [fetchEvents]);
  useEffect(() => { void fetchUnscheduled(); }, [fetchUnscheduled]);

  // Check GCal last synced
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/calendar/google/status");
        if (res.ok) {
          const d = await res.json() as { connected?: boolean; last_synced?: string };
          if (d.connected) setGcalConnected(true);
          if (d.last_synced) setLastSynced(d.last_synced);
        }
      } catch {
        // Ignore — GCal status is non-critical
      }
    })();
  }, []);

  // ── Navigation ────────────────────────────────────────────────────────────────
  function goBack() {
    setCurrentDate((d) => {
      const nd = new Date(d);
      if (view === "week") {
        nd.setDate(nd.getDate() - 7);
      } else {
        nd.setMonth(nd.getMonth() - 1);
      }
      return nd;
    });
  }

  function goForward() {
    setCurrentDate((d) => {
      const nd = new Date(d);
      if (view === "week") {
        nd.setDate(nd.getDate() + 7);
      } else {
        nd.setMonth(nd.getMonth() + 1);
      }
      return nd;
    });
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

  // ── Event chip click → popover ────────────────────────────────────────────────
  function handleEventClick(event: CalendarEvent, el: HTMLElement) {
    setActiveEvent(event);
    const rect = el.getBoundingClientRect();
    // Position popover below the chip, clamped to viewport
    const top  = Math.min(rect.bottom + 8, window.innerHeight - 220);
    const left = Math.min(rect.left, window.innerWidth - 272);
    setPopoverAnchor({ top, left });
  }

  // ── Date setter for unscheduled items ─────────────────────────────────────────
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
    } catch {
      // Ignore
    }
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
    } catch {
      // Ignore
    }
  }

  // ── Drag-and-drop handlers ────────────────────────────────────────────────────
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

  // ── Week view: compute days in current week ────────────────────────────────────
  function getWeekDays(): Date[] {
    const d    = new Date(currentDate);
    const day  = d.getDay(); // 0=Sun
    const diff = d.getDate() - day;
    const sunday = new Date(d.setDate(diff));
    return Array.from({ length: 7 }, (_, i) => {
      const dd = new Date(sunday);
      dd.setDate(sunday.getDate() + i);
      return dd;
    });
  }

  // ── Month view: compute grid cells ────────────────────────────────────────────
  function getMonthCells(): (Date | null)[] {
    const year  = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    // Pad to complete last row
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────
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

  // ── Header label ──────────────────────────────────────────────────────────────
  function getHeaderLabel(): string {
    if (view === "month") {
      return `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    }
    const days = getWeekDays();
    const start = days[0];
    const end   = days[6];
    if (start.getMonth() === end.getMonth()) {
      return `${MONTH_NAMES[start.getMonth()]} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`;
    }
    return `${MONTH_NAMES[start.getMonth()]} ${start.getDate()} – ${MONTH_NAMES[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
  }

  // ── Relative sync time ────────────────────────────────────────────────────────
  function relativeSyncTime(): string {
    if (!lastSynced) return "";
    const diff = Math.floor((Date.now() - new Date(lastSynced).getTime()) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  }

  const totalUnscheduled = unscheduledTodos.length + unscheduledWOs.length + unscheduledLeads.length;

  // ── Week view rendering ───────────────────────────────────────────────────────
  function renderWeekView() {
    const weekDays = getWeekDays();
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
                className="py-3 px-2 text-center border-r border-border last:border-r-0"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { void handleDropOnDay(toDateStr(day)); }}
              >
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                  {DAY_NAMES[day.getDay()]}
                </p>
                <div className={`w-8 h-8 flex items-center justify-center mx-auto mt-1 rounded-full text-sm font-bold transition-colors ${
                  today
                    ? "bg-[#6B7EFF] text-white"
                    : "text-foreground"
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
            const dateStr = toDateStr(day);
            const dayEvents = eventsForDate(dateStr);
            const allDay    = dayEvents.filter((e) => !e.time);
            const timed     = dayEvents.filter((e) => !!e.time);

            return (
              <div
                key={i}
                className="min-h-[200px] border-r border-b border-border last:border-r-0 p-1.5 space-y-1"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { void handleDropOnDay(dateStr); }}
              >
                {/* All-day items first */}
                {allDay.map((ev) => (
                  <EventChip key={ev.id} event={ev} onClick={handleEventClick} />
                ))}
                {/* Timed items */}
                {timed.map((ev) => (
                  <EventChip key={ev.id} event={ev} onClick={handleEventClick} />
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

  // ── Month view rendering ──────────────────────────────────────────────────────
  function renderMonthView() {
    const cells = getMonthCells();

    return (
      <div className="flex-1 min-h-0 overflow-auto">
        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 border-b border-border bg-white sticky top-0 z-10">
          {DAY_NAMES.map((name) => (
            <div key={name} className="py-2 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wide border-r border-border last:border-r-0">
              {name}
            </div>
          ))}
        </div>

        {/* Month grid */}
        <div className="grid grid-cols-7">
          {cells.map((cell, idx) => {
            if (!cell) {
              return (
                <div key={`empty-${idx}`} className="min-h-[110px] bg-slate-50/60 border-r border-b border-border last:border-r-0" />
              );
            }
            const dateStr  = toDateStr(cell);
            const dayEvents = eventsForDate(dateStr);
            const visible  = dayEvents.slice(0, 3);
            const overflow = dayEvents.length - 3;
            const today    = isToday(cell);

            return (
              <div
                key={dateStr}
                className="min-h-[110px] border-r border-b border-border last:border-r-0 p-1.5"
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
                    <EventChip key={ev.id} event={ev} onClick={handleEventClick} />
                  ))}
                  {overflow > 0 && (
                    <p className="text-[9px] font-medium text-muted-foreground px-1">
                      +{overflow} more
                    </p>
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
            Connect Google Calendar to sync your events across platforms.
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
        {/* ── Left panel: calendar ──────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-h-0 p-6 pr-3 gap-4">
          {/* Calendar header */}
          <div className="flex items-center gap-4 flex-wrap">
            {/* View toggle */}
            <div className="flex items-center bg-white border border-border rounded-lg p-0.5">
              <button
                onClick={() => setView("week")}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  view === "week"
                    ? "bg-[#6B7EFF] text-white"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Week
              </button>
              <button
                onClick={() => setView("month")}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  view === "month"
                    ? "bg-[#6B7EFF] text-white"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Month
              </button>
            </div>

            {/* Date navigation */}
            <div className="flex items-center gap-2">
              <button
                onClick={goBack}
                className="p-1.5 rounded-lg hover:bg-accent transition-colors border border-border"
              >
                <ChevronLeft size={14} className="text-muted-foreground" />
              </button>
              <span className="text-sm font-semibold text-foreground min-w-[200px] text-center">
                {getHeaderLabel()}
              </span>
              <button
                onClick={goForward}
                className="p-1.5 rounded-lg hover:bg-accent transition-colors border border-border"
              >
                <ChevronRight size={14} className="text-muted-foreground" />
              </button>
            </div>

            <div className="flex-1" />

            {/* Google Calendar controls */}
            <div className="flex items-center gap-2">
              {gcalConnected ? (
                <>
                  <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                    Google Calendar Connected
                  </span>
                  {lastSynced && (
                    <span className="text-[10px] text-muted-foreground">
                      Last synced: {relativeSyncTime()}
                    </span>
                  )}
                  <button
                    onClick={() => { void handleSync(); }}
                    disabled={syncing}
                    className="p-1.5 rounded-lg hover:bg-accent transition-colors border border-border"
                    title="Sync with Google Calendar"
                  >
                    <RefreshCw size={14} className={`text-muted-foreground ${syncing ? "animate-spin" : ""}`} />
                  </button>
                </>
              ) : (
                <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-white border border-border px-2.5 py-1 rounded-full">
                  <Link2Off size={11} />
                  Not Connected
                </span>
              )}
            </div>
          </div>

          {/* Calendar grid */}
          <div className="flex-1 bg-white border border-border rounded-xl overflow-hidden flex flex-col min-h-0">
            {loading ? (
              <div className="p-4">
                <SkeletonRow cols={7} rows={4} />
              </div>
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
              <span className="w-2.5 h-2.5 rounded-sm bg-[#F59E0B] inline-block" />
              Work Orders
            </span>
            {gcalConnected && (
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#10B981] inline-block" />
                Google Calendar
              </span>
            )}
          </div>
        </div>

        {/* ── Right panel: unscheduled ────────────────────────────────────────── */}
        <div className="w-80 border-l border-border bg-white flex flex-col">
          <div className="px-4 py-4 border-b border-border flex items-center gap-2">
            <CalendarClock size={16} className="text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">Unscheduled</span>
            {totalUnscheduled > 0 && (
              <span className="ml-auto text-[10px] font-bold bg-[#6B7EFF]/10 text-[#6B7EFF] px-1.5 py-0.5 rounded-full">
                {totalUnscheduled}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {unscheduledLoading ? (
              <div className="p-4">
                <SkeletonRow cols={2} rows={4} />
              </div>
            ) : totalUnscheduled === 0 ? (
              <EmptyState
                icon={<CheckCircle2 size={24} className="text-emerald-500" />}
                title="All caught up"
                description="No unscheduled to-dos, work orders, or open leads."
              />
            ) : (
              <div className="p-3 space-y-4">
                {/* Open To-Dos */}
                {unscheduledTodos.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2 px-1">
                      Open To-Dos ({unscheduledTodos.length})
                    </p>
                    <div className="space-y-1.5">
                      {unscheduledTodos.map((todo) => (
                        <div
                          key={todo.id}
                          draggable
                          onDragStart={() => handleDragStart("todo", todo.id)}
                          className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-white hover:border-[#6B7EFF]/30 hover:bg-[#6B7EFF]/5 transition-colors cursor-grab active:cursor-grabbing group"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">{todo.title}</p>
                            <div className="mt-0.5">
                              <PriorityChip priority={todo.priority} />
                            </div>
                          </div>
                          {pickerTodoId === todo.id ? (
                            <input
                              type="date"
                              autoFocus
                              className="text-xs border border-[#6B7EFF] rounded px-1.5 py-1 w-32 focus:outline-none"
                              onChange={(e) => {
                                if (e.target.value) void setTodoDate(todo.id, e.target.value);
                              }}
                              onBlur={() => setPickerTodoId(null)}
                            />
                          ) : (
                            <button
                              onClick={() => setPickerTodoId(todo.id)}
                              className="text-[10px] text-[#6B7EFF] font-medium hover:underline shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              Set date
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Unscheduled Work Orders */}
                {unscheduledWOs.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2 px-1">
                      Work Orders ({unscheduledWOs.length})
                    </p>
                    <div className="space-y-1.5">
                      {unscheduledWOs.map((wo) => (
                        <div
                          key={wo.id}
                          draggable
                          onDragStart={() => handleDragStart("wo", wo.id)}
                          className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-white hover:border-[#F59E0B]/30 hover:bg-amber-50/50 transition-colors cursor-grab active:cursor-grabbing group"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">{wo.title}</p>
                            {wo.site_name && (
                              <p className="text-[10px] text-muted-foreground truncate">{wo.site_name}</p>
                            )}
                            {wo.priority && (
                              <div className="mt-0.5">
                                <PriorityChip priority={wo.priority} />
                              </div>
                            )}
                          </div>
                          {pickerWoId === wo.id ? (
                            <input
                              type="date"
                              autoFocus
                              className="text-xs border border-[#F59E0B] rounded px-1.5 py-1 w-32 focus:outline-none"
                              onChange={(e) => {
                                if (e.target.value) void setWODate(wo.id, e.target.value);
                              }}
                              onBlur={() => setPickerWoId(null)}
                            />
                          ) : (
                            <button
                              onClick={() => setPickerWoId(wo.id)}
                              className="text-[10px] text-amber-600 font-medium hover:underline shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              Schedule
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Open Leads */}
                {unscheduledLeads.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2 px-1">
                      Open Leads ({unscheduledLeads.length})
                    </p>
                    <div className="space-y-1.5">
                      {unscheduledLeads.map((lead) => (
                        <a
                          key={lead.id}
                          href={`/crm/leads/${lead.id}`}
                          className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-white hover:border-[#6B7EFF]/30 hover:bg-[#6B7EFF]/5 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">{lead.name}</p>
                            {lead.company && (
                              <p className="text-[10px] text-muted-foreground truncate">{lead.company}</p>
                            )}
                          </div>
                          <span className="text-[9px] font-semibold bg-[#6B7EFF]/10 text-[#6B7EFF] px-1.5 py-0.5 rounded-full capitalize shrink-0">
                            {lead.stage.replace(/_/g, " ")}
                          </span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Drag hint */}
                <div className="mt-2 px-1 py-2 bg-slate-50 rounded-lg border border-dashed border-border text-center">
                  <p className="text-[9px] text-muted-foreground">
                    Drag items onto a calendar day to schedule them
                  </p>
                </div>
              </div>
            )}
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
