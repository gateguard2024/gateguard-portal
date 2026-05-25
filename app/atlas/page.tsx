"use client"

import { useState } from "react"
import {
  RefreshCw, X, Check, Users, Building2,
  Settings, Plus, ChevronDown, Zap, AlertTriangle,
  Filter,
} from "lucide-react"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { UserCheck, RotateCcw, Tv, SlidersHorizontal, Network, MoreVertical } = require("lucide-react") as any

// ─── Types ────────────────────────────────────────────────────────────────────

type EventType = "move_in" | "move_out" | "name_change" | "renewal"
type EventStatus = "pending" | "provisioning" | "active" | "deactivated" | "failed"
type PmsType = "Yardi" | "AppFolio" | "Manual"
type TabType = "events" | "properties" | "rules"

type AtlasEvent = {
  id: string
  property_name: string
  unit: string
  resident: string
  event_type: EventType
  status: EventStatus
  timestamp: string
  directv_account?: string
  error?: string
}

type PropertyConfig = {
  id: string
  name: string
  units: number
  directv_account: string
  pms_type: PmsType
  auto_provision: boolean
  last_sync: string
}

// ─── Demo data ────────────────────────────────────────────────────────────────

const DEMO_EVENTS: AtlasEvent[] = [
  {
    id: "ae-1",
    property_name: "Riverside Commons",
    unit: "4B",
    resident: "Marcus Webb",
    event_type: "move_in",
    status: "active",
    timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
    directv_account: "DTV-7829341",
  },
  {
    id: "ae-2",
    property_name: "Stonegate Villas",
    unit: "11A",
    resident: "Jennifer Morales",
    event_type: "move_in",
    status: "provisioning",
    timestamp: new Date(Date.now() - 18 * 60000).toISOString(),
  },
  {
    id: "ae-3",
    property_name: "Lakewood Commons",
    unit: "3C",
    resident: "Derek Chan",
    event_type: "move_out",
    status: "deactivated",
    timestamp: new Date(Date.now() - 24 * 3600000).toISOString(),
    directv_account: "DTV-6641029",
  },
  {
    id: "ae-4",
    property_name: "Sunset Commons",
    unit: "7F",
    resident: "Amanda Torres",
    event_type: "move_in",
    status: "failed",
    timestamp: new Date(Date.now() - 4 * 3600000).toISOString(),
    error: "CC check failed — credit score below threshold (AR response). Manual review required.",
  },
]

const DEMO_PROPERTIES: PropertyConfig[] = [
  {
    id: "pp-1",
    name: "Riverside Commons",
    units: 240,
    directv_account: "DTV-MASTER-7829",
    pms_type: "Yardi",
    auto_provision: true,
    last_sync: new Date(Date.now() - 12 * 60000).toISOString(),
  },
  {
    id: "pp-2",
    name: "Stonegate Villas",
    units: 96,
    directv_account: "DTV-MASTER-4411",
    pms_type: "AppFolio",
    auto_provision: true,
    last_sync: new Date(Date.now() - 3 * 3600000).toISOString(),
  },
  {
    id: "pp-3",
    name: "Lakewood Commons",
    units: 180,
    directv_account: "DTV-MASTER-8803",
    pms_type: "Manual",
    auto_provision: false,
    last_sync: new Date(Date.now() - 2 * 24 * 3600000).toISOString(),
  },
]

const PROVISIONING_RULES = [
  {
    id: "rule-1",
    title: "Move-In Provisioning",
    description: "When a new lease is detected, automatically provision DirecTV service under the lease holder's name. ATLAS runs a SARA CC check first — if approved, Order Entry is submitted immediately.",
    icon: UserCheck,
    color: "#059669",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    enabled: true,
  },
  {
    id: "rule-2",
    title: "Move-Out Deactivation",
    description: "When a lease end date is reached or a move-out event is received from the PMS, ATLAS deactivates the DirecTV account within 24 hours. Unit is marked available for the next tenant.",
    icon: RotateCcw,
    color: "#B45309",
    bg: "bg-amber-50",
    border: "border-amber-200",
    enabled: true,
  },
  {
    id: "rule-3",
    title: "Name Change on Lease Transfer",
    description: "When a lease is transferred to a new holder, ATLAS updates the DirecTV account holder name to match the new tenant. No service interruption — continuous billing, new account holder.",
    icon: Network,
    color: "#6B7EFF",
    bg: "bg-indigo-50",
    border: "border-indigo-200",
    enabled: false,
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function EventTypeBadge({ type }: { type: EventType }) {
  const cfg = {
    move_in:     { label: "MOVE IN",     bg: "bg-emerald-100", text: "text-emerald-700" },
    move_out:    { label: "MOVE OUT",    bg: "bg-slate-100",   text: "text-slate-600"   },
    name_change: { label: "NAME CHANGE", bg: "bg-blue-100",    text: "text-blue-700"    },
    renewal:     { label: "RENEWAL",     bg: "bg-violet-100",  text: "text-violet-700"  },
  }[type]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider ${cfg.bg} ${cfg.text}`}
      style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
      {cfg.label}
    </span>
  )
}

function StatusBadge({ status }: { status: EventStatus }) {
  const cfg = {
    pending:      { label: "Pending",      dot: "bg-amber-400",   text: "text-amber-700",   bg: "bg-amber-50"   },
    provisioning: { label: "Provisioning", dot: "bg-blue-400",    text: "text-blue-700",    bg: "bg-blue-50"    },
    active:       { label: "Active",       dot: "bg-emerald-400", text: "text-emerald-700", bg: "bg-emerald-50" },
    deactivated:  { label: "Deactivated",  dot: "bg-slate-400",   text: "text-slate-600",   bg: "bg-slate-50"   },
    failed:       { label: "Failed",       dot: "bg-red-500",     text: "text-red-700",     bg: "bg-red-50"     },
  }[status]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot} ${status === "provisioning" ? "animate-pulse" : ""}`} />
      {cfg.label}
    </span>
  )
}

