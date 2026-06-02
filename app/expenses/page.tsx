'use client'

import { useState, useEffect, useCallback } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import {
  Plus, Search, Filter, Download, RefreshCw,
  TrendingUp, AlertTriangle, CheckCircle2, X, Loader2,
} from 'lucide-react'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { DollarSign, Receipt, Tag, Building2, ChevronDown } = require('lucide-react') as any

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Expense {
  id: string
  description: string
  amount: number
  category: string
  vendor: string | null
  expense_date: string
  status: 'pending' | 'approved' | 'rejected'
  submitted_by: string | null
  notes: string | null
  created_at: string
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Equipment', 'Software', 'Travel', 'Meals', 'Office Supplies',
  'Marketing', 'Subcontractor', 'Utilities', 'Other',
]

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  dot: 'bg-amber-500',   text: 'text-amber-700',   bg: 'bg-amber-50'  },
  approved: { label: 'Approved', dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' },
  rejected: { label: 'Rejected', dot: 'bg-red-500',     text: 'text-red-700',     bg: 'bg-red-50'    },
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const [expenses,     setExpenses]     = useState<Expense[]>([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterCat,    setFilterCat]    = useState<string>('all')
  const [showCreate,   setShowCreate]   = useState(false)
  const [apiMissing,   setApiMissing]   = useState(false)

  // Create modal state
  const [cDesc,    setCDesc]    = useState('')
  const [cAmount,  setCAmount]  = useState('')
  const [cCat,     setCCat]     = useState('Equipment')
  const [cVendor,  setCVendor]  = useState('')
  const [cDate,    setCDate]    = useState(new Date().toISOString().split('T')[0])
  const [cNotes,   setCNotes]   = useState('')
  const [cSaving,  setCSaving]  = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/expenses')
      if (res.status === 404) { setApiMissing(true); setLoading(false); return }
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setExpenses(data.expenses ?? [])
    } catch {
      setApiMissing(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function submitCreate() {
    if (!cDesc.trim() || !cAmount) return
    setCSaving(true)
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: cDesc, amount: parseFloat(cAmount),
          category: cCat, vendor: cVendor || null,
          expense_date: cDate, notes: cNotes || null,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setExpenses(prev => [data, ...prev])
        setShowCreate(false)
        setCDesc(''); setCAmount(''); setCVendor(''); setCNotes('')
      }
    } catch { /* api not yet wired */ }
    setCSaving(false)
  }

  // ── Derived ──────────────────────────────────────────────────────────────────
  const visible = expenses.filter(e => {
    if (filterStatus !== 'all' && e.status !== filterStatus) return false
    if (filterCat    !== 'all' && e.category !== filterCat)  return false
    if (search && !e.description.toLowerCase().includes(search.toLowerCase()) &&
        !(e.vendor ?? '').toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const totalSpend    = expenses.reduce((s, e) => s + (e.status !== 'rejected' ? e.amount : 0), 0)
  const pendingCount  = expenses.filter(e => e.status === 'pending').length
  const approvedTotal = expenses.filter(e => e.status === 'approved').reduce((s, e) => s + e.amount, 0)

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC]">
      <TopBar
        title="Expenses"
        subtitle="Track and manage business expenses"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setCDesc(''); setCAmount(''); setCVendor(''); setCNotes(''); setShowCreate(true) }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#6B7EFF] hover:bg-[#5a6ee8] text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
            >
              <Plus size={13} /> Log Expense
            </button>
            <button onClick={load} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 bg-white rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors">
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
        }
      />

      <div className="flex-1 p-6 space-y-5">

        {/* ── KPI cards ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: DollarSign, label: 'Total Spend',      value: fmt(totalSpend),    color: '#6B7EFF', bg: '#6B7EFF18' },
            { icon: AlertTriangle, label: 'Pending Review', value: String(pendingCount), color: '#F59E0B', bg: '#F59E0B18' },
            { icon: CheckCircle2, label: 'Approved',        value: fmt(approvedTotal), color: '#10B981', bg: '#10B98118' },
          ].map(card => (
            <div key={card.label} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4 shadow-sm">
              <div className="p-2.5 rounded-xl shrink-0" style={{ backgroundColor: card.bg }}>
                <card.icon size={16} style={{ color: card.color }} />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{card.value}</p>
                <p className="text-[11px] text-slate-500 font-medium">{card.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Filters ───────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search expenses…"
              className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-[#6B7EFF] bg-white"
            />
          </div>

          <div className="relative">
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="appearance-none pl-3 pr-7 py-2 text-xs border border-slate-200 rounded-lg bg-white outline-none focus:border-[#6B7EFF] text-slate-600"
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              value={filterCat}
              onChange={e => setFilterCat(e.target.value)}
              className="appearance-none pl-3 pr-7 py-2 text-xs border border-slate-200 rounded-lg bg-white outline-none focus:border-[#6B7EFF] text-slate-600"
            >
              <option value="all">All categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          <button className="flex items-center gap-1.5 text-xs text-slate-500 border border-slate-200 bg-white rounded-lg px-3 py-2 hover:bg-slate-50 transition-colors">
            <Download size={12} /> Export
          </button>
        </div>

        {/* ── Table ─────────────────────────────────────────────────────────── */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[1fr_120px_120px_100px_100px_80px] gap-0 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
            {['Description', 'Category', 'Vendor', 'Date', 'Amount', 'Status'].map(h => (
              <span key={h} className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{h}</span>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <Loader2 size={18} className="animate-spin mr-2" />
              <span className="text-sm">Loading expenses…</span>
            </div>
          ) : apiMissing || visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#6B7EFF]/10 flex items-center justify-center mb-3">
                <Receipt size={22} className="text-[#6B7EFF]" />
              </div>
              <p className="text-sm font-semibold text-slate-700 mb-1">No expenses yet</p>
              <p className="text-xs text-slate-400 mb-4">
                {apiMissing
                  ? 'Expense tracking database table coming soon — log expenses manually for now.'
                  : 'Click "Log Expense" to record your first expense.'}
              </p>
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#6B7EFF] text-white text-xs font-semibold rounded-lg hover:bg-[#5a6ee8] transition-colors"
              >
                <Plus size={13} /> Log Expense
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {visible.map(e => {
                const s = STATUS_CONFIG[e.status]
                return (
                  <div key={e.id} className="grid grid-cols-[1fr_120px_120px_100px_100px_80px] gap-0 px-4 py-3 hover:bg-slate-50 transition-colors items-center">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{e.description}</p>
                      {e.notes && <p className="text-[11px] text-slate-400 truncate">{e.notes}</p>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Tag size={10} className="text-slate-400 shrink-0" />
                      <span className="text-xs text-slate-600 truncate">{e.category}</span>
                    </div>
                    <span className="text-xs text-slate-500 truncate">{e.vendor ?? '—'}</span>
                    <span className="text-xs text-slate-500">{new Date(e.expense_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}</span>
                    <span className="text-sm font-semibold text-slate-800">{fmt(e.amount)}</span>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${s.bg} ${s.text} w-fit`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                      {s.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Footer */}
          {visible.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/60">
              <span className="text-xs text-slate-400">{visible.length} expense{visible.length !== 1 ? 's' : ''}</span>
              <span className="text-sm font-bold text-slate-800">
                {fmt(visible.reduce((s, e) => s + e.amount, 0))}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Create Modal ───────────────────────────────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900">Log Expense</h3>
              <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-slate-100 rounded text-slate-400"><X size={14} /></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Description *</label>
                <input autoFocus value={cDesc} onChange={e => setCDesc(e.target.value)}
                  placeholder="What was this expense for?"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6B7EFF] placeholder-slate-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Amount *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                    <input type="number" min="0" step="0.01" value={cAmount} onChange={e => setCAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-6 pr-3 border border-slate-200 rounded-lg py-1.5 text-sm outline-none focus:border-[#6B7EFF] placeholder-slate-400" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Date</label>
                  <input type="date" value={cDate} onChange={e => setCDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-[#6B7EFF]" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Category</label>
                  <select value={cCat} onChange={e => setCCat(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-[#6B7EFF] bg-white">
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Vendor</label>
                  <input value={cVendor} onChange={e => setCVendor(e.target.value)}
                    placeholder="Vendor name"
                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-[#6B7EFF] placeholder-slate-400" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Notes</label>
                <textarea value={cNotes} onChange={e => setCNotes(e.target.value)} rows={2}
                  placeholder="Optional details…"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6B7EFF] resize-none placeholder-slate-400" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-200 bg-slate-50">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
              <button
                onClick={() => void submitCreate()}
                disabled={!cDesc.trim() || !cAmount || cSaving}
                className="px-4 py-2 text-sm font-semibold bg-[#6B7EFF] hover:bg-[#5a6ee8] disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-1.5"
              >
                {cSaving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                Save Expense
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
