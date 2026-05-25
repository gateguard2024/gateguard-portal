'use client'

import { useState, useEffect } from 'react'
import {
  Bell, AlertTriangle, Info, CheckCircle2,
  Clock, ArrowRight, Shield,
} from 'lucide-react'

const { AlertOctagon } = require('lucide-react') as any

/* ─── Types ──────────────────────────────────────────────────── */
// Sourced from the incidents table (severity: low | medium | high | critical)
// Alerts page shows only high + critical incidents (the urgent ones).
// The "warning" tab maps to "high" severity.
type TabKey = 'all' | 'critical' | 'high'

interface GGAlert {
  id: string
  severity: string          // low | medium | high | critical
  status: string            // open | investigating | resolved | closed
  title: string
  description: string | null
  reported_by: string | null
  site_id: string | null
  created_at: string
  updated_at: string
}

/* ─── Config ─────────────────────────────────────────────────── */
const SEVERITY_CONFIG: Record<string, { bar: string; icon: React.ElementType; iconColor: string; label: string }> = {
  critical: { bar: 'bg-red-500',   icon: AlertOctagon,  iconColor: 'text-red-500',   label: 'Critical' },
  high:     { bar: 'bg-amber-400', icon: AlertTriangle, iconColor: 'text-amber-500', label: 'High'     },
  medium:   { bar: 'bg-blue-400',  icon: Info,          iconColor: 'text-blue-500',  label: 'Medium'   },
  low:      { bar: 'bg-slate-300', icon: Bell,          iconColor: 'text-slate-400', label: 'Low'      },
}

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'all',      label: 'All Alerts' },
  { key: 'critical', label: 'Critical'   },
  { key: 'high',     label: 'High'       },
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

/* ─── Alert row ──────────────────────────────────────────────── */
function AlertRow({ alert }: { alert: GGAlert }) {
  const sevCfg  = SEVERITY_CONFIG[alert.severity] ?? SEVERITY_CONFIG.high
  const isOpen  = alert.status === 'open' || alert.status === 'investigating'

  return (
    <div className={`flex items-start gap-0 border-b border-slate-100 last:border-0 transition-colors ${isOpen ? 'bg-blue-50/40' : ''}`}>
      <div className={`w-1 self-stretch rounded-l-xl shrink-0 ${sevCfg.bar}`} />
      <div className="flex-1 flex items-start gap-3 px-4 py-3.5">
        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
          <sevCfg.icon size={14} className="text-slate-500" />
        </div>
        <div className="flex-1 min-w-0">
          {isOpen && (
            <span className="inline-block w-2 h-2 rounded-full bg-brand-400 mb-1 align-middle mr-1" />
          )}
          <p className="text-sm text-slate-800 leading-snug font-medium">{alert.title}</p>
          {alert.description && (
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{alert.description}</p>
          )}
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <Clock size={10} />
              {timeAgo(alert.created_at)}
            </div>
            <span className={`text-xs font-semibold ${sevCfg.iconColor}`}>
              {sevCfg.label}
            </span>
            {alert.reported_by && (
              <span className="text-xs text-slate-400">via {alert.reported_by}</span>
            )}
            {!isOpen && (
              <span className="text-xs text-emerald-600 font-medium capitalize">{alert.status}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href="/incidents"
            className="flex items-center gap-1 text-xs font-semibold text-brand-400 hover:text-brand-500 transition-colors whitespace-nowrap"
          >
            View <ArrowRight size={11} />
          </a>
        </div>
      </div>
    </div>
  )
}

/* ─── Main page ──────────────────────────────────────────────── */
export default function AlertsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [alerts, setAlerts]       = useState<GGAlert[]>([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    // Fetch high + critical incidents from the incidents table
    fetch('/api/incidents?severity=high,critical&limit=50')
      .then(r => r.json())
      .then(d => setAlerts(d.incidents ?? []))
      .catch(() => setAlerts([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = alerts.filter(a =>
    activeTab === 'all' ? true : a.severity === activeTab
  )

  const unreadCount = alerts.filter(a => a.status === 'open' || a.status === 'investigating').length
  const tabCount    = (key: TabKey) =>
    key === 'all' ? alerts.length : alerts.filter(a => a.severity === key).length

  return (
    <div className="p-6 max-w-screen-xl mx-auto space-y-6">

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Bell size={24} className="text-brand-400" />
            Alerts
            {!loading && unreadCount > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 bg-red-100 text-red-600 rounded-full">
                {unreadCount} unread
              </span>
            )}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Critical and warning events from your properties
          </p>
        </div>
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

      {/* ── Alert list ────────────────────────────────────────── */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-16 bg-muted/50 rounded animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <CheckCircle2 size={40} className="text-emerald-400 mb-4 opacity-50" />
          <p className="font-semibold text-slate-700 text-lg">All clear</p>
          <p className="text-sm text-slate-400 mt-1">
            {activeTab === 'all'
              ? 'No critical or warning events at this time'
              : `No ${activeTab} alerts at this time`}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {filtered.map(alert => (
            <AlertRow key={alert.id} alert={alert} />
          ))}
        </div>
      )}
    </div>
  )
}
