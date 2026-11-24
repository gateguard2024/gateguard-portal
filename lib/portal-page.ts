/**
 * lib/portal-page.ts — server-side gate for ops portal pages. Loads the portal by
 * slug and enforces the shared view PIN (pp_<slug> cookie) the same way page.tsx
 * does, so each sub-route can render <PinGate/> when locked.
 */
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { managerFromSession, gateGuardStaff } from '@/lib/portal-manager'

export type PortalPage =
  | { notFound: true }
  | { locked: true; displayName: string }
  | { portal: { slug: string; site_id: string | null; displayName: string; modules: string[] } }

export async function loadPortalPage(slug: string): Promise<PortalPage> {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: portal } = await sb
    .from('client_portals')
    .select('id, slug, site_id, branding, modules, status, access_pin')
    .ilike('slug', slug)
    .maybeSingle()

  if (!portal || portal.status === 'disabled') return { notFound: true }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const displayName = (portal.branding as any)?.display_name || portal.slug

  if (portal.access_pin) {
    const c = cookies().get(`pp_${slug}`)?.value
    if (!c || c !== portal.access_pin) {
      // A signed-in manager is in (their personal PIN is their login, no expiry).
      const m = await managerFromSession(cookies().get(`pm_${slug}`)?.value, portal.id)
      // Gate Guard staff signed in to Nexus get in too (logged as a staff visit).
      if (!m && !(await gateGuardStaff(portal.site_id))) return { locked: true, displayName }
    }
  }
  return { portal: { slug: portal.slug, site_id: portal.site_id, displayName, modules: (portal.modules as string[]) ?? [] } }
}
