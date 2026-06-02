/**
 * GET /api/aria/searches
 * Returns non-expired ARIA searches belonging to the current user, newest first.
 * Scoped to user_id — never leaks other users' search history.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUser()

    // Always scope to the current user — no one sees another user's search history
    const query = supabase
      .from('aria_searches')
      .select('id, query, query_interpretation, imported_count, imported_at, expires_at, created_at, results')
      .eq('user_id', user.id)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(50)

    const { data, error } = await query
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ searches: data ?? [] })
    
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch search history'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}