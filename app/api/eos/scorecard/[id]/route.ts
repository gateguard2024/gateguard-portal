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

    const { data, error } = await supabase
      .from('eos_scorecard')
      .update(body)
      .eq('id', params.id)
      .eq('org_id', orgId)
      .select()
      .single()

    if (error) {
      console.error('[/api/eos/scorecard/[id] PATCH]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('[/api/eos/scorecard/[id] PATCH] unexpected:', err)
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

    // Delete entries first (cascade should handle this, but being explicit)
    await supabase
      .from('eos_scorecard_entries')
      .delete()
      .eq('scorecard_id', params.id)

    const { error } = await supabase
      .from('eos_scorecard')
      .delete()
      .eq('id', params.id)
      .eq('org_id', orgId)

    if (error) {
      console.error('[/api/eos/scorecard/[id] DELETE]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[/api/eos/scorecard/[id] DELETE] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
