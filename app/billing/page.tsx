'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Layers } = require('lucide-react') as any
import { TopBar } from '@/components/layout/TopBar'
import { DataTable, Column } from '@/components/ui/DataTable'
import { SlideOver } from '@/components/ui/SlideOver'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  Plus, CheckCircle2, XCircle, AlertTriangle, Clock, FileText,
  TrendingUp, Filter, Search, Download, Send, Eye, RefreshCw,
  Check, X,
} from 'lucide-react'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { CreditCard, DollarSign, Building2, Copy, ExternalLink, MoreVertical, ChevronDown, Zap } = require('lucide-react') as any

// ─── Types ─────────────────────────────────────────────────────────────────────

interface InvoiceLineItem {
  id: string
  service_type: string
  description: string
  qty: number
  unit_price: number
  amount: number
  is_recurring: boolean
  sort_order: number
}

interface Invoice {
  id: string
  invoice_number: string
  org_id: string | null
  client_org_id: string | null
  site_id: string | null
  status: string
  issue_date: string
  due_date: string
  subtotal: number
  tax_amount: number
  total: number
  amount_paid: number
  balance_due: number
  notes: string | null
  stripe_payment_link: string | null
  qb_invoice_id: string | null
  qb_synced_at: string | null
  paid_at: string | null
  sent_at: string | null
  voided_at: string | null
  created_at: string
  site_name: string | null
  client_name: string | null
  // Phase billing fields
  phase_group_id?: string | null
  phase_number?: number | null
  phase_label?: string | null
  phase_total_amount?: number | null
  invoice_line_items?: InvoiceLineItem[]
  commission_payouts?: CommissionPayout[]
}

interface PhaseRow {
  label:    string  // e.g. "Deposit"
  percent:  string  // e.g. "30"
  due_date: string  // ISO date
}

interface CommissionPayout {
  id: string
  org_id: string | null
  invoice_id: string | null
  site_id: string | null
  payout_type: string
  amount: number
  rate_percent: number | null
  status: string
  pay_period: string | null
  approved_at: string | null
  approved_by: string | null
  paid_at: string | null
  notes: string | null
  site_name?: string | null
  invoice_number?: string | null
  org_name?: string | null
}

interface Site {
  id: string
  name: string
  units: number | null
  billing_video_fee?: number | null
  billing_unit_rate?: number | null
  billing_units?: number | null
}

interface NewLineItem {
  service_type: string
  description: string
  qty: string
  unit_price: string
  is_recurring: boolean
}

// ─── Status config ──────────────────────────────────────────────────────────────

const INV_STATUS: Record<string, { label: string; bg: string; text: string; icon: React.ElementType }> = {
  draft:   { label: 'Draft',   bg: 'bg-slate-500/10',   text: 'text-slate-400',   icon: FileText      },
  sent:    { label: 'Sent',    bg: 'bg-blue-500/10',    text: 'text-blue-400',    icon: Send          },
  viewed:  { label: 'Viewed',  bg: 'bg-purple-500/10',  text: 'text-purple-400',  icon: Eye           },
  paid:    { label: 'Paid',    bg: 'bg-emerald-500/10', text: 'text-emerald-400', icon: CheckCircle2  },
  overdue: { label: 'Overdue', bg: 'bg-red-500/10',     text: 'text-red-400',     icon: AlertTriangle },
  void:    { label: 'Void',    bg: 'bg-slate-500/10',   text: 'text-slate-500',   icon: XCircle       },
}

