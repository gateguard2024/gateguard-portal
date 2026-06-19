/**
 * GET /api/requests — global list of incoming work-order requests (wo_requests)
 * across all sites the caller can see. Used by the Operations Hub Requests tab.
 * Query: ?status=open (default: not closed/converted) | all
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth }            from '@clerk/nextjs/server'
import { createClient }    from '@supabase/supabase-js'
import { getCurrentUser }  from '@/lib/current-user'
import { resolveOrgScope } from '@/lib/org-scope'

function serviceDb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = serviceDb()
  const statusParam = new URL(req.url).searchParams.get('status') ?? 'open'

  // Which sites can the caller see?
  let siteQ = db.from('sites').select('id, name, city, state')
  const scope = await resolveOrgScope(await getCurrentUser())
  if (!scope.all) {
    const ids = scope.ids.filter(Boolean)
    if (ids.length === 0) return NextResponse.json({ requests: [] })
    siteQ = siteQ.or(`org_id.in.(${ids.join(',')}),master_dealer_id.in.(${ids.join(',')}),install_dealer_id.in.(${ids.join(',')}),service_dealer_id.in.(${ids.join(',')})`)
  }
  const { data: sites } = await siteQ
  const siteMap: Record<string, { name: string; city?: string; state?: string }> = {}
  for (const s of sites ?? []) siteMap[s.id] = { name: s.name, city: s.city, state: s.state }
  const siteIds = Object.keys(siteMap)
  if (siteIds.length === 0) return NextResponse.json({ requests: [] })

  let reqQ = db.from('wo_requests').select('*').in('site_id', siteIds).order('created_at', { ascending: false })
  if (statusParam === 'open') reqQ = reqQ.in('status', ['new', 'acknowledged'])
  const { data, error } = await reqQ
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const requests = (data ?? []).map(r => ({ ...r, site_name: siteMap[r.site_id]?.name ?? null, site_city: siteMap[r.site_id]?.city ?? null, site_state: siteMap[r.site_id]?.state ?? null }))
  return NextResponse.json({ requests })
}
