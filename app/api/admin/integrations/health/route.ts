/**
 * GET /api/admin/integrations/health — corporate-only live health of the
 * ACCOUNT-LEVEL services (as opposed to per-site vendors in ../route.ts).
 *
 * Each service is actually pinged (token refresh / cheap authed call) so the
 * status is real, not just "env var present". Never returns secrets.
 *   status: 'live' — reachable + authenticated
 *           'failed' — configured but the live check failed (bad/expired creds)
 *           'not_configured' — required env / connection missing
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

type Status = 'live' | 'failed' | 'not_configured'
type Check = { key: string; name: string; category: string; status: Status; detail: string; connectPath?: string }

// fetch with a hard timeout so one slow service can't hang the whole page.
async function ping(url: string, init: RequestInit = {}, ms = 6000): Promise<Response | null> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try { return await fetch(url, { ...init, signal: ctrl.signal }) } catch { return null } finally { clearTimeout(t) }
}

const googleId = () => process.env.GOOGLE_CALENDAR_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID
const googleSecret = () => process.env.GOOGLE_CALENDAR_CLIENT_SECRET ?? process.env.GOOGLE_CLIENT_SECRET

async function googleRefreshOk(refreshToken: string): Promise<boolean> {
  const client_id = googleId(), client_secret = googleSecret()
  if (!client_id || !client_secret || !refreshToken) return false
  const res = await ping('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id, client_secret, refresh_token: refreshToken, grant_type: 'refresh_token' }).toString(),
  }, 6000)
  return !!res && res.ok
}

async function checkSupabase(): Promise<Check> {
  try {
    const { error } = await supabase.from('organizations').select('id', { count: 'exact', head: true }).limit(1)
    return { key: 'supabase', name: 'Supabase (database)', category: 'Core', status: error ? 'failed' : 'live', detail: error ? error.message : 'Database reachable' }
  } catch (e) {
    return { key: 'supabase', name: 'Supabase (database)', category: 'Core', status: 'failed', detail: e instanceof Error ? e.message : 'unreachable' }
  }
}

async function checkGoogleCalendar(): Promise<Check> {
  const base = { key: 'gcal', name: 'Google Calendar', category: 'Google', connectPath: '/api/calendar/google/connect' }
  if (!googleId() || !googleSecret()) return { ...base, status: 'not_configured', detail: 'GOOGLE_CALENDAR_CLIENT_ID / _SECRET not set' }
  const { data, count } = await supabase.from('user_settings').select('gcal_refresh_token', { count: 'exact' }).not('gcal_refresh_token', 'is', null).limit(1)
  const n = count ?? 0
  if (n === 0) return { ...base, status: 'not_configured', detail: 'App configured, but no user has connected a calendar yet' }
  const ok = await googleRefreshOk(String(data?.[0]?.gcal_refresh_token ?? ''))
  return { ...base, status: ok ? 'live' : 'failed', detail: ok ? `${n} user${n === 1 ? '' : 's'} connected · token refresh OK` : `${n} connected, but token refresh FAILED (revoked/expired — see note)` }
}

async function checkGmail(): Promise<Check> {
  const base = { key: 'gmail', name: 'Gmail', category: 'Google', connectPath: '/messages/settings' }
  if (!googleId() || !googleSecret()) return { ...base, status: 'not_configured', detail: 'Google OAuth client not set' }
  let data: Record<string, unknown>[] | null = null, count = 0
  const res = await supabase.from('message_channels').select('oauth_refresh_token', { count: 'exact' }).eq('channel_type', 'gmail').not('oauth_refresh_token', 'is', null).limit(1)
  data = res.data as Record<string, unknown>[] | null; count = res.count ?? 0
  if (count === 0) return { ...base, status: 'not_configured', detail: 'App configured, but no Gmail account connected yet' }
  const ok = await googleRefreshOk(String(data?.[0]?.oauth_refresh_token ?? ''))
  return { ...base, status: ok ? 'live' : 'failed', detail: ok ? `${count} account${count === 1 ? '' : 's'} connected · token refresh OK` : `${count} connected, but token refresh FAILED (revoked/expired)` }
}

async function checkQuickBooks(): Promise<Check> {
  const base = { key: 'qbo', name: 'QuickBooks Online', category: 'Finance', connectPath: '/api/integrations/quickbooks/connect' }
  if (!process.env.QBO_CLIENT_ID) return { ...base, status: 'not_configured', detail: 'QBO_CLIENT_ID not set' }
  try {
    const { getQboAuth } = await import('@/lib/qbo')
    const authRes = await getQboAuth()
    // getQboAuth refreshes the stored token; ok === true means live.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const a = authRes as any
    if (a?.ok) return { ...base, status: 'live', detail: `Connected${a.realmId ? ` · realm ${a.realmId}` : ''} · token refresh OK` }
    return { ...base, status: a?.reason === 'not_connected' || /connect/i.test(String(a?.reason)) ? 'not_configured' : 'failed', detail: String(a?.reason ?? 'not connected') }
  } catch (e) {
    return { ...base, status: 'failed', detail: e instanceof Error ? e.message : 'error' }
  }
}

async function checkResend(): Promise<Check> {
  const base = { key: 'resend', name: 'Resend (email)', category: 'Messaging' }
  const key = process.env.RESEND_API_KEY
  if (!key) return { ...base, status: 'not_configured', detail: 'RESEND_API_KEY not set' }
  const res = await ping('https://api.resend.com/domains', { headers: { Authorization: `Bearer ${key}` } }, 6000)
  if (!res) return { ...base, status: 'failed', detail: 'No response (timeout)' }
  return { ...base, status: res.ok ? 'live' : 'failed', detail: res.ok ? 'API key valid' : `API returned ${res.status}` }
}

async function checkStripe(): Promise<Check> {
  const base = { key: 'stripe', name: 'Stripe (payments)', category: 'Finance' }
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return { ...base, status: 'not_configured', detail: 'STRIPE_SECRET_KEY not set' }
  const res = await ping('https://api.stripe.com/v1/balance', { headers: { Authorization: `Bearer ${key}` } }, 6000)
  if (!res) return { ...base, status: 'failed', detail: 'No response (timeout)' }
  return { ...base, status: res.ok ? 'live' : 'failed', detail: res.ok ? 'Secret key valid' : `API returned ${res.status}` }
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user.isCorporate) return NextResponse.json({ error: 'Corporate only' }, { status: 403 })

  const checks = await Promise.all([
    checkSupabase(), checkGoogleCalendar(), checkGmail(), checkQuickBooks(), checkResend(), checkStripe(),
  ])
  return NextResponse.json({ checkedAt: new Date().toISOString(), checks })
}
