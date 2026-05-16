/**
 * lib/org-scope.ts
 *
 * Resolves which organization IDs a portal user is allowed to query.
 *
 * The GateGuard 6-tier hierarchy (stored via parent_id on organizations):
 *
 *   corporate
 *     └── master_agent
 *           └── master_dealer
 *                 ├── sales
 *                 ├── install_dealer
 *                 └── service_dealer
 *                       └── client
 *
 * Visibility rules:
 *   corporate      → all data (no org filter)
 *   master_agent   → their subtree: all master_dealers + all dealers under them
 *   master_dealer  → their subtree: themselves + all dealers under them
 *   dealer (any)   → self only
 *   client         → self only
 *
 * Usage in an API route:
 *   const user  = await getCurrentUser()
 *   const scope = await resolveOrgScope(user)
 *   if (scope.all) {
 *     // no filter — corporate user
 *   } else {
 *     query = query.in('org_id', scope.ids)
 *   }
 */

import { createClient } from '@supabase/supabase-js'
import type { PortalUser } from './current-user'

// Use service role for the hierarchy lookup — this is a read-only metadata query
// that resolves permissions, not data; it runs server-side only.
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export interface OrgScope {
  /** true = corporate user, apply NO org_id filter — they see everything */
  all: boolean
  /**
   * When all=false, filter any query with:
   *   .in('org_id', scope.ids)
   *   or for sites: .or(`master_dealer_id.in.(${ids}),install_dealer_id.in.(${ids}),service_dealer_id.in.(${ids})`)
   */
  ids: string[]
  /** The authenticated user's own org_id, regardless of scope */
  own_id: string | null
}

/**
 * Walk the organizations tree downward from a given org_id using a recursive
 * CTE and return all descendant IDs (inclusive of the root).
 */
async function getDescendantIds(org_id: string): Promise<string[]> {
  const supabase = getSupabase()

  // Recursive CTE: start at org_id, walk children depth-first
  const { data, error } = await supabase.rpc('get_org_subtree', { root_id: org_id })

  if (error || !data) {
    // Fallback: just return own org_id if RPC isn't available yet
    console.warn('[org-scope] get_org_subtree RPC failed, falling back to self-only:', error?.message)
    return [org_id]
  }

  return (data as Array<{ id: string }>).map(r => r.id)
}

export async function resolveOrgScope(user: PortalUser): Promise<OrgScope> {
  // Corporate + admins without an org_id = see everything
  if (user.isCorporate || !user.org_id) {
    return { all: true, ids: [], own_id: user.org_id }
  }

  // Master agents and master dealers: see their entire subtree
  if (user.isMasterAgent || user.isMasterDealer) {
    const ids = await getDescendantIds(user.org_id)
    return { all: false, ids, own_id: user.org_id }
  }

  // Individual dealers (sales / install / service) + clients: self only
  return { all: false, ids: [user.org_id], own_id: user.org_id }
}

/**
 * Apply an org scope filter to a Supabase query builder.
 * Handles both simple org_id columns and the 3-FK pattern on sites.
 *
 * @param query   — a Supabase query builder (before .select() is finalized)
 * @param scope   — result of resolveOrgScope()
 * @param column  — the column to filter. For sites use 'site' to apply 3-FK OR logic.
 */
export function applyOrgScope<T>(
  query: T,
  scope: OrgScope,
  column: string | 'site' = 'org_id'
): T {
  if (scope.all) return query  // corporate — no filter

  const ids    = scope.ids
  const idList = ids.join(',')

  // For the sites table, a site is "visible" if ANY of the three dealer FKs
  // match an org_id in the scope — account owner, installer, or service dealer.
  if (column === 'site') {
    return (query as any).or(
      `master_dealer_id.in.(${idList}),install_dealer_id.in.(${idList}),service_dealer_id.in.(${idList})`
    ) as T
  }

  return (query as any).in(column, ids) as T
}

/**
 * Quick guard for routes that should 401 when org context is missing.
 * Returns true if the user has enough context to proceed.
 */
export function hasOrgContext(user: PortalUser): boolean {
  return user.isCorporate || !!user.org_id
}
