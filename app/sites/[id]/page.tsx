'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Building2, MapPin, Phone, Mail, Wrench, ChevronLeft,
  Plus, Shield, Activity, ClipboardList, Package,
  CheckCircle2, AlertTriangle, XCircle, Wifi, WifiOff,
  Key, FileText, Trash2, RefreshCw, Copy, ExternalLink, X, Search,
} from 'lucide-react'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Inbox, Edit3, Edit2, RotateCcw } = require('lucide-react') as any
import { QuickActions } from '@/components/shared/QuickActions'
import { TrackerBoard } from '@/components/tracker/TrackerBoard'

/* ─── types ──────────────────────────────────────────── */
interface Site {
  id: string
  name: string
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  property_type: string
  units: number | null
  status: string
  org_id: string | null
  master_dealer_id: string | null
  install_dealer_id: string | null
  service_dealer_id: string | null
  primary_contact_name: string | null
  primary_contact_email: string | null
  primary_contact_phone: string | null
  pm_name: string | null
  pm_email: string | null
  pm_phone: string | null
  gate_code: string | null
  parking_notes: string | null
  access_notes: string | null
  notes: string | null
  crm_customer_id: string | null
  crm_opp_id: string | null
  created_at: string
}

interface Asset {
  id: string
  product_name: string
  product_sku: string | null
  product_category: string | null
  serial_number: string | null
  mac_address: string | null
  ip_address: string | null
  firmware_version: string | null
  location_note: string
  location_zone: string | null
  installed_by: string | null
  installed_at: string | null
  status: string
  last_seen_at: string | null
  offline_since: string | null
  notes: string | null
}

interface SiteEvent {
  id: string
  event_type: string
  event_source: string
  summary: string | null
  severity: string
  created_at: string
}

interface WorkOrder {
  id: string
  wo_number: string
  title: string
  status: string
  priority: string
  scheduled_date: string | null
  assignee_name: string | null
  created_at: string
}

interface PMSchedule {
  id: string
  title: string
  description: string | null
  interval_days: number
  next_due_at: string
  last_generated_at: string | null
  is_active: boolean
  created_at: string
}

