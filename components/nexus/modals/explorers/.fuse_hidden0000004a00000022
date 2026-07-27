'use client'

import { useState, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CalEvent {
  id:          string
  title:       string
  type:        string
  start_time:  string
  end_time:    string | null
  is_all_day:  boolean
}

interface Props {
  onBack: () => void
}

// ─── Event type config ────────────────────────────────────────────────────────

const TYPE_META: Record<string, { label: string; hex: string }> = {
  todo:             { label: 'Task',        hex: '#6B7EFF' },
  work_order:       { label: 'Work Order',  hex: '#059669' },
  work_order_phase: { label: 'Phase',       hex: '#C2410C' },
  pm_schedule:      { label: 'PM',          hex: '#0B7285' },
  gcal:             { label: 'Personal',    hex: '#7C3AED' },
  crm_activity:     { label: 'CRM',         hex: '#fbbf24' },
  tracker_task:     { label: 'Tracker',     hex: '#8B5CF6' },
}

function hexRgb(h: string) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h)
  return r ? `${parseInt(r[1],16)},${parseInt(r[2],16)},${parseInt(r[3],16)}` : '107,126,255'
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  } catch { return '' }
}

function minutesUntil(iso: string): number {
  return (new Date(iso).getTime() - Date.now()) / 60000
}

function formatRelative(mins: number): { label: string; urgent: boolean } {
  if (mins < -60)   return { label: `${Math.abs(Math.round(mins / 60))}h ago`, urgent: false }
  if (mins < 0)     return { label: 'Started',                                 urgent: false }
  if (mins < 1)     return { label: 'Starting now',                            urgent: true  }
  if (mins < 30)    return { label: `In ${Math.round(mins)} min`,              urgent: true  }
  if (mins < 60)    return { label: `In ${Math.round(mins)} min`,              urgent: false }
  return { label: `In ${Math.round(mins / 60)}h`, urgent: false }
}

// ─── Event card ───────────────────────────────────────────────────────────────

function EventCard({ event }: { event: CalEvent }) {
  const meta    = TYPE_META[event.type] ?? { label: event.type, hex: '#6B7EFF' }
  const rgb     = hexRgb(meta.hex)
  const mins    = minutesUntil(event.start_time)
  const rel     = formatRelative(mins)
  const isPast  = mins < -60
  const isPulse = rel.urgent

  return (
    <>
      {isPulse && (
        <style>{`
          @keyframes nexus-pulse-border {
            0%, 100% { box-shadow: 0 0 0 0 rgba(${rgb},0); border-color: rgba(${rgb},0.3); }
            50%       { box-shadow: 0 0 12px 2px rgba(${rgb},0.25); border-color: rgba(${rgb},0.65); }
          }
          .event-pulse { animation: nexus-pulse-border 2s ease-in-out infinite; }
        `}</style>
      )}

      <div
        className={`flex items-start gap-3 px-3 py-3 rounded-xl transition-all ${isPulse ? 'event-pulse' : ''}`}
        style={{
          background: isPast ? 'rgba(255,255,255,0.02)' : `rgba(${rgb},0.06)`,
          border:     `0.5px solid rgba(${rgb},${isPast ? 0.08 : 0.2})`,
          opacity:    isPast ? 0.45 : 1,
        }}
      >
        {/* Time column */}
        <div className="flex-shrink-0 text-right" style={{ minWidth: 52 }}>
          <p className="text-[11px] font-mono font-medium" style={{ color: `rgba(${rgb},0.9)` }}>
            {event.is_all_day ? 'All day' : formatTime(event.start_time)}
          </p>
          {!event.is_all_day && event.end_time && (
            <p className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.25)' }}>
              {formatTime(event.end_time)}
            </p>
          )}
        </div>

        {/* Connector line */}
        <div className="flex flex-col items-center mt-1 flex-shrink-0">
          <div className="w-2 h-2 rounded-full" style={{ background: meta.hex, boxShadow: `0 0 5px ${meta.hex}80` }} />
          <div className="w-px flex-1 mt-1" style={{ background: `rgba(${rgb},0.2)`, minHeight: 20 }} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p
              className="text-xs font-medium leading-snug"
              style={{ color: isPast ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.88)' }}
            >
              {event.title}
            </p>
            <span
              className="text-[9px] px-1.5 py-0.5 rounded flex-shrink-0"
              style={{
                background: `rgba(${rgb},0.12)`,
                color:      `rgba(${rgb},0.85)`,
                border:     `0.5px solid rgba(${rgb},0.25)`,
              }}
            >
              {meta.label}
            </span>
          </div>

          {/* Relative time badge */}
          {!event.is_all_day && !isPast && (
            <span
              className="text-[9px] mt-1 inline-block px-1.5 py-0.5 rounded"
              style={{
                background: rel.urgent ? `rgba(${rgb},0.18)` : 'rgba(255,255,255,0.04)',
                color:      rel.urgent ? meta.hex : 'rgba(255,255,255,0.3)',
                fontWeight: rel.urgent ? 600 : 400,
              }}
            >
              {rel.label}
            </span>
          )}
        </div>
      </div>
    </>
  )
}

