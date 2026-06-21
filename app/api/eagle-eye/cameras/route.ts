/**
 * GET /api/eagle-eye/cameras?site_id=<site>
 * Live camera list for a site (id, name, tags). OPERATE action — available to
 * any user scoped to the site (dealers included); the OAuth setup that makes it
 * work is corporate-only. Refreshes the token automatically.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope } from '@/lib/org-scope'
import { getSiteEagleEyeAccess, listEagleEyeCameras } from '@/lib/eagle-eye'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function canViewSite(siteId: string): Promise<boolean> {
  const user = await getCurrentUser()
  const scope = await resolveOrgScope(user)
  if (scope.all) return true
  const { data } = await supabase.from('sites').select('master_dealer_id, install_dealer_id, service_dealer_id, org_id').eq('id', siteId).maybeSingle()
  if (!data) return false
  return [data.master_dealer_id, data.install_dealer_id, data.service_dealer_id, data.org_id].some(o => o && scope.ids.includes(o))
}

export async function GET(req: NextRequest) {
  const siteId = req.nextUrl.searchParams.get('site_id') ?? ''
  if (!siteId) return NextResponse.json({ error: 'site_id required' }, { status: 400 })
  if (!(await canViewSite(siteId))) return NextResponse.json({ error: 'That site is outside your access.' }, { status: 403 })
  try {
    const { token, baseHost } = await getSiteEagleEyeAccess(siteId)
    const cameras = await listEagleEyeCameras(token, baseHost)
    return NextResponse.json({ cameras })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Eagle Eye fetch failed', cameras: [] }, { status: 502 })
  }
}
