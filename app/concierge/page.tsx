"use client"

import { useState } from "react"
import {
  Mail, Star, Clock, CheckCircle2, AlertTriangle,
  Send, FileText, RefreshCw, Bell,
} from "lucide-react"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { ThumbsUp, TrendingUp, Calendar, DollarSign, X } = require("lucide-react") as any

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "qbr" | "nps" | "renewals" | "incidents"

interface Property {
  id: string
  name: string
  units: number
  contractEnd: string
  lastQBR: string
  npsScore: number
  mrr: number
}

interface NPSResponse {
  id: string
  property: string
  tech: string
  workOrder: string
  score: number
  text: string
  date: string
}

interface Renewal {
  id: string
  property: string
  contractEnd: string
  mrr: number
  daysLeft: number
}

interface Incident {
  id: string
  property: string
  type: string
  reportedDate: string
  resolvedDate: string
  followUpStatus: "Not Sent" | "Sent" | "Responded"
}

// ─── Demo Data ────────────────────────────────────────────────────────────────

const DEMO_PROPERTIES: Property[] = [
  { id: "1", name: "Sunset Commons",       units: 48,  contractEnd: "2026-09-15", lastQBR: "2026-02-10", npsScore: 4.2, mrr: 2880 },
  { id: "2", name: "Riverview Apartments", units: 92,  contractEnd: "2026-07-01", lastQBR: "2026-01-22", npsScore: 3.8, mrr: 5520 },
  { id: "3", name: "Oakwood Estates",      units: 156, contractEnd: "2026-12-20", lastQBR: "2026-03-05", npsScore: 4.7, mrr: 9360 },
]

const DEMO_NPS: NPSResponse[] = [
  { id: "1", property: "Sunset Commons",      tech: "Marcus T.",  workOrder: "WO-2041", score: 5, text: "Gate was back up same day. Marcus knew exactly what the issue was. Couldn't be happier.", date: "2026-05-24" },
  { id: "2", property: "Riverview Apts",      tech: "Jordan L.",  workOrder: "WO-2039", score: 2, text: "Took 3 days to show up and the gate is still sticking. Not great.", date: "2026-05-23" },
  { id: "3", property: "Oakwood Estates",     tech: "Sam K.",     workOrder: "WO-2037", score: 5, text: "Professional, fast, and explained everything. Best service call we've had.", date: "2026-05-22" },
  { id: "4", property: "The Reserve at 5th", tech: "Alex R.",    workOrder: "WO-2035", score: 3, text: "Fixed the issue but had to reschedule twice. Communication could be better.", date: "2026-05-21" },
  { id: "5", property: "Lakeview Commons",    tech: "Taylor M.", workOrder: "WO-2033", score: 1, text: "Gate is still broken. Tech came out, said parts are on order. No update since.", date: "2026-05-20" },
]

const DEMO_RENEWALS: Renewal[] = [
  { id: "1", property: "Riverview Apartments", contractEnd: "2026-07-01", mrr: 5520, daysLeft: 37 },
  { id: "2", property: "Parkview HOA",          contractEnd: "2026-07-18", mrr: 3240, daysLeft: 54 },
  { id: "3", property: "The Reserve at 5th",    contractEnd: "2026-08-02", mrr: 7800, daysLeft: 69 },
  { id: "4", property: "Sunset Commons",        contractEnd: "2026-09-15", mrr: 2880, daysLeft: 113 },
]

const DEMO_INCIDENTS: Incident[] = [
  { id: "1", property: "Riverview Apartments", type: "Gate Power Failure",   reportedDate: "2026-05-20", resolvedDate: "2026-05-21", followUpStatus: "Not Sent" },
  { id: "2", property: "Sunset Commons",       type: "Camera Offline (3)",   reportedDate: "2026-05-18", resolvedDate: "2026-05-19", followUpStatus: "Sent" },
  { id: "3", property: "Oakwood Estates",      type: "Access Card Lockout",  reportedDate: "2026-05-15", resolvedDate: "2026-05-15", followUpStatus: "Responded" },
  { id: "4", property: "Lakeview Commons",     type: "Intercom Audio Fault", reportedDate: "2026-05-14", resolvedDate: "2026-05-17", followUpStatus: "Not Sent" },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StarRating({ score }: { score: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`w-4 h-4 ${i <= score ? "fill-amber-400 text-amber-400" : "text-gray-300"}`} />
      ))}
    </div>
  )
}

function scoreColor(score: number) {
  if (score >= 4) return "text-emerald-600 bg-emerald-50"
  if (score === 3) return "text-amber-600 bg-amber-50"
  return "text-red-600 bg-red-50"
}

function urgencyStyle(days: number) {
  if (days <= 30) return { border: "border-red-200 bg-red-50/60",    badge: "bg-red-100 text-red-700",    label: "Critical" }
  if (days <= 60) return { border: "border-amber-200 bg-amber-50/60", badge: "bg-amber-100 text-amber-700", label: "Soon" }
  return           { border: "border-blue-200 bg-blue-50/60",   badge: "bg-blue-100 text-blue-700",   label: "Upcoming" }
}

