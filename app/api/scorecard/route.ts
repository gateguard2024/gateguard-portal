/**
 * GET /api/scorecard  — dealer performance scorecard
 * Computes metrics from real WO + permit data per org
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

// Score calculation weights
const WEIGHTS = {
  response_time: 0.25,   // avg hours to first assignment
  fcr:           0.25,   // first call resolution %
  compliance:    0.20,   // % permits compliant
  uptime:        0.20,   // % WOs completed on schedule
  nps:           0.10,   // customer satisfaction proxy
}

function weightedScore(metrics: {
  response_time_score: number;
  fcr_score: number;
  compliance_score: number;
  uptime_score: number;
  nps_score: number;
}) {
  return Math.round(
    metrics.response_time_score * WEIGHTS.response_time +
    metrics.fcr_score           * WEIGHTS.fcr +
    metrics.compliance_score    * WEIGHTS.compliance +
    metrics.uptime_score        * WEIGHTS.uptime +
    metrics.nps_score           * WEIGHTS.nps
  )
}

export async function GET() {
  const caller = await getCurrentUser()

  // Determine which orgs to score
  let orgIds: string[] = []
  if (caller.isCorporate) {
    const { data } = await supabase
      .from('organizations')
      .select('id')
      .in('org_tier', ['full_dealer', 'service_dealer', 'master_dealer'])
      .eq('is_active', true)
    orgIds = (data ?? []).map(o => o.id)
  } else if (caller.org_id) {
    orgIds = [caller.org_id]
  }

  if (orgIds.length === 0) {
    return NextResponse.json({ scorecards: [] })
  }

  // Fetch orgs
  const { data: orgs } = await supabase
    .from('organizations')
    .select('id, name, org_tier, city, state')
    .in('id', orgIds)

  // Fetch WO stats per org (last 90 days)
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const { data: wos } = await supabase
    .from('work_orders')
    .select('id, org_id, status, priority, scheduled_date, created_at, completed_at, assignee_id')
    .in('org_id', orgIds)
    .gte('created_at', since)

  // Fetch permit compliance stats per org
  const { data: permits } = await supabase
    .from('permits_with_status')
    .select('org_id, status')
    .in('org_id', orgIds)

  const scorecards = (orgs ?? []).map(org => {
    const orgWOs = (wos ?? []).filter(w => w.org_id === org.id)
    const orgPermits = (permits ?? []).filter(p => p.org_id === org.id)

    // FCR: WOs completed without re-open = simplified as completed / total
    const completedWOs  = orgWOs.filter(w => w.status === 'completed').length
    const totalWOs      = orgWOs.length
    const fcr_pct       = totalWOs > 0 ? Math.round((completedWOs / totalWOs) * 100) : 85

    // Response time: avg hours from created_at to scheduled_date on assigned WOs
    const assignedWOs   = orgWOs.filter(w => w.assignee_id && w.scheduled_date)
    const avgHrs = assignedWOs.length > 0
      ? assignedWOs.reduce((sum, w) => {
          const hrs = (new Date(w.scheduled_date!).getTime() - new Date(w.created_at).getTime()) / 3_600_000
          return sum + Math.max(0, hrs)
        }, 0) / assignedWOs.length
      : 2.0
    const clampedHrs = Math.min(Math.max(avgHrs, 0), 24)

    // Compliance: % of permits that are compliant or no_expiry
    const compliantPermits = orgPermits.filter(p => p.status === 'compliant' || p.status === 'no_expiry').length
    const compliance_pct   = orgPermits.length > 0
      ? Math.round((compliantPermits / orgPermits.length) * 100)
      : 100  // no permits = N/A, show as 100

    // Uptime proxy: WOs completed on or before scheduled date
    const overdueWOs     = orgWOs.filter(w =>
      w.status === 'completed' && w.completed_at && w.scheduled_date &&
      new Date(w.completed_at) > new Date(w.scheduled_date)
    ).length
    const uptime_pct = totalWOs > 0
      ? Math.round(((completedWOs - overdueWOs) / Math.max(completedWOs, 1)) * 100)
      : 97

    // NPS proxy — based on overall performance (no real NPS data yet)
    const nps_proxy = Math.round(fcr_pct * 0.8 + compliance_pct * 0.2) - 10

    // Convert to 0–100 scores
    const response_time_score = Math.round(Math.max(0, 100 - (clampedHrs / 24) * 100))
    const fcr_score           = Math.min(100, fcr_pct)
    const compliance_score    = Math.min(100, compliance_pct)
    const uptime_score        = Math.min(100, Math.max(0, uptime_pct))
    const nps_score           = Math.min(100, Math.max(0, nps_proxy))

    const score = weightedScore({ response_time_score, fcr_score, compliance_score, uptime_score, nps_score })

    return {
      org_id:          org.id,
      name:            org.name,
      org_tier:        org.org_tier,
      location:        [org.city, org.state].filter(Boolean).join(', '),
      score,
      certified:       score >= 80,
      metrics: {
        response_time_hrs:   +clampedHrs.toFixed(1),
        fcr_pct,
        compliance_pct,
        uptime_pct,
        nps_proxy,
        total_wos:       totalWOs,
        completed_wos:   completedWOs,
        total_permits:   orgPermits.length,
      },
    }
  })

  // Sort by score desc
  scorecards.sort((a, b) => b.score - a.score)

  return NextResponse.json({ scorecards })
}
