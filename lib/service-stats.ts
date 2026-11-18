/**
 * Service stats — visits, hours on site, parts, return trips — per property,
 * per tech, and a network "what to expect" benchmark for dealers.
 *
 * Definitions (keep them here, one place):
 *  - Visit        = one finished time-on-site entry (arrive → leave) on a job.
 *  - Job          = a completed work order (completed_at in the window).
 *  - Hours        = sum of visit minutes ÷ 60.
 *  - Return trip  = a completed job at the same OPENING (gate/door, migration 233)
 *                   as a completed job closed in the 30 days before it was opened —
 *                   the first fix didn't hold. Jobs with no opening (older jobs,
 *                   "Whole property / other", properties without openings) are
 *                   compared with each other at the property level.
 *  - First-time fix (tech) = their job was done in one visit day AND no return trip
 *                   at that opening in the 30 days after.
 *  - On time      = first arrival on or before the job's scheduled day (ET).
 *  - Parts        = work_order_parts not marked 'returned'; cost = qty × unit_cost.
 */
import { createClient } from '@supabase/supabase-js'

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const DAY = 86_400_000
const RETURN_WINDOW = 30 * DAY

export type WO = { id: string; opening_id?: string | null; site_id: string | null; assignee_id: string | null; assignee_name: string | null; status: string | null; completed_at: string | null; created_at: string | null; scheduled_date: string | null }
export type TE = { work_order_id: string; technician_id: string | null; technician_name: string | null; clock_in: string; clock_out: string | null; duration_mins: number | null }
export type PT = { work_order_id: string; qty: number | null; unit_cost: number | null; action: string | null }

const etDay = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
function byJob<T extends { work_order_id: string }>(rows: T[]) { const m = new Map<string, T[]>(); for (const r of rows) (m.get(r.work_order_id) ?? m.set(r.work_order_id, []).get(r.work_order_id)!).push(r); return m }
const r1 = (n: number) => Math.round(n * 10) / 10
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null)

// Supabase caps a select at 1,000 rows — page through.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function pageAll<T>(build: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: { message: string } | null }>, max = 20000): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; from < max; from += 1000) {
    const { data, error } = await build(from, from + 999)
    if (error) throw new Error(error.message)
    out.push(...((data ?? []) as T[]))
    if (!data || data.length < 1000) break
  }
  return out
}
async function inChunks<T>(table: string, cols: string, col: string, ids: string[]): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; i < ids.length; i += 200) {
    const part = ids.slice(i, i + 200)
    out.push(...(await pageAll<T>((f, t) => db().from(table).select(cols).in(col, part).range(f, t))))
  }
  return out
}

/** Completed jobs (completed_at ≥ since), with their visits and parts. */
export async function loadWork(filter: { siteIds?: string[]; orgIds?: string[] | 'all'; since: Date }) {
  const cols = await woCols()
  let jobs: WO[] = []
  if (filter.siteIds) {
    if (filter.siteIds.length) jobs = (await inChunks<WO>('work_orders', cols, 'site_id', filter.siteIds)).filter((w) => w.completed_at && w.completed_at >= filter.since.toISOString())
  } else {
    jobs = await pageAll<WO>((f, t) => {
      let q = db().from('work_orders').select(cols).not('completed_at', 'is', null).gte('completed_at', filter.since.toISOString()).order('completed_at', { ascending: true }).range(f, t)
      if (filter.orgIds && filter.orgIds !== 'all') q = filter.orgIds.length ? q.in('org_id', filter.orgIds) : q.eq('id', '00000000-0000-0000-0000-000000000000')
      return q
    })
  }
  jobs = jobs.filter((w) => !/cancel|delet/i.test(String(w.status ?? '')))
  const ids = jobs.map((w) => w.id)
  const [visits, parts] = await Promise.all([
    inChunks<TE>('work_order_time_entries', 'work_order_id, technician_id, technician_name, clock_in, clock_out, duration_mins', 'work_order_id', ids),
    inChunks<PT>('work_order_parts', 'work_order_id, qty, unit_cost, action', 'work_order_id', ids),
  ])
  return { jobs, visits: visits.filter((v) => v.clock_out), parts: parts.filter((p) => p.action !== 'returned') }
}

/** Where a repeat is judged: the opening when the job names one, else the property. */
export const spotOf = (j: WO) => (j.opening_id ? `o:${j.opening_id}` : j.site_id ? `s:${j.site_id}` : null)

