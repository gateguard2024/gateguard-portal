/**
 * GET /api/aria/searches
 * Returns all non-expired ARIA searches for the caller's org hierarchy, newest first.
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

    let query = supabase
      .from('aria_searches')
      .select('id, query, query_interpretation, imported_count, imported_at, expires_at, created_at, results')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(50)

    // ── Security & Hierarchy Boundary ───────────────────────────────────────
    // If not a global admin, scope searches to the user's allowed org tree.
    if (!scope.all) {
      const allowedIds = scope.ids && scope.ids.length > 0 ? scope.ids : (scope.own_id ? [scope.own_id] : [])
      
      if (allowedIds.length > 0) {
        query = query.in('org_id', allowedIds)
      } else {
        // If the user has no org affiliation, return empty to prevent data leakage
        return NextResponse.json({ searches: [] })
      }
    }

    const { data, error } = await query
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ searches: data ?? [] })
    
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch search history'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}