const PAY_STATUS: Record<string, { label: string; bg: string; text: string }> = {
  pending:  { label: 'Pending',  bg: 'bg-amber-500/10',   text: 'text-amber-400'   },
  approved: { label: 'Approved', bg: 'bg-blue-500/10',    text: 'text-blue-400'    },
  paid:     { label: 'Paid',     bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  held:     { label: 'Held',     bg: 'bg-red-500/10',     text: 'text-red-400'     },
}

const SERVICE_TYPES = [
  { value: 'video_monitoring', label: 'Video Monitoring',  defaultDesc: 'Video Monitoring Fee — Monthly',                           defaultQty: '1',  defaultPrice: '500.00' },
  { value: 'access_plan',      label: 'Access Plan',       defaultDesc: 'GateGuard Access Plan — $5.00/unit/mo (gate service, Brivo, PMS integration, 36-month agreement)', defaultQty: '',   defaultPrice: '5.00'   },
  { value: 'one_time',         label: 'One-Time Fee',      defaultDesc: '',                                                           defaultQty: '1',  defaultPrice: ''       },
  { value: 'service_call',     label: 'Service Call',      defaultDesc: 'On-site service call',                                      defaultQty: '1',  defaultPrice: ''       },
  { value: 'labor',            label: 'Labor',             defaultDesc: 'Installation / labor',                                      defaultQty: '1',  defaultPrice: ''       },
  { value: 'equipment',        label: 'Equipment',         defaultDesc: '',                                                           defaultQty: '1',  defaultPrice: ''       },
]

// ─── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined) {
  if (n == null) return '$0.00'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function StatusBadge({ status, map }: { status: string; map: Record<string, { label: string; bg: string; text: string; icon?: React.ElementType }> }) {
  const cfg = map[status] ?? { label: status, bg: 'bg-slate-500/10', text: 'text-slate-400' }
  const Icon = (cfg as { icon?: React.ElementType }).icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${cfg.bg} ${cfg.text}`}>
      {Icon && <Icon size={10} />}
      {cfg.label}
    </span>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const [tab, setTab] = useState<'invoices' | 'payouts'>('invoices')

  // Invoice state
  const [invoices,    setInvoices]    = useState<Invoice[]>([])
  const [invLoading,  setInvLoading]  = useState(true)
  const [invFilter,   setInvFilter]   = useState('all')
  const [invSearch,   setInvSearch]   = useState('')
  const [invSelected, setInvSelected] = useState<Set<string>>(new Set())

  // Payout state
  const [payouts,    setPayouts]    = useState<CommissionPayout[]>([])
  const [payLoading, setPayLoading] = useState(true)
  const [payFilter,  setPayFilter]  = useState('all')
  const [payPeriod,  setPayPeriod]  = useState('')
  const [paySelected, setPaySelected] = useState<Set<string>>(new Set())

  // Slide-overs
  const [newInvOpen,    setNewInvOpen]    = useState(false)
  const [detailInv,     setDetailInv]     = useState<Invoice | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Stats
  const [stats, setStats] = useState({ mrr: 0, pipeline: 0, overdueSum: 0, overdueCount: 0, paidThisMonth: 0 })

  // New invoice form
  const [sites,           setSites]           = useState<Site[]>([])
  const [siteSearch,      setSiteSearch]      = useState('')
  const [selectedSite,    setSelectedSite]    = useState<Site | null>(null)
  const [siteDropdown,    setSiteDropdown]    = useState(false)
  const [newLineItems,    setNewLineItems]    = useState<NewLineItem[]>([])
  const [newDueDate,      setNewDueDate]      = useState('')
  const [newNotes,        setNewNotes]        = useState('')
  const [newInvSaving,    setNewInvSaving]    = useState(false)

  // Phase billing state
  const [phaseEnabled, setPhaseEnabled] = useState(false)
  const [phases, setPhases] = useState<PhaseRow[]>([
    { label: 'Deposit',   percent: '30', due_date: '' },
    { label: 'Milestone', percent: '30', due_date: '' },
    { label: 'Final',     percent: '40', due_date: '' },
  ])

  // Action loading
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})

  // Mark paid form
  const [markPaidOpen,   setMarkPaidOpen]   = useState(false)
  const [markPaidInv,    setMarkPaidInv]    = useState<Invoice | null>(null)
  const [markPaidAmount, setMarkPaidAmount] = useState('')
  const [markPaidNotes,  setMarkPaidNotes]  = useState('')

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Fetch invoices ──────────────────────────────────────────────────────────
  const fetchInvoices = useCallback(async (q?: string) => {
    setInvLoading(true)
    try {
      const params = new URLSearchParams()
      if (invFilter !== 'all') params.set('status', invFilter)
      if (q)                   params.set('q', q)
      const res  = await fetch(`/api/invoices?${params}`)
      const json = await res.json()
      const list: Invoice[] = json.records ?? []
      setInvoices(list)

      // Compute stats
      const now   = new Date()
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

      const mrr = list
        .filter(i => i.status === 'paid' && i.issue_date?.startsWith(month))
        .reduce((s, i) => s + (i.total ?? 0), 0)

      const pipeline = list
        .filter(i => ['draft', 'sent', 'viewed'].includes(i.status))
        .reduce((s, i) => s + (i.total ?? 0), 0)

      const overdue = list.filter(i => i.status === 'overdue')
      const overdueSum   = overdue.reduce((s, i) => s + (i.balance_due ?? 0), 0)
      const overdueCount = overdue.length

      const paidThisMonth = list
        .filter(i => i.status === 'paid' && i.paid_at?.startsWith(month))
        .reduce((s, i) => s + (i.amount_paid ?? 0), 0)

      setStats({ mrr, pipeline, overdueSum, overdueCount, paidThisMonth })
    } finally {
      setInvLoading(false)
    }
  }, [invFilter])

  // ── Fetch payouts ───────────────────────────────────────────────────────────
  const fetchPayouts = useCallback(async () => {
    setPayLoading(true)
    try {
      const params = new URLSearchParams()
      if (payFilter !== 'all') params.set('status', payFilter)
      if (payPeriod)           params.set('pay_period', payPeriod)
      const res  = await fetch(`/api/commission-payouts?${params}`)
      const json = await res.json()
      setPayouts(json.records ?? [])
    } finally {
      setPayLoading(false)
    }
  }, [payFilter, payPeriod])

  // ── Fetch sites for new invoice form ────────────────────────────────────────
  const fetchSites = useCallback(async (q?: string) => {
    const params = new URLSearchParams({ limit: '20' })
    if (q) params.set('q', q)
    const res  = await fetch(`/api/sites?${params}`)
    const json = await res.json()
    setSites(json.sites ?? json.records ?? [])
  }, [])

  useEffect(() => { fetchInvoices() }, [fetchInvoices])
  useEffect(() => { fetchPayouts()  }, [fetchPayouts])

  // Debounced invoice search
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(() => {
      fetchInvoices(invSearch || undefined)
    }, 300)
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current) }
  }, [invSearch, fetchInvoices])

  // ── Actions ─────────────────────────────────────────────────────────────────
  async function sendInvoice(inv: Invoice, e: React.MouseEvent) {
    e.stopPropagation()
    setActionLoading(p => ({ ...p, [`send-${inv.id}`]: true }))
    try {
      const res  = await fetch(`/api/invoices/${inv.id}/send`, { method: 'POST' })
      const json = await res.json()
      if (json.error) { alert(json.error); return }
      await fetchInvoices()
      if (detailInv?.id === inv.id) loadDetail(inv.id)
    } finally {
      setActionLoading(p => ({ ...p, [`send-${inv.id}`]: false }))
    }
  }

  async function qbSync(inv: Invoice, e: React.MouseEvent) {
    e.stopPropagation()
    setActionLoading(p => ({ ...p, [`qb-${inv.id}`]: true }))
    try {
      const res  = await fetch(`/api/invoices/${inv.id}/qb-sync`, { method: 'POST' })
      const json = await res.json()
      if (json.error) { alert(`QB Sync: ${json.error}`); return }
      if (json.skipped) { alert('QuickBooks not configured. Set QBO_ACCESS_TOKEN and QBO_REALM_ID env vars.'); return }
      await fetchInvoices()
      if (detailInv?.id === inv.id) loadDetail(inv.id)
    } finally {
      setActionLoading(p => ({ ...p, [`qb-${inv.id}`]: false }))
    }
  }

  async function voidInvoice(inv: Invoice) {
    if (!confirm(`Void invoice ${inv.invoice_number}? This cannot be undone.`)) return
    await fetch(`/api/invoices/${inv.id}`, { method: 'DELETE' })
    setDetailInv(null)
    await fetchInvoices()
  }

  async function submitMarkPaid() {
    if (!markPaidInv) return
    setActionLoading(p => ({ ...p, [`paid-${markPaidInv.id}`]: true }))
    try {
      const res  = await fetch(`/api/invoices/${markPaidInv.id}/mark-paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount_paid: markPaidAmount ? parseFloat(markPaidAmount) : markPaidInv.total,
          notes:       markPaidNotes || undefined,
        }),
      })
      const json = await res.json()
      if (json.error) { alert(json.error); return }
      setMarkPaidOpen(false)
      setMarkPaidInv(null)
      await fetchInvoices()
      if (detailInv?.id === markPaidInv.id) loadDetail(markPaidInv.id)
    } finally {
      setActionLoading(p => ({ ...p, [`paid-${markPaidInv?.id}`]: false }))
    }
  }

  async function bulkPayoutAction(action: 'approve' | 'hold' | 'mark_paid') {
    const ids = [...paySelected]
    if (ids.length === 0) return
    const res  = await fetch('/api/commission-payouts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, action }),
    })
    const json = await res.json()
    if (json.error) { alert(json.error); return }
    setPaySelected(new Set())
    fetchPayouts()
  }

  async function loadDetail(id: string) {
    setDetailLoading(true)
    try {
      const res  = await fetch(`/api/invoices/${id}`)
      const json = await res.json()
      if (json.invoice) setDetailInv(json.invoice)
    } finally {
      setDetailLoading(false)
    }
  }

  // ── New invoice ─────────────────────────────────────────────────────────────
  function addLineItem() {
    setNewLineItems(p => [...p, { service_type: 'video_monitoring', description: 'Video Monitoring Fee — Monthly', qty: '1', unit_price: '500.00', is_recurring: true }])
  }

  function updateLineItem(idx: number, field: keyof NewLineItem, value: string | boolean) {
    setNewLineItems(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], [field]: value }

      // Auto-fill on service_type change
      if (field === 'service_type') {
        const st = SERVICE_TYPES.find(s => s.value === value)
        if (st) {
          next[idx].description = st.defaultDesc
          next[idx].unit_price  = st.defaultPrice
          // For access_plan, auto-populate qty from selected site units
          if (value === 'access_plan' && selectedSite) {
            const units = selectedSite.billing_units ?? selectedSite.units ?? ''
            next[idx].qty = String(units)
          } else {
            next[idx].qty = st.defaultQty
          }
        }
      }
      return next
    })
  }

  function removeLineItem(idx: number) {
    setNewLineItems(prev => prev.filter((_, i) => i !== idx))
  }

  function newInvTotal() {
    return newLineItems.reduce((s, li) => {
      const qty   = parseFloat(li.qty)   || 0
      const price = parseFloat(li.unit_price) || 0
      return s + qty * price
    }, 0)
  }

  async function saveNewInvoice(andSend = false) {
    if (!newLineItems.length) { alert('Add at least one line item'); return }
    setNewInvSaving(true)
    try {
      if (phaseEnabled) {
        // ── Phase billing path ──────────────────────────────────────────────────
        const totalPct = phases.reduce((s, p) => s + (parseFloat(p.percent) || 0), 0)
        if (Math.round(totalPct) !== 100) {
          alert(`Phase percentages must sum to 100% (currently ${totalPct}%)`); return
        }
        for (const p of phases) {
          if (!p.due_date) { alert(`Phase "${p.label}" is missing a due date`); return }
        }

        const contractTotal = newInvTotal()
        const phase_group_id = crypto.randomUUID()
        const phaseTotal = phases.length
        const createdIds: string[] = []

        for (let i = 0; i < phases.length; i++) {
          const ph       = phases[i]
          const pct      = parseFloat(ph.percent) || 0
          const phaseAmt = parseFloat((contractTotal * pct / 100).toFixed(2))

          const body: Record<string, unknown> = {
            site_id:             selectedSite?.id ?? null,
            notes:               newNotes || null,
            due_date:            ph.due_date,
            phase_group_id,
            phase_number:        i + 1,
            phase_label:         ph.label,
            phase_total_amount:  contractTotal,
            line_items: [{
              service_type: newLineItems[0]?.service_type ?? 'one_time',
              description:  `${ph.label} — Phase ${i + 1} of ${phaseTotal} (${pct}%)`,
              qty:          1,
              unit_price:   phaseAmt,
              is_recurring: false,
              sort_order:   0,
            }],
          }

          const res  = await fetch('/api/invoices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
          const json = await res.json()
          if (json.error) { alert(`Phase ${i + 1} error: ${json.error}`); return }
          createdIds.push(json.invoice?.id)
        }

        if (andSend) {
          // Send all phase invoices
          await Promise.all(createdIds.map(id => fetch(`/api/invoices/${id}/send`, { method: 'POST' })))
        }
      } else {
        // ── Standard single-invoice path ────────────────────────────────────────
        const body: Record<string, unknown> = {
          site_id:    selectedSite?.id ?? null,
          notes:      newNotes || null,
          due_date:   newDueDate || new Date().toISOString().split('T')[0],
          line_items: newLineItems.map((li, idx) => ({
            service_type: li.service_type,
            description:  li.description,
            qty:          parseFloat(li.qty)        || 1,
            unit_price:   parseFloat(li.unit_price) || 0,
            is_recurring: li.is_recurring,
            sort_order:   idx,
          })),
        }

        const res  = await fetch('/api/invoices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        const json = await res.json()
        if (json.error) { alert(json.error); return }

        if (andSend && json.invoice) {
          await fetch(`/api/invoices/${json.invoice.id}/send`, { method: 'POST' })
        }
      }

      setNewInvOpen(false)
      resetNewInvoiceForm()
      await fetchInvoices()
    } finally {
      setNewInvSaving(false)
    }
  }

  function resetNewInvoiceForm() {
    setSelectedSite(null)
    setSiteSearch('')
    setNewLineItems([])
    setNewDueDate('')
    setNewNotes('')
    setPhaseEnabled(false)
    setPhases([
      { label: 'Deposit',   percent: '30', due_date: '' },
      { label: 'Milestone', percent: '30', due_date: '' },
      { label: 'Final',     percent: '40', due_date: '' },
    ])
  }

  // ── Invoice table columns ───────────────────────────────────────────────────
  const invColumns: Column<Invoice>[] = [
    {
      key:    'invoice_number',
      label:  'Invoice #',
      width:  'w-44',
      render: (_, row) => (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-mono text-[#6B7EFF] text-xs">{row.invoice_number}</span>
          {row.phase_label && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400">
              <Layers size={9} />
              {row.phase_label}
            </span>
          )}
        </div>
      ),
    },
    {
      key:    'site_name',
      label:  'Property',
      width:  'min-w-0 flex-1',
      render: (_, row) => (
        <div>
          <p className="font-medium text-foreground text-sm truncate">{row.site_name ?? row.client_name ?? '—'}</p>
        </div>
      ),
    },
    {
      key:    'total',
      label:  'Amount',
      width:  'w-28',
      align:  'right',
      render: (_, row) => <span className="font-semibold text-sm">{fmt(row.total)}</span>,
    },
    {
      key:    'status',
      label:  'Status',
      width:  'w-28',
      render: (_, row) => <StatusBadge status={row.status} map={INV_STATUS} />,
    },
    {
      key:    'due_date',
      label:  'Due',
      width:  'w-28',
      render: (_, row) => <span className="text-xs text-muted-foreground">{fmtDate(row.due_date)}</span>,
    },
    {
      key:    'qb_synced_at',
      label:  'QB Sync',
      width:  'w-24',
      render: (_, row) => row.qb_synced_at
        ? <span className="inline-flex items-center gap-1 text-emerald-400 text-xs"><Check size={11} /> Synced</span>
        : (
          <button
            onClick={e => qbSync(row, e)}
            disabled={actionLoading[`qb-${row.id}`]}
            className="text-[11px] text-amber-400 border border-amber-400/30 rounded px-1.5 py-0.5 hover:bg-amber-400/10 transition-colors disabled:opacity-50"
          >
            {actionLoading[`qb-${row.id}`] ? '…' : 'Sync'}
          </button>
        ),
    },
  ]

  const invActions = (row: Invoice) => (
    <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
      {(row.status === 'draft' || row.status === 'viewed') && (
        <button
          onClick={e => sendInvoice(row, e)}
          disabled={actionLoading[`send-${row.id}`]}
          className="flex items-center gap-1 text-[11px] text-blue-400 border border-blue-400/30 rounded px-2 py-1 hover:bg-blue-400/10 transition-colors disabled:opacity-50"
        >
          <Send size={10} />
          {actionLoading[`send-${row.id}`] ? 'Sending…' : 'Send'}
        </button>
      )}
      {row.status !== 'paid' && row.status !== 'void' && (
        <button
          onClick={e => { e.stopPropagation(); setMarkPaidInv(row); setMarkPaidAmount(String(row.total)); setMarkPaidOpen(true) }}
          className="flex items-center gap-1 text-[11px] text-emerald-400 border border-emerald-400/30 rounded px-2 py-1 hover:bg-emerald-400/10 transition-colors"
        >
          <CheckCircle2 size={10} /> Mark Paid
        </button>
      )}
    </div>
  )

  // ── Payout table columns ────────────────────────────────────────────────────
  const payColumns: Column<CommissionPayout>[] = [
    {
      key: 'org_name', label: 'Dealer / Rep', width: 'min-w-0 flex-1',
      render: (_, row) => (
        <div>
          <p className="font-medium text-sm text-foreground">{row.org_name ?? '—'}</p>
          <p className="text-[11px] text-muted-foreground capitalize">{row.payout_type}</p>
        </div>
      ),
    },
    {
      key: 'site_name', label: 'Property', width: 'w-40',
      render: (_, row) => <span className="text-xs text-muted-foreground">{row.site_name ?? '—'}</span>,
    },
    {
      key: 'invoice_number', label: 'Invoice', width: 'w-32',
      render: (_, row) => <span className="font-mono text-[#6B7EFF] text-xs">{row.invoice_number ?? '—'}</span>,
    },
    {
      key: 'amount', label: 'Amount', width: 'w-24', align: 'right',
      render: (_, row) => <span className="font-semibold text-sm">{fmt(row.amount)}</span>,
    },
    {
      key: 'pay_period', label: 'Period', width: 'w-24',
      render: (_, row) => <span className="text-xs text-muted-foreground">{row.pay_period ?? '—'}</span>,
    },
    {
      key: 'status', label: 'Status', width: 'w-24',
      render: (_, row) => <StatusBadge status={row.status} map={PAY_STATUS} />,
    },
  ]

  // ── Filter tabs ─────────────────────────────────────────────────────────────
  const invTabs = ['all', 'draft', 'sent', 'paid', 'overdue', 'void']
  const payTabs = ['all', 'pending', 'approved', 'paid', 'held']

  // ── Filtered invoices ───────────────────────────────────────────────────────
  // (filter is applied server-side, but we also need to handle display)
  const displayedInvoices = invoices

  // ── AR Aging ────────────────────────────────────────────────────────────────
  const [agingOpen, setAgingOpen] = useState(true)
  const [reminderLoading, setReminderLoading] = useState<Record<string, boolean>>({})

  const arAging = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const active = invoices.filter(i => !['paid', 'void'].includes(i.status))

    function daysPast(dueDate: string | null): number {
      if (!dueDate) return 0
      const d = new Date(dueDate + 'T00:00:00')
      return Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
    }

    const current    = active.filter(i => daysPast(i.due_date) <= 0)
    const bucket30   = active.filter(i => { const d = daysPast(i.due_date); return d >= 1 && d <= 30 })
    const bucket60   = active.filter(i => { const d = daysPast(i.due_date); return d >= 31 && d <= 60 })
    const bucket90   = active.filter(i => daysPast(i.due_date) >= 61)

    const sum = (arr: Invoice[]) => arr.reduce((s, i) => s + (i.balance_due ?? i.total ?? 0), 0)

    const overdue = active.filter(i => daysPast(i.due_date) >= 1)
    const top5Overdue = [...overdue]
      .sort((a, b) => daysPast(b.due_date) - daysPast(a.due_date))
      .slice(0, 5)
      .map(i => ({ ...i, days_overdue: daysPast(i.due_date) }))

    return {
      current:    { invoices: current,  total: sum(current)  },
      bucket30:   { invoices: bucket30, total: sum(bucket30) },
      bucket60:   { invoices: bucket60, total: sum(bucket60) },
      bucket90:   { invoices: bucket90, total: sum(bucket90) },
      totalOverdue: sum(overdue),
      top5Overdue,
    }
  }, [invoices])

  async function sendReminder(inv: Invoice & { days_overdue?: number }) {
    setReminderLoading(p => ({ ...p, [inv.id]: true }))
    try {
      await fetch('/api/billing/send-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_id:     inv.id,
          invoice_number: inv.invoice_number,
          client_name:    inv.client_name ?? inv.site_name,
          amount:         inv.balance_due ?? inv.total,
        }),
      })
    } finally {
      setReminderLoading(p => ({ ...p, [inv.id]: false }))
    }
  }

  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        title="Billing"
        subtitle="Invoices · Commissions · QuickBooks"
        actions={
          <button
            onClick={() => { setNewInvOpen(true); fetchSites() }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#6B7EFF] hover:bg-[#5a6ee0] text-white text-sm font-medium transition-colors shadow-lg shadow-[#6B7EFF]/20"
          >
            <Plus size={15} /> New Invoice
          </button>
        }
      />

      <div className="flex-1 p-6 space-y-5">

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Active MRR',      value: fmt(stats.mrr),           icon: TrendingUp,  color: 'text-[#6B7EFF]',   bg: 'bg-[#6B7EFF]/10'   },
            { label: 'Pipeline',         value: fmt(stats.pipeline),      icon: DollarSign,  color: 'text-blue-400',    bg: 'bg-blue-500/10'    },
            { label: 'Overdue',          value: `${fmt(stats.overdueSum)} (${stats.overdueCount})`, icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10' },
            { label: 'Paid This Month',  value: fmt(stats.paidThisMonth), icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          ].map(s => {
            const Icon = s.icon
            return (
              <div key={s.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                <div className={`p-2.5 rounded-lg ${s.bg}`}>
                  <Icon size={16} className={s.color} />
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── AR Aging Panel ── */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <button
            onClick={() => setAgingOpen(o => !o)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-foreground">AR Aging</span>
              {arAging.totalOverdue > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 text-red-400">
                  {fmt(arAging.totalOverdue)} overdue
                </span>
              )}
            </div>
            <ChevronDown
              size={16}
              className={`text-muted-foreground transition-transform ${agingOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {agingOpen && (
            <div className="border-t border-border">
              {/* Aging buckets */}
              <div className="grid grid-cols-4 gap-0 divide-x divide-border">
                {[
                  { label: 'Current (0–30)',  data: arAging.current,  color: 'text-foreground',   bg: '' },
                  { label: '31–60 Days',      data: arAging.bucket30, color: 'text-amber-400',    bg: 'bg-amber-500/5' },
                  { label: '61–90 Days',      data: arAging.bucket60, color: 'text-orange-400',   bg: 'bg-orange-500/5' },
                  { label: '90+ Days',        data: arAging.bucket90, color: 'text-red-400',      bg: 'bg-red-500/5' },
                ].map(bucket => (
                  <div key={bucket.label} className={`px-5 py-4 ${bucket.bg}`}>
                    <p className="text-xs text-muted-foreground mb-1">{bucket.label}</p>
                    <p className={`text-lg font-bold ${bucket.color}`}>{fmt(bucket.data.total)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {bucket.data.invoices.length} inv{bucket.data.invoices.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                ))}
              </div>

              {/* Top 5 most overdue */}
              {arAging.top5Overdue.length > 0 && (
                <div className="border-t border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Invoice #</th>
                        <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Client</th>
                        <th className="text-right px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Amount</th>
                        <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Due Date</th>
                        <th className="text-right px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Days Overdue</th>
                        <th className="px-5 py-2.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {arAging.top5Overdue.map(inv => (
                        <tr key={inv.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="px-5 py-3">
                            <span className="font-mono text-[#6B7EFF] text-xs">{inv.invoice_number}</span>
                          </td>
                          <td className="px-5 py-3 text-sm text-foreground">{inv.client_name ?? inv.site_name ?? '—'}</td>
                          <td className="px-5 py-3 text-right font-semibold text-sm">{fmt(inv.balance_due ?? inv.total)}</td>
                          <td className="px-5 py-3 text-xs text-muted-foreground">{fmtDate(inv.due_date)}</td>
                          <td className="px-5 py-3 text-right">
                            <span className={`text-xs font-semibold ${(inv as any).days_overdue >= 90 ? 'text-red-400' : (inv as any).days_overdue >= 61 ? 'text-orange-400' : 'text-amber-400'}`}>
                              {(inv as any).days_overdue}d
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <button
                              onClick={() => sendReminder(inv as any)}
                              disabled={reminderLoading[inv.id]}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border border-border hover:bg-muted transition-colors disabled:opacity-50"
                            >
                              <Send size={11} />
                              {reminderLoading[inv.id] ? 'Sending…' : 'Send Reminder'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Tabs ── */}
        <div className="flex items-center gap-0 border-b border-border">
          {(['invoices', 'payouts'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${
                tab === t
                  ? 'border-[#6B7EFF] text-[#6B7EFF]'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t === 'invoices' ? 'Invoices' : 'Commission Payouts'}
            </button>
          ))}
        </div>

        {/* ── Invoices Tab ── */}
        {tab === 'invoices' && (
          <div className="space-y-4">
            {/* Filter bar */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
                {invTabs.map(t => (
                  <button
                    key={t}
                    onClick={() => { setInvFilter(t); }}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${
                      invFilter === t
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="relative flex-1 max-w-xs">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={invSearch}
                  onChange={e => setInvSearch(e.target.value)}
                  placeholder="Search invoice # or property…"
                  className="w-full pl-9 pr-3 h-9 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]"
                />
              </div>
              <button
                onClick={() => fetchInvoices(invSearch || undefined)}
                className="h-9 w-9 flex items-center justify-center border border-border rounded-lg hover:bg-muted transition-colors"
                title="Refresh"
              >
                <RefreshCw size={14} className={`text-muted-foreground ${invLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <DataTable<Invoice>
                columns={invColumns}
                data={displayedInvoices}
                rowKey="id"
                loading={invLoading}
                skeletonRows={6}
                onRowClick={row => { setDetailInv(null); loadDetail(row.id) }}
                selectable
                selectedIds={invSelected}
                onSelectChange={setInvSelected}
                actions={invActions}
                emptyState={
                  <EmptyState
                    icon={<FileText size={24} className="text-muted-foreground" />}
                    title="No invoices yet"
                    description="Create your first invoice to start tracking billing."
                    action={{ label: '+ New Invoice', onClick: () => { setNewInvOpen(true); fetchSites() } }}
                  />
                }
              />
            </div>
          </div>
        )}

        {/* ── Payouts Tab ── */}
        {tab === 'payouts' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
                {payTabs.map(t => (
                  <button
                    key={t}
                    onClick={() => setPayFilter(t)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${
                      payFilter === t
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="relative">
                <input
                  value={payPeriod}
                  onChange={e => setPayPeriod(e.target.value)}
                  placeholder="YYYY-MM"
                  pattern="\d{4}-\d{2}"
                  className="w-32 px-3 h-9 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]"
                />
              </div>
              {paySelected.size > 0 && (
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-xs text-muted-foreground">{paySelected.size} selected</span>
                  <button
                    onClick={() => bulkPayoutAction('approve')}
                    className="px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 text-xs font-medium hover:bg-blue-500/20 transition-colors border border-blue-400/20"
                  >
                    Approve Selected
                  </button>
                  <button
                    onClick={() => bulkPayoutAction('mark_paid')}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-colors border border-emerald-400/20"
                  >
                    Mark Paid Selected
                  </button>
                  <button
                    onClick={() => bulkPayoutAction('hold')}
                    className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors border border-red-400/20"
                  >
                    Hold Selected
                  </button>
                </div>
              )}
            </div>

            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <DataTable<CommissionPayout>
                columns={payColumns}
                data={payouts}
                rowKey="id"
                loading={payLoading}
                skeletonRows={6}
                selectable
                selectedIds={paySelected}
                onSelectChange={setPaySelected}
                emptyState={
                  <EmptyState
                    icon={<DollarSign size={24} className="text-muted-foreground" />}
                    title="No commission payouts"
                    description="Payouts are created automatically when invoices are generated for sites with assigned dealers."
                  />
                }
              />
            </div>
          </div>
        )}

      </div>

      {/* ── New Invoice SlideOver ── */}
      <SlideOver
        open={newInvOpen}
        onClose={() => { setNewInvOpen(false); resetNewInvoiceForm() }}
        title="New Invoice"
        subtitle="Create a new invoice for a property"
        size="lg"
        footer={
          <div className="flex items-center justify-between">
            <button
              onClick={() => { setNewInvOpen(false); resetNewInvoiceForm() }}
              className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => saveNewInvoice(false)}
                disabled={newInvSaving}
                className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
              >
                Save as Draft
              </button>
              <button
                onClick={() => saveNewInvoice(true)}
                disabled={newInvSaving}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-[#6B7EFF] hover:bg-[#5a6ee0] text-white rounded-lg transition-colors disabled:opacity-50"
              >
                <Send size={14} />
                {newInvSaving ? 'Saving…' : 'Save & Send'}
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-5 p-1">
          {/* Property search */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Property</label>
            <div className="relative">
              <div
                onClick={() => { setSiteDropdown(true); fetchSites(siteSearch) }}
                className="w-full h-9 px-3 flex items-center justify-between bg-background border border-border rounded-lg cursor-pointer text-sm"
              >
                <span className={selectedSite ? 'text-foreground' : 'text-muted-foreground'}>
                  {selectedSite ? selectedSite.name : 'Search properties…'}
                </span>
                <ChevronDown size={14} className="text-muted-foreground" />
              </div>
              {siteDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-xl z-50 overflow-hidden">
                  <div className="p-2 border-b border-border">
                    <input
                      autoFocus
                      value={siteSearch}
                      onChange={e => { setSiteSearch(e.target.value); fetchSites(e.target.value) }}
                      placeholder="Type to search…"
                      className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {sites.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No properties found</p>}
                    {sites.map(s => (
                      <button
                        key={s.id}
                        onClick={() => {
                          setSelectedSite(s)
                          setSiteDropdown(false)
                          // Auto-add access plan if units exist
                          if (s.units) {
                            setNewLineItems([
                              { service_type: 'video_monitoring', description: 'Video Monitoring Fee — Monthly', qty: '1', unit_price: '500.00', is_recurring: true },
                              { service_type: 'access_plan', description: `GateGuard Access Plan — ${s.units} units × $5.00/unit/mo (gate service, Brivo, PMS integration, 36-month agreement)`, qty: String(s.units), unit_price: '5.00', is_recurring: true },
                            ])
                          }
                        }}
                        className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent transition-colors"
                      >
                        <p className="font-medium">{s.name}</p>
                        {s.units && <p className="text-xs text-muted-foreground">{s.units} units</p>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Due date + Notes */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Due Date</label>
              <input
                type="date"
                value={newDueDate}
                onChange={e => setNewDueDate(e.target.value)}
                className="w-full h-9 px-3 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Notes</label>
              <input
                value={newNotes}
                onChange={e => setNewNotes(e.target.value)}
                placeholder="Optional notes…"
                className="w-full h-9 px-3 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]"
              />
            </div>
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-muted-foreground">Line Items</label>
              <button
                onClick={addLineItem}
                className="flex items-center gap-1 text-xs text-[#6B7EFF] hover:text-[#5a6ee0] transition-colors"
              >
                <Plus size={12} /> Add Line Item
              </button>
            </div>

            {newLineItems.length === 0 && (
              <div className="border border-dashed border-border rounded-lg py-6 text-center">
                <p className="text-xs text-muted-foreground">No line items yet. Click "Add Line Item" to begin.</p>
              </div>
            )}

            <div className="space-y-2">
              {newLineItems.map((li, idx) => (
                <div key={idx} className="bg-muted/30 border border-border rounded-lg p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <select
                        value={li.service_type}
                        onChange={e => updateLineItem(idx, 'service_type', e.target.value)}
                        className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]"
                      >
                        {SERVICE_TYPES.map(st => (
                          <option key={st.value} value={st.value}>{st.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="w-20">
                      <input
                        type="number"
                        value={li.qty}
                        onChange={e => updateLineItem(idx, 'qty', e.target.value)}
                        placeholder="Qty"
                        className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]"
                      />
                    </div>
                    <div className="w-28">
                      <input
                        type="number"
                        value={li.unit_price}
                        onChange={e => updateLineItem(idx, 'unit_price', e.target.value)}
                        placeholder="Unit price"
                        className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]"
                      />
                    </div>
                    <div className="w-24 h-8 flex items-center justify-end">
                      <span className="text-xs font-semibold text-foreground">
                        {fmt((parseFloat(li.qty) || 0) * (parseFloat(li.unit_price) || 0))}
                      </span>
                    </div>
                    <button onClick={() => removeLineItem(idx)} className="text-muted-foreground hover:text-red-400 transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                  <input
                    value={li.description}
                    onChange={e => updateLineItem(idx, 'description', e.target.value)}
                    placeholder="Description…"
                    className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`recurring-${idx}`}
                      checked={li.is_recurring}
                      onChange={e => updateLineItem(idx, 'is_recurring', e.target.checked)}
                      className="rounded accent-[#6B7EFF]"
                    />
                    <label htmlFor={`recurring-${idx}`} className="text-[11px] text-muted-foreground">Recurring monthly</label>
                  </div>
                </div>
              ))}
            </div>

            {newLineItems.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border flex items-center justify-end gap-4">
                <span className="text-xs text-muted-foreground">Total</span>
                <span className="text-base font-bold text-foreground">{fmt(newInvTotal())}</span>
              </div>
            )}
          </div>

          {/* ── Phase Billing ── */}
          {newLineItems.length > 0 && (
            <div className="border border-border rounded-lg overflow-hidden">
              {/* Toggle header */}
              <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
                <div className="flex items-center gap-2">
                  <Layers size={14} className="text-muted-foreground" />
                  <span className="text-xs font-semibold text-foreground">Phase Billing</span>
                  {!phaseEnabled && (
                    <span className="text-xs text-muted-foreground">Bill in a single invoice</span>
                  )}
                </div>
                {/* Toggle switch */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={phaseEnabled}
                  onClick={() => setPhaseEnabled(v => !v)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#6B7EFF] focus:ring-offset-1 ${
                    phaseEnabled ? 'bg-[#6B7EFF]' : 'bg-muted-foreground/30'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${
                      phaseEnabled ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Phase builder — shown when enabled */}
              {phaseEnabled && (
                <div className="p-4 space-y-3">
                  {/* Summary */}
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{fmt(newInvTotal())}</span> will be split across {phases.length} phase invoice{phases.length !== 1 ? 's' : ''}
                  </p>

                  {/* Phase rows */}
                  <div className="space-y-2">
                    {/* Header row */}
                    <div className="grid grid-cols-[1fr_64px_96px_108px_28px] gap-2 px-1">
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Phase Label</span>
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider text-right">%</span>
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider text-right">Amount</span>
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Due Date</span>
                      <span />
                    </div>

                    {phases.map((ph, i) => {
                      const pct = parseFloat(ph.percent) || 0
                      const amt = newInvTotal() * pct / 100
                      return (
                        <div key={i} className="grid grid-cols-[1fr_64px_96px_108px_28px] gap-2 items-center">
                          {/* Label */}
                          <input
                            value={ph.label}
                            onChange={e => setPhases(prev => prev.map((p, j) => j === i ? { ...p, label: e.target.value } : p))}
                            placeholder="Label"
                            className="h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]"
                          />
                          {/* Percent */}
                          <div className="relative flex items-center">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={ph.percent}
                              onChange={e => setPhases(prev => prev.map((p, j) => j === i ? { ...p, percent: e.target.value } : p))}
                              className="h-8 w-full px-2 pr-4 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-[#6B7EFF] text-right"
                            />
                            <span className="absolute right-1.5 text-[10px] text-muted-foreground pointer-events-none">%</span>
                          </div>
                          {/* Amount (read-only) */}
                          <div className="h-8 px-2 flex items-center justify-end bg-muted/40 border border-border rounded">
                            <span className="text-xs font-semibold text-foreground">{fmt(amt)}</span>
                          </div>
                          {/* Due date */}
                          <input
                            type="date"
                            value={ph.due_date}
                            onChange={e => setPhases(prev => prev.map((p, j) => j === i ? { ...p, due_date: e.target.value } : p))}
                            className="h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]"
                          />
                          {/* Delete */}
                          {phases.length > 1 ? (
                            <button
                              type="button"
                              onClick={() => setPhases(prev => prev.filter((_, j) => j !== i))}
                              className="h-8 w-7 flex items-center justify-center text-muted-foreground hover:text-red-400 transition-colors"
                              title="Remove phase"
                            >
                              <X size={13} />
                            </button>
                          ) : <span />}
                        </div>
                      )
                    })}
                  </div>

                  {/* Percent total indicator */}
                  {(() => {
                    const total = phases.reduce((s, p) => s + (parseFloat(p.percent) || 0), 0)
                    const isOk  = Math.round(total) === 100
                    return (
                      <div className={`flex items-center gap-2 text-xs ${isOk ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {isOk
                          ? <><Check size={12} /> 100% allocated</>
                          : <><AlertTriangle size={12} /> {total}% allocated — all phases must sum to 100%</>
                        }
                      </div>
                    )
                  })()}

                  {/* Add phase button */}
                  <button
                    type="button"
                    onClick={() => setPhases(prev => [...prev, { label: `Phase ${prev.length + 1}`, percent: '0', due_date: '' }])}
                    className="flex items-center gap-1 text-xs text-[#6B7EFF] hover:text-[#5a6ee0] transition-colors"
                  >
                    <Plus size={12} /> Add Phase
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </SlideOver>

      {/* ── Invoice Detail SlideOver ── */}
      <SlideOver
        open={!!detailInv || detailLoading}
        onClose={() => { setDetailInv(null) }}
        title={detailInv ? `Invoice ${detailInv.invoice_number}` : 'Loading…'}
        subtitle={detailInv ? `${fmtDate(detailInv.issue_date)} · ${detailInv.site_name ?? detailInv.client_name ?? ''}` : undefined}
        size="lg"
        footer={
          detailInv && (
            <div className="flex items-center gap-2 flex-wrap">
              {detailInv.status !== 'paid' && detailInv.status !== 'void' && (
                <button
                  onClick={() => { setMarkPaidInv(detailInv); setMarkPaidAmount(String(detailInv.total)); setMarkPaidOpen(true) }}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm bg-emerald-500/10 text-emerald-400 border border-emerald-400/20 rounded-lg hover:bg-emerald-500/20 transition-colors"
                >
                  <CheckCircle2 size={14} /> Mark Paid
                </button>
              )}
              {detailInv.status !== 'void' && (
                <button
                  onClick={() => voidInvoice(detailInv)}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-400 border border-red-400/20 rounded-lg hover:bg-red-500/10 transition-colors"
                >
                  <XCircle size={14} /> Void
                </button>
              )}
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors ml-auto"
              >
                <Download size={14} /> Download PDF
              </button>
            </div>
          )
        }
      >
        {detailLoading && !detailInv && (
          <div className="flex items-center justify-center py-16">
            <RefreshCw size={20} className="animate-spin text-muted-foreground" />
          </div>
        )}
        {detailInv && (
          <div className="space-y-6">
            {/* Status + header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <StatusBadge status={detailInv.status} map={INV_STATUS} />
                  {detailInv.paid_at && <span className="text-xs text-muted-foreground">Paid {fmtDate(detailInv.paid_at)}</span>}
                </div>
                <p className="text-sm text-muted-foreground">Due {fmtDate(detailInv.due_date)}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">{fmt(detailInv.total)}</p>
                {detailInv.balance_due > 0 && detailInv.status !== 'void' && (
                  <p className="text-xs text-red-400">Balance due: {fmt(detailInv.balance_due)}</p>
                )}
              </div>
            </div>

            {/* Property info */}
            {(detailInv.site_name || detailInv.client_name) && (
              <div className="bg-muted/30 rounded-lg p-3">
                <div className="flex items-center gap-2 text-sm">
                  <Building2 size={14} className="text-muted-foreground" />
                  <span className="font-medium">{detailInv.site_name ?? detailInv.client_name}</span>
                </div>
              </div>
            )}

            {/* Line items */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Line Items</p>
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/30 border-b border-border">
                      <th className="text-left px-3 py-2 text-muted-foreground font-medium">Description</th>
                      <th className="text-right px-3 py-2 text-muted-foreground font-medium w-16">Qty</th>
                      <th className="text-right px-3 py-2 text-muted-foreground font-medium w-24">Rate</th>
                      <th className="text-right px-3 py-2 text-muted-foreground font-medium w-24">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detailInv.invoice_line_items ?? []).map(li => (
                      <tr key={li.id} className="border-b border-border/50">
                        <td className="px-3 py-2.5">
                          <p className="text-foreground">{li.description}</p>
                          <p className="text-[10px] text-muted-foreground capitalize">{li.service_type.replace(/_/g, ' ')}</p>
                        </td>
                        <td className="px-3 py-2.5 text-right text-muted-foreground">{li.qty}</td>
                        <td className="px-3 py-2.5 text-right text-muted-foreground">{fmt(li.unit_price)}</td>
                        <td className="px-3 py-2.5 text-right font-semibold">{fmt(li.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals */}
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span><span>{fmt(detailInv.subtotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Tax</span><span>$0.00</span>
              </div>
              <div className="flex justify-between font-bold text-base border-t border-border pt-1.5">
                <span>Total</span><span>{fmt(detailInv.total)}</span>
              </div>
              {detailInv.amount_paid > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>Amount Paid</span><span>−{fmt(detailInv.amount_paid)}</span>
                </div>
              )}
              {detailInv.balance_due > 0 && (
                <div className="flex justify-between font-semibold text-red-400">
                  <span>Balance Due</span><span>{fmt(detailInv.balance_due)}</span>
                </div>
              )}
            </div>

            {/* Payment link */}
            {detailInv.stripe_payment_link && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Stripe Payment Link</p>
                <div className="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-2">
                  <span className="text-xs text-muted-foreground truncate flex-1">{detailInv.stripe_payment_link}</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(detailInv.stripe_payment_link!)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title="Copy link"
                  >
                    <Copy size={13} />
                  </button>
                  <a
                    href={detailInv.stripe_payment_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#6B7EFF] hover:text-[#5a6ee0] transition-colors"
                    title="Open"
                  >
                    <ExternalLink size={13} />
                  </a>
                </div>
              </div>
            )}

            {/* QB Sync */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">QuickBooks</p>
              <div className="flex items-center gap-3">
                {detailInv.qb_synced_at ? (
                  <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                    <Check size={12} /> Synced {new Date(detailInv.qb_synced_at).toLocaleDateString()}
                    {detailInv.qb_invoice_id && <span className="text-muted-foreground">(QB #{detailInv.qb_invoice_id})</span>}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Not synced</span>
                )}
                <button
                  onClick={e => qbSync(detailInv, e)}
                  disabled={actionLoading[`qb-${detailInv.id}`]}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                >
                  {actionLoading[`qb-${detailInv.id}`] ? <RefreshCw size={12} className="animate-spin" /> : <Zap size={12} />}
                  Sync to QB
                </button>
              </div>
            </div>

            {/* Commission payouts on this invoice */}
            {(detailInv.commission_payouts ?? []).length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Commission Payouts</p>
                <div className="space-y-1.5">
                  {(detailInv.commission_payouts ?? []).map(p => (
                    <div key={p.id} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2 text-xs">
                      <span className="capitalize text-muted-foreground">{p.payout_type}</span>
                      {p.rate_percent && <span className="text-muted-foreground">{p.rate_percent}%</span>}
                      <span className="font-semibold">{fmt(p.amount)}</span>
                      <StatusBadge status={p.status} map={PAY_STATUS} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {detailInv.notes && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
                <p className="text-sm text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">{detailInv.notes}</p>
              </div>
            )}
          </div>
        )}
      </SlideOver>

      {/* ── Mark Paid Modal ── */}
      {markPaidOpen && markPaidInv && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMarkPaidOpen(false)} />
          <div className="relative bg-card border border-border rounded-xl w-80 p-5 shadow-2xl space-y-4">
            <h3 className="font-semibold text-sm">Mark Invoice as Paid</h3>
            <p className="text-xs text-muted-foreground">{markPaidInv.invoice_number} · {fmt(markPaidInv.total)}</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Amount Paid</label>
                <input
                  type="number"
                  value={markPaidAmount}
                  onChange={e => setMarkPaidAmount(e.target.value)}
                  className="w-full h-9 px-3 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Notes (optional)</label>
                <input
                  value={markPaidNotes}
                  onChange={e => setMarkPaidNotes(e.target.value)}
                  placeholder="Payment method, reference…"
                  className="w-full h-9 px-3 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => { setMarkPaidOpen(false); setMarkPaidInv(null) }}
                className="flex-1 px-3 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitMarkPaid}
                disabled={actionLoading[`paid-${markPaidInv.id}`]}
                className="flex-1 px-3 py-2 text-sm bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {actionLoading[`paid-${markPaidInv.id}`] ? 'Saving…' : 'Mark Paid'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
