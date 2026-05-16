/**
 * GET   /api/reps/commissions          — list commissions (optionally filtered by period)
 * PATCH /api/reps/commissions          — bulk status update (approve / mark paid)
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

  const { searchParams } = new URL(req.url)
  const period = searchParams.get('period')  // "YYYY-MM"
  const repId  = searchParams.get('rep_id')

  let query = supabase
    .from('rep_commissions')
    .select(`
      *,
      sales_reps(first_name, last_name, tier)
    `)
    .order('pay_period', { ascending: false })
    .order('created_at', { ascending: false })

  if (!caller.isCorporate && caller.org_id) {
    query = query.eq('org_id', caller.org_id)
  }
  if (period) query = query.eq('pay_period', period)
  if (repId)  query = query.eq('rep_id', repId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ commissions: data ?? [] })
}

export async function PATCH(req: NextRequest) {
  const caller = await getCurrentUser()
  const allowed = caller.isCorporate ||
    caller.org_tier === 'master_dealer' ||
    caller.org_tier === 'full_dealer'

  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { id, status } = body

  if (!id || !status) {
    return NextResponse.json({ error: 'id and status are required' }, { status: 400 })
  }

  const validStatuses = ['pending', 'approved', 'paid', 'held']
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 })
  }

  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  }

  if (status === 'approved') {
    updates.approved_by = caller.id
    updates.approved_at = new Date().toISOString()
  }
  if (status === 'paid') {
    updates.paid_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('rep_commissions')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ commission: data })
}
