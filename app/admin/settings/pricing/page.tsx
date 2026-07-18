'use client'

// Corporate Pricing Console v2 — Phase 1 of the catalog import
// (docs/nexus/CATALOG_IMPORT_PHASES.md)
//
// ONE catalog: every service & labor line lives on service_catalog.
//   Floor   — absolute minimum; below it a deal needs dealer + GateGuard approval
//   Target  — the "sweet spot" every deal should meet or exceed
//   Status  — approved / for-review / open ([Open] items can never be quotable)
// Corporate can add new line items from here. Dealers add their own margin on
// top at /settings/pricing (markup only — never below corporate pricing).
// Every save is audited in catalog_pricing_log.

import { useState, useEffect, useCallback } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { CheckCircle2, AlertCircle, Loader2, ChevronDown, Plus, X, Layers } from 'lucide-react'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Save, DollarSign, Hammer, PackagePlus, Store } = require('lucide-react') as any

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

const SECTIONS: Array<{ key: string; title: string; subtitle: string; icon: any }> = [
  { key: 'A', title: 'Core Subscription', subtitle: 'Base economics — non-optional, in every deal', icon: DollarSign },
  { key: 'B', title: 'Configured at Sale', subtitle: 'Per-access-point setup fees set by the survey', icon: Hammer },
  { key: 'C', title: 'Add-Ons', subtitle: 'Optional recurring and one-time layers on the core', icon: Layers },
  { key: 'MARKETPLACE', title: 'Marketplace Services', subtitle: 'Third-party provider services on the same catalog', icon: Store },
]

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
    <div className={`relative inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold cursor-pointer ${STATUS_STYLES[value]}`}>
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
  value, onChange, disabled, accent,
}: { value: number | null; onChange: (v: number | null) => void; disabled?: boolean; accent?: 'floor' | 'target' }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">$</span>
      <input
        type="number"
        step="1"
        min="0"
        disabled={disabled}
        value={value ?? ''}
        placeholder="—"
        onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className={`w-[92px] rounded-xl border bg-background py-2 pl-6 pr-2 text-sm font-semibold outline-none transition-colors disabled:opacity-30 ${
          accent === 'target'
            ? 'border-emerald-200 focus:border-emerald-500 text-emerald-800'
            : 'border-border focus:border-[#6B7EFF]'
        }`}
      />
    </div>
  )
}

