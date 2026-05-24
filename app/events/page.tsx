'use client'

import { useState, useEffect } from 'react'
import { Calendar, Plus, MapPin, Clock, Users, Building2, ChevronRight } from 'lucide-react'

const { Tag } = require('lucide-react') as any

/* ─── Types ──────────────────────────────────────────────────── */
type SiteEventType = string
type SiteEventSeverity = string
type TabKey = 'all' | 'info' | 'warning' | 'critical'

interface SiteEvent {
  id: string
  event_type: SiteEventType
  title: string
  description: string | null
  severity: SiteEventSeverity
  resolved: boolean
  site_id: string | null
  org_id: string | null
  created_at: string
}

/* ─── Config ─────────────────────────────────────────────────── */
const EVENT_TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  install:      { label: 'Install',      color: 'text-sky-700',     bg: 'bg-sky-100'     },
  offline:      { label: 'Offline',      color: 'text-red-700',     bg: 'bg-red-100'     },
  online:       { label: 'Online',       color: 'text-emerald-700', bg: 'bg-emerald-100' },
  work_order:   { label: 'Work Order',   color: 'text-amber-700',   bg: 'bg-amber-100'   },
  inspection:   { label: 'Inspection',   color: 'text-violet-700',  bg: 'bg-violet-100'  },
  alert:        { label: 'Alert',        color: 'text-red-700',     bg: 'bg-red-100'     },
  access:       { label: 'Access',       color: 'text-indigo-700',  bg: 'bg-indigo-100'  },
  visitor:      { label: 'Visitor',      color: 'text-pink-700',    bg: 'bg-pink-100'    },
  other:        { label: 'Other',        color: 'text-slate-700',   bg: 'bg-slate-100'   },
}

const SEVERITY_CONFIG: Record<string, { dot: string; color: string; label: string }> = {
  info:     { dot: 'bg-blue-400',    color: 'text-blue-600',    label: 'Info'     },
  warning:  { dot: 'bg-amber-400',   color: 'text-amber-600',   label: 'Warning'  },
  critical: { dot: 'bg-red-500',     color: 'text-red-600',     label: 'Critical' },
}

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'all',      label: 'All Events' },
  { key: 'critical', label: 'Critical'   },
  { key: 'warning',  label: 'Warnings'   },
  { key: 'info',     label: 'Info'       },
]

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

/* ─── Main page ──────────────────────────────────────────────── */
export default function EventsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [events, setEvents]       = useState<SiteEvent[]>([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    fetch('/api/events')
      .then(r => r.json())
      .then(d => setEvents(d.events ?? []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = events.filter(e => {
    if (activeTab === 'all') return true
    return e.severity === activeTab
  })

  const tabCount = (key: TabKey) =>
    key === 'all' ? events.length : events.filter(e => e.severity === key).length

  return (
    <div className="p-6 max-w-screen-xl mx-auto space-y-6">

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Calendar size={24} className="text-brand-400" />
            Events
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Property installs, offline alerts, inspections, and access events
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-brand-400 text-white rounded-lg text-sm font-semibold hover:bg-brand-500 transition-colors shrink-0">
          <Plus size={15} /> New Event
        </button>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────── */}
      <div className="flex gap-0.5 border-b border-slate-200">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? 'border-brand-400 text-brand-400'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
              activeTab === tab.key ? 'bg-brand-100 text-brand-600' : 'bg-slate-100 text-slate-500'
            }`}>
              {tabCount(tab.key)}
            </span>
          </button>
        ))}
      </div>

      {/* ── Content ───────────────────────────────────────────── */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="border border-border rounded-xl bg-card p-4 space-y-3">
              <div className="h-5 bg-muted/50 rounded animate-pulse w-24" />
              <div className="h-4 bg-muted/50 rounded animate-pulse w-full" />
              <div className="h-3 bg-muted/50 rounded animate-pulse w-3/4" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Calendar size={40} className="mb-4 opacity-25" />
          <p className="font-semibold text-slate-600 text-lg">No events yet</p>
          <p className="text-sm mt-1 text-slate-400">
            {activeTab === 'all'
              ? 'Events from your properties will appear here'
              : `No ${activeTab} events at this time`}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(event => {
            const typeCfg   = EVENT_TYPE_CONFIG[event.event_type] ?? EVENT_TYPE_CONFIG.other
            const sevCfg    = SEVERITY_CONFIG[event.severity]    ?? SEVERITY_CONFIG.info
            return (
              <div
                key={event.id}
                className="border border-border rounded-xl bg-card p-4 hover:shadow-md transition-shadow cursor-pointer group"
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${typeCfg.bg} ${typeCfg.color}`}>
                    <Tag size={10} />
                    {typeCfg.label}
                  </span>
                  <div className="flex items-center gap-1.5 text-xs">
                    <div className={`w-1.5 h-1.5 rounded-full ${sevCfg.dot}`} />
                    <span className={sevCfg.color}>{sevCfg.label}</span>
                  </div>
                </div>

                {/* Title */}
                <h3 className="font-semibold text-slate-900 text-sm leading-snug mb-2 group-hover:text-brand-400 transition-colors">
                  {event.title}
                </h3>

                {/* Description */}
                {event.description && (
                  <p className="text-xs text-slate-500 mb-2 line-clamp-2">{event.description}</p>
                )}

                {/* Meta */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Clock size={11} className="shrink-0 text-slate-400" />
                    {timeAgo(event.created_at)}
                  </div>
                  {event.resolved && (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Resolved
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end mt-4 pt-3 border-t border-slate-100">
                  <ChevronRight size={14} className="text-slate-300 group-hover:text-brand-400 transition-colors" />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
