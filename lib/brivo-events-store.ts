/**
 * lib/brivo-events-store.ts — Brivo door events per property (migrations 241 + 243).
 * We KEEP 90 days (Residents flags people with no door use in 60+ days) and fill in
 * the last 30 the first time.
 *
 * Brivo answers at most 2 days per request, so screens can't ask it for a month.
 * Instead the job (inngest/functions/brivo-events-sync.ts, every 15 min) calls
 * syncSite() per property. Each run has a BUDGET of Brivo calls (Nov 24 2026: an
 * account with Brivo's Eagle Eye link logs a camera event every few seconds, and
 * reading 30 days in one go got the key throttled):
 *   1. newest first, everything since `synced_through` → now;
 *   2. with what's left, keep filling older history back from `backfilled_from`
 *      (migration 243) toward 30 days ago — a few thousand events per run, so a
 *      busy property's month fills in over a few hours without hurting screens.
 * Only door / gate events are stored. pruneOld() deletes anything older than 90 days.
 *
 * Screens call recentSiteEvents(): stored events + a live top-up from Brivo for
 * anything after the last sync, newest first. If migration 241 hasn't run, it
 * falls back to asking Brivo live (the old behaviour) — nothing breaks.
 */
import { createClient } from '@supabase/supabase-js'
import { getSiteBrivoToken, readBrivoEvents, listBrivoUsers, noUserLabel, isAccessEvent, type BrivoEvent } from '@/lib/brivo'
import { memo } from '@/lib/memo'

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
export const KEEP_DAYS = 90
export const BACKFILL_DAYS = 30
const DAY = 864e5
const OVERLAP = 10 * 60_000 // re-read the last 10 minutes each run (late events), duplicates are ignored

const missingTable = (msg?: string) => !!msg && /brivo_event|does not exist|schema cache/i.test(msg)

type Row = { brivo_event_id: string; occurred_at: string; action: string | null; actor: string | null; door: string | null }
const toEvent = (r: Row): BrivoEvent => ({ id: r.brivo_event_id, occurred: r.occurred_at, action: r.action ?? 'Access event', actor: r.actor ?? noUserLabel(r.action ?? ''), door: r.door })

/** Save events for a site; duplicates (same Brivo id) are skipped. */
async function store(siteId: string, events: BrivoEvent[]): Promise<{ saved: number; error: string | null }> {
  // Access events only — camera / video events aren't kept (isAccessEvent).
  const rows = events.filter(e => e.occurred && isAccessEvent(e)).map(e => ({ site_id: siteId, brivo_event_id: e.id, occurred_at: e.occurred!, action: e.action, actor: e.actor, door: e.door }))
  let saved = 0
  for (let i = 0; i < rows.length; i += 500) {
    const part = rows.slice(i, i + 500)
    const { error } = await db().from('brivo_events').upsert(part, { onConflict: 'site_id,brivo_event_id', ignoreDuplicates: true })
    if (error) return { saved, error: error.message }
    saved += part.length
  }
  return { saved, error: null }
}

// Per run, per property: Brivo calls (100 events each) and wall time. Background lane
// (~1.4 calls/s, screens always go first).
const RUN_PAGES = Math.max(5, Number(process.env.BRIVO_SYNC_PAGES) || 80)
const RUN_MS = 50_000
const missingColumn = (msg?: string) => !!msg && /backfilled_from/i.test(msg)

/** Copy one property's new events, then fill in older history with what's left. */
export async function syncSite(siteId: string, now = Date.now()): Promise<{ site_id: string; read: number; saved: number; backfilled_from: string | null; error: string | null }> {
  const sb = db()
  let hasBackfill = true
  let st: { synced_through: string | null; backfilled_from?: string | null } | null = null
  {
    const r = await sb.from('brivo_event_sync').select('synced_through, backfilled_from').eq('site_id', siteId).maybeSingle()
    if (r.error && missingColumn(r.error.message)) {
      hasBackfill = false
      const r2 = await sb.from('brivo_event_sync').select('synced_through').eq('site_id', siteId).maybeSingle()
      if (r2.error) return { site_id: siteId, read: 0, saved: 0, backfilled_from: null, error: r2.error.message }
      st = r2.data
    } else if (r.error) return { site_id: siteId, read: 0, saved: 0, backfilled_from: null, error: r.error.message }
    else st = r.data
  }
  const floor = now - BACKFILL_DAYS * DAY
  const deadline = Date.now() + RUN_MS
  let read = 0
  let saved = 0
  let error: string | null = null
  let syncedThrough: number | null = st?.synced_through ? Date.parse(st.synced_through) : null
  // How far back history is complete. Unknown (before 243) → only trust from synced_through.
  let backfilledFrom: number | null = st?.backfilled_from ? Date.parse(st.backfilled_from) : syncedThrough
  try {
    const { token, apiKey } = await getSiteBrivoToken(siteId)
    let pagesLeft = RUN_PAGES
    // 1. New events, newest first.
    const from = syncedThrough != null ? Math.max(floor, syncedThrough - OVERLAP) : floor
    const r1 = await readBrivoEvents(token, apiKey, from, now, { maxPages: pagesLeft, deadline, bg: true })
    pagesLeft -= r1.pages; read += r1.read
    const s1 = await store(siteId, await nameEvents(siteId, r1.events))
    saved += s1.saved
    if (s1.error) throw new Error(s1.error)
    if (r1.complete) {
      syncedThrough = now
      backfilledFrom = backfilledFrom == null ? from : Math.min(backfilledFrom, from)
    } else {
      // Didn't get all the way back this run (first run, or a long outage): what we
      // have is now → reachedFrom; the older part is filled in by step 2 next runs.
      syncedThrough = now
      backfilledFrom = r1.reachedFrom
    }
    // 2. Older history, back toward 30 days ago, with what's left of the budget.
    if (hasBackfill && backfilledFrom != null && backfilledFrom > floor + 60_000 && pagesLeft > 0 && Date.now() < deadline) {
      const r2 = await readBrivoEvents(token, apiKey, floor, backfilledFrom + OVERLAP, { maxPages: pagesLeft, deadline, bg: true })
      read += r2.read
      const s2 = await store(siteId, await nameEvents(siteId, r2.events))
      saved += s2.saved
      if (s2.error) throw new Error(s2.error)
      backfilledFrom = Math.min(backfilledFrom, r2.reachedFrom)
    }
  } catch (e) {
    error = e instanceof Error ? e.message : 'Brivo sync failed'
  }
  const row: Record<string, unknown> = {
    site_id: siteId,
    last_run_at: new Date(now).toISOString(), last_count: read, last_error: error, updated_at: new Date().toISOString(),
  }
  // Only move the markers for what was actually saved (an error mid-way keeps the old ones).
  if (!error && syncedThrough != null) row.synced_through = new Date(syncedThrough).toISOString()
  if (!error && hasBackfill && backfilledFrom != null) row.backfilled_from = new Date(backfilledFrom).toISOString()
  const { error: upErr } = await sb.from('brivo_event_sync').upsert(row, { onConflict: 'site_id' })
  if (upErr && !error) error = upErr.message
  return { site_id: siteId, read, saved, backfilled_from: backfilledFrom != null ? new Date(backfilledFrom).toISOString() : null, error }
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

/** Delete events older than KEEP_DAYS (90). */
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
    .eq('site_id', siteId).gte('occurred_at', since).order('occurred_at', { ascending: false }).limit(limit * 2) // room for camera rows saved before the filter
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
    .filter(e => { if (seen.has(e.id) || !isAccessEvent(e)) return false; seen.add(e.id); return true })
    .sort((a, b) => String(b.occurred ?? '').localeCompare(String(a.occurred ?? '')))
    .slice(0, limit)
}

// Live read for screens: newest first, a few Brivo calls at most, kept 1 min per
// property so every screen open doesn't ask Brivo again.
async function live(siteId: string, from: number, to: number, limit: number): Promise<BrivoEvent[]> {
  const key = `brivo-live:${siteId}:${Math.floor(from / 60_000)}:${limit}`
  return memo(key, 60_000, async () => {
    const { token, apiKey } = await getSiteBrivoToken(siteId)
    const r = await readBrivoEvents(token, apiKey, from, to, { maxPages: 4, deadline: Date.now() + 15_000 })
    const events = await nameEvents(siteId, r.events)
    return events.sort((a, b) => String(b.occurred ?? '').localeCompare(String(a.occurred ?? ''))).slice(0, limit)
  })
}