let hasOpeningCol: boolean | null = null
async function woCols() {
  const base = 'id, site_id, assignee_id, assignee_name, status, completed_at, created_at, scheduled_date'
  if (hasOpeningCol === null) { const { error } = await db().from('work_orders').select('opening_id').limit(1); hasOpeningCol = !error }
  return hasOpeningCol ? `${base}, opening_id` : base
}

/** Ids of jobs that were a return trip (same property, a completed job in the 30 days before it was opened). */
export function returnTrips(jobs: WO[]): Set<string> {
  const bySite = new Map<string, WO[]>()
  for (const j of jobs) { const k = spotOf(j); if (k && j.completed_at) (bySite.get(k) ?? bySite.set(k, []).get(k)!).push(j) }
  const out = new Set<string>()
  for (const list of Array.from(bySite.values())) {
    list.sort((a, b) => a.completed_at!.localeCompare(b.completed_at!))
    for (const j of list) {
      const opened = new Date(j.created_at ?? j.completed_at!).getTime()
      if (list.some((p) => p.id !== j.id && new Date(p.completed_at!).getTime() <= opened && opened - new Date(p.completed_at!).getTime() <= RETURN_WINDOW)) out.add(j.id)
    }
  }
  return out
}

function totals(jobs: WO[], visits: TE[], parts: PT[], since: number, returns: Set<string>) {
  const js = jobs.filter((j) => new Date(j.completed_at!).getTime() >= since)
  const ids = new Set(js.map((j) => j.id))
  const vs = visits.filter((v) => ids.has(v.work_order_id))
  const ps = parts.filter((p) => ids.has(p.work_order_id))
  const mins = vs.reduce((s, v) => s + (v.duration_mins ?? 0), 0)
  const vIds = new Set(vs.map((v) => v.work_order_id))
  return {
    jobs: js.length,
    visits: vs.length,
    hours: r1(mins / 60),
    avg_visit_mins: vs.length ? Math.round(mins / vs.length) : null,
    parts: ps.reduce((s, p) => s + (Number(p.qty) || 1), 0),
    parts_cost: Math.round(ps.reduce((s, p) => s + (Number(p.qty) || 1) * (Number(p.unit_cost) || 0), 0)),
    return_trips: js.filter((j) => returns.has(j.id)).length,
    jobs_without_time: js.filter((j) => !vIds.has(j.id)).length,
  }
}

/** One property: month / 90 days / 12 months, last visit, return trips. */
export async function siteStats(siteId: string) {
  const now = Date.now()
  const { jobs, visits, parts } = await loadWork({ siteIds: [siteId], since: new Date(now - 365 * DAY) })
  const returns = returnTrips(jobs)
  const last = visits.reduce<string | null>((m, v) => (!m || v.clock_out! > m ? v.clock_out! : m), null)
  return {
    month: totals(jobs, visits, parts, now - 30 * DAY, returns),
    d90: totals(jobs, visits, parts, now - 90 * DAY, returns),
    year: totals(jobs, visits, parts, now - 365 * DAY, returns),
    by_opening: byOpening(jobs, visits, parts, returns),
    last_visit: last,
    last_job_at: jobs.length ? jobs[jobs.length - 1].completed_at : null,
    recent: jobs.slice(-6).reverse().map((j) => {
      const vs = visits.filter((v) => v.work_order_id === j.id)
      return { id: j.id, opening_id: j.opening_id ?? null, completed_at: j.completed_at, tech: j.assignee_name, visits: vs.length, mins: vs.reduce((s, v) => s + (v.duration_mins ?? 0), 0), return_trip: returns.has(j.id) }
    }),
  }
}

/** 12-month totals per opening (+ "Whole property / other" and jobs with no opening set). */
function byOpening(jobs: WO[], visits: TE[], parts: PT[], returns: Set<string>) {
  const vBy = byJob(visits), pBy = byJob(parts)
  const m = new Map<string, { opening_id: string | null; jobs: number; visits: number; mins: number; parts_cost: number; return_trips: number; last_visit: string | null }>()
  for (const j of jobs) {
    const key = j.opening_id ?? '_none'
    const r = m.get(key) ?? m.set(key, { opening_id: j.opening_id ?? null, jobs: 0, visits: 0, mins: 0, parts_cost: 0, return_trips: 0, last_visit: null }).get(key)!
    r.jobs++; if (returns.has(j.id)) r.return_trips++
    for (const v of vBy.get(j.id) ?? []) { r.visits++; r.mins += v.duration_mins ?? 0; if (!r.last_visit || v.clock_out! > r.last_visit) r.last_visit = v.clock_out }
    for (const p of pBy.get(j.id) ?? []) r.parts_cost += (Number(p.qty) || 1) * (Number(p.unit_cost) || 0)
  }
  return Array.from(m.values()).map((r) => ({ ...r, hours: r1(r.mins / 60), parts_cost: Math.round(r.parts_cost) }))
}

