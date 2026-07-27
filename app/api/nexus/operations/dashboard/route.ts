/**
 * GET /api/nexus/operations/dashboard — aggregated, read-only Operations landing feed.
 *
 * Phase 1: EVERYTHING here is real data from EXISTING tables (no new tables, no
 * device integration). Device "online" counts come from the stored
 * `site_assets.status` string, which is set at install — so we return it under
 * `health` but flag `onlineTrackingLive: false`. Phase 2 (a nightly Inngest
 * rollup that writes live UniFi/Eagle-Eye state back into those same columns)
 * flips that flag to true without changing this contract.
 *
 * Sources: sites, site_assets, site_panels, work_orders, wo_requests, pm_schedules.
 * All org-scoped. Crew utilization is intentionally NOT here — the landing reuses
 * the existing /api/dispatch/analytics endpoint for that.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, applyOrgScope } from '@/lib/org-scope'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

type DeviceCat = 'camera' | 'reader' | 'intercom' | 'gate' | 'network'
function categoryOf(cat: string | null, name: string | null): DeviceCat {
  const s = `${cat ?? ''} ${name ?? ''}`.toLowerCase()
  if (s.includes('camera') || s.includes('nvr') || s.includes('dvr')) return 'camera'
  if (s.includes('intercom') || s.includes('entry')) return 'intercom'
  if (s.includes('gate') || s.includes('operator') || s.includes('barrier')) return 'gate'
  if (s.includes('reader') || s.includes('access') || s.includes('lock') || s.includes('controller')) return 'reader'
  return 'network'
}
type Health = 'online' | 'attention' | 'offline'
function healthOf(status: string | null): Health {
  if (status === 'active') return 'online'
  if (status === 'offline') return 'offline'
  return 'attention' // degraded / replaced / unknown → needs a look
}

const EMPTY = {
  fleet: { gates: 0, cameras: 0, readers: 0, intercoms: 0, network: 0, devicesTotal: 0, doors: 0, panelsLive: 0, panelsTotal: 0, sitesActive: 0, sitesTotal: 0, units: 0, health: { online: 0, attention: 0, offline: 0 }, onlineTrackingLive: false },
  response: { avgResponseHours: null as number | null, avgResolveDays: null as number | null, sampleSize: 0 },
  requests: { open: 0, items: [] as unknown[] },
  schedule: { todayCount: 0, items: [] as unknown[] },
  openWorkOrders: { open: 0, items: [] as unknown[] },
  pm: { overdue: 0, dueSoon: 0, onTrack: 0 },
  serviceLoad: { visits90d: 0, devices: 0, ratio: 0 },
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user.canViewWOs && !user.canViewCRM && !user.isCorporate) {
    return NextResponse.json(EMPTY)
  }
  const scope = await resolveOrgScope(user)
  if (!scope.all && scope.ids.length === 0) return NextResponse.json(EMPTY)

  // ---- Scoped site ids (sites use the multi-column dealer scope) ----
  let sitesQ = supabase.from('sites').select('id, name, city, state, status, units')
  sitesQ = applyOrgScope(sitesQ, scope, 'site')
  const { data: sites, error: sitesErr } = await sitesQ
  if (sitesErr) return NextResponse.json({ error: sitesErr.message }, { status: 500 })
  const siteRows = sites ?? []
  const siteIds = siteRows.map((s) => s.id)
  const siteName = new Map<string, string>(siteRows.map((s) => [s.id, s.name as string]))

  const sitesActive = siteRows.filter((s) => (s.status ?? 'active') === 'active').length
  const units = siteRows.reduce((n, s) => n + (Number(s.units) || 0), 0)

  if (siteIds.length === 0) {
    return NextResponse.json({ ...EMPTY, fleet: { ...EMPTY.fleet, sitesTotal: 0 } })
  }

  // ---- Fleet: site_assets (counts + install-status health) ----
  const cat = { gate: 0, camera: 0, reader: 0, intercom: 0, network: 0 }
  const onlineLive = { gate: 0, camera: 0, reader: 0, intercom: 0, network: 0 }
  const health = { online: 0, attention: 0, offline: 0 }
  const LIVE_MS = 48 * 36e5   // a device counts as "live online" only if polled within 48h
  let liveSeen = 0
  {
    const { data: assets } = await supabase
      .from('site_assets')
      .select('product_category, product_name, status, last_seen_at')
      .in('site_id', siteIds)
    for (const a of assets ?? []) {
      const c = categoryOf(a.product_category as string | null, a.product_name as string | null)
      cat[c]++
      health[healthOf(a.status as string | null)]++
      const seen = a.last_seen_at ? Date.parse(a.last_seen_at as string) : NaN
      if (!Number.isNaN(seen) && Date.now() - seen < LIVE_MS) {
        liveSeen++
        if (a.status === 'active') onlineLive[c]++
      }
    }
  }
  const devicesTotal = cat.gate + cat.camera + cat.reader + cat.intercom + cat.network

  // ---- Panels / doors ----
  let doors = 0, panelsLive = 0, panelsTotal = 0
  {
    const { data: panels } = await supabase
      .from('site_panels')
      .select('door_count, status')
      .in('site_id', siteIds)
    panelsTotal = (panels ?? []).length
    for (const p of panels ?? []) {
      doors += Number(p.door_count) || 0
      if (p.status === 'live') panelsLive++
    }
  }

  // ---- Work orders (org-scoped): response times, today's schedule, service load ----
  const today = new Date().toISOString().slice(0, 10)
  const since = new Date(Date.now() - 120 * 864e5).toISOString()
  let woQ = supabase
    .from('work_orders')
    .select('id, title, site_id, priority, status, assignee_name, scheduled_date, created_at, arrived_at, completed_at')
    .gte('created_at', since)
    .limit(2000)
  woQ = applyOrgScope(woQ, scope)
  const { data: wos } = await woQ
  const woRows = wos ?? []

  let respSum = 0, respN = 0, resolveSum = 0, resolveN = 0
  const scheduleItems: unknown[] = []
  for (const w of woRows) {
    const created = w.created_at ? Date.parse(w.created_at as string) : NaN
    if (w.arrived_at && !Number.isNaN(created)) { respSum += Date.parse(w.arrived_at as string) - created; respN++ }
    if (w.completed_at && !Number.isNaN(created)) { resolveSum += Date.parse(w.completed_at as string) - created; resolveN++ }
    if ((w.scheduled_date as string | null) === today && scheduleItems.length < 12) {
      scheduleItems.push({ id: w.id, title: w.title ?? 'Work order', site: siteName.get(w.site_id as string) ?? null, tech: w.assignee_name ?? null, priority: w.priority ?? 'normal', status: w.status ?? 'open' })
    }
  }
  const avgResponseHours = respN ? Math.round((respSum / respN / 36e5) * 10) / 10 : null
  const avgResolveDays = resolveN ? Math.round((resolveSum / resolveN / 864e5) * 10) / 10 : null
  const visits90d = woRows.filter((w) => w.created_at && Date.parse(w.created_at as string) >= Date.now() - 90 * 864e5).length
  const ratio = devicesTotal ? Math.round((visits90d / devicesTotal) * 100) / 100 : 0

  // ---- Open work orders (ALL open, org-scoped — not date-limited) ----
  const openItems: unknown[] = []
  {
    let oq = supabase
      .from('work_orders')
      .select('id, wo_number, title, site_id, priority, status, assignee_name, scheduled_date, created_at')
      .not('status', 'in', '(completed,cancelled,canceled,closed,done)')
      .order('created_at', { ascending: false })
      .limit(24)
    oq = applyOrgScope(oq, scope)
    const { data: ows } = await oq
    for (const w of ows ?? []) {
      openItems.push({ id: w.id, wo: w.wo_number ?? null, title: w.title ?? 'Work order', site: siteName.get(w.site_id as string) ?? null, tech: w.assignee_name ?? null, priority: w.priority ?? 'normal', status: w.status ?? 'open', scheduled: w.scheduled_date ?? null })
    }
  }
  let openWoCount = openItems.length
  {
    let cq = supabase.from('work_orders').select('id', { count: 'exact', head: true })
      .not('status', 'in', '(completed,cancelled,canceled,closed,done)')
    cq = applyOrgScope(cq, scope)
    const { count } = await cq
    if (typeof count === 'number') openWoCount = count
  }

  // ---- Open requests (by scoped sites) ----
  const requestItems: unknown[] = []
  {
    const { data: reqs } = await supabase
      .from('wo_requests')
      .select('id, title, site_id, priority_requested, status, created_at')
      .in('site_id', siteIds)
      .in('status', ['new', 'acknowledged'])
      .order('created_at', { ascending: false })
      .limit(12)
    for (const r of reqs ?? []) {
      const ageHours = r.created_at ? Math.round((Date.now() - Date.parse(r.created_at as string)) / 36e5) : null
      requestItems.push({ id: r.id, title: r.title ?? 'Request', site: siteName.get(r.site_id as string) ?? null, priority: r.priority_requested ?? 'normal', ageHours })
    }
  }
  let openReqCount = requestItems.length
  {
    const { count } = await supabase
      .from('wo_requests')
      .select('id', { count: 'exact', head: true })
      .in('site_id', siteIds)
      .in('status', ['new', 'acknowledged'])
    if (typeof count === 'number') openReqCount = count
  }

  // ---- Preventive maintenance buckets ----
  let overdue = 0, dueSoon = 0, onTrack = 0
  {
    let pmQ = supabase.from('pm_schedules').select('next_due_at, is_active, org_id').eq('is_active', true).limit(2000)
    pmQ = applyOrgScope(pmQ, scope)
    const { data: pms } = await pmQ
    const now = Date.now(), soon = now + 14 * 864e5
    for (const p of pms ?? []) {
      const due = p.next_due_at ? Date.parse(p.next_due_at as string) : NaN
      if (Number.isNaN(due)) { onTrack++; continue }
      if (due < now) overdue++
      else if (due <= soon) dueSoon++
      else onTrack++
    }
  }

  return NextResponse.json({
    fleet: {
      gates: cat.gate, cameras: cat.camera, readers: cat.reader, intercoms: cat.intercom, network: cat.network,
      devicesTotal, doors, panelsLive, panelsTotal,
      sitesActive, sitesTotal: siteRows.length, units,
      camerasOnline: onlineLive.camera, networkOnline: onlineLive.network, readersOnline: onlineLive.reader, intercomsOnline: onlineLive.intercom,
      health,
      onlineTrackingLive: liveSeen > 0, // true once the nightly rollup has written live status
    },
    response: { avgResponseHours, avgResolveDays, sampleSize: respN },
    requests: { open: openReqCount, items: requestItems },
    schedule: { todayCount: scheduleItems.length, items: scheduleItems },
    openWorkOrders: { open: openWoCount, items: openItems },
    pm: { overdue, dueSoon, onTrack },
    serviceLoad: { visits90d, devices: devicesTotal, ratio },
  })
}
