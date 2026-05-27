'use client'

import { useState, useEffect, useCallback } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import {
  CheckCircle2, AlertCircle, Loader2, Info, ChevronDown, ChevronRight,
} from 'lucide-react'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Save, ToggleLeft, ToggleRight, Settings2 } = require('lucide-react') as any

/* ─── Types ──────────────────────────────────────────────── */
type AccessLevel = 'none' | 'view' | 'edit'

interface Feature {
  key:               string
  label:             string
  section:           string
  section_label:     string
  href:              string | null
  description:       string | null
  sort_order:        number
  is_paid:           boolean
  is_beta:           boolean
  tier_defaults:     Record<string, AccessLevel>
  stripe_product_id: string | null
  notes:             string | null
}

const ORG_TIERS = [
  { id: 'master_agent',       label: 'Master Agent',   short: 'MA'  },
  { id: 'master_dealer',      label: 'MSO',            short: 'MSO' },
  { id: 'full_dealer',        label: 'Full Dealer',    short: 'FD'  },
  { id: 'service_dealer',     label: 'Service Dealer', short: 'SD'  },
  { id: 'install_contractor', label: 'Install Co.',    short: 'IC'  },
  { id: 'sales_partner',      label: 'Sales Partner',  short: 'SP'  },
]

const LEVEL_STYLES: Record<AccessLevel, string> = {
  none: 'bg-slate-100 text-slate-500',
  view: 'bg-amber-100 text-amber-700',
  edit: 'bg-emerald-100 text-emerald-700',
}

/* ─── Group features by section ──────────────────────────── */
function groupBySection(features: Feature[]): Map<string, { label: string; items: Feature[] }> {
  const map = new Map<string, { label: string; items: Feature[] }>()
  for (const f of features) {
    if (!map.has(f.section)) map.set(f.section, { label: f.section_label, items: [] })
    map.get(f.section)!.items.push(f)
  }
  return map
}

/* ─── Compact tier select ────────────────────────────────── */
function TierSelect({ value, onChange }: { value: AccessLevel; onChange: (v: AccessLevel) => void }) {
  return (
    <div className={`relative inline-flex items-center rounded-md px-2 py-1 text-[11px] font-semibold cursor-pointer ${LEVEL_STYLES[value]}`}>
      <select
        value={value}
        onChange={e => onChange(e.target.value as AccessLevel)}
        className="absolute inset-0 opacity-0 cursor-pointer w-full"
      >
        <option value="none">None</option>
        <option value="view">View</option>
        <option value="edit">Edit</option>
      </select>
      <span className="capitalize">{value === 'none' ? 'None' : value === 'view' ? 'View' : 'Edit'}</span>
      <ChevronDown size={9} className="ml-1 opacity-60" />
    </div>
  )
}

