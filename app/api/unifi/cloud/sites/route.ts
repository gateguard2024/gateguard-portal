/**
 * GET /api/unifi/cloud/sites?site_id=  — list every site/console on the Ubiquiti
 * account (using the cloud API key saved on this site), so corporate can pick which
 * one is this property and paste its Cloud site ID. Corporate-only (setup helper).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { getSiteUniFiCloud, listCloudSites, listCloudHosts } from '@/lib/unifi-cloud'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const siteId = req.nextUrl.searchParams.get('site_id') ?? ''
  if (!siteId) return NextResponse.json({ error: 'site_id required' }, { status: 400 })
  const user = await getCurrentUser()
  if (!user?.isCorporate) return NextResponse.json({ error: 'Corporate only.' }, { status: 403 })
  try {
    const creds = await getSiteUniFiCloud(siteId)
    if (!creds) return NextResponse.json({ error: 'Save the Cloud API key first, then refresh.', sites: [] }, { status: 400 })
    const [sites, hosts] = await Promise.all([listCloudSites(creds.apiKey), listCloudHosts(creds.apiKey)])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hostName: Record<string, string> = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const h of hosts) hostName[h.id ?? h.hostId] = h.reportedState?.hostname ?? h.reportedState?.name ?? h.hostname ?? h.id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const list = sites.map((s: any) => ({
      site_id: s.siteId ?? s.id,
      name: s.meta?.name ?? s.name ?? '(unnamed)',
      host_id: s.hostId ?? null,
      host_name: hostName[s.hostId] ?? null,
    }))
    return NextResponse.json({ sites: list })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'lookup failed', sites: [] }, { status: 502 })
  }
}
