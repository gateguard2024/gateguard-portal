/**
 * /api/sites/[id]/packages — Package room(s) for one property (Nexus → Systems → Packages tab).
 *
 * GET                     → { rooms, room, sections, today_section, overview, exceptions, aging, packages, sessions,
 *                             fees, checklist, can_setup, units }   (?room=<id>&filter=waiting|today|picked_up|aging&q=)
 * GET ?package=<id>       → { package, events }  (timeline)
 * POST { action, … }
 *   Everyone with door access at this property (canOperate 'doors'):
 *     log_package, pickup, hold, release, return, waive, assign, note, resolve, service
 *   Setup — Gate Guard corporate or the dealer's admin:
 *     create_room { name }, save_room { room_id, name, edge_device_id, controller_id, door_panel_id, fees },
 *     save_sections { room_id, sections: [{ id?, name, color, kind, sort, led_start, led_end }] },
 *     check { room_id, key, done }, go_live { room_id }, take_offline { room_id },
 *     seed_test { room_id }, clear_test { room_id }
 * Logic + rules: lib/packages.ts. Tables: migration 225.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { canOperate } from '@/lib/system-access'
import { normalizeRole } from '@/lib/permissions'
import {
  db, roomsForSite, loadRoomView, packageDetail, runPackageAction, createRoom, seedTestData, clearTestData,
  feesOf, CHECKLIST, DAY_COLORS, type Any,
} from '@/lib/packages'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const bad = (m: string, s = 400) => NextResponse.json({ error: m }, { status: s })
const OPERATE = ['log_package', 'pickup', 'hold', 'release', 'return', 'waive', 'assign', 'note', 'resolve', 'service']

async function access(siteId: string) {
  const user = await getCurrentUser()
  const view = await canOperate(user, siteId, 'doors')
  const setup = view && (user.isCorporate || normalizeRole(user.role) === 'admin')
  return { user, view, setup }
}
const missingTables = (e: unknown) => /package_rooms|relation .* does not exist|schema cache/i.test(e instanceof Error ? e.message : String(e))

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const a = await access(params.id)
  if (!a.view) return bad('No access to this property’s systems.', 403)
  const sp = req.nextUrl.searchParams
  try {
    const rooms = await roomsForSite(params.id)
    const room = rooms.find(r => r.id === sp.get('room')) ?? rooms[0] ?? null
    if (sp.get('package')) {
      if (!room) return bad('No package room here.', 404)
      const d = await packageDetail(room.id, String(sp.get('package')))
      return d ? NextResponse.json(d) : bad('Package not found.', 404)
    }
    const { data: site } = await db().from('sites').select('billing_units').eq('id', params.id).maybeSingle()
    const base = { rooms: rooms.map(r => ({ id: r.id, name: r.name, status: r.status })), can_setup: a.setup, units: site?.billing_units ?? null, checklist_steps: CHECKLIST, colors: DAY_COLORS }
    if (!room) return NextResponse.json({ ...base, room: null })
    const view = await loadRoomView(room, { q: sp.get('q') ?? '', filter: sp.get('filter') ?? 'waiting' })
    return NextResponse.json({ ...base, ...view })
  } catch (e) {
    if (missingTables(e)) return NextResponse.json({ rooms: [], room: null, can_setup: a.setup, needs_migration: true })
    return bad(e instanceof Error ? e.message : 'Could not load packages.', 500)
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const a = await access(params.id)
  if (!a.view) return bad('No access to this property’s systems.', 403)
  const body = (await req.json().catch(() => ({}))) as Any
  const action = String(body.action ?? '')
  const actor = { name: a.user.name || a.user.email || 'Gate Guard', via: 'nexus' as const }
  const sb = db()

  try {
    if (action === 'create_room') {
      if (!a.setup) return bad('Only Gate Guard or your admin can set up a package room.', 403)
      const room = await createRoom(params.id, String(body.name ?? ''), actor.name)
      return NextResponse.json({ ok: true, room })
    }

    const rooms = await roomsForSite(params.id)
    const room = rooms.find(r => r.id === (body.room_id ?? rooms[0]?.id))
    if (!room) return bad('Set up a package room first.', 404)

    if (OPERATE.includes(action)) {
      const r = await runPackageAction(room, action, body, actor)
      return r.ok ? NextResponse.json({ ok: true, ...(r.data ?? {}) }) : bad(r.error, r.status ?? 400)
    }

    if (!a.setup) return bad('Only Gate Guard or your admin can change the room setup.', 403)
    const now = new Date().toISOString()

    if (action === 'save_room') {
      const s = (room.settings ?? {}) as Any
      const incoming = { ...((body.fees ?? {}) as Any) }
      if (!a.user.isCorporate) delete incoming.confirmed  // only Gate Guard confirms fee amounts
      const f = { ...feesOf(room), ...incoming }
      const clean = (v: unknown) => (String(v ?? '').trim().slice(0, 40) || null)
      const patch: Any = {
        name: String(body.name ?? room.name).trim().slice(0, 80) || room.name,
        edge_device_id: clean(body.edge_device_id ?? room.edge_device_id),
        controller_id: clean(body.controller_id ?? room.controller_id),
        door_panel_id: clean(body.door_panel_id ?? room.door_panel_id),
        settings: { ...s, fees: feesOf({ settings: { fees: f } }) },
        updated_at: now,
      }
      const { error } = await sb.from('package_rooms').update(patch).eq('id', room.id)
      if (error) return bad(error.message, 500)
      return NextResponse.json({ ok: true })
    }

    if (action === 'save_sections') {
      const list = Array.isArray(body.sections) ? (body.sections as Any[]) : []
      if (!list.length) return bad('Keep at least one section.')
      const kinds = ['day', 'oversized', 'cold', 'staff', 'unsorted']
      const { data: existing } = await sb.from('package_sections').select('id').eq('room_id', room.id)
      const keep = new Set<string>()
      for (const [i, x] of list.entries()) {
        const row = {
          room_id: room.id, name: String(x.name ?? '').trim().slice(0, 30) || `Section ${i + 1}`,
          color: /^#[0-9a-f]{6}$/i.test(String(x.color)) ? String(x.color) : '#2F6FE0',
          kind: kinds.includes(x.kind) ? x.kind : 'day', sort: Number.isFinite(Number(x.sort)) ? Number(x.sort) : i,
          led_start: Number.isFinite(Number(x.led_start)) && x.led_start !== '' && x.led_start != null ? Number(x.led_start) : null,
          led_end: Number.isFinite(Number(x.led_end)) && x.led_end !== '' && x.led_end != null ? Number(x.led_end) : null,
        }
        if (x.id && (existing ?? []).some(e => e.id === x.id)) {
          const { error } = await sb.from('package_sections').update(row).eq('id', x.id)
          if (error) return bad(error.message, 500)
          keep.add(x.id)
        } else {
          const { data, error } = await sb.from('package_sections').insert(row).select('id').single()
          if (error) return bad(error.message, 500)
          keep.add(data.id)
        }
      }
      // Removed sections: packages keep their record (section_id → null).
      const drop = (existing ?? []).map(e => e.id).filter(id => !keep.has(id))
      if (drop.length) await sb.from('package_sections').delete().in('id', drop)
      return NextResponse.json({ ok: true })
    }

    if (action === 'check') {
      const key = String(body.key ?? '')
      if (!CHECKLIST.some(c => c.key === key)) return bad('Unknown step.')
      const list = { ...((room.checklist ?? {}) as Any) }
      if (body.done) list[key] = { at: now, by: actor.name }; else delete list[key]
      const { error } = await sb.from('package_rooms').update({ checklist: list, updated_at: now }).eq('id', room.id)
      if (error) return bad(error.message, 500)
      return NextResponse.json({ ok: true, checklist: list })
    }

    if (action === 'go_live' || action === 'take_offline') {
      const live = action === 'go_live'
      if (live) {
        const done = (room.checklist ?? {}) as Any
        const left = CHECKLIST.filter(c => !done[c.key])
        if (left.length && !(a.user.isCorporate && body.override)) return bad(`Finish setup first: ${left.map(c => c.label).join(', ')}.`, 409)
      }
      const { error } = await sb.from('package_rooms').update({ status: live ? 'live' : 'offline', updated_at: now }).eq('id', room.id)
      if (error) return bad(error.message, 500)
      await sb.from('package_events').insert({ room_id: room.id, kind: live ? 'room_live' : 'room_offline', actor: actor.name, detail: { override: !!body.override } })
      return NextResponse.json({ ok: true })
    }

    if (action === 'seed_test') { const n = await seedTestData(room, actor.name); return NextResponse.json({ ok: true, added: n }) }
    if (action === 'clear_test') { await clearTestData(room.id); return NextResponse.json({ ok: true }) }

    return bad('Unknown action.')
  } catch (e) {
    if (missingTables(e)) return bad('Package tables aren’t set up yet — run migration 225 on this database.', 503)
    return bad(e instanceof Error ? e.message : 'Something went wrong.', 500)
  }
}
