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
    const ctx = await resolveBrivo(req)
    if (!ctx) return NextResponse.json({ error: 'That site is outside your access (or has no Brivo login set).' }, { status: 403 })
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
