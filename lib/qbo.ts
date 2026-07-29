/**
 * lib/qbo.ts — shared QuickBooks Online client.
 *
 * ONE connection: Gate Guard corporate connects a single QBO company; every
 * client site is a Customer inside it. Tokens live in the `qbo_connection`
 * table and auto-refresh (QBO access tokens die after ~1 hour), so callers
 * never deal with expiry.
 *
 * Static app credentials come from env (register the app at developer.intuit.com):
 *   QBO_CLIENT_ID, QBO_CLIENT_SECRET
 *   QBO_ENVIRONMENT      — 'production' (default) | 'sandbox'
 *   QBO_REDIRECT_URI     — must match the redirect URI registered on the Intuit app
 *
 * Backward compatibility: if no OAuth row exists yet but the legacy manual env
 * vars QBO_ACCESS_TOKEN + QBO_REALM_ID are present, we use those (they still
 * expire hourly — the OAuth connect flow is the durable path).
 */
import { createClient } from '@supabase/supabase-js'
import { encryptJson, decryptJson, credsKeyConfigured } from '@/lib/crypto-creds'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ── Token encryption at rest ────────────────────────────────────────────────
// QBO access/refresh tokens are encrypted with the shared CREDENTIALS_ENC_KEY
// (same AES-256-GCM scheme protecting Brivo/Eagle Eye keys) before they touch
// the DB. Reads are backward-compatible: any legacy plaintext row still works,
// and gets re-encrypted the next time it's written (connect or refresh).
function encTok(raw: string | null | undefined): string | null {
  if (!raw) return null
  if (!credsKeyConfigured()) return raw // no key configured → store as-is (fallback)
  return encryptJson({ t: raw })
}
function decTok(stored: string | null | undefined): string | null {
  if (!stored) return null
  if (stored.startsWith('v1:') && stored.split(':').length === 4) {
    try { return decryptJson<{ t: string }>(stored).t } catch { return null }
  }
  return stored // legacy plaintext row
}

const OAUTH_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
const AUTHORIZE_URL   = 'https://appcenter.intuit.com/connect/oauth2'
export const QBO_SCOPE = 'com.intuit.quickbooks.accounting'

export function qboEnvironment(): 'production' | 'sandbox' {
  return process.env.QBO_ENVIRONMENT === 'sandbox' ? 'sandbox' : 'production'
}

export function qboApiBase(env = qboEnvironment()): string {
  return env === 'sandbox'
    ? 'https://sandbox-quickbooks.api.intuit.com'
    : 'https://quickbooks.api.intuit.com'
}

export function qboRedirectUri(originFallback?: string): string {
  if (process.env.QBO_REDIRECT_URI) return process.env.QBO_REDIRECT_URI
  if (originFallback) return `${originFallback}/api/integrations/quickbooks/callback`
  return ''
}

export function qboAuthorizeUrl(redirectUri: string, state: string): string {
  const p = new URLSearchParams({
    client_id: process.env.QBO_CLIENT_ID ?? '',
    response_type: 'code',
    scope: QBO_SCOPE,
    redirect_uri: redirectUri,
    state,
  })
  return `${AUTHORIZE_URL}?${p.toString()}`
}

function basicAuthHeader(): string {
  const raw = `${process.env.QBO_CLIENT_ID ?? ''}:${process.env.QBO_CLIENT_SECRET ?? ''}`
  return `Basic ${Buffer.from(raw).toString('base64')}`
}

type TokenResponse = {
  access_token: string
  refresh_token: string
  expires_in: number
  x_refresh_token_expires_in: number
}

async function postTokenEndpoint(body: URLSearchParams): Promise<TokenResponse> {
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`QBO token endpoint ${res.status}: ${detail}`)
  }
  return res.json() as Promise<TokenResponse>
}

/** Exchange an OAuth authorization code for tokens and persist the connection. */
export async function exchangeCodeAndSave(
  code: string, realmId: string, redirectUri: string, connectedBy: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const tok = await postTokenEndpoint(new URLSearchParams({
      grant_type: 'authorization_code', code, redirect_uri: redirectUri,
    }))
    const now = Date.now()
    const { error } = await db().from('qbo_connection').upsert({
      realm_id: realmId,
      environment: qboEnvironment(),
      access_token: encTok(tok.access_token),
      refresh_token: encTok(tok.refresh_token),
      access_expires_at: new Date(now + tok.expires_in * 1000).toISOString(),
      refresh_expires_at: new Date(now + tok.x_refresh_token_expires_in * 1000).toISOString(),
      connected_by: connectedBy,
      is_active: true,
      last_refreshed_at: new Date(now).toISOString(),
      updated_at: new Date(now).toISOString(),
    }, { onConflict: 'realm_id' })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

type ConnRow = {
  id: string; realm_id: string; environment: string
  access_token: string | null; refresh_token: string | null
  access_expires_at: string | null
}

async function activeConnection(): Promise<ConnRow | null> {
  const { data } = await db()
    .from('qbo_connection')
    .select('id, realm_id, environment, access_token, refresh_token, access_expires_at')
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as ConnRow) ?? null
}

