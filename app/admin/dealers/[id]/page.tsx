'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft, Building2, Users, Wrench, Shield, Star,
  TrendingUp, ClipboardList, Layers, CheckCircle2, Clock,
  Mail, Phone, Globe, MapPin, FileText, Plus, Loader2,
  AlertTriangle, X,
} from 'lucide-react'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { DollarSign, Calendar, Hammer, Edit2, ToggleLeft, ToggleRight, Save } = require('lucide-react') as any

import { DataTable, type Column } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/EmptyState'
import { SlideOver, SlideOverFooter } from '@/components/ui/SlideOver'
import { TopBar } from '@/components/layout/TopBar'

/* ─── Types ──────────────────────────────────────────────── */
interface Org {
  id: string
  name: string
  org_tier: string
  tier_label: string | null
  parent_org_id: string | null
  is_active: boolean
  onboarded_at: string | null
  created_at: string
  license_number: string | null
  service_area_states: string[]
  tech_count: number
  email: string | null
  phone: string | null
  website: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  onboarding_complete: boolean | null
}

interface CommissionConfig {
  org_id: string
  master_agent_rate: number
  master_dealer_rate: number
  sales_partner_rate: number
  service_dealer_rate: number
  notes: string | null
  _default?: boolean
}

interface Stats {
  sites_count: number
  active_wos_count: number
  monthly_revenue: number
  total_commission: number
}

interface Site {
  id: string
  name: string
  unit_count?: number | null
  monthly_mrr?: number | null
  status?: string | null
  last_wo_date?: string | null
  contract_end_date?: string | null
}

interface WorkOrder {
  id: string
  title: string
  status: string
  priority?: string | null
  scheduled_date?: string | null
  tech_name?: string | null
}

interface Commission {
  id: string
  rep_id: string
  pay_period: string
  amount_cents: number
  door_count?: number
  status: 'pending' | 'approved' | 'paid' | 'held'
  notes?: string | null
  sales_reps?: { first_name: string; last_name: string; tier: string } | null
}

/* ─── Tier config ────────────────────────────────────────── */
const TIER_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  master_agent:       { label: 'Master Agent',       icon: Star,          color: 'text-violet-700',  bg: 'bg-violet-100'  },
  master_dealer:      { label: 'MSO',                 icon: Layers,        color: 'text-brand-400',   bg: 'bg-brand-50'    },
  full_dealer:        { label: 'Full Dealership',    icon: Shield,        color: 'text-indigo-700',  bg: 'bg-indigo-100'  },
  service_dealer:     { label: 'Service Dealer',     icon: Wrench,        color: 'text-emerald-700', bg: 'bg-emerald-100' },
  install_contractor: { label: 'Install Contractor', icon: ClipboardList, color: 'text-amber-700',   bg: 'bg-amber-100'   },
  sales_partner:      { label: 'Sales Partner',      icon: TrendingUp,    color: 'text-sky-700',     bg: 'bg-sky-100'     },
}

/* ─── Helpers ────────────────────────────────────────────── */
function TierPill({ tier, tierLabel }: { tier: string; tierLabel?: string | null }) {
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

function WOStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    open:        'bg-slate-100 text-slate-600',
    in_progress: 'bg-blue-100 text-blue-700',
    scheduled:   'bg-amber-100 text-amber-700',
    in_route:    'bg-orange-100 text-orange-700',
    on_site:     'bg-purple-100 text-purple-700',
    completed:   'bg-emerald-100 text-emerald-700',
    cancelled:   'bg-rose-100 text-rose-700',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${map[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

function CommissionStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid:     'bg-emerald-100 text-emerald-700',
    approved: 'bg-blue-100 text-blue-700',
    pending:  'bg-amber-100 text-amber-700',
    held:     'bg-rose-100 text-rose-700',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${map[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  )
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtMoney(cents: number) {
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })
}

function fmtDollars(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0 })
}

/* ─── Onboarding stepper ─────────────────────────────────── */
const ONBOARDING_STEPS = [
  { key: 'agreement',  label: 'Agreement Signed' },
  { key: 'portal',     label: 'Portal Active' },
  { key: 'first_wo',   label: 'First Work Order' },
  { key: 'first_inv',  label: 'First Invoice' },
  { key: 'certified',  label: 'Certified' },
]

