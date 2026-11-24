/**
 * lib/portal-auth.ts — gatekeeper for public customer-portal data endpoints.
 *
 * The customer portal is PIN-authed (not Clerk). Every /api/portal/[slug]/* data
 * route calls verifyPortal() first: it loads the portal config, and if a PIN is
 * set, requires the pp_<slug> cookie (set by /verify) to match. Then the route
 * fetches the site's data server-side with the SITE's stored vendor credentials
 * — same feeds as the internal page, but the customer never sees the keys.
 */
import { createHash } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { managerFromSession, gateGuardStaff } from '@/lib/portal-manager'
import type { NextRequest } from 'next/server'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export type PortalCtx = {
  site_id: string | null
  org_id: string
  slug: string
  modules: string[]
  camera_ids: string[] | null
  door_ids: string[] | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  branding: any
}

export type PortalVerify =
  | { ok: true; portal: PortalCtx }
  | { ok: false; status: number; error: string }

export async function verifyPortal(req: NextRequest, slug: string): Promise<PortalVerify> {
  const { data: portal } = await db()
    .from('client_portals')
    .select('id, site_id, org_id, slug, modules, camera_ids, door_ids, branding, access_pin, status')
    .ilike('slug', slug)
    .maybeSingle()

  if (!portal || portal.status === 'disabled') return { ok: false, status: 404, error: 'Portal not found.' }

  // If a PIN is configured, require the matching verified cookie.
  // In = the shared view code cookie OR a signed-in manager (their PIN is their login).
  if (portal.access_pin) {
    const cookie = req.cookies.get(`pp_${slug}`)?.value
    if (!cookie || cookie !== portal.access_pin) {
      const pmRaw = req.cookies.get(`pm_${slug}`)?.value
      const m = await managerFromSession(pmRaw, portal.id)
      if (!m && !(await gateGuardStaff())) {
        // Say which sign-in was checked and why it failed (shown on the portal's bar).
        const { auth } = await import('@clerk/nextjs/server')
        const clerkId = await Promise.resolve(auth()).then(a => a.userId).catch(() => null)
        const why = [
          `view code ${cookie ? 'out of date' : 'not entered'}`,
          `manager sign-in ${pmRaw ? (pmRaw.includes('.') ? 'not valid — PIN changed or turned off?' : 'from before the update — sign in again') : 'none'}`,
          `Gate Guard login ${clerkId ? 'not corporate' : 'not seen'}`,
        ].join(' · ')
        return { ok: false, status: 401, error: `Locked — enter your PIN. (${why})` }
      }
    }
  }

  return {
    ok: true,
    portal: {
      site_id: portal.site_id,
      org_id: portal.org_id,
      slug: portal.slug,
      modules: (portal.modules as string[]) ?? [],
      camera_ids: (portal.camera_ids as string[] | null) ?? null,
      door_ids: (portal.door_ids as string[] | null) ?? null,
      branding: portal.branding ?? {},
    },
  }
}

/** Is this door on the portal? (client_portals.door_ids — empty list = every door.) */
export function portalDoorAllowed(portal: { door_ids: string[] | null }, doorId: string): boolean {
  return !portal.door_ids || portal.door_ids.length === 0 || portal.door_ids.map(String).includes(String(doorId))
}

// Shared hash (must match /api/portal/[slug]/verify).
export function hashPortalPin(pin: string): string {
  return createHash('sha256').update(`gg-portal:${pin.trim()}`).digest('hex')
}
