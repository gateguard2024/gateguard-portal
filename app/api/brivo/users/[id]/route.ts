import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { getAllowedBrivoSite, getAllowedVaultBrivoSite } from '@/lib/brivo-scope'
import { getOrgBrivoToken, getSiteBrivoToken, setBrivoUserSuspended } from '@/lib/brivo'
import { canOperate } from '@/lib/system-access'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// PATCH /api/brivo/users/[id]  { site_id|org_id, suspended: boolean }
// Suspend / reactivate a Brivo user, using that site's own credentials.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser()
    const body = await req.json().catch(() => ({}))
    const siteId = String(body.site_id ?? '')
    const orgId = String(body.org_id ?? '')

    let token: string, apiKey: string
    if (siteId) {
      const site = await getAllowedVaultBrivoSite(user, siteId)
      if (!site) return NextResponse.json({ error: 'That site is outside your access.' }, { status: 403 })
      if (!(await canOperate(user, siteId, 'door_users'))) return NextResponse.json({ error: 'You don’t have door-user access for this site.' }, { status: 403 })
      ;({ token, apiKey } = await getSiteBrivoToken(siteId))
    } else if (orgId) {
      const site = await getAllowedBrivoSite(user, orgId)
      if (!site) return NextResponse.json({ error: 'That site is outside your access.' }, { status: 403 })
      ;({ token, apiKey } = await getOrgBrivoToken(orgId))
    } else {
      return NextResponse.json({ error: 'site_id or org_id is required' }, { status: 400 })
    }

    await setBrivoUserSuspended(token, apiKey, params.id, body.suspended === true)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Brivo update failed' }, { status: 502 })
  }
}
