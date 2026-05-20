"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { cn } from "@/lib/utils"
import { EmptyState } from "@/components/ui/EmptyState"
import { SkeletonRow } from "@/components/ui/SkeletonRow"
import {
  Plus, X, Check, Clock, FileText, Download, ArrowRight,
  ChevronRight, MapPin, User, Loader2, RefreshCw,
  Trash2, AlertTriangle, CheckCircle2, Search, Upload,
  ClipboardList, Zap, Layers, Camera,
} from "lucide-react"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Mic, MicOff, Sparkles, Edit2, Save } = require("lucide-react") as any

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SurveyDevice {
  id:        string
  name:      string
  brand:     string
  model:     string
  location:  string
  condition: "Good" | "Fair" | "Poor" | ""
  action:    "Keep" | "Service" | "Replace" | "New Install" | ""
  notes:     string
  photos?:   string[]
}

interface BomItem {
  description: string
  sku:         string | null
  qty:         number
  unit:        string
  unit_price:  number
  priority:    "urgent" | "recommended" | "optional"
  category:    string
  notes:       string | null
}

interface Recommendation {
  title:    string
  detail:   string
  priority: "urgent" | "recommended" | "optional"
}

interface InstallNote {
  note: string
}

interface UrgentItem {
  item:   string
  reason: string
}

