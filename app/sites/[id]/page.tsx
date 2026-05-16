'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Building2, MapPin, Phone, Mail, Wrench, ChevronLeft,
  Plus, Shield, Activity, ClipboardList, Package,
  CheckCircle2, AlertTriangle, XCircle, Wifi, WifiOff,
  Key, FileText, Edit3, Trash2, RefreshCw,
} from 'lucide-react'

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
      <div className="w-full max-w-lg bg-white shadow-2xl flex flex-col h-full overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Add Installed Equipment</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Product Name *</label>
            <input value={form.product_name} onChange={e => set('product_name', e.target.value)} placeholder="DoorKing 6050" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">SKU / Model</label>
              <input value={form.product_sku} onChange={e => set('product_sku', e.target.value)} placeholder="DK-6050" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <select value={form.product_category} onChange={e => set('product_category', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
              <input value={form.location_note} onChange={e => set('location_note', e.target.value)} placeholder="Main Gate" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Zone (optional)</label>
              <input value={form.location_zone} onChange={e => set('location_zone', e.target.value)} placeholder="North Entry" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Hardware IDs</p>
            <div className="space-y-3">
              <input value={form.serial_number} onChange={e => set('serial_number', e.target.value)} placeholder="Serial number" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              <div className="grid grid-cols-2 gap-3">
                <input value={form.mac_address} onChange={e => set('mac_address', e.target.value)} placeholder="MAC address" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                <input value={form.ip_address} onChange={e => set('ip_address', e.target.value)} placeholder="IP address" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Install Record</p>
            <div className="space-y-3">
              <input value={form.installed_by} onChange={e => set('installed_by', e.target.value)} placeholder="Installed by (tech name)" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              <textarea value={form.install_notes} onChange={e => set('install_notes', e.target.value)} placeholder="Install notes" rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none" />
            </div>
          </div>
        </form>

        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="px-5 py-2 text-sm bg-brand-400 text-white rounded-lg hover:bg-brand-500 disabled:opacity-50">
            {saving ? 'Saving…' : 'Add Equipment'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Helpers ────────────────────────────────────────── */
const ASSET_STATUS: Record<string, { label: string; color: string; dot: string }> = {
  active:   { label: 'Online',   color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  offline:  { label: 'Offline',  color: 'bg-red-100 text-red-700',         dot: 'bg-red-500'     },
  degraded: { label: 'Degraded', color: 'bg-amber-100 text-amber-700',     dot: 'bg-amber-500'   },
  replaced: { label: 'Replaced', color: 'bg-slate-100 text-slate-500',     dot: 'bg-slate-400'   },
}

const WO_STATUS: Record<string, string> = {
  open:        'bg-blue-100 text-blue-700',
  scheduled:   'bg-violet-100 text-violet-700',
  in_progress: 'bg-amber-100 text-amber-700',
  completed:   'bg-emerald-100 text-emerald-700',
  cancelled:   'bg-slate-100 text-slate-500',
}

const PRIORITY: Record<string, string> = {
  critical: 'text-red-600',
  high:     'text-amber-600',
  normal:   'text-slate-500',
  low:      'text-slate-400',
}

const SEVERITY_ICON: Record<string, JSX.Element> = {
  critical: <AlertTriangle size={14} className="text-red-500" />,
  warning:  <AlertTriangle size={14} className="text-amber-500" />,
  info:     <Activity size={14} className="text-brand-400" />,
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
type Tab = 'overview' | 'assets' | 'events' | 'work_orders'

export default function SiteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [site, setSite]             = useState<Site | null>(null)
  const [assets, setAssets]         = useState<Asset[]>([])
  const [events, setEvents]         = useState<SiteEvent[]>([])
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [loading, setLoading]       = useState(true)
  const [tab, setTab]               = useState<Tab>('overview')
  const [showAddAsset, setShowAddAsset] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/sites/${id}`)
      const json = await res.json()
      if (!res.ok) { router.push('/sites'); return }
      setSite(json.site)
      setAssets(json.assets)
      setEvents(json.events)
      setWorkOrders(json.work_orders)
    } finally { setLoading(false) }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-brand-400 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!site) return null

  const siteStatus = (site.status in ASSET_STATUS) ? ASSET_STATUS[site.status] : null
  const activeAssets   = assets.filter(a => a.status === 'active').length
  const offlineAssets  = assets.filter(a => a.status === 'offline').length

  const TABS: { id: Tab; label: string; icon: any; count?: number }[] = [
    { id: 'overview',    label: 'Overview',     icon: Building2 },
    { id: 'assets',      label: 'Equipment',    icon: Package,    count: assets.length },
    { id: 'events',      label: 'Events',       icon: Activity,   count: events.length },
    { id: 'work_orders', label: 'Work Orders',  icon: ClipboardList, count: workOrders.length },
  ]

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Back */}
      <Link href="/sites" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-400 mb-4 transition-colors">
        <ChevronLeft size={16} /> Back to Properties
      </Link>

      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-slate-900">{site.name}</h1>
            {/* Status badge */}
            <select
              value={site.status}
              disabled={statusUpdating}
              onChange={e => handleStatusChange(e.target.value)}
              className="text-xs border border-slate-200 rounded-full px-3 py-1 font-medium focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
            >
              <option value="active">Active</option>
              <option value="prospect">Prospect</option>
              <option value="inactive">Inactive</option>
              <option value="churned">Churned</option>
            </select>
          </div>
          {(site.city || site.address) && (
            <p className="text-sm text-slate-500 flex items-center gap-1.5">
              <MapPin size={14} />
              {[site.address, site.city, site.state, site.zip].filter(Boolean).join(', ')}
            </p>
          )}
        </div>

        {/* KPI pills */}
        <div className="flex items-center gap-3 text-sm">
          {site.units && (
            <div className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-full">
              {site.units.toLocaleString()} units
            </div>
          )}
          <div className={`px-3 py-1.5 rounded-full font-medium ${activeAssets > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
            {activeAssets} device{activeAssets !== 1 ? 's' : ''} online
          </div>
          {offlineAssets > 0 && (
            <div className="px-3 py-1.5 bg-red-100 text-red-700 rounded-full font-medium flex items-center gap-1.5">
              <WifiOff size={12} /> {offlineAssets} offline
            </div>
          )}
          <button
            onClick={() => setShowAddAsset(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-400 text-white rounded-lg text-sm font-medium hover:bg-brand-500"
          >
            <Plus size={15} /> Add Equipment
          </button>
        </div>
      </div>

      {/* ── Dealer attribution card ────────────────────────────────── */}
      {/* This is the "who owns, installs, services" 3-column panel */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <DealerCard
          role="Master Dealer"
          label="Account Owner"
          id={site.master_dealer_id}
          color="text-violet-600"
          bgColor="bg-violet-50"
          borderColor="border-violet-200"
        />
        <DealerCard
          role="Install Dealer"
          label="Installed By"
          id={site.install_dealer_id}
          color="text-blue-600"
          bgColor="bg-blue-50"
          borderColor="border-blue-200"
        />
        <DealerCard
          role="Service Dealer"
          label="Day-to-Day Contact"
          id={site.service_dealer_id}
          color="text-brand-400"
          bgColor="bg-brand-50"
          borderColor="border-brand-200"
          primary
        />
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-slate-200 mb-6">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
              tab === t.id
                ? 'border-brand-400 text-brand-400'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <t.icon size={15} />
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === t.id ? 'bg-brand-100 text-brand-400' : 'bg-slate-100 text-slate-500'}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab: Overview ────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="grid grid-cols-2 gap-6">
          {/* Property info */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <Building2 size={16} className="text-slate-400" /> Property Info
            </h3>
            <dl className="space-y-3 text-sm">
              <InfoRow label="Type"     value={site.property_type} />
              <InfoRow label="Units"    value={site.units?.toLocaleString() ?? null} />
              <InfoRow label="Address"  value={[site.address, site.city, site.state].filter(Boolean).join(', ') || null} />
              <InfoRow label="Added"    value={formatDate(site.created_at)} />
              {site.crm_opp_id && (
                <InfoRow label="CRM Opp" value={
                  <Link href={`/crm/opportunities/${site.crm_opp_id}`} className="text-brand-400 hover:underline">
                    View opportunity →
                  </Link>
                } />
              )}
            </dl>
          </div>

          {/* Contacts */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <Mail size={16} className="text-slate-400" /> Contacts
            </h3>
            <div className="space-y-4 text-sm">
              {site.pm_name && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Property Manager</p>
                  <p className="font-medium text-slate-900">{site.pm_name}</p>
                  {site.pm_email && <a href={`mailto:${site.pm_email}`} className="text-brand-400 hover:underline block">{site.pm_email}</a>}
                  {site.pm_phone && <p className="text-slate-500">{site.pm_phone}</p>}
                </div>
              )}
              {site.primary_contact_name && site.primary_contact_name !== site.pm_name && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Primary Contact</p>
                  <p className="font-medium text-slate-900">{site.primary_contact_name}</p>
                  {site.primary_contact_email && <a href={`mailto:${site.primary_contact_email}`} className="text-brand-400 hover:underline block">{site.primary_contact_email}</a>}
                </div>
              )}
              {!site.pm_name && !site.primary_contact_name && (
                <p className="text-slate-400">No contacts added</p>
              )}
            </div>
          </div>

          {/* Access info */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <Key size={16} className="text-slate-400" /> Site Access (Tech Info)
            </h3>
            <dl className="space-y-3 text-sm">
              <InfoRow label="Gate Code"    value={site.gate_code} monospace />
              <InfoRow label="Parking"      value={site.parking_notes} />
              <InfoRow label="Access Notes" value={site.access_notes} />
            </dl>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <FileText size={16} className="text-slate-400" /> Notes
            </h3>
            {site.notes ? (
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{site.notes}</p>
            ) : (
              <p className="text-sm text-slate-400">No notes</p>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Assets ──────────────────────────────────────────────── */}
      {tab === 'assets' && (
        <div className="space-y-3">
          {assets.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-16 text-slate-400">
              <Package size={40} className="mb-3 opacity-30" />
              <p className="font-medium">No equipment documented</p>
              <p className="text-sm mt-1">Add the devices installed at this property</p>
              <button
                onClick={() => setShowAddAsset(true)}
                className="mt-4 flex items-center gap-2 px-4 py-2 bg-brand-400 text-white rounded-lg text-sm font-medium hover:bg-brand-500"
              >
                <Plus size={15} /> Add Equipment
              </button>
            </div>
          ) : (
            <>
              {/* Group by zone */}
              {groupByZone(assets).map(({ zone, items }) => (
                <div key={zone} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  {zone && (
                    <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{zone}</span>
                    </div>
                  )}
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Device</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Location</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Serial</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">IP</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Status</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Installed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {items.map(asset => {
                        const cfg = ASSET_STATUS[asset.status] ?? ASSET_STATUS.active
                        return (
                          <tr key={asset.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3">
                              <div className="font-medium text-slate-900">{asset.product_name}</div>
                              {asset.product_sku && <div className="text-xs text-slate-400 font-mono">{asset.product_sku}</div>}
                              {asset.product_category && <div className="text-xs text-slate-400">{asset.product_category}</div>}
                            </td>
                            <td className="px-4 py-3 text-slate-600">{asset.location_note}</td>
                            <td className="px-4 py-3 font-mono text-xs text-slate-500">{asset.serial_number ?? '—'}</td>
                            <td className="px-4 py-3 font-mono text-xs text-slate-500">{asset.ip_address ?? '—'}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.color}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                {cfg.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-500">
                              {formatDate(asset.installed_at)}
                              {asset.installed_by && <div className="text-slate-400">{asset.installed_by}</div>}
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
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Activity size={40} className="mb-3 opacity-30" />
              <p className="font-medium">No events yet</p>
              <p className="text-sm mt-1">Events are logged automatically as activity occurs</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {events.map(ev => (
                <div key={ev.id} className="flex items-start gap-3 px-5 py-4 hover:bg-slate-50">
                  <div className="mt-0.5">{SEVERITY_ICON[ev.severity] ?? SEVERITY_ICON.info}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{ev.event_type.replace(/_/g, ' ')}</span>
                      <span className="text-xs text-slate-400">via {ev.event_source}</span>
                    </div>
                    {ev.summary && <p className="text-sm text-slate-700 mt-0.5">{ev.summary}</p>}
                  </div>
                  <div className="text-xs text-slate-400 shrink-0">{formatDateTime(ev.created_at)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Work Orders ─────────────────────────────────────────── */}
      {tab === 'work_orders' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {workOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <ClipboardList size={40} className="mb-3 opacity-30" />
              <p className="font-medium">No work orders for this site</p>
              <Link href="/maintenance" className="mt-4 flex items-center gap-2 px-4 py-2 bg-brand-400 text-white rounded-lg text-sm font-medium hover:bg-brand-500">
                <Plus size={15} /> Create Work Order
              </Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600">WO #</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600">Title</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600">Priority</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600">Assigned</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600">Scheduled</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {workOrders.map(wo => (
                  <tr key={wo.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-brand-400 font-semibold">{wo.wo_number}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{wo.title}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${WO_STATUS[wo.status] ?? 'bg-slate-100 text-slate-500'}`}>
                        {wo.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-xs font-semibold capitalize ${PRIORITY[wo.priority] ?? 'text-slate-500'}`}>
                      {wo.priority}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{wo.assignee_name ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(wo.scheduled_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
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
  )
}

/* ─── Dealer attribution card ────────────────────────── */
function DealerCard({
  role, label, id, color, bgColor, borderColor, primary,
}: {
  role: string
  label: string
  id: string | null
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
          <span className="text-xs bg-white/70 border border-slate-200 text-slate-500 px-2 py-0.5 rounded-full">Primary</span>
        )}
      </div>
      <p className="text-xs text-slate-500 mb-3">{label}</p>
      {id ? (
        <div className="flex items-center justify-between">
          <span className="text-sm font-mono text-slate-400 truncate">{id.slice(0, 8)}…</span>
          <Link href={`/customers/${id}`} className={`text-xs font-medium ${color} hover:underline`}>View →</Link>
        </div>
      ) : (
        <p className="text-sm text-slate-400 italic">Not assigned</p>
      )}
    </div>
  )
}

/* ─── Info row ───────────────────────────────────────── */
function InfoRow({ label, value, monospace }: { label: string; value: React.ReactNode; monospace?: boolean }) {
  return (
    <div className="flex gap-3">
      <dt className="w-28 shrink-0 text-slate-400">{label}</dt>
      <dd className={`text-slate-700 ${monospace ? 'font-mono' : ''}`}>
        {value ?? <span className="text-slate-300">—</span>}
      </dd>
    </div>
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
