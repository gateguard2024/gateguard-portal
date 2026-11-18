import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope } from '@/lib/org-scope'
import { guardSite } from '@/lib/ops-scope'
import { siteStats, techStats, benchmark } from '@/lib/service-stats'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/service-stats
 *   ?view=site&site_id=…   one property: visits, hours, parts, return trips (month / 90 d / 12 mo)
 *   ?view=techs[&days=90]   per tech for the caller's company (corporate: everyone)
 *   ?view=benchmark          network per-property-per-year averages by size (anonymous counts only)
 * Definitions live in lib/service-stats.ts.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const view = url.searchParams.get('view') ?? 'site'
  const user = await getCurrentUser()
  if (!user || user.id === 'anonymous') return NextResponse.json({ error: 'Sign in' }, { status: 401 })
  try {
    if (view === 'site') {
      const siteId = url.searchParams.get('site_id') ?? ''
      if (!siteId || !(await guardSite(req, siteId))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json(await siteStats(siteId))
    }
    if (!user.isCorporate && !user.canViewWOs) return NextResponse.json({ error: 'Job access needed' }, { status: 403 })
    if (view === 'techs') {
      const scope = await resolveOrgScope(user)
      const days = Math.min(365, Math.max(7, Number(url.searchParams.get('days')) || 90))
      return NextResponse.json({ days, techs: await techStats(scope.all ? 'all' : scope.ids.filter(Boolean), days) })
    }
    if (view === 'benchmark') return NextResponse.json(await benchmark())
    return NextResponse.json({ error: 'Unknown view' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Stats failed' }, { status: 500 })
  }
}
