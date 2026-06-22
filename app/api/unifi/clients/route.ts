/**
 * GET /api/unifi/clients?site_id=  — connected UniFi Network clients for a site.
 * 'network' capability required. Read-only visibility for dealers.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { canOperate } from '@/lib/system-access'
import { listSiteUniFiClients } from '@/lib/unifi'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const siteId = req.nextUrl.searchParams.get('site_id') ?? ''
  if (!siteId) return NextResponse.json({ error: 'site_id required' }, { status: 400 })
  if (!(await canOperate(await getCurrentUser(), siteId, 'network'))) return NextResponse.json({ error: 'No network access.' }, { status: 403 })
  try {
    const clients = await listSiteUniFiClients(siteId)
    return NextResponse.json({ clients })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'UniFi fetch failed', clients: [] }, { status: 502 })
  }
}
