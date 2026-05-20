'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft, Users, TrendingUp, Clock, Loader2,
  Mail, Phone, AlertTriangle, ChevronRight,
} from 'lucide-react'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { DollarSign, Target } = require('lucide-react') as any

import { DataTable, type Column } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/EmptyState'
import { TopBar } from '@/components/layout/TopBar'

/* ─── Types ──────────────────────────────────────────────── */
interface Rep {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  tier: 'senior_rep' | 'rep' | 'sub_rep'
  parent_rep_id: string | null
  commission_rate: number
  pipeline_value: number
  active_sites: number
  is_active: boolean
}

interface Commission {
  id: string
  rep_id: string
  pay_period: string
  amount_cents: number
  door_count?: number
  status: 'pending' | 'approved' | 'paid' | 'held'
  notes?: string | null
}

interface Lead {
  id: string
  company_name?: string | null
  contact_name?: string | null
  status?: string | null
  pipeline_value?: number | null
  created_at: string
  last_activity_at?: string | null
}

interface Opportunity {
  id: string
  title: string
  stage?: string | null
  value?: number | null
  created_at: string
  updated_at?: string | null
}

/* ─── Helpers ────────────────────────────────────────────── */
const TIER_LABELS: Record<string, string> = {
  senior_rep: 'Senior Rep',
  rep:        'Rep',
  sub_rep:    'Sub-Rep',
}

function TierBadge({ tier }: { tier: string }) {
  const label = TIER_LABELS[tier] ?? tier
  if (tier === 'senior_rep')
    return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-brand-400/10 text-brand-400">{label}</span>
  if (tier === 'rep')
    return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-400/10 text-violet-400">{label}</span>
  return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-400/10 text-emerald-400">{label}</span>
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

function fmtMoney(cents: number) {
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })
}

