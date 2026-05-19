import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

// GET — list crew for a work order
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const { data, error } = await supabase
    .from('work_order_crew')
    .select(`
      id, role, sort_order, added_at,
      technician:technicians(id, name, initials, role, phone, email, status)
    `)
    .eq('work_order_id', params.id)
    .order('sort_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ crew: data ?? [] })
}

// POST — add a crew member
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { technician_id, role = 'crew' } = await req.json()
  if (!technician_id) return NextResponse.json({ error: 'technician_id required' }, { status: 400 })

  // Count existing crew for sort_order
  const { count } = await supabase
    .from('work_order_crew')
    .select('*', { count: 'exact', head: true })
    .eq('work_order_id', params.id)

  const { data, error } = await supabase
    .from('work_order_crew')
    .insert({ work_order_id: params.id, technician_id, role, sort_order: count ?? 0 })
    .select(`id, role, sort_order, technician:technicians(id, name, initials, role, phone, email, status)`)
    .single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Already on crew' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ member: data }, { status: 201 })
}

// DELETE — remove a crew member by work_order_crew row id
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(req.url)
  const memberId = searchParams.get('member_id')
  if (!memberId) return NextResponse.json({ error: 'member_id required' }, { status: 400 })

  const { error } = await supabase
    .from('work_order_crew')
    .delete()
    .eq('id', memberId)
    .eq('work_order_id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
