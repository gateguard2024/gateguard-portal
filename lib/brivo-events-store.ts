/**
 * lib/brivo-events-store.ts — 30 days of Brivo door events per property (migration 241).
 *
 * Brivo answers at most 2 days per request, so screens can't ask it for a month.
 * Instead the hourly job (inngest/functions/brivo-events-sync.ts) calls
 * syncAllSites(): for each active property with a Brivo login it copies every
 * event since `synced_through` (first time: the last 30 days) into brivo_events,
 * then pruneOld() deletes anything older than 30 days.
 *
 * Screens call recentSiteEvents(): stored events + a live top-up from Brivo for
 * anything after the last sync, newest first. If migration 241 hasn't run, it
 * falls back to asking Brivo live (the old behaviour) — nothing breaks.
 */
import { createClient } from '@supabase/supabase-js'
import { getSiteBrivoToken, listBrivoEventsRange, listBrivoUsers, noUserLabel, type BrivoEvent } from '@/lib/brivo'

// ── Names for events Brivo sent without one ────────────────────────────────
// Some events carry only the user's id (or no person at all). Look the id up in the
// property's Brivo people (kept 30 min per server), and label person-less events by
// what happened (Exit button, Schedule, Unknown card…). Names are saved with the event.
const userNames = new Map<string, { at: number; names: Map<string, string> }>()
async function namesFor(siteId: string): Promise<Map<string, string>> {
  const hit = userNames.get(siteId)
  if (hit && Date.now() - hit.at < 30 * 60_000) return hit.names
  const names = new Map<string, string>()
  try {
    const { token, apiKey, brivoSiteId } = await getSiteBrivoToken(siteId)
    for (const u of await listBrivoUsers(token, apiKey, brivoSiteId)) {
      const n = [u.firstName, u.lastName].filter(Boolean).join(' ').trim()
      if (n) names.set(String(u.id), n)
    }
  } catch (e) { console.error('[brivo-events] user names:', e instanceof Error ? e.message : e) }
  userNames.set(siteId, { at: Date.now(), names })
  return names
}
export async function nameEvents(siteId: string, events: BrivoEvent[]): Promise<BrivoEvent[]> {
  const needIds = events.some(e => !e.actor && e.actor_id)
  const names = needIds ? await namesFor(siteId) : null
  return events.map(e => {
    if (e.actor) return e
    const byId = e.actor_id && names ? names.get(e.actor_id) : undefined
    return { ...e, actor: byId ?? noUserLabel(e.action, e.credential) }
  })
}

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
export const KEEP_DAYS = 30
const DAY = 864e5
const OVERLAP = 10 * 60_000 // re-read the last 10 minutes each run (late events), duplicates are ignored

const missingTable = (msg?: string) => !!msg && /brivo_event|does not exist|schema cache/i.test(msg)

type Row = { brivo_event_id: string; occurred_at: string; action: string | null; actor: string | null; door: string | null }
const toEvent = (r: Row): BrivoEvent => ({ id: r.brivo_event_id, occurred: r.occurred_at, action: r.action ?? 'Access event', actor: r.actor ?? noUserLabel(r.action ?? ''), door: r.door })

/** Save events for a site; duplicates (same Brivo id) are skipped. */
async function store(siteId: string, events: BrivoEvent[]): Promise<{ saved: number; error: string | null }> {
  const rows = events.filter(e => e.occurred).map(e => ({ site_id: siteId, brivo_event_id: e.id, occurred_at: e.occurred!, action: e.action, actor: e.actor, door: e.door }))
  let saved = 0
  for (let i = 0; i < rows.length; i += 500) {
    const part = rows.slice(i, i + 500)
    const { error } = await db().from('brivo_events').upsert(part, { onConflict: 'site_id,brivo_event_id', ignoreDuplicates: true })
    if (error) return { saved, error: error.message }
    saved += part.length
  }
  return { saved, error: null }
}

