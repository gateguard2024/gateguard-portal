/**
 * /api/portal/[slug]/packages — the property manager's Packages page (Nexus property portal).
 *
 * GET  (portal PIN)                    → room view (lib/packages loadRoomView) — ?filter=&q=&room=
 * GET  ?package=<id>                   → { package, events }
 * POST (portal PIN + personal manager PIN, like gate control — every change names a person):
 *   log_package, pickup, hold, release, return, waive, assign, note, resolve, service
 * Room setup, devices and fee amounts are set by Gate Guard / the dealer in Nexus, not here.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyPortal } from '@/lib/portal-auth'
import { getPortalManager } from '@/lib/portal-manager'
import { roomsForSite, loadRoomView, packageDetail, runPackageAction, type Any } from '@/lib/packages'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const bad = (m: string, s = 400, extra: Any = {}) => NextResponse.json({ error: m, ...extra }, { status: s })
const ACTIONS = ['log_package', 'pickup', 'hold', 'release', 'return', 'waive', 'assign', 'note', 'resolve', 'service']

async function roomFor(siteId: string, want?: string | null) {
  const rooms = (await roomsForSite(siteId)).filter(r => r.status !== 'offline' || r.id === want)
  return { rooms, room: rooms.find(r => r.id === want) ?? rooms[0] ?? null }
}

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const v = await verifyPortal(req, params.slug)
  if (!v.ok) return bad(v.error, v.status)
  if (!v.portal.site_id) return bad('This portal is not linked to a site.')
  const sp = req.nextUrl.searchParams
  try {
    const { rooms, room } = await roomFor(v.portal.site_id, sp.get('room'))
    if (!room) return NextResponse.json({ rooms: [], room: null })
    if (sp.get('package')) {
      const d = await packageDetail(room.id, String(sp.get('package')))
      return d ? NextResponse.json(d) : bad('Package not found.', 404)
    }
    const view = await loadRoomView(room, { q: sp.get('q') ?? '', filter: sp.get('filter') ?? 'waiting' })
    // Managers don't see device ids or the setup checklist.
    const { edge_device_id: _e, controller_id: _c, door_panel_id: _d, checklist: _k, health: _h, ...safeRoom } = view.room as Any
    void _e; void _c; void _d; void _k; void _h
    return NextResponse.json({ ...view, room: safeRoom, rooms: rooms.map(r => ({ id: r.id, name: r.name, status: r.status })) })
  } catch (e) {
    return bad(e instanceof Error ? e.message : 'Could not load packages.', 500)
  }
}

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const v = await verifyPortal(req, params.slug)
  if (!v.ok) return bad(v.error, v.status)
  if (!v.portal.site_id) return bad('This portal is not linked to a site.')
  const manager = await getPortalManager(req, params.slug)
  if (!manager) return bad('Sign in with your personal PIN to make changes.', 403, { need_manager: true })
  const body = (await req.json().catch(() => ({}))) as Any
  const action = String(body.action ?? '')
  if (!ACTIONS.includes(action)) return bad('Unknown action.')
  try {
    const { room } = await roomFor(v.portal.site_id, body.room_id)
    if (!room) return bad('No package room at this property yet.', 404)
    const r = await runPackageAction(room, action, body, { name: manager.name, via: 'portal' })
    return r.ok ? NextResponse.json({ ok: true, ...(r.data ?? {}) }) : bad(r.error, r.status ?? 400)
  } catch (e) {
    return bad(e instanceof Error ? e.message : 'Something went wrong.', 500)
  }
}
