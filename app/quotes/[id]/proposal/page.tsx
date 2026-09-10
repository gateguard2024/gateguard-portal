'use client'

/**
 * /quotes/[id]/proposal — the ONE customer-facing proposal (Phase 1).
 *
 * Thin wrapper: fetch the public payload, render the unified module-driven
 * ProposalView inside the branded NexusDocShell. The old ~900-line bespoke page
 * (and the separate /approve clone) are replaced by the shared renderer so there
 * is a single source of truth for layout, totals, optional add-ons, and sign.
 */
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { NexusDocShell } from '@/components/public/NexusDocShell'
import ProposalView from '@/components/public/ProposalView'
import { PartnershipProposal } from '@/components/public/PartnershipProposal'
import type { PricedLine } from '@/lib/proposal-modules'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Payload = { quote: any; lineItems: PricedLine[]; review_hold?: boolean; review_status?: string }

export default function ProposalPage() {
  const params = useParams()
  const id = String(params?.id ?? '')
  const [data, setData] = useState<Payload | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let live = true
    fetch(`/api/quotes/${id}/public`)
      .then(r => r.json())
      .then(j => { if (!live) return; if (j?.error) setErr(j.error); else if (j?.review_hold) setData({ quote: null, lineItems: [], review_hold: true, review_status: j.review_status }); else setData(j) })
      .catch(() => { if (live) setErr('Could not load this proposal.') })
    return () => { live = false }
  }, [id])

  const center = (node: React.ReactNode) => (
    <NexusDocShell>
      <div style={{ padding: 48, textAlign: 'center', color: '#9fc2dc', fontFamily: 'ui-sans-serif,system-ui' }}>{node}</div>
    </NexusDocShell>
  )
  if (err) return center(err)
  if (!data) return center('Loading proposal…')
  if (data.review_hold) return center(
    <div style={{ maxWidth: 420, margin: '0 auto' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#e6f1fb', marginBottom: 8 }}>This proposal is being finalized</div>
      <div style={{ fontSize: 14, lineHeight: 1.6 }}>It’s in final review with the GateGuard team and will be available shortly. Please check back, or contact your GateGuard representative.</div>
    </div>
  )

  const isPartnership = data.quote?.quote_mode === 'partnership' || !!data.quote?.partnership
  return (
    <NexusDocShell
      meta={{ number: data.quote?.quote_number, validUntil: data.quote?.valid_until ?? data.quote?.expiry_date }}
      onDownload={() => window.print()}
    >
      {isPartnership
        ? <PartnershipProposal quote={data.quote} cfg={data.quote?.partnership ?? {}} />
        : <ProposalView quote={data.quote} lineItems={data.lineItems ?? []} />}
    </NexusDocShell>
  )
}
