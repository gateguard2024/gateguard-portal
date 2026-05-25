"use client"

import { useState } from "react"
import {
  Package, CheckCircle2, AlertTriangle, Zap,
  ChevronDown, Users, FileText, RefreshCw, Check,
} from "lucide-react"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { DollarSign, BarChart3, Hammer, TrendingUp, Shield, Star, Toggle, SlidersHorizontal } = require("lucide-react") as any

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "builder" | "margin" | "packages"

interface MarginRule {
  id: string
  name: string
  description: string
  enabled: boolean
  threshold: string
  thresholdLabel: string
  thresholdUnit: string
}

interface PackageTier {
  name: string
  price: number
  period: string
  features: string[]
  recommended: boolean
  color: string
  badge?: string
}

// ─── Demo Data ────────────────────────────────────────────────────────────────

const SURVEYS = [
  { id: "s1", label: "Sunset Commons Site Survey" },
  { id: "s2", label: "Riverview Apts Survey" },
  { id: "s3", label: "New Install - Oak Street" },
]

const MOCK_QUOTES: Record<string, {
  property: string
  lineItems: { section: string; items: { desc: string; qty: number; unitPrice: number; cost: number }[] }[]
}> = {
  s1: {
    property: "Sunset Commons",
    lineItems: [
      {
        section: "Equipment",
        items: [
          { desc: "DoorKing 6050 Gate Operator",    qty: 2, unitPrice: 2200, cost: 1450 },
          { desc: "Brivo ACS300 Access Controller", qty: 1, unitPrice:  895, cost:  520 },
          { desc: "UniFi G3 Intercom (IP65)",       qty: 1, unitPrice:  420, cost:  240 },
          { desc: "Photobeam Safety Sensors (pair)", qty: 2, unitPrice:  190, cost:  110 },
        ],
      },
      {
        section: "Labor",
        items: [
          { desc: "Gate Operator Installation",  qty: 8, unitPrice: 95, cost: 95 },
          { desc: "Access Control Programming",  qty: 4, unitPrice: 95, cost: 95 },
          { desc: "Network Configuration",       qty: 2, unitPrice: 95, cost: 95 },
        ],
      },
      {
        section: "Recurring Services",
        items: [
          { desc: "Access Plan (48 units × $5/mo)", qty: 1, unitPrice: 240, cost: 0 },
          { desc: "Gate Operator Service Plan",     qty: 1, unitPrice:   0, cost: 0 },
        ],
      },
    ],
  },
  s2: {
    property: "Riverview Apts",
    lineItems: [
      {
        section: "Equipment",
        items: [
          { desc: "LiftMaster SL3000 Slide Gate", qty: 1, unitPrice: 3100, cost: 2100 },
          { desc: "Brivo ACS6100 Panel",          qty: 1, unitPrice: 1200, cost:  720 },
          { desc: "Eagle Eye B3 Camera ×4",       qty: 4, unitPrice:  380, cost:  210 },
        ],
      },
      {
        section: "Labor",
        items: [
          { desc: "Gate Installation",    qty: 10, unitPrice: 95, cost: 95 },
          { desc: "Camera Mounting + Run", qty: 6,  unitPrice: 95, cost: 95 },
        ],
      },
      {
        section: "Recurring Services",
        items: [
          { desc: "Access Plan (92 units × $5/mo)",  qty: 1, unitPrice: 460, cost: 0 },
          { desc: "Video Monitoring Fee",             qty: 1, unitPrice: 500, cost: 0 },
        ],
      },
    ],
  },
  s3: {
    property: "Oak Street — New Install",
    lineItems: [
      {
        section: "Equipment",
        items: [
          { desc: "Viking G5 Swing Gate Operator", qty: 2, unitPrice: 1850, cost: 1200 },
          { desc: "Brivo 100 Single-Door",         qty: 2, unitPrice:  490, cost:  290 },
        ],
      },
      {
        section: "Labor",
        items: [
          { desc: "Full Site Install",   qty: 12, unitPrice: 95, cost: 95 },
          { desc: "Commission + Sign-Off", qty: 2, unitPrice: 95, cost: 95 },
        ],
      },
      {
        section: "Recurring Services",
        items: [
          { desc: "Access Plan (24 units × $5/mo)", qty: 1, unitPrice: 120, cost: 0 },
        ],
      },
    ],
  },
}

