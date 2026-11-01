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

/** Events are a dealer / Gate Guard tool. Property (client) and master-agent
 *  logins don't plan events, can't see guest lists and can't send email. */
export const canUseEvents = (u: PortalUser) => signedIn(u) && !u.isClient && !u.isMasterAgent
export const EVENTS_DENIED = 'Events aren’t available for your account.'

/** Company ids the caller can see events for; null = all (corporate). */
export async function eventOrgIds(user: PortalUser): Promise<string[] | null> {
  if (user.isCorporate) return null
  const scope = await resolveOrgScope(user)
  const ids = scope.ids.length ? scope.ids : user.org_id ? [user.org_id] : []
  return ids.length ? ids : [NO_MATCH]
}

export function canSeeEvent(user: PortalUser, orgIds: string[] | null, evt: { org_id?: string | null }) {
  if (!canUseEvents(user)) return false
  if (orgIds === null) return true
  return !!evt.org_id && orgIds.includes(evt.org_id)
}

/** Load the caller + the event, and check access in one go. */
export async function guardEvent(eventId: string): Promise<{ user: PortalUser; event: Record<string, unknown> } | { error: string; status: 401 | 403 | 404 | 500 }> {
  const user = await getCurrentUser()
  if (!signedIn(user)) return { error: 'Unauthorized', status: 401 }
  if (!canUseEvents(user)) return { error: EVENTS_DENIED, status: 403 }
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) return { error: 'Event not found', status: 404 }
  const { data: event, error } = await eventsDb.from('property_events').select('*').eq('id', eventId).maybeSingle()
  if (error) return { error: error.message, status: 500 }
  if (!event) return { error: 'Event not found', status: 404 }
  if (!canSeeEvent(user, await eventOrgIds(user), event)) return { error: 'Event not found', status: 404 }
  return { user, event }
}

/**
 * Check the records an event links to belong to the caller's companies — a
 * site, a sales deal, a starter or own-company plan. Returns an error message,
 * or null when everything is fine. Corporate may link anything.
 */
export async function checkEventLinks(user: PortalUser, links: { site_id?: unknown; opportunity_id?: unknown; template_id?: unknown }): Promise<string | null> {
  const id = (v: unknown) => (typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v) ? v : null)
  for (const [k, v] of Object.entries(links)) if (v != null && v !== '' && !id(v)) return `That ${k.replace('_id', '').replace('opportunity', 'deal')} wasn’t found.`
  const orgIds = await eventOrgIds(user)
  const siteId = id(links.site_id), dealId = id(links.opportunity_id), tplId = id(links.template_id)
  if (tplId) {
    const { data, error } = await eventsDb.from('event_templates').select('org_id').eq('id', tplId).maybeSingle()
    if (error) return error.message
    if (!data || (orgIds && data.org_id != null && !orgIds.includes(data.org_id))) return 'That plan wasn’t found.'
  }
  if (!orgIds) return null
  if (siteId) {
    const { data, error } = await eventsDb.from('sites').select('master_dealer_id, install_dealer_id, service_dealer_id, org_id').eq('id', siteId).maybeSingle()
    if (error) return error.message
    if (!data || ![data.master_dealer_id, data.install_dealer_id, data.service_dealer_id, data.org_id].some(o => o && orgIds.includes(o))) return 'That property wasn’t found.'
  }
  if (dealId) {
    const { data, error } = await eventsDb.from('opportunities').select('dealer_org_id').eq('id', dealId).maybeSingle()
    if (error) return error.message
    if (!data || !data.dealer_org_id || !orgIds.includes(data.dealer_org_id)) return 'That deal wasn’t found.'
  }
  return null
}
