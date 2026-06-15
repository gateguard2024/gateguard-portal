import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { isBrivoSiteAllowed } from '@/lib/brivo-scope'
import { getMasterBrivoToken, listBrivoUsers, listBrivoGroups, createBrivoUser } from '@/lib/brivo'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/brivo/users?site_id=<brivo_site_id>&groups=1
// Returns the live Brivo user list for a site the caller is allowed to see.
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    const siteId = req.nextUrl.searchParams.get('site_id') ?? ''
    if (!siteId) return NextResponse.json({ error: 'site_id is required' }, { status: 400 })
    if (!(await isBrivoSiteAllowed(user, siteId))) {
      return NextResponse.json({ error: 'That site is outside your access.' }, { status: 403 })
    }
    const { token, apiKey } = await getMasterBrivoToken()
    const users = await listBrivoUsers(token, apiKey, siteId)
    const groups = req.nextUrl.searchParams.get('groups')
      ? await listBrivoGroups(token, apiKey, siteId).catch(() => [])
      : undefined
    return NextResponse.json({ users, ...(groups ? { groups } : {}) })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Brivo fetch failed' }, { status: 502 })
  }
}

// POST /api/brivo/users  { site_id, firstName, lastName, email?, unit?, groupId? }
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    const body = await req.json().catch(() => ({}))
    const siteId = String(body.site_id ?? '')
    if (!siteId) return NextResponse.json({ error: 'site_id is required' }, { status: 400 })
    if (!(await isBrivoSiteAllowed(user, siteId))) {
      return NextResponse.json({ error: 'That site is outside your access.' }, { status: 403 })
    }
    const firstName = String(body.firstName ?? '').trim()
    const lastName = String(body.lastName ?? '').trim()
    if (!firstName || !lastName) return NextResponse.json({ error: 'First and last name are required.' }, { status: 400 })

    const { token, apiKey } = await getMasterBrivoToken()
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
