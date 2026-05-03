/**
 * lib/brivo.ts — GateGuard Portal
 *
 * Brivo API client adapted for the portal's organizations table.
 * Ported from the working GGSOC implementation.
 *
 * Auth model (same as GGSOC):
 *   App-level (GateGuard's registered Brivo developer app):
 *     BRIVO_API_KEY, BRIVO_CLIENT_ID, BRIVO_CLIENT_SECRET  ← Vercel env vars
 *
 *   Per-org (property manager login stored in organizations table):
 *     brivo_username, brivo_password
 *     brivo_access_token, brivo_token_expires  ← cached, auto-refreshed
 *
 * Token flow:
 *   POST https://auth.brivo.com/oauth/token
 *   Authorization: Basic {base64(clientId:clientSecret)}
 *   api-key: {BRIVO_API_KEY}
 *   Body: grant_type=password&username=…&password=…
 */

import { createClient } from '@supabase/supabase-js'

const BRIVO_AUTH_URL = 'https://auth.brivo.com/oauth/token'
const BRIVO_API_BASE = 'https://api.brivo.com/v1/api'

function serviceDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ─── App-level credentials (env vars only in portal) ─────────────────────────
interface BrivoAppCreds {
  apiKey:    string
  authBasic: string  // base64(clientId:clientSecret)
}

function getBrivoAppCreds(): BrivoAppCreds {
  const apiKey = process.env.BRIVO_API_KEY
  const clientId = process.env.BRIVO_CLIENT_ID
  const clientSecret = process.env.BRIVO_CLIENT_SECRET
  const authBasic = process.env.BRIVO_AUTH_BASIC  // pre-computed alternative

  if (!apiKey) throw new Error('BRIVO_API_KEY env var not set')

  if (authBasic) return { apiKey, authBasic }
  if (clientId && clientSecret) {
    return { apiKey, authBasic: Buffer.from(`${clientId}:${clientSecret}`).toString('base64') }
  }

  throw new Error('Brivo app credentials missing: set BRIVO_CLIENT_ID + BRIVO_CLIENT_SECRET (or BRIVO_AUTH_BASIC)')
}

// ─── Per-org token (cached in DB, auto-refreshes) ────────────────────────────
export interface BrivoToken {
  token:  string
  apiKey: string
  orgId:  string
}

