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

    // Verify the run belongs to this user (scoping guard).
    // NB: aria_search_runs uses raw_query + intent_type (not query/mode).
    const { data: run, error: runError } = await supabase
      .from('aria_search_runs')
      .select('id, raw_query, intent_type, status, user_id, org_id, created_at, selected_candidate_id')
      .eq('id', runId)
      .maybeSingle()

    if (runError || !run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    }

    if (run.user_id !== user.id && run.org_id !== user.org_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch all candidates for this run — real columns per migration 107.
    const { data: candidates, error: candError } = await supabase
      .from('aria_candidates')
      .select(`
        id,
        property_name,
        address,
        city,
        state,
        zip,
        units,
        year_built,
        property_type,
        management_company,
        owner_entity,
        phone,
        website,
        confidence_score,
        isp_providers,
        bulk_agreement_hint,
        gate_issue_detected,
        pain_signals,
        top_evidence_snippet,
        rank_position,
        status,
        created_at
      `)
      .eq('search_run_id', runId)
      .order('rank_position', { ascending: true })

    if (candError) {
      console.error('[candidates/runId] DB error:', candError.message)
      return NextResponse.json({ error: 'DB error' }, { status: 500 })
    }

    // Map to the shape the ARIA CandidateGrid consumes (Candidate interface).
    type CandRow = {
      id: string; property_name: string | null; address: string | null;
      city: string | null; state: string | null; zip: string | null;
      units: number | null; year_built: number | null; property_type: string | null;
      management_company: string | null; owner_entity: string | null;
      phone: string | null; website: string | null; confidence_score: number | null;
      isp_providers: string[] | null; bulk_agreement_hint: boolean | null;
      gate_issue_detected: boolean | null; pain_signals: string[] | null;
      top_evidence_snippet: string | null; rank_position: number | null;
      status: string | null; created_at: string
    }
    const mapped = ((candidates ?? []) as CandRow[]).map((c) => ({
      _candidate_id: c.id,
      name: c.property_name ?? 'Unknown Property',
      address: c.address ?? '',
      city: c.city ?? '',
      state: c.state ?? '',
      zip: c.zip ?? '',
      units: c.units ?? undefined,
      year_built: c.year_built ?? undefined,
      property_class: c.property_type ?? undefined,
      management_company: c.management_company ?? undefined,
      owner_entity: c.owner_entity ?? undefined,
      phone: c.phone ?? undefined,
      website: c.website ?? undefined,
      isp_signal: Array.isArray(c.isp_providers) && c.isp_providers.length ? c.isp_providers.join(', ') : undefined,
      bulk_detected: c.bulk_agreement_hint ?? undefined,
      gate_signal: c.gate_issue_detected ?? undefined,
      pain_brief: c.top_evidence_snippet || (Array.isArray(c.pain_signals) && c.pain_signals.length ? c.pain_signals[0] : undefined),
      buy_score_estimate: c.confidence_score != null ? Math.round(Number(c.confidence_score) / 10) : undefined,
      status: c.status ?? 'pending',
      rank_position: c.rank_position ?? undefined,
    }))

    return NextResponse.json({
      run: {
        id: run.id,
        query: run.raw_query,
        mode: run.intent_type,
        status: run.status,
        created_at: run.created_at,
        selected_candidate_id: run.selected_candidate_id,
      },
      candidates: mapped,
      total: mapped.length,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[candidates/runId]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
