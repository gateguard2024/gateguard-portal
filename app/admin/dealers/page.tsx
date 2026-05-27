'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Users, Plus, Search, Building2, Star, Wrench,
  TrendingUp, ClipboardList, Layers, ChevronRight,
  CheckCircle2, Clock, Shield, Mail, Phone,
} from 'lucide-react'

/* ─── Types ──────────────────────────────────────────────── */
interface PartnerOrg {
  id: string
  name: string
  org_tier: string
  tier_label: string | null
  parent_org_id: string | null
  license_number: string | null
  service_area_states: string[]
  tech_count: number
  onboarded_at: string | null
  created_at: string
  is_active: boolean
  onboarding_complete: boolean | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  partner_docs: PartnerDoc[] | null
}

interface PartnerDoc {
  type: 'w9' | '1099' | 'coi' | 'license' | 'nda' | 'agreement' | 'background_check'
  label: string
  status: 'missing' | 'pending' | 'on_file' | 'expired'
  url?: string
  expires_at?: string
  uploaded_at?: string
  notes?: string
}

/* ─── Tier config ────────────────────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TIER_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string; tabLabel: string }> = {
  master_agent:       { label: 'Master Agent',                    icon: Star,          color: 'text-violet-700',  bg: 'bg-violet-100',  tabLabel: 'Master Agent'      },
  master_dealer:      { label: 'MSO — Master System Operator',    icon: Layers,        color: 'text-brand-400',   bg: 'bg-brand-50',    tabLabel: 'MSO'               },
  full_dealer:        { label: 'System Operator (Full Dealership)',icon: Shield,        color: 'text-indigo-700',  bg: 'bg-indigo-100',  tabLabel: 'System Operator'   },
  service_dealer:     { label: 'Servicing Partner',               icon: Wrench,        color: 'text-emerald-700', bg: 'bg-emerald-100', tabLabel: 'Servicing Partner' },
  install_contractor: { label: 'Installation Partner',            icon: ClipboardList, color: 'text-amber-700',   bg: 'bg-amber-100',   tabLabel: 'Install Partner'   },
  sales_partner:      { label: 'Sales Partner',                   icon: TrendingUp,    color: 'text-sky-700',     bg: 'bg-sky-100',     tabLabel: 'Sales Partner'     },
}

const PARTNER_TIERS = Object.keys(TIER_CONFIG) as Array<keyof typeof TIER_CONFIG>

/* ─── Document dot indicators ────────────────────────────── */
const DOC_TYPES: Array<{ type: PartnerDoc['type']; abbr: string }> = [
  { type: 'w9',               abbr: 'W9'  },
  { type: '1099',             abbr: '1099'},
  { type: 'coi',              abbr: 'COI' },
  { type: 'license',          abbr: 'LIC' },
  { type: 'nda',              abbr: 'NDA' },
  { type: 'agreement',        abbr: 'AGR' },
  { type: 'background_check', abbr: 'BGC' },
]

function ComplianceDots({ docs }: { docs: PartnerDoc[] | null | undefined }) {
  const docMap = new Map<string, PartnerDoc['status']>()
  if (docs) {
    for (const d of docs) docMap.set(d.type, d.status)
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {DOC_TYPES.map(({ type, abbr }) => {
        const status = docMap.get(type)
        const dotColor =
          status === 'on_file'  ? 'bg-emerald-500' :
          status === 'pending'  ? 'bg-amber-400'   :
          status === 'expired'  ? 'bg-rose-500'    :
          status === 'missing'  ? 'bg-rose-300'    :
          'bg-slate-200'
        return (
          <div key={type} className="flex flex-col items-center gap-0.5" title={`${abbr}: ${status ?? 'no data'}`}>
            <div className={`w-2 h-2 rounded-full ${dotColor}`} />
            <span className="text-[8px] text-slate-400 font-medium leading-none">{abbr}</span>
          </div>
        )
      })}
    </div>
  )
}

