'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, Calendar, X, Clock, MapPin } from 'lucide-react';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { ChevronDown } = require('lucide-react') as any;
import { NEXUS_BG } from '@/components/nexus/NexusBackdrop';
// --- Data Contracts & Types ---
type CalCategory = 'jobs' | 'sales' | 'todos' | 'google';
type CalEvent = {
  id: string;
  title: string;
  start: string;          // ISO
  end?: string | null;    // ISO
  all_day?: boolean;
  category: CalCategory;
  location?: string | null;
  href?: string | null;
};
// Map the API's event `type` → calendar category.
const TYPE_TO_CAT: Record<string, CalCategory> = {
  nexus_event: 'jobs',
  work_order: 'jobs',
  work_order_phase: 'jobs',
  pm_schedule: 'jobs',
  todo: 'todos',
  tracker_task: 'todos',
  crm_activity: 'sales',
  gcal: 'google',
};
// --- Real API (GET ?year&month&scope → {events:[{id,type,title,date,time,...}]}) ---
const loadEvents = async (startISO: string, _endISO: string, scope: 'me' | 'team'): Promise<CalEvent[]> => {
  try {
    const d = new Date(startISO);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const res = await fetch(`/api/calendar/events?year=${year}&month=${month}&scope=${scope}`, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      const list = Array.isArray(json.events) ? json.events : Array.isArray(json) ? json : [];
      return list.map((ev: any): CalEvent => {
        const time: string | null = ev.time && ev.time !== '' ? ev.time : null;
        const date: string = ev.date ?? (ev.start_time ? String(ev.start_time).split('T')[0] : '');
        return {
          id: String(ev.id),
          title: ev.title ?? 'Event',
          start: ev.start ?? `${date}T${time ?? '00:00'}:00`,
          end: ev.end ?? ev.end_time ?? null,
          all_day: ev.all_day ?? !time,
          category: ev.category ?? TYPE_TO_CAT[ev.type] ?? 'todos',
          location: ev.location ?? null,
          href: ev.href ?? null,
        };
      });
    }
  } catch {
    /* fall through to preview */
  }
  return mockEvents(startISO);
};
const mockEvents = (startISO: string): CalEvent[] => {
  const b = new Date(startISO); const y = b.getFullYear(); const m = b.getMonth();
  return [
    { id: 'e1', title: 'Install at Avalon', start: new Date(y, m, 14, 9, 0).toISOString(), end: new Date(y, m, 14, 11, 0).toISOString(), category: 'jobs', location: '123 Avalon Heights' },
    { id: 'e3', title: 'Quote Review - Beacon', start: new Date(y, m, 16, 14, 0).toISOString(), category: 'sales' },
    { id: 'e4', title: 'Order parts for Kim Plaza', start: new Date(y, m, 14, 0, 0).toISOString(), all_day: true, category: 'todos' },
  ];
};
const createEvent = async (form: Partial<CalEvent> & { scope: 'me' | 'team' }): Promise<CalEvent> => {
  const category: CalCategory = form.category || 'jobs';
  try {
    // Route the create by the chosen category — the type the user picked must
    // decide where it's saved, not always the work-order/calendar endpoint.
    if (category === 'todos') {
      // To-Do → /api/todos (shows on the calendar via the To-Dos source).
      const dueDate = form.start ? String(form.start).split('T')[0] : undefined;
      const res = await fetch('/api/todos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: form.title, due_date: dueDate ?? null }),
      });
      if (res.ok) {
        const json = await res.json();
        const t = json.todo ?? json.record ?? json;
        return {
          id: String(t?.id ?? `td-${Date.now()}`),
          title: (t?.title as string) ?? form.title ?? 'New To-Do',
          start: (t?.due_date ? `${String(t.due_date).split('T')[0]}T00:00:00` : form.start) ?? new Date().toISOString(),
          end: null,
          all_day: true,
          category: 'todos',
          location: form.location,
          href: '/todos',
        };
      }
    } else if (category === 'google') {
      // Google → save locally first, then push to Google Calendar (best-effort).
      const res = await fetch('/api/calendar/events', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: form.title, start: form.start, end: form.end, all_day: form.all_day, location: form.location }),
      });
      void fetch('/api/calendar/google/sync', { method: 'POST' }).catch(() => {});
      if (res.ok) {
        const json = await res.json();
        if (json.event) return { ...(json.event as CalEvent), category: 'google' };
      }
    } else {
      // event / sales → local calendar_events (source of truth).
      const res = await fetch('/api/calendar/events', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: form.title, start: form.start, end: form.end, all_day: form.all_day, location: form.location }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.event) return { ...(json.event as CalEvent), category };
      }
    }
  } catch {
    /* fall through to local */
  }
  return {
    id: `e-${Date.now()}`,
    title: form.title || 'New Event',
    start: form.start || new Date().toISOString(),
    end: form.end,
    all_day: form.all_day,
    category,
    location: form.location,
    href: null,
  };
};
// --- Theme & Styles ---
const textPrimary = { color: 'rgba(255,255,255,0.9)' };
const textSecondary = { color: 'rgba(255,255,255,0.5)' };
const glassBg = { backgroundColor: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)' };
const CATEGORIES: Record<CalCategory, { label: string; color: string }> = {
  jobs: { label: 'Jobs', color: '#34D399' },
  sales: { label: 'Sales', color: '#22D3EE' },
  todos: { label: 'To-Dos', color: '#A78BFA' },
  google: { label: 'Google', color: '#FBBF24' }
};
// --- Helpers ---
const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();
const formatTime = (iso?: string | null, allDay?: boolean) => {
  if (allDay) return 'All day';
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};
const INITIAL_DATE = new Date();
export default function CalendarViews() {
  const [currentDate, setCurrentDate] = useState(INITIAL_DATE);
  const [view, setView] = useState<'Month' | 'Week' | 'Day' | 'List'>('Month');
  const [scope, setScope] = useState<'me' | 'team'>('me');
  const [activeFilters, setActiveFilters] = useState<Set<CalCategory>>(new Set(['jobs', 'sales', 'todos', 'google']));
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const [events, setEvents] = useState<CalEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [selectedEvent, setSelectedEvent] = useState<CalEvent | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  // Sync calendar — pull/push Google Calendar via the existing sync endpoint.
  async function handleSyncCalendar() {
    if (syncing) return;
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch('/api/calendar/google/sync', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSyncMsg(data?.error || data?.message || 'Connect Google Calendar first.');
      } else {
        setSyncMsg('Calendar synced.');
        // Refresh the current month after a successful sync.
        const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString();
        const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString();
        setEvents(await loadEvents(start, end, scope));
      }
    } catch {
      setSyncMsg('Could not sync calendar.');
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(null), 4000);
    }
  }

  // Load events when period/scope changes
  useEffect(() => {
    setIsLoading(true);
    const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString();
    const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString();
    loadEvents(start, end, scope).then(data => {
      setEvents(data);
      setIsLoading(false);
    });
  }, [currentDate, scope, view]);
  const filteredEvents = useMemo(() => {
    return events.filter(e => activeFilters.has(e.category));
  }, [events, activeFilters]);
  // --- Actions ---
  const handlePrev = () => {
    const newDate = new Date(currentDate);
    if (view === 'Month') newDate.setMonth(newDate.getMonth() - 1);
    if (view === 'Week') newDate.setDate(newDate.getDate() - 7);
    if (view === 'Day' || view === 'List') newDate.setDate(newDate.getDate() - 1);
    setCurrentDate(newDate);
  };
  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (view === 'Month') newDate.setMonth(newDate.getMonth() + 1);
    if (view === 'Week') newDate.setDate(newDate.getDate() + 7);
    if (view === 'Day' || view === 'List') newDate.setDate(newDate.getDate() + 1);
    setCurrentDate(newDate);
  };
  const handleToday = () => setCurrentDate(new Date());
  const toggleFilter = (cat: CalCategory) => {
    const next = new Set(activeFilters);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    setActiveFilters(next);
  };
  // --- Sub-components (Views) ---
  const renderMonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const cells: (Date | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let i = 1; i <= daysInMonth; i++) cells.push(new Date(year, month, i));
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-2 grid grid-cols-7 gap-2 rounded-lg border border-white/5 bg-white/5 py-2 text-center text-[10px] font-bold uppercase tracking-widest text-slate-500">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
        </div>
        <div className="grid flex-1 auto-rows-fr grid-cols-7 gap-2">
          {cells.map((date, idx) => {
            if (!date) return <div key={`empty-${idx}`} className="rounded-2xl border border-white/5 bg-transparent" />;
            const isToday = new Date().toDateString() === date.toDateString();
            const isSelected = selectedDate.toDateString() === date.toDateString();
            const dayEvents = filteredEvents.filter(e => new Date(e.start).toDateString() === date.toDateString());
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedDate(date)}
                className={`relative flex min-h-[84px] flex-col rounded-2xl border p-2 text-left transition-all ${
                  isSelected
                    ? 'border-[#00c8ff] bg-[#007cff]/20 shadow-[0_0_18px_rgba(0,124,255,0.3)]'
                    : isToday
                    ? 'border-[#00c8ff]/60 bg-white/10'
                    : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${isToday ? 'rounded-md bg-cyan-400 px-1.5 py-0.5 font-extrabold text-slate-950' : 'text-slate-400'}`}>{date.getDate()}</span>
                  {isToday && <span className="text-[8px] font-bold uppercase tracking-wider text-cyan-400">Today</span>}
                  {!isToday && dayEvents.length > 0 && <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#00c8ff', boxShadow: '0 0 6px rgba(34,211,238,0.8)' }} />}
                </div>
                <div className="mt-1 flex flex-col gap-1 overflow-hidden">
                  {dayEvents.slice(0, 2).map(e => {
                    const color = CATEGORIES[e.category].color;
                    return <div key={e.id} className="truncate rounded border px-1.5 py-0.5 text-[9px] font-medium" style={{ background: `${color}1f`, color, borderColor: `${color}4d` }}>{e.title}</div>;
                  })}
                  {dayEvents.length > 2 && <div className="rounded border border-rose-500/30 bg-rose-950/60 px-1.5 py-0.5 text-center text-[9px] font-bold text-rose-300">+{dayEvents.length - 2} more</div>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const date = currentDate.getDate();
    const dayOfWeek = currentDate.getDay();

    const startOfWeek = new Date(year, month, date - dayOfWeek);
    const weekDays = Array.from({ length: 7 }).map((_, i) => new Date(year, month, startOfWeek.getDate() + i));
    return (
      <div className="flex flex-1 border border-white/5 rounded-2xl overflow-hidden mt-4 bg-black/10">
        {weekDays.map((day, idx) => {
          const isToday = new Date().toDateString() === day.toDateString();
          const dayEvents = filteredEvents.filter(e => new Date(e.start).toDateString() === day.toDateString());
          return (
            <div key={idx} className="flex-1 flex flex-col border-r last:border-r-0 border-white/5">
              <div className="p-3 border-b border-white/5 flex flex-col items-center bg-white/5">
                <span className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={textSecondary}>
                  {day.toLocaleDateString(undefined, { weekday: 'short' })}
                </span>
                <span className={`text-sm w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-[#6B7EFF] text-white font-bold' : ''}`} style={!isToday ? textPrimary : {}}>
                  {day.getDate()}
                </span>
              </div>
              <div className="flex-1 p-2 flex flex-col gap-2 overflow-y-auto">
                {dayEvents.map(e => (
                  <button
                    key={e.id}
                    onClick={() => setSelectedEvent(e)}
                    className="text-left p-2 rounded-xl flex flex-col gap-1 transition-colors hover:bg-white/10"
                    style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
                  >
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORIES[e.category].color }} />
                      <span className="text-[10px] font-medium" style={textSecondary}>{formatTime(e.start, e.all_day)}</span>
                    </div>
                    <span className="text-xs font-medium leading-tight" style={textPrimary}>{e.title}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };
  const renderDayView = () => {
    const dayEvents = filteredEvents
      .filter(e => new Date(e.start).toDateString() === currentDate.toDateString())
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    return (
      <div className="flex-1 flex flex-col mt-4 max-w-2xl">
        <h2 className="text-xl font-medium mb-6" style={textPrimary}>
          {currentDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        </h2>
        {dayEvents.length === 0 ? (
          <div className="p-8 text-center" style={textSecondary}>No events today.</div>
        ) : (
          <div className="flex flex-col gap-3">
            {dayEvents.map(e => (
              <button
                key={e.id}
                onClick={() => setSelectedEvent(e)}
                className="w-full text-left p-4 rounded-2xl flex items-center gap-4 transition-colors hover:bg-white/5"
                style={glassBg}
              >
                <div className="w-24 text-sm font-medium flex-shrink-0" style={textSecondary}>
                  {formatTime(e.start, e.all_day)}
                </div>
                <div className="w-1 h-8 rounded-full" style={{ backgroundColor: CATEGORIES[e.category].color }} />
                <div className="flex-1">
                  <div className="text-base font-medium" style={textPrimary}>{e.title}</div>
                  {e.location && (
                    <div className="text-xs mt-1 flex items-center gap-1" style={textSecondary}>
                      <MapPin size={12} /> {e.location}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };
  const renderListView = () => {
    const sorted = [...filteredEvents].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    const grouped = sorted.reduce((acc, e) => {
      const d = new Date(e.start).toDateString();
      if (!acc[d]) acc[d] = [];
      acc[d].push(e);
      return acc;
    }, {} as Record<string, CalEvent[]>);
    return (
      <div className="flex-1 overflow-y-auto mt-4 max-w-2xl pr-4">
        {Object.entries(grouped).map(([dateStr, evts]) => {
          const d = new Date(dateStr);
          const isToday = new Date().toDateString() === d.toDateString();
          return (
            <div key={dateStr} className="mb-8">
              <div className="text-sm font-semibold mb-3 flex items-center gap-2" style={textPrimary}>
                {isToday && <span className="px-2 py-0.5 rounded text-[10px] uppercase bg-[#6B7EFF] text-white">Today</span>}
                {d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
              </div>
              <div className="flex flex-col gap-2">
                {evts.map(e => (
                  <button
                    key={e.id}
                    onClick={() => setSelectedEvent(e)}
                    className="w-full text-left p-3 rounded-2xl flex items-center gap-4 transition-colors hover:bg-white/5"
                    style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
                  >
                    <div className="w-16 text-xs font-medium text-right flex-shrink-0" style={textSecondary}>
                      {formatTime(e.start, e.all_day)}
                    </div>
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CATEGORIES[e.category].color }} />
                    <div className="flex-1 text-sm font-medium truncate" style={textPrimary}>{e.title}</div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        {sorted.length === 0 && <div className="text-sm p-4" style={textSecondary}>No upcoming events found.</div>}
      </div>
    );
  };
  // --- Render Modals ---
  const renderEventPopover = () => {
    if (!selectedEvent) return null;
    const cat = CATEGORIES[selectedEvent.category];
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-sm rounded-3xl overflow-hidden flex flex-col relative max-h-[85dvh]" style={{ backgroundColor: 'rgba(30,30,30,0.9)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="p-5 flex flex-col gap-4 min-h-0 flex-1 overflow-y-auto" style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}>
            <div className="flex justify-between items-start">
              <div className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider" style={{ backgroundColor: `${cat.color}20`, color: cat.color }}>
                {cat.label}
              </div>
              <button onClick={() => setSelectedEvent(null)} className="p-1 rounded-full hover:bg-white/10" style={textSecondary}><X size={18} /></button>
            </div>

            <h3 className="text-xl font-semibold leading-tight" style={textPrimary}>{selectedEvent.title}</h3>

            <div className="flex flex-col gap-2.5 text-sm" style={textSecondary}>
              <div className="flex items-center gap-2">
                <Clock size={16} />
                <span>
                  {new Date(selectedEvent.start).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                  {' • '}
                  {formatTime(selectedEvent.start, selectedEvent.all_day)}
                  {selectedEvent.end && ` - ${formatTime(selectedEvent.end)}`}
                </span>
              </div>
              {selectedEvent.location && (
                <div className="flex items-center gap-2">
                  <MapPin size={16} />
                  <span>{selectedEvent.location}</span>
                </div>
              )}
            </div>
          </div>

          {selectedEvent.href && (
            <div className="p-4 border-t flex gap-3" style={{ borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(0,0,0,0.2)' }}>
              <a href={selectedEvent.href} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-center transition-colors hover:opacity-90" style={{ backgroundColor: '#6B7EFF', color: 'white' }}>Open</a>
            </div>
          )}
        </div>
      </div>
    );
  };
  const renderAddModal = () => {
    if (!isAddModalOpen) return null;
    const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      const form = e.target as HTMLFormElement;
      const dateVal = (form.elements.namedItem('dateStr') as HTMLInputElement)?.value;
      const timeVal = (form.elements.namedItem('timeStr') as HTMLInputElement)?.value;
      const startIso = dateVal ? new Date(`${dateVal}T${timeVal || '09:00'}:00`).toISOString() : new Date().toISOString();
      const newEvt = await createEvent({
        title: (form.elements.namedItem('titleStr') as HTMLInputElement).value,
        start: startIso,
        all_day: !timeVal,
        category: (form.elements.namedItem('category') as HTMLInputElement)?.value as CalCategory,
        scope: scope,
      });
      setEvents([...events, newEvt]);
      setIsAddModalOpen(false);
    };
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-3xl flex flex-col relative max-h-[85dvh] overflow-hidden" style={{ backgroundColor: 'rgba(30,30,30,0.95)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="p-5 border-b flex justify-between items-center" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <h3 className="text-lg font-medium" style={textPrimary}>Add Event</h3>
            <button onClick={() => setIsAddModalOpen(false)} className="p-1 rounded-full hover:bg-white/10" style={textSecondary}><X size={18} /></button>
          </div>

          <form onSubmit={handleSave} className="p-5 flex flex-col gap-4 overflow-y-auto" style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}>
            <div>
              <input name="titleStr" type="text" placeholder="Event title" required className="w-full bg-transparent border-b border-white/10 outline-none px-2 py-2 text-lg placeholder:text-white/30" style={textPrimary} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <input name="dateStr" type="date" required className="w-full bg-black/20 border outline-none px-3 py-2.5 rounded-xl text-sm" style={{ ...textPrimary, borderColor: 'rgba(255,255,255,0.1)' }} />
              <input name="timeStr" type="time" className="w-full bg-black/20 border outline-none px-3 py-2.5 rounded-xl text-sm" style={{ ...textPrimary, borderColor: 'rgba(255,255,255,0.1)' }} />
            </div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(CATEGORIES) as CalCategory[]).map(cat => (
                <label key={cat} className="flex items-center gap-2 text-sm p-2 rounded-xl cursor-pointer hover:bg-white/5 border border-transparent has-[:checked]:border-white/20">
                  <input type="radio" name="category" value={cat} defaultChecked={cat === 'jobs'} className="hidden" />
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CATEGORIES[cat].color }} />
                  <span style={textPrimary}>{CATEGORIES[cat].label}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-white/5" style={textSecondary}>Cancel</button>
              <button type="submit" className="px-5 py-2 rounded-xl text-sm font-medium transition-colors hover:opacity-90" style={{ backgroundColor: '#6B7EFF', color: 'white' }}>Save Event</button>
            </div>
          </form>
        </div>
      </div>
    );
  };
  const renderDayInspector = () => {
    const dayEvents = filteredEvents
      .filter(e => new Date(e.start).toDateString() === selectedDate.toDateString())
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    const dLabel = selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    return (
      <div className="hidden w-80 shrink-0 flex-col rounded-2xl border border-white/10 p-4 lg:flex" style={{ background: 'rgba(14,30,56,0.7)', backdropFilter: 'blur(12px)' }}>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-400">Day Inspector</span>
          <span className="rounded-full border border-white/5 bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-300">{dayEvents.length} items</span>
        </div>
        <h3 className="mb-3 text-lg font-extrabold text-white">{dLabel}</h3>
        <hr className="mb-3 border-white/10" />
        <div className="flex max-h-[440px] min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
          {dayEvents.length === 0 ? (
            <div className="rounded-2xl border border-white/5 bg-slate-900/30 py-14 text-center text-xs text-slate-500">No events scheduled for this day.</div>
          ) : dayEvents.map(e => {
            const color = CATEGORIES[e.category].color;
            return (
              <button key={e.id} onClick={() => setSelectedEvent(e)} className="rounded-2xl border bg-slate-900/80 p-3.5 text-left transition-all hover:scale-[1.02]" style={{ borderColor: `${color}55` }}>
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{formatTime(e.start, e.all_day)}{e.end ? ` - ${formatTime(e.end)}` : ''}</span>
                <h4 className="mt-0.5 text-sm font-bold text-white">{e.title}</h4>
                <div className="mt-2 flex items-center gap-2">
                  <span className="rounded-full border px-2 py-0.5 text-[9px] font-bold" style={{ background: `${color}1a`, color, borderColor: `${color}4d` }}>{CATEGORIES[e.category].label}</span>
                  {e.location && <span className="truncate text-[10px] text-slate-400">{e.location}</span>}
                </div>
              </button>
            );
          })}
        </div>
        <button onClick={() => setIsAddModalOpen(true)} className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-[#00c8ff]/45 bg-[#007cff]/25 py-2.5 text-xs font-bold text-[#bfe6ff] shadow-[0_0_15px_rgba(0,124,255,0.2)] transition-all hover:bg-[#007cff]/40">
          <Plus size={14} /> Add to {selectedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </button>
      </div>
    );
  };

  const monthLabel = currentDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <div className="relative flex w-full flex-1 flex-col rounded-3xl p-4 font-sans" style={{ background: NEXUS_BG }}>
      <div className="pointer-events-none absolute left-8 top-6 h-72 w-72 rounded-full" style={{ background: 'rgba(34,211,238,0.08)', filter: 'blur(80px)' }} />
      <div className="pointer-events-none absolute bottom-8 right-8 h-72 w-72 rounded-full" style={{ background: 'rgba(99,102,241,0.08)', filter: 'blur(80px)' }} />

      <div className="relative z-10 mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-[#0e1e38] p-1 text-xs font-medium text-slate-400">
          {(['Month', 'Week', 'Day', 'List'] as const).map(mode => (
            <button key={mode} onClick={() => setView(mode)} className={`rounded-lg px-3 py-1 transition-all ${view === mode ? 'border border-[#00c8ff]/45 bg-[#007cff]/30 font-bold text-[#bfe6ff]' : 'hover:text-slate-200'}`}>{mode}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-[#0e1e38] px-1 py-1 text-slate-300">
            <button onClick={handlePrev} className="rounded-lg p-1.5 hover:bg-white/10"><ChevronLeft size={16} /></button>
            <button onClick={() => { const t = new Date(); setCurrentDate(t); setSelectedDate(t); }} className="rounded-lg px-2.5 py-1 text-xs font-semibold hover:bg-white/10">Today</button>
            <button onClick={handleNext} className="rounded-lg p-1.5 hover:bg-white/10"><ChevronRight size={16} /></button>
          </div>
          <span className="min-w-[128px] text-center text-lg font-bold text-slate-100">{monthLabel}</span>
          <button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-1.5 rounded-xl border border-[#00c8ff]/45 bg-[#007cff]/30 px-3.5 py-1.5 text-xs font-bold text-[#bfe6ff] shadow-[0_0_15px_rgba(0,124,255,0.25)] transition-all hover:bg-[#007cff]/40"><Plus size={14} /> Add Event</button>
        </div>
      </div>

      <div className="relative z-10 mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {(Object.keys(CATEGORIES) as CalCategory[]).map(cat => {
            const isActive = activeFilters.has(cat); const color = CATEGORIES[cat].color;
            return (
              <button key={cat} onClick={() => toggleFilter(cat)} className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-all ${isActive ? 'bg-slate-800 text-white' : 'border-white/5 bg-slate-900/60 text-slate-400 hover:border-white/20'}`} style={isActive ? { borderColor: `${color}66` } : undefined}>
                <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                {CATEGORIES[cat].label}
              </button>
            );
          })}
          {isLoading && <span className="ml-1 animate-pulse text-[10px] text-slate-500">Updating...</span>}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex items-center gap-1.5 rounded-full border border-white/5 bg-slate-900/60 px-2.5 py-1 text-xs text-slate-400">
            <Calendar size={12} />
            <select value={scope} onChange={e => setScope(e.target.value as 'me' | 'team')} className="cursor-pointer appearance-none bg-transparent pr-4 outline-none">
              <option value="me" className="bg-neutral-900">My Calendar</option>
              <option value="team" className="bg-neutral-900">My Team</option>
            </select>
            <ChevronDown size={12} className="pointer-events-none absolute right-2" />
          </div>
          <button onClick={handleSyncCalendar} disabled={syncing} className="rounded-full border border-white/5 bg-slate-900/60 px-3 py-1 text-xs font-medium text-slate-400 transition-colors hover:border-white/20 disabled:opacity-50">{syncing ? 'Syncing...' : 'Sync'}</button>
        </div>
      </div>

      {syncMsg && (<div className="relative z-10 mb-3 rounded-lg px-3 py-2 text-xs" style={{ background: 'rgba(34,211,238,0.10)', border: '1px solid rgba(34,211,238,0.28)', color: '#a5f3fc' }}>{syncMsg}</div>)}

      <div className="relative z-10 flex min-h-0 flex-1 gap-4">
        <div className="flex min-w-0 flex-1 flex-col">
          {view === 'Month' && renderMonthView()}
          {view === 'Week' && renderWeekView()}
          {view === 'Day' && renderDayView()}
          {view === 'List' && renderListView()}
        </div>
        {renderDayInspector()}
      </div>

      {renderEventPopover()}
      {renderAddModal()}
    </div>
  );
}
