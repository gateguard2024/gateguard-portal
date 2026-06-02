/**
 * DELETE /api/aria/searches/[id]
 * Deletes a saved ARIA search. Only the user who created it may delete it.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!params.id) {
      return NextResponse.json({ error: 'Search ID is required' }, { status: 400 })
    }

    // Fetch the record and verify the current user owns it
    const { data: search, error: fetchErr } = await supabase
      .from('aria_searches')
      .select('user_id')
      .eq('id', params.id)
      .single()

    if (fetchErr || !search) {
      return NextResponse.json({ error: 'Search not found' }, { status: 404 })
    }

    if (search.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error: deleteErr } = await supabase
      .from('aria_searches')
      .delete()
      .eq('id', params.id)

    if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 })

    return NextResponse.json({ ok: true })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}