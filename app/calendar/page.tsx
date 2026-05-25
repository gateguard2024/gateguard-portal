"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonRow } from "@/components/ui/SkeletonRow";
import { ChevronLeft, ChevronRight, RefreshCw, CheckCircle2, Clock, ChevronDown, Users } from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { CalendarDays, CalendarClock, Settings, Save, Eye, EyeOff, Wrench2 } = require("lucide-react") as any;

// ─── Types ────────────────────────────────────────────────────────────────────

interface CalendarEvent {
  id: string;
  type: "todo" | "work_order" | "gcal" | "company" | "meeting";
  title: string;
  date: string;
  time?: string;
  status: string;
  priority?: string;
  color: string;
  link?: string;
  gcal_event_id?: string;
  source: string;
  isCompany?: boolean;
  assignee?: string;
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

type CalendarView = "week" | "month";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// ─── Calendar source definitions ──────────────────────────────────────────────

interface CalendarSource {
  id: string;
  label: string;
  color: string;
  group: string;
  adminOnly?: boolean;
  description?: string;
}

const CALENDAR_SOURCES: CalendarSource[] = [
  // My Calendar
  { id: "my_todos",       label: "My To-Dos",         color: "#6B7EFF", group: "Mine",   description: "To-dos with due dates" },
  { id: "my_workorders",  label: "My Work Orders",     color: "#F59E0B", group: "Mine",   description: "Work orders assigned to me" },
  // Team
  { id: "all_installs",   label: "All Installs",       color: "#8B5CF6", group: "Team",   description: "Every install org-wide" },
  { id: "all_service",    label: "All Service Calls",  color: "#F97316", group: "Team",   description: "Every service WO org-wide" },
  { id: "sales_meetings", label: "Sales Appointments", color: "#10B981", group: "Team",   description: "CRM meetings & appointments" },
  // Company
  { id: "company",        label: "Company Events",     color: "#6B7EFF", group: "Company", description: "L10s, permit/quote expiries, GG events" },
];

const SOURCE_GROUPS = ["Mine", "Team", "Company"];

// ─── Priority chip ────────────────────────────────────────────────────────────

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

// ─── Event chip ───────────────────────────────────────────────────────────────

function EventChip({
  event,
  onClick,
}: {
  event: CalendarEvent;
  onClick: (event: CalendarEvent, el: HTMLElement) => void;
}) {
  const isCompany = event.isCompany;
  return (
    <button
      className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] font-medium truncate transition-opacity hover:opacity-80 ${
        isCompany
          ? "border-l-2 text-slate-700 bg-slate-50"
          : "text-white"
      }`}
      style={
        isCompany
          ? { borderLeftColor: event.color, backgroundColor: `${event.color}14` }
          : { backgroundColor: event.color }
      }
      onClick={(e) => onClick(event, e.currentTarget)}
      title={event.title}
    >
      {event.time && <span className={`mr-1 ${isCompany ? "opacity-60" : "opacity-80"}`}>{event.time}</span>}
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
  const src = CALENDAR_SOURCES.find((s) => s.id === event.source);
  const typeLabel = src?.label ?? (
    event.type === "todo"       ? "To-Do" :
    event.type === "work_order" ? "Work Order" :
    event.type === "meeting"    ? "Sales Meeting" :
    event.type === "company"    ? "Company Event" : "Event"
  );

  return (
    <div
      className="fixed z-50 bg-white border border-border rounded-xl shadow-xl p-4 w-72"
      style={{ top: anchor.top, left: anchor.left }}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span
              className="w-2 h-2 rounded-full shrink-0 inline-block"
              style={{ backgroundColor: event.color }}
            />
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{typeLabel}</p>
          </div>
          <p className="text-sm font-semibold text-foreground leading-tight">{event.title}</p>
          {event.assignee && (
            <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
              <Users size={10} />
              {event.assignee}
            </p>
          )}
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xs p-1 shrink-0">✕</button>
      </div>
      <div className="space-y-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Clock size={11} />
          {event.date}{event.time ? ` at ${event.time}` : ""}
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle2 size={11} />
          <span className="capitalize">{event.status.replace(/_/g, " ")}</span>
        </div>
        {event.priority && <div className="mt-1"><PriorityChip priority={event.priority} /></div>}
      </div>
      {event.link && (
        <a
          href={event.link}
          className="mt-3 flex items-center gap-1.5 text-xs font-medium text-[#6B7EFF] hover:underline"
        >
          Open →
        </a>
      )}
    </div>
  );
}

// ─── Sources panel (left rail) ────────────────────────────────────────────────

function SourcesRail({
  activeSources,
  onChange,
  gcalConnected,
  lastSynced,
  onSync,
  syncing,
}: {
  activeSources: Set<string>;
  onChange: (next: Set<string>) => void;
  gcalConnected: boolean;
  lastSynced: string | null;
  onSync: () => void;
  syncing: boolean;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  function toggle(id: string) {
    const next = new Set(activeSources);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onChange(next);
  }

  function toggleGroup(group: string) {
    const groupSources = CALENDAR_SOURCES.filter((s) => s.group === group).map((s) => s.id);
    const allOn = groupSources.every((id) => activeSources.has(id));
    const next = new Set(activeSources);
    groupSources.forEach((id) => allOn ? next.delete(id) : next.add(id));
    onChange(next);
  }

  const allOn = CALENDAR_SOURCES.every((s) => activeSources.has(s.id));

  function relativeSyncTime(): string {
    if (!lastSynced) return "";
    const diff = Math.floor((Date.now() - new Date(lastSynced).getTime()) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  }

  return (
    <div className="w-56 shrink-0 border-r border-border bg-white flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="px-3 pt-4 pb-2 border-b border-border">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2">Calendars</p>
        {/* Show All / My Calendar toggle */}
        <button
          onClick={() => onChange(new Set(allOn ? ["my_todos"] : CALENDAR_SOURCES.map((s) => s.id)))}
          className={`w-full flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors ${
            allOn
              ? "bg-[#6B7EFF] text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          {allOn ? <Eye size={12} /> : <EyeOff size={12} />}
          {allOn ? "Showing All" : "My Calendar Only"}
        </button>
      </div>

      {/* Source groups */}
      <div className="flex-1 p-2 space-y-1">
        {SOURCE_GROUPS.map((group) => {
          const sources = CALENDAR_SOURCES.filter((s) => s.group === group);
          const isCollapsed = collapsed[group];
          const groupAllOn = sources.every((s) => activeSources.has(s.id));
          const groupSomeOn = sources.some((s) => activeSources.has(s.id));

          return (
            <div key={group}>
              {/* Group header */}
              <button
                className="w-full flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-accent transition-colors group"
                onClick={() => setCollapsed((p) => ({ ...p, [group]: !p[group] }))}
              >
                <ChevronDown
                  size={11}
                  className={`text-muted-foreground transition-transform shrink-0 ${isCollapsed ? "-rotate-90" : ""}`}
                />
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide flex-1 text-left">
                  {group}
                </span>
                {/* Group toggle dot */}
                <span
                  className={`w-2 h-2 rounded-full shrink-0 transition-all ${
                    groupAllOn ? "opacity-100" : groupSomeOn ? "opacity-40" : "opacity-10"
                  }`}
                  style={{ backgroundColor: sources[0]?.color ?? "#6B7EFF" }}
                  onClick={(e) => { e.stopPropagation(); toggleGroup(group); }}
                  title={groupAllOn ? `Hide all ${group}` : `Show all ${group}`}
                />
              </button>

              {/* Sources in group */}
              {!isCollapsed && (
                <div className="ml-2 space-y-0.5">
                  {sources.map((src) => {
                    const active = activeSources.has(src.id);
                    return (
                      <button
                        key={src.id}
                        onClick={() => toggle(src.id)}
                        title={src.description}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-accent transition-colors text-left"
                      >
                        {/* Color checkbox */}
                        <span
                          className="w-3 h-3 rounded shrink-0 border-2 transition-all flex items-center justify-center"
                          style={{
                            backgroundColor: active ? src.color : "transparent",
                            borderColor: src.color,
                          }}
                        >
                          {active && (
                            <svg width="7" height="5" viewBox="0 0 7 5" fill="none">
                              <path d="M1 2.5L2.8 4L6 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </span>
                        <span className={`text-xs truncate ${active ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                          {src.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* External calendars section */}
      <div className="border-t border-border p-3">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2">External</p>
        {gcalConnected ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-emerald-50">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-xs font-medium text-emerald-700 flex-1 truncate">Google Calendar</span>
              <button
                onClick={onSync}
                disabled={syncing}
                className="shrink-0"
                title="Sync now"
              >
                <RefreshCw size={11} className={`text-emerald-600 ${syncing ? "animate-spin" : ""}`} />
              </button>
            </div>
            {lastSynced && (
              <p className="text-[9px] text-muted-foreground px-2">
                Pushed {relativeSyncTime()}
              </p>
            )}
          </div>
        ) : (
          <a
            href="/api/calendar/google/connect"
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:border-[#6B7EFF]/40 hover:text-[#6B7EFF] transition-colors"
          >
            <CalendarDays size={12} />
            Push to Google Cal
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Main wrapper ─────────────────────────────────────────────────────────────

export default function CalendarPageWrapper() {
  return (
    <Suspense fallback={<div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{color:"#6B7EFF"}}>Loading…</div></div>}>
      <CalendarPage />
    </Suspense>
  );
}

function CalendarPage() {
  const searchParams = useSearchParams();

  const [view, setView]           = useState<CalendarView>("week");
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [events, setEvents]       = useState<CalendarEvent[]>([]);
  const [loading, setLoading]     = useState(true);
  const [syncing, setSyncing]     = useState(false);
  const [gcalConnected, setGcalConnected] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [activeEvent, setActiveEvent]   = useState<CalendarEvent | null>(null);
  const [popoverAnchor, setPopoverAnchor] = useState<{ top: number; left: number } | null>(null);

  // All sources on by default
  const [activeSources, setActiveSources] = useState<Set<string>>(
    new Set(CALENDAR_SOURCES.map((s) => s.id))
  );

  // Unscheduled panel
  const [unscheduledTodos, setUnscheduledTodos] = useState<UnscheduledTodo[]>([]);
  const [unscheduledWOs, setUnscheduledWOs]     = useState<UnscheduledWO[]>([]);
  const [unscheduledLoading, setUnscheduledLoading] = useState(true);

  // Inline date pickers
  const [pickerTodoId, setPickerTodoId] = useState<string | null>(null);
  const [pickerWoId, setPickerWoId]     = useState<string | null>(null);

  // Drag-drop
  const dragItem = useRef<{ type: "todo" | "wo"; id: string } | null>(null);

  // ── GCal status on mount ──────────────────────────────────────────────────
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/calendar/google/status");
        if (res.ok) {
          const d = await res.json() as { connected: boolean; last_synced?: string };
          setGcalConnected(d.connected ?? false);
          if (d.last_synced) setLastSynced(d.last_synced);
        }
      } catch { /* ignore */ }
    })();
    const cp = searchParams.get("connected");
    if (cp === "true") setGcalConnected(true);
  }, [searchParams]);

  // ── Fetch events ──────────────────────────────────────────────────────────
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const year   = currentDate.getFullYear();
      const month  = currentDate.getMonth() + 1;
      const sources = Array.from(activeSources).join(",");
      const res = await fetch(`/api/calendar/events?year=${year}&month=${month}&sources=${sources}`);
      if (res.ok) {
        const d = await res.json() as { events: CalendarEvent[] };
        setEvents(d.events ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [currentDate, activeSources]);

  useEffect(() => { void fetchEvents(); }, [fetchEvents]);

  // ── Unscheduled ───────────────────────────────────────────────────────────
  useEffect(() => {
    setUnscheduledLoading(true);
    void (async () => {
      try {
        const [todosRes, wosRes] = await Promise.all([
          fetch("/api/todos?status=open&no_due_date=true&limit=20"),
          fetch("/api/maintenance?status=open&no_schedule=true&limit=20"),
        ]);
        if (todosRes.ok) {
          const d = await todosRes.json() as { todos?: UnscheduledTodo[] };
          setUnscheduledTodos((d.todos ?? []).filter((t) => !t.due_date));
        }
        if (wosRes.ok) {
          const d = await wosRes.json() as { work_orders?: UnscheduledWO[] };
          setUnscheduledWOs(d.work_orders ?? []);
        }
      } finally {
        setUnscheduledLoading(false);
      }
    })();
  }, []);

  // ── Navigation ────────────────────────────────────────────────────────────
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

  // ── GCal sync ─────────────────────────────────────────────────────────────
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

  // ── Event popover ─────────────────────────────────────────────────────────
  function handleEventClick(event: CalendarEvent, el: HTMLElement) {
    setActiveEvent(event);
    const rect = el.getBoundingClientRect();
    setPopoverAnchor({
      top:  Math.min(rect.bottom + 8, window.innerHeight - 240),
      left: Math.min(rect.left, window.innerWidth - 288),
    });
  }

  // ── Date setting ──────────────────────────────────────────────────────────
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

  // ── Drag-drop ─────────────────────────────────────────────────────────────
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

  // ── Week/month helpers ────────────────────────────────────────────────────
  function getWeekDays(): Date[] {
    const d = new Date(currentDate);
    const sunday = new Date(d.setDate(d.getDate() - d.getDay()));
    return Array.from({ length: 7 }, (_, i) => {
      const dd = new Date(sunday);
      dd.setDate(sunday.getDate() + i);
      return dd;
    });
  }
  function getMonthCells(): (Date | null)[] {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
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
    if (view === "month") return `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    const days = getWeekDays();
    const s = days[0], e = days[6];
    if (s.getMonth() === e.getMonth()) {
      return `${MONTH_NAMES[s.getMonth()]} ${s.getDate()}–${e.getDate()}, ${s.getFullYear()}`;
    }
    return `${MONTH_NAMES[s.getMonth()]} ${s.getDate()} – ${MONTH_NAMES[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
  }

  const totalUnscheduled = unscheduledTodos.length + unscheduledWOs.length;

  // ── Week view ─────────────────────────────────────────────────────────────
  function renderWeekView() {
    const weekDays = getWeekDays();
    const hasAny = weekDays.some((d) => eventsForDate(toDateStr(d)).length > 0);
    return (
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="grid grid-cols-7 border-b border-border bg-white sticky top-0 z-10">
          {weekDays.map((day, i) => (
            <div
              key={i}
              className="py-3 px-2 text-center border-r border-border last:border-r-0"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { void handleDropOnDay(toDateStr(day)); }}
            >
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                {DAY_NAMES[day.getDay()]}
              </p>
              <div className={`w-8 h-8 flex items-center justify-center mx-auto mt-1 rounded-full text-sm font-bold ${
                isToday(day) ? "bg-[#6B7EFF] text-white" : "text-foreground"
              }`}>
                {day.getDate()}
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {weekDays.map((day, i) => {
            const dateStr = toDateStr(day);
            const dayEvents = eventsForDate(dateStr);
            return (
              <div
                key={i}
                className="min-h-[200px] border-r border-b border-border last:border-r-0 p-1.5 space-y-0.5"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { void handleDropOnDay(dateStr); }}
              >
                {dayEvents.map((ev) => (
                  <EventChip key={ev.id} event={ev} onClick={handleEventClick} />
                ))}
              </div>
            );
          })}
        </div>
        {!loading && !hasAny && (
          <div className="py-8">
            <EmptyState
              icon={<CalendarDays size={28} className="text-muted-foreground" />}
              title="No events this week"
              description="Scheduled work orders, to-dos, and meetings will appear here."
            />
          </div>
        )}
      </div>
    );
  }

  // ── Month view ────────────────────────────────────────────────────────────
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
            if (!cell) return (
              <div key={`empty-${idx}`} className="min-h-[110px] bg-slate-50/60 border-r border-b border-border last:border-r-0" />
            );
            const dateStr = toDateStr(cell);
            const dayEvents = eventsForDate(dateStr);
            const visible = dayEvents.slice(0, 3);
            const overflow = dayEvents.length - 3;
            return (
              <div
                key={dateStr}
                className="min-h-[110px] border-r border-b border-border last:border-r-0 p-1.5"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { void handleDropOnDay(dateStr); }}
              >
                <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold mb-1 ${
                  isToday(cell) ? "bg-[#6B7EFF] text-white" : "text-foreground"
                }`}>
                  {cell.getDate()}
                </div>
                <div className="space-y-0.5">
                  {visible.map((ev) => (
                    <EventChip key={ev.id} event={ev} onClick={handleEventClick} />
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

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-[#F8FAFC]">
      <TopBar title="Calendar" subtitle="Your schedule across all work types" />

      <div className="flex flex-1 min-h-0">
        {/* ── Left: Sources rail ────────────────────────────────────────── */}
        <SourcesRail
          activeSources={activeSources}
          onChange={setActiveSources}
          gcalConnected={gcalConnected}
          lastSynced={lastSynced}
          onSync={() => { void handleSync(); }}
          syncing={syncing}
        />

        {/* ── Center: Calendar ──────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Calendar header bar */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-white">
            {/* View toggle */}
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
              {(["week", "month"] as CalendarView[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors capitalize ${
                    view === v ? "bg-white text-foreground shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>

            {/* Date nav */}
            <div className="flex items-center gap-1">
              <button onClick={goBack} className="p-1.5 rounded-lg hover:bg-accent transition-colors border border-border">
                <ChevronLeft size={14} className="text-muted-foreground" />
              </button>
              <span className="text-sm font-semibold text-foreground min-w-[200px] text-center">
                {getHeaderLabel()}
              </span>
              <button onClick={goForward} className="p-1.5 rounded-lg hover:bg-accent transition-colors border border-border">
                <ChevronRight size={14} className="text-muted-foreground" />
              </button>
            </div>

            <button
              onClick={() => setCurrentDate(new Date())}
              className="text-xs font-medium text-muted-foreground hover:text-foreground px-2.5 py-1 rounded-lg border border-border hover:bg-accent transition-colors"
            >
              Today
            </button>

            <div className="flex-1" />

            {/* Event count badge */}
            {events.length > 0 && (
              <span className="text-xs text-muted-foreground bg-slate-100 px-2 py-0.5 rounded-full">
                {events.length} event{events.length !== 1 ? "s" : ""}
              </span>
            )}

            {loading && (
              <RefreshCw size={14} className="text-muted-foreground animate-spin" />
            )}
          </div>

          {/* Calendar grid */}
          <div className="flex-1 bg-white border-b border-border overflow-hidden flex flex-col min-h-0">
            {loading ? (
              <div className="p-4"><SkeletonRow cols={7} rows={4} /></div>
            ) : (
              view === "week" ? renderWeekView() : renderMonthView()
            )}
          </div>

          {/* Legend strip */}
          <div className="flex items-center gap-4 px-4 py-2 bg-white border-t border-border flex-wrap">
            {CALENDAR_SOURCES.filter((s) => activeSources.has(s.id)).map((src) => (
              <span key={src.id} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: src.color }} />
                {src.label}
              </span>
            ))}
          </div>
        </div>

        {/* ── Right: Unscheduled ────────────────────────────────────────── */}
        <div className="w-72 border-l border-border bg-white flex flex-col">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <CalendarClock size={15} className="text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">Unscheduled</span>
            {totalUnscheduled > 0 && (
              <span className="ml-auto text-[10px] font-bold bg-[#6B7EFF]/10 text-[#6B7EFF] px-1.5 py-0.5 rounded-full">
                {totalUnscheduled}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {unscheduledLoading ? (
              <div className="p-4"><SkeletonRow cols={2} rows={4} /></div>
            ) : totalUnscheduled === 0 ? (
              <EmptyState
                icon={<CheckCircle2 size={22} className="text-emerald-500" />}
                title="All scheduled"
                description="No unscheduled to-dos or work orders."
              />
            ) : (
              <div className="p-3 space-y-4">
                {unscheduledTodos.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2 px-1 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#6B7EFF] inline-block" />
                      To-Dos ({unscheduledTodos.length})
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
                            <div className="mt-0.5"><PriorityChip priority={todo.priority} /></div>
                          </div>
                          {pickerTodoId === todo.id ? (
                            <input
                              type="date" autoFocus
                              className="text-xs border border-[#6B7EFF] rounded px-1.5 py-1 w-32 focus:outline-none"
                              onChange={(e) => { if (e.target.value) void setTodoDate(todo.id, e.target.value); }}
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

                {unscheduledWOs.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2 px-1 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#F59E0B] inline-block" />
                      Work Orders ({unscheduledWOs.length})
                    </p>
                    <div className="space-y-1.5">
                      {unscheduledWOs.map((wo) => (
                        <div
                          key={wo.id}
                          draggable
                          onDragStart={() => handleDragStart("wo", wo.id)}
                          className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-white hover:border-amber-300 hover:bg-amber-50/50 transition-colors cursor-grab active:cursor-grabbing group"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">{wo.title}</p>
                            {wo.site_name && (
                              <p className="text-[10px] text-muted-foreground truncate">{wo.site_name}</p>
                            )}
                            {wo.priority && <div className="mt-0.5"><PriorityChip priority={wo.priority} /></div>}
                          </div>
                          {pickerWoId === wo.id ? (
                            <input
                              type="date" autoFocus
                              className="text-xs border border-amber-400 rounded px-1.5 py-1 w-32 focus:outline-none"
                              onChange={(e) => { if (e.target.value) void setWODate(wo.id, e.target.value); }}
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

                <div className="px-1 py-2 bg-slate-50 rounded-lg border border-dashed border-border text-center">
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
          <div className="fixed inset-0 z-40" onClick={() => { setActiveEvent(null); setPopoverAnchor(null); }} />
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
