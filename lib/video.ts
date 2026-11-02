/**
 * One camera API for a property across Eagle Eye (cloud) and Gate Guard Edge
 * (Jetson + Frigate). Shared by:
 *   GET /api/sites/[id]/video     — dealers / corporate (canOperate 'cameras')
 *   GET /api/portal/[slug]/video  — property portal (view PIN, portal's cameras only)
 * The routes do the access check, then call siteVideo().
 *
 *   view=cameras                           → every camera, tagged by provider, + an Edge pass
 *   view=events&start&end&camera&kind&q    → events from both, newest first (search)
 *   view=timeline&camera&start&end         → recorded segments + events for one camera
 *   view=pass                              → a fresh Edge pass (players renew before expiry)
 *
 * Media never flows through here: Eagle Eye pictures/clips use each caller's own
 * preview + clip routes; Edge video goes browser → device with the pass
 * (docs/edge/EDGE_API.md). Camera keys: "een:<id>" or "edge:<frigate camera name>".
 */
import { getSiteEagleEyeAccess, listEagleEyeCameras, listEagleEyeEvents, eagleEyeListRecordedSegments } from '@/lib/eagle-eye'
import { getSiteEdge, listEdgeCameras, edgeJson, mintEdgePass, type EdgeConn } from '@/lib/edge'
import { getSiteVendorCreds } from '@/lib/site-integrations'

// Eagle Eye v3 event types we show (developer.eagleeyenetworks.com/docs/events).
const EEN_EVENT_TYPES = ['een.motionDetectionEvent.v1', 'een.motionInRegionDetectionEvent.v1', 'een.lprPlateReadEvent.v1', 'een.loiterDetectionEvent.v1', 'een.tamperDetectionEvent.v1', 'een.objectLineCrossEvent.v1', 'een.objectIntrusionEvent.v1', 'een.deviceCloudStatusUpdateEvent.v1']

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>
export type VideoEvent = { key: string; provider: 'een' | 'edge'; cameraKey: string; cameraName: string; label: string; kind: string; start: string; end: string | null; plate: string | null; score: number | null; edgeId: string | null; hasClip: boolean }

export interface SiteVideoOpts {
  /** Who the Edge pass is for (user id, or e.g. "portal:<slug>"). */
  userId: string
  /** Camera filter by key ("een:<id>" / "edge:<name>"). Omit = every camera. */
  allow?: (cameraKey: string) => boolean
  /** Edge cameras the pass may open. Default '*'. */
  edgeCameras?: string[] | '*'
}

const VEHICLE = new Set(['car', 'truck', 'bus', 'motorcycle', 'bicycle', 'boat', 'license_plate'])
const ANIMAL = new Set(['dog', 'cat', 'bird', 'horse', 'deer', 'bear', 'raccoon', 'fox', 'squirrel', 'rabbit'])
function eenKind(label: string) {
  if (/plate/i.test(label)) return 'plate'
  if (/motion/i.test(label)) return 'motion'
  if (/loiter/i.test(label)) return 'person'
  if (/tamper|intrusion|line/i.test(label)) return 'alert'
  if (/device|status/i.test(label)) return 'system'
  return 'other'
}
const iso = (sec: number) => new Date(sec * 1000).toISOString()
const parseTime = (v: string | null, fallback: number) => { const t = v ? Date.parse(v) : NaN; return Number.isFinite(t) ? t : fallback }
const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

async function een(siteId: string) {
  const c = await getSiteVendorCreds(siteId, 'eagle_eye')
  if (!c?.refresh_token) return null
  try { return await getSiteEagleEyeAccess(siteId) } catch { return null }
}

