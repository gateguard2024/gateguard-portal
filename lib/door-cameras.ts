/**
 * lib/door-cameras.ts — which camera watches each Brivo door / gate, so the
 * property portal's Access page can show live video next to the Open buttons
 * ("see it before you open it").
 *
 * First match wins:
 *   1. Openings (site_openings, migration 233) — a door and cameras in the same opening.
 *   2. Gate Watch (gate_watches) — a watched gate's camera + its Brivo door.
 *   0. The property's own choice (Access page → camera picker) always wins.
 *   3. By name — shared words that name the place ("Main", "P2", "Phase 3"), ignoring
 *      a prefix every camera has ("EPV-") and generic words (gate/door/entry/exit/camera).
 * Only cameras the caller passes in (already limited to the portal's cameras) are used.
 */
import { createClient } from '@supabase/supabase-js'

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export type LinkCam = { key: string; id: string; name: string; provider: string }
export type DoorCamLink = { door_id: string; camera: LinkCam; how: 'chosen' | 'opening' | 'gate_watch' | 'name' }

const asKey = (v: string) => (v.startsWith('een:') || v.startsWith('edge:') ? v : `een:${v}`)
export const normName = (s: string) => s.toLowerCase()
  .replace(/\b(camera|cam|door|access point|ap)\b/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ').trim()

/** Words that say nothing about WHICH gate/door it is. */
const GENERIC = new Set(['gate', 'gates', 'door', 'doors', 'entry', 'entrance', 'exit', 'in', 'out', 'the', 'and', 'cam', 'camera', 'reader', 'lpr', 'ptz', 'view'])
const tokens = (s: string) => normName(s)
  .replace(/\b(phase|ph|p|building|bldg|b)\s*(\d+)\b/g, (_m, w: string, n: string) => `${/^b/.test(w) ? 'b' : 'p'}${n}`)
  .split(' ').filter(Boolean)
const nums = (ts: string[]) => ts.filter(t => /\d/.test(t))

/** Best camera for a door by name: shared words, ignoring words every camera has
 *  (a property prefix like "EPV") and generic words. Needs a real overlap. */
export function nameMatch(door: string, cameras: LinkCam[]): LinkCam | null {
  if (!cameras.length) return null
  const exact = cameras.find(c => normName(c.name) === normName(door))
  if (exact) return exact
  const freq = new Map<string, number>()
  for (const c of cameras) for (const t of new Set(tokens(c.name))) freq.set(t, (freq.get(t) ?? 0) + 1)
  const common = (t: string) => cameras.length > 1 && (freq.get(t) ?? 0) === cameras.length
  const keep = (ts: string[]) => ts.filter(t => !common(t))
  const dAll = keep(tokens(door)), dKey = dAll.filter(t => !GENERIC.has(t))
  let best: LinkCam | null = null, bestScore = 0, tie = false
  for (const c of cameras) {
    const cAll = keep(tokens(c.name)), cKey = cAll.filter(t => !GENERIC.has(t))
    const key = dKey.filter(t => cKey.includes(t)).length
    const dn = nums(dKey), cn = nums(cKey)
    if (dn.length && cn.length && !dn.some(t => cn.includes(t))) continue // "Phase 2" never takes the "Phase 3" camera
    if (!key) continue // must share a word that names the place ("main", "p2", "phase 3", "pool")
    const all = dAll.filter(t => cAll.includes(t)).length
    // all the camera's naming words appear in the door name (or the other way) = strong
    const covers = cKey.length > 0 && cKey.every(t => dKey.includes(t)) || dKey.length > 0 && dKey.every(t => cKey.includes(t))
    const score = key * 10 + all + (covers ? 50 : 0)
    if (score > bestScore) { best = c; bestScore = score; tie = false } else if (score === bestScore) tie = true
  }
  return best && !tie ? best : null
}

/** choices: what the property chose per door — a camera key, or 'none' (no camera). Wins over everything. */
export async function doorCameraLinks(siteId: string, doors: { id: string; name: string }[], cameras: LinkCam[], choices: Record<string, string> = {}): Promise<Record<string, DoorCamLink>> {
  const byKey = new Map(cameras.map(c => [c.key, c]))
  const out: Record<string, DoorCamLink> = {}
  const decided = new Set<string>()
  for (const d of doors) {
    const ch = choices[d.id]
    if (!ch) continue
    decided.add(d.id)
    const cam = ch === 'none' ? null : byKey.get(asKey(ch))
    if (cam) out[d.id] = { door_id: d.id, camera: cam, how: 'chosen' }
  }
  const set = (doorId: string, camKey: string | null | undefined, how: DoorCamLink['how']) => {
    if (!camKey || out[doorId] || decided.has(doorId)) return
    const cam = byKey.get(asKey(camKey))
    if (cam && doors.some(d => d.id === doorId)) out[doorId] = { door_id: doorId, camera: cam, how }
  }

  // 1. Openings (before migration 233 the table is missing → skip quietly)
  const op = await db().from('site_openings').select('brivo_door_ids, camera_ids').eq('site_id', siteId).eq('active', true)
  if (!op.error) for (const o of (op.data ?? []) as { brivo_door_ids: string[] | null; camera_ids: string[] | null }[]) {
    const cam = (o.camera_ids ?? []).map(asKey).find(k => byKey.has(k))
    for (const d of o.brivo_door_ids ?? []) set(String(d), cam, 'opening')
  }
  // 2. Gate Watch
  const gw = await db().from('gate_watches').select('brivo_door_id, camera_key').eq('site_id', siteId)
  if (!gw.error) for (const g of (gw.data ?? []) as { brivo_door_id: string | null; camera_key: string | null }[]) {
    if (g.brivo_door_id) set(String(g.brivo_door_id), g.camera_key, 'gate_watch')
  }
  // 3. By name
  for (const d of doors) {
    if (out[d.id] || decided.has(d.id)) continue
    const c = nameMatch(d.name, cameras)
    if (c) out[d.id] = { door_id: d.id, camera: c, how: 'name' }
  }
  return out
}
