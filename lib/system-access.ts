/**
 * lib/system-access.ts — SERVER ONLY.
 * Dealer-admin-managed "Site Systems" access: who on a dealer's team may operate
 * each system (doors / cameras / relays / door users) and at which sites.
 *
 * Rules:
 *  - Corporate → everything.
 *  - Admin role within the site's org → everything (the dealer admin operates all).
 *  - Other staff → only the capabilities granted, at all-sites or the listed sites.
 *  - A site must always be in the user's org scope regardless.
 */
import { createClient } from '@supabase/supabase-js'
import { resolveOrgScope } from '@/lib/org-scope'
import { normalizeRole } from '@/lib/permissions'
import type { getCurrentUser } from '@/lib/current-user'

type PortalUser = Awaited<ReturnType<typeof getCurrentUser>>
const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export type Capability = 'doors' | 'cameras' | 'relays' | 'door_users' | 'network'
export const CAPABILITIES: { key: Capability; label: string; icon: string }[] = [
  { key: 'doors',      label: 'Doors (unlock)',     icon: '🚪' },
  { key: 'door_users', label: 'Door users (add/remove)', icon: '👥' },
  { key: 'cameras',    label: 'Cameras (view)',     icon: '📹' },
  { key: 'relays',     label: 'Relays / power',     icon: '🔌' },
  { key: 'network',    label: 'Network (UniFi)',    icon: '🌐' },
]

export interface MemberAccess { capabilities: Capability[]; all_sites: boolean; site_ids: string[] }

export async function getMemberSystemAccess(clerkUserId: string, orgId: string | null): Promise<MemberAccess> {
  const { data } = await db().from('member_system_access').select('capabilities, all_sites, site_ids')
    .eq('clerk_user_id', clerkUserId).eq('org_id', orgId).maybeSingle()
  return {
    capabilities: (data?.capabilities ?? []) as Capability[],
    all_sites: data?.all_sites ?? false,
    site_ids: (data?.site_ids ?? []) as string[],
  }
}

export async function setMemberSystemAccess(clerkUserId: string, orgId: string | null, a: MemberAccess): Promise<{ error: string | null }> {
  const { error } = await db().from('member_system_access').upsert({
    clerk_user_id: clerkUserId, org_id: orgId,
    capabilities: a.capabilities, all_sites: a.all_sites, site_ids: a.site_ids,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'clerk_user_id,org_id' })
  return { error: error?.message ?? null }
}

async function siteInScope(user: PortalUser, siteId: string): Promise<boolean> {
  const scope = await resolveOrgScope(user)
  if (scope.all) return true
  const { data } = await db().from('sites').select('master_dealer_id, install_dealer_id, service_dealer_id, org_id').eq('id', siteId).maybeSingle()
  if (!data) return false
  return [data.master_dealer_id, data.install_dealer_id, data.service_dealer_id, data.org_id].some(o => o && scope.ids.includes(o))
}

/** Can this user operate `capability` at `siteId`? Enforced on operate endpoints. */
export async function canOperate(user: PortalUser, siteId: string, capability: Capability): Promise<boolean> {
  if (!siteId) return false
  if (!(await siteInScope(user, siteId))) return false
  if (user.isCorporate) return true
  if (normalizeRole(user.role) === 'admin') return true   // dealer admin operates everything
  const access = await getMemberSystemAccess(user.id, user.org_id)
  if (!access.capabilities.includes(capability)) return false
  return access.all_sites || access.site_ids.includes(siteId)
}