/* ─── Add Line Item modal ────────────────────────────────────────────────── */
function AddItemModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: '', bucket: 'C', category: 'other', billing_type: 'per_unit', unit_label: 'unit',
    floor_price: '', target_price: '', status: 'for_review', notes: '', item_code: '',
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function create() {
    if (!form.name.trim() || busy) return
    setBusy(true)
    setErr(null)
    try {
      const res = await fetch('/api/admin/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          bucket: form.bucket,
          category: form.category,
          billing_type: form.billing_type,
          unit_label: form.unit_label,
          floor_price: form.floor_price === '' ? null : Number(form.floor_price),
          target_price: form.target_price === '' ? null : Number(form.target_price),
          status: form.status,
          notes: form.notes || null,
          item_code: form.item_code || null,
        }),
      })
      const out = await res.json()
      if (!res.ok) throw new Error(out?.error ?? 'Create failed')
      onCreated()
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Create failed')
    } finally {
      setBusy(false)
    }
  }

  const field = 'w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[#6B7EFF]'
  const label = 'text-[11px] font-semibold uppercase tracking-wide text-muted-foreground'

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-border bg-white p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-base font-semibold">
            <PackagePlus size={17} className="text-[#6B7EFF]" /> New Line Item
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
        </div>
        {err && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{err}</div>}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <div className={label}>Name</div>
            <input className={field} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. After-hours emergency dispatch" />
          </div>
          <div>
            <div className={label}>Bucket</div>
            <select className={field} value={form.bucket} onChange={e => set('bucket', e.target.value)}>
              <option value="A">A — Core subscription</option>
              <option value="B">B — Configured at sale</option>
              <option value="C">C — Add-on</option>
            </select>
          </div>
          <div>
            <div className={label}>Category</div>
            <select className={field} value={form.category} onChange={e => set('category', e.target.value)}>
              {['gate','labor','access_control','video_monitoring','security','internet','tv','network_mgmt','smart_locks','package_lockers','energy','other'].map(c => (
                <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <div className={label}>Billing</div>
            <select className={field} value={form.billing_type} onChange={e => set('billing_type', e.target.value)}>
              <option value="per_unit">Per unit / month</option>
              <option value="per_property">Per property / month</option>
              <option value="flat_fee">Flat / month</option>
              <option value="one_time">One-time</option>
              <option value="per_foot">Per foot</option>
              <option value="case_by_case">Case by case</option>
            </select>
          </div>
          <div>
            <div className={label}>Unit label</div>
            <input className={field} value={form.unit_label} onChange={e => set('unit_label', e.target.value)} placeholder="gate, door, camera…" />
          </div>
          <div>
            <div className={label}>Floor $</div>
            <input type="number" min="0" className={field} value={form.floor_price} onChange={e => set('floor_price', e.target.value)} placeholder="absolute minimum" />
          </div>
          <div>
            <div className={label}>Target $ (sweet spot)</div>
            <input type="number" min="0" className={field} value={form.target_price} onChange={e => set('target_price', e.target.value)} placeholder="should meet or exceed" />
          </div>
          <div>
            <div className={label}>Status</div>
            <select className={field} value={form.status} onChange={e => set('status', e.target.value)}>
              <option value="for_review">For Review</option>
              <option value="approved">Approved</option>
              <option value="open">Open (not quotable)</option>
            </select>
          </div>
          <div>
            <div className={label}>Code (optional)</div>
            <input className={field} value={form.item_code} onChange={e => set('item_code', e.target.value)} placeholder="auto if blank" />
          </div>
          <div className="col-span-2">
            <div className={label}>Notes</div>
            <input className={field} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="internal guidance for this line" />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-muted">Cancel</button>
          <button
            onClick={create}
            disabled={busy || !form.name.trim()}
            className="flex items-center gap-1.5 rounded-xl bg-[#6B7EFF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5A6BEB] disabled:opacity-40"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add Line Item
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function PricingConsolePage() {
  const [items, setItems] = useState<PricingItem[]>([])
  const [settings, setSettings] = useState<PricingSetting[]>([])
  const [dirty, setDirty] = useState<Set<string>>(new Set())
  const [dirtySettings, setDirtySettings] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  const load = useCallback(() => {
    fetch('/api/admin/pricing', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        setItems(d.items ?? [])
        setSettings(d.settings ?? [])
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

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
  const counts = {
    total: items.length,
    quotable: items.filter(i => i.quotable).length,
    review: items.filter(i => i.status === 'for_review').length,
    open: items.filter(i => i.status === 'open').length,
  }

  return (
    <div className="flex min-h-full flex-col">
      <TopBar
        title="Pricing Console"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 rounded-lg border border-[#6B7EFF]/40 px-3 py-2 text-sm font-semibold text-[#6B7EFF] transition-colors hover:bg-[#6B7EFF]/10"
            >
              <Plus size={14} /> Line Item
            </button>
            <button
              onClick={save}
              disabled={dirtyCount === 0 || saving}
              className="flex items-center gap-1.5 rounded-lg bg-[#6B7EFF] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#5A6BEB] disabled:opacity-40"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save{dirtyCount > 0 ? ` (${dirtyCount})` : ''}
            </button>
          </div>
        }
      />

      <div className="mx-auto w-full max-w-6xl space-y-5 px-6 py-5">
        {/* Summary strip */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: 'Catalog Lines', value: counts.total, cls: 'text-foreground' },
            { label: 'Quotable', value: counts.quotable, cls: 'text-emerald-600' },
            { label: 'For Review', value: counts.review, cls: 'text-amber-600' },
            { label: 'Open — Blocked', value: counts.open, cls: 'text-red-600' },
          ].map(s => (
            <div key={s.label} className="rounded-2xl border border-border bg-card px-4 py-3">
              <div className={`text-2xl font-bold ${s.cls}`}>{loading ? '—' : s.value}</div>
              <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Rules of the road */}
        <div className="rounded-2xl border border-border bg-gradient-to-r from-[#6B7EFF]/[0.06] to-transparent p-4 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">Floor & Target: </span>
          at or above <span className="font-semibold text-emerald-700">Target</span> = sweet spot, no sign-off.
          Between <span className="font-semibold text-amber-700">Floor</span> and Target = written justification.
          Below Floor = <span className="font-semibold">dealer + GateGuard dual approval</span>.
          <span className="rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-semibold text-red-700"> Open </span> items can never be quoted.
          Dealers add their own margin on top at <span className="font-mono text-xs">/settings/pricing</span> — markup only, never below these numbers.
        </div>

        {flash && (
          <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${flash.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
            {flash.ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
            {flash.msg}
          </div>
        )}

        {loading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Loading pricing catalog…</div>
        ) : (
          <>
            {SECTIONS.map(sec => {
              const rows = sec.key === 'MARKETPLACE'
                ? items.filter(i => !i.is_gateguard_program)
                : items.filter(i => i.is_gateguard_program && i.bucket === sec.key)
              if (!rows.length) return null
              const Icon = sec.icon
              return (
                <div key={sec.key} className="overflow-hidden rounded-2xl border border-border bg-card">
                  <div className="flex items-center gap-3 border-b border-border px-5 py-3.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#6B7EFF]/10">
                      <Icon size={16} className="text-[#6B7EFF]" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-foreground">{sec.title}</div>
                      <div className="text-xs text-muted-foreground">{sec.subtitle}</div>
                    </div>
                    <div className="ml-auto rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">{rows.length} lines</div>
                  </div>

                  <div className="hidden grid-cols-[minmax(220px,2fr)_100px_100px_100px_110px_70px_minmax(160px,1.5fr)] items-center gap-3 border-b border-border bg-muted/30 px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground lg:grid">
                    <div>Line Item</div><div>Billed</div><div>Floor</div><div>Target</div><div>Status</div><div>Quote</div><div>Notes</div>
                  </div>

                  <div className="divide-y divide-border">
                    {rows.map(i => {
                      const isDirty = dirty.has(i.id)
                      const noPrice = i.billing_type === 'case_by_case'
                      return (
                        <div
                          key={i.id}
                          className={`grid grid-cols-2 items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/30 lg:grid-cols-[minmax(220px,2fr)_100px_100px_100px_110px_70px_minmax(160px,1.5fr)] ${isDirty ? 'bg-[#6B7EFF]/[0.04]' : ''}`}
                        >
                          <div className="col-span-2 lg:col-span-1">
                            <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                              {isDirty && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />}
                              {i.name}
                            </div>
                            <div className="text-[11px] text-muted-foreground">{i.item_code ?? i.provider}</div>
                          </div>
                          <div className="whitespace-nowrap rounded-full bg-muted px-2 py-1 text-center text-[11px] font-medium text-muted-foreground">{unitLabel(i)}</div>
                          <MoneyInput value={i.floor_price} disabled={noPrice} accent="floor" onChange={v => patchItem(i.id, { floor_price: v })} />
                          <MoneyInput value={i.target_price} disabled={noPrice} accent="target" onChange={v => patchItem(i.id, { target_price: v, ...(v != null ? { base_price: v } : {}) })} />
                          <StatusSelect value={i.status} onChange={v => patchItem(i.id, { status: v, ...(v === 'open' ? { quotable: false } : {}) })} />
                          <button
                            type="button"
                            disabled={i.status === 'open'}
                            onClick={() => patchItem(i.id, { quotable: !i.quotable })}
                            title={i.status === 'open' ? 'Open items can never be quotable' : 'Toggle quotable'}
                            className={`rounded-full px-2.5 py-1 text-[11px] font-bold disabled:opacity-30 ${i.quotable ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                          >
                            {i.quotable ? 'Yes' : 'No'}
                          </button>
                          <input
                            value={i.notes ?? ''}
                            onChange={e => patchItem(i.id, { notes: e.target.value })}
                            className="col-span-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:border-[#6B7EFF] lg:col-span-1"
                            placeholder="internal guidance…"
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            {/* Program settings */}
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="flex items-center gap-3 border-b border-border px-5 py-3.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#6B7EFF]/10">
                  <DollarSign size={16} className="text-[#6B7EFF]" />
                </div>
                <div>
                  <div className="text-sm font-bold text-foreground">Program Settings</div>
                  <div className="text-xs text-muted-foreground">Included allotments, term, and the early-termination schedule</div>
                </div>
              </div>
              <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:gap-x-6">
                {settings.map(s => (
                  <div key={s.key} className="flex items-center justify-between gap-3 px-5 py-3">
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
                      className="w-20 shrink-0 rounded-xl border border-border bg-background px-2 py-2 text-right text-sm font-semibold outline-none focus:border-[#6B7EFF]"
                    />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {showAdd && <AddItemModal onClose={() => setShowAdd(false)} onCreated={load} />}
    </div>
  )
}
