'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Bucket =
  | 'draft'
  | 'needs_nda'
  | 'nda_sent'
  | 'nda_signed'
  | 'needs_agreement'
  | 'agreement_signed'
  | 'needs_compliance'
  | 'ready_to_approve'
  | 'live'

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
  compliance_needed: boolean
  bucket: Bucket
  resume_href: string
  open_href: string
}

const buckets: Bucket[] = [
  'draft',
  'needs_nda',
  'nda_sent',
  'needs_agreement',
  'needs_compliance',
  'ready_to_approve',
  'live',
]

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
  if (bucket === 'needs_compliance') return '#F87171'
  if (bucket === 'needs_nda' || bucket === 'needs_agreement') return '#FBBF24'
  if (bucket === 'nda_sent') return '#8B5CF6'
  return '#64748B'
}

function tierText(item: DealerItem) {
  return item.tier_label || item.org_tier || 'Partner'
}

export function InternalDealerOnboardingBoard() {
  const router = useRouter()
  const [items, setItems] = useState<DealerItem[]>([])
  const [bucket, setBucket] = useState<Bucket>('needs_nda')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
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
    void load()
  }, [])

  const shown = items.filter(item => item.bucket === bucket)
  const selected = items.find(item => item.id === selectedId) ?? null

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
        {buckets.map(nextBucket => {
          const c = color(nextBucket)
          const count = items.filter(item => item.bucket === nextBucket).length
          const active = bucket === nextBucket
          return (
            <button key={nextBucket} type="button" onClick={() => { setBucket(nextBucket); setSelectedId(null) }} className="rounded-2xl px-3 py-3 text-left" style={{ background: active ? `${c}1f` : 'rgba(0,0,0,0.18)', border: active ? `1px solid ${c}66` : '1px solid rgba(255,255,255,0.06)' }}>
              <div className="text-[9px] uppercase tracking-[0.12em]" style={{ color: c }}>{label(nextBucket)}</div>
              <div className="mt-1 text-lg font-semibold" style={{ color: 'rgba(255,255,255,0.94)' }}>{count}</div>
            </button>
          )
        })}
      </div>

      {loading && <div className="rounded-2xl p-4 text-xs" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.48)' }}>Loading dealer onboarding…</div>}
      {message && <div className="rounded-2xl p-4 text-xs" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.48)' }}>{message}</div>}
      {!loading && shown.length === 0 && !message && <div className="rounded-2xl p-4 text-xs" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.48)' }}>No {label(bucket).toLowerCase()} records right now.</div>}

      <div className="space-y-2">
        {shown.map(item => {
          const c = color(item.bucket)
          const active = selectedId === item.id
          return (
            <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className="w-full rounded-2xl px-3 py-3 text-left" style={{ background: active ? `${c}1f` : 'rgba(0,0,0,0.18)', border: active ? `1px solid ${c}66` : '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>{item.title}</div>
                  <div className="mt-1 text-[11px]" style={{ color: 'rgba(255,255,255,0.48)' }}>{tierText(item)} • {item.contact_email || item.subtitle}</div>
                  <div className="mt-1 text-[10px]" style={{ color: 'rgba(255,255,255,0.34)' }}>NDA: {item.nda_status} • Agreement: {item.agreement_status}</div>
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

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-2xl px-3 py-2" style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.06)' }}><div className="text-[9px] uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.34)' }}>NDA</div><div className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.78)' }}>{selected.nda_status}</div></div>
            <div className="rounded-2xl px-3 py-2" style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.06)' }}><div className="text-[9px] uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.34)' }}>Agreement</div><div className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.78)' }}>{selected.agreement_status}</div></div>
            <div className="rounded-2xl px-3 py-2" style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.06)' }}><div className="text-[9px] uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.34)' }}>Compliance</div><div className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.78)' }}>{selected.compliance_needed ? 'Needs review' : 'Looks OK'}</div></div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => router.push(selected.resume_href)} className="rounded-full px-3 py-1.5 text-[11px] font-semibold" style={{ background: 'linear-gradient(135deg, #8B5CF6, #007CFF)', color: 'white' }}>Resume Onboarding</button>
            <button type="button" onClick={() => router.push(selected.open_href)} className="rounded-full px-3 py-1.5 text-[11px] font-semibold" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.62)' }}>Open Dealer</button>
          </div>
        </div>
      )}
    </div>
  )
}
