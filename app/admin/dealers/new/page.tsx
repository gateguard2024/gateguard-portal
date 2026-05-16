'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft, ChevronRight, Building2, Users, Shield,
  CheckCircle2, MapPin, Phone, Mail, Globe, Layers,
  Star, Wrench, TrendingUp, ClipboardList, Zap,
  AlertCircle, Copy, ExternalLink,
} from 'lucide-react'

/* ─── Types ──────────────────────────────────────────────── */
type OrgTier = 'master_agent' | 'master_dealer' | 'service_dealer' | 'install_dealer' | 'sales'
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
  // Step 3 — Parent org
  parent_org_id: string
  parent_org_name: string  // display only
  // Step 4 — Primary admin
  admin_first_name: string
  admin_last_name: string
  admin_email: string
  admin_role: PortalRole
  send_invite: boolean
}

const EMPTY: WizardState = {
  org_tier: '',
  org_name: '', license_number: '', service_area_states: [], tech_count: '',
  address: '', city: '', state: '', zip: '', org_phone: '', org_email: '', website: '',
  parent_org_id: '', parent_org_name: '',
  admin_first_name: '', admin_last_name: '', admin_email: '',
  admin_role: 'admin', send_invite: true,
}

/* ─── Tier config ────────────────────────────────────────── */
const TIERS: {
  id: OrgTier
  label: string
  sublabel: string
  icon: any
  color: string
  bg: string
  border: string
  who: string
}[] = [
  {
    id: 'master_agent',
    label: 'Master Agent',
    sublabel: 'Manages multiple Master Dealers',
    icon: Star,
    color: 'text-violet-600',
    bg: 'bg-violet-50',
    border: 'border-violet-300',
    who: 'Large dealer groups managing multiple territories. Sees all their master dealers\' data.',
  },
  {
    id: 'master_dealer',
    label: 'Master Dealer',
    sublabel: 'Account owner for properties',
    icon: Layers,
    color: 'text-brand-400',
    bg: 'bg-brand-50',
    border: 'border-brand-300',
    who: 'The billing entity for properties. May have install and service dealers under them.',
  },
  {
    id: 'service_dealer',
    label: 'Service Dealer',
    sublabel: 'Day-to-day property service',
    icon: Wrench,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-300',
    who: 'Primary ongoing relationship. Handles all work orders and maintenance for assigned properties.',
  },
  {
    id: 'install_dealer',
    label: 'Install Dealer',
    sublabel: 'Installs and commissions',
    icon: ClipboardList,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    who: 'Handles the initial install and commissioning. May not be the ongoing service dealer.',
  },
  {
    id: 'sales',
    label: 'Sales Dealer',
    sublabel: 'Sales and referrals only',
    icon: TrendingUp,
    color: 'text-sky-600',
    bg: 'bg-sky-50',
    border: 'border-sky-300',
    who: 'Brings in new business. Earns commissions. Does not handle service or installs.',
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
  { n: 3, label: 'Parent Org'    },
  { n: 4, label: 'Admin User'    },
  { n: 5, label: 'Review'        },
]

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
export default function NewDealerPage() {
  const router = useRouter()
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

  /* ── Validation per step ── */
  const canAdvance = (): boolean => {
    if (step === 1) return !!form.org_tier
    if (step === 2) return !!form.org_name.trim()
    if (step === 3) return true  // parent org is optional for master agents
    if (step === 4) return !!(form.admin_first_name.trim() && form.admin_last_name.trim() && form.admin_email.includes('@'))
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
        }),
      })
      const json = await res.json()
      if (!res.ok && res.status !== 207) throw new Error(json.error ?? 'Onboarding failed')
      setResult(json)
      setStep(6)  // success screen
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const selectedTier = TIERS.find(t => t.id === form.org_tier)

  /* ── Success screen ── */
  if (step === 6 && result) {
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
                onClick={() => set('org_tier', tier.id)}
                className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
                  form.org_tier === tier.id
                    ? `${tier.border} ${tier.bg}`
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    form.org_tier === tier.id ? tier.bg : 'bg-slate-100'
                  }`}>
                    <tier.icon size={18} className={form.org_tier === tier.id ? tier.color : 'text-slate-400'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold text-sm ${form.org_tier === tier.id ? tier.color : 'text-slate-800'}`}>
                        {tier.label}
                      </span>
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

      {/* ── Step 3: Parent org ───────────────────────────────────────── */}
      {step === 3 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-1">Parent Organization</h2>
          <p className="text-sm text-slate-500 mb-2">
            {form.org_tier === 'master_agent'
              ? 'Master agents sit directly under GateGuard Corporate. No parent org needed.'
              : form.org_tier === 'master_dealer'
              ? 'Which Master Agent does this Master Dealer sit under?'
              : 'Which Master Dealer owns this dealer relationship?'}
          </p>

          {form.org_tier === 'master_agent' ? (
            <div className="bg-violet-50 border border-violet-200 rounded-xl p-5 flex items-center gap-3">
              <Building2 size={20} className="text-violet-500 shrink-0" />
              <div>
                <p className="font-semibold text-violet-800 text-sm">GateGuard Corporate</p>
                <p className="text-xs text-violet-600">Master Agents report directly to GateGuard. No additional parent needed.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <p className="text-xs text-slate-500 mb-3">Enter the Supabase org ID of the parent organization, or leave blank to assign later from the org record.</p>
                <Field label="Parent Org ID" hint="UUID from the organizations table">
                  <Input
                    value={form.parent_org_id}
                    onChange={e => set('parent_org_id', e.target.value)}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    className="font-mono"
                  />
                </Field>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 flex items-start gap-2">
                <AlertCircle size={15} className="mt-0.5 shrink-0 text-amber-500" />
                <div>
                  <p className="font-semibold">Parent org picker coming soon</p>
                  <p className="text-xs mt-0.5">The searchable org picker is on the roadmap. For now, paste the parent org's UUID from the Dealers list page. You can also set this after onboarding from the org detail page.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Step 4: Primary admin user ──────────────────────────────── */}
      {step === 4 && (
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

      {/* ── Step 5: Review ───────────────────────────────────────────── */}
      {step === 5 && (
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

            {/* Parent */}
            <ReviewCard icon={ChevronRight} color="text-slate-500" bg="bg-slate-100" title="Parent Organization">
              {form.org_tier === 'master_agent' ? (
                <p className="font-semibold text-slate-900">GateGuard Corporate</p>
              ) : form.parent_org_id ? (
                <p className="font-mono text-xs text-slate-500">{form.parent_org_id}</p>
              ) : (
                <p className="text-slate-400 italic text-sm">Not set — assign after launch</p>
              )}
            </ReviewCard>

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
              <li className="flex items-start gap-2"><span className="font-bold shrink-0">2.</span> {form.send_invite ? `Sends a portal sign-up invite to ${form.admin_email}` : `Skips the invite — you'll set up access manually`}</li>
              <li className="flex items-start gap-2"><span className="font-bold shrink-0">3.</span> Wires their portal access so they only see {form.org_name}'s data from the moment they log in</li>
            </ol>
          </div>
        </div>
      )}

      {/* ── Nav buttons ──────────────────────────────────────────────── */}
      <div className="flex justify-between mt-8 pt-6 border-t border-slate-200">
        <button
          onClick={() => setStep(s => Math.max(1, s - 1))}
          disabled={step === 1}
          className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={16} /> Back
        </button>

        {step < 5 ? (
          <button
            onClick={() => setStep(s => s + 1)}
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
