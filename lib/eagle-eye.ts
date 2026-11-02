/**
 * lib/eagle-eye.ts — SERVER ONLY. Eagle Eye Networks API v3 (OAuth2).
 *
 * Per-site model: corporate enters the site's own EEN client_id + client_secret
 * (Connections card), then runs a one-time "Connect Eagle Eye" OAuth flow. We
 * store the access + refresh token and the account-specific base host in the
 * encrypted vault. listEagleEyeCameras refreshes the token as needed.
 *
 * Verified shapes (developer.eagleeyenetworks.com):
 *   token:  POST https://auth.eagleeyenetworks.com/oauth2/token  (Basic id:secret)
 *   token response includes refresh_token + httpsBaseUrl.hostname
 *   cameras: GET https://<hostname>/api/v3.0/cameras  (Bearer)
 */
import { getSiteVendorCreds, mergeSiteVendorCreds } from '@/lib/site-integrations'

const EEN_AUTH_BASE = 'https://auth.eagleeyenetworks.com/oauth2'
export const EEN_SCOPE = 'vms.all'

/**
 * The OAuth redirect_uri MUST be a single, stable URL that is also registered in
 * the Eagle Eye application — Vercel preview/deploy origins change per build and
 * are not registered, which causes "invalid_request: redirect_uri". Prefer an
 * explicit env (EEN_REDIRECT_BASE) or the app's public URL; only fall back to the
 * request origin for local dev. The connect + callback routes must use the SAME value.
 */
export function eagleEyeRedirectUri(requestOrigin: string): string {
  const base = (process.env.EEN_REDIRECT_BASE || process.env.NEXT_PUBLIC_APP_URL || requestOrigin).replace(/\/+$/, '')
  return `${base}/api/eagle-eye/callback`
}

export function eagleEyeAuthorizeUrl(clientId: string, redirectUri: string, state: string): string {
  const u = new URL(`${EEN_AUTH_BASE}/authorize`)
  // Trim — a stray space/newline from copy-paste makes EEN reject the client_id
  // with "invalid_request: client_id".
  u.searchParams.set('client_id', clientId.trim())
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('scope', EEN_SCOPE)
  u.searchParams.set('redirect_uri', redirectUri)
  u.searchParams.set('state', state)
  return u.toString()
}

