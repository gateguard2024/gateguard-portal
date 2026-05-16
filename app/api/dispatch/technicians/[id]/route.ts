import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// PATCH /api/dispatch/technicians/[id] — update status or current job
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()

  const { data, error } = await supabase
    .from('technicians')
    .update(body)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data)  return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ technician: data })
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
