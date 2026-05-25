"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Phone, RefreshCw, Settings, Loader2,
  ChevronDown, ChevronUp, Check, X, Copy, Users, Activity,
  MessageSquare, ClipboardList, Building2,
} from "lucide-react"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { PhoneCall, PhoneIncoming, PhoneOutgoing, Mic, MicOff, Volume2, Clock, TrendingUp, Sliders } = require("lucide-react") as any

// ─── Types ────────────────────────────────────────────────────────────────────

type TrinityCall = {
  id: string
  direction: "inbound" | "outbound"
  phone_number: string
  contact_name: string | null
  duration_seconds: number
  sentiment: string | null
  outcome: string | null
  ai_summary: string | null
  recording_url: string | null
  lead_id: string | null
  created_at: string
}

type Stats = {
  calls_today: number
  calls_this_week: number
  qualified: number
  avg_duration: number
}

type ScriptType = "intro" | "followup" | "win_back"

type TabType = "monitor" | "history" | "postcall" | "talkingpoints" | "scripts"

// ─── Mock live calls ──────────────────────────────────────────────────────────

const LIVE_CALLS = [
  {
    id: "live-1",
    contact: "Riverside Commons",
    phone: "+14045552847",
    direction: "inbound" as const,
    duration: 142,
    intents: ["buying_signal", "pricing_ask"],
    agent: "TRINITY",
  },
  {
    id: "live-2",
    contact: "Marcus Webb",
    phone: "+17705559312",
    direction: "outbound" as const,
    duration: 67,
    intents: ["objection", "schedule_request"],
    agent: "TRINITY",
  },
  {
    id: "live-3",
    contact: "Stonegate HOA",
    phone: "+14045551188",
    direction: "inbound" as const,
    duration: 23,
    intents: ["escalation"],
    agent: "TRINITY",
  },
]

const INTENT_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  buying_signal:    { label: "Buying Signal",     bg: "bg-emerald-100", text: "text-emerald-700" },
  objection:        { label: "Objection",          bg: "bg-red-100",     text: "text-red-700"     },
  pricing_ask:      { label: "Pricing Ask",        bg: "bg-blue-100",    text: "text-blue-700"    },
  schedule_request: { label: "Schedule Request",   bg: "bg-violet-100",  text: "text-violet-700"  },
  escalation:       { label: "Escalation",         bg: "bg-amber-100",   text: "text-amber-700"   },
}

// ─── Mock post-call summaries ─────────────────────────────────────────────────

const POST_CALL_DATA = [
  {
    id: "pc-1",
    contact: "Jennifer Morales",
    phone: "+14045551234",
    duration: 284,
    sentiment: 0.82,
    summary: "Prospect is actively evaluating access control vendors for a 240-unit community. Expressed strong interest in Brivo integration and asked about the resident app timeline.",
    outcome: "qualified",
    pushed: false,
    created_at: new Date(Date.now() - 35 * 60000).toISOString(),
  },
  {
    id: "pc-2",
    contact: "Lakewood Properties",
    phone: "+17705558821",
    duration: 91,
    sentiment: 0.44,
    summary: "Inbound inquiry about gate repair service on an existing install. Caller had concerns about response time SLA and needs a callback from a senior tech.",
    outcome: "callback_requested",
    pushed: false,
    created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
  },
  {
    id: "pc-3",
    contact: "Derek Chan",
    phone: "+14045557700",
    duration: 38,
    sentiment: 0.21,
    summary: "Short outbound attempt to a lapsed lead. Contact stated they signed with a competitor last month and was not interested in further outreach at this time.",
    outcome: "not_interested",
    pushed: false,
    created_at: new Date(Date.now() - 5 * 3600000).toISOString(),
  },
]

// ─── Mock talking points ──────────────────────────────────────────────────────

const TALKING_POINTS_DATA = {
  property: "Riverside Commons — 240 Units",
  pain_score: 8.2,
  points: [
    "Open work order #WO-2241 (gate arm stuck in raised position, reported 3 days ago) — open with resolution before call ends.",
    "Quote #Q-0184 for $31,400 was sent 11 days ago and last opened 2 days ago — excellent time to ask for signature.",
    "Property is 94% occupied with 12 pending move-ins this month — DirecTV activation pipeline ready to trigger via ATLAS.",
  ],
}

// ─── Default scripts ──────────────────────────────────────────────────────────

