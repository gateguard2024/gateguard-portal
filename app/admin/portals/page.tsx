import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

// The old dark "Customer Portals" page is retired (decided 2026-11-03: no legacy
// pages). Property portals are set up in Admin → Property portals, or on each
// property's Systems page → "Property portal" (components/nexus/systems/PropertyPortal.tsx).
// Old links (sidebar, Setup checklist, bookmarks) land on the new screen.
export default function AdminPortalsRedirect() {
  redirect('/?view=admin&portals=1')
}
