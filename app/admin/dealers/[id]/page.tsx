'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft, Building2, Users, Wrench, Shield, Star,
  TrendingUp, ClipboardList, Layers, CheckCircle2, Clock,
  Mail, Phone, Globe, MapPin, FileText, Plus, Loader2,
  AlertTriangle, X, Upload, ExternalLink,
} from 'lucide-react'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { DollarSign, Calendar, Edit2, ToggleLeft, ToggleRight, Activity, Save } = require('lucide-react') as any

import { DataTable, type Column } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/EmptyState'
import { SlideOver, SlideOverFooter } from '@/components/ui/SlideOver'
import { TopBar } from '@/components/layout/TopBar'

/* ─── Types ──────────────────────────────────────────────── */
interface PartnerDoc {
  type: 'w9' | 'coi' | 'license' | 'nda' | 'agreement' | 'background_check' | 'sales_training_cert' | 'tech1_cert' | 'tech2_cert' | 'tech3_cert'
  label: string
  status: 'missing' | 'pending' | 'on_file' | 'expired'
  url?: string
  expires_at?: string
  uploaded_at?: string
  notes?: string
}

interface Org {
  id: string
  name: string
  org_tier: string
  tier_label: string | null
  parent_org_id: string | null
  is_active: boolean
  onboarded_at: string | null
  created_at: string
  license_number: string | null
  service_area_states: string[]
  tech_count: number
  email: string | null
  phone: string | null
  website: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  onboarding_complete: boolean | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  partner_docs: PartnerDoc[] | null
}

interface CommissionConfig {
  org_id: string
  master_agent_rate: number
  master_dealer_rate: number
  sales_partner_rate: number
  service_dealer_rate: number
  notes: string | null
  _default?: boolean
}

interface Stats {
  sites_count: number
  active_wos_count: number
  monthly_revenue: number
  total_commission: number
}

interface Site {
  id: string
  name: string
  unit_count?: number | null
  monthly_mrr?: number | null
  status?: string | null
  last_wo_date?: string | null
  contract_end_date?: string | null
}

interface WorkOrder {
  id: string
  title: string
  status: string
  priority?: string | null
  scheduled_date?: string | null
  tech_name?: string | null
}

interface Commission {
  id: string
  rep_id: string
  pay_period: string
  amount_cents: number
  door_count?: number
  status: 'pending' | 'approved' | 'paid' | 'held'
  notes?: string | null
  sales_reps?: { first_name: string; last_name: string; tier: string } | null
}

/* ─── Tier config ────────────────────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TIER_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  master_agent:       { label: 'Master Agent',                     icon: Star,          color: 'text-violet-700',  bg: 'bg-violet-100'  },
  master_dealer:      { label: 'MSO — Master System Operator',     icon: Layers,        color: 'text-brand-400',   bg: 'bg-brand-50'    },
  full_dealer:        { label: 'System Operator (Full Dealership)', icon: Shield,        color: 'text-indigo-700',  bg: 'bg-indigo-100'  },
  service_dealer:     { label: 'Servicing Partner',                icon: Wrench,        color: 'text-emerald-700', bg: 'bg-emerald-100' },
  install_contractor: { label: 'Installation Partner',             icon: ClipboardList, color: 'text-amber-700',   bg: 'bg-amber-100'   },
  sales_partner:      { label: 'Sales Partner',                    icon: TrendingUp,    color: 'text-sky-700',     bg: 'bg-sky-100'     },
}

/* ─── Document config ────────────────────────────────────── */
const DOC_CONFIGS: Array<{ type: PartnerDoc['type']; label: string; hasExpiry: boolean }> = [
  { type: 'w9',                  label: 'W-9',                      hasExpiry: false },
  { type: 'coi',                 label: 'Certificate of Insurance', hasExpiry: true  },
  { type: 'license',             label: 'State License',            hasExpiry: true  },
  { type: 'nda',                 label: 'NDA',                      hasExpiry: false },
  { type: 'agreement',           label: 'Dealer Agreement',         hasExpiry: false },
  { type: 'background_check',    label: 'Background Check',         hasExpiry: true  },
  { type: 'sales_training_cert', label: 'Sales Training Cert',      hasExpiry: true  },
  { type: 'tech1_cert',          label: 'Tech 1 Certification',     hasExpiry: true  },
  { type: 'tech2_cert',          label: 'Tech 2 Certification',     hasExpiry: true  },
  { type: 'tech3_cert',          label: 'Tech 3 Certification',     hasExpiry: true  },
]

/* ─── Helpers ────────────────────────────────────────────── */
function TierPill({ tier, tierLabel }: { tier: string; tierLabel?: string | null }) {
  const cfg = TIER_CONFIG[tier]
  if (!cfg) return <span className="text-xs text-slate-400">{tierLabel ?? tier}</span>
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.color}`}>
      <Icon size={11} />
      {tierLabel ?? cfg.label}
    </span>
  )
}

function WOStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    open:        'bg-slate-100 text-slate-600',
    in_progress: 'bg-blue-100 text-blue-700',
    scheduled:   'bg-amber-100 text-amber-700',
    in_route:    'bg-orange-100 text-orange-700',
    on_site:     'bg-purple-100 text-purple-700',
    completed:   'bg-emerald-100 text-emerald-700',
    cancelled:   'bg-rose-100 text-rose-700',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${map[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

function CommissionStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid:     'bg-emerald-100 text-emerald-700',
    approved: 'bg-blue-100 text-blue-700',
    pending:  'bg-amber-100 text-amber-700',
    held:     'bg-rose-100 text-rose-700',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${map[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  )
}

function DocStatusBadge({ status }: { status: PartnerDoc['status'] }) {
  const map: Record<PartnerDoc['status'], { cls: string; label: string }> = {
    on_file:  { cls: 'bg-emerald-100 text-emerald-700', label: 'On File'  },
    pending:  { cls: 'bg-amber-100 text-amber-700',     label: 'Pending'  },
    expired:  { cls: 'bg-rose-100 text-rose-700',       label: 'Expired'  },
    missing:  { cls: 'bg-slate-100 text-slate-500',     label: 'Missing'  },
  }
  const { cls, label } = map[status] ?? { cls: 'bg-slate-100 text-slate-400', label: status }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${cls}`}>
      {label}
    </span>
  )
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtMoney(cents: number) {
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })
}