const DEFAULT_SCRIPTS: Record<ScriptType, string> = {
  intro: `Hi, this is TRINITY calling on behalf of GateGuard. I'm reaching out because we help multifamily properties modernize their access control with smart gates, cameras, and resident apps — all installed and managed by your local dealer. Do you have 90 seconds to hear how it works?`,
  followup: `Hi, this is TRINITY following up from GateGuard. We spoke recently about upgrading your property's access control. I wanted to check in — is now a good time to continue that conversation?`,
  win_back: `Hi, this is TRINITY from GateGuard. It's been a while since we last connected, and I wanted to reach out because we've added some exciting new features to our platform that I think you'd find valuable. Would you be open to a quick call with one of our team members this week?`,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (!seconds || seconds === 0) return "—"
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const SENTIMENT_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  interested:     { label: "Interested",     bg: "bg-emerald-100", text: "text-emerald-700" },
  positive:       { label: "Positive",       bg: "bg-green-100",   text: "text-green-700"   },
  neutral:        { label: "Neutral",        bg: "bg-gray-100",    text: "text-gray-600"    },
  negative:       { label: "Negative",       bg: "bg-red-100",     text: "text-red-700"     },
  not_interested: { label: "Not Interested", bg: "bg-slate-100",   text: "text-slate-600"   },
}

const OUTCOME_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  qualified:          { label: "Qualified",      bg: "bg-emerald-50",  text: "text-emerald-700" },
  callback_requested: { label: "Callback",       bg: "bg-blue-50",     text: "text-blue-700"    },
  voicemail:          { label: "Voicemail",       bg: "bg-amber-50",    text: "text-amber-700"   },
  no_answer:          { label: "No Answer",       bg: "bg-gray-50",     text: "text-gray-500"    },
  not_interested:     { label: "Not Interested",  bg: "bg-slate-50",    text: "text-slate-500"   },
  transferred:        { label: "Transferred",     bg: "bg-violet-50",   text: "text-violet-700"  },
  initiated:          { label: "Initiated",       bg: "bg-blue-50",     text: "text-blue-500"    },
}

function Badge({ config, value }: { config: Record<string, { label: string; bg: string; text: string }>; value: string | null }) {
  if (!value) return <span className="text-xs text-gray-400">—</span>
  const c = config[value] ?? { label: value, bg: "bg-gray-100", text: "text-gray-600" }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  )
}

// ─── Initiate Call Modal ──────────────────────────────────────────────────────

function InitiateCallModal({ onClose }: { onClose: () => void }) {
  const [phone, setPhone] = useState("")
  const [name, setName] = useState("")
  const [scriptType, setScriptType] = useState<ScriptType>("intro")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch("/api/trinity/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: phone, contact_name: name || undefined, script_type: scriptType }),
      })
      const data = await res.json()
      if (res.ok) {
        setResult(data.message ?? "Call initiated successfully.")
      } else {
        setResult(data.error ?? "Failed to initiate call.")
      }
    } catch {
      setResult("Network error. Please try again.")
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
            Initiate TRINITY Call
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>
        {result ? (
          <div className="p-6">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-emerald-50 border border-emerald-200">
              <Check size={18} className="text-emerald-600 shrink-0 mt-0.5" />
              <p className="text-sm text-emerald-800">{result}</p>
            </div>
            <button
              onClick={onClose}
              className="mt-4 w-full h-9 rounded-lg text-sm font-medium text-white transition-colors"
              style={{ background: "#0B1728" }}
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Phone Number *</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+14045551234"
                required
                className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                style={{ "--tw-ring-color": "#6B7EFF" } as React.CSSProperties}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Contact Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Jane Smith (optional)"
                className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Script Type</label>
              <select
                value={scriptType}
                onChange={e => setScriptType(e.target.value as ScriptType)}
                className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:border-transparent"
              >
                <option value="intro">Intro — First contact</option>
                <option value="followup">Follow-Up — Already spoke</option>
                <option value="win_back">Win-Back — Lapsed contact</option>
              </select>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-9 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 h-9 rounded-lg text-sm font-medium text-white flex items-center justify-center gap-2 transition-colors"
                style={{ background: "#0B1728" }}
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Phone size={14} />}
                {loading ? "Initiating…" : "Start Call"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ─── Live Call Monitor Tab ────────────────────────────────────────────────────

function LiveCallMonitor() {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
        </span>
        <span className="text-sm font-semibold text-gray-700"
          style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
          {LIVE_CALLS.length} active calls
        </span>
        <span className="text-xs text-gray-400 ml-1">— real-time intent classification</span>
      </div>

      {LIVE_CALLS.map(call => (
        <div key={call.id}
          className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                call.direction === "inbound" ? "bg-blue-100" : "bg-teal-100"
              }`}>
                {call.direction === "inbound"
                  ? <PhoneIncoming size={14} className="text-blue-600" />
                  : <PhoneOutgoing size={14} className="text-teal-600" />
                }
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{call.contact}</p>
                <p className="text-xs text-gray-400"
                  style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                  {call.phone}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-xs font-semibold text-emerald-600"
                style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                {formatDuration(call.duration + tick)}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mr-1 self-center">
              Intents:
            </span>
            {call.intents.map(intent => {
              const cfg = INTENT_CONFIG[intent] ?? { label: intent, bg: "bg-gray-100", text: "text-gray-600" }
              return (
                <span key={intent}
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${cfg.bg} ${cfg.text}`}>
                  {cfg.label}
                </span>
              )
            })}
          </div>
        </div>
      ))}

      <div className="p-4 rounded-xl border border-dashed border-gray-200 bg-gray-50 text-center">
        <p className="text-xs text-gray-500">
          Live intent classification is powered by TRINITY + Claude Haiku streaming analysis.
          Intent chips update as the conversation progresses.
        </p>
      </div>
    </div>
  )
}

