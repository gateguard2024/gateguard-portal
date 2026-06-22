/**
 * GET /api/brivo/doors?site_id=<site>|org_id=<org>
 * List a property's Brivo doors (access points), using that site's own creds.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { getAllowedBrivoSite, getAllowedVaultBrivoSite } from '@/lib/brivo-scope'
import { getOrgBrivoToken, getSiteBrivoToken, listBrivoDoors } from '@/lib/brivo'
import { canOperate } from '@/lib/system-access'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    const siteId = req.nextUrl.searchParams.get('site_id') ?? ''
    const orgId = req.nextUrl.searchParams.get('org_id') ?? ''

    let token: string, apiKey: string, brivoSiteId: string
    if (siteId) {
      const site = await getAllowedVaultBrivoSite(user, siteId)
      if (!site) return NextResponse.json({ error: 'That site is outside your access (or has no Brivo login set).' }, { status: 403 })
      if (!(await canOperate(user, siteId, 'doors'))) return NextResponse.json({ error: 'You don’t have door access for this site.' }, { status: 403 })
      ;({ token, apiKey, brivoSiteId } = await getSiteBrivoToken(siteId))
      if (!brivoSiteId) brivoSiteId = site.brivo_site_id
    } else if (orgId) {
      const site = await getAllowedBrivoSite(user, orgId)
      if (!site) return NextResponse.json({ error: 'That site is outside your access.' }, { status: 403 })
      ;({ token, apiKey } = await getOrgBrivoToken(orgId)); brivoSiteId = site.brivo_site_id
    } else {
      return NextResponse.json({ error: 'site_id or org_id is required' }, { status: 400 })
    }

    const doors = await listBrivoDoors(token, apiKey, brivoSiteId)
    return NextResponse.json({ doors })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Brivo doors fetch failed' }, { status: 502 })
  }
}
