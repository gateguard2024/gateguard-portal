import Link from 'next/link'
import { notFound } from 'next/navigation'
import { loadPortalPage } from '@/lib/portal-page'
import { PinGate } from '@/components/portal/PinGate'
import { OpsShell, C } from '@/components/portal/ops/OpsShell'

export const dynamic = 'force-dynamic'

// Property-portal tabs that are designed (canvas "Property Portal" page) but not
// built yet. Built tabs have their own static route folder, which Next.js matches
// before this one. Delete an entry here when its real page ships.
const SECTIONS: Record<string, { title: string; body: string; today?: { label: string; path: string } }> = {
  packages: { title: 'Packages', body: 'Deliveries, pickups, and hold fees for the package room and lockers.' },
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
      <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em' }}>{s.title}</h1>
      <section style={{ marginTop: 20, maxWidth: 640, background: C.card, borderRadius: 12, padding: 24, boxShadow: '0 1px 2px rgba(0,0,0,.04), 0 6px 20px -12px rgba(0,0,0,.18)' }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>Coming to this tab</div>
        <p style={{ margin: '6px 0 0', color: C.ink3, fontSize: 14 }}>{s.body}</p>
        {s.today && (
          <Link href={`/portal/${params.slug}/${s.today.path}`} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, marginTop: 8, color: C.blue, fontWeight: 600, textDecoration: 'none' }}>
            {s.today.label} →
          </Link>
        )}
      </section>
    </OpsShell>
  )
}
