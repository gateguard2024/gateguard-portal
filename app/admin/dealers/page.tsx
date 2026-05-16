'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Users, Plus, Search, Building2, Star, Wrench,
  TrendingUp, ClipboardList, Layers, ChevronRight,
  MapPin, Mail, Phone, CheckCircle2, Clock, Copy,
} from 'lucide-react'

/* ─── Types ──────────────────────────────────────────────── */
interface DealerOrg {
  id: string
  name: string
  tier: string
  tier_label: string | null
  parent_id: string | null
  license_number: string | null
  service_area_states: string[]
  tech_count: number
  onboarded_at: string | null
  created_at: string
}

/* ─── Tier config ────────────────────────────────────────── */
const TIER_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string; dot: string }> = {
  master_agent:   { label: 'Master Agent',   icon: Star,         color: 'text-violet-700', bg: 'bg-violet-100', dot: 'bg-violet-500'  },
  master_dealer:  { label: 'Master Dealer',  icon: Layers,    color: 'text-brand-400',  bg: 'bg-brand-50',   dot: 'bg-brand-400'   },
  service_dealer: { label: 'Service Dealer', icon: Wrench,       color: 'text-emerald-700',bg: 'bg-emerald-100',dot: 'bg-emerald-500' },
  install_dealer: { label: 'Install Dealer', icon: ClipboardList,color: 'text-amber-700',  bg: 'bg-amber-100',  dot: 'bg-amber-500'   },
  sales:          { label: 'Sales Dealer',   icon: TrendingUp,  color: 'text-sky-700',    bg: 'bg-sky-100',    dot: 'bg-sky-500'     },
}

/* ─── Stat pill ──────────────────────────────────────────── */
function TierPill({ tier, tierLabel }: { tier: string; tierLabel: string | null }) {
  const cfg = TIER_CONFIG[tier]
  if (!cfg) return <span className="text-xs text-slate-400">{tierLabel ?? tier}</span>
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.color}`}>
      <Icon size={11} />
      {tierLabel ?? cfg.label}
    </span>
  )
}

/* ─── Stat card ──────────────────────────────────────────── */
function StatCard({
  label, value, icon: Icon, color, active, onClick,
}: {
  label: string; value: number; icon: any; color: string; active: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
        active ? 'border-brand-400 bg-brand-50 shadow-sm' : 'border-slate-200 bg-white hover:border-brand-200'
      }`}
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
        <Icon size={17} />
      </div>
      <div>
        <div className="text-2xl font-bold text-slate-900 leading-none">{value}</div>
        <div className="text-xs text-slate-500 mt-0.5">{label}</div>
      </div>
    </button>
  )
}

