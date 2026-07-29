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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  branding: any
}

export type PortalVerify =
  | { ok: true; portal: PortalCtx }
  | { ok: false; status: number; error: string }

export async function verifyPortal(req: NextRequest, slug: string): Promise<PortalVerify> {
  const { data: portal } = await db()
    .from('client_portals')
    .select('site_id, org_id, slug, modules, camera_ids, branding, access_pin, status')
    .ilike('slug', slug)
    .maybeSingle()

  if (!portal || portal.status === 'disabled') return { ok: false, status: 404, error: 'Portal not found.' }

  // If a PIN is configured, require the matching verified cookie.
  if (portal.access_pin) {
    const cookie = req.cookies.get(`pp_${slug}`)?.value
    if (!cookie || cookie !== portal.access_pin) return { ok: false, status: 401, error: 'Locked — enter the access code.' }
  }

  return {
    ok: true,
    portal: {
      site_id: portal.site_id,
      org_id: portal.org_id,
      slug: portal.slug,
      modules: (portal.modules as string[]) ?? [],
      camera_ids: (portal.camera_ids as string[] | null) ?? null,
      branding: portal.branding ?? {},
    },
  }
}

// Shared hash (must match /api/portal/[slug]/verify).
export function hashPortalPin(pin: string): string {
  return createHash('sha256').update(`gg-portal:${pin.trim()}`).digest('hex')
}