function basic(clientId: string, clientSecret: string) {
  return Buffer.from(`${clientId.trim()}:${clientSecret.trim()}`).toString('base64')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function tokenRequest(clientId: string, clientSecret: string, body: Record<string, string>): Promise<any> {
  const res = await fetch(`${EEN_AUTH_BASE}/token`, {
    method: 'POST',
    // EEN docs require the Accept: application/json header on the token request.
    headers: { Authorization: `Basic ${basic(clientId, clientSecret)}`, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams(body).toString(),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`Eagle Eye token (${res.status}): ${await res.text()}`)
  return res.json()
}

export async function eagleEyeExchangeCode(clientId: string, clientSecret: string, code: string, redirectUri: string) {
  // scope is required on the authorization_code exchange per EEN docs.
  return tokenRequest(clientId, clientSecret, { grant_type: 'authorization_code', scope: EEN_SCOPE, code, redirect_uri: redirectUri })
}

export async function eagleEyeRefresh(clientId: string, clientSecret: string, refreshToken: string) {
  return tokenRequest(clientId, clientSecret, { grant_type: 'refresh_token', refresh_token: refreshToken })
}

/** Get a valid access token + base host for a site, refreshing + persisting if expired. */
// Single-flight refresh guard. The customer portal renders a whole camera wall at
// once, firing many camera-preview requests in parallel. Eagle Eye rotates the
// refresh token (single-use), so a parallel stampede would make the first refresh
// win and the rest fail with invalid_client (and concurrent credential writes can
// clobber the vault blob). We coalesce concurrent refreshes per site into ONE, and
// if a refresh still fails we re-read the vault once in case a sibling just
// refreshed successfully.
const eenRefreshInFlight = new Map<string, Promise<{ token: string; baseHost: string }>>()

export async function getSiteEagleEyeAccess(siteId: string): Promise<{ token: string; baseHost: string }> {
  const c = await getSiteVendorCreds(siteId, 'eagle_eye')
  if (!c?.client_id || !c?.client_secret) throw new Error('Eagle Eye client ID/secret are not set for this site.')
  if (!c.refresh_token) throw new Error('Eagle Eye is not connected for this site yet — run Connect Eagle Eye.')

  const exp = c.expires_at ? new Date(c.expires_at).getTime() : 0
  if (c.access_token && c.base_host && exp - Date.now() > 60_000) {
    return { token: c.access_token, baseHost: c.base_host }
  }

  // Coalesce concurrent refreshes within this instance into one.
  const existing = eenRefreshInFlight.get(siteId)
  if (existing) return existing

  const p = (async () => {
    try {
      const t = await eagleEyeRefresh(c.client_id as string, c.client_secret as string, c.refresh_token as string)
      const baseHost = t.httpsBaseUrl?.hostname || c.base_host
      await mergeSiteVendorCreds(siteId, 'eagle_eye', {
        access_token: t.access_token,
        refresh_token: t.refresh_token || c.refresh_token,
        expires_at: new Date(Date.now() + (t.expires_in ?? 3600) * 1000).toISOString(),
        base_host: baseHost,
      })
      return { token: t.access_token, baseHost }
    } catch (e) {
      // A sibling request (possibly on another serverless instance) may have just
      // refreshed and rotated the single-use token out from under us. Poll the
      // vault a few times — the winner's fresh access token becomes visible within
      // ~1-2s — and use it instead of failing the tile.
      for (let i = 0; i < 5; i++) {
        await new Promise((r) => setTimeout(r, 600))
        const c2 = await getSiteVendorCreds(siteId, 'eagle_eye')
        const exp2 = c2?.expires_at ? new Date(c2.expires_at).getTime() : 0
        if (c2?.access_token && c2.base_host && exp2 - Date.now() > 60_000) {
          return { token: c2.access_token, baseHost: c2.base_host }
        }
      }
      throw e
    } finally {
      eenRefreshInFlight.delete(siteId)
    }
  })()
  eenRefreshInFlight.set(siteId, p)
  return p
}

export interface EagleEyeCamera { id: string; name: string; tags: string[]; esn: string | null; online: boolean | null }

/** Grab a single preview JPEG frame for a camera (server-side, so the token
 * never reaches the browser). Returns null if unavailable.
 *
 * Uses EEN v3 `/media/liveImage.jpeg?deviceId=X&type=preview` (Accept: image/jpeg),
 * which returns a single current JPEG and — per the docs — "waits until the image
 * is available." That's far more reliable than the old approach of opening the
 * `/feeds` MJPEG multipart stream and scanning bytes for one frame, which timed
 * out on slow-updating cameras (indoor/low-motion) and returned nothing. */
export async function eagleEyePreviewFrame(token: string, baseHost: string, deviceId: string): Promise<Buffer | null> {
  try {
    const res = await fetch(
      `https://${baseHost}/api/v3.0/media/liveImage.jpeg?deviceId=${encodeURIComponent(deviceId)}&type=preview`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'image/jpeg' }, signal: AbortSignal.timeout(12000) }
    )
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    return buf.length > 0 ? buf : null
  } catch { return null }
}

/** Best-quality current still for AI checks: the main (full-resolution) stream
 * first, then the preview stream. Gate Watch crops the gate out of this, so
 * resolution matters for far or odd-angle gates. */
export async function eagleEyeFullFrame(token: string, baseHost: string, deviceId: string): Promise<Buffer | null> {
  for (const type of ['main', 'preview']) {
    try {
      const res = await fetch(`https://${baseHost}/api/v3.0/media/liveImage.jpeg?deviceId=${encodeURIComponent(deviceId)}&type=${type}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'image/jpeg' }, signal: AbortSignal.timeout(type === 'main' ? 9000 : 12000),
      })
      if (!res.ok) continue
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.length > 1000 && buf[0] === 0xff && buf[1] === 0xd8) return buf
    } catch { /* try the next stream */ }
  }
  return null
}

// ── Live frames (preview MJPEG feed) ─────────────────────────────────────────
// `liveImage.jpeg` is NOT live: Eagle Eye returns the last still it stored, which
// only refreshes while someone is watching (Marbella, Nov 2 2026: Gym/Leasing at
// 7:22 PM the day before, Mail Left at 8:22 AM, fetched at noon). The `main`
// liveImage fails for those cameras, so eagleEyeFullFrame falls through to that
// stale preview. The real live picture is the preview feed's multipart (MJPEG)
// stream: GET /feeds → multipartUrl, authorised by a media-session cookie
// (GET /media/session → url → GET url sets it). We open the stream server-side,
// keep the first complete JPEG and close it. Docs: developer.eagleeyenetworks.com/docs/watch-live-video

export interface EenLiveTrace { step: string; status?: number; note?: string; ms: number }

const eenMediaCookies = new Map<string, { cookie: string; at: number }>()

async function eenMediaCookie(token: string, baseHost: string, trace: EenLiveTrace[], fresh = false): Promise<string> {
  const key = `${baseHost}|${token.slice(-16)}`
  const hit = eenMediaCookies.get(key)
  if (!fresh && hit && Date.now() - hit.at < 4 * 60_000) return hit.cookie
  const t0 = Date.now()
  const s = await fetch(`https://${baseHost}/api/v3.0/media/session`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, signal: AbortSignal.timeout(5000),
  })
  trace.push({ step: 'media/session', status: s.status, ms: Date.now() - t0 })
  if (!s.ok) return ''
  const { url } = await s.json().catch(() => ({ url: '' }))
  if (!url) return ''
  const t1 = Date.now()
  const c = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, redirect: 'manual', signal: AbortSignal.timeout(5000) })
  const set = typeof c.headers.getSetCookie === 'function' ? c.headers.getSetCookie() : [c.headers.get('set-cookie') ?? '']
  const cookie = set.filter(Boolean).map(v => v.split(';')[0]).join('; ')
  trace.push({ step: 'media cookie', status: c.status, note: cookie ? `${set.length} cookie(s)` : 'no cookie', ms: Date.now() - t1 })
  if (cookie) eenMediaCookies.set(key, { cookie, at: Date.now() })
  return cookie
}

