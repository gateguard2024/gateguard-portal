import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

// GET — list call logs for a work order
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const { data, error } = await supabase
    .from('wo_call_logs')
    .select('*')
    .eq('work_order_id', params.id)
    .order('called_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ calls: data ?? [] })
}

// POST — log a call
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const {
    direction = 'outbound', contact_name, phone, duration_mins,
    notes, outcome, made_by, called_at,
  } = body

  const { data, error } = await supabase
    .from('wo_call_logs')
    .insert({
      work_order_id: params.id,
      direction,
      contact_name:  contact_name?.trim() || null,
      phone:         phone?.trim()         || null,
      duration_mins: duration_mins         || null,
      notes:         notes?.trim()         || null,
      outcome:       outcome               || null,
      made_by:       made_by?.trim()       || null,
      called_at:     called_at             || new Date().toISOString(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ call: data }, { status: 201 })
}

// DELETE — remove a call log
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const { call_id } = body
  if (!call_id) return NextResponse.json({ error: 'call_id required' }, { status: 400 })

  const { error } = await supabase
    .from('wo_call_logs')
    .delete()
    .eq('id', call_id)
    .eq('work_order_id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
