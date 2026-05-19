import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

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
    const orgId = user.org_id ?? 'corporate'
    const body = await req.json()

    // If marking done, set done_at
    const updates: Record<string, unknown> = { ...body }
    if (body.done === true && !body.done_at) {
      updates.done_at = new Date().toISOString()
    } else if (body.done === false) {
      updates.done_at = null
    }

    const { data, error } = await supabase
      .from('eos_todos')
      .update(updates)
      .eq('id', params.id)
      .eq('org_id', orgId)
      .select()
      .single()

    if (error) {
      console.error('[/api/eos/todos/[id] PATCH]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('[/api/eos/todos/[id] PATCH] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    const orgId = user.org_id ?? 'corporate'

    const { error } = await supabase
      .from('eos_todos')
      .delete()
      .eq('id', params.id)
      .eq('org_id', orgId)

    if (error) {
      console.error('[/api/eos/todos/[id] DELETE]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[/api/eos/todos/[id] DELETE] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