/** Returns { status, body } — the route turns it into a JSON response. */
export async function siteVideo(siteId: string, sp: URLSearchParams, opts: SiteVideoOpts): Promise<{ status: number; body: unknown }> {
  const allow = opts.allow ?? (() => true)
  const view = sp.get('view') ?? 'cameras'
  // Speed: an Eagle Eye timeline/events call never needs the Edge login, so only
  // wait for it when the answer uses it (it's a vault read). Started now, in parallel.
  const edgeP = getSiteEdge(siteId).catch(() => null)
  const cam = sp.get('camera') ?? ''
  const needsEdge = view === 'pass' || view === 'cameras' || !cam.startsWith('een:')
  const edge = needsEdge ? await edgeP : null
  const passFor = (conn: EdgeConn) => ({ base: conn.baseUrl, deviceId: conn.deviceId, ...mintEdgePass(conn, { siteId, userId: opts.userId, scopes: ['live', 'vod', 'snapshot', 'events', 'export'], cameras: opts.edgeCameras ?? '*', ttlSec: 900 }) })

  if (view === 'pass') {
    if (!edge) return { status: 404, body: { error: 'No Edge device at this property.' } }
    return { status: 200, body: { edge: passFor(edge) } }
  }

  if (view === 'cameras') {
    const errors: Record<string, string> = {}
    const [eenRes, edgeRes] = await Promise.all([
      (async () => {
        const a = await een(siteId)
        if (!a) return []
        try { return await listEagleEyeCameras(a.token, a.baseHost) } catch (e) { errors.een = e instanceof Error ? e.message : 'Eagle Eye unavailable'; return [] }
      })(),
      (async () => {
        if (!edge) return []
        const r = await listEdgeCameras(edge, siteId)
        if (!r.ok) { errors.edge = r.error; return [] }
        return r.cameras
      })(),
    ])
    const cameras = [
      ...edgeRes.map(c => ({ key: `edge:${c.name}`, provider: 'edge' as const, id: c.name, name: c.label, online: errors.edge ? null : c.enabled })),
      ...eenRes.map(c => ({ key: `een:${c.id}`, provider: 'een' as const, id: c.id, name: c.name, online: c.online, tags: c.tags })),
    ].filter(c => allow(c.key))
    return { status: 200, body: { cameras, edge: edge && !errors.edge ? passFor(edge) : null, errors, providers: { een: eenRes.length > 0 || !!errors.een, edge: !!edge } } }
  }

  const now = Date.now()
  if (view === 'events') {
    const end = parseTime(sp.get('end'), now)
    const start = Math.max(parseTime(sp.get('start'), end - 24 * 36e5), end - 7 * 864e5)   // ≤ 7 days per search
    const camera = sp.get('camera') ?? ''
    if (camera && !allow(camera)) return { status: 403, body: { error: 'That camera isn’t available here.' } }
    const kind = sp.get('kind') ?? ''
    const q = (sp.get('q') ?? '').trim().toLowerCase()
    const errors: Record<string, string> = {}
    const out: VideoEvent[] = []
    const jobs: Promise<void>[] = []
    if (!camera || camera.startsWith('een:')) jobs.push((async () => {
      const a = await een(siteId)
      if (!a) return
      try {
        // Eagle Eye's documented pattern is one camera (actor) + explicit event types per
        // request, so ask camera by camera (6 at a time) instead of one site-wide call.
        // One camera asked for (the viewer): skip the camera list — it only supplies names.
        const cams = camera ? [] as { id: string; name: string }[] : await listEagleEyeCameras(a.token, a.baseHost).catch(() => [] as { id: string; name: string }[])
        const ids = camera ? [camera.slice(4)] : cams.map(c => c.id).filter(id => allow(`een:${id}`)).slice(0, 40)
        const evs: Awaited<ReturnType<typeof listEagleEyeEvents>> = []
        const fails: string[] = []
        let k = 0
        await Promise.all(Array.from({ length: Math.min(6, ids.length) }, async () => {
          while (k < ids.length) {
            const id = ids[k++]
            try { evs.push(...await listEagleEyeEvents(a.token, a.baseHost, { start: new Date(start), end: new Date(end), cameraId: id, types: EEN_EVENT_TYPES })) }
            catch (e) { fails.push(e instanceof Error ? e.message : 'failed') }
          }
        }))
        if (fails.length && fails.length === ids.length) throw new Error(fails[0])
        const names = new Map(cams.map(c => [c.id, c.name]))
        for (const e of evs) {
          if (!e.when || !e.cameraId) continue
          out.push({ key: `een:${e.id}`, provider: 'een', cameraKey: `een:${e.cameraId}`, cameraName: names.get(e.cameraId) ?? 'Camera', label: e.label, kind: eenKind(e.label), start: e.when, end: null, plate: null, score: null, edgeId: null, hasClip: true })
        }
      } catch (e) { errors.een = e instanceof Error ? e.message : 'Eagle Eye events unavailable' }
    })())
    if (edge && (!camera || camera.startsWith('edge:'))) jobs.push((async () => {
      const qs = new URLSearchParams({ after: String(Math.floor(start / 1000)), before: String(Math.ceil(end / 1000)), limit: '300', include_thumbnails: '0' })
      if (camera) qs.set('cameras', camera.slice(5))
      const r = await edgeJson<Row[]>(edge, siteId, `/api/events?${qs}`)
      if (!r.ok) { errors.edge = r.error; return }
      for (const e of Array.isArray(r.data) ? r.data : []) {
        const label = String(e.label ?? 'object')
        const sub = Array.isArray(e.sub_label) ? e.sub_label[0] : e.sub_label
        const plate = e.data?.recognized_license_plate ?? (label === 'license_plate' ? sub : null) ?? null
        out.push({
          key: `edge:${e.id}`, provider: 'edge', cameraKey: `edge:${e.camera}`, cameraName: titleCase(String(e.camera ?? 'Camera')),
          label: sub && !plate ? `${titleCase(label)} · ${sub}` : titleCase(label),
          kind: plate ? 'plate' : label === 'person' ? 'person' : VEHICLE.has(label) ? 'vehicle' : ANIMAL.has(label) ? 'animal' : 'other',
          start: iso(Number(e.start_time)), end: e.end_time ? iso(Number(e.end_time)) : null,
          plate: plate ? String(plate) : null, score: Number(e.data?.top_score ?? e.top_score ?? e.score) || null,
          edgeId: String(e.id), hasClip: e.has_clip !== false,
        })
      }
    })())
    await Promise.all(jobs)
    const shown = out
      .filter(e => allow(e.cameraKey))
      .filter(e => (!kind || e.kind === kind || (kind === 'vehicle' && e.kind === 'plate')) && (!q || `${e.label} ${e.plate ?? ''} ${e.cameraName}`.toLowerCase().includes(q)))
      .sort((a, b) => Date.parse(b.start) - Date.parse(a.start))
      .slice(0, 400)
    return { status: 200, body: { events: shown, errors, window: { start: new Date(start).toISOString(), end: new Date(end).toISOString() } } }
  }

  if (view === 'timeline') {
    const camera = sp.get('camera') ?? ''
    if (!/^(een|edge):.+/.test(camera)) return { status: 400, body: { error: 'camera is required' } }
    if (!allow(camera)) return { status: 403, body: { error: 'That camera isn’t available here.' } }
    const end = parseTime(sp.get('end'), now)
    const start = Math.max(parseTime(sp.get('start'), end - 24 * 36e5), end - 2 * 864e5)   // ≤ 48 h per timeline
    let segments: { start: string; end: string }[] = []
    let error: string | null = null
    if (camera.startsWith('een:')) {
      const a = await een(siteId)
      if (!a) error = 'Eagle Eye isn’t connected for this property.'
      else {
        try {
          const rows = await eagleEyeListRecordedSegments(a.token, a.baseHost, camera.slice(4), new Date(start).toISOString(), new Date(end).toISOString(), { withUrls: false })
          segments = rows.slice().reverse().map((r, i, arr) => ({ start: r.start, end: r.end ?? arr[i + 1]?.start ?? new Date(Math.min(now, Date.parse(r.start) + 60_000)).toISOString() }))
        } catch (e) { error = e instanceof Error ? e.message : 'Eagle Eye recordings unavailable.' }
      }
    } else if (!edge) error = 'No Edge device at this property.'
    else {
      const r = await edgeJson<Row[]>(edge, siteId, `/api/${encodeURIComponent(camera.slice(5))}/recordings?after=${Math.floor(start / 1000)}&before=${Math.ceil(end / 1000)}`)
      if (!r.ok) error = r.error
      else segments = (Array.isArray(r.data) ? r.data : []).map(s => ({ start: iso(Number(s.start_time)), end: iso(Number(s.end_time)) })).sort((a, b) => a.start.localeCompare(b.start))
    }
    // Merge touching segments (≤ 2 s gap) so the bar draws a few blocks, not thousands.
    const merged: { start: string; end: string }[] = []
    for (const s of segments) {
      const last = merged[merged.length - 1]
      if (last && Date.parse(s.start) - Date.parse(last.end) <= 2000) { if (s.end > last.end) last.end = s.end } else merged.push({ ...s })
    }
    return { status: 200, body: { camera, segments: merged, error, window: { start: new Date(start).toISOString(), end: new Date(end).toISOString() } } }
  }

  return { status: 400, body: { error: 'Unknown view' } }
}

/**
 * A property portal's camera list (`client_portals.camera_ids`) → filter + Edge pass scope.
 * Entries: plain Eagle Eye id (legacy), "een:<id>" or "edge:<frigate name>".
 * The list only limits the provider it names: an Eagle-Eye-only list leaves every
 * Edge camera showing until someone picks Edge cameras (decided 2026-11-02).
 */
export function portalCameraScope(cameraIds: string[] | null | undefined): { allow: (key: string) => boolean; edgeCameras: string[] | '*' } {
  const list = (cameraIds ?? []).map(String).filter(Boolean)
  const eenIds = new Set(list.filter(x => !x.startsWith('edge:')).map(x => x.replace(/^een:/, '')))
  const edgeNames = list.filter(x => x.startsWith('edge:')).map(x => x.slice(5))
  const edgeSet = new Set(edgeNames)
  return {
    allow: (key: string) => {
      if (key.startsWith('een:')) return eenIds.size === 0 || eenIds.has(key.slice(4))
      if (key.startsWith('edge:')) return edgeSet.size === 0 || edgeSet.has(key.slice(5))
      return false
    },
    edgeCameras: edgeNames.length ? edgeNames : '*',
  }
}
