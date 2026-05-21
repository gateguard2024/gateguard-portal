'use client'

import { useState } from 'react'
import { Calendar, Plus, MapPin, Clock, Users, Building2, ChevronRight, Filter } from 'lucide-react'

const { Tag, CheckCircle } = require('lucide-react') as any

/* ─── Types ──────────────────────────────────────────────────── */
type EventType = 'inspection' | 'training' | 'install' | 'dealer_event' | 'site_visit'
type EventStatus = 'upcoming' | 'in_progress' | 'completed' | 'cancelled'
type TabKey = 'all' | 'property' | 'dealer' | 'upcoming'

interface GGEvent {
  id: string
  title: string
  location: string
  property?: string
  date: string
  time: string
  type: EventType
  status: EventStatus
  attendees: number
  org: string
}

/* ─── Demo data ──────────────────────────────────────────────── */
const DEMO_EVENTS: GGEvent[] = [
  {
    id: '1',
    title: 'Annual Gate Inspection — East Ponce Village',
    location: 'Atlanta, GA',
    property: 'East Ponce Village',
    date: 'May 28, 2026',
    time: '9:00 AM',
    type: 'inspection',
    status: 'upcoming',
    attendees: 3,
    org: 'GateGuard Corporate',
  },
  {
    id: '2',
    title: 'UL 325 Compliance Training — Atlanta Dealers',
    location: 'GateGuard HQ, Atlanta, GA',
    date: 'Jun 4, 2026',
    time: '10:00 AM',
    type: 'training',
    status: 'upcoming',
    attendees: 12,
    org: 'GateGuard Corporate',
  },
  {
    id: '3',
    title: 'New Install Kickoff — Stonegate Preserve',
    location: 'Marietta, GA',
    property: 'Stonegate Preserve',
    date: 'Jun 7, 2026',
    time: '8:00 AM',
    type: 'install',
    status: 'upcoming',
    attendees: 4,
    org: 'Apex Security Systems',
  },
  {
    id: '4',
    title: 'Dealer Q2 Review — Southeast Region',
    location: 'Virtual (Zoom)',
    date: 'Jun 12, 2026',
    time: '2:00 PM',
    type: 'dealer_event',
    status: 'upcoming',
    attendees: 18,
    org: 'GateGuard Corporate',
  },
  {
    id: '5',
    title: 'Site Survey — The Canopy at Buckhead',
    location: 'Buckhead, GA',
    property: 'The Canopy at Buckhead',
    date: 'May 22, 2026',
    time: '11:00 AM',
    type: 'site_visit',
    status: 'completed',
    attendees: 2,
    org: 'ProAccess Dealers',
  },
]

/* ─── Config ─────────────────────────────────────────────────── */
const EVENT_TYPE_CONFIG: Record<EventType, { label: string; color: string; bg: string }> = {
  inspection:   { label: 'Inspection',    color: 'text-amber-700',   bg: 'bg-amber-100'   },
  training:     { label: 'Training',      color: 'text-violet-700',  bg: 'bg-violet-100'  },
  install:      { label: 'Install',       color: 'text-sky-700',     bg: 'bg-sky-100'     },
  dealer_event: { label: 'Dealer Event',  color: 'text-indigo-700',  bg: 'bg-indigo-100'  },
  site_visit:   { label: 'Site Visit',    color: 'text-emerald-700', bg: 'bg-emerald-100' },
}

const STATUS_CONFIG: Record<EventStatus, { label: string; color: string; dot: string }> = {
  upcoming:    { label: 'Upcoming',    color: 'text-blue-600',    dot: 'bg-blue-400'    },
  in_progress: { label: 'In Progress', color: 'text-amber-600',   dot: 'bg-amber-400'   },
  completed:   { label: 'Completed',   color: 'text-emerald-600', dot: 'bg-emerald-400' },
  cancelled:   { label: 'Cancelled',   color: 'text-slate-400',   dot: 'bg-slate-300'   },
}

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'all',      label: 'All Events'     },
  { key: 'property', label: 'Property Events'},
  { key: 'dealer',   label: 'Dealer Events'  },
  { key: 'upcoming', label: 'Upcoming'       },
]

/* ─── Main page ──────────────────────────────────────────────── */
export default function EventsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('all')

  const filtered = DEMO_EVENTS.filter(e => {
    if (activeTab === 'property') return !!e.property
    if (activeTab === 'dealer')   return e.type === 'dealer_event' || e.type === 'training'
    if (activeTab === 'upcoming') return e.status === 'upcoming'
    return true
  })

  return (
    <div className="p-6 max-w-screen-xl mx-auto space-y-6">

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Calendar size={24} className="text-brand-400" />
            Events
            <span className="text-xs font-bold px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full">Beta</span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Property inspections, dealer training days, site installs, and team events
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-brand-400 text-white rounded-lg text-sm font-semibold hover:bg-brand-500 transition-colors shrink-0">
          <Plus size={15} /> New Event
        </button>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────── */}
      <div className="flex gap-0.5 border-b border-slate-200">
        {TABS.map(tab => {
          const count = DEMO_EVENTS.filter(e => {
            if (tab.key === 'property') return !!e.property
            if (tab.key === 'dealer')   return e.type === 'dealer_event' || e.type === 'training'
            if (tab.key === 'upcoming') return e.status === 'upcoming'
            return true
          }).length
          return (
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
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Event cards ───────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Calendar size={40} className="mb-4 opacity-25" />
          <p className="font-semibold text-slate-600 text-lg">No events scheduled</p>
          <p className="text-sm mt-1 text-slate-400">Events you create will appear here</p>
          <button className="mt-4 flex items-center gap-2 px-4 py-2 bg-brand-400 text-white rounded-lg text-sm font-semibold hover:bg-brand-500 transition-colors">
            <Plus size={14} /> New Event
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(event => {
            const typeCfg   = EVENT_TYPE_CONFIG[event.type]
            const statusCfg = STATUS_CONFIG[event.status]
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
                    <div className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                    <span className={statusCfg.color}>{statusCfg.label}</span>
                  </div>
                </div>

                {/* Title */}
                <h3 className="font-semibold text-slate-900 text-sm leading-snug mb-2 group-hover:text-brand-400 transition-colors">
                  {event.title}
                </h3>

                {/* Meta */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Calendar size={11} className="shrink-0 text-slate-400" />
                    {event.date} · {event.time}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <MapPin size={11} className="shrink-0 text-slate-400" />
                    {event.location}
                  </div>
                  {event.property && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Building2 size={11} className="shrink-0 text-slate-400" />
                      {event.property}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Users size={11} className="shrink-0 text-slate-400" />
                    {event.attendees} attendee{event.attendees !== 1 ? 's' : ''}
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
                  <span className="text-[11px] text-slate-400">{event.org}</span>
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
