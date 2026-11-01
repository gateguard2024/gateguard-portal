/**
 * Gate Guard Edge — the Jetson Orin Nano + Frigate box at a property.
 *
 * Speed: video never goes through Nexus. The browser talks straight to the device
 * (live MSE/WebRTC, HLS playback, snapshots, clips). Nexus only hands out a
 * short-lived signed PASS after checking the user may operate cameras at that site.
 * The device's Gate Guard agent checks the pass in front of Frigate's own paths.
 * Contract for the device team: docs/edge/EDGE_API.md.
 *
 * Pass = "gg1.<base64url(JSON payload)>.<base64url(HMAC-SHA256(edge_secret, 'gg1.'+payload))>"
 *   payload: { v:1, sid: site id, did: device id, sub: user id, sc: scopes, cam: cameras|'*', iat, exp }
 *   scopes: live · vod · snapshot · events · export · api (server-to-device JSON)
 */
import crypto from 'node:crypto'
import { getSiteVendorCreds } from '@/lib/site-integrations'

export type EdgeScope = 'live' | 'vod' | 'snapshot' | 'events' | 'export' | 'api'
export interface EdgeConn { baseUrl: string; deviceId: string; secret: string }

const b64u = (b: Buffer | string) => Buffer.from(b).toString('base64url')

/** The site's Edge device, or null when none is set up. */
export async function getSiteEdge(siteId: string): Promise<EdgeConn | null> {
  const c = await getSiteVendorCreds(siteId, 'edge')
  if (!c?.base_url || !c?.edge_secret) return null
  const baseUrl = String(c.base_url).trim().replace(/\/+$/, '')
  if (!/^https:\/\//i.test(baseUrl)) return null   // passes ride in URLs — never over plain http
  return { baseUrl, deviceId: String(c.device_id || ''), secret: String(c.edge_secret) }
}

export function mintEdgePass(conn: EdgeConn, opts: { siteId: string; userId: string; scopes: EdgeScope[]; cameras?: string[] | '*'; ttlSec?: number }): { pass: string; exp: number } {
  const now = Math.floor(Date.now() / 1000)
  const exp = now + Math.max(30, Math.min(3600, opts.ttlSec ?? 600))
  const payload = b64u(JSON.stringify({ v: 1, sid: opts.siteId, did: conn.deviceId, sub: opts.userId, sc: opts.scopes, cam: opts.cameras ?? '*', iat: now, exp }))
  const sig = b64u(crypto.createHmac('sha256', conn.secret).update(`gg1.${payload}`).digest())
  return { pass: `gg1.${payload}.${sig}`, exp }
}

/** Same check the device runs — used by tests and the Nexus side of the contract. */
export function verifyEdgePass(secret: string, pass: string): { ok: true; claims: Record<string, unknown> } | { ok: false; reason: string } {
  const m = /^gg1\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(pass)
  if (!m) return { ok: false, reason: 'malformed' }
  const want = crypto.createHmac('sha256', secret).update(`gg1.${m[1]}`).digest()
  const got = Buffer.from(m[2], 'base64url')
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return { ok: false, reason: 'bad signature' }
  let claims: Record<string, unknown>
  try { claims = JSON.parse(Buffer.from(m[1], 'base64url').toString()) } catch { return { ok: false, reason: 'bad payload' } }
  if (typeof claims.exp !== 'number' || claims.exp < Date.now() / 1000) return { ok: false, reason: 'expired' }
  return { ok: true, claims }
}

/** Server → device JSON (Frigate API behind the agent). Never throws. */
export async function edgeJson<T = unknown>(conn: EdgeConn, siteId: string, path: string, timeoutMs = 8000): Promise<{ ok: true; data: T } | { ok: false; error: string; status?: number }> {
  const { pass } = mintEdgePass(conn, { siteId, userId: 'nexus', scopes: ['api', 'events'], ttlSec: 60 })
  try {
    const res = await fetch(`${conn.baseUrl}${path}`, { headers: { Authorization: `Bearer ${pass}`, Accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs), cache: 'no-store' })
    if (!res.ok) return { ok: false, status: res.status, error: res.status === 401 || res.status === 403 ? 'The Edge device rejected Nexus’s pass — check the device pass secret.' : `Edge device returned ${res.status}` }
    return { ok: true, data: await res.json() as T }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: /timeout|abort/i.test(msg) ? 'The Edge device didn’t answer in time (offline or slow link).' : `Couldn’t reach the Edge device: ${msg}` }
  }
}

/** Camera names Frigate is configured with (from /api/config). */
export async function listEdgeCameras(conn: EdgeConn, siteId: string): Promise<{ ok: true; cameras: { name: string; enabled: boolean; label: string }[] } | { ok: false; error: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = await edgeJson<any>(conn, siteId, '/api/config')
  if (!r.ok) return r
  const cams = r.data?.cameras ?? {}
  return {
    ok: true,
    cameras: Object.entries(cams).map(([name, c]) => ({
      name,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      enabled: (c as any)?.enabled !== false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      label: String((c as any)?.friendly_name ?? name).replace(/_/g, ' '),
    })),
  }
}

/** Server → device: one full-resolution still from a camera (Gate Watch). Null on any failure. */
export async function edgeImage(conn: EdgeConn, siteId: string, camera: string, timeoutMs = 9000): Promise<Buffer | null> {
  const { pass } = mintEdgePass(conn, { siteId, userId: 'nexus', scopes: ['api', 'snapshot'], cameras: [camera], ttlSec: 60 })
  try {
    const res = await fetch(`${conn.baseUrl}/api/${encodeURIComponent(camera)}/latest.jpg`, { headers: { Authorization: `Bearer ${pass}`, Accept: 'image/jpeg' }, signal: AbortSignal.timeout(timeoutMs), cache: 'no-store' })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    return buf.length > 1000 ? buf : null
  } catch { return null }
}
