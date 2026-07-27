/**
 * POST /api/brivo/guests  { site_id|org_id, firstName, lastName, email, from?, to?, group_id? }
 * Issue a time-boxed visitor Mobile Pass: create the guest as a Brivo user, add to
 * a group for access, and issue a pass with effective from/to dates. 'door_users'.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { canOperate } from '@/lib/system-access'
import { getAllowedBrivoSite, getAllowedVaultBrivoSite } from '@/lib/brivo-scope'
import { getOrgBrivoToken, getSiteBrivoToken, createBrivoUser, resendBrivoMobilePass } from '@/lib/brivo'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    const body = await req.json().catch(() => ({}))
    const siteId = String(body.site_id ?? '')
    const orgId = String(body.org_id ?? '')
    const firstName = String(body.firstName ?? '').trim()
    const lastName = String(body.lastName ?? '').trim()
    const email = body.email ? String(body.email).trim() : null
    if (!firstName || !lastName) return NextResponse.json({ error: 'Guest first and last name are required.' }, { status: 400 })
    if (!email) return NextResponse.json({ error: 'A guest email is required to send the pass.' }, { status: 400 })

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

    // 1) create the guest as a user (+group for access), 2) issue a dated pass.
    const created = await createBrivoUser(token, apiKey, { firstName, lastName, email, groupId: body.group_id ? String(body.group_id) : null })
    await resendBrivoMobilePass(token, apiKey, created.id, email, { from: body.from ?? null, to: body.to ?? null })

    if (siteId) {
      try {
        await supabase.from('site_events').insert({
          site_id: siteId, event_type: 'guest_pass', event_source: 'brivo',
          title: `Visitor pass issued: ${firstName} ${lastName}`,
          description: `${user.name} issued a guest Mobile Pass${body.to ? ` (valid to ${body.to})` : ''} via Nexus`,
          summary: `Guest pass by ${user.name}`,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          metadata: { brivo_user_id: created.id, from: body.from ?? null, to: body.to ?? null, by_name: user.name } as any,
        })
      } catch { /* audit best-effort */ }
    }
    return NextResponse.json({ ok: true, guest_id: created.id })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Issue guest pass failed' }, { status: 502 })
  }
}
