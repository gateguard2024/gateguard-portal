'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2, Search, Plus, MapPin, Wrench, CheckCircle2,
  AlertTriangle, XCircle, Clock, Filter,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { SlideOver, SlideOverFooter } from '@/components/ui/SlideOver'

/* ─── types ─────────────────────────────────────────── */
interface Site {
  id: string
  name: string
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  property_type: string
  units: number | null
  status: 'active' | 'inactive' | 'prospect' | 'churned'
  pm_name: string | null
  primary_contact_name: string | null
  primary_contact_email: string | null
  asset_count: number
  latest_event: { event_type: string; summary: string; created_at: string } | null
  created_at: string
}

/* ─── status helpers ─────────────────────────────────── */
const STATUS_CONFIG = {
  active:   { label: 'Active',   color: 'bg-emerald-100 text-emerald-700',  dot: 'bg-emerald-500' },
  inactive: { label: 'Inactive', color: 'bg-slate-100 text-slate-600',      dot: 'bg-slate-400'   },
  prospect: { label: 'Prospect', color: 'bg-blue-100 text-blue-700',        dot: 'bg-blue-500'    },
  churned:  { label: 'Churned',  color: 'bg-red-100 text-red-700',          dot: 'bg-red-500'     },
}

/* ─── New Site slide-over ────────────────────────────── */
function NewSiteSlideOver({
  open,
  onClose,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  onSaved: (site: Site) => void
}) {
  const [form, setForm] = useState({
    name: '', address: '', city: '', state: '', zip: '',
    property_type: 'Multifamily', units: '',
    pm_name: '', pm_email: '', pm_phone: '',
    gate_code: '', access_notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (field: string, val: string) => setForm(f => ({ ...f, [field]: val }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Property name is required'); return }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          units: form.units ? parseInt(form.units) : null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to save')
      onSaved({ ...json.site, asset_count: 0, latest_event: null })
      onClose()
      setForm({ name:'',address:'',city:'',state:'',zip:'',property_type:'Multifamily',units:'',pm_name:'',pm_email:'',pm_phone:'',gate_code:'',access_notes:'' })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="New Property"
      size="md"
      footer={
        <SlideOverFooter
          onCancel={onClose}
          onSave={handleSubmit as unknown as () => void}
          saving={saving}
          saveLabel="Add Property"
        />
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
        )}

        {/* Property name */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Property Name *</label>
          <input
            type="text"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="Stonegate Townhomes"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </div>

        {/* Type + Units */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Property Type</label>
            <select
              value={form.property_type}
              onChange={e => set('property_type', e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              <option>Multifamily</option>
              <option>HOA</option>
              <option>Commercial</option>
              <option>Mixed-Use</option>
              <option>Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Units</label>
            <input
              type="number"
              value={form.units}
              onChange={e => set('units', e.target.value)}
              placeholder="186"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
        </div>

        {/* Address */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Street Address</label>
          <input
            type="text"
            value={form.address}
            onChange={e => set('address', e.target.value)}
            placeholder="1400 Stonegate Dr"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </div>

        <div className="grid grid-cols-6 gap-3">
          <div className="col-span-3">
            <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
            <input
              type="text"
              value={form.city}
              onChange={e => set('city', e.target.value)}
              placeholder="Alpharetta"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
          <div className="col-span-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
            <input
              type="text"
              value={form.state}
              onChange={e => set('state', e.target.value)}
              placeholder="GA"
              maxLength={2}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">ZIP</label>
            <input
              type="text"
              value={form.zip}
              onChange={e => set('zip', e.target.value)}
              placeholder="30022"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
        </div>

        {/* PM */}
        <div className="border-t border-slate-100 pt-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Property Manager</p>
          <div className="space-y-3">
            <input
              type="text"
              value={form.pm_name}
              onChange={e => set('pm_name', e.target.value)}
              placeholder="Name"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="email"
                value={form.pm_email}
                onChange={e => set('pm_email', e.target.value)}
                placeholder="Email"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
              <input
                type="tel"
                value={form.pm_phone}
                onChange={e => set('pm_phone', e.target.value)}
                placeholder="Phone"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
          </div>
        </div>

        {/* Access */}
        <div className="border-t border-slate-100 pt-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Site Access</p>
          <div className="space-y-3">
            <input
              type="text"
              value={form.gate_code}
              onChange={e => set('gate_code', e.target.value)}
              placeholder="Gate code (e.g. #4521)"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            <textarea
              value={form.access_notes}
              onChange={e => set('access_notes', e.target.value)}
              placeholder="Access notes for techs (e.g. check in at leasing office)"
              rows={2}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
            />
          </div>
        </div>
      </form>
    </SlideOver>
  )
}

/* ─── Stat card ──────────────────────────────────────── */
function StatCard({
  label, value, icon: Icon, color, active, onClick,
}: {
  label: string; value: number; icon: any; color: string; active: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
        active ? 'border-brand-400 bg-brand-50 shadow-sm' : 'border-slate-200 bg-white hover:border-brand-200 hover:bg-slate-50'
      }`}
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
        <Icon size={18} />
      </div>
      <div>
        <div className="text-2xl font-bold text-slate-900 leading-none">{value}</div>
        <div className="text-xs text-slate-500 mt-0.5">{label}</div>
      </div>
    </button>
  )
}

/* ─── Main page ──────────────────────────────────────── */
export default function SitesPage() {
  const router = useRouter()
  const [sites, setSites]           = useState<Site[]>([])
  const [loading, setLoading]       = useState(true)
  const [q, setQ]                   = useState('')
  const [filterStatus, setFilter]   = useState<string | null>(null)
  const [showNew, setShowNew]       = useState(false)

  const fetchSites = async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (q)            params.set('q', q)
    if (filterStatus) params.set('status', filterStatus)
    const res  = await fetch(`/api/sites?${params}`)
    const json = await res.json()
    setSites(json.sites ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchSites() }, [q, filterStatus])

  const counts = {
    active:   sites.filter(s => s.status === 'active').length,
    inactive: sites.filter(s => s.status === 'inactive').length,
    prospect: sites.filter(s => s.status === 'prospect').length,
    churned:  sites.filter(s => s.status === 'churned').length,
  }

  const handleSaved = (site: Site) => {
    setSites(prev => [site, ...prev])
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const eventIcon = (type: string) => {
    if (type === 'device_offline')       return <AlertTriangle size={12} className="text-amber-500" />
    if (type === 'work_order_completed') return <CheckCircle2 size={12} className="text-emerald-500" />
    if (type === 'install')              return <Wrench size={12} className="text-brand-400" />
    return <Clock size={12} className="text-slate-400" />
  }

  // ─── Table columns ──────────────────────────────────────────────────────────
  const siteColumns: Column<Site>[] = [
    {
      key: 'name',
      label: 'Property',
      sortable: true,
      render: (_, row) => (
        <div>
          <div className="font-semibold text-slate-900">{row.name}</div>
          {row.pm_name && (
            <div className="text-xs text-slate-400 mt-0.5">PM: {row.pm_name}</div>
          )}
        </div>
      ),
    },
    {
      key: 'city',
      label: 'Location',
      render: (_, row) => row.city && row.state ? (
        <div className="flex items-center gap-1 text-slate-600">
          <MapPin size={12} className="text-slate-400 shrink-0" />
          {row.city}, {row.state}
        </div>
      ) : (
        <span className="text-slate-300">—</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (_, row) => {
        const cfg = STATUS_CONFIG[row.status] ?? STATUS_CONFIG.inactive
        return (
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
        )
      },
    },
    {
      key: 'units',
      label: 'Units',
      align: 'right',
      sortable: true,
      render: (_, row) => row.units
        ? <span className="text-slate-600">{row.units.toLocaleString()}</span>
        : <span className="text-slate-300">—</span>,
    },
    {
      key: 'asset_count',
      label: 'Assets',
      align: 'right',
      sortable: true,
      render: (_, row) => (
        <span className={`text-sm font-semibold ${row.asset_count > 0 ? 'text-slate-900' : 'text-slate-300'}`}>
          {row.asset_count > 0 ? row.asset_count : '—'}
        </span>
      ),
    },
    {
      key: 'latest_event',
      label: 'Latest Event',
      render: (_, row) => row.latest_event ? (
        <div className="flex items-start gap-1.5 max-w-[200px]">
          <span className="mt-0.5">{eventIcon(row.latest_event.event_type)}</span>
          <div>
            <p className="text-xs text-slate-600 line-clamp-1">{row.latest_event.summary}</p>
            <p className="text-xs text-slate-400">{formatDate(row.latest_event.created_at)}</p>
          </div>
        </div>
      ) : (
        <span className="text-xs text-slate-300">No events</span>
      ),
    },
    {
      key: 'created_at',
      label: 'Added',
      sortable: true,
      render: (_, row) => (
        <span className="text-xs text-slate-400">{formatDate(row.created_at)}</span>
      ),
    },
  ]

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Building2 size={24} className="text-brand-400" />
            Properties
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">All installed sites — equipment, service history, and dealer attribution</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-400 text-white rounded-lg text-sm font-medium hover:bg-brand-500"
        >
          <Plus size={16} />
          Add Property
        </button>
      </div>

      {/* Stat bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Active"   value={counts.active}   icon={CheckCircle2}  color="bg-emerald-100 text-emerald-600" active={filterStatus === 'active'}   onClick={() => setFilter(f => f === 'active'   ? null : 'active')}   />
        <StatCard label="Prospect" value={counts.prospect} icon={Clock}         color="bg-blue-100 text-blue-600"       active={filterStatus === 'prospect'} onClick={() => setFilter(f => f === 'prospect' ? null : 'prospect')} />
        <StatCard label="Inactive" value={counts.inactive} icon={XCircle}       color="bg-slate-100 text-slate-500"    active={filterStatus === 'inactive'} onClick={() => setFilter(f => f === 'inactive' ? null : 'inactive')} />
        <StatCard label="Churned"  value={counts.churned}  icon={AlertTriangle}  color="bg-red-100 text-red-500"        active={filterStatus === 'churned'}  onClick={() => setFilter(f => f === 'churned'  ? null : 'churned')}  />
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search by name, address, or city…"
          className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
        />
      </div>

      {/* Table */}
      <DataTable<Site>
        columns={siteColumns}
        data={sites}
        rowKey="id"
        loading={loading}
        skeletonRows={5}
        onRowClick={row => router.push('/sites/' + row.id)}
        emptyState={
          <EmptyState
            icon={<Building2 size={32} className="text-muted-foreground" />}
            title="No properties yet"
            description="Add your first installed property to get started"
            action={{ label: 'Add Property', onClick: () => setShowNew(true) }}
          />
        }
      />

      {/* New site panel */}
      <NewSiteSlideOver open={showNew} onClose={() => setShowNew(false)} onSaved={handleSaved} />
    </div>
  )
}
