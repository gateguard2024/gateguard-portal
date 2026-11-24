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

// ─── Per-SITE token (from the site_integrations vault) ───────────────────────
// Each property site can hold its OWN Brivo login in the encrypted vault. This
// is the per-site path; getOrgBrivoToken remains for the legacy per-org setup.
export interface SiteBrivoToken { token: string; apiKey: string; brivoSiteId: string; credentialValue?: string }

// Cache site Brivo tokens so a burst of calls (portal load fires doors + events +
// users at once) reuses ONE token instead of minting a fresh one per call. Brivo
// invalidates rapidly re-minted password-grant tokens — that's why, without this,
// the first call in a burst works and the next returns 401 "Access token expired".
// The org path already caches (brivo_access_token/brivo_token_expires); this brings
// the per-site path to parity. In-memory (per warm instance) is enough: the burst
// that triggers the bug happens inside a single invocation.
const siteBrivoTokenCache = new Map<string, { token: string; apiKey: string; brivoSiteId: string; credentialValue?: string; exp: number }>()
const tokenSite = new Map<string, string>() // token → site, so an expired one can be renewed
function siteForToken(token: string): string | null {
  const hit = tokenSite.get(token)
  if (hit) return hit
  for (const [site, c] of Array.from(siteBrivoTokenCache.entries())) if (c.token === token) return site
  return null
}

