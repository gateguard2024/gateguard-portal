/**
 * GET /api/aria/search-runs
 *
 * Returns the current user's ARIA search runs from the last 72 hours.
 * Used by the ARIA page left panel to show 72-hour memory — recent searches
 * the user can re-open without spending credits.
 *
 * Query params:
 *   limit?  — max results (default 20)
 *
 * Response:
 *   { runs: SearchRunSummary[] }
 *
 * Each run includes its mode, query, selected candidate, candidate count,
 * and whether it has a cached aria_properties record (instant re-open).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const WINDOW_HOURS = 72

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const limit = Math.min(50, parseInt(req.nextUrl.searchParams.get('limit') ?? '20', 10))
    const since = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000).toISOString()

    // Fetch runs for this user in the window
    const { data: runs, error } = await supabase
      .from('aria_search_runs')
      .select(`
        id,
        query,
        mode,
        status,
        engine_version,
        search_type,
        selected_candidate_id,
        created_at,
        completed_at,
        candidate_count,
        aria_candidates (
          id,
          property_name,
          address,
          city,
          state,
          score,
          rank_position,
          status
        )
      `)
      .eq('user_id', user.id)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[search-runs] DB error:', error.message)
      return NextResponse.json({ error: 'DB error' }, { status: 500 })
    }

    // Annotate each run with whether its selected property is in the intel DB
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const enriched = await Promise.all((runs ?? []).map(async (run: any) => {
      // Find the selected candidate's property name for DB cache lookup
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const selected = (run.aria_candidates ?? []).find((c: any) => c.id === run.selected_candidate_id)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        || (run.aria_candidates ?? [])[0]

      let has_intel_cache = false
      if (selected?.property_name) {
        const { data: prop } = await supabase
          .from('aria_properties')
          .select('id, last_researched_at')
          .ilike('property_name', `%${selected.property_name.split(' ').slice(0, 2).join(' ')}%`)
          .maybeSingle()
        has_intel_cache = !!prop
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const candidates = ((run.aria_candidates ?? []) as any[])
        .sort((a: any, b: any) => (a.rank_position ?? 99) - (b.rank_position ?? 99))
        .slice(0, 5)

      return {
        id: run.id,
        query: run.query,
        mode: run.mode,
        status: run.status,
        engine_version: run.engine_version,
        search_type: run.search_type,
        created_at: run.created_at,
        completed_at: run.completed_at,
        candidate_count: run.candidate_count ?? candidates.length,
        selected_candidate_id: run.selected_candidate_id,
        top_candidates: candidates,
        has_intel_cache,
        // Primary display info
        primary_property: selected
          ? { name: selected.property_name, city: selected.city, state: selected.state }
          : null,
      }
    }))

    return NextResponse.json({
      runs: enriched,
      window_hours: WINDOW_HOURS,
      total: enriched.length,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[search-runs]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
