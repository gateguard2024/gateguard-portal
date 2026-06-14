import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, applyOrgScope } from '@/lib/org-scope'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

type Health = 'online' | 'warning' | 'offline'

function healthOf(status: string | null): Health {
  if (status === 'active') return 'online'
  if (status === 'offline') return 'offline'
  return 'warning' // maintenance / unknown / anything else needs a look
}

function categoryOf(cat: string | null, name: string | null): 'camera' | 'reader' | 'intercom' | 'gate' | 'network' {
  const s = `${cat ?? ''} ${name ?? ''}`.toLowerCase()
  if (s.includes('camera') || s.includes('nvr') || s.includes('dvr')) return 'camera'
  if (s.includes('intercom') || s.includes('entry')) return 'intercom'
  if (s.includes('gate') || s.includes('operator') || s.includes('barrier')) return 'gate'
  if (s.includes('reader') || s.includes('access') || s.includes('lock') || s.includes('controller')) return 'reader'
  return 'network'
}

// GET /api/nexus/systems — installed systems + device health, per site, org-scoped.
export async function GET(_req: NextRequest) {
  const user = await getCurrentUser()
  const scope = await resolveOrgScope(user)

  let sitesQ = supabase
    .from('sites')
    .select('id, name, address, city, state, status')
    .order('name', { ascending: true })
    .limit(200)
  sitesQ = applyOrgScope(sitesQ, scope, 'site')
  const { data: sites, error } = await sitesQ
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const siteIds = (sites ?? []).map((s) => s.id)
  if (siteIds.length === 0) return NextResponse.json({ sites: [] })

  const { data: assets } = await supabase
    .from('site_assets')
    .select('site_id, product_name, product_category, firmware_version, status, last_seen_at, location_note, notes')
    .in('site_id', siteIds)

  const bySite = new Map<string, any[]>()
  for (const a of assets ?? []) {
    if (!bySite.has(a.site_id)) bySite.set(a.site_id, [])
    bySite.get(a.site_id)!.push(a)
  }

  const result = (sites ?? []).map((s) => {
    const devs = bySite.get(s.id) ?? []
    const devices = devs.map((d, i) => {
      const health = healthOf(d.status)
      return {
        id: `${s.id}-${i}`,
        name: d.product_name || d.location_note || 'Device',
        type: d.product_category || 'Device',
        category: categoryOf(d.product_category, d.product_name),
        health,
        firmware: d.firmware_version || undefined,
        last_seen: d.last_seen_at || undefined,
        issue: health === 'offline' ? 'Offline' : health === 'warning' ? (d.notes || 'Needs attention') : null,
      }
    })
    const online = devices.filter((d) => d.health === 'online').length
    const offline = devices.filter((d) => d.health === 'offline').length
    const warning = devices.filter((d) => d.health === 'warning').length
    return {
      id: s.id,
      site_name: s.name,
      address: [s.address, s.city, s.state].filter(Boolean).join(', ') || null,
      isp: null,
      device_total: devices.length,
      online,
      offline,
      warning,
      last_checked: devs.map((d) => d.last_seen_at).filter(Boolean).sort().pop() ?? new Date().toISOString(),
      devices,
      activity: [],
    }
  })

  return NextResponse.json({ sites: result })
}