function OnboardingStepper({ org }: { org: Org }) {
  // Infer which steps are complete based on available data
  const completedSteps = new Set<string>()
  if (org.onboarded_at) { completedSteps.add('agreement'); completedSteps.add('portal') }
  if (org.onboarding_complete) { completedSteps.add('first_wo'); completedSteps.add('first_inv') }

  return (
    <div className="flex items-center gap-0 overflow-x-auto">
      {ONBOARDING_STEPS.map((step, i) => {
        const done = completedSteps.has(step.key)
        return (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center min-w-[100px]">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                done
                  ? 'bg-emerald-500 border-emerald-500 text-white'
                  : 'bg-white border-slate-200 text-slate-400'
              }`}>
                {done ? <CheckCircle2 size={14} /> : i + 1}
              </div>
              <span className={`text-[9px] mt-1 font-medium text-center leading-tight ${done ? 'text-emerald-600' : 'text-slate-400'}`}>
                {step.label}
              </span>
            </div>
            {i < ONBOARDING_STEPS.length - 1 && (
              <div className={`h-0.5 w-10 shrink-0 -mt-4 mx-0.5 transition-colors ${done ? 'bg-emerald-400' : 'bg-slate-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ─── Main page ──────────────────────────────────────────── */
export default function DealerDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params.id

  const [org, setOrg]                       = useState<Org | null>(null)
  const [commConfig, setCommConfig]          = useState<CommissionConfig | null>(null)
  const [stats, setStats]                    = useState<Stats | null>(null)
  const [sites, setSites]                    = useState<Site[]>([])
  const [wos, setWOs]                        = useState<WorkOrder[]>([])
  const [commissions, setCommissions]        = useState<Commission[]>([])
  const [loading, setLoading]                = useState(true)
  const [tab, setTab]                        = useState<'overview' | 'properties' | 'work_orders' | 'commissions' | 'documents'>('overview')
  const [editOpen, setEditOpen]              = useState(false)
  const [saving, setSaving]                  = useState(false)
  const [savingStatus, setSavingStatus]      = useState(false)

  // Edit form state
  const [editName, setEditName]         = useState('')
  const [editEmail, setEditEmail]       = useState('')
  const [editPhone, setEditPhone]       = useState('')
  const [editWebsite, setEditWebsite]   = useState('')

  // Commission actions
  const [commActionId, setCommActionId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/dealers/${id}`)
      if (!res.ok) { router.push('/admin/dealers'); return }
      const data = await res.json()
      setOrg(data.org)
      setCommConfig(data.commission_config)
      setStats(data.stats)
      setSites(data.sites ?? [])
      setWOs(data.recent_wos ?? [])
      setCommissions(data.commission_payouts ?? [])
      // Seed edit form
      setEditName(data.org.name ?? '')
      setEditEmail(data.org.email ?? '')
      setEditPhone(data.org.phone ?? '')
      setEditWebsite(data.org.website ?? '')
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [id, router])

  useEffect(() => { void load() }, [load])

  const handleSaveEdit = async () => {
    if (!org) return
    setSaving(true)
    try {
      await fetch(`/api/admin/dealers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, email: editEmail, phone: editPhone, website: editWebsite }),
      })
      void load()
      setEditOpen(false)
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  const handleToggleActive = async () => {
    if (!org) return
    setSavingStatus(true)
    try {
      await fetch(`/api/admin/dealers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !org.is_active }),
      })
      void load()
    } catch (e) { console.error(e) }
    finally { setSavingStatus(false) }
  }

  const handleCommissionAction = async (commId: string, status: string) => {
    setCommActionId(commId)
    try {
      await fetch(`/api/reps/commissions/${commId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      void load()
    } catch (e) { console.error(e) }
    finally { setCommActionId(null) }
  }

  /* ─── Table columns ────────────────────────────────────── */
  const sitesColumns: Column<Site>[] = [
    {
      key: 'name',
      label: 'Property',
      render: (_, row) => <span className="font-medium text-foreground">{row.name}</span>,
    },
    {
      key: 'unit_count',
      label: 'Units',
      align: 'right',
      render: (_, row) => <span className="text-muted-foreground">{row.unit_count ?? '—'}</span>,
    },
    {
      key: 'monthly_mrr',
      label: 'Monthly MRR',
      align: 'right',
      render: (_, row) => (
        <span className="font-medium text-foreground">
          {row.monthly_mrr ? fmtDollars(row.monthly_mrr) : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Health',
      render: (_, row) => {
        const s = row.status ?? 'active'
        const map: Record<string, string> = {
          active:   'bg-emerald-100 text-emerald-700',
          inactive: 'bg-slate-100 text-slate-500',
          pending:  'bg-amber-100 text-amber-700',
        }
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${map[s] ?? 'bg-slate-100 text-slate-600'}`}>
            {s}
          </span>
        )
      },
    },
    {
      key: 'last_wo_date',
      label: 'Last WO',
      render: (_, row) => <span className="text-muted-foreground text-xs">{fmtDate(row.last_wo_date ?? null)}</span>,
    },
    {
      key: 'contract_end_date',
      label: 'Contract End',
      render: (_, row) => <span className="text-muted-foreground text-xs">{fmtDate(row.contract_end_date ?? null)}</span>,
    },
  ]

  const woColumns: Column<WorkOrder>[] = [
    {
      key: 'id',
      label: 'WO#',
      render: (_, row) => (
        <Link href={`/maintenance/${row.id}`} className="text-brand-400 font-mono text-xs hover:underline">
          {row.id.slice(0, 8).toUpperCase()}
        </Link>
      ),
    },
    {
      key: 'title',
      label: 'Title',
      render: (_, row) => <span className="font-medium text-foreground">{row.title}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (_, row) => <WOStatusBadge status={row.status} />,
    },
    {
      key: 'priority',
      label: 'Priority',
      render: (_, row) => {
        if (!row.priority) return <span className="text-muted-foreground">—</span>
        const map: Record<string, string> = { high: 'text-rose-600', medium: 'text-amber-600', low: 'text-slate-500' }
        return <span className={`text-xs font-semibold capitalize ${map[row.priority] ?? 'text-slate-500'}`}>{row.priority}</span>
      },
    },
    {
      key: 'scheduled_date',
      label: 'Scheduled',
      render: (_, row) => <span className="text-muted-foreground text-xs">{fmtDate(row.scheduled_date ?? null)}</span>,
    },
    {
      key: 'tech_name',
      label: 'Tech',
      render: (_, row) => <span className="text-muted-foreground">{row.tech_name ?? '—'}</span>,
    },
  ]

  const commColumns: Column<Commission>[] = [
    {
      key: 'pay_period',
      label: 'Period',
      sortable: true,
      render: (_, row) => <span className="font-mono text-xs text-foreground">{row.pay_period}</span>,
    },
    {
      key: 'rep_id',
      label: 'Rep',
      render: (_, row) => (
        <span className="text-foreground">
          {row.sales_reps ? `${row.sales_reps.first_name} ${row.sales_reps.last_name}`.trim() : '—'}
        </span>
      ),
    },
    {
      key: 'amount_cents',
      label: 'Amount',
      sortable: true,
      align: 'right',
      render: (_, row) => <span className="font-semibold text-foreground">{fmtMoney(row.amount_cents)}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (_, row) => <CommissionStatusBadge status={row.status} />,
    },
  ]

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <TopBar title="Dealer Detail" subtitle="Loading…" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin text-brand-400" />
        </div>
      </div>
    )
  }

  if (!org) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <TopBar title="Dealer Not Found" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <AlertTriangle size={40} className="mx-auto text-amber-400 mb-3" />
            <p className="font-semibold text-foreground">Dealer not found</p>
            <Link href="/admin/dealers" className="text-brand-400 text-sm mt-2 inline-block hover:underline">
              ← Back to Dealer Network
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const tierCfg = TIER_CONFIG[org.org_tier]
  const TierIcon = tierCfg?.icon ?? Building2

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <TopBar
        title={org.name}
        subtitle={tierCfg?.label ?? org.org_tier}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-accent transition-colors"
            >
              <Edit2 size={13} /> Edit
            </button>
            <button
              onClick={() => { void handleToggleActive() }}
              disabled={savingStatus}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                org.is_active
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                  : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
              }`}
            >
              {savingStatus ? (
                <Loader2 size={12} className="animate-spin" />
              ) : org.is_active ? (
                <ToggleRight size={13} />
              ) : (
                <ToggleLeft size={13} />
              )}
              {org.is_active ? 'Active' : 'Inactive'}
            </button>
          </div>
        }
      />

      <div className="flex-1 p-6 space-y-6 max-w-screen-xl mx-auto w-full">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/admin/dealers" className="hover:text-foreground flex items-center gap-1">
            <ChevronLeft size={14} /> Dealer Network
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium">{org.name}</span>
        </div>

        {/* Header card */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${tierCfg?.bg ?? 'bg-slate-100'}`}>
              <TierIcon size={24} className={tierCfg?.color ?? 'text-slate-500'} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold text-foreground">{org.name}</h1>
                <TierPill tier={org.org_tier} tierLabel={org.tier_label} />
                <span className={`inline-flex items-center gap-1 text-xs font-medium ${org.is_active ? 'text-emerald-600' : 'text-rose-600'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full inline-block ${org.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  {org.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                {org.email && (
                  <span className="flex items-center gap-1.5">
                    <Mail size={13} /> {org.email}
                  </span>
                )}
                {org.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone size={13} /> {org.phone}
                  </span>
                )}
                {org.website && (
                  <a href={org.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-brand-400 hover:underline">
                    <Globe size={13} /> {org.website.replace(/^https?:\/\//, '')}
                  </a>
                )}
                {(org.city || org.state) && (
                  <span className="flex items-center gap-1.5">
                    <MapPin size={13} /> {[org.city, org.state].filter(Boolean).join(', ')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick stats */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-border">
              <div>
                <div className="text-2xl font-bold text-foreground">{stats.sites_count}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Properties Served</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{stats.active_wos_count}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Active WOs</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{fmtDollars(stats.monthly_revenue)}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Monthly Revenue</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{fmtMoney(stats.total_commission)}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Commission Paid</div>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border overflow-x-auto">
          {(['overview', 'properties', 'work_orders', 'commissions', 'documents'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium capitalize whitespace-nowrap transition-colors border-b-2 -mb-px ${
                tab === t
                  ? 'border-brand-400 text-brand-400'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* ── Overview ─────────────────────────────────────────── */}
        {tab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Info card */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Organization Info</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tier</span>
                  <TierPill tier={org.org_tier} tierLabel={org.tier_label} />
                </div>
                {org.license_number && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">License #</span>
                    <span className="font-mono text-xs text-foreground">{org.license_number}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Technicians</span>
                  <span className="text-foreground font-medium">{org.tech_count}</span>
                </div>
                {org.service_area_states?.length > 0 && (
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-muted-foreground shrink-0">Service Area</span>
                    <div className="flex flex-wrap gap-1 justify-end">
                      {org.service_area_states.map(s => (
                        <span key={s} className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-semibold">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Onboarded</span>
                  <span className="text-foreground">{fmtDate(org.onboarded_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span className="text-foreground">{fmtDate(org.created_at)}</span>
                </div>
              </div>

              {/* Commission config */}
              {commConfig && (
                <div className="pt-4 border-t border-border space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Commission Config</h4>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Sales Partner Rate</span>
                    <span className="font-mono font-semibold text-foreground">${commConfig.sales_partner_rate.toFixed(2)}/unit</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Service Dealer Rate</span>
                    <span className="font-mono font-semibold text-foreground">${commConfig.service_dealer_rate.toFixed(2)}/unit</span>
                  </div>
                  {commConfig.notes && (
                    <p className="text-xs text-muted-foreground italic mt-2">{commConfig.notes}</p>
                  )}
                  {commConfig._default && (
                    <p className="text-xs text-amber-600 mt-1">Using default rates — no custom config set</p>
                  )}
                </div>
              )}
            </div>

            {/* Onboarding stepper */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Onboarding Progress</h3>
              <OnboardingStepper org={org} />

              {/* Recent activity */}
              <div className="pt-4 border-t border-border space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recent Activity</h4>
                {wos.slice(0, 5).length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">No activity yet</p>
                ) : (
                  wos.slice(0, 5).map(wo => (
                    <div key={wo.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-border/50 last:border-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <Wrench size={12} className="text-muted-foreground shrink-0" />
                        <span className="text-sm text-foreground truncate">{wo.title}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <WOStatusBadge status={wo.status} />
                        <span className="text-xs text-muted-foreground">{fmtDate(wo.scheduled_date ?? null)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Properties ─────────────────────────────────────── */}
        {tab === 'properties' && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
              <Building2 size={15} className="text-brand-400" />
              <h2 className="text-sm font-semibold">Properties Served</h2>
              {sites.length > 0 && (
                <span className="ml-auto text-[10px] text-muted-foreground">{sites.length} sites</span>
              )}
            </div>
            <DataTable<Site>
              columns={sitesColumns}
              data={sites}
              rowKey="id"
              loading={loading}
              skeletonRows={4}
              onRowClick={row => router.push(`/sites/${row.id}`)}
              emptyState={
                <EmptyState
                  icon={<Building2 size={32} className="text-muted-foreground" />}
                  title="No properties yet"
                  description="Properties linked to this dealer will appear here"
                />
              }
            />
          </div>
        )}

        {/* ── Work Orders ────────────────────────────────────── */}
        {tab === 'work_orders' && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
              <Wrench size={15} className="text-brand-400" />
              <h2 className="text-sm font-semibold">Work Orders</h2>
              {wos.length > 0 && (
                <span className="ml-auto text-[10px] text-muted-foreground">{wos.length} recent WOs</span>
              )}
            </div>
            <DataTable<WorkOrder>
              columns={woColumns}
              data={wos}
              rowKey="id"
              loading={loading}
              skeletonRows={5}
              onRowClick={row => router.push(`/maintenance/${row.id}`)}
              emptyState={
                <EmptyState
                  icon={<Wrench size={32} className="text-muted-foreground" />}
                  title="No work orders"
                  description="Work orders for this dealer will appear here"
                />
              }
            />
          </div>
        )}

        {/* ── Commission History ──────────────────────────────── */}
        {tab === 'commissions' && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
              <DollarSign size={15} className="text-brand-400" />
              <h2 className="text-sm font-semibold">Commission History</h2>
            </div>
            <DataTable<Commission>
              columns={commColumns}
              data={commissions}
              rowKey="id"
              loading={loading}
              skeletonRows={5}
              actions={row => (
                <div className="flex items-center gap-1.5 justify-end">
                  {row.status === 'pending' && (
                    <>
                      <button
                        onClick={() => { void handleCommissionAction(row.id, 'approved') }}
                        disabled={commActionId === row.id}
                        className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => { void handleCommissionAction(row.id, 'held') }}
                        disabled={commActionId === row.id}
                        className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 text-xs font-semibold border border-amber-200 hover:bg-amber-100 transition-colors disabled:opacity-50"
                      >
                        Hold
                      </button>
                    </>
                  )}
                  {row.status === 'approved' && (
                    <button
                      onClick={() => { void handleCommissionAction(row.id, 'paid') }}
                      disabled={commActionId === row.id}
                      className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200 hover:bg-blue-100 transition-colors disabled:opacity-50"
                    >
                      Mark Paid
                    </button>
                  )}
                  {row.status === 'held' && (
                    <button
                      onClick={() => { void handleCommissionAction(row.id, 'approved') }}
                      disabled={commActionId === row.id}
                      className="px-2.5 py-1 rounded-lg bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 hover:bg-slate-100 transition-colors disabled:opacity-50"
                    >
                      Unhold
                    </button>
                  )}
                </div>
              )}
              emptyState={
                <EmptyState
                  icon={<DollarSign size={32} className="text-muted-foreground" />}
                  title="No commission records"
                  description="Commission payouts for this dealer will appear here"
                />
              }
            />
          </div>
        )}

        {/* ── Documents ──────────────────────────────────────── */}
        {tab === 'documents' && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
              <div className="flex items-center gap-2">
                <FileText size={15} className="text-brand-400" />
                <h2 className="text-sm font-semibold">Documents</h2>
              </div>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-400 text-white text-xs font-semibold hover:bg-brand-500 transition-colors">
                <Plus size={12} /> Upload
              </button>
            </div>
            <EmptyState
              icon={<FileText size={32} className="text-muted-foreground" />}
              title="No documents uploaded"
              description="Upload NDAs, dealer agreements, W9s, insurance certificates, and licenses here"
              action={{ label: 'Upload Document', onClick: () => {} }}
            />
          </div>
        )}
      </div>

      {/* ── Edit SlideOver ─────────────────────────────────── */}
      <SlideOver
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Dealer"
        subtitle={org.name}
        size="md"
        footer={
          <SlideOverFooter
            onCancel={() => setEditOpen(false)}
            onSave={() => { void handleSaveEdit() }}
            saving={saving}
            saveLabel="Save Changes"
          />
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Organization Name</label>
            <input
              value={editName}
              onChange={e => setEditName(e.target.value)}
              className="w-full px-3 py-2 h-9 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-background"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Email</label>
            <input
              type="email"
              value={editEmail}
              onChange={e => setEditEmail(e.target.value)}
              className="w-full px-3 py-2 h-9 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-background"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Phone</label>
            <input
              type="tel"
              value={editPhone}
              onChange={e => setEditPhone(e.target.value)}
              className="w-full px-3 py-2 h-9 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-background"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Website</label>
            <input
              type="url"
              value={editWebsite}
              onChange={e => setEditWebsite(e.target.value)}
              className="w-full px-3 py-2 h-9 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-background"
            />
          </div>
        </div>
      </SlideOver>
    </div>
  )
}
