'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { stageForBucket, VETTING_OPTIONS, type ReviewPoint } from '@/lib/dealer-onboarding'

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
  nda_signature_id?: string | null
  nda_executed_cert_url?: string | null
  agreement_status: string
  agreement_signature_id?: string | null
  agreement_executed_cert_url?: string | null
  executed_cert_url?: string | null
  compliance_needed: boolean
  next_action?: string | null
  bucket: Bucket
  channel_manager_name?: string | null
  vetting_status?: string | null
  reviews?: ReviewPoint[]
  resume_href: string
  open_href: string
}

const buckets: Bucket[] = ['draft', 'needs_nda', 'nda_sent', 'nda_signed', 'needs_agreement', 'agreement_signed', 'needs_compliance', 'ready_to_approve', 'live']

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
  if (bucket === 'nda_signed') return '#C4B5FD'
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
  const [uploadingDoc, setUploadingDoc] = useState<'nda' | 'agreement' | null>(null)
  const ndaFileRef = useRef<HTMLInputElement>(null)
  const agreementFileRef = useRef<HTMLInputElement>(null)
  const [cmDraft, setCmDraft] = useState('')
  const [savingHealth, setSavingHealth] = useState(false)

  // Save vetting (stage 1) / channel manager (stage 2) for a partner.
  async function saveHealth(orgId: string, patch: Record<string, string>) {
    setSavingHealth(true); setActionMessage(null)
    try {
      const res = await fetch('/api/nexus/internal/dealer-onboarding', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ org_id: orgId, ...patch }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.success === false) throw new Error(data?.message ?? 'Could not save.')
      setActionMessage('Saved.')
      await load()
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Could not save.')
    } finally { setSavingHealth(false) }
  }

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
  // Keep the channel-manager input in sync with the selected dealer.
  useEffect(() => {
    const sel = items.find(i => i.id === selectedId)
    setCmDraft(sel?.channel_manager_name ?? '')
  }, [selectedId, items])

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

  async function countersignDocument(
    item: DealerItem,
    signatureId: string | null | undefined,
    docLabel: 'NDA' | 'Agreement'
  ) {
    setBusy('countersign')
    setActionMessage(null)
    try {
      if (!signatureId) throw new Error(`No signed ${docLabel} record was found to countersign.`)
      const res = await fetch('/api/signatures/countersign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signature_id: signatureId,
          countersigned_name: 'Russel Feldman',
          countersigned_title: 'CEO',
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.ok === false) throw new Error(data?.error ?? data?.message ?? `${docLabel} countersign failed.`)
      setActionMessage(`${docLabel} countersigned. Final copy is being stored and confirmation emails are being sent.`)
      await load()
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : `Could not countersign ${docLabel}.`)
    } finally {
      setBusy(null)
    }
  }

  async function handleUpload(item: DealerItem, kind: 'nda' | 'agreement', file: File) {
    setUploadingDoc(kind)
    setActionMessage(null)
    try {
      const docType = kind === 'nda' ? 'nda' : agreementType(item)
      const fd = new FormData()
      fd.append('file', file)
      fd.append('org_id', item.id)
      fd.append('document_type', docType)
      if (item.contact_name) fd.append('signer_name', item.contact_name)
      if (item.contact_email) fd.append('signer_email', item.contact_email)
      fd.append('signer_company', item.title)

      const res = await fetch('/api/signatures/upload', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.ok === false) throw new Error(data?.error ?? `${kind === 'nda' ? 'NDA' : 'Agreement'} upload failed.`)
      setActionMessage(`${kind === 'nda' ? 'NDA' : 'Agreement'} uploaded and marked as fully executed.`)
      await load()
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Upload failed.')
    } finally {
      setUploadingDoc(null)
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

      {/* Hidden file inputs — triggered by upload buttons below */}
      <input
        ref={ndaFileRef}
        type="file"
        accept=".pdf,.html,.doc,.docx,.jpg,.jpeg,.png"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file && selected) void handleUpload(selected, 'nda', file)
          e.target.value = ''
        }}
      />
      <input
        ref={agreementFileRef}
        type="file"
        accept=".pdf,.html,.doc,.docx,.jpg,.jpeg,.png"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file && selected) void handleUpload(selected, 'agreement', file)
          e.target.value = ''
        }}
      />

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

          {/* Partner health — 8-stage spec layer: vetting, channel manager, reviews */}
          <div className="mt-4 rounded-2xl p-3" style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center justify-between">
              <div className="text-[9px] uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.34)' }}>Partner health</div>
              <div className="text-[10px] font-semibold" style={{ color: '#C4B5FD' }}>Stage {stageForBucket(selected.bucket).n} of 8 — {stageForBucket(selected.bucket).label}</div>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* Vetting (stage 1) */}
              <div>
                <div className="mb-1 text-[10px]" style={{ color: 'rgba(255,255,255,0.5)' }}>Vetting</div>
                <div className="flex flex-wrap gap-1.5">
                  {VETTING_OPTIONS.map(opt => {
                    const on = (selected.vetting_status ?? 'not_started') === opt.value
                    return <button key={opt.value} type="button" disabled={savingHealth} onClick={() => saveHealth(selected.id, { vetting_status: opt.value })} className="rounded-full px-2.5 py-1 text-[10px] font-semibold disabled:opacity-50" style={{ background: on ? `${opt.color}26` : 'rgba(255,255,255,0.05)', border: `1px solid ${on ? opt.color + '66' : 'rgba(255,255,255,0.1)'}`, color: on ? opt.color : 'rgba(255,255,255,0.6)' }}>{opt.label}</button>
                  })}
                </div>
              </div>
              {/* Channel manager (stage 2) */}
              <div>
                <div className="mb-1 text-[10px]" style={{ color: 'rgba(255,255,255,0.5)' }}>Channel Manager</div>
                <div className="flex gap-1.5">
                  <input value={cmDraft} onChange={e => setCmDraft(e.target.value)} placeholder="Assign a manager" className="min-w-0 flex-1 rounded-lg px-2.5 py-1.5 text-xs outline-none" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.9)' }} />
                  <button type="button" disabled={savingHealth || cmDraft === (selected.channel_manager_name ?? '')} onClick={() => saveHealth(selected.id, { channel_manager_name: cmDraft.trim() })} className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold disabled:opacity-40" style={{ background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.4)', color: '#ddd6fe' }}>Save</button>
                </div>
              </div>
            </div>
            {/* 30/60/90 reviews (stage 8) — live dealers only */}
            {selected.bucket === 'live' && selected.reviews && selected.reviews.length > 0 && (
              <div className="mt-3">
                <div className="mb-1 text-[10px]" style={{ color: 'rgba(255,255,255,0.5)' }}>30 / 60 / 90-day reviews</div>
                <div className="flex flex-wrap gap-1.5">
                  {selected.reviews.map(r => {
                    const c = r.state === 'overdue' ? '#F87171' : r.state === 'due' ? '#FBBF24' : '#34D399'
                    const txt = r.state === 'overdue' ? 'overdue' : r.state === 'due' ? 'due now' : `due ${new Date(r.dueAt).toLocaleDateString()}`
                    return <span key={r.day} className="rounded-full px-2.5 py-1 text-[10px] font-semibold" style={{ background: `${c}22`, border: `1px solid ${c}55`, color: c }}>{r.day}-day · {txt}</span>
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {(selected.bucket === 'draft' || selected.bucket === 'needs_nda' || selected.bucket === 'nda_sent') && <button type="button" disabled={!!busy} onClick={() => sendDoc(selected, 'nda')} className="rounded-full px-3 py-1.5 text-[11px] font-semibold disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #FBBF24, #F97316)', color: '#111827' }}>{busy === 'nda' ? 'Sending…' : selected.bucket === 'nda_sent' ? 'Resend NDA' : 'Send NDA'}</button>}
            {selected.bucket === 'nda_signed' && <button type="button" disabled={!!busy} onClick={() => countersignDocument(selected, selected.nda_signature_id, 'NDA')} className="rounded-full px-3 py-1.5 text-[11px] font-semibold disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #34D399, #00C8FF)', color: '#02111d' }}>{busy === 'countersign' ? 'Countersigning…' : 'Countersign NDA'}</button>}
            {selected.bucket === 'needs_agreement' && <button type="button" disabled={!!busy} onClick={() => sendDoc(selected, 'agreement')} className="rounded-full px-3 py-1.5 text-[11px] font-semibold disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #8B5CF6, #007CFF)', color: 'white' }}>{busy === 'agreement' ? 'Sending…' : 'Send Agreement'}</button>}
            {selected.bucket === 'agreement_signed' && <button type="button" disabled={!!busy} onClick={() => countersignDocument(selected, selected.agreement_signature_id, 'Agreement')} className="rounded-full px-3 py-1.5 text-[11px] font-semibold disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #34D399, #00C8FF)', color: '#02111d' }}>{busy === 'countersign' ? 'Countersigning…' : 'Countersign Agreement'}</button>}
            {/* Upload buttons — for offline/pre-signed docs */}
            {(selected.bucket === 'draft' || selected.bucket === 'needs_nda' || selected.bucket === 'nda_sent' || selected.bucket === 'nda_signed') && !selected.nda_executed_cert_url && (
              <button type="button" disabled={!!uploadingDoc} onClick={() => ndaFileRef.current?.click()} className="rounded-full px-3 py-1.5 text-[11px] font-semibold disabled:opacity-50" style={{ background: 'rgba(196,181,253,0.12)', border: '1px solid rgba(196,181,253,0.28)', color: '#C4B5FD' }}>{uploadingDoc === 'nda' ? 'Uploading…' : 'Upload Signed NDA ↑'}</button>
            )}
            {(selected.bucket === 'needs_agreement' || selected.bucket === 'agreement_signed') && !selected.agreement_executed_cert_url && (
              <button type="button" disabled={!!uploadingDoc} onClick={() => agreementFileRef.current?.click()} className="rounded-full px-3 py-1.5 text-[11px] font-semibold disabled:opacity-50" style={{ background: 'rgba(196,181,253,0.12)', border: '1px solid rgba(196,181,253,0.28)', color: '#C4B5FD' }}>{uploadingDoc === 'agreement' ? 'Uploading…' : 'Upload Executed Agreement ↑'}</button>
            )}
            {selected.nda_executed_cert_url && <a href={selected.nda_executed_cert_url} target="_blank" rel="noreferrer" className="rounded-full px-3 py-1.5 text-[11px] font-semibold" style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.24)', color: '#34D399' }}>Open Final NDA</a>}
            {selected.agreement_executed_cert_url && <a href={selected.agreement_executed_cert_url} target="_blank" rel="noreferrer" className="rounded-full px-3 py-1.5 text-[11px] font-semibold" style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.24)', color: '#34D399' }}>Open Final Agreement</a>}
            <button type="button" onClick={() => router.push(selected.open_href)} className="rounded-full px-3 py-1.5 text-[11px] font-semibold" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.62)' }}>Open Dealer</button>
          </div>
        </div>
      )}
    </div>
  )
}
