/**
 * PATCH  /api/crm/activities/[id]  — edit activity (subject, body, type, due_at, completed_at)
 * DELETE /api/crm/activities/[id]  — delete activity
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
  try {
    const caller = await getCurrentUser()
    const body   = await req.json()

    const { data: existing } = await supabase
      .from('crm_activities')
      .select('id, created_by, opportunity_id')
      .eq('id', params.id)
      .single()

    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.subject      !== undefined) updates.subject      = body.subject
    if (body.body         !== undefined) updates.body         = body.body
    if (body.type         !== undefined) updates.type         = body.type
    if (body.due_at       !== undefined) updates.due_at       = body.due_at
    if (body.outcome      !== undefined) updates.outcome      = body.outcome
    if (body.duration_mins !== undefined) updates.duration_mins = body.duration_mins

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
    await getCurrentUser()

    const { data: existing } = await supabase
      .from('crm_activities')
      .select('id')
      .eq('id', params.id)
      .single()

    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

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
