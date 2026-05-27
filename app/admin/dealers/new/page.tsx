'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft, ChevronRight, Building2, Users, Shield,
  CheckCircle2, MapPin, Phone, Mail, Globe, Layers,
  Star, Wrench, TrendingUp, ClipboardList, Zap, FileText,
  AlertCircle, Copy, ExternalLink, Hash, Info,
  Search, X, Loader2, Clock, RefreshCw, Upload, Plus, Trash2,
} from 'lucide-react'
import { NDA_TEMPLATE } from '@/lib/nda-template'
import { AGREEMENT_TEMPLATE } from '@/lib/agreement-template'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { DollarSign, Hammer, UserCheck, UserPlus, ShieldCheck, Eye, EyeOff } = require('lucide-react') as any

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
type DocStatus  = 'missing' | 'pending' | 'on_file'
type SignStatus = '' | 'pending' | 'counterparty_signed' | 'fully_executed'

interface TechUser {
  _id:        string   // local uuid for list mgmt
  first_name: string
  last_name:  string
  email:      string
  phone:      string
}

interface WizardState {
  // Step 1 — Dealer type
  org_tier: OrgTier | ''
  // Step 2 — Org info
  org_name:            string
  entity_type:         string
  license_number:      string
  service_area_states: string[]
  tech_count:          string
  address: string; city: string; state: string; zip: string
  org_phone: string; org_email: string; website: string
  // After step 2: draft org created
  draft_org_id: string
  // Step 3 — NDA signing
  nda_sent:        boolean
  nda_sig_id:      string
  nda_status:      SignStatus
  nda_signed_name: string
  // Step 4 — Relationships
  parent_org_id:      string
  parent_org_name:    string
  master_agent_id:    string
  master_agent_name:  string
  master_dealer_id:   string
  master_dealer_name: string
  // Step 5 — Commission
  sales_partner_rate:  string
  service_dealer_rate: string
  commission_notes:    string
  // Step 6 — Agreement signing
  agreement_sent:        boolean
  agreement_sig_id:      string
  agreement_status:      SignStatus
  agreement_signed_name: string
  // Step 7 — Users
  admin_first_name: string
  admin_last_name:  string
  admin_email:      string
  admin_role:       PortalRole
  technicians:      TechUser[]
  // Step 8 — Compliance
  coi_status:       DocStatus
  coi_url:          string
  coi_expires_at:   string
  w9_status:        DocStatus
  w9_url:           string
  license_status:   DocStatus
  license_url:      string
  license_expires_at: string
  bg_ack:           boolean
}

const EMPTY: WizardState = {
  org_tier: '',
  org_name: '', entity_type: 'limited liability company',
  license_number: '', service_area_states: [], tech_count: '',
  address: '', city: '', state: '', zip: '', org_phone: '', org_email: '', website: '',
  draft_org_id: '',
  nda_sent: false, nda_sig_id: '', nda_status: '', nda_signed_name: '',
  parent_org_id: '', parent_org_name: '', master_agent_id: '', master_agent_name: '',
  master_dealer_id: '', master_dealer_name: '',
  sales_partner_rate: '1.00', service_dealer_rate: '3.00', commission_notes: '',
  agreement_sent: false, agreement_sig_id: '', agreement_status: '', agreement_signed_name: '',
  admin_first_name: '', admin_last_name: '', admin_email: '', admin_role: 'admin',
  technicians: [],
  coi_status: 'missing', coi_url: '', coi_expires_at: '',
  w9_status: 'missing', w9_url: '',
  license_status: 'missing', license_url: '', license_expires_at: '',
  bg_ack: false,
}

const ENTITY_TYPES = [
  'limited liability company', 'corporation', 'S corporation',
  'partnership', 'sole proprietorship', 'limited partnership',
]

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
]

/* ─── Tier config ────────────────────────────────────────── */
const TIERS: {
  id: OrgTier; label: string; sublabel: string; icon: any
  color: string; bg: string; border: string; who: string; flagship?: boolean
}[] = [
  {
    id: 'full_dealer', label: 'Full Dealership', sublabel: 'Can self-perform any role',
    icon: Shield, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-300',
    who: 'The flagship tier. Can sell, install, and service. Sets commission templates for their network.', flagship: true,
  },
  {
    id: 'service_dealer', label: 'Service Dealer', sublabel: 'Day-to-day property service',
    icon: Wrench, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-300',
    who: 'Primary ongoing relationship with properties. Handles all work orders and maintenance.',
  },
  {
    id: 'install_contractor', label: 'Installing Contractor', sublabel: 'Installs only — no recurring',
    icon: ClipboardList, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-300',
    who: 'Handles the initial install and commissioning. Paid from one-time setup fees only.',
  },
  {
    id: 'sales_partner', label: 'Sales Partner', sublabel: 'Sells only, lifetime commission',
    icon: TrendingUp, color: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-300',
    who: 'Brings in new properties. Earns lifetime recurring sales commission on every unit they close.',
  },
  {
    id: 'master_dealer', label: 'MSO — Master System Operator', sublabel: 'Dealer group account owner',
    icon: Layers, color: 'text-brand-400', bg: 'bg-brand-50', border: 'border-brand-300',
    who: 'The billing entity for a portfolio of properties. Sets commission templates.',
  },
  {
    id: 'master_agent', label: 'Master Agent', sublabel: 'Recruits & oversees dealers',
    icon: Star, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-300',
    who: 'Recruits and onboards dealers. Earns $0.50/unit/month on every property in their network.',
  },
  {
    id: 'corporate', label: 'GateGuard Direct', sublabel: 'House account',
    icon: Building2, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-300',
    who: 'Properties managed directly by GateGuard. No dealer split — full margin retained.',
  },
]

/* ─── Portal access matrix per tier ──────────────────────── */
const TIER_ACCESS: Record<string, { can: string[]; limited: string[]; cannot: string[] }> = {
  full_dealer: {
    can:     ['Dashboard', 'CRM', 'Quotes', 'Dispatch', 'Work Orders', 'Billing', 'Reports', 'Map', 'ARIA', 'KB / Tech Tool'],
    limited: [],
    cannot:  ['Admin panel', 'Platform-wide data'],
  },
  service_dealer: {
    can:     ['Dashboard', 'Dispatch', 'Work Orders', 'Properties (own sites)', 'KB / Tech Tool'],
    limited: ['Reports (own only)', 'Billing (view)'],
    cannot:  ['CRM', 'Quotes', 'ARIA', 'Admin panel'],
  },
  install_contractor: {
    can:     ['Dashboard', 'Work Orders (installs)', 'KB / Tech Tool'],
    limited: ['Properties (install view only)'],
    cannot:  ['CRM', 'Quotes', 'Billing', 'Dispatch scheduling', 'ARIA'],
  },
  sales_partner: {
    can:     ['Dashboard', 'CRM (sales pipeline)', 'Quotes (own only)', 'ARIA'],
    limited: ['Reports (own commissions)'],
    cannot:  ['Dispatch', 'Work Orders', 'Billing', 'Field tools'],
  },
  master_dealer: {
    can:     ['Dashboard', 'CRM', 'Quotes', 'Dispatch', 'Work Orders', 'Billing', 'Reports', 'Map', 'ARIA', 'Network overview'],
    limited: [],
    cannot:  ['Admin panel'],
  },
  master_agent: {
    can:     ['Dashboard', 'CRM (dealer pipeline)', 'Reports (network)', 'ARIA'],
    limited: ['Billing (own orgs only)'],
    cannot:  ['Dispatch', 'Work Orders', 'Field tools'],
  },
  corporate: {
    can:     ['Full portal access', 'Admin panel', 'All dealer data'],
    limited: [],
    cannot:  [],
  },
}

/* ─── Role options ───────────────────────────────────────── */
const ROLE_OPTIONS: { id: PortalRole; label: string; desc: string }[] = [
  { id: 'admin',      label: 'Admin',      desc: 'Full access — billing, team, settings' },
  { id: 'supervisor', label: 'Supervisor', desc: 'Work orders, techs, sites. No billing.' },
  { id: 'dealer',     label: 'Dealer',     desc: 'Standard access — jobs, quotes, properties.' },
  { id: 'rep',        label: 'Rep',        desc: 'CRM and pipeline only.' },
]

/* ─── Agreement doc types per tier ──────────────────────── */
const TIER_DOC_TYPES: Record<string, string> = {
  master_agent:       'master_agent_agreement',
  master_dealer:      'dealer_agreement',
  full_dealer:        'dealer_agreement',
  service_dealer:     'service_agreement',
  install_contractor: 'install_partner_agreement',
  sales_partner:      'sales_partner_agreement',
}

