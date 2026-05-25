'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft, ChevronRight, Building2, Users, Shield,
  CheckCircle2, MapPin, Phone, Mail, Globe, Layers,
  Star, Wrench, TrendingUp, ClipboardList, Zap,
  AlertCircle, Copy, ExternalLink, Hash, Info,
  Search, X, Loader2,
} from 'lucide-react'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { DollarSign, Hammer, UserCheck } = require('lucide-react') as any

/* ─── Types ──────────────────────────────────────────────── */
type OrgTier =
  | 'full_dealer'
  | 'service_dealer'
  | 'install_contractor'
  | 'sales_partner'
  | 'master_dealer'
  | 'master_agent'
  | 'corporate'

type PortalRole = 'admin' | 'supervisor' | 'dealer' | 'rep'

interface WizardState {
  // Step 1 — Dealer type
  org_tier: OrgTier | ''
  // Step 2 — Org info
  org_name: string
  license_number: string
  service_area_states: string[]
  tech_count: string
  address: string
  city: string
  state: string
  zip: string
  org_phone: string
  org_email: string
  website: string
  // Step 3 — Relationships
  parent_org_id: string
  parent_org_name: string   // display only
  master_agent_id: string
  master_dealer_id: string
  // Step 4 — Commission config (for full_dealer / master_dealer)
  sales_partner_rate: string
  service_dealer_rate: string
  commission_notes: string
  // Step 5 — Primary admin
  admin_first_name: string
  admin_last_name: string
  admin_email: string
  admin_role: PortalRole
  send_invite: boolean
  // Step 6 — Feature permissions
  permissions: Record<string, PermLevel>
}

const EMPTY: WizardState = {
  org_tier: '',
  org_name: '', license_number: '', service_area_states: [], tech_count: '',
  address: '', city: '', state: '', zip: '', org_phone: '', org_email: '', website: '',
  parent_org_id: '', parent_org_name: '',
  master_agent_id: '', master_dealer_id: '',
  sales_partner_rate: '1.00', service_dealer_rate: '3.00', commission_notes: '',
  admin_first_name: '', admin_last_name: '', admin_email: '',
  admin_role: 'admin', send_invite: true,
  permissions: {},
}

/* ─── Tier config (7 tiers) ──────────────────────────────── */
const TIERS: {
  id: OrgTier
  label: string
  sublabel: string
  icon: any
  color: string
  bg: string
  border: string
  who: string
  flagship?: boolean
  comingSoon?: boolean
}[] = [
  {
    id: 'full_dealer',
    label: 'Full Dealership',
    sublabel: 'Can self-perform any role',
    icon: Shield,
    color: 'text-indigo-600',
    bg: 'bg-indigo-50',
    border: 'border-indigo-300',
    who: 'The flagship tier. Can sell, install, and service. Sets commission templates for their network. May subcontract any role.',
    flagship: true,
  },
  {
    id: 'service_dealer',
    label: 'Service Dealer',
    sublabel: 'Day-to-day property service',
    icon: Wrench,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-300',
    who: 'Primary ongoing relationship with properties. Handles all work orders and maintenance. Earns recurring service commission.',
  },
  {
    id: 'install_contractor',
    label: 'Installing Contractor',
    sublabel: 'Installs only — no recurring',
    icon: ClipboardList,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    who: 'Handles the initial install and commissioning. Paid from one-time setup fees only. Zero recurring commission.',
  },
  {
    id: 'sales_partner',
    label: 'Sales Partner',
    sublabel: 'Sells only, lifetime commission',
    icon: TrendingUp,
    color: 'text-sky-600',
    bg: 'bg-sky-50',
    border: 'border-sky-300',
    who: 'Brings in new properties. Earns lifetime recurring sales commission on every unit they close. No service or installs.',
  },
  {
    id: 'master_dealer',
    label: 'MSO — Master System Operator',
    sublabel: 'Dealer group account owner',
    icon: Layers,
    color: 'text-brand-400',
    bg: 'bg-brand-50',
    border: 'border-brand-300',
    who: 'The billing entity for a portfolio of properties. Sets commission templates. May have full dealers, service, and install contractors under them.',
  },
  {
    id: 'master_agent',
    label: 'Master Agent',
    sublabel: 'Recruits & oversees dealers',
    icon: Star,
    color: 'text-violet-600',
    bg: 'bg-violet-50',
    border: 'border-violet-300',
    who: 'Recruits and onboards dealers. Earns $0.50/unit/month on every property in their network. Operational access drops once dealer is live.',
  },
  {
    id: 'corporate',
    label: 'GateGuard Direct',
    sublabel: 'House account',
    icon: Building2,
    color: 'text-slate-600',
    bg: 'bg-slate-50',
    border: 'border-slate-300',
    who: 'Properties managed directly by GateGuard. No dealer split — full margin retained. Used for flagship / reference properties.',
  },
]

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
]

const ROLE_OPTIONS: { id: PortalRole; label: string; desc: string }[] = [
  { id: 'admin',      label: 'Admin',      desc: 'Full access to all their org data — billing, team, settings' },
  { id: 'supervisor', label: 'Supervisor',  desc: 'Can manage work orders, techs, and sites. No billing.' },
  { id: 'dealer',     label: 'Dealer',      desc: 'Standard dealer access — jobs, quotes, properties.' },
  { id: 'rep',        label: 'Rep',         desc: 'CRM and pipeline only. No work orders or billing.' },
]

/* ─── Step indicator ─────────────────────────────────────── */
const STEPS = [
  { n: 1, label: 'Dealer Type'   },
  { n: 2, label: 'Org Info'      },
  { n: 3, label: 'Relationships' },
  { n: 4, label: 'Commission'    },
  { n: 5, label: 'Admin User'    },
  { n: 6, label: 'Permissions'   },
  { n: 7, label: 'Review'        },
]