async function eenPreviewMultipartUrl(token: string, baseHost: string, deviceId: string, trace: EenLiveTrace[], prefer: 'preview' | 'main' = 'preview'): Promise<string> {
  const t0 = Date.now()
  const r = await fetch(`https://${baseHost}/api/v3.0/feeds?deviceId=${encodeURIComponent(deviceId)}&include=multipartUrl`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, signal: AbortSignal.timeout(5000),
  })
  trace.push({ step: 'feeds', status: r.status, ms: Date.now() - t0 })
  if (!r.ok) return ''
  const j = await r.json().catch(() => ({}))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const feeds: any[] = j.results ?? j.data ?? []
  const pick = feeds.find(f => f?.type === prefer && f?.multipartUrl) ?? feeds.find(f => f?.multipartUrl)
  if (!pick) trace.push({ step: 'feeds', note: `no multipartUrl (${feeds.map(f => f?.type).join(',') || 'none'})`, ms: 0 })
  return pick?.multipartUrl ?? ''
}

/** Pull the first complete JPEG out of a multipart/x-mixed-replace body. */
function firstJpeg(buf: Buffer): Buffer | null {
  const soi = buf.indexOf(Buffer.from([0xff, 0xd8, 0xff]))
  if (soi < 0) return null
  // Prefer the part's Content-Length when the header gives one.
  const head = buf.subarray(Math.max(0, soi - 400), soi).toString('latin1')
  const m = /content-length:\s*(\d+)/i.exec(head)
  if (m) {
    const len = Number(m[1])
    return buf.length >= soi + len ? Buffer.from(buf.subarray(soi, soi + len)) : null
  }
  // Otherwise the frame ends at the next part boundary ("\r\n--").
  const next = buf.indexOf('\r\n--', soi, 'latin1')
  if (next < 0) return null
  const eoi = buf.lastIndexOf(Buffer.from([0xff, 0xd9]), next)
  return eoi > soi ? Buffer.from(buf.subarray(soi, eoi + 2)) : null
}

/** A truly current JPEG from the camera's live preview feed, or null.
 * Pass `trace` to collect step-by-step results (portal ?debug=1). */
