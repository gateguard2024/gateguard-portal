/**
 * GET /api/brivo/events?site_id=<site>  — recent Brivo access events for the site,
 * shaped for the Activity feed. 'doors' (or 'network') capability required.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { getAllowedVaultBrivoSite } from '@/lib/brivo-scope'
import { listSiteBrivoEvents } from '@/lib/brivo'
import { canOperate } from '@/lib/system-access'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    const siteId = req.nextUrl.searchParams.get('site_id') ?? ''
    if (!siteId) return NextResponse.json({ error: 'site_id is required', events: [] }, { status: 400 })

    const site = await getAllowedVaultBrivoSite(user, siteId)
    if (!site) return NextResponse.json({ error: 'That site is outside your access (or has no Brivo login set).', events: [] }, { status: 403 })
    if (!(await canOperate(user, siteId, 'doors'))) return NextResponse.json({ error: 'No door access for this site.', events: [] }, { status: 403 })

    const raw = await listSiteBrivoEvents(siteId, 40)
    const events = raw.map(e => ({
      id: `brivo-${e.id}`,
      event_type: 'access',
      event_source: 'brivo',
      severity: 'info',
      summary: [e.actor, e.action, e.door].filter(Boolean).join(' · ') || e.action,
      created_at: e.occurred,
    }))
    return NextResponse.json({ events })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Brivo events fetch failed', events: [] }, { status: 502 })
  }
}