/* ─── Permission sections ─────────────────────────────────── */
type PermLevel = 'none' | 'view' | 'edit' | 'administer'

const PERM_SECTIONS: {
  id: string
  label: string
  desc: string
  icon: any
  defaultByTier: Partial<Record<string, PermLevel>>
}[] = [
  { id: 'crm',       label: 'CRM & Sales',         desc: 'Leads, opportunities, pipeline',        icon: TrendingUp, defaultByTier: { full_dealer: 'edit', service_dealer: 'view', install_contractor: 'none', sales_partner: 'administer', master_dealer: 'administer', master_agent: 'edit' } },
  { id: 'customers', label: 'Customers',            desc: 'Accounts, contacts, activity history',  icon: Users,      defaultByTier: { full_dealer: 'edit', service_dealer: 'view', install_contractor: 'view',  sales_partner: 'view',        master_dealer: 'administer', master_agent: 'edit' } },
  { id: 'quotes',    label: 'Quotes & Proposals',   desc: 'Quote builder, client approvals',       icon: ClipboardList, defaultByTier: { full_dealer: 'edit', service_dealer: 'view', install_contractor: 'none', sales_partner: 'edit', master_dealer: 'administer', master_agent: 'edit' } },
  { id: 'billing',   label: 'Billing & Invoices',   desc: 'Invoices, MRR, commission payouts',     icon: DollarSign, defaultByTier: { full_dealer: 'view', service_dealer: 'view', install_contractor: 'none', sales_partner: 'view', master_dealer: 'edit', master_agent: 'view' } },
  { id: 'work_orders', label: 'Work Orders',        desc: 'Field jobs, dispatch, scheduling',      icon: Hammer,     defaultByTier: { full_dealer: 'edit', service_dealer: 'edit', install_contractor: 'edit', sales_partner: 'view', master_dealer: 'administer', master_agent: 'view' } },
  { id: 'sites',     label: 'Properties & Sites',   desc: 'Installed properties, assets, health',  icon: Building2,  defaultByTier: { full_dealer: 'edit', service_dealer: 'view', install_contractor: 'view', sales_partner: 'view', master_dealer: 'administer', master_agent: 'view' } },
  { id: 'inventory', label: 'Inventory',            desc: 'Parts, van stock, purchase orders',     icon: Layers,     defaultByTier: { full_dealer: 'edit', service_dealer: 'view', install_contractor: 'edit', sales_partner: 'none', master_dealer: 'edit', master_agent: 'view' } },
  { id: 'tech_tool', label: 'Tech Tool & Surveys',  desc: '/tech diagnostics, site surveys',       icon: Zap,        defaultByTier: { full_dealer: 'administer', service_dealer: 'edit', install_contractor: 'administer', sales_partner: 'view', master_dealer: 'administer', master_agent: 'view' } },
  { id: 'training',  label: 'Training & Certs',     desc: 'Courses, quizzes, certifications',      icon: Star,       defaultByTier: { full_dealer: 'edit', service_dealer: 'view', install_contractor: 'view', sales_partner: 'view', master_dealer: 'administer', master_agent: 'view' } },
  { id: 'compliance',label: 'Compliance & Permits', desc: 'Permit tracker, renewal alerts',        icon: Shield,     defaultByTier: { full_dealer: 'edit', service_dealer: 'view', install_contractor: 'view', sales_partner: 'none', master_dealer: 'administer', master_agent: 'view' } },
  { id: 'reps',      label: 'Reps & Commissions',   desc: 'Rep hierarchy, commission config',      icon: UserCheck,  defaultByTier: { full_dealer: 'administer', service_dealer: 'none', install_contractor: 'none', sales_partner: 'view', master_dealer: 'administer', master_agent: 'administer' } },
  { id: 'design',    label: 'Design Suite',         desc: 'Floor plans, as-builts, e-sign',        icon: MapPin,     defaultByTier: { full_dealer: 'edit', service_dealer: 'view', install_contractor: 'edit', sales_partner: 'none', master_dealer: 'edit', master_agent: 'view' } },
  { id: 'security',  label: 'Security Hardware',    desc: 'Cameras, access control, network',      icon: Shield,     defaultByTier: { full_dealer: 'edit', service_dealer: 'view', install_contractor: 'edit', sales_partner: 'none', master_dealer: 'edit', master_agent: 'view' } },
  { id: 'ai_army',   label: 'AI Intelligence',      desc: 'ARIA, SCOUT, NEXUS, AI agents',         icon: Zap,        defaultByTier: { full_dealer: 'view', service_dealer: 'none', install_contractor: 'none', sales_partner: 'view', master_dealer: 'edit', master_agent: 'edit' } },
  { id: 'admin',     label: 'Admin & Dealers',      desc: 'Dealer mgmt, users, scorecard, map',   icon: Hash,       defaultByTier: { full_dealer: 'none', service_dealer: 'none', install_contractor: 'none', sales_partner: 'none', master_dealer: 'view', master_agent: 'administer' } },
]

const PERM_LEVELS: { id: PermLevel; label: string; color: string; bg: string; ring: string }[] = [
  { id: 'none',       label: 'None',       color: 'text-slate-400',   bg: 'bg-slate-100',   ring: 'ring-slate-300'   },
  { id: 'view',       label: 'View',       color: 'text-sky-600',     bg: 'bg-sky-100',     ring: 'ring-sky-400'     },
  { id: 'edit',       label: 'Edit',       color: 'text-amber-600',   bg: 'bg-amber-100',   ring: 'ring-amber-400'   },
  { id: 'administer', label: 'Admin',      color: 'text-emerald-600', bg: 'bg-emerald-100', ring: 'ring-emerald-400' },
]

