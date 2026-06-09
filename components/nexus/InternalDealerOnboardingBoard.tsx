'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Bucket = 'draft' | 'needs_nda' | 'nda_sent' | 'nda_signed' | 'needs_agreement' | 'agreement_signed' | 'needs_compliance' | 'ready_to_approve' | 'live'

type DealerItem = {
  id: string
  title: string
  subtitle: string
  org_tier: string | null
  tier_label: string | null
  is_active: boolean
  onboarding_complete: boolean
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  nda_status: string
  agreement_status: string
  agreement_signature_id?: string | null
  executed_cert_url?: string | null
  compliance_needed: boolean
  next_action?: string | null
  bucket: Bucket
  resume_href: string
  open_href: string
}

const buckets: Bucket[] = ['draft', 'needs_nda', 'nda_sent', 'needs_agreement', 'agreement_signed', 'needs_compliance', 'ready_to_approve', 'live']

const agreementByTier: Record<string, string> = {
  master_agent: 'master_agent_agreement',
  master_dealer: 'dealer_agreement',
  full_dealer: 'dealer_agreement',
  service_dealer: 'service_agreement',
  install_contractor: 'install_partner_agreement',
  sales_partner: 'sales_partner_agreement',
}

function label(bucket: Bucket) {
  if (bucket === 'draft') return 'Draft'
  if (bucket === 'needs_nda') return 'Needs NDA'
  if (bucket === 'nda_sent') return 'NDA Sent'
  if (bucket === 'nda_signed') return 'NDA Signed'
  if (bucket === 'needs_agreement') return 'Needs Agreement'
  if (bucket === 'agreement_signed') return 'Agreement Signed'
  if (bucket === 'needs_compliance') return 'Needs Compliance'
  if (bucket === 'ready_to_approve') return 'Ready to Approve'
  return 'Live Dealers'
}

function color(bucket: Bucket) {
  if (bucket === 'ready_to_approve') return '#34D399'
  if (bucket === 'live') return '#00C8FF'
  if (bucket === 'agreement_signed') return '#34D399'
  if (bucket === 'needs_compliance') return '#F87171'
  if (bucket === 'needs_nda' || bucket === 'needs_agreement') return '#FBBF24'
  if (bucket === 'nda_sent') return '#8B5CF6'
  return '#64748B'
}

function tierText(item: DealerItem) {
  return item.tier_label || item.org_tier || 'Partner'
}

function agreementType(item: DealerItem) {
  return agreementByTier[item.org_tier ?? ''] ?? 'dealer_agreement'
}