/* ─── Add Asset slide-over ───────────────────────────── */
function AddAssetSlideOver({
  siteId,
  open,
  onClose,
  onSaved,
}: {
  siteId: string
  open: boolean
  onClose: () => void
  onSaved: (asset: Asset) => void
}) {
  const [form, setForm] = useState({
    product_name: '', product_sku: '', product_category: 'Gate Operator',
    serial_number: '', mac_address: '', ip_address: '',
    location_note: 'Main Gate', location_zone: '',
    installed_by: '', install_notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const set = (f: string, v: string) => setForm(prev => ({ ...prev, [f]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.product_name.trim()) { setError('Product name is required'); return }
    setSaving(true); setError(null)
    try {
      const res = await fetch(`/api/sites/${siteId}/assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, installed_at: new Date().toISOString() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to save')
      onSaved(json.asset)
      onClose()
      setForm({ product_name:'',product_sku:'',product_category:'Gate Operator',serial_number:'',mac_address:'',ip_address:'',location_note:'Main Gate',location_zone:'',installed_by:'',install_notes:'' })
    } catch (err: any) { setError(err.message) }
    finally { setSaving(false) }
  }

  if (!open) return null

  const CATEGORIES = ['Gate Operator','Access Controller','Callbox/Intercom','Camera','Network Switch','Access Reader','Loop Detector','Photobeam','Lock/Strike','Other']

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-lg bg-[#1e2a3a] shadow-2xl flex flex-col h-full overflow-y-auto">
        <div className="sticky top-0 bg-[#1e2a3a] border-b border-[#33465b] px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#eaf2fb]">Add Installed Equipment</h2>
          <button onClick={onClose} className="text-[#8598aa] hover:text-[#c3d3e2] text-2xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 p-6 space-y-4">
          {error && <div className="bg-[rgba(239,68,68,0.13)] border border-[rgba(239,68,68,0.35)] text-[#fca5a5] rounded-lg px-4 py-3 text-sm">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-[#c3d3e2] mb-1">Product Name *</label>
            <input value={form.product_name} onChange={e => set('product_name', e.target.value)} placeholder="DoorKing 6050" className="w-full border border-[#3a4a5c] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5FB8E0]" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#c3d3e2] mb-1">SKU / Model</label>
              <input value={form.product_sku} onChange={e => set('product_sku', e.target.value)} placeholder="DK-6050" className="w-full border border-[#3a4a5c] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5FB8E0]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#c3d3e2] mb-1">Category</label>
              <select value={form.product_category} onChange={e => set('product_category', e.target.value)} className="w-full border border-[#3a4a5c] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5FB8E0]">
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#c3d3e2] mb-1">Location</label>
              <input value={form.location_note} onChange={e => set('location_note', e.target.value)} placeholder="Main Gate" className="w-full border border-[#3a4a5c] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5FB8E0]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#c3d3e2] mb-1">Zone (optional)</label>
              <input value={form.location_zone} onChange={e => set('location_zone', e.target.value)} placeholder="North Entry" className="w-full border border-[#3a4a5c] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5FB8E0]" />
            </div>
          </div>

          <div className="border-t border-[#2a3a4d] pt-4">
            <p className="text-xs font-semibold text-[#98abbd] uppercase tracking-wider mb-3">Hardware IDs</p>
            <div className="space-y-3">
              <input value={form.serial_number} onChange={e => set('serial_number', e.target.value)} placeholder="Serial number" className="w-full border border-[#3a4a5c] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5FB8E0]" />
              <div className="grid grid-cols-2 gap-3">
                <input value={form.mac_address} onChange={e => set('mac_address', e.target.value)} placeholder="MAC address" className="w-full border border-[#3a4a5c] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5FB8E0]" />
                <input value={form.ip_address} onChange={e => set('ip_address', e.target.value)} placeholder="IP address" className="w-full border border-[#3a4a5c] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5FB8E0]" />
              </div>
            </div>
          </div>

          <div className="border-t border-[#2a3a4d] pt-4">
            <p className="text-xs font-semibold text-[#98abbd] uppercase tracking-wider mb-3">Install Record</p>
            <div className="space-y-3">
              <input value={form.installed_by} onChange={e => set('installed_by', e.target.value)} placeholder="Installed by (tech name)" className="w-full border border-[#3a4a5c] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5FB8E0]" />
              <textarea value={form.install_notes} onChange={e => set('install_notes', e.target.value)} placeholder="Install notes" rows={2} className="w-full border border-[#3a4a5c] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5FB8E0] resize-none" />
            </div>
          </div>
        </form>

        <div className="sticky bottom-0 bg-[#1e2a3a] border-t border-[#33465b] px-6 py-4 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-[#3a4a5c] rounded-lg hover:bg-[#22303f]">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="px-5 py-2 text-sm bg-[#3f7fb8] text-white rounded-lg hover:bg-[#2f7fb8] disabled:opacity-50">
            {saving ? 'Saving…' : 'Add Equipment'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Helpers ────────────────────────────────────────── */
const ASSET_STATUS: Record<string, { label: string; color: string; dot: string }> = {
  active:   { label: 'Online',   color: 'bg-[rgba(126,224,168,0.15)] text-emerald-300', dot: 'bg-emerald-500' },
  offline:  { label: 'Offline',  color: 'bg-[rgba(239,68,68,0.18)] text-[#fca5a5]',         dot: 'bg-red-500'     },
  degraded: { label: 'Degraded', color: 'bg-[rgba(251,191,36,0.15)] text-amber-300',     dot: 'bg-amber-500'   },
  replaced: { label: 'Replaced', color: 'bg-[#22303f] text-[#98abbd]',     dot: 'bg-slate-400'   },
}

const WO_STATUS: Record<string, string> = {
  open:        'bg-[rgba(95,184,224,0.15)] text-[#9FD8EC]',
  scheduled:   'bg-violet-100 text-violet-700',
  in_progress: 'bg-[rgba(251,191,36,0.15)] text-amber-300',
  completed:   'bg-[rgba(126,224,168,0.15)] text-emerald-300',
  cancelled:   'bg-[#22303f] text-[#98abbd]',
}

const PRIORITY: Record<string, string> = {
  critical: 'text-[#fca5a5]',
  high:     'text-amber-300',
  normal:   'text-[#98abbd]',
  low:      'text-[#8598aa]',
}

const SEVERITY_ICON: Record<string, JSX.Element> = {
  critical: <AlertTriangle size={14} className="text-[#fb7185]" />,
  warning:  <AlertTriangle size={14} className="text-amber-300" />,
  info:     <Activity size={14} className="text-[#5FB8E0]" />,
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function formatDateTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

/* ─── Main page ──────────────────────────────────────── */
type Tab = 'overview' | 'assets' | 'events' | 'work_orders' | 'requests' | 'pm_schedules' | 'opportunities' | 'quotes' | 'warranty' | 'tasks'

interface SiteOpportunity {
  id: string
  name: string
  stage: string
  amount: number | null
  opp_type: string | null
  account_name: string
  created_at: string
  close_date: string | null
}

interface SiteQuote {
  id: string
  quote_number: string
  status: string
  property_name: string | null
  units: number | null
  total_one_time: number
  total_mrr: number
  created_at: string
  sent_at: string | null
  accepted_at: string | null
}

interface WORequest {
  id: string
  site_id: string
  title: string
  description?: string
  area?: string
  priority_requested: string
  contact_name?: string
  contact_email?: string
  contact_phone?: string
  status: string
  converted_wo_id?: string
  notes?: string
  created_at: string
}

interface AssetWithWarranty extends Asset {
  warranty_months?: number | null
  warranty_expires_at?: string | null
  warranty_provider?: string | null
  warranty_notes?: string | null
  rma_status?: string | null
  rma_ticket_number?: string | null
  rma_initiated_at?: string | null
  rma_resolved_at?: string | null
  rma_notes?: string | null
}

interface RMARecord {
  id: string
  site_asset_id: string
  work_order_id?: string | null
  status: 'pending' | 'shipped' | 'received' | 'resolved' | 'denied'
  ticket_number?: string | null
  reason?: string | null
  resolution?: string | null
  initiated_at?: string | null
  shipped_at?: string | null
  received_at?: string | null
  resolved_at?: string | null
  notes?: string | null
  asset_name?: string
}

// Steel palette scoped to this page — dark steel behind the white PortalShell bg.
const STEEL_SCOPE = {
  '--background': '212 33% 13%', '--foreground': '210 30% 92%',
  '--card': '213 31% 17%', '--card-foreground': '210 30% 92%',
  '--popover': '213 31% 15%', '--popover-foreground': '210 30% 92%',
  '--muted': '211 26% 24%', '--muted-foreground': '208 16% 66%',
  '--accent': '212 28% 27%', '--accent-foreground': '210 30% 92%',
  '--secondary': '212 26% 24%', '--secondary-foreground': '210 30% 92%',
  '--border': '210 19% 31%', '--input': '210 19% 29%', '--ring': '199 58% 62%',
  background: 'linear-gradient(180deg,#16202c,#111a24)', minHeight: '100%',
} as unknown as React.CSSProperties

export default function SiteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [site, setSite]             = useState<Site | null>(null)
  const [assets, setAssets]         = useState<Asset[]>([])
  // Fleet-health backfill: inline-edit MAC (UniFi match) + Serial/ESN (Eagle Eye match).
  const [idEdit, setIdEdit] = useState<{ id: string; serial: string; mac: string } | null>(null)
  const [idSaving, setIdSaving] = useState(false)
  async function saveAssetIds() {
    if (!idEdit) return
    setIdSaving(true)
    try {
      const res = await fetch(`/api/sites/${id}/assets/${idEdit.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serial_number: idEdit.serial.trim(), mac_address: idEdit.mac.trim() }),
      })
      if (res.ok) {
        setAssets(prev => prev.map(a => a.id === idEdit.id ? { ...a, serial_number: idEdit.serial.trim() || null, mac_address: idEdit.mac.trim() || null } : a))
        setIdEdit(null)
      }
    } finally { setIdSaving(false) }
  }
  const [events, setEvents]         = useState<SiteEvent[]>([])
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [requests, setRequests]     = useState<WORequest[]>([])
  const [pmSchedules, setPMSchedules]   = useState<PMSchedule[]>([])
  const [siteOpps, setSiteOpps]         = useState<SiteOpportunity[]>([])
  const [siteQuotes, setSiteQuotes]     = useState<SiteQuote[]>([])
  const [quotesLoaded, setQuotesLoaded] = useState(false)
  const [loading, setLoading]           = useState(true)
  const [tab, setTab]               = useState<Tab>('overview')
  const [showAddAsset, setShowAddAsset] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)
  const [convertingId, setConvertingId] = useState<string | null>(null)

  // Linked org names (fetched after site loads)
  interface OrgLink { id: string; name: string; org_tier?: string }
  const [linkedOrgs, setLinkedOrgs] = useState<Record<string, OrgLink | null>>({
    org_id: null, master_dealer_id: null, install_dealer_id: null, service_dealer_id: null,
  })
  const [assigningField, setAssigningField] = useState<string | null>(null)
  const [assignSaving, setAssignSaving] = useState(false)

  // Warranty / RMA state
  const [rmaRecords, setRmaRecords]         = useState<RMARecord[]>([])
  const [rmaLoading, setRmaLoading]         = useState(false)
  const [rmaLoaded, setRmaLoaded]           = useState(false)
  const [editRma, setEditRma]               = useState<RMARecord | null>(null)
  const [rmaSlideOpen, setRmaSlideOpen]     = useState(false)
  const [rmaForm, setRmaForm]               = useState({ status: 'pending', ticket_number: '', notes: '' })
  const [rmaSaving, setRmaSaving]           = useState(false)

  // PM Schedule form state
  const [showPMForm, setShowPMForm] = useState(false)
  const [pmForm, setPMForm] = useState({
    title: '', description: '', interval_days: '90', next_due_at: '',
  })
  const [pmSaving, setPMSaving] = useState(false)
  const [pmError, setPMError]   = useState<string | null>(null)
  const [togglingPM, setTogglingPM] = useState<string | null>(null)
  const [deletingPM, setDeletingPM] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [siteRes, reqRes, pmRes] = await Promise.all([
        fetch(`/api/sites/${id}`),
        fetch(`/api/sites/${id}/requests`),
        fetch(`/api/pm-schedules?site_id=${id}`),
      ])
      const siteJson = await siteRes.json()
      if (!siteRes.ok) { router.push('/sites'); return }
      setSite(siteJson.site)
      setAssets(siteJson.assets)
      setEvents(siteJson.events)
      setWorkOrders(siteJson.work_orders)

      // Load org names for attribution fields
      const s = siteJson.site as Site
      const orgFields: Array<keyof Site> = ['org_id', 'master_dealer_id', 'install_dealer_id', 'service_dealer_id']
      const orgResults = await Promise.allSettled(
        orgFields.map(field => {
          const orgId = s[field]
          if (!orgId) return Promise.resolve(null)
          return fetch(`/api/customers/${orgId}`).then(r => r.ok ? r.json() : null)
        })
      )
      const newLinkedOrgs: Record<string, OrgLink | null> = {
        org_id: null, master_dealer_id: null, install_dealer_id: null, service_dealer_id: null,
      }
      orgFields.forEach((field, i) => {
        const result = orgResults[i]
        if (result.status === 'fulfilled' && result.value) {
          const org = result.value.organization ?? result.value
          const orgId = s[field] as string
          newLinkedOrgs[field] = { id: orgId, name: org.name, org_tier: org.org_tier }
        }
      })
      setLinkedOrgs(newLinkedOrgs)
      if (reqRes.ok) {
        const reqJson = await reqRes.json()
        setRequests(reqJson.requests ?? [])
      }
      if (pmRes.ok) {
        const pmJson = await pmRes.json()
        setPMSchedules(pmJson.pm_schedules ?? [])
      }
      // Load opportunities linked to this site
      const oppRes = await fetch(`/api/crm/opportunities?site_id=${id}`)
      if (oppRes.ok) {
        const oppJson = await oppRes.json()
        // API returns { records: [...], grouped: ..., ... }
        setSiteOpps(oppJson.records ?? oppJson.opportunities ?? [])
      }
      // Load quotes linked to this site
      const quotesRes = await fetch(`/api/quotes?site_id=${id}`)
      if (quotesRes.ok) {
        const quotesJson = await quotesRes.json()
        setSiteQuotes(quotesJson.records ?? [])
      }
      setQuotesLoaded(true)
    } finally { setLoading(false) }
  }

  const handleAddPMSchedule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pmForm.title.trim())    { setPMError('Title is required');       return }
    if (!pmForm.next_due_at)     { setPMError('First due date is required'); return }
    setPMSaving(true); setPMError(null)
    try {
      const res = await fetch('/api/pm-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          site_id:       id,
          title:         pmForm.title.trim(),
          description:   pmForm.description.trim() || null,
          interval_days: Number(pmForm.interval_days),
          next_due_at:   new Date(pmForm.next_due_at).toISOString(),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to save')
      setPMSchedules(prev => [...prev, json.pm_schedule])
      setShowPMForm(false)
      setPMForm({ title: '', description: '', interval_days: '90', next_due_at: '' })
    } catch (err: any) { setPMError(err.message) }
    finally { setPMSaving(false) }
  }

  const handleTogglePM = async (schedule: PMSchedule) => {
    setTogglingPM(schedule.id)
    try {
      const res = await fetch(`/api/pm-schedules/${schedule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !schedule.is_active }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setPMSchedules(prev => prev.map(s => s.id === schedule.id ? json.pm_schedule : s))
    } finally { setTogglingPM(null) }
  }

  const handleDeletePM = async (scheduleId: string) => {
    if (!confirm('Delete this PM schedule?')) return
    setDeletingPM(scheduleId)
    try {
      const res = await fetch(`/api/pm-schedules/${scheduleId}`, { method: 'DELETE' })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error) }
      setPMSchedules(prev => prev.filter(s => s.id !== scheduleId))
    } finally { setDeletingPM(null) }
  }

  const handleConvertRequest = async (req: WORequest) => {
    setConvertingId(req.id)
    try {
      // Create work order from request
      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:         req.title,
          customer_name: site?.name ?? '',
          job_type:      'Repair',
          priority:      req.priority_requested,
          status:        'open',
          notes:         [req.description, req.area ? `Area: ${req.area}` : '', req.contact_name ? `Contact: ${req.contact_name} ${req.contact_email ?? ''} ${req.contact_phone ?? ''}` : ''].filter(Boolean).join('\n'),
          site_id:       id,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      // Mark request as converted
      await fetch(`/api/sites/${id}/requests`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: req.id, status: 'converted', converted_wo_id: json.work_order.id }),
      }).catch(() => {})
      setRequests(r => r.map(x => x.id === req.id ? { ...x, status: 'converted', converted_wo_id: json.work_order.id } : x))
      setWorkOrders(w => [json.work_order, ...w])
    } finally {
      setConvertingId(null)
    }
  }

  const copyRequestLink = () => {
    const url = `${window.location.origin}/request/${id}`
    navigator.clipboard.writeText(url).then(() => {
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    })
  }

  useEffect(() => { fetchData() }, [id])

  const handleStatusChange = async (newStatus: string) => {
    if (!site) return
    setStatusUpdating(true)
    await fetch(`/api/sites/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    setSite(s => s ? { ...s, status: newStatus } : s)
    setStatusUpdating(false)
  }

  const handleAssign = async (field: string, org: OrgLink | null) => {
    setAssignSaving(true)
    try {
      const res = await fetch(`/api/sites/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: org?.id ?? null }),
      })
      if (res.ok) {
        setSite(s => s ? { ...s, [field]: org?.id ?? null } as Site : s)
        setLinkedOrgs(prev => ({ ...prev, [field]: org }))
      }
    } finally {
      setAssignSaving(false)
      setAssigningField(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-[#5FB8E0] border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!site) return null

  const siteStatus = (site.status in ASSET_STATUS) ? ASSET_STATUS[site.status] : null
  const activeAssets   = assets.filter(a => a.status === 'active').length
  const offlineAssets  = assets.filter(a => a.status === 'offline').length

  const newRequests = requests.filter(r => r.status === 'new').length

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { ShieldCheck } = require('lucide-react') as any

  const TABS: { id: Tab; label: string; icon: any; count?: number; badge?: number }[] = [
    { id: 'overview',      label: 'Overview',      icon: Building2 },
    { id: 'assets',        label: 'Equipment',     icon: Package,       count: assets.length },
    { id: 'events',        label: 'Events',        icon: Activity,      count: events.length },
    { id: 'work_orders',   label: 'Work Orders',   icon: ClipboardList, count: workOrders.length },
    { id: 'requests',      label: 'Requests',      icon: Inbox,         count: requests.length, badge: newRequests },
    { id: 'pm_schedules',  label: 'PM Schedules',  icon: RefreshCw,     count: pmSchedules.length },
    { id: 'opportunities', label: 'Opportunities', icon: FileText,      count: siteOpps.length },
    { id: 'quotes',        label: 'Quotes',        icon: FileText,      count: siteQuotes.length },
    { id: 'warranty',      label: 'Warranty & RMA', icon: ShieldCheck },
    { id: 'tasks',         label: 'Tasks',          icon: ClipboardList },
  ]

  return (
    <div className="min-h-full" style={STEEL_SCOPE}>
      <div className="max-w-6xl mx-auto p-6">
      {/* Back */}
      <Link href="/sites" className="inline-flex items-center gap-1.5 text-sm text-[#98abbd] hover:text-[#5FB8E0] mb-4 transition-colors">
        <ChevronLeft size={16} /> Back to Properties
      </Link>

      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-[#eaf2fb]">{site.name}</h1>
            {/* Status badge */}
            <select
              value={site.status}
              disabled={statusUpdating}
              onChange={e => handleStatusChange(e.target.value)}
              className="text-xs border border-[#33465b] rounded-full px-3 py-1 font-medium focus:outline-none focus:ring-2 focus:ring-[#5FB8E0] bg-[#1e2a3a]"
            >
              <option value="active">Active</option>
              <option value="prospect">Prospect</option>
              <option value="inactive">Inactive</option>
              <option value="churned">Churned</option>
            </select>
          </div>
          {(site.city || site.address) && (
            <p className="text-sm text-[#98abbd] flex items-center gap-1.5">
              <MapPin size={14} />
              {[site.address, site.city, site.state, site.zip].filter(Boolean).join(', ')}
            </p>
          )}
          {/* Quick action buttons */}
          <div className="mt-3">
            <QuickActions
              recordType="site"
              recordId={id}
              recordName={site.name}
              contactEmail={site.pm_email ?? site.primary_contact_email ?? undefined}
              contactName={site.pm_name ?? site.primary_contact_name ?? undefined}
              onActivityCreated={() => {}}
            />
          </div>
        </div>

        {/* KPI pills */}
        <div className="flex items-center gap-3 text-sm">
          {site.units && (
            <div className="px-3 py-1.5 bg-[#22303f] text-[#aebfce] rounded-full">
              {site.units.toLocaleString()} units
            </div>
          )}
          <div className={`px-3 py-1.5 rounded-full font-medium ${activeAssets > 0 ? 'bg-[rgba(126,224,168,0.15)] text-emerald-300' : 'bg-[#22303f] text-[#98abbd]'}`}>
            {activeAssets} device{activeAssets !== 1 ? 's' : ''} online
          </div>
          {offlineAssets > 0 && (
            <div className="px-3 py-1.5 bg-[rgba(239,68,68,0.18)] text-[#fca5a5] rounded-full font-medium flex items-center gap-1.5">
              <WifiOff size={12} /> {offlineAssets} offline
            </div>
          )}
          <button
            onClick={() => setShowAddAsset(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#3f7fb8] text-white rounded-lg text-sm font-medium hover:bg-[#2f7fb8]"
          >
            <Plus size={15} /> Add Equipment
          </button>
        </div>
      </div>

      {/* ── Assignment cards ── */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <AssignmentCard
          role="Customer Account"
          label="Paying Client"
          fieldKey="org_id"
          orgLink={linkedOrgs.org_id}
          onAssign={setAssigningField}
          color="text-amber-300"
          bgColor="bg-amber-50"
          borderColor="border-[rgba(251,191,36,0.35)]"
        />
        <AssignmentCard
          role="MSO"
          label="Account Owner"
          fieldKey="master_dealer_id"
          orgLink={linkedOrgs.master_dealer_id}
          onAssign={setAssigningField}
          color="text-violet-300"
          bgColor="bg-violet-50"
          borderColor="border-violet-200"
        />
        <AssignmentCard
          role="Install Dealer"
          label="Installed By"
          fieldKey="install_dealer_id"
          orgLink={linkedOrgs.install_dealer_id}
          onAssign={setAssigningField}
          color="text-[#9FD8EC]"
          bgColor="bg-[#22303f]"
          borderColor="border-blue-200"
        />
        <AssignmentCard
          role="Service Dealer"
          label="Day-to-Day Contact"
          fieldKey="service_dealer_id"
          orgLink={linkedOrgs.service_dealer_id}
          onAssign={setAssigningField}
          color="text-[#5FB8E0]"
          bgColor="bg-[#3f7fb8]"
          borderColor="border-[#5FB8E0]"
          primary
        />
      </div>

      {/* Org picker modal */}
      <OrgPickerModal
        open={assigningField !== null}
        onClose={() => setAssigningField(null)}
        onSelect={org => assigningField && handleAssign(assigningField, org)}
        tierFilter={
          assigningField === 'org_id'            ? 'client' :
          assigningField === 'master_dealer_id'  ? 'master_dealer' :
          assigningField === 'install_dealer_id' ? 'install_contractor' :
          assigningField === 'service_dealer_id' ? 'service_dealer' : undefined
        }
        title={
          assigningField === 'org_id'            ? 'Assign Customer Account' :
          assigningField === 'master_dealer_id'  ? 'Assign MSO' :
          assigningField === 'install_dealer_id' ? 'Assign Install Dealer' :
          assigningField === 'service_dealer_id' ? 'Assign Service Dealer' : 'Assign Organization'
        }
      />

      {/* ── Tabs ────────────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-[#33465b] mb-6">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
              tab === t.id
                ? 'border-[#5FB8E0] text-[#5FB8E0]'
                : 'border-transparent text-[#98abbd] hover:text-[#c3d3e2]'
            }`}
          >
            <t.icon size={15} />
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === t.id ? 'bg-[#3f7fb8] text-[#5FB8E0]' : 'bg-[#22303f] text-[#98abbd]'}`}>
                {t.count}
              </span>
            )}
            {t.badge !== undefined && t.badge > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500 text-white font-bold leading-none">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab: Overview ────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="grid grid-cols-2 gap-6">
          {/* Property info */}
          <div className="bg-[#1e2a3a] rounded-xl border border-[#33465b] p-5">
            <h3 className="text-sm font-semibold text-[#c3d3e2] mb-4 flex items-center gap-2">
              <Building2 size={16} className="text-[#8598aa]" /> Property Info
            </h3>
            <dl className="space-y-3 text-sm">
              <InfoRow label="Type"     value={site.property_type} />
              <InfoRow label="Units"    value={site.units?.toLocaleString() ?? null} />
              <InfoRow label="Address"  value={[site.address, site.city, site.state].filter(Boolean).join(', ') || null} />
              <InfoRow label="Added"    value={formatDate(site.created_at)} />
              {site.crm_opp_id && (
                <InfoRow label="CRM Opp" value={
                  <Link href={`/crm/opportunities/${site.crm_opp_id}`} className="text-[#5FB8E0] hover:underline">
                    View opportunity →
                  </Link>
                } />
              )}
            </dl>
          </div>

          {/* Contacts */}
          <div className="bg-[#1e2a3a] rounded-xl border border-[#33465b] p-5">
            <h3 className="text-sm font-semibold text-[#c3d3e2] mb-4 flex items-center gap-2">
              <Mail size={16} className="text-[#8598aa]" /> Contacts
            </h3>
            <div className="space-y-4 text-sm">
              {site.pm_name && (
                <div>
                  <p className="text-xs font-semibold text-[#8598aa] uppercase tracking-wider mb-1">Property Manager</p>
                  <p className="font-medium text-[#eaf2fb]">{site.pm_name}</p>
                  {site.pm_email && <a href={`mailto:${site.pm_email}`} className="text-[#5FB8E0] hover:underline block">{site.pm_email}</a>}
                  {site.pm_phone && <p className="text-[#98abbd]">{site.pm_phone}</p>}
                </div>
              )}
              {site.primary_contact_name && site.primary_contact_name !== site.pm_name && (
                <div>
                  <p className="text-xs font-semibold text-[#8598aa] uppercase tracking-wider mb-1">Primary Contact</p>
                  <p className="font-medium text-[#eaf2fb]">{site.primary_contact_name}</p>
                  {site.primary_contact_email && <a href={`mailto:${site.primary_contact_email}`} className="text-[#5FB8E0] hover:underline block">{site.primary_contact_email}</a>}
                </div>
              )}
              {!site.pm_name && !site.primary_contact_name && (
                <p className="text-[#8598aa]">No contacts added</p>
              )}
            </div>
          </div>

          {/* Access info */}
          <div className="bg-[#1e2a3a] rounded-xl border border-[#33465b] p-5">
            <h3 className="text-sm font-semibold text-[#c3d3e2] mb-4 flex items-center gap-2">
              <Key size={16} className="text-[#8598aa]" /> Site Access (Tech Info)
            </h3>
            <dl className="space-y-3 text-sm">
              <InfoRow label="Gate Code"    value={site.gate_code} monospace />
              <InfoRow label="Parking"      value={site.parking_notes} />
              <InfoRow label="Access Notes" value={site.access_notes} />
            </dl>
          </div>

          {/* Notes */}
          <div className="bg-[#1e2a3a] rounded-xl border border-[#33465b] p-5">
            <h3 className="text-sm font-semibold text-[#c3d3e2] mb-4 flex items-center gap-2">
              <FileText size={16} className="text-[#8598aa]" /> Notes
            </h3>
            {site.notes ? (
              <p className="text-sm text-[#aebfce] whitespace-pre-wrap">{site.notes}</p>
            ) : (
              <p className="text-sm text-[#8598aa]">No notes</p>
            )}
          </div>

          {/* Map — full width spanning both columns */}
          {(site.address || site.city) && (
            <div className="col-span-2 bg-[#1e2a3a] rounded-xl border border-[#33465b] p-5">
              <h3 className="text-sm font-semibold text-[#c3d3e2] mb-4 flex items-center gap-2">
                <MapPin size={16} className="text-[#8598aa]" /> Location
              </h3>
              <SiteMapEmbed
                address={[site.address, site.city, site.state, site.zip].filter(Boolean).join(', ')}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Assets ──────────────────────────────────────────────── */}
      {tab === 'assets' && (
        <div className="space-y-3">
          {assets.length === 0 ? (
            <div className="bg-[#1e2a3a] rounded-xl border border-[#33465b] flex flex-col items-center justify-center py-16 text-[#8598aa]">
              <Package size={40} className="mb-3 opacity-30" />
              <p className="font-medium">No equipment documented</p>
              <p className="text-sm mt-1">Add the devices installed at this property</p>
              <button
                onClick={() => setShowAddAsset(true)}
                className="mt-4 flex items-center gap-2 px-4 py-2 bg-[#3f7fb8] text-white rounded-lg text-sm font-medium hover:bg-[#2f7fb8]"
              >
                <Plus size={15} /> Add Equipment
              </button>
            </div>
          ) : (
            <>
              {/* Group by zone */}
              {groupByZone(assets).map(({ zone, items }) => (
                <div key={zone} className="bg-[#1e2a3a] rounded-xl border border-[#33465b] overflow-hidden">
                  {zone && (
                    <div className="px-4 py-2.5 bg-[#1a2532] border-b border-[#33465b]">
                      <span className="text-xs font-semibold text-[#98abbd] uppercase tracking-wider">{zone}</span>
                    </div>
                  )}
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#2a3a4d]">
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#98abbd]">Device</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#98abbd]">Location</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#98abbd]">Serial / MAC</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#98abbd]">IP</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#98abbd]">Status</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#98abbd]">Installed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#22303f]">
                      {items.map(asset => {
                        const cfg = ASSET_STATUS[asset.status] ?? ASSET_STATUS.active
                        return (
                          <tr key={asset.id} className="hover:bg-[#22303f]">
                            <td className="px-4 py-3">
                              <div className="font-medium text-[#eaf2fb]">{asset.product_name}</div>
                              {asset.product_sku && <div className="text-xs text-[#8598aa] font-mono">{asset.product_sku}</div>}
                              {asset.product_category && <div className="text-xs text-[#8598aa]">{asset.product_category}</div>}
                            </td>
                            <td className="px-4 py-3 text-[#aebfce]">{asset.location_note}</td>
                            <td className="px-4 py-3 font-mono text-xs text-[#98abbd]">
                              {idEdit?.id === asset.id ? (
                                <div className="flex flex-col gap-1">
                                  <input value={idEdit.serial} onChange={e => setIdEdit({ ...idEdit, serial: e.target.value })} placeholder="Serial / ESN" className="w-32 border border-[#3a4a5c] rounded px-1.5 py-1 text-xs" />
                                  <input value={idEdit.mac} onChange={e => setIdEdit({ ...idEdit, mac: e.target.value })} placeholder="MAC address" className="w-32 border border-[#3a4a5c] rounded px-1.5 py-1 text-xs" />
                                  <div className="flex gap-1">
                                    <button type="button" disabled={idSaving} onClick={saveAssetIds} className="px-2 py-0.5 rounded bg-[#2f7fb8] text-white text-[11px] disabled:opacity-40">{idSaving ? '…' : 'Save'}</button>
                                    <button type="button" onClick={() => setIdEdit(null)} className="px-2 py-0.5 rounded bg-[#22303f] text-[#aebfce] text-[11px]">Cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-start gap-1.5">
                                  <div>
                                    <div>{asset.serial_number ?? '—'}</div>
                                    <div className={asset.mac_address ? 'text-[#8598aa]' : 'text-amber-300'}>{asset.mac_address ?? 'no MAC'}</div>
                                  </div>
                                  <button type="button" onClick={() => setIdEdit({ id: asset.id, serial: asset.serial_number ?? '', mac: asset.mac_address ?? '' })} className="text-[#5FB8E0] hover:text-[#5FB8E0]" title="Backfill Serial / MAC for fleet health">✎</button>
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-[#98abbd]">{asset.ip_address ?? '—'}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.color}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                {cfg.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-[#98abbd]">
                              {formatDate(asset.installed_at)}
                              {asset.installed_by && <div className="text-[#8598aa]">{asset.installed_by}</div>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* ── Tab: Events ──────────────────────────────────────────────── */}
      {tab === 'events' && (
        <div className="bg-[#1e2a3a] rounded-xl border border-[#33465b] overflow-hidden">
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-[#8598aa]">
              <Activity size={40} className="mb-3 opacity-30" />
              <p className="font-medium">No events yet</p>
              <p className="text-sm mt-1">Events are logged automatically as activity occurs</p>
            </div>
          ) : (
            <div className="divide-y divide-[#2a3a4d]">
              {events.map(ev => (
                <div key={ev.id} className="flex items-start gap-3 px-5 py-4 hover:bg-[#22303f]">
                  <div className="mt-0.5">{SEVERITY_ICON[ev.severity] ?? SEVERITY_ICON.info}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[#98abbd] uppercase tracking-wide">{ev.event_type.replace(/_/g, ' ')}</span>
                      <span className="text-xs text-[#8598aa]">via {ev.event_source}</span>
                    </div>
                    {ev.summary && <p className="text-sm text-[#c3d3e2] mt-0.5">{ev.summary}</p>}
                  </div>
                  <div className="text-xs text-[#8598aa] shrink-0">{formatDateTime(ev.created_at)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Work Orders ─────────────────────────────────────────── */}
      {tab === 'work_orders' && (
        <div className="bg-[#1e2a3a] rounded-xl border border-[#33465b] overflow-hidden">
          {/* Header with Create button */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#33465b] bg-[#1a2532]">
            <h3 className="text-sm font-semibold text-[#c3d3e2]">Work Orders</h3>
            <Link
              href={`/maintenance?new=1&site_id=${id}&site_name=${encodeURIComponent(site?.name ?? '')}`}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#3f7fb8] text-white text-xs font-medium rounded-lg hover:bg-[#2f7fb8] transition-colors"
            >
              <Plus size={12} /> New Work Order
            </Link>
          </div>
          {workOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-[#8598aa]">
              <ClipboardList size={40} className="mb-3 opacity-30" />
              <p className="font-medium">No work orders for this site</p>
              <p className="text-sm mt-1 opacity-70">Click "New Work Order" above to create one</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#33465b] bg-[#1a2532]">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#aebfce]">WO #</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#aebfce]">Title</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#aebfce]">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#aebfce]">Priority</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#aebfce]">Assigned</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#aebfce]">Scheduled</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a3a4d]">
                {workOrders.map(wo => (
                  <tr
                    key={wo.id}
                    onClick={() => router.push(`/maintenance/${wo.id}`)}
                    className="hover:bg-[#22303f] cursor-pointer"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-[#5FB8E0] font-semibold">{wo.wo_number}</td>
                    <td className="px-4 py-3 font-medium text-[#eaf2fb]">{wo.title}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${WO_STATUS[wo.status] ?? 'bg-[#22303f] text-[#98abbd]'}`}>
                        {wo.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-xs font-semibold capitalize ${PRIORITY[wo.priority] ?? 'text-[#98abbd]'}`}>
                      {wo.priority}
                    </td>
                    <td className="px-4 py-3 text-[#aebfce]">{wo.assignee_name ?? '—'}</td>
                    <td className="px-4 py-3 text-[#98abbd] text-xs">{formatDate(wo.scheduled_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Tab: Requests ────────────────────────────────────────────── */}
      {tab === 'requests' && (
        <div className="space-y-4">
          {/* Header with share link */}
          <div className="bg-[#1e2a3a] rounded-xl border border-[#33465b] p-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[#dbe6f0] mb-0.5">Property Request Portal</h3>
              <p className="text-xs text-[#98abbd]">Share this link with your property manager so they can submit maintenance requests directly.</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={`/request/${id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-[#33465b] rounded-lg hover:bg-[#22303f] text-[#aebfce] transition-colors"
              >
                <ExternalLink size={12} /> Preview
              </a>
              <button
                onClick={copyRequestLink}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${copySuccess ? 'bg-emerald-500 text-white' : 'bg-[#3f7fb8] text-white hover:bg-[#2f7fb8]'}`}
              >
                <Copy size={12} />
                {copySuccess ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
          </div>

          {/* Requests table */}
          <div className="bg-[#1e2a3a] rounded-xl border border-[#33465b] overflow-hidden">
            {requests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-[#8598aa]">
                <Inbox size={36} className="mb-3 opacity-30" />
                <p className="font-medium text-sm">No requests yet</p>
                <p className="text-xs mt-1">Share the request portal link with your property manager to get started</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#33465b] bg-[#1a2532]">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#98abbd]">Request</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#98abbd]">Area</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#98abbd]">Priority</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#98abbd]">Contact</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#98abbd]">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#98abbd]">Submitted</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a3a4d]">
                  {requests.map(req => {
                    const priBg: Record<string, string> = { urgent: 'bg-[rgba(239,68,68,0.18)] text-[#fca5a5]', high: 'bg-orange-100 text-orange-700', normal: 'bg-[rgba(95,184,224,0.15)] text-[#9FD8EC]', low: 'bg-[#22303f] text-[#98abbd]' }
                    const stBg:  Record<string, string> = { new: 'bg-yellow-100 text-yellow-700', acknowledged: 'bg-[rgba(95,184,224,0.15)] text-[#9FD8EC]', converted: 'bg-[rgba(126,224,168,0.15)] text-emerald-300', closed: 'bg-[#22303f] text-[#98abbd]' }
                    const age = Math.floor((Date.now() - new Date(req.created_at).getTime()) / 86400000)
                    return (
                      <tr key={req.id} className="hover:bg-[#22303f]">
                        <td className="px-4 py-3">
                          <div className="font-medium text-[#eaf2fb]">{req.title}</div>
                          {req.description && <div className="text-xs text-[#8598aa] truncate max-w-[220px] mt-0.5">{req.description}</div>}
                        </td>
                        <td className="px-4 py-3 text-[#98abbd] text-xs">{req.area ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${priBg[req.priority_requested] ?? priBg.normal}`}>
                            {req.priority_requested}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-[#98abbd]">
                          {req.contact_name && <div className="font-medium text-[#c3d3e2]">{req.contact_name}</div>}
                          {req.contact_email && <div>{req.contact_email}</div>}
                          {req.contact_phone && <div>{req.contact_phone}</div>}
                          {!req.contact_name && !req.contact_email && !req.contact_phone && '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${stBg[req.status] ?? stBg.new}`}>
                            {req.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-[#8598aa]">
                          {age === 0 ? 'Today' : age === 1 ? 'Yesterday' : `${age}d ago`}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {req.status === 'new' && (
                            <button
                              onClick={() => handleConvertRequest(req)}
                              disabled={convertingId === req.id}
                              className="text-xs font-medium text-[#5FB8E0] hover:text-[#5FB8E0] disabled:opacity-50 whitespace-nowrap"
                            >
                              {convertingId === req.id ? 'Creating…' : '+ Create WO'}
                            </button>
                          )}
                          {req.status === 'converted' && req.converted_wo_id && (
                            <a href={`/maintenance/${req.converted_wo_id}`} className="text-xs font-medium text-emerald-300 hover:underline">
                              View WO →
                            </a>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: PM Schedules ────────────────────────────────────────── */}
      {tab === 'pm_schedules' && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[#dbe6f0]">Preventive Maintenance Schedules</h3>
              <p className="text-xs text-[#98abbd] mt-0.5">Recurring PM tasks — work orders are auto-created when due</p>
            </div>
            <button
              onClick={() => { setShowPMForm(true); setPMError(null) }}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#3f7fb8] text-white rounded-lg text-sm font-medium hover:bg-[#2f7fb8]"
            >
              <Plus size={15} /> Add PM Schedule
            </button>
          </div>

          {/* Add form */}
          {showPMForm && (
            <div className="bg-[#1e2a3a] rounded-xl border border-[#33465b] p-5">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-semibold text-[#dbe6f0]">New PM Schedule</h4>
                <button onClick={() => setShowPMForm(false)} className="text-[#8598aa] hover:text-[#c3d3e2]">
                  <X size={16} />
                </button>
              </div>
              <form onSubmit={handleAddPMSchedule} className="space-y-3">
                {pmError && (
                  <div className="bg-[rgba(239,68,68,0.13)] border border-[rgba(239,68,68,0.35)] text-[#fca5a5] rounded-lg px-4 py-2.5 text-sm">{pmError}</div>
                )}
                <div>
                  <label className="block text-xs font-medium text-[#aebfce] mb-1">Title *</label>
                  <input
                    value={pmForm.title}
                    onChange={e => setPMForm(p => ({ ...p, title: e.target.value }))}
                    placeholder="e.g. Gate lubrication"
                    className="w-full border border-[#3a4a5c] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5FB8E0]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#aebfce] mb-1">Description</label>
                  <textarea
                    value={pmForm.description}
                    onChange={e => setPMForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Optional checklist or instructions"
                    rows={2}
                    className="w-full border border-[#3a4a5c] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5FB8E0] resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#aebfce] mb-1">Interval</label>
                    <select
                      value={pmForm.interval_days}
                      onChange={e => setPMForm(p => ({ ...p, interval_days: e.target.value }))}
                      className="w-full border border-[#3a4a5c] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5FB8E0]"
                    >
                      <option value="30">Every 30 days</option>
                      <option value="60">Every 60 days</option>
                      <option value="90">Every 90 days</option>
                      <option value="180">Every 180 days</option>
                      <option value="365">Every 365 days</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#aebfce] mb-1">First Due Date *</label>
                    <input
                      type="date"
                      value={pmForm.next_due_at}
                      onChange={e => setPMForm(p => ({ ...p, next_due_at: e.target.value }))}
                      className="w-full border border-[#3a4a5c] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5FB8E0]"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowPMForm(false)}
                    className="px-4 py-2 text-sm border border-[#3a4a5c] rounded-lg hover:bg-[#22303f]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={pmSaving}
                    className="px-5 py-2 text-sm bg-[#3f7fb8] text-white rounded-lg hover:bg-[#2f7fb8] disabled:opacity-50"
                  >
                    {pmSaving ? 'Saving…' : 'Add Schedule'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Schedules list */}
          {pmSchedules.length === 0 && !showPMForm ? (
            <div className="bg-[#1e2a3a] rounded-xl border border-[#33465b] flex flex-col items-center justify-center py-16 text-[#8598aa]">
              <RefreshCw size={40} className="mb-3 opacity-30" />
              <p className="font-medium text-sm">No PM schedules yet</p>
              <p className="text-xs mt-1">Add recurring maintenance tasks — work orders are created automatically</p>
              <button
                onClick={() => setShowPMForm(true)}
                className="mt-4 flex items-center gap-2 px-4 py-2 bg-[#3f7fb8] text-white rounded-lg text-sm font-medium hover:bg-[#2f7fb8]"
              >
                <Plus size={15} /> Add PM Schedule
              </button>
            </div>
          ) : pmSchedules.length > 0 ? (
            <div className="bg-[#1e2a3a] rounded-xl border border-[#33465b] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#33465b] bg-[#1a2532]">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#98abbd]">Task</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#98abbd]">Interval</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#98abbd]">Next Due</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#98abbd]">Last Run</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#98abbd]">Active</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a3a4d]">
                  {pmSchedules.map(s => {
                    const due     = new Date(s.next_due_at)
                    const now     = new Date()
                    const daysOut = Math.floor((due.getTime() - now.getTime()) / 86400000)
                    const dueCls  = daysOut < 0
                      ? 'text-[#fca5a5] font-semibold'
                      : daysOut <= 7
                        ? 'text-amber-300 font-semibold'
                        : 'text-emerald-300'
                    const dueLabel = daysOut < 0
                      ? `${Math.abs(daysOut)}d overdue`
                      : daysOut === 0
                        ? 'Today'
                        : daysOut === 1
                          ? 'Tomorrow'
                          : formatDate(s.next_due_at)
                    return (
                      <tr key={s.id} className={`hover:bg-[#22303f] ${!s.is_active ? 'opacity-50' : ''}`}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-[#eaf2fb]">{s.title}</div>
                          {s.description && <div className="text-xs text-[#8598aa] truncate max-w-[220px] mt-0.5">{s.description}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-[#22303f] text-[#aebfce]">
                            <RotateCcw size={11} />
                            Every {s.interval_days}d
                          </span>
                        </td>
                        <td className={`px-4 py-3 text-sm ${dueCls}`}>
                          {dueLabel}
                        </td>
                        <td className="px-4 py-3 text-xs text-[#8598aa]">
                          {s.last_generated_at ? formatDate(s.last_generated_at) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleTogglePM(s)}
                            disabled={togglingPM === s.id}
                            title={s.is_active ? 'Deactivate' : 'Activate'}
                            className={`w-10 h-5 rounded-full relative transition-colors focus:outline-none disabled:opacity-50 ${s.is_active ? 'bg-[#3f7fb8]' : 'bg-slate-300'}`}
                          >
                            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-[#1e2a3a] rounded-full shadow transition-transform ${s.is_active ? 'translate-x-5' : 'translate-x-0'}`} />
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleDeletePM(s.id)}
                            disabled={deletingPM === s.id}
                            className="text-[#aebfce] hover:text-[#fb7185] transition-colors disabled:opacity-50"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      )}

      {/* ── Tab: Opportunities ──────────────────────────────────────────── */}
      {tab === 'opportunities' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[#dbe6f0]">Linked Opportunities</h3>
              <p className="text-xs text-[#8598aa] mt-0.5">All CRM opportunities tied to this property</p>
            </div>
            <Link
              href={`/crm/opportunities`}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5FB8E0] hover:underline"
            >
              <ExternalLink size={12} /> View CRM
            </Link>
          </div>
          {siteOpps.length === 0 ? (
            <div className="text-center py-12 text-sm text-[#8598aa]">
              <FileText size={24} className="mx-auto mb-2 text-[#aebfce]" />
              No opportunities linked to this property yet.<br />
              When a won opportunity creates this property, it appears here.
            </div>
          ) : (
            <div className="bg-[#1e2a3a] rounded-xl border border-[#2a3a4d] shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[#1a2532] border-b border-[#2a3a4d]">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#98abbd] uppercase tracking-wider">Opportunity</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#98abbd] uppercase tracking-wider">Type</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#98abbd] uppercase tracking-wider">Stage</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#98abbd] uppercase tracking-wider">Value</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#98abbd] uppercase tracking-wider">Close Date</th>
                    <th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#22303f]">
                  {siteOpps.map(opp => (
                    <tr key={opp.id} className="hover:bg-[#22303f] transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#eaf2fb]">{opp.name}</p>
                        <p className="text-xs text-[#8598aa]">{opp.account_name}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-block text-xs font-medium bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full capitalize">
                          {opp.opp_type?.replace(/_/g, ' ') ?? 'Property'}
                        </span>
                      </td>
                      <td className="px-4 py-3 capitalize text-[#aebfce]">{opp.stage?.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3 text-[#c3d3e2] font-medium">
                        {opp.amount ? `$${opp.amount.toLocaleString()}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-[#98abbd] text-xs">
                        {opp.close_date ? new Date(opp.close_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/crm/opportunities/${opp.id}`}
                          className="text-xs text-[#5FB8E0] hover:underline flex items-center gap-1 justify-end"
                        >
                          <ExternalLink size={11} /> View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'quotes' && (
        <div className='space-y-4'>
          <div className='flex items-center justify-between'>
            <div>
              <h3 className='text-sm font-semibold text-[#dbe6f0]'>Quotes</h3>
              <p className='text-xs text-[#8598aa] mt-0.5'>All quotes for this property</p>
            </div>
            <Link
              href={`/quotes/new?site_id=${id}&site_name=${encodeURIComponent(site?.name ?? '')}`}
              className='inline-flex items-center gap-1.5 text-xs font-medium text-[#5FB8E0] hover:underline'
            >
              <Plus size={12} /> New Quote
            </Link>
          </div>
          {!quotesLoaded ? (
            <div className='flex items-center gap-2 py-4 text-[#8598aa]'>
              <RefreshCw size={14} className='animate-spin' />
              <span className='text-sm'>Loading…</span>
            </div>
          ) : siteQuotes.length === 0 ? (
            <div className='text-center py-12 text-sm text-[#8598aa]'>
              <FileText size={24} className='mx-auto mb-2 text-[#aebfce]' />
              No quotes for this property yet.
            </div>
          ) : (
            <div className='bg-[#1e2a3a] rounded-xl border border-[#2a3a4d] shadow-sm overflow-hidden'>
              <table className='w-full text-sm'>
                <thead className='bg-[#1a2532] border-b border-[#2a3a4d]'>
                  <tr>
                    <th className='text-left px-4 py-2.5 text-xs font-semibold text-[#98abbd] uppercase tracking-wider'>Quote #</th>
                    <th className='text-left px-4 py-2.5 text-xs font-semibold text-[#98abbd] uppercase tracking-wider'>Property</th>
                    <th className='text-right px-4 py-2.5 text-xs font-semibold text-[#98abbd] uppercase tracking-wider'>Setup</th>
                    <th className='text-right px-4 py-2.5 text-xs font-semibold text-[#98abbd] uppercase tracking-wider'>MRR</th>
                    <th className='text-left px-4 py-2.5 text-xs font-semibold text-[#98abbd] uppercase tracking-wider'>Status</th>
                    <th className='text-left px-4 py-2.5 text-xs font-semibold text-[#98abbd] uppercase tracking-wider'>Date</th>
                    <th />
                  </tr>
                </thead>
                <tbody className='divide-y divide-[#22303f]'>
                  {siteQuotes.map(q => (
                    <tr key={q.id} className='hover:bg-[#22303f] transition-colors'>
                      <td className='px-4 py-3'>
                        <span className='font-mono text-xs text-[#5FB8E0]'>{q.quote_number}</span>
                      </td>
                      <td className='px-4 py-3'>
                        <span className='text-[#dbe6f0]'>{q.property_name ?? site?.name ?? '—'}</span>
                        {q.units ? <span className='text-xs text-[#8598aa] ml-1'>({q.units} units)</span> : null}
                      </td>
                      <td className='px-4 py-3 text-right font-medium text-[#c3d3e2]'>
                        ${q.total_one_time.toLocaleString()}
                      </td>
                      <td className='px-4 py-3 text-right'>
                        <span className='text-violet-300 font-medium'>${q.total_mrr.toLocaleString()}</span>
                        <span className='text-xs text-[#8598aa]'>/mo</span>
                      </td>
                      <td className='px-4 py-3'>
                        <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full capitalize
                          ${q.status === 'accepted' ? 'bg-[rgba(126,224,168,0.15)] text-emerald-300'
                          : q.status === 'sent' || q.status === 'viewed' ? 'bg-[rgba(95,184,224,0.15)] text-[#9FD8EC]'
                          : q.status === 'declined' ? 'bg-[rgba(239,68,68,0.18)] text-[#fca5a5]'
                          : 'bg-[#22303f] text-[#98abbd]'}`}
                        >
                          {q.status}
                        </span>
                      </td>
                      <td className='px-4 py-3 text-xs text-[#8598aa]'>
                        {new Date(q.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className='px-4 py-3 text-right'>
                        <Link
                          href={`/quotes/${q.id}`}
                          className='text-xs text-[#5FB8E0] hover:underline flex items-center gap-1 justify-end'
                        >
                          <ExternalLink size={11} /> View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Warranty & RMA ────────────────────────────────────── */}
      {tab === 'warranty' && (
        <div className="space-y-6">
          {/* Expiring Soon */}
          {(() => {
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            const expiringSoon = (assets as AssetWithWarranty[]).filter(a => {
              if (!a.warranty_expires_at) return false
              const exp = new Date(a.warranty_expires_at + 'T00:00:00')
              const days = Math.floor((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
              return days >= 0 && days <= 90
            }).sort((a, b) => {
              const da = new Date((a as AssetWithWarranty).warranty_expires_at! + 'T00:00:00').getTime()
              const db = new Date((b as AssetWithWarranty).warranty_expires_at! + 'T00:00:00').getTime()
              return da - db
            })

            if (expiringSoon.length === 0) return null
            return (
              <div>
                <h3 className="text-sm font-semibold text-[#dbe6f0] mb-3 flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
                  Expiring Within 90 Days ({expiringSoon.length})
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {expiringSoon.map(a => {
                    const wa = a as AssetWithWarranty
                    const exp = new Date(wa.warranty_expires_at! + 'T00:00:00')
                    const days = Math.floor((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                    return (
                      <div key={a.id} className="bg-amber-50 border border-[rgba(251,191,36,0.35)] rounded-xl p-4">
                        <p className="font-medium text-[#dbe6f0] text-sm">{a.product_name}</p>
                        {a.product_sku && <p className="text-xs text-[#8598aa]">{a.product_sku}</p>}
                        <p className="text-xs text-amber-300 mt-2 font-semibold">
                          Expires in {days} day{days !== 1 ? 's' : ''}
                        </p>
                        {wa.warranty_provider && (
                          <p className="text-xs text-[#98abbd] mt-0.5">{wa.warranty_provider}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* All Assets warranty grid */}
          <div>
            <h3 className="text-sm font-semibold text-[#dbe6f0] mb-3">All Equipment — Warranty Status</h3>
            {assets.length === 0 ? (
              <div className="text-center py-10 text-[#8598aa] text-sm">No equipment on this site yet.</div>
            ) : (
              <div className="bg-[#1e2a3a] border border-[#33465b] rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-[#1a2532] border-b border-[#2a3a4d]">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#98abbd] uppercase tracking-wider">Asset</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#98abbd] uppercase tracking-wider">Serial #</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#98abbd] uppercase tracking-wider">Warranty Expires</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#98abbd] uppercase tracking-wider">Provider</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#98abbd] uppercase tracking-wider">RMA Status</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#22303f]">
                    {(assets as AssetWithWarranty[]).map(a => {
                      const rmaStatus = a.rma_status ?? 'none'
                      return (
                        <tr key={a.id} className="hover:bg-[#22303f] transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-medium text-[#dbe6f0]">{a.product_name}</p>
                            {a.product_category && <p className="text-xs text-[#8598aa]">{a.product_category}</p>}
                          </td>
                          <td className="px-4 py-3 text-xs font-mono text-[#98abbd]">{a.serial_number ?? '—'}</td>
                          <td className="px-4 py-3 text-xs text-[#aebfce]">
                            {a.warranty_expires_at ? formatDate(a.warranty_expires_at) : '—'}
                          </td>
                          <td className="px-4 py-3 text-xs text-[#98abbd]">{a.warranty_provider ?? '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize
                              ${rmaStatus === 'pending'  ? 'bg-[rgba(251,191,36,0.15)] text-amber-300' :
                                rmaStatus === 'shipped'  ? 'bg-[rgba(95,184,224,0.15)] text-[#9FD8EC]' :
                                rmaStatus === 'received' ? 'bg-purple-100 text-purple-700' :
                                rmaStatus === 'resolved' ? 'bg-[rgba(126,224,168,0.15)] text-emerald-300' :
                                'bg-[#22303f] text-[#8598aa]'}`}
                            >
                              {rmaStatus === 'none' ? 'No RMA' : rmaStatus}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {rmaStatus !== 'none' && rmaStatus !== 'resolved' && (
                              <button
                                onClick={() => {
                                  setEditRma({
                                    id: a.rma_ticket_number ?? a.id,
                                    site_asset_id: a.id,
                                    status: rmaStatus as RMARecord['status'],
                                    ticket_number: a.rma_ticket_number ?? '',
                                    notes: a.rma_notes ?? '',
                                    asset_name: a.product_name,
                                  })
                                  setRmaForm({
                                    status: rmaStatus,
                                    ticket_number: a.rma_ticket_number ?? '',
                                    notes: a.rma_notes ?? '',
                                  })
                                  setRmaSlideOpen(true)
                                }}
                                className="text-xs text-[#5FB8E0] hover:text-[#5FB8E0] font-medium"
                              >
                                Update
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
          </div>

          {/* Active RMAs section — pulled from asset rma_status fields */}
          {(() => {
            const activeRMAs = (assets as AssetWithWarranty[]).filter(a =>
              a.rma_status && !['none', 'resolved', 'denied'].includes(a.rma_status)
            )
            if (activeRMAs.length === 0) return (
              <div className="text-center py-8 text-[#8598aa]">
                <Shield size={24} className="mx-auto mb-2 text-[#aebfce]" />
                <p className="text-sm">No active RMAs</p>
                <p className="text-xs mt-1">RMA records appear here when equipment status is set to pending, shipped, or received</p>
              </div>
            )
            return (
              <div>
                <h3 className="text-sm font-semibold text-[#dbe6f0] mb-3">Active RMAs ({activeRMAs.length})</h3>
                <div className="space-y-3">
                  {activeRMAs.map(a => {
                    const rmaStatus = a.rma_status ?? 'pending'
                    return (
                      <div key={a.id} className="bg-[#1e2a3a] border border-[#33465b] rounded-xl p-4 flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium text-[#dbe6f0] text-sm">{a.product_name}</p>
                          {a.rma_ticket_number && (
                            <p className="text-xs font-mono text-[#8598aa] mt-0.5">Ticket: {a.rma_ticket_number}</p>
                          )}
                          {a.rma_initiated_at && (
                            <p className="text-xs text-[#8598aa] mt-0.5">Initiated: {formatDate(a.rma_initiated_at)}</p>
                          )}
                          {a.rma_notes && (
                            <p className="text-xs text-[#98abbd] mt-1">{a.rma_notes}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold capitalize
                            ${rmaStatus === 'pending'  ? 'bg-[rgba(251,191,36,0.15)] text-amber-300' :
                              rmaStatus === 'shipped'  ? 'bg-[rgba(95,184,224,0.15)] text-[#9FD8EC]' :
                              rmaStatus === 'received' ? 'bg-purple-100 text-purple-700' :
                              'bg-[#22303f] text-[#8598aa]'}`}
                          >
                            {rmaStatus}
                          </span>
                          <button
                            onClick={() => {
                              setEditRma({
                                id: a.rma_ticket_number ?? a.id,
                                site_asset_id: a.id,
                                status: rmaStatus as RMARecord['status'],
                                ticket_number: a.rma_ticket_number ?? '',
                                notes: a.rma_notes ?? '',
                                asset_name: a.product_name,
                              })
                              setRmaForm({
                                status: rmaStatus,
                                ticket_number: a.rma_ticket_number ?? '',
                                notes: a.rma_notes ?? '',
                              })
                              setRmaSlideOpen(true)
                            }}
                            className="text-xs font-medium text-[#5FB8E0] hover:text-[#5FB8E0] border border-[#5FB8E0] px-3 py-1.5 rounded-lg hover:bg-[#3f7fb8] transition-colors"
                          >
                            Update
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* ── Tab: Tasks ─────────────────────────────────────────────────── */}
      {tab === 'tasks' && id && (
        <TrackerBoard entityType="site" entityId={id} />
      )}

      {/* RMA Update SlideOver */}
      {rmaSlideOpen && editRma && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40" onClick={() => setRmaSlideOpen(false)} />
          <div className="w-full max-w-md bg-[#1e2a3a] shadow-2xl flex flex-col h-full">
            <div className="sticky top-0 bg-[#1e2a3a] border-b border-[#33465b] px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-[#eaf2fb]">Update RMA</h2>
                <p className="text-xs text-[#8598aa] mt-0.5">{editRma.asset_name}</p>
              </div>
              <button onClick={() => setRmaSlideOpen(false)} className="text-[#8598aa] hover:text-[#c3d3e2]">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-[#aebfce] mb-1">Status</label>
                <select
                  value={rmaForm.status}
                  onChange={e => setRmaForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full border border-[#3a4a5c] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5FB8E0]"
                >
                  <option value="pending">Pending</option>
                  <option value="shipped">Shipped</option>
                  <option value="received">Received</option>
                  <option value="resolved">Resolved</option>
                  <option value="denied">Denied</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#aebfce] mb-1">Ticket Number</label>
                <input
                  value={rmaForm.ticket_number}
                  onChange={e => setRmaForm(f => ({ ...f, ticket_number: e.target.value }))}
                  placeholder="RMA-12345"
                  className="w-full border border-[#3a4a5c] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5FB8E0]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#aebfce] mb-1">Notes</label>
                <textarea
                  value={rmaForm.notes}
                  onChange={e => setRmaForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="RMA notes, tracking number, resolution details…"
                  rows={4}
                  className="w-full border border-[#3a4a5c] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5FB8E0] resize-none"
                />
              </div>
            </div>
            <div className="sticky bottom-0 bg-[#1e2a3a] border-t border-[#33465b] px-6 py-4 flex gap-3 justify-end">
              <button
                onClick={() => setRmaSlideOpen(false)}
                className="px-4 py-2 text-sm border border-[#3a4a5c] rounded-lg hover:bg-[#22303f]"
              >
                Cancel
              </button>
              <button
                disabled={rmaSaving}
                onClick={async () => {
                  setRmaSaving(true)
                  try {
                    await fetch(`/api/sites/${id}/assets`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        asset_id:          editRma.site_asset_id,
                        rma_status:        rmaForm.status,
                        rma_ticket_number: rmaForm.ticket_number || null,
                        rma_notes:         rmaForm.notes || null,
                      }),
                    })
                    // Optimistically update local assets state
                    setAssets(prev => prev.map(a => {
                      if (a.id !== editRma.site_asset_id) return a
                      return {
                        ...a,
                        rma_status:        rmaForm.status,
                        rma_ticket_number: rmaForm.ticket_number || null,
                        rma_notes:         rmaForm.notes || null,
                      } as AssetWithWarranty
                    }))
                    setRmaSlideOpen(false)
                  } finally { setRmaSaving(false) }
                }}
                className="px-5 py-2 text-sm bg-[#3f7fb8] text-white rounded-lg hover:bg-[#2f7fb8] disabled:opacity-50"
              >
                {rmaSaving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add asset panel */}
      <AddAssetSlideOver
        siteId={id}
        open={showAddAsset}
        onClose={() => setShowAddAsset(false)}
        onSaved={asset => {
          setAssets(prev => [...prev, asset])
          setTab('assets')
        }}
      />
    </div>
    </div>
  )
}

/* ─── Org picker modal ───────────────────────────────── */
interface OrgLink { id: string; name: string; org_tier?: string }

function OrgPickerModal({ open, onClose, onSelect, tierFilter, title }: {
  open: boolean
  onClose: () => void
  onSelect: (org: OrgLink | null) => void
  tierFilter?: string
  title: string
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<OrgLink[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (!open) { setQ(''); setResults([]) }
  }, [open])

  useEffect(() => {
    if (!q.trim()) { setResults([]); return }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const url = `/api/customers?q=${encodeURIComponent(q)}${tierFilter ? `&tier=${tierFilter}` : ''}`
        const res = await fetch(url)
        const json = await res.json()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setResults((json.records ?? []).map((o: any) => ({ id: o.id, name: o.name, org_tier: o.org_tier })))
      } finally { setSearching(false) }
    }, 300)
    return () => clearTimeout(t)
  }, [q, tierFilter])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-[#1e2a3a] rounded-2xl shadow-2xl w-full max-w-md max-h-[70vh] flex flex-col">
        <div className="px-5 py-4 border-b border-[#33465b] flex items-center justify-between">
          <h3 className="font-semibold text-[#eaf2fb]">{title}</h3>
          <button onClick={onClose} className="text-[#8598aa] hover:text-[#c3d3e2]"><X size={18} /></button>
        </div>
        <div className="px-4 py-3 border-b border-[#2a3a4d]">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8598aa]" />
            <input
              autoFocus
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search by name..."
              className="w-full pl-9 pr-4 py-2 border border-[#33465b] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#5FB8E0]"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {searching && <div className="flex items-center justify-center py-8 text-[#8598aa] text-sm">Searching…</div>}
          {!searching && q && results.length === 0 && (
            <div className="py-8 text-center text-[#8598aa] text-sm">No results for &ldquo;{q}&rdquo;</div>
          )}
          {!searching && !q && (
            <div className="py-6 text-center text-[#8598aa] text-sm">Type to search organizations</div>
          )}
          {results.map(org => (
            <button
              key={org.id}
              onClick={() => { onSelect(org); onClose() }}
              className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[#22303f] text-left border-b border-[#2a3a4d] last:border-0"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#eaf2fb] truncate">{org.name}</p>
                {org.org_tier && <p className="text-xs text-[#8598aa] capitalize">{org.org_tier.replace(/_/g, ' ')}</p>}
              </div>
              <span className="text-xs text-[#5FB8E0] font-medium shrink-0">Select →</span>
            </button>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-[#2a3a4d]">
          <button
            onClick={() => { onSelect(null); onClose() }}
            className="text-sm text-[#8598aa] hover:text-[#fb7185]"
          >
            Remove assignment
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Assignment card ────────────────────────────────── */
function AssignmentCard({
  role, label, fieldKey, orgLink, onAssign, color, bgColor, borderColor, primary,
}: {
  role: string
  label: string
  fieldKey: string
  orgLink: OrgLink | null
  onAssign: (field: string) => void
  color: string
  bgColor: string
  borderColor: string
  primary?: boolean
}) {
  return (
    <div className={`rounded-xl border ${borderColor} ${bgColor} p-4`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-bold uppercase tracking-widest ${color}`}>{role}</span>
        {primary && (
          <span className="text-xs bg-[#1e2a3a]/70 border border-[#33465b] text-[#98abbd] px-2 py-0.5 rounded-full">Primary</span>
        )}
      </div>
      <p className="text-xs text-[#98abbd] mb-3">{label}</p>
      {orgLink ? (
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-[#dbe6f0] truncate">{orgLink.name}</span>
          <div className="flex items-center gap-2 shrink-0">
            <Link href={`/customers/${orgLink.id}`} className={`text-xs font-medium ${color} hover:underline`}>View</Link>
            <span className="text-[#aebfce]">·</span>
            <button onClick={() => onAssign(fieldKey)} className="text-xs text-[#8598aa] hover:text-[#c3d3e2]">Transfer</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => onAssign(fieldKey)}
          className={`text-sm ${color} hover:opacity-80 font-medium flex items-center gap-1`}
        >
          <Plus size={13} /> Assign
        </button>
      )}
    </div>
  )
}

/* ─── Info row ───────────────────────────────────────── */
function InfoRow({ label, value, monospace }: { label: string; value: React.ReactNode; monospace?: boolean }) {
  return (
    <div className="flex gap-3">
      <dt className="w-28 shrink-0 text-[#8598aa]">{label}</dt>
      <dd className={`text-[#c3d3e2] ${monospace ? 'font-mono' : ''}`}>
        {value ?? <span className="text-[#aebfce]">—</span>}
      </dd>
    </div>
  )
}

/* ─── Mapbox map embed ───────────────────────────────── */
function SiteMapEmbed({ address }: { address: string }) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

  useEffect(() => {
    if (!token) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let map: any = null

    const loadMap = async () => {
      // Load CSS once
      if (!document.getElementById('mapbox-gl-css')) {
        const link = document.createElement('link')
        link.id   = 'mapbox-gl-css'
        link.rel  = 'stylesheet'
        link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css'
        document.head.appendChild(link)
      }

      // Load JS once
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!(window as any).mapboxgl) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script')
          script.src     = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js'
          script.onload  = () => resolve()
          script.onerror = () => reject(new Error('Mapbox load failed'))
          document.head.appendChild(script)
        })
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapboxgl = (window as any).mapboxgl
      mapboxgl.accessToken = token

      // Geocode the address
      let coords: [number, number] = [-84.3877, 33.7490] // Atlanta fallback
      try {
        const geo = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${token}&limit=1`
        )
        const geoJson = await geo.json()
        const feature = geoJson.features?.[0]
        if (feature) coords = feature.center as [number, number]
      } catch { /* use fallback coords */ }

      const container = document.getElementById('site-map-container')
      if (!container) return

      map = new mapboxgl.Map({
        container: 'site-map-container',
        style:     'mapbox://styles/mapbox/streets-v12',
        center:    coords,
        zoom:      15,
      })

      new mapboxgl.Marker({ color: '#5FB8E0' })
        .setLngLat(coords)
        .addTo(map)
    }

    loadMap()

    return () => {
      if (map) map.remove()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address])

  if (!token) {
    return (
      <div className="h-[280px] rounded-xl border border-border bg-[#1a2532] flex flex-col items-center justify-center text-[#8598aa] text-sm gap-1">
        <MapPin size={24} className="text-[#aebfce]" />
        <span>Map unavailable — set NEXT_PUBLIC_MAPBOX_TOKEN</span>
      </div>
    )
  }

  return (
    <div
      id="site-map-container"
      style={{ height: '280px' }}
      className="rounded-xl overflow-hidden border border-border"
    />
  )
}

/* ─── Group assets by zone ───────────────────────────── */
function groupByZone(assets: Asset[]): { zone: string | null; items: Asset[] }[] {
  const map = new Map<string | null, Asset[]>()
  for (const a of assets) {
    const key = a.location_zone ?? null
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(a)
  }
  return Array.from(map.entries()).map(([zone, items]) => ({ zone, items }))
}