/** Per tech over the last `days` (default 90). */
export async function techStats(orgIds: string[] | 'all', days = 90) {
  const now = Date.now()
  const since = now - days * DAY
  // Load an extra 30 days on both sides of the window so return trips are judged fairly.
  const { jobs, visits, parts } = await loadWork({ orgIds, since: new Date(since - 30 * DAY) })
  const returns = returnTrips(jobs)
  const inWin = jobs.filter((j) => new Date(j.completed_at!).getTime() >= since)
  const bySiteLater = (j: WO) => jobs.some((o) => o.id !== j.id && spotOf(o) !== null && spotOf(o) === spotOf(j) && returns.has(o.id) && new Date(o.created_at ?? o.completed_at!).getTime() >= new Date(j.completed_at!).getTime() && new Date(o.created_at ?? o.completed_at!).getTime() - new Date(j.completed_at!).getTime() <= RETURN_WINDOW)

  const vByJob = byJob(visits), pByJob = byJob(parts)
  type Acc = { id: string; name: string | null; jobs: number; mins: number; visits: number; ftf: number; ftfJudged: number; onTime: number; onTimeJudged: number; parts: number }
  const acc = new Map<string, Acc>()
  const get = (id: string, name: string | null) => acc.get(id) ?? acc.set(id, { id, name, jobs: 0, mins: 0, visits: 0, ftf: 0, ftfJudged: 0, onTime: 0, onTimeJudged: 0, parts: 0 }).get(id)!

  for (const j of inWin) {
    if (!j.assignee_id) continue
    const a = get(j.assignee_id, j.assignee_name)
    a.jobs++
    const vs = vByJob.get(j.id) ?? []
    const daysOnSite = new Set(vs.map((v) => etDay(v.clock_in))).size
    // Only judge first-time fix once the 30-day look-ahead has passed (or a return already happened).
    const later = bySiteLater(j)
    if (later || now - new Date(j.completed_at!).getTime() >= RETURN_WINDOW) { a.ftfJudged++; if (daysOnSite <= 1 && !later) a.ftf++ }
    if (j.scheduled_date && vs.length) {
      a.onTimeJudged++
      const first = vs.reduce((m, v) => (v.clock_in < m ? v.clock_in : m), vs[0].clock_in)
      if (etDay(first) <= j.scheduled_date) a.onTime++
    }
    a.parts += (pByJob.get(j.id) ?? []).reduce((s, p) => s + (Number(p.qty) || 1), 0)
  }
  // Hours go to whoever logged them (a helper on someone else's job counts too).
  // Older entries carry a login id or just a name — map those back to the tech.
  const roster = await techRoster()
  const winJobs = new Map(inWin.map((j) => [j.id, j]))
  for (const v of visits) {
    const job = winJobs.get(v.work_order_id)
    if (!job) continue
    const id = (v.technician_id && roster.byId.has(v.technician_id) ? v.technician_id : null)
      ?? (v.technician_id ? roster.byLogin.get(v.technician_id) : null)
      ?? (v.technician_name ? roster.byName.get(v.technician_name.trim().toLowerCase()) : null)
      ?? job.assignee_id
    if (!id) continue
    const a = get(id, v.technician_name ?? job?.assignee_name ?? null)
    a.mins += v.duration_mins ?? 0; a.visits++
  }
  const weeks = days / 7
  return Array.from(acc.values()).map((a) => ({
    technician_id: a.id,
    name: a.name,
    jobs: a.jobs,
    hours: r1(a.mins / 60),
    visits: a.visits,
    avg_visit_mins: a.visits ? Math.round(a.mins / a.visits) : null,
    first_time_fix_pct: pct(a.ftf, a.ftfJudged),
    jobs_per_week: r1(a.jobs / weeks),
    on_time_pct: pct(a.onTime, a.onTimeJudged),
    parts_per_job: a.jobs ? r1(a.parts / a.jobs) : null,
  })).sort((x, y) => y.jobs - x.jobs)
}

