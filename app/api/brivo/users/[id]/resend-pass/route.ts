/**
 * POST /api/brivo/users/[id]/resend-pass  { site_id|org_id, email?, name? }
 * Resend a resident's Brivo Mobile Pass (revoke old + issue new) — so a dealer
 * fixes "I didn't get my pass" without logging into Brivo. 'door_users' capability.
 * [id] = Brivo user id.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { canOperate } from '@/lib/system-access'
import { getAllowedBrivoSite, getAllowedVaultBrivoSite } from '@/lib/brivo-scope'
import { getOrgBrivoToken, getSiteBrivoToken, resendBrivoMobilePass } from '@/lib/brivo'

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

    const result = await resendBrivoMobilePass(token, apiKey, params.id, body.email ? String(body.email) : null)

    if (siteId) {
      try {
        await supabase.from('site_events').insert({
          site_id: siteId, event_type: 'pass_resend', event_source: 'brivo',
          title: `Mobile pass resent: ${body.name ?? 'resident'}`,
          description: `${user.name} resent a Brivo Mobile Pass (revoked ${result.revoked} old) via Nexus`,
          summary: `Pass resent by ${user.name}`,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          metadata: { brivo_user_id: params.id, by_name: user.name } as any,
        })
      } catch { /* audit best-effort */ }
    }
    return NextResponse.json({ ok: true, revoked: result.revoked })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Resend pass failed' }, { status: 502 })
  }
}
