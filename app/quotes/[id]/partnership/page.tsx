'use client'

/**
 * /quotes/[id]/partnership — rep-facing editor for the Property Partnership letter.
 * Full-screen, steel, no portal sidebar. Left form drives the live client letter.
 */
import { useParams } from 'next/navigation'
import { PartnershipEditor } from '@/components/quotes/PartnershipEditor'

export default function PartnershipEditorPage() {
  const params = useParams()
  const id = String(params?.id ?? '')
  return <PartnershipEditor id={id} />
}
