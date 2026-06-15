import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { getAllowedBrivoSite } from '@/lib/brivo-scope'
import { getOrgBrivoToken, setBrivoUserSuspended } from '@/lib/brivo'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// PATCH /api/brivo/users/[id]  { org_id, suspended: boolean }
// Suspend / reactivate a Brivo user, using that site's own credentials.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser()
    const body = await req.json().catch(() => ({}))
    const orgId = String(body.org_id ?? '')
    if (!orgId) return NextResponse.json({ error: 'org_id is required' }, { status: 400 })
    const site = await getAllowedBrivoSite(user, orgId)
    if (!site) return NextResponse.json({ error: 'That site is outside your access.' }, { status: 403 })

    const { token, apiKey } = await getOrgBrivoToken(orgId)
    await setBrivoUserSuspended(token, apiKey, params.id, body.suspended === true)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Brivo update failed' }, { status: 502 })
  }
}