const DOC_LABELS: Record<string, string> = {
  nda:                        'Mutual NDA',
  master_agent_agreement:     'Master Agent Agreement',
  dealer_agreement:           'Authorized Dealer Agreement',
  service_agreement:          'Service Partner Agreement',
  install_partner_agreement:  'Installation Partner Agreement',
  sales_partner_agreement:    'Sales Partner Agreement',
}

const COMMISSION_TIERS = new Set(['full_dealer', 'master_dealer'])

/* ─── Step bar ───────────────────────────────────────────── */
const STEPS = [
  { n: 1, label: 'Type'         },
  { n: 2, label: 'Org Info'     },
  { n: 3, label: 'NDA'          },
  { n: 4, label: 'Relationships'},
  { n: 5, label: 'Commission'   },
  { n: 6, label: 'Agreement'    },
  { n: 7, label: 'Users'        },
  { n: 8, label: 'Compliance'   },
  { n: 9, label: 'Approve'      },
]

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-start gap-0 mb-8 overflow-x-auto pb-2">
      {STEPS.map((s, i) => (
        <div key={s.n} className="flex items-start">
          <div className="flex flex-col items-center min-w-[52px]">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-all ${
              s.n < current  ? 'bg-brand-400 border-brand-400 text-white' :
              s.n === current ? 'bg-white border-brand-400 text-brand-400' :
              'bg-white border-slate-200 text-slate-400'
            }`}>
              {s.n < current ? <CheckCircle2 size={13} /> : s.n}
            </div>
            <span className={`text-[10px] mt-1 font-medium text-center leading-tight ${
              s.n === current ? 'text-brand-400' : s.n < current ? 'text-brand-400' : 'text-slate-400'
            }`}>{s.label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`h-0.5 w-8 sm:w-10 mx-0.5 mt-3.5 shrink-0 transition-all ${
              s.n < current ? 'bg-brand-400' : 'bg-slate-200'
            }`} />
          )}
        </div>
      ))}
    </div>
  )
}

/* ─── Field / Input helpers ──────────────────────────────── */
function Field({ label, required, children, hint }: {
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
      className={`w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 disabled:bg-slate-50 disabled:text-slate-400 ${props.className ?? ''}`}
    />
  )
}

/* ─── Org search picker ──────────────────────────────────── */
interface OrgOption { id: string; name: string; org_tier: string; tier_label: string | null; is_active: boolean }

const TIER_CFG_WIZARD: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  master_agent:       { label: 'Master Agent',  icon: Star,          color: 'text-violet-700', bg: 'bg-violet-100' },
  master_dealer:      { label: 'MSO',            icon: Layers,        color: 'text-brand-400',  bg: 'bg-brand-50'   },
  full_dealer:        { label: 'Full Dealer',   icon: Shield,        color: 'text-indigo-700', bg: 'bg-indigo-100' },
  service_dealer:     { label: 'Service',       icon: Wrench,        color: 'text-emerald-700',bg: 'bg-emerald-100'},
  install_contractor: { label: 'Install',       icon: ClipboardList, color: 'text-amber-700',  bg: 'bg-amber-100'  },
  sales_partner:      { label: 'Sales Partner', icon: TrendingUp,    color: 'text-sky-700',    bg: 'bg-sky-100'    },
}

function OrgSearchPicker({ value, displayName, onChange, onClear, placeholder, tiers }: {
  value: string; displayName: string
  onChange: (id: string, name: string) => void
  onClear: () => void; placeholder: string; tiers?: string[]
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
        <button onClick={onClear} className="text-slate-300 hover:text-slate-600"><X size={14} /></button>
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
          {searching && <div className="px-3 py-2 text-xs text-slate-400 flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> Searching…</div>}
          {!searching && results.length === 0 && <div className="px-3 py-2 text-xs text-slate-400">No matches found</div>}
          {results.map(org => {
            const cfg = TIER_CFG_WIZARD[org.org_tier]
            const TierIcon = cfg?.icon ?? Building2
            return (
              <button key={org.id}
                onClick={() => { onChange(org.id, org.name); setQ(''); setOpen(false) }}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 text-left"
              >
                <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${cfg?.bg ?? 'bg-slate-100'}`}>
                  <TierIcon size={11} className={cfg?.color ?? 'text-slate-500'} />
                </div>
                <span className="flex-1 text-sm text-slate-900 font-medium truncate">{org.name}</span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cfg?.bg ?? 'bg-slate-100'} ${cfg?.color ?? 'text-slate-500'}`}>
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

/* ─── Signing status widget ──────────────────────────────── */
function SigningPanel({
  docType, orgId, label, sent, sigId, status, signedName,
  onSend, onRefresh, onCountersign,
  sending, refreshing, countersigning,
}: {
  docType: string; orgId: string; label: string
  sent: boolean; sigId: string; status: SignStatus; signedName: string
  onSend: () => void; onRefresh: () => void; onCountersign: () => void
  sending: boolean; refreshing: boolean; countersigning: boolean
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Doc header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
        <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center shrink-0">
          <FileText size={15} className="text-indigo-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900">{label}</p>
          <p className="text-xs text-slate-400">Gate Guard, LLC &amp; {orgId ? 'dealer org' : '(pending)'}</p>
        </div>
        {status === 'fully_executed' && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-1">
            <CheckCircle2 size={10} /> Executed
          </span>
        )}
        {status === 'counterparty_signed' && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1">
            <Clock size={10} /> Needs countersign
          </span>
        )}
        {status === 'pending' && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 flex items-center gap-1">
            <Clock size={10} /> Awaiting dealer
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
        {!sent && (
          <button
            onClick={onSend}
            disabled={sending || !orgId}
            className="flex items-center gap-1.5 px-3 py-2 bg-brand-400 text-white rounded-lg text-sm font-semibold hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sending ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />}
            Send for Signature
          </button>
        )}
        {sent && status !== 'fully_executed' && (
          <>
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              {refreshing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              Check Status
            </button>
            {status === 'counterparty_signed' && (
              <button
                onClick={onCountersign}
                disabled={countersigning}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
              >
                {countersigning ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                Countersign Now
              </button>
            )}
          </>
        )}
        {status === 'fully_executed' && (
          <span className="text-sm font-medium text-emerald-600 flex items-center gap-1.5">
            <CheckCircle2 size={14} /> Fully executed — both parties signed
          </span>
        )}
      </div>

      {/* Status trail */}
      {sent && (
        <div className="px-4 pb-3 space-y-1">
          <div className="flex items-center gap-2 text-xs">
            <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 ${
              ['pending','counterparty_signed','fully_executed'].includes(status) ? 'bg-emerald-500' : 'bg-slate-200'
            }`}>
              {['pending','counterparty_signed','fully_executed'].includes(status) && (
                <CheckCircle2 size={9} className="text-white" />
              )}
            </div>
            <span className={['pending','counterparty_signed','fully_executed'].includes(status) ? 'text-emerald-700 font-medium' : 'text-slate-400'}>
              Signing link sent to dealer
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 ${
              ['counterparty_signed','fully_executed'].includes(status) ? 'bg-emerald-500' : 'bg-slate-200'
            }`}>
              {['counterparty_signed','fully_executed'].includes(status) && (
                <CheckCircle2 size={9} className="text-white" />
              )}
            </div>
            <span className={['counterparty_signed','fully_executed'].includes(status) ? 'text-emerald-700 font-medium' : 'text-slate-400'}>
              {signedName ? `Dealer signed (${signedName})` : 'Dealer signed'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 ${
              status === 'fully_executed' ? 'bg-emerald-500' : 'bg-slate-200'
            }`}>
              {status === 'fully_executed' && <CheckCircle2 size={9} className="text-white" />}
            </div>
            <span className={status === 'fully_executed' ? 'text-emerald-700 font-medium' : 'text-slate-400'}>
              GateGuard countersigned
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Commission pool validation ──────────────────────────── */
function commissionPoolError(form: WizardState): string | null {
  const sales   = parseFloat(form.sales_partner_rate)   || 0
  const service = parseFloat(form.service_dealer_rate)  || 0
  if (sales < 0 || service < 0) return 'Rates cannot be negative'
  if (sales + service > 4.00)   return `Total \$${(sales + service).toFixed(2)} exceeds the \$4.00 configurable pool`
  return null
}