function fmtPipeline(value: number) {
  if (value >= 1_000_000) return '$' + (value / 1_000_000).toFixed(1) + 'M'
  if (value >= 1_000) return '$' + Math.round(value / 1_000) + 'K'
  return '$' + value
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function daysSince(iso: string | null | undefined): number {
  if (!iso) return 9999
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

/* ─── Main page ──────────────────────────────────────────── */
export default function RepDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params.id

  const [rep, setRep]                 = useState<Rep | null>(null)
  const [allReps, setAllReps]         = useState<Rep[]>([])
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [leads, setLeads]             = useState<Lead[]>([])
  const [opps, setOpps]               = useState<Opportunity[]>([])
  const [loading, setLoading]         = useState(true)
  const [tab, setTab]                 = useState<'overview' | 'pipeline' | 'commissions'>('overview')
  const [commActionId, setCommActionId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [repsRes, commsRes] = await Promise.all([
        fetch('/api/reps'),
        fetch(`/api/reps/commissions?rep_id=${id}`),
      ])
      const [repsData, commsData] = await Promise.all([repsRes.json(), commsRes.json()])
      const repsList: Rep[] = repsData.reps ?? []
      setAllReps(repsList)
      const found = repsList.find(r => r.id === id) ?? null
      setRep(found)
      setCommissions(commsData.commissions ?? [])

      // Try to fetch leads / opps (might not exist — silently fail)
      try {
        const leadsRes = await fetch(`/api/crm/leads?rep_id=${id}`)
        if (leadsRes.ok) {
          const ld = await leadsRes.json()
          setLeads(ld.leads ?? [])
        }
      } catch { /* ignore */ }

      try {
        const oppsRes = await fetch(`/api/crm/opportunities?rep_id=${id}`)
        if (oppsRes.ok) {
          const od = await oppsRes.json()
          setOpps(od.opportunities ?? [])
        }
      } catch { /* ignore */ }

    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { void load() }, [load])

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

  // Computed stats
  const now = new Date()
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const commMTD = commissions
    .filter(c => c.pay_period === currentPeriod && (c.status === 'approved' || c.status === 'paid'))
    .reduce((s, c) => s + c.amount_cents, 0)

  const commYTD = commissions
    .filter(c => {
      const year = c.pay_period.slice(0, 4)
      return year === String(now.getFullYear()) && (c.status === 'approved' || c.status === 'paid')
    })
    .reduce((s, c) => s + c.amount_cents, 0)

  const repById: Record<string, Rep> = {}
  for (const r of allReps) repById[r.id] = r

  const parentRep = rep?.parent_rep_id ? repById[rep.parent_rep_id] : null

  /* ─── Table columns ────────────────────────────────────── */
  const commColumns: Column<Commission>[] = [
    {
      key: 'pay_period',
      label: 'Period',
      sortable: true,
      render: (_, row) => <span className="font-mono text-xs text-foreground">{row.pay_period}</span>,
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
    {
      key: 'notes',
      label: 'Notes',
      render: (_, row) => <span className="text-muted-foreground text-xs">{row.notes ?? '—'}</span>,
    },
  ]

  const pipelineColumns: Column<Lead & Opportunity & { _type: string }>[] = [
    {
      key: 'title',
      label: 'Record',
      render: (_, row) => (
        <div>
          <div className="font-medium text-foreground">
            {(row as any).company_name ?? (row as any).title ?? '—'}
          </div>
          <div className="text-[10px] text-muted-foreground capitalize">{row._type}</div>
        </div>
      ),
    },
    {
      key: 'stage',
      label: 'Stage',
      render: (_, row) => (
        <span className="text-muted-foreground capitalize text-xs">
          {(row as any).stage ?? (row as any).status ?? '—'}
        </span>
      ),
    },
    {
      key: 'value',
      label: 'Value',
      align: 'right',
      render: (_, row) => {
        const v = (row as any).value ?? (row as any).pipeline_value
        return <span className="font-medium text-foreground">{v ? fmtPipeline(Number(v)) : '—'}</span>
      },
    },
    {
      key: 'created_at',
      label: 'Age',
      render: (_, row) => {
        const days = daysSince(row.created_at)
        const color = days > 30 ? 'text-rose-600' : days > 14 ? 'text-amber-600' : 'text-muted-foreground'
        return <span className={`text-xs ${color}`}>{days}d</span>
      },
    },
    {
      key: 'last_activity_at',
      label: 'Last Activity',
      render: (_, row) => (
        <span className="text-muted-foreground text-xs">
          {fmtDate((row as any).last_activity_at ?? (row as any).updated_at)}
        </span>
      ),
    },
  ]

  // Merge leads + opps into pipeline
  const pipeline: (Lead & Opportunity & { _type: string })[] = [
    ...leads.map(l => ({ ...l, title: l.company_name ?? l.contact_name ?? '', stage: l.status, value: l.pipeline_value ?? 0, updated_at: l.last_activity_at, _type: 'lead' })),
    ...opps.map(o => ({ ...o, company_name: o.title, contact_name: null, status: o.stage, pipeline_value: o.value ?? 0, last_activity_at: o.updated_at, _type: 'opportunity' })),
  ] as any

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <TopBar title="Rep Detail" subtitle="Loading…" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin text-brand-400" />
        </div>
      </div>
    )
  }

  if (!rep) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <TopBar title="Rep Not Found" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <AlertTriangle size={40} className="mx-auto text-amber-400 mb-3" />
            <p className="font-semibold text-foreground">Rep not found</p>
            <Link href="/reps" className="text-brand-400 text-sm mt-2 inline-block hover:underline">
              ← Back to Reps &amp; Commissions
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const repName = `${rep.first_name} ${rep.last_name}`.trim()

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <TopBar
        title={repName}
        subtitle={TIER_LABELS[rep.tier] ?? rep.tier}
      />

      <div className="flex-1 p-6 space-y-6 max-w-screen-xl mx-auto w-full">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/reps" className="hover:text-foreground flex items-center gap-1">
            <ChevronLeft size={14} /> Reps &amp; Commissions
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium">{repName}</span>
        </div>

        {/* Header card */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-brand-400/10 flex items-center justify-center shrink-0">
              <span className="text-xl font-bold text-brand-400">
                {rep.first_name[0]}{rep.last_name[0]}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold text-foreground">{repName}</h1>
                <TierBadge tier={rep.tier} />
                <span className={`inline-flex items-center gap-1 text-xs font-medium ${rep.is_active ? 'text-emerald-600' : 'text-rose-600'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full inline-block ${rep.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  {rep.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                {rep.email && (
                  <span className="flex items-center gap-1.5">
                    <Mail size={13} /> {rep.email}
                  </span>
                )}
                {rep.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone size={13} /> {rep.phone}
                  </span>
                )}
                {parentRep && (
                  <button
                    onClick={() => router.push(`/reps/${parentRep.id}`)}
                    className="flex items-center gap-1.5 text-brand-400 hover:underline"
                  >
                    <ChevronRight size={13} /> Reports to: {parentRep.first_name} {parentRep.last_name}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-border">
            <div>
              <div className="text-2xl font-bold text-foreground">{fmtPipeline(rep.pipeline_value)}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Pipeline Value</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{rep.active_sites}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Active Sites</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{fmtMoney(commMTD)}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Commission MTD</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{fmtMoney(commYTD)}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Commission YTD</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border overflow-x-auto">
          {(['overview', 'pipeline', 'commissions'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium capitalize whitespace-nowrap transition-colors border-b-2 -mb-px ${
                tab === t
                  ? 'border-brand-400 text-brand-400'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* ── Overview ─────────────────────────────────────────── */}
        {tab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Performance cards */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Pipeline Snapshot</h3>
              <div className="grid grid-cols-3 gap-3">
                {(['30', '60', '90'] as const).map(days => {
                  const cutoff = new Date(Date.now() - parseInt(days) * 86400000).toISOString()
                  const val = pipeline
                    .filter((p: any) => p.created_at >= cutoff)
                    .reduce((s: number, p: any) => s + (Number(p.value) || Number(p.pipeline_value) || 0), 0)
                  return (
                    <div key={days} className="bg-background rounded-lg border border-border p-3 text-center">
                      <div className="text-lg font-bold text-foreground">{fmtPipeline(val)}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{days}d</div>
                    </div>
                  )
                })}
              </div>

              {/* Commission breakdown */}
              <div className="pt-4 border-t border-border space-y-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Commission Breakdown</h4>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Rate</span>
                  <span className="font-mono font-semibold text-foreground">${rep.commission_rate.toFixed(2)}/unit</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Paid MTD</span>
                  <span className="font-semibold text-foreground">{fmtMoney(commMTD)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Paid YTD</span>
                  <span className="font-semibold text-foreground">{fmtMoney(commYTD)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Pending</span>
                  <span className="font-semibold text-amber-600">
                    {fmtMoney(commissions.filter(c => c.status === 'pending').reduce((s, c) => s + c.amount_cents, 0))}
                  </span>
                </div>
              </div>
            </div>

            {/* Sub-reps if any */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Direct Reports</h3>
              {allReps.filter(r => r.parent_rep_id === id).length === 0 ? (
                <div className="text-sm text-muted-foreground py-4 text-center">No direct reports</div>
              ) : (
                allReps.filter(r => r.parent_rep_id === id).map(sub => (
                  <button
                    key={sub.id}
                    onClick={() => router.push(`/reps/${sub.id}`)}
                    className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-brand-400/10 flex items-center justify-center text-[10px] font-bold text-brand-400">
                        {sub.first_name[0]}{sub.last_name[0]}
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-medium text-foreground">{sub.first_name} {sub.last_name}</div>
                        <div className="text-[10px] text-muted-foreground">{TIER_LABELS[sub.tier] ?? sub.tier}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-foreground">{fmtPipeline(sub.pipeline_value)}</div>
                      <div className="text-[10px] text-muted-foreground">pipeline</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── Pipeline ─────────────────────────────────────────── */}
        {tab === 'pipeline' && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
              <Target size={15} className="text-brand-400" />
              <h2 className="text-sm font-semibold">Pipeline</h2>
              {pipeline.length > 0 && (
                <span className="ml-auto text-[10px] text-muted-foreground">{pipeline.length} records</span>
              )}
            </div>
            <DataTable
              columns={pipelineColumns as any}
              data={pipeline}
              rowKey="id"
              loading={loading}
              skeletonRows={4}
              emptyState={
                <EmptyState
                  icon={<TrendingUp size={32} className="text-muted-foreground" />}
                  title="No pipeline records"
                  description="Leads and opportunities assigned to this rep will appear here"
                />
              }
            />
          </div>
        )}

        {/* ── Commission History ────────────────────────────────── */}
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
                  description="Commission payouts for this rep will appear here"
                />
              }
            />
          </div>
        )}
      </div>
    </div>
  )
}
