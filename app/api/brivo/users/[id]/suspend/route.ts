/**
 * POST /api/brivo/users/[id]/suspend  { site_id|org_id, suspended:boolean, name? }
 * Suspend or reactivate a Brivo user (turns their access on/off). 'door_users'.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { canOperate } from '@/lib/system-access'
import { getAllowedBrivoSite, getAllowedVaultBrivoSite } from '@/lib/brivo-scope'
import { getOrgBrivoToken, getSiteBrivoToken, setBrivoUserSuspended } from '@/lib/brivo'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser()
    const body = await req.json().catch(() => ({}))
    const siteId = String(body.site_id ?? '')
    const orgId = String(body.org_id ?? '')
    const suspended = body.suspended === true

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

    await setBrivoUserSuspended(token, apiKey, params.id, suspended)

    if (siteId) {
      try {
        await supabase.from('site_events').insert({
          site_id: siteId, event_type: suspended ? 'user_suspend' : 'user_reactivate', event_source: 'brivo',
          title: `${suspended ? 'Suspended' : 'Reactivated'} user: ${body.name ?? 'user'}`,
          description: `${user.name} ${suspended ? 'suspended' : 'reactivated'} a Brivo user via Nexus`,
          summary: `User ${suspended ? 'suspended' : 'reactivated'} by ${user.name}`,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          metadata: { brivo_user_id: params.id, suspended, by_name: user.name } as any,
        })
      } catch { /* audit best-effort */ }
    }
    return NextResponse.json({ ok: true, suspended })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Suspend failed' }, { status: 502 })
  }
}
