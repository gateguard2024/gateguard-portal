/**
 * Openings (migration 233) — the gates / doors / entrances at a property.
 * One opening groups: installed devices (site_assets.opening_id), Brivo door(s),
 * cameras, Shelly relays and Gate Watch gates. Jobs name the opening they were
 * for (work_orders.opening_id, or opening_property = "Whole property / other"),
 * and return trips are counted per opening (lib/service-stats.ts).
 */
import { createClient } from '@supabase/supabase-js'

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export const OPENING_KINDS = ['gate', 'pedestrian', 'door', 'garage', 'elevator', 'other'] as const
export type OpeningKind = (typeof OPENING_KINDS)[number]
export type Opening = {
  id: string; site_id: string; name: string; kind: OpeningKind
  brivo_door_ids: string[]; camera_ids: string[]; relay_ids: string[]; gate_watch_ids: string[]
  notes: string | null; sort: number; active: boolean
}
export type Suggestion = {
  key: string; name: string; kind: OpeningKind; source: string
  brivo_door_ids: string[]; camera_ids: string[]; relay_ids: string[]; gate_watch_ids: string[]; asset_ids: string[]
}

const missingTable = (m: string) => /site_openings|opening_id|opening_property/.test(m) && /does not exist|schema cache|Could not find/i.test(m)
export const NEEDS_233 = 'Openings need migration 233.'

/** Active openings for a site (or [] + needsMigration before 233 runs). */
export async function listOpenings(siteId: string, includeRemoved = false): Promise<{ openings: Opening[]; needsMigration: boolean }> {
  let q = db().from('site_openings').select('id, site_id, name, kind, brivo_door_ids, camera_ids, relay_ids, gate_watch_ids, notes, sort, active').eq('site_id', siteId).order('sort').order('name')
  if (!includeRemoved) q = q.eq('active', true)
  const { data, error } = await q
  if (error) { if (missingTable(error.message)) return { openings: [], needsMigration: true }; throw new Error(error.message) }
  return { openings: (data ?? []) as Opening[], needsMigration: false }
}

export async function openingOnSite(openingId: string, siteId: string | null | undefined): Promise<boolean> {
  if (!siteId) return false
  const { data, error } = await db().from('site_openings').select('id').eq('id', openingId).eq('site_id', siteId).eq('active', true).maybeSingle()
  return !error && !!data
}

export const guessKind = (name: string): OpeningKind =>
  /elevator/i.test(name) ? 'elevator' : /garage|parking/i.test(name) ? 'garage'
    : /ped|walk|man ?gate|pool|amenity|dog|trash/i.test(name) ? 'pedestrian'
      : /door|lobby|leasing|office|mail|package|gym|fitness|club|entry door/i.test(name) ? 'door' : 'gate'

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/**
 * Suggested openings from what the property already has: Gate Watch gates
 * (with their camera + Brivo door), Brivo doors (passed in by the caller, who
 * already loaded them), and device locations on the asset list. Anything already
 * in an opening is left out; same-named items merge into one suggestion.
 */
