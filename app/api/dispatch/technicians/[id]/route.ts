import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// PATCH /api/dispatch/technicians/[id] — update status or current job
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()

  // Drift-resilient: if a column doesn't exist yet (e.g. level/skills before
  // migration 123 is applied), strip the offending field and retry rather than
  // failing the whole save.
  let attempt: Record<string, unknown> = { ...body }
  for (let i = 0; i < 4; i++) {
    const { data, error } = await supabase.from('technicians').update(attempt).eq('id', params.id).select().single()
    if (!error) {
      if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json({ technician: data })
    }
    const m = /Could not find the '(\w+)' column|column "?(\w+)"? .* does not exist/.exec(error.message)
    const bad = m?.[1] || m?.[2]
    if ((error.code === 'PGRST204' || error.code === '42703') && bad && bad in attempt) {
      delete attempt[bad]; continue
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ error: 'Could not update' }, { status: 500 })
}

// DELETE /api/dispatch/technicians/[id]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await supabase
    .from('technicians')
    .delete()
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
