/**
 * lib/finance-auth.ts — SERVER ONLY. The second lock on Admin → Finance.
 *
 * Who gets in (all three, checked on every request):
 *   1. Gate Guard corporate (org_tier = 'corporate') AND Clerk role 'admin'
 *   2. An active row in finance_access (a code the owner set for them)
 *   3. A live Finance session cookie (gg_fin) from entering that code
 *
 * Codes: 6 digits, scrypt-hashed with a per-person salt. 5 wrong tries locks
 * that person out for 30 minutes and is logged. Sessions are signed with a key
 * derived from CREDENTIALS_ENC_KEY, expire after finance_settings.idle_minutes
 * without use (every request slides the window), and die at once when the person
 * locks Finance or the owner resets their code (session_nonce changes).
 *
 * Owners (env FINANCE_OWNER_EMAILS, comma-separated; default rfeldman@gateguard.co)
 * are the only people who can set, reset or remove other people's codes. An owner
 * with no code yet may set their own first code without unlocking.
 */
import crypto from 'crypto'
import { clerkClient } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import type { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, type PortalUser } from '@/lib/current-user'

export const FIN_COOKIE = 'gg_fin'
const MAX_TRIES = 5
const LOCK_MINUTES = 30

export const fdb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// ── Who ──────────────────────────────────────────────────────────────────────
export function financeOwnerEmails(): string[] {
  const raw = process.env.FINANCE_OWNER_EMAILS || 'rfeldman@gateguard.co'
  return raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
}
/** Corporate + admin role. Everyone else never sees Finance at all. */
export const isFinanceEligible = (u: PortalUser) => u.isCorporate && u.role === 'admin'
export const isFinanceOwner = (u: PortalUser) => isFinanceEligible(u) && financeOwnerEmails().includes(u.email.toLowerCase())

// ── Codes ────────────────────────────────────────────────────────────────────
export const validCode = (code: unknown): code is string => typeof code === 'string' && /^\d{6}$/.test(code)

export function hashCode(code: string): string {
  const salt = crypto.randomBytes(16)
  const hash = crypto.scryptSync(code, salt, 32, { N: 16384, r: 8, p: 1 })
  return `s1:${salt.toString('base64')}:${hash.toString('base64')}`
}
function codeMatches(code: string, stored: string): boolean {
  const [v, saltB64, hashB64] = String(stored).split(':')
  if (v !== 's1' || !saltB64 || !hashB64) return false
  const want = Buffer.from(hashB64, 'base64')
  const got = crypto.scryptSync(code, Buffer.from(saltB64, 'base64'), want.length, { N: 16384, r: 8, p: 1 })
  return got.length === want.length && crypto.timingSafeEqual(got, want)
}
const newNonce = () => crypto.randomBytes(12).toString('base64url')

// ── Session token: <uid>.<nonce>.<expMs>.<sig> (all base64url) ────────────────
function sessionKey(): Buffer {
  const k = process.env.CREDENTIALS_ENC_KEY
  if (!k) throw new Error('CREDENTIALS_ENC_KEY env var is not set — required for Finance sessions.')
  return crypto.createHash('sha256').update(`gg-finance-session:${k}`, 'utf8').digest()
}
const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64url')
const unb64 = (s: string) => Buffer.from(s, 'base64url').toString('utf8')
function sign(body: string): string {
  return crypto.createHmac('sha256', sessionKey()).update(body).digest('base64url')
}
function makeToken(uid: string, nonce: string, expMs: number): string {
  const body = `${b64(uid)}.${nonce}.${expMs}`
  return `${body}.${sign(body)}`
}
function readToken(token: string | undefined): { uid: string; nonce: string; exp: number } | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 4) return null
  const [u, nonce, expS, sig] = parts
  const body = `${u}.${nonce}.${expS}`
  const want = sign(body)
  if (sig.length !== want.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null
  const exp = Number(expS)
  if (!isFinite(exp)) return null
  try { return { uid: unb64(u), nonce, exp } } catch { return null }
}

export function setSessionCookie(res: NextResponse, token: string, idleMinutes: number) {
  res.cookies.set(FIN_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: idleMinutes * 60 })
}
export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(FIN_COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 0 })
}

