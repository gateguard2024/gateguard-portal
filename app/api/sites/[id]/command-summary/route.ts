/**
 * GET /api/sites/[id]/command-summary — the top intelligence strip for the Site
 * Command page. CHEAP + LOCAL only: device counts + health from site_assets,
 * doors from site_panels, open faults + 90d uptime from incidents, events-today
 * from site_events, and which vendor integrations are connected. No live vendor
 * calls here (those stay in the individual widgets) so the page loads fast.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, applyOrgScope } from '@/lib/org-scope'
import { siteHealth } from '@/lib/site-health'
import { siteUptime, type UptimeIncident } from '@/lib/site-uptime'

export const dynamic = 'force-dynamic'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

type Cat = 'camera' | 'reader' | 'intercom' | 'gate' | 'network'
function categoryOf(cat: string | null, name: string | null): Cat {
  const s = `${cat ?? ''} ${name ?? ''}`.toLowerCase()
  if (s.includes('camera') || s.includes('nvr') || s.includes('dvr')) return 'camera'
  if (s.includes('intercom') || s.includes('entry')) return 'intercom'
  if (s.includes('gate') || s.includes('operator') || s.includes('barrier')) return 'gate'
  if (s.includes('reader') || s.includes('access') || s.includes('lock') || s.includes('controller')) return 'reader'
  return 'network'
}
const OPEN_INC = new Set(['open', 'investigating'])
const WINDOW_MS = 90 * 864e5

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  const scope = await resolveOrgScope(user)
  const siteId = params.id

  // Access check — the site must be within the caller's scope (corporate = all).
  let siteQ = supabase.from('sites').select('id, name, address, city, state, units, status').eq('id', siteId)
  siteQ = applyOrgScope(siteQ, scope, 'site')
  const { data: site } = await siteQ.maybeSingle()
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [assetsRes, panelsRes, incRes, eventsRes, integRes] = await Promise.all([
    supabase.from('site_assets').select('product_category, product_name, status').eq('site_id', siteId),
    supabase.from('site_panels').select('door_count, status').eq('site_id', siteId),
    supabase.from('incidents').select('status, severity, category, asset_id, title, started_at, resolved_at, created_at, updated_at').eq('site_id', siteId).limit(1000),
    supabase.from('site_events').select('id', { count: 'exact', head: true }).eq('site_id', siteId).gte('created_at', new Date(Date.now() - 864e5).toISOString()),
    supabase.from('site_integrations').select('vendor, status').eq('site_id', siteId),
  ])

  // Devices + health
  const cat = { camera: 0, reader: 0, intercom: 0, gate: 0, network: 0 }
  const health = { online: 0, attention: 0, offline: 0 }
  const catOnline = { camera: 0, reader: 0, intercom: 0, gate: 0, network: 0 }
  for (const a of assetsRes.data ?? []) {
    const c = categoryOf(a.product_category as string | null, a.product_name as string | null)
    cat[c]++
    const st = String(a.status ?? '')
    if (st === 'active') { health.online++; catOnline[c]++ }
    else if (st === 'offline') health.offline++
    else health.attention++
  }
  const devicesTotal = cat.camera + cat.reader + cat.intercom + cat.gate + cat.network

  // Doors
  let doors = 0, panelsLive = 0
  for (const p of panelsRes.data ?? []) { doors += Number(p.door_count) || 0; if (p.status === 'live') panelsLive++ }

  // Faults + uptime (90d) — lib/site-uptime.ts: device-weighted availability (a fault takes
  // down its device, not the whole property; network/power = everything; no double counting).
  const now = Date.now()
  let openFaults = 0, lastStart = 0
  for (const i of incRes.data ?? []) {
    const started = i.started_at ? Date.parse(i.started_at as string) : (i.created_at ? Date.parse(i.created_at as string) : NaN)
    if (Number.isNaN(started)) continue
    if (started > lastStart) lastStart = started
    if (OPEN_INC.has(String(i.status))) openFaults++
  }
  const up = siteUptime((incRes.data ?? []) as UptimeIncident[], { camera: cat.camera, gate: cat.gate, door: Math.max(doors, cat.reader), intercom: cat.intercom, network: cat.network }, now, WINDOW_MS)
  const uptimePct = up.pct

  // Health (lib/site-health.ts): 100 minus what's wrong now — Gate Watch, Faults, open jobs,
  // requests, repeat visits. The page adds live cameras (withCameras). Reasons are shown.
  const siteHealthRes = (await siteHealth([site.id]).catch(() => new Map())).get(site.id) ?? null
  const healthScore = siteHealthRes?.score ?? Math.max(0, Math.round((devicesTotal ? health.online / devicesTotal : 1) * 100 - openFaults * 4))

  // Connected vendors
  const vendors: Record<string, boolean> = {}
  for (const v of integRes.data ?? []) if (v.vendor) vendors[v.vendor as string] = String(v.status ?? '') !== 'error'

  return NextResponse.json({
    site: { id: site.id, name: site.name, address: site.address, city: site.city, state: site.state, units: site.units, status: site.status },
    devices: { ...cat, total: devicesTotal, online: health.online, offline: health.offline, attention: health.attention, camerasOnline: catOnline.camera, gatesOnline: catOnline.gate },
    doors: { total: doors, panelsLive },
    faults: { open: openFaults, uptimePct, timeSinceLastMs: lastStart ? now - lastStart : null },
    eventsToday: eventsRes.count ?? 0,
    healthScore,
    health: siteHealthRes,
    vendors,
  })
}
