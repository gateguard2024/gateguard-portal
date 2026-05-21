'use client'

import { useState } from 'react'
import {
  AlertTriangle, Plus, Building2, Clock, User,
  CheckCircle2, XCircle, Filter, ChevronDown, X,
} from 'lucide-react'

const { ShieldAlert, Flame, Wrench2, AlertOctagon } = require('lucide-react') as any

/* ─── Types ──────────────────────────────────────────────────── */
type Severity = 'critical' | 'high' | 'medium' | 'low'
type IncidentStatus = 'open' | 'investigating' | 'resolved' | 'closed'
type TabKey = 'all' | Severity

interface Incident {
  id: string
  date: string
  property: string
  type: string
  severity: Severity
  status: IncidentStatus
  assignee: string
  description: string
}

/* ─── Config ─────────────────────────────────────────────────── */
const SEVERITY_CONFIG: Record<Severity, { label: string; color: string; bg: string; border: string; dot: string }> = {
  critical: { label: 'Critical', color: 'text-red-700',    bg: 'bg-red-100',    border: 'border-red-200',   dot: 'bg-red-500'    },
  high:     { label: 'High',     color: 'text-amber-700',  bg: 'bg-amber-100',  border: 'border-amber-200', dot: 'bg-amber-500'  },
  medium:   { label: 'Medium',   color: 'text-yellow-700', bg: 'bg-yellow-100', border: 'border-yellow-200',dot: 'bg-yellow-500' },
  low:      { label: 'Low',      color: 'text-blue-700',   bg: 'bg-blue-100',   border: 'border-blue-200',  dot: 'bg-blue-400'   },
}

const STATUS_CONFIG: Record<IncidentStatus, { label: string; color: string }> = {
  open:          { label: 'Open',          color: 'text-red-600'     },
  investigating: { label: 'Investigating', color: 'text-amber-600'   },
  resolved:      { label: 'Resolved',      color: 'text-emerald-600' },
  closed:        { label: 'Closed',        color: 'text-slate-400'   },
}

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'all',      label: 'All'      },
  { key: 'critical', label: 'Critical' },
  { key: 'high',     label: 'High'     },
  { key: 'medium',   label: 'Medium'   },
  { key: 'low',      label: 'Low'      },
]

/* ─── Demo data ──────────────────────────────────────────────── */
const DEMO_INCIDENTS: Incident[] = [
  {
    id: 'INC-001',
    date: 'May 20, 2026 · 7:42 AM',
    property: 'East Ponce Village',
    type: 'Gate Failure',
    severity: 'critical',
    status: 'investigating',
    assignee: 'Mike Torres',
    description: 'Main vehicle gate stuck open after power surge. Residents unable to secure entry.',
  },
  {
    id: 'INC-002',
    date: 'May 19, 2026 · 2:15 PM',
    property: 'Stonegate Preserve',
    type: 'Camera Offline',
    severity: 'high',
    status: 'open',
    assignee: 'Unassigned',
    description: 'Two perimeter cameras went offline. Likely PoE switch issue — ticket pending.',
  },
  {
    id: 'INC-003',
    date: 'May 18, 2026 · 11:05 AM',
    property: 'The Canopy at Buckhead',
    type: 'Unauthorized Access Attempt',
    severity: 'high',
    status: 'resolved',
    assignee: 'Nicole G.',
    description: 'Brivo log shows 6 failed badge attempts on pedestrian gate. No breach. Credentials purged.',
  },
  {
    id: 'INC-004',
    date: 'May 17, 2026 · 4:30 PM',
    property: 'Vinings Place',
    type: 'Loop Detector Fault',
    severity: 'medium',
    status: 'resolved',
    assignee: 'Jake R.',
    description: 'Exit loop detector triggered false positives. Replaced induction loop sensor. Gate confirmed operational.',
  },
  {
    id: 'INC-005',
    date: 'May 16, 2026 · 9:00 AM',
    property: 'Peachtree Commons',
    type: 'Permit Violation Warning',
    severity: 'medium',
    status: 'open',
    assignee: 'Admin',
    description: 'Received notice from Fulton County regarding expired gate operator permit. Renewal submitted.',
  },
  {
    id: 'INC-006',
    date: 'May 14, 2026 · 3:22 PM',
    property: 'The Reserve at Hamilton Mill',
    type: 'Network Disruption',
    severity: 'low',
    status: 'closed',
    assignee: 'IT Team',
    description: 'UniFi switch rebooted after firmware update. 4-minute connectivity gap. No security impact.',
  },
]

