'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Wrench, Clock, Calendar, CheckCircle2, X, AlertTriangle,
  Plus, Trash2, MessageSquare, Package, User, Users, ChevronDown,
  RefreshCw, Send, Building2, Hash, MapPin, Check, FileText, Search,
} from 'lucide-react'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { ArrowLeft, Edit2, Timer, Tag, ClipboardList, PhoneCall, PhoneOutgoing, Navigation } = require('lucide-react') as any
import { TopBar } from '@/components/layout/TopBar'
import { QuickActions } from '@/components/shared/QuickActions'
import { cn } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────

type WOStatus   = 'open' | 'in_progress' | 'scheduled' | 'in_route' | 'on_site' | 'completed' | 'cancelled'
type WOPriority = 'urgent' | 'high' | 'medium' | 'low'

interface WorkOrder {
  id: string
  wo_number: string
  title: string
  description?: string
  customer_name: string
  assignee_id?: string
  assignee_name?: string
  priority: WOPriority
  status: WOStatus
  job_type: string
  category?: string
  estimated_hours?: number
  location?: string
  scheduled_date?: string
  due_date?: string
  completed_at?: string
  notes?: string
  parent_wo_id?: string
  site_id?: string | null
  // Flattened site fields (joined from sites table)
  site_address?: string | null
  site_city?: string | null
  site_state?: string | null
  site_zip?: string | null
  site_access_notes?: string | null
  site_pm_name?: string | null
  site_pm_email?: string | null
  site_pm_phone?: string | null
  site_contact_name?: string | null
  site_contact_email?: string | null
  site_contact_phone?: string | null
  created_at: string
  updated_at: string
}

interface CallLog {
  id: string
  work_order_id: string
  direction: 'inbound' | 'outbound'
  contact_name?: string | null
  phone?: string | null
  duration_mins?: number | null
  notes?: string | null
  ai_summary?: string | null
  outcome?: 'reached' | 'no_answer' | 'left_voicemail' | 'wrong_number' | 'callback_requested' | null
  made_by?: string | null
  called_at: string
  created_at: string
}

interface ChecklistItem {
  id: string
  work_order_id: string
  title: string
  completed: boolean
  completed_at?: string
  completed_by?: string
  completed_by_name?: string
  sort_order: number
  // Migration 044 fields
  outcome?: 'pass' | 'fail' | 'na' | null
  notes?: string | null
  category?: 'task' | 'safety' | 'inspection' | 'verification'
  added_by?: 'management' | 'tech'
}

interface InstalledEquipment {
  id: string
  work_order_id: string
  name: string
  make?: string | null
  model?: string | null
  sku?: string | null
  serial_number?: string | null
  location?: string | null
  qty: number
  condition?: 'new' | 'existing' | 'replaced' | null
  notes?: string | null
  added_by: 'management' | 'tech'
  confirmed: boolean
  confirmed_by?: string | null
  confirmed_at?: string | null
  sort_order: number
  created_at: string
}

interface WOComment {
  id: string
  work_order_id: string
  author_name: string
  author_initials: string
  content: string
  created_at: string
}

interface PartUsed {
  id: string
  work_order_id: string
  inventory_item_id?: string | null
  // new schema fields (work_order_parts)
  name?: string
  sku?: string | null
  qty?: number
  action?: string
  added_by?: string | null
  // legacy compat
  part_id?: string
  part_name?: string
  part_number?: string
  quantity?: number
  unit_cost?: number | null
}

interface InventorySearchResult {
  id: string
  name: string
  sku: string | null
  on_hand: number
  unit_cost: number
  category: string
}

interface SubWorkOrder {
  id: string
  wo_number: string
  title: string
  status: WOStatus
  priority: WOPriority
  assignee_name?: string
  due_date?: string
}

type FTStatus = 'draft' | 'submitted' | 'approved' | 'rejected'

interface FieldTicket {
  id: string
  work_order_id: string
  site_id?: string | null
  technician_name: string
  title: string
  findings?: string | null
  work_performed?: string | null
  materials_used?: string | null
  labor_hours?: number | null
  recommendations?: string | null
  status: FTStatus
  submitted_at?: string | null
  approved_at?: string | null
  approved_by?: string | null
  created_at: string
  updated_at: string
}

interface TimeEntry {
  id: string
  work_order_id: string
  technician_name: string
  clock_in: string
  clock_out?: string | null
  duration_mins?: number | null
  notes?: string | null
  created_at: string
}

// ── Config ───────────────────────────────────────────────────────────────────

const PRIORITY_CFG: Record<WOPriority, { bg: string; text: string; label: string }> = {
  urgent: { bg: 'bg-red-500/10',    text: 'text-red-400',    label: 'Urgent' },
  high:   { bg: 'bg-orange-500/10', text: 'text-orange-400', label: 'High'   },
  medium: { bg: 'bg-amber-500/10',  text: 'text-amber-400',  label: 'Medium' },
  low:    { bg: 'bg-slate-500/10',  text: 'text-slate-400',  label: 'Low'    },
}

