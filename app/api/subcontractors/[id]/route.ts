import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

// GET /api/subcontractors/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await getCurrentUser()

  const { data, error } = await supabase
    .from('subcontractors')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  // Also fetch their assigned work orders
  const { data: assignments } = await supabase
    .from('work_order_subcontractors')
    .select('*, work_orders(*)')
    .eq('subcontractor_id', params.id)
    .order('assigned_at', { ascending: false })

  return NextResponse.json({ subcontractor: data, assignments: assignments ?? [] })
}

// PATCH /api/subcontractors/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  await getCurrentUser()
  const body = await req.json()

  const allowed = [
    'name','company','email','phone','trade',
    'license_number','license_expiry','insurance_expiry','status',
  ]
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  const { data, error } = await supabase
    .from('subcontractors')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ subcontractor: data })
}

// DELETE /api/subcontractors/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await getCurrentUser()

  const { error } = await supabase
    .from('subcontractors')
    .delete()
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
