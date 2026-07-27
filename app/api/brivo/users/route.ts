import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { getAllowedBrivoSite, getAllowedVaultBrivoSite } from '@/lib/brivo-scope'
import { getOrgBrivoToken, getSiteBrivoToken, listBrivoUsers, listBrivoGroups, createBrivoUser } from '@/lib/brivo'
import { canOperate } from '@/lib/system-access'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Resolve a Brivo token + brivo_site_id from EITHER a per-site id (vault) or a
// legacy org id. Returns null if the caller can't access the requested target.
async function resolveBrivo(req: NextRequest, body?: Record<string, unknown>) {
  const user = await getCurrentUser()
  const siteId = String(body?.site_id ?? req.nextUrl.searchParams.get('site_id') ?? '')
  const orgId = String(body?.org_id ?? req.nextUrl.searchParams.get('org_id') ?? '')
  if (siteId) {
    const site = await getAllowedVaultBrivoSite(user, siteId)
    if (!site) return null
    if (!(await canOperate(user, siteId, 'door_users'))) return null
    const { token, apiKey, brivoSiteId } = await getSiteBrivoToken(siteId)
    return { token, apiKey, brivoSiteId: brivoSiteId || site.brivo_site_id }
  }
  if (orgId) {
    const site = await getAllowedBrivoSite(user, orgId)
    if (!site) return null
    const { token, apiKey } = await getOrgBrivoToken(orgId)
    return { token, apiKey, brivoSiteId: site.brivo_site_id }
  }
  return null
}

// GET /api/brivo/users?site_id=<site>|org_id=<org>&groups=1
export async function GET(req: NextRequest) {
  try {
    // Specific reasons for the common per-site path (doors use a DIFFERENT
    // capability, so a login can see doors but lack door-user permission).
    const siteId = req.nextUrl.searchParams.get('site_id') ?? ''
    if (siteId) {
      const user = await getCurrentUser()
      const site = await getAllowedVaultBrivoSite(user, siteId)
      if (!site) return NextResponse.json({ error: 'This property has no Brivo login set, or it’s outside your access.' }, { status: 403 })
      if (!(await canOperate(user, siteId, 'door_users'))) return NextResponse.json({ error: 'Your login can unlock doors here but doesn’t have the “Door users (add/remove)” permission. A corporate/dealer admin can enable it so residents & admins load.' }, { status: 403 })
    }
    const ctx = await resolveBrivo(req)
    if (!ctx) return NextResponse.json({ error: 'That site is outside your access (or has no Brivo login set).' }, { status: 403 })
    // The user + group lists are SCOPED by the property's Brivo Site ID. Doors don't
    // need it, so a site can show doors but no users when the Site ID wasn't saved.
    if (!ctx.brivoSiteId) {
      return NextResponse.json({
        users: [], groups: [], needs_site_id: true,
        error: 'This property is connected to Brivo, but its Brivo Site ID isn’t saved — so residents/admins can’t be listed (doors don’t need it, which is why you see doors but not users). Open Setup & keys and reconnect Brivo, or set the Site ID.',
      })
    }
    const users = await listBrivoUsers(ctx.token, ctx.apiKey, ctx.brivoSiteId)
    const groups = req.nextUrl.searchParams.get('groups')
      ? await listBrivoGroups(ctx.token, ctx.apiKey, ctx.brivoSiteId).catch(() => [])
      : undefined
    return NextResponse.json({ users, ...(groups ? { groups } : {}) })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Brivo fetch failed' }, { status: 502 })
  }
}

// POST /api/brivo/users  { site_id|org_id, firstName, lastName, email?, unit?, groupId? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const ctx = await resolveBrivo(req, body)
    if (!ctx) return NextResponse.json({ error: 'That site is outside your access (or has no Brivo login set).' }, { status: 403 })

    const firstName = String(body.firstName ?? '').trim()
    const lastName = String(body.lastName ?? '').trim()
    if (!firstName || !lastName) return NextResponse.json({ error: 'First and last name are required.' }, { status: 400 })

    const created = await createBrivoUser(ctx.token, ctx.apiKey, {
      firstName,
      lastName,
      email: body.email ? String(body.email).trim() : null,
      externalId: body.unit ? String(body.unit).trim() : null,
      groupId: body.groupId ? String(body.groupId) : null,
    })
    return NextResponse.json({ ok: true, id: created.id }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Brivo create failed' }, { status: 502 })
  }
}
