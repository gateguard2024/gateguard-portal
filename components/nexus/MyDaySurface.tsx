'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AddEventModal } from '@/components/calendar/AddEventModal'

type MyDaySummary = {
  success?: boolean
  counts?: {
    today_total?: number
    week_total?: number
    today_todos?: number
    today_work_orders?: number
    today_crm_activities?: number
    today_tracker_tasks?: number
  }
  today?: {
    events?: Array<{
      id: string
      type: string
      title: string
      date?: string | null
      time?: string | null
      starts_at?: string | null
    }>
  }
  next_four_hour_appointment?: {
    title: string
    time?: string | null
    starts_at?: string | null
  } | null
  google_calendar?: {
    connected?: boolean
  }
}

type MyDayCard = {
  title: string
  subtitle: string
  hex: string
  actionLabel: string
  onClick?: () => void
  badge?: string
}

function rgb(hex: string): string {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return r ? `${parseInt(r[1], 16)},${parseInt(r[2], 16)},${parseInt(r[3], 16)}` : '0,200,255'
}

function formatEventTime(event?: { time?: string | null; starts_at?: string | null } | null): string {
  if (!event) return ''
  if (event.time) return event.time
  if (event.starts_at?.includes('T')) return event.starts_at.split('T')[1]?.slice(0, 5) ?? ''
  return ''
}

function MyDayCardButton({ card }: { card: MyDayCard }) {
  const color = rgb(card.hex)

  return (
    <button
      type="button"
      onClick={card.onClick}
      className="group relative min-h-[132px] overflow-hidden rounded-3xl p-4 text-left transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-60"
      style={{
        background: `linear-gradient(145deg, rgba(${color},0.18), rgba(255,255,255,0.035))`,
        border: `1px solid rgba(${color},0.30)`,
        boxShadow: `0 0 22px rgba(${color},0.12), 0 18px 50px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.06)`,
        backdropFilter: 'blur(18px)',
      }}
    >
      {card.badge && (
        <div
          className="absolute right-4 top-4 rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em]"
          style={{
            background: `rgba(${color},0.14)`,
            border: `1px solid rgba(${color},0.28)`,
            color: 'rgba(255,255,255,0.82)',
          }}
        >
          {card.badge}
        </div>
      )}

      <div
        className="mb-4 flex h-8 w-8 items-center justify-center rounded-2xl text-sm"
        style={{
          background: `rgba(${color},0.28)`,
          border: `1px solid rgba(${color},0.38)`,
          color: 'rgba(255,255,255,0.9)',
        }}
      />

      <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.94)' }}>
        {card.title}
      </div>

      <div className="mt-1.5 text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.48)' }}>
        {card.subtitle}
      </div>

      <div
        className="absolute bottom-4 right-4 text-xs opacity-70 transition-opacity group-hover:opacity-100"
        style={{ color: card.hex }}
      >
        {card.actionLabel}
      </div>
    </button>
  )
}

