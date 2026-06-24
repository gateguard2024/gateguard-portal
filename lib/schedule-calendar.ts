// Public booking calendar access — uses the PORTAL's per-user Google OAuth model
// (each user connects their own Gmail; refresh token in user_settings), NOT a
// service account. Resolves the "host" calendar for a public booking and gives
// back a Google access token + the host's Clerk user id.
//
// Host resolution (step 1 = corporate sales rep):
//   1. SCHEDULE_HOST_USER_ID env (a Clerk id whose Gmail is connected), else
//   2. the first user_settings row that has a connected Google Calendar.
// Step 2 (later) will resolve the host from the routed dealer instead.
import { createClient } from '@supabase/supabase-js'
import { getGcalAccessToken } from '@/lib/gcal-sync'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

const DEALER_TIERS = ['master_dealer', 'install_dealer', 'service_dealer', 'sales', 'master_agent']

export type ScheduleHost = { userId: string; token: string; hostName: string | null; routedToDealer: boolean }

/**
 * Resolve the calendar host for a public booking.
 * Step 2: if the prospect gives a ZIP, route to the NEAREST dealer (same region by
 * ZIP proximity) that has a user with a connected Google Calendar. Falls back to the
 * corporate sales rep (SCHEDULE_HOST_USER_ID, else first connected user).
 */
export async function getScheduleHost(loc?: { zip?: string; state?: string }): Promise<ScheduleHost | { error: string }> {
  const supabase = db()

  // All users who have connected Google Calendar.
  const { data: connected } = await supabase.from('user_settings')
    .select('user_id, gcal_refresh_token').not('gcal_refresh_token', 'is', null)
  if (!connected?.length) {
    return { error: 'No sales/dealer calendar is connected yet. A rep needs to connect Google Calendar in the portal first.' }
  }
  const refreshByUser: Record<string, string> = {}
  for (const c of connected) if (c.user_id && c.gcal_refresh_token) refreshByUser[c.user_id] = c.gcal_refresh_token

  const auth = async (userId: string, hostName: string | null, routed: boolean): Promise<ScheduleHost | { error: string }> => {
    const { token, error } = await getGcalAccessToken(refreshByUser[userId])
    if (!token) return { error: error ?? 'Could not authorize the calendar.' }
    return { userId, token, hostName, routedToDealer: routed }
  }

  // ── Dealer routing by ZIP/state ────────────────────────────────────────────
  const prospectZip = parseInt((loc?.zip || '').replace(/\D/g, ''), 10)
  if (loc?.zip || loc?.state) {
    // Map each connected user → their org.
    const { data: profs } = await supabase.from('profiles')
      .select('clerk_user_id, org_id').in('clerk_user_id', Object.keys(refreshByUser))
    const userByOrg: Record<string, string> = {}
    for (const p of profs ?? []) if (p.org_id && p.clerk_user_id && !userByOrg[p.org_id]) userByOrg[p.org_id] = p.clerk_user_id

    const orgIds = Object.keys(userByOrg)
    if (orgIds.length) {
      const { data: dealers } = await supabase.from('organizations')
        .select('id, name, state, zip').in('id', orgIds).in('tier', DEALER_TIERS).neq('status', 'inactive')
      const ranked = (dealers ?? []).map(d => {
        const dz = parseInt((d.zip || '').replace(/\D/g, ''), 10)
        const sameState = loc?.state && d.state && d.state.toUpperCase() === loc.state.toUpperCase()
        const zipDist = (!isNaN(prospectZip) && !isNaN(dz)) ? Math.abs(prospectZip - dz) : 99999
        return { d, score: (sameState ? 0 : 100000) + zipDist }
      }).sort((a, b) => a.score - b.score)
      if (ranked.length) {
        const best = ranked[0].d
        const h = await auth(userByOrg[best.id], best.name, true)
        if (!('error' in h)) return h   // dealer host found; else fall through to corporate
      }
    }
  }

  // ── Corporate fallback ──────────────────────────────────────────────────────
  const envId = process.env.SCHEDULE_HOST_USER_ID
  if (envId && refreshByUser[envId]) return auth(envId, 'GateGuard', false)
  const firstUser = Object.keys(refreshByUser)[0]
  return auth(firstUser, 'GateGuard', false)
}

const CAL = 'https://www.googleapis.com/calendar/v3'

/** Busy blocks on the host's primary calendar between two ISO instants. */
export async function getBusy(token: string, timeMinISO: string, timeMaxISO: string, timeZone: string): Promise<{ start: string; end: string }[]> {
  const res = await fetch(`${CAL}/freeBusy`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ timeMin: timeMinISO, timeMax: timeMaxISO, timeZone, items: [{ id: 'primary' }] }),
  })
  if (!res.ok) throw new Error(`freeBusy ${res.status}`)
  const j = await res.json() as { calendars?: { primary?: { busy?: { start: string; end: string }[] } } }
  return j.calendars?.primary?.busy ?? []
}

/** Create an event on the host's primary calendar; returns the htmlLink. */
export async function insertEvent(token: string, body: unknown): Promise<{ htmlLink?: string; id?: string }> {
  const res = await fetch(`${CAL}/calendars/primary/events?sendUpdates=all`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`events.insert ${res.status}: ${(await res.text()).slice(0, 160)}`)
  return res.json()
}