/* ─── Main page ──────────────────────────────────────────── */
export default function DealersPage() {
  const [orgs, setOrgs]           = useState<DealerOrg[]>([])
  const [loading, setLoading]     = useState(true)
  const [q, setQ]                 = useState('')
  const [filterTier, setFilter]   = useState<string | null>(null)
  const [copied, setCopied]       = useState<string | null>(null)

  const fetchOrgs = async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (q)          params.set('q', q)
    if (filterTier) params.set('tier', filterTier)
    const res  = await fetch(`/api/admin/onboard-dealer?${params}`)
    const json = await res.json()
    setOrgs(json.orgs ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchOrgs() }, [q, filterTier])

  const counts = {
    master_agent:   orgs.filter(o => o.tier === 'master_agent').length,
    master_dealer:  orgs.filter(o => o.tier === 'master_dealer').length,
    service_dealer: orgs.filter(o => o.tier === 'service_dealer').length,
    install_dealer: orgs.filter(o => o.tier === 'install_dealer').length,
    sales:          orgs.filter(o => o.tier === 'sales').length,
  }

  const formatDate = (iso: string | null) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const copyId = (id: string) => {
    navigator.clipboard.writeText(id)
    setCopied(id)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users size={24} className="text-brand-400" />
            Dealer Network
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            All orgs in the GateGuard hierarchy — {orgs.length} total
          </p>
        </div>
        <Link
          href="/admin/dealers/new"
          className="flex items-center gap-2 px-4 py-2 bg-brand-400 text-white rounded-lg text-sm font-medium hover:bg-brand-500"
        >
          <Plus size={16} /> Add Dealer
        </Link>
      </div>

      {/* Tier filter bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <StatCard label="Master Agents"   value={counts.master_agent}   icon={Star}         color="bg-violet-100 text-violet-600" active={filterTier === 'master_agent'}   onClick={() => setFilter(f => f === 'master_agent'   ? null : 'master_agent')}   />
        <StatCard label="Master Dealers"  value={counts.master_dealer}  icon={Layers}    color="bg-brand-50 text-brand-400"    active={filterTier === 'master_dealer'}  onClick={() => setFilter(f => f === 'master_dealer'  ? null : 'master_dealer')}  />
        <StatCard label="Service Dealers" value={counts.service_dealer} icon={Wrench}       color="bg-emerald-100 text-emerald-600" active={filterTier === 'service_dealer'} onClick={() => setFilter(f => f === 'service_dealer' ? null : 'service_dealer')} />
        <StatCard label="Install Dealers" value={counts.install_dealer} icon={ClipboardList}color="bg-amber-100 text-amber-600"   active={filterTier === 'install_dealer'} onClick={() => setFilter(f => f === 'install_dealer' ? null : 'install_dealer')} />
        <StatCard label="Sales Dealers"   value={counts.sales}          icon={TrendingUp}  color="bg-sky-100 text-sky-600"        active={filterTier === 'sales'}          onClick={() => setFilter(f => f === 'sales'          ? null : 'sales')}          />
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search by company name…"
          className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <div className="animate-spin w-6 h-6 border-2 border-brand-400 border-t-transparent rounded-full mr-3" />
            Loading dealers…
          </div>
        ) : orgs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Users size={40} className="mb-3 opacity-30" />
            <p className="font-medium">No dealers yet</p>
            <p className="text-sm mt-1">Use the onboarding wizard to add your first dealer</p>
            <Link
              href="/admin/dealers/new"
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-brand-400 text-white rounded-lg text-sm font-medium hover:bg-brand-500"
            >
              <Plus size={15} /> Add Dealer
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600">Organization</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600">Tier</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600">Service Area</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600">Techs</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600">Org ID</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600">Onboarded</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orgs.map(org => (
                <tr key={org.id} className="hover:bg-slate-50 group transition-colors">
                  {/* Name */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${TIER_CONFIG[org.tier]?.bg ?? 'bg-slate-100'}`}>
                        {(() => {
                          const Icon = TIER_CONFIG[org.tier]?.icon ?? Building2
                          return <Icon size={14} className={TIER_CONFIG[org.tier]?.color ?? 'text-slate-500'} />
                        })()}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">{org.name}</div>
                        {org.license_number && (
                          <div className="text-xs text-slate-400">License: {org.license_number}</div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Tier */}
                  <td className="px-4 py-3.5">
                    <TierPill tier={org.tier} tierLabel={org.tier_label} />
                  </td>

                  {/* Service area */}
                  <td className="px-4 py-3.5">
                    {org.service_area_states?.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {org.service_area_states.slice(0, 4).map(s => (
                          <span key={s} className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-semibold">{s}</span>
                        ))}
                        {org.service_area_states.length > 4 && (
                          <span className="text-xs text-slate-400">+{org.service_area_states.length - 4}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </td>

                  {/* Tech count */}
                  <td className="px-4 py-3.5 text-slate-600">
                    {org.tech_count > 0 ? (
                      <span className="font-semibold">{org.tech_count}</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>

                  {/* Org ID (copy button) */}
                  <td className="px-4 py-3.5">
                    <button
                      onClick={() => copyId(org.id)}
                      className="flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-brand-400 transition-colors"
                      title="Copy org ID"
                    >
                      {org.id.slice(0, 8)}…
                      <Copy size={11} className={copied === org.id ? 'text-emerald-500' : ''} />
                    </button>
                    {copied === org.id && (
                      <span className="text-xs text-emerald-500 ml-0.5">Copied!</span>
                    )}
                  </td>

                  {/* Onboarded */}
                  <td className="px-4 py-3.5 text-slate-500 text-xs">
                    {org.onboarded_at ? (
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 size={12} className="text-emerald-500" />
                        {formatDate(org.onboarded_at)}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Clock size={12} />
                        Pending
                      </div>
                    )}
                  </td>

                  {/* Arrow */}
                  <td className="px-4 py-3.5 text-right">
                    <ChevronRight size={18} className="text-slate-300 group-hover:text-brand-400 transition-colors ml-auto" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Quick onboard CTA if empty */}
      {!loading && orgs.length === 0 && (
        <div className="mt-6 bg-brand-50 border border-brand-200 rounded-xl p-5 flex items-start gap-4">
          <div className="w-10 h-10 bg-brand-400 rounded-lg flex items-center justify-center shrink-0">
            <Users size={20} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-brand-900">Ready to onboard your first dealer?</p>
            <p className="text-sm text-brand-700 mt-1">
              The onboarding wizard creates the org, sends the invite, and wires their portal access — all in one flow.
            </p>
          </div>
          <Link
            href="/admin/dealers/new"
            className="shrink-0 px-4 py-2 bg-brand-400 text-white rounded-lg text-sm font-medium hover:bg-brand-500"
          >
            Start Wizard →
          </Link>
        </div>
      )}
    </div>
  )
}
