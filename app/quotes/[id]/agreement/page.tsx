'use client'

/**
 * /quotes/[id]/agreement — client-facing Partnership service agreement, generated
 * from the same partnership config as the proposal. Full-screen, print → PDF.
 */
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { NexusDocShell } from '@/components/public/NexusDocShell'
import { PartnershipAgreement } from '@/components/public/PartnershipAgreement'

export default function AgreementPage() {
  const params = useParams()
  const id = String(params?.id ?? '')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [quote, setQuote] = useState<any>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    fetch(`/api/quotes/${id}/public`).then(r => r.json())
      .then(j => { if (j?.error) setErr(j.error); else setQuote(j.quote) })
      .catch(() => setErr('Could not load this agreement.'))
  }, [id])

  const wrap = (n: React.ReactNode) => (
    <NexusDocShell meta={{ number: quote?.quote_number }} onDownload={() => window.print()}>
      {n}
    </NexusDocShell>
  )
  if (err) return wrap(<div style={{ padding: 48, color: '#9fc2dc', textAlign: 'center' }}>{err}</div>)
  if (!quote) return wrap(<div style={{ padding: 48, color: '#9fc2dc', textAlign: 'center' }}>Loading agreement…</div>)
  return wrap(<PartnershipAgreement quote={quote} cfg={quote?.partnership ?? {}} />)
}