function fmtDollars(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0 })
}

/* ─── Onboarding stepper ─────────────────────────────────── */
const ONBOARDING_STEPS = [
  { key: 'agreement',  label: 'Agreement Signed' },
  { key: 'portal',     label: 'Portal Active' },
  { key: 'first_wo',   label: 'First Work Order' },
  { key: 'first_inv',  label: 'First Invoice' },
  { key: 'certified',  label: 'Certified' },
]

function OnboardingStepper({ org }: { org: Org }) {
  const completedSteps = new Set<string>()
  if (org.onboarded_at) { completedSteps.add('agreement'); completedSteps.add('portal') }
  if (org.onboarding_complete) { completedSteps.add('first_wo'); completedSteps.add('first_inv') }

  return (
    <div className="flex items-center gap-0 overflow-x-auto">
      {ONBOARDING_STEPS.map((step, i) => {
        const done = completedSteps.has(step.key)
        return (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center min-w-[100px]">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                done ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-200 text-slate-400'
              }`}>
                {done ? <CheckCircle2 size={14} /> : i + 1}
              </div>
              <span className={`text-[9px] mt-1 font-medium text-center leading-tight ${done ? 'text-emerald-600' : 'text-slate-400'}`}>
                {step.label}
              </span>
            </div>
            {i < ONBOARDING_STEPS.length - 1 && (
              <div className={`h-0.5 w-10 shrink-0 -mt-4 mx-0.5 transition-colors ${done ? 'bg-emerald-400' : 'bg-slate-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ─── Compliance tab ─────────────────────────────────────── */
interface DocSlideOverState {
  open: boolean
  docType: PartnerDoc['type'] | null
  status: PartnerDoc['status']
  url: string
  expires_at: string
  notes: string
}

interface SigRecord {
  id: string
  document_type: string
  status: string
  signer_email: string
  signed_name: string | null
  signed_at: string | null
  countersigned_at: string | null
  expires_at: string
  sent_by_name: string | null
}

const E_SIGN_DOC_TYPES = new Set(['nda', 'agreement'])

function ComplianceTab({ org, onSaved }: { org: Org; onSaved: () => void }) {
  const docs: PartnerDoc[] = org.partner_docs ?? []
  const docMap = new Map<string, PartnerDoc>()
  for (const d of docs) docMap.set(d.type, d)

  const [slide, setSlide] = useState<DocSlideOverState>({
    open: false, docType: null,
    status: 'missing', url: '', expires_at: '', notes: '',
  })
  const [saving, setSaving]       = useState(false)
  const [sigs, setSigs]           = useState<SigRecord[]>([])
  const [sendingDoc, setSendingDoc] = useState<string | null>(null)
  const [countersigning, setCountersigning] = useState<string | null>(null)
  const [countersignName] = useState('Russel Feldman')

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch(`/api/signatures/by-record?org_id=${org.id}`)
        const data = await r.json()
        setSigs(data.signatures ?? [])
      } catch (_) {}
    })()
  }, [org.id])

  const latestSig = (docType: string) =>
    sigs.filter(s => s.document_type === docType).sort((a, b) =>
      new Date(b.expires_at).getTime() - new Date(a.expires_at).getTime()
    )[0] ?? null

  const handleSendDoc = async (docType: string, email: string) => {
    if (!email) return
    setSendingDoc(docType)
    try {
      await fetch('/api/signatures/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_type: docType,
          org_id:        org.id,
          signer_email:  email,
          signer_company: org.name,
        }),
      })
      // Refresh signatures
      const r = await fetch(`/api/signatures/by-record?org_id=${org.id}`)
      const data = await r.json()
      setSigs(data.signatures ?? [])
    } catch (_) {}
    finally { setSendingDoc(null) }
  }

  const handleCountersign = async (sigId: string) => {
    setCountersigning(sigId)
    try {
      await fetch('/api/signatures/countersign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature_id: sigId, countersigned_name: countersignName, countersigned_title: 'CEO' }),
      })
      const r = await fetch(`/api/signatures/by-record?org_id=${org.id}`)
      const data = await r.json()
      setSigs(data.signatures ?? [])
    } catch (_) {}
    finally { setCountersigning(null) }
  }

  const openSlide = (type: PartnerDoc['type']) => {
    const existing = docMap.get(type)
    setSlide({
      open: true, docType: type,
      status: existing?.status ?? 'missing',
      url: existing?.url ?? '',
      expires_at: existing?.expires_at ?? '',
      notes: existing?.notes ?? '',
    })
  }

  const handleSave = async () => {
    if (!slide.docType) return
    setSaving(true)
    try {
      const cfg = DOC_CONFIGS.find(d => d.type === slide.docType)!
      const updatedDoc: PartnerDoc = {
        type: slide.docType,
        label: cfg.label,
        status: slide.status,
        url: slide.url || undefined,
        expires_at: slide.expires_at || undefined,
        notes: slide.notes || undefined,
        uploaded_at: new Date().toISOString(),
      }
      // Merge with existing docs array
      const existing = (org.partner_docs ?? []).filter(d => d.type !== slide.docType)
      const newDocs = [...existing, updatedDoc]
      await fetch(`/api/admin/dealers/${org.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partner_docs: newDocs }),
      })
      setSlide(s => ({ ...s, open: false }))
      onSaved()
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  // Overall compliance score
  const onFileCount  = DOC_CONFIGS.filter(cfg => docMap.get(cfg.type)?.status === 'on_file').length
  const expiredCount = DOC_CONFIGS.filter(cfg => docMap.get(cfg.type)?.status === 'expired').length
  const missingCount = DOC_CONFIGS.filter(cfg => {
    const s = docMap.get(cfg.type)?.status
    return !s || s === 'missing'
  }).length

  const bannerColor = expiredCount > 0 ? 'bg-rose-50 border-rose-200 text-rose-700'
    : missingCount > 0 ? 'bg-amber-50 border-amber-200 text-amber-700'
    : 'bg-emerald-50 border-emerald-200 text-emerald-700'

  const bannerText = expiredCount > 0
    ? `${expiredCount} document${expiredCount > 1 ? 's' : ''} expired — action required`
    : missingCount > 0
    ? `${missingCount} document${missingCount > 1 ? 's' : ''} missing — compliance incomplete`
    : `All ${DOC_CONFIGS.length} documents on file — fully compliant`

  const slideCfg = DOC_CONFIGS.find(d => d.type === slide.docType)

  return (
    <>
      <div className="space-y-4">
        {/* Banner */}
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium ${bannerColor}`}>
          {expiredCount > 0 || missingCount > 0 ? (
            <AlertTriangle size={14} className="shrink-0" />
          ) : (
            <CheckCircle2 size={14} className="shrink-0" />
          )}
          {bannerText}
          <span className="ml-auto text-xs opacity-75">{onFileCount} / {DOC_CONFIGS.length} complete</span>
        </div>

        {/* Doc cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {DOC_CONFIGS.map(cfg => {
            const doc = docMap.get(cfg.type)
            const status = doc?.status ?? 'missing'
            return (
              <div key={cfg.type} className="bg-card border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <FileText size={14} className="text-muted-foreground shrink-0" />
                      <span className="font-semibold text-sm text-foreground">{cfg.label}</span>
                    </div>
                    {doc?.expires_at && (
                      <div className="text-xs text-muted-foreground mt-0.5 ml-[22px]">
                        Expires: {fmtDate(doc.expires_at)}
                      </div>
                    )}
                    {doc?.uploaded_at && (
                      <div className="text-xs text-muted-foreground mt-0.5 ml-[22px]">
                        Uploaded: {fmtDate(doc.uploaded_at)}
                      </div>
                    )}
                  </div>
                  <DocStatusBadge status={status} />
                </div>

                {doc?.notes && (
                  <p className="text-xs text-muted-foreground italic border-l-2 border-border pl-2">{doc.notes}</p>
                )}

                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  {doc?.url && (
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-accent transition-colors"
                    >
                      <ExternalLink size={11} /> View
                    </a>
                  )}
                  {/* E-sign controls for NDA and agreement */}
                  {(cfg.type === 'nda' || cfg.type === 'agreement') && (() => {
                    const sig = latestSig(cfg.type === 'agreement' ? 'dealer_agreement' : cfg.type)
                      ?? latestSig(cfg.type === 'agreement' ? 'service_agreement' : cfg.type)
                      ?? latestSig(cfg.type === 'agreement' ? 'master_agent_agreement' : cfg.type)
                    const sigEmail = org.email ?? org.contact_email ?? ''
                    if (sig?.status === 'counterparty_signed') {
                      return (
                        <button
                          onClick={() => { void handleCountersign(sig.id) }}
                          disabled={countersigning === sig.id}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                        >
                          {countersigning === sig.id ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                          Countersign
                        </button>
                      )
                    }
                    if (sig?.status === 'pending') {
                      return (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-amber-600 font-medium flex items-center gap-1">
                            <Clock size={10} /> Awaiting signature
                          </span>
                          {sigEmail && (
                            <button
                              onClick={() => { void handleSendDoc(cfg.type === 'agreement' ? 'dealer_agreement' : cfg.type, sigEmail) }}
                              disabled={sendingDoc === cfg.type}
                              className="flex items-center gap-1 px-2 py-1 rounded border border-slate-200 text-[10px] text-slate-500 hover:bg-slate-50 transition-colors"
                            >
                              Resend
                            </button>
                          )}
                        </div>
                      )
                    }
                    if (sig?.status === 'fully_executed') {
                      return (
                        <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                          <CheckCircle2 size={10} /> Fully executed
                        </span>
                      )
                    }
                    // Not yet sent
                    return sigEmail ? (
                      <button
                        onClick={() => { void handleSendDoc(cfg.type === 'agreement' ? 'dealer_agreement' : cfg.type, sigEmail) }}
                        disabled={sendingDoc === cfg.type}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50"
                      >
                        {sendingDoc === cfg.type ? <Loader2 size={11} className="animate-spin" /> : <Mail size={11} />}
                        Send for Signature
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-400 italic">Add org email to send</span>
                    )
                  })()}
                  <button
                    onClick={() => openSlide(cfg.type)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-accent transition-colors"
                  >
                    <Upload size={11} />
                    {doc?.url ? 'Update' : 'Manual upload'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Doc SlideOver */}
      <SlideOver
        open={slide.open}
        onClose={() => setSlide(s => ({ ...s, open: false }))}
        title={`Update ${slideCfg?.label ?? 'Document'}`}
        subtitle={org.name}
        size="md"
        footer={
          <SlideOverFooter
            onCancel={() => setSlide(s => ({ ...s, open: false }))}
            onSave={() => { void handleSave() }}
            saving={saving}
            saveLabel="Save Document"
          />
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Status</label>
            <select
              value={slide.status}
              onChange={e => setSlide(s => ({ ...s, status: e.target.value as PartnerDoc['status'] }))}
              className="w-full px-3 py-2 h-9 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-background"
            >
              <option value="missing">Missing</option>
              <option value="pending">Pending Review</option>
              <option value="on_file">On File</option>
              <option value="expired">Expired</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Document URL</label>
            <input
              type="url"
              value={slide.url}
              onChange={e => setSlide(s => ({ ...s, url: e.target.value }))}
              placeholder="https://drive.google.com/…"
              className="w-full px-3 py-2 h-9 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-background"
            />
          </div>
          {slideCfg?.hasExpiry && (
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Expiry Date</label>
              <input
                type="date"
                value={slide.expires_at}
                onChange={e => setSlide(s => ({ ...s, expires_at: e.target.value }))}
                className="w-full px-3 py-2 h-9 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-background"
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Notes</label>
            <textarea
              value={slide.notes}
              onChange={e => setSlide(s => ({ ...s, notes: e.target.value }))}
              rows={3}
              placeholder="Optional notes about this document…"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-background resize-none"
            />
          </div>
        </div>
      </SlideOver>
    </>
  )
}

/* ─── Features tab ───────────────────────────────────────── */
type AccessLevel = 'none' | 'view' | 'edit'

interface OrgFeature {
  key:           string
  label:         string
  section:       string
  section_label: string
  sort_order:    number
  tier_default:  AccessLevel
  access_level:  AccessLevel
  is_overridden: boolean
  override: {
    access_level: AccessLevel
    is_promo:     boolean
    promo_reason: string | null
    expires_at:   string | null
    notes:        string | null
  } | null
}

const ACCESS_OPTIONS: { value: AccessLevel; label: string; color: string }[] = [
  { value: 'none', label: 'None',  color: 'bg-slate-100 text-slate-500' },
  { value: 'view', label: 'View',  color: 'bg-amber-100 text-amber-700' },
  { value: 'edit', label: 'Edit',  color: 'bg-emerald-100 text-emerald-700' },
]

function OrgAccessSelector({ value, onChange }: { value: AccessLevel; onChange: (v: AccessLevel) => void }) {
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

function groupFeaturesBySection(features: OrgFeature[]): Map<string, { label: string; items: OrgFeature[] }> {
  const map = new Map<string, { label: string; items: OrgFeature[] }>()
  for (const f of features) {
    if (!map.has(f.section)) map.set(f.section, { label: f.section_label, items: [] })
    map.get(f.section)!.items.push(f)
  }
  return map
}

function FeaturesTab({ org }: { org: Org }) {
  const [features, setFeatures]   = useState<OrgFeature[]>([])
  const [loading, setLoading]     = useState(true)
  const [dirty, setDirty]         = useState<Map<string, Partial<OrgFeature & { is_promo: boolean; expires_at: string; notes: string }>>>(new Map())
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [error, setError]         = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        const res  = await fetch(`/api/admin/org-features/${org.id}`)
        const data = await res.json()
        setFeatures(data.features ?? [])
      } catch { setError('Failed to load features') }
      finally { setLoading(false) }
    })()
  }, [org.id])

  const markDirty = (key: string, patch: Record<string, unknown>) => {
    setDirty(d => {
      const next = new Map(d)
      next.set(key, { ...(next.get(key) ?? {}), ...patch })
      return next
    })
    setFeatures(fs => fs.map(f => {
      if (f.key !== key) return f
      const newLevel = (patch.access_level as AccessLevel | undefined) ?? f.access_level
      return {
        ...f,
        access_level:  newLevel,
        is_overridden: newLevel !== f.tier_default || !!(patch.is_promo ?? f.override?.is_promo),
        override: {
          access_level: newLevel,
          is_promo:     (patch.is_promo as boolean | undefined) ?? f.override?.is_promo ?? false,
          promo_reason: (patch.promo_reason as string | null | undefined) ?? f.override?.promo_reason ?? null,
          expires_at:   (patch.expires_at as string | null | undefined) ?? f.override?.expires_at ?? null,
          notes:        (patch.notes as string | null | undefined) ?? f.override?.notes ?? null,
        },
      }
    }))
  }

  const handleSave = async () => {
    if (dirty.size === 0) return
    setSaving(true)
    setError(null)
    try {
      const updates = Array.from(dirty.entries()).map(([key, patch]) => ({
        feature_key:  key,
        access_level: (patch as OrgFeature).access_level ?? 'none',
        is_promo:     (patch as Record<string, unknown>).is_promo ?? false,
        expires_at:   (patch as Record<string, unknown>).expires_at ?? null,
        notes:        (patch as Record<string, unknown>).notes ?? null,
      }))
      const res  = await fetch(`/api/admin/org-features/${org.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ updates }),
      })
      const data = await res.json()
      const failed = (data.results ?? []).filter((r: Record<string, unknown>) => !r.ok)
      if (failed.length > 0) throw new Error(`${failed.length} item(s) failed to save`)
      setDirty(new Map())
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err: unknown) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const sections = groupFeaturesBySection(features)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={22} className="animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
          <AlertTriangle size={14} className="shrink-0" /> {error}
        </div>
      )}

      {/* Info + save bar */}
      <div className="flex items-center justify-between gap-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
        <p className="text-sm text-blue-700">
          <span className="font-semibold">Overrides</span> apply to {org.name} only.
          Tier defaults (from global settings) are shown in grey. Set to <span className="font-semibold">None</span> to hide a section from this org's sidebar entirely.
        </p>
        <button
          onClick={() => { void handleSave() }}
          disabled={dirty.size === 0 || saving}
          className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            dirty.size > 0
              ? 'bg-brand-400 text-white hover:bg-brand-500'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : saved ? <CheckCircle2 size={13} /> : <Save size={13} />}
          {saved ? 'Saved!' : `Save${dirty.size > 0 ? ` (${dirty.size})` : ''}`}
        </button>
      </div>

      {/* Feature sections */}
      {Array.from(sections.entries()).map(([sectionKey, { label, items }]) => (
        <div key={sectionKey} className="bg-card border border-border rounded-xl overflow-hidden">
          {/* Section header */}
          <div className="flex items-center justify-between px-5 py-2.5 border-b border-border bg-slate-50">
            <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">{label}</h3>
            <span className="text-[10px] text-slate-400">{items.length} feature{items.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-[1fr_120px_80px_80px_1fr] gap-3 px-5 py-1.5 border-b border-slate-100 bg-slate-50/50">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Feature</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Access Level</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Tier Default</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Promo</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Expiry / Notes</span>
          </div>

          {items.map(f => {
            const isDirty   = dirty.has(f.key)
            const isPromo   = f.override?.is_promo ?? false
            const expiresAt = f.override?.expires_at ?? ''
            const notes     = f.override?.notes ?? ''
            const tierColor = f.tier_default === 'edit' ? 'text-emerald-600' : f.tier_default === 'view' ? 'text-amber-600' : 'text-slate-400'

            return (
              <div
                key={f.key}
                className={`grid grid-cols-[1fr_120px_80px_80px_1fr] gap-3 px-5 py-3 border-b border-slate-50 items-center hover:bg-slate-50/50 transition-colors ${
                  isDirty ? 'bg-amber-50/30' : ''
                }`}
              >
                {/* Label */}
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium text-foreground truncate">{f.label}</span>
                  {f.is_overridden && !isDirty && (
                    <span className="text-[9px] font-bold bg-brand-50 text-brand-400 px-1.5 py-0.5 rounded-full uppercase tracking-wide shrink-0">Override</span>
                  )}
                  {isDirty && <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />}
                </div>

                {/* Access level selector */}
                <div className="flex justify-center">
                  <OrgAccessSelector
                    value={f.access_level}
                    onChange={v => markDirty(f.key, { access_level: v })}
                  />
                </div>

                {/* Tier default (read-only badge) */}
                <div className="flex justify-center">
                  <span className={`text-[10px] font-semibold capitalize ${tierColor}`}>
                    {f.tier_default}
                  </span>
                </div>

                {/* Promo toggle */}
                <div className="flex justify-center">
                  <button onClick={() => markDirty(f.key, { is_promo: !isPromo })}>
                    {isPromo
                      ? <ToggleRight size={18} className="text-brand-400" />
                      : <ToggleLeft  size={18} className="text-slate-300" />
                    }
                  </button>
                </div>

                {/* Expiry + Notes */}
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={expiresAt.slice(0, 10)}
                    onChange={e => markDirty(f.key, { expires_at: e.target.value || null })}
                    placeholder="No expiry"
                    className="w-32 text-[11px] border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-400 text-slate-600"
                  />
                  <input
                    value={notes}
                    onChange={e => markDirty(f.key, { notes: e.target.value || null })}
                    placeholder="Notes…"
                    className="flex-1 text-[11px] border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-400 text-slate-600"
                  />
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

/* ─── Main page ──────────────────────────────────────────── */
type TabKey = 'overview' | 'properties' | 'work_orders' | 'commissions' | 'compliance' | 'features' | 'reps' | 'activity'

const TAB_LABELS: Record<TabKey, string> = {
  overview:     'Overview',
  properties:   'Properties',
  work_orders:  'Work Orders',
  commissions:  'Commissions',
  compliance:   'Compliance',
  features:     'Features',
  reps:         'Reps',
  activity:     'Activity Log',
}

export default function DealerDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params.id

  const [org, setOrg]                  = useState<Org | null>(null)
  const [commConfig, setCommConfig]     = useState<CommissionConfig | null>(null)
  const [stats, setStats]               = useState<Stats | null>(null)
  const [sites, setSites]               = useState<Site[]>([])
  const [wos, setWOs]                   = useState<WorkOrder[]>([])
  const [commissions, setCommissions]   = useState<Commission[]>([])
  const [loading, setLoading]           = useState(true)
  const [tab, setTab]                   = useState<TabKey>('overview')
  const [editOpen, setEditOpen]         = useState(false)
  const [saving, setSaving]             = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)

  // Edit form state
  const [editName, setEditName]               = useState('')
  const [editEmail, setEditEmail]             = useState('')
  const [editPhone, setEditPhone]             = useState('')
  const [editWebsite, setEditWebsite]         = useState('')
  const [editContactName, setEditContactName] = useState('')
  const [editContactEmail, setEditContactEmail] = useState('')
  const [editContactPhone, setEditContactPhone] = useState('')

  // Commission actions
  const [commActionId, setCommActionId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/dealers/${id}`)
      if (!res.ok) { router.push('/admin/dealers'); return }
      const data = await res.json()
      setOrg(data.org)
      setCommConfig(data.commission_config)
      setStats(data.stats)
      setSites(data.sites ?? [])
      setWOs(data.recent_wos ?? [])
      setCommissions(data.commission_payouts ?? [])
      // Seed edit form
      setEditName(data.org.name ?? '')
      setEditEmail(data.org.email ?? '')
      setEditPhone(data.org.phone ?? '')
      setEditWebsite(data.org.website ?? '')
      setEditContactName(data.org.contact_name ?? '')
      setEditContactEmail(data.org.contact_email ?? '')
      setEditContactPhone(data.org.contact_phone ?? '')
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [id, router])

  useEffect(() => { void load() }, [load])

  const handleSaveEdit = async () => {
    if (!org) return
    setSaving(true)
    try {
      await fetch(`/api/admin/dealers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName, email: editEmail, phone: editPhone, website: editWebsite,
          contact_name: editContactName, contact_email: editContactEmail, contact_phone: editContactPhone,
        }),
      })
      void load()
      setEditOpen(false)
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  const handleToggleActive = async () => {
    if (!org) return
    setSavingStatus(true)
    try {
      await fetch(`/api/admin/dealers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !org.is_active }),
      })
      void load()
    } catch (e) { console.error(e) }
    finally { setSavingStatus(false) }
  }

  const handleCommissionAction = async (commId: string, status: string) => {
    setCommActionId(commId)
    try {
      await fetch(`/api/reps/commissions/${commId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      void load()
    } catch (e) { console.error(e) }
    finally { setCommActionId(null) }
  }

  /* ─── Table columns ────────────────────────────────────── */
  const sitesColumns: Column<Site>[] = [
    {
      key: 'name',
      label: 'Property',
      render: (_, row) => <span className="font-medium text-foreground">{row.name}</span>,
    },
    {
      key: 'unit_count',
      label: 'Units',
      align: 'right',
      render: (_, row) => <span className="text-muted-foreground">{row.unit_count ?? '—'}</span>,
    },
    {
      key: 'monthly_mrr',
      label: 'Monthly MRR',
      align: 'right',
      render: (_, row) => (
        <span className="font-medium text-foreground">
          {row.monthly_mrr ? fmtDollars(row.monthly_mrr) : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Health',
      render: (_, row) => {
        const s = row.status ?? 'active'
        const map: Record<string, string> = {
          active:   'bg-emerald-100 text-emerald-700',
          inactive: 'bg-slate-100 text-slate-500',
          pending:  'bg-amber-100 text-amber-700',
        }
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${map[s] ?? 'bg-slate-100 text-slate-600'}`}>
            {s}
          </span>
        )
      },
    },
    {
      key: 'last_wo_date',
      label: 'Last WO',
      render: (_, row) => <span className="text-muted-foreground text-xs">{fmtDate(row.last_wo_date)}</span>,
    },
    {
      key: 'contract_end_date',
      label: 'Contract End',
      render: (_, row) => <span className="text-muted-foreground text-xs">{fmtDate(row.contract_end_date)}</span>,
    },
  ]

  const woColumns: Column<WorkOrder>[] = [
    {
      key: 'id',
      label: 'WO#',
      render: (_, row) => (
        <Link href={`/maintenance/${row.id}`} className="text-brand-400 font-mono text-xs hover:underline">
          {row.id.slice(0, 8).toUpperCase()}
        </Link>
      ),
    },
    {
      key: 'title',
      label: 'Title',
      render: (_, row) => <span className="font-medium text-foreground">{row.title}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (_, row) => <WOStatusBadge status={row.status} />,
    },
    {
      key: 'priority',
      label: 'Priority',
      render: (_, row) => {
        if (!row.priority) return <span className="text-muted-foreground">—</span>
        const map: Record<string, string> = { high: 'text-rose-600', medium: 'text-amber-600', low: 'text-slate-500' }
        return <span className={`text-xs font-semibold capitalize ${map[row.priority] ?? 'text-slate-500'}`}>{row.priority}</span>
      },
    },
    {
      key: 'scheduled_date',
      label: 'Scheduled',
      render: (_, row) => <span className="text-muted-foreground text-xs">{fmtDate(row.scheduled_date)}</span>,
    },
    {
      key: 'tech_name',
      label: 'Tech',
      render: (_, row) => <span className="text-muted-foreground">{row.tech_name ?? '—'}</span>,
    },
  ]

  const commColumns: Column<Commission>[] = [
    {
      key: 'pay_period',
      label: 'Period',
      sortable: true,
      render: (_, row) => <span className="font-mono text-xs text-foreground">{row.pay_period}</span>,
    },
    {
      key: 'rep_id',
      label: 'Rep',
      render: (_, row) => (
        <span className="text-foreground">
          {row.sales_reps ? `${row.sales_reps.first_name} ${row.sales_reps.last_name}`.trim() : '—'}
        </span>
      ),
    },
    {
      key: 'amount_cents',
      label: 'Amount',
      sortable: true,
      align: 'right',
      render: (_, row) => <span className="font-semibold text-foreground">{fmtMoney(row.amount_cents)}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (_, row) => <CommissionStatusBadge status={row.status} />,
    },
  ]

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <TopBar title="Partner Detail" subtitle="Loading…" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin text-brand-400" />
        </div>
      </div>
    )
  }

  if (!org) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <TopBar title="Partner Not Found" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <AlertTriangle size={40} className="mx-auto text-amber-400 mb-3" />
            <p className="font-semibold text-foreground">Partner not found</p>
            <Link href="/admin/dealers" className="text-brand-400 text-sm mt-2 inline-block hover:underline">
              ← Back to Partner Network
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const tierCfg = TIER_CONFIG[org.org_tier]
  const TierIcon = tierCfg?.icon ?? Building2

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <TopBar
        title={org.name}
        subtitle={tierCfg?.label ?? org.org_tier}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-accent transition-colors"
            >
              <Edit2 size={13} /> Edit
            </button>
            <button
              onClick={() => { void handleToggleActive() }}
              disabled={savingStatus}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                org.is_active
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                  : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
              }`}
            >
              {savingStatus ? (
                <Loader2 size={12} className="animate-spin" />
              ) : org.is_active ? (
                <ToggleRight size={13} />
              ) : (
                <ToggleLeft size={13} />
              )}
              {org.is_active ? 'Active' : 'Inactive'}
            </button>
          </div>
        }
      />

      <div className="flex-1 p-6 space-y-6 max-w-screen-xl mx-auto w-full">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/admin/dealers" className="hover:text-foreground flex items-center gap-1">
            <ChevronLeft size={14} /> Partner Network
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium">{org.name}</span>
        </div>

        {/* Header card */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${tierCfg?.bg ?? 'bg-slate-100'}`}>
              <TierIcon size={24} className={tierCfg?.color ?? 'text-slate-500'} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold text-foreground">{org.name}</h1>
                <TierPill tier={org.org_tier} tierLabel={org.tier_label} />
                <span className={`inline-flex items-center gap-1 text-xs font-medium ${org.is_active ? 'text-emerald-600' : 'text-rose-600'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full inline-block ${org.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  {org.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                {org.email && (
                  <span className="flex items-center gap-1.5">
                    <Mail size={13} /> {org.email}
                  </span>
                )}
                {org.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone size={13} /> {org.phone}
                  </span>
                )}
                {org.website && (
                  <a href={org.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-brand-400 hover:underline">
                    <Globe size={13} /> {org.website.replace(/^https?:\/\//, '')}
                  </a>
                )}
                {(org.city || org.state) && (
                  <span className="flex items-center gap-1.5">
                    <MapPin size={13} /> {[org.city, org.state].filter(Boolean).join(', ')}
                  </span>
                )}
              </div>
              {/* Primary contact */}
              {(org.contact_name || org.contact_email) && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground border-t border-border/50 pt-2">
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Primary Contact:</span>
                  {org.contact_name && <span>{org.contact_name}</span>}
                  {org.contact_email && (
                    <span className="flex items-center gap-1.5">
                      <Mail size={12} /> {org.contact_email}
                    </span>
                  )}
                  {org.contact_phone && (
                    <span className="flex items-center gap-1.5">
                      <Phone size={12} /> {org.contact_phone}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Quick stats */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-border">
              <div>
                <div className="text-2xl font-bold text-foreground">{stats.sites_count}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Properties Served</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{stats.active_wos_count}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Active WOs</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{fmtDollars(stats.monthly_revenue)}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Monthly Revenue</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{fmtMoney(stats.total_commission)}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Commission Paid</div>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-0.5 border-b border-border overflow-x-auto">
          {(Object.keys(TAB_LABELS) as TabKey[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                tab === t
                  ? 'border-brand-400 text-brand-400'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {/* ── Overview ─────────────────────────────────────────── */}
        {tab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Info card */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Organization Info</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tier</span>
                  <TierPill tier={org.org_tier} tierLabel={org.tier_label} />
                </div>
                {org.license_number && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">License #</span>
                    <span className="font-mono text-xs text-foreground">{org.license_number}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Technicians</span>
                  <span className="text-foreground font-medium">{org.tech_count}</span>
                </div>
                {org.service_area_states?.length > 0 && (
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-muted-foreground shrink-0">Service Area</span>
                    <div className="flex flex-wrap gap-1 justify-end">
                      {org.service_area_states.map(s => (
                        <span key={s} className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-semibold">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Onboarded</span>
                  <span className="text-foreground">{fmtDate(org.onboarded_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span className="text-foreground">{fmtDate(org.created_at)}</span>
                </div>
              </div>

              {/* Commission config */}
              {commConfig && (
                <div className="pt-4 border-t border-border space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Commission Config</h4>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Sales Partner Rate</span>
                    <span className="font-mono font-semibold text-foreground">${commConfig.sales_partner_rate.toFixed(2)}/unit</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Service Dealer Rate</span>
                    <span className="font-mono font-semibold text-foreground">${commConfig.service_dealer_rate.toFixed(2)}/unit</span>
                  </div>
                  {commConfig.notes && (
                    <p className="text-xs text-muted-foreground italic mt-2">{commConfig.notes}</p>
                  )}
                  {commConfig._default && (
                    <p className="text-xs text-amber-600 mt-1">Using default rates — no custom config set</p>
                  )}
                </div>
              )}
            </div>

            {/* Onboarding stepper */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Onboarding Progress</h3>
              <OnboardingStepper org={org} />

              {/* Recent activity */}
              <div className="pt-4 border-t border-border space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recent Activity</h4>
                {wos.slice(0, 5).length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">No activity yet</p>
                ) : (
                  wos.slice(0, 5).map(wo => (
                    <div key={wo.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-border/50 last:border-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <Wrench size={12} className="text-muted-foreground shrink-0" />
                        <span className="text-sm text-foreground truncate">{wo.title}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <WOStatusBadge status={wo.status} />
                        <span className="text-xs text-muted-foreground">{fmtDate(wo.scheduled_date)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Properties ─────────────────────────────────────── */}
        {tab === 'properties' && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
              <Building2 size={15} className="text-brand-400" />
              <h2 className="text-sm font-semibold">Properties Served</h2>
              {sites.length > 0 && (
                <span className="ml-auto text-[10px] text-muted-foreground">{sites.length} sites</span>
              )}
            </div>
            <DataTable<Site>
              columns={sitesColumns}
              data={sites}
              rowKey="id"
              loading={loading}
              skeletonRows={4}
              onRowClick={row => router.push(`/sites/${row.id}`)}
              emptyState={
                <EmptyState
                  icon={<Building2 size={32} className="text-muted-foreground" />}
                  title="No properties yet"
                  description="Properties linked to this partner will appear here"
                />
              }
            />
          </div>
        )}

        {/* ── Work Orders ────────────────────────────────────── */}
        {tab === 'work_orders' && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
              <Wrench size={15} className="text-brand-400" />
              <h2 className="text-sm font-semibold">Work Orders</h2>
              {wos.length > 0 && (
                <span className="ml-auto text-[10px] text-muted-foreground">{wos.length} recent WOs</span>
              )}
            </div>
            <DataTable<WorkOrder>
              columns={woColumns}
              data={wos}
              rowKey="id"
              loading={loading}
              skeletonRows={5}
              onRowClick={row => router.push(`/maintenance/${row.id}`)}
              emptyState={
                <EmptyState
                  icon={<Wrench size={32} className="text-muted-foreground" />}
                  title="No work orders"
                  description="Work orders for this partner will appear here"
                />
              }
            />
          </div>
        )}

        {/* ── Commission History ──────────────────────────────── */}
        {tab === 'commissions' && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
              <DollarSign size={15} className="text-brand-400" />
              <h2 className="text-sm font-semibold">Commission History</h2>
            </div>
            <DataTable<Commission>
              columns={commColumns}
              data={commissions}
              rowKey="id"
              loading={loading}
              skeletonRows={5}
              actions={row => (
                <div className="flex items-center gap-1.5 justify-end">
                  {row.status === 'pending' && (
                    <>
                      <button
                        onClick={() => { void handleCommissionAction(row.id, 'approved') }}
                        disabled={commActionId === row.id}
                        className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => { void handleCommissionAction(row.id, 'held') }}
                        disabled={commActionId === row.id}
                        className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 text-xs font-semibold border border-amber-200 hover:bg-amber-100 transition-colors disabled:opacity-50"
                      >
                        Hold
                      </button>
                    </>
                  )}
                  {row.status === 'approved' && (
                    <button
                      onClick={() => { void handleCommissionAction(row.id, 'paid') }}
                      disabled={commActionId === row.id}
                      className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200 hover:bg-blue-100 transition-colors disabled:opacity-50"
                    >
                      Mark Paid
                    </button>
                  )}
                  {row.status === 'held' && (
                    <button
                      onClick={() => { void handleCommissionAction(row.id, 'approved') }}
                      disabled={commActionId === row.id}
                      className="px-2.5 py-1 rounded-lg bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 hover:bg-slate-100 transition-colors disabled:opacity-50"
                    >
                      Unhold
                    </button>
                  )}
                </div>
              )}
              emptyState={
                <EmptyState
                  icon={<DollarSign size={32} className="text-muted-foreground" />}
                  title="No commission records"
                  description="Commission payouts for this partner will appear here"
                />
              }
            />
          </div>
        )}

        {/* ── Compliance ──────────────────────────────────────── */}
        {tab === 'compliance' && (
          <ComplianceTab org={org} onSaved={() => { void load() }} />
        )}

        {/* ── Features ────────────────────────────────────────── */}
        {tab === 'features' && (
          <FeaturesTab org={org} />
        )}

        {/* ── Reps ────────────────────────────────────────────── */}
        {tab === 'reps' && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
              <div className="flex items-center gap-2">
                <Users size={15} className="text-brand-400" />
                <h2 className="text-sm font-semibold">Sales Reps</h2>
              </div>
              <Link
                href={`/reps?org_id=${org.id}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-accent transition-colors"
              >
                View in Reps <ExternalLink size={11} />
              </Link>
            </div>
            <EmptyState
              icon={<Users size={32} className="text-muted-foreground" />}
              title="No reps linked"
              description="Sales reps assigned to this partner will appear here"
              action={{ label: 'Manage Reps', onClick: () => router.push('/reps') }}
            />
          </div>
        )}

        {/* ── Activity Log ────────────────────────────────────── */}
        {tab === 'activity' && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
              <Activity size={15} className="text-brand-400" />
              <h2 className="text-sm font-semibold">Activity Log</h2>
            </div>
            <EmptyState
              icon={<Activity size={32} className="text-muted-foreground" />}
              title="No activity recorded"
              description="Onboarding steps, document uploads, and status changes will appear here"
            />
          </div>
        )}
      </div>

      {/* ── Edit SlideOver ─────────────────────────────────── */}
      <SlideOver
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Partner"
        subtitle={org.name}
        size="md"
        footer={
          <SlideOverFooter
            onCancel={() => setEditOpen(false)}
            onSave={() => { void handleSaveEdit() }}
            saving={saving}
            saveLabel="Save Changes"
          />
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Organization Name</label>
            <input
              value={editName}
              onChange={e => setEditName(e.target.value)}
              className="w-full px-3 py-2 h-9 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-background"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Org Email</label>
            <input
              type="email"
              value={editEmail}
              onChange={e => setEditEmail(e.target.value)}
              className="w-full px-3 py-2 h-9 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-background"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Org Phone</label>
            <input
              type="tel"
              value={editPhone}
              onChange={e => setEditPhone(e.target.value)}
              className="w-full px-3 py-2 h-9 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-background"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Website</label>
            <input
              type="url"
              value={editWebsite}
              onChange={e => setEditWebsite(e.target.value)}
              className="w-full px-3 py-2 h-9 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-background"
            />
          </div>

          <div className="pt-2 border-t border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Primary Contact</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Name</label>
                <input
                  value={editContactName}
                  onChange={e => setEditContactName(e.target.value)}
                  placeholder="Contact name"
                  className="w-full px-3 py-2 h-9 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-background"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Email</label>
                <input
                  type="email"
                  value={editContactEmail}
                  onChange={e => setEditContactEmail(e.target.value)}
                  placeholder="contact@example.com"
                  className="w-full px-3 py-2 h-9 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-background"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Phone</label>
                <input
                  type="tel"
                  value={editContactPhone}
                  onChange={e => setEditContactPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="w-full px-3 py-2 h-9 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-background"
                />
              </div>
            </div>
          </div>
        </div>
      </SlideOver>
    </div>
  )
}
