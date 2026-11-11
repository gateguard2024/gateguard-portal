/**
 * lib/packages.ts — Package rooms (Part 14 · Nexus Parcel). Shared by the Nexus Systems
 * "Packages" tab (/api/sites/[id]/packages) and the property portal Packages page
 * (/api/portal/[slug]/packages). The Jetson ingest API (step 5) will write the same tables.
 *
 * Rules that live here (keep them in one place):
 *   • Pickup is ALWAYS allowed. Storage fees never hold a package — they post to the
 *     resident's account at pickup (fee_cents) unless waived.
 *   • Fee = (days on the shelf − free days) × daily fee, capped per package. Time the room
 *     was down (fee_paused_ms) doesn't count. Defaults are UNCONFIRMED until Russel signs off.
 *   • Rotating colored day sections (5 under 120 units, 8 above) + fixed spots:
 *     Floor (oversized), Fridge (cold), Staff hold, Yellow (unsorted).
 *   • Service mode = door unlocked + alerts paused until service_until (auto-ends).
 * Tables: migration 225.
 */
import { createClient } from '@supabase/supabase-js'
import { todayET, etDateOf } from '@/lib/tz'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Any = Record<string, any>
export const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export const WAITING = ['received', 'unsorted', 'notified', 'staff_hold', 'flagged'] as const
export const STATUS_LABEL: Record<string, string> = {
  received: 'Waiting', unsorted: 'Unsorted', notified: 'Waiting', picked_up: 'Picked up', staff_hold: 'Staff hold',
  flagged: 'Flagged', returned: 'Returned', abandoned: 'Abandoned',
}
export const EXCEPTION_LABEL: Record<string, string> = {
  no_owner: 'No owner found', wrong_pickup: 'Possible wrong pickup', dumped: 'Box left outside the room', unlogged: 'Boxes not scanned',
  door_propped: 'Door propped open', tailgate: 'Someone followed in', lingering: 'Someone stayed a long time', aging: 'Waiting a long time',
  abandoned: 'Abandoned', room_health: 'Room device problem', key_used: 'Key used', damaged: 'Arrived damaged', other: 'Other',
}

// ── Fees ─────────────────────────────────────────────────────────────────────
export type FeeSettings = { free_days: number; daily_fee_cents: number; fee_cap_cents: number; property_share_cents: number; confirmed: boolean }
export const DEFAULT_FEES: FeeSettings = { free_days: 5, daily_fee_cents: 300, fee_cap_cents: 3000, property_share_cents: 200, confirmed: false }

export function feesOf(room: Any | null | undefined): FeeSettings {
  const s = (room?.settings ?? {}) as Any
  const f = (s.fees ?? {}) as Any
  const n = (v: unknown, d: number) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.round(Number(v)) : d)
  return {
    free_days: n(f.free_days, DEFAULT_FEES.free_days),
    daily_fee_cents: n(f.daily_fee_cents, DEFAULT_FEES.daily_fee_cents),
    fee_cap_cents: n(f.fee_cap_cents, DEFAULT_FEES.fee_cap_cents),
    property_share_cents: n(f.property_share_cents, DEFAULT_FEES.property_share_cents),
    confirmed: !!f.confirmed,
  }
}

