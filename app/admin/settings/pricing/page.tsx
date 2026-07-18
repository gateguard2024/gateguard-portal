'use client'

// Corporate Pricing Console — Phase 1 of the catalog import
// (docs/nexus/CATALOG_IMPORT_PHASES.md).
//
// One place to manage every priced line in the Product Catalog:
//   Floor   — the absolute minimum; below it a deal needs dealer + GateGuard approval
//   Target  — the "sweet spot" every deal should meet or exceed
//   Status  — approved / for-review / open ([Open] items can never be quotable)
// Plus the program settings (included allotments, term, ETF schedule).
// Every save is audited in catalog_pricing_log with the editor's name.

import { useState, useEffect, useCallback } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { CheckCircle2, AlertCircle, Loader2, ChevronDown } from 'lucide-react'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Save, DollarSign } = require('lucide-react') as any

interface PricingItem {
  id: string
  item_code: string | null
  name: string
  provider: string
  category: string
  bucket: 'A' | 'B' | 'C' | null
  billing_type: string
  unit_label: string | null
  base_price: number
  floor_price: number | null
  target_price: number | null
  status: 'approved' | 'for_review' | 'open'
  quotable: boolean
  dealer_visible: boolean
  is_gateguard_program: boolean
  notes: string | null
  sort_order: number
}

interface PricingSetting {
  key: string
  value: number
  description: string | null
}

const BUCKET_LABELS: Record<string, string> = {
  A: 'A — Core subscription (base economics)',
  B: 'B — Configured at sale (setup fees)',
  C: 'C — Add-ons',
}

function unitLabel(i: PricingItem): string {
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

const STATUS_STYLES: Record<string, string> = {
  approved: 'bg-emerald-100 text-emerald-700',
  for_review: 'bg-amber-100 text-amber-700',
  open: 'bg-red-100 text-red-700',
}

function StatusSelect({ value, onChange }: { value: PricingItem['status']; onChange: (v: PricingItem['status']) => void }) {
  return (
    <div className={`relative inline-flex items-center rounded-md px-2 py-1 text-[11px] font-semibold cursor-pointer ${STATUS_STYLES[value]}`}>
      <select value={value} onChange={e => onChange(e.target.value as PricingItem['status'])} className="absolute inset-0 w-full cursor-pointer opacity-0">
        <option value="approved">Approved</option>
        <option value="for_review">For Review</option>
        <option value="open">Open</option>
      </select>
      <span>{value === 'approved' ? 'Approved' : value === 'for_review' ? 'For Review' : 'Open'}</span>
      <ChevronDown size={9} className="ml-1 opacity-60" />
    </div>
  )
}

function MoneyInput({
  value, onChange, disabled, placeholder,
}: { value: number | null; onChange: (v: number | null) => void; disabled?: boolean; placeholder?: string }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
      <input
        type="number"
        step="1"
        min="0"
        disabled={disabled}
        value={value ?? ''}
        placeholder={placeholder ?? '—'}
        onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className="w-24 rounded-lg border border-border bg-background py-1.5 pl-5 pr-2 text-sm outline-none focus:border-[#6B7EFF] disabled:opacity-40"
      />
    </div>
  )
}