// ─── Add Property Slide-Over ──────────────────────────────────────────────────

function AddPropertySlideOver({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({
    name: "",
    directv_account: "",
    pms_type: "AppFolio" as PmsType,
    auto_provision: true,
  })
  const [saved, setSaved] = useState(false)

  function handleSave() {
    setSaved(true)
    setTimeout(onClose, 1200)
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-white h-full shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200"
          style={{ background: "#0B1728" }}>
          <div>
            <h2 className="font-bold text-white text-sm"
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
              Add Property to ATLAS
            </h2>
            <p className="text-[11px] text-white/50 mt-0.5">Configure DirecTV auto-provisioning</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Property Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Riverside Commons"
              className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">DirecTV Master Account #</label>
            <input
              type="text"
              value={form.directv_account}
              onChange={e => setForm(p => ({ ...p, directv_account: e.target.value }))}
              placeholder="DTV-MASTER-XXXXX"
              className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">PMS Type</label>
            <div className="relative">
              <select
                value={form.pms_type}
                onChange={e => setForm(p => ({ ...p, pms_type: e.target.value as PmsType }))}
                className="w-full h-9 pl-3 pr-8 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:border-transparent appearance-none"
              >
                <option value="Yardi">Yardi</option>
                <option value="AppFolio">AppFolio</option>
                <option value="Manual">Manual Webhook</option>
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
            <p className="mt-1 text-[10px] text-gray-400">
              {form.pms_type === "Manual"
                ? "POST to /api/atlas/webhook with x-atlas-key header. See docs."
                : `ATLAS will listen for ${form.pms_type} lease events via webhook.`}
            </p>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-100">
            <div>
              <p className="text-sm font-medium text-gray-700">Auto-Provision</p>
              <p className="text-xs text-gray-400 mt-0.5">Automatically activate DirecTV on move-in events</p>
            </div>
            <button
              onClick={() => setForm(p => ({ ...p, auto_provision: !p.auto_provision }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                form.auto_provision ? "bg-emerald-500" : "bg-gray-300"
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                form.auto_provision ? "translate-x-6" : "translate-x-1"
              }`} />
            </button>
          </div>

          <div className="p-3 rounded-lg border border-dashed border-gray-200 bg-gray-50">
            <p className="text-[11px] text-gray-500 leading-relaxed">
              <span className="font-semibold text-gray-700">Webhook URL:</span>{" "}
              <code className="text-[10px] bg-gray-200 rounded px-1">POST /api/atlas/webhook</code>
              <br />
              <span className="font-semibold text-gray-700">Auth header:</span>{" "}
              <code className="text-[10px] bg-gray-200 rounded px-1">x-atlas-key: &lt;ATLAS_WEBHOOK_SECRET&gt;</code>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="flex-1 h-9 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!form.name}
            className="flex-1 h-9 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            style={{ background: saved ? "#059669" : "#0B1728" }}
          >
            {saved ? <><Check size={14} /> Saved!</> : "Add Property"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AtlasPage() {
  const [activeTab, setActiveTab] = useState<TabType>("events")
  const [events, setEvents] = useState<AtlasEvent[]>(DEMO_EVENTS)
  const [properties] = useState<PropertyConfig[]>(DEMO_PROPERTIES)
  const [rules, setRules] = useState(PROVISIONING_RULES)
  const [showAddProperty, setShowAddProperty] = useState(false)
  const [retried, setRetried] = useState<Set<string>>(new Set())

  function handleRetry(id: string) {
    setRetried(prev => new Set([...prev, id]))
    setEvents(prev =>
      prev.map(e => e.id === id ? { ...e, status: "provisioning" as EventStatus, error: undefined } : e)
    )
    // Simulate re-provisioning completing
    setTimeout(() => {
      setEvents(prev =>
        prev.map(e => e.id === id ? { ...e, status: "active" as EventStatus } : e)
      )
    }, 2500)
  }

  function handleRuleToggle(id: string) {
    setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r))
  }

  const stats = [
    {
      label: "Active Properties",
      value: properties.filter(p => p.auto_provision).length,
      icon: Building2,
      color: "#6B7EFF",
    },
    {
      label: "Pending Activations",
      value: events.filter(e => e.status === "pending" || e.status === "provisioning").length,
      icon: Zap,
      color: "#B45309",
    },
    {
      label: "Completed This Month",
      value: events.filter(e => e.status === "active" && e.event_type === "move_in").length,
      icon: Check,
      color: "#059669",
    },
    {
      label: "Deactivations This Month",
      value: events.filter(e => e.status === "deactivated").length,
      icon: RotateCcw,
      color: "#64748B",
    },
  ]

  const tabs: { id: TabType; label: string }[] = [
    { id: "events",     label: "Events Feed"         },
    { id: "properties", label: "Property Config"      },
    { id: "rules",      label: "Provisioning Rules"   },
  ]

  return (
    <div className="min-h-screen" style={{ background: "#EEF2FF" }}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-10 flex items-center gap-4 px-6 py-4 shadow-sm"
        style={{ background: "#0B1728" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold text-white"
            style={{ background: "#3B5BDB" }}>
            AT
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span
                className="text-xl font-bold tracking-widest text-white"
                style={{ fontFamily: "'IBM Plex Mono', monospace" }}
              >
                ATLAS
              </span>
              {/* v1.1 badge */}
              <span className="bg-purple-500 text-white text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                v1.1
              </span>
            </div>
            <p className="text-[11px] text-white/50 -mt-0.5"
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
              Resident Lifecycle Middleware
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ background: "#3B5BDB" }} />
            <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "#3B5BDB" }} />
          </span>
          <span className="text-[11px] font-semibold tracking-widest uppercase text-white/70"
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
            LISTENING
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            className="h-8 w-8 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            title="Settings"
          >
            <Settings size={15} />
          </button>
          <button
            onClick={() => setShowAddProperty(true)}
            className="h-8 px-4 rounded-lg text-sm font-semibold text-white flex items-center gap-2 transition-colors hover:opacity-90"
            style={{ background: "#3B5BDB" }}
          >
            <Plus size={14} />
            Add Property
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

        {/* ── Stats Bar ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map(stat => (
            <div key={stat.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-gray-500">{stat.label}</span>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: `${stat.color}18` }}>
                  <stat.icon size={14} style={{ color: stat.color }} />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900"
                style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* ── Tab Bar ──────────────────────────────────────────────────────── */}
        <div className="flex gap-1 p-1 bg-white rounded-xl border border-gray-100 shadow-sm w-fit">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`h-8 px-4 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? "text-white"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
              style={activeTab === tab.id ? { background: "#0B1728" } : {}}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Events Feed ──────────────────────────────────────────────────── */}
        {activeTab === "events" && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900"
                style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                Resident Lifecycle Events
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{events.length} events</span>
                <button className="h-7 px-2 rounded-lg border border-gray-200 text-xs text-gray-500 flex items-center gap-1 hover:bg-gray-50 transition-colors">
                  <Filter size={11} />
                  Filter
                </button>
              </div>
            </div>

            <div className="divide-y divide-gray-50">
              {events.map(event => (
                <div key={event.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {/* Icon */}
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                        event.event_type === "move_in"
                          ? "bg-emerald-100"
                          : event.event_type === "move_out"
                          ? "bg-slate-100"
                          : "bg-blue-100"
                      }`}>
                        {event.event_type === "move_in"
                          ? <UserCheck size={16} className="text-emerald-600" />
                          : event.event_type === "move_out"
                          ? <RotateCcw size={16} className="text-slate-500" />
                          : <Users size={16} className="text-blue-600" />
                        }
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <p className="text-sm font-semibold text-gray-900">{event.resident}</p>
                          <EventTypeBadge type={event.event_type} />
                        </div>
                        <p className="text-xs text-gray-500">
                          <span className="font-medium text-gray-700">{event.property_name}</span>
                          {" · "}Unit {event.unit}
                          {event.directv_account && (
                            <> · <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{event.directv_account}</span></>
                          )}
                        </p>
                        {event.error && (
                          <div className="flex items-start gap-1.5 mt-2 p-2 rounded-lg bg-red-50 border border-red-100">
                            <AlertTriangle size={12} className="text-red-500 shrink-0 mt-0.5" />
                            <p className="text-[11px] text-red-600 leading-relaxed">{event.error}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <StatusBadge status={event.status} />
                      <span className="text-[10px] text-gray-400">{timeAgo(event.timestamp)}</span>
                      {event.status === "failed" && (
                        <button
                          onClick={() => !retried.has(event.id) && handleRetry(event.id)}
                          disabled={retried.has(event.id)}
                          className="h-7 px-3 rounded-lg text-[11px] font-semibold text-white flex items-center gap-1 transition-colors disabled:opacity-60"
                          style={{ background: "#0B1728" }}
                        >
                          <RefreshCw size={11} />
                          Retry
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Property Config ───────────────────────────────────────────────── */}
        {activeTab === "properties" && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900"
                style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                Enrolled Properties
              </h2>
              <button
                onClick={() => setShowAddProperty(true)}
                className="h-8 px-3 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 transition-colors hover:opacity-90"
                style={{ background: "#3B5BDB" }}
              >
                <Plus size={13} />
                Add Property
              </button>
            </div>

            {/* Table header */}
            <div className="hidden md:grid grid-cols-[1fr_80px_160px_100px_100px_80px_40px] gap-4 px-6 py-2 bg-gray-50 border-b border-gray-100">
              {["Property", "Units", "DirecTV Account", "PMS", "Auto-Provision", "Last Sync", ""].map((h, i) => (
                <span key={i} className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  {h}
                </span>
              ))}
            </div>

            <div className="divide-y divide-gray-50">
              {properties.map(prop => (
                <div
                  key={prop.id}
                  className="grid grid-cols-[1fr_80px_160px_100px_100px_80px_40px] gap-4 px-6 py-3 items-center hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{prop.name}</p>
                  </div>
                  <span className="text-sm text-gray-600 tabular-nums"
                    style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                    {prop.units}
                  </span>
                  <span className="text-xs text-gray-600 truncate"
                    style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                    {prop.directv_account}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold w-fit ${
                    prop.pms_type === "Yardi"
                      ? "bg-violet-100 text-violet-700"
                      : prop.pms_type === "AppFolio"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-600"
                  }`}>
                    {prop.pms_type}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${prop.auto_provision ? "bg-emerald-400" : "bg-gray-300"}`} />
                    <span className={`text-xs font-medium ${prop.auto_provision ? "text-emerald-600" : "text-gray-400"}`}>
                      {prop.auto_provision ? "ON" : "OFF"}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">{timeAgo(prop.last_sync)}</span>
                  <button className="h-7 w-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                    <MoreVertical size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Provisioning Rules ────────────────────────────────────────────── */}
        {activeTab === "rules" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <SlidersHorizontal size={16} className="text-gray-400" />
              <p className="text-sm text-gray-600">
                ATLAS rules engine — controls automatic provisioning behavior for all enrolled properties
              </p>
            </div>

            {rules.map(rule => {
              const RuleIcon = rule.icon
              return (
                <div
                  key={rule.id}
                  className={`bg-white rounded-xl border p-6 shadow-sm transition-opacity ${
                    rule.enabled ? "opacity-100" : "opacity-60"
                  } ${rule.border}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${rule.bg}`}>
                        <RuleIcon size={18} style={{ color: rule.color }} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-bold text-gray-900"
                            style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                            {rule.title}
                          </h3>
                          {rule.enabled ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                              ACTIVE
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                              OFF
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 leading-relaxed">{rule.description}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleRuleToggle(rule.id)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 mt-2 ${
                        rule.enabled ? "bg-emerald-500" : "bg-gray-300"
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        rule.enabled ? "translate-x-6" : "translate-x-1"
                      }`} />
                    </button>
                  </div>
                </div>
              )
            })}

            <div className="p-4 rounded-xl border border-dashed border-purple-200 bg-purple-50">
              <p className="text-xs text-purple-700 leading-relaxed">
                <span className="font-semibold">ATLAS v1.1:</span> Rules engine connects to SARA Plus CC
                check + Order Entry via the SARA Bridge API. Configure{" "}
                <code className="text-[10px] bg-purple-100 rounded px-1">ATLAS_WEBHOOK_SECRET</code> in
                Vercel env vars. PMS integrations (Yardi, AppFolio) require their respective API keys.
              </p>
            </div>
          </div>
        )}

      </div>

      {/* ── Add Property Slide-Over ──────────────────────────────────────── */}
      {showAddProperty && <AddPropertySlideOver onClose={() => setShowAddProperty(false)} />}
    </div>
  )
}
