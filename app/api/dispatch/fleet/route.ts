import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope } from '@/lib/org-scope'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

// GET /api/dispatch/fleet — latest location ping per tech (last 4 hours)
export async function GET(_req: NextRequest) {
  const user  = await getCurrentUser()
  const scope = await resolveOrgScope(user)

  const cutoff = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()

  // Build technician query with org scope
  let techQuery = supabase
    .from('technicians')
    .select('id, name, initials, status, current_job_id, org_id')
    .order('name')

  if (!scope.all && scope.ids.length > 0) {
    const idList = scope.ids.join(',')
    techQuery = (techQuery as any).or(`org_id.in.(${idList}),org_id.is.null`) as typeof techQuery
  }

  const { data: techs, error: techErr } = await techQuery
  if (techErr) return NextResponse.json({ error: techErr.message }, { status: 500 })
  if (!techs || techs.length === 0) return NextResponse.json({ fleet: [] })

  const techIds = techs.map(t => t.id)

  // Get latest ping per tech in last 4 hours
  const { data: pings, error: pingErr } = await supabase
    .from('tech_location_pings')
    .select('technician_id, lat, lng, event_type, work_order_id, created_at')
    .in('technician_id', techIds)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })

  if (pingErr) return NextResponse.json({ error: pingErr.message }, { status: 500 })

  // Keep only the most recent ping per tech
  const latestPingByTech = new Map<string, (typeof pings)[0]>()
  for (const ping of (pings ?? [])) {
    if (!latestPingByTech.has(ping.technician_id)) {
      latestPingByTech.set(ping.technician_id, ping)
    }
  }

  // Get current work orders for techs with active jobs
  const jobIds = techs
    .map(t => t.current_job_id)
    .filter((id): id is string => !!id)

  const jobMap = new Map<string, string>()
  if (jobIds.length > 0) {
    const { data: jobs } = await supabase
      .from('work_orders')
      .select('id, title')
      .in('id', jobIds)
    for (const j of (jobs ?? [])) {
      jobMap.set(j.id, j.title)
    }
  }

  const fleet = techs
    .filter(t => latestPingByTech.has(t.id))
    .map(t => {
      const ping = latestPingByTech.get(t.id)!
      return {
        tech_id:       t.id,
        name:          t.name,
        initials:      t.initials,
        status:        t.status,
        lat:           ping.lat,
        lng:           ping.lng,
        event_type:    ping.event_type,
        work_order_id: ping.work_order_id ?? t.current_job_id ?? null,
        wo_title:      ping.work_order_id
          ? (jobMap.get(ping.work_order_id) ?? null)
          : (t.current_job_id ? (jobMap.get(t.current_job_id) ?? null) : null),
        updated_at:    ping.created_at,
      }
    })

  return NextResponse.json({ fleet })
}
