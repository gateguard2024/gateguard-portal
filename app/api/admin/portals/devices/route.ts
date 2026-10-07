import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { getSiteEagleEyeAccess, listEagleEyeCameras } from '@/lib/eagle-eye'
import { getSiteBrivoToken, listBrivoDoors } from '@/lib/brivo'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/admin/portals/devices?site_id=UUID  (corporate-only)
// Lists every camera + door the site's connected Brivo / Eagle Eye accounts
// expose, so the provisioning UI can offer a per-device include toggle instead
// of asking anyone to paste IDs. Each feed is independent + failure-tolerant.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user.isCorporate) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const siteId = req.nextUrl.searchParams.get('site_id')
  if (!siteId) return NextResponse.json({ error: 'site_id is required' }, { status: 400 })

  const cameras = await (async () => {
    try {
      const { token, baseHost } = await getSiteEagleEyeAccess(siteId)
      const all = await listEagleEyeCameras(token, baseHost)
      return all.map(c => ({ id: c.id, name: c.name, online: c.online !== false }))
    } catch { return [] }
  })()

  const doors = await (async () => {
    try {
      const { token, apiKey, brivoSiteId } = await getSiteBrivoToken(siteId)
      const all = await listBrivoDoors(token, apiKey, brivoSiteId)
      return all.map(d => ({ id: d.id, name: d.name }))
    } catch { return [] }
  })()

  return NextResponse.json({
    cameras,
    doors,
    camerasConnected: cameras.length > 0,
    doorsConnected: doors.length > 0,
  })
}