/* ─── SlideOver — Report Incident ────────────────────────────── */
function ReportSlideOver({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900 text-base">Report Incident</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 transition-colors">
            <X size={18} className="text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Property</label>
            <input
              type="text"
              placeholder="Search property name…"
              className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Incident Type</label>
            <select className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white">
              <option value="">Select type…</option>
              <option>Gate Failure</option>
              <option>Camera Offline</option>
              <option>Unauthorized Access</option>
              <option>Loop Detector Fault</option>
              <option>Permit Violation</option>
              <option>Network Disruption</option>
              <option>Equipment Damage</option>
              <option>Other</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Severity</label>
            <div className="grid grid-cols-2 gap-2">
              {(['critical', 'high', 'medium', 'low'] as Severity[]).map(s => {
                const cfg = SEVERITY_CONFIG[s]
                return (
                  <button
                    key={s}
                    type="button"
                    className={`h-9 rounded-lg border text-xs font-semibold transition-colors ${cfg.bg} ${cfg.color} ${cfg.border}`}
                  >
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Description</label>
            <textarea
              rows={4}
              placeholder="Describe the incident…"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Assign To</label>
            <input
              type="text"
              placeholder="Team member name or email…"
              className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-9 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            className="flex-1 h-9 bg-brand-400 text-white rounded-lg text-sm font-semibold hover:bg-brand-500 transition-colors"
          >
            Submit Report
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Main page ──────────────────────────────────────────────── */
export default function IncidentsPage() {
  const [activeTab, setActiveTab]     = useState<TabKey>('all')
  const [slideOpen, setSlideOpen]     = useState(false)

  const openCount     = DEMO_INCIDENTS.filter(i => i.status === 'open' || i.status === 'investigating').length
  const resolvedCount = DEMO_INCIDENTS.filter(i => i.status === 'resolved' && i.date.includes('May')).length

  const filtered = DEMO_INCIDENTS.filter(i =>
    activeTab === 'all' ? true : i.severity === activeTab
  )

  const tabCount = (key: TabKey) =>
    key === 'all' ? DEMO_INCIDENTS.length : DEMO_INCIDENTS.filter(i => i.severity === key).length

  return (
    <div className="p-6 max-w-screen-xl mx-auto space-y-6">

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <AlertTriangle size={24} className="text-brand-400" />
            Incident Reports
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Gate failures, security events, equipment issues, and compliance violations
          </p>
        </div>
        <button
          onClick={() => setSlideOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-400 text-white rounded-lg text-sm font-semibold hover:bg-brand-500 transition-colors shrink-0"
        >
          <Plus size={15} /> Report Incident
        </button>
      </div>

      {/* ── KPI cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="border border-border rounded-xl bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
              <AlertTriangle size={16} className="text-red-500" />
            </div>
            <span className="text-sm font-medium text-slate-500">Open</span>
          </div>
          <p className="text-3xl font-bold text-red-600">{openCount}</p>
          <p className="text-xs text-slate-400 mt-1">Active incidents requiring attention</p>
        </div>
        <div className="border border-border rounded-xl bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 size={16} className="text-emerald-500" />
            </div>
            <span className="text-sm font-medium text-slate-500">Resolved This Month</span>
          </div>
          <p className="text-3xl font-bold text-emerald-600">{resolvedCount}</p>
          <p className="text-xs text-slate-400 mt-1">Closed out in May 2026</p>
        </div>
        <div className="border border-border rounded-xl bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <Clock size={16} className="text-amber-500" />
            </div>
            <span className="text-sm font-medium text-slate-500">Avg Response Time</span>
          </div>
          <p className="text-3xl font-bold text-amber-600">2.4h</p>
          <p className="text-xs text-slate-400 mt-1">Time to first assignment</p>
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

      {/* ── Table ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <CheckCircle2 size={40} className="text-emerald-400 mb-4 opacity-50" />
            <p className="font-semibold text-slate-700">No incidents in this category</p>
            <p className="text-sm text-slate-400 mt-1">All clear for {activeTab} severity</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">ID</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Property</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Severity</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Assignee</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(inc => {
                const sevCfg    = SEVERITY_CONFIG[inc.severity]
                const statusCfg = STATUS_CONFIG[inc.status]
                return (
                  <tr key={inc.id} className="hover:bg-slate-50 transition-colors cursor-pointer group">
                    {/* Left severity bar */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className={`w-1 h-8 rounded-full ${sevCfg.dot} shrink-0`} />
                        <span className="font-mono text-xs text-slate-500 font-semibold">{inc.id}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">{inc.date}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <Building2 size={12} className="text-slate-400 shrink-0" />
                        <span className="font-medium text-slate-700 text-sm">{inc.property}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-slate-600">{inc.type}</td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${sevCfg.bg} ${sevCfg.color}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${sevCfg.dot}`} />
                        {sevCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-xs font-medium ${statusCfg.color}`}>{statusCfg.label}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <User size={11} className="text-slate-400 shrink-0" />
                        {inc.assignee}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── SlideOver ─────────────────────────────────────────── */}
      <ReportSlideOver open={slideOpen} onClose={() => setSlideOpen(false)} />
    </div>
  )
}