const DEFAULT_RULES: MarginRule[] = [
  {
    id: "r1",
    name: "Minimum Margin Alert",
    description: "Flag any line item below the minimum margin threshold with an amber warning.",
    enabled: true,
    threshold: "20",
    thresholdLabel: "Minimum margin",
    thresholdUnit: "%",
  },
  {
    id: "r2",
    name: "Discount Cap",
    description: "Prevent discounts exceeding the cap without manager approval.",
    enabled: true,
    threshold: "15",
    thresholdLabel: "Max discount",
    thresholdUnit: "%",
  },
  {
    id: "r3",
    name: "Labor Rate Floor",
    description: "Flag any labor line item billed below the hourly floor as requiring review.",
    enabled: true,
    threshold: "85",
    thresholdLabel: "Min labor rate",
    thresholdUnit: "$/hr",
  },
  {
    id: "r4",
    name: "Bundle Bonus",
    description: "Auto-suggest the premium package when gate + cameras + access control are all present. Saves 12%.",
    enabled: true,
    threshold: "12",
    thresholdLabel: "Bundle savings",
    thresholdUnit: "%",
  },
]

const PACKAGE_TIERS: PackageTier[] = [
  {
    name: "Basic",
    price: 2490,
    period: "install + $240/mo",
    recommended: false,
    color: "border-gray-200",
    features: [
      "1 gate operator (slide or swing)",
      "Brivo 100 single-door controller",
      "Basic mobile access (50 credentials)",
      "GateGuard portal access",
      "Email support",
    ],
  },
  {
    name: "Standard",
    price: 4890,
    period: "install + $460/mo",
    recommended: true,
    badge: "FORGE Recommended",
    color: "border-[#6B7EFF] ring-2 ring-[#6B7EFF]/20",
    features: [
      "2 gate operators + safety sensors",
      "Brivo ACS300 multi-door controller",
      "UniFi G3 intercom with video",
      "Unlimited mobile credentials",
      "GateGuard portal + client dashboard",
      "Gate Operator Service Plan (included)",
      "Priority phone + chat support",
    ],
  },
  {
    name: "Premium",
    price: 8990,
    period: "install + $960/mo",
    recommended: false,
    color: "border-gray-200",
    features: [
      "Up to 4 gate operators",
      "Brivo ACS6100 enterprise panel",
      "Eagle Eye camera system (4 cams)",
      "LPR-ready gate triggers",
      "UniFi network infrastructure",
      "Video Monitoring ($500/mo flat)",
      "ARIA lead intel access",
      "Dedicated account manager",
    ],
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function marginPct(unitPrice: number, cost: number) {
  if (unitPrice === 0) return null
  return Math.round(((unitPrice - cost) / unitPrice) * 100)
}

// ─── Quote Preview ────────────────────────────────────────────────────────────

function QuotePreview({ surveyId }: { surveyId: string }) {
  const q = MOCK_QUOTES[surveyId]
  if (!q) return null

  const allItems = q.lineItems.flatMap((s) => s.items)
  const subtotal = allItems.reduce((sum, i) => sum + i.qty * i.unitPrice, 0)
  const totalCost = allItems.reduce((sum, i) => sum + i.qty * i.cost, 0)
  const margin = subtotal > 0 ? Math.round(((subtotal - totalCost) / subtotal) * 100) : 0

  return (
    <div className="space-y-4">
      {/* Quote header */}
      <div className="bg-[#0B1728] rounded-xl p-4 flex items-start justify-between">
        <div>
          <p className="text-teal-400 text-xs font-mono uppercase tracking-widest mb-0.5">Quote Draft</p>
          <h3 className="text-white font-bold text-lg">{q.property}</h3>
          <p className="text-white/50 text-xs mt-0.5">Prepared by FORGE v1.1 · {new Date().toLocaleDateString()}</p>
        </div>
        <span className="bg-orange-500 text-white text-xs font-semibold px-2.5 py-1 rounded-full">AI Generated</span>
      </div>

      {/* Line items */}
      {q.lineItems.map((section) => (
        <div key={section.section} className="rounded-xl border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider">{section.section}</p>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {section.items.map((item, i) => {
                const m = marginPct(item.unitPrice, item.cost)
                const low = m !== null && m < 20
                return (
                  <tr key={i} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-2.5 text-gray-800 flex items-center gap-1.5">
                      {low && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                      {item.desc}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 text-right">{item.qty}×</td>
                    <td className="px-4 py-2.5 text-gray-800 text-right font-medium">
                      {item.unitPrice === 0 ? "Included" : `$${item.unitPrice.toLocaleString()}`}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}

      {/* Totals */}
      <div className="rounded-xl border border-gray-200 p-4 space-y-2">
        <div className="flex justify-between text-sm text-gray-600"><span>Subtotal</span><span>${subtotal.toLocaleString()}</span></div>
        <div className="flex justify-between text-sm text-gray-600"><span>Tax (8.25%)</span><span>${Math.round(subtotal * 0.0825).toLocaleString()}</span></div>
        <div className="border-t border-gray-200 mt-2 pt-2 flex justify-between font-bold text-gray-900">
          <span>Total</span>
          <span>${Math.round(subtotal * 1.0825).toLocaleString()}</span>
        </div>
      </div>

      {/* Margin bar */}
      <div className="rounded-xl border border-gray-200 p-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="font-medium text-gray-700 flex items-center gap-1.5">
            <BarChart3 className="w-4 h-4 text-[#6B7EFF]" /> Margin Analysis
          </span>
          <span className={`font-bold text-sm ${margin >= 30 ? "text-emerald-600" : margin >= 20 ? "text-amber-600" : "text-red-600"}`}>
            {margin}% overall
          </span>
        </div>
        <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
          <div
            className={`h-full rounded-full ${margin >= 30 ? "bg-emerald-500" : margin >= 20 ? "bg-amber-400" : "bg-red-500"}`}
            style={{ width: `${Math.min(margin, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>Cost: ${totalCost.toLocaleString()}</span>
          <span>Sell: ${subtotal.toLocaleString()}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ForgePage() {
  const [tab, setTab] = useState<Tab>("builder")
  const [selectedSurvey, setSelectedSurvey] = useState("")
  const [generating, setGenerating] = useState(false)
  const [generatedSurveyId, setGeneratedSurveyId] = useState<string | null>(null)
  const [rules, setRules] = useState<MarginRule[]>(DEFAULT_RULES)
  const [thresholds, setThresholds] = useState<Record<string, string>>(
    Object.fromEntries(DEFAULT_RULES.map((r) => [r.id, r.threshold]))
  )

  // Manual build state
  const [manualProperty, setManualProperty] = useState("")
  const [manualGates, setManualGates] = useState("1")
  const [manualCameras, setManualCameras] = useState("0")
  const [manualUnits, setManualUnits] = useState("24")
  const [manualGenerated, setManualGenerated] = useState(false)
  const [manualGenerating, setManualGenerating] = useState(false)

  function handleGenerate() {
    if (!selectedSurvey) return
    setGenerating(true)
    setGeneratedSurveyId(null)
    setTimeout(() => {
      setGenerating(false)
      setGeneratedSurveyId(selectedSurvey)
    }, 1500)
  }

  function handleManualGenerate() {
    if (!manualProperty) return
    setManualGenerating(true)
    setTimeout(() => { setManualGenerating(false); setManualGenerated(true) }, 1500)
  }

  function toggleRule(id: string) {
    setRules((prev) => prev.map((r) => r.id === id ? { ...r, enabled: !r.enabled } : r))
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "builder",  label: "Quote Builder" },
    { id: "margin",   label: "Margin Guard" },
    { id: "packages", label: "Package Suggestions" },
  ]

  const stats = [
    { label: "Quotes Generated",  value: "143", sub: "This quarter" },
    { label: "Avg Margin %",       value: "34%",  sub: "vs 28% industry" },
    { label: "Quotes Accepted",    value: "89",   sub: "62% win rate" },
    { label: "Revenue Pipeline",   value: "$2.1M", sub: "open quotes" },
  ]

  return (
    <div className="min-h-screen bg-[#EEF2FF]">
      {/* Header */}
      <div className="bg-[#0B1728] px-6 py-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-white text-3xl font-bold tracking-tight">FORGE</h1>
                <span className="bg-orange-500 text-white text-xs font-semibold px-2.5 py-1 rounded-full">v1.1</span>
              </div>
              <p className="text-white/60 text-sm">AI Quote Builder — Survey-to-Quote · Margin Guard · Package Optimizer</p>
            </div>
            <div className="hidden md:flex items-center gap-2">
              <Hammer className="w-5 h-5 text-white/40" />
              <span className="text-white/40 text-sm">Quote Builder Agent</span>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
            {stats.map((s) => (
              <div key={s.label} className="bg-white/10 rounded-xl px-4 py-3">
                <p className="text-white/50 text-xs font-medium uppercase tracking-wider mb-1">{s.label}</p>
                <p className="text-white text-2xl font-bold">{s.value}</p>
                <p className="text-orange-400 text-xs mt-0.5">{s.sub}</p>
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

        {/* Quote Builder */}
        {tab === "builder" && (
          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
            {/* Left panel */}
            <div className="space-y-4">
              {/* Survey picker */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#6B7EFF]" /> Build from Survey
                </h3>
                <p className="text-xs text-gray-500 mb-3">Pull a site survey and FORGE auto-generates a quote with AI-optimized line items and margin analysis.</p>
                <div className="relative mb-3">
                  <select
                    value={selectedSurvey}
                    onChange={(e) => { setSelectedSurvey(e.target.value); setGeneratedSurveyId(null) }}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 appearance-none bg-white pr-8 focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]"
                  >
                    <option value="">Select a survey…</option>
                    {SURVEYS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                  <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={!selectedSurvey || generating}
                  className="w-full bg-[#0B1728] text-white rounded-lg py-2 text-sm font-medium hover:bg-[#152236] disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {generating ? <><RefreshCw className="w-4 h-4 animate-spin" /> Generating…</> : <><Zap className="w-4 h-4" /> Generate Quote</>}
                </button>
              </div>

              {/* Manual build */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-orange-500" /> Manual Build
                </h3>
                <p className="text-xs text-gray-500 mb-3">Enter property details and FORGE estimates equipment, labor, and recurring costs.</p>
                <div className="space-y-2.5">
                  {[
                    { label: "Property Name", value: manualProperty, setter: setManualProperty, placeholder: "e.g. Oak Street Apts" },
                  ].map((f) => (
                    <div key={f.label}>
                      <label className="block text-xs text-gray-500 mb-1">{f.label}</label>
                      <input
                        type="text"
                        value={f.value}
                        onChange={(e) => f.setter(e.target.value)}
                        placeholder={f.placeholder}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]"
                      />
                    </div>
                  ))}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Gates",   value: manualGates,   setter: setManualGates },
                      { label: "Cameras", value: manualCameras, setter: setManualCameras },
                      { label: "Units",   value: manualUnits,   setter: setManualUnits },
                    ].map((f) => (
                      <div key={f.label}>
                        <label className="block text-xs text-gray-500 mb-1">{f.label}</label>
                        <input
                          type="number"
                          min="0"
                          value={f.value}
                          onChange={(e) => f.setter(e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]"
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={handleManualGenerate}
                    disabled={!manualProperty || manualGenerating}
                    className="w-full bg-orange-500 text-white rounded-lg py-2 text-sm font-medium hover:bg-orange-600 disabled:opacity-40 flex items-center justify-center gap-2 mt-1"
                  >
                    {manualGenerating ? <><RefreshCw className="w-4 h-4 animate-spin" /> Estimating…</> : <><Zap className="w-4 h-4" /> Build Estimate</>}
                  </button>
                </div>
              </div>
            </div>

            {/* Right panel — quote preview */}
            <div>
              {!generatedSurveyId && !manualGenerated && (
                <div className="bg-white rounded-2xl border border-dashed border-gray-300 flex flex-col items-center justify-center py-20 text-center">
                  <Package className="w-10 h-10 text-gray-300 mb-3" />
                  <p className="font-medium text-gray-500">Select a survey or fill in property details</p>
                  <p className="text-sm text-gray-400 mt-1">FORGE will generate a quote with margin analysis</p>
                </div>
              )}
              {generatedSurveyId && <QuotePreview surveyId={generatedSurveyId} />}
              {manualGenerated && !generatedSurveyId && (
                <div className="space-y-4">
                  <div className="bg-[#0B1728] rounded-xl p-4">
                    <p className="text-teal-400 text-xs font-mono uppercase tracking-widest mb-0.5">Estimate Draft</p>
                    <h3 className="text-white font-bold text-lg">{manualProperty}</h3>
                    <p className="text-white/50 text-xs mt-0.5">Prepared by FORGE v1.1 · {new Date().toLocaleDateString()}</p>
                  </div>
                  <div className="rounded-xl border border-gray-200 p-4 text-sm text-gray-700 space-y-2">
                    <div className="flex justify-between"><span className="text-gray-500">Gate operators ({manualGates})</span><span className="font-medium">${(parseInt(manualGates || "0") * 2200).toLocaleString()}</span></div>
                    {parseInt(manualCameras || "0") > 0 && <div className="flex justify-between"><span className="text-gray-500">Cameras ({manualCameras})</span><span className="font-medium">${(parseInt(manualCameras) * 380).toLocaleString()}</span></div>}
                    <div className="flex justify-between"><span className="text-gray-500">Access controller</span><span className="font-medium">$895</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Labor (est.)</span><span className="font-medium">${(parseInt(manualGates || "0") * 8 * 95).toLocaleString()}</span></div>
                    <div className="border-t border-gray-200 pt-2 flex justify-between font-bold text-gray-900">
                      <span>Est. Install Total</span>
                      <span>${(parseInt(manualGates || "0") * 2200 + parseInt(manualCameras || "0") * 380 + 895 + parseInt(manualGates || "0") * 8 * 95).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-emerald-600"><span>Recurring (Access Plan)</span><span>${(parseInt(manualUnits || "0") * 5).toLocaleString()}/mo</span></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Margin Guard */}
        {tab === "margin" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 px-6 py-4 mb-2">
              <h2 className="font-semibold text-gray-900">Margin Guard Rules</h2>
              <p className="text-sm text-gray-500 mt-0.5">These rules apply to every quote FORGE generates. Toggle rules on/off or adjust thresholds.</p>
            </div>
            {rules.map((rule) => (
              <div key={rule.id} className={`bg-white rounded-2xl border p-5 ${rule.enabled ? "border-gray-200" : "border-gray-100 opacity-60"}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {rule.id === "r1" && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                      {rule.id === "r2" && <Shield className="w-4 h-4 text-blue-500" />}
                      {rule.id === "r3" && <Hammer className="w-4 h-4 text-orange-500" />}
                      {rule.id === "r4" && <Star className="w-4 h-4 text-purple-500" />}
                      <span className="font-semibold text-gray-900">{rule.name}</span>
                    </div>
                    <p className="text-sm text-gray-600">{rule.description}</p>
                    <div className="mt-3 flex items-center gap-2">
                      <label className="text-xs text-gray-500">{rule.thresholdLabel}</label>
                      <input
                        type="number"
                        value={thresholds[rule.id]}
                        onChange={(e) => setThresholds((prev) => ({ ...prev, [rule.id]: e.target.value }))}
                        className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]"
                      />
                      <span className="text-xs text-gray-400">{rule.thresholdUnit}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleRule(rule.id)}
                    className={`shrink-0 w-12 h-6 rounded-full transition-colors relative ${rule.enabled ? "bg-[#6B7EFF]" : "bg-gray-200"}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${rule.enabled ? "translate-x-6" : "translate-x-0.5"}`} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Package Suggestions */}
        {tab === "packages" && (
          <div className="space-y-6">
            {/* Input */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-900 mb-3">Property Profile</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Property Type</label>
                  <div className="relative">
                    <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]">
                      <option>Multifamily</option>
                      <option>HOA</option>
                      <option>Commercial</option>
                      <option>Mixed-Use</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Unit Count</label>
                  <input type="range" min="10" max="500" defaultValue="92" className="w-full mt-2 accent-[#6B7EFF]" />
                  <p className="text-xs text-gray-400 mt-0.5">92 units</p>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-2">Existing Services</label>
                  <div className="space-y-1">
                    {["Has DirecTV", "Has Cameras", "Has Gate", "Has Access Control"].map((s) => (
                      <label key={s} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input type="checkbox" className="accent-[#6B7EFF]" />
                        {s}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <button className="mt-4 bg-orange-500 text-white rounded-lg px-5 py-2 text-sm font-medium hover:bg-orange-600 flex items-center gap-2">
                <Zap className="w-4 h-4" /> Get Recommendation
              </button>
            </div>

            {/* Package cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {PACKAGE_TIERS.map((pkg) => (
                <div key={pkg.name} className={`bg-white rounded-2xl border p-5 relative ${pkg.color}`}>
                  {pkg.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-[#6B7EFF] text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">{pkg.badge}</span>
                    </div>
                  )}
                  <div className="mt-2">
                    <p className="font-bold text-gray-900 text-lg">{pkg.name}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      ${pkg.price.toLocaleString()}
                      <span className="text-sm font-normal text-gray-500 ml-1">{pkg.period}</span>
                    </p>
                  </div>
                  <ul className="mt-4 space-y-2">
                    {pkg.features.map((f, i) => (
                      <li key={i} className="flex gap-2 text-sm text-gray-700">
                        <CheckCircle2 className={`w-4 h-4 mt-0.5 shrink-0 ${pkg.recommended ? "text-[#6B7EFF]" : "text-emerald-500"}`} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button className={`w-full mt-5 rounded-lg py-2 text-sm font-medium border transition-colors ${
                    pkg.recommended
                      ? "bg-[#6B7EFF] text-white border-[#6B7EFF] hover:bg-[#5a6de8]"
                      : "border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}>
                    {pkg.recommended ? "Use This Package" : "Select"}
                  </button>
                </div>
              ))}
            </div>

            <p className="text-xs text-gray-400 text-center">
              Package prices are estimates. FORGE adjusts final quote based on survey data and Margin Guard rules.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
