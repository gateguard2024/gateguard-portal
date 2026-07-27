'use client'

import { useEffect, useState } from 'react'

type InvoiceBucket = 'past_due' | 'due_soon' | 'open' | 'recently_paid'

type InvoiceCard = {
  id: string
  invoice_number: string
  title: string
  status: string
  amount: number
  due_date: string | null
  paid_at: string | null
  customer_name: string | null
  notes: string | null
  bucket: InvoiceBucket
  urgency: 'high' | 'medium' | 'low'
}

function formatMoney(value: number): string {
  return `$${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

function bucketLabel(bucket: InvoiceBucket): string {
  if (bucket === 'past_due') return 'Past Due'
  if (bucket === 'due_soon') return 'Due Soon'
  if (bucket === 'recently_paid') return 'Recently Paid'
  return 'Open / Unpaid'
}

function bucketColor(bucket: InvoiceBucket): string {
  if (bucket === 'past_due') return '#F87171'
  if (bucket === 'due_soon') return '#FBBF24'
  if (bucket === 'recently_paid') return '#34D399'
  return '#00C8FF'
}

export function MoneyDocsInvoicesBoard() {
  const [invoices, setInvoices] = useState<InvoiceCard[]>([])
  const [selectedBucket, setSelectedBucket] = useState<InvoiceBucket>('past_due')
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)

  async function loadInvoices() {
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch('/api/nexus/money-docs/invoices')
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.success === false) throw new Error(data?.message ?? 'Could not load invoices.')
      const nextInvoices = Array.isArray(data.invoices) ? data.invoices as InvoiceCard[] : []
      setInvoices(nextInvoices)
      if (nextInvoices.length === 0) setMessage('No invoices found yet. Once invoices are loaded, they will show here.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load invoices.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadInvoices()
  }, [])

  const buckets: InvoiceBucket[] = ['past_due', 'due_soon', 'open', 'recently_paid']
  const shownInvoices = invoices.filter(invoice => invoice.bucket === selectedBucket)
  const selectedInvoice = invoices.find(invoice => invoice.id === selectedInvoiceId) ?? null

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {buckets.map(bucket => {
          const color = bucketColor(bucket)
          const count = invoices.filter(invoice => invoice.bucket === bucket).length
          const active = selectedBucket === bucket
          return (
            <button
              key={bucket}
              type="button"
              onClick={() => { setSelectedBucket(bucket); setSelectedInvoiceId(null) }}
              className="rounded-2xl px-3 py-3 text-left transition-all hover:-translate-y-0.5"
              style={{ background: active ? `${color}1f` : 'rgba(0,0,0,0.18)', border: active ? `1px solid ${color}66` : '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="text-[10px] uppercase tracking-[0.14em]" style={{ color }}>{bucketLabel(bucket)}</div>
              <div className="mt-1 text-lg font-semibold" style={{ color: 'rgba(255,255,255,0.94)' }}>{count}</div>
            </button>
          )
        })}
      </div>

      {loading && <div className="rounded-2xl p-4 text-xs" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.48)' }}>Loading invoices…</div>}
      {message && <div className="rounded-2xl p-4 text-xs" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.48)' }}>{message}</div>}

      {!loading && shownInvoices.length === 0 && !message && (
        <div className="rounded-2xl p-4 text-xs" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.48)' }}>
          No {bucketLabel(selectedBucket).toLowerCase()} invoices right now.
        </div>
      )}

      {shownInvoices.length > 0 && (
        <div className="space-y-2">
          {shownInvoices.map(invoice => {
            const selected = selectedInvoiceId === invoice.id
            const color = bucketColor(invoice.bucket)
            return (
              <button
                key={invoice.id}
                type="button"
                onClick={() => setSelectedInvoiceId(invoice.id)}
                className="w-full rounded-2xl px-3 py-3 text-left transition-all hover:-translate-y-0.5"
                style={{ background: selected ? `${color}1f` : 'rgba(0,0,0,0.18)', border: selected ? `1px solid ${color}66` : '1px solid rgba(255,255,255,0.06)' }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>{invoice.title}</div>
                    <div className="mt-1 text-[11px]" style={{ color: 'rgba(255,255,255,0.48)' }}>{invoice.customer_name || invoice.invoice_number}</div>
                    <div className="mt-1 text-[10px]" style={{ color: 'rgba(255,255,255,0.34)' }}>{invoice.due_date ? `Due ${invoice.due_date}` : invoice.paid_at ? `Paid ${invoice.paid_at.slice(0, 10)}` : 'No due date'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold" style={{ color }}>{formatMoney(invoice.amount)}</div>
                    <div className="mt-1 rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em]" style={{ background: `${color}1f`, border: `1px solid ${color}44`, color }}>{invoice.status}</div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {selectedInvoice && (
        <div className="rounded-3xl p-4" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.18)' }}>
          <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: '#fde68a' }}>Selected Invoice</div>
          <div className="mt-1 text-lg font-semibold" style={{ color: 'rgba(255,255,255,0.94)' }}>{selectedInvoice.title}</div>
          <div className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.54)' }}>{selectedInvoice.customer_name || selectedInvoice.invoice_number}</div>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-2xl px-3 py-2" style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.06)' }}><div className="text-[9px] uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.34)' }}>Amount</div><div className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.78)' }}>{formatMoney(selectedInvoice.amount)}</div></div>
            <div className="rounded-2xl px-3 py-2" style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.06)' }}><div className="text-[9px] uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.34)' }}>Due Date</div><div className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.78)' }}>{selectedInvoice.due_date || 'No due date'}</div></div>
            <div className="rounded-2xl px-3 py-2" style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.06)' }}><div className="text-[9px] uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.34)' }}>Status</div><div className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.78)' }}>{selectedInvoice.status}</div></div>
          </div>
          {selectedInvoice.notes && <div className="mt-3 text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.52)' }}>{selectedInvoice.notes}</div>}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="rounded-full px-3 py-1.5 text-[11px] font-semibold" style={{ background: 'linear-gradient(135deg, #FBBF24, #F59E0B)', color: '#140c02' }}>Open Billing</button>
            <button type="button" className="rounded-full px-3 py-1.5 text-[11px] font-semibold" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.62)' }}>Add Follow-up</button>
          </div>
        </div>
      )}
    </div>
  )
}