export function InternalDealerOnboardingBoard() {
  const router = useRouter()
  const [items, setItems] = useState<DealerItem[]>([])
  const [bucket, setBucket] = useState<Bucket>('needs_nda')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState<'nda' | 'agreement' | 'countersign' | null>(null)

  async function load() {
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch('/api/nexus/internal/dealer-onboarding')
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.success === false) throw new Error(data?.message ?? 'Could not load dealer onboarding.')
      const next = Array.isArray(data.items) ? data.items as DealerItem[] : []
      setItems(next)
      if (next.length === 0) setMessage('No dealer onboarding records found yet.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load dealer onboarding.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  async function sendDoc(item: DealerItem, kind: 'nda' | 'agreement') {
    setBusy(kind)
    setActionMessage(null)
    try {
      if (!item.contact_email) throw new Error('This dealer needs a contact email before sending.')
      const payload: Record<string, string | null> = {
        document_type: kind === 'nda' ? 'nda' : agreementType(item),
        org_id: item.id,
        signer_name: item.contact_name || item.title,
        signer_email: item.contact_email,
        signer_company: item.title,
      }
      const endpoint = ['/api', 'signatures', 'send'].join('/')
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.ok === false) throw new Error(data?.error ?? data?.message ?? 'Document email failed.')
      setActionMessage(kind === 'nda' ? 'NDA sent from this glass board.' : 'Agreement sent from this glass board.')
      await load()
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Could not send document.')
    } finally {
      setBusy(null)
    }
  }

  async function countersignAgreement(item: DealerItem) {
    setBusy('countersign')
    setActionMessage(null)
    try {
      if (!item.agreement_signature_id) throw new Error('No signed agreement record was found to countersign.')
      const res = await fetch('/api/signatures/countersign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signature_id: item.agreement_signature_id,
          countersigned_name: 'Russel Feldman',
          countersigned_title: 'CEO',
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.ok === false) throw new Error(data?.error ?? data?.message ?? 'Countersign failed.')
      setActionMessage('Agreement countersigned. Final copy is being stored and confirmation emails are being sent.')
      await load()
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Could not countersign agreement.')
    } finally {
      setBusy(null)
    }
  }

  const shown = items.filter(item => item.bucket === bucket)
  const selected = items.find(item => item.id === selectedId) ?? null

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        {buckets.map(nextBucket => {
          const c = color(nextBucket)
          const count = items.filter(item => item.bucket === nextBucket).length
          const active = bucket === nextBucket
          return (
            <button key={nextBucket} type="button" onClick={() => { setBucket(nextBucket); setSelectedId(null); setActionMessage(null) }} className="rounded-2xl px-3 py-3 text-left" style={{ background: active ? `${c}1f` : 'rgba(0,0,0,0.18)', border: active ? `1px solid ${c}66` : '1px solid rgba(255,255,255,0.06)' }}>
              <div className="text-[9px] uppercase tracking-[0.12em]" style={{ color: c }}>{label(nextBucket)}</div>
              <div className="mt-1 text-lg font-semibold" style={{ color: 'rgba(255,255,255,0.94)' }}>{count}</div>
            </button>
          )
        })}
      </div>

      {loading && <div className="rounded-2xl p-4 text-xs" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.48)' }}>Loading dealer onboarding…</div>}
      {message && <div className="rounded-2xl p-4 text-xs" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.48)' }}>{message}</div>}
      {actionMessage && <div className="rounded-2xl p-4 text-xs" style={{ background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.24)', color: '#FBBF24' }}>{actionMessage}</div>}
      {!loading && shown.length === 0 && !message && <div className="rounded-2xl p-4 text-xs" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.48)' }}>No {label(bucket).toLowerCase()} records right now.</div>}

      <div className="space-y-2">
        {shown.map(item => {
          const c = color(item.bucket)
          const active = selectedId === item.id
          return (
            <button key={item.id} type="button" onClick={() => { setSelectedId(item.id); setActionMessage(null) }} className="w-full rounded-2xl px-3 py-3 text-left" style={{ background: active ? `${c}1f` : 'rgba(0,0,0,0.18)', border: active ? `1px solid ${c}66` : '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>{item.title}</div>
                  <div className="mt-1 text-[11px]" style={{ color: 'rgba(255,255,255,0.48)' }}>{tierText(item)} • {item.contact_email || item.subtitle}</div>
                  <div className="mt-2 inline-flex rounded-full px-2 py-1 text-[10px] font-semibold" style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.22)', color: '#FBBF24' }}>Next: {item.next_action || label(item.bucket)}</div>
                </div>
                <div className="rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em]" style={{ background: `${c}1f`, border: `1px solid ${c}44`, color: c }}>{label(item.bucket)}</div>
              </div>
            </button>
          )
        })}
      </div>

      {selected && (
        <div className="rounded-3xl p-4" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.18)' }}>
          <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: '#ddd6fe' }}>Selected Dealer Onboarding</div>
          <div className="mt-1 text-lg font-semibold" style={{ color: 'rgba(255,255,255,0.94)' }}>{selected.title}</div>
          <div className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.54)' }}>{tierText(selected)} • {selected.contact_email || 'No contact email'}</div>

          <div className="mt-4 rounded-2xl p-3" style={{ background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.20)' }}>
            <div className="text-[9px] uppercase tracking-[0.14em]" style={{ color: '#FBBF24' }}>Next Action</div>
            <div className="mt-1 text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>{selected.next_action || label(selected.bucket)}</div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-2xl px-3 py-2" style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.06)' }}><div className="text-[9px] uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.34)' }}>NDA</div><div className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.78)' }}>{selected.nda_status}</div></div>
            <div className="rounded-2xl px-3 py-2" style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.06)' }}><div className="text-[9px] uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.34)' }}>Agreement</div><div className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.78)' }}>{selected.agreement_status}</div></div>
            <div className="rounded-2xl px-3 py-2" style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.06)' }}><div className="text-[9px] uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.34)' }}>Compliance</div><div className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.78)' }}>{selected.compliance_needed ? 'Needs review' : 'Looks OK'}</div></div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {(selected.bucket === 'draft' || selected.bucket === 'needs_nda' || selected.bucket === 'nda_sent') && <button type="button" disabled={!!busy} onClick={() => sendDoc(selected, 'nda')} className="rounded-full px-3 py-1.5 text-[11px] font-semibold disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #FBBF24, #F97316)', color: '#111827' }}>{busy === 'nda' ? 'Sending…' : selected.bucket === 'nda_sent' ? 'Resend NDA' : 'Send NDA'}</button>}
            {selected.bucket === 'needs_agreement' && <button type="button" disabled={!!busy} onClick={() => sendDoc(selected, 'agreement')} className="rounded-full px-3 py-1.5 text-[11px] font-semibold disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #8B5CF6, #007CFF)', color: 'white' }}>{busy === 'agreement' ? 'Sending…' : 'Send Agreement'}</button>}
            {selected.bucket === 'agreement_signed' && <button type="button" disabled={!!busy} onClick={() => countersignAgreement(selected)} className="rounded-full px-3 py-1.5 text-[11px] font-semibold disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #34D399, #00C8FF)', color: '#02111d' }}>{busy === 'countersign' ? 'Countersigning…' : 'Countersign Agreement'}</button>}
            {selected.executed_cert_url && <a href={selected.executed_cert_url} target="_blank" rel="noreferrer" className="rounded-full px-3 py-1.5 text-[11px] font-semibold" style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.24)', color: '#34D399' }}>Open Final Copy</a>}
            <button type="button" onClick={() => router.push(selected.open_href)} className="rounded-full px-3 py-1.5 text-[11px] font-semibold" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.62)' }}>Open Dealer</button>
          </div>
        </div>
      )}
    </div>
  )
}