// ── DB helpers ───────────────────────────────────────────────────────────────
export interface AccessRow {
  clerk_user_id: string; email: string; name: string | null; code_hash: string; active: boolean
  failed_attempts: number; locked_until: string | null; session_nonce: string; last_unlock_at: string | null
}
async function getAccess(uid: string): Promise<AccessRow | null> {
  const { data, error } = await fdb().from('finance_access').select('*').eq('clerk_user_id', uid).maybeSingle()
  if (error) throw new Error(error.message)
  return (data as AccessRow) ?? null
}
export async function idleMinutes(): Promise<number> {
  const { data } = await fdb().from('finance_settings').select('idle_minutes').eq('id', 1).maybeSingle()
  const n = Number(data?.idle_minutes)
  return n >= 5 && n <= 60 ? n : 15
}
export function clientIp(req: NextRequest): string | null {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null
}
export async function audit(entry: { user?: PortalUser | null; action: string; target?: string | null; detail?: unknown; ip?: string | null }) {
  const { error } = await fdb().from('finance_audit').insert({
    clerk_user_id: entry.user?.id ?? null, email: entry.user?.email ?? null, action: entry.action,
    target: entry.target ?? null, detail: entry.detail ?? null, ip: entry.ip ?? null,
  })
  if (error) console.error('[finance] audit write failed', error.message)
}

// ── Status (for the page: locked / unlocked / no code yet) ───────────────────
export type FinanceStatus =
  | { state: 'not_allowed' }
  | { state: 'no_code'; owner: boolean }
  | { state: 'locked_out'; until: string; owner: boolean }
  | { state: 'locked'; owner: boolean }
  | { state: 'unlocked'; owner: boolean; expires_at: string; idle_minutes: number }

export async function financeStatus(req: NextRequest): Promise<{ status: FinanceStatus; user: PortalUser; access: AccessRow | null }> {
  const user = await getCurrentUser()
  if (!isFinanceEligible(user)) return { status: { state: 'not_allowed' }, user, access: null }
  const owner = isFinanceOwner(user)
  const access = await getAccess(user.id)
  if (!access || !access.active) return { status: { state: 'no_code', owner }, user, access }
  if (access.locked_until && new Date(access.locked_until).getTime() > Date.now()) return { status: { state: 'locked_out', until: access.locked_until, owner }, user, access }
  const tok = readToken(req.cookies.get(FIN_COOKIE)?.value)
  if (!tok || tok.uid !== user.id || tok.nonce !== access.session_nonce || tok.exp <= Date.now()) return { status: { state: 'locked', owner }, user, access }
  const idle = await idleMinutes()
  return { status: { state: 'unlocked', owner, expires_at: new Date(tok.exp).toISOString(), idle_minutes: idle }, user, access }
}

// ── The gate every Finance data route calls first ─────────────────────────────
export type FinanceGate =
  | { ok: true; user: PortalUser; owner: boolean; token: string; idle: number }
  | { ok: false; status: number; error: string; state?: FinanceStatus['state'] }

export async function requireFinance(req: NextRequest): Promise<FinanceGate> {
  const { status, user, access } = await financeStatus(req)
  if (status.state === 'not_allowed') return { ok: false, status: 403, error: 'Finance is for Gate Guard senior admins only.', state: status.state }
  if (status.state !== 'unlocked' || !access) return { ok: false, status: 401, error: 'Finance is locked — enter your code.', state: status.state }
  // Slide the idle window: a fresh token for every request that passes.
  const token = makeToken(user.id, access.session_nonce, Date.now() + status.idle_minutes * 60_000)
  return { ok: true, user, owner: status.owner, token, idle: status.idle_minutes }
}

// ── Unlock / lock ─────────────────────────────────────────────────────────────
export type UnlockResult =
  | { ok: true; token: string; idle: number }
  | { ok: false; status: number; error: string; locked_until?: string; tries_left?: number }

