import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, applyOrgScope } from '@/lib/org-scope'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

// GET /api/pm-schedules — list PM schedules scoped to caller's org
// Optional ?site_id= to filter by site
export async function GET(req: NextRequest) {
  const user  = await getCurrentUser()
  const scope = await resolveOrgScope(user)

  const { searchParams } = new URL(req.url)
  const site_id = searchParams.get('site_id')

  let query = supabase
    .from('pm_schedules')
    .select('id, org_id, site_id, title, description, interval_days, last_generated_at, next_due_at, is_active, created_at, updated_at')
    .order('next_due_at', { ascending: true })

  query = applyOrgScope(query, scope, 'org_id')

  if (site_id) query = query.eq('site_id', site_id)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ pm_schedules: data ?? [] })
}

// POST /api/pm-schedules — create a new PM schedule
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  const body = await req.json()

  const { site_id, title, description, interval_days = 90, next_due_at } = body

  if (!site_id || !title || !next_due_at) {
    return NextResponse.json(
      { error: 'site_id, title, and next_due_at are required' },
      { status: 400 }
    )
  }

  const org_id = user.isCorporate ? (body.org_id ?? null) : (user.org_id ?? null)

  const { data, error } = await supabase
    .from('pm_schedules')
    .insert({
      org_id,
      site_id,
      title,
      description: description ?? null,
      interval_days: Number(interval_days),
      next_due_at,
      is_active: true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ pm_schedule: data }, { status: 201 })
}