/** Copy one property's new events. Returns how many were read from Brivo. */
export async function syncSite(siteId: string, now = Date.now()): Promise<{ site_id: string; read: number; error: string | null }> {
  const sb = db()
  const { data: st, error: stErr } = await sb.from('brivo_event_sync').select('synced_through').eq('site_id', siteId).maybeSingle()
  if (stErr) return { site_id: siteId, read: 0, error: stErr.message }
  const floor = now - KEEP_DAYS * DAY
  const from = Math.max(floor, st?.synced_through ? Date.parse(st.synced_through) - OVERLAP : floor)
  let read = 0
  let error: string | null = null
  try {
    const { token, apiKey } = await getSiteBrivoToken(siteId)
    const events = await nameEvents(siteId, await listBrivoEventsRange(token, apiKey, from, now))
    read = events.length
    const r = await store(siteId, events)
    error = r.error
  } catch (e) {
    error = e instanceof Error ? e.message : 'Brivo sync failed'
  }
  const { error: upErr } = await sb.from('brivo_event_sync').upsert({
    site_id: siteId,
    // Only move forward when everything saved — otherwise the next run retries the same window.
    ...(error ? {} : { synced_through: new Date(now).toISOString() }),
    last_run_at: new Date(now).toISOString(), last_count: read, last_error: error, updated_at: new Date().toISOString(),
  }, { onConflict: 'site_id' })
  if (upErr && !error) error = upErr.message
  return { site_id: siteId, read, error }
}

/** Active properties with a Brivo login. */
export async function sitesWithBrivo(): Promise<string[]> {
  const sb = db()
  const { data, error } = await sb.from('site_integrations').select('site_id').eq('vendor', 'brivo')
  if (error) throw new Error(error.message)
  const ids = [...new Set((data ?? []).map(r => String(r.site_id)))]
  if (!ids.length) return []
  const { data: sites, error: sErr } = await sb.from('sites').select('id, status').in('id', ids)
  if (sErr) throw new Error(sErr.message)
  return (sites ?? []).filter(s => !s.status || s.status === 'active').map(s => String(s.id))
}

/** Delete events older than 30 days. */
export async function pruneOld(now = Date.now()): Promise<{ error: string | null }> {
  const { error } = await db().from('brivo_events').delete().lt('occurred_at', new Date(now - KEEP_DAYS * DAY).toISOString())
  return { error: error?.message ?? null }
}

/**
 * Newest events for a property over the last `days` (≤ 30): stored history plus a
 * live top-up since the last sync. Falls back to live Brivo if 241 hasn't run or
 * this property hasn't synced yet.
 */
export async function recentSiteEvents(siteId: string, opts: { days?: number; limit?: number } = {}): Promise<BrivoEvent[]> {
  const days = Math.min(KEEP_DAYS, Math.max(1, opts.days ?? 7))
  const limit = Math.min(2000, Math.max(1, opts.limit ?? 100))
  const now = Date.now()
  const sb = db()
  const { data: st, error: stErr } = await sb.from('brivo_event_sync').select('synced_through').eq('site_id', siteId).maybeSingle()
  if (stErr || !st?.synced_through) {
    if (stErr && !missingTable(stErr.message)) console.error('[brivo-events] sync state read failed:', stErr.message)
    return live(siteId, now - Math.min(days, 2) * DAY, now, limit)
  }
  const since = new Date(now - days * DAY).toISOString()
  const { data, error } = await sb.from('brivo_events').select('brivo_event_id, occurred_at, action, actor, door')
    .eq('site_id', siteId).gte('occurred_at', since).order('occurred_at', { ascending: false }).limit(limit)
  if (error) {
    console.error('[brivo-events] read failed:', error.message)
    return live(siteId, now - Math.min(days, 2) * DAY, now, limit)
  }
  const stored = ((data ?? []) as Row[]).map(toEvent)
  // Top up anything after the last sync (≤ ~1 hour normally; capped at 2 days).
  const after = Math.max(Date.parse(st.synced_through) - OVERLAP, now - 2 * DAY)
  const fresh = after < now ? await live(siteId, after, now, limit).catch(() => [] as BrivoEvent[]) : []
  const seen = new Set<string>()
  return [...fresh, ...stored]
    .filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true })
    .sort((a, b) => String(b.occurred ?? '').localeCompare(String(a.occurred ?? '')))
    .slice(0, limit)
}

async function live(siteId: string, from: number, to: number, limit: number): Promise<BrivoEvent[]> {
  const { token, apiKey } = await getSiteBrivoToken(siteId)
  const events = await nameEvents(siteId, await listBrivoEventsRange(token, apiKey, from, to, Math.max(limit, 200)))
  return events.sort((a, b) => String(b.occurred ?? '').localeCompare(String(a.occurred ?? ''))).slice(0, limit)
}
