/**
 * DELETE /api/aria/searches/[id]
 * Deletes a saved ARIA search, with strict org-scope security checks.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope } from '@/lib/org-scope'

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

    const scope = await resolveOrgScope(user)

    // ── Security Boundary ───────────────────────────────────────────────────
    // 1. Fetch the search to verify ownership before deletion
    const { data: search, error: fetchErr } = await supabase
      .from('aria_searches')
      .select('org_id')
      .eq('id', params.id)
      .single()

    if (fetchErr || !search) {
      return NextResponse.json({ error: 'Search not found' }, { status: 404 })
    }

    // 2. Prevent users from deleting searches outside their organizational tree
    if (!scope.all) {
      const allowedIds = scope.ids && scope.ids.length > 0 ? scope.ids : (scope.own_id ? [scope.own_id] : [])
      
      if (!allowedIds.includes(search.org_id)) {
        return NextResponse.json({ 
          error: 'Forbidden: You do not have permission to delete this search' 
        }, { status: 403 })
      }
    }

    // ── Execution ───────────────────────────────────────────────────────────
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