/**
 * GET /api/sites/[id]/video?view=cameras|events|timeline|pass
 * One camera API for a property across Eagle Eye (cloud) and Gate Guard Edge
 * (Jetson + Frigate). Cameras capability required (canOperate).
 *
 *   view=cameras                           → every camera, tagged by provider, + an Edge pass
 *   view=events&start&end&camera&kind&q    → events from both, newest first (search)
 *   view=timeline&camera&start&end         → recorded segments + events for one camera
 *   view=pass                              → a fresh Edge pass (players renew before expiry)
 *
 * Media never flows through here:
 *   Eagle Eye → the existing /api/eagle-eye/preview + /api/eagle-eye/clip routes (unchanged).
 *   Edge      → the browser calls the device directly with the pass (docs/edge/EDGE_API.md).
 * Camera keys: "een:<id>" or "edge:<frigate camera name>".
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { canOperate } from '@/lib/system-access'
import { getSiteEagleEyeAccess, listEagleEyeCameras, listEagleEyeEvents, eagleEyeListRecordedSegments } from '@/lib/eagle-eye'
import { getSiteEdge, listEdgeCameras, edgeJson, mintEdgePass, type EdgeConn } from '@/lib/edge'
import { getSiteVendorCreds } from '@/lib/site-integrations'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>
export type VideoEvent = { key: string; provider: 'een' | 'edge'; cameraKey: string; cameraName: string; label: string; kind: string; start: string; end: string | null; plate: string | null; score: number | null; edgeId: string | null; hasClip: boolean }

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

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const siteId = params.id
  const user = await getCurrentUser()
  if (!(await canOperate(user, siteId, 'cameras'))) return NextResponse.json({ error: 'You don’t have camera access for this property.' }, { status: 403 })
  const sp = req.nextUrl.searchParams
  const view = sp.get('view') ?? 'cameras'
  const edge = await getSiteEdge(siteId)
  const passFor = (conn: EdgeConn, cams: string[] | '*' = '*') => ({ base: conn.baseUrl, deviceId: conn.deviceId, ...mintEdgePass(conn, { siteId, userId: user.id, scopes: ['live', 'vod', 'snapshot', 'events', 'export'], cameras: cams, ttlSec: 900 }) })

  if (view === 'pass') {
    if (!edge) return NextResponse.json({ error: 'No Edge device at this property.' }, { status: 404 })
    return NextResponse.json({ edge: passFor(edge) })
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
    ]
    return NextResponse.json({ cameras, edge: edge && !errors.edge ? passFor(edge) : null, errors, providers: { een: eenRes.length > 0 || !!errors.een, edge: !!edge } })
  }

  const now = Date.now()
  if (view === 'events') {
    const end = parseTime(sp.get('end'), now)
    const start = Math.max(parseTime(sp.get('start'), end - 24 * 36e5), end - 7 * 864e5)   // ≤ 7 days per search
    const camera = sp.get('camera') ?? ''
    const kind = sp.get('kind') ?? ''
    const q = (sp.get('q') ?? '').trim().toLowerCase()
    const errors: Record<string, string> = {}
    const out: VideoEvent[] = []
    const jobs: Promise<void>[] = []
    if (!camera || camera.startsWith('een:')) jobs.push((async () => {
      const a = await een(siteId)
      if (!a) return
      try {
        const [cams, evs] = await Promise.all([
          listEagleEyeCameras(a.token, a.baseHost).catch(() => []),
          listEagleEyeEvents(a.token, a.baseHost, { start: new Date(start), end: new Date(end), cameraId: camera ? camera.slice(4) : undefined }),
        ])
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
      .filter(e => (!kind || e.kind === kind || (kind === 'vehicle' && e.kind === 'plate')) && (!q || `${e.label} ${e.plate ?? ''} ${e.cameraName}`.toLowerCase().includes(q)))
      .sort((a, b) => Date.parse(b.start) - Date.parse(a.start))
      .slice(0, 400)
    return NextResponse.json({ events: shown, errors, window: { start: new Date(start).toISOString(), end: new Date(end).toISOString() } })
  }

  if (view === 'timeline') {
    const camera = sp.get('camera') ?? ''
    if (!/^(een|edge):.+/.test(camera)) return NextResponse.json({ error: 'camera is required' }, { status: 400 })
    const end = parseTime(sp.get('end'), now)
    const start = Math.max(parseTime(sp.get('start'), end - 24 * 36e5), end - 2 * 864e5)   // ≤ 48 h per timeline
    let segments: { start: string; end: string }[] = []
    let error: string | null = null
    if (camera.startsWith('een:')) {
      const a = await een(siteId)
      if (!a) error = 'Eagle Eye isn’t connected for this property.'
      else {
        const rows = await eagleEyeListRecordedSegments(a.token, a.baseHost, camera.slice(4), new Date(start).toISOString(), new Date(end).toISOString())
        segments = rows.slice().reverse().map((r, i, arr) => ({ start: r.start, end: r.end ?? arr[i + 1]?.start ?? new Date(Math.min(now, Date.parse(r.start) + 60_000)).toISOString() }))
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
    return NextResponse.json({ camera, segments: merged, error, window: { start: new Date(start).toISOString(), end: new Date(end).toISOString() } })
  }

  return NextResponse.json({ error: 'Unknown view' }, { status: 400 })
}
