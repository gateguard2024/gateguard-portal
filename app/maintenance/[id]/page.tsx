'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Wrench, Clock, Calendar, CheckCircle2, X, AlertTriangle,
  Plus, Trash2, Edit2, MessageSquare, Package, User, ChevronDown,
  RefreshCw, Send, Building2, Hash, Timer, MapPin, Tag, Check,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
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
  part_id?: string
  part_name: string
  part_number?: string
  quantity: number
  unit_cost?: number
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
          estimated_hours: form.estimated_hours ? parseFloat(form.estimated_hours) : null,
          due_date:        form.due_date        || null,
          scheduled_date:  form.scheduled_date  || null,
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
  const [partForm, setPartForm] = useState({ part_name: '', part_number: '', quantity: '1', unit_cost: '' })
  const [addingPart, setAddingPart] = useState(false)

  // Active tab
  const [tab, setTab] = useState<'details' | 'comments' | 'parts'>('details')

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

  const handleAddPart = async () => {
    if (!partForm.part_name.trim()) return
    setAddingPart(true)
    try {
      const res  = await fetch(`/api/maintenance/${id}/parts`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          part_name:   partForm.part_name.trim(),
          part_number: partForm.part_number || null,
          quantity:    parseInt(partForm.quantity) || 1,
          unit_cost:   partForm.unit_cost ? parseFloat(partForm.unit_cost) : null,
        }),
      })
      const json = await res.json()
      if (res.ok) {
        setPartsUsed(p => [...p, json.part])
        setPartForm({ part_name: '', part_number: '', quantity: '1', unit_cost: '' })
        setShowAddPart(false)
      }
    } finally { setAddingPart(false) }
  }

  const handleDeletePart = async (partId: string) => {
    setPartsUsed(p => p.filter(x => x.id !== partId))
    await fetch(`/api/maintenance/${id}/parts`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ part_used_id: partId }),
    })
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

  const partsTotal = partsUsed.reduce((acc, p) => acc + (p.unit_cost ?? 0) * p.quantity, 0)

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
              <div className="flex gap-1 border-b border-border pb-0">
                {([
                  { key: 'details',  label: 'Details',  icon: Wrench   },
                  { key: 'comments', label: `Comments (${comments.length})`, icon: MessageSquare },
                  { key: 'parts',    label: `Parts Used (${partsUsed.length})`, icon: Package },
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
                            <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Part #</th>
                            <th className="text-center px-4 py-2.5 text-xs text-muted-foreground font-medium">Qty</th>
                            <th className="text-right px-4 py-2.5 text-xs text-muted-foreground font-medium">Unit Cost</th>
                            <th className="text-right px-4 py-2.5 text-xs text-muted-foreground font-medium">Total</th>
                            <th className="px-4 py-2.5" />
                          </tr>
                        </thead>
                        <tbody>
                          {partsUsed.map(p => (
                            <tr key={p.id} className="border-b border-border/50 hover:bg-accent/30 group">
                              <td className="px-5 py-3 font-medium text-foreground">{p.part_name}</td>
                              <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{p.part_number ?? '—'}</td>
                              <td className="px-4 py-3 text-center text-muted-foreground">{p.quantity}</td>
                              <td className="px-4 py-3 text-right text-muted-foreground">{p.unit_cost ? `$${p.unit_cost.toFixed(2)}` : '—'}</td>
                              <td className="px-4 py-3 text-right font-medium">{p.unit_cost ? `$${(p.unit_cost * p.quantity).toFixed(2)}` : '—'}</td>
                              <td className="px-4 py-3 text-right">
                                <button onClick={() => handleDeletePart(p.id)} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 text-red-400 transition-all">
                                  <Trash2 size={12} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {/* Add part form */}
                    {showAddPart ? (
                      <div className="px-5 py-4 border-t border-border space-y-3">
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
                            placeholder="Part # (optional)"
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
                        <div className="flex gap-2">
                          <button onClick={() => setShowAddPart(false)} className="flex-1 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent transition-colors">Cancel</button>
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