export async function eagleEyeLiveFrame(token: string, baseHost: string, deviceId: string, trace: EenLiveTrace[] = [], budgetMs = 8000, feed: 'preview' | 'main' = 'preview'): Promise<Buffer | null> {
  const started = Date.now()
  try {
    const [url, cookie] = await Promise.all([eenPreviewMultipartUrl(token, baseHost, deviceId, trace, feed), eenMediaCookie(token, baseHost, trace)])
    if (!url) return null
    for (const attempt of [0, 1]) {
      const left = budgetMs - (Date.now() - started)
      if (left < 1500) { trace.push({ step: 'stream', note: 'out of time', ms: 0 }); return null }
      const ctl = new AbortController()
      const timer = setTimeout(() => ctl.abort(), left)
      const t0 = Date.now()
      try {
        const ck = attempt === 0 ? cookie : await eenMediaCookie(token, baseHost, trace, true)
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, ...(ck ? { Cookie: ck } : {}) }, signal: ctl.signal })
        trace.push({ step: 'stream', status: res.status, note: res.headers.get('content-type') ?? '', ms: Date.now() - t0 })
        if ((res.status === 401 || res.status === 403) && attempt === 0) { await res.body?.cancel().catch(() => {}); continue }
        if (!res.ok || !res.body) return null
        // Not a picture stream (e.g. a main feed that isn't MJPEG) → give up now, don't wait out the budget.
        const ct = res.headers.get('content-type') ?? ''
        if (ct && !/multipart|jpe?g/i.test(ct)) { trace.push({ step: 'stream', note: `not MJPEG (${ct})`, ms: Date.now() - t0 }); await res.body.cancel().catch(() => {}); return null }
        const reader = res.body.getReader()
        let buf = Buffer.alloc(0)
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          buf = Buffer.concat([buf, Buffer.from(value)])
          const jpg = firstJpeg(buf)
          if (jpg && jpg.length > 1000) {
            ctl.abort()
            trace.push({ step: 'frame', note: `${jpg.length} bytes`, ms: Date.now() - t0 })
            return jpg
          }
          if (buf.length > 4_000_000) break
        }
        trace.push({ step: 'frame', note: `no frame in ${buf.length} bytes`, ms: Date.now() - t0 })
        return null
      } catch (e) {
        trace.push({ step: 'stream', note: e instanceof Error ? e.name : 'error', ms: Date.now() - t0 })
        return null
      } finally { clearTimeout(timer) }
    }
    return null
  } catch (e) {
    trace.push({ step: 'live', note: e instanceof Error ? e.message : 'error', ms: Date.now() - started })
    return null
  }
}

/** Resolve a recorded-video MP4 URL for a camera around a timestamp. */
export async function eagleEyeRecordedMp4Url(token: string, baseHost: string, deviceId: string, sinceISO: string): Promise<string | null> {
  try {
    const res = await fetch(`https://${baseHost}/api/v3.0/media?deviceId=${encodeURIComponent(deviceId)}&type=main&mediaType=video&startTimestamp__gte=${encodeURIComponent(eenTime(sinceISO))}&include=mp4Url&pageSize=1`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, signal: AbortSignal.timeout(9000),
    })
    if (!res.ok) return null
    const j = await res.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = (j.results ?? j.data ?? [])[0]
    return row?.mp4Url ?? null
  } catch { return null }
}

/** Find the recording that covers `tsISO` (main stream, then preview — some cameras
 * only keep the preview stream in the cloud). Falls back to the first recording
 * after `tsISO`. `trace` collects what Eagle Eye answered (portal clip ?debug=1).
 * The old eagleEyeRecordedMp4Url only asked main for a segment STARTING after ts,
 * so on Marbella every timeline click came back "No recording". */
