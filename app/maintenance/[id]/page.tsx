'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Wrench, Clock, Calendar, CheckCircle2, X, AlertTriangle,
  Plus, Trash2, MessageSquare, Package, User, ChevronDown,
  RefreshCw, Send, Building2, Hash, MapPin, Check, FileText, Search,
} from 'lucide-react'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { ArrowLeft, Edit2, Timer, Tag, ClipboardList } = require('lucide-react') as any
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
  created_at: string
  updated_at: string
}

interface ChecklistItem {
  id: string
  work_order_id: string
  title: string
  completed: boolean
  completed_at?: string
  completed_by?: string
  sort_order: number
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
  const [tab, setTab] = useState<'details' | 'comments' | 'parts' | 'field_tickets' | 'time'>('details')

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

      // Load field tickets + time entries in parallel (non-blocking)
      void Promise.all([
        fetch(`/api/field-tickets?work_order_id=${id}`).then(r => r.json()).then(j => {
          setFieldTickets(j.records ?? [])
        }).catch(() => {}),
        fetch(`/api/maintenance/${id}/time`).then(r => r.json()).then(j => {
          setTimeEntries(j.entries ?? [])
          setTotalMins(j.totalMins ?? 0)
          setActiveEntry(j.activeEntry ?? null)
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
                  { key: 'field_tickets', label: `Field Tickets (${fieldTickets.length})`, icon: ClipboardList },
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

              {/* ── Details tab ── */}
              {tab === 'details' && (
                <div className="space-y-5">
                  {/* Description / Notes */}
                  {wo.notes && (
                    <div className="bg-card border border-border rounded-xl p-5">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Description</h3>
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{wo.notes}</p>
                    </div>
                  )}

                  {/* Checklist */}
                  <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-brand-400" />
                        Checklist
                        {totalCount > 0 && (
                          <span className="text-xs text-muted-foreground font-normal">({doneCount}/{totalCount})</span>
                        )}
                      </h3>
                    </div>

                    <div className="divide-y divide-border/50">
                      {checklist.length === 0 && (
                        <p className="px-5 py-6 text-sm text-muted-foreground text-center">No checklist items yet — add one below</p>
                      )}
                      {checklist.map(item => (
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
                          <span className={cn('flex-1 text-sm', item.completed && 'line-through text-muted-foreground')}>
                            {item.title}
                          </span>
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 text-red-400 transition-all"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Add item input */}
                    <div className="px-5 py-3 border-t border-border flex gap-2">
                      <input
                        value={newItem}
                        onChange={e => setNewItem(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleAddItem()}
                        placeholder="Add checklist item…"
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
              {tab === 'field_tickets' && (
                <div className="space-y-4">
                  {/* New ticket form */}
                  {showNewFT ? (
                    <div className="bg-card border border-border rounded-xl overflow-hidden">
                      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
                        <h3 className="text-sm font-semibold flex items-center gap-2">
                          <ClipboardList size={14} className="text-brand-400" />
                          New Field Ticket
                        </h3>
                        <button onClick={() => { setShowNewFT(false); setFtError('') }} className="p-1.5 rounded-lg hover:bg-accent">
                          <X size={13} className="text-muted-foreground" />
                        </button>
                      </div>
                      <div className="p-5 space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Technician Name *</label>
                            <input
                              value={ftForm.technician_name}
                              onChange={e => setFtForm(f => ({ ...f, technician_name: e.target.value }))}
                              placeholder="Your name"
                              className="w-full text-sm px-3 py-2.5 border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Ticket Title *</label>
                            <input
                              value={ftForm.title}
                              onChange={e => setFtForm(f => ({ ...f, title: e.target.value }))}
                              placeholder="e.g. Gate motor replacement"
                              className="w-full text-sm px-3 py-2.5 border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Findings / Observations</label>
                          <textarea
                            value={ftForm.findings}
                            onChange={e => setFtForm(f => ({ ...f, findings: e.target.value }))}
                            placeholder="What did you find on site?"
                            rows={3}
                            className="w-full text-sm px-3 py-2.5 border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-brand-500/30 resize-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Work Performed</label>
                          <textarea
                            value={ftForm.work_performed}
                            onChange={e => setFtForm(f => ({ ...f, work_performed: e.target.value }))}
                            placeholder="Describe what was done…"
                            rows={3}
                            className="w-full text-sm px-3 py-2.5 border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-brand-500/30 resize-none"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Materials Used</label>
                            <input
                              value={ftForm.materials_used}
                              onChange={e => setFtForm(f => ({ ...f, materials_used: e.target.value }))}
                              placeholder="e.g. 14/2 wire, connectors"
                              className="w-full text-sm px-3 py-2.5 border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Labor Hours</label>
                            <input
                              type="number" step="0.25" min="0"
                              value={ftForm.labor_hours}
                              onChange={e => setFtForm(f => ({ ...f, labor_hours: e.target.value }))}
                              placeholder="e.g. 2.5"
                              className="w-full text-sm px-3 py-2.5 border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Recommendations</label>
                          <textarea
                            value={ftForm.recommendations}
                            onChange={e => setFtForm(f => ({ ...f, recommendations: e.target.value }))}
                            placeholder="Suggested follow-up actions…"
                            rows={2}
                            className="w-full text-sm px-3 py-2.5 border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-brand-500/30 resize-none"
                          />
                        </div>

                        {ftError && (
                          <div className="flex items-center gap-2 text-red-500 text-xs bg-red-500/10 rounded-xl px-3 py-2">
                            <AlertTriangle size={13} /> {ftError}
                          </div>
                        )}

                        <div className="flex gap-2 pt-1">
                          <button onClick={() => { setShowNewFT(false); setFtError('') }}
                            className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-accent transition-colors">
                            Cancel
                          </button>
                          <button onClick={handleSubmitFT} disabled={ftSaving || !ftForm.title.trim()}
                            className="flex-1 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition-colors disabled:opacity-50 shadow-lg shadow-brand-500/20">
                            {ftSaving ? 'Submitting…' : 'Submit Field Ticket'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowNewFT(true)}
                      className="flex items-center gap-2 px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-xl transition-colors shadow-lg shadow-brand-500/20"
                    >
                      <Plus size={14} /> New Field Ticket
                    </button>
                  )}

                  {/* Existing tickets */}
                  {fieldTickets.length === 0 && !showNewFT && (
                    <div className="bg-card border border-border rounded-xl flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <ClipboardList size={28} className="mb-2 opacity-20" />
                      <p className="text-sm">No field tickets yet</p>
                      <p className="text-xs mt-1 opacity-70">Submit one after completing on-site work</p>
                    </div>
                  )}

                  {fieldTickets.map(ft => {
                    const statusCfg: Record<FTStatus, { bg: string; text: string; label: string }> = {
                      draft:     { bg: 'bg-slate-500/10',   text: 'text-slate-400',   label: 'Draft'     },
                      submitted: { bg: 'bg-amber-500/10',   text: 'text-amber-400',   label: 'Submitted' },
                      approved:  { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Approved'  },
                      rejected:  { bg: 'bg-red-500/10',     text: 'text-red-400',     label: 'Rejected'  },
                    }
                    const sc = statusCfg[ft.status]
                    return (
                      <div key={ft.id} className="bg-card border border-border rounded-xl overflow-hidden group">
                        <div className="flex items-start justify-between px-5 py-4 border-b border-border">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${sc.bg} ${sc.text}`}>
                                {sc.label}
                              </span>
                              <span className="text-xs text-muted-foreground">{fmtDate(ft.created_at)}</span>
                            </div>
                            <h4 className="text-sm font-semibold text-foreground">{ft.title}</h4>
                            <p className="text-xs text-muted-foreground mt-0.5">by {ft.technician_name || 'Unknown tech'}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {ft.status === 'submitted' && (
                              <button
                                onClick={() => handleApproveFT(ft)}
                                className="px-2.5 py-1 text-xs font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-colors"
                              >
                                Approve
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteFT(ft.id)}
                              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/10 text-red-400 transition-all"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                        <div className="px-5 py-4 space-y-3">
                          {ft.findings && (
                            <div>
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Findings</p>
                              <p className="text-sm text-foreground whitespace-pre-wrap">{ft.findings}</p>
                            </div>
                          )}
                          {ft.work_performed && (
                            <div>
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Work Performed</p>
                              <p className="text-sm text-foreground whitespace-pre-wrap">{ft.work_performed}</p>
                            </div>
                          )}
                          {(ft.materials_used || ft.labor_hours) && (
                            <div className="flex gap-6">
                              {ft.materials_used && (
                                <div>
                                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Materials</p>
                                  <p className="text-sm">{ft.materials_used}</p>
                                </div>
                              )}
                              {ft.labor_hours && (
                                <div>
                                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Labor Hours</p>
                                  <p className="text-sm font-semibold">{ft.labor_hours}h</p>
                                </div>
                              )}
                            </div>
                          )}
                          {ft.recommendations && (
                            <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg px-4 py-3">
                              <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider mb-1">Recommendations</p>
                              <p className="text-sm text-foreground">{ft.recommendations}</p>
                            </div>
                          )}
                          {ft.approved_at && (
                            <p className="text-xs text-emerald-400">✓ Approved by {ft.approved_by} on {fmtDate(ft.approved_at)}</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
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
