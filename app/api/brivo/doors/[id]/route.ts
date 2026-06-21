/**
 * POST /api/brivo/doors/[id]  { site_id|org_id, door_name?, confirm: true }
 * Remotely UNLOCK a door — a physical-security action. Requires confirm:true.
 * Records a site_event ("door_unlock") so the timeline shows who unlocked what,
 * when — the foundation for tying camera footage to door events later.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { getAllowedBrivoSite, getAllowedVaultBrivoSite } from '@/lib/brivo-scope'
import { getOrgBrivoToken, getSiteBrivoToken, unlockBrivoDoor } from '@/lib/brivo'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser()
    const body = await req.json().catch(() => ({}))
    if (body.confirm !== true) return NextResponse.json({ error: 'Unlocking a door needs confirmation.' }, { status: 400 })

    const siteId = String(body.site_id ?? '')
    const orgId = String(body.org_id ?? '')
    let token: string, apiKey: string
    if (siteId) {
      const site = await getAllowedVaultBrivoSite(user, siteId)
      if (!site) return NextResponse.json({ error: 'That site is outside your access.' }, { status: 403 })
      ;({ token, apiKey } = await getSiteBrivoToken(siteId))
    } else if (orgId) {
      const site = await getAllowedBrivoSite(user, orgId)
      if (!site) return NextResponse.json({ error: 'That site is outside your access.' }, { status: 403 })
      ;({ token, apiKey } = await getOrgBrivoToken(orgId))
    } else {
      return NextResponse.json({ error: 'site_id or org_id is required' }, { status: 400 })
    }

    await unlockBrivoDoor(token, apiKey, params.id)

    // Audit trail — also shows in the site activity timeline; future camera link.
    if (siteId) {
      const doorName = String(body.door_name ?? 'Door')
      try {
        await supabase.from('site_events').insert({
          site_id: siteId,
          event_type: 'door_unlock',
          event_source: 'brivo',
          title: `Door unlocked: ${doorName}`,
          description: `Unlocked remotely by ${user.name} via Nexus`,
          summary: `${doorName} unlocked by ${user.name}`,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          metadata: { door_id: params.id, door_name: doorName, by_user_id: user.id, by_name: user.name } as any,
        })
      } catch { /* audit is best-effort; the unlock already happened */ }
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Door unlock failed' }, { status: 502 })
  }
}
