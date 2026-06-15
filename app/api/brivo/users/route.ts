import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { getAllowedBrivoSite } from '@/lib/brivo-scope'
import { getOrgBrivoToken, listBrivoUsers, listBrivoGroups, createBrivoUser } from '@/lib/brivo'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/brivo/users?org_id=<org>&groups=1
// Each site authenticates with its OWN Brivo credentials (per org).
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    const orgId = req.nextUrl.searchParams.get('org_id') ?? ''
    if (!orgId) return NextResponse.json({ error: 'org_id is required' }, { status: 400 })
    const site = await getAllowedBrivoSite(user, orgId)
    if (!site) return NextResponse.json({ error: 'That site is outside your access.' }, { status: 403 })

    const { token, apiKey } = await getOrgBrivoToken(orgId)
    const users = await listBrivoUsers(token, apiKey, site.brivo_site_id)
    const groups = req.nextUrl.searchParams.get('groups')
      ? await listBrivoGroups(token, apiKey, site.brivo_site_id).catch(() => [])
      : undefined
    return NextResponse.json({ users, ...(groups ? { groups } : {}) })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Brivo fetch failed' }, { status: 502 })
  }
}

// POST /api/brivo/users  { org_id, firstName, lastName, email?, unit?, groupId? }
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    const body = await req.json().catch(() => ({}))
    const orgId = String(body.org_id ?? '')
    if (!orgId) return NextResponse.json({ error: 'org_id is required' }, { status: 400 })
    const site = await getAllowedBrivoSite(user, orgId)
    if (!site) return NextResponse.json({ error: 'That site is outside your access.' }, { status: 403 })

    const firstName = String(body.firstName ?? '').trim()
    const lastName = String(body.lastName ?? '').trim()
    if (!firstName || !lastName) return NextResponse.json({ error: 'First and last name are required.' }, { status: 400 })

    const { token, apiKey } = await getOrgBrivoToken(orgId)
    const created = await createBrivoUser(token, apiKey, {
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