/* ─── Review card ────────────────────────────────────────── */
function ReviewCard({ icon: Icon, color, bg, title, children }: {
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

/* ─── Main wizard ────────────────────────────────────────── */
export default function NewDealerPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const resumeId = searchParams.get('resume')

  const [step, setStep]           = useState(1)
  const [form, setForm]           = useState<WizardState>(EMPTY)
  const [resumeLoading, setResumeLoading] = useState(!!resumeId)
  const [creatingDraft, setCreatingDraft] = useState(false)
  const [activating, setActivating]       = useState(false)
  const [result, setResult]       = useState<any>(null)
  const [error, setError]         = useState<string | null>(null)
  // Signing state
  const [sendingNda, setSendingNda]               = useState(false)
  const [sendingAgreement, setSendingAgreement]   = useState(false)
  const [refreshingNda, setRefreshingNda]         = useState(false)
  const [refreshingAgreement, setRefreshingAgreement] = useState(false)
  const [countersigningNda, setCountersigningNda]         = useState(false)
  const [countersigningAgreement, setCountersigningAgreement] = useState(false)
  // Document preview + edit state
  const TODAY_FORMATTED = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const [ndaEffectiveDate, setNdaEffectiveDate]   = useState(TODAY_FORMATTED)
  const [ndaText, setNdaText]                     = useState('')   // populated on step 3 mount
  const [ndaPreviewOpen, setNdaPreviewOpen]       = useState(false)
  const [agrEffectiveDate, setAgrEffectiveDate]   = useState(TODAY_FORMATTED)
  const [agrText, setAgrText]                     = useState('')   // populated on step 6 mount
  const [agrPreviewOpen, setAgrPreviewOpen]       = useState(false)

  const set = (field: keyof WizardState, val: any) =>
    setForm(f => ({ ...f, [field]: val }))

  // ── Resume existing onboarding ────────────────────────────────────────────
  useEffect(() => {
    if (!resumeId) return
    ;(async () => {
      setResumeLoading(true)
      try {
        // 1. Fetch the org record
        const orgRes = await fetch(`/api/admin/dealers/${resumeId}`)
        if (!orgRes.ok) throw new Error('Could not load dealer record')
        const { org, commissionConfig } = await orgRes.json()

        // 2. Fetch existing signatures for this org
        const sigRes = await fetch(`/api/signatures/by-record?org_id=${resumeId}`)
        const sigData = sigRes.ok ? await sigRes.json() : { signatures: [] }
        const sigs: any[] = sigData.signatures ?? []
        const ndaSig      = sigs.find((s: any) => s.document_type === 'nda')
        const agrSig      = sigs.find((s: any) => s.document_type !== 'nda' && s.document_type !== undefined)

        // 3. Pre-fill form from org data
        const prefilled: WizardState = {
          ...EMPTY,
          draft_org_id:        org.id,
          org_tier:            org.org_tier ?? '',
          org_name:            org.name ?? '',
          entity_type:         org.entity_type ?? 'limited liability company',
          license_number:      org.license_number ?? '',
          service_area_states: org.service_area_states ?? [],
          tech_count:          org.tech_count != null ? String(org.tech_count) : '',
          address:             org.address ?? '',
          city:                org.city ?? '',
          state:               org.state ?? '',
          zip:                 org.zip ?? '',
          org_phone:           org.phone ?? '',
          org_email:           org.email ?? '',
          website:             org.website ?? '',
          // Relationships
          parent_org_id:       org.parent_org_id ?? '',
          // Commission
          sales_partner_rate:  commissionConfig?.sales_partner_rate != null ? String(commissionConfig.sales_partner_rate) : '1.00',
          service_dealer_rate: commissionConfig?.service_dealer_rate != null ? String(commissionConfig.service_dealer_rate) : '3.00',
          commission_notes:    commissionConfig?.notes ?? '',
          // NDA
          nda_sent:        !!ndaSig,
          nda_sig_id:      ndaSig?.id ?? '',
          nda_status:      ndaSig?.status ?? '',
          nda_signed_name: ndaSig?.signer_name ?? '',
          // Agreement
          agreement_sent:        !!agrSig,
          agreement_sig_id:      agrSig?.id ?? '',
          agreement_status:      agrSig?.status ?? '',
          agreement_signed_name: agrSig?.signer_name ?? '',
          // Compliance
          coi_status:         org.partner_docs?.find((d: any) => d.type === 'coi')?.status ?? 'missing',
          coi_url:            org.partner_docs?.find((d: any) => d.type === 'coi')?.url ?? '',
          coi_expires_at:     org.partner_docs?.find((d: any) => d.type === 'coi')?.expires_at ?? '',
          w9_status:          org.partner_docs?.find((d: any) => d.type === 'w9')?.status ?? 'missing',
          w9_url:             org.partner_docs?.find((d: any) => d.type === 'w9')?.url ?? '',
          license_status:     org.partner_docs?.find((d: any) => d.type === 'license')?.status ?? 'missing',
          license_url:        org.partner_docs?.find((d: any) => d.type === 'license')?.url ?? '',
          license_expires_at: org.partner_docs?.find((d: any) => d.type === 'license')?.expires_at ?? '',
          bg_ack:             false,
        }
        setForm(prefilled)

        // 4. Jump to the furthest incomplete step
        let resumeStep = 3   // default: NDA
        if (!prefilled.nda_sent)        resumeStep = 3
        else if (!prefilled.parent_org_id) resumeStep = 4
        else if (!commissionConfig)     resumeStep = 5
        else if (!prefilled.agreement_sent) resumeStep = 6
        else if (!org.contact_email)    resumeStep = 7
        else                            resumeStep = 8

        setStep(resumeStep)
      } catch (e: any) {
        setError(e.message ?? 'Failed to load dealer for resume')
      } finally {
        setResumeLoading(false)
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeId])

  const toggleState = (s: string) =>
    setForm(f => ({
      ...f, service_area_states: f.service_area_states.includes(s)
        ? f.service_area_states.filter(x => x !== s)
        : [...f.service_area_states, s],
    }))

  /* ── Build NDA text from current form + effective date ── */
  const buildNdaText = (effectiveDate: string) => NDA_TEMPLATE
    .replace(/\{\{EFFECTIVE_DATE\}\}/g, effectiveDate || TODAY_FORMATTED)
    .replace(/\{\{DEALER_LEGAL_NAME\}\}/g, form.org_name || '(Dealer Name)')
    .replace(/\{\{DEALER_STATE_AND_ENTITY_TYPE\}\}/g,
      [form.state, form.entity_type].filter(Boolean).join(' ') || '(State Entity Type)')
    .replace(/\{\{DEALER_ADDRESS\}\}/g,
      [form.address, form.city, form.state, form.zip].filter(Boolean).join(', ') || '(Dealer Address)')

  /* ── Build Agreement text from current form + effective date ── */
  const buildAgreementText = (effectiveDate: string) => {
    const tierKey = form.org_tier as string
    const territory = form.service_area_states.join(', ') || '(All licensed states)'
    const hw = '40'; const sw = '30'; const install = '100'
    return AGREEMENT_TEMPLATE
      .replace(/\{\{EFFECTIVE_DATE\}\}/g, effectiveDate || TODAY_FORMATTED)
      .replace(/\{\{DEALER_LEGAL_NAME\}\}/g, form.org_name || '(Dealer Name)')
      .replace(/\{\{DEALER_STATE_AND_ENTITY_TYPE\}\}/g,
        [form.state, form.entity_type].filter(Boolean).join(' ') || '(State Entity Type)')
      .replace(/\{\{DEALER_ADDRESS\}\}/g,
        [form.address, form.city, form.state, form.zip].filter(Boolean).join(', ') || '(Dealer Address)')
      .replace(/\{\{APPROVED_TERRITORY\}\}/g, territory)
      .replace(/\{\{CHECKBOX_FULL_DEALER\}\}/g,          tierKey === 'full_dealer'        ? 'X' : ' ')
      .replace(/\{\{CHECKBOX_SERVICE_DEALER\}\}/g,        tierKey === 'service_dealer'     ? 'X' : ' ')
      .replace(/\{\{CHECKBOX_INSTALLING_CONTRACTOR\}\}/g, tierKey === 'install_contractor' ? 'X' : ' ')
      .replace(/\{\{CHECKBOX_SALES_PARTNER\}\}/g,         tierKey === 'sales_partner'      ? 'X' : ' ')
      .replace(/\{\{CHECKBOX_MSO\}\}/g,                   tierKey === 'master_dealer'      ? 'X' : ' ')
      .replace(/\{\{CHECKBOX_MASTER_AGENT\}\}/g,          tierKey === 'master_agent'       ? 'X' : ' ')
      .replace(/\{\{HARDWARE_DISCOUNT_PERCENTAGE\}\}/g, hw)
      .replace(/\{\{SOFTWARE_MRR_PERCENTAGE\}\}/g, sw)
      .replace(/\{\{MASTER_AGENT_OVERRIDE_AMOUNT\}\}/g, '0.50')
      .replace(/\{\{INSTALL_FEE_PERCENTAGE\}\}/g, install)
      .replace(/\{\{DYNAMIC_TIER_NOTES\}\}/g, '')
  }

  /* ── Commission step skip ── */
  const advance = async () => {
    // Step 2 → 3: create draft org
    if (step === 2) {
      setCreatingDraft(true)
      setError(null)
      try {
        const res = await fetch('/api/admin/create-draft-dealer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            org_name:            form.org_name.trim(),
            org_tier:            form.org_tier,
            entity_type:         form.entity_type,
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
            sales_partner_rate:  COMMISSION_TIERS.has(form.org_tier as string) ? parseFloat(form.sales_partner_rate) || 1 : null,
            service_dealer_rate: COMMISSION_TIERS.has(form.org_tier as string) ? parseFloat(form.service_dealer_rate) || 3 : null,
            commission_notes:    form.commission_notes || null,
          }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'Failed to create draft')
        set('draft_org_id', json.org_id)
        setStep(3)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setCreatingDraft(false)
      }
      return
    }
    // Step 4 → skip commission for non-commission tiers → step 6
    if (step === 4 && !COMMISSION_TIERS.has(form.org_tier as string)) {
      setStep(6); return
    }
    setStep(s => s + 1)
  }

  const retreat = () => {
    if (step === 6 && !COMMISSION_TIERS.has(form.org_tier as string)) {
      setStep(4); return
    }
    setStep(s => Math.max(1, s - 1))
  }

  /* ── NDA send ── */
  const sendNda = async () => {
    if (!form.draft_org_id || !form.org_email.trim()) return
    setSendingNda(true)
    // Use edited text if preview was opened, otherwise generate fresh
    const docText = ndaText || buildNdaText(ndaEffectiveDate)
    try {
      const res = await fetch('/api/signatures/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_type:  'nda',
          org_id:         form.draft_org_id,
          signer_name:    form.org_name,
          signer_email:   form.org_email.trim(),
          signer_company: form.org_name,
          document_html:  docText,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to send NDA')
      setForm(f => ({ ...f, nda_sent: true, nda_sig_id: json.signature_id ?? '', nda_status: 'pending' }))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSendingNda(false)
    }
  }

  /* ── Agreement send ── */
  const sendAgreement = async () => {
    if (!form.draft_org_id || !form.org_email.trim()) return
    setSendingAgreement(true)
    const docType = TIER_DOC_TYPES[form.org_tier as string] ?? 'dealer_agreement'
    const docText = agrText || buildAgreementText(agrEffectiveDate)
    try {
      const res = await fetch('/api/signatures/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_type:  docType,
          org_id:         form.draft_org_id,
          signer_name:    form.org_name,
          signer_email:   form.org_email.trim(),
          signer_company: form.org_name,
          document_html:  docText,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to send agreement')
      setForm(f => ({ ...f, agreement_sent: true, agreement_sig_id: json.signature_id ?? '', agreement_status: 'pending' }))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSendingAgreement(false)
    }
  }

  /* ── Refresh signing status (NDA or Agreement) ── */
  const refreshSigningStatus = async (which: 'nda' | 'agreement') => {
    if (!form.draft_org_id) return
    if (which === 'nda') setRefreshingNda(true); else setRefreshingAgreement(true)
    try {
      const res  = await fetch(`/api/signatures/by-record?org_id=${form.draft_org_id}`)
      const data = await res.json()
      const sigs: any[] = data.signatures ?? []
      const docType = which === 'nda' ? 'nda'
        : (TIER_DOC_TYPES[form.org_tier as string] ?? 'dealer_agreement')

      const altTypes = which === 'agreement'
        ? ['dealer_agreement','service_agreement','install_partner_agreement','sales_partner_agreement','master_agent_agreement']
        : ['nda']

      const latest = sigs
        .filter(s => altTypes.includes(s.document_type))
        .sort((a, b) => new Date(b.expires_at).getTime() - new Date(a.expires_at).getTime())[0]

      if (!latest) return
      if (which === 'nda') {
        setForm(f => ({
          ...f,
          nda_sig_id: latest.id,
          nda_status: latest.status as SignStatus,
          nda_signed_name: latest.signed_name ?? '',
        }))
      } else {
        setForm(f => ({
          ...f,
          agreement_sig_id: latest.id,
          agreement_status: latest.status as SignStatus,
          agreement_signed_name: latest.signed_name ?? '',
        }))
      }
    } catch (_) {}
    finally {
      if (which === 'nda') setRefreshingNda(false); else setRefreshingAgreement(false)
    }
  }

  /* ── Countersign ── */
  const countersign = async (which: 'nda' | 'agreement') => {
    const sigId = which === 'nda' ? form.nda_sig_id : form.agreement_sig_id
    if (!sigId) return
    if (which === 'nda') setCountersigningNda(true); else setCountersigningAgreement(true)
    try {
      await fetch('/api/signatures/countersign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature_id: sigId, countersigned_name: 'Russel Feldman', countersigned_title: 'CEO' }),
      })
      if (which === 'nda') {
        setForm(f => ({ ...f, nda_status: 'fully_executed' }))
      } else {
        setForm(f => ({ ...f, agreement_status: 'fully_executed' }))
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      if (which === 'nda') setCountersigningNda(false); else setCountersigningAgreement(false)
    }
  }

  /* ── Tech user helpers ── */
  const addTech = () => {
    const newTech: TechUser = { _id: crypto.randomUUID(), first_name: '', last_name: '', email: '', phone: '' }
    setForm(f => ({ ...f, technicians: [...f.technicians, newTech] }))
  }
  const updateTech = (id: string, field: keyof TechUser, val: string) => {
    setForm(f => ({ ...f, technicians: f.technicians.map(t => t._id === id ? { ...t, [field]: val } : t) }))
  }
  const removeTech = (id: string) => {
    setForm(f => ({ ...f, technicians: f.technicians.filter(t => t._id !== id) }))
  }

  /* ── Canadvance ── */
  const canAdvance = (): boolean => {
    if (step === 1) return !!form.org_tier
    if (step === 2) return !!form.org_name.trim() && !!form.org_email.trim()
    if (step === 3) return form.nda_status === 'fully_executed'
    if (step === 4) return true
    if (step === 5) return commissionPoolError(form) === null
    if (step === 6) return form.agreement_status === 'fully_executed'
    if (step === 7) return !!(form.admin_first_name.trim() && form.admin_last_name.trim() && form.admin_email.includes('@'))
    if (step === 8) return form.bg_ack
    return true
  }

  /* ── Final activation (step 9 → approve) ── */
  const handleActivate = async () => {
    setActivating(true)
    setError(null)
    try {
      const portalUsers = [{
        first_name: form.admin_first_name.trim(),
        last_name:  form.admin_last_name.trim(),
        email:      form.admin_email.trim(),
        role:       form.admin_role,
      }]
      const techPayload = form.technicians.filter(t => t.first_name.trim() && t.last_name.trim()).map(t => ({
        first_name: t.first_name.trim(),
        last_name:  t.last_name.trim(),
        email:      t.email || undefined,
        phone:      t.phone || undefined,
      }))
      const res = await fetch('/api/admin/activate-dealer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id:       form.draft_org_id,
          portal_users: portalUsers,
          technicians:  techPayload,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Activation failed')
      setResult(json)
      setStep(10)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActivating(false)
    }
  }

  const selectedTier = TIERS.find(t => t.id === form.org_tier)
  const access = form.org_tier ? TIER_ACCESS[form.org_tier as string] : null

  /* ── Resume loading screen ── */
  if (resumeLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC' }}>
        <div className="text-center">
          <Loader2 size={32} className="animate-spin text-brand-400 mx-auto mb-3" />
          <p className="text-sm text-slate-500">Loading dealer record…</p>
        </div>
      </div>
    )
  }

  /* ── Success screen (step 10) ── */
  if (step === 10 && result) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Dealer is Live!</h2>
          <p className="text-slate-500 mb-6">{result.message}</p>

          <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 text-left mb-6 space-y-2.5">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Organization</span>
              <span className="font-semibold text-slate-900">{form.org_name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Tier</span>
              <span className="font-medium text-slate-700">{selectedTier?.label}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Admin</span>
              <span className="font-medium text-slate-700">{form.admin_email}</span>
            </div>
            {result.invite_statuses?.map((s: any) => (
              <div key={s.email} className="flex justify-between text-sm">
                <span className="text-slate-500 truncate max-w-[50%]">{s.email}</span>
                <span className={`font-medium text-xs ${s.status === 'invited' ? 'text-brand-400' : s.status === 'existing_user_updated' ? 'text-emerald-600' : 'text-red-500'}`}>
                  {s.status === 'invited' ? '✉ Invite sent' : s.status === 'existing_user_updated' ? '✓ Updated' : `⚠ ${s.status}`}
                </span>
              </div>
            ))}
            {result.tech_ids?.length > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Technicians</span>
                <span className="font-medium text-emerald-600">{result.tech_ids.length} created</span>
              </div>
            )}
            <div className="flex justify-between text-sm items-center">
              <span className="text-slate-500">Org ID</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-slate-400">{form.draft_org_id.slice(0,8)}…</span>
                <button onClick={() => navigator.clipboard.writeText(form.draft_org_id)} className="text-slate-400 hover:text-brand-400">
                  <Copy size={13} />
                </button>
              </div>
            </div>
          </div>

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
      <div className="mb-6">
        <Link href="/admin/dealers" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-400 mb-4 transition-colors">
          <ChevronLeft size={16} /> Back to Dealers
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Users size={24} className="text-brand-400" />
          Set Up New Dealer
        </h1>
        <p className="text-sm text-slate-500 mt-1">9-step verified onboarding — NDA + Agreement required before logins go live.</p>
      </div>

      <StepBar current={step} />

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {/* ── Step 1: Dealer type + access matrix ───────────────────────── */}
      {step === 1 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-1">What type of dealer is this?</h2>
          <p className="text-sm text-slate-500 mb-6">This determines their org hierarchy position and what they can see and do in the portal.</p>

          <div className="space-y-3 mb-6">
            {TIERS.map(tier => (
              <button
                key={tier.id}
                onClick={() => set('org_tier', tier.id)}
                className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
                  form.org_tier === tier.id
                    ? `${tier.border} ${tier.bg}`
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                } ${tier.flagship ? 'ring-1 ring-indigo-200' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${form.org_tier === tier.id ? tier.bg : 'bg-slate-100'}`}>
                    <tier.icon size={18} className={form.org_tier === tier.id ? tier.color : 'text-slate-400'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-semibold text-sm ${form.org_tier === tier.id ? tier.color : 'text-slate-800'}`}>{tier.label}</span>
                      {tier.flagship && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-600">FLAGSHIP</span>}
                      <span className="text-xs text-slate-400">{tier.sublabel}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{tier.who}</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 shrink-0 mt-0.5 transition-all ${form.org_tier === tier.id ? 'border-brand-400 bg-brand-400' : 'border-slate-300'}`}>
                    {form.org_tier === tier.id && <div className="w-full h-full flex items-center justify-center"><div className="w-2 h-2 bg-white rounded-full" /></div>}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Portal access matrix — shown when tier is selected */}
          {access && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Portal Access for {selectedTier?.label}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {access.can.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-2">Full Access</p>
                    <ul className="space-y-1">
                      {access.can.map(item => (
                        <li key={item} className="flex items-center gap-1.5 text-xs text-slate-700">
                          <CheckCircle2 size={11} className="text-emerald-500 shrink-0" /> {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {access.limited.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-2">Limited</p>
                    <ul className="space-y-1">
                      {access.limited.map(item => (
                        <li key={item} className="flex items-center gap-1.5 text-xs text-slate-700">
                          <Info size={11} className="text-amber-500 shrink-0" /> {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {access.cannot.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">No Access</p>
                    <ul className="space-y-1">
                      {access.cannot.map(item => (
                        <li key={item} className="flex items-center gap-1.5 text-xs text-slate-400">
                          <X size={11} className="shrink-0" /> {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <p className="text-[10px] text-slate-400 mt-4 border-t border-slate-200 pt-3">
                Fine-grained permissions are set per user from Admin → Platform Users after the dealer is activated.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Step 2: Org info ──────────────────────────────────────────── */}
      {step === 2 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-1">Organization Details</h2>
          <p className="text-sm text-slate-500 mb-6">
            Basic info for <span className="font-medium text-slate-700">{selectedTier?.label}</span>. The org will be created as a draft — the NDA goes out next.
          </p>
          <div className="space-y-5">
            <Field label="Company Legal Name" required hint="Full legal name as it appears on your business registration">
              <Input value={form.org_name} onChange={e => set('org_name', e.target.value)} placeholder="Sunshine Gate Services LLC" autoFocus />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Entity Type" required hint="Used in legal agreements">
                <select value={form.entity_type} onChange={e => set('entity_type', e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white">
                  {ENTITY_TYPES.map(et => <option key={et} value={et}>{et.charAt(0).toUpperCase() + et.slice(1)}</option>)}
                </select>
              </Field>
              <Field label="License Number">
                <Input value={form.license_number} onChange={e => set('license_number', e.target.value)} placeholder="GA-EL-12345" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Org Email" required hint="NDA signing link will be sent here">
                <Input type="email" value={form.org_email} onChange={e => set('org_email', e.target.value)} placeholder="info@dealer.com" />
              </Field>
              <Field label="Phone">
                <Input value={form.org_phone} onChange={e => set('org_phone', e.target.value)} placeholder="(404) 555-0100" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Website">
                <Input value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://sunshinegate.com" />
              </Field>
              <Field label="# of Technicians">
                <Input type="number" value={form.tech_count} onChange={e => set('tech_count', e.target.value)} placeholder="4" />
              </Field>
            </div>
            <Field label="Service Area States" hint="Click to select all states this dealer operates in">
              <div className="flex flex-wrap gap-1.5 mt-1">
                {US_STATES.map(s => (
                  <button key={s} type="button" onClick={() => toggleState(s)}
                    className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                      form.service_area_states.includes(s) ? 'bg-brand-400 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}>
                    {s}
                  </button>
                ))}
              </div>
            </Field>
            <div className="border-t border-slate-100 pt-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Address (optional)</p>
              <div className="space-y-3">
                <Input value={form.address} onChange={e => set('address', e.target.value)} placeholder="Street address" />
                <div className="grid grid-cols-6 gap-3">
                  <div className="col-span-3"><Input value={form.city} onChange={e => set('city', e.target.value)} placeholder="City" /></div>
                  <div className="col-span-1"><Input value={form.state} onChange={e => set('state', e.target.value)} placeholder="GA" maxLength={2} /></div>
                  <div className="col-span-2"><Input value={form.zip} onChange={e => set('zip', e.target.value)} placeholder="ZIP" /></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 3: NDA signing ───────────────────────────────────────── */}
      {step === 3 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-1">Non-Disclosure Agreement</h2>
          <p className="text-sm text-slate-500 mb-4">
            Review, edit, then send the Mutual NDA to{' '}
            <span className="font-medium text-slate-700">{form.org_email || '(no email)'}</span> for signature.
          </p>

          {!form.org_email.trim() && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 flex items-start gap-2">
              <AlertCircle size={15} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700">No org email set — go back to Step 2 and enter a contact email.</p>
            </div>
          )}

          {/* Effective date + preview toggle */}
          {!form.nda_sent && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Document Settings</p>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-xs text-slate-500 mb-1">Effective Date</label>
                  <input
                    type="text"
                    value={ndaEffectiveDate}
                    onChange={e => {
                      setNdaEffectiveDate(e.target.value)
                      if (ndaPreviewOpen) setNdaText(buildNdaText(e.target.value))
                    }}
                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400"
                    placeholder="e.g. May 27, 2026"
                  />
                </div>
                <button
                  onClick={() => {
                    if (!ndaPreviewOpen) setNdaText(buildNdaText(ndaEffectiveDate))
                    setNdaPreviewOpen(v => !v)
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-sm font-medium text-slate-600 transition-colors mt-4"
                >
                  {ndaPreviewOpen ? <EyeOff size={14} /> : <Eye size={14} />}
                  {ndaPreviewOpen ? 'Hide' : 'Preview & Edit'}
                </button>
              </div>

              {/* Editable NDA body */}
              {ndaPreviewOpen && (
                <div className="mt-2">
                  <p className="text-xs text-slate-400 mb-1.5">
                    Edit the document below before sending. Changes are saved locally and sent with the document.
                  </p>
                  <textarea
                    value={ndaText}
                    onChange={e => setNdaText(e.target.value)}
                    rows={22}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-xs font-mono leading-relaxed focus:outline-none focus:ring-1 focus:ring-brand-400 text-slate-700 bg-slate-50 resize-y"
                    spellCheck={false}
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    {ndaText.length} characters · The signer will see this exact text on their signing page.
                  </p>
                </div>
              )}
            </div>
          )}

          <SigningPanel
            docType="nda"
            orgId={form.draft_org_id}
            label="Mutual Non-Disclosure Agreement"
            sent={form.nda_sent}
            sigId={form.nda_sig_id}
            status={form.nda_status}
            signedName={form.nda_signed_name}
            onSend={sendNda}
            onRefresh={() => void refreshSigningStatus('nda')}
            onCountersign={() => void countersign('nda')}
            sending={sendingNda}
            refreshing={refreshingNda}
            countersigning={countersigningNda}
          />

          {form.nda_status !== 'fully_executed' && (
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-2 text-sm text-blue-700">
              <Info size={15} className="mt-0.5 shrink-0" />
              <span>Step 4 (Relationships) unlocks once both parties have signed. Use Check Status after the dealer signs.</span>
            </div>
          )}
        </div>
      )}

      {/* ── Step 4: Relationships ─────────────────────────────────────── */}
      {step === 4 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-1">Org Relationships</h2>
          <p className="text-sm text-slate-500 mb-5">
            Map this org to its Master Agent and MSO. The parent sees the child in their network view, and the child sees the parent.
            All fields optional — assignable from the org detail page later.
          </p>

          {form.org_tier === 'master_agent' ? (
            <div className="bg-violet-50 border border-violet-200 rounded-xl p-5 flex items-center gap-3 mb-4">
              <Building2 size={20} className="text-violet-500 shrink-0" />
              <div>
                <p className="font-semibold text-violet-800 text-sm">GateGuard Corporate</p>
                <p className="text-xs text-violet-600">Master Agents report directly to GateGuard. No parent org needed.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Master Agent (recruiter)</p>
                <p className="text-xs text-slate-400 mb-3">The Master Agent who recruited this dealer. Earns $0.50/unit/month.</p>
                <OrgSearchPicker
                  value={form.master_agent_id} displayName={form.master_agent_name || (form.master_agent_id ? `MA (${form.master_agent_id.slice(0,8)}…)` : '')}
                  onChange={(id, name) => { set('master_agent_id', id); set('master_agent_name', name) }}
                  onClear={() => { set('master_agent_id', ''); set('master_agent_name', '') }}
                  placeholder="Search for Master Agent org…" tiers={['master_agent']}
                />
              </div>
              {form.org_tier !== 'master_dealer' && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">MSO (group owner)</p>
                  <p className="text-xs text-slate-400 mb-3">The MSO this org operates under. Earns $0.50/unit/month.</p>
                  <OrgSearchPicker
                    value={form.master_dealer_id} displayName={form.master_dealer_name || (form.master_dealer_id ? `MSO (${form.master_dealer_id.slice(0,8)}…)` : '')}
                    onChange={(id, name) => { set('master_dealer_id', id); set('master_dealer_name', name) }}
                    onClear={() => { set('master_dealer_id', ''); set('master_dealer_name', '') }}
                    placeholder="Search for MSO org…" tiers={['master_dealer']}
                  />
                </div>
              )}
              {(['service_dealer','install_contractor','sales_partner'] as OrgTier[]).includes(form.org_tier as OrgTier) && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Full Dealership (direct parent)</p>
                  <p className="text-xs text-slate-400 mb-3">The Full Dealership this org reports to, if any.</p>
                  <OrgSearchPicker
                    value={form.parent_org_id} displayName={form.parent_org_name || (form.parent_org_id ? `Dealer (${form.parent_org_id.slice(0,8)}…)` : '')}
                    onChange={(id, name) => { set('parent_org_id', id); set('parent_org_name', name) }}
                    onClear={() => { set('parent_org_id', ''); set('parent_org_name', '') }}
                    placeholder="Search for Full Dealer org…" tiers={['full_dealer']}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Step 5: Commission ────────────────────────────────────────── */}
      {step === 5 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-1">Commission Configuration</h2>
          <p className="text-sm text-slate-500 mb-5">Set the default rates for this {selectedTier?.label}. Rates per unit per month across their network.</p>

          {/* Revenue breakdown visual */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">$10.00 / unit / month breakdown</p>
            <div className="space-y-2.5">
              <div className="flex items-center gap-3">
                <div className="w-28 text-xs text-slate-500 shrink-0">Property pays</div>
                <div className="flex-1 h-6 bg-slate-200 rounded-md flex items-center px-2">
                  <span className="text-xs font-semibold text-slate-600">$10.00 / unit</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-28 text-xs text-slate-500 shrink-0">GateGuard keeps</div>
                <div className="flex-1 h-6 bg-brand-50 border border-brand-200 rounded-md flex items-center px-2">
                  <span className="text-xs font-semibold text-brand-400">$5.00 gross margin</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-28 text-xs text-slate-500 shrink-0">Dealer pool</div>
                <div className="flex-1 grid grid-cols-4 gap-1">
                  <div className="h-6 bg-violet-100 rounded flex items-center justify-center text-[10px] font-semibold text-violet-700">$0.50 MA</div>
                  <div className="h-6 bg-brand-50 border border-brand-200 rounded flex items-center justify-center text-[10px] font-semibold text-brand-400">$0.50 MD</div>
                  <div className="h-6 bg-sky-100 rounded flex items-center justify-center text-[10px] font-semibold text-sky-700">
                    ${parseFloat(form.sales_partner_rate || '1').toFixed(2)} SP
                  </div>
                  <div className="h-6 bg-emerald-100 rounded flex items-center justify-center text-[10px] font-semibold text-emerald-700">
                    ${parseFloat(form.service_dealer_rate || '3').toFixed(2)} SD
                  </div>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-3">MA = Master Agent · MD = MSO · SP = Sales Partner · SD = Service Dealer</p>
          </div>

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

          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
            <div>
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Configurable Pool — $4.00 total</p>
              <p className="text-xs text-slate-400">SP + SD rates must sum to $4.00 or less.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Sales Partner Rate ($/unit/mo)" required>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                  <input type="number" step="0.01" min="0" max="4" value={form.sales_partner_rate}
                    onChange={e => set('sales_partner_rate', e.target.value)}
                    className="w-full border border-slate-300 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
              </Field>
              <Field label="Service Dealer Rate ($/unit/mo)" required>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                  <input type="number" step="0.01" min="0" max="4" value={form.service_dealer_rate}
                    onChange={e => set('service_dealer_rate', e.target.value)}
                    className="w-full border border-slate-300 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
              </Field>
            </div>
            {(() => {
              const poolErr  = commissionPoolError(form)
              const total    = (parseFloat(form.sales_partner_rate) || 0) + (parseFloat(form.service_dealer_rate) || 0)
              const remaining = 4.00 - total
              return (
                <div className={`rounded-lg px-4 py-3 flex items-center justify-between text-sm ${poolErr ? 'bg-red-50 border border-red-200' : 'bg-emerald-50 border border-emerald-200'}`}>
                  <span className={poolErr ? 'text-red-700' : 'text-emerald-700'}>
                    {poolErr ? poolErr : `Pool used: $${total.toFixed(2)} of $4.00`}
                  </span>
                  {!poolErr && remaining > 0 && (
                    <span className="text-emerald-600 font-semibold text-xs">${remaining.toFixed(2)} stays with {selectedTier?.label ?? 'dealership'}</span>
                  )}
                </div>
              )
            })()}
            <Field label="Notes (optional)" hint="E.g. 'Negotiated rate — Atlanta market launch'">
              <textarea value={form.commission_notes} onChange={e => set('commission_notes', e.target.value)}
                rows={2} placeholder="Any notes about this commission arrangement…"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none" />
            </Field>
          </div>
        </div>
      )}

      {/* ── Step 6: Agreement signing ─────────────────────────────────── */}
      {step === 6 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-1">Authorized Dealer Agreement</h2>
          <p className="text-sm text-slate-500 mb-4">
            Review, edit, then send the{' '}
            {DOC_LABELS[TIER_DOC_TYPES[form.org_tier as string] ?? 'dealer_agreement']} to{' '}
            <span className="font-medium text-slate-700">{form.org_email || '(no email)'}</span> for signature.
          </p>

          {/* Effective date + preview toggle */}
          {!form.agreement_sent && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Document Settings</p>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-xs text-slate-500 mb-1">Effective Date</label>
                  <input
                    type="text"
                    value={agrEffectiveDate}
                    onChange={e => {
                      setAgrEffectiveDate(e.target.value)
                      if (agrPreviewOpen) setAgrText(buildAgreementText(e.target.value))
                    }}
                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400"
                    placeholder="e.g. May 27, 2026"
                  />
                </div>
                <button
                  onClick={() => {
                    if (!agrPreviewOpen) setAgrText(buildAgreementText(agrEffectiveDate))
                    setAgrPreviewOpen(v => !v)
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-sm font-medium text-slate-600 transition-colors mt-4"
                >
                  {agrPreviewOpen ? <EyeOff size={14} /> : <Eye size={14} />}
                  {agrPreviewOpen ? 'Hide' : 'Preview & Edit'}
                </button>
              </div>

              {/* Editable Agreement body */}
              {agrPreviewOpen && (
                <div className="mt-2">
                  <p className="text-xs text-slate-400 mb-1.5">
                    Edit the agreement below before sending. The signer will see this exact text.
                  </p>
                  <textarea
                    value={agrText}
                    onChange={e => setAgrText(e.target.value)}
                    rows={28}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-xs font-mono leading-relaxed focus:outline-none focus:ring-1 focus:ring-brand-400 text-slate-700 bg-slate-50 resize-y"
                    spellCheck={false}
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    {agrText.length} characters · Includes Exhibit A — Tier &amp; Commission Addendum
                  </p>
                </div>
              )}
            </div>
          )}

          <SigningPanel
            docType={TIER_DOC_TYPES[form.org_tier as string] ?? 'dealer_agreement'}
            orgId={form.draft_org_id}
            label={DOC_LABELS[TIER_DOC_TYPES[form.org_tier as string] ?? 'dealer_agreement']}
            sent={form.agreement_sent}
            sigId={form.agreement_sig_id}
            status={form.agreement_status}
            signedName={form.agreement_signed_name}
            onSend={sendAgreement}
            onRefresh={() => void refreshSigningStatus('agreement')}
            onCountersign={() => void countersign('agreement')}
            sending={sendingAgreement}
            refreshing={refreshingAgreement}
            countersigning={countersigningAgreement}
          />

          {form.agreement_status !== 'fully_executed' && (
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-2 text-sm text-blue-700">
              <Info size={15} className="mt-0.5 shrink-0" />
              <span>Step 7 (Users) unlocks once the agreement is fully executed.</span>
            </div>
          )}
        </div>
      )}

      {/* ── Step 7: Users ─────────────────────────────────────────────── */}
      {step === 7 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-1">Users</h2>
          <p className="text-sm text-slate-500 mb-6">
            Set up the primary admin and any technicians. Portal invites go out when you approve the dealer in step 9.
          </p>

          {/* Primary admin */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 mb-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Primary Admin User</p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="First Name" required>
                  <Input value={form.admin_first_name} onChange={e => set('admin_first_name', e.target.value)} placeholder="Jamie" autoFocus />
                </Field>
                <Field label="Last Name" required>
                  <Input value={form.admin_last_name} onChange={e => set('admin_last_name', e.target.value)} placeholder="Rodriguez" />
                </Field>
              </div>
              <Field label="Email Address" required hint="Portal invite will be sent here at step 9">
                <Input type="email" value={form.admin_email} onChange={e => set('admin_email', e.target.value)} placeholder="jamie@sunshinegate.com" />
              </Field>
              <Field label="Portal Role">
                <div className="space-y-2 mt-1">
                  {ROLE_OPTIONS.map(r => (
                    <button key={r.id} type="button" onClick={() => set('admin_role', r.id)}
                      className={`w-full text-left rounded-lg border px-4 py-2.5 text-sm transition-all ${form.admin_role === r.id ? 'border-brand-400 bg-brand-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className={`font-semibold ${form.admin_role === r.id ? 'text-brand-400' : 'text-slate-800'}`}>{r.label}</span>
                          <span className="text-xs text-slate-500 ml-2">{r.desc}</span>
                        </div>
                        <div className={`w-4 h-4 rounded-full border-2 shrink-0 ${form.admin_role === r.id ? 'border-brand-400 bg-brand-400' : 'border-slate-300'}`}>
                          {form.admin_role === r.id && <div className="w-full h-full flex items-center justify-center"><div className="w-1.5 h-1.5 bg-white rounded-full" /></div>}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          </div>

          {/* Technicians */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Technicians</p>
                <p className="text-xs text-slate-400 mt-0.5">Added to the technicians roster with auto-generated /tech access codes.</p>
              </div>
              <button onClick={addTech}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-400 text-white text-xs font-semibold rounded-lg hover:bg-brand-500">
                <Plus size={12} /> Add Tech
              </button>
            </div>
            {form.technicians.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-sm border border-dashed border-slate-200 rounded-lg">
                No technicians added — they can be added from Dispatch after activation.
              </div>
            ) : (
              <div className="space-y-3">
                {form.technicians.map((tech, i) => (
                  <div key={tech._id} className="bg-slate-50 rounded-xl p-4 relative">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-slate-500">Technician {i + 1}</span>
                      <button onClick={() => removeTech(tech._id)} className="text-slate-300 hover:text-red-400 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="First Name" required>
                        <Input value={tech.first_name} onChange={e => updateTech(tech._id, 'first_name', e.target.value)} placeholder="Alex" />
                      </Field>
                      <Field label="Last Name" required>
                        <Input value={tech.last_name} onChange={e => updateTech(tech._id, 'last_name', e.target.value)} placeholder="Smith" />
                      </Field>
                      <Field label="Email (optional)">
                        <Input type="email" value={tech.email} onChange={e => updateTech(tech._id, 'email', e.target.value)} placeholder="alex@dealer.com" />
                      </Field>
                      <Field label="Phone (optional)">
                        <Input value={tech.phone} onChange={e => updateTech(tech._id, 'phone', e.target.value)} placeholder="(404) 555-0200" />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Step 8: Compliance uploads ────────────────────────────────── */}
      {step === 8 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-1">Compliance Documents</h2>
          <p className="text-sm text-slate-500 mb-6">
            Collect the required documents before activating the dealer. At minimum, the background check acknowledgment is required.
            Uploads can be finalized from the dealer's Compliance tab after activation.
          </p>

          <div className="space-y-4">
            {/* Certificate of Insurance */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Shield size={15} className="text-indigo-500 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Certificate of Insurance</p>
                    <p className="text-xs text-slate-400">COI naming Gate Guard, LLC as additional insured</p>
                  </div>
                </div>
                <StatusPill status={form.coi_status} />
              </div>
              <div className="space-y-3">
                <div className="flex gap-3">
                  {(['missing','pending','on_file'] as DocStatus[]).map(s => (
                    <button key={s} onClick={() => set('coi_status', s)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${form.coi_status === s ? docStatusActive(s) : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                      {s === 'missing' ? 'Missing' : s === 'pending' ? 'Pending Review' : 'On File'}
                    </button>
                  ))}
                </div>
                {form.coi_status !== 'missing' && (
                  <div className="grid grid-cols-2 gap-3">
                    <Input value={form.coi_url} onChange={e => set('coi_url', e.target.value)} placeholder="https://drive.google.com/…" />
                    <Input type="date" value={form.coi_expires_at} onChange={e => set('coi_expires_at', e.target.value)}
                      className="text-sm text-slate-600" />
                  </div>
                )}
              </div>
            </div>

            {/* W-9 */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileText size={15} className="text-emerald-500 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">W-9 Form</p>
                    <p className="text-xs text-slate-400">IRS W-9 — required for commission payments</p>
                  </div>
                </div>
                <StatusPill status={form.w9_status} />
              </div>
              <div className="space-y-3">
                <div className="flex gap-3">
                  {(['missing','pending','on_file'] as DocStatus[]).map(s => (
                    <button key={s} onClick={() => set('w9_status', s)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${form.w9_status === s ? docStatusActive(s) : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                      {s === 'missing' ? 'Missing' : s === 'pending' ? 'Pending Review' : 'On File'}
                    </button>
                  ))}
                </div>
                {form.w9_status !== 'missing' && (
                  <Input value={form.w9_url} onChange={e => set('w9_url', e.target.value)} placeholder="https://drive.google.com/…" />
                )}
              </div>
            </div>

            {/* State License */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Hash size={15} className="text-amber-500 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">State License Copy</p>
                    <p className="text-xs text-slate-400">Low-voltage / electrical contractor license</p>
                  </div>
                </div>
                <StatusPill status={form.license_status} />
              </div>
              <div className="space-y-3">
                <div className="flex gap-3">
                  {(['missing','pending','on_file'] as DocStatus[]).map(s => (
                    <button key={s} onClick={() => set('license_status', s)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${form.license_status === s ? docStatusActive(s) : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                      {s === 'missing' ? 'Missing' : s === 'pending' ? 'Pending Review' : 'On File'}
                    </button>
                  ))}
                </div>
                {form.license_status !== 'missing' && (
                  <div className="grid grid-cols-2 gap-3">
                    <Input value={form.license_url} onChange={e => set('license_url', e.target.value)} placeholder="https://drive.google.com/…" />
                    <Input type="date" value={form.license_expires_at} onChange={e => set('license_expires_at', e.target.value)} />
                  </div>
                )}
              </div>
            </div>

            {/* Background Check Ack */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={form.bg_ack} onChange={e => set('bg_ack', e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-brand-400 focus:ring-brand-400" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">Background Check Acknowledgment <span className="text-red-500">*</span></p>
                  <p className="text-xs text-slate-500 mt-1">
                    I confirm that all technicians on this account have passed a background check and that copies are on file. Gate Guard reserves the right to require proof of background checks at any time.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {!form.bg_ack && (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2 text-sm text-amber-700">
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              <span>Background check acknowledgment required to proceed to activation.</span>
            </div>
          )}
        </div>
      )}

      {/* ── Step 9: Review & Activate ─────────────────────────────────── */}
      {step === 9 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-1">Review &amp; Activate</h2>
          <p className="text-sm text-slate-500 mb-6">
            Confirm everything is correct. Clicking Activate will make the org live, send all portal invites, and create technician records.
          </p>

          <div className="space-y-4">
            {selectedTier && (
              <ReviewCard icon={selectedTier.icon} color={selectedTier.color} bg={selectedTier.bg} title="Dealer Type">
                <p className="font-semibold text-slate-900">{selectedTier.label}</p>
                <p className="text-xs text-slate-500">{selectedTier.sublabel}</p>
              </ReviewCard>
            )}
            <ReviewCard icon={Building2} color="text-slate-600" bg="bg-slate-100" title="Organization">
              <p className="font-semibold text-slate-900">{form.org_name}</p>
              {form.license_number && <p className="text-xs text-slate-500">License: {form.license_number}</p>}
              {form.service_area_states.length > 0 && <p className="text-xs text-slate-500">States: {form.service_area_states.join(', ')}</p>}
              {form.org_email && <p className="text-xs text-slate-500">{form.org_email}</p>}
            </ReviewCard>
            <ReviewCard icon={Layers} color="text-slate-500" bg="bg-slate-100" title="Relationships">
              {form.org_tier === 'master_agent' ? (
                <p className="font-semibold text-slate-900">GateGuard Corporate (direct)</p>
              ) : (
                <div className="space-y-1">
                  {form.master_agent_name ? <p className="text-xs text-slate-600">MA: {form.master_agent_name}</p> : <p className="text-xs text-slate-400 italic">Master Agent: not set</p>}
                  {form.master_dealer_name ? <p className="text-xs text-slate-600">MSO: {form.master_dealer_name}</p> : <p className="text-xs text-slate-400 italic">MSO: not set</p>}
                  {form.parent_org_name && <p className="text-xs text-slate-600">Parent: {form.parent_org_name}</p>}
                </div>
              )}
            </ReviewCard>
            {COMMISSION_TIERS.has(form.org_tier as string) && (
              <ReviewCard icon={DollarSign} color="text-emerald-600" bg="bg-emerald-50" title="Commission Config">
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                  <p className="text-xs text-slate-500">MA: <span className="font-semibold text-slate-700">$0.50</span> (locked)</p>
                  <p className="text-xs text-slate-500">MSO: <span className="font-semibold text-slate-700">$0.50</span> (locked)</p>
                  <p className="text-xs text-slate-500">SP: <span className="font-semibold text-slate-700">${parseFloat(form.sales_partner_rate || '1').toFixed(2)}</span></p>
                  <p className="text-xs text-slate-500">SD: <span className="font-semibold text-slate-700">${parseFloat(form.service_dealer_rate || '3').toFixed(2)}</span></p>
                </div>
              </ReviewCard>
            )}
            <ReviewCard icon={FileText} color="text-indigo-600" bg="bg-indigo-50" title="Legal Documents">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs">
                  <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                  <span className="font-medium text-emerald-700">NDA — Fully executed</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                  <span className="font-medium text-emerald-700">{DOC_LABELS[TIER_DOC_TYPES[form.org_tier as string] ?? 'dealer_agreement']} — Fully executed</span>
                </div>
              </div>
            </ReviewCard>
            <ReviewCard icon={Users} color="text-brand-400" bg="bg-brand-50" title="Users">
              <p className="font-semibold text-slate-900">{form.admin_first_name} {form.admin_last_name}</p>
              <p className="text-xs text-slate-500">{form.admin_email} · {ROLE_OPTIONS.find(r => r.id === form.admin_role)?.label}</p>
              {form.technicians.filter(t => t.first_name.trim()).length > 0 && (
                <p className="text-xs text-slate-500 mt-1">{form.technicians.filter(t => t.first_name.trim()).length} technician{form.technicians.filter(t => t.first_name.trim()).length !== 1 ? 's' : ''} to be created</p>
              )}
            </ReviewCard>
            <ReviewCard icon={ShieldCheck} color="text-emerald-600" bg="bg-emerald-50" title="Compliance">
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                <p className="text-xs"><span className={docStatusColor(form.coi_status)}>COI: {form.coi_status.replace('_', ' ')}</span></p>
                <p className="text-xs"><span className={docStatusColor(form.w9_status)}>W-9: {form.w9_status.replace('_', ' ')}</span></p>
                <p className="text-xs"><span className={docStatusColor(form.license_status)}>License: {form.license_status.replace('_', ' ')}</span></p>
                <p className="text-xs text-emerald-700 font-medium">Background check: ✓</p>
              </div>
            </ReviewCard>
          </div>

          {/* What happens */}
          <div className="mt-6 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-2">What happens when you click Activate</p>
            <ol className="space-y-1.5 text-xs text-emerald-800">
              <li className="flex items-start gap-2"><span className="font-bold shrink-0">1.</span> <span className="font-semibold">{form.org_name}</span> goes live (is_active = true) in GateGuard</li>
              <li className="flex items-start gap-2"><span className="font-bold shrink-0">2.</span> Portal invite sent to {form.admin_email}</li>
              {form.technicians.filter(t => t.first_name.trim()).length > 0 && (
                <li className="flex items-start gap-2"><span className="font-bold shrink-0">3.</span> {form.technicians.filter(t => t.first_name.trim()).length} technician record{form.technicians.filter(t => t.first_name.trim()).length !== 1 ? 's' : ''} created with /tech access codes</li>
              )}
              <li className="flex items-start gap-2"><span className="font-bold shrink-0">{form.technicians.filter(t => t.first_name.trim()).length > 0 ? '4' : '3'}.</span> Compliance documents saved to dealer's Compliance tab</li>
            </ol>
          </div>
        </div>
      )}

      {/* ── Nav buttons ───────────────────────────────────────────────── */}
      <div className="flex justify-between mt-8 pt-6 border-t border-slate-200">
        <button
          onClick={retreat}
          disabled={step === 1 || creatingDraft}
          className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={16} /> Back
        </button>

        {step < 9 ? (
          <button
            onClick={() => { void advance() }}
            disabled={!canAdvance() || creatingDraft}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-400 text-white rounded-lg text-sm font-medium hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {creatingDraft ? (
              <><Loader2 size={15} className="animate-spin" /> Creating draft…</>
            ) : (
              <>Continue <ChevronRight size={16} /></>
            )}
          </button>
        ) : (
          <button
            onClick={() => { void handleActivate() }}
            disabled={activating}
            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            {activating ? (
              <><Loader2 size={15} className="animate-spin" /> Activating…</>
            ) : (
              <><Zap size={16} /> Activate Dealer</>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

/* ─── Small helpers ──────────────────────────────────────── */
function StatusPill({ status }: { status: DocStatus }) {
  const map: Record<DocStatus, string> = {
    on_file: 'bg-emerald-100 text-emerald-700',
    pending: 'bg-amber-100 text-amber-700',
    missing: 'bg-slate-100 text-slate-500',
  }
  const labels: Record<DocStatus, string> = { on_file: 'On File', pending: 'Pending', missing: 'Missing' }
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${map[status]}`}>{labels[status]}</span>
}

function docStatusActive(s: DocStatus): string {
  if (s === 'on_file') return 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-400'
  if (s === 'pending') return 'bg-amber-100 text-amber-700 ring-1 ring-amber-400'
  return 'bg-slate-200 text-slate-600 ring-1 ring-slate-400'
}

function docStatusColor(s: DocStatus): string {
  if (s === 'on_file') return 'text-emerald-700 font-medium'
  if (s === 'pending') return 'text-amber-700'
  return 'text-slate-400'
}
