import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json()
  const { status, resolved_at, description, severity, reported_by } = body

  const updates: Record<string, unknown> = {}
  if (status      !== undefined) updates.status      = status
  if (resolved_at !== undefined) updates.resolved_at = resolved_at
  if (description !== undefined) updates.description = description
  if (severity    !== undefined) updates.severity    = severity
  if (reported_by !== undefined) updates.reported_by = reported_by

  if (status === 'resolved' && !updates.resolved_at) {
    updates.resolved_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('incidents')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ incident: data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error } = await supabase
    .from('incidents')
    .delete()
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
