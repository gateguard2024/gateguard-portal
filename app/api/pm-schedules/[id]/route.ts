import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

// PATCH /api/pm-schedules/[id] — update fields
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser()
  const body = await req.json()

  const { title, description, interval_days, next_due_at, is_active } = body

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (title        !== undefined) updates.title         = title
  if (description  !== undefined) updates.description   = description
  if (interval_days !== undefined) updates.interval_days = Number(interval_days)
  if (next_due_at  !== undefined) updates.next_due_at   = next_due_at
  if (is_active    !== undefined) updates.is_active      = is_active

  // Scope check — non-corporate users can only touch their own org's records
  let query = supabase
    .from('pm_schedules')
    .update(updates)
    .eq('id', params.id)

  if (!user.isCorporate && user.org_id) {
    query = query.eq('org_id', user.org_id)
  }

  const { data, error } = await query.select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data)  return NextResponse.json({ error: 'Not found' },  { status: 404 })

  return NextResponse.json({ pm_schedule: data })
}

// DELETE /api/pm-schedules/[id] — delete a PM schedule
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser()

  let query = supabase
    .from('pm_schedules')
    .delete()
    .eq('id', params.id)

  if (!user.isCorporate && user.org_id) {
    query = query.eq('org_id', user.org_id)
  }

  const { error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
