/**
 * Property health engine — one score per property from what's actually wrong now:
 * Gate Watch (left open / can't see), open Faults, open jobs (urgent, overdue),
 * open service requests, repeat visits (90 days). Cameras are added on the property
 * page from live Eagle Eye status (withCameras). Points + bands: lib/site-health-rules.ts.
 * Reads only, batched for many properties (the dashboard).
 */
import { createClient } from '@supabase/supabase-js'
import { HEALTH_POINTS as P, scoreOf, type HealthReason, type SiteHealth } from '@/lib/site-health-rules'
import { loadWork, returnTrips } from '@/lib/service-stats'

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const DONE = '(completed,complete,done,closed,cancelled,canceled,deleted)'
const URGENT = new Set(['high', 'urgent', 'critical', 'emergency'])
/** Planned upkeep, not a problem: preventive maintenance, inspections, scheduled service. */
const PLANNED = /\b(pm|preventive|preventative|inspection|maintenance plan|quarterly|annual|tune[- ]?up)\b/i
const norm = (s: unknown) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

async function inChunks<T>(build: (ids: string[]) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>, ids: string[]): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; i < ids.length; i += 150) {
    const { data, error } = await build(ids.slice(i, i + 150))
    if (error) { console.error('[site-health]', error.message); continue } // a missing table/column just means no points from it
    out.push(...((data ?? []) as T[]))
  }
  return out
}

export async function siteHealth(siteIds: string[]): Promise<Map<string, SiteHealth>> {
  const ids = Array.from(new Set(siteIds.filter(Boolean)))
  const out = new Map<string, SiteHealth>()
  if (!ids.length) return out
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

  const [gates, faults, jobs, reqs, work] = await Promise.all([
    inChunks<{ id: string; site_id: string; label: string; state: string; incident_id: string | null }>((c) => db().from('gate_watches').select('id, site_id, label, state, incident_id').in('site_id', c).eq('enabled', true), ids),
    inChunks<{ id: string; site_id: string; title: string | null; severity: string | null }>((c) => db().from('incidents').select('id, site_id, title, severity').in('site_id', c).in('status', ['open', 'investigating']), ids),
    inChunks<{ id: string; site_id: string; priority: string | null; scheduled_date: string | null; title: string | null; job_type: string | null }>((c) => db().from('work_orders').select('id, site_id, priority, scheduled_date, title, job_type').in('site_id', c).not('status', 'in', DONE), ids),
    inChunks<{ site_id: string; priority_requested: string | null; area: string | null; status: string; converted_wo_id: string | null }>((c) => db().from('wo_requests').select('site_id, priority_requested, area, status, converted_wo_id').in('site_id', c).in('status', ['new', 'acknowledged', 'converted']), ids),
    loadWork({ siteIds: ids, since: new Date(Date.now() - 90 * 86_400_000) }).catch(() => ({ jobs: [] as never[], visits: [], parts: [] })),
  ])
  const returns = returnTrips(work.jobs)

  for (const siteId of ids) {
    const reasons: HealthReason[] = []
    const g = gates.filter((x) => x.site_id === siteId)
    const leftOpen = g.filter((x) => x.state === 'left_open')
    for (const x of leftOpen) reasons.push({ kind: 'gate', text: `${x.label} left open`, points: P.gateLeftOpen })
    for (const x of g.filter((x) => x.state === 'blind')) reasons.push({ kind: 'blind', text: `Gate Watch can’t see ${x.label}`, points: P.gateBlind })

    const counted = new Set(leftOpen.map((x) => x.incident_id).filter(Boolean))
    for (const f of faults.filter((x) => x.site_id === siteId && !counted.has(x.id))) reasons.push({ kind: 'fault', text: `Fault: ${f.title || 'open'}`, points: P.faultOpen })

    // Fair counting (Nov 24 2026): one problem costs points ONCE, and planned work isn't a problem.
    //  • the job made from a left-open gate's ticket is already counted as the gate
    //  • preventive maintenance / inspections, and routine jobs booked for today or later, cost nothing
    const openGates = new Set(leftOpen.map((x) => norm(x.label)))
    const siteReqs = reqs.filter((x) => x.site_id === siteId)
    const gateJobIds = new Set(siteReqs.filter((x) => x.converted_wo_id && openGates.has(norm(x.area))).map((x) => String(x.converted_wo_id)))
    const planned = (x: { priority: string | null; scheduled_date: string | null; title: string | null; job_type: string | null }) =>
      PLANNED.test(`${x.job_type ?? ''} ${x.title ?? ''}`) || (!URGENT.has(String(x.priority ?? '').toLowerCase()) && !!x.scheduled_date && x.scheduled_date >= today)
    const js = jobs.filter((x) => x.site_id === siteId && !gateJobIds.has(String(x.id)) && !(planned(x) && !(x.scheduled_date && x.scheduled_date < today)))
    const urgent = js.filter((x) => URGENT.has(String(x.priority ?? '').toLowerCase())).length
    const other = js.length - urgent
    const overdue = js.filter((x) => x.scheduled_date && x.scheduled_date < today).length
    if (urgent) reasons.push({ kind: 'jobs', text: `${plural(urgent, 'urgent job')} open`, points: urgent * P.jobUrgent })
    if (other) reasons.push({ kind: 'jobs', text: `${plural(other, 'open job')}`, points: other * P.jobOther })
    if (overdue) reasons.push({ kind: 'overdue', text: `${plural(overdue, 'job')} overdue`, points: overdue * P.jobOverdue })

    // A request for a gate already counted as left open isn't counted twice.
    const rs = siteReqs.filter((x) => x.status !== 'converted' && !openGates.has(norm(x.area)))
    const rHigh = rs.filter((x) => URGENT.has(String(x.priority_requested ?? '').toLowerCase())).length
    const rOther = rs.length - rHigh
    if (rHigh) reasons.push({ kind: 'requests', text: `${plural(rHigh, 'urgent request')} waiting`, points: rHigh * P.requestHigh })
    if (rOther) reasons.push({ kind: 'requests', text: `${plural(rOther, 'request')} waiting`, points: rOther * P.requestOther })

    const repeats = work.jobs.filter((j) => j.site_id === siteId && returns.has(j.id)).length
    if (repeats) reasons.push({ kind: 'repeat', text: `${plural(repeats, 'repeat visit')} in 90 days`, points: Math.min(P.repeatMax, repeats * P.repeatVisit) })

    out.set(siteId, scoreOf(reasons))
  }
  return out
}

/** Fleet roll-up for the dashboard: average, how many in each band, worst first. */
export function fleetHealth(map: Map<string, SiteHealth>, names: Map<string, string>) {
  const rows = Array.from(map.entries()).map(([site_id, h]) => ({ site_id, name: names.get(site_id) ?? 'Property', ...h }))
  const avg = rows.length ? Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length) : null
  return {
    avg,
    good: rows.filter((r) => r.band === 'good').length,
    watch: rows.filter((r) => r.band === 'watch').length,
    bad: rows.filter((r) => r.band === 'bad').length,
    worst: rows.filter((r) => r.score < 100).sort((a, b) => a.score - b.score).slice(0, 5),
  }
}
