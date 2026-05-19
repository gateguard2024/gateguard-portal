import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: { id: string; phaseId: string } }) {
  const body = await req.json()
  const { data, error } = await supabase
    .from('work_order_phases')
    .update(body)
    .eq('id', params.phaseId)
    .eq('work_order_id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ phase: data })
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string; phaseId: string } }) {
  const { error } = await supabase
    .from('work_order_phases')
    .delete()
    .eq('id', params.phaseId)
    .eq('work_order_id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
