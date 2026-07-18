'use client'

// Dealer Pricing & Margin — dealers add margin ON TOP of corporate pricing.
// Markup only: margin is a % or fixed $ added to the corporate price; a dealer
// can never sell below it. Corporate manages the underlying floors/targets at
// /admin/settings/pricing (Pricing Console). CPQ reads: your price = corporate
// price + your margin.

import { useEffect, useState, useCallback } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Save, DollarSign, Percent } = require('lucide-react') as any

interface MarginItem {
  id: string
  item_code: string | null
  name: string
  category: string
  billing_type: string
  unit_label: string | null
  base_price: number
  target_price: number | null
  bucket: string | null
  status: string
  quotable: boolean
  is_gateguard_program: boolean
  margin_type: 'percent' | 'fixed'
  margin_value: number
}

function unitLabel(i: MarginItem): string {
  switch (i.billing_type) {
    case 'per_unit': return `/${i.unit_label ?? 'unit'}/mo`
    case 'per_property': return '/property/mo'
    case 'flat_fee': return 'flat/mo'
    case 'one_time': return `one-time/${i.unit_label ?? 'item'}`
    case 'per_foot': return '/foot'
    case 'case_by_case': return 'case by case'
    default: return i.billing_type
  }
}

function corpPrice(i: MarginItem): number | null {
  return i.target_price ?? (i.base_price || null)
}

function yourPrice(i: MarginItem): number | null {
  const base = corpPrice(i)
  if (base == null) return null
  return i.margin_type === 'percent' ? base * (1 + i.margin_value / 100) : base + i.margin_value
}

export default function DealerPricingPage() {
  const [items, setItems] = useState<MarginItem[]>([])
  const [dirty, setDirty] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null)

  useEffect(() => {
    fetch('/api/dealer/pricing', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setItems((d.items ?? []).filter((i: MarginItem) => i.quotable)))
      .finally(() => setLoading(false))
  }, [])

  const patch = useCallback((id: string, p: Partial<MarginItem>) => {
    setItems(prev => prev.map(i => (i.id === id ? { ...i, ...p } : i)))
    setDirty(prev => new Set(prev).add(id))
  }, [])

  async function save() {
    if (saving || dirty.size === 0) return
    setSaving(true)
    setFlash(null)
    try {
      const res = await fetch('/api/dealer/pricing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: items
            .filter(i => dirty.has(i.id))
            .map(i => ({ service_id: i.id, margin_type: i.margin_type, margin_value: i.margin_value })),
        }),
      })
      const out = await res.json()
      if (!res.ok) throw new Error(out?.error ?? 'Save failed')
      setDirty(new Set())
      setFlash({ ok: true, msg: `Saved margins on ${out.updated} line${out.updated === 1 ? '' : 's'}.` })
    } catch (e) {
      setFlash({ ok: false, msg: e instanceof Error ? e.message : 'Save failed' })
    } finally {
      setSaving(false)
    }
  }

  const groups: Array<{ title: string; rows: MarginItem[] }> = [
    { title: 'GateGuard Program', rows: items.filter(i => i.is_gateguard_program) },
    { title: 'Marketplace Services', rows: items.filter(i => !i.is_gateguard_program) },
  ]

  return (
    <div className="flex min-h-full flex-col">
      <TopBar
        title="Pricing & Margin"
        actions={
          <button
            onClick={save}
            disabled={dirty.size === 0 || saving}
            className="flex items-center gap-1.5 rounded-lg bg-[#6B7EFF] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#5A6BEB] disabled:opacity-40"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save{dirty.size > 0 ? ` (${dirty.size})` : ''}
          </button>
        }
      />

      <div className="mx-auto w-full max-w-5xl space-y-5 px-6 py-5">
        <div className="rounded-2xl border border-border bg-gradient-to-r from-[#6B7EFF]/[0.06] to-transparent p-4 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">Your margin, your price. </span>
          Add margin on top of GateGuard pricing as a percent or fixed dollar amount per line —
          your quoted price becomes <span className="font-semibold">corporate price + your margin</span>.
          Margins can't go negative: you can always sell higher, never below program pricing.
        </div>

        {flash && (
          <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${flash.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
            {flash.ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
            {flash.msg}
          </div>
        )}

        {loading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Loading your pricing…</div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No quotable catalog lines are available to your organization yet.
          </div>
        ) : (
          groups.map(g => {
            if (!g.rows.length) return null
            return (
              <div key={g.title} className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
                  <div className="text-sm font-bold text-foreground">{g.title}</div>
                  <div className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">{g.rows.length} lines</div>
                </div>

                <div className="hidden grid-cols-[minmax(220px,2fr)_110px_110px_170px_110px] items-center gap-3 border-b border-border bg-muted/30 px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground lg:grid">
                  <div>Line Item</div><div>Billed</div><div>Corporate</div><div>Your Margin</div><div>Your Price</div>
                </div>

                <div className="divide-y divide-border">
                  {g.rows.map(i => {
                    const isDirty = dirty.has(i.id)
                    const cp = corpPrice(i)
                    const yp = yourPrice(i)
                    return (
                      <div
                        key={i.id}
                        className={`grid grid-cols-2 items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/30 lg:grid-cols-[minmax(220px,2fr)_110px_110px_170px_110px] ${isDirty ? 'bg-[#6B7EFF]/[0.04]' : ''}`}
                      >
                        <div className="col-span-2 lg:col-span-1">
                          <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                            {isDirty && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />}
                            {i.name}
                          </div>
                          <div className="text-[11px] text-muted-foreground">{i.item_code ?? i.category.replace(/_/g, ' ')}</div>
                        </div>
                        <div className="whitespace-nowrap rounded-full bg-muted px-2 py-1 text-center text-[11px] font-medium text-muted-foreground">{unitLabel(i)}</div>
                        <div className="text-sm font-semibold text-foreground">{cp != null ? `$${cp.toLocaleString()}` : '—'}</div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => patch(i.id, { margin_type: i.margin_type === 'percent' ? 'fixed' : 'percent' })}
                            title="Toggle percent / fixed dollar margin"
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground hover:border-[#6B7EFF] hover:text-[#6B7EFF]"
                          >
                            {i.margin_type === 'percent' ? <Percent size={13} /> : <DollarSign size={13} />}
                          </button>
                          <input
                            type="number"
                            min="0"
                            step={i.margin_type === 'percent' ? 1 : 5}
                            value={i.margin_value}
                            onChange={e => patch(i.id, { margin_value: Math.max(0, Number(e.target.value)) })}
                            className="w-20 rounded-xl border border-border bg-background px-2 py-2 text-sm font-semibold outline-none focus:border-[#6B7EFF]"
                          />
                          <span className="text-xs text-muted-foreground">{i.margin_type === 'percent' ? '%' : '$'}</span>
                        </div>
                        <div className={`text-sm font-bold ${i.margin_value > 0 ? 'text-emerald-700' : 'text-foreground'}`}>
                          {yp != null ? `$${Math.round(yp).toLocaleString()}` : '—'}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