function followUpBadge(status: Incident["followUpStatus"]) {
  if (status === "Responded") return "bg-emerald-100 text-emerald-700"
  if (status === "Sent")      return "bg-blue-100 text-blue-700"
  return "bg-gray-100 text-gray-600"
}

// ─── QBR Slide-Over ───────────────────────────────────────────────────────────

function QBRSlideOver({ property, onClose }: { property: Property; onClose: () => void }) {
  const [sent, setSent] = useState(false)
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-xl bg-white shadow-2xl flex flex-col overflow-hidden">
        <div className="bg-[#0B1728] px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-teal-400 text-xs font-mono uppercase tracking-widest mb-0.5">QBR Draft</p>
            <h2 className="text-white font-semibold text-lg">{property.name}</h2>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Period</p>
            <p className="text-sm text-gray-800">Q1–Q2 2026 · Prepared by CONCIERGE v1.1</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { val: "99.2%", label: "Gate Uptime",     color: "text-emerald-600" },
              { val: "2.4h",  label: "Avg Response",    color: "text-blue-600" },
              { val: "14",    label: "Issues Resolved", color: "text-purple-600" },
            ].map((k) => (
              <div key={k.label} className="rounded-xl border border-gray-200 p-3 text-center">
                <p className={`text-2xl font-bold ${k.color}`}>{k.val}</p>
                <p className="text-xs text-gray-500 mt-0.5">{k.label}</p>
              </div>
            ))}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
              <ThumbsUp className="w-4 h-4 text-emerald-500" /> What Went Well
            </p>
            <ul className="space-y-1.5">
              {[
                "Gate uptime exceeded 99% — zero resident-impacting outages lasting more than 30 minutes",
                `All ${property.units} resident credentials verified and synced with Brivo — zero access lockouts reported`,
                "Camera system detected and flagged 3 unauthorized tailgating events, supporting lease enforcement",
              ].map((item, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-amber-500" /> Opportunities
            </p>
            <ul className="space-y-1.5">
              {[
                "Visitor management module could reduce front-desk calls by ~40% — demo available",
                "Loop detector replacement recommended before peak summer traffic season",
              ].map((item, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-700">
                  <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-0.5">Property NPS</p>
              <p className="text-2xl font-bold text-gray-900">{property.npsScore.toFixed(1)} / 5</p>
            </div>
            <StarRating score={Math.round(property.npsScore)} />
          </div>
        </div>
        <div className="border-t border-gray-200 px-6 py-4 flex gap-3">
          {sent ? (
            <div className="flex items-center gap-2 text-emerald-600 font-medium text-sm">
              <CheckCircle2 className="w-5 h-5" /> Sent to property manager
            </div>
          ) : (
            <>
              <button
                onClick={() => setSent(true)}
                className="flex-1 bg-[#6B7EFF] text-white rounded-lg py-2 text-sm font-medium hover:bg-[#5a6de8] flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" /> Send to Property Manager
              </button>
              <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_] = useState(() => { setTimeout(onDone, 3000); return null })
  return (
    <div className="fixed bottom-6 right-6 z-50 bg-[#0B1728] text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm font-medium">
      <CheckCircle2 className="w-4 h-4 text-teal-400" /> {message}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ConciergePage() {
  const [tab, setTab] = useState<Tab>("qbr")
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const [qbrProperty, setQbrProperty] = useState<Property | null>(null)
  const [incidents, setIncidents] = useState(DEMO_INCIDENTS)
  const [toast, setToast] = useState<string | null>(null)

  function handleGenerateQBR(p: Property) {
    setGeneratingId(p.id)
    setTimeout(() => { setGeneratingId(null); setQbrProperty(p) }, 1400)
  }

  function handleIncidentFollowUp(id: string) {
    setIncidents((prev) => prev.map((i) => i.id === id ? { ...i, followUpStatus: "Sent" as const } : i))
    setToast("Follow-up email drafted and queued")
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "qbr",       label: "QBR Drafts" },
    { id: "nps",       label: "NPS Tracker" },
    { id: "renewals",  label: "Renewals" },
    { id: "incidents", label: "Incidents" },
  ]

  return (
    <div className="min-h-screen bg-[#EEF2FF]">
      {/* Header */}
      <div className="bg-[#0B1728] px-6 py-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-white text-3xl font-bold tracking-tight">CONCIERGE</h1>
                <span className="bg-teal-500 text-white text-xs font-semibold px-2.5 py-1 rounded-full">v1.1</span>
              </div>
              <p className="text-white/60 text-sm">Client Communications AI — QBRs · NPS · Renewals · Incident Follow-Up</p>
            </div>
            <div className="hidden md:flex items-center gap-2">
              <Bell className="w-5 h-5 text-white/40" />
              <span className="text-white/40 text-sm">Client Comms Agent</span>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
            {[
              { label: "QBRs Sent This Quarter", value: "7",   sub: "+3 vs last Q" },
              { label: "NPS Responses",           value: "38",  sub: "4.1 avg score" },
              { label: "Renewals Flagged",         value: "4",   sub: "Next 90 days" },
              { label: "Avg NPS Score",            value: "4.1", sub: "↑ 0.4 vs prior Q" },
            ].map((s) => (
              <div key={s.label} className="bg-white/10 rounded-xl px-4 py-3">
                <p className="text-white/50 text-xs font-medium uppercase tracking-wider mb-1">{s.label}</p>
                <p className="text-white text-2xl font-bold">{s.value}</p>
                <p className="text-teal-400 text-xs mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-xl p-1 border border-gray-200 w-fit mb-6">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t.id ? "bg-[#0B1728] text-white" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* QBR Drafts */}
        {tab === "qbr" && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Quarterly Business Review Drafts</h2>
              <p className="text-sm text-gray-500 mt-0.5">CONCIERGE auto-generates QBR reports from live WO, camera, and NPS data</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {["Property", "Units", "Contract End", "Last QBR", "NPS Score", "Action"].map((h) => (
                      <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DEMO_PROPERTIES.map((p) => (
                    <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{p.name}</td>
                      <td className="px-6 py-4 text-gray-600">{p.units}</td>
                      <td className="px-6 py-4 text-gray-600">{p.contractEnd}</td>
                      <td className="px-6 py-4 text-gray-600">{p.lastQBR}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${scoreColor(p.npsScore)}`}>
                          <Star className="w-3 h-3 fill-current" /> {p.npsScore.toFixed(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleGenerateQBR(p)}
                          disabled={generatingId === p.id}
                          className="flex items-center gap-1.5 bg-[#0B1728] text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-[#152236] disabled:opacity-60 min-w-[130px] justify-center"
                        >
                          {generatingId === p.id ? (
                            <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Generating…</>
                          ) : (
                            <><FileText className="w-3.5 h-3.5" /> Generate QBR</>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* NPS Tracker */}
        {tab === "nps" && (
          <div className="space-y-3">
            {DEMO_NPS.map((r) => {
              const colorClass =
                r.score >= 4 ? "border-emerald-200 bg-emerald-50/40"
                : r.score === 3 ? "border-amber-200 bg-amber-50/40"
                : "border-red-200 bg-red-50/40"
              return (
                <div key={r.id} className={`rounded-2xl border p-5 ${colorClass}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900 text-sm">{r.property}</span>
                        <span className="text-xs text-gray-500">· Tech: {r.tech} · {r.workOrder}</span>
                        <span className="text-xs text-gray-400">{r.date}</span>
                      </div>
                      <StarRating score={r.score} />
                      <p className="text-sm text-gray-700 mt-2 italic">"{r.text}"</p>
                    </div>
                    {r.score <= 3 && (
                      <button
                        onClick={() => setToast(`Follow-up queued for ${r.property}`)}
                        className="shrink-0 flex items-center gap-1.5 bg-[#0B1728] text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-[#152236]"
                      >
                        <Send className="w-3.5 h-3.5" /> Send Follow-Up
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Renewals */}
        {tab === "renewals" && (
          <div className="space-y-3">
            {DEMO_RENEWALS.map((r) => {
              const u = urgencyStyle(r.daysLeft)
              return (
                <div key={r.id} className={`rounded-2xl border p-5 ${u.border}`}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900">{r.property}</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${u.badge}`}>{u.label}</span>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Expires {r.contractEnd}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {r.daysLeft} days left</span>
                        <span className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" /> ${r.mrr.toLocaleString()}/mo MRR</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setToast("Renewal email drafted and queued")}
                      className="shrink-0 flex items-center gap-1.5 bg-[#0B1728] text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-[#152236]"
                    >
                      <Mail className="w-3.5 h-3.5" /> Draft Renewal Email
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Incidents */}
        {tab === "incidents" && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Incident Follow-Up Communications</h2>
              <p className="text-sm text-gray-500 mt-0.5">CONCIERGE drafts post-incident messages to property managers</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {["Property", "Incident Type", "Reported", "Resolved", "Follow-Up Status", "Action"].map((h) => (
                      <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {incidents.map((inc) => (
                    <tr key={inc.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{inc.property}</td>
                      <td className="px-6 py-4 text-gray-700">{inc.type}</td>
                      <td className="px-6 py-4 text-gray-600">{inc.reportedDate}</td>
                      <td className="px-6 py-4 text-gray-600">{inc.resolvedDate}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${followUpBadge(inc.followUpStatus)}`}>
                          {inc.followUpStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {inc.followUpStatus === "Not Sent" ? (
                          <button
                            onClick={() => handleIncidentFollowUp(inc.id)}
                            className="flex items-center gap-1.5 bg-[#0B1728] text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-[#152236]"
                          >
                            <Send className="w-3.5 h-3.5" /> Send Follow-Up
                          </button>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {qbrProperty && <QBRSlideOver property={qbrProperty} onClose={() => setQbrProperty(null)} />}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  )
}