export async function suggestOpenings(siteId: string, brivoDoors: { id: string; name: string }[], existing: Opening[]): Promise<Suggestion[]> {
  const used = {
    door: new Set(existing.flatMap((o) => o.brivo_door_ids)),
    gw: new Set(existing.flatMap((o) => o.gate_watch_ids)),
    names: new Set(existing.map((o) => norm(o.name))),
  }
  const gw = await db().from('gate_watches').select('id, label, camera_key, brivo_door_id').eq('site_id', siteId)
  let assets = await db().from('site_assets').select('id, location_note, status, opening_id').eq('site_id', siteId)
  if (assets.error) assets = await db().from('site_assets').select('id, location_note, status').eq('site_id', siteId) as typeof assets
  const assetRows = (assets.data ?? []) as { id: string; location_note: string | null; status: string | null; opening_id?: string | null }[]

  const out = new Map<string, Suggestion>()
  const add = (name: string, source: string, part: Partial<Suggestion>) => {
    const key = norm(name)
    if (!key || used.names.has(key)) return
    const s = out.get(key) ?? { key, name: name.trim(), kind: guessKind(name), source, brivo_door_ids: [], camera_ids: [], relay_ids: [], gate_watch_ids: [], asset_ids: [] }
    for (const f of ['brivo_door_ids', 'camera_ids', 'relay_ids', 'gate_watch_ids', 'asset_ids'] as const) for (const v of part[f] ?? []) if (v && !s[f].includes(v)) s[f].push(v)
    if (!s.source.includes(source)) s.source += ` + ${source}`
    out.set(key, s)
  }
  for (const g of (gw.data ?? []) as { id: string; label: string; camera_key: string | null; brivo_door_id: string | null }[]) {
    if (used.gw.has(g.id)) continue
    add(g.label, 'Gate Watch', { gate_watch_ids: [g.id], camera_ids: g.camera_key ? [g.camera_key] : [], brivo_door_ids: g.brivo_door_id && !used.door.has(g.brivo_door_id) ? [g.brivo_door_id] : [] })
  }
  // A Brivo door that a Gate Watch gate already points at joins that suggestion.
  const gwDoor = new Map<string, string>()
  for (const s of Array.from(out.values())) for (const d of s.brivo_door_ids) gwDoor.set(d, s.key)
  for (const d of brivoDoors) {
    if (used.door.has(String(d.id)) || gwDoor.has(String(d.id))) continue
    add(d.name, 'Brivo', { brivo_door_ids: [String(d.id)] })
  }
  for (const a of assetRows) {
    if (a.opening_id || a.status === 'removed' || !a.location_note?.trim()) continue
    add(a.location_note, 'Devices', { asset_ids: [a.id] })
  }
  return Array.from(out.values())
}

/** Create one opening and attach its devices. */
export async function createOpening(siteId: string, orgId: string | null, who: string | null, o: Partial<Suggestion> & { name: string; notes?: string | null }) {
  const name = o.name.trim()
  if (!name) return { error: 'Give the opening a name.' }
  const { data: cur } = await db().from('site_openings').select('sort').eq('site_id', siteId).order('sort', { ascending: false }).limit(1)
  const sort = ((cur?.[0] as { sort?: number } | undefined)?.sort ?? -1) + 1
  const { data, error } = await db().from('site_openings').insert({
    site_id: siteId, org_id: orgId, name, kind: OPENING_KINDS.includes(o.kind as OpeningKind) ? o.kind : guessKind(name),
    brivo_door_ids: o.brivo_door_ids ?? [], camera_ids: o.camera_ids ?? [], relay_ids: o.relay_ids ?? [], gate_watch_ids: o.gate_watch_ids ?? [],
    notes: o.notes ?? null, sort, active: true, created_by: who,
  }).select().single()
  if (error) return { error: missingTable(error.message) ? NEEDS_233 : error.message }
  if (o.asset_ids?.length) {
    const { error: aErr } = await db().from('site_assets').update({ opening_id: (data as Opening).id }).in('id', o.asset_ids).eq('site_id', siteId)
    if (aErr) return { error: `Saved, but couldn’t attach the devices: ${aErr.message}`, opening: data as Opening }
  }
  return { opening: data as Opening }
}

/**
 * Which opening a request's `area` means: a Gate Watch gate's label (→ the opening
 * that holds that gate), else an opening with the same name. null = no match.
 */
export async function openingForArea(siteId: string, area: string | null | undefined): Promise<string | null> {
  const a = norm(String(area ?? ''))
  if (!siteId || !a) return null
  const { openings, needsMigration } = await listOpenings(siteId)
  if (needsMigration || !openings.length) return null
  const { data: gw } = await db().from('gate_watches').select('id, label').eq('site_id', siteId)
  const gate = ((gw ?? []) as { id: string; label: string }[]).find((g) => norm(g.label) === a)
  if (gate) { const o = openings.find((x) => x.gate_watch_ids.includes(gate.id)); if (o) return o.id }
  return openings.find((o) => norm(o.name) === a)?.id ?? null
}

/** Tag a job with its opening (only if it has none yet). Never throws; returns the id set, or null. */
export async function tagJobWithOpening(woId: string, siteId: string | null, area: string | null | undefined): Promise<string | null> {
  try {
    if (!siteId) return null
    const id = await openingForArea(siteId, area)
    if (!id) return null
    const { data, error } = await db().from('work_orders').update({ opening_id: id, opening_property: false }).eq('id', woId).is('opening_id', null).select('id')
    if (error) { console.error('[openings] tag job failed:', error.message); return null }
    return data?.length ? id : null
  } catch (e) { console.error('[openings] tag job failed:', e); return null }
}
