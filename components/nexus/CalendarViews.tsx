'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'

type CalEventType =
  | 'todo'
  | 'work_order'
  | 'work_order_phase'
  | 'pm_schedule'
  | 'gcal'
  | 'crm_activity'
  | 'tracker_task'

type CalEvent = {
  id: string
  title: string
  type: CalEventType
  start_time: string
  end_time: string | null
  is_all_day?: boolean
  owner_name?: string | null
  link?: string | null
}

type CalendarView = 'month' | 'week' | 'day' | 'list'

type CreateEventPayload = {
  title: string
  date: string
  start_time: string | null
  end_time: string | null
  type: CalEventType
  is_all_day: boolean
}

const TYPE_COLORS: Record<CalEventType, string> = {
  todo: '#6B7EFF',
  work_order: '#059669',
  work_order_phase: '#C2410C',
  pm_schedule: '#0B7285',
  gcal: '#7C3AED',
  crm_activity: '#0EA5E9',
  tracker_task: '#8B5CF6',
}

const TYPE_LABELS: Record<CalEventType, string> = {
  todo: 'To-do',
  work_order: 'Work order',
  work_order_phase: 'Work phase',
  pm_schedule: 'PM schedule',
  gcal: 'Google Calendar',
  crm_activity: 'CRM activity',
  tracker_task: 'Tracker task',
}

// Friendly categories so a busy calendar (e.g. a CEO viewing the whole group)
// can show/hide whole streams. Plain labels per the 5th-grader rule.
const CATEGORIES: { id: string; label: string; color: string; types: CalEventType[] }[] = [
  { id: 'jobs',   label: 'Jobs',    color: '#F59E0B', types: ['work_order', 'work_order_phase', 'pm_schedule'] },
  { id: 'sales',  label: 'Sales',   color: '#0EA5E9', types: ['crm_activity'] },
  { id: 'tasks',  label: 'To-Dos',  color: '#6B7EFF', types: ['todo', 'tracker_task'] },
  { id: 'google', label: 'Google',  color: '#10B981', types: ['gcal'] },
]
const TYPE_CATEGORY: Record<CalEventType, string> = {
  work_order: 'jobs', work_order_phase: 'jobs', pm_schedule: 'jobs',
  crm_activity: 'sales', todo: 'tasks', tracker_task: 'tasks',
  gcal: 'google',
}

const VIEW_LABELS: { key: CalendarView; label: string }[] = [
  { key: 'month', label: 'Month' },
  { key: 'week', label: 'Week' },
  { key: 'day', label: 'Day' },
  { key: 'list', label: 'List' },
]

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const glassStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.035)',
  border: '1px solid rgba(255,255,255,0.08)',
  backdropFilter: 'blur(18px)',
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.055)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: 'rgba(255,255,255,0.9)',
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function startOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function addDays(date: Date, count: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + count)
  return next
}

function addMonths(date: Date, count: number) {
  const next = new Date(date)
  next.setMonth(next.getMonth() + count)
  return next
}

