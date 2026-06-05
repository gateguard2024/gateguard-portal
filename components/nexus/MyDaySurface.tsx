'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

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

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/calendar/my-day')
        const data = await res.json().catch(() => null) as MyDaySummary | null
        if (!cancelled && res.ok && data?.success) setSummary(data)
      } catch {
        // My Day still renders useful entry points when summary loading fails.
      }
    })()
    return () => { cancelled = true }
  }, [])

  const todayCount = summary?.counts?.today_total ?? 0
  const weekCount = summary?.counts?.week_total ?? 0
  const todayEvents = summary?.today?.events ?? []
  const nextEvent = todayEvents[0]
  const nextFourHour = summary?.next_four_hour_appointment
  const connected = summary?.google_calendar?.connected === true

  const cards: MyDayCard[] = [
    {
      title: 'Today’s Schedule',
      subtitle: nextEvent
        ? `Next: ${formatEventTime(nextEvent)} ${nextEvent.title}`.trim()
        : 'See calendar, events, jobs, and appointments for today.',
      hex: '#00C8FF',
      badge: `${todayCount} today`,
      actionLabel: 'View Week →',
      onClick: () => router.push('/calendar'),
    },
    {
      title: 'Top 10 Things',
      subtitle: 'The most important things to handle today across tasks, jobs, leads, opportunities, and billing.',
      hex: '#007CFF',
      badge: 'Next',
      actionLabel: 'Open →',
    },
    {
      title: 'Add Event',
      subtitle: 'Put something on your day. Nexus saves it first; Google sync is optional.',
      hex: '#34d399',
      actionLabel: 'Add →',
      onClick: () => router.push('/calendar'),
    },
    {
      title: 'Find Time',
      subtitle: nextFourHour
        ? `Next 4-hour block found: ${nextFourHour.title}`
        : 'Find open time for a call, site walk, install, or long appointment.',
      hex: '#fbbf24',
      actionLabel: 'Soon →',
    },
    {
      title: 'To-Dos',
      subtitle: `${summary?.counts?.today_todos ?? 0} due today. Overdue, unscheduled, and done actions come next.`,
      hex: '#a855f7',
      actionLabel: 'Open →',
    },
    {
      title: 'Jobs / Site Visits',
      subtitle: `${summary?.counts?.today_work_orders ?? 0} scheduled today. Job visits and work orders roll into My Day.`,
      hex: '#f97316',
      actionLabel: 'Open Jobs →',
      onClick: () => router.push('/?tab=jobs'),
    },
    {
      title: 'Leads & Follow-Ups',
      subtitle: 'People and properties that need a touch today.',
      hex: '#38bdf8',
      actionLabel: 'Open →',
      onClick: () => router.push('/?tab=opps'),
    },
    {
      title: 'Opportunities',
      subtitle: 'Deals waiting on proposal, quote, next step, or follow-up.',
      hex: '#22c55e',
      actionLabel: 'Open →',
      onClick: () => router.push('/?tab=opps'),
    },
    {
      title: 'Billing',
      subtitle: 'Invoices, collections, renewals, and money items will roll into My Day here.',
      hex: '#eab308',
      actionLabel: 'Soon →',
    },
    {
      title: 'Email',
      subtitle: connected ? 'Calendar is connected. Email inbox connector comes later.' : 'Email will show important customer messages once mailbox connectors are added.',
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
              Calendar, events, to-dos, jobs, leads, opportunities, billing, and email all roll up here.
            </p>
          </div>
          <div className="rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.18em]" style={{ background: 'rgba(0,200,255,0.10)', color: 'rgba(125,229,255,0.95)', border: '1px solid rgba(0,200,255,0.24)' }}>
            {weekCount} this week
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {cards.map(card => <MyDayCardButton key={card.title} card={card} />)}
        </div>

        <div className="mt-5 text-[11px]" style={{ color: 'rgba(255,255,255,0.32)' }}>
          My Day is the customer-facing command center. The backend can be calendar, CRM, jobs, billing, and email — the user just works the day.
        </div>
      </div>
    </section>
  )
}