const STATUS_CFG: Record<WOStatus, { label: string; bg: string; text: string; dot: string }> = {
  open:        { label: 'Open',        bg: 'bg-blue-500/10',    text: 'text-blue-400',    dot: 'bg-blue-400'    },
  scheduled:   { label: 'Scheduled',   bg: 'bg-violet-500/10',  text: 'text-violet-400',  dot: 'bg-violet-400'  },
  in_route:    { label: 'En Route',    bg: 'bg-amber-500/10',   text: 'text-amber-400',   dot: 'bg-amber-400'   },
  on_site:     { label: 'On Site',     bg: 'bg-orange-500/10',  text: 'text-orange-400',  dot: 'bg-orange-400'  },
  in_progress: { label: 'In Progress', bg: 'bg-amber-500/10',   text: 'text-amber-400',   dot: 'bg-amber-400'   },
  completed:   { label: 'Completed',   bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  cancelled:   { label: 'Cancelled',   bg: 'bg-slate-500/10',   text: 'text-slate-400',   dot: 'bg-slate-400'   },
}

const STATUSES: { value: WOStatus; label: string }[] = [
  { value: 'open',        label: 'Open'        },
  { value: 'scheduled',   label: 'Scheduled'   },
  { value: 'in_route',    label: 'En Route'    },
  { value: 'on_site',     label: 'On Site'     },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed',   label: 'Completed'   },
  { value: 'cancelled',   label: 'Cancelled'   },
]

const PRIORITIES: { value: WOPriority; label: string }[] = [
  { value: 'urgent', label: '🔴 Urgent' },
  { value: 'high',   label: '🟠 High'   },
  { value: 'medium', label: '🔵 Medium' },
  { value: 'low',    label: '⚪ Low'    },
]

// Compact category colors used in Details tab checklist overview
const CATEGORY_COLORS: Record<string, string> = {
  task:         'bg-blue-500/10 text-blue-400',
  safety:       'bg-red-500/10 text-red-400',
  inspection:   'bg-violet-500/10 text-violet-400',
  verification: 'bg-emerald-500/10 text-emerald-400',
}

function fmtDate(iso?: string) {
  if (!iso) return '—'
  return new Date(iso + (iso.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ── Edit Slide-Over ──────────────────────────────────────────────────────────

interface EditSlideOverProps {
  open: boolean
  wo: WorkOrder
  onClose: () => void
  onSaved: (wo: WorkOrder) => void
}

// ── WorkOrderTimeline ─────────────────────────────────────────────────────────
const TIMELINE_STEPS = [
  { key: 'created',   label: 'Created'  },
  { key: 'assigned',  label: 'Assigned' },
  { key: 'en_route',  label: 'En Route' },
  { key: 'on_site',   label: 'On Site'  },
  { key: 'completed', label: 'Completed'},
] as const

function statusToStepIndex(status: WOStatus): number {
  switch (status) {
    case 'open':        return 0
    case 'scheduled':   return 1
    case 'in_route':    return 2
    case 'in_progress': return 3
    case 'on_site':     return 3
    case 'completed':   return 4
    default:            return 0
  }
}

function WorkOrderTimeline({ status }: { status: WOStatus }) {
  if (status === 'cancelled') {
    return (
      <div className="mb-6 bg-card border border-border rounded-xl px-5 py-4 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
        <span className="text-sm font-semibold text-slate-400">Cancelled</span>
      </div>
    )
  }

  const activeIndex = statusToStepIndex(status)

  return (
    <div className="mb-6 bg-card border border-border rounded-xl px-5 py-4">
      <div className="flex items-center">
        {TIMELINE_STEPS.map((step, i) => {
          const isCompleted = i < activeIndex
          const isCurrent   = i === activeIndex
          const isFuture    = i > activeIndex

          return (
            <div key={step.key} className="flex items-center flex-1 last:flex-none">
              {/* Step */}
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <div
                  className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                    isCompleted && 'bg-emerald-500 text-white',
                    isCurrent   && 'bg-[#6B7EFF] text-white ring-4 ring-[#6B7EFF]/20',
                    isFuture    && 'bg-white border-2 border-border text-muted-foreground',
                  )}
                >
                  {isCompleted ? (
                    <Check size={13} strokeWidth={3} />
                  ) : (
                    <span>{i + 1}</span>
                  )}
                </div>
                <span
                  className={cn(
                    'text-[10px] font-medium whitespace-nowrap leading-tight',
                    isCompleted && 'text-emerald-500',
                    isCurrent   && 'text-[#6B7EFF] font-semibold',
                    isFuture    && 'text-muted-foreground',
                  )}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line (skip after last step) */}
              {i < TIMELINE_STEPS.length - 1 && (
                <div
                  className={cn(
                    'flex-1 h-0.5 mx-1 mb-5 rounded-full transition-colors',
                    i < activeIndex ? 'bg-emerald-500' : 'bg-border',
                  )}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function EditSlideOver({ open, wo, onClose, onSaved }: EditSlideOverProps) {
  const [form, setForm] = useState({
    title:          wo.title,
    customer_name:  wo.customer_name,
    job_type:       wo.job_type,
    category:       wo.category       ?? 'Repair',
    priority:       wo.priority,
    status:         wo.status,
    location:       wo.location       ?? '',
    estimated_hours: wo.estimated_hours?.toString() ?? '',
    due_date:       wo.due_date       ?? '',
    scheduled_date: wo.scheduled_date ?? '',
    notes:          wo.notes          ?? '',
  })
  const [sendNotifications, setSendNotifications] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    if (!form.title.trim()) { setError('Title required'); return }
    setSaving(true); setError('')
    try {
      const res  = await fetch(`/api/maintenance/${wo.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          ...form,
          estimated_hours:   form.estimated_hours ? parseFloat(form.estimated_hours) : null,
          due_date:          form.due_date        || null,
          scheduled_date:    form.scheduled_date  || null,
          send_notifications: sendNotifications,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Save failed')
      onSaved(json.work_order)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const sel = 'w-full appearance-none border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 bg-background pr-8'
  const inp = 'w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 bg-background'
  const lbl = 'block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5'

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-[480px] bg-card border-l border-border z-50 flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-sm font-bold">Edit Work Order</h2>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">{wo.wo_number}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent">
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div><label className={lbl}>Title *</label>
            <input value={form.title} onChange={e => set('title', e.target.value)} className={inp} /></div>

          <div><label className={lbl}>Customer / Property *</label>
            <input value={form.customer_name} onChange={e => set('customer_name', e.target.value)} className={inp} /></div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Job Type</label>
              <div className="relative">
                <select value={form.job_type} onChange={e => set('job_type', e.target.value)} className={sel}>
                  {['Install','Repair','PM','Site Walk'].map(j => <option key={j}>{j}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            </div>
            <div><label className={lbl}>Category</label>
              <div className="relative">
                <select value={form.category} onChange={e => set('category', e.target.value)} className={sel}>
                  {['Preventive','Damage','Electrical','Mechanical','Plumbing','Safety','General','Repair'].map(c => <option key={c}>{c}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Priority</label>
              <div className="relative">
                <select value={form.priority} onChange={e => set('priority', e.target.value)} className={sel}>
                  {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            </div>
            <div><label className={lbl}>Status</label>
              <div className="relative">
                <select value={form.status} onChange={e => set('status', e.target.value)} className={sel}>
                  {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Location / Area</label>
              <input value={form.location} onChange={e => set('location', e.target.value)} placeholder="e.g. Main Gate" className={inp} /></div>
            <div><label className={lbl}>Est. Hours</label>
              <input type="number" step="0.5" min="0" value={form.estimated_hours} onChange={e => set('estimated_hours', e.target.value)} placeholder="2.5" className={inp} /></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Due Date</label>
              <input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} className={inp} /></div>
            <div><label className={lbl}>Scheduled Date</label>
              <input type="date" value={form.scheduled_date} onChange={e => set('scheduled_date', e.target.value)} className={inp} /></div>
          </div>

          <div><label className={lbl}>Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={4}
              className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 bg-background resize-none" /></div>

          {error && (
            <div className="flex items-center gap-2 text-red-500 text-xs bg-red-500/10 rounded-xl px-3 py-2">
              <AlertTriangle size={13} /> {error}
            </div>
          )}
        </div>

        {/* Email notification toggle */}
        <div className="border-t border-border px-4 py-3 bg-background/50">
          <label className="flex items-center gap-2.5 cursor-pointer select-none group">
            <input
              type="checkbox"
              checked={sendNotifications}
              onChange={e => setSendNotifications(e.target.checked)}
              className="w-4 h-4 rounded border-border accent-brand-500 cursor-pointer"
            />
            <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
              Send email notification to property manager on status change
            </span>
          </label>
        </div>

        <div className="border-t border-border p-4 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-accent transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition-colors disabled:opacity-50 shadow-lg shadow-brand-500/20">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function WorkOrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [wo, setWo]               = useState<WorkOrder | null>(null)
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])
  const [comments, setComments]   = useState<WOComment[]>([])
  const [partsUsed, setPartsUsed] = useState<PartUsed[]>([])
  const [subWOs, setSubWOs]       = useState<SubWorkOrder[]>([])
  const [loading, setLoading]     = useState(true)
  const [editOpen, setEditOpen]   = useState(false)

  // Checklist input
  const [newItem, setNewItem]       = useState('')
  const [addingItem, setAddingItem] = useState(false)

  // Comment input
  const [newComment, setNewComment]     = useState('')
  const [postingComment, setPostingComment] = useState(false)

  // Part input
  const [showAddPart, setShowAddPart] = useState(false)
  const [partForm, setPartForm] = useState({ part_name: '', part_number: '', quantity: '1', unit_cost: '', action: 'used' })
  const [addingPart, setAddingPart] = useState(false)

  // Inventory search picker
  const [invSearch, setInvSearch]         = useState('')
  const [invResults, setInvResults]       = useState<InventorySearchResult[]>([])
  const [invSearching, setInvSearching]   = useState(false)
  const [selectedInvItem, setSelectedInvItem] = useState<InventorySearchResult | null>(null)

  // Active tab
  const [tab, setTab] = useState<'details' | 'comments' | 'parts' | 'field_tickets' | 'time' | 'crew' | 'schedule' | 'calls'>('details')

  // Template email slide-over
  const [emailSlideOpen, setEmailSlideOpen] = useState(false)
  const [emailTemplate, setEmailTemplate] = useState<string | null>(null)
  const [emailSubject, setEmailSubject]   = useState('')
  const [emailBody, setEmailBody]         = useState('')
  const [emailTo, setEmailTo]             = useState('')
  const [emailSending, setEmailSending]   = useState(false)
  const [emailSent, setEmailSent]         = useState(false)

  // All techs (for crew picker)
  const [allTechs, setAllTechs] = useState<{ id: string; name: string; initials: string; role: string }[]>([])

  // Field Tickets
  const [fieldTickets, setFieldTickets]   = useState<FieldTicket[]>([])
  const [showNewFT, setShowNewFT]         = useState(false)
  const [ftSaving, setFtSaving]           = useState(false)
  const [ftError, setFtError]             = useState('')
  const [ftForm, setFtForm] = useState({
    technician_name: '', title: '', findings: '', work_performed: '',
    materials_used: '', labor_hours: '', recommendations: '',
  })

  // Time Tracking
  const [timeEntries, setTimeEntries]     = useState<TimeEntry[]>([])
  const [totalMins, setTotalMins]         = useState(0)
  const [activeTimeEntry, setActiveEntry] = useState<TimeEntry | null>(null)
  const [timeSaving, setTimeSaving]       = useState(false)
  const [clockTechName, setClockTechName] = useState('')

  // Overview summary counts (loaded non-blocking for Details dashboard)
  const [crewCount, setCrewCount]   = useState<number | null>(null)
  const [phaseCount, setPhaseCount] = useState<number | null>(null)

  const commentInputRef = useRef<HTMLTextAreaElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/maintenance/${id}`)
      const json = await res.json()
      if (!res.ok) { router.push('/maintenance'); return }
      setWo(json.work_order)
      setChecklist(json.checklist       ?? [])
      setComments(json.comments         ?? [])
      setPartsUsed(json.parts_used      ?? [])
      setSubWOs(json.sub_work_orders    ?? [])

      // Load parts from new work_order_parts table (non-blocking)
      void (async () => {
        try {
          const partsRes  = await fetch(`/api/maintenance/${id}/parts`)
          const partsJson = await partsRes.json()
          if (partsRes.ok && partsJson.parts?.length > 0) {
            setPartsUsed(partsJson.parts)
          }
        } catch (_) { /* non-blocking */ }
      })()

      // Load field tickets + time entries + crew/phase counts in parallel (non-blocking)
      void Promise.all([
        fetch(`/api/field-tickets?work_order_id=${id}`).then(r => r.json()).then(j => {
          setFieldTickets(j.records ?? [])
        }).catch(() => {}),
        fetch(`/api/maintenance/${id}/time`).then(r => r.json()).then(j => {
          setTimeEntries(j.entries ?? [])
          setTotalMins(j.totalMins ?? 0)
          setActiveEntry(j.activeEntry ?? null)
        }).catch(() => {}),
        fetch('/api/dispatch/technicians').then(r => r.json()).then(j => {
          setAllTechs(j.technicians ?? [])
        }).catch(() => {}),
        fetch(`/api/maintenance/${id}/crew`).then(r => r.json()).then(j => {
          setCrewCount((j.crew ?? []).length)
        }).catch(() => {}),
        fetch(`/api/maintenance/${id}/phases`).then(r => r.json()).then(j => {
          setPhaseCount((j.phases ?? []).length)
        }).catch(() => {}),
      ])
    } finally {
      setLoading(false)
    }
  }, [id, router])

  useEffect(() => { load() }, [load])

  // ── Status quick-change ──────────────────────────────────────────

  const handleStatusChange = async (newStatus: WOStatus) => {
    if (!wo) return
    const res  = await fetch(`/api/maintenance/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    const json = await res.json()
    if (res.ok) setWo(json.work_order)
  }

  // ── Checklist ────────────────────────────────────────────────────

  const handleAddItem = async () => {
    if (!newItem.trim()) return
    setAddingItem(true)
    try {
      const res  = await fetch(`/api/maintenance/${id}/checklist`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newItem.trim(), sort_order: checklist.length }),
      })
      const json = await res.json()
      if (res.ok) { setChecklist(c => [...c, json.item]); setNewItem('') }
    } finally { setAddingItem(false) }
  }

  const handleToggleItem = async (item: ChecklistItem) => {
    const optimistic = checklist.map(c => c.id === item.id ? { ...c, completed: !c.completed } : c)
    setChecklist(optimistic)
    const res  = await fetch(`/api/maintenance/${id}/checklist`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: item.id, completed: !item.completed }),
    })
    const json = await res.json()
    if (res.ok) setChecklist(c => c.map(x => x.id === item.id ? json.item : x))
    else        setChecklist(checklist) // revert
  }

  const handleDeleteItem = async (itemId: string) => {
    setChecklist(c => c.filter(x => x.id !== itemId))
    await fetch(`/api/maintenance/${id}/checklist`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: itemId }),
    })
  }

  // ── Comments ─────────────────────────────────────────────────────

  const handlePostComment = async () => {
    if (!newComment.trim()) return
    setPostingComment(true)
    try {
      const res  = await fetch(`/api/maintenance/${id}/comments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment.trim() }),
      })
      const json = await res.json()
      if (res.ok) { setComments(c => [...c, json.comment]); setNewComment('') }
    } finally { setPostingComment(false) }
  }

  const handleDeleteComment = async (commentId: string) => {
    setComments(c => c.filter(x => x.id !== commentId))
    await fetch(`/api/maintenance/${id}/comments`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment_id: commentId }),
    })
  }

  // ── Parts ────────────────────────────────────────────────────────

  const handleInvSearch = async (q: string) => {
    setInvSearch(q)
    if (!q.trim()) { setInvResults([]); return }
    setInvSearching(true)
    try {
      const res  = await fetch(`/api/inventory?q=${encodeURIComponent(q)}`)
      const json = await res.json()
      setInvResults(json.records ?? [])
    } catch (_) { /* ignore */ } finally { setInvSearching(false) }
  }

  const handleSelectInvItem = (item: InventorySearchResult) => {
    setSelectedInvItem(item)
    setPartForm(f => ({
      ...f,
      part_name:   item.name,
      part_number: item.sku ?? '',
      unit_cost:   String(item.unit_cost),
    }))
    setInvResults([])
    setInvSearch('')
  }

  const handleAddPart = async () => {
    if (!partForm.part_name.trim()) return
    setAddingPart(true)
    try {
      const res  = await fetch(`/api/maintenance/${id}/parts`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inventory_item_id: selectedInvItem?.id ?? null,
          name:      partForm.part_name.trim(),
          sku:       partForm.part_number || null,
          qty:       parseInt(partForm.quantity) || 1,
          unit_cost: partForm.unit_cost ? parseFloat(partForm.unit_cost) : null,
          action:    partForm.action || 'used',
        }),
      })
      const json = await res.json()
      if (res.ok) {
        setPartsUsed(p => [...p, json.part])
        setPartForm({ part_name: '', part_number: '', quantity: '1', unit_cost: '', action: 'used' })
        setSelectedInvItem(null)
        setShowAddPart(false)
      } else {
        alert(json.error ?? 'Failed to add part')
      }
    } finally { setAddingPart(false) }
  }

  const handleDeletePart = async (partId: string) => {
    setPartsUsed(p => p.filter(x => x.id !== partId))
    // Try new RESTful endpoint first
    const res = await fetch(`/api/maintenance/${id}/parts/${partId}`, { method: 'DELETE' })
    if (!res.ok) {
      // Fallback to legacy body-DELETE
      await fetch(`/api/maintenance/${id}/parts`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ part_used_id: partId }),
      })
    }
  }

  // ── Field Tickets ────────────────────────────────────────────────

  const handleSubmitFT = async () => {
    if (!ftForm.title.trim()) { setFtError('Title is required'); return }
    setFtSaving(true); setFtError('')
    try {
      const res  = await fetch('/api/field-tickets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          work_order_id:   id,
          technician_name: ftForm.technician_name.trim(),
          title:           ftForm.title.trim(),
          findings:        ftForm.findings.trim()      || null,
          work_performed:  ftForm.work_performed.trim() || null,
          materials_used:  ftForm.materials_used.trim() || null,
          labor_hours:     ftForm.labor_hours           ? parseFloat(ftForm.labor_hours) : null,
          recommendations: ftForm.recommendations.trim() || null,
          status:          'submitted',
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Save failed')
      setFieldTickets(f => [json, ...f])
      setFtForm({ technician_name: '', title: '', findings: '', work_performed: '', materials_used: '', labor_hours: '', recommendations: '' })
      setShowNewFT(false)
    } catch (err: unknown) {
      setFtError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setFtSaving(false)
    }
  }

  const handleApproveFT = async (ft: FieldTicket) => {
    const res  = await fetch(`/api/field-tickets/${ft.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    })
    const json = await res.json()
    if (res.ok) setFieldTickets(f => f.map(x => x.id === ft.id ? json : x))
  }

  const handleDeleteFT = async (ftId: string) => {
    setFieldTickets(f => f.filter(x => x.id !== ftId))
    await fetch(`/api/field-tickets/${ftId}`, { method: 'DELETE' })
  }

  // ── Time Tracking ────────────────────────────────────────────────

  const handleClockIn = async () => {
    if (!clockTechName.trim()) return
    setTimeSaving(true)
    try {
      const res  = await fetch(`/api/maintenance/${id}/time`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ technician_name: clockTechName.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Clock-in failed')
      setActiveEntry(json)
      setTimeEntries(e => [json, ...e])
    } finally {
      setTimeSaving(false)
    }
  }

  const handleClockOut = async () => {
    if (!activeTimeEntry) return
    setTimeSaving(true)
    try {
      const res  = await fetch(`/api/maintenance/${id}/time`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry_id: activeTimeEntry.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Clock-out failed')
      setActiveEntry(null)
      setTimeEntries(e => e.map(x => x.id === json.id ? json : x))
      setTotalMins(m => m + (json.duration_mins ?? 0))
    } finally {
      setTimeSaving(false)
    }
  }

  // ── Template Email ───────────────────────────────────────────────

  const EMAIL_TEMPLATES = [
    {
      id:      'missed',
      label:   '📋 Sorry We Missed You',
      subject: (wo: WorkOrder) => `We stopped by — ${wo.customer_name}`,
      body:    (wo: WorkOrder) => `Hi,\n\nWe came by today for your scheduled service call (${wo.wo_number}) but were unable to complete access to the site.\n\nPlease contact us at your earliest convenience to reschedule. We want to make sure your access control system is operating at its best.\n\nThank you,\nGateGuard Service Team`,
    },
    {
      id:      'complete',
      label:   '✅ Visit Complete — Thank You',
      subject: (wo: WorkOrder) => `Service Complete — ${wo.customer_name} — ${wo.wo_number}`,
      body:    (wo: WorkOrder) => `Hi,\n\nIt was a pleasure visiting your property today. Your service call (${wo.wo_number}) has been completed.\n\nIf you have any questions about the work performed or notice any issues, please don't hesitate to reach out. We're here to help.\n\nThank you for choosing GateGuard,\nGateGuard Service Team`,
    },
    {
      id:      'reminder',
      label:   '📅 Appointment Reminder',
      subject: (wo: WorkOrder) => `Upcoming Service — ${wo.customer_name} — ${fmtDate(wo.scheduled_date)}`,
      body:    (wo: WorkOrder) => `Hi,\n\nThis is a friendly reminder that your GateGuard service appointment (${wo.wo_number}) is scheduled for ${fmtDate(wo.scheduled_date)}.\n\nPlease ensure site access is available for our technician. If you need to reschedule, please contact us as soon as possible.\n\nThank you,\nGateGuard Service Team`,
    },
    {
      id:      'followup',
      label:   '🔧 Follow-Up Required',
      subject: (wo: WorkOrder) => `Follow-Up Needed — ${wo.customer_name} — ${wo.wo_number}`,
      body:    (wo: WorkOrder) => `Hi,\n\nFollowing our recent service visit (${wo.wo_number}), we've identified some additional items that require attention.\n\nOur team will be in touch shortly to discuss next steps. If you have any immediate concerns, please don't hesitate to call us directly.\n\nThank you,\nGateGuard Service Team`,
    },
    {
      id:      'parts_eta',
      label:   '📦 Parts on Order',
      subject: (wo: WorkOrder) => `Parts Ordered — ${wo.customer_name} — ${wo.wo_number}`,
      body:    (wo: WorkOrder) => `Hi,\n\nThank you for your patience. Following our service call (${wo.wo_number}), we've ordered the necessary parts to complete your repair.\n\nWe'll contact you as soon as the parts arrive to schedule the completion of your work order.\n\nThank you,\nGateGuard Service Team`,
    },
    {
      id:      'custom',
      label:   '✏️ Custom Email',
      subject: () => '',
      body:    () => '',
    },
  ]

  const handleSelectTemplate = (templateId: string) => {
    if (!wo) return
    const tmpl = EMAIL_TEMPLATES.find(t => t.id === templateId)
    if (!tmpl) return
    setEmailTemplate(templateId)
    setEmailSubject(tmpl.subject(wo))
    setEmailBody(tmpl.body(wo))
    // Pre-fill to address from PM or site contact
    setEmailTo(wo.site_pm_email ?? wo.site_contact_email ?? '')
  }

  const handleSendEmail = async () => {
    if (!emailTo.trim() || !emailSubject.trim() || !emailBody.trim() || !wo) return
    setEmailSending(true)
    try {
      const res = await fetch('/api/crm/email/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_email:       emailTo.trim(),
          subject:        emailSubject.trim(),
          body:           emailBody.trim(),
          sender_name:    'GateGuard Service Team',
        }),
      })
      if (res.ok) {
        setEmailSent(true)
        setTimeout(() => {
          setEmailSlideOpen(false)
          setEmailSent(false)
          setEmailTemplate(null)
          setEmailSubject('')
          setEmailBody('')
          setEmailTo('')
        }, 1500)
      }
    } finally { setEmailSending(false) }
  }

  // ── Derived state ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col min-h-full">
        <TopBar title="Work Order" subtitle="Loading…" />
        <div className="flex items-center justify-center flex-1 text-muted-foreground text-sm">
          <RefreshCw size={16} className="animate-spin mr-2" /> Loading work order…
        </div>
      </div>
    )
  }

  if (!wo) return null

  const isOverdue  = wo.status !== 'completed' && wo.due_date && new Date(wo.due_date + 'T23:59:59') < new Date()
  const sc         = STATUS_CFG[wo.status] ?? STATUS_CFG.open
  const pc         = PRIORITY_CFG[wo.priority] ?? PRIORITY_CFG.medium
  const doneCount  = checklist.filter(c => c.completed).length
  const totalCount = checklist.length
  const progress   = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

  // Normalize helper — handles both old (wo_parts_used) and new (work_order_parts) schemas
  const normPart = (p: PartUsed) => ({
    id:        p.id,
    name:      p.name       ?? p.part_name   ?? 'Unknown part',
    sku:       p.sku        ?? p.part_number ?? null,
    qty:       p.qty        ?? p.quantity    ?? 1,
    unit_cost: p.unit_cost  ?? null,
    action:    p.action     ?? 'used',
    added_by:  p.added_by   ?? null,
  })

  const partsTotal = partsUsed.reduce((acc, p) => {
    const n = normPart(p)
    return acc + (n.unit_cost ?? 0) * n.qty
  }, 0)

  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        title={wo.wo_number}
        subtitle={wo.title}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/maintenance" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-accent transition-colors text-muted-foreground">
              <ArrowLeft size={12} /> Work Orders
            </Link>
            <button
              onClick={() => setEditOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors"
            >
              <Edit2 size={12} /> Edit
            </button>
          </div>
        }
      />

      <EditSlideOver open={editOpen} wo={wo} onClose={() => setEditOpen(false)} onSaved={w => { setWo(w); setEditOpen(false) }} />

      {/* ── Template Email Slide-Over ── */}
      {emailSlideOpen && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setEmailSlideOpen(false)} />
          <div className="fixed inset-y-0 right-0 w-[520px] bg-card border-l border-border z-50 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h2 className="text-sm font-bold">Send Email</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{wo.wo_number} · {wo.customer_name}</p>
              </div>
              <button onClick={() => { setEmailSlideOpen(false); setEmailTemplate(null) }} className="p-1.5 rounded-lg hover:bg-accent">
                <X size={14} className="text-muted-foreground" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Template picker */}
              {!emailTemplate ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Choose a Template</p>
                  {EMAIL_TEMPLATES.map(t => (
                    <button
                      key={t.id}
                      onClick={() => handleSelectTemplate(t.id)}
                      className="w-full text-left px-4 py-3 rounded-xl border border-border hover:border-brand-500/50 hover:bg-accent/30 transition-all text-sm font-medium text-foreground"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  <button onClick={() => setEmailTemplate(null)} className="text-xs text-brand-400 hover:text-brand-500 flex items-center gap-1">
                    <ArrowLeft size={11} /> Back to templates
                  </button>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">To *</label>
                    <input
                      value={emailTo}
                      onChange={e => setEmailTo(e.target.value)}
                      placeholder="recipient@example.com"
                      className="w-full text-sm px-3 py-2.5 border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    />
                    {(wo.site_pm_email || wo.site_contact_email) && (
                      <div className="flex gap-2 mt-1.5 flex-wrap">
                        {wo.site_pm_email && (
                          <button onClick={() => setEmailTo(wo.site_pm_email!)} className="text-xs text-brand-400 hover:underline">
                            Use PM: {wo.site_pm_email}
                          </button>
                        )}
                        {wo.site_contact_email && wo.site_contact_email !== wo.site_pm_email && (
                          <button onClick={() => setEmailTo(wo.site_contact_email!)} className="text-xs text-brand-400 hover:underline">
                            Use contact: {wo.site_contact_email}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Subject *</label>
                    <input
                      value={emailSubject}
                      onChange={e => setEmailSubject(e.target.value)}
                      className="w-full text-sm px-3 py-2.5 border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Message *</label>
                    <textarea
                      value={emailBody}
                      onChange={e => setEmailBody(e.target.value)}
                      rows={10}
                      className="w-full text-sm px-3 py-2.5 border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-brand-500/30 resize-none"
                    />
                  </div>
                </>
              )}
            </div>

            {emailTemplate && (
              <div className="border-t border-border p-4 flex gap-3">
                <button onClick={() => setEmailSlideOpen(false)} className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-accent">Cancel</button>
                <button
                  onClick={handleSendEmail}
                  disabled={emailSending || !emailTo.trim() || !emailSubject.trim() || emailSent}
                  className="flex-1 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold disabled:opacity-50 shadow-lg shadow-brand-500/20"
                >
                  {emailSent ? '✓ Sent!' : emailSending ? 'Sending…' : 'Send Email'}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      <div className="flex-1 p-6">
        <div className="max-w-6xl mx-auto">

          {/* Header bar */}
          <div className="flex items-start gap-4 mb-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold text-foreground">{wo.title}</h1>
                {isOverdue && (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-red-500/10 text-red-400 text-xs font-semibold rounded-full">
                    <AlertTriangle size={10} /> Overdue
                  </span>
                )}
                <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${pc.bg} ${pc.text}`}>
                  {pc.label}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                <Building2 size={13} />
                <span>{wo.customer_name}</span>
                {wo.location && (<><span className="text-border">·</span><MapPin size={13} /><span>{wo.location}</span></>)}
              </div>
            </div>

            {/* Status dropdown */}
            <div className="relative shrink-0">
              <select
                value={wo.status}
                onChange={e => handleStatusChange(e.target.value as WOStatus)}
                className={cn(
                  'appearance-none pl-7 pr-8 py-2 rounded-xl text-sm font-semibold cursor-pointer border-0 outline-none',
                  sc.bg, sc.text
                )}
              >
                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <span className={cn('absolute left-2.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full pointer-events-none', sc.dot)} />
              <ChevronDown size={12} className={cn('absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none', sc.text)} />
            </div>
          </div>

          {/* Quick action buttons */}
          <div className="mb-6">
            <QuickActions
              recordType="work_order"
              recordId={wo.id}
              recordName={`WO ${wo.wo_number}: ${wo.title}`}
              onActivityCreated={() => {}}
            />
          </div>

          {/* Status timeline */}
          <WorkOrderTimeline status={wo.status} />

          {/* Checklist progress bar (if items exist) */}
          {totalCount > 0 && (
            <div className="mb-6 bg-card border border-border rounded-xl px-5 py-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Checklist Progress
                </span>
                <span className="text-xs font-bold text-foreground">{doneCount} / {totalCount} completed</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-500', progress === 100 ? 'bg-emerald-400' : 'bg-amber-400')}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Main grid */}
          <div className="grid grid-cols-3 gap-6">

            {/* ── Left column (2/3) ── */}
            <div className="col-span-2 space-y-6">

              {/* Tabs */}
              <div className="flex gap-1 border-b border-border pb-0 flex-wrap">
                {([
                  { key: 'details',       label: 'Details',                               icon: Wrench        },
                  { key: 'crew',          label: 'Crew',                                  icon: Users         },
                  { key: 'schedule',      label: 'Schedule',                              icon: Calendar      },
                  { key: 'field_tickets', label: `Field Tickets (${fieldTickets.length})`, icon: ClipboardList },
                  { key: 'calls',         label: 'Calls',                                 icon: PhoneCall     },
                  { key: 'time',          label: `Time (${totalMins > 0 ? Math.floor(totalMins / 60) + 'h ' + (totalMins % 60) + 'm' : timeEntries.length})`, icon: Clock },
                  { key: 'comments',      label: `Comments (${comments.length})`,          icon: MessageSquare },
                  { key: 'parts',         label: `Parts (${partsUsed.length})`,            icon: Package       },
                ] as const).map(t => {
                  const Icon = t.icon
                  return (
                    <button
                      key={t.key}
                      onClick={() => setTab(t.key)}
                      className={cn(
                        'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                        tab === t.key
                          ? 'border-brand-500 text-brand-400'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <Icon size={13} />
                      {t.label}
                    </button>
                  )
                })}
              </div>

              {/* ── Details tab — Overview dashboard ── */}
              {tab === 'details' && (
                <div className="space-y-5">

                  {/* Description / Notes */}
                  {wo.notes && (
                    <div className="bg-card border border-border rounded-xl p-5">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Description</h3>
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{wo.notes}</p>
                    </div>
                  )}

                  {/* Overview summary grid — click any tile to jump to that tab */}
                  <div className="grid grid-cols-3 gap-3">
                    {/* Tasks */}
                    <button
                      onClick={() => setTab('field_tickets')}
                      className="bg-card border border-border rounded-xl p-4 text-left hover:border-brand-500/50 hover:bg-accent/30 transition-all group"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <CheckCircle2 size={15} className="text-brand-400" />
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider group-hover:text-brand-400 transition-colors">Tasks →</span>
                      </div>
                      {totalCount > 0 ? (
                        <>
                          <p className="text-2xl font-bold text-foreground">{doneCount}<span className="text-base font-normal text-muted-foreground">/{totalCount}</span></p>
                          <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
                            <div className={cn('h-full rounded-full transition-all', progress === 100 ? 'bg-emerald-400' : 'bg-amber-400')} style={{ width: `${progress}%` }} />
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">No tasks yet</p>
                      )}
                    </button>

                    {/* Crew */}
                    <button
                      onClick={() => setTab('crew')}
                      className="bg-card border border-border rounded-xl p-4 text-left hover:border-brand-500/50 hover:bg-accent/30 transition-all group"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <Users size={15} className="text-violet-400" />
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider group-hover:text-brand-400 transition-colors">Crew →</span>
                      </div>
                      <p className="text-2xl font-bold text-foreground">
                        {crewCount === null ? '—' : crewCount}
                        <span className="text-sm font-normal text-muted-foreground ml-1">assigned</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{wo.assignee_name ?? 'No lead assigned'}</p>
                    </button>

                    {/* Schedule */}
                    <button
                      onClick={() => setTab('schedule')}
                      className="bg-card border border-border rounded-xl p-4 text-left hover:border-brand-500/50 hover:bg-accent/30 transition-all group"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <Calendar size={15} className="text-blue-400" />
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider group-hover:text-brand-400 transition-colors">Schedule →</span>
                      </div>
                      <p className="text-2xl font-bold text-foreground">
                        {phaseCount === null ? '—' : phaseCount}
                        <span className="text-sm font-normal text-muted-foreground ml-1">phase{phaseCount !== 1 ? 's' : ''}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{wo.scheduled_date ? fmtDate(wo.scheduled_date) : 'No date set'}</p>
                    </button>

                    {/* Time */}
                    <button
                      onClick={() => setTab('time')}
                      className="bg-card border border-border rounded-xl p-4 text-left hover:border-brand-500/50 hover:bg-accent/30 transition-all group"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <Clock size={15} className="text-amber-400" />
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider group-hover:text-brand-400 transition-colors">Time →</span>
                      </div>
                      <p className="text-2xl font-bold text-foreground">
                        {totalMins > 0 ? `${Math.floor(totalMins / 60)}h ${totalMins % 60}m` : '0h'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {activeTimeEntry ? '🟢 Clock running' : `${timeEntries.length} entr${timeEntries.length !== 1 ? 'ies' : 'y'}`}
                      </p>
                    </button>

                    {/* Comments */}
                    <button
                      onClick={() => setTab('comments')}
                      className="bg-card border border-border rounded-xl p-4 text-left hover:border-brand-500/50 hover:bg-accent/30 transition-all group"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <MessageSquare size={15} className="text-sky-400" />
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider group-hover:text-brand-400 transition-colors">Comments →</span>
                      </div>
                      <p className="text-2xl font-bold text-foreground">{comments.length}</p>
                      <p className="text-xs text-muted-foreground mt-1">{comments.length === 0 ? 'No comments yet' : `Last: ${timeAgo(comments[comments.length - 1].created_at)}`}</p>
                    </button>

                    {/* Parts */}
                    <button
                      onClick={() => setTab('parts')}
                      className="bg-card border border-border rounded-xl p-4 text-left hover:border-brand-500/50 hover:bg-accent/30 transition-all group"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <Package size={15} className="text-emerald-400" />
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider group-hover:text-brand-400 transition-colors">Parts →</span>
                      </div>
                      <p className="text-2xl font-bold text-foreground">{partsUsed.length}</p>
                      <p className="text-xs text-muted-foreground mt-1">{partsTotal > 0 ? `$${partsTotal.toFixed(2)} total` : 'No parts logged'}</p>
                    </button>
                  </div>

                  {/* Checklist — same data as Field Tickets Service Tasks, quick interactive view */}
                  <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-brand-400" />
                        Checklist
                        {totalCount > 0 && (
                          <span className="text-xs text-muted-foreground font-normal">({doneCount}/{totalCount})</span>
                        )}
                      </h3>
                      <button
                        onClick={() => setTab('field_tickets')}
                        className="text-xs text-brand-400 hover:text-brand-500 font-medium transition-colors"
                      >
                        Manage in Field Tickets →
                      </button>
                    </div>

                    <div className="divide-y divide-border/50">
                      {checklist.length === 0 && (
                        <p className="px-5 py-6 text-sm text-muted-foreground text-center">No tasks yet — add them in the Field Tickets tab</p>
                      )}
                      {checklist.map(item => {
                        const cat = CATEGORY_COLORS[item.category ?? 'task']
                        return (
                          <div key={item.id} className="flex items-center gap-3 px-5 py-3 group hover:bg-accent/30 transition-colors">
                            <button
                              onClick={() => handleToggleItem(item)}
                              className={cn(
                                'w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                                item.completed
                                  ? 'bg-emerald-400 border-emerald-400'
                                  : 'border-border hover:border-brand-400'
                              )}
                            >
                              {item.completed && <Check size={10} className="text-white" strokeWidth={3} />}
                            </button>
                            {item.category && item.category !== 'task' && (
                              <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 uppercase tracking-wide', cat)}>{item.category}</span>
                            )}
                            <span className={cn('flex-1 text-sm', item.completed && 'line-through text-muted-foreground')}>
                              {item.title}
                            </span>
                            {item.outcome && (
                              <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0',
                                item.outcome === 'pass' ? 'bg-emerald-500/10 text-emerald-400'
                                  : item.outcome === 'fail' ? 'bg-red-500/10 text-red-400'
                                  : 'bg-slate-500/10 text-slate-400'
                              )}>
                                {item.outcome === 'pass' ? '✓ PASS' : item.outcome === 'fail' ? '✗ FAIL' : 'N/A'}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* Quick-add */}
                    <div className="px-5 py-3 border-t border-border flex gap-2">
                      <input
                        value={newItem}
                        onChange={e => setNewItem(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleAddItem()}
                        placeholder="Quick-add a task…"
                        className="flex-1 text-sm px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                      />
                      <button
                        onClick={handleAddItem}
                        disabled={addingItem || !newItem.trim()}
                        className="px-3 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm rounded-lg disabled:opacity-40 transition-colors"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Sub-Work Orders */}
                  {subWOs.length > 0 && (
                    <div className="bg-card border border-border rounded-xl overflow-hidden">
                      <div className="px-5 py-3.5 border-b border-border">
                        <h3 className="text-sm font-semibold flex items-center gap-2">
                          <Wrench size={14} className="text-brand-400" />
                          Sub-Work Orders
                          <span className="text-xs text-muted-foreground font-normal">({subWOs.length})</span>
                        </h3>
                      </div>
                      <div className="divide-y divide-border/50">
                        {subWOs.map(sub => {
                          const ssc = STATUS_CFG[sub.status] ?? STATUS_CFG.open
                          return (
                            <Link
                              key={sub.id}
                              href={`/maintenance/${sub.id}`}
                              className="flex items-center gap-4 px-5 py-3 hover:bg-accent/30 transition-colors"
                            >
                              <span className="font-mono text-xs text-brand-400">{sub.wo_number}</span>
                              <span className="flex-1 text-sm font-medium text-foreground">{sub.title}</span>
                              {sub.assignee_name && (
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <div className="w-5 h-5 rounded-full bg-brand-900 flex items-center justify-center text-[10px] text-brand-300 font-semibold">
                                    {sub.assignee_name.split(' ').map(n => n[0]).join('')}
                                  </div>
                                  {sub.assignee_name}
                                </div>
                              )}
                              <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-semibold', ssc.bg, ssc.text)}>
                                {ssc.label}
                              </span>
                            </Link>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Field Tickets tab ── */}
              {tab === 'field_tickets' && wo && (
                <FieldTicketsTab
                  workOrderId={wo.id}
                  initialChecklist={checklist}
                  fieldTickets={fieldTickets}
                  onApproveFT={handleApproveFT}
                  onDeleteFT={handleDeleteFT}
                />
              )}

              {/* ── Time Tracking tab ── */}
              {tab === 'time' && (
                <div className="space-y-4">
                  {/* Clock-in card */}
                  <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-border">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Clock size={14} className="text-brand-400" />
                        Time Clock
                        {totalMins > 0 && (
                          <span className="ml-auto text-xs text-muted-foreground font-normal">
                            Total: <span className="text-foreground font-semibold">
                              {Math.floor(totalMins / 60)}h {totalMins % 60}m
                            </span>
                          </span>
                        )}
                      </h3>
                    </div>

                    {activeTimeEntry ? (
                      <div className="px-5 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-3 h-3 rounded-full bg-emerald-400" />
                            <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-emerald-400">
                              {activeTimeEntry.technician_name} is clocked in
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Since {new Date(activeTimeEntry.clock_in).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={handleClockOut}
                          disabled={timeSaving}
                          className="px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
                        >
                          {timeSaving ? 'Saving…' : '⏹ Clock Out'}
                        </button>
                      </div>
                    ) : (
                      <div className="px-5 py-4 flex items-center gap-3">
                        <input
                          value={clockTechName}
                          onChange={e => setClockTechName(e.target.value)}
                          placeholder="Technician name"
                          className="flex-1 text-sm px-3 py-2.5 border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                        />
                        <button
                          onClick={handleClockIn}
                          disabled={timeSaving || !clockTechName.trim()}
                          className="px-4 py-2.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 whitespace-nowrap"
                        >
                          {timeSaving ? 'Clocking…' : '▶ Clock In'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Time entries table */}
                  {timeEntries.length > 0 ? (
                    <div className="bg-card border border-border rounded-xl overflow-hidden">
                      <div className="px-5 py-3.5 border-b border-border">
                        <h3 className="text-sm font-semibold text-muted-foreground">Time Entries</h3>
                      </div>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-background/30">
                            <th className="text-left px-5 py-2.5 text-xs text-muted-foreground font-medium">Technician</th>
                            <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Clock In</th>
                            <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Clock Out</th>
                            <th className="text-right px-5 py-2.5 text-xs text-muted-foreground font-medium">Duration</th>
                          </tr>
                        </thead>
                        <tbody>
                          {timeEntries.map(e => {
                            const dur = e.duration_mins
                              ? `${Math.floor(e.duration_mins / 60)}h ${e.duration_mins % 60}m`
                              : '—'
                            const fmtTime = (iso: string) =>
                              new Date(iso).toLocaleString('en-US', {
                                month: 'short', day: 'numeric',
                                hour: 'numeric', minute: '2-digit',
                              })
                            return (
                              <tr key={e.id} className="border-b border-border/50 hover:bg-accent/30">
                                <td className="px-5 py-3 font-medium text-foreground">{e.technician_name}</td>
                                <td className="px-4 py-3 text-muted-foreground text-xs">{fmtTime(e.clock_in)}</td>
                                <td className="px-4 py-3 text-muted-foreground text-xs">
                                  {e.clock_out
                                    ? fmtTime(e.clock_out)
                                    : <span className="flex items-center gap-1 text-emerald-400">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                        Active
                                      </span>
                                  }
                                </td>
                                <td className="px-5 py-3 text-right font-semibold">{dur}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                        {totalMins > 0 && (
                          <tfoot>
                            <tr className="border-t border-border bg-background/30">
                              <td colSpan={3} className="px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total</td>
                              <td className="px-5 py-2.5 text-right text-sm font-bold text-foreground">
                                {Math.floor(totalMins / 60)}h {totalMins % 60}m
                              </td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  ) : (
                    <div className="bg-card border border-border rounded-xl flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Clock size={28} className="mb-2 opacity-20" />
                      <p className="text-sm">No time entries yet</p>
                      <p className="text-xs mt-1 opacity-70">Clock in to start tracking labor</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Comments tab ── */}
              {tab === 'comments' && (
                <div className="space-y-4">
                  {comments.length === 0 && (
                    <div className="bg-card border border-border rounded-xl flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <MessageSquare size={28} className="mb-2 opacity-20" />
                      <p className="text-sm">No comments yet</p>
                    </div>
                  )}

                  {comments.map(c => (
                    <div key={c.id} className="bg-card border border-border rounded-xl p-4 group">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-900 flex items-center justify-center text-[11px] text-brand-300 font-bold shrink-0">
                          {c.author_initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-foreground">{c.author_name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">{timeAgo(c.created_at)}</span>
                              <button
                                onClick={() => handleDeleteComment(c.id)}
                                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 text-red-400 transition-all"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>
                          <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">{c.content}</p>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Add comment */}
                  <div className="bg-card border border-border rounded-xl p-4">
                    <textarea
                      ref={commentInputRef}
                      value={newComment}
                      onChange={e => setNewComment(e.target.value)}
                      placeholder="Add a comment…"
                      rows={3}
                      className="w-full text-sm px-3 py-2.5 border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-brand-500/30 resize-none mb-3"
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={handlePostComment}
                        disabled={postingComment || !newComment.trim()}
                        className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg disabled:opacity-40 transition-colors"
                      >
                        <Send size={13} />
                        {postingComment ? 'Posting…' : 'Post Comment'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Parts tab ── */}
              {tab === 'parts' && (
                <div className="space-y-4">
                  <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Package size={14} className="text-brand-400" />
                        Parts Used
                      </h3>
                      {partsTotal > 0 && (
                        <span className="text-xs font-semibold text-foreground">
                          Total: ${partsTotal.toFixed(2)}
                        </span>
                      )}
                    </div>

                    {partsUsed.length === 0 && !showAddPart && (
                      <p className="px-5 py-8 text-sm text-muted-foreground text-center">No parts recorded yet</p>
                    )}

                    {partsUsed.length > 0 && (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-background/30">
                            <th className="text-left px-5 py-2.5 text-xs text-muted-foreground font-medium">Part</th>
                            <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">SKU</th>
                            <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Action</th>
                            <th className="text-center px-4 py-2.5 text-xs text-muted-foreground font-medium">Qty</th>
                            <th className="text-right px-4 py-2.5 text-xs text-muted-foreground font-medium">Unit Cost</th>
                            <th className="text-right px-4 py-2.5 text-xs text-muted-foreground font-medium">Total</th>
                            <th className="px-4 py-2.5" />
                          </tr>
                        </thead>
                        <tbody>
                          {partsUsed.map(p => {
                            const np = normPart(p)
                            const actionColors: Record<string, string> = {
                              used:      'bg-blue-500/10 text-blue-400',
                              installed: 'bg-emerald-500/10 text-emerald-400',
                              returned:  'bg-amber-500/10 text-amber-400',
                              warranty:  'bg-violet-500/10 text-violet-400',
                            }
                            return (
                              <tr key={p.id} className="border-b border-border/50 hover:bg-accent/30 group">
                                <td className="px-5 py-3 font-medium text-foreground">{np.name}</td>
                                <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{np.sku ?? '—'}</td>
                                <td className="px-4 py-3">
                                  <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize', actionColors[np.action] ?? 'bg-slate-500/10 text-slate-400')}>
                                    {np.action}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center text-muted-foreground">{np.qty}</td>
                                <td className="px-4 py-3 text-right text-muted-foreground">{np.unit_cost != null ? `$${np.unit_cost.toFixed(2)}` : '—'}</td>
                                <td className="px-4 py-3 text-right font-medium">{np.unit_cost != null ? `$${(np.unit_cost * np.qty).toFixed(2)}` : '—'}</td>
                                <td className="px-4 py-3 text-right">
                                  <button onClick={() => handleDeletePart(p.id)} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 text-red-400 transition-all">
                                    <Trash2 size={12} />
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                        {partsTotal > 0 && (
                          <tfoot>
                            <tr className="border-t border-border bg-background/30">
                              <td colSpan={5} className="px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Parts Total</td>
                              <td className="px-4 py-2.5 text-right text-sm font-bold text-foreground">${partsTotal.toFixed(2)}</td>
                              <td />
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    )}

                    {/* Add part form */}
                    {showAddPart ? (
                      <div className="px-5 py-4 border-t border-border space-y-3">
                        {/* Inventory search picker */}
                        <div className="relative">
                          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                          <input
                            value={invSearch}
                            onChange={e => handleInvSearch(e.target.value)}
                            placeholder="Search inventory (or enter manually below)…"
                            className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                          />
                          {selectedInvItem && (
                            <button
                              onClick={() => { setSelectedInvItem(null); setPartForm(f => ({ ...f, part_name: '', part_number: '' })) }}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-red-400"
                            >
                              <X size={12} />
                            </button>
                          )}
                          {/* Dropdown results */}
                          {invResults.length > 0 && (
                            <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-lg z-20 overflow-hidden max-h-48 overflow-y-auto">
                              {invSearching && <p className="px-3 py-2 text-xs text-muted-foreground">Searching…</p>}
                              {invResults.map(item => (
                                <button
                                  key={item.id}
                                  onClick={() => handleSelectInvItem(item)}
                                  className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-accent/50 text-left transition-colors"
                                >
                                  <div>
                                    <p className="text-sm font-medium text-foreground">{item.name}</p>
                                    <p className="text-xs text-muted-foreground">{item.sku ?? ''} · {item.category}</p>
                                  </div>
                                  <div className="text-right shrink-0 ml-3">
                                    <p className="text-xs font-semibold text-foreground">${item.unit_cost.toFixed(2)}</p>
                                    <p className={cn('text-xs', item.on_hand === 0 ? 'text-red-400' : item.on_hand <= 2 ? 'text-amber-400' : 'text-emerald-400')}>
                                      {item.on_hand} in stock
                                    </p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {selectedInvItem && (
                          <div className="flex items-center gap-2 px-3 py-2 bg-brand-500/10 rounded-lg text-xs text-brand-400">
                            <Package size={12} />
                            <span className="font-medium">{selectedInvItem.name}</span>
                            <span className="text-muted-foreground">· {selectedInvItem.on_hand} in stock</span>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                          <input
                            value={partForm.part_name}
                            onChange={e => setPartForm(f => ({ ...f, part_name: e.target.value }))}
                            placeholder="Part name *"
                            className="text-sm px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                          />
                          <input
                            value={partForm.part_number}
                            onChange={e => setPartForm(f => ({ ...f, part_number: e.target.value }))}
                            placeholder="SKU / Part # (optional)"
                            className="text-sm px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                          />
                          <input
                            type="number" min="1"
                            value={partForm.quantity}
                            onChange={e => setPartForm(f => ({ ...f, quantity: e.target.value }))}
                            placeholder="Qty"
                            className="text-sm px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                          />
                          <input
                            type="number" step="0.01" min="0"
                            value={partForm.unit_cost}
                            onChange={e => setPartForm(f => ({ ...f, unit_cost: e.target.value }))}
                            placeholder="Unit cost ($)"
                            className="text-sm px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                          />
                        </div>

                        {/* Action selector */}
                        <div className="flex gap-2">
                          {(['used', 'installed', 'returned', 'warranty'] as const).map(a => (
                            <button
                              key={a}
                              onClick={() => setPartForm(f => ({ ...f, action: a }))}
                              className={cn(
                                'flex-1 py-1.5 text-xs font-medium rounded-lg border capitalize transition-colors',
                                partForm.action === a
                                  ? 'bg-brand-500 text-white border-brand-500'
                                  : 'border-border text-muted-foreground hover:border-brand-400'
                              )}
                            >
                              {a}
                            </button>
                          ))}
                        </div>

                        <div className="flex gap-2">
                          <button onClick={() => { setShowAddPart(false); setSelectedInvItem(null); setInvResults([]) }} className="flex-1 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent transition-colors">Cancel</button>
                          <button onClick={handleAddPart} disabled={addingPart || !partForm.part_name.trim()} className="flex-1 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium disabled:opacity-40 transition-colors">
                            {addingPart ? 'Adding…' : 'Add Part'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="px-5 py-3 border-t border-border">
                        <button onClick={() => setShowAddPart(true)} className="flex items-center gap-1.5 text-sm text-brand-400 hover:text-brand-500 transition-colors">
                          <Plus size={14} /> Add Part
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Crew tab ── */}
              {tab === 'crew' && wo && (
                <CrewTab workOrderId={wo.id} techs={allTechs} />
              )}

              {/* ── Schedule tab ── */}
              {tab === 'schedule' && wo && (
                <ScheduleTab workOrderId={wo.id} />
              )}

              {/* ── Calls tab ── */}
              {tab === 'calls' && wo && (
                <CallsTab workOrderId={wo.id} workOrder={wo} />
              )}
            </div>

            {/* ── Right sidebar (1/3) ── */}
            <div className="space-y-4">

              {/* Details card */}
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Details</h3>
                </div>
                <div className="p-4 space-y-3.5">

                  <DetailRow icon={<Hash size={13} />} label="WO Number">
                    <span className="font-mono text-brand-400 text-xs">{wo.wo_number}</span>
                  </DetailRow>

                  <DetailRow icon={<Tag size={13} />} label="Category">
                    <span className="text-sm">{wo.category ?? wo.job_type}</span>
                  </DetailRow>

                  <DetailRow icon={<User size={13} />} label="Assigned To">
                    {wo.assignee_name ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-brand-900 flex items-center justify-center text-[10px] text-brand-300 font-semibold">
                          {wo.assignee_name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <span className="text-sm">{wo.assignee_name}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground/60 italic">Unassigned</span>
                    )}
                  </DetailRow>

                  <DetailRow icon={<Calendar size={13} />} label="Due Date">
                    <span className={cn('text-sm', isOverdue && 'text-red-400 font-semibold')}>
                      {fmtDate(wo.due_date)}
                      {isOverdue && ' · Overdue'}
                    </span>
                  </DetailRow>

                  {wo.scheduled_date && (
                    <DetailRow icon={<Clock size={13} />} label="Scheduled">
                      <span className="text-sm">{fmtDate(wo.scheduled_date)}</span>
                    </DetailRow>
                  )}

                  {wo.estimated_hours && (
                    <DetailRow icon={<Timer size={13} />} label="Est. Time">
                      <span className="text-sm">{wo.estimated_hours}h</span>
                    </DetailRow>
                  )}

                  {wo.location && (
                    <DetailRow icon={<MapPin size={13} />} label="Location">
                      <span className="text-sm">{wo.location}</span>
                    </DetailRow>
                  )}

                  {wo.completed_at && (
                    <DetailRow icon={<CheckCircle2 size={13} />} label="Completed">
                      <span className="text-sm text-emerald-400">{fmtDate(wo.completed_at)}</span>
                    </DetailRow>
                  )}
                </div>
              </div>

              {/* Site Address + Map card */}
              {(wo.site_address || wo.location) && (() => {
                const addr = [wo.site_address, wo.site_city, wo.site_state, wo.site_zip].filter(Boolean).join(', ')
                const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr || wo.location || '')}`
                return (
                  <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Navigation size={11} /> Site Location
                      </h3>
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-brand-400 hover:text-brand-500 font-semibold flex items-center gap-1"
                      >
                        Directions →
                      </a>
                    </div>
                    {/* Google Maps static embed (no API key needed for iframe embed) */}
                    <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="block">
                      <div className="w-full h-32 bg-muted relative overflow-hidden">
                        <iframe
                          title="site-map"
                          width="100%"
                          height="100%"
                          style={{ border: 0 }}
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                          src={`https://maps.google.com/maps?q=${encodeURIComponent(addr || wo.location || '')}&output=embed&z=15`}
                        />
                        {/* Overlay to make entire area clickable as a link */}
                        <div className="absolute inset-0 cursor-pointer" />
                      </div>
                    </a>
                    <div className="px-4 py-3">
                      <p className="text-sm font-medium text-foreground leading-snug">{wo.site_address || wo.location}</p>
                      {(wo.site_city || wo.site_state) && (
                        <p className="text-xs text-muted-foreground mt-0.5">{[wo.site_city, wo.site_state, wo.site_zip].filter(Boolean).join(', ')}</p>
                      )}
                      <div className="flex gap-2 mt-3">
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-brand-500/10 text-brand-400 hover:bg-brand-500/20 text-xs font-semibold rounded-lg transition-colors"
                        >
                          <Navigation size={11} /> Get Directions
                        </a>
                        <button
                          onClick={() => {
                            if (navigator.clipboard) navigator.clipboard.writeText(addr)
                          }}
                          className="px-3 py-2 bg-muted hover:bg-accent text-muted-foreground text-xs rounded-lg transition-colors"
                          title="Copy address"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Site Access Notes card — shown prominently for field tech */}
              {wo.site_access_notes && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-amber-500/20 flex items-center gap-1.5">
                    <AlertTriangle size={11} className="text-amber-400" />
                    <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Access Notes / Gate Codes</h3>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{wo.site_access_notes}</p>
                  </div>
                </div>
              )}

              {/* Site Contacts card */}
              {(wo.site_pm_name || wo.site_contact_name) && (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-border">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Site Contacts</h3>
                  </div>
                  <div className="p-4 space-y-3">
                    {wo.site_pm_name && (
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Property Manager</p>
                        <p className="text-sm font-medium text-foreground">{wo.site_pm_name}</p>
                        {wo.site_pm_phone && (
                          <a href={`tel:${wo.site_pm_phone}`} className="text-xs text-brand-400 hover:underline flex items-center gap-1 mt-0.5">
                            <PhoneCall size={10} /> {wo.site_pm_phone}
                          </a>
                        )}
                        {wo.site_pm_email && (
                          <button
                            onClick={() => { setEmailTo(wo.site_pm_email!); setEmailSlideOpen(true) }}
                            className="text-xs text-brand-400 hover:underline flex items-center gap-1 mt-0.5"
                          >
                            <Send size={10} /> {wo.site_pm_email}
                          </button>
                        )}
                      </div>
                    )}
                    {wo.site_contact_name && wo.site_contact_name !== wo.site_pm_name && (
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Primary Contact</p>
                        <p className="text-sm font-medium text-foreground">{wo.site_contact_name}</p>
                        {wo.site_contact_phone && (
                          <a href={`tel:${wo.site_contact_phone}`} className="text-xs text-brand-400 hover:underline flex items-center gap-1 mt-0.5">
                            <PhoneCall size={10} /> {wo.site_contact_phone}
                          </a>
                        )}
                        {wo.site_contact_email && (
                          <button
                            onClick={() => { setEmailTo(wo.site_contact_email!); setEmailSlideOpen(true) }}
                            className="text-xs text-brand-400 hover:underline flex items-center gap-1 mt-0.5"
                          >
                            <Send size={10} /> {wo.site_contact_email}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Quick actions */}
              <div className="bg-card border border-border rounded-xl p-4 space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Actions</h3>

                {wo.status === 'scheduled' && (
                  <button onClick={() => handleStatusChange('in_route')}
                    className="w-full py-2 px-3 rounded-lg bg-amber-500/10 text-amber-400 text-sm font-medium hover:bg-amber-500/20 transition-colors text-left flex items-center gap-2">
                    🚗 Mark En Route
                  </button>
                )}
                {wo.status === 'in_route' && (
                  <button onClick={() => handleStatusChange('on_site')}
                    className="w-full py-2 px-3 rounded-lg bg-orange-500/10 text-orange-400 text-sm font-medium hover:bg-orange-500/20 transition-colors text-left flex items-center gap-2">
                    🔧 Mark On Site
                  </button>
                )}
                {!['in_route', 'on_site', 'in_progress', 'completed'].includes(wo.status) && (
                  <button onClick={() => handleStatusChange('in_progress')}
                    className="w-full py-2 px-3 rounded-lg bg-amber-500/10 text-amber-400 text-sm font-medium hover:bg-amber-500/20 transition-colors text-left flex items-center gap-2">
                    <Wrench size={13} /> Mark In Progress
                  </button>
                )}
                {wo.status !== 'completed' && (
                  <button onClick={() => handleStatusChange('completed')}
                    className="w-full py-2 px-3 rounded-lg bg-emerald-500/10 text-emerald-400 text-sm font-medium hover:bg-emerald-500/20 transition-colors text-left flex items-center gap-2">
                    <CheckCircle2 size={13} /> Mark Complete
                  </button>
                )}
                <button onClick={() => { setTab('comments'); commentInputRef.current?.focus() }}
                  className="w-full py-2 px-3 rounded-lg bg-muted text-muted-foreground text-sm font-medium hover:bg-accent transition-colors text-left flex items-center gap-2">
                  <MessageSquare size={13} /> Add Comment
                </button>
                <button onClick={() => setEmailSlideOpen(true)}
                  className="w-full py-2 px-3 rounded-lg bg-muted text-muted-foreground text-sm font-medium hover:bg-accent transition-colors text-left flex items-center gap-2">
                  <Send size={13} /> Send Email
                </button>
                <button onClick={() => setTab('calls')}
                  className="w-full py-2 px-3 rounded-lg bg-muted text-muted-foreground text-sm font-medium hover:bg-accent transition-colors text-left flex items-center gap-2">
                  <PhoneCall size={13} /> Log a Call
                </button>
                <button onClick={() => setEditOpen(true)}
                  className="w-full py-2 px-3 rounded-lg bg-muted text-muted-foreground text-sm font-medium hover:bg-accent transition-colors text-left flex items-center gap-2">
                  <Edit2 size={13} /> Edit Work Order
                </button>
              </div>

              {/* Timestamps */}
              <div className="text-xs text-muted-foreground space-y-1 px-1">
                <div>Created: {fmtDate(wo.created_at)}</div>
                <div>Updated: {timeAgo(wo.updated_at)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── CrewTab ───────────────────────────────────────────────────────────────────

function CrewTab({ workOrderId, techs }: { workOrderId: string; techs: { id: string; name: string; initials: string; role: string }[] }) {
  interface CrewMember {
    id: string
    role: string
    technician: { id: string; name: string; initials: string; role: string; phone?: string; email?: string; status?: string }
  }
  const [crew, setCrew]       = useState<CrewMember[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding]   = useState(false)
  const [selectedTechId, setSelectedTechId] = useState('')
  const [selectedRole, setSelectedRole]     = useState('crew')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/maintenance/${workOrderId}/crew`)
      .then(r => r.json())
      .then(d => { setCrew(d.crew ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [workOrderId])

  const handleAdd = async () => {
    if (!selectedTechId) { setError('Select a technician'); return }
    setSaving(true); setError(null)
    try {
      const res = await fetch(`/api/maintenance/${workOrderId}/crew`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ technician_id: selectedTechId, role: selectedRole }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? 'Failed') }
      const { member } = await res.json()
      setCrew(prev => [...prev, member])
      setAdding(false)
      setSelectedTechId('')
      setSelectedRole('crew')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (memberId: string) => {
    const res = await fetch(`/api/maintenance/${workOrderId}/crew?member_id=${memberId}`, { method: 'DELETE' })
    if (res.ok) setCrew(prev => prev.filter(m => m.id !== memberId))
  }

  const assignedIds = new Set(crew.map(m => m.technician.id))
  const available = techs.filter(t => !assignedIds.has(t.id))

  const ROLE_COLORS: Record<string, string> = {
    lead:       'bg-blue-100 text-blue-700',
    owner:      'bg-violet-100 text-violet-700',
    supervisor: 'bg-amber-100 text-amber-700',
    crew:       'bg-slate-100 text-slate-600',
  }

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading crew…</div>

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Assigned Crew</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{crew.length} member{crew.length !== 1 ? 's' : ''} on this job</p>
        </div>
        <button
          onClick={() => { setAdding(true); setError(null) }}
          className="flex items-center gap-1.5 text-xs bg-[#6B7EFF] text-white px-3 py-1.5 rounded-lg hover:bg-[#5B6EEF] font-medium"
        >
          <Plus size={13} /> Add Crew
        </button>
      </div>

      {/* Add crew form */}
      {adding && (
        <div className="border border-border rounded-xl p-4 bg-slate-50/50 space-y-3">
          <p className="text-xs font-semibold text-foreground">Add crew member</p>
          <select
            className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#6B7EFF] bg-background"
            value={selectedTechId}
            onChange={e => setSelectedTechId(e.target.value)}
          >
            <option value="">— Select technician —</option>
            {available.map(t => (
              <option key={t.id} value={t.id}>{t.name} ({t.role})</option>
            ))}
          </select>
          <select
            className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#6B7EFF] bg-background"
            value={selectedRole}
            onChange={e => setSelectedRole(e.target.value)}
          >
            <option value="lead">Lead Tech</option>
            <option value="crew">Crew</option>
            <option value="supervisor">Supervisor</option>
            <option value="owner">Owner / On-Site</option>
          </select>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={saving} className="flex-1 text-xs bg-[#6B7EFF] text-white py-2 rounded-lg font-medium hover:bg-[#5B6EEF] disabled:opacity-50">
              {saving ? 'Adding…' : 'Add to Job'}
            </button>
            <button onClick={() => setAdding(false)} className="flex-1 text-xs border border-border text-muted-foreground py-2 rounded-lg hover:bg-accent">
              Cancel
            </button>
          </div>
        </div>
      )}

      {crew.length === 0 && !adding ? (
        <div className="border border-dashed border-border rounded-xl p-8 text-center">
          <Users size={24} className="text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No crew assigned yet</p>
          <button onClick={() => setAdding(true)} className="text-xs text-[#6B7EFF] hover:underline mt-1">Add first crew member →</button>
        </div>
      ) : (
        <div className="space-y-2">
          {crew.map(member => (
            <div key={member.id} className="flex items-center gap-3 bg-white border border-border rounded-xl px-4 py-3">
              <div className="w-8 h-8 rounded-full bg-[#6B7EFF] text-white text-xs font-bold flex items-center justify-center shrink-0">
                {member.technician.initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{member.technician.name}</p>
                <p className="text-xs text-muted-foreground">{member.technician.role}{member.technician.phone ? ` · ${member.technician.phone}` : ''}</p>
              </div>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${ROLE_COLORS[member.role] ?? ROLE_COLORS.crew}`}>
                {member.role === 'lead' ? 'Lead' : member.role === 'owner' ? 'Owner' : member.role === 'supervisor' ? 'Supervisor' : 'Crew'}
              </span>
              <button onClick={() => handleRemove(member.id)} className="text-muted-foreground hover:text-red-500 transition-colors ml-1">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── ScheduleTab ───────────────────────────────────────────────────────────────

function ScheduleTab({ workOrderId }: { workOrderId: string }) {
  interface Phase {
    id: string
    name: string
    scheduled_date: string | null
    end_date: string | null
    status: string
    notes: string | null
    sort_order: number
  }
  const [phases, setPhases]         = useState<Phase[]>([])
  const [loading, setLoading]       = useState(true)
  const [adding, setAdding]         = useState(false)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [form, setForm]             = useState({ name: '', scheduled_date: '', end_date: '', notes: '' })
  const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null)
  const [editPhaseForm, setEditPhaseForm]   = useState({ name: '', scheduled_date: '', end_date: '', notes: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError]   = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/maintenance/${workOrderId}/phases`)
      .then(r => r.json())
      .then(d => { setPhases(d.phases ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [workOrderId])

  const handleAdd = async () => {
    if (!form.name.trim()) { setError('Phase name is required'); return }
    setSaving(true); setError(null)
    try {
      const res = await fetch(`/api/maintenance/${workOrderId}/phases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      const { phase } = await res.json()
      setPhases(prev => [...prev, phase])
      setAdding(false)
      setForm({ name: '', scheduled_date: '', end_date: '', notes: '' })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  const cycleStatus = async (phase: Phase) => {
    const next: Record<string, string> = { pending: 'in_progress', in_progress: 'complete', complete: 'pending', skipped: 'pending' }
    const newStatus = next[phase.status] ?? 'pending'
    const res = await fetch(`/api/maintenance/${workOrderId}/phases/${phase.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) setPhases(prev => prev.map(p => p.id === phase.id ? { ...p, status: newStatus } : p))
  }

  const handleDelete = async (phaseId: string) => {
    const res = await fetch(`/api/maintenance/${workOrderId}/phases/${phaseId}`, { method: 'DELETE' })
    if (res.ok) setPhases(prev => prev.filter(p => p.id !== phaseId))
  }

  const startEdit = (phase: Phase) => {
    setEditingPhaseId(phase.id)
    setEditPhaseForm({
      name:           phase.name,
      scheduled_date: phase.scheduled_date ?? '',
      end_date:       phase.end_date ?? '',
      notes:          phase.notes ?? '',
    })
    setEditError(null)
  }

  const cancelEdit = () => {
    setEditingPhaseId(null)
    setEditError(null)
  }

  const handleEditSave = async () => {
    if (!editingPhaseId) return
    if (!editPhaseForm.name.trim()) { setEditError('Phase name is required'); return }
    setEditSaving(true); setEditError(null)
    try {
      const res = await fetch(`/api/maintenance/${workOrderId}/phases/${editingPhaseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editPhaseForm),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      const { phase } = await res.json()
      setPhases(prev => prev.map(p => p.id === editingPhaseId ? phase : p))
      setEditingPhaseId(null)
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setEditSaving(false)
    }
  }

  const PHASE_STATUS_CFG: Record<string, { label: string; color: string }> = {
    pending:     { label: 'Pending',     color: 'bg-slate-100 text-slate-500' },
    in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700' },
    complete:    { label: 'Complete',    color: 'bg-emerald-100 text-emerald-700' },
    skipped:     { label: 'Skipped',     color: 'bg-amber-100 text-amber-600' },
  }

  const fmtPhaseDate = (d: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading schedule…</div>

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Job Phases / Schedule</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {phases.length === 0 ? 'Single-day job — add phases for multi-day or staged work' : `${phases.length} phase${phases.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={() => { setAdding(true); setError(null) }}
          className="flex items-center gap-1.5 text-xs bg-[#6B7EFF] text-white px-3 py-1.5 rounded-lg hover:bg-[#5B6EEF] font-medium"
        >
          <Plus size={13} /> Add Phase
        </button>
      </div>

      {adding && (
        <div className="border border-border rounded-xl p-4 bg-slate-50/50 space-y-3">
          <p className="text-xs font-semibold text-foreground">New phase / day</p>
          <input
            className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#6B7EFF] bg-background"
            placeholder={'Name — e.g. "Day 1 – Rough-in" or "Phase 2 – Commissioning"'}
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide block mb-1">Start Date</label>
              <input
                type="date"
                className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#6B7EFF] bg-background"
                value={form.scheduled_date}
                onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide block mb-1">End Date (optional)</label>
              <input
                type="date"
                className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#6B7EFF] bg-background"
                value={form.end_date}
                onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
              />
            </div>
          </div>
          <textarea
            className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#6B7EFF] bg-background resize-none"
            rows={2}
            placeholder="Notes for this phase (optional)"
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={saving} className="flex-1 text-xs bg-[#6B7EFF] text-white py-2 rounded-lg font-medium hover:bg-[#5B6EEF] disabled:opacity-50">
              {saving ? 'Adding…' : 'Add Phase'}
            </button>
            <button onClick={() => setAdding(false)} className="flex-1 text-xs border border-border text-muted-foreground py-2 rounded-lg hover:bg-accent">
              Cancel
            </button>
          </div>
        </div>
      )}

      {phases.length === 0 && !adding ? (
        <div className="border border-dashed border-border rounded-xl p-8 text-center">
          <Calendar size={24} className="text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground font-medium">No phases defined</p>
          <p className="text-xs text-muted-foreground mt-1 mb-3">Add phases to split this job across multiple days or stages</p>
          <button onClick={() => setAdding(true)} className="text-xs text-[#6B7EFF] hover:underline">Add first phase →</button>
        </div>
      ) : (
        <div className="space-y-2">
          {phases.map((phase, idx) => {
            const cfg = PHASE_STATUS_CFG[phase.status] ?? PHASE_STATUS_CFG.pending
            const isEditing = editingPhaseId === phase.id
            return (
              <div key={phase.id} className="bg-white border border-border rounded-xl overflow-hidden">
                {isEditing ? (
                  <div className="px-4 py-3 space-y-3">
                    <p className="text-xs font-semibold text-foreground">Edit phase {idx + 1}</p>
                    <input
                      className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#6B7EFF] bg-background"
                      placeholder="Phase name"
                      value={editPhaseForm.name}
                      onChange={e => setEditPhaseForm(f => ({ ...f, name: e.target.value }))}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide block mb-1">Start Date</label>
                        <input
                          type="date"
                          className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#6B7EFF] bg-background"
                          value={editPhaseForm.scheduled_date}
                          onChange={e => setEditPhaseForm(f => ({ ...f, scheduled_date: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide block mb-1">End Date</label>
                        <input
                          type="date"
                          className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#6B7EFF] bg-background"
                          value={editPhaseForm.end_date}
                          onChange={e => setEditPhaseForm(f => ({ ...f, end_date: e.target.value }))}
                        />
                      </div>
                    </div>
                    <textarea
                      className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#6B7EFF] bg-background resize-none"
                      rows={2}
                      placeholder="Notes (optional)"
                      value={editPhaseForm.notes}
                      onChange={e => setEditPhaseForm(f => ({ ...f, notes: e.target.value }))}
                    />
                    {editError && <p className="text-xs text-red-500">{editError}</p>}
                    <div className="flex gap-2">
                      <button onClick={handleEditSave} disabled={editSaving} className="flex-1 text-xs bg-[#6B7EFF] text-white py-2 rounded-lg font-medium hover:bg-[#5B6EEF] disabled:opacity-50">
                        {editSaving ? 'Saving…' : 'Save Changes'}
                      </button>
                      <button onClick={cancelEdit} className="flex-1 text-xs border border-border text-muted-foreground py-2 rounded-lg hover:bg-accent">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="px-4 py-3 flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{phase.name}</p>
                      {(phase.scheduled_date || phase.end_date) && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {fmtPhaseDate(phase.scheduled_date)}
                          {phase.end_date && phase.end_date !== phase.scheduled_date ? ` → ${fmtPhaseDate(phase.end_date)}` : ''}
                        </p>
                      )}
                      {phase.notes && <p className="text-xs text-muted-foreground mt-1 italic">{phase.notes}</p>}
                    </div>
                    <button
                      onClick={() => cycleStatus(phase)}
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0 hover:opacity-80 transition-opacity cursor-pointer ${cfg.color}`}
                      title="Click to advance status"
                    >
                      {cfg.label}
                    </button>
                    <button
                      onClick={() => startEdit(phase)}
                      className="text-muted-foreground hover:text-[#6B7EFF] transition-colors mt-0.5 shrink-0"
                      title="Edit phase"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    <button onClick={() => handleDelete(phase.id)} className="text-muted-foreground hover:text-red-500 transition-colors mt-0.5 shrink-0">
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── FieldTicketsTab ───────────────────────────────────────────────────────────
// Two-section structured field packet: Service Tasks + Equipment Manifest.
// Management pre-builds before dispatch; tech checks off and confirms on-site.

interface FTTabProps {
  workOrderId: string
  initialChecklist: ChecklistItem[]
  fieldTickets: FieldTicket[]
  onApproveFT: (ft: FieldTicket) => void
  onDeleteFT: (id: string) => void
}

const CATEGORY_CFG: Record<string, { label: string; bg: string; text: string }> = {
  task:         { label: 'Task',         bg: 'bg-blue-500/10',    text: 'text-blue-400'    },
  safety:       { label: 'Safety',       bg: 'bg-red-500/10',     text: 'text-red-400'     },
  inspection:   { label: 'Inspect',      bg: 'bg-violet-500/10',  text: 'text-violet-400'  },
  verification: { label: 'Verify',       bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
}

function FieldTicketsTab({ workOrderId, initialChecklist, fieldTickets, onApproveFT, onDeleteFT }: FTTabProps) {
  // ── Service Tasks state ─────────────────────────────────────────────────────
  const [tasks, setTasks]           = useState<ChecklistItem[]>(initialChecklist)
  const [showAddTask, setShowAddTask] = useState(false)
  const [taskForm, setTaskForm]     = useState({ title: '', category: 'task', added_by: 'management', notes: '' })
  const [savingTask, setSavingTask] = useState(false)
  const [expandedTask, setExpandedTask] = useState<string | null>(null)

  // ── Equipment Manifest state ────────────────────────────────────────────────
  const [equipment, setEquipment]     = useState<InstalledEquipment[]>([])
  const [equipLoading, setEquipLoading] = useState(true)
  const [showAddEquip, setShowAddEquip] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [equipForm, setEquipForm]     = useState({
    name: '', make: '', model: '', sku: '', qty: '1',
    condition: 'new', notes: '', added_by: 'management',
  })
  const [confirmForm, setConfirmForm] = useState({ serial_number: '', location: '', confirmed_by: '' })
  const [savingEquip, setSavingEquip] = useState(false)

  // ── Old field ticket collapse state ────────────────────────────────────────
  const [showLegacy, setShowLegacy] = useState(false)

  useEffect(() => {
    fetch(`/api/maintenance/${workOrderId}/equipment`)
      .then(r => r.json())
      .then(d => { setEquipment(d.equipment ?? []) })
      .catch(() => {})
      .finally(() => setEquipLoading(false))
  }, [workOrderId])

  // ── Task handlers ───────────────────────────────────────────────────────────
  const handleAddTask = async () => {
    if (!taskForm.title.trim()) return
    setSavingTask(true)
    try {
      const res  = await fetch(`/api/maintenance/${workOrderId}/checklist`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:    taskForm.title.trim(),
          category: taskForm.category,
          added_by: taskForm.added_by,
          notes:    taskForm.notes.trim() || null,
          sort_order: tasks.length,
        }),
      })
      const json = await res.json()
      if (res.ok) {
        setTasks(t => [...t, json.item])
        setTaskForm({ title: '', category: 'task', added_by: 'management', notes: '' })
        setShowAddTask(false)
      }
    } finally { setSavingTask(false) }
  }

  const handleToggleTask = async (task: ChecklistItem) => {
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: !t.completed } : t))
    const res  = await fetch(`/api/maintenance/${workOrderId}/checklist`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: task.id, completed: !task.completed }),
    })
    const json = await res.json()
    if (res.ok) setTasks(prev => prev.map(t => t.id === task.id ? json.item : t))
    else setTasks(prev => prev.map(t => t.id === task.id ? task : t))
  }

  const handleSetOutcome = async (task: ChecklistItem, outcome: 'pass' | 'fail' | 'na') => {
    const next = task.outcome === outcome ? null : outcome
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, outcome: next } : t))
    await fetch(`/api/maintenance/${workOrderId}/checklist`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: task.id, outcome: next }),
    })
  }

  const handleDeleteTask = async (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId))
    await fetch(`/api/maintenance/${workOrderId}/checklist`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: taskId }),
    })
  }

  // ── Equipment handlers ──────────────────────────────────────────────────────
  const handleAddEquip = async () => {
    if (!equipForm.name.trim()) return
    setSavingEquip(true)
    try {
      const res  = await fetch(`/api/maintenance/${workOrderId}/equipment`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:      equipForm.name.trim(),
          make:      equipForm.make.trim()  || null,
          model:     equipForm.model.trim() || null,
          sku:       equipForm.sku.trim()   || null,
          qty:       parseInt(equipForm.qty) || 1,
          condition: equipForm.condition,
          notes:     equipForm.notes.trim() || null,
          added_by:  equipForm.added_by,
        }),
      })
      const json = await res.json()
      if (res.ok) {
        setEquipment(e => [...e, json.item])
        setEquipForm({ name: '', make: '', model: '', sku: '', qty: '1', condition: 'new', notes: '', added_by: 'management' })
        setShowAddEquip(false)
      }
    } finally { setSavingEquip(false) }
  }

  const handleConfirmEquip = async (item: InstalledEquipment) => {
    setSavingEquip(true)
    try {
      const res  = await fetch(`/api/maintenance/${workOrderId}/equipment/${item.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmed:     true,
          serial_number: confirmForm.serial_number.trim() || null,
          location:      confirmForm.location.trim()      || null,
          confirmed_by:  confirmForm.confirmed_by.trim()  || null,
        }),
      })
      const json = await res.json()
      if (res.ok) {
        setEquipment(prev => prev.map(e => e.id === item.id ? json.item : e))
        setConfirmingId(null)
        setConfirmForm({ serial_number: '', location: '', confirmed_by: '' })
      }
    } finally { setSavingEquip(false) }
  }

  const handleDeleteEquip = async (itemId: string) => {
    setEquipment(prev => prev.filter(e => e.id !== itemId))
    await fetch(`/api/maintenance/${workOrderId}/equipment/${itemId}`, { method: 'DELETE' })
  }

  // ── Derived ─────────────────────────────────────────────────────────────────
  const tasksDone  = tasks.filter(t => t.completed).length
  const equipDone  = equipment.filter(e => e.confirmed).length
  const inp        = 'w-full text-sm px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-brand-500/30'

  return (
    <div className="space-y-5">

      {/* ── Section 1: Service Tasks ── */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <CheckCircle2 size={14} className="text-brand-400" />
            Service Tasks
            {tasks.length > 0 && (
              <span className="text-xs text-muted-foreground font-normal">({tasksDone}/{tasks.length} done)</span>
            )}
          </h3>
          <button
            onClick={() => setShowAddTask(true)}
            className="flex items-center gap-1 text-xs bg-brand-500 text-white px-2.5 py-1.5 rounded-lg hover:bg-brand-600 font-medium"
          >
            <Plus size={12} /> Add Task
          </button>
        </div>

        {tasks.length === 0 && !showAddTask && (
          <div className="px-5 py-8 text-center text-muted-foreground">
            <ClipboardList size={24} className="mx-auto mb-2 opacity-20" />
            <p className="text-sm">No tasks built yet</p>
            <p className="text-xs mt-1 opacity-70">Management adds tasks before dispatch — tech checks them off on site</p>
          </div>
        )}

        <div className="divide-y divide-border/40">
          {tasks.map(task => {
            const catCfg = CATEGORY_CFG[task.category ?? 'task'] ?? CATEGORY_CFG.task
            const isExpanded = expandedTask === task.id
            return (
              <div key={task.id} className="group">
                <div className="flex items-center gap-3 px-5 py-3 hover:bg-accent/20 transition-colors">
                  {/* Checkbox */}
                  <button
                    onClick={() => handleToggleTask(task)}
                    className={cn(
                      'w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                      task.completed
                        ? 'bg-emerald-400 border-emerald-400'
                        : 'border-border hover:border-brand-400'
                    )}
                  >
                    {task.completed && <Check size={10} className="text-white" strokeWidth={3} />}
                  </button>

                  {/* Category badge */}
                  <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-md shrink-0', catCfg.bg, catCfg.text)}>
                    {catCfg.label}
                  </span>

                  {/* Title */}
                  <span
                    className={cn('flex-1 text-sm cursor-pointer', task.completed && 'line-through text-muted-foreground')}
                    onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                  >
                    {task.title}
                  </span>

                  {/* Added-by badge */}
                  {task.added_by === 'tech' && (
                    <span className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5 shrink-0">
                      Added on-site
                    </span>
                  )}

                  {/* Outcome buttons — only show after completing */}
                  {task.completed && (
                    <div className="flex gap-1 shrink-0">
                      {(['pass', 'fail', 'na'] as const).map(o => (
                        <button
                          key={o}
                          onClick={() => handleSetOutcome(task, o)}
                          className={cn(
                            'text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors',
                            task.outcome === o
                              ? o === 'pass' ? 'bg-emerald-400 text-white'
                                : o === 'fail' ? 'bg-red-400 text-white'
                                : 'bg-slate-400 text-white'
                              : 'border border-border text-muted-foreground hover:border-foreground'
                          )}
                        >
                          {o === 'pass' ? '✓ PASS' : o === 'fail' ? '✗ FAIL' : 'N/A'}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Delete */}
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 text-red-400 transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>

                {/* Expanded notes area */}
                {isExpanded && (
                  <div className="px-5 pb-3 pt-0 bg-accent/10">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Notes</p>
                    <p className="text-xs text-foreground">{task.notes || <span className="italic text-muted-foreground">No notes</span>}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Add task form */}
        {showAddTask && (
          <div className="px-5 py-4 border-t border-border space-y-3 bg-background/50">
            <input
              value={taskForm.title}
              onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleAddTask()}
              placeholder="Task description *"
              className={inp}
              autoFocus
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Category</p>
                <div className="flex gap-1.5 flex-wrap">
                  {(['task', 'safety', 'inspection', 'verification'] as const).map(c => (
                    <button
                      key={c}
                      onClick={() => setTaskForm(f => ({ ...f, category: c }))}
                      className={cn(
                        'text-[10px] font-semibold px-2 py-1 rounded-md border transition-colors capitalize',
                        taskForm.category === c
                          ? `${CATEGORY_CFG[c].bg} ${CATEGORY_CFG[c].text} border-transparent`
                          : 'border-border text-muted-foreground hover:border-foreground'
                      )}
                    >
                      {CATEGORY_CFG[c].label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Added by</p>
                <div className="flex gap-1.5">
                  {(['management', 'tech'] as const).map(a => (
                    <button
                      key={a}
                      onClick={() => setTaskForm(f => ({ ...f, added_by: a }))}
                      className={cn(
                        'text-[10px] font-semibold px-2 py-1 rounded-md border capitalize transition-colors',
                        taskForm.added_by === a
                          ? 'bg-brand-500 text-white border-transparent'
                          : 'border-border text-muted-foreground hover:border-foreground'
                      )}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <input
              value={taskForm.notes}
              onChange={e => setTaskForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Notes (optional)"
              className={inp}
            />
            <div className="flex gap-2">
              <button onClick={() => { setShowAddTask(false); setTaskForm({ title: '', category: 'task', added_by: 'management', notes: '' }) }}
                className="flex-1 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent transition-colors">
                Cancel
              </button>
              <button onClick={handleAddTask} disabled={savingTask || !taskForm.title.trim()}
                className="flex-1 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium disabled:opacity-40 transition-colors">
                {savingTask ? 'Adding…' : 'Add Task'}
              </button>
            </div>
          </div>
        )}

        {/* Progress bar */}
        {tasks.length > 0 && (
          <div className="px-5 py-2.5 border-t border-border/50 bg-background/30">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-500', tasksDone === tasks.length ? 'bg-emerald-400' : 'bg-amber-400')}
                  style={{ width: `${tasks.length > 0 ? Math.round((tasksDone / tasks.length) * 100) : 0}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{tasksDone}/{tasks.length}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Section 2: Equipment Manifest ── */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Package size={14} className="text-brand-400" />
            Equipment Manifest
            {equipment.length > 0 && (
              <span className="text-xs text-muted-foreground font-normal">({equipDone}/{equipment.length} confirmed)</span>
            )}
          </h3>
          <button
            onClick={() => setShowAddEquip(true)}
            className="flex items-center gap-1 text-xs bg-brand-500 text-white px-2.5 py-1.5 rounded-lg hover:bg-brand-600 font-medium"
          >
            <Plus size={12} /> Add Equipment
          </button>
        </div>

        {equipLoading ? (
          <p className="px-5 py-6 text-sm text-muted-foreground text-center">Loading…</p>
        ) : equipment.length === 0 && !showAddEquip ? (
          <div className="px-5 py-8 text-center text-muted-foreground">
            <Package size={24} className="mx-auto mb-2 opacity-20" />
            <p className="text-sm">No equipment listed yet</p>
            <p className="text-xs mt-1 opacity-70">Management adds expected equipment — tech confirms serial numbers on-site</p>
          </div>
        ) : null}

        <div className="divide-y divide-border/40">
          {equipment.map(item => (
            <div key={item.id} className="group">
              <div className="flex items-start gap-3 px-5 py-3.5 hover:bg-accent/20 transition-colors">
                {/* Confirmed indicator */}
                <div className={cn(
                  'w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                  item.confirmed ? 'bg-emerald-400' : 'bg-amber-500/20 border-2 border-amber-400/50'
                )}>
                  {item.confirmed
                    ? <Check size={10} className="text-white" strokeWidth={3} />
                    : <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  }
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">{item.name}</span>
                    {item.make && <span className="text-xs text-muted-foreground">{item.make}</span>}
                    {item.model && <span className="text-xs text-muted-foreground">· {item.model}</span>}
                    {item.qty > 1 && (
                      <span className="text-[10px] font-semibold bg-slate-500/10 text-slate-400 px-1.5 py-0.5 rounded">×{item.qty}</span>
                    )}
                    {item.condition && (
                      <span className={cn(
                        'text-[10px] font-semibold px-1.5 py-0.5 rounded capitalize',
                        item.condition === 'new'      ? 'bg-emerald-500/10 text-emerald-400'
                          : item.condition === 'replaced' ? 'bg-amber-500/10 text-amber-400'
                          : 'bg-slate-500/10 text-slate-400'
                      )}>
                        {item.condition}
                      </span>
                    )}
                  </div>

                  {item.confirmed ? (
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {item.serial_number && (
                        <span className="text-xs text-muted-foreground font-mono">SN: {item.serial_number}</span>
                      )}
                      {item.location && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin size={10} /> {item.location}
                        </span>
                      )}
                      {item.confirmed_by && (
                        <span className="text-xs text-emerald-400">✓ {item.confirmed_by}</span>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-amber-400 mt-1">Pending confirmation by tech</p>
                  )}

                  {item.sku && <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">SKU: {item.sku}</p>}
                  {item.notes && <p className="text-xs text-muted-foreground mt-0.5 italic">{item.notes}</p>}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!item.confirmed && (
                    <button
                      onClick={() => { setConfirmingId(item.id); setConfirmForm({ serial_number: item.serial_number ?? '', location: item.location ?? '', confirmed_by: '' }) }}
                      className="text-xs font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      Confirm Install
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteEquip(item.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 text-red-400 transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              {/* Inline confirm form */}
              {confirmingId === item.id && (
                <div className="px-5 py-3 bg-emerald-500/5 border-t border-emerald-500/20 space-y-2">
                  <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Confirm Installation</p>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      value={confirmForm.serial_number}
                      onChange={e => setConfirmForm(f => ({ ...f, serial_number: e.target.value }))}
                      placeholder="Serial number"
                      className={inp}
                    />
                    <input
                      value={confirmForm.location}
                      onChange={e => setConfirmForm(f => ({ ...f, location: e.target.value }))}
                      placeholder="Location (e.g. Main Gate)"
                      className={inp}
                    />
                    <input
                      value={confirmForm.confirmed_by}
                      onChange={e => setConfirmForm(f => ({ ...f, confirmed_by: e.target.value }))}
                      placeholder="Tech name"
                      className={inp}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmingId(null)} className="flex-1 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-accent">Cancel</button>
                    <button onClick={() => handleConfirmEquip(item)} disabled={savingEquip}
                      className="flex-1 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold disabled:opacity-50">
                      {savingEquip ? 'Saving…' : '✓ Mark Installed'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add equipment form */}
        {showAddEquip && (
          <div className="px-5 py-4 border-t border-border space-y-3 bg-background/50">
            <div className="grid grid-cols-2 gap-2">
              <input value={equipForm.name} onChange={e => setEquipForm(f => ({ ...f, name: e.target.value }))} placeholder="Equipment name *" className={inp} autoFocus />
              <input value={equipForm.make} onChange={e => setEquipForm(f => ({ ...f, make: e.target.value }))} placeholder="Make / Brand" className={inp} />
              <input value={equipForm.model} onChange={e => setEquipForm(f => ({ ...f, model: e.target.value }))} placeholder="Model" className={inp} />
              <input value={equipForm.sku} onChange={e => setEquipForm(f => ({ ...f, sku: e.target.value }))} placeholder="SKU (optional)" className={inp} />
              <input type="number" min="1" value={equipForm.qty} onChange={e => setEquipForm(f => ({ ...f, qty: e.target.value }))} placeholder="Qty" className={inp} />
              <div className="relative">
                <select value={equipForm.condition} onChange={e => setEquipForm(f => ({ ...f, condition: e.target.value }))}
                  className={cn(inp, 'appearance-none pr-7')}>
                  <option value="new">New Install</option>
                  <option value="existing">Existing (keep)</option>
                  <option value="replaced">Replacement</option>
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            </div>
            <input value={equipForm.notes} onChange={e => setEquipForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes (optional)" className={inp} />
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Added by</p>
              <div className="flex gap-1.5">
                {(['management', 'tech'] as const).map(a => (
                  <button key={a} onClick={() => setEquipForm(f => ({ ...f, added_by: a }))}
                    className={cn('text-[10px] font-semibold px-2.5 py-1 rounded-md border capitalize transition-colors',
                      equipForm.added_by === a ? 'bg-brand-500 text-white border-transparent' : 'border-border text-muted-foreground hover:border-foreground'
                    )}>
                    {a}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowAddEquip(false)} className="flex-1 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent">Cancel</button>
              <button onClick={handleAddEquip} disabled={savingEquip || !equipForm.name.trim()}
                className="flex-1 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium disabled:opacity-40">
                {savingEquip ? 'Adding…' : 'Add to Manifest'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Section 3: Field Reports (legacy — collapsed by default) ── */}
      {fieldTickets.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <button
            onClick={() => setShowLegacy(!showLegacy)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-accent/30 transition-colors"
          >
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <FileText size={14} className="text-muted-foreground" />
              Field Reports
              <span className="text-xs text-muted-foreground font-normal">({fieldTickets.length})</span>
            </h3>
            <ChevronDown size={14} className={cn('text-muted-foreground transition-transform', showLegacy && 'rotate-180')} />
          </button>

          {showLegacy && (
            <div className="divide-y divide-border/50 border-t border-border">
              {fieldTickets.map(ft => {
                const statusCfg: Record<FTStatus, { bg: string; text: string; label: string }> = {
                  draft:     { bg: 'bg-slate-500/10',   text: 'text-slate-400',   label: 'Draft'     },
                  submitted: { bg: 'bg-amber-500/10',   text: 'text-amber-400',   label: 'Submitted' },
                  approved:  { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Approved'  },
                  rejected:  { bg: 'bg-red-500/10',     text: 'text-red-400',     label: 'Rejected'  },
                }
                const sc = statusCfg[ft.status]
                return (
                  <div key={ft.id} className="px-5 py-4 space-y-2 group">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${sc.bg} ${sc.text}`}>{sc.label}</span>
                        <span className="text-sm font-semibold text-foreground">{ft.title}</span>
                        <span className="text-xs text-muted-foreground">· {ft.technician_name || 'Unknown'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {ft.status === 'submitted' && (
                          <button onClick={() => onApproveFT(ft)} className="px-2.5 py-1 text-xs font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-lg">
                            Approve
                          </button>
                        )}
                        <button onClick={() => onDeleteFT(ft.id)} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 text-red-400 transition-all">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    {ft.findings && <p className="text-xs text-foreground whitespace-pre-wrap">{ft.findings}</p>}
                    {ft.work_performed && <p className="text-xs text-muted-foreground whitespace-pre-wrap">{ft.work_performed}</p>}
                    {ft.labor_hours && <p className="text-xs font-semibold text-foreground">Labor: {ft.labor_hours}h</p>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── CallsTab ──────────────────────────────────────────────────────────────────
// Log calls, make click-to-call, store call history on the record.

interface CallsTabProps {
  workOrderId: string
  workOrder: WorkOrder
}

function CallsTab({ workOrderId, workOrder }: CallsTabProps) {
  const [calls, setCalls]         = useState<CallLog[]>([])
  const [loading, setLoading]     = useState(true)
  const [showLogForm, setShowLogForm] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [deleting, setDeleting]   = useState<string | null>(null)

  const [form, setForm] = useState({
    direction:    'outbound' as 'inbound' | 'outbound',
    contact_name: '',
    phone:        '',
    duration_mins: '',
    outcome:      '' as '' | 'reached' | 'no_answer' | 'left_voicemail' | 'wrong_number' | 'callback_requested',
    notes:        '',
    made_by:      '',
    called_at:    new Date().toISOString().slice(0, 16), // datetime-local format
  })

  // Pre-fill contact from site contacts if available
  useEffect(() => {
    if (workOrder.site_pm_name) {
      setForm(f => ({
        ...f,
        contact_name: workOrder.site_pm_name ?? '',
        phone: workOrder.site_pm_phone ?? '',
      }))
    }
  }, [workOrder])

  useEffect(() => {
    fetch(`/api/maintenance/${workOrderId}/calls`)
      .then(r => r.json())
      .then(j => { setCalls(j.calls ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [workOrderId])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/maintenance/${workOrderId}/calls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          duration_mins: form.duration_mins ? parseInt(form.duration_mins) : null,
          outcome:       form.outcome || null,
          called_at:     form.called_at ? new Date(form.called_at).toISOString() : new Date().toISOString(),
        }),
      })
      const json = await res.json()
      if (res.ok) {
        setCalls(prev => [json.call, ...prev])
        setShowLogForm(false)
        setForm({
          direction:    'outbound',
          contact_name: workOrder.site_pm_name ?? '',
          phone:        workOrder.site_pm_phone ?? '',
          duration_mins: '',
          outcome:      '',
          notes:        '',
          made_by:      '',
          called_at:    new Date().toISOString().slice(0, 16),
        })
      }
    } finally { setSaving(false) }
  }

  const handleDelete = async (callId: string) => {
    setDeleting(callId)
    try {
      const res = await fetch(`/api/maintenance/${workOrderId}/calls`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_id: callId }),
      })
      if (res.ok) setCalls(prev => prev.filter(c => c.id !== callId))
    } finally { setDeleting(null) }
  }

  const OUTCOME_CFG: Record<string, { label: string; color: string }> = {
    reached:            { label: 'Reached',           color: 'bg-emerald-500/10 text-emerald-400' },
    no_answer:          { label: 'No Answer',          color: 'bg-slate-500/10 text-slate-400'     },
    left_voicemail:     { label: 'Left Voicemail',     color: 'bg-blue-500/10 text-blue-400'       },
    wrong_number:       { label: 'Wrong Number',       color: 'bg-red-500/10 text-red-400'         },
    callback_requested: { label: 'Callback Requested', color: 'bg-amber-500/10 text-amber-400'     },
  }

  // Quick-dial contacts from the work order's site data
  const quickContacts = [
    workOrder.site_pm_name && workOrder.site_pm_phone
      ? { name: workOrder.site_pm_name, phone: workOrder.site_pm_phone, label: 'PM' }
      : null,
    workOrder.site_contact_name && workOrder.site_contact_phone && workOrder.site_contact_phone !== workOrder.site_pm_phone
      ? { name: workOrder.site_contact_name, phone: workOrder.site_contact_phone, label: 'Contact' }
      : null,
  ].filter(Boolean) as { name: string; phone: string; label: string }[]

  const inp = 'w-full text-sm px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-brand-500/30'
  const lbl = 'block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1'

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading calls…</div>

  return (
    <div className="space-y-4">

      {/* Quick Dial card */}
      {quickContacts.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <PhoneOutgoing size={14} className="text-emerald-400" />
              Quick Dial
            </h3>
          </div>
          <div className="p-4 flex flex-wrap gap-3">
            {quickContacts.map(c => (
              <div key={c.phone} className="flex items-center gap-3 bg-background border border-border rounded-xl px-4 py-3 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <PhoneCall size={14} className="text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                  <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                  <p className="text-xs text-brand-400">{c.phone}</p>
                </div>
                <a
                  href={`tel:${c.phone}`}
                  onClick={() => {
                    // Pre-fill log form on click-to-call
                    setForm(f => ({ ...f, contact_name: c.name, phone: c.phone, direction: 'outbound' }))
                    setTimeout(() => setShowLogForm(true), 500)
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs font-semibold rounded-lg transition-colors"
                >
                  <PhoneCall size={12} /> Call
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Call log header */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <PhoneCall size={14} className="text-brand-400" />
            Call Log
            {calls.length > 0 && <span className="text-xs font-normal text-muted-foreground">({calls.length})</span>}
          </h3>
          <button
            onClick={() => setShowLogForm(v => !v)}
            className="flex items-center gap-1.5 text-xs bg-brand-500 text-white px-3 py-1.5 rounded-lg hover:bg-brand-600 font-medium transition-colors"
          >
            <Plus size={12} /> Log a Call
          </button>
        </div>

        {/* Log a call form */}
        {showLogForm && (
          <div className="px-5 py-4 border-b border-border bg-background/40 space-y-4">
            <p className="text-xs font-semibold text-foreground">Record a Call</p>

            {/* Direction toggle */}
            <div className="flex gap-2">
              {(['outbound', 'inbound'] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setForm(f => ({ ...f, direction: d }))}
                  className={cn(
                    'flex-1 py-2 text-xs font-semibold rounded-lg border capitalize transition-colors flex items-center justify-center gap-1.5',
                    form.direction === d
                      ? 'bg-brand-500 text-white border-brand-500'
                      : 'border-border text-muted-foreground hover:border-brand-400'
                  )}
                >
                  {d === 'outbound' ? <PhoneOutgoing size={11} /> : <PhoneCall size={11} />}
                  {d}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Contact Name</label>
                <input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} placeholder="Who did you call?" className={inp} />
              </div>
              <div>
                <label className={lbl}>Phone Number</label>
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(555) 000-0000" className={inp} />
              </div>
              <div>
                <label className={lbl}>Duration (mins)</label>
                <input type="number" min="0" value={form.duration_mins} onChange={e => setForm(f => ({ ...f, duration_mins: e.target.value }))} placeholder="e.g. 5" className={inp} />
              </div>
              <div>
                <label className={lbl}>Made By (Tech Name)</label>
                <input value={form.made_by} onChange={e => setForm(f => ({ ...f, made_by: e.target.value }))} placeholder="Your name" className={inp} />
              </div>
            </div>

            {/* Outcome picker */}
            <div>
              <label className={lbl}>Outcome</label>
              <div className="flex flex-wrap gap-2">
                {(['reached', 'no_answer', 'left_voicemail', 'callback_requested', 'wrong_number'] as const).map(o => (
                  <button
                    key={o}
                    onClick={() => setForm(f => ({ ...f, outcome: f.outcome === o ? '' : o }))}
                    className={cn(
                      'px-2.5 py-1 text-[11px] font-semibold rounded-full border transition-colors',
                      form.outcome === o
                        ? OUTCOME_CFG[o].color + ' border-transparent'
                        : 'border-border text-muted-foreground hover:border-brand-400'
                    )}
                  >
                    {OUTCOME_CFG[o].label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={lbl}>Notes</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={3}
                placeholder="What was discussed? Any follow-up needed?"
                className="w-full text-sm px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-brand-500/30 resize-none"
              />
            </div>

            <div>
              <label className={lbl}>Date & Time</label>
              <input type="datetime-local" value={form.called_at} onChange={e => setForm(f => ({ ...f, called_at: e.target.value }))} className={inp} />
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowLogForm(false)} className="flex-1 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-accent transition-colors">Cancel</button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving…' : 'Save Call'}
              </button>
            </div>
          </div>
        )}

        {/* Call history */}
        {calls.length === 0 && !showLogForm ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <PhoneCall size={28} className="mb-2 opacity-20" />
            <p className="text-sm">No calls logged yet</p>
            <p className="text-xs mt-1 opacity-70">Click "Log a Call" to record a call on this work order</p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {calls.map(call => {
              const outcomeInfo = call.outcome ? OUTCOME_CFG[call.outcome] : null
              const fmtCallTime = (iso: string) =>
                new Date(iso).toLocaleString('en-US', {
                  month: 'short', day: 'numeric',
                  hour: 'numeric', minute: '2-digit',
                })
              return (
                <div key={call.id} className="px-5 py-4 group hover:bg-accent/20 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                      call.direction === 'outbound' ? 'bg-brand-500/10' : 'bg-emerald-500/10'
                    )}>
                      {call.direction === 'outbound'
                        ? <PhoneOutgoing size={14} className="text-brand-400" />
                        : <PhoneCall size={14} className="text-emerald-400" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground">{call.contact_name || 'Unknown contact'}</span>
                        {call.phone && (
                          <a href={`tel:${call.phone}`} className="text-xs text-brand-400 hover:underline">{call.phone}</a>
                        )}
                        {outcomeInfo && (
                          <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', outcomeInfo.color)}>
                            {outcomeInfo.label}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                        <span>{fmtCallTime(call.called_at)}</span>
                        {call.duration_mins && <span>· {call.duration_mins}min</span>}
                        {call.made_by && <span>· by {call.made_by}</span>}
                        <span className={cn('capitalize', call.direction === 'outbound' ? 'text-brand-400' : 'text-emerald-400')}>
                          · {call.direction}
                        </span>
                      </div>
                      {call.notes && (
                        <p className="text-sm text-foreground mt-2 leading-relaxed whitespace-pre-wrap">{call.notes}</p>
                      )}
                      {call.ai_summary && (
                        <div className="mt-2 px-3 py-2 bg-violet-500/5 border border-violet-500/20 rounded-lg">
                          <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-wider mb-1">AI Summary</p>
                          <p className="text-xs text-foreground">{call.ai_summary}</p>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(call.id)}
                      disabled={deleting === call.id}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/10 text-red-400 transition-all shrink-0"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Helper component ──────────────────────────────────────────────────────────

function DetailRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="text-muted-foreground mt-0.5 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">{label}</div>
        <div className="text-foreground">{children}</div>
      </div>
    </div>
  )
}
