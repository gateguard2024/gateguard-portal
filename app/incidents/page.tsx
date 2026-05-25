'use client'

import { useState, useEffect } from 'react'
import {
  AlertTriangle, Plus, Clock, User,
  CheckCircle2, X,
} from 'lucide-react'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { ShieldCheck } = require('lucide-react') as any

/* ─── Types ──────────────────────────────────────────────────── */
type Severity = 'critical' | 'high' | 'medium' | 'low'
type IncidentStatus = 'open' | 'investigating' | 'resolved' | 'closed'
type TabKey = 'all' | Severity | 'unacked'

interface Incident {
  id: string
  title: string
  description: string | null
  severity: Severity
  status: IncidentStatus
  reported_by: string | null
  site_id: string | null
  created_at: string
  updated_at: string
  acknowledged_at: string | null
  acknowledged_by: string | null
}

/* ─── Config ─────────────────────────────────────────────────── */
const SEVERITY_CONFIG: Record<Severity, { label: string; color: string; bg: string; border: string; dot: string }> = {
  critical: { label: 'Critical', color: 'text-red-700',    bg: 'bg-red-100',    border: 'border-red-200',    dot: 'bg-red-500'    },
  high:     { label: 'High',     color: 'text-amber-700',  bg: 'bg-amber-100',  border: 'border-amber-200',  dot: 'bg-amber-500'  },
  medium:   { label: 'Medium',   color: 'text-yellow-700', bg: 'bg-yellow-100', border: 'border-yellow-200', dot: 'bg-yellow-500' },
  low:      { label: 'Low',      color: 'text-blue-700',   bg: 'bg-blue-100',   border: 'border-blue-200',   dot: 'bg-blue-400'   },
}

