import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

// /portal/<site> → the property portal (Nexus Property shell). This used to render the
// old steel-theme CustomerPortalTemplate; the new portal is the only property portal
// now (decided 2026-11-02). Links from Admin → Customer Portals, the Systems Setup
// checklist and Lexi all land here. The view-PIN gate runs on the dashboard page.
export default function PortalHome({ params }: { params: { slug: string } }) {
  redirect(`/portal/${encodeURIComponent(params.slug)}/dashboard`)
}