export async function getSiteBrivoToken(siteId: string): Promise<SiteBrivoToken> {
  const cached = siteBrivoTokenCache.get(siteId)
  if (cached && cached.exp - Date.now() > 60_000) {
    return { token: cached.token, apiKey: cached.apiKey, brivoSiteId: cached.brivoSiteId, credentialValue: cached.credentialValue }
  }

  // Imported lazily to avoid a cycle (site-integrations → crypto only).
  const { getSiteVendorCreds } = await import('@/lib/site-integrations')
  const creds = await getSiteVendorCreds(siteId, 'brivo')
  if (!creds?.username || !creds?.password) throw new Error('Brivo credentials are not set for this site.')

  // Each site brings its OWN Brivo api key + app credentials — nothing shared.
  // (Falls back to GateGuard's app-level env vars only if a site didn't provide
  // its own, so legacy single-app setups keep working.)
  let apiKey = creds.api_key
  let authBasic = creds.auth_basic
  if (!authBasic && creds.client_id && creds.client_secret) {
    authBasic = Buffer.from(`${creds.client_id}:${creds.client_secret}`).toString('base64')
  }
  if (!apiKey || !authBasic) {
    const app = getBrivoAppCreds()
    apiKey = apiKey || app.apiKey
    authBasic = authBasic || app.authBasic
  }

  const res = await fetch(BRIVO_AUTH_URL, {
    method: 'POST',
    headers: { Authorization: `Basic ${authBasic}`, 'api-key': apiKey, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'password', username: creds.username, password: creds.password }).toString(),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Brivo auth failed (${res.status})`)
  const tokens = await res.json()
  if (tokens?.access_token) { tokenSite.set(tokens.access_token, siteId); if (tokenSite.size > 500) tokenSite.delete(tokenSite.keys().next().value as string) }
  const brivoSiteId = String(creds.site_id ?? '')
  const credentialValue = creds.credential_value || undefined
  const ttlSec = Number(tokens.expires_in) > 0 ? Number(tokens.expires_in) : 900
  siteBrivoTokenCache.set(siteId, {
    token: tokens.access_token, apiKey, brivoSiteId, credentialValue,
    exp: Date.now() + ttlSec * 1000,
  })
  return { token: tokens.access_token, apiKey, brivoSiteId, credentialValue }
}

// ─── Master account token (sees all sites) ──────────────────────────────────
// Corporate access: GateGuard's master Brivo login can see every site. Cached
// in-process. Set BRIVO_MASTER_USERNAME + BRIVO_MASTER_PASSWORD in env.
let _masterCache: { token: string; expires: number } | null = null

export async function getMasterBrivoToken(): Promise<{ token: string; apiKey: string }> {
  const { apiKey, authBasic } = getBrivoAppCreds()
  if (_masterCache && _masterCache.expires - Date.now() > 60_000) {
    return { token: _masterCache.token, apiKey }
  }
  const username = process.env.BRIVO_MASTER_USERNAME
  const password = process.env.BRIVO_MASTER_PASSWORD
  if (!username || !password) {
    throw new Error('Brivo master account not configured: set BRIVO_MASTER_USERNAME + BRIVO_MASTER_PASSWORD')
  }
  const res = await fetch(BRIVO_AUTH_URL, {
    method: 'POST',
    headers: { Authorization: `Basic ${authBasic}`, 'api-key': apiKey, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'password', username, password }).toString(),
  })
  if (!res.ok) throw new Error(`Brivo master auth failed (${res.status}): ${await res.text()}`)
  const tokens = await res.json()
  _masterCache = { token: tokens.access_token, expires: Date.now() + (tokens.expires_in ?? 3600) * 1000 }
  return { token: tokens.access_token, apiKey }
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

// ─── Expired sign-in → sign in again and retry once ─────────────────────────
// Brivo can end a sign-in before its expires_in (another login on the same account
// from another server, a sync, or the Brivo website ends the older one) and answers
// 401 "invalid_token / Access token expired". Every Brivo call goes through brivoSend,
// so all of them recover on their own: find which site the token belongs to, sign
// that site in again, retry once. `renewed` maps old → new token so a loop that keeps
// passing the old token (event paging) uses the new one.
const renewed = new Map<string, string>()
const latest = (t: string) => { let x = t; for (let i = 0; i < 5 && renewed.has(x); i++) x = renewed.get(x)!; return x }
const expired = (status: number, text: string) => status === 401 && /invalid_token|expired|unauthori/i.test(text)

// ─── Speed limit (Nov 24 2026: Brivo emailed "over its throttle limit (calls per
// second)" for our Tier 1 key) ───────────────────────────────────────────────
// Per API key, per server: at most BRIVO_MAX_INFLIGHT calls at once and a gap of
// BRIVO_MIN_GAP_MS between starts (default 3 at once, ~4 calls/s). Brivo's 429
// "too many" → wait (Retry-After, else 1/2/4/8 s) and retry, up to 4 times.
const MAX_INFLIGHT = Math.max(1, Number(process.env.BRIVO_MAX_INFLIGHT) || 3)
const MIN_GAP_MS = Math.max(0, Number(process.env.BRIVO_MIN_GAP_MS) || 250)
// Background reads (the event history sync / top-up) go slower and always let a
// screen's call go first (Nov 24 2026: the first 30-day sync paged hundreds of event
// pages, Brivo throttled the key, and Residents / door actions stalled behind it).
const BG_GAP_MS = Math.max(MIN_GAP_MS, Number(process.env.BRIVO_BG_GAP_MS) || 700)
type Prio = 'urgent' | 'normal' | 'bg'
type Lane = { inflight: number; next: number; bgNext: number; queue: (() => void)[]; bgQueue: (() => void)[] }
const lanes = new Map<string, Lane>()
const nap = (ms: number) => new Promise<void>(r => setTimeout(r, ms))
async function slot(key: string, prio: Prio = 'normal'): Promise<() => void> {
  const lane = lanes.get(key) ?? { inflight: 0, next: 0, bgNext: 0, queue: [], bgQueue: [] }
  lanes.set(key, lane)
  const bg = prio === 'bg'
  // Urgent (open a gate, add a person — anything that isn't a read) goes to the FRONT
  // of the line and may use one extra slot (Nov 24 2026: "Open gate" sat behind a
  // residents load's hundreds of reads and timed out). Background: one at a time, and
  // only while no screen call is waiting.
  const blocked = () => prio === 'urgent' ? lane.inflight >= MAX_INFLIGHT + 1
    : bg ? (lane.inflight >= 1 || lane.queue.length > 0) : lane.inflight >= MAX_INFLIGHT
  while (blocked()) {
    await new Promise<void>(r => (bg ? lane.bgQueue : lane.queue)[prio === 'urgent' ? 'unshift' : 'push'](r))
  }
  lane.inflight++
  const now = Date.now()
  if (prio === 'urgent') return release(lane)
  const at = bg ? Math.max(lane.next, lane.bgNext) : lane.next
  lane.next = Math.max(now, at) + MIN_GAP_MS
  if (bg) lane.bgNext = Math.max(now, at) + BG_GAP_MS
  if (at > now) await nap(at - now)
  return release(lane)
}
function release(lane: Lane) {
  let done = false
  return () => {
    if (done) return
    done = true
    lane.inflight--
    // Wake a screen call first; background only when none is waiting (it re-checks).
    const next = lane.queue.shift() ?? lane.bgQueue.shift()
    next?.()
  }
}
async function limitedFetch(apiKey: string, url: string, init: RequestInit, prio: Prio = 'normal'): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const done = await slot(apiKey, prio)
    let res: Response
    try { res = await fetch(url, init) } finally { done() }
    if (res.status !== 429) return res
    // Throttled. Background gives up (next run carries on); a gate open retries
    // quickly twice; reads back off up to 4 times.
    if (prio === 'bg' && attempt >= 1) return res
    if (prio === 'urgent' && attempt >= 2) return res
    if (attempt >= 4) return res
    const ra = Number(res.headers.get('retry-after'))
    const wait = Number.isFinite(ra) && ra > 0 ? Math.min(ra, 30) * 1000 : 1000 * 2 ** attempt
    await nap(prio === 'urgent' ? Math.min(wait, 2000) : wait)
  }
}

async function brivoSend(method: string, token: string, apiKey: string, url: string, body?: Record<string, any>, bg = false): Promise<any> {
  const prio: Prio = bg ? 'bg' : method === 'GET' ? 'normal' : 'urgent'
  const send = (t: string) => limitedFetch(apiKey, url, { method, headers: brivoHeaders(t, apiKey), body: body ? JSON.stringify(body) : undefined, cache: 'no-store' }, prio)
  const label = `${method} ${url.replace(BRIVO_API_BASE, '').split('?')[0]}`
  let t = latest(token)
  let res = await send(t)
  if (res.status === 401) {
    const text = await res.text()
    const siteId = expired(res.status, text) ? siteForToken(t) : null
    if (!siteId) throw new Error(`Brivo ${label} failed (401): ${text}`)
    siteBrivoTokenCache.delete(siteId)
    const fresh = await getSiteBrivoToken(siteId)
    renewed.set(t, fresh.token)
    if (token !== t) renewed.set(token, fresh.token)
    t = fresh.token
    res = await send(t)
  }
  if (method !== 'GET' && res.ok) forgetBrivoUsers()
  return handleBrivoResponse(res, label)
}

export async function brivoGet(
  token: string, apiKey: string, path: string, params?: Record<string, string>, opts?: { bg?: boolean }
): Promise<any> {
  const url = new URL(`${BRIVO_API_BASE}${path}`)
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return brivoSend('GET', token, apiKey, url.toString(), undefined, !!opts?.bg)
}

export async function brivoPost(
  token: string, apiKey: string, path: string, body?: Record<string, any>
): Promise<any> {
  return brivoSend('POST', token, apiKey, `${BRIVO_API_BASE}${path}`, body)
}

export async function brivoPut(
  token: string, apiKey: string, path: string, body?: Record<string, any>
): Promise<any> {
  return brivoSend('PUT', token, apiKey, `${BRIVO_API_BASE}${path}`, body)
}

export async function brivoDelete(
  token: string, apiKey: string, path: string
): Promise<any> {
  return brivoSend('DELETE', token, apiKey, `${BRIVO_API_BASE}${path}`)
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
  groupNames:  string[]
}

// Brivo returns contact info as arrays in varied shapes — pull the primary value.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function brivoEmail(u: any): string | null {
  if (u.email) return String(u.email)
  const arr = u.emails ?? u.emailAddresses ?? []
  for (const e of arr) { const v = typeof e === 'string' ? e : (e?.address ?? e?.email ?? e?.value); if (v) return String(v) }
  return null
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function brivoPhone(u: any): string | null {
  const arr = u.phoneNumbers ?? u.phones ?? []
  for (const p of arr) { const v = typeof p === 'string' ? p : (p?.number ?? p?.phoneNumber ?? p?.value); if (v) return String(v) }
  const cf = u.customFields?.find((f: any) => /phone|mobile|cell/i.test(f.fieldName ?? ''))?.value
  return cf ? String(cf) : null
}

/**
 * Fetch all users for a Brivo site.
 * Handles Brivo's pagination (pageSize max 100).
 */
// People lists are kept 10 min per account (every screen asks; Brivo is slow). Any write
// in this file (add person, group change, suspend…) clears it so changes show at once.
const usersCache = new Map<string, { at: number; users: BrivoUser[]; pending: number }>()
export function forgetBrivoUsers() { usersCache.clear() }

export async function listBrivoUsers(
  token: string,
  apiKey: string,
  brivoSiteId: string
): Promise<BrivoUser[]> {
  return (await listBrivoUsersEx(token, apiKey, brivoSiteId)).users
}

/** Same, plus how many groups' members are still being looked up (shown as "loading
 * groups" and filled in on the next load). Kept 10 min once complete, 20 s while not. */
export async function listBrivoUsersEx(
  token: string,
  apiKey: string,
  brivoSiteId: string
): Promise<{ users: BrivoUser[]; groupsPending: number }> {
  const ck = `${apiKey}|${brivoSiteId}`
  const hit = usersCache.get(ck)
  if (hit && Date.now() - hit.at < (hit.pending ? 20_000 : 600_000)) return { users: hit.users, groupsPending: hit.pending }
  const inflight = usersInflight.get(ck)
  if (inflight) return inflight
  const p = listBrivoUsersFresh(token, apiKey, brivoSiteId)
    .then(r => { usersCache.set(ck, { at: Date.now(), users: r.users, pending: r.groupsPending }); return r })
    .finally(() => usersInflight.delete(ck))
  usersInflight.set(ck, p)
  return p
}
const usersInflight = new Map<string, Promise<{ users: BrivoUser[]; groupsPending: number }>>()

// ─── Who is in which group (Nov 24 2026) ────────────────────────────────────
// Brivo's /users list leaves out groupIds, so membership = one call per group (a
// property with a group per unit = hundreds of calls; that timed out the Residents
// page every time). Saved in brivo_group_members (migration 244) and refreshed a
// slice at a time: each load spends at most `budgetMs` on the groups that are
// missing or oldest, in the background lane. Without 244 it's kept in memory only.
const MEMBERS_FRESH_MS = 6 * 3600_000
/** A person was added to / removed from a group here — look its members up again. */
async function groupChanged(groupId: string) {
  memMembers.forEach((_, k) => { if (k.endsWith(`|${groupId}`)) memMembers.delete(k) })
  const { error } = await serviceDb().from('brivo_group_members').delete().eq('group_id', groupId)
  if (error && !/brivo_group_members|does not exist|schema cache/i.test(error.message)) console.error('[brivo] members reset:', error.message)
}
const memMembers = new Map<string, { at: number; ids: string[] }>()
async function groupMembership(token: string, apiKey: string, brivoSiteId: string, groupIds: string[], budgetMs: number): Promise<{ byGroup: Map<string, string[]>; pending: number }> {
  const byGroup = new Map<string, string[]>()
  const fetchedAt = new Map<string, number>()
  let hasTable = true
  const { data, error } = await serviceDb().from('brivo_group_members').select('group_id, user_ids, fetched_at').eq('brivo_site_id', String(brivoSiteId))
  if (error) { hasTable = false; if (!/brivo_group_members|does not exist|schema cache/i.test(error.message)) console.error('[brivo] members read:', error.message) }
  for (const r of (data ?? []) as { group_id: string; user_ids: string[] | null; fetched_at: string }[]) {
    byGroup.set(String(r.group_id), (r.user_ids ?? []).map(String)); fetchedAt.set(String(r.group_id), Date.parse(r.fetched_at))
  }
  for (const gid of groupIds) {
    const m = memMembers.get(`${brivoSiteId}|${gid}`)
    if (m && (!fetchedAt.has(gid) || m.at > fetchedAt.get(gid)!)) { byGroup.set(gid, m.ids); fetchedAt.set(gid, m.at) }
  }
  // Missing first, then the oldest; only stale ones.
  const todo = groupIds.filter(g => !fetchedAt.has(g) || Date.now() - fetchedAt.get(g)! > MEMBERS_FRESH_MS)
    .sort((a, b) => (fetchedAt.get(a) ?? 0) - (fetchedAt.get(b) ?? 0))
  const deadline = Date.now() + budgetMs
  const fresh: { brivo_site_id: string; group_id: string; user_ids: string[]; fetched_at: string }[] = []
  let i = 0
  // Two at a time in the background lane (each still waits its turn).
  const worker = async () => {
    while (i < todo.length && Date.now() < deadline) {
      const gid = todo[i++]
      try {
        const ids = await groupMemberIds(token, apiKey, gid, true)
        byGroup.set(gid, ids); memMembers.set(`${brivoSiteId}|${gid}`, { at: Date.now(), ids })
        fresh.push({ brivo_site_id: String(brivoSiteId), group_id: gid, user_ids: ids, fetched_at: new Date().toISOString() })
      } catch (e) {
        console.error('[brivo] group members', gid, e instanceof Error ? e.message : e)
        if (/\(429\)/.test(String(e))) break // throttled — stop, carry on next load
      }
    }
  }
  await Promise.all([worker(), worker()])
  if (hasTable && fresh.length) {
    const { error: upErr } = await serviceDb().from('brivo_group_members').upsert(fresh, { onConflict: 'brivo_site_id,group_id' })
    if (upErr) console.error('[brivo] members save:', upErr.message)
  }
  const pending = groupIds.filter(g => !byGroup.has(g)).length
  return { byGroup, pending }
}

/** Members of one group (Brivo: GET /groups/{id}/users, paged). */
async function groupMemberIds(token: string, apiKey: string, groupId: string, bg = false): Promise<string[]> {
  const ids: string[] = []
  for (let offset = 0; offset <= 20000; offset += 100) {
    const data = await brivoGet(token, apiKey, `/groups/${groupId}/users`, { pageSize: '100', offset: String(offset) }, { bg })
    const page: any[] = data.data ?? []
    for (const m of page) ids.push(String(m.id ?? m.userId ?? m))
    if (page.length < 100) break
  }
  return ids
}

async function listBrivoUsersFresh(
  token: string,
  apiKey: string,
  brivoSiteId: string
): Promise<{ users: BrivoUser[]; groupsPending: number }> {
  const users: BrivoUser[] = []
  let offset = 0
  const pageSize = 100

  // NOTE: Brivo's `/users` endpoint rejects the `site eq "X"` filter with a
  // 400 "Invalid filter format" (users belong to a site via GROUPS, not a
  // direct site field). So we page ALL account users, then narrow client-side
  // to the site's groups when we can determine them (mirrors the doors pattern).
  const siteGroups = await listBrivoSiteGroupsRaw(token, apiKey, brivoSiteId).catch(() => [] as any[])
  const siteGroupSet = new Set(siteGroups.map((g: any) => String(g.id)))
  const groupNameById = new Map<string, string>(siteGroups.map((g: any) => [String(g.id), String(g.name ?? 'Group')]))

  while (true) {
    const data = await brivoGet(token, apiKey, '/users', {
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

      const gids = (u.groupIds ?? []).map((g: any) => String(g))
      users.push({
        id:         String(u.id),
        firstName:  u.firstName?.trim() ?? '',
        lastName:   u.lastName?.trim()  ?? '',
        email:      brivoEmail(u),
        phone:      brivoPhone(u) || phone || null,
        unitNumber: unitNumber || u.externalId || null,
        active:     u.suspended !== true,
        groupIds:   gids,
        groupNames: gids.map((id: string) => groupNameById.get(id)).filter(Boolean) as string[],
      })
    }

    if (page.length < pageSize) break
    offset += pageSize
  }

  // Brivo's /users list usually leaves out groupIds (Nov 24 2026: no groups showed on
  // Residents). Membership comes from the saved per-group lists (groupMembership).
  let groupsPending = 0
  if (siteGroups.length > 0 && !users.some(u => u.groupIds.length)) {
    const m = await groupMembership(token, apiKey, brivoSiteId, siteGroups.map((g: any) => String(g.id)), 8_000)
    groupsPending = m.pending
    const byUser = new Map<string, string[]>()
    m.byGroup.forEach((ids, gid) => { for (const uid of ids) byUser.set(uid, [...(byUser.get(uid) ?? []), gid]) })
    for (const u of users) {
      const gids = byUser.get(u.id) ?? []
      u.groupIds = gids
      u.groupNames = gids.map(id => groupNameById.get(id)).filter(Boolean) as string[]
      if (!u.unitNumber) { const mm = u.groupNames.map(n => n.match(/unit\s*(\d+[A-Za-z]*)/i)).find(Boolean); if (mm) u.unitNumber = mm[1] }
    }
  }

  // Narrow to this site's groups — but ONLY if that leaves results (and only once every
  // group's members are known — a half-filled list would hide people).
  if (siteGroupSet.size > 0 && groupsPending === 0) {
    const scoped = users.filter(u => (u.groupIds ?? []).some(g => siteGroupSet.has(String(g))))
    if (scoped.length > 0) return { users: scoped, groupsPending }
  }
  return { users, groupsPending }
}

/**
 * Create a Brivo user, optionally adding them to a group (groups carry access).
 * Phone is a Brivo custom field — handled in a later phase; not written here.
 */
export async function createBrivoUser(
  token: string,
  apiKey: string,
  input: { firstName: string; lastName: string; email?: string | null; phone?: string | null; externalId?: string | null; groupId?: string | null },
): Promise<{ id: string }> {
  // Brivo's user schema takes emails/phoneNumbers as ARRAYS of objects — NOT a
  // top-level `email` string. Sending `email: "x"` makes Brivo reject the whole
  // request as 400 "bad request" (this was the add-user bug). Mirror the exact
  // shape updateBrivoUser uses, which Brivo accepts.
  const body: Record<string, any> = { firstName: input.firstName, lastName: input.lastName }
  if (input.email) body.emails = [{ address: input.email, email: true }]
  if (input.phone) body.phoneNumbers = [{ number: input.phone }]
  if (input.externalId) body.externalId = input.externalId  // we use this for unit number

  const created = await brivoPost(token, apiKey, '/users', body)
  const id = String(created.id ?? created.userId ?? '')
  if (!id) throw new Error('Brivo did not return a new user id')

  // Adding the user to a group is how Brivo grants access at a site.
  if (input.groupId) {
    await brivoPut(token, apiKey, `/groups/${input.groupId}/users/${id}`, {})
    await groupChanged(String(input.groupId))
  }
  return { id }
}

/**
 * Suspend or reactivate a Brivo user. Uses Brivo's dedicated endpoints; if your
 * Brivo instance differs, this is the one call to adjust.
 */
export async function setBrivoUserSuspended(
  token: string,
  apiKey: string,
  userId: string,
  suspended: boolean,
): Promise<{ success: true }> {
  const path = suspended ? `/users/${userId}/suspend` : `/users/${userId}/reactivate`
  await brivoPost(token, apiKey, path, {})
  return { success: true }
}

// ─── Doors / access points ───────────────────────────────────────────────────
export interface BrivoDoor { id: string; name: string }

/** List a site's doors (access points).
 * Each property has its OWN Brivo account, so the account behind these creds
 * contains only this site's access points — no site filter needed (and the
 * /access-points endpoint rejects the users/groups-style `site eq "X"` filter).
 * If a brivoSiteId is provided we still narrow client-side when the access point
 * carries a site id, but never to an empty list. */
export async function listBrivoDoors(token: string, apiKey: string, brivoSiteId?: string): Promise<BrivoDoor[]> {
  const data = await brivoGet(token, apiKey, '/access-points', { pageSize: '100' })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const all = (data.data ?? []) as any[]
  let rows = all
  if (brivoSiteId) {
    const narrowed = all.filter(d => String(d.siteId ?? d.site?.id ?? d.site ?? '') === String(brivoSiteId))
    if (narrowed.length > 0) rows = narrowed   // only narrow if the field actually matched
  }
  return rows.map(d => ({ id: String(d.id), name: d.name ?? 'Door' }))
}

/** Remotely unlock / pulse a door. Sensitive action — callers must confirm. */
export async function unlockBrivoDoor(token: string, apiKey: string, doorId: string, _credentialValue?: string): Promise<{ success: true }> {
  try {
    // Administrative remote unlock: /activate opens the door "at the Administrator's
    // request" and takes NO body. (The /unlock endpoint is a card-holder action that
    // requires a credentialValue and returns "Invalid user" without one — wrong tool
    // for an operator open.) The door must have "Control From Browser" enabled in
    // Brivo's Account Config Tool, and the admin account must have unlock permission.
    await brivoPost(token, apiKey, `/access-points/${doorId}/activate`, {})
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/\(429\)|throttl|too many/i.test(msg)) {
      throw new Error(`Brivo is limiting our requests right now (too many calls) — try again in a minute. (${msg})`)
    }
    if (/\b40[13]\b/.test(msg) || /not allowed|invalid|permission|activat/i.test(msg)) {
      // Keep Brivo's own words — a suspended / throttled key also answers 401/403.
      throw new Error(`Brivo would not open this door. In Brivo’s Account Config Tool, open this Door and check “Control From Browser” (remote activation), and confirm your admin account can unlock it — then retry. Brivo said: ${msg}`)
    }
    throw e
  }
  return { success: true }
}

// ─── Access events (the Brivo activity / event tracker) ──────────────────────
export interface BrivoEvent { id: string; occurred: string | null; action: string; actor: string | null; door: string | null; actor_id?: string | null; credential?: string | null; camera?: boolean }

/** Access log = doors, gates, credentials, people. Brivo's camera / video events
 * (motion, clips, recording, camera on/offline) are left out (Nov 24 2026). */
const CAMERA_EVENT = /\b(camera|video|motion|clip|snapshot|recording|onair|eagle ?eye|stream|analytics?)\b/i
export const isAccessEvent = (e: Pick<BrivoEvent, 'action' | 'camera'>) => !e.camera && !CAMERA_EVENT.test(e.action || '')

/** Recent access events for the account behind these creds (each site = own account). */
export async function listBrivoEvents(token: string, apiKey: string, pageSize = 40, sinceDays = 7): Promise<BrivoEvent[]> {
  // Brivo /events REQUIRES a time window (uuid, occurredAfter, or occurredBefore) —
  // without one it 400s. Default to the last `sinceDays` up to now.
  // Brivo wants ISO 8601 WITHOUT milliseconds (…ssZ). The .000Z form is rejected on some accounts.
  // Brivo also refuses a window longer than 2 days ("Requested Occurred range was
  // longer than days: 2", Nov 23 2026) — so ask in 2-day pieces, newest first, and
  // stop as soon as we have pageSize events.
  const iso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z')
  const CHUNK = 2 * 24 * 60 * 60 * 1000 - 60_000
  const start = Date.now() - Math.max(0, sinceDays) * 24 * 60 * 60 * 1000
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = []
  for (let end = Date.now(); end > start && rows.length < pageSize; end -= CHUNK) {
    const from = Math.max(start, end - CHUNK)
    const data = await brivoGet(token, apiKey, '/events', { pageSize: String(pageSize - rows.length), occurredAfter: iso(new Date(from)), occurredBefore: iso(new Date(end)) })
    rows.push(...((data.data ?? data.events ?? []) as unknown[]))
  }
  return rows.map(mapBrivoEvent)
}

/** One Brivo event row → our shape, with a STABLE id (used as the storage key). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapBrivoEvent(e: any): BrivoEvent {
  // Brivo's event shape varies by event type and API version — read every place a
  // field can be (Nov 24 2026: events were showing a blank user when the name was in
  // eventData / eventObject, or Brivo only sent the user's id).
  const ed = e.eventData ?? e.data ?? {}
  const occurred = e.occurred ?? e.occurredTime ?? e.created ?? e.timestamp ?? null
  const action = e.securityAction?.actionName ?? e.securityAction?.action ?? e.eventType?.name ?? e.action ?? e.actionName ?? ed.actionName ?? e.name ?? 'Access event'
  const full = (o: any) => (o ? (o.name ?? ([o.firstName, o.lastName].filter(Boolean).join(' ') || null)) : null)
  const actor = full(e.actor) ?? full(e.user) ?? ed.actorName ?? ed.userName ?? e.actorName ?? e.credentialHolderName ?? ed.credentialHolderName ?? null
  const actorType = String(e.actor?.type ?? ed.actorType ?? '').toLowerCase()
  const actorIdRaw = e.actor?.id ?? e.user?.id ?? ed.actorId ?? ed.userId ?? e.actorId ?? null
  const actor_id = actorIdRaw != null && (!actorType || /user/.test(actorType)) ? String(actorIdRaw) : null
  const door = e.object?.name ?? e.eventObject?.name ?? e.accessPoint?.name ?? e.door?.name ?? ed.objectName ?? e.objectName ?? null
  const cred = ed.credentialObject ?? ed.credential ?? e.credential ?? (Array.isArray(ed.credentials) ? ed.credentials[0] : null) ?? null
  const credential = cred ? String(cred.reference ?? cred.referenceId ?? cred.value ?? cred.id ?? '') || null : null
  const id = e.id ?? e.eventId ?? e.uuid ?? `${occurred ?? ''}|${action}|${actor ?? ''}|${door ?? ''}`
  const objType = String(e.eventObject?.type ?? e.object?.type ?? ed.objectType ?? '').toLowerCase()
  const camera = /camera|video/.test(objType)
  return { id: String(id), occurred, action, actor: actor ? String(actor).trim() || null : null, door, actor_id, credential, camera }
}

/** What happened when no person is named — so a row never just shows a blank. */
export function noUserLabel(action: string, credential?: string | null): string | null {
  const a = action.toLowerCase()
  if (/request to exit|rex|exit request|egress/.test(a)) return 'Exit button'
  if (/schedule/.test(a)) return 'Schedule'
  if (/held open|left open|ajar/.test(a)) return 'Door held open'
  if (/forced/.test(a)) return 'Door forced open'
  if (/unknown|invalid|not found|unrecognized/.test(a)) return credential ? `Unknown card / code ${credential}` : 'Unknown card / code'
  if (/administrat|remote|activation|activated|control from browser/.test(a)) return 'Remote unlock'
  if (/offline|online|tamper|power|battery|communicat/.test(a)) return 'Device'
  return credential ? `Card / code ${credential}` : null
}

/** A few RAW Brivo events (for checking field names) — the diag view only. */
export async function brivoRawEvents(token: string, apiKey: string, fromMs: number, toMs: number, pageSize = 50): Promise<any[]> {
  const iso = (d: number) => new Date(d).toISOString().replace(/\.\d{3}Z$/, 'Z')
  const data = await brivoGet(token, apiKey, '/events', { pageSize: String(pageSize), occurredAfter: iso(Math.max(fromMs, toMs - 2 * 864e5 + 60_000)), occurredBefore: iso(toMs) })
  return (data.data ?? data.events ?? []) as any[]
}

/** Events between two times, NEWEST FIRST, in Brivo's 2-day windows, paged — with a
 * budget. Brivo pages BY TIME, not by row count: `offset` is a date inside the window
 * and results run newest → oldest from it ("Offset must be between the start and end
 * time, offset is applied from the greatest date…", Nov 23 2026). So each next page
 * asks from the oldest event seen so far; events at that same second come back again
 * and are skipped by id.
 *
 * Nov 24 2026: an account with Brivo's Eagle Eye link logs a "Camera Motion" event
 * every few seconds — ~99% of its events. Reading 30 days at once was hundreds of
 * calls, Brivo throttled the key and every screen stalled. So:
 *  - only ACCESS events come back (camera / video events are read past, not kept);
 *  - it stops at `maxPages` calls or the `deadline`, and says how far back it got
 *    (`reachedFrom`) so the caller can carry on from there next time;
 *  - `bg` sends the calls in the slow background lane (screens go first). */
export async function readBrivoEvents(
  token: string, apiKey: string, fromMs: number, toMs: number,
  opts: { maxPages?: number; deadline?: number; bg?: boolean } = {},
): Promise<{ events: BrivoEvent[]; reachedFrom: number; complete: boolean; pages: number; read: number }> {
  const iso = (d: number) => new Date(d).toISOString().replace(/\.\d{3}Z$/, 'Z')
  const CHUNK = 2 * 24 * 60 * 60 * 1000 - 60_000
  const PAGE = 100
  const maxPages = Math.max(1, opts.maxPages ?? 10)
  const out: BrivoEvent[] = []
  const seen = new Set<string>()
  let pages = 0
  let read = 0
  let reachedFrom = toMs // everything from here up to toMs has been read
  const outOfBudget = () => pages >= maxPages || (opts.deadline != null && Date.now() >= opts.deadline)
  for (let end = toMs; end > fromMs; end -= CHUNK) {
    const start = Math.max(fromMs, end - CHUNK)
    let cursor: number | null = null
    let windowDone = false
    while (!outOfBudget()) {
      const params: Record<string, string> = { pageSize: String(PAGE), occurredAfter: iso(start), occurredBefore: iso(end) }
      if (cursor != null) params.offset = iso(cursor)
      const data = await brivoGet(token, apiKey, '/events', params, { bg: opts.bg })
      pages++
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = ((data.data ?? data.events ?? []) as any[]).map(mapBrivoEvent)
      read += rows.length
      let added = 0
      let oldest = cursor ?? end
      for (const e of rows) {
        const t = e.occurred ? Date.parse(e.occurred) : NaN
        if (!Number.isNaN(t) && t < oldest) oldest = t
        if (seen.has(e.id)) continue
        seen.add(e.id); added++
        if (isAccessEvent(e)) out.push(e)
      }
      // Done with this window: short page, nothing new, or we've reached its start.
      if (rows.length < PAGE || added === 0 || oldest <= start) { windowDone = true; break }
      // Next page from the oldest second we have (Brivo times are whole seconds).
      cursor = Math.max(start, Math.floor(oldest / 1000) * 1000)
      // Everything newer than that second is in hand (that second is re-read next page).
      reachedFrom = Math.min(reachedFrom, cursor + 1000)
    }
    if (!windowDone) return { events: out, reachedFrom, complete: false, pages, read }
    reachedFrom = start
  }
  return { events: out, reachedFrom: fromMs, complete: true, pages, read }
}

/** Old name — every ACCESS event between two times (budget 40 calls). */
export async function listBrivoEventsRange(token: string, apiKey: string, fromMs: number, toMs: number): Promise<BrivoEvent[]> {
  return (await readBrivoEvents(token, apiKey, fromMs, toMs, { maxPages: 40 })).events
}

/** Per-site convenience: recent Brivo access events for a property. */
// Reads the stored 30-day history + a live top-up (lib/brivo-events-store.ts,
// migration 241); falls back to asking Brivo live until 241 has run.
export async function listSiteBrivoEvents(siteId: string, pageSize = 40, days = 7): Promise<BrivoEvent[]> {
  const { recentSiteEvents } = await import('@/lib/brivo-events-store')
  return recentSiteEvents(siteId, { days, limit: pageSize })
}

// ─── Resident credentials / Brivo Mobile Pass ───────────────────────────────
// Lets a dealer fix "I didn't get my mobile pass" without logging into Brivo:
// revoke the old pass + send a fresh one.
//
// NOTE: Brivo Mobile Pass is created via the credentials API. The exact body
// (mobile-pass credential format id) varies by Brivo account — set
// BRIVO_BMP_FORMAT_ID, or confirm the call against the GGSOC implementation.
// These functions are the single spot to adjust.
const BMP_FORMAT_ID = process.env.BRIVO_BMP_FORMAT_ID ? Number(process.env.BRIVO_BMP_FORMAT_ID) : 110
// Physical card/fob credential format id — account-specific (e.g. a 26-bit Wiegand
// format). Set BRIVO_CARD_FORMAT_ID; confirm the value in your Brivo account.
const CARD_FORMAT_ID = process.env.BRIVO_CARD_FORMAT_ID ? Number(process.env.BRIVO_CARD_FORMAT_ID) : 100

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function listBrivoUserCredentials(token: string, apiKey: string, userId: string): Promise<any[]> {
  const data = await brivoGet(token, apiKey, `/users/${userId}/credentials`, { pageSize: '100' })
  return data.data ?? []
}

/** Revoke a credential (delete the mobile pass). */
export async function deleteBrivoCredential(token: string, apiKey: string, credentialId: string): Promise<void> {
  await brivoDelete(token, apiKey, `/credentials/${credentialId}`)
}

/** Resend a Brivo Mobile Pass: revoke existing mobile-pass credentials for the
 * user, then issue + assign a fresh one (Brivo emails the new invite). */
export async function resendBrivoMobilePass(token: string, apiKey: string, userId: string, email: string | null, dates?: { from?: string | null; to?: string | null }): Promise<{ revoked: number }> {
  const creds = await listBrivoUserCredentials(token, apiKey, userId)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const passes = creds.filter((c: any) => /mobile|bmp|pass/i.test(`${c.credentialFormat?.name ?? ''} ${c.fieldName ?? ''} ${c.type ?? ''}`))
  for (const p of passes) { try { await deleteBrivoCredential(token, apiKey, String(p.id)) } catch { /* continue */ } }

  // Issue a new Brivo Mobile Pass — credential keyed to the user's email; Brivo
  // sends the invite. (Confirm format id / shape against your Brivo account.)
  const created = await brivoPost(token, apiKey, '/credentials', {
    credentialFormat: { id: BMP_FORMAT_ID },
    referenceId: email ?? `user-${userId}`,
  })
  const credId = String(created.id ?? created.referenceId ?? '')
  if (credId) {
    // Assign to the user, optionally time-boxed (effective from/to — used for guests).
    const assign: Record<string, unknown> = {}
    if (dates?.from) assign.effectiveFrom = dates.from
    if (dates?.to) assign.effectiveTo = dates.to
    try { await brivoPut(token, apiKey, `/users/${userId}/credentials/${credId}`, assign) } catch { /* assignment best-effort */ }
  }
  return { revoked: passes.length }
}

/** Issue a NEW Brivo Mobile Pass and assign it to the user WITHOUT touching any
 * existing credentials (so a user can hold a pass + a fob at once). Brivo emails
 * the invite. Use resendBrivoMobilePass() instead for the "didn't get it" case. */
export async function issueBrivoMobilePass(token: string, apiKey: string, userId: string, email: string | null): Promise<{ credentialId: string }> {
  const created = await brivoPost(token, apiKey, '/credentials', {
    credentialFormat: { id: BMP_FORMAT_ID },
    referenceId: email ?? `user-${userId}`,
  })
  const credId = String(created.id ?? created.referenceId ?? '')
  if (credId) { try { await brivoPut(token, apiKey, `/users/${userId}/credentials/${credId}`, {}) } catch { /* assignment best-effort */ } }
  return { credentialId: credId }
}

/** Create a physical card/fob credential and assign it to the user. cardNumber is
 * the number stamped on the fob; facilityCode is optional (site-code cards). */
export async function assignBrivoFob(token: string, apiKey: string, userId: string, cardNumber: string, facilityCode?: string | null): Promise<{ credentialId: string }> {
  const body: Record<string, unknown> = { credentialFormat: { id: CARD_FORMAT_ID }, cardNumber: String(cardNumber).trim() }
  if (facilityCode) body.facilityCode = String(facilityCode).trim()
  const created = await brivoPost(token, apiKey, '/credentials', body)
  const credId = String(created.id ?? '')
  if (credId) { try { await brivoPut(token, apiKey, `/users/${userId}/credentials/${credId}`, {}) } catch { /* assignment best-effort */ } }
  return { credentialId: credId }
}

// PIN credential. Brivo represents a keypad PIN as a credential with the account's
// PIN format id. Set BRIVO_PIN_FORMAT_ID to the value in your Brivo account (the
// default 108 is Brivo's common "Unknown Format (PIN)" but varies per account).
const PIN_FORMAT_ID = process.env.BRIVO_PIN_FORMAT_ID ? Number(process.env.BRIVO_PIN_FORMAT_ID) : 108
export async function assignBrivoPin(token: string, apiKey: string, userId: string, pin: string): Promise<{ credentialId: string }> {
  const created = await brivoPost(token, apiKey, '/credentials', {
    credentialFormat: { id: PIN_FORMAT_ID },
    referenceId: `pin-${userId}`,
    encodedCredential: String(pin).trim(),
  })
  const credId = String(created.id ?? '')
  if (credId) { try { await brivoPut(token, apiKey, `/users/${userId}/credentials/${credId}`, {}) } catch { /* assignment best-effort */ } }
  return { credentialId: credId }
}

/** Reversibly turn a single credential off (revoke) or back on (reinstate) —
 * keeps the credential on the user so it stays visible and can be reinstated,
 * unlike deleteBrivoCredential which is permanent. Brivo suspend support is
 * account-dependent; confirm the field name against your account if it 400s. */
export async function setBrivoCredentialSuspended(token: string, apiKey: string, credentialId: string, suspended: boolean): Promise<{ success: true }> {
  await brivoPut(token, apiKey, `/credentials/${credentialId}`, { suspended })
  return { success: true }
}

/** Assign a Brivo user to a group (how Brivo grants site access). */
export async function assignBrivoUserToGroup(token: string, apiKey: string, groupId: string, userId: string): Promise<{ success: true }> {
  await brivoPut(token, apiKey, `/groups/${groupId}/users/${userId}`, {})
  await groupChanged(String(groupId))
  return { success: true }
}

/** Remove a Brivo user from a group (revokes that group's access). */
export async function removeBrivoUserFromGroup(token: string, apiKey: string, groupId: string, userId: string): Promise<{ success: true }> {
  await brivoDelete(token, apiKey, `/groups/${groupId}/users/${userId}`)
  await groupChanged(String(groupId))
  return { success: true }
}

/** The groups a user actually belongs to right now (access assignments). Brivo
 * doesn't reliably expand groupIds on /users, so we ask per-user directly. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getBrivoUserGroups(token: string, apiKey: string, userId: string): Promise<{ id: string; name: string }[]> {
  const data = await brivoGet(token, apiKey, `/users/${userId}/groups`, { pageSize: '100' }).catch(() => ({ data: [] as any[] }))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data.data ?? []) as any[]).map(g => ({ id: String(g.id), name: g.name ?? 'Group' }))
}

/** Fetch a single Brivo user's raw object. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getBrivoUser(token: string, apiKey: string, userId: string): Promise<any> {
  return brivoGet(token, apiKey, `/users/${userId}`)
}

/** Update a Brivo user's name / email / phone. Fetch-merge-PUT so other fields
 * are preserved. Email/phone are stored as arrays — we set the primary entry. */
export async function updateBrivoUser(token: string, apiKey: string, userId: string, changes: { firstName?: string; lastName?: string; email?: string | null; phone?: string | null }): Promise<{ success: true }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cur: any = await getBrivoUser(token, apiKey, userId).catch(() => ({}))
  const body: Record<string, unknown> = {
    firstName: changes.firstName ?? cur.firstName,
    lastName:  changes.lastName ?? cur.lastName,
  }
  if (changes.email !== undefined) body.emails = changes.email ? [{ address: changes.email, email: true }] : []
  if (changes.phone !== undefined) body.phoneNumbers = changes.phone ? [{ number: changes.phone }] : []
  await brivoPut(token, apiKey, `/users/${userId}`, body)
  return { success: true }
}

/** Map a user's credentials to a compact, UI-friendly shape. */
export async function getBrivoUserCredentialSummary(token: string, apiKey: string, userId: string): Promise<Array<{ id: string; label: string; type: string; isPass: boolean; active: boolean; effectiveFrom: string | null; effectiveTo: string | null }>> {
  const creds = await listBrivoUserCredentials(token, apiKey, userId)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (creds as any[]).map(c => {
    const fmt = `${c.credentialFormat?.name ?? ''} ${c.fieldName ?? ''} ${c.type ?? ''}`
    return {
      id: String(c.id),
      label: c.credentialFormat?.name ?? c.type ?? c.referenceId ?? 'Credential',
      type: String(c.type ?? c.credentialFormat?.name ?? 'credential'),
      isPass: /mobile|bmp|pass/i.test(fmt),
      active: c.suspended !== true && c.disabled !== true,
      effectiveFrom: c.effectiveFrom ?? c.effective ?? null,
      effectiveTo: c.expiration ?? c.effectiveTo ?? null,
    }
  })
}

/** Revoke ALL mobile-pass credentials for a user (turns off their pass) without
 * issuing a new one. Returns how many were revoked. */
export async function revokeBrivoMobilePass(token: string, apiKey: string, userId: string): Promise<{ revoked: number }> {
  const creds = await listBrivoUserCredentials(token, apiKey, userId)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const passes = creds.filter((c: any) => /mobile|bmp|pass/i.test(`${c.credentialFormat?.name ?? ''} ${c.fieldName ?? ''} ${c.type ?? ''}`))
  for (const p of passes) { try { await deleteBrivoCredential(token, apiKey, String(p.id)) } catch { /* continue */ } }
  return { revoked: passes.length }
}

/** Raw group rows for a site — pages ALL groups then narrows client-side by any
 * site field present (Brivo's `/groups` endpoint rejects the `site eq "X"` filter
 * with a 400 "Invalid filter format", same as /users). */
async function listBrivoSiteGroupsRaw(token: string, apiKey: string, brivoSiteId: string): Promise<any[]> {
  const out: any[] = []
  let offset = 0
  const pageSize = 100
  while (true) {
    const data = await brivoGet(token, apiKey, '/groups', { pageSize: String(pageSize), offset: String(offset) })
    const page: any[] = data.data ?? []
    out.push(...page)
    if (page.length < pageSize) break
    offset += pageSize
    if (offset > 5000) break
  }
  if (brivoSiteId) {
    const narrowed = out.filter(g => String(g.siteId ?? g.site?.id ?? g.site ?? '') === String(brivoSiteId))
    if (narrowed.length > 0) return narrowed  // only narrow if the field actually matched
  }
  return out
}

/** Group ids for a site — used to narrow the (unfilterable) user list. */
export async function listBrivoSiteGroupIds(token: string, apiKey: string, brivoSiteId: string): Promise<string[]> {
  const groups = await listBrivoSiteGroupsRaw(token, apiKey, brivoSiteId)
  return groups.map(g => String(g.id))
}

/** List the Brivo groups for a site (used for the Add-User access picker). */
export async function listBrivoGroups(
  token: string,
  apiKey: string,
  brivoSiteId: string,
): Promise<{ id: string; name: string }[]> {
  const groups = await listBrivoSiteGroupsRaw(token, apiKey, brivoSiteId)
  return groups.map((g: any) => ({ id: String(g.id), name: g.name ?? 'Group' }))
}
