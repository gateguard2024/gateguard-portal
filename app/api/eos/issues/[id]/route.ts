import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveEosOrgId } from '@/lib/eos-org'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    const orgId = await resolveEosOrgId(user)
    const body = await req.json()

    // If resolving, set resolved_at
    const updates: Record<string, unknown> = { ...body }
    if (body.status === 'Resolved' && !body.resolved_at) {
      updates.resolved_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('eos_issues')
      .update(updates)
      .eq('id', params.id)
      .eq('org_id', orgId)
      .select()
      .single()

    if (error) {
      console.error('[/api/eos/issues/[id] PATCH]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('[/api/eos/issues/[id] PATCH] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    const orgId = await resolveEosOrgId(user)

    const { error } = await supabase
      .from('eos_issues')
      .delete()
      .eq('id', params.id)
      .eq('org_id', orgId)

    if (error) {
      console.error('[/api/eos/issues/[id] DELETE]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[/api/eos/issues/[id] DELETE] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