export async function getOrgBrivoToken(orgId: string): Promise<BrivoToken> {
  const db = serviceDb()

  const { data: org, error } = await db
    .from('organizations')
    .select('brivo_username, brivo_password, brivo_access_token, brivo_token_expires, brivo_site_id')
    .eq('id', orgId)
    .single()

  if (error || !org) throw new Error(`Organization ${orgId} not found`)

  if (!org.brivo_username || !org.brivo_password) {
    throw new Error(`Brivo credentials not configured for org ${orgId}`)
  }

  const { apiKey, authBasic } = getBrivoAppCreds()

  // Return cached token if still valid (60s buffer)
  const expiresAt = org.brivo_token_expires ? new Date(org.brivo_token_expires).getTime() : 0
  if (org.brivo_access_token && expiresAt - Date.now() > 60_000) {
    return { token: org.brivo_access_token, apiKey, orgId }
  }

  // Refresh via password grant
  console.log(`[brivo] Refreshing token for org ${orgId}…`)

  const res = await fetch(BRIVO_AUTH_URL, {
    method: 'POST',
    headers: {
      Authorization:  `Basic ${authBasic}`,
      'api-key':      apiKey,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'password',
      username:   org.brivo_username,
      password:   org.brivo_password,
    }).toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Brivo auth failed (${res.status}): ${text}`)
  }

  const tokens    = await res.json()
  const newExpiry = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString()

  await db
    .from('organizations')
    .update({ brivo_access_token: tokens.access_token, brivo_token_expires: newExpiry })
    .eq('id', orgId)

  console.log(`[brivo] ✅ Token refreshed for org ${orgId}`)
  return { token: tokens.access_token, apiKey, orgId }
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────
function brivoHeaders(token: string, apiKey: string): HeadersInit {
  return {
    Authorization:  `Bearer ${token}`,
    'api-key':      apiKey,
    Accept:         'application/json',
    'Content-Type': 'application/json',
  }
}

async function handleBrivoResponse(res: Response, label: string): Promise<any> {
  if (!res.ok) throw new Error(`Brivo ${label} failed (${res.status}): ${await res.text()}`)
  if (res.status === 204) return { success: true }
  const ct = res.headers.get('content-type') ?? ''
  if (!ct.includes('application/json')) return { success: true }
  return res.json()
}

export async function brivoGet(
  token: string, apiKey: string, path: string, params?: Record<string, string>
): Promise<any> {
  const url = new URL(`${BRIVO_API_BASE}${path}`)
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString(), { headers: brivoHeaders(token, apiKey) })
  return handleBrivoResponse(res, `GET ${path}`)
}

export async function brivoPost(
  token: string, apiKey: string, path: string, body?: Record<string, any>
): Promise<any> {
  const res = await fetch(`${BRIVO_API_BASE}${path}`, {
    method: 'POST', headers: brivoHeaders(token, apiKey),
    body: body ? JSON.stringify(body) : undefined,
  })
  return handleBrivoResponse(res, `POST ${path}`)
}

export async function brivoPut(
  token: string, apiKey: string, path: string, body?: Record<string, any>
): Promise<any> {
  const res = await fetch(`${BRIVO_API_BASE}${path}`, {
    method: 'PUT', headers: brivoHeaders(token, apiKey),
    body: body ? JSON.stringify(body) : undefined,
  })
  return handleBrivoResponse(res, `PUT ${path}`)
}

export async function brivoDelete(
  token: string, apiKey: string, path: string
): Promise<any> {
  const res = await fetch(`${BRIVO_API_BASE}${path}`, {
    method: 'DELETE', headers: brivoHeaders(token, apiKey),
  })
  return handleBrivoResponse(res, `DELETE ${path}`)
}

// ─── Domain helpers ───────────────────────────────────────────────────────────

export interface BrivoUser {
  id:          string
  firstName:   string
  lastName:    string
  email:       string | null
  phone:       string | null
  unitNumber:  string | null
  active:      boolean
  groupIds:    string[]
}

/**
 * Fetch all users for a Brivo site.
 * Handles Brivo's pagination (pageSize max 100).
 */
export async function listBrivoUsers(
  token: string,
  apiKey: string,
  brivoSiteId: string
): Promise<BrivoUser[]> {
  const users: BrivoUser[] = []
  let offset = 0
  const pageSize = 100

  while (true) {
    const data = await brivoGet(token, apiKey, '/users', {
      filter:   `site eq "${brivoSiteId}"`,
      pageSize: String(pageSize),
      offset:   String(offset),
    })

    const page: any[] = data.data ?? []
    if (page.length === 0) break

    for (const u of page) {
      // Extract phone from custom fields (Brivo stores phone as a custom field)
      const phone = u.customFields?.find((f: any) =>
        f.fieldName?.toLowerCase().includes('phone') ||
        f.fieldName?.toLowerCase().includes('mobile')
      )?.value ?? null

      // Extract unit from group name heuristic (groups often named "Unit 101")
      const unitGroup = (u.groupIds ?? [])
        .map((gid: string) => u.groups?.find((g: any) => g.id === gid)?.name ?? '')
        .find((name: string) => /unit\s*\d+/i.test(name))
      const unitMatch  = unitGroup?.match(/(\d+[A-Za-z]*)/)
      const unitNumber = unitMatch ? unitMatch[1] : null

      users.push({
        id:         String(u.id),
        firstName:  u.firstName?.trim() ?? '',
        lastName:   u.lastName?.trim()  ?? '',
        email:      u.email || null,
        phone:      phone   || null,
        unitNumber: unitNumber || u.externalId || null,
        active:     u.suspended !== true,
        groupIds:   u.groupIds ?? [],
      })
    }

    if (page.length < pageSize) break
    offset += pageSize
  }

  return users
}