function startOfWeek(date: Date) {
  const next = startOfDay(date)
  next.setDate(next.getDate() - next.getDay())
  return next
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function localISO(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString()
}

function hexToRgba(hex: string, opacity: number) {
  const clean = hex.replace('#', '')
  const bigint = parseInt(clean, 16)
  const red = (bigint >> 16) & 255
  const green = (bigint >> 8) & 255
  const blue = bigint & 255
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`
}

function isSameDay(first: Date, second: Date) {
  return dateKey(first) === dateKey(second)
}

function formatMonthYear(date: Date) {
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(date)
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date)
}

function formatFullDay(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function eventDate(event: CalEvent) {
  return new Date(event.start_time)
}

function eventEndDate(event: CalEvent) {
  if (event.end_time) return new Date(event.end_time)
  return event.is_all_day ? addDays(startOfDay(eventDate(event)), 1) : eventDate(event)
}

function eventTimeLabel(event: CalEvent) {
  if (event.is_all_day || !event.end_time) return 'All day'
  return `${formatTime(eventDate(event))} – ${formatTime(new Date(event.end_time))}`
}

function sortEvents(events: CalEvent[]) {
  return [...events].sort((first, second) => {
    if (first.is_all_day && !second.is_all_day) return -1
    if (!first.is_all_day && second.is_all_day) return 1
    return eventDate(first).getTime() - eventDate(second).getTime()
  })
}

function buildEvent(
  id: string,
  title: string,
  type: CalEventType,
  dayOffset: number,
  startTime: string | null,
  endTime: string | null,
  ownerName: string | null = 'Me'
): CalEvent {
  const day = dateKey(addDays(new Date(), dayOffset))
  const isAllDay = !startTime

  return {
    id,
    title,
    type,
    start_time: localISO(day, startTime ?? '00:00'),
    end_time: endTime ? localISO(day, endTime) : null,
    is_all_day: isAllDay,
    owner_name: ownerName,
  }
}

const KNOWN_TYPES = new Set<CalEventType>(['todo', 'work_order', 'work_order_phase', 'pm_schedule', 'gcal', 'crm_activity', 'tracker_task'])

// Real data: /api/calendar/events returns { events: [{ id, type, title, date 'YYYY-MM-DD', time? 'HH:MM', color, link }] }.
// We fetch by the month at the middle of the requested range, then map to CalEvent.
async function loadEvents(rangeStartISO: string, rangeEndISO: string, scope: 'me' | 'team'): Promise<CalEvent[]> {
  const mid = new Date((new Date(rangeStartISO).getTime() + new Date(rangeEndISO).getTime()) / 2)
  try {
    const res = await fetch(`/api/calendar/events?year=${mid.getFullYear()}&month=${mid.getMonth() + 1}&scope=${scope}`)
    if (!res.ok) return []
    const data = await res.json().catch(() => ({}))
    const raw: Array<Record<string, unknown>> = data.events ?? []
    return raw.map((e) => {
      const rawType = String(e.type ?? 'todo')
      const type = (KNOWN_TYPES.has(rawType as CalEventType) ? rawType : 'todo') as CalEventType
      const date = String(e.date ?? '').slice(0, 10)
      const time = e.time ? String(e.time) : null
      const startMs = new Date(`${date}T${time ?? '00:00'}:00`).getTime()
      return {
        id: String(e.id),
        title: String(e.title ?? 'Event'),
        type,
        start_time: new Date(startMs).toISOString(),
        end_time: time ? new Date(startMs + 60 * 60 * 1000).toISOString() : null,
        is_all_day: !time,
        owner_name: (e.owner_name as string) ?? null,
        link: (e.link as string) ?? null,
      }
    })
  } catch {
    return []
  }
}

function onOpen(event: CalEvent) {
  if (event.link && typeof window !== 'undefined') window.location.href = event.link
}

async function onCreate(payload: CreateEventPayload) {
  // No POST on /api/calendar/events yet — persist as a To-Do (shows on the calendar as type 'todo').
  try {
    await fetch('/api/todos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: payload.title, due_date: payload.date }),
    })
  } catch { /* optimistic UI already added it */ }
}

function EventChip({ event, onClick }: { event: CalEvent; onClick: (event: CalEvent) => void }) {
  const color = TYPE_COLORS[event.type]

  return (
    <button
      type="button"
      onClick={(clickEvent) => {
        clickEvent.stopPropagation()
        onClick(event)
      }}
      className="w-full rounded-xl px-2 py-1 text-left text-xs transition hover:opacity-90"
      style={{
        background: hexToRgba(color, 0.18),
        border: `1px solid ${hexToRgba(color, 0.45)}`,
        color: 'rgba(255,255,255,0.9)',
      }}
    >
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
        <span className="truncate font-medium">{event.title}</span>
      </div>
      {!event.is_all_day && (
        <div className="mt-0.5 truncate pl-4" style={{ color: 'rgba(255,255,255,0.5)' }}>
          {eventTimeLabel(event)}
        </div>
      )}
    </button>
  )
}

function EmptyState({ label = 'No events' }: { label?: string }) {
  return (
    <div className="rounded-2xl px-4 py-8 text-center text-sm" style={glassStyle}>
      <Calendar className="mx-auto mb-2 h-5 w-5" style={{ color: 'rgba(255,255,255,0.34)' }} />
      <p style={{ color: 'rgba(255,255,255,0.5)' }}>{label}</p>
    </div>
  )
}

export default function CalendarViews() {
  const [view, setView] = useState<CalendarView>('month')
  const [cursorDate, setCursorDate] = useState(() => new Date())
  const [events, setEvents] = useState<CalEvent[]>([])
  const [selectedEvent, setSelectedEvent] = useState<CalEvent | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formDate, setFormDate] = useState(() => dateKey(new Date()))
  const [formStartTime, setFormStartTime] = useState('09:00')
  const [formEndTime, setFormEndTime] = useState('10:00')
  const [formType, setFormType] = useState<CalEventType>('todo')
  const [viewScope, setViewScope] = useState<'me' | 'team'>('me')
  const [hiddenCats, setHiddenCats] = useState<Set<string>>(new Set())

  function toggleCategory(id: string) {
    setHiddenCats((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const today = useMemo(() => startOfDay(new Date()), [])

  const range = useMemo(() => {
    if (view === 'month') {
      const first = startOfMonth(cursorDate)
      const last = endOfMonth(cursorDate)
      const start = startOfWeek(first)
      const end = addDays(startOfWeek(last), 7)
      return { start, end }
    }

    if (view === 'week') {
      const start = startOfWeek(cursorDate)
      return { start, end: addDays(start, 7) }
    }

    if (view === 'day') {
      const start = startOfDay(cursorDate)
      return { start, end: addDays(start, 1) }
    }

    const start = startOfDay(cursorDate)
    return { start, end: addDays(start, 31) }
  }, [cursorDate, view])

  useEffect(() => {
    let isMounted = true

    loadEvents(range.start.toISOString(), range.end.toISOString(), viewScope).then((loadedEvents) => {
      if (isMounted) setEvents(sortEvents(loadedEvents))
    })

    return () => {
      isMounted = false
    }
  }, [range.start, range.end, viewScope])

  const periodLabel = useMemo(() => {
    if (view === 'month') return formatMonthYear(cursorDate)
    if (view === 'week') return `${formatShortDate(range.start)} – ${formatShortDate(addDays(range.end, -1))}`
    if (view === 'day') return formatFullDay(cursorDate)
    return `${formatShortDate(range.start)} – ${formatShortDate(addDays(range.end, -1))}`
  }, [cursorDate, range.end, range.start, view])

  const monthDays = useMemo(() => {
    const days: Date[] = []
    let day = new Date(range.start)

    while (day < range.end) {
      days.push(new Date(day))
      day = addDays(day, 1)
    }

    return days
  }, [range.start, range.end])

  const weekDays = useMemo(() => {
    const start = startOfWeek(cursorDate)
    return Array.from({ length: 7 }, (_, index) => addDays(start, index))
  }, [cursorDate])

  // Category show/hide filter (declutter a busy team calendar).
  const visibleEvents = useMemo(() => events.filter((e) => !hiddenCats.has(TYPE_CATEGORY[e.type])), [events, hiddenCats])

  const dayEvents = (day: Date) => sortEvents(visibleEvents.filter((event) => isSameDay(eventDate(event), day)))

  const groupedListEvents = useMemo(() => {
    const groups = new Map<string, CalEvent[]>()

    visibleEvents.forEach((event) => {
      const key = dateKey(eventDate(event))
      groups.set(key, [...(groups.get(key) ?? []), event])
    })

    return Array.from(groups.entries()).map(([key, groupEvents]) => ({
      key,
      day: new Date(`${key}T00:00:00`),
      events: sortEvents(groupEvents),
    }))
  }, [visibleEvents])

  function movePrevious() {
    setSelectedEvent(null)
    setCursorDate((current) => {
      if (view === 'month') return addMonths(current, -1)
      if (view === 'week') return addDays(current, -7)
      if (view === 'day') return addDays(current, -1)
      return addDays(current, -31)
    })
  }

  function moveNext() {
    setSelectedEvent(null)
    setCursorDate((current) => {
      if (view === 'month') return addMonths(current, 1)
      if (view === 'week') return addDays(current, 7)
      if (view === 'day') return addDays(current, 1)
      return addDays(current, 31)
    })
  }

  function moveToday() {
    setSelectedEvent(null)
    setCursorDate(new Date())
  }

  function openCreateForm() {
    setFormDate(dateKey(cursorDate))
    setShowCreateForm(true)
    setSelectedEvent(null)
  }

  function submitCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const hasTimes = Boolean(formStartTime && formEndTime)
    const payload: CreateEventPayload = {
      title: formTitle.trim(),
      date: formDate,
      start_time: hasTimes ? localISO(formDate, formStartTime) : null,
      end_time: hasTimes ? localISO(formDate, formEndTime) : null,
      type: formType,
      is_all_day: !hasTimes,
    }

    onCreate(payload)

    const optimisticEvent: CalEvent = {
      id: `new-${Date.now()}`,
      title: payload.title,
      type: payload.type,
      start_time: payload.start_time ?? localISO(payload.date, '00:00'),
      end_time: payload.end_time,
      is_all_day: payload.is_all_day,
      owner_name: 'Me',
    }

    setEvents((currentEvents) => sortEvents([...currentEvents, optimisticEvent]))
    setFormTitle('')
    setShowCreateForm(false)
  }

  return (
    <section className="w-full pb-28 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6">
        <div className="rounded-3xl p-4 sm:p-5" style={glassStyle}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-end">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="flex items-center gap-2 rounded-2xl px-3 py-2 text-sm" style={glassStyle}>
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>Show</span>
                <select
                  className="rounded-xl px-2 py-1 text-sm outline-none"
                  style={inputStyle}
                  value={viewScope}
                  onChange={(event) => setViewScope(event.target.value as 'me' | 'team')}
                >
                  <option value="me">My calendar</option>
                  <option value="team">My team</option>
                </select>
              </label>

              <button
                type="button"
                onClick={openCreateForm}
                className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium transition hover:opacity-90"
                style={{
                  background: 'linear-gradient(135deg, #6B7EFF, #00C8FF)',
                  color: 'white',
                }}
              >
                <Plus className="h-4 w-4" />
                Add event
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {VIEW_LABELS.map((item) => {
                const isActive = view === item.key
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setView(item.key)
                      setSelectedEvent(null)
                    }}
                    className="rounded-full px-4 py-2 text-sm font-medium transition hover:opacity-90"
                    style={{
                      background: isActive ? hexToRgba('#6B7EFF', 0.26) : 'rgba(255,255,255,0.04)',
                      border: isActive ? `1px solid ${hexToRgba('#6B7EFF', 0.6)}` : '1px solid rgba(255,255,255,0.08)',
                      color: isActive ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)',
                    }}
                  >
                    {item.label}
                  </button>
                )
              })}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between xl:justify-end">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={movePrevious}
                  className="rounded-2xl p-2 transition hover:opacity-90"
                  style={glassStyle}
                  aria-label="Previous"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={moveToday}
                  className="rounded-2xl px-4 py-2 text-sm font-medium transition hover:opacity-90"
                  style={glassStyle}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={moveNext}
                  className="rounded-2xl p-2 transition hover:opacity-90"
                  style={glassStyle}
                  aria-label="Next"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              <div className="min-w-0 rounded-2xl px-4 py-2 text-center text-sm font-semibold" style={glassStyle}>
                {periodLabel}
              </div>
            </div>
          </div>
        </div>

        {showCreateForm && (
          <form onSubmit={submitCreate} className="rounded-3xl p-4 sm:p-5" style={glassStyle}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>
                  Add event
                </h2>
                <p className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Leave both times blank to make it all day.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="rounded-full p-2 transition hover:opacity-90"
                style={glassStyle}
                aria-label="Close add event form"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-5">
              <label className="md:col-span-2">
                <span className="mb-1 block text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Title
                </span>
                <input
                  required
                  value={formTitle}
                  onChange={(event) => setFormTitle(event.target.value)}
                  className="w-full rounded-2xl px-3 py-2 text-sm outline-none"
                  style={inputStyle}
                  placeholder="Event name"
                />
              </label>

              <label>
                <span className="mb-1 block text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Date
                </span>
                <input
                  required
                  type="date"
                  value={formDate}
                  onChange={(event) => setFormDate(event.target.value)}
                  className="w-full rounded-2xl px-3 py-2 text-sm outline-none"
                  style={inputStyle}
                />
              </label>

              <label>
                <span className="mb-1 block text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Start time
                </span>
                <input
                  type="time"
                  value={formStartTime}
                  onChange={(event) => setFormStartTime(event.target.value)}
                  className="w-full rounded-2xl px-3 py-2 text-sm outline-none"
                  style={inputStyle}
                />
              </label>

              <label>
                <span className="mb-1 block text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  End time
                </span>
                <input
                  type="time"
                  value={formEndTime}
                  onChange={(event) => setFormEndTime(event.target.value)}
                  className="w-full rounded-2xl px-3 py-2 text-sm outline-none"
                  style={inputStyle}
                />
              </label>

              <label className="md:col-span-2">
                <span className="mb-1 block text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Type
                </span>
                <select
                  value={formType}
                  onChange={(event) => setFormType(event.target.value as CalEventType)}
                  className="w-full rounded-2xl px-3 py-2 text-sm outline-none"
                  style={inputStyle}
                >
                  {Object.entries(TYPE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex items-end md:col-span-3">
                <button
                  type="submit"
                  className="w-full rounded-2xl px-4 py-2 text-sm font-medium transition hover:opacity-90 md:w-auto"
                  style={{ background: '#6B7EFF', color: 'white' }}
                >
                  Save event
                </button>
              </div>
            </div>
          </form>
        )}

        <div className="rounded-3xl p-4 sm:p-5" style={glassStyle}>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Show:</span>
            {CATEGORIES.map((cat) => {
              const on = !hiddenCats.has(cat.id)
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => toggleCategory(cat.id)}
                  className="flex items-center gap-2 rounded-full px-3 py-1 text-xs transition"
                  style={{
                    background: on ? hexToRgba(cat.color, 0.16) : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${on ? hexToRgba(cat.color, 0.4) : 'rgba(255,255,255,0.08)'}`,
                    color: on ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.35)',
                    textDecoration: on ? 'none' : 'line-through',
                  }}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: on ? cat.color : 'rgba(255,255,255,0.25)' }} />
                  {cat.label}
                </button>
              )
            })}
          </div>

          {view === 'month' && (
            <div>
              <div className="grid grid-cols-7 gap-2 pb-2 text-center text-xs font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {DAY_LABELS.map((label) => (
                  <div key={label}>{label}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {monthDays.map((day) => {
                  const eventsForThisDay = dayEvents(day)
                  const visibleEvents = eventsForThisDay.slice(0, 3)
                  const extraCount = eventsForThisDay.length - visibleEvents.length
                  const isToday = isSameDay(day, today)
                  const isCurrentMonth = day.getMonth() === cursorDate.getMonth()

                  return (
                    <button
                      key={dateKey(day)}
                      type="button"
                      onClick={() => {
                        setCursorDate(day)
                        setView('day')
                        setSelectedEvent(null)
                      }}
                      className="min-h-28 rounded-2xl p-2 text-left transition hover:opacity-90"
                      style={{
                        background: isToday ? hexToRgba('#6B7EFF', 0.12) : 'rgba(255,255,255,0.025)',
                        border: isToday ? `1px solid ${hexToRgba('#6B7EFF', 0.55)}` : '1px solid rgba(255,255,255,0.07)',
                      }}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span
                          className="flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium"
                          style={{
                            background: isToday ? '#6B7EFF' : 'transparent',
                            color: isToday
                              ? 'white'
                              : isCurrentMonth
                                ? 'rgba(255,255,255,0.9)'
                                : 'rgba(255,255,255,0.34)',
                          }}
                        >
                          {day.getDate()}
                        </span>
                      </div>

                      <div className="space-y-1">
                        {visibleEvents.map((event) => (
                          <EventChip key={event.id} event={event} onClick={setSelectedEvent} />
                        ))}
                        {extraCount > 0 && (
                          <div className="rounded-xl px-2 py-1 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                            +{extraCount} more
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {view === 'week' && (
            <div className="grid gap-3 lg:grid-cols-7">
              {weekDays.map((day) => {
                const eventsForThisDay = dayEvents(day)
                const isToday = isSameDay(day, today)

                return (
                  <div
                    key={dateKey(day)}
                    className="min-h-48 rounded-2xl p-3"
                    style={{
                      background: isToday ? hexToRgba('#00C8FF', 0.1) : 'rgba(255,255,255,0.025)',
                      border: isToday ? `1px solid ${hexToRgba('#00C8FF', 0.45)}` : '1px solid rgba(255,255,255,0.07)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setCursorDate(day)
                        setView('day')
                        setSelectedEvent(null)
                      }}
                      className="mb-3 w-full rounded-xl px-2 py-2 text-left transition hover:opacity-90"
                      style={{ background: 'rgba(255,255,255,0.025)' }}
                    >
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                        {DAY_LABELS[day.getDay()]}
                      </p>
                      <p className="text-lg font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>
                        {formatShortDate(day)}
                      </p>
                    </button>

                    {eventsForThisDay.length ? (
                      <div className="space-y-2">
                        {eventsForThisDay.map((event) => (
                          <EventChip key={event.id} event={event} onClick={setSelectedEvent} />
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-xl px-3 py-4 text-center text-sm" style={{ color: 'rgba(255,255,255,0.34)' }}>
                        No events
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {view === 'day' && (
            <div className="space-y-3">
              {dayEvents(cursorDate).length ? (
                dayEvents(cursorDate).map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => setSelectedEvent(event)}
                    className="flex w-full flex-col gap-3 rounded-2xl p-4 text-left transition hover:opacity-90 sm:flex-row sm:items-center sm:justify-between"
                    style={{
                      background: hexToRgba(TYPE_COLORS[event.type], event.is_all_day ? 0.2 : 0.12),
                      border: `1px solid ${hexToRgba(TYPE_COLORS[event.type], 0.45)}`,
                    }}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: TYPE_COLORS[event.type] }} />
                        <p className="truncate font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>
                          {event.title}
                        </p>
                      </div>
                      <p className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                        {TYPE_LABELS[event.type]}
                      </p>
                    </div>
                    <div className="shrink-0 rounded-xl px-3 py-1 text-sm" style={glassStyle}>
                      {eventTimeLabel(event)}
                    </div>
                  </button>
                ))
              ) : (
                <EmptyState />
              )}
            </div>
          )}

          {view === 'list' && (
            <div className="space-y-5">
              {groupedListEvents.length ? (
                groupedListEvents.map((group) => (
                  <div key={group.key}>
                    <h3 className="mb-2 text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>
                      {formatFullDay(group.day)}
                    </h3>
                    <div className="space-y-2">
                      {group.events.map((event) => (
                        <button
                          key={event.id}
                          type="button"
                          onClick={() => setSelectedEvent(event)}
                          className="flex w-full flex-col gap-3 rounded-2xl p-4 text-left transition hover:opacity-90 sm:flex-row sm:items-center sm:justify-between"
                          style={{
                            background: 'rgba(255,255,255,0.025)',
                            border: '1px solid rgba(255,255,255,0.07)',
                          }}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="h-2.5 w-2.5 rounded-full" style={{ background: TYPE_COLORS[event.type] }} />
                              <p className="truncate font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>
                                {event.title}
                              </p>
                            </div>
                            <p className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                              {TYPE_LABELS[event.type]}
                            </p>
                          </div>
                          <div className="shrink-0 rounded-xl px-3 py-1 text-sm" style={glassStyle}>
                            {eventTimeLabel(event)}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState label="No upcoming events" />
              )}
            </div>
          )}
        </div>
      </div>

      {selectedEvent && (
        <div className="fixed left-4 right-4 top-24 z-50 mx-auto max-w-sm rounded-3xl p-4 shadow-2xl" style={glassStyle}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Event
              </p>
              <h2 className="mt-1 text-lg font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>
                {selectedEvent.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setSelectedEvent(null)}
              className="rounded-full p-2 transition hover:opacity-90"
              style={glassStyle}
              aria-label="Close event details"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3 rounded-2xl px-3 py-2" style={glassStyle}>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>Type</span>
              <span className="flex items-center gap-2 font-medium" style={{ color: 'rgba(255,255,255,0.9)' }}>
                <span className="h-2 w-2 rounded-full" style={{ background: TYPE_COLORS[selectedEvent.type] }} />
                {TYPE_LABELS[selectedEvent.type]}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-2xl px-3 py-2" style={glassStyle}>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>Date</span>
              <span className="font-medium" style={{ color: 'rgba(255,255,255,0.9)' }}>
                {formatShortDate(eventDate(selectedEvent))}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-2xl px-3 py-2" style={glassStyle}>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>Time</span>
              <span className="font-medium" style={{ color: 'rgba(255,255,255,0.9)' }}>
                {eventTimeLabel(selectedEvent)}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onOpen(selectedEvent)}
            className="mt-4 w-full rounded-2xl px-4 py-2 text-sm font-medium transition hover:opacity-90"
            style={{ background: '#6B7EFF', color: 'white' }}
          >
            Open
          </button>
        </div>
      )}
    </section>
  )
}