export function MyDaySurface() {
  const router = useRouter()
  const [summary, setSummary] = useState<MyDaySummary | null>(null)
  const [addEventOpen, setAddEventOpen] = useState(false)

  const loadSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/calendar/my-day')
      const data = await res.json().catch(() => null) as MyDaySummary | null
      if (res.ok && data?.success) setSummary(data)
    } catch {
      // My Day still renders useful entry points when summary loading fails.
    }
  }, [])

  useEffect(() => {
    void loadSummary()
  }, [loadSummary])

  const todayCount = summary?.counts?.today_total ?? 0
  const weekCount = summary?.counts?.week_total ?? 0
  const todayEvents = summary?.today?.events ?? []
  const nextEvent = todayEvents[0]
  const connected = summary?.google_calendar?.connected === true
  const todoCount = summary?.counts?.today_todos ?? 0
  const workSignalCount = (summary?.counts?.today_work_orders ?? 0) + (summary?.counts?.today_crm_activities ?? 0) + (summary?.counts?.today_tracker_tasks ?? 0)

  const cards: MyDayCard[] = [
    {
      title: 'Today’s Schedule',
      subtitle: nextEvent
        ? `Next: ${formatEventTime(nextEvent)} ${nextEvent.title}`.trim()
        : 'Calendar, events, jobs, site visits, and appointments for today.',
      hex: '#00C8FF',
      badge: `${todayCount} today`,
      actionLabel: 'Open →',
      onClick: () => router.push('/calendar'),
    },
    {
      title: 'Top 10 Things',
      subtitle: workSignalCount > 0
        ? `${workSignalCount} work signals are ready to rank across jobs, follow-ups, tasks, leads, opportunities, and billing.`
        : 'The most important work to handle today will rank here.',
      hex: '#007CFF',
      badge: 'Next',
      actionLabel: 'Open →',
    },
    {
      title: 'To-Dos',
      subtitle: `${todoCount} due today. Overdue, unscheduled, and done actions come next.`,
      hex: '#a855f7',
      actionLabel: 'Open →',
    },
    {
      title: 'Email',
      subtitle: connected ? 'Calendar is connected. Important email will roll in once mailbox connectors are added.' : 'Important customer messages will show here once mailbox connectors are added.',
      hex: '#64748b',
      actionLabel: 'Coming soon →',
    },
  ]

  return (
    <section className="mt-9 w-full max-w-5xl">
      <div
        className="rounded-[2rem] p-5 sm:p-6"
        style={{
          background: 'linear-gradient(180deg, rgba(0,200,255,0.07), rgba(255,255,255,0.022))',
          border: '1px solid rgba(0,200,255,0.14)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.32), 0 0 38px rgba(0,200,255,0.07), inset 0 1px 0 rgba(255,255,255,0.06)',
          backdropFilter: 'blur(24px)',
        }}
      >
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: 'rgba(0,200,255,0.78)' }}>
              My Day
            </div>
            <h2 className="mt-1 text-xl font-semibold leading-tight" style={{ color: 'rgba(255,255,255,0.96)' }}>
              What needs your attention today?
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.48)' }}>
              Schedule, top priorities, to-dos, and email. Jobs, leads, opportunities, billing, and field work roll into those four places.
            </p>
          </div>
          <div className="rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.18em]" style={{ background: 'rgba(0,200,255,0.10)', color: 'rgba(125,229,255,0.95)', border: '1px solid rgba(0,200,255,0.24)' }}>
            {weekCount} this week
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(card => <MyDayCardButton key={card.title} card={card} />)}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-3xl p-4" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.92)' }}>Today’s Schedule</div>
                <div className="mt-1 text-[11px]" style={{ color: 'rgba(255,255,255,0.42)' }}>Events, appointments, site visits, and scheduled work.</div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setAddEventOpen(true)} className="rounded-full px-3 py-1.5 text-[11px] font-semibold" style={{ background: 'rgba(0,200,255,0.12)', border: '1px solid rgba(0,200,255,0.24)', color: '#7dd3fc' }}>Add Event</button>
                <button type="button" onClick={() => router.push('/calendar')} className="rounded-full px-3 py-1.5 text-[11px] font-semibold" style={{ background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.58)' }}>Week</button>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {todayEvents.length > 0 ? todayEvents.slice(0, 5).map(event => (
                <div key={`${event.type}-${event.id}`} className="rounded-2xl px-3 py-2" style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.88)' }}>{event.title}</div>
                    <div className="text-[10px]" style={{ color: '#7dd3fc' }}>{formatEventTime(event) || 'Today'}</div>
                  </div>
                  <div className="mt-1 text-[10px] capitalize" style={{ color: 'rgba(255,255,255,0.34)' }}>{event.type.replace(/_/g, ' ')}</div>
                </div>
              )) : (
                <div className="rounded-2xl px-3 py-3 text-xs" style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.42)' }}>
                  Nothing scheduled yet. Add an event to start planning your day.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl p-4" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.92)' }}>Top 10 Things</div>
            <div className="mt-1 text-[11px]" style={{ color: 'rgba(255,255,255,0.42)' }}>Jobs, leads, opportunities, billing, tasks, and follow-ups will rank here by urgency.</div>
            <div className="mt-4 rounded-2xl px-3 py-3 text-xs" style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.42)' }}>
              Ranking engine coming next. For now, use Today’s Schedule and Add Event.
            </div>
          </div>
        </div>

        <div className="mt-5 text-[11px]" style={{ color: 'rgba(255,255,255,0.32)' }}>
          My Day stays simple: schedule, top priorities, to-dos, and email. Everything else rolls up into one of those.
        </div>
      </div>

      <AddEventModal
        open={addEventOpen}
        onClose={() => setAddEventOpen(false)}
        onSaved={loadSummary}
      />
    </section>
  )
}
