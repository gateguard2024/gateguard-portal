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
    headers: { Authorization: `Basic ${basic(clientId, clientSecret)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`Eagle Eye token (${res.status}): ${await res.text()}`)
  return res.json()
}

export async function eagleEyeExchangeCode(clientId: string, clientSecret: string, code: string, redirectUri: string) {
  return tokenRequest(clientId, clientSecret, { grant_type: 'authorization_code', code, redirect_uri: redirectUri })
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
