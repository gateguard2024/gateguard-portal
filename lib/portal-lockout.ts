/**
 * lib/portal-lockout.ts — wrong-PIN lockout for the property portal sign-ins
 * (shared view code + personal manager PINs). 10 wrong tries in 15 minutes for a
 * portal pauses sign-in for that portal until the window passes. Counted in
 * site_events ('portal_pin_fail') so every server instance sees the same count.
 * A missing site (portal not linked) just isn't limited.
 */
import { createClient } from '@supabase/supabase-js'

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
export const MAX_FAILS = 10
const WINDOW_MS = 15 * 60_000

export async function pinLocked(siteId: string | null | undefined): Promise<boolean> {
  if (!siteId) return false
  const { count, error } = await db().from('site_events').select('id', { count: 'exact', head: true })
    .eq('site_id', siteId).eq('event_type', 'portal_pin_fail').gte('created_at', new Date(Date.now() - WINDOW_MS).toISOString())
  if (error) { console.error('[portal-lockout] count failed:', error.message); return false }
  return (count ?? 0) >= MAX_FAILS
}

export async function recordPinFail(siteId: string | null | undefined, ip: string | null) {
  if (!siteId) return
  const { error } = await db().from('site_events').insert({ site_id: siteId, event_type: 'portal_pin_fail', title: 'Wrong PIN on the property portal', metadata: { ip } })
  if (error) console.error('[portal-lockout] log failed:', error.message)
}

export const LOCKED_MSG = 'Too many wrong PINs — sign-in is paused for 15 minutes. Call Gate Guard if you need in now.'
export const clientIp = (h: Headers) => (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || null