/* ─── Feature row ────────────────────────────────────────── */
function FeatureRow({
  f,
  isDirty,
  onTierChange,
  onPatch,
}: {
  f: Feature
  isDirty: boolean
  onTierChange: (tier: string, level: AccessLevel) => void
  onPatch: (patch: Partial<Feature>) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      {/* Main row */}
      <div className={`grid grid-cols-[1fr_repeat(6,82px)_36px] gap-2 px-5 py-3 border-b border-slate-50 items-center hover:bg-slate-50/60 transition-colors ${isDirty ? 'bg-amber-50/40' : ''}`}>
        {/* Feature name + description */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-800 truncate">{f.label}</span>
            {isDirty && <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />}
            {f.is_beta && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 text-purple-600 uppercase tracking-wide">Beta</span>
            )}
            {f.is_paid && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-sky-100 text-sky-600 uppercase tracking-wide">Paid</span>
            )}
          </div>
          {f.description && (
            <span className="text-[11px] text-slate-400 truncate block mt-0.5">{f.description}</span>
          )}
        </div>

        {/* Per-tier selects */}
        {ORG_TIERS.map(tier => (
          <div key={tier.id} className="flex justify-center">
            <TierSelect
              value={(f.tier_defaults ?? {})[tier.id] as AccessLevel ?? 'none'}
              onChange={v => onTierChange(tier.id, v)}
            />
          </div>
        ))}

        {/* Expand settings */}
        <button
          onClick={() => setExpanded(e => !e)}
          className={`flex items-center justify-center w-7 h-7 rounded-md transition-colors ${expanded ? 'bg-slate-200 text-slate-600' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
          title="Stripe / Paid / Beta settings"
        >
          <Settings2 size={13} />
        </button>
      </div>

      {/* Expanded settings row */}
      {expanded && (
        <div className="grid grid-cols-[1fr_240px_80px_80px] gap-4 px-5 py-3 bg-slate-50 border-b border-slate-100 items-center">
          <div className="text-[11px] text-slate-500 italic">Extended settings for <span className="font-medium text-slate-700">{f.label}</span></div>

          {/* Stripe product ID */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Stripe ID</label>
            <input
              value={f.stripe_product_id ?? ''}
              onChange={e => onPatch({ stripe_product_id: e.target.value || null })}
              placeholder="prod_..."
              className="flex-1 text-xs border border-slate-200 rounded px-2 py-1 font-mono focus:outline-none focus:ring-1 focus:ring-brand-400 text-slate-600 bg-white"
            />
          </div>

          {/* Paid toggle */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Paid</label>
            <button onClick={() => onPatch({ is_paid: !f.is_paid })}>
              {f.is_paid
                ? <ToggleRight size={20} className="text-brand-400" />
                : <ToggleLeft  size={20} className="text-slate-300" />
              }
            </button>
          </div>

          {/* Beta toggle */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Beta</label>
            <button onClick={() => onPatch({ is_beta: !f.is_beta })}>
              {f.is_beta
                ? <ToggleRight size={20} className="text-amber-500" />
                : <ToggleLeft  size={20} className="text-slate-300" />
              }
            </button>
          </div>
        </div>
      )}
    </>
  )
}

/* ─── Main page ──────────────────────────────────────────── */
export default function GlobalFeaturesPage() {
  const [features, setFeatures]     = useState<Feature[]>([])
  const [loading, setLoading]       = useState(true)
  const [dirty, setDirty]           = useState<Map<string, Partial<Feature>>>(new Map())
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [collapsed, setCollapsed]   = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/features')
      const data = await res.json()
      setFeatures(data.features ?? [])
    } catch { setError('Failed to load features') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const markDirty = (key: string, patch: Partial<Feature>) => {
    setDirty(d => {
      const next = new Map(d)
      next.set(key, { ...(next.get(key) ?? {}), ...patch })
      return next
    })
    setFeatures(fs => fs.map(f => f.key === key ? { ...f, ...patch } : f))
  }

  const setTierDefault = (featureKey: string, tier: string, level: AccessLevel) => {
    const f = features.find(f => f.key === featureKey)
    if (!f) return
    const next = { ...f.tier_defaults, [tier]: level }
    markDirty(featureKey, { tier_defaults: next })
  }

  const handleSave = async () => {
    if (dirty.size === 0) return
    setSaving(true)
    setError(null)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updates = Array.from(dirty.entries()).map(([key, patch]) => ({ key, ...patch }))
      const res = await fetch('/api/admin/features', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      })
      const data = await res.json()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const failed = (data.results ?? []).filter((r: any) => !r.ok)
      if (failed.length > 0) throw new Error(`${failed.length} item(s) failed to save`)
      setDirty(new Map())
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const toggleSection = (key: string) => {
    setCollapsed(s => {
      const next = new Set(s)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const sections = groupBySection(features)

  return (
    <div className="flex flex-col min-h-full bg-[#F8FAFC]">
      <TopBar
        title="Feature Settings"
        subtitle="Global tier defaults · Stripe subscription hooks"
        actions={
          <button
            onClick={() => void handleSave()}
            disabled={dirty.size === 0 || saving}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              dirty.size > 0
                ? 'bg-brand-400 text-white hover:bg-brand-500'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <CheckCircle2 size={14} /> : <Save size={14} />}
            {saved ? 'Saved!' : `Save${dirty.size > 0 ? ` (${dirty.size})` : ''}`}
          </button>
        }
      />

      <div className="flex-1 p-6">
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" /> {error}
          </div>
        )}

        {/* Info banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-6 flex items-start gap-2 text-sm text-blue-700">
          <Info size={15} className="mt-0.5 shrink-0" />
          <div>
            <span className="font-semibold">Tier defaults</span> set what new dealers get automatically.
            Override per org on the <span className="font-medium">Dealer detail → Features tab</span>.
            Users can be further restricted from <span className="font-medium">Platform Users</span>.
            Click <Settings2 size={11} className="inline mx-0.5" /> on any row to set Stripe ID, Paid, or Beta flags.
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="space-y-4">
            {Array.from(sections.entries()).map(([sectionKey, { label, items }]) => {
              const isCollapsed = collapsed.has(sectionKey)
              const dirtyCount = items.filter(f => dirty.has(f.key)).length
              return (
                <div key={sectionKey} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  {/* Section header — clickable to collapse */}
                  <button
                    onClick={() => toggleSection(sectionKey)}
                    className="w-full flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50 hover:bg-slate-100/60 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {isCollapsed ? <ChevronRight size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                      <h3 className="text-sm font-semibold text-slate-700">{label}</h3>
                      {dirtyCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-600">{dirtyCount} unsaved</span>
                      )}
                    </div>
                    <span className="text-xs text-slate-400">{items.length} feature{items.length !== 1 ? 's' : ''}</span>
                  </button>

                  {!isCollapsed && (
                    <>
                      {/* Column headers */}
                      <div className="grid grid-cols-[1fr_repeat(6,82px)_36px] gap-2 px-5 py-2 border-b border-slate-100 bg-slate-50/50">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Feature</span>
                        {ORG_TIERS.map(t => (
                          <span key={t.id} className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">{t.short}</span>
                        ))}
                        <span />
                      </div>

                      {/* Feature rows */}
                      {items.map(f => (
                        <FeatureRow
                          key={f.key}
                          f={f}
                          isDirty={dirty.has(f.key)}
                          onTierChange={(tier, level) => setTierDefault(f.key, tier, level)}
                          onPatch={patch => markDirty(f.key, patch)}
                        />
                      ))}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
