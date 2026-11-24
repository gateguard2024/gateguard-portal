/**
 * lib/door-cameras.ts — which camera watches each Brivo door / gate, so the
 * property portal's Access page can show live video next to the Open buttons
 * ("see it before you open it").
 *
 * First match wins:
 *   1. Openings (site_openings, migration 233) — a door and cameras in the same opening.
 *   2. Gate Watch (gate_watches) — a watched gate's camera + its Brivo door.
 *   3. Same name — "Main Entry Gate" door ↔ "Main Entry Gate" camera (spaces,
 *      dashes and words like camera/cam/door ignored).
 * Only cameras the caller passes in (already limited to the portal's cameras) are used.
 */
import { createClient } from '@supabase/supabase-js'

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export type LinkCam = { key: string; id: string; name: string; provider: string }
export type DoorCamLink = { door_id: string; camera: LinkCam; how: 'opening' | 'gate_watch' | 'name' }

const asKey = (v: string) => (v.startsWith('een:') || v.startsWith('edge:') ? v : `een:${v}`)
export const normName = (s: string) => s.toLowerCase()
  .replace(/\b(camera|cam|door|access point|ap)\b/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ').trim()

export async function doorCameraLinks(siteId: string, doors: { id: string; name: string }[], cameras: LinkCam[]): Promise<Record<string, DoorCamLink>> {
  const byKey = new Map(cameras.map(c => [c.key, c]))
  const out: Record<string, DoorCamLink> = {}
  const set = (doorId: string, camKey: string | null | undefined, how: DoorCamLink['how']) => {
    if (!camKey || out[doorId]) return
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
  // 3. Same name
  const camByName = new Map<string, LinkCam>()
  for (const c of cameras) { const n = normName(c.name); if (n && !camByName.has(n)) camByName.set(n, c) }
  for (const d of doors) {
    if (out[d.id]) continue
    const c = camByName.get(normName(d.name))
    if (c) out[d.id] = { door_id: d.id, camera: c, how: 'name' }
  }
  return out
}