// ─── Post-Call Summary Tab ────────────────────────────────────────────────────

function PostCallSummary() {
  const [rows, setRows] = useState(POST_CALL_DATA)
  const [toast, setToast] = useState<string | null>(null)

  function handlePushCRM(id: string, contact: string) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, pushed: true } : r))
    setToast(`${contact} pushed to CRM`)
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div className="relative">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 text-white text-sm font-medium shadow-lg animate-in fade-in slide-in-from-bottom-2">
          <Check size={15} />
          {toast}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900"
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
            Post-Call Summaries
          </h3>
          <span className="text-xs text-gray-400">{rows.length} recent calls</span>
        </div>

        <div className="divide-y divide-gray-50">
          {rows.map(row => (
            <div key={row.id} className="p-6 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                    <Users size={14} className="text-gray-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{row.contact}</p>
                    <p className="text-xs text-gray-400"
                      style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                      {row.phone} · {formatDuration(row.duration)} · {timeAgo(row.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {/* Sentiment score */}
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    row.sentiment >= 0.7
                      ? "bg-emerald-100 text-emerald-700"
                      : row.sentiment >= 0.4
                      ? "bg-amber-100 text-amber-700"
                      : "bg-red-100 text-red-700"
                  }`}
                    style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                    {Math.round(row.sentiment * 100)}%
                  </span>
                  <Badge config={OUTCOME_CONFIG} value={row.outcome} />
                </div>
              </div>

              {/* AI summary */}
              <div className="ml-11 p-3 rounded-lg bg-gray-50 border border-gray-100">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
                  AI Summary
                </p>
                <p className="text-sm text-gray-700 leading-relaxed">{row.summary}</p>
              </div>

              {/* Push to CRM */}
              <div className="ml-11 flex justify-end">
                <button
                  onClick={() => !row.pushed && handlePushCRM(row.id, row.contact)}
                  disabled={row.pushed}
                  className={`h-8 px-4 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    row.pushed
                      ? "bg-emerald-50 text-emerald-600 cursor-default"
                      : "text-white hover:opacity-90"
                  }`}
                  style={!row.pushed ? { background: "#0B1728" } : {}}
                >
                  {row.pushed ? <><Check size={12} /> Pushed to CRM</> : "Push to CRM"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Talking Points Tab ───────────────────────────────────────────────────────

function TalkingPointsPanel() {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    const text = TALKING_POINTS_DATA.points.map((p, i) => `${i + 1}. ${p}`).join("\n")
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const painColor =
    TALKING_POINTS_DATA.pain_score >= 8
      ? "text-red-600"
      : TALKING_POINTS_DATA.pain_score >= 5
      ? "text-amber-600"
      : "text-emerald-600"

  return (
    <div className="space-y-4">
      {/* Incoming call indicator */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "#EEF2FF" }}>
              <Building2 size={18} style={{ color: "#6B7EFF" }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-gray-900">{TALKING_POINTS_DATA.property}</p>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                </span>
                <span className="text-xs text-blue-600 font-semibold">Active Call</span>
              </div>
              <p className="text-xs text-gray-500">NEXUS property intelligence — updated live</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Pain Score</p>
            <p className={`text-2xl font-bold ${painColor}`}
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
              {TALKING_POINTS_DATA.pain_score}
              <span className="text-base text-gray-400">/10</span>
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {TALKING_POINTS_DATA.points.map((point, i) => (
            <div key={i} className="flex gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 mt-0.5"
                style={{ background: "#0B1728" }}>
                {i + 1}
              </span>
              <p className="text-sm text-gray-700 leading-relaxed">{point}</p>
            </div>
          ))}
        </div>

        <div className="flex justify-end mt-4">
          <button
            onClick={handleCopy}
            className="h-8 px-4 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            {copied ? <><Check size={12} className="text-emerald-600" /> Copied!</> : <><Copy size={12} /> Copy to clipboard</>}
          </button>
        </div>
      </div>

      <div className="p-4 rounded-xl border border-dashed border-blue-200 bg-blue-50">
        <p className="text-xs text-blue-700 leading-relaxed">
          <span className="font-semibold">NEXUS Integration:</span> Talking points are auto-generated from
          open work orders, quote status, ARIA pain score, and occupancy data for the inbound caller&apos;s property.
          Configure property matching via caller ID in TRINITY settings.
        </p>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TrinityPage() {
  const [calls, setCalls] = useState<TrinityCall[]>([])
  const [stats, setStats] = useState<Stats>({ calls_today: 0, calls_this_week: 0, qualified: 0, avg_duration: 0 })
  const [loading, setLoading] = useState(true)
  const [showInitiate, setShowInitiate] = useState(false)
  const [expandedCall, setExpandedCall] = useState<string | null>(null)
  const [activeScript, setActiveScript] = useState<ScriptType>("intro")
  const [scripts, setScripts] = useState(DEFAULT_SCRIPTS)
  const [scriptSaved, setScriptSaved] = useState(false)
  const [voiceId, setVoiceId] = useState("21m00Tcm4TlvDq8ikWAM")
  const [speed, setSpeed] = useState(1.0)
  const [pitchNotes, setPitchNotes] = useState("Warm, professional, confident. Avoid sounding robotic.")
  const [activeTab, setActiveTab] = useState<TabType>("monitor")

  const fetchCalls = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/trinity/calls")
      if (res.ok) {
        const data = await res.json()
        setCalls(data.calls ?? [])
        if (data.stats) setStats(data.stats)
        else {
          const c = (data.calls ?? []) as TrinityCall[]
          const today = new Date().toDateString()
          const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
          const calls_today = c.filter(x => new Date(x.created_at).toDateString() === today).length
          const calls_this_week = c.filter(x => new Date(x.created_at).getTime() > weekAgo).length
          const qualified = c.filter(x => x.outcome === "qualified").length
          const withDuration = c.filter(x => x.duration_seconds > 0)
          const avg_duration = withDuration.length
            ? Math.round(withDuration.reduce((s, x) => s + x.duration_seconds, 0) / withDuration.length)
            : 0
          setStats({ calls_today, calls_this_week, qualified, avg_duration })
        }
      } else {
        setCalls([])
      }
    } catch {
      setCalls([])
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchCalls() }, [fetchCalls])

  function handleSaveScript() {
    setScriptSaved(true)
    setTimeout(() => setScriptSaved(false), 2000)
  }

  const kpis = [
    { label: "Calls Today",     value: stats.calls_today,     icon: PhoneCall,  color: "#0B7285" },
    { label: "Calls This Week", value: stats.calls_this_week, icon: TrendingUp, color: "#6B7EFF" },
    { label: "Qualified Leads", value: stats.qualified,       icon: Check,      color: "#059669" },
    { label: "Avg Duration",    value: formatDuration(stats.avg_duration), icon: Clock, color: "#B45309" },
  ]

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: "monitor",      label: "Live Monitor",      icon: <Activity size={13} /> },
    { id: "postcall",     label: "Post-Call",         icon: <ClipboardList size={13} /> },
    { id: "talkingpoints",label: "Talking Points",    icon: <MessageSquare size={13} /> },
    { id: "history",      label: "Call History",      icon: <PhoneCall size={13} /> },
    { id: "scripts",      label: "Scripts & Voice",   icon: <Sliders size={13} /> },
  ]

  return (
    <div className="min-h-screen" style={{ background: "#EEF2FF" }}>
      {/* ── Top Bar ────────────────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-10 flex items-center gap-4 px-6 py-4 shadow-sm"
        style={{ background: "#0B1728" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold text-white"
            style={{ background: "#0B7285" }}>
            TR
          </div>
          <span
            className="text-xl font-bold tracking-widest text-white"
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          >
            TRINITY
          </span>
          {/* v1.1 badge */}
          <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full font-semibold"
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
            v1.1
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ background: "#0B7285" }} />
            <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "#0B7285" }} />
          </span>
          <span className="text-[11px] font-semibold tracking-widest uppercase text-white/70"
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
            ACTIVE
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={fetchCalls}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => setShowInitiate(true)}
            className="h-8 px-4 rounded-lg text-sm font-semibold text-white flex items-center gap-2 transition-colors hover:opacity-90"
            style={{ background: "#0B7285" }}
          >
            <Phone size={14} />
            Initiate Call
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

        {/* ── KPI Cards ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map(kpi => (
            <div key={kpi.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-gray-500">{kpi.label}</span>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: `${kpi.color}18` }}>
                  <kpi.icon size={14} style={{ color: kpi.color }} />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900"
                style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                {kpi.value}
              </p>
            </div>
          ))}
        </div>

        {/* ── Tab Bar ─────────────────────────────────────────────────────── */}
        <div className="flex gap-1 p-1 bg-white rounded-xl border border-gray-100 shadow-sm w-fit">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? "text-white"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
              style={activeTab === tab.id ? { background: "#0B1728" } : {}}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab Content ─────────────────────────────────────────────────── */}

        {/* Live Monitor */}
        {activeTab === "monitor" && <LiveCallMonitor />}

        {/* Post-Call Summaries */}
        {activeTab === "postcall" && <PostCallSummary />}

        {/* Talking Points */}
        {activeTab === "talkingpoints" && <TalkingPointsPanel />}

        {/* Call History */}
        {activeTab === "history" && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900"
                style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                Call History
              </h2>
              <span className="text-xs text-gray-400">{calls.length} records</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={24} className="animate-spin text-gray-300" />
              </div>
            ) : calls.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                  <Phone size={20} className="text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-500">No calls yet</p>
                <p className="text-xs text-gray-400">Initiate your first TRINITY call to get started</p>
                <button
                  onClick={() => setShowInitiate(true)}
                  className="mt-2 h-8 px-4 rounded-lg text-xs font-semibold text-white"
                  style={{ background: "#0B1728" }}
                >
                  Initiate Call
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                <div className="hidden md:grid grid-cols-[28px_1fr_100px_90px_110px_100px_80px_60px] gap-3 px-6 py-2 bg-gray-50">
                  {["", "Contact", "Duration", "Sentiment", "Outcome", "Time", "", ""].map((h, i) => (
                    <span key={i} className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                      {h}
                    </span>
                  ))}
                </div>
                {calls.map(call => (
                  <div key={call.id}>
                    <div
                      className="grid grid-cols-[28px_1fr_100px_90px_110px_100px_80px_60px] gap-3 px-6 py-3 items-center hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => setExpandedCall(expandedCall === call.id ? null : call.id)}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${call.direction === "inbound" ? "bg-blue-100" : "bg-teal-100"}`}>
                        {call.direction === "inbound"
                          ? <PhoneIncoming size={12} className="text-blue-600" />
                          : <PhoneOutgoing size={12} className="text-teal-600" />
                        }
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {call.contact_name ?? "Unknown"}
                        </p>
                        <p className="text-xs text-gray-400 truncate"
                          style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                          {call.phone_number}
                        </p>
                      </div>
                      <span className="text-sm text-gray-600 tabular-nums"
                        style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                        {formatDuration(call.duration_seconds)}
                      </span>
                      <Badge config={SENTIMENT_CONFIG} value={call.sentiment} />
                      <Badge config={OUTCOME_CONFIG} value={call.outcome} />
                      <span className="text-xs text-gray-400">{timeAgo(call.created_at)}</span>
                      <div>
                        {call.recording_url && (
                          <a
                            href={call.recording_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            Play
                          </a>
                        )}
                      </div>
                      <div className="flex justify-end">
                        {expandedCall === call.id
                          ? <ChevronUp size={14} className="text-gray-400" />
                          : <ChevronDown size={14} className="text-gray-400" />
                        }
                      </div>
                    </div>

                    {expandedCall === call.id && call.ai_summary && (
                      <div className="px-6 pb-4">
                        <div className="ml-9 p-3 rounded-lg bg-gray-50 border border-gray-100">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
                            AI Summary
                          </p>
                          <p className="text-sm text-gray-700">{call.ai_summary}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Scripts & Voice */}
        {activeTab === "scripts" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Script Editor */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900"
                  style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                  Script Editor
                </h2>
                <div className="flex gap-1">
                  {(["intro", "followup", "win_back"] as ScriptType[]).map(t => (
                    <button
                      key={t}
                      onClick={() => setActiveScript(t)}
                      className={`h-7 px-3 rounded-lg text-[11px] font-semibold transition-colors ${
                        activeScript === t
                          ? "text-white"
                          : "text-gray-500 hover:bg-gray-100"
                      }`}
                      style={activeScript === t ? { background: "#0B1728" } : {}}
                    >
                      {t === "intro" ? "Intro" : t === "followup" ? "Follow-Up" : "Win-Back"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-6">
                <textarea
                  value={scripts[activeScript]}
                  onChange={e => setScripts(prev => ({ ...prev, [activeScript]: e.target.value }))}
                  rows={6}
                  className="w-full p-3 rounded-lg border border-gray-200 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:border-transparent leading-relaxed"
                  style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}
                  placeholder="Enter the call script for this scenario…"
                />
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-gray-400">
                    {scripts[activeScript].length} characters · ~{Math.ceil(scripts[activeScript].split(" ").length / 150)} min read
                  </span>
                  <button
                    onClick={handleSaveScript}
                    className="h-8 px-4 rounded-lg text-xs font-semibold text-white flex items-center gap-2 transition-colors"
                    style={{ background: scriptSaved ? "#059669" : "#0B1728" }}
                  >
                    {scriptSaved ? <><Check size={12} /> Saved</> : "Save Script"}
                  </button>
                </div>
              </div>
            </div>

            {/* Voice Profile */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
                <Sliders size={15} className="text-gray-400" />
                <h2 className="font-semibold text-gray-900"
                  style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                  Voice Profile
                </h2>
                <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: "#EEF2FF", color: "#6B7EFF", fontFamily: "'IBM Plex Mono', monospace" }}>
                  ElevenLabs
                </span>
              </div>
              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Voice ID
                    <span className="ml-2 text-[10px] text-gray-400 font-normal">from elevenlabs.io/app/voice-library</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={voiceId}
                      onChange={e => setVoiceId(e.target.value)}
                      className="flex-1 h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                      style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px" }}
                      placeholder="21m00Tcm4TlvDq8ikWAM"
                    />
                    <a
                      href="https://elevenlabs.io/app/voice-library"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-9 px-3 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 flex items-center hover:bg-gray-50 transition-colors whitespace-nowrap"
                    >
                      Browse
                    </a>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-gray-600">Speed</label>
                    <span className="text-xs font-bold text-gray-900"
                      style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                      {speed.toFixed(2)}×
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.8}
                    max={1.2}
                    step={0.05}
                    value={speed}
                    onChange={e => setSpeed(parseFloat(e.target.value))}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-[#0B7285]"
                  />
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-gray-400">0.8× (slower)</span>
                    <span className="text-[10px] text-gray-400">1.2× (faster)</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Pitch Notes
                    <span className="ml-2 text-[10px] text-gray-400 font-normal">guidance for voice tuning</span>
                  </label>
                  <textarea
                    value={pitchNotes}
                    onChange={e => setPitchNotes(e.target.value)}
                    rows={3}
                    className="w-full p-3 rounded-lg border border-gray-200 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:border-transparent"
                    placeholder="Describe the desired tone and delivery style…"
                  />
                </div>

                <div className="pt-1 p-3 rounded-lg border border-dashed border-gray-200 bg-gray-50">
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    <span className="font-semibold text-gray-700">Configure:</span> Set{" "}
                    <code className="text-[10px] bg-gray-200 rounded px-1">ELEVENLABS_API_KEY</code> and{" "}
                    <code className="text-[10px] bg-gray-200 rounded px-1">TWILIO_ACCOUNT_SID</code> in Vercel env vars to enable live calls.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── Initiate Call Modal ──────────────────────────────────────────── */}
      {showInitiate && <InitiateCallModal onClose={() => { setShowInitiate(false); fetchCalls() }} />}
    </div>
  )
}