const STATUS_CONFIG: Record<IncidentStatus, { label: string; color: string }> = {
  open:          { label: 'Open',          color: 'text-red-600'     },
  investigating: { label: 'Investigating', color: 'text-amber-600'   },
  resolved:      { label: 'Resolved',      color: 'text-emerald-600' },
  closed:        { label: 'Closed',        color: 'text-slate-400'   },
}

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'all',      label: 'All'          },
  { key: 'unacked',  label: 'Unacknowledged' },
  { key: 'critical', label: 'Critical'     },
  { key: 'high',     label: 'High'         },
  { key: 'medium',   label: 'Medium'       },
  { key: 'low',      label: 'Low'          },
]

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtTs(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

/* ─── SlideOver — Report Incident ────────────────────────────── */
function ReportSlideOver({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (inc: Incident) => void
}) {
  const [form, setForm] = useState({ title: '', description: '', severity: 'medium' as Severity, reported_by: '' })
  const [saving, setSaving] = useState(false)

  if (!open) return null

  async function handleSubmit() {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        const d = await res.json()
        onCreated(d.incident)
        setForm({ title: '', description: '', severity: 'medium', reported_by: '' })
        onClose()
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col h-full">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900 text-base">Report Incident</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 transition-colors">
            <X size={18} className="text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Brief description of the incident…"
              className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
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
                    onClick={() => setForm(f => ({ ...f, severity: s }))}
                    className={`h-9 rounded-lg border text-xs font-semibold transition-colors ${cfg.bg} ${cfg.color} ${cfg.border} ${
                      form.severity === s ? 'ring-2 ring-offset-1 ring-brand-400' : ''
                    }`}
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
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Describe the incident…"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Reported By</label>
            <input
              type="text"
              value={form.reported_by}
              onChange={e => setForm(f => ({ ...f, reported_by: e.target.value }))}
              placeholder="Your name…"
              className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-9 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !form.title.trim()}
            className="flex-1 h-9 bg-brand-400 text-white rounded-lg text-sm font-semibold hover:bg-brand-500 transition-colors disabled:opacity-50"
          >
            {saving ? 'Submitting…' : 'Submit Report'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Main page ──────────────────────────────────────────────── */
export default function IncidentsPage() {
  const [activeTab, setActiveTab]   = useState<TabKey>('all')
  const [slideOpen, setSlideOpen]   = useState(false)
  const [incidents, setIncidents]   = useState<Incident[]>([])
  const [loading,   setLoading]     = useState(true)
  const [acking,    setAcking]      = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetch('/api/incidents')
      .then(r => r.json())
      .then(d => setIncidents(d.incidents ?? []))
      .catch(() => setIncidents([]))
      .finally(() => setLoading(false))
  }, [])

  async function acknowledge(inc: Incident) {
    if (inc.acknowledged_at) return
    setAcking(p => ({ ...p, [inc.id]: true }))
    try {
      const res = await fetch(`/api/incidents/${inc.id}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (res.ok) {
        const d = await res.json()
        setIncidents(prev =>
          prev.map(i =>
            i.id === inc.id
              ? { ...i, acknowledged_at: d.incident.acknowledged_at, acknowledged_by: d.incident.acknowledged_by }
              : i
          )
        )
      }
    } finally {
      setAcking(p => ({ ...p, [inc.id]: false }))
    }
  }

  const openCount     = incidents.filter(i => i.status === 'open' || i.status === 'investigating').length
  const resolvedCount = incidents.filter(i => i.status === 'resolved').length
  const unackedCount  = incidents.filter(i => !i.acknowledged_at && (i.status === 'open' || i.status === 'investigating')).length

  const filtered = incidents.filter(i => {
    if (activeTab === 'all')    return true
    if (activeTab === 'unacked') return !i.acknowledged_at && (i.status === 'open' || i.status === 'investigating')
    return i.severity === activeTab
  })

  const tabCount = (key: TabKey) => {
    if (key === 'all')    return incidents.length
    if (key === 'unacked') return unackedCount
    return incidents.filter(i => i.severity === key).length
  }

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
      <div className="grid grid-cols-4 gap-4">
        <div className="border border-border rounded-xl bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
              <AlertTriangle size={16} className="text-red-500" />
            </div>
            <span className="text-sm font-medium text-slate-500">Open</span>
          </div>
          <p className="text-3xl font-bold text-red-600">{loading ? '—' : openCount}</p>
          <p className="text-xs text-slate-400 mt-1">Active incidents</p>
        </div>
        <div className="border border-border rounded-xl bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <AlertTriangle size={16} className="text-amber-500" />
            </div>
            <span className="text-sm font-medium text-slate-500">Unacknowledged</span>
          </div>
          <p className="text-3xl font-bold text-amber-600">{loading ? '—' : unackedCount}</p>
          <p className="text-xs text-slate-400 mt-1">Need acknowledgement</p>
        </div>
        <div className="border border-border rounded-xl bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 size={16} className="text-emerald-500" />
            </div>
            <span className="text-sm font-medium text-slate-500">Resolved</span>
          </div>
          <p className="text-3xl font-bold text-emerald-600">{loading ? '—' : resolvedCount}</p>
          <p className="text-xs text-slate-400 mt-1">Closed out incidents</p>
        </div>
        <div className="border border-border rounded-xl bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center">
              <Clock size={16} className="text-slate-400" />
            </div>
            <span className="text-sm font-medium text-slate-500">Total</span>
          </div>
          <p className="text-3xl font-bold text-slate-700">{loading ? '—' : incidents.length}</p>
          <p className="text-xs text-slate-400 mt-1">All incidents logged</p>
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
            }${tab.key === 'unacked' && tabCount(tab.key) > 0 ? ' !bg-amber-100 !text-amber-600' : ''}`}>
              {tabCount(tab.key)}
            </span>
          </button>
        ))}
      </div>

      {/* ── Table ─────────────────────────────────────────────── */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-12 bg-muted/50 rounded animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <CheckCircle2 size={40} className="text-emerald-400 mb-4 opacity-50" />
          <p className="font-semibold text-slate-700 text-lg">No incidents</p>
          <p className="text-sm text-slate-400 mt-1">
            {activeTab === 'all'
              ? 'No incidents have been reported yet'
              : activeTab === 'unacked'
              ? 'All incidents have been acknowledged'
              : `No ${activeTab} severity incidents`}
          </p>
          {activeTab === 'all' && (
            <button
              onClick={() => setSlideOpen(true)}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-brand-400 text-white rounded-lg text-sm font-semibold hover:bg-brand-500 transition-colors"
            >
              <Plus size={14} /> Report Incident
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Title</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Severity</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Reported By</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Acknowledged</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(inc => {
                const sevCfg    = SEVERITY_CONFIG[inc.severity]    ?? SEVERITY_CONFIG.medium
                const statusCfg = STATUS_CONFIG[inc.status]        ?? STATUS_CONFIG.open
                const isAcked   = !!inc.acknowledged_at
                return (
                  <tr key={inc.id} className={`hover:bg-slate-50 transition-colors ${!isAcked && (inc.status === 'open' || inc.status === 'investigating') ? 'bg-amber-50/30' : ''}`}>
                    <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">{timeAgo(inc.created_at)}</td>
                    <td className="px-4 py-3.5">
                      <div>
                        <span className="font-medium text-slate-700 text-sm">{inc.title}</span>
                        {inc.description && (
                          <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{inc.description}</p>
                        )}
                      </div>
                    </td>
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
                        {inc.reported_by ?? 'Unknown'}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      {isAcked ? (
                        <div>
                          <div className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                            <ShieldCheck size={12} />
                            {inc.acknowledged_by ?? 'Someone'}
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">{fmtTs(inc.acknowledged_at!)}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      {!isAcked && (inc.status === 'open' || inc.status === 'investigating') && (
                        <button
                          onClick={() => acknowledge(inc)}
                          disabled={acking[inc.id]}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors border border-amber-200 disabled:opacity-50 whitespace-nowrap"
                        >
                          <ShieldCheck size={12} />
                          {acking[inc.id] ? 'Acking…' : 'Acknowledge'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── SlideOver ─────────────────────────────────────────── */}
      <ReportSlideOver
        open={slideOpen}
        onClose={() => setSlideOpen(false)}
        onCreated={inc => setIncidents(prev => [inc, ...prev])}
      />
    </div>
  )
}
