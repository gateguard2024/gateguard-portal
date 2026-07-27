'use client'

import { useEffect, useState } from 'react'

type RenewalBucket = 'expiring_soon' | 'needs_followup' | 'active' | 'recently_renewed'

type RenewalCard = {
  id: string
  title: string
  status: string
  mrr: number
  setup_total: number
  contract_start: string | null
  contract_end: string | null
  company_name: string | null
  property_name: string | null
  notes: string | null
  bucket: RenewalBucket
  urgency: 'high' | 'medium' | 'low'
}

function formatMoney(value: number): string {
  return `$${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

function bucketLabel(bucket: RenewalBucket): string {
  if (bucket === 'expiring_soon') return 'Expiring Soon'
  if (bucket === 'needs_followup') return 'Needs Follow-up'
  if (bucket === 'recently_renewed') return 'Recently Renewed'
  return 'Active'
}

function bucketColor(bucket: RenewalBucket): string {
  if (bucket === 'needs_followup') return '#F87171'
  if (bucket === 'expiring_soon') return '#FBBF24'
  if (bucket === 'recently_renewed') return '#34D399'
  return '#00C8FF'
}

export function MoneyDocsRenewalsBoard() {
  const [renewals, setRenewals] = useState<RenewalCard[]>([])
  const [selectedBucket, setSelectedBucket] = useState<RenewalBucket>('expiring_soon')
  const [selectedRenewalId, setSelectedRenewalId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)

  async function loadRenewals() {
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch('/api/nexus/money-docs/renewals')
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.success === false) throw new Error(data?.message ?? 'Could not load renewals.')
      const nextRenewals = Array.isArray(data.renewals) ? data.renewals as RenewalCard[] : []
      setRenewals(nextRenewals)
      if (nextRenewals.length === 0) setMessage('No renewals found yet. Customer contract dates will show here once loaded.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load renewals.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadRenewals()
  }, [])

  const buckets: RenewalBucket[] = ['expiring_soon', 'needs_followup', 'active', 'recently_renewed']
  const shownRenewals = renewals.filter(renewal => renewal.bucket === selectedBucket)
  const selectedRenewal = renewals.find(renewal => renewal.id === selectedRenewalId) ?? null

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {buckets.map(bucket => {
          const color = bucketColor(bucket)
          const count = renewals.filter(renewal => renewal.bucket === bucket).length
          const active = selectedBucket === bucket
          return (
            <button key={bucket} type="button" onClick={() => { setSelectedBucket(bucket); setSelectedRenewalId(null) }} className="rounded-2xl px-3 py-3 text-left transition-all hover:-translate-y-0.5" style={{ background: active ? `${color}1f` : 'rgba(0,0,0,0.18)', border: active ? `1px solid ${color}66` : '1px solid rgba(255,255,255,0.06)' }}>
              <div className="text-[10px] uppercase tracking-[0.14em]" style={{ color }}>{bucketLabel(bucket)}</div>
              <div className="mt-1 text-lg font-semibold" style={{ color: 'rgba(255,255,255,0.94)' }}>{count}</div>
            </button>
          )
        })}
      </div>

      {loading && <div className="rounded-2xl p-4 text-xs" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.48)' }}>Loading renewals…</div>}
      {message && <div className="rounded-2xl p-4 text-xs" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.48)' }}>{message}</div>}

      {!loading && shownRenewals.length === 0 && !message && (
        <div className="rounded-2xl p-4 text-xs" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.48)' }}>
          No {bucketLabel(selectedBucket).toLowerCase()} renewals right now.
        </div>
      )}

      {shownRenewals.length > 0 && (
        <div className="space-y-2">
          {shownRenewals.map(renewal => {
            const selected = selectedRenewalId === renewal.id
            const color = bucketColor(renewal.bucket)
            return (
              <button key={renewal.id} type="button" onClick={() => setSelectedRenewalId(renewal.id)} className="w-full rounded-2xl px-3 py-3 text-left transition-all hover:-translate-y-0.5" style={{ background: selected ? `${color}1f` : 'rgba(0,0,0,0.18)', border: selected ? `1px solid ${color}66` : '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>{renewal.title}</div>
                    <div className="mt-1 text-[11px]" style={{ color: 'rgba(255,255,255,0.48)' }}>{renewal.property_name || renewal.company_name || 'Customer account'}</div>
                    <div className="mt-1 text-[10px]" style={{ color: 'rgba(255,255,255,0.34)' }}>{renewal.contract_end ? `Ends ${renewal.contract_end}` : 'No end date'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold" style={{ color }}>{formatMoney(renewal.mrr)} MRR</div>
                    <div className="mt-1 rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em]" style={{ background: `${color}1f`, border: `1px solid ${color}44`, color }}>{renewal.status}</div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {selectedRenewal && (
        <div className="rounded-3xl p-4" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.18)' }}>
          <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: '#fde68a' }}>Selected Renewal</div>
          <div className="mt-1 text-lg font-semibold" style={{ color: 'rgba(255,255,255,0.94)' }}>{selectedRenewal.title}</div>
          <div className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.54)' }}>{selectedRenewal.property_name || selectedRenewal.company_name || 'Customer account'}</div>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-2xl px-3 py-2" style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.06)' }}><div className="text-[9px] uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.34)' }}>MRR</div><div className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.78)' }}>{formatMoney(selectedRenewal.mrr)}</div></div>
            <div className="rounded-2xl px-3 py-2" style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.06)' }}><div className="text-[9px] uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.34)' }}>Start</div><div className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.78)' }}>{selectedRenewal.contract_start || 'No start date'}</div></div>
            <div className="rounded-2xl px-3 py-2" style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.06)' }}><div className="text-[9px] uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.34)' }}>End</div><div className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.78)' }}>{selectedRenewal.contract_end || 'No end date'}</div></div>
          </div>
          {selectedRenewal.notes && <div className="mt-3 text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.52)' }}>{selectedRenewal.notes}</div>}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="rounded-full px-3 py-1.5 text-[11px] font-semibold" style={{ background: 'linear-gradient(135deg, #FBBF24, #F59E0B)', color: '#140c02' }}>Open Renewals</button>
            <button type="button" className="rounded-full px-3 py-1.5 text-[11px] font-semibold" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.62)' }}>Add Follow-up</button>
          </div>
        </div>
      )}
    </div>
  )
}
