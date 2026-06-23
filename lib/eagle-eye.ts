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
  u.searchParams.set('client_id', clientId)
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('scope', EEN_SCOPE)
  u.searchParams.set('redirect_uri', redirectUri)
  u.searchParams.set('state', state)
  return u.toString()
}

function basic(clientId: string, clientSecret: string) {
  return Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
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
export async function getSiteEagleEyeAccess(siteId: string): Promise<{ token: string; baseHost: string }> {
  const c = await getSiteVendorCreds(siteId, 'eagle_eye')
  if (!c?.client_id || !c?.client_secret) throw new Error('Eagle Eye client ID/secret are not set for this site.')
  if (!c.refresh_token) throw new Error('Eagle Eye is not connected for this site yet — run Connect Eagle Eye.')

  const exp = c.expires_at ? new Date(c.expires_at).getTime() : 0
  if (c.access_token && c.base_host && exp - Date.now() > 60_000) {
    return { token: c.access_token, baseHost: c.base_host }
  }
  // Refresh.
  const t = await eagleEyeRefresh(c.client_id, c.client_secret, c.refresh_token)
  const baseHost = t.httpsBaseUrl?.hostname || c.base_host
  await mergeSiteVendorCreds(siteId, 'eagle_eye', {
    access_token: t.access_token,
    refresh_token: t.refresh_token || c.refresh_token,
    expires_at: new Date(Date.now() + (t.expires_in ?? 3600) * 1000).toISOString(),
    base_host: baseHost,
  })
  return { token: t.access_token, baseHost }
}

export interface EagleEyeCamera { id: string; name: string; tags: string[] }

/** Grab a single preview JPEG frame for a camera (server-side, so the token
 * never reaches the browser). Returns null if unavailable. */
export async function eagleEyePreviewFrame(token: string, baseHost: string, deviceId: string): Promise<Buffer | null> {
  try {
    const feed = await fetch(`https://${baseHost}/api/v3.0/feeds?deviceId=${encodeURIComponent(deviceId)}&type=preview&include=multipartUrl`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, signal: AbortSignal.timeout(8000),
    })
    if (!feed.ok) return null
    const fj = await feed.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const url = fj.multipartUrl ?? (fj.results ?? [])[0]?.multipartUrl
    if (!url) return null
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) })
    if (!res.ok || !res.body) return null
    // Read the MJPEG stream until we have one complete JPEG (FFD8…FFD9).
    const reader = res.body.getReader()
    const chunks: number[] = []
    let start = -1
    const cap = 3_000_000
    for (let i = 0; i < 400; i++) {
      const { value, done } = await reader.read()
      if (done) break
      for (let b = 0; b < value.length; b++) {
        chunks.push(value[b])
        const n = chunks.length
        if (start < 0 && n >= 2 && chunks[n - 2] === 0xff && chunks[n - 1] === 0xd8) start = n - 2
        else if (start >= 0 && n >= 2 && chunks[n - 2] === 0xff && chunks[n - 1] === 0xd9) {
          reader.cancel().catch(() => {})
          return Buffer.from(chunks.slice(start, n))
        }
      }
      if (chunks.length > cap) break
    }
    reader.cancel().catch(() => {})
    return null
  } catch { return null }
}

/** Resolve a recorded-video MP4 URL for a camera around a timestamp. */
export async function eagleEyeRecordedMp4Url(token: string, baseHost: string, deviceId: string, sinceISO: string): Promise<string | null> {
  try {
    const res = await fetch(`https://${baseHost}/api/v3.0/media?deviceId=${encodeURIComponent(deviceId)}&type=main&mediaType=video&startTimestamp__gte=${encodeURIComponent(sinceISO)}&include=mp4Url&pageSize=1`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, signal: AbortSignal.timeout(9000),
    })
    if (!res.ok) return null
    const j = await res.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = (j.results ?? j.data ?? [])[0]
    return row?.mp4Url ?? null
  } catch { return null }
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

export async function listEagleEyeCameras(token: string, baseHost: string): Promise<EagleEyeCamera[]> {
  const res = await fetch(`https://${baseHost}/api/v3.0/cameras?pageSize=1000`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`Eagle Eye cameras (${res.status}): ${await res.text()}`)
  const d = await res.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (d.results ?? d.data ?? []) as any[]
  return rows.map(c => ({ id: String(c.id ?? c.esn ?? ''), name: c.name ?? 'Camera', tags: Array.isArray(c.tags) ? c.tags.map((t: unknown) => String(t)) : [] }))
}
