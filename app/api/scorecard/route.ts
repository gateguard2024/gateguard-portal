import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope } from '@/lib/org-scope'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

export async function GET() {
  const user  = await getCurrentUser()
  const scope = await resolveOrgScope(user)

  // ── Fetch orgs in scope ────────────────────────────────────────────
  let orgQuery = supabase
    .from('organizations')
    .select('id, name, tier, tier_label, service_area_states')
    .neq('tier', 'client')
    .order('name', { ascending: true })

  if (!scope.all && scope.ids.length > 0) {
    orgQuery = orgQuery.in('id', scope.ids)
  }
  if (!scope.all && scope.ids.length === 0) {
    // No accessible orgs
    return NextResponse.json({ scorecards: [] })
  }

  const { data: orgs, error: orgsError } = await orgQuery
  if (orgsError) {
    console.error('[api/scorecard] orgs error:', orgsError.message)
    return NextResponse.json({ error: orgsError.message }, { status: 500 })
  }

  if (!orgs || orgs.length === 0) {
    return NextResponse.json({ scorecards: [] })
  }

  const orgIds = orgs.map(o => o.id)

  // ── Fetch WO counts per org ────────────────────────────────────────
  const { data: wos, error: wosError } = await supabase
    .from('work_orders')
    .select('org_id, status, created_at, scheduled_date')
    .in('org_id', orgIds)

  if (wosError) {
    console.error('[api/scorecard] work_orders error:', wosError.message)
  }

  // ── Fetch site counts per org ──────────────────────────────────────
  const { data: sites, error: sitesError } = await supabase
    .from('sites')
    .select('org_id, master_dealer_id')
    .or(`org_id.in.(${orgIds.join(',')}),master_dealer_id.in.(${orgIds.join(',')})`)

  if (sitesError) {
    console.error('[api/scorecard] sites error:', sitesError.message)
  }

  // ── Build per-org maps ─────────────────────────────────────────────
  const wosByOrg: Record<string, Array<{ status: string; created_at: string; scheduled_date: string | null }>> = {}
  for (const wo of wos ?? []) {
    if (!wo.org_id) continue
    if (!wosByOrg[wo.org_id]) wosByOrg[wo.org_id] = []
    wosByOrg[wo.org_id].push(wo)
  }

  // Sites count: count each site once per org (by org_id or master_dealer_id)
  const siteCountByOrg: Record<string, number> = {}
  for (const site of sites ?? []) {
    const id = site.org_id ?? site.master_dealer_id
    if (!id) continue
    siteCountByOrg[id] = (siteCountByOrg[id] ?? 0) + 1
  }

  // ── Compute scorecard per org ──────────────────────────────────────
  const scorecards = orgs.map(org => {
    const orgWos   = wosByOrg[org.id] ?? []
    const total    = orgWos.length
    const completed = orgWos.filter(w => w.status === 'completed').length
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : null

    // Avg response hours = avg (scheduled_date - created_at) in hours
    const responseSamples = orgWos
      .filter(w => w.scheduled_date && w.created_at)
      .map(w => {
        const created   = new Date(w.created_at).getTime()
        const scheduled = new Date(w.scheduled_date!).getTime()
        const diffHrs   = (scheduled - created) / (1000 * 60 * 60)
        return diffHrs >= 0 ? diffHrs : null
      })
      .filter((h): h is number => h !== null)

    const avgResponseHrs = responseSamples.length > 0
      ? Math.round((responseSamples.reduce((a, b) => a + b, 0) / responseSamples.length) * 10) / 10
      : null

    const site_count = siteCountByOrg[org.id] ?? 0

    // Composite score: weighted from completion rate + response time
    // completion_rate: 0–100 → up to 60 pts
    // response time: 0-2 hrs = 40pts, 2-4 = 30pts, 4-8 = 15pts, >8 = 5pts
    let score: number | null = null
    if (completionRate !== null) {
      const completionPts = Math.round((completionRate / 100) * 60)
      let responsePts = 30 // default mid-range if no data
      if (avgResponseHrs !== null) {
        if (avgResponseHrs <= 2)      responsePts = 40
        else if (avgResponseHrs <= 4) responsePts = 30
        else if (avgResponseHrs <= 8) responsePts = 15
        else                          responsePts = 5
      }
      score = Math.min(100, completionPts + responsePts)
    }

    return {
      id:              org.id,
      name:            org.name,
      tier:            org.tier,
      tier_label:      org.tier_label,
      location:        org.service_area_states?.join(', ') ?? '',
      site_count,
      total_wos:       total,
      completed_wos:   completed,
      completion_rate: completionRate,
      avg_response_hrs: avgResponseHrs,
      score,
      certified:       score !== null && score >= 80,
    }
  })

  return NextResponse.json({ scorecards })
}
