/**
 * lib/portal-manager.ts — per-manager personal sign-in for the customer ops portal.
 *
 * A manager's personal PIN is their LOGIN (no Clerk — Nov 24 2026): it opens the
 * portal and signs them in for control, and they STAY signed in on that device until
 * they press Sign out (no expiry). The pm_<slug> cookie is `<manager id>.<signature>`;
 * the signature covers the manager's current PIN hash, so changing their PIN, turning
 * them off or removing them ends every session at once. Sign-ins and sign-outs are
 * logged in site_events (portal_sign_in / portal_sign_out).
 * The portal's own code (client_portals.access_pin, set by Gate Guard in Nexus) is the
 * GATE GUARD PIN: it signs in as "Gate Guard" with full control (Nov 24 2026 — it's
 * Gate Guard's only PIN). Session `gg.<sig>`, tied to that code: changing it in Nexus
 * signs Gate Guard out everywhere. Never give this code to a property — they each get
 * their own personal PIN.
 */
import { createHash, createHmac, timingSafeEqual } from 'crypto'
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

/** Browsers cap cookie life at 400 days — "doesn't expire" for a busy manager. */
export const MANAGER_COOKIE = { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/', maxAge: 60 * 60 * 24 * 400 }

function sessionKey(): string {
  const k = process.env.PORTAL_SESSION_KEY || process.env.CREDENTIALS_ENC_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!k) throw new Error('No key to sign portal sessions (set PORTAL_SESSION_KEY or CREDENTIALS_ENC_KEY).')
  return k
}
const sign = (id: string, pinHash: string) => createHmac('sha256', sessionKey()).update(`gg-pm:${id}|${pinHash}`).digest('base64url').slice(0, 32)

/** The cookie value for a signed-in manager (see header). */
export function managerSession(id: string, pinHash: string): string { return `${id}.${sign(id, pinHash)}` }

/** The built-in Gate Guard sign-in (the portal's own code). */
export const GATE_GUARD_ID = 'gate-guard'
const portalCodeHash = (pin: string) => createHash('sha256').update(`gg-portal:${pin.trim()}`).digest('hex') // = portal-auth hashPortalPin
export function gateGuardSession(accessPinHash: string): string { return `gg.${sign(GATE_GUARD_ID, accessPinHash)}` }

/** Check a pm_ cookie against this portal's managers → the active manager, or null. */
export async function managerFromSession(value: string | undefined | null, portalId: string): Promise<PortalManager | null> {
  if (!value) return null
  if (value.startsWith('gg.')) {
    const { data } = await db().from('client_portals').select('access_pin').eq('id', portalId).maybeSingle()
    if (!data?.access_pin) return null
    const want = Buffer.from(sign(GATE_GUARD_ID, data.access_pin)), got = Buffer.from(value.slice(3))
    return want.length === got.length && timingSafeEqual(want, got) ? { id: GATE_GUARD_ID, name: 'Gate Guard', email: null } : null
  }
  const dot = value.lastIndexOf('.')
  if (dot < 1) return null // old unsigned cookie (just an id) → sign in again
  const id = value.slice(0, dot), sig = value.slice(dot + 1)
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const { data } = await db().from('portal_managers').select('id, name, email, active, pin_hash').eq('id', id).eq('client_portal_id', portalId).maybeSingle()
  if (!data || !data.active || !data.pin_hash) return null
  const want = Buffer.from(sign(data.id, data.pin_hash)), got = Buffer.from(sig)
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null
  return { id: data.id, name: data.name, email: data.email ?? null }
}

/** The portal row id for a slug (managers are scoped to one portal). */
async function portalRow(slug: string): Promise<{ id: string; site_id: string | null; org_id: string; access_pin: string | null } | null> {
  const { data } = await db()
    .from('client_portals')
    .select('id, site_id, org_id, status, access_pin')
    .ilike('slug', slug)
    .maybeSingle()
  if (!data || data.status === 'disabled') return null
  return { id: data.id, site_id: data.site_id, org_id: data.org_id, access_pin: data.access_pin ?? null }
}

/** Resolve the signed-in manager from the pm_<slug> cookie, or null. */
export async function getPortalManager(req: NextRequest, slug: string): Promise<PortalManager | null> {
  const value = req.cookies.get(`pm_${slug}`)?.value
  if (!value) return null
  const portal = await portalRow(slug)
  if (!portal) return null
  return managerFromSession(value, portal.id)
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
  // The portal's own code = the Gate Guard PIN (full control, signed in as "Gate Guard").
  if (portal.access_pin && portalCodeHash(pin) === portal.access_pin) {
    return { id: GATE_GUARD_ID, name: 'Gate Guard', email: null, session: gateGuardSession(portal.access_pin) } as PortalManager & { session: string }
  }
  const hash = hashManagerPin(pin)
  const m = (data ?? []).find(r => r.pin_hash === hash)
  return m ? { id: m.id, name: m.name, email: m.email ?? null, session: managerSession(m.id, m.pin_hash) } as PortalManager & { session: string } : null
}

/** Gate Guard staff signed in to Nexus in this browser (corporate only) — they can open
 * any property portal to look and manage its managers, without a PIN. Each visit is
 * logged once per 12 h per person per property ('portal_staff_view'). Never throws. */
export async function gateGuardStaff(siteId?: string | null): Promise<{ id: string; name: string } | null> {
  try {
    const { getCurrentUser } = await import('@/lib/current-user')
    const u = await getCurrentUser()
    if (!u.isCorporate || !u.id || u.id === 'system' || u.id === 'anonymous') return null
    const staff = { id: String(u.id), name: `${u.name || u.email || 'Gate Guard'} (Gate Guard)` }
    if (siteId) {
      const since = new Date(Date.now() - 12 * 3600_000).toISOString()
      const { count } = await db().from('site_events').select('id', { count: 'exact', head: true }).eq('site_id', siteId).eq('event_type', 'portal_staff_view').gte('created_at', since).eq('metadata->>staff_id', staff.id)
      if (!count) {
        const { error } = await db().from('site_events').insert({ site_id: siteId, event_type: 'portal_staff_view', title: `${staff.name} opened the property portal`, metadata: { staff_id: staff.id, by: staff.name } })
        if (error) console.error('[portal staff] log failed:', error.message)
      }
    }
    return staff
  } catch { return null }
}

/** Log a sign-in / sign-out for the property (Settings → Managers shows these). */
export async function logManagerSession(siteId: string | null | undefined, kind: 'in' | 'out', m: { id: string; name: string }, how: string) {
  if (!siteId) return
  const { error } = await db().from('site_events').insert({
    site_id: siteId, event_type: kind === 'in' ? 'portal_sign_in' : 'portal_sign_out',
    title: `${m.name} signed ${kind} ${kind === 'in' ? 'to' : 'of'} the property portal`,
    metadata: { manager_id: m.id, by: m.name, how },
  })
  if (error) console.error(`[portal sign-${kind}] log failed:`, error.message)
}

export { portalRow as portalRowForSlug }
