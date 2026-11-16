/**
 * GET /api/mobile/me — resident app: who am I and what can I open right now?
 * Auth: Clerk session token (Authorization: Bearer). Reads everything live, nothing cached
 * in the app, so a change in the portal or in Brivo shows on the next call.
 */
import { NextResponse } from 'next/server'
import { brivoStatus, db, getAccessRows, getMobileCaller, siteDoors, tagResidentIfNew } from '@/lib/mobile-resident'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const caller = await getMobileCaller()
  if (!caller) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  try {
    const rows = await getAccessRows(caller)
    if (rows.length) await tagResidentIfNew(caller)

    const siteIds = Array.from(new Set(rows.map(r => r.site_id)))
    const [{ data: sites }, { data: cams }] = await Promise.all([
      db().from('sites').select('id, name, address, city, state').in('id', siteIds.length ? siteIds : ['00000000-0000-0000-0000-000000000000']),
      db().from('door_cameras').select('site_id, door_id, camera_name, stream_url').in('site_id', siteIds.length ? siteIds : ['00000000-0000-0000-0000-000000000000']),
    ])

    const properties = await Promise.all(rows.map(async row => {
      const site = (sites ?? []).find(s => s.id === row.site_id)
      const base = {
        site_id: row.site_id,
        name: site?.name ?? 'Your property',
        address: [site?.address, site?.city, site?.state].filter(Boolean).join(', '),
        unit: row.unit_number,
      }
      try {
        const { brivo, doors } = await siteDoors(row.site_id)
        const status = await brivoStatus(row, brivo)
        return {
          ...base,
          status,
          doors: status === 'active'
            ? doors.map(d => {
                const cam = (cams ?? []).find(c => c.site_id === row.site_id && c.door_id === d.id)
                return { id: d.id, name: d.name, camera: cam ? { name: cam.camera_name, stream_url: cam.stream_url } : null }
              })
            : [],
        }
      } catch (e) {
        console.error('[mobile/me] site', row.site_id, e)
        return { ...base, status: 'unavailable' as const, doors: [] }
      }
    }))

    return NextResponse.json({
      user: { name: caller.name, email: caller.emails[0] ?? null },
      properties,
    })
  } catch (e) {
    console.error('[mobile/me]', e)
    return NextResponse.json({ error: 'Could not load your access. Please try again.' }, { status: 500 })
  }
}
