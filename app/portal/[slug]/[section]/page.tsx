import { notFound } from 'next/navigation'
import { loadPortalPage } from '@/lib/portal-page'
import { PinGate } from '@/components/portal/PinGate'
import { OpsShell } from '@/components/portal/ops/OpsShell'
import { ComingSoon } from '@/components/portal/ops/ComingSoon'

export const dynamic = 'force-dynamic'

// Property-portal tabs that are designed (canvas "Property Portal" page) but not
// built yet. Built tabs have their own static route folder, which Next.js matches
// before this one. Delete an entry here when its real page ships.
const SECTIONS: Record<string, { title: string; body: string; today?: { label: string; path: string } }> = {
  units: { title: 'Units', body: 'Smart locks and unit security, unit by unit.' },
  movein: { title: 'Move-in & Renewals', body: 'Your move-in and renewal portals: fees, revenue share, and the wording and look residents see.' },
  service: { title: 'Service', body: 'Service requests and GateGuard visits for this property.' },
  billing: { title: 'Billing', body: 'Invoices, payments, and revenue share in one place.', today: { label: 'Billing & payments are on the Dashboard for now', path: 'dashboard' } },
  settings: { title: 'Settings', body: 'Staff users and permissions, and settings for this site.' },
}

export default async function Page({ params }: { params: { slug: string; section: string } }) {
  const s = SECTIONS[params.section]
  if (!s) notFound()
  const g = await loadPortalPage(params.slug)
  if ('notFound' in g) notFound()
  if ('locked' in g) return <PinGate slug={params.slug} displayName={g.displayName} />

  return (
    <OpsShell slug={params.slug} displayName={g.portal.displayName} active={params.section}>
      <ComingSoon title={s.title} body={s.body} link={s.today ? { label: s.today.label, href: `/portal/${params.slug}/${s.today.path}` } : undefined} />
    </OpsShell>
  )
}
