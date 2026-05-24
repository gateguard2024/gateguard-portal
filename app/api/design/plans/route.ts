/**
 * GET  /api/design/plans — list floor plans for the org
 * POST /api/design/plans — create a new floor plan
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

// GET /api/design/plans
export async function GET(_req: NextRequest) {
  const user = await getCurrentUser()
  if (!user.id || user.id === 'system') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const scope = await resolveOrgScope(user)
  const db = serviceDb()

  let query = db
    .from('floor_plans')
    .select(`
      id, name, level, org_id, site_id, status, created_at, updated_at,
      floor_plan_devices(id),
      floor_plan_connections(id)
    `)
    .order('updated_at', { ascending: false })

  if (!scope.all && scope.ids.length > 0) {
    query = query.in('org_id', scope.ids)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Flatten counts
  const plans = (data ?? []).map((p: Record<string, unknown>) => ({
    ...(p as Record<string, unknown>),
    device_count: Array.isArray(p.floor_plan_devices) ? p.floor_plan_devices.length : 0,
    connection_count: Array.isArray(p.floor_plan_connections) ? p.floor_plan_connections.length : 0,
    floor_plan_devices: undefined,
    floor_plan_connections: undefined,
  }))

  return NextResponse.json({ plans })
}

// POST /api/design/plans
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user.id || user.id === 'system') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { name, level, site_id } = body

  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const db = serviceDb()
  const org_id = user.isCorporate ? (body.org_id ?? null) : (user.org_id ?? null)

  const { data, error } = await db
    .from('floor_plans')
    .insert({
      name,
      level:   level ?? 'Level 1',
      org_id,
      site_id: site_id ?? null,
      status:  'draft',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ plan: data }, { status: 201 })
}
