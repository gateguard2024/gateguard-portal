/**
 * GET /api/aria/usage
 *
 * Returns ARIA search usage stats with hierarchical rollup.
 * The rollup mirrors GateGuard's org tree:
 *
 *   User search count
 *   → rolls up to their org
 *   → rolls up to parent org (master dealer, master agent, corporate)
 *
 * Example:
 *   Sales rep searched 4×, dealer owner searched 4× → dealership = 8
 *   3 dealerships under master agent (24) + master agent searched 10× = 34 corporate
 *
 * Response shape:
 *   {
 *     my_searches: { total, base, deep, today, this_week, this_month },
 *     my_org:      { org_id, org_name, total, base, deep, this_week, this_month, top_users[] },
 *     hierarchy:   { org_id, org_name, org_tier, own_count, child_count, total_count }[],
 *     corporate_total: number,
 *   }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope } from '@/lib/org-scope'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(_req: NextRequest) {
  try {
    const user  = await getCurrentUser()
    const scope = await resolveOrgScope(user)
    const orgId = scope.own_id ?? null

    // ── 1. My personal search counts ─────────────────────────────────────────
    const mySearches = { total: 0, base: 0, deep: 0, today: 0, this_week: 0, this_month: 0 }

    if (user?.id) {
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      const weekStart  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000).toISOString()
      const monthStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

      const { data: myRows } = await supabase
        .from('aria_searches')
        .select('id, search_type, created_at')
        .eq('user_id', user.id)

      if (myRows) {
        mySearches.total      = myRows.length
        mySearches.base       = myRows.filter(r => r.search_type === 'base').length
        mySearches.deep       = myRows.filter(r => r.search_type === 'deep').length
        mySearches.today      = myRows.filter(r => r.created_at >= todayStart).length
        mySearches.this_week  = myRows.filter(r => r.created_at >= weekStart).length
        mySearches.this_month = myRows.filter(r => r.created_at >= monthStart).length
      }
    }

    // ── 2. My org counts + top users ─────────────────────────────────────────
    const myOrg: {
      org_id: string | null; org_name: string | null
      total: number; base: number; deep: number; this_week: number; this_month: number
      top_users: { user_name: string; user_email: string; count: number }[]
    } = { org_id: orgId, org_name: null, total: 0, base: 0, deep: 0, this_week: 0, this_month: 0, top_users: [] }

    if (orgId) {
      const weekStart  = new Date(Date.now() - 7  * 24 * 60 * 60 * 1000).toISOString()
      const monthStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

      // Get org name
      const { data: orgRow } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', orgId)
        .single()
      myOrg.org_name = orgRow?.name ?? null

      const { data: orgRows } = await supabase
        .from('aria_searches')
        .select('id, search_type, created_at, user_id, user_name, user_email')
        .eq('org_id', orgId)

      if (orgRows) {
        myOrg.total      = orgRows.length
        myOrg.base       = orgRows.filter(r => r.search_type === 'base').length
        myOrg.deep       = orgRows.filter(r => r.search_type === 'deep').length
        myOrg.this_week  = orgRows.filter(r => r.created_at >= weekStart).length
        myOrg.this_month = orgRows.filter(r => r.created_at >= monthStart).length

        // Top users within this org
        const byUser: Record<string, { user_name: string; user_email: string; count: number }> = {}
        orgRows.forEach(r => {
          if (!r.user_id) return
          const key = r.user_id
          if (!byUser[key]) byUser[key] = { user_name: r.user_name ?? r.user_email ?? 'Unknown', user_email: r.user_email ?? '', count: 0 }
          byUser[key].count++
        })
        myOrg.top_users = Object.values(byUser).sort((a, b) => b.count - a.count).slice(0, 5)
      }
    }

    // ── 3. Hierarchy rollup — walk the org tree upward then downward ──────────
    // Pull all orgs in the scope (this org + ancestors + children) with their counts
    const hierarchy: {
      org_id: string; org_name: string; org_tier: string
      own_count: number; child_count: number; total_count: number
      depth: number
    }[] = []

    // Get all org IDs in scope (own_id + all ancestor + child org IDs)
    const allScopeIds = scope.ids ?? (orgId ? [orgId] : [])

    if (allScopeIds.length > 0) {
      // Per-org counts from aria_searches
      const { data: countRows } = await supabase
        .from('aria_searches')
        .select('org_id')
        .in('org_id', allScopeIds)

      const countMap: Record<string, number> = {}
      countRows?.forEach(r => {
        if (r.org_id) countMap[r.org_id] = (countMap[r.org_id] ?? 0) + 1
      })

      // Get org metadata for all scoped IDs
      const { data: orgs } = await supabase
        .from('organizations')
        .select('id, name, org_tier, parent_org_id')
        .in('id', allScopeIds)
        .order('org_tier')

      if (orgs) {
        // Build parent→children map
        const childrenOf: Record<string, string[]> = {}
        orgs.forEach(o => {
          if (o.parent_org_id) {
            childrenOf[o.parent_org_id] = [...(childrenOf[o.parent_org_id] ?? []), o.id]
          }
        })

        // Recursively sum children
        function subtreeCount(id: string): number {
          const own = countMap[id] ?? 0
          const children = childrenOf[id] ?? []
          return own + children.reduce((sum, cid) => sum + subtreeCount(cid), 0)
        }

        const tierOrder: Record<string, number> = {
          corporate: 0, master_agent: 1, master_dealer: 2,
          full_dealer: 3, service_dealer: 3, install_contractor: 3, sales_partner: 3, client: 4,
        }

        orgs.sort((a, b) => (tierOrder[a.org_tier ?? ''] ?? 9) - (tierOrder[b.org_tier ?? ''] ?? 9))
          .forEach((o, i) => {
            const own   = countMap[o.id] ?? 0
            const total = subtreeCount(o.id)
            hierarchy.push({
              org_id:      o.id,
              org_name:    o.name ?? 'Unknown',
              org_tier:    o.org_tier ?? 'unknown',
              own_count:   own,
              child_count: total - own,
              total_count: total,
              depth:       tierOrder[o.org_tier ?? ''] ?? 9,
            })
          })
      }
    }

    // ── 4. Corporate total — sum of all search rows (GG Corporate only) ───────
    // For dealers/reps, this is their own hierarchy total
    const corporateTotal = hierarchy.reduce((max, row) => {
      // The top of their visible hierarchy = row with no parent in scope
      return row.depth === 0 ? row.total_count : max
    }, hierarchy.find(r => !allScopeIds.includes(/* eslint-disable @typescript-eslint/no-explicit-any */ '' as any))?.total_count ?? (hierarchy[0]?.total_count ?? 0))

    return NextResponse.json({
      my_searches:     mySearches,
      my_org:          myOrg,
      hierarchy,
      corporate_total: hierarchy[0]?.total_count ?? myOrg.total,
    })

  } catch (err: any) {
    console.error('[aria/usage]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