export async function eagleEyeFindClip(token: string, baseHost: string, deviceId: string, tsISO: string, trace: EenLiveTrace[] = []): Promise<{ url: string; start: string; end: string | null; type: string } | null> {
  const ts = Date.parse(tsISO) || Date.now() - 60_000
  for (const type of ['main', 'preview'] as const) {
    const t0 = Date.now()
    try {
      const qs = new URLSearchParams({ deviceId, type, mediaType: 'video', startTimestamp__gte: eenTime(ts - 15 * 60_000), include: 'mp4Url', pageSize: '100' })
      const res = await fetch(`https://${baseHost}/api/v3.0/media?${qs.toString()}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, signal: AbortSignal.timeout(8000) })
      if (!res.ok) {
        trace.push({ step: `media ${type}`, status: res.status, note: (await res.text().catch(() => '')).slice(0, 200), ms: Date.now() - t0 })
        continue
      }
      const j = await res.json()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = ((j.results ?? j.data ?? []) as any[]).map(r => ({ start: String(r.startTimestamp ?? r.start ?? ''), end: (r.endTimestamp ?? r.end ?? null) as string | null, url: String(r.mp4Url ?? '') })).filter(r => r.start)
      const withUrl = rows.filter(r => r.url).length
      trace.push({ step: `media ${type}`, status: res.status, note: `${rows.length} rows, ${withUrl} with mp4Url${rows[0] ? `, first ${rows[0].start}` : ''}`, ms: Date.now() - t0 })
      const covering = rows.find(r => r.url && Date.parse(r.start) <= ts && (!r.end || Date.parse(r.end) >= ts))
      const after = rows.find(r => r.url && Date.parse(r.start) >= ts)
      const pick = covering ?? after
      if (pick) return { url: pick.url, start: pick.start, end: pick.end, type }
    } catch (e) {
      trace.push({ step: `media ${type}`, note: e instanceof Error ? e.name : 'error', ms: Date.now() - t0 })
    }
  }
  return null
}

export interface EagleEyeSegment { start: string; end: string | null; mp4Url: string | null }

/** EEN v3 wants ISO 8601 with milliseconds and a numeric offset ("…T17:47:01.146+00:00").
 * A plain "…Z" is refused (that refusal used to be swallowed → "No recordings"). */
export function eenTime(v: string | number | Date): string {
  return new Date(v).toISOString().replace('Z', '+00:00')
}

/** List recorded video segments for a camera within a time window (timeline +
 * archive browser). Pages through EEN v3 /media (nextPageToken) and tries the
 * main stream first, then the preview stream (some cameras only record preview
 * to the cloud). Newest first. Throws with EEN's message on an API error so the
 * caller can show it instead of an empty timeline. */
export async function eagleEyeListRecordedSegments(
  token: string, baseHost: string, deviceId: string, startISO: string, endISO: string, opts?: { withUrls?: boolean }
): Promise<EagleEyeSegment[]> {
  const endMs = Date.parse(endISO)
  const pull = async (type: 'main' | 'preview') => {
    const out: EagleEyeSegment[] = []
    let pageToken = ''
    for (let page = 0; page < 15; page++) {
      // Start 10 min early: a segment that began just before the window still covers it.
      const qs = new URLSearchParams({ deviceId, type, mediaType: 'video', startTimestamp__gte: eenTime(Date.parse(startISO) - 10 * 60_000), pageSize: '200' })
      if (opts?.withUrls !== false && type === 'main') qs.set('include', 'mp4Url')
      if (pageToken) qs.set('pageToken', pageToken)
      const res = await fetch(`https://${baseHost}/api/v3.0/media?${qs.toString()}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, signal: AbortSignal.timeout(12000) })
      if (!res.ok) {
        const body = (await res.text().catch(() => '')).slice(0, 200)
        throw new Error(`Eagle Eye recordings (${res.status})${body ? `: ${body}` : ''}`)
      }
      const j = await res.json()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = (j.results ?? j.data ?? []) as any[]
      for (const r of rows) {
        const st = r.startTimestamp ?? r.start ?? null
        if (!st || Date.parse(st) > endMs) continue
        out.push({ start: st, end: r.endTimestamp ?? r.end ?? null, mp4Url: r.mp4Url ?? null })
      }
      pageToken = j.nextPageToken || ''
      // Rows come oldest-first from startTimestamp__gte; stop once we're past the window.
      const last = rows[rows.length - 1]?.startTimestamp
      if (!pageToken || !rows.length || (last && Date.parse(last) > endMs)) break
    }
    return out
  }
  let rows = await pull('main')
  if (!rows.length) rows = await pull('preview').catch(() => [])
  return rows.filter(r => !r.end || Date.parse(r.end) >= Date.parse(startISO)).sort((a, b) => (a.start < b.start ? 1 : -1))
}

/** Fetch the bytes of a recorded MP4 url (token auth) for proxying to <video>. */
export async function eagleEyeFetchMp4(token: string, mp4Url: string): Promise<{ buf: Buffer; type: string } | null> {
  try {
    const res = await fetch(mp4Url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    return { buf, type: res.headers.get('content-type') || 'video/mp4' }
  } catch { return null }
}

export interface EagleEyeEvent { id: string; type: string; label: string; cameraId: string | null; when: string | null; ongoing: boolean }

const EEN_EVENT_LABELS: Record<string, string> = {
  'een.motionDetectionEvent.v1': 'Motion',
  'een.motionInRegionDetectionEvent.v1': 'Motion (region)',
  'een.lprPlateReadEvent.v1': 'License plate',
  'een.loiterDetectionEvent.v1': 'Loitering',
  'een.tamperDetectionEvent.v1': 'Tamper / blocked',
  'een.objectLineCrossEvent.v1': 'Line cross',
  'een.objectIntrusionEvent.v1': 'Intrusion',
  'een.deviceCloudStatusUpdateEvent.v1': 'Device status',
}
export function eenEventLabel(type: string): string {
  return EEN_EVENT_LABELS[type] ?? String(type).replace(/^een\./, '').replace(/Event\.v\d+$/, '').replace(/([A-Z])/g, ' $1').trim()
}

/** Historical camera events (motion, LPR, tamper, line-cross, device status…) for a
 * property over the last `hours`. Time-range per EEN v3 events API. */
export async function listEagleEyeEvents(token: string, baseHost: string, opts?: { hours?: number; cameraId?: string; types?: string[]; start?: Date; end?: Date }): Promise<EagleEyeEvent[]> {
  const hours = Math.min(168, Math.max(1, opts?.hours ?? 24))
  const iso = (d: Date) => d.toISOString().replace('Z', '+00:00')
  // Optional explicit window (camera search); otherwise the last `hours` as before.
  const end = opts?.end ?? new Date()
  const start = opts?.start ?? new Date(end.getTime() - hours * 36e5)
  const qs = new URLSearchParams({ startTimestamp__gte: iso(start), endTimestamp__lte: iso(end), pageSize: '100' })
  if (opts?.cameraId) qs.set('actor', `camera:${opts.cameraId}`)
  if (opts?.types?.length) qs.set('type__in', opts.types.join(','))
  const res = await fetch(`https://${baseHost}/api/v3.0/events?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`Eagle Eye events (${res.status})`)
  const d = await res.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (d.results ?? d.data ?? []) as any[]
  return rows.map(e => ({
    id: String(e.id ?? `${e.actorId}-${e.startTimestamp}-${e.type}`),
    type: String(e.type ?? ''),
    label: eenEventLabel(String(e.type ?? '')),
    cameraId: e.actorId ? String(e.actorId) : null,
    when: e.startTimestamp ?? null,
    ongoing: e.endTimestamp == null && e.span === true,
  }))
}

export async function listEagleEyeCameras(token: string, baseHost: string): Promise<EagleEyeCamera[]> {
  const res = await fetch(`https://${baseHost}/api/v3.0/cameras?pageSize=1000`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`Eagle Eye cameras (${res.status}): ${await res.text()}`)
  const d = await res.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (d.results ?? d.data ?? []) as any[]
  const eenOnline = (c: any): boolean | null => {
    const st = c.status
    if (typeof c.isOnline === 'boolean') return c.isOnline
    if (st == null) return null
    if (typeof st === 'string') return /online|streaming/i.test(st) && !/offline/i.test(st)
    if (typeof st === 'object') {
      const cs = st.connectionStatus ?? st.connection ?? st.cameraOnline ?? st.state
      if (typeof cs === 'boolean') return cs
      if (typeof cs === 'string') return /online|streaming/i.test(cs) && !/offline/i.test(cs)
    }
    return null
  }
  return rows.map(c => ({ id: String(c.id ?? c.esn ?? ''), esn: c.esn ? String(c.esn) : (c.id ? String(c.id) : null), name: c.name ?? 'Camera', tags: Array.isArray(c.tags) ? c.tags.map((t: unknown) => String(t)) : [], online: eenOnline(c) }))
}

/**
 * The camera's live preview feed as a continuous stream (multipart/x-mixed-replace
 * MJPEG) — for an <img> in the dealer viewer, so live plays at the camera's preview
 * rate instead of one still every few seconds. Token + media cookie stay server-side;
 * the route pipes the body through. Returns the upstream Response, or null.
 * Frame rate = the camera's preview update rate in Eagle Eye (0.25 s = 4 fps … 16 s).
 */
export async function eagleEyeLiveStream(token: string, baseHost: string, deviceId: string, signal?: AbortSignal): Promise<Response | null> {
  const trace: EenLiveTrace[] = []
  const [url, cookie] = await Promise.all([eenPreviewMultipartUrl(token, baseHost, deviceId, trace), eenMediaCookie(token, baseHost, trace)])
  if (!url) return null
  for (const attempt of [0, 1]) {
    const ck = attempt === 0 ? cookie : await eenMediaCookie(token, baseHost, trace, true)
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, ...(ck ? { Cookie: ck } : {}) }, signal })
    if ((res.status === 401 || res.status === 403) && attempt === 0) { await res.body?.cancel().catch(() => {}); continue }
    return res.ok && res.body ? res : null
  }
  return null
}
