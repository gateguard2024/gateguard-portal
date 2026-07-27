/**
 * /api/brivo/users/[id]
 *   GET   → user detail + credentials (sent/active passes) + recent activity
 *   PATCH → update firstName / lastName / email / phone (or suspend via {suspended})
 * 'door_users' capability, scoped to the site.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { canOperate } from '@/lib/system-access'
import { getAllowedBrivoSite, getAllowedVaultBrivoSite } from '@/lib/brivo-scope'
import { getOrgBrivoToken, getSiteBrivoToken, getBrivoUser, updateBrivoUser, setBrivoUserSuspended, getBrivoUserCredentialSummary, getBrivoUserGroups, listSiteBrivoEvents } from '@/lib/brivo'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function resolve(siteId: string, orgId: string) {
  const user = await getCurrentUser()
  if (siteId) {
    const site = await getAllowedVaultBrivoSite(user, siteId)
    if (!site) return null
    if (!(await canOperate(user, siteId, 'door_users'))) return null
    const { token, apiKey } = await getSiteBrivoToken(siteId)
    return { token, apiKey, siteId }
  }
  if (orgId) {
    const site = await getAllowedBrivoSite(user, orgId)
    if (!site) return null
    const { token, apiKey } = await getOrgBrivoToken(orgId)
    return { token, apiKey, siteId: '' }
  }
  return null
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await resolve(String(req.nextUrl.searchParams.get('site_id') ?? ''), String(req.nextUrl.searchParams.get('org_id') ?? ''))
    if (!ctx) return NextResponse.json({ error: 'That site is outside your access (or you lack door-user permission).' }, { status: 403 })
    const [raw, credentials, groups] = await Promise.all([
      getBrivoUser(ctx.token, ctx.apiKey, params.id).catch(() => ({})),
      getBrivoUserCredentialSummary(ctx.token, ctx.apiKey, params.id).catch(() => []),
      getBrivoUserGroups(ctx.token, ctx.apiKey, params.id).catch(() => []),
    ])
    let activity: unknown[] = []
    if (ctx.siteId) {
      const name = `${raw.firstName ?? ''} ${raw.lastName ?? ''}`.trim().toLowerCase()
      const events = await listSiteBrivoEvents(ctx.siteId, 100).catch(() => [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      activity = (events as any[]).filter(e => name && String(e.actor ?? '').toLowerCase().includes(name)).slice(0, 20)
    }
    return NextResponse.json({ user: raw, credentials, groups, activity })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Brivo user fetch failed' }, { status: 502 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json().catch(() => ({}))
    const ctx = await resolve(String(body.site_id ?? ''), String(body.org_id ?? ''))
    if (!ctx) return NextResponse.json({ error: 'You don’t have permission to edit users for this site.' }, { status: 403 })

    if (body.suspended !== undefined) {
      await setBrivoUserSuspended(ctx.token, ctx.apiKey, params.id, body.suspended === true)
      return NextResponse.json({ ok: true })
    }
    await updateBrivoUser(ctx.token, ctx.apiKey, params.id, {
      firstName: body.firstName, lastName: body.lastName,
      email: body.email !== undefined ? (body.email || null) : undefined,
      phone: body.phone !== undefined ? (body.phone || null) : undefined,
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Update failed' }, { status: 502 })
  }
}
