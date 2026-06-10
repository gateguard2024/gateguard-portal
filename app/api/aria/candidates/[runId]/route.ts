/**
 * GET /api/aria/candidates/[runId]
 *
 * Returns all candidates for a specific search run.
 * Used by the ARIA page 72-hour memory to re-open a past search's candidate grid.
 *
 * The caller already has the run ID from /api/aria/search-runs.
 * This endpoint hydrates the full candidate list for display in the CandidateGrid.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  req: NextRequest,
  { params }: { params: { runId: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { runId } = params
    if (!runId) {
      return NextResponse.json({ error: 'runId required' }, { status: 400 })
    }

    // Verify the run belongs to this user (scoping guard)
    const { data: run, error: runError } = await supabase
      .from('aria_search_runs')
      .select('id, query, mode, status, user_id, org_id, created_at, selected_candidate_id')
      .eq('id', runId)
      .maybeSingle()

    if (runError || !run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    }

    if (run.user_id !== user.id && run.org_id !== user.org_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch all candidates for this run
    const { data: candidates, error: candError } = await supabase
      .from('aria_candidates')
      .select(`
        id,
        property_name,
        address,
        city,
        state,
        units,
        year_built,
        property_type,
        score,
        rank_position,
        status,
        isp_brief,
        pain_brief,
        proptech_detected,
        data_confidence,
        created_at
      `)
      .eq('search_run_id', runId)
      .order('rank_position', { ascending: true })

    if (candError) {
      console.error('[candidates/runId] DB error:', candError.message)
      return NextResponse.json({ error: 'DB error' }, { status: 500 })
    }

    return NextResponse.json({
      run: {
        id: run.id,
        query: run.query,
        mode: run.mode,
        status: run.status,
        created_at: run.created_at,
        selected_candidate_id: run.selected_candidate_id,
      },
      candidates: candidates ?? [],
      total: (candidates ?? []).length,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[candidates/runId]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
