/**
 * GET /api/aria/history
 * Lightweight, user-scoped ARIA search history for the date-grouped browser.
 * No expiry filter (unlike /searches) so the month/year view spans full history.
 * Selects light columns only — never the heavy `results` blob.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user?.id || user.id === 'anonymous') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const limit = Math.min(Number(new URL(req.url).searchParams.get('limit') ?? 300), 500)

    const { data, error } = await supabase
      .from('aria_searches')
      .select('id, query, query_interpretation, imported_count, search_type, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ items: data ?? [] })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch history'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
