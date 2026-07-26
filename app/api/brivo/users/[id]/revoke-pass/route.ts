/**
 * POST /api/brivo/users/[id]/revoke-pass  { site_id|org_id, name? }
 * Turn OFF a resident/admin's Brivo Mobile Pass (revoke all their pass credentials)
 * — e.g. a move-out or a lost phone — without logging into Brivo. 'door_users'.
 * [id] = Brivo user id.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { canOperate } from '@/lib/system-access'
import { getAllowedBrivoSite, getAllowedVaultBrivoSite } from '@/lib/brivo-scope'
import { getOrgBrivoToken, getSiteBrivoToken, revokeBrivoMobilePass } from '@/lib/brivo'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
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

    const result = await revokeBrivoMobilePass(token, apiKey, params.id)

    if (siteId) {
      try {
        await supabase.from('site_events').insert({
          site_id: siteId, event_type: 'pass_revoke', event_source: 'brivo',
          title: `Mobile pass revoked: ${body.name ?? 'user'}`,
          description: `${user.name} revoked ${result.revoked} Brivo Mobile Pass credential(s) via Nexus`,
          summary: `Pass revoked by ${user.name}`,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          metadata: { brivo_user_id: params.id, revoked: result.revoked, by_name: user.name } as any,
        })
      } catch { /* audit best-effort */ }
    }
    return NextResponse.json({ ok: true, revoked: result.revoked })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Revoke pass failed' }, { status: 502 })
  }
}
