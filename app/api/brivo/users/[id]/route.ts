import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { isBrivoSiteAllowed } from '@/lib/brivo-scope'
import { getMasterBrivoToken, setBrivoUserSuspended } from '@/lib/brivo'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// PATCH /api/brivo/users/[id]  { site_id, suspended: boolean }
// Suspend / reactivate a Brivo user at a site the caller is allowed to manage.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser()
    const body = await req.json().catch(() => ({}))
    const siteId = String(body.site_id ?? '')
    if (!siteId) return NextResponse.json({ error: 'site_id is required' }, { status: 400 })
    if (!(await isBrivoSiteAllowed(user, siteId))) {
      return NextResponse.json({ error: 'That site is outside your access.' }, { status: 403 })
    }
    const { token, apiKey } = await getMasterBrivoToken()
    await setBrivoUserSuspended(token, apiKey, params.id, body.suspended === true)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Brivo update failed' }, { status: 502 })
  }
}
