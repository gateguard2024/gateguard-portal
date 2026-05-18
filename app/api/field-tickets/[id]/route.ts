import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await getCurrentUser()
    const { data, error } = await supabase
      .from('field_tickets')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 404 })
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser()
    const body = await req.json()

    // Build safe patch — only allow known columns
    const patch: Record<string, any> = {}
    const allowed = [
      'title', 'findings', 'work_performed', 'materials_used', 'labor_hours',
      'recommendations', 'photos', 'signature_url', 'technician_name',
    ]
    for (const k of allowed) {
      if (k in body) patch[k] = body[k]
    }

    // Status transitions
    if (body.status) {
      patch.status = body.status
      if (body.status === 'submitted') patch.submitted_at = new Date().toISOString()
      if (body.status === 'approved') {
        patch.approved_at = new Date().toISOString()
        patch.approved_by = user.name ?? ''
      }
      if (body.status === 'rejected' && body.rejection_reason) {
        patch.rejection_reason = body.rejection_reason
      }
    }

    const { data, error } = await supabase
      .from('field_tickets')
      .update(patch)
      .eq('id', params.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await getCurrentUser()
    const { error } = await supabase
      .from('field_tickets')
      .delete()
      .eq('id', params.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