export type QboAuth =
  | { ok: true; token: string; realmId: string; environment: 'production' | 'sandbox' }
  | { ok: false; reason: string }

/**
 * Return a valid access token + realm, refreshing when it's within 2 minutes of
 * expiry. Falls back to legacy QBO_ACCESS_TOKEN/QBO_REALM_ID env if no stored
 * connection exists.
 */
export async function getQboAuth(): Promise<QboAuth> {
  const conn = await activeConnection()

  if (!conn) {
    const { QBO_ACCESS_TOKEN, QBO_REALM_ID } = process.env
    if (QBO_ACCESS_TOKEN && QBO_REALM_ID) {
      return { ok: true, token: QBO_ACCESS_TOKEN, realmId: QBO_REALM_ID, environment: qboEnvironment() }
    }
    return { ok: false, reason: 'QuickBooks is not connected. Connect a QBO company first.' }
  }

  const env = (conn.environment === 'sandbox' ? 'sandbox' : 'production') as 'production' | 'sandbox'
  const accessToken = decTok(conn.access_token)
  const refreshToken = decTok(conn.refresh_token)
  const expiresAt = conn.access_expires_at ? new Date(conn.access_expires_at).getTime() : 0
  const needsRefresh = !accessToken || Date.now() > expiresAt - 120_000

  if (!needsRefresh && accessToken) {
    return { ok: true, token: accessToken, realmId: conn.realm_id, environment: env }
  }

  if (!refreshToken) {
    return { ok: false, reason: 'QuickBooks token expired and no refresh token is stored — reconnect QBO.' }
  }
  if (!process.env.QBO_CLIENT_ID || !process.env.QBO_CLIENT_SECRET) {
    return { ok: false, reason: 'QBO_CLIENT_ID / QBO_CLIENT_SECRET not set — cannot refresh token.' }
  }

  try {
    const tok = await postTokenEndpoint(new URLSearchParams({
      grant_type: 'refresh_token', refresh_token: refreshToken,
    }))
    const now = Date.now()
    const { error } = await db().from('qbo_connection').update({
      access_token: encTok(tok.access_token),
      refresh_token: encTok(tok.refresh_token), // QBO rotates the refresh token
      access_expires_at: new Date(now + tok.expires_in * 1000).toISOString(),
      refresh_expires_at: new Date(now + tok.x_refresh_token_expires_in * 1000).toISOString(),
      last_refreshed_at: new Date(now).toISOString(),
      updated_at: new Date(now).toISOString(),
    }).eq('id', conn.id)
    if (error) return { ok: false, reason: `Failed to persist refreshed token: ${error.message}` }
    return { ok: true, token: tok.access_token, realmId: conn.realm_id, environment: env }
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) }
  }
}

/** Low-level authenticated call to the QBO REST API. `path` starts with '/'. */
export async function qboApi(
  auth: Extract<QboAuth, { ok: true }>, path: string, init?: RequestInit
): Promise<Response> {
  const url = `${qboApiBase(auth.environment)}/v3/company/${auth.realmId}${path}`
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${auth.token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
  })
}

/** Run a QBO SQL-ish query (e.g. "select * from Customer maxresults 1000"). */
export async function qboQuery<T = any>(
  auth: Extract<QboAuth, { ok: true }>, query: string
): Promise<{ ok: true; rows: T[] } | { ok: false; error: string }> {
  const res = await qboApi(auth, `/query?query=${encodeURIComponent(query)}&minorversion=73`, { method: 'GET' })
  if (!res.ok) return { ok: false, error: `QBO query ${res.status}: ${await res.text()}` }
  const body = await res.json()
  const entity = Object.keys(body?.QueryResponse ?? {}).find(k => Array.isArray(body.QueryResponse[k]))
  const rows = entity ? (body.QueryResponse[entity] as T[]) : []
  return { ok: true, rows }
}
