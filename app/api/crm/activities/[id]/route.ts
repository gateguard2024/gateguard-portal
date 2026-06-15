/**
 * PATCH  /api/crm/activities/[id]  — edit activity (subject, body, type, due_at, completed_at)
 * DELETE /api/crm/activities/[id]  — delete activity
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { opportunityInScope, leadInScope } from '@/lib/crm-scope'

// An activity is reachable only if its parent opportunity/lead is in the caller's
// scope (corporate bypasses). Fails closed for orphan activities (non-corporate).
async function activityInScope(row: { opportunity_id?: string | null; lead_id?: string | null } | null, isCorporate: boolean): Promise<boolean> {
  if (isCorporate) return true
  if (!row) return false
  if (row.opportunity_id) return opportunityInScope(row.opportunity_id)
  if (row.lead_id) return leadInScope(row.lead_id)
  return false
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const caller = await getCurrentUser()
    const body   = await req.json()

    const { data: existing } = await supabase
      .from('crm_activities')
      .select('id, created_by, opportunity_id, lead_id')
      .eq('id', params.id)
      .single()

    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!(await activityInScope(existing, caller.isCorporate))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // crm_activities has no updated_at column — never include it
    const updates: Record<string, unknown> = {}
    if (body.subject      !== undefined) updates.subject      = body.subject
    if (body.body         !== undefined) updates.body         = body.body
    if (body.type         !== undefined) updates.type         = body.type
    if (body.due_at       !== undefined) updates.due_at       = body.due_at
    if (body.outcome      !== undefined) updates.outcome      = body.outcome
    if (body.duration_mins !== undefined) updates.duration_min = body.duration_mins  // DB column: duration_min (no s)

    // Mark complete / reopen
    if (body.completed_at !== undefined) {
      updates.completed_at = body.completed_at
    } else if (body.completed === true) {
      updates.completed_at = new Date().toISOString()
    } else if (body.completed === false) {
      updates.completed_at = null
    }

    const { data, error } = await supabase
      .from('crm_activities')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const caller = await getCurrentUser()

    const { data: existing } = await supabase
      .from('crm_activities')
      .select('id, opportunity_id, lead_id')
      .eq('id', params.id)
      .single()

    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!(await activityInScope(existing, caller.isCorporate))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { error } = await supabase
      .from('crm_activities')
      .delete()
      .eq('id', params.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
