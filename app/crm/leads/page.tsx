'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Search, Plus, Building2, MapPin, Phone, Mail,
  Hash, Clock, TrendingUp, Filter, ChevronRight,
  Users, Star, AlertCircle, CheckCircle2, XCircle,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'

interface Lead {
  id: string
  name: string
  contact: string
  email: string
  phone: string | null
  propertyType: string
  units: number | null
  location: string
  stage: string
  source: string
  rep: string
  lastActivity: string
  assigned_dealer: string | null
}

const STAGE_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  new:         { label: 'New',         color: 'bg-slate-100 text-slate-600',    dot: 'bg-slate-400'  },
  contacted:   { label: 'Contacted',   color: 'bg-blue-100 text-blue-700',      dot: 'bg-blue-500'   },
  qualifying:  { label: 'Qualifying',  color: 'bg-indigo-100 text-indigo-700',  dot: 'bg-indigo-500' },
  site_walk:   { label: 'Site Walk',   color: 'bg-amber-100 text-amber-700',    dot: 'bg-amber-500'  },
  proposal:    { label: 'Proposal',    color: 'bg-orange-100 text-orange-700',  dot: 'bg-orange-500' },
  negotiation: { label: 'Negotiation', color: 'bg-rose-100 text-rose-700',      dot: 'bg-rose-500'   },
  won:         { label: 'Won',         color: 'bg-emerald-100 text-emerald-700',dot: 'bg-emerald-500'},
  lost:        { label: 'Lost',        color: 'bg-red-100 text-red-600',        dot: 'bg-red-400'    },
}

const STAGES = Object.keys(STAGE_CONFIG)

