// lib/brivo-scope.ts
// Decides which Brivo sites a caller may see/manage, by org.brivo_site_id:
//   corporate → every site; dealer → their subtree; PM → their own org.
import { createClient } from '@supabase/supabase-js'
import { resolveOrgScope } from '@/lib/org-scope'
import type { getCurrentUser } from '@/lib/current-user'

type PortalUser = Awaited<ReturnType<typeof getCurrentUser>>

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export interface BrivoSite { org_id: string; name: string; brivo_site_id: string }

export async function allowedBrivoSites(user: PortalUser): Promise<BrivoSite[]> {
  const scope = await resolveOrgScope(user)
  let q = db()
    .from('organizations')
    .select('id,name,brivo_site_id')
    .not('brivo_site_id', 'is', null)
    .order('name')
  if (!scope.all) {
    q = q.in('id', scope.ids.length ? scope.ids : ['00000000-0000-0000-0000-000000000000'])
  }
  const { data } = await q
  return (data ?? [])
    .filter((o) => o.brivo_site_id)
    .map((o) => ({ org_id: o.id, name: o.name as string, brivo_site_id: String(o.brivo_site_id) }))
}

export async function isBrivoSiteAllowed(user: PortalUser, siteId: string): Promise<boolean> {
  if (!siteId) return false
  const sites = await allowedBrivoSites(user)
  return sites.some((s) => s.brivo_site_id === String(siteId))
}

// Each site authenticates with its OWN Brivo credentials, so we work by org_id:
// returns the site (incl. brivo_site_id) only if the caller may manage that org.
export async function getAllowedBrivoSite(user: PortalUser, orgId: string): Promise<BrivoSite | null> {
  if (!orgId) return null
  const sites = await allowedBrivoSites(user)
  return sites.find((s) => s.org_id === orgId) ?? null
}