export default function PricingConsolePage() {
  const [items, setItems] = useState<PricingItem[]>([])
  const [settings, setSettings] = useState<PricingSetting[]>([])
  const [dirty, setDirty] = useState<Set<string>>(new Set())
  const [dirtySettings, setDirtySettings] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null)

  useEffect(() => {
    fetch('/api/admin/pricing', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        setItems(d.items ?? [])
        setSettings(d.settings ?? [])
      })
      .finally(() => setLoading(false))
  }, [])

  const patchItem = useCallback((id: string, patch: Partial<PricingItem>) => {
    setItems(prev => prev.map(i => (i.id === id ? { ...i, ...patch } : i)))
    setDirty(prev => new Set(prev).add(id))
  }, [])

  const patchSetting = useCallback((key: string, value: number) => {
    setSettings(prev => prev.map(s => (s.key === key ? { ...s, value } : s)))
    setDirtySettings(prev => new Set(prev).add(key))
  }, [])

  async function save() {
    if (saving) return
    // Client-side guardrail mirror: floor may never exceed target.
    for (const i of items) {
      if (dirty.has(i.id) && i.floor_price != null && i.target_price != null && i.floor_price > i.target_price) {
        setFlash({ ok: false, msg: `${i.name}: floor ($${i.floor_price}) cannot exceed target ($${i.target_price}).` })
        return
      }
    }
    setSaving(true)
    setFlash(null)
    try {
      const res = await fetch('/api/admin/pricing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: items
            .filter(i => dirty.has(i.id))
            .map(({ id, base_price, floor_price, target_price, status, quotable, dealer_visible, notes }) => ({
              id, base_price, floor_price, target_price, status, quotable, dealer_visible, notes,
            })),
          settings: settings
            .filter(s => dirtySettings.has(s.key))
            .map(({ key, value }) => ({ key, value })),
        }),
      })
      const out = await res.json()
      if (!res.ok) throw new Error(out?.error ?? 'Save failed')
      setDirty(new Set())
      setDirtySettings(new Set())
      setFlash({ ok: true, msg: `Saved ${out.updated} change${out.updated === 1 ? '' : 's'} — logged to the pricing audit trail.` })
    } catch (e) {
      setFlash({ ok: false, msg: e instanceof Error ? e.message : 'Save failed' })
    } finally {
      setSaving(false)
    }
  }

  const dirtyCount = dirty.size + dirtySettings.size
  const buckets: Array<'A' | 'B' | 'C'> = ['A', 'B', 'C']

  return (
    <div className="flex min-h-full flex-col">
      <TopBar
        title="Pricing Console"
        actions={
          <button
            onClick={save}
            disabled={dirtyCount === 0 || saving}
            className="flex items-center gap-1.5 rounded-lg bg-[#6B7EFF] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#5A6BEB] disabled:opacity-40"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save{dirtyCount > 0 ? ` (${dirtyCount})` : ''}
          </button>
        }
      />

      <div className="mx-auto w-full max-w-5xl space-y-5 px-6 py-5">
        {/* Rules of the road */}
        <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">How floor and target work: </span>
          a deal at or above <span className="font-semibold text-emerald-700">Target</span> is the sweet spot and needs no extra sign-off.
          Between <span className="font-semibold text-amber-700">Floor</span> and Target requires written justification before the quote goes out.
          Below Floor requires approval from <span className="font-semibold">both the dealer and GateGuard</span>.
          Items marked <span className="rounded bg-red-100 px-1 py-0.5 text-[11px] font-semibold text-red-700">Open</span> can never be quoted.
          Every change here is written to the pricing audit log.
        </div>

        {flash && (
          <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${flash.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
            {flash.ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
            {flash.msg}
          </div>
        )}

        {loading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Loading pricing catalog…</div>
        ) : (
          <>
            {[...buckets, 'MARKETPLACE' as const].map(bucket => {
              const rows = bucket === 'MARKETPLACE'
                ? items.filter(i => !i.is_gateguard_program)
                : items.filter(i => i.is_gateguard_program && i.bucket === bucket)
              if (!rows.length) return null
              return (
                <div key={bucket} className="overflow-hidden rounded-xl border border-border bg-card">
                  <div className="border-b border-border bg-muted/40 px-4 py-2.5 text-sm font-semibold text-foreground">
                    {bucket === 'MARKETPLACE' ? 'Marketplace services (third-party providers)' : BUCKET_LABELS[bucket]}
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-2 font-semibold">Item</th>
                        <th className="px-2 py-2 font-semibold">Unit</th>
                        <th className="px-2 py-2 font-semibold">Floor</th>
                        <th className="px-2 py-2 font-semibold">Target</th>
                        <th className="px-2 py-2 font-semibold">Status</th>
                        <th className="px-2 py-2 font-semibold">Quotable</th>
                        <th className="px-4 py-2 font-semibold">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rows.map(i => {
                        const isDirty = dirty.has(i.id)
                        const noPrice = i.billing_type === 'case_by_case'
                        return (
                          <tr key={i.id} className={isDirty ? 'bg-[#6B7EFF]/5' : undefined}>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-1.5 font-medium text-foreground">
                                {isDirty && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />}
                                {i.name}
                              </div>
                              <div className="text-[11px] text-muted-foreground">{i.item_code ?? i.provider}</div>
                            </td>
                            <td className="whitespace-nowrap px-2 py-2.5 text-xs text-muted-foreground">{unitLabel(i)}</td>
                            <td className="px-2 py-2.5">
                              <MoneyInput value={i.floor_price} disabled={noPrice} onChange={v => patchItem(i.id, { floor_price: v })} />
                            </td>
                            <td className="px-2 py-2.5">
                              <MoneyInput value={i.target_price} disabled={noPrice} onChange={v => patchItem(i.id, { target_price: v, ...(v != null ? { base_price: v } : {}) })} />
                            </td>
                            <td className="px-2 py-2.5">
                              <StatusSelect
                                value={i.status}
                                onChange={v => patchItem(i.id, { status: v, ...(v === 'open' ? { quotable: false } : {}) })}
                              />
                            </td>
                            <td className="px-2 py-2.5">
                              <button
                                type="button"
                                disabled={i.status === 'open'}
                                onClick={() => patchItem(i.id, { quotable: !i.quotable })}
                                title={i.status === 'open' ? 'Open items can never be quotable' : 'Toggle quotable'}
                                className={`rounded-md px-2 py-1 text-[11px] font-semibold disabled:opacity-40 ${i.quotable ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                              >
                                {i.quotable ? 'Yes' : 'No'}
                              </button>
                            </td>
                            <td className="px-4 py-2.5">
                              <input
                                value={i.notes ?? ''}
                                onChange={e => patchItem(i.id, { notes: e.target.value })}
                                className="w-full min-w-[180px] rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-[#6B7EFF]"
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
            })}

            {/* Program settings */}
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5 text-sm font-semibold text-foreground">
                <DollarSign size={14} className="text-[#6B7EFF]" /> Program Settings
              </div>
              <div className="grid grid-cols-1 gap-x-6 divide-y divide-border sm:grid-cols-2 sm:divide-y-0">
                {settings.map(s => (
                  <div key={s.key} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                        {dirtySettings.has(s.key) && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />}
                        {s.description ?? s.key}
                      </div>
                      <div className="text-[11px] text-muted-foreground">{s.key}</div>
                    </div>
                    <input
                      type="number"
                      value={s.value}
                      onChange={e => patchSetting(s.key, Number(e.target.value))}
                      className="w-20 shrink-0 rounded-lg border border-border bg-background px-2 py-1.5 text-right text-sm outline-none focus:border-[#6B7EFF]"
                    />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
