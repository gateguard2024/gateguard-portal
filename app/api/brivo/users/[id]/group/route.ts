/**
 * POST /api/brivo/users/[id]/group  { site_id|org_id, group_id, name?, group_name? }
 * Assign a Brivo user to a group (grants site access). 'door_users'.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { canOperate } from '@/lib/system-access'
import { getAllowedBrivoSite, getAllowedVaultBrivoSite } from '@/lib/brivo-scope'
import { getOrgBrivoToken, getSiteBrivoToken, assignBrivoUserToGroup, removeBrivoUserFromGroup } from '@/lib/brivo'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser()
    const body = await req.json().catch(() => ({}))
    const siteId = String(body.site_id ?? '')
    const orgId = String(body.org_id ?? '')
    const groupId = String(body.group_id ?? '')
    if (!groupId) return NextResponse.json({ error: 'group_id is required' }, { status: 400 })

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

    await assignBrivoUserToGroup(token, apiKey, groupId, params.id)

    if (siteId) {
      try {
        await supabase.from('site_events').insert({
          site_id: siteId, event_type: 'user_group_assign', event_source: 'brivo',
          title: `Group assigned: ${body.name ?? 'user'} → ${body.group_name ?? 'group'}`,
          description: `${user.name} added a Brivo user to a group via Nexus`,
          summary: `Group assigned by ${user.name}`,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          metadata: { brivo_user_id: params.id, group_id: groupId, by_name: user.name } as any,
        })
      } catch { /* audit best-effort */ }
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Group assign failed' }, { status: 502 })
  }
}

// DELETE /api/brivo/users/[id]/group  { site_id|org_id, group_id, name?, group_name? }
// Remove a Brivo user from a group (revokes that group's access). 'door_users'.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser()
    const body = await req.json().catch(() => ({}))
    const siteId = String(body.site_id ?? '')
    const orgId = String(body.org_id ?? '')
    const groupId = String(body.group_id ?? '')
    if (!groupId) return NextResponse.json({ error: 'group_id is required' }, { status: 400 })

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

    await removeBrivoUserFromGroup(token, apiKey, groupId, params.id)

    if (siteId) {
      try {
        await supabase.from('site_events').insert({
          site_id: siteId, event_type: 'user_group_remove', event_source: 'brivo',
          title: `Group removed: ${body.name ?? 'user'} ✕ ${body.group_name ?? 'group'}`,
          description: `${user.name} removed a Brivo user from a group via Nexus`,
          summary: `Group removed by ${user.name}`,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          metadata: { brivo_user_id: params.id, group_id: groupId, by_name: user.name } as any,
        })
      } catch { /* audit best-effort */ }
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Group remove failed' }, { status: 502 })
  }
}
