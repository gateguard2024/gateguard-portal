'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, Calendar, X, Clock, MapPin } from 'lucide-react';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { ChevronDown } = require('lucide-react') as any;
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
  try {
    const res = await fetch('/api/calendar/events', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: form.title, start: form.start, end: form.end, all_day: form.all_day, location: form.location }),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.event) return json.event as CalEvent;
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
    category: form.category || 'jobs',
    location: form.location,
    href: null,
  };
};
// --- Theme & Styles ---
const textPrimary = { color: 'rgba(255,255,255,0.9)' };
const textSecondary = { color: 'rgba(255,255,255,0.5)' };
const textFaint = { color: 'rgba(255,255,255,0.34)' };
const glassBg = { backgroundColor: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)' };
const CATEGORIES: Record<CalCategory, { label: string; color: string }> = {
  jobs: { label: 'Jobs', color: '#C2410C' },
  sales: { label: 'Sales', color: '#00C8FF' },
  todos: { label: 'To-Dos', color: '#8B5CF6' },
  google: { label: 'Google', color: '#34D399' }
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

  const [events, setEvents] = useState<CalEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [selectedEvent, setSelectedEvent] = useState<CalEvent | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
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

    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
    return (
      <div className="flex flex-col flex-1 border border-white/5 rounded-2xl overflow-hidden mt-4 bg-black/10">
        <div className="grid grid-cols-7 border-b border-white/5 bg-white/5">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="py-2 text-center text-[10px] font-semibold uppercase tracking-wider" style={textSecondary}>
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 flex-1 auto-rows-fr">
          {days.map((date, idx) => {
            if (!date) return <div key={`empty-${idx}`} className="border-r border-b border-white/5 p-1" />;

            const isToday = new Date().toDateString() === date.toDateString();
            const dayEvents = filteredEvents.filter(e => new Date(e.start).toDateString() === date.toDateString());
            return (
              <div key={idx} className="border-r border-b border-white/5 p-1.5 min-h-[100px] flex flex-col gap-1">
                <div className="flex justify-between items-start">
                  <span className={`text-xs w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-[#6B7EFF] text-white font-bold' : ''}`} style={!isToday ? textSecondary : {}}>
                    {date.getDate()}
                  </span>
                </div>
                <div className="flex flex-col gap-1 overflow-hidden">
                  {dayEvents.slice(0, 3).map(e => (
                    <button
                      key={e.id}
                      onClick={() => setSelectedEvent(e)}
                      className="text-left truncate text-[10px] px-1.5 py-0.5 rounded-md hover:bg-white/10 transition-colors flex items-center gap-1.5 w-full"
                      style={textPrimary}
                    >
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: CATEGORIES[e.category].color }} />
                      <span className="truncate">{e.title}</span>
                    </button>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-[9px] px-1" style={textFaint}>+ {dayEvents.length - 3} more</div>
                  )}
                </div>
              </div>
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
        <div className="w-full max-w-sm rounded-3xl overflow-hidden flex flex-col relative" style={{ backgroundColor: 'rgba(30,30,30,0.9)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="p-5 flex flex-col gap-4">
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
        <div className="w-full max-w-md rounded-3xl flex flex-col relative" style={{ backgroundColor: 'rgba(30,30,30,0.95)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="p-5 border-b flex justify-between items-center" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <h3 className="text-lg font-medium" style={textPrimary}>Add Event</h3>
            <button onClick={() => setIsAddModalOpen(false)} className="p-1 rounded-full hover:bg-white/10" style={textSecondary}><X size={18} /></button>
          </div>

          <form onSubmit={handleSave} className="p-5 flex flex-col gap-4">
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
  const currentLabel = useMemo(() => {
    if (view === 'Day') return currentDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
    if (view === 'Month' || view === 'List') return currentDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    const start = new Date(currentDate);
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }, [currentDate, view]);
  return (
    <div className="w-full flex flex-col font-sans">

      {/* 1. SLIM TOOLBAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">

        <div className="flex items-center p-1 rounded-xl w-max" style={glassBg}>
          {(['Month', 'Week', 'Day', 'List'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                backgroundColor: view === v ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: view === v ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)'
              }}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1" style={textPrimary}>
            <button onClick={handlePrev} className="p-1.5 rounded-full hover:bg-white/10 transition-colors"><ChevronLeft size={18} /></button>
            <button onClick={handleToday} className="px-3 py-1 text-xs font-medium rounded-full hover:bg-white/10 transition-colors">Today</button>
            <button onClick={handleNext} className="p-1.5 rounded-full hover:bg-white/10 transition-colors"><ChevronRight size={18} /></button>
          </div>
          <span className="text-base font-medium min-w-[140px] text-center" style={textPrimary}>
            {currentLabel}
          </span>
        </div>
        <div className="flex items-center gap-3 justify-end">
          <div className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl cursor-pointer hover:bg-white/5 transition-colors text-sm font-medium" style={textSecondary}>
            <Calendar size={14} />
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as 'me' | 'team')}
              className="bg-transparent appearance-none outline-none cursor-pointer pr-4"
              style={textSecondary}
            >
              <option value="me" className="bg-neutral-900">My Calendar</option>
              <option value="team" className="bg-neutral-900">My Team</option>
            </select>
            <ChevronDown size={14} className="absolute right-2 pointer-events-none" />
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors hover:opacity-90"
            style={{ backgroundColor: '#6B7EFF', color: 'white' }}
          >
            <Plus size={16} /> Add event
          </button>
        </div>
      </div>
      {/* 2. CATEGORY FILTERS */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto hide-scrollbar">
        {(Object.keys(CATEGORIES) as CalCategory[]).map(cat => {
          const isActive = activeFilters.has(cat);
          const color = CATEGORIES[cat].color;
          return (
            <button
              key={cat}
              onClick={() => toggleFilter(cat)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all"
              style={{
                backgroundColor: isActive ? 'rgba(255,255,255,0.06)' : 'transparent',
                border: isActive ? `1px solid rgba(255,255,255,0.1)` : '1px solid transparent',
                color: isActive ? textPrimary.color : textSecondary.color,
                opacity: isActive ? 1 : 0.6
              }}
            >
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              {CATEGORIES[cat].label}
            </button>
          );
        })}
        {isLoading && <span className="text-[10px] ml-2 animate-pulse" style={textFaint}>Updating...</span>}
      </div>
      {/* 3. CALENDAR VIEW RENDERER */}
      {view === 'Month' && renderMonthView()}
      {view === 'Week' && renderWeekView()}
      {view === 'Day' && renderDayView()}
      {view === 'List' && renderListView()}
      {/* MODALS */}
      {renderEventPopover()}
      {renderAddModal()}
    </div>
  );
}
