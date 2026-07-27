/**
 * POST /api/brivo/users/[id]/credentials
 *   { site_id|org_id, action, credential_id?, card_number?, facility_code?, email?, name? }
 *
 * action:
 *   'issue-pass'  → issue a NEW Brivo Mobile Pass (additive; keeps existing creds)
 *   'assign-fob'  → create + assign a physical card/fob (needs card_number)
 *   'revoke'      → reversibly turn a single credential off (needs credential_id)
 *   'reinstate'   → turn that credential back on (needs credential_id)
 *
 * 'door_users' capability, scoped to the site. [id] = Brivo user id.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { canOperate } from '@/lib/system-access'
import { getAllowedBrivoSite, getAllowedVaultBrivoSite } from '@/lib/brivo-scope'
import { getOrgBrivoToken, getSiteBrivoToken, issueBrivoMobilePass, assignBrivoFob, setBrivoCredentialSuspended } from '@/lib/brivo'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const ACTIONS = ['issue-pass', 'assign-fob', 'revoke', 'reinstate'] as const
type Action = (typeof ACTIONS)[number]

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser()
    const body = await req.json().catch(() => ({}))
    const siteId = String(body.site_id ?? '')
    const orgId = String(body.org_id ?? '')
    const action = String(body.action ?? '') as Action
    if (!ACTIONS.includes(action)) return NextResponse.json({ error: 'invalid action' }, { status: 400 })

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

    let summary = ''
    if (action === 'issue-pass') {
      await issueBrivoMobilePass(token, apiKey, params.id, body.email || null)
      summary = 'Mobile pass issued'
    } else if (action === 'assign-fob') {
      const cardNumber = String(body.card_number ?? '').trim()
      if (!cardNumber) return NextResponse.json({ error: 'card_number is required to assign a fob' }, { status: 400 })
      await assignBrivoFob(token, apiKey, params.id, cardNumber, body.facility_code || null)
      summary = `Fob assigned (#${cardNumber})`
    } else {
      const credentialId = String(body.credential_id ?? '').trim()
      if (!credentialId) return NextResponse.json({ error: 'credential_id is required' }, { status: 400 })
      await setBrivoCredentialSuspended(token, apiKey, credentialId, action === 'revoke')
      summary = action === 'revoke' ? 'Credential revoked' : 'Credential reinstated'
    }

    if (siteId) {
      try {
        await supabase.from('site_events').insert({
          site_id: siteId, event_type: `credential_${action.replace('-', '_')}`, event_source: 'brivo',
          title: `${summary}: ${body.name ?? 'user'}`,
          description: `${user.name} performed "${action}" on a Brivo credential via Nexus`,
          summary: `${summary} by ${user.name}`,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          metadata: { brivo_user_id: params.id, action, credential_id: body.credential_id ?? null, by_name: user.name } as any,
        })
      } catch { /* audit best-effort */ }
    }
    return NextResponse.json({ ok: true, summary })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Credential action failed' }, { status: 502 })
  }
}