function StagePill({ stage }: { stage: string }) {
  const cfg = STAGE_CONFIG[stage] ?? STAGE_CONFIG.new
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

export default function LeadsPage() {
  const [leads, setLeads]         = useState<Lead[]>([])
  const [loading, setLoading]     = useState(true)
  const [q, setQ]                 = useState('')
  const [filterStage, setFilter]  = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch('/api/crm/leads')
      .then(r => r.json())
      .then(data => {
        const mapped = (Array.isArray(data) ? data : []).map((d: any) => ({
          id:              d.id,
          name:            d.name || d.property_name || d.contact_name || 'Unnamed Lead',
          contact:         d.contact || d.contact_name || '',
          email:           d.email || '',
          phone:           d.phone || null,
          propertyType:    d.propertyType || 'Multifamily',
          units:           d.units || null,
          location:        d.location || '',
          stage:           d.stage || 'new',
          source:          d.source || 'show',
          rep:             d.rep || 'R. Feldman',
          lastActivity:    d.lastActivity || '—',
          assigned_dealer: d.assigned_dealer || null,
        }))
        setLeads(mapped)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filtered = leads.filter(l => {
    const matchQ = !q || [l.name, l.contact, l.location, l.email].some(
      v => v?.toLowerCase().includes(q.toLowerCase())
    )
    const matchStage = !filterStage || l.stage === filterStage
    return matchQ && matchStage
  })

  const counts = STAGES.reduce((acc, s) => {
    acc[s] = leads.filter(l => l.stage === s).length
    return acc
  }, {} as Record<string, number>)

  const statCards = [
    { label: 'Total Leads',  value: leads.length,                       icon: Users,        color: 'bg-slate-100 text-slate-600'   },
    { label: 'New',          value: counts.new || 0,                    icon: Star,         color: 'bg-blue-100 text-blue-600'     },
    { label: 'In Progress',  value: (counts.contacted || 0) + (counts.qualifying || 0) + (counts.site_walk || 0) + (counts.proposal || 0) + (counts.negotiation || 0),
                                                                         icon: TrendingUp,   color: 'bg-violet-100 text-violet-600' },
    { label: 'Won',          value: counts.won || 0,                    icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-600'},
    { label: 'Lost',         value: counts.lost || 0,                   icon: XCircle,      color: 'bg-red-100 text-red-600'       },
  ]

  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        title="Leads"
        subtitle={`${leads.length} total leads`}
        actions={
          <Link
            href="/crm"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-accent transition-colors text-muted-foreground"
          >
            ← Pipeline
          </Link>
        }
      />

      <div className="flex-1 p-6">
        {/* Stat Cards */}
        <div className="grid grid-cols-5 gap-3 mb-6">
          {statCards.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
                <Icon size={16} />
              </div>
              <div>
                <div className="text-xl font-bold text-foreground">{value}</div>
                <div className="text-[11px] text-muted-foreground">{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Search + Filter */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search by property, contact, or location…"
              className="w-full pl-9 pr-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/30 bg-background"
            />
          </div>
          <button
            onClick={() => setShowFilters(f => !f)}
            className={`flex items-center gap-2 px-3 py-2.5 text-sm border rounded-lg transition-colors ${
              filterStage ? 'border-brand-400 bg-brand-50 text-brand-400' : 'border-border hover:bg-accent text-muted-foreground'
            }`}
          >
            <Filter size={14} />
            {filterStage ? STAGE_CONFIG[filterStage]?.label : 'Filter'}
          </button>
        </div>

        {/* Stage filter pills */}
        {showFilters && (
          <div className="flex flex-wrap gap-2 mb-4 p-3 bg-muted/40 rounded-xl border border-border">
            <button
              onClick={() => { setFilter(null); setShowFilters(false) }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                !filterStage ? 'bg-brand-400 text-white border-brand-400' : 'border-border text-muted-foreground hover:bg-accent'
              }`}
            >
              All ({leads.length})
            </button>
            {STAGES.map(s => {
              const cfg = STAGE_CONFIG[s]
              return (
                <button
                  key={s}
                  onClick={() => { setFilter(f => f === s ? null : s); setShowFilters(false) }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    filterStage === s ? cfg.color + ' border-transparent' : 'border-border text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {cfg.label} {counts[s] > 0 && `(${counts[s]})`}
                </button>
              )
            })}
          </div>
        )}

        {/* Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <div className="animate-spin w-5 h-5 border-2 border-brand-400 border-t-transparent rounded-full mr-3" />
              Loading leads…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <AlertCircle size={36} className="mb-3 opacity-20" />
              <p className="font-medium">{q || filterStage ? 'No leads match your filters' : 'No leads yet'}</p>
              {(q || filterStage) && (
                <button onClick={() => { setQ(''); setFilter(null) }} className="mt-2 text-sm text-brand-400 hover:underline">
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Property / Contact</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Location</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Stage</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Source</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Contact Info</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Activity</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(lead => (
                  <tr key={lead.id} className="hover:bg-muted/30 group transition-colors">
                    {/* Property + Contact */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                          <Building2 size={14} className="text-blue-600" />
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">{lead.name}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            {lead.contact}
                            {lead.units && (
                              <>
                                <span className="text-border">·</span>
                                <Hash size={9} />
                                <span>{lead.units} units</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Location */}
                    <td className="px-4 py-3.5">
                      {lead.location ? (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin size={11} className="shrink-0" />
                          {lead.location}
                        </div>
                      ) : (
                        <span className="text-muted-foreground/40 text-xs">—</span>
                      )}
                    </td>

                    {/* Stage */}
                    <td className="px-4 py-3.5">
                      <StagePill stage={lead.stage} />
                    </td>

                    {/* Source */}
                    <td className="px-4 py-3.5">
                      <span className="text-xs font-medium px-2 py-1 bg-slate-100 text-slate-600 rounded-full capitalize">
                        {lead.source}
                      </span>
                    </td>

                    {/* Contact Info */}
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col gap-0.5">
                        {lead.email && (
                          <a href={`mailto:${lead.email}`} onClick={e => e.stopPropagation()}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-brand-400 transition-colors">
                            <Mail size={10} />
                            {lead.email}
                          </a>
                        )}
                        {lead.phone && (
                          <a href={`tel:${lead.phone}`} onClick={e => e.stopPropagation()}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-brand-400 transition-colors">
                            <Phone size={10} />
                            {lead.phone}
                          </a>
                        )}
                      </div>
                    </td>

                    {/* Last Activity */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock size={10} />
                        {lead.lastActivity}
                      </div>
                    </td>

                    {/* Arrow */}
                    <td className="px-4 py-3.5 text-right">
                      <Link href={`/crm/leads/${lead.id}`} className="inline-flex items-center gap-1 text-xs text-brand-400 opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                        View <ChevronRight size={13} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {!loading && filtered.length > 0 && (
          <p className="text-xs text-muted-foreground mt-3 text-right">
            Showing {filtered.length} of {leads.length} leads
          </p>
        )}
      </div>
    </div>
  )
}
