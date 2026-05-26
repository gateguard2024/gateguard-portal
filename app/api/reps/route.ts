/**
 * GET  /api/reps          — list reps (scoped by org)
 * POST /api/reps          — create a rep
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const caller = await getCurrentUser()
  if (!caller.org_id && !caller.isCorporate) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let query = supabase
    .from('sales_reps')
    .select('*')
    .eq('is_active', true)
    .order('tier', { ascending: true })
    .order('last_name', { ascending: true })

  // Corporate sees all reps; everyone else sees their org's reps
  if (!caller.isCorporate && caller.org_id) {
    query = query.eq('org_id', caller.org_id)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reps: data ?? [] })
}

export async function POST(req: NextRequest) {
  const caller = await getCurrentUser()
  const allowed = caller.isCorporate ||
    caller.org_tier === 'master_dealer' ||
    caller.org_tier === 'full_dealer'

  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden — dealer admin only' }, { status: 403 })
  }

  const body = await req.json()
  const { first_name, last_name, email, phone, tier, commission_rate, parent_rep_id } = body

  if (!first_name?.trim() || !last_name?.trim()) {
    return NextResponse.json({ error: 'first_name and last_name are required' }, { status: 400 })
  }

  const validTiers = ['senior_rep', 'rep', 'sub_rep']
  if (tier && !validTiers.includes(tier)) {
    return NextResponse.json({ error: `Invalid tier: ${tier}` }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('sales_reps')
    .insert({
      org_id:          caller.org_id ?? null,
      first_name:      first_name.trim(),
      last_name:       last_name.trim(),
      email:           email ?? null,
      phone:           phone ?? null,
      tier:            tier ?? 'rep',
      commission_rate: commission_rate ?? 0.05,
      parent_rep_id:   parent_rep_id ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rep: data }, { status: 201 })
}