function defaultPermissions(tier: string): Record<string, PermLevel> {
  const out: Record<string, PermLevel> = {}
  for (const s of PERM_SECTIONS) {
    out[s.id] = s.defaultByTier[tier] ?? 'view'
  }
  return out
}

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-10">
      {STEPS.map((s, i) => (
        <div key={s.n} className="flex items-center">
          <div className="flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all ${
              s.n < current  ? 'bg-brand-400 border-brand-400 text-white' :
              s.n === current ? 'bg-white border-brand-400 text-brand-400' :
              'bg-white border-slate-200 text-slate-400'
            }`}>
              {s.n < current ? <CheckCircle2 size={16} /> : s.n}
            </div>
            <span className={`text-xs mt-1 font-medium whitespace-nowrap ${
              s.n === current ? 'text-brand-400' : s.n < current ? 'text-brand-400' : 'text-slate-400'
            }`}>{s.label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`h-0.5 w-12 sm:w-20 mx-1 mt-[-12px] transition-all ${
              s.n < current ? 'bg-brand-400' : 'bg-slate-200'
            }`} />
          )}
        </div>
      ))}
    </div>
  )
}

/* ─── Field row ──────────────────────────────────────────── */
function Field({
  label, required, children, hint,
}: {
  label: string; required?: boolean; children: React.ReactNode; hint?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  )
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 disabled:bg-slate-50 disabled:text-slate-400"
    />
  )
}

/* ─── Main wizard ────────────────────────────────────────── */
/* ─── Commission pool validation ─────────────────────────── */
function commissionPoolError(form: WizardState): string | null {
  const sales   = parseFloat(form.sales_partner_rate)   || 0
  const service = parseFloat(form.service_dealer_rate)  || 0
  if (sales < 0 || service < 0) return 'Rates cannot be negative'
  if (sales + service > 4.00)   return `Total $${(sales + service).toFixed(2)} exceeds the $4.00 configurable pool`
  return null
}

/* ─── Org search picker ──────────────────────────────────── */
interface OrgOption {
  id: string
  name: string
  org_tier: string
  tier_label: string | null
  is_active: boolean
}

function OrgSearchPicker({
  value,
  displayName,
  onChange,
  onClear,
  placeholder,
  tiers,
}: {
  value: string
  displayName: string
  onChange: (id: string, name: string) => void
  onClear: () => void
  placeholder: string
  tiers?: string[]
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<OrgOption[]>([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)

  const search = useCallback(async (query: string) => {
    if (!query.trim()) { setResults([]); return }
    setSearching(true)
    try {
      const params = new URLSearchParams({ q: query, limit: '10' })
      if (tiers) tiers.forEach(t => params.append('tier', t))
      const res = await fetch(`/api/admin/orgs?${params}`)
      const data = await res.json()
      setResults(data.orgs ?? [])
    } catch { setResults([]) }
    finally { setSearching(false) }
  }, [tiers])

  useEffect(() => {
    const timer = setTimeout(() => { void search(q) }, 250)
    return () => clearTimeout(timer)
  }, [q, search])

  if (value) {
    return (
      <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-white">
        <span className="flex-1 text-sm text-slate-900 font-medium">{displayName}</span>
        <span className="text-xs text-slate-400 font-mono">{value.slice(0, 8)}…</span>
        <button onClick={onClear} className="text-slate-300 hover:text-slate-600 transition-colors">
          <X size={14} />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
      </div>
      {open && q.trim() && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg py-1 max-h-48 overflow-y-auto">
          {searching && (
            <div className="px-3 py-2 text-xs text-slate-400 flex items-center gap-2">
              <Loader2 size={12} className="animate-spin" /> Searching…
            </div>
          )}
          {!searching && results.length === 0 && (
            <div className="px-3 py-2 text-xs text-slate-400">No matches found</div>
          )}
          {results.map(org => {
            const cfg = TIER_CONFIG_WIZARD[org.org_tier]
            const TierIcon = cfg?.icon ?? Building2
            return (
              <button
                key={org.id}
                onClick={() => { onChange(org.id, org.name); setQ(''); setOpen(false) }}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 transition-colors text-left"
              >
                <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${cfg?.bg ?? 'bg-slate-100'}`}>
                  <TierIcon size={11} className={cfg?.color ?? 'text-slate-500'} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-900 font-medium truncate">{org.name}</div>
                </div>
                <span className={`text-[10px] font-semibold shrink-0 px-1.5 py-0.5 rounded-full ${cfg?.bg ?? 'bg-slate-100'} ${cfg?.color ?? 'text-slate-500'}`}>
                  {cfg?.label ?? org.org_tier}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ─── Tier config for org search picker (local to wizard) ─── */
const TIER_CONFIG_WIZARD: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  master_agent:       { label: 'Master Agent',  icon: Star,          color: 'text-violet-700', bg: 'bg-violet-100' },
  master_dealer:      { label: 'MSO',            icon: Layers,        color: 'text-brand-400',  bg: 'bg-brand-50'   },
  full_dealer:        { label: 'Full Dealer',   icon: Shield,        color: 'text-indigo-700', bg: 'bg-indigo-100' },
  service_dealer:     { label: 'Service',       icon: Wrench,        color: 'text-emerald-700',bg: 'bg-emerald-100'},
  install_contractor: { label: 'Install',       icon: ClipboardList, color: 'text-amber-700',  bg: 'bg-amber-100'  },
  sales_partner:      { label: 'Sales Partner', icon: TrendingUp,    color: 'text-sky-700',    bg: 'bg-sky-100'    },
}

/* ─── Which tiers show commission step ───────────────────── */
const COMMISSION_TIERS = new Set(['full_dealer', 'master_dealer'])

