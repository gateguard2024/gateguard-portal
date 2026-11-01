/**
 * Who can see / change a property event.
 *   Gate Guard corporate → every event.
 *   Everyone else        → events owned by one of their companies (their org and,
 *                          for master dealers, the companies under them). Events
 *                          with no company (Gate Guard's own) are corporate-only.
 * Signed-out callers get nothing — getCurrentUser() never returns null, it returns
 * an "anonymous" user, so `if (!user)` checks are not enough.
 */
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser, type PortalUser } from '@/lib/current-user'
import { resolveOrgScope } from '@/lib/org-scope'

export const eventsDb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const NO_MATCH = '00000000-0000-0000-0000-000000000000'

export const signedIn = (u: PortalUser) => !!u.id && u.id !== 'anonymous'

/** Company ids the caller can see events for; null = all (corporate). */
export async function eventOrgIds(user: PortalUser): Promise<string[] | null> {
  if (user.isCorporate) return null
  const scope = await resolveOrgScope(user)
  const ids = scope.ids.length ? scope.ids : user.org_id ? [user.org_id] : []
  return ids.length ? ids : [NO_MATCH]
}

export function canSeeEvent(user: PortalUser, orgIds: string[] | null, evt: { org_id?: string | null }) {
  if (!signedIn(user)) return false
  if (orgIds === null) return true
  return !!evt.org_id && orgIds.includes(evt.org_id)
}

/** Load the caller + the event, and check access in one go. */
export async function guardEvent(eventId: string): Promise<{ user: PortalUser; event: Record<string, unknown> } | { error: string; status: 401 | 403 | 404 | 500 }> {
  const user = await getCurrentUser()
  if (!signedIn(user)) return { error: 'Unauthorized', status: 401 }
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) return { error: 'Event not found', status: 404 }
  const { data: event, error } = await eventsDb.from('property_events').select('*').eq('id', eventId).maybeSingle()
  if (error) return { error: error.message, status: 500 }
  if (!event) return { error: 'Event not found', status: 404 }
  if (!canSeeEvent(user, await eventOrgIds(user), event)) return { error: 'Event not found', status: 404 }
  return { user, event }
}
