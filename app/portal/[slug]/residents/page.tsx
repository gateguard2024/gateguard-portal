import { notFound } from 'next/navigation'
import { loadPortalPage } from '@/lib/portal-page'
import { PinGate } from '@/components/portal/PinGate'
import ResidentsClient from '@/components/portal/ops/ResidentsClient'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: { slug: string } }) {
  const g = await loadPortalPage(params.slug)
  if ('notFound' in g) notFound()
  if ('locked' in g) return <PinGate slug={params.slug} displayName={g.displayName} />
  return <ResidentsClient slug={params.slug} displayName={g.portal.displayName} />
}