export async function unlock(user: PortalUser, code: unknown, ip: string | null): Promise<UnlockResult> {
  if (!isFinanceEligible(user)) return { ok: false, status: 403, error: 'Finance is for Gate Guard senior admins only.' }
  if (!validCode(code)) return { ok: false, status: 400, error: 'Enter your 6-digit code.' }
  const access = await getAccess(user.id)
  if (!access || !access.active) return { ok: false, status: 403, error: 'You don’t have a Finance code yet. Ask the owner to set one.' }
  if (access.locked_until && new Date(access.locked_until).getTime() > Date.now()) {
    return { ok: false, status: 423, error: 'Too many wrong tries. Finance is locked for you for now.', locked_until: access.locked_until }
  }
  const db = fdb()
  if (!codeMatches(code, access.code_hash)) {
    const tries = (access.failed_attempts ?? 0) + 1
    if (tries >= MAX_TRIES) {
      const until = new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString()
      const { error } = await db.from('finance_access').update({ failed_attempts: 0, locked_until: until, session_nonce: newNonce(), updated_at: new Date().toISOString() }).eq('clerk_user_id', user.id)
      if (error) return { ok: false, status: 500, error: error.message }
      await audit({ user, action: 'locked_out', detail: { minutes: LOCK_MINUTES }, ip })
      return { ok: false, status: 423, error: `Too many wrong tries. Finance is locked for you for ${LOCK_MINUTES} minutes.`, locked_until: until }
    }
    const { error } = await db.from('finance_access').update({ failed_attempts: tries, updated_at: new Date().toISOString() }).eq('clerk_user_id', user.id)
    if (error) return { ok: false, status: 500, error: error.message }
    await audit({ user, action: 'unlock_failed', detail: { tries }, ip })
    return { ok: false, status: 401, error: 'That code isn’t right.', tries_left: MAX_TRIES - tries }
  }
  const { error } = await db.from('finance_access').update({ failed_attempts: 0, locked_until: null, last_unlock_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('clerk_user_id', user.id)
  if (error) return { ok: false, status: 500, error: error.message }
  await audit({ user, action: 'unlock', ip })
  const idle = await idleMinutes()
  return { ok: true, token: makeToken(user.id, access.session_nonce, Date.now() + idle * 60_000), idle }
}

/** Lock now: the current session (and any other copy of it) stops working. */
export async function lock(user: PortalUser, ip: string | null): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await getAccess(user.id)
  if (!access) return { ok: true }
  const { error } = await fdb().from('finance_access').update({ session_nonce: newNonce(), updated_at: new Date().toISOString() }).eq('clerk_user_id', user.id)
  if (error) return { ok: false, error: error.message }
  await audit({ user, action: 'lock', ip })
  return { ok: true }
}

// ── Owner: set / reset / remove codes ────────────────────────────────────────
async function findCorporateAdmin(email: string): Promise<{ ok: true; id: string; email: string; name: string } | { ok: false; error: string }> {
  const clerk = await clerkClient()
  const list = await clerk.users.getUserList({ emailAddress: [email], limit: 2 })
  const u = list.data?.[0]
  if (!u) return { ok: false, error: 'No Nexus user has that email.' }
  const meta = (u.publicMetadata ?? {}) as { org_tier?: string; role?: string }
  if (meta.org_tier !== 'corporate' || meta.role !== 'admin') return { ok: false, error: 'Only Gate Guard corporate admins can have a Finance code.' }
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || email
  return { ok: true, id: u.id, email: u.emailAddresses[0]?.emailAddress ?? email, name }
}

export async function setCode(owner: PortalUser, email: string, code: unknown, ip: string | null): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (!validCode(code)) return { ok: false, status: 400, error: 'The code must be exactly 6 digits.' }
  if (/^(\d)\1{5}$/.test(code) || '0123456789'.includes(code) || '9876543210'.includes(code)) return { ok: false, status: 400, error: 'Pick a less obvious code (no 111111 or 123456).' }
  const target = await findCorporateAdmin(email.trim().toLowerCase())
  if (!target.ok) return { ok: false, status: 400, error: target.error }
  const existing = await getAccess(target.id)
  const now = new Date().toISOString()
  const { error } = await fdb().from('finance_access').upsert({
    clerk_user_id: target.id, email: target.email, name: target.name, code_hash: hashCode(code), active: true,
    failed_attempts: 0, locked_until: null, session_nonce: newNonce(), set_by: owner.id, updated_at: now,
  }, { onConflict: 'clerk_user_id' })
  if (error) return { ok: false, status: 500, error: error.message }
  await audit({ user: owner, action: existing ? 'code_reset' : 'code_set', target: target.email, ip })
  return { ok: true }
}

export async function removeCode(owner: PortalUser, email: string, ip: string | null): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  // Match the email exactly (case-insensitive) in code — ilike would treat _ and % as wildcards.
  const want = email.trim().toLowerCase()
  const { data: rows, error: readErr } = await fdb().from('finance_access').select('clerk_user_id, email')
  if (readErr) return { ok: false, status: 500, error: readErr.message }
  const row = (rows ?? []).find(r => String(r.email).toLowerCase() === want)
  if (!row) return { ok: false, status: 404, error: 'Nobody with that email has a Finance code.' }
  const { error } = await fdb().from('finance_access').update({ active: false, session_nonce: newNonce(), updated_at: new Date().toISOString() }).eq('clerk_user_id', row.clerk_user_id)
  if (error) return { ok: false, status: 500, error: error.message }
  await audit({ user: owner, action: 'code_removed', target: email.trim().toLowerCase(), ip })
  return { ok: true }
}

export async function listAccess(): Promise<{ email: string; name: string | null; active: boolean; last_unlock_at: string | null; locked_until: string | null }[]> {
  const { data, error } = await fdb().from('finance_access').select('email, name, active, last_unlock_at, locked_until').order('email')
  if (error) throw new Error(error.message)
  return data ?? []
}
