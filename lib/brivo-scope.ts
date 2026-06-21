// lib/brivo-scope.ts
// Which Brivo sites a caller may see/manage. Two sources, merged:
//   1) PER-SITE vault (site_integrations vendor='brivo') — the current model.
//   2) Legacy per-ORG config (organizations.brivo_site_id) — kept for back-compat.
// Scope: corporate → all; others → their org subtree.
import { createClient } from '@supabase/supabase-js'
import { resolveOrgScope } from '@/lib/org-scope'
import { getSiteVendorCreds } from '@/lib/site-integrations'
import type { getCurrentUser } from '@/lib/current-user'

type PortalUser = Awaited<ReturnType<typeof getCurrentUser>>

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// org_id (legacy) OR site_id (vault). brivo_site_id is the Brivo-side site id.
export interface BrivoSite { org_id?: string; site_id?: string; name: string; brivo_site_id: string }

// Per-site vault Brivo sites within the caller's scope.
async function vaultBrivoSites(scope: { all: boolean; ids: string[] }): Promise<BrivoSite[]> {
  let q = db().from('site_integrations').select('site_id, sites!inner(id, name, org_id, master_dealer_id, install_dealer_id, service_dealer_id)').eq('vendor', 'brivo')
  const { data } = await q
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data ?? []) as any[]
  const out: BrivoSite[] = []
  for (const r of rows) {
    const s = r.sites
    if (!s) continue
    if (!scope.all) {
      const ok = [s.org_id, s.master_dealer_id, s.install_dealer_id, s.service_dealer_id].some((o: string) => o && scope.ids.includes(o))
      if (!ok) continue
    }
    const creds = await getSiteVendorCreds(r.site_id, 'brivo')
    out.push({ site_id: r.site_id, name: s.name ?? 'Site', brivo_site_id: String(creds?.site_id ?? '') })
  }
  return out
}

async function legacyOrgBrivoSites(scope: { all: boolean; ids: string[] }): Promise<BrivoSite[]> {
  let q = db().from('organizations').select('id,name,brivo_site_id').not('brivo_site_id', 'is', null).order('name')
  if (!scope.all) q = q.in('id', scope.ids.length ? scope.ids : ['00000000-0000-0000-0000-000000000000'])
  const { data } = await q
  return (data ?? []).filter(o => o.brivo_site_id).map(o => ({ org_id: o.id, name: o.name as string, brivo_site_id: String(o.brivo_site_id) }))
}

export async function allowedBrivoSites(user: PortalUser): Promise<BrivoSite[]> {
  const scope = await resolveOrgScope(user)
  const [vault, legacy] = await Promise.all([vaultBrivoSites(scope), legacyOrgBrivoSites(scope)])
  return [...vault, ...legacy]
}

// Legacy per-org accessor (unchanged signature).
export async function getAllowedBrivoSite(user: PortalUser, orgId: string): Promise<BrivoSite | null> {
  if (!orgId) return null
  const sites = await legacyOrgBrivoSites(await resolveOrgScope(user))
  return sites.find((s) => s.org_id === orgId) ?? null
}

// Per-site accessor: confirm the caller may manage this site (and it has Brivo creds).
export async function getAllowedVaultBrivoSite(user: PortalUser, siteId: string): Promise<BrivoSite | null> {
  if (!siteId) return null
  const scope = await resolveOrgScope(user)
  const sites = await vaultBrivoSites(scope)
  return sites.find((s) => s.site_id === siteId) ?? null
}
