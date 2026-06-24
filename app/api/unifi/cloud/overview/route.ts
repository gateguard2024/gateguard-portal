/**
 * GET /api/unifi/cloud/overview?site_id=  — internet/WAN status + client counts +
 * device health for a property, via the UniFi Site Manager Cloud API (api.ui.com).
 * 'network' capability required. ?debug=1 returns raw site/device payloads.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { canOperate } from '@/lib/system-access'
import { getSiteUniFiOverview, getSiteUniFiCloud, listCloudSites, listCloudDevices } from '@/lib/unifi-cloud'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const siteId = req.nextUrl.searchParams.get('site_id') ?? ''
  if (!siteId) return NextResponse.json({ error: 'site_id required' }, { status: 400 })
  if (!(await canOperate(await getCurrentUser(), siteId, 'network'))) return NextResponse.json({ error: 'No network access.' }, { status: 403 })
  try {
    if (req.nextUrl.searchParams.get('debug') === '1') {
      const creds = await getSiteUniFiCloud(siteId)
      if (!creds) return NextResponse.json({ error: 'No UniFi cloud key set' }, { status: 400 })
      const sites = await listCloudSites(creds.apiKey)
      const devices = await listCloudDevices(creds.apiKey, creds.hostId ?? undefined)
      return NextResponse.json({ creds: { siteId: creds.siteId, hostId: creds.hostId }, sites_sample: sites.slice(0, 3), devices_sample: devices.slice(0, 3) })
    }
    const overview = await getSiteUniFiOverview(siteId)
    return NextResponse.json(overview)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'UniFi cloud fetch failed', connected: false }, { status: 502 })
  }
}
