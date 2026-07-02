/**
 * GET  /api/design/plans           — list floor plans for the org (optionally ?site_id=)
 * POST /api/design/plans           — create a new floor plan for a site_id
 *
 * Uses ONLY floor_plans + floor_plan_devices. Wires/zones are stored as
 * floor_plan_devices rows (device_type '__wire__' / '__zone__') so device_count
 * is derived from the real element count (excluding those helper rows).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope } from '@/lib/org-scope'

export const dynamic = 'force-dynamic'

function serviceDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET /api/design/plans[?site_id=UUID]
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const scope = await resolveOrgScope(user)
  const db = serviceDb()
  const siteId = new URL(req.url).searchParams.get('site_id')

  let query = db
    .from('floor_plans')
    .select(`
      id, name, level, org_id, site_id, status, file_url, file_type, created_at, updated_at,
      floor_plan_devices(id, device_type)
    `)
    .order('updated_at', { ascending: false })

  if (siteId) query = query.eq('site_id', siteId)
  if (!scope.all && scope.ids.length > 0) query = query.in('org_id', scope.ids)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const plans = (data ?? []).map((p: Record<string, unknown>) => {
    const rows = Array.isArray(p.floor_plan_devices)
      ? (p.floor_plan_devices as Array<{ device_type: string | null }>)
      : []
    const deviceCount = rows.filter(
      (r) => r.device_type !== '__wire__' && r.device_type !== '__zone__'
    ).length
    return {
      ...(p as Record<string, unknown>),
      device_count: deviceCount,
      element_count: rows.length,
      floor_plan_devices: undefined,
    }
  })

  return NextResponse.json({ plans })
}

// POST /api/design/plans  { site_id, name?, level?, status?, file_type? }
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { site_id, name, level, status, file_type } = body

  const db = serviceDb()
  const org_id = user.isCorporate ? (body.org_id ?? null) : (user.org_id ?? null)

  const { data, error } = await db
    .from('floor_plans')
    .insert({
      name: name ?? 'New Design',
      level: level ?? 'Level 1',
      org_id,
      site_id: site_id ?? null,
      status: status ?? 'floor_plan',
      file_type: file_type ?? 'blank',
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ plan: data }, { status: 201 })
}
