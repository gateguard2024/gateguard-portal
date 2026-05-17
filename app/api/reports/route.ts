import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, applyOrgScope } from '@/lib/org-scope'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user  = await getCurrentUser()
  const scope = await resolveOrgScope(user)

  const { searchParams } = new URL(req.url)
  const periodParam = searchParams.get('period') // YYYY-MM
  const now         = new Date()
  const period      = periodParam ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // Parse period bounds
  const [yr, mo]     = period.split('-').map(Number)
  const periodStart  = new Date(yr, mo - 1, 1).toISOString()
  const periodEnd    = new Date(yr, mo, 1).toISOString()       // exclusive upper bound

  // ── Total sites ────────────────────────────────────────────────────
  let sitesQuery = supabase
    .from('sites')
    .select('id, status, org_id, master_dealer_id, install_dealer_id, service_dealer_id, organizations!sites_org_id_fkey(id, name, tier, tier_label)', { count: 'exact' })

  sitesQuery = applyOrgScope(sitesQuery, scope, 'site')

  const { data: sites, count: totalSites, error: sitesError } = await sitesQuery
  if (sitesError) {
    console.error('[api/reports] sites error:', sitesError.message)
    return NextResponse.json({ error: sitesError.message }, { status: 500 })
  }

  // ── Work orders ─────────────────────────────────────────────────────
  let woQuery = supabase
    .from('work_orders')
    .select('id, status, org_id, created_at')

  if (!scope.all && scope.ids.length > 0) {
    woQuery = woQuery.in('org_id', scope.ids)
  } else if (!scope.all && scope.ids.length === 0) {
    // No accessible orgs → empty result
    return NextResponse.json({
      summary: { total_sites: 0, total_wos_month: 0, open_wos: 0, completed_wos_month: 0 },
      by_tier:  [],
      orgs:     [],
      period,
    })
  }

  const { data: allWos, error: wosError } = await woQuery
  if (wosError) {
    console.error('[api/reports] work_orders error:', wosError.message)
  }

  const thisMonthWos = (allWos ?? []).filter(w =>
    w.created_at >= periodStart && w.created_at < periodEnd
  )

  const summary = {
    total_sites:          totalSites ?? 0,
    total_wos_month:      thisMonthWos.length,
    open_wos:             (allWos ?? []).filter(w => w.status === 'open' || w.status === 'in_progress').length,
    completed_wos_month:  thisMonthWos.filter(w => w.status === 'completed').length,
  }

  // ── By org tier ────────────────────────────────────────────────────
  const tierMap: Record<string, { tier: string; tier_label: string; site_count: number; wo_count: number }> = {}

  for (const site of sites ?? []) {
    const org: any = (site as any).organizations
    if (!org) continue
    const t = org.tier ?? 'unknown'
    if (!tierMap[t]) {
      tierMap[t] = { tier: t, tier_label: org.tier_label ?? t, site_count: 0, wo_count: 0 }
    }
    tierMap[t].site_count++
  }

  // WO counts by org tier: build org→tier map first
  const orgTierMap: Record<string, string> = {}
  for (const site of sites ?? []) {
    const org: any = (site as any).organizations
    if (org?.id && org?.tier) orgTierMap[org.id] = org.tier
  }
  for (const wo of allWos ?? []) {
    if (!wo.org_id) continue
    const tier = orgTierMap[wo.org_id]
    if (tier && tierMap[tier]) {
      tierMap[tier].wo_count++
    }
  }

  const by_tier = Object.values(tierMap).sort((a, b) => b.site_count - a.site_count)

  // ── Per-org rollup ─────────────────────────────────────────────────
  const orgMap: Record<string, { org_id: string; name: string; tier: string; tier_label: string; site_count: number; wo_count: number; open_wos: number }> = {}

  for (const site of sites ?? []) {
    const org: any = (site as any).organizations
    if (!org) continue
    if (!orgMap[org.id]) {
      orgMap[org.id] = {
        org_id:     org.id,
        name:       org.name,
        tier:       org.tier ?? '',
        tier_label: org.tier_label ?? '',
        site_count: 0,
        wo_count:   0,
        open_wos:   0,
      }
    }
    orgMap[org.id].site_count++
  }

  for (const wo of allWos ?? []) {
    if (!wo.org_id || !orgMap[wo.org_id]) continue
    orgMap[wo.org_id].wo_count++
    if (wo.status === 'open' || wo.status === 'in_progress') {
      orgMap[wo.org_id].open_wos++
    }
  }

  const orgs = Object.values(orgMap).sort((a, b) => b.site_count - a.site_count)

  return NextResponse.json({ summary, by_tier, orgs, period })
}