// ─── Explorer ─────────────────────────────────────────────────────────────────

export function CalExplorer({ onBack }: Props) {
  const [events,  setEvents]  = useState<CalEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState<string>('all')

  useEffect(() => {
    const today    = new Date(); today.setHours(0,0,0,0)
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)

    fetch(`/api/calendar/events?start=${today.toISOString()}&end=${tomorrow.toISOString()}`)
      .then(r => r.json())
      .then(d => {
        const raw: CalEvent[] = d.events ?? d ?? []
        // Sort chronologically
        setEvents(raw.sort((a, b) =>
          new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        ))
      })
      .catch(() => setEvents([]))
      .finally(() => setLoading(false))
  }, [])

  const types     = ['all', ...new Set(events.map(e => e.type))]
  const filtered  = filter === 'all' ? events : events.filter(e => e.type === filter)
  const upcoming  = events.filter(e => minutesUntil(e.start_time) > -60 && minutesUntil(e.start_time) < 30)

  return (
    <>
      <style>{`
        @keyframes nexus-slide-up {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .nexus-explorer { animation: nexus-slide-up 0.22s cubic-bezier(0.16,1,0.3,1) both; }
      `}</style>

      <div className="nexus-explorer space-y-3">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 transition-colors"
            style={{ color: 'rgba(251,191,36,0.55)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(251,191,36,0.95)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(251,191,36,0.55)')}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-xs font-medium">Schedule</span>
          </button>
          <div className="flex-1 h-px" style={{ background: 'rgba(251,191,36,0.15)' }} />

          {upcoming.length > 0 && (
            <span
              className="text-[9px] px-2 py-0.5 rounded-full font-medium"
              style={{ background: 'rgba(251,191,36,0.18)', color: '#fbbf24', border: '0.5px solid rgba(251,191,36,0.35)' }}
            >
              {upcoming.length} starting soon
            </span>
          )}

          <span
            className="text-[9px] uppercase tracking-widest font-mono px-2 py-0.5 rounded"
            style={{ background: 'rgba(251,191,36,0.08)', color: 'rgba(251,191,36,0.55)', border: '0.5px solid rgba(251,191,36,0.18)' }}
          >
            Explorer
          </span>
        </div>

        {/* Type filters */}
        <div className="flex gap-1.5 flex-wrap">
          {types.map(t => {
            const m = TYPE_META[t]
            return (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className="px-2.5 py-0.5 rounded-full text-[10px] font-medium transition-all capitalize"
                style={
                  filter === t
                    ? { background: 'rgba(251,191,36,0.2)', border: '0.5px solid rgba(251,191,36,0.45)', color: '#fbbf24' }
                    : { background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.3)' }
                }
              >
                {t === 'all' ? `All (${events.length})` : (m?.label ?? t)}
              </button>
            )
          })}
        </div>

        {/* Timeline */}
        {loading ? (
          <div className="flex items-center gap-2 py-6 justify-center">
            <div className="w-4 h-4 rounded-full border-2 border-amber-500/30 border-t-amber-400 animate-spin" />
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Loading schedule…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.22)' }}>No events today</p>
          </div>
        ) : (
          <div className="space-y-1.5 overflow-y-auto pr-0.5" style={{ maxHeight: '40vh', scrollbarWidth: 'none' }}>
            {filtered.map(e => <EventCard key={e.id} event={e} />)}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-0.5" style={{ borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
          <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>
            {filtered.length} event{filtered.length !== 1 ? 's' : ''} today
          </span>
          <span className="text-[9px] uppercase tracking-widest" style={{ color: 'rgba(251,191,36,0.3)' }}>
            Nexus Calendar · Explorer Mode
          </span>
        </div>
      </div>
    </>
  )
}
