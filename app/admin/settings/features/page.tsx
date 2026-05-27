'use client'

import { useState, useEffect, useCallback } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import {
  CheckCircle2, AlertCircle, Loader2, Info,
  Settings, Package, Shield, DollarSign,
} from 'lucide-react'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Save, ShieldCheck, ToggleLeft, ToggleRight, ExternalLink } = require('lucide-react') as any

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
  { id: 'master_agent',       label: 'Master Agent'   },
  { id: 'master_dealer',      label: 'MSO'            },
  { id: 'full_dealer',        label: 'Full Dealer'    },
  { id: 'service_dealer',     label: 'Service Dealer' },
  { id: 'install_contractor', label: 'Install Co.'    },
  { id: 'sales_partner',      label: 'Sales Partner'  },
]

const ACCESS_OPTIONS: { value: AccessLevel; label: string; color: string }[] = [
  { value: 'none', label: 'None',  color: 'bg-slate-100 text-slate-500' },
  { value: 'view', label: 'View',  color: 'bg-amber-100 text-amber-700' },
  { value: 'edit', label: 'Edit',  color: 'bg-emerald-100 text-emerald-700' },
]

/* ─── Group features by section ──────────────────────────── */
function groupBySection(features: Feature[]): Map<string, { label: string; items: Feature[] }> {
  const map = new Map<string, { label: string; items: Feature[] }>()
  for (const f of features) {
    if (!map.has(f.section)) map.set(f.section, { label: f.section_label, items: [] })
    map.get(f.section)!.items.push(f)
  }
  return map
}

/* ─── Access level selector ──────────────────────────────── */
function AccessSelector({ value, onChange }: { value: AccessLevel; onChange: (v: AccessLevel) => void }) {
  return (
    <div className="flex gap-0.5">
      {ACCESS_OPTIONS.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-2 py-1 text-[10px] font-semibold rounded transition-all ${
            value === opt.value ? opt.color : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
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
      const updates = Array.from(dirty.entries()).map(([key, patch]) => ({ key, ...patch }))
      const res = await fetch('/api/admin/features', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      })
      const data = await res.json()
      const failed = (data.results ?? []).filter((r: any) => !r.ok)
      if (failed.length > 0) throw new Error(`${failed.length} item(s) failed to save`)
      setDirty(new Map())
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const sections = groupBySection(features)

  return (
    <div className="flex flex-col min-h-full bg-[#F8FAFC]">
      <TopBar
        title="Feature Settings"
        subtitle="Global defaults · tier access levels · Stripe subscription hooks"
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
            {saved ? 'Saved!' : `Save${dirty.size > 0 ? ` (${dirty.size} change${dirty.size !== 1 ? 's' : ''})` : ''}`}
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
            <span className="font-semibold">Tier defaults</span> set what new dealers get automatically based on their org tier.
            Individual orgs can be overridden from their Dealer detail → Features tab.
            Users can be further restricted (never elevated) from Platform Users.
            <span className="ml-1 font-medium">Stripe IDs</span> will auto-gate features once subscriptions are wired.
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="space-y-6">
            {Array.from(sections.entries()).map(([sectionKey, { label, items }]) => (
              <div key={sectionKey} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                {/* Section header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
                  <h3 className="text-sm font-semibold text-slate-700">{label}</h3>
                  <span className="text-xs text-slate-400">{items.length} feature{items.length !== 1 ? 's' : ''}</span>
                </div>

                {/* Column headers */}
                <div className="grid grid-cols-[200px_1fr_repeat(6,80px)_120px_60px_60px] gap-2 px-5 py-2 border-b border-slate-100 bg-slate-50/50">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Feature</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Description</span>
                  {ORG_TIERS.map(t => (
                    <span key={t.id} className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">{t.label}</span>
                  ))}
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Stripe ID</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Paid</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Beta</span>
                </div>

                {/* Feature rows */}
                {items.map(f => (
                  <div
                    key={f.key}
                    className={`grid grid-cols-[200px_1fr_repeat(6,80px)_120px_60px_60px] gap-2 px-5 py-3 border-b border-slate-50 items-center hover:bg-slate-50/50 transition-colors ${
                      dirty.has(f.key) ? 'bg-amber-50/30' : ''
                    }`}
                  >
                    {/* Label */}
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium text-slate-800 truncate">{f.label}</span>
                      {dirty.has(f.key) && <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />}
                    </div>

                    {/* Description */}
                    <span className="text-xs text-slate-400 truncate">{f.description ?? '—'}</span>

                    {/* Per-tier access selectors */}
                    {ORG_TIERS.map(tier => (
                      <div key={tier.id} className="flex justify-center">
                        <AccessSelector
                          value={(f.tier_defaults ?? {})[tier.id] as AccessLevel ?? 'none'}
                          onChange={v => setTierDefault(f.key, tier.id, v)}
                        />
                      </div>
                    ))}

                    {/* Stripe product ID */}
                    <input
                      value={f.stripe_product_id ?? ''}
                      onChange={e => markDirty(f.key, { stripe_product_id: e.target.value || null })}
                      placeholder="prod_..."
                      className="w-full text-xs border border-slate-200 rounded px-2 py-1 font-mono focus:outline-none focus:ring-1 focus:ring-brand-400 text-slate-600"
                    />

                    {/* Paid toggle */}
                    <div className="flex justify-center">
                      <button onClick={() => markDirty(f.key, { is_paid: !f.is_paid })}>
                        {f.is_paid
                          ? <ToggleRight size={20} className="text-brand-400" />
                          : <ToggleLeft  size={20} className="text-slate-300" />
                        }
                      </button>
                    </div>

                    {/* Beta toggle */}
                    <div className="flex justify-center">
                      <button onClick={() => markDirty(f.key, { is_beta: !f.is_beta })}>
                        {f.is_beta
                          ? <ToggleRight size={20} className="text-amber-500" />
                          : <ToggleLeft  size={20} className="text-slate-300" />
                        }
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