export default function NewDealerPage() {
  const [step, setStep]         = useState(1)
  const [form, setForm]         = useState<WizardState>(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult]     = useState<any>(null)
  const [error, setError]       = useState<string | null>(null)

  const set = (field: keyof WizardState, val: any) =>
    setForm(f => ({ ...f, [field]: val }))

  const toggleState = (s: string) => {
    setForm(f => ({
      ...f,
      service_area_states: f.service_area_states.includes(s)
        ? f.service_area_states.filter(x => x !== s)
        : [...f.service_area_states, s],
    }))
  }

  /* ── Auto-populate permissions when tier is selected ── */
  const selectTier = (tier: OrgTier) => {
    setForm(f => ({
      ...f,
      org_tier: tier,
      permissions: defaultPermissions(tier),
    }))
  }

  /* ── Skip commission step for tiers that don't need it ── */
  const advance = () => {
    if (step === 3 && !COMMISSION_TIERS.has(form.org_tier as string)) {
      setStep(5) // skip commission step
    } else {
      setStep(s => s + 1)
    }
  }

  const retreat = () => {
    if (step === 5 && !COMMISSION_TIERS.has(form.org_tier as string)) {
      setStep(3) // back to relationships, skipping commission
    } else {
      setStep(s => Math.max(1, s - 1))
    }
  }

  /* ── Validation per step ── */
  const canAdvance = (): boolean => {
    if (step === 1) return !!form.org_tier
    if (step === 2) return !!form.org_name.trim()
    if (step === 3) return true  // relationships are optional
    if (step === 4) return commissionPoolError(form) === null
    if (step === 5) return !!(form.admin_first_name.trim() && form.admin_last_name.trim() && form.admin_email.includes('@'))
    if (step === 6) return true  // permissions always valid
    return true
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/onboard-dealer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_name:            form.org_name.trim(),
          org_tier:            form.org_tier,
          parent_org_id:       form.parent_org_id || null,
          master_agent_id:     form.master_agent_id || null,
          master_dealer_id:    form.master_dealer_id || null,
          license_number:      form.license_number || null,
          service_area_states: form.service_area_states,
          tech_count:          form.tech_count ? parseInt(form.tech_count) : null,
          address:             form.address || null,
          city:                form.city || null,
          state:               form.state || null,
          zip:                 form.zip || null,
          phone:               form.org_phone || null,
          email:               form.org_email || null,
          website:             form.website || null,
          admin_first_name:    form.admin_first_name.trim(),
          admin_last_name:     form.admin_last_name.trim(),
          admin_email:         form.admin_email.trim(),
          admin_role:          form.admin_role,
          send_invite:         form.send_invite,
          // commission config (only used for full_dealer / master_dealer)
          sales_partner_rate:  COMMISSION_TIERS.has(form.org_tier as string)
                                 ? parseFloat(form.sales_partner_rate) || 1.00
                                 : null,
          service_dealer_rate: COMMISSION_TIERS.has(form.org_tier as string)
                                 ? parseFloat(form.service_dealer_rate) || 3.00
                                 : null,
          commission_notes:    form.commission_notes || null,
          permissions:         form.permissions,
        }),
      })
      const json = await res.json()
      if (!res.ok && res.status !== 207) throw new Error(json.error ?? 'Onboarding failed')
      setResult(json)
      setStep(8)  // success screen
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const selectedTier = TIERS.find(t => t.id === form.org_tier)

  /* ── Success screen ── */
  if (step === 8 && result) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Dealer Onboarded!</h2>
          <p className="text-slate-500 mb-6">{result.message}</p>

          <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 text-left mb-6 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Organization</span>
              <span className="font-semibold text-slate-900">{result.org?.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Tier</span>
              <span className="font-medium text-slate-700">{result.org?.tier_label}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Admin</span>
              <span className="font-medium text-slate-700">{form.admin_email}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Invite Status</span>
              <span className={`font-medium ${
                result.invite_status === 'invited' ? 'text-brand-400' :
                result.invite_status === 'existing_user' ? 'text-emerald-600' : 'text-slate-500'
              }`}>
                {result.invite_status === 'invited'       ? '✉ Invite sent' :
                 result.invite_status === 'existing_user' ? '✓ Existing user updated' : 'No invite sent'}
              </span>
            </div>
            {result.org?.id && (
              <div className="flex justify-between text-sm items-center">
                <span className="text-slate-500">Org ID</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-slate-400">{result.org.id.slice(0,8)}…</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(result.org.id)}
                    className="text-slate-400 hover:text-brand-400"
                  >
                    <Copy size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {result.docs_sent && (
            <div className="bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-xl p-4 text-sm text-left mb-4">
              <div className="flex items-start gap-2">
                <Mail size={15} className="mt-0.5 shrink-0 text-indigo-500" />
                <div>
                  <p className="font-semibold">NDA &amp; Agreement sent</p>
                  <p className="mt-0.5 text-xs text-indigo-600">{result.docs_note}</p>
                </div>
              </div>
            </div>
          )}

          {result.clerk_error && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-sm text-left mb-6">
              <div className="flex items-start gap-2">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">Invite failed — org was created</p>
                  <p className="mt-1">{result.clerk_error}</p>
                  <p className="mt-2 text-xs">You can retry by going to the dealer's org page and sending the invite manually.</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-center">
            <button
              onClick={() => { setStep(1); setForm(EMPTY); setResult(null) }}
              className="px-5 py-2.5 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50"
            >
              Add Another Dealer
            </button>
            <Link
              href="/admin/dealers"
              className="px-5 py-2.5 bg-brand-400 text-white rounded-lg text-sm font-medium hover:bg-brand-500"
            >
              View All Dealers
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <Link href="/admin/dealers" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-400 mb-4 transition-colors">
          <ChevronLeft size={16} /> Back to Dealers
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Users size={24} className="text-brand-400" />
          Set Up New Dealer
        </h1>
        <p className="text-sm text-slate-500 mt-1">Creates the org record, sends the portal invite, and wires access — all in one flow.</p>
      </div>

      {/* Step bar */}
      <StepBar current={step} />

      {/* Error */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Step 1: Dealer type ─────────────────────────────────────── */}
      {step === 1 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-1">What type of dealer is this?</h2>
          <p className="text-sm text-slate-500 mb-6">This determines what they can see and do in the portal and how they fit in the org hierarchy.</p>

          <div className="space-y-3">
            {TIERS.map(tier => (
              <button
                key={tier.id}
                onClick={() => selectTier(tier.id as OrgTier)}
                className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
                  form.org_tier === tier.id
                    ? `${tier.border} ${tier.bg}`
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                } ${tier.flagship ? 'ring-1 ring-indigo-200' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    form.org_tier === tier.id ? tier.bg : 'bg-slate-100'
                  }`}>
                    <tier.icon size={18} className={form.org_tier === tier.id ? tier.color : 'text-slate-400'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-semibold text-sm ${form.org_tier === tier.id ? tier.color : 'text-slate-800'}`}>
                        {tier.label}
                      </span>
                      {tier.flagship && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-600">
                          FLAGSHIP
                        </span>
                      )}
                      <span className="text-xs text-slate-400">{tier.sublabel}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{tier.who}</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 shrink-0 mt-0.5 transition-all ${
                    form.org_tier === tier.id
                      ? 'border-brand-400 bg-brand-400'
                      : 'border-slate-300'
                  }`}>
                    {form.org_tier === tier.id && (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full" />
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Step 2: Org info ─────────────────────────────────────────── */}
      {step === 2 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-1">Organization Details</h2>
          <p className="text-sm text-slate-500 mb-6">
            Basic info about <span className="font-medium text-slate-700">{selectedTier?.label}</span> — this becomes their org record in GateGuard.
          </p>

          <div className="space-y-5">
            <Field label="Company Name" required>
              <Input
                value={form.org_name}
                onChange={e => set('org_name', e.target.value)}
                placeholder="Sunshine Gate Services LLC"
                autoFocus
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="License Number">
                <Input
                  value={form.license_number}
                  onChange={e => set('license_number', e.target.value)}
                  placeholder="GA-EL-12345"
                />
              </Field>
              <Field label="# of Technicians">
                <Input
                  type="number"
                  value={form.tech_count}
                  onChange={e => set('tech_count', e.target.value)}
                  placeholder="4"
                />
              </Field>
            </div>

            <Field label="Service Area States" hint="Click to select all states this dealer operates in">
              <div className="flex flex-wrap gap-1.5 mt-1">
                {US_STATES.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleState(s)}
                    className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                      form.service_area_states.includes(s)
                        ? 'bg-brand-400 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </Field>

            <div className="border-t border-slate-100 pt-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Contact Info (optional)</p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Phone">
                    <Input value={form.org_phone} onChange={e => set('org_phone', e.target.value)} placeholder="(404) 555-0100" />
                  </Field>
                  <Field label="Email">
                    <Input type="email" value={form.org_email} onChange={e => set('org_email', e.target.value)} placeholder="info@dealer.com" />
                  </Field>
                </div>
                <Field label="Website">
                  <Input value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://sunshinegate.com" />
                </Field>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Address (optional)</p>
              <div className="space-y-3">
                <Input value={form.address} onChange={e => set('address', e.target.value)} placeholder="Street address" />
                <div className="grid grid-cols-6 gap-3">
                  <div className="col-span-3">
                    <Input value={form.city} onChange={e => set('city', e.target.value)} placeholder="City" />
                  </div>
                  <div className="col-span-1">
                    <Input value={form.state} onChange={e => set('state', e.target.value)} placeholder="GA" maxLength={2} />
                  </div>
                  <div className="col-span-2">
                    <Input value={form.zip} onChange={e => set('zip', e.target.value)} placeholder="ZIP" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 3: Relationships ────────────────────────────────────── */}
      {step === 3 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-1">Org Relationships</h2>
          <p className="text-sm text-slate-500 mb-5">
            Set the Master Agent who recruited this org and the MSO they belong to.
            All fields are optional — you can assign these after onboarding from the org detail page.
          </p>

          {form.org_tier === 'master_agent' ? (
            <div className="bg-violet-50 border border-violet-200 rounded-xl p-5 flex items-center gap-3 mb-4">
              <Building2 size={20} className="text-violet-500 shrink-0" />
              <div>
                <p className="font-semibold text-violet-800 text-sm">GateGuard Corporate</p>
                <p className="text-xs text-violet-600">Master Agents report directly to GateGuard. No parent org or master dealer needed.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Master Agent */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Master Agent (recruiter)</p>
                <p className="text-xs text-slate-400 mb-3">
                  The Master Agent who signed or recruited this dealer. They earn $0.50/unit/month on this dealer's portfolio.
                </p>
                <OrgSearchPicker
                  value={form.master_agent_id}
                  displayName={form.master_agent_id ? `Master Agent (${form.master_agent_id.slice(0, 8)}…)` : ''}
                  onChange={(id) => set('master_agent_id', id)}
                  onClear={() => set('master_agent_id', '')}
                  placeholder="Search for Master Agent org…"
                  tiers={['master_agent']}
                />
              </div>

              {/* Master Dealer */}
              {form.org_tier !== 'master_dealer' && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">MSO (group owner)</p>
                  <p className="text-xs text-slate-400 mb-3">
                    The MSO this org operates under. They earn $0.50/unit/month and set the default commission template.
                  </p>
                  <OrgSearchPicker
                    value={form.master_dealer_id}
                    displayName={form.master_dealer_id ? `MSO (${form.master_dealer_id.slice(0, 8)}…)` : ''}
                    onChange={(id) => set('master_dealer_id', id)}
                    onClear={() => set('master_dealer_id', '')}
                    placeholder="Search for MSO org…"
                    tiers={['master_dealer']}
                  />
                </div>
              )}

              {/* Parent Org (for sub-types) */}
              {(form.org_tier === 'service_dealer' || form.org_tier === 'install_contractor' || form.org_tier === 'sales_partner') && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Full Dealership (direct parent)</p>
                  <p className="text-xs text-slate-400 mb-3">
                    The Full Dealership this org reports to, if any. Optional — not all sub-types have a direct parent dealer.
                  </p>
                  <OrgSearchPicker
                    value={form.parent_org_id}
                    displayName={form.parent_org_name || (form.parent_org_id ? `Dealer (${form.parent_org_id.slice(0, 8)}…)` : '')}
                    onChange={(id, name) => { set('parent_org_id', id); set('parent_org_name', name) }}
                    onClear={() => { set('parent_org_id', ''); set('parent_org_name', '') }}
                    placeholder="Search for Full Dealer org…"
                    tiers={['full_dealer']}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Step 4: Commission Config ───────────────────────────────── */}
      {step === 4 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-1">Commission Configuration</h2>
          <p className="text-sm text-slate-500 mb-5">
            Set the default commission rates for this {selectedTier?.label}. Rates apply per unit per month across all properties in their network.
          </p>

          {/* Revenue breakdown visual */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">$10.00 / unit / month breakdown</p>
            <div className="space-y-2.5">
              {/* Property pays */}
              <div className="flex items-center gap-3">
                <div className="w-28 text-xs text-slate-500 shrink-0">Property pays</div>
                <div className="flex-1 h-6 bg-slate-200 rounded-md flex items-center px-2">
                  <span className="text-xs font-semibold text-slate-600">$10.00 / unit</span>
                </div>
              </div>
              {/* GateGuard keep */}
              <div className="flex items-center gap-3">
                <div className="w-28 text-xs text-slate-500 shrink-0">GateGuard keeps</div>
                <div className="flex-1 h-6 bg-brand-50 border border-brand-200 rounded-md flex items-center px-2">
                  <span className="text-xs font-semibold text-brand-400">$5.00 gross margin</span>
                </div>
              </div>
              {/* Dealer pool */}
              <div className="flex items-center gap-3">
                <div className="w-28 text-xs text-slate-500 shrink-0">Dealer pool</div>
                <div className="flex-1 grid grid-cols-4 gap-1">
                  <div className="h-6 bg-violet-100 rounded flex items-center justify-center text-[10px] font-semibold text-violet-700">$0.50 MA</div>
                  <div className="h-6 bg-brand-50 border border-brand-200 rounded flex items-center justify-center text-[10px] font-semibold text-brand-400">$0.50 MD</div>
                  <div className="h-6 bg-sky-100 rounded flex items-center justify-center text-[10px] font-semibold text-sky-700">
                    ${parseFloat(form.sales_partner_rate || '1') .toFixed(2)} SP
                  </div>
                  <div className="h-6 bg-emerald-100 rounded flex items-center justify-center text-[10px] font-semibold text-emerald-700">
                    ${parseFloat(form.service_dealer_rate || '3').toFixed(2)} SD
                  </div>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-3">MA = Master Agent · MSO = Master System Operator · SP = Sales Partner · SD = Service Dealer</p>
          </div>

          {/* Locked rates */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-600">Master Agent Rate</span>
                <span className="text-[10px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded font-semibold">LOCKED</span>
              </div>
              <div className="text-2xl font-bold text-violet-600">$0.50</div>
              <div className="text-xs text-slate-400 mt-0.5">per unit / month</div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-600">MSO Rate</span>
                <span className="text-[10px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded font-semibold">LOCKED</span>
              </div>
              <div className="text-2xl font-bold text-brand-400">$0.50</div>
              <div className="text-xs text-slate-400 mt-0.5">per unit / month</div>
            </div>
          </div>

          {/* Configurable rates */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
            <div>
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Configurable Pool — $4.00 total</p>
              <p className="text-xs text-slate-400">Sales Partner + Service Dealer rates must sum to $4.00 or less. {selectedTier?.id === 'full_dealer' ? 'If self-performing, the unassigned balance stays with the Full Dealership.' : ''}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Sales Partner Rate ($/unit/mo)" required>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="4"
                    value={form.sales_partner_rate}
                    onChange={e => set('sales_partner_rate', e.target.value)}
                    className="w-full border border-slate-300 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                </div>
              </Field>
              <Field label="Service Dealer Rate ($/unit/mo)" required>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="4"
                    value={form.service_dealer_rate}
                    onChange={e => set('service_dealer_rate', e.target.value)}
                    className="w-full border border-slate-300 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                </div>
              </Field>
            </div>

            {/* Real-time pool total */}
            {(() => {
              const poolErr = commissionPoolError(form)
              const total   = (parseFloat(form.sales_partner_rate) || 0) + (parseFloat(form.service_dealer_rate) || 0)
              const remaining = 4.00 - total
              return (
                <div className={`rounded-lg px-4 py-3 flex items-center justify-between text-sm ${
                  poolErr ? 'bg-red-50 border border-red-200' : 'bg-emerald-50 border border-emerald-200'
                }`}>
                  <span className={poolErr ? 'text-red-700' : 'text-emerald-700'}>
                    {poolErr ? poolErr : `Pool used: $${total.toFixed(2)} of $4.00`}
                  </span>
                  {!poolErr && remaining > 0 && (
                    <span className="text-emerald-600 font-semibold text-xs">
                      ${remaining.toFixed(2)} stays with {selectedTier?.label ?? 'dealership'}
                    </span>
                  )}
                </div>
              )
            })()}

            <Field label="Notes (optional)" hint="E.g. 'Negotiated rate — Atlanta market launch'">
              <textarea
                value={form.commission_notes}
                onChange={e => set('commission_notes', e.target.value)}
                rows={2}
                placeholder="Any notes about this commission arrangement…"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
              />
            </Field>
          </div>
        </div>
      )}

      {/* ── Step 5: Primary admin user ──────────────────────────────── */}
      {step === 5 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-1">Primary Admin User</h2>
          <p className="text-sm text-slate-500 mb-6">
            This person gets the portal invite and becomes the {form.org_name || 'dealer'}'s first admin. They can add more users after setup.
          </p>

          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <Field label="First Name" required>
                <Input
                  value={form.admin_first_name}
                  onChange={e => set('admin_first_name', e.target.value)}
                  placeholder="Jamie"
                  autoFocus
                />
              </Field>
              <Field label="Last Name" required>
                <Input
                  value={form.admin_last_name}
                  onChange={e => set('admin_last_name', e.target.value)}
                  placeholder="Rodriguez"
                />
              </Field>
            </div>

            <Field label="Email Address" required hint="This is where the portal invite will be sent">
              <Input
                type="email"
                value={form.admin_email}
                onChange={e => set('admin_email', e.target.value)}
                placeholder="jamie@sunshinegate.com"
              />
            </Field>

            <Field label="Portal Role" hint="What level of access does this admin need within their org?">
              <div className="space-y-2 mt-1">
                {ROLE_OPTIONS.map(r => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => set('admin_role', r.id)}
                    className={`w-full text-left rounded-lg border px-4 py-3 text-sm transition-all ${
                      form.admin_role === r.id
                        ? 'border-brand-400 bg-brand-50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className={`font-semibold ${form.admin_role === r.id ? 'text-brand-400' : 'text-slate-800'}`}>
                          {r.label}
                        </span>
                        <span className="text-xs text-slate-500 ml-2">{r.desc}</span>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 shrink-0 ${
                        form.admin_role === r.id ? 'border-brand-400 bg-brand-400' : 'border-slate-300'
                      }`}>
                        {form.admin_role === r.id && (
                          <div className="w-full h-full flex items-center justify-center">
                            <div className="w-1.5 h-1.5 bg-white rounded-full" />
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </Field>

            <div className="border-t border-slate-100 pt-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.send_invite}
                  onChange={e => set('send_invite', e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-brand-400 focus:ring-brand-400"
                />
                <div>
                  <span className="text-sm font-medium text-slate-800">Send portal invite email</span>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Sends a Clerk sign-up invitation to {form.admin_email || 'the email above'}. They'll set their password and be immediately scoped to {form.org_name || 'the new org'}.
                    Uncheck if you want to create the account manually later.
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 6: Feature Permissions ─────────────────────────────── */}
      {step === 6 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-1">Feature Permissions</h2>
          <p className="text-sm text-slate-500 mb-2">
            Control what this dealer can access. Permissions are pre-filled based on their tier — adjust as needed.
          </p>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mb-5">
            {PERM_LEVELS.map(pl => (
              <div key={pl.id} className="flex items-center gap-1.5">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${pl.bg} ring-1 ${pl.ring}`} />
                <span className="text-xs text-slate-600 font-medium">{pl.label}</span>
                <span className="text-xs text-slate-400">
                  {pl.id === 'none' && '— hidden'}
                  {pl.id === 'view' && '— read only'}
                  {pl.id === 'edit' && '— can make changes'}
                  {pl.id === 'administer' && '— full control + invite'}
                </span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PERM_SECTIONS.map(section => {
              const Icon = section.icon
              const current: PermLevel = form.permissions[section.id] ?? 'view'
              const currentLevel = PERM_LEVELS.find(p => p.id === current)!
              return (
                <div
                  key={section.id}
                  className={`bg-white rounded-xl border p-3 transition-all ${
                    current === 'none' ? 'border-slate-200 opacity-60' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start gap-3 mb-2.5">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${currentLevel.bg}`}>
                      <Icon size={15} className={currentLevel.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 leading-tight">{section.label}</p>
                      <p className="text-xs text-slate-400 leading-tight mt-0.5">{section.desc}</p>
                    </div>
                  </div>
                  {/* 4-button pill selector */}
                  <div className="flex rounded-lg overflow-hidden border border-slate-200 text-xs font-medium">
                    {PERM_LEVELS.map((pl, idx) => (
                      <button
                        key={pl.id}
                        onClick={() => setForm(f => ({ ...f, permissions: { ...f.permissions, [section.id]: pl.id } }))}
                        className={`flex-1 py-1.5 transition-all ${
                          idx > 0 ? 'border-l border-slate-200' : ''
                        } ${
                          current === pl.id
                            ? `${pl.bg} ${pl.color} font-semibold`
                            : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                        }`}
                      >
                        {pl.label}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          <p className="text-xs text-slate-400 mt-4">
            These permissions apply to the primary admin and all users they invite under this organization. They can be changed later in the dealer detail page.
          </p>
        </div>
      )}

      {/* ── Step 7: Review ───────────────────────────────────────────── */}
      {step === 7 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-1">Review & Launch</h2>
          <p className="text-sm text-slate-500 mb-6">Confirm everything below, then hit Launch to create the dealer account.</p>

          <div className="space-y-4">
            {/* Tier */}
            {selectedTier && (
              <ReviewCard icon={selectedTier.icon} color={selectedTier.color} bg={selectedTier.bg} title="Dealer Type">
                <p className="font-semibold text-slate-900">{selectedTier.label}</p>
                <p className="text-xs text-slate-500">{selectedTier.sublabel}</p>
              </ReviewCard>
            )}

            {/* Org */}
            <ReviewCard icon={Building2} color="text-slate-600" bg="bg-slate-100" title="Organization">
              <p className="font-semibold text-slate-900">{form.org_name}</p>
              {form.license_number && <p className="text-xs text-slate-500">License: {form.license_number}</p>}
              {form.service_area_states.length > 0 && (
                <p className="text-xs text-slate-500">States: {form.service_area_states.join(', ')}</p>
              )}
              {form.tech_count && <p className="text-xs text-slate-500">{form.tech_count} technicians</p>}
              {form.city && form.state && <p className="text-xs text-slate-500">{form.city}, {form.state}</p>}
            </ReviewCard>

            {/* Relationships */}
            <ReviewCard icon={Layers} color="text-slate-500" bg="bg-slate-100" title="Relationships">
              {form.org_tier === 'master_agent' ? (
                <p className="font-semibold text-slate-900">GateGuard Corporate (direct)</p>
              ) : (
                <div className="space-y-1">
                  {form.master_agent_id
                    ? <p className="text-xs text-slate-500 font-mono">MA: {form.master_agent_id.slice(0,8)}…</p>
                    : <p className="text-xs text-slate-400 italic">Master Agent: not set</p>}
                  {form.master_dealer_id
                    ? <p className="text-xs text-slate-500 font-mono">MD: {form.master_dealer_id.slice(0,8)}…</p>
                    : <p className="text-xs text-slate-400 italic">MSO: not set</p>}
                  {form.parent_org_id
                    ? <p className="text-xs text-slate-500 font-mono">Parent: {form.parent_org_id.slice(0,8)}…</p>
                    : null}
                </div>
              )}
            </ReviewCard>

            {/* Commission config */}
            {COMMISSION_TIERS.has(form.org_tier as string) && (
              <ReviewCard icon={DollarSign} color="text-emerald-600" bg="bg-emerald-50" title="Commission Config">
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                  <p className="text-xs text-slate-500">Master Agent: <span className="font-semibold text-slate-700">$0.50</span> (locked)</p>
                  <p className="text-xs text-slate-500">MSO: <span className="font-semibold text-slate-700">$0.50</span> (locked)</p>
                  <p className="text-xs text-slate-500">Sales Partner: <span className="font-semibold text-slate-700">${parseFloat(form.sales_partner_rate || '1').toFixed(2)}</span></p>
                  <p className="text-xs text-slate-500">Service Dealer: <span className="font-semibold text-slate-700">${parseFloat(form.service_dealer_rate || '3').toFixed(2)}</span></p>
                </div>
                {form.commission_notes && <p className="text-xs text-slate-400 mt-1">{form.commission_notes}</p>}
              </ReviewCard>
            )}

            {/* Admin */}
            <ReviewCard icon={Users} color="text-brand-400" bg="bg-brand-50" title="Primary Admin">
              <p className="font-semibold text-slate-900">{form.admin_first_name} {form.admin_last_name}</p>
              <p className="text-xs text-slate-500">{form.admin_email}</p>
              <p className="text-xs text-slate-500">Role: {ROLE_OPTIONS.find(r => r.id === form.admin_role)?.label}</p>
              <p className={`text-xs mt-1 font-medium ${form.send_invite ? 'text-brand-400' : 'text-slate-400'}`}>
                {form.send_invite ? '✉ Invite will be sent' : 'No invite — manual setup'}
              </p>
            </ReviewCard>
          </div>

          {/* What happens */}
          <div className="mt-6 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-2">What happens when you click Launch</p>
            <ol className="space-y-1.5 text-xs text-emerald-800">
              <li className="flex items-start gap-2"><span className="font-bold shrink-0">1.</span> Creates <span className="font-semibold">{form.org_name}</span> as a {selectedTier?.label} org in the GateGuard database</li>
              {COMMISSION_TIERS.has(form.org_tier as string) && (
                <li className="flex items-start gap-2"><span className="font-bold shrink-0">2.</span> Sets commission config (Sales Partner ${parseFloat(form.sales_partner_rate || '1').toFixed(2)} · Service Dealer ${parseFloat(form.service_dealer_rate || '3').toFixed(2)} / unit / month)</li>
              )}
              <li className="flex items-start gap-2"><span className="font-bold shrink-0">{COMMISSION_TIERS.has(form.org_tier as string) ? '3' : '2'}.</span> {form.send_invite ? `Sends a portal sign-up invite to ${form.admin_email}` : `Skips the invite — you'll set up access manually`}</li>
              <li className="flex items-start gap-2"><span className="font-bold shrink-0">{COMMISSION_TIERS.has(form.org_tier as string) ? '4' : '3'}.</span> Wires their portal access so they only see {form.org_name}'s data from the moment they log in</li>
            </ol>
          </div>
        </div>
      )}

      {/* ── Nav buttons ──────────────────────────────────────────────── */}
      <div className="flex justify-between mt-8 pt-6 border-t border-slate-200">
        <button
          onClick={retreat}
          disabled={step === 1}
          className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={16} /> Back
        </button>

        {step < 7 ? (
          <button
            onClick={advance}
            disabled={!canAdvance()}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-400 text-white rounded-lg text-sm font-medium hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Continue <ChevronRight size={16} />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Launching…
              </>
            ) : (
              <>
                <Zap size={16} />
                Launch Dealer
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

/* ─── Review card ─────────────────────────────────────────── */
function ReviewCard({
  icon: Icon, color, bg, title, children,
}: {
  icon: any; color: string; bg: string; title: string; children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex gap-4">
      <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
        <Icon size={17} className={color} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{title}</p>
        {children}
      </div>
    </div>
  )
}
