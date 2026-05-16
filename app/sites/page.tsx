'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Building2, Search, Plus, MapPin, Wrench, CheckCircle2,
  AlertTriangle, XCircle, Clock, ChevronRight, Filter,
} from 'lucide-react'

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

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/40" onClick={onClose} />
      {/* Panel */}
      <div className="w-full max-w-lg bg-white shadow-2xl flex flex-col h-full overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">New Property</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 p-6 space-y-5">
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

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-5 py-2 text-sm bg-brand-400 text-white rounded-lg hover:bg-brand-500 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Add Property'}
          </button>
        </div>
      </div>
    </div>
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
    if (type === 'device_offline')  return <AlertTriangle size={12} className="text-amber-500" />
    if (type === 'work_order_completed') return <CheckCircle2 size={12} className="text-emerald-500" />
    if (type === 'install')         return <Wrench size={12} className="text-brand-400" />
    return <Clock size={12} className="text-slate-400" />
  }

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
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <div className="animate-spin w-6 h-6 border-2 border-brand-400 border-t-transparent rounded-full mr-3" />
            Loading properties…
          </div>
        ) : sites.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Building2 size={40} className="mb-3 opacity-30" />
            <p className="font-medium">No properties yet</p>
            <p className="text-sm mt-1">Add your first installed property to get started</p>
            <button
              onClick={() => setShowNew(true)}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-brand-400 text-white rounded-lg text-sm font-medium hover:bg-brand-500"
            >
              <Plus size={15} /> Add Property
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Property</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Location</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Type</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Assets</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Latest Event</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sites.map(site => {
                const cfg = STATUS_CONFIG[site.status] ?? STATUS_CONFIG.inactive
                return (
                  <tr key={site.id} className="hover:bg-slate-50 transition-colors group">
                    {/* Name */}
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-slate-900">{site.name}</div>
                      {site.pm_name && (
                        <div className="text-xs text-slate-400 mt-0.5">PM: {site.pm_name}</div>
                      )}
                    </td>
                    {/* Location */}
                    <td className="px-4 py-3.5 text-slate-600">
                      {site.city && site.state ? (
                        <div className="flex items-center gap-1">
                          <MapPin size={12} className="text-slate-400 shrink-0" />
                          {site.city}, {site.state}
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    {/* Type */}
                    <td className="px-4 py-3.5 text-slate-600">
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">{site.property_type}</span>
                      {site.units && (
                        <span className="text-xs text-slate-400 ml-1.5">{site.units.toLocaleString()} units</span>
                      )}
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </span>
                    </td>
                    {/* Assets */}
                    <td className="px-4 py-3.5">
                      <span className={`text-sm font-semibold ${site.asset_count > 0 ? 'text-slate-900' : 'text-slate-300'}`}>
                        {site.asset_count > 0 ? site.asset_count : '—'}
                      </span>
                      {site.asset_count > 0 && (
                        <span className="text-xs text-slate-400 ml-1">devices</span>
                      )}
                    </td>
                    {/* Latest event */}
                    <td className="px-4 py-3.5 max-w-[200px]">
                      {site.latest_event ? (
                        <div className="flex items-start gap-1.5">
                          <span className="mt-0.5">{eventIcon(site.latest_event.event_type)}</span>
                          <div>
                            <p className="text-xs text-slate-600 line-clamp-1">{site.latest_event.summary}</p>
                            <p className="text-xs text-slate-400">{formatDate(site.latest_event.created_at)}</p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-300">No events</span>
                      )}
                    </td>
                    {/* Arrow */}
                    <td className="px-4 py-3.5 text-right">
                      <Link href={`/sites/${site.id}`} className="text-slate-300 group-hover:text-brand-400 transition-colors">
                        <ChevronRight size={18} />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* New site panel */}
      <NewSiteSlideOver open={showNew} onClose={() => setShowNew(false)} onSaved={handleSaved} />
    </div>
  )
}
