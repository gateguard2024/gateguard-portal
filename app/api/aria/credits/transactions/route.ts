/**
 * GET /api/aria/credits/transactions?org_id=<uuid>&limit=20
 *
 * Returns recent credit transactions for an org.
 * Corporate admins can query any org. Regular users can only query their own org.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const queryOrgId = url.searchParams.get('org_id')
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20', 10), 100)

    let orgId: string | null
    if (queryOrgId && queryOrgId !== user.org_id) {
      if (!user.isCorporate) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      orgId = queryOrgId
    } else {
      orgId = user.org_id
    }

    if (!orgId) return NextResponse.json({ transactions: [] })

    const { data, error } = await supabase
      .from('credit_transactions')
      .select('id, transaction_type, amount, balance_after, note, granted_by_name, expires_at, created_at, stripe_session_id')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[credits/transactions]', error.message)
      return NextResponse.json({ error: 'DB error' }, { status: 500 })
    }

    return NextResponse.json({ transactions: data ?? [] })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