/* ─── Tier pill ──────────────────────────────────────────── */
function TierPill({ tier }: { tier: string }) {
  const cfg = TIER_CONFIG[tier]
  if (!cfg) return <span className="text-xs text-slate-400">{tier}</span>
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.color}`}>
      <Icon size={11} />
      {cfg.label}
    </span>
  )
}

/* ─── Tab bar ────────────────────────────────────────────── */
type TabKey = 'all' | keyof typeof TIER_CONFIG

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'all',               label: 'All'              },
  { key: 'master_agent',      label: 'Master Agent'     },
  { key: 'master_dealer',     label: 'MSO'              },
  { key: 'full_dealer',       label: 'System Operator'  },
  { key: 'service_dealer',    label: 'Servicing Partner'},
  { key: 'install_contractor',label: 'Install Partner'  },
  { key: 'sales_partner',     label: 'Sales Partner'    },
]

/* ─── Main page ──────────────────────────────────────────── */
export default function PartnerNetworkPage() {
  const router = useRouter()
  const [allOrgs, setAllOrgs]   = useState<PartnerOrg[]>([])
  const [loading, setLoading]   = useState(true)
  const [q, setQ]               = useState('')
  const [activeTab, setActiveTab] = useState<TabKey>('all')

  const fetchOrgs = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/admin/onboard-dealer')
      const json = await res.json()
      // Filter to partner tiers only (exclude corporate + client)
      const partners = (json.orgs ?? []).filter((o: PartnerOrg) =>
        PARTNER_TIERS.includes(o.org_tier as keyof typeof TIER_CONFIG)
      )
      setAllOrgs(partners)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchOrgs() }, [fetchOrgs])

  // Count per tier (across full dataset, not filtered by search)
  const counts: Record<string, number> = { all: allOrgs.length }
  for (const tier of PARTNER_TIERS) {
    counts[tier] = allOrgs.filter(o => o.org_tier === tier).length
  }

  // Apply tab + search filter
  const filtered = allOrgs.filter(o => {
    const tierMatch = activeTab === 'all' || o.org_tier === activeTab
    const searchMatch = !q.trim() || o.name.toLowerCase().includes(q.toLowerCase()) ||
      (o.contact_name ?? '').toLowerCase().includes(q.toLowerCase()) ||
      (o.contact_email ?? '').toLowerCase().includes(q.toLowerCase())
    return tierMatch && searchMatch
  })

  const fmtDate = (iso: string | null) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="p-6 max-w-screen-2xl mx-auto space-y-6">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users size={24} className="text-brand-400" />
            Partner Network
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Master Agents, MSOs, System Operators, and Servicing / Install / Sales Partners
          </p>
        </div>
        <Link
          href="/admin/dealers/new"
          className="flex items-center gap-2 px-4 py-2 bg-brand-400 text-white rounded-lg text-sm font-semibold hover:bg-brand-500 transition-colors shrink-0"
        >
          <Plus size={15} /> Add Partner
        </Link>
      </div>

      {/* ── Search ──────────────────────────────────────────── */}
      <div className="relative max-w-md">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search by name, contact, email…"
          className="w-full pl-9 pr-4 py-2 h-9 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
        />
      </div>

      {/* ── Tabs ────────────────────────────────────────────── */}
      <div className="flex gap-0.5 border-b border-slate-200 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? 'border-brand-400 text-brand-400'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
              activeTab === tab.key
                ? 'bg-brand-100 text-brand-600'
                : 'bg-slate-100 text-slate-500'
            }`}>
              {counts[tab.key] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* ── Table ───────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <div className="animate-spin w-5 h-5 border-2 border-brand-400 border-t-transparent rounded-full mr-3" />
            Loading partners…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Users size={36} className="mb-3 opacity-25" />
            <p className="font-medium text-slate-600">No partners found</p>
            <p className="text-sm mt-1">
              {q ? 'Try a different search term' : 'Use the onboarding wizard to add your first partner'}
            </p>
            {!q && (
              <Link
                href="/admin/dealers/new"
                className="mt-4 flex items-center gap-2 px-4 py-2 bg-brand-400 text-white rounded-lg text-sm font-semibold hover:bg-brand-500"
              >
                <Plus size={14} /> Add Partner
              </Link>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Organization</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Partner Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Contact</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Service Area</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Sites</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Compliance</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Onboarded</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(org => {
                const cfg = TIER_CONFIG[org.org_tier]
                const OrgIcon = cfg?.icon ?? Building2
                return (
                  <tr
                    key={org.id}
                    className="hover:bg-slate-50 group transition-colors cursor-pointer"
                    onClick={() => router.push(`/admin/dealers/${org.id}`)}
                  >
                    {/* Organization */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${cfg?.bg ?? 'bg-slate-100'}`}>
                          <OrgIcon size={14} className={cfg?.color ?? 'text-slate-500'} />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 truncate max-w-[200px]">{org.name}</div>
                          {org.license_number && (
                            <div className="text-[11px] text-slate-400">
                              Lic: {org.license_number}
                            </div>
                          )}
                          {!org.is_active && (
                            <span className="text-[10px] text-rose-500 font-medium">Inactive</span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Partner Type */}
                    <td className="px-4 py-3.5">
                      <TierPill tier={org.org_tier} />
                    </td>

                    {/* Contact */}
                    <td className="px-4 py-3.5">
                      {org.contact_name || org.contact_email ? (
                        <div className="space-y-0.5">
                          {org.contact_name && (
                            <div className="text-sm font-medium text-slate-700">{org.contact_name}</div>
                          )}
                          {org.contact_email && (
                            <div className="flex items-center gap-1 text-xs text-slate-400">
                              <Mail size={10} />
                              <span className="truncate max-w-[160px]">{org.contact_email}</span>
                            </div>
                          )}
                          {org.contact_phone && (
                            <div className="flex items-center gap-1 text-xs text-slate-400">
                              <Phone size={10} />
                              {org.contact_phone}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>

                    {/* Service Area */}
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

                    {/* Sites */}
                    <td className="px-4 py-3.5 text-slate-500 text-sm">
                      <span className="text-slate-300">—</span>
                    </td>

                    {/* Compliance dots */}
                    <td className="px-4 py-3.5">
                      <ComplianceDots docs={org.partner_docs} />
                    </td>

                    {/* Onboarded */}
                    <td className="px-4 py-3.5 text-xs text-slate-500">
                      {org.onboarded_at ? (
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 size={11} className="text-emerald-500 shrink-0" />
                          {fmtDate(org.onboarded_at)}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <Clock size={11} className="shrink-0" />
                          Pending
                        </div>
                      )}
                    </td>

                    {/* Resume / Arrow */}
                    <td className="px-4 py-3.5 text-right">
                      {!org.onboarding_complete ? (
                        <Link
                          href={`/admin/dealers/new?resume=${org.id}`}
                          onClick={e => e.stopPropagation()}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-700 text-[10px] font-semibold hover:bg-amber-200 transition-colors whitespace-nowrap"
                        >
                          Resume →
                        </Link>
                      ) : (
                        <ChevronRight size={17} className="text-slate-300 group-hover:text-brand-400 transition-colors ml-auto" />
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
  )
}