async function techRoster() {
  let r = await db().from('technicians').select('id, name, clerk_user_id')
  if (r.error) r = await db().from('technicians').select('id, name') as typeof r
  const rows = (r.data ?? []) as { id: string; name: string | null; clerk_user_id?: string | null }[]
  return {
    byId: new Set(rows.map((t) => t.id)),
    byLogin: new Map(rows.filter((t) => t.clerk_user_id).map((t) => [t.clerk_user_id!, t.id])),
    byName: new Map(rows.filter((t) => t.name).map((t) => [t.name!.trim().toLowerCase(), t.id])),
  }
}

export const SIZE_BUCKETS: { key: string; label: string; min: number; max: number }[] = [
  { key: 'xs', label: 'Under 100 units', min: 1, max: 99 },
  { key: 's', label: '100–249 units', min: 100, max: 249 },
  { key: 'm', label: '250–399 units', min: 250, max: 399 },
  { key: 'l', label: '400+ units', min: 400, max: Infinity },
]
const median = (xs: number[]) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }

/**
 * Network "what to expect" — per property per year, by size. Uses every active
 * property that's been live a full year (so a new site's quiet first months don't
 * drag the average). Anonymous: no names, no dealers, only counts.
 */
export async function benchmark() {
  const now = Date.now()
  const yearAgo = new Date(now - 365 * DAY).toISOString()
  const sites = await pageAll<{ id: string; units: number | null; status: string | null; created_at: string | null }>((f, t) =>
    db().from('sites').select('id, units, status, created_at').range(f, t))
  const live = sites.filter((s) => (s.status ?? 'active') === 'active' && (!s.created_at || s.created_at <= yearAgo))
  const { jobs, visits, parts } = await loadWork({ siteIds: live.map((s) => s.id), since: new Date(now - 365 * DAY) })
  const returns = returnTrips(jobs)
  type Row = { visits: number; hours: number; parts_cost: number; jobs: number; returns: number }
  const per = new Map<string, Row>(live.map((s) => [s.id, { visits: 0, hours: 0, parts_cost: 0, jobs: 0, returns: 0 }]))
  const jobSite = new Map(jobs.map((j) => [j.id, j.site_id]))
  for (const j of jobs) { const r = j.site_id ? per.get(j.site_id) : null; if (r) { r.jobs++; if (returns.has(j.id)) r.returns++ } }
  for (const v of visits) { const r = per.get(jobSite.get(v.work_order_id) ?? ''); if (r) { r.visits++; r.hours += (v.duration_mins ?? 0) / 60 } }
  for (const p of parts) { const r = per.get(jobSite.get(p.work_order_id) ?? ''); if (r) r.parts_cost += (Number(p.qty) || 1) * (Number(p.unit_cost) || 0) }

  const jobSiteVisited = new Set(visits.map((v) => v.work_order_id))
  const group = (ids: string[]) => {
    const rows = ids.map((id) => per.get(id)!).filter(Boolean)
    const visitsArr = rows.map((r) => r.visits), hoursArr = rows.map((r) => r.hours)
    const v = visitsArr.reduce((a, b) => a + b, 0), h = hoursArr.reduce((a, b) => a + b, 0)
    const jobsN = rows.reduce((a, r) => a + r.jobs, 0), ret = rows.reduce((a, r) => a + r.returns, 0)
    return {
      properties: rows.length,
      visits_per_year: rows.length ? r1(v / rows.length) : null,
      visits_median: median(visitsArr),
      hours_per_year: rows.length ? r1(h / rows.length) : null,
      hours_per_visit: v ? r1(h / v) : null,
      parts_cost_per_year: rows.length ? Math.round(rows.reduce((a, r) => a + r.parts_cost, 0) / rows.length) : null,
      return_trip_pct: pct(ret, jobsN),
    }
  }
  const sizeOf = (u: number | null) => (u && u > 0 ? SIZE_BUCKETS.find((b) => u >= b.min && u <= b.max)?.key ?? null : null)
  return {
    as_of: new Date(now).toISOString(),
    all: group(live.map((s) => s.id)),
    by_size: [
      ...SIZE_BUCKETS.map((b) => ({ key: b.key, label: b.label, ...group(live.filter((s) => sizeOf(s.units) === b.key).map((s) => s.id)) })),
      { key: 'unknown', label: 'Size not set', ...group(live.filter((s) => !sizeOf(s.units)).map((s) => s.id)) },
    ],
    // Most visits still have no time logged until the Finish job rule has run a while.
    jobs_without_time: jobs.filter((j) => !jobSiteVisited.has(j.id)).length,
    jobs: jobs.length,
  }
}
