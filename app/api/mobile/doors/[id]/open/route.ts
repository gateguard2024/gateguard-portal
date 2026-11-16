/**
 * POST /api/mobile/doors/[id]/open   body: { site_id }
 * Resident app "Open" button. Re-checks everything on every tap: signed in, active access
 * row for that site, not suspended in Brivo, door belongs to that site. Then Brivo /activate.
 * Every attempt is written to resident_door_opens.
 */
import { NextRequest, NextResponse } from 'next/server'
import { unlockBrivoDoor } from '@/lib/brivo'
import { brivoStatus, getAccessRows, getMobileCaller, logOpen, siteDoors } from '@/lib/mobile-resident'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const caller = await getMobileCaller()
  if (!caller) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const siteId = typeof body?.site_id === 'string' ? body.site_id : ''
  const doorId = params.id
  if (!siteId || !doorId) return NextResponse.json({ error: 'site_id and door id are required' }, { status: 400 })

  const row = (await getAccessRows(caller)).find(r => r.site_id === siteId)
  if (!row) {
    await logOpen({ site_id: siteId, clerk_user_id: caller.userId, door_id: doorId, result: 'denied', detail: 'no active access' }).catch(() => {})
    return NextResponse.json({ error: 'Your access is not active. Please contact the leasing office.' }, { status: 403 })
  }

  try {
    const { brivo, doors } = await siteDoors(siteId)
    const door = doors.find(d => d.id === doorId)
    if (!door) {
      await logOpen({ site_id: siteId, access_id: row.id, clerk_user_id: caller.userId, door_id: doorId, result: 'denied', detail: 'door not at this site' })
      return NextResponse.json({ error: 'That door is not part of your property.' }, { status: 403 })
    }
    if ((await brivoStatus(row, brivo)) === 'paused') {
      await logOpen({ site_id: siteId, access_id: row.id, clerk_user_id: caller.userId, door_id: doorId, door_name: door.name, result: 'denied', detail: 'suspended in Brivo' })
      return NextResponse.json({ error: 'Your access is paused. Please contact the leasing office.' }, { status: 403 })
    }

    await unlockBrivoDoor(brivo.token, brivo.apiKey, doorId)
    await logOpen({ site_id: siteId, access_id: row.id, clerk_user_id: caller.userId, door_id: doorId, door_name: door.name, result: 'opened' })
    return NextResponse.json({ ok: true, door: door.name })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[mobile/open]', siteId, doorId, msg)
    await logOpen({ site_id: siteId, access_id: row.id, clerk_user_id: caller.userId, door_id: doorId, result: 'error', detail: msg.slice(0, 500) })
    return NextResponse.json({ error: 'The door did not respond. Please try again.' }, { status: 502 })
  }
}
