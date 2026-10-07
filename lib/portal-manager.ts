/**
 * lib/portal-manager.ts — per-manager personal sign-in for the customer ops portal.
 *
 * The shared PIN (client_portals.access_pin) is view-only. Control actions call
 * getPortalManager() first: it reads the pm_<slug> cookie (a verified manager id,
 * set by /api/portal/[slug]/manager/verify) and returns the named, active manager
 * for that portal — so site_events can record WHO ran the command.
 */
import { createHash } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

/** Personal-PIN hash — deliberately a different salt from the shared portal PIN. */
export function hashManagerPin(pin: string): string {
  return createHash('sha256').update(`gg-portal-mgr:${pin.trim()}`).digest('hex')
}

export type PortalManager = { id: string; name: string; email: string | null }

/** The portal row id for a slug (managers are scoped to one portal). */
async function portalRow(slug: string): Promise<{ id: string; site_id: string | null; org_id: string } | null> {
  const { data } = await db()
    .from('client_portals')
    .select('id, site_id, org_id, status')
    .ilike('slug', slug)
    .maybeSingle()
  if (!data || data.status === 'disabled') return null
  return { id: data.id, site_id: data.site_id, org_id: data.org_id }
}

/** Resolve the signed-in manager from the pm_<slug> cookie, or null. */
export async function getPortalManager(req: NextRequest, slug: string): Promise<PortalManager | null> {
  const mid = req.cookies.get(`pm_${slug}`)?.value
  if (!mid) return null
  const portal = await portalRow(slug)
  if (!portal) return null
  const { data } = await db()
    .from('portal_managers')
    .select('id, name, email, active, client_portal_id')
    .eq('id', mid)
    .eq('client_portal_id', portal.id)
    .maybeSingle()
  if (!data || !data.active) return null
  return { id: data.id, name: data.name, email: data.email ?? null }
}

/** Verify a personal PIN against this portal's active managers; returns the match. */
export async function matchManagerPin(slug: string, pin: string): Promise<PortalManager | null> {
  const portal = await portalRow(slug)
  if (!portal) return null
  const { data } = await db()
    .from('portal_managers')
    .select('id, name, email, pin_hash, active')
    .eq('client_portal_id', portal.id)
    .eq('active', true)
  const hash = hashManagerPin(pin)
  const m = (data ?? []).find(r => r.pin_hash === hash)
  return m ? { id: m.id, name: m.name, email: m.email ?? null } : null
}

export { portalRow as portalRowForSlug }
