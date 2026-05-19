import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

// GET — list phases for a work order
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const { data, error } = await supabase
    .from('work_order_phases')
    .select('*')
    .eq('work_order_id', params.id)
    .order('sort_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ phases: data ?? [] })
}

// POST — add a phase
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const { name, scheduled_date, end_date, notes, status = 'pending' } = body
  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const { count } = await supabase
    .from('work_order_phases')
    .select('*', { count: 'exact', head: true })
    .eq('work_order_id', params.id)

  const { data, error } = await supabase
    .from('work_order_phases')
    .insert({
      work_order_id: params.id,
      name: name.trim(),
      scheduled_date: scheduled_date || null,
      end_date:       end_date || null,
      notes:          notes || null,
      status,
      sort_order: count ?? 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ phase: data }, { status: 201 })
}