interface Survey {
  id:               string
  survey_number:    string
  property_name:    string
  property_address: string | null
  surveyor_name:    string | null
  surveyor_type:    string
  survey_date:      string
  status:           "draft" | "reviewed" | "quote_created" | "archived"
  devices:          SurveyDevice[]
  voice_transcript: string | null
  notes_raw:        string | null
  ai_summary:       string | null
  ai_sow:           string | null
  ai_bom:           BomItem[]
  ai_recommendations: Recommendation[]
  ai_urgent_items:  UrgentItem[]
  ai_install_notes: InstallNote[]
  ai_timeline:      string | null
  quote_id:         string | null
  created_at:       string
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function statusBadge(status: Survey["status"]) {
  const map: Record<Survey["status"], { cls: string; label: string }> = {
    draft:         { cls: "bg-gray-100 text-gray-600",        label: "Draft"         },
    reviewed:      { cls: "bg-blue-100 text-blue-700",        label: "Reviewed"      },
    quote_created: { cls: "bg-emerald-100 text-emerald-700",  label: "Quote Created" },
    archived:      { cls: "bg-slate-100 text-slate-500",      label: "Archived"      },
  }
  return map[status] ?? map.draft
}

function priorityColor(p: string) {
  if (p === "urgent")      return "text-red-600   bg-red-50   border-red-200"
  if (p === "recommended") return "text-blue-600  bg-blue-50  border-blue-200"
  return                          "text-gray-500  bg-gray-50  border-gray-200"
}

function conditionColor(c: string) {
  if (c === "Good")  return "bg-emerald-100 text-emerald-700"
  if (c === "Fair")  return "bg-amber-100   text-amber-700"
  if (c === "Poor")  return "bg-red-100     text-red-700"
  return                    "bg-gray-100    text-gray-500"
}

function actionColor(a: string) {
  if (a === "Keep")        return "bg-emerald-100 text-emerald-700"
  if (a === "Service")     return "bg-blue-100    text-blue-700"
  if (a === "Replace")     return "bg-amber-100   text-amber-700"
  if (a === "New Install") return "bg-purple-100  text-purple-700"
  return                          "bg-gray-100    text-gray-500"
}

const newDevice = (): SurveyDevice => ({
  id:        crypto.randomUUID(),
  name:      "",
  brand:     "",
  model:     "",
  location:  "",
  condition: "",
  action:    "",
  notes:     "",
})

// ─── New Survey Modal ──────────────────────────────────────────────────────────

interface NewSurveyModalProps {
  onClose:  () => void
  onCreate: (s: Survey) => void
}

function NewSurveyModal({ onClose, onCreate }: NewSurveyModalProps) {
  const [form, setForm] = useState({
    property_name:    "",
    property_address: "",
    surveyor_type:    "sales" as "sales" | "tech" | "admin",
    survey_date:      new Date().toISOString().slice(0, 10),
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState("")

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.property_name.trim()) { setErr("Property name is required"); return }
    setSaving(true)
    try {
      const res  = await fetch("/api/surveys", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Failed to create survey")
      onCreate(json.survey)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error")
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">New Site Survey</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>
        <form onSubmit={submit} className="px-6 py-4 space-y-4">
          {err && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
              <AlertTriangle size={12} /> {err}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Property Name *</label>
            <input
              autoFocus
              value={form.property_name}
              onChange={e => setForm(f => ({ ...f, property_name: e.target.value }))}
              placeholder="Camden Crossing Apartments"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Property Address</label>
            <input
              value={form.property_address}
              onChange={e => setForm(f => ({ ...f, property_address: e.target.value }))}
              placeholder="123 Main St, Atlanta, GA 30301"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Surveyor Type</label>
              <select
                value={form.surveyor_type}
                onChange={e => setForm(f => ({ ...f, surveyor_type: e.target.value as "sales" | "tech" | "admin" }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              >
                <option value="sales">Sales</option>
                <option value="tech">Tech</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Survey Date</label>
              <input
                type="date"
                value={form.survey_date}
                onChange={e => setForm(f => ({ ...f, survey_date: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 rounded-lg bg-[#6B7EFF] text-white text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm flex items-center justify-center gap-2">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Create Survey
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Device Card ───────────────────────────────────────────────────────────────

interface DeviceCardProps {
  device:   SurveyDevice
  onChange: (d: SurveyDevice) => void
  onDelete: () => void
}

function DeviceCard({ device, onChange, onDelete }: DeviceCardProps) {
  const [expanded, setExpanded] = useState(true)

  const isWorking    = device.condition === "Good" || device.condition === "Fair"
  const isNotWorking = device.condition === "Poor" || device.action === "Replace" || device.action === "New Install"

  function toggleWorking(setWorking: boolean) {
    if (setWorking) {
      const newAction = (device.action === "Replace" || device.action === "New Install") ? "Keep" : device.action
      onChange({ ...device, condition: "Good", action: newAction })
    } else {
      const newAction = (device.action === "Keep" || device.action === "") ? "Replace" : device.action
      onChange({ ...device, condition: "Poor", action: newAction })
    }
  }

  function handlePhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      onChange({ ...device, photos: [...(device.photos ?? []), dataUrl] })
    }
    reader.readAsDataURL(file)
    // Reset input so the same file can be selected again
    e.target.value = ""
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50/70 border-b border-gray-100">
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-2 text-left min-w-0 shrink-1 overflow-hidden"
        >
          <ChevronRight size={13} className={cn("text-gray-400 transition-transform shrink-0", expanded && "rotate-90")} />
          <span className="text-sm font-medium text-gray-900 truncate">
            {device.name || <span className="text-gray-400 font-normal">Unnamed device</span>}
          </span>
          {device.location && (
            <span className="flex items-center gap-1 text-[11px] text-gray-500 shrink-0">
              <MapPin size={10} /> {device.location}
            </span>
          )}
        </button>

        {/* Working / Not Working toggle */}
        <div className="flex items-center gap-1 ml-auto shrink-0">
          {isWorking && !isNotWorking ? (
            <button
              onClick={() => toggleWorking(false)}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 transition-colors"
              title="Click to mark as Not Working"
            >
              <Check size={9} /> Working <span className="text-emerald-500 ml-0.5">$500/mo</span>
            </button>
          ) : isNotWorking ? (
            <button
              onClick={() => toggleWorking(true)}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium bg-red-50 text-red-600 border-red-200 hover:bg-red-100 transition-colors"
              title="Click to mark as Working"
            >
              <X size={9} /> Not Working <span className="text-red-400 ml-0.5">$750/mo</span>
            </button>
          ) : (
            <button
              onClick={() => toggleWorking(true)}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200 transition-colors"
              title="Click to set status"
            >
              ? Unknown
            </button>
          )}
        </div>

        <button onClick={onDelete} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors shrink-0">
          <Trash2 size={13} />
        </button>
      </div>

      {/* Fields */}
      {expanded && (
        <div className="p-3 grid grid-cols-2 gap-2.5">
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Device / Name *</label>
            <input
              value={device.name}
              onChange={e => onChange({ ...device, name: e.target.value })}
              placeholder="Gate Operator"
              className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
            />
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Brand</label>
            <input
              value={device.brand}
              onChange={e => onChange({ ...device, brand: e.target.value })}
              placeholder="DoorKing"
              className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
            />
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Model</label>
            <input
              value={device.model}
              onChange={e => onChange({ ...device, model: e.target.value })}
              placeholder="9050"
              className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
            />
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Location</label>
            <input
              value={device.location}
              onChange={e => onChange({ ...device, location: e.target.value })}
              placeholder="Main Entrance"
              className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
            />
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Condition</label>
            <select
              value={device.condition}
              onChange={e => onChange({ ...device, condition: e.target.value as SurveyDevice["condition"] })}
              className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
            >
              <option value="">Select...</option>
              <option value="Good">Good</option>
              <option value="Fair">Fair</option>
              <option value="Poor">Poor</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Action</label>
            <select
              value={device.action}
              onChange={e => onChange({ ...device, action: e.target.value as SurveyDevice["action"] })}
              className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
            >
              <option value="">Select...</option>
              <option value="Keep">Keep</option>
              <option value="Service">Service</option>
              <option value="Replace">Replace</option>
              <option value="New Install">New Install</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-[11px] text-gray-500 mb-1">What needs to be done?</label>
            <textarea
              value={device.notes}
              onChange={e => onChange({ ...device, notes: e.target.value })}
              placeholder="Describe the work required: e.g. replace loop detector, reprogram access codes, align gate sensors, upgrade firmware..."
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 resize-none"
            />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Photos</label>
            <label className="mt-1 flex items-center gap-2 px-3 py-2 border border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 text-sm text-muted-foreground">
              <Camera size={14} />
              <span>Add photo</span>
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoCapture} />
            </label>
            {device.photos?.length ? (
              <div className="flex gap-2 mt-2 flex-wrap">
                {device.photos.map((p, i) => (
                  <img key={i} src={p} className="w-16 h-16 object-cover rounded-lg border border-border" alt={`Photo ${i+1}`} />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── BOM Table ─────────────────────────────────────────────────────────────────

interface BomTableProps {
  items:     BomItem[]
  onChange:  (items: BomItem[]) => void
}

function BomTable({ items, onChange }: BomTableProps) {
  function update(idx: number, patch: Partial<BomItem>) {
    onChange(items.map((it, i) => i === idx ? { ...it, ...patch } : it))
  }

  const total = items.reduce((s, it) => s + it.qty * it.unit_price, 0)

  if (!items.length) return null

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <ClipboardList size={14} className="text-[#6B7EFF]" />
        <h3 className="text-sm font-semibold text-gray-900">Bill of Materials</h3>
        <span className="text-[11px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium ml-1">{items.length} items</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-3 py-2 text-gray-500 font-medium w-[30%]">Description</th>
              <th className="text-left px-3 py-2 text-gray-500 font-medium w-[10%]">SKU</th>
              <th className="text-center px-3 py-2 text-gray-500 font-medium w-[8%]">Qty</th>
              <th className="text-left px-3 py-2 text-gray-500 font-medium w-[8%]">Unit</th>
              <th className="text-right px-3 py-2 text-gray-500 font-medium w-[12%]">Unit Price</th>
              <th className="text-right px-3 py-2 text-gray-500 font-medium w-[12%]">Subtotal</th>
              <th className="text-left px-3 py-2 text-gray-500 font-medium w-[12%]">Priority</th>
              <th className="px-2 py-2 w-[8%]" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {items.map((item, idx) => (
              <tr key={idx} className="hover:bg-gray-50/40 transition-colors group">
                <td className="px-3 py-2">
                  <input
                    value={item.description}
                    onChange={e => update(idx, { description: e.target.value })}
                    className="w-full bg-transparent border-b border-transparent focus:border-blue-400 focus:outline-none py-0.5 font-medium text-gray-800"
                  />
                </td>
                <td className="px-3 py-2 text-gray-500 font-mono">
                  <input
                    value={item.sku ?? ""}
                    onChange={e => update(idx, { sku: e.target.value || null })}
                    placeholder="—"
                    className="w-full bg-transparent border-b border-transparent focus:border-blue-400 focus:outline-none py-0.5"
                  />
                </td>
                <td className="px-3 py-2 text-center">
                  <input
                    type="number"
                    min={1}
                    value={item.qty}
                    onChange={e => update(idx, { qty: parseInt(e.target.value) || 1 })}
                    className="w-12 text-center bg-transparent border-b border-transparent focus:border-blue-400 focus:outline-none py-0.5 text-gray-700"
                  />
                </td>
                <td className="px-3 py-2 text-gray-600">
                  <input
                    value={item.unit}
                    onChange={e => update(idx, { unit: e.target.value })}
                    className="w-12 bg-transparent border-b border-transparent focus:border-blue-400 focus:outline-none py-0.5"
                  />
                </td>
                <td className="px-3 py-2 text-right text-gray-700">
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={item.unit_price}
                    onChange={e => update(idx, { unit_price: parseFloat(e.target.value) || 0 })}
                    className="w-20 text-right bg-transparent border-b border-transparent focus:border-blue-400 focus:outline-none py-0.5"
                  />
                </td>
                <td className="px-3 py-2 text-right font-semibold text-gray-800 tabular-nums">
                  ${(item.qty * item.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="px-3 py-2">
                  <select
                    value={item.priority}
                    onChange={e => update(idx, { priority: e.target.value as BomItem["priority"] })}
                    className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full border focus:outline-none", priorityColor(item.priority))}
                  >
                    <option value="urgent">Urgent</option>
                    <option value="recommended">Recommended</option>
                    <option value="optional">Optional</option>
                  </select>
                </td>
                <td className="px-2 py-2">
                  <button
                    onClick={() => onChange(items.filter((_, i) => i !== idx))}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-all"
                  >
                    <X size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 border-t border-gray-200">
              <td colSpan={5} className="px-3 py-2.5 text-right text-xs font-semibold text-gray-700">Total</td>
              <td className="px-3 py-2.5 text-right font-bold text-gray-900 tabular-nums text-sm">
                ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/50 flex justify-end">
        <button
          onClick={() => onChange([...items, {
            description: "New Item", sku: null, qty: 1, unit: "each",
            unit_price: 0, priority: "recommended", category: "equipment", notes: null,
          }])}
          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
        >
          <Plus size={12} /> Add row
        </button>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function SurveyPage() {
  const [surveys,        setSurveys]       = useState<Survey[]>([])
  const [loading,        setLoading]       = useState(true)
  const [selectedId,     setSelectedId]    = useState<string | null>(null)
  const [survey,         setSurvey]        = useState<Survey | null>(null)
  const [surveyLoading,  setSurveyLoading] = useState(false)
  const [showNew,        setShowNew]       = useState(false)
  const [activeTab,      setActiveTab]     = useState<"capture" | "ai">("capture")
  const [searchQ,        setSearchQ]       = useState("")
  const [statusFilter,   setStatusFilter]  = useState<"all" | Survey["status"]>("all")

  // Saving state
  const [savingNotes,    setSavingNotes]   = useState(false)
  const [generating,     setGenerating]    = useState(false)
  const [creatingQuote,  setCreatingQuote] = useState(false)
  const [savingBom,      setSavingBom]     = useState(false)
  const [parseLoading,   setParseLoading]  = useState(false)
  const [genError,       setGenError]      = useState("")
  const [quoteSuccess,   setQuoteSuccess]  = useState<string | null>(null)

  // Voice
  const [recording,      setRecording]     = useState(false)
  const [transcript,     setTranscript]    = useState("")
  const recognitionRef = useRef<unknown>(null)

  // ── Load list ──────────────────────────────────────────────────────────────

  const loadSurveys = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch("/api/surveys?limit=100")
      const json = await res.json()
      setSurveys(json.surveys ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadSurveys() }, [loadSurveys])

  // ── Load detail ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!selectedId) { setSurvey(null); return }
    setSurveyLoading(true)
    fetch(`/api/surveys/${selectedId}`)
      .then(r => r.json())
      .then(j => {
        setSurvey(j.survey ?? null)
        setTranscript(j.survey?.voice_transcript ?? "")
        if (j.survey?.ai_sow) setActiveTab("ai")
      })
      .finally(() => setSurveyLoading(false))
  }, [selectedId])

  // ── Voice recording ───────────────────────────────────────────────────────

  function toggleRecording() {
    if (recording) {
      if (recognitionRef.current) {
        (recognitionRef.current as { stop: () => void }).stop()
      }
      setRecording(false)
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) {
      alert("Voice input not supported in this browser. Please use Chrome.")
      return
    }

    const recognition = new SR()
    recognition.continuous     = true
    recognition.interimResults = true
    recognition.lang           = "en-US"

    let finalTranscript = transcript

    recognition.onresult = (e: { results: SpeechRecognitionResultList }) => {
      let interim = ""
      for (let i = e.results.length - 1; i >= 0; i--) {
        if (e.results[i].isFinal) {
          finalTranscript += (finalTranscript ? " " : "") + e.results[i][0].transcript
          break
        } else {
          interim = e.results[i][0].transcript
        }
      }
      setTranscript(finalTranscript + (interim ? " " + interim : ""))
    }

    recognition.onend = () => {
      setRecording(false)
      setTranscript(finalTranscript)
    }

    recognitionRef.current = recognition
    recognition.start()
    setRecording(true)
  }

  // ── Plaud file upload ─────────────────────────────────────────────────────

  const plaudInputRef = useRef<HTMLInputElement>(null)

  async function handlePlaudUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !survey) return
    setParseLoading(true)
    try {
      const form = new FormData()
      form.append("audio", file)
      const res  = await fetch("/api/plaud/transcribe", { method: "POST", body: form })
      const json = await res.json()
      if (json.transcript) {
        const t = json.transcript as string
        setTranscript(t)
        await patchSurvey({ voice_transcript: t })
      }
    } catch {
      alert("Transcription failed. Please paste transcript manually.")
    } finally {
      setParseLoading(false)
      if (plaudInputRef.current) plaudInputRef.current.value = ""
    }
  }

  // ── Parse transcript → devices ────────────────────────────────────────────

  async function parseTranscript() {
    if (!survey || !transcript.trim()) return
    setParseLoading(true)
    try {
      const res  = await fetch("/api/kb/parse-survey-transcript", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ transcript }),
      })
      const json = await res.json()
      if (json.devices && Array.isArray(json.devices)) {
        const condMap: Record<string, SurveyDevice["condition"]> = {
          good: "Good", fair: "Fair", poor: "Poor",
          Good: "Good", Fair: "Fair", Poor: "Poor",
        }
        const actMap: Record<string, SurveyDevice["action"]> = {
          keep: "Keep", service: "Service", replace: "Replace",
          new_install: "New Install", "new install": "New Install",
          Keep: "Keep", Service: "Service", Replace: "Replace", "New Install": "New Install",
        }
        const parsed: SurveyDevice[] = json.devices.map((d: Record<string, string>) => ({
          id:        crypto.randomUUID(),
          name:      d.name      ?? "",
          brand:     d.brand     ?? "",
          model:     d.model     ?? "",
          location:  d.location  ?? "",
          condition: condMap[d.condition] ?? "",
          action:    actMap[d.action]     ?? "",
          notes:     d.notes     ?? "",
        }))
        const merged = [...(survey.devices ?? []), ...parsed]
        setSurvey(s => s ? { ...s, devices: merged } : s)
        await patchSurvey({ devices: merged, voice_transcript: transcript })
      }
    } catch {
      alert("Failed to parse transcript.")
    } finally {
      setParseLoading(false)
    }
  }

  // ── Save helpers ──────────────────────────────────────────────────────────

  async function patchSurvey(body: Partial<Survey>) {
    if (!survey) return
    const res  = await fetch(`/api/surveys/${survey.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    })
    const json = await res.json()
    if (json.survey) {
      if ('devices' in body) {
        lastSavedDevicesRef.current = JSON.stringify(json.survey.devices ?? [])
      }
      setSurvey(json.survey)
      setSurveys(ss => ss.map(s => s.id === json.survey.id ? json.survey : s))
    }
  }

  async function saveNotes() {
    if (!survey) return
    setSavingNotes(true)
    try {
      await patchSurvey({ notes_raw: survey.notes_raw, voice_transcript: transcript, devices: survey.devices })
    } finally {
      setSavingNotes(false)
    }
  }

  function updateDevice(id: string, d: SurveyDevice) {
    if (!survey) return
    setSurvey(s => s ? { ...s, devices: s.devices.map(x => x.id === id ? d : x) } : s)
  }

  function deleteDevice(id: string) {
    if (!survey) return
    setSurvey(s => s ? { ...s, devices: s.devices.filter(x => x.id !== id) } : s)
  }

  function addDevice(preset?: Partial<SurveyDevice>) {
    if (!survey) return
    const d = { ...newDevice(), ...preset }
    setSurvey(s => s ? { ...s, devices: [...s.devices, d] } : s)
  }

  // ── Auto-save devices (debounced) ─────────────────────────────────────────
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedDevicesRef = useRef<string>("")
  const [autoSaving, setAutoSaving] = useState(false)

  useEffect(() => {
    if (!survey) return
    const current = JSON.stringify(survey.devices ?? [])
    if (current === lastSavedDevicesRef.current) return
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(async () => {
      const stillCurrent = JSON.stringify(survey.devices ?? [])
      if (stillCurrent === lastSavedDevicesRef.current) return
      setAutoSaving(true)
      try {
        await patchSurvey({ devices: survey.devices })
      } finally {
        setAutoSaving(false)
      }
    }, 1800)
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [survey?.devices])

  // ── Generate AI output ────────────────────────────────────────────────────

  async function generate() {
    if (!survey) return
    // Save current state first
    await patchSurvey({ devices: survey.devices, notes_raw: survey.notes_raw, voice_transcript: transcript })
    setGenerating(true)
    setGenError("")
    try {
      const res  = await fetch(`/api/surveys/${survey.id}/generate`, { method: "POST" })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Generation failed")
      setSurvey(json.survey)
      setSurveys(ss => ss.map(s => s.id === json.survey.id ? json.survey : s))
      setActiveTab("ai")
    } catch (e: unknown) {
      setGenError(e instanceof Error ? e.message : "Generation failed")
    } finally {
      setGenerating(false)
    }
  }

  // ── Save edited BOM ───────────────────────────────────────────────────────

  async function saveBom() {
    if (!survey) return
    setSavingBom(true)
    try {
      await patchSurvey({
        ai_bom:            survey.ai_bom,
        ai_sow:            survey.ai_sow,
        ai_summary:        survey.ai_summary,
        ai_recommendations: survey.ai_recommendations,
        ai_timeline:       survey.ai_timeline,
      })
    } finally {
      setSavingBom(false)
    }
  }

  // ── Create quote ──────────────────────────────────────────────────────────

  async function createQuote() {
    if (!survey) return
    setCreatingQuote(true)
    setQuoteSuccess(null)
    try {
      const res  = await fetch(`/api/surveys/${survey.id}/create-quote`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({}),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Failed")
      setQuoteSuccess(json.quote_number ?? json.quote_id)
      await loadSurveys()
      setSurvey(s => s ? { ...s, status: "quote_created", quote_id: json.quote_id } : s)
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to create quote")
    } finally {
      setCreatingQuote(false)
    }
  }

  // ── Filtered list ─────────────────────────────────────────────────────────

  const filtered = surveys.filter(s => {
    const matchStatus = statusFilter === "all" || s.status === statusFilter
    const matchQ      = s.property_name.toLowerCase().includes(searchQ.toLowerCase()) ||
                        (s.survey_number ?? "").toLowerCase().includes(searchQ.toLowerCase())
    return matchStatus && matchQ
  })

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC]">

      {/* Page Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Site Surveys</h1>
          <p className="text-sm text-gray-500 mt-0.5">Voice-driven field surveys → AI-generated SOW, BOM & quotes</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#6B7EFF] text-white text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus size={14} /> New Survey
        </button>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left: Survey List ── */}
        <div className="w-80 shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
          {/* Search + filter */}
          <div className="p-3 border-b border-gray-100 space-y-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                placeholder="Search surveys..."
                className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 bg-gray-50"
              />
            </div>
            <div className="flex gap-1 flex-wrap">
              {(["all", "draft", "reviewed", "quote_created", "archived"] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors capitalize",
                    statusFilter === s ? "bg-[#6B7EFF] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  )}
                >
                  {s === "all" ? "All" : s === "quote_created" ? "Quote Created" : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {loading ? (
              <SkeletonRow rows={4} cols={3} />
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={<ClipboardList size={32} className="text-muted-foreground" />}
                title="No surveys yet"
                description="Click New Survey to start a site walk"
                action={{ label: 'New Survey', onClick: () => setShowNew(true) }}
              />
            ) : (
              filtered.map(s => {
                const badge = statusBadge(s.status)
                return (
                  <button
                    key={s.id}
                    onClick={() => { setSelectedId(s.id); setActiveTab("capture"); setGenError(""); setQuoteSuccess(null) }}
                    className={cn(
                      "w-full text-left px-3 py-3 hover:bg-blue-50/40 transition-colors",
                      selectedId === s.id && "bg-blue-50 border-r-2 border-r-[#6B7EFF]"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{s.property_name}</p>
                        <p className="text-[10px] text-gray-400 font-mono mt-0.5">{s.survey_number ?? "—"}</p>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full", badge.cls)}>
                            {badge.label}
                          </span>
                          <span className="text-[10px] text-gray-400">{s.survey_date}</span>
                          {(s.devices?.length ?? 0) > 0 && (
                            <span className="text-[10px] text-gray-500">
                              {s.devices.length} device{s.devices.length !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* ── Right: Survey Detail ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!selectedId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
              <div className="w-16 h-16 rounded-2xl bg-[#6B7EFF]/10 flex items-center justify-center mb-4">
                <Mic size={28} className="text-[#6B7EFF]" />
              </div>
              <h2 className="text-lg font-semibold text-gray-800">Voice-Driven Site Surveys</h2>
              <p className="text-sm text-gray-500 mt-2 max-w-sm">
                Speak what you see. Our AI turns your site walkthrough into a professional SOW, BOM, and draft quote.
              </p>
              <button
                onClick={() => setShowNew(true)}
                className="mt-6 flex items-center gap-2 px-4 py-2 rounded-lg bg-[#6B7EFF] text-white text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
              >
                <Plus size={14} /> Start New Survey
              </button>
            </div>
          ) : surveyLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 size={24} className="animate-spin text-gray-400" />
            </div>
          ) : survey ? (
            <>
              {/* Survey Header */}
              <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3 shrink-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-semibold text-gray-900 truncate">{survey.property_name}</h2>
                    <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full", statusBadge(survey.status).cls)}>
                      {statusBadge(survey.status).label}
                    </span>
                    <span className="text-xs text-gray-400 font-mono">{survey.survey_number}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                    {survey.property_address && <span className="flex items-center gap-1"><MapPin size={10} />{survey.property_address}</span>}
                    <span className="flex items-center gap-1"><User size={10} />{survey.surveyor_name ?? "—"}</span>
                    <span>{survey.survey_date}</span>
                  </div>
                </div>
                {survey.quote_id ? (
                  <a
                    href={`/quotes/${survey.quote_id}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 transition-colors"
                  >
                    <CheckCircle2 size={12} /> View Quote
                  </a>
                ) : survey.ai_bom?.length > 0 ? (
                  <button
                    onClick={createQuote}
                    disabled={creatingQuote}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-60"
                  >
                    {creatingQuote ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
                    Create Quote
                  </button>
                ) : null}
              </div>

              {/* Quote success banner */}
              {quoteSuccess && (
                <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-2.5 flex items-center gap-2 text-sm text-emerald-700">
                  <CheckCircle2 size={14} />
                  <span>Quote <strong>{quoteSuccess}</strong> created. </span>
                  <a href={`/quotes/${survey.quote_id}`} className="underline font-medium ml-1">Open quote →</a>
                </div>
              )}

              {/* Tabs */}
              <div className="bg-white border-b border-gray-200 px-6 flex items-center gap-0 shrink-0">
                {([
                  { id: "capture", label: "Capture",  icon: Mic         },
                  { id: "ai",      label: "AI Output", icon: Sparkles    },
                ] as const).map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={cn(
                      "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                      activeTab === id
                        ? "border-[#6B7EFF] text-[#6B7EFF]"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                    )}
                  >
                    <Icon size={13} /> {label}
                    {id === "ai" && survey.ai_sow && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ml-0.5" />
                    )}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5">

                {/* ── CAPTURE TAB ── */}
                {activeTab === "capture" && (
                  <>
                    {/* Voice Input */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Mic size={15} className="text-[#6B7EFF]" />
                          <h3 className="text-sm font-semibold text-gray-900">Voice Transcript</h3>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Plaud upload */}
                          <input
                            ref={plaudInputRef}
                            type="file"
                            accept="audio/*,.m4a,.mp3,.wav,.ogg"
                            onChange={handlePlaudUpload}
                            className="hidden"
                          />
                          <button
                            onClick={() => plaudInputRef.current?.click()}
                            disabled={parseLoading}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                          >
                            <Upload size={11} /> Upload Plaud
                          </button>

                          {/* Live mic */}
                          <button
                            onClick={toggleRecording}
                            className={cn(
                              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                              recording
                                ? "bg-red-600 text-white hover:bg-red-700"
                                : "bg-[#6B7EFF] text-white hover:bg-blue-700"
                            )}
                          >
                            {recording ? (
                              <><MicOff size={11} /> Stop</>
                            ) : (
                              <><Mic size={11} /> Dictate</>
                            )}
                          </button>
                        </div>
                      </div>

                      {recording && (
                        <div className="flex items-center gap-2 text-xs text-red-600 font-medium mb-2 animate-pulse">
                          <span className="w-2 h-2 rounded-full bg-red-500" />
                          Recording... speak clearly about what you see on site
                        </div>
                      )}

                      <textarea
                        value={transcript}
                        onChange={e => setTranscript(e.target.value)}
                        placeholder="Speak what you see, or type observations here. Example: 'Main entrance has a DoorKing 9050 gate operator in fair condition, needs new loop detector. Building A has 4 cameras, one is offline...'"
                        rows={6}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none text-gray-700 leading-relaxed"
                      />

                      <div className="flex items-center gap-2 mt-3">
                        <button
                          onClick={parseTranscript}
                          disabled={parseLoading || !transcript.trim()}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                        >
                          {parseLoading ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
                          Extract Devices from Transcript
                        </button>
                        <span className="text-xs text-gray-400">AI parses your notes into device cards</span>
                      </div>
                    </div>

                    {/* Field Notes */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Edit2 size={14} className="text-gray-500" />
                        <h3 className="text-sm font-semibold text-gray-900">Field Notes</h3>
                      </div>
                      <textarea
                        value={survey.notes_raw ?? ""}
                        onChange={e => setSurvey(s => s ? { ...s, notes_raw: e.target.value } : s)}
                        placeholder="Additional observations, access issues, special conditions, HOA restrictions..."
                        rows={4}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none text-gray-700"
                      />
                    </div>

                    {/* Device Inventory */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Layers size={14} className="text-gray-500" />
                          <h3 className="text-sm font-semibold text-gray-900">Device Inventory</h3>
                          <span className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                            {survey.devices?.length ?? 0}
                          </span>
                          {autoSaving && (
                            <span className="text-[10px] text-gray-400 flex items-center gap-1">
                              <Loader2 size={9} className="animate-spin" /> saving…
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => addDevice()}
                          className="flex items-center gap-1.5 text-xs text-[#6B7EFF] hover:text-blue-700 font-medium"
                        >
                          <Plus size={12} /> Add Device
                        </button>
                      </div>

                      {/* Quick-add presets */}
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {[
                          { name: "Gate Operator",    brand: "DoorKing" },
                          { name: "Access Reader",    brand: "Brivo"    },
                          { name: "IP Camera",        brand: ""         },
                          { name: "Intercom",         brand: ""         },
                          { name: "Loop Detector",    brand: ""         },
                          { name: "Mag Lock",         brand: ""         },
                          { name: "Electric Strike",  brand: ""         },
                          { name: "Keypad",           brand: ""         },
                          { name: "Video Doorbell",   brand: ""         },
                          { name: "Photobeam",        brand: ""         },
                        ].map(p => (
                          <button
                            key={p.name}
                            type="button"
                            onClick={() => addDevice({ name: p.name, brand: p.brand })}
                            className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-[#6B7EFF]/30 text-[#6B7EFF] bg-indigo-50 hover:bg-indigo-100 transition-colors"
                          >
                            + {p.name}
                          </button>
                        ))}
                      </div>
                      <div className="space-y-2.5">
                        {(survey.devices ?? []).map(d => (
                          <DeviceCard
                            key={d.id}
                            device={d}
                            onChange={upd => updateDevice(d.id, upd)}
                            onDelete={() => deleteDevice(d.id)}
                          />
                        ))}
                        {(survey.devices?.length ?? 0) === 0 && (
                          <div className="text-center py-8 text-gray-400 bg-white rounded-xl border border-dashed border-gray-300">
                            <Layers size={20} className="mx-auto mb-2 text-gray-300" />
                            <p className="text-sm">No devices yet</p>
                            <p className="text-xs mt-1">Use voice dictation above or click "Add Device"</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action bar */}
                    <div className="flex items-center gap-3 sticky bottom-0 bg-[#F8FAFC] py-3 border-t border-gray-200 -mx-6 px-6">
                      <button
                        onClick={saveNotes}
                        disabled={savingNotes}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        {savingNotes ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                        Save
                      </button>

                      <button
                        onClick={generate}
                        disabled={generating || (!transcript.trim() && (!survey.devices || survey.devices.length === 0))}
                        className={cn(
                          "flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors shadow-sm disabled:opacity-50",
                          survey.devices?.length > 0 || transcript.trim()
                            ? "bg-[#6B7EFF] hover:bg-blue-700 animate-pulse-once"
                            : "bg-gray-400"
                        )}
                      >
                        {generating ? (
                          <><Loader2 size={13} className="animate-spin" /> Generating...</>
                        ) : (
                          <><Sparkles size={13} /> Generate SOW + BOM</>
                        )}
                      </button>

                      {survey.ai_sow && !generating && (
                        <span className="text-[11px] text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 size={11} /> AI output ready
                          <button
                            onClick={() => setActiveTab("ai")}
                            className="underline ml-1 font-medium"
                          >View →</button>
                        </span>
                      )}

                      {genError && (
                        <span className="flex items-center gap-1.5 text-xs text-red-600">
                          <AlertTriangle size={12} /> {genError}
                        </span>
                      )}
                    </div>
                  </>
                )}

                {/* ── AI OUTPUT TAB ── */}
                {activeTab === "ai" && (
                  <>
                    {!survey.ai_summary && !survey.ai_sow && (
                      <div className="text-center py-12">
                        <Sparkles size={28} className="mx-auto text-gray-300 mb-3" />
                        <p className="text-sm text-gray-500 font-medium">No AI output yet</p>
                        <p className="text-xs text-gray-400 mt-1">Go to the Capture tab and click "Generate SOW + BOM"</p>
                        <button
                          onClick={() => setActiveTab("capture")}
                          className="mt-4 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#6B7EFF] text-white text-xs font-medium hover:bg-blue-700 transition-colors mx-auto"
                        >
                          <ArrowRight size={12} /> Go to Capture
                        </button>
                      </div>
                    )}

                    {/* Summary */}
                    {survey.ai_summary && (
                      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles size={14} className="text-[#6B7EFF]" />
                          <h3 className="text-sm font-semibold text-gray-900">Executive Summary</h3>
                          <span className="text-[10px] text-gray-400 font-medium ml-1">AI generated · editable</span>
                        </div>
                        <textarea
                          value={survey.ai_summary}
                          onChange={e => setSurvey(s => s ? { ...s, ai_summary: e.target.value } : s)}
                          rows={3}
                          className="w-full text-sm text-gray-700 leading-relaxed border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
                        />
                      </div>
                    )}

                    {/* Urgent Items */}
                    {survey.ai_urgent_items?.length > 0 && (
                      <div className="bg-red-50 rounded-xl border border-red-200 shadow-sm p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <AlertTriangle size={14} className="text-red-600" />
                          <h3 className="text-sm font-semibold text-red-800">Urgent Items</h3>
                        </div>
                        <ul className="space-y-2">
                          {survey.ai_urgent_items.map((u, i) => (
                            <li key={i} className="text-sm">
                              <span className="font-medium text-red-800">{u.item}</span>
                              <span className="text-red-600"> — {u.reason}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Scope of Work */}
                    {survey.ai_sow && (
                      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText size={14} className="text-gray-500" />
                          <h3 className="text-sm font-semibold text-gray-900">Scope of Work</h3>
                          <span className="text-[10px] text-gray-400 font-medium ml-1">editable</span>
                        </div>
                        <textarea
                          value={survey.ai_sow}
                          onChange={e => setSurvey(s => s ? { ...s, ai_sow: e.target.value } : s)}
                          rows={14}
                          className="w-full text-sm text-gray-700 leading-relaxed font-mono border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-y"
                        />
                      </div>
                    )}

                    {/* BOM */}
                    {(survey.ai_bom?.length ?? 0) > 0 && (
                      <BomTable
                        items={survey.ai_bom}
                        onChange={items => setSurvey(s => s ? { ...s, ai_bom: items } : s)}
                      />
                    )}

                    {/* Recommendations */}
                    {survey.ai_recommendations?.length > 0 && (
                      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Check size={14} className="text-blue-600" />
                          <h3 className="text-sm font-semibold text-gray-900">Recommendations</h3>
                        </div>
                        <div className="space-y-2.5">
                          {survey.ai_recommendations.map((r, i) => (
                            <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
                              <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full border shrink-0 mt-0.5", priorityColor(r.priority))}>
                                {r.priority}
                              </span>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-800">{r.title}</p>
                                <p className="text-xs text-gray-500 mt-0.5">{r.detail}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Install Notes */}
                    {survey.ai_install_notes?.length > 0 && (
                      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <ClipboardList size={14} className="text-gray-500" />
                          <h3 className="text-sm font-semibold text-gray-900">Install Notes for Field Team</h3>
                        </div>
                        <ol className="space-y-1.5">
                          {survey.ai_install_notes.map((n, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                              <span className="text-xs font-bold text-[#6B7EFF] mt-0.5 shrink-0 w-5">{i + 1}.</span>
                              <span>{n.note}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {/* Timeline */}
                    {survey.ai_timeline && (
                      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Clock size={14} className="text-gray-500" />
                          <h3 className="text-sm font-semibold text-gray-900">Estimated Timeline</h3>
                          <span className="text-[10px] text-gray-400 font-medium ml-1">editable</span>
                        </div>
                        <textarea
                          value={survey.ai_timeline}
                          onChange={e => setSurvey(s => s ? { ...s, ai_timeline: e.target.value } : s)}
                          rows={3}
                          className="w-full text-sm text-gray-700 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
                        />
                      </div>
                    )}

                    {/* AI Output action bar */}
                    {survey.ai_sow && (
                      <div className="flex items-center gap-3 sticky bottom-0 bg-[#F8FAFC] py-3 border-t border-gray-200 -mx-6 px-6">
                        <button
                          onClick={saveBom}
                          disabled={savingBom}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          {savingBom ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                          Save Edits
                        </button>

                        <button
                          onClick={generate}
                          disabled={generating}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#6B7EFF] text-[#6B7EFF] text-sm font-medium hover:bg-blue-50 transition-colors"
                        >
                          {generating ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                          Regenerate
                        </button>

                        <div className="flex-1" />

                        {survey.quote_id ? (
                          <a
                            href={`/quotes/${survey.quote_id}`}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
                          >
                            <CheckCircle2 size={13} /> View Quote
                          </a>
                        ) : (
                          <button
                            onClick={createQuote}
                            disabled={creatingQuote || !survey.ai_bom?.length}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50"
                          >
                            {creatingQuote ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
                            Create Quote from BOM
                            <ArrowRight size={12} />
                          </button>
                        )}

                        <button
                          onClick={() => {
                            const text = [
                              survey.property_name,
                              survey.property_address,
                              "",
                              survey.ai_summary ?? "",
                              "",
                              survey.ai_sow ?? "",
                            ].join("\n")
                            navigator.clipboard.writeText(text).then(() => alert("SOW copied to clipboard!"))
                          }}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <Download size={13} /> Copy SOW
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>

      {showNew && (
        <NewSurveyModal
          onClose={() => setShowNew(false)}
          onCreate={s => {
            setSurveys(ss => [s, ...ss])
            setSelectedId(s.id)
            setSurvey(s)
            setTranscript("")
            setActiveTab("capture")
            setShowNew(false)
          }}
        />
      )}
    </div>
  )
}