const DAY = 86400000
/** Days a package has been on the shelf (whole days, room-down time excluded). */
export function daysOnShelf(p: Any, now = Date.now()): number {
  const end = p.picked_up_at ? new Date(p.picked_up_at).getTime() : now
  const ms = Math.max(0, end - new Date(p.received_at).getTime() - Number(p.fee_paused_ms || 0))
  return Math.floor(ms / DAY)
}
/** Fee owed so far (or posted at pickup). Never blocks pickup. */
export function feeFor(p: Any, fees: FeeSettings, now = Date.now()): number {
  if (p.fee_waived) return 0
  if (p.status === 'picked_up' && p.fee_posted_at) return Number(p.fee_cents || 0)
  if (p.status === 'returned') return 0
  const billable = daysOnShelf(p, now) - fees.free_days
  if (billable <= 0) return 0
  return Math.min(billable * fees.daily_fee_cents, fees.fee_cap_cents)
}
/** When fees start, e.g. for "Free until Sun 5 pm". */
export function freeUntil(p: Any, fees: FeeSettings): string {
  return new Date(new Date(p.received_at).getTime() + Number(p.fee_paused_ms || 0) + fees.free_days * DAY).toISOString()
}
export const money = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`

// ── Sections ─────────────────────────────────────────────────────────────────
export const DAY_COLORS: { name: string; color: string }[] = [
  { name: 'Blue', color: '#2F6FE0' }, { name: 'Green', color: '#2E9A55' }, { name: 'Orange', color: '#E07B22' },
  { name: 'Purple', color: '#8E5BD9' }, { name: 'Red', color: '#D7443E' }, { name: 'Teal', color: '#1BA5A5' },
  { name: 'Pink', color: '#D9508C' }, { name: 'Brown', color: '#9A6B3E' }, { name: 'Navy', color: '#2C3E8C' }, { name: 'Lime', color: '#7FA82E' },
]
export const FIXED_SPOTS = [
  { name: 'Floor', color: '#8E8E93', kind: 'oversized' }, { name: 'Fridge', color: '#5AC8FA', kind: 'cold' },
  { name: 'Staff hold', color: '#3A3A3C', kind: 'staff' }, { name: 'Yellow', color: '#FFCC00', kind: 'unsorted' },
] as const

export function defaultSections(units: number | null | undefined): { name: string; color: string; kind: string; sort: number }[] {
  const days = (units ?? 0) >= 120 ? 8 : 5
  return [
    ...DAY_COLORS.slice(0, days).map((c, i) => ({ ...c, kind: 'day', sort: i })),
    ...FIXED_SPOTS.map((f, i) => ({ name: f.name, color: f.color, kind: f.kind as string, sort: 100 + i })),
  ]
}
/** Today's section: a day section holding today's date, else the one with the oldest date (next to rotate). */
export function todaySection(sections: Any[]): Any | null {
  const days = sections.filter(s => s.kind === 'day')
  if (!days.length) return null
  const t = todayET()
  return days.find(s => s.assigned_date === t)
    ?? [...days].sort((a, b) => String(a.assigned_date ?? '').localeCompare(String(b.assigned_date ?? '')))[0]
}

// ── Setup checklist (dealer) ─────────────────────────────────────────────────
export const CHECKLIST: { key: string; label: string; help: string }[] = [
  { key: 'jetson', label: 'Jetson online', help: 'Room Jetson (gge-#####) shows in Nexus Edge and reports in.' },
  { key: 'controller', label: 'Room controller wired', help: 'ESP32: strike, door switch, key override, Amazon Key, USPS key, tamper, heat, power status (drawing PR-01.3).' },
  { key: 'door_panel', label: 'Door panel + scanner', help: 'Outside panel shows the scan screen; a test label opens the door in under 1 s.' },
  { key: 'cameras', label: 'Cameras cover the room', help: 'Door camera + room cameras; walk every corner and confirm the AI sees you.' },
  { key: 'pad', label: 'Drop pad reads labels', help: 'Top + side cameras read 10 test boxes at odd angles; cord scanner works.' },
  { key: 'sections', label: 'Sections + lights', help: 'Each section lights its own LED range; brightness capped.' },
  { key: 'door_test', label: 'Door + key test', help: 'Strike locks on power loss; key opens from outside; key use shows as "Key used".' },
  { key: 'alerts', label: 'Alerts reach staff', help: 'Door-propped, tailgate and unlogged-box tests reach the property and monitoring.' },
  { key: 'residents', label: 'Resident list synced', help: 'Unit roster is current so labels match.' },
]

// ── Loading ──────────────────────────────────────────────────────────────────
export async function roomsForSite(siteId: string): Promise<Any[]> {
  const { data, error } = await db().from('package_rooms').select('*').eq('site_id', siteId).order('created_at')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function loadRoomView(room: Any, opts: { q?: string; filter?: string; limit?: number } = {}): Promise<Any> {
  const sb = db()
  const fees = feesOf(room)
  const today = todayET()
  const since = new Date(Date.now() - 2 * DAY).toISOString()
  const [sec, waiting, recent, exc, sess] = await Promise.all([
    sb.from('package_sections').select('*').eq('room_id', room.id).order('sort'),
    sb.from('packages').select('*').eq('room_id', room.id).in('status', WAITING as unknown as string[]).order('received_at', { ascending: false }).limit(1000),
    sb.from('packages').select('*').eq('room_id', room.id).gte('updated_at', since).order('updated_at', { ascending: false }).limit(200),
    sb.from('package_exceptions').select('*').eq('room_id', room.id).eq('status', 'open').order('created_at', { ascending: false }).limit(100),
    sb.from('package_sessions').select('*').eq('room_id', room.id).order('started_at', { ascending: false }).limit(15),
  ])
  for (const r of [sec, waiting, recent, exc, sess]) if (r.error) throw new Error(r.error.message)
  const sections = sec.data ?? []
  const secById: Record<string, Any> = Object.fromEntries(sections.map(s => [s.id, s]))
  const now = Date.now()
  const decorate = (p: Any): Any => ({
    ...p,
    status_label: STATUS_LABEL[p.status] ?? p.status,
    section: p.section_id ? { name: secById[p.section_id]?.name, color: secById[p.section_id]?.color, kind: secById[p.section_id]?.kind } : null,
    days: daysOnShelf(p, now),
    fee_now: feeFor(p, fees, now),
    free_until: freeUntil(p, fees),
  })
  const wait = (waiting.data ?? []).map(decorate)
  const deliveredToday = (recent.data ?? []).filter(p => etDateOf(p.received_at) === today).length
  const pickedToday = (recent.data ?? []).filter(p => p.picked_up_at && etDateOf(p.picked_up_at) === today).length

  // Aging (past the free days) shows in Needs attention even without an exception row.
  const aging = wait.filter(p => p.days >= fees.free_days && p.status !== 'staff_hold')
  const exceptions = (exc.data ?? []).map(e => ({ ...e, label: EXCEPTION_LABEL[e.kind] ?? e.kind }))

  let list: Any[]
  const f = opts.filter || 'waiting'
  if (f === 'waiting') list = wait
  else if (f === 'today') list = (recent.data ?? []).filter(p => etDateOf(p.received_at) === today).map(decorate)
  else if (f === 'picked_up') list = (recent.data ?? []).filter(p => p.status === 'picked_up').map(decorate)
  else if (f === 'aging') list = aging
  else list = wait
  const q = (opts.q ?? '').trim().toLowerCase()
  if (q) {
    // Search reaches older packages too (any status), not just what's loaded.
    const like = `%${q.replace(/[%_,()]/g, ' ')}%`
    const { data: found } = await sb.from('packages').select('*').eq('room_id', room.id)
      .or(`recipient_name.ilike.${like},unit.ilike.${like},tracking.ilike.${like},carrier.ilike.${like}`)
      .order('received_at', { ascending: false }).limit(100)
    list = (found ?? []).map(decorate)
  }

  const serviceOn = !!(room.service_until && new Date(room.service_until).getTime() > now)
  return {
    room: { ...room, service_on: serviceOn },
    fees,
    sections: sections.map(s => ({ ...s, waiting: wait.filter(p => p.section_id === s.id).length })),
    today_section: todaySection(sections),
    overview: {
      waiting: wait.length,
      delivered_today: deliveredToday,
      picked_up_today: pickedToday,
      needs_attention: exceptions.length + aging.length,
      aging: aging.length,
      fees_accruing_cents: wait.reduce((s, p) => s + p.fee_now, 0),
      oldest_days: wait.reduce((m, p) => Math.max(m, p.days), 0),
    },
    exceptions,
    aging: aging.slice(0, 50),
    packages: list.slice(0, opts.limit ?? 300),
    sessions: sess.data ?? [],
  }
}

export async function packageDetail(roomId: string, id: string): Promise<Any | null> {
  const sb = db()
  const { data: p } = await sb.from('packages').select('*').eq('id', id).eq('room_id', roomId).maybeSingle()
  if (!p) return null
  const [ev, room, sec] = await Promise.all([
    sb.from('package_events').select('*').eq('package_id', id).order('created_at'),
    sb.from('package_rooms').select('*').eq('id', roomId).maybeSingle(),
    p.section_id ? sb.from('package_sections').select('name, color, kind').eq('id', p.section_id).maybeSingle() : Promise.resolve({ data: null }),
  ])
  const fees = feesOf(room.data)
  return {
    package: { ...p, status_label: STATUS_LABEL[p.status] ?? p.status, section: sec.data, days: daysOnShelf(p), fee_now: feeFor(p, fees), free_until: freeUntil(p, fees) },
    events: ev.data ?? [],
  }
}

// ── Writes ───────────────────────────────────────────────────────────────────
export async function addEvent(roomId: string, packageId: string | null, kind: string, actor: string, detail: Any = {}) {
  await db().from('package_events').insert({ room_id: roomId, package_id: packageId, kind, actor, detail })
}

const CARRIERS = ['UPS', 'FedEx', 'USPS', 'Amazon', 'DHL', 'OnTrac', 'Veho', 'Other']
/** Carrier from the tracking number's format (the door panel does the same). */
export function carrierFromTracking(t: string): string | null {
  const s = t.replace(/\s+/g, '').toUpperCase()
  if (/^1Z[0-9A-Z]{16}$/.test(s)) return 'UPS'
  if (/^TBA\d{9,}$/.test(s)) return 'Amazon'
  if (/^(94|93|92|95|420\d{5})\d{18,22}$/.test(s) || /^[A-Z]{2}\d{9}US$/.test(s)) return 'USPS'
  if (/^\d{12}$/.test(s) || /^\d{15}$/.test(s) || /^\d{20}$/.test(s)) return 'FedEx'
  if (/^JD\d{18}$/.test(s) || /^\d{10}$/.test(s)) return 'DHL'
  return null
}

export type Actor = { name: string; via: 'nexus' | 'portal' }
type Result = { ok: true; data?: Any } | { ok: false; error: string; status?: number }

async function getPkg(roomId: string, id: unknown): Promise<Any | null> {
  if (typeof id !== 'string' || !id) return null
  const { data } = await db().from('packages').select('*').eq('id', id).eq('room_id', roomId).maybeSingle()
  return data
}

/** Actions both sides can run on an existing room (callers check permissions first). */
export async function runPackageAction(room: Any, action: string, body: Any, actor: Actor): Promise<Result> {
  const sb = db()
  const fees = feesOf(room)
  const now = new Date().toISOString()

  if (action === 'log_package') {
    // Office log: staff take a box at the desk or enter one by hand.
    const recipient = String(body.recipient_name ?? '').trim().slice(0, 120)
    const unit = String(body.unit ?? '').trim().slice(0, 20)
    if (!recipient && !unit) return { ok: false, error: 'Add a name or a unit.' }
    const tracking = String(body.tracking ?? '').replace(/\s+/g, '').toUpperCase().slice(0, 40) || null
    const carrier = CARRIERS.includes(String(body.carrier)) ? String(body.carrier) : (tracking ? carrierFromTracking(tracking) : null)
    const size = ['envelope', 'box', 'oversized'].includes(body.size) ? body.size : 'box'
    const flags = Array.isArray(body.flags) ? body.flags.filter((x: unknown) => ['cold', 'medication', 'signature', 'damaged'].includes(String(x))) : []
    const hold = !!body.staff_hold
    const { data: secs } = await sb.from('package_sections').select('*').eq('room_id', room.id).order('sort')
    const wantKind = hold ? 'staff' : size === 'oversized' ? 'oversized' : flags.includes('cold') ? 'cold' : null
    const section = (body.section_id && (secs ?? []).find(s => s.id === body.section_id))
      || (wantKind ? (secs ?? []).find(s => s.kind === wantKind) : todaySection(secs ?? []))
    const row = {
      room_id: room.id, site_id: room.site_id, tracking, carrier, recipient_name: recipient || null, unit: unit || null,
      section_id: section?.id ?? null, size, flags, status: hold ? 'staff_hold' : 'received', source: body.test ? 'test' : 'office',
      logged_by: actor.name, notes: String(body.notes ?? '').slice(0, 500) || null,
    }
    const { data, error } = await sb.from('packages').insert(row).select('*').single()
    if (error) return { ok: false, error: error.code === '23505' ? 'That tracking number is already logged in this room.' : error.message }
    await addEvent(room.id, data.id, 'received', actor.name, { via: actor.via, source: row.source, section: section?.name ?? null })
    return { ok: true, data: { package: data } }
  }

  if (action === 'resolve') {
    const id = String(body.id ?? '')
    const resolution = String(body.resolution ?? '').trim().slice(0, 300) || 'Handled'
    const { data, error } = await sb.from('package_exceptions').update({ status: 'resolved', resolved_at: now, resolved_by: actor.name, resolution })
      .eq('id', id).eq('room_id', room.id).eq('status', 'open').select('id, package_id').maybeSingle()
    if (error) return { ok: false, error: error.message }
    if (!data) return { ok: false, error: 'Already handled.', status: 409 }
    if (data.package_id) await addEvent(room.id, data.package_id, 'note', actor.name, { text: `Resolved: ${resolution}` })
    return { ok: true }
  }

  if (action === 'service') {
    const minutes = Math.max(0, Math.min(8 * 60, Math.round(Number(body.minutes) || 0)))
    const until = minutes ? new Date(Date.now() + minutes * 60000).toISOString() : null
    const note = String(body.note ?? '').slice(0, 200) || null
    const { error } = await sb.from('package_rooms').update({ service_until: until, service_by: minutes ? actor.name : null, service_note: minutes ? note : null, updated_at: now }).eq('id', room.id)
    if (error) return { ok: false, error: error.message }
    await addEvent(room.id, null, minutes ? 'service_on' : 'service_off', actor.name, { minutes, note, via: actor.via })
    // The room's Jetson reads service_until on its next check-in (step 5) and unlocks / relocks.
    return { ok: true, data: { service_until: until } }
  }

  // Everything below works on one package.
  const p = await getPkg(room.id, body.id)
  if (!p) return { ok: false, error: 'Package not found.', status: 404 }

  if (action === 'pickup') {
    if (p.status === 'picked_up') return { ok: false, error: 'Already picked up.', status: 409 }
    if (p.status === 'returned') return { ok: false, error: 'This one was returned to the sender.', status: 409 }
    // Pickup is always allowed — the fee posts to the resident's account, it never blocks.
    const fee = feeFor({ ...p, picked_up_at: now, status: 'received' }, fees)
    const by = String(body.picked_up_by ?? '').trim().slice(0, 120) || p.recipient_name || 'Resident'
    const { error } = await sb.from('packages').update({ status: 'picked_up', picked_up_at: now, picked_up_by: by, fee_cents: fee, fee_posted_at: fee ? now : null, updated_at: now }).eq('id', p.id)
    if (error) return { ok: false, error: error.message }
    await addEvent(room.id, p.id, 'picked_up', actor.name, { by, fee_cents: fee, via: actor.via, at_desk: true })
    return { ok: true, data: { fee_cents: fee } }
  }
  if (action === 'hold' || action === 'release') {
    const on = action === 'hold'
    if (['picked_up', 'returned'].includes(p.status)) return { ok: false, error: 'This package already left the room.', status: 409 }
    const patch: Any = { status: on ? 'staff_hold' : 'received', updated_at: now }
    if (on) { const { data: st } = await sb.from('package_sections').select('id').eq('room_id', room.id).eq('kind', 'staff').maybeSingle(); if (st) patch.section_id = st.id }
    const { error } = await sb.from('packages').update(patch).eq('id', p.id)
    if (error) return { ok: false, error: error.message }
    await addEvent(room.id, p.id, on ? 'staff_hold' : 'released', actor.name, { via: actor.via })
    return { ok: true }
  }
  if (action === 'return') {
    if (['picked_up', 'returned'].includes(p.status)) return { ok: false, error: 'This package already left the room.', status: 409 }
    const reason = String(body.reason ?? '').slice(0, 200) || 'Returned to sender'
    const { error } = await sb.from('packages').update({ status: 'returned', updated_at: now, notes: [p.notes, reason].filter(Boolean).join(' · ') }).eq('id', p.id)
    if (error) return { ok: false, error: error.message }
    await addEvent(room.id, p.id, 'returned', actor.name, { reason, via: actor.via })
    return { ok: true }
  }
  if (action === 'waive') {
    const { error } = await sb.from('packages').update({ fee_waived: true, fee_cents: 0, updated_at: now }).eq('id', p.id)
    if (error) return { ok: false, error: error.message }
    await addEvent(room.id, p.id, 'fee_waived', actor.name, { via: actor.via, reason: String(body.reason ?? '').slice(0, 200) || null })
    return { ok: true }
  }
  if (action === 'assign') {
    // Fix who it's for (unsorted / wrong unit).
    const recipient = String(body.recipient_name ?? p.recipient_name ?? '').trim().slice(0, 120) || null
    const unit = String(body.unit ?? p.unit ?? '').trim().slice(0, 20) || null
    if (!unit) return { ok: false, error: 'Add the unit.' }
    const patch: Any = { recipient_name: recipient, unit, updated_at: now }
    if (p.status === 'unsorted' || p.status === 'flagged') patch.status = 'received'
    const { error } = await sb.from('packages').update(patch).eq('id', p.id)
    if (error) return { ok: false, error: error.message }
    await addEvent(room.id, p.id, 'assigned', actor.name, { unit, recipient, via: actor.via })
    // The resident alert goes out from the notify step (step 8 — resident app).
    return { ok: true }
  }
  if (action === 'note') {
    const text = String(body.text ?? '').trim().slice(0, 500)
    if (!text) return { ok: false, error: 'Write a note.' }
    await addEvent(room.id, p.id, 'note', actor.name, { text, via: actor.via })
    return { ok: true }
  }
  return { ok: false, error: 'Unknown action.' }
}

// ── Dealer-only setup actions ────────────────────────────────────────────────
export async function createRoom(siteId: string, name: string, by: string): Promise<Any> {
  const sb = db()
  const { data: site } = await sb.from('sites').select('billing_units').eq('id', siteId).maybeSingle()
  const { data: room, error } = await sb.from('package_rooms').insert({ site_id: siteId, name: name.trim().slice(0, 80) || 'Package Room', created_by: by, settings: { fees: DEFAULT_FEES } }).select('*').single()
  if (error) throw new Error(error.message)
  const secs = defaultSections(site?.billing_units).map(s => ({ ...s, room_id: room.id }))
  const { error: e2 } = await sb.from('package_sections').insert(secs)
  if (e2) throw new Error(e2.message)
  await addEvent(room.id, null, 'room_created', by, { units: site?.billing_units ?? null })
  return room
}

/** Bench / demo data so the pages show something before the Jetson is hooked up. */
export async function seedTestData(room: Any, by: string): Promise<number> {
  const sb = db()
  const { data: secs } = await sb.from('package_sections').select('*').eq('room_id', room.id).order('sort')
  const day = todaySection(secs ?? [])
  const k = (kind: string) => (secs ?? []).find(s => s.kind === kind)
  const ago = (h: number) => new Date(Date.now() - h * 3600000).toISOString()
  const { data: sess } = await sb.from('package_sessions').insert({ room_id: room.id, site_id: room.site_id, kind: 'delivery', entry_method: 'label_scan', carrier: 'UPS', started_at: ago(1.2), ended_at: ago(1.1), boxes_scanned: 5, boxes_seen: 6, source: 'test' }).select('id').single()
  const rows = [
    { recipient_name: 'J. Smith', unit: '214', carrier: 'UPS', size: 'box', section_id: day?.id, received_at: ago(1.2) },
    { recipient_name: 'R. Smith', unit: '214', carrier: 'UPS', size: 'envelope', section_id: day?.id, received_at: ago(1.2) },
    { recipient_name: 'A. Patel', unit: '108', carrier: 'UPS', size: 'box', section_id: day?.id, received_at: ago(1.15) },
    { recipient_name: 'M. Ortiz', unit: '311', carrier: 'UPS', size: 'oversized', section_id: k('oversized')?.id, received_at: ago(1.15) },
    { recipient_name: 'T. Nguyen', unit: '162', carrier: 'Amazon', size: 'box', flags: ['cold'], section_id: k('cold')?.id, received_at: ago(3) },
    { recipient_name: 'L. Brooks', unit: '405', carrier: 'FedEx', size: 'box', section_id: day?.id, received_at: ago(24 * 7) },
    { recipient_name: null, unit: null, carrier: 'FedEx', size: 'box', status: 'unsorted', section_id: k('unsorted')?.id, received_at: ago(1.1) },
  ].map((r, i) => ({ status: 'received', flags: [], ...r, room_id: room.id, site_id: room.site_id, session_id: sess?.id ?? null, source: 'test', logged_by: by, tracking: `TEST${Date.now().toString().slice(-7)}${i}` }))
  const { data: pk, error } = await sb.from('packages').insert(rows).select('id, status')
  if (error) throw new Error(error.message)
  await sb.from('package_exceptions').insert([
    { room_id: room.id, site_id: room.site_id, package_id: (pk ?? []).find(p => p.status === 'unsorted')?.id ?? null, kind: 'no_owner', severity: 'warn', title: 'Label unreadable — on the yellow shelf', detail: 'Driver tried the pad twice. Check the label and assign it.', source: 'test' },
    { room_id: room.id, site_id: room.site_id, session_id: sess?.id ?? null, kind: 'unlogged', severity: 'warn', title: 'UPS delivery: 6 boxes seen, 5 scanned', detail: 'One box went on the shelf without crossing the pad. Clip saved.', source: 'test' },
  ])
  return rows.length
}

export async function clearTestData(roomId: string): Promise<void> {
  const sb = db()
  await sb.from('package_exceptions').delete().eq('room_id', roomId).eq('source', 'test')
  await sb.from('packages').delete().eq('room_id', roomId).eq('source', 'test')
  await sb.from('package_sessions').delete().eq('room_id', roomId).eq('source', 'test')
}
