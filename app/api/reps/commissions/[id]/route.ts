/**
 * PATCH /api/reps/commissions/[id] — update individual commission payout status
 *
 * Body: { status: 'pending'|'approved'|'paid'|'held', notes?: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const caller = await getCurrentUser()
  const allowed =
    caller.isCorporate ||
    caller.org_tier === 'master_dealer' ||
    caller.org_tier === 'full_dealer'

  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden — dealer admin only' }, { status: 403 })
  }

  const { id } = params

  let body: { status: string; notes?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { status, notes } = body

  const validStatuses = ['pending', 'approved', 'paid', 'held']
  if (!status || !validStatuses.includes(status)) {
    return NextResponse.json(
      { error: `status must be one of: ${validStatuses.join(', ')}` },
      { status: 400 }
    )
  }

  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  }

  if (notes !== undefined) updates.notes = notes

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
  return NextResponse.json({ ok: true, commission: data })
}
