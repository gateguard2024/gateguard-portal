/**
 * GET /api/aria/credits/balance
 *
 * Returns the current org's ARIA credit balance.
 * Used by the ARIA page TopBar to show the credit chip and gate the search button.
 *
 * Response:
 *   { balance: number, lifetime_spent: number, lifetime_earned: number, has_balance: boolean }
 *   or { balance: 0, has_balance: false } if no row exists yet (never purchased).
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
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Corporate admins can pass ?org_id= to view another org's balance
    const url = new URL(req.url)
    const queryOrgId = url.searchParams.get('org_id')
    let orgId: string | null

    if (queryOrgId && queryOrgId !== user.org_id) {
      // Only corporate users can view other orgs' balances
      if (!user.isCorporate) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      orgId = queryOrgId
    } else {
      orgId = user.org_id
    }

    if (!orgId) {
      return NextResponse.json({ balance: 0, has_balance: false, lifetime_spent: 0, lifetime_earned: 0 })
    }

    const { data, error } = await supabase
      .from('credit_balances')
      .select('balance, reserved, lifetime_spent, lifetime_earned, updated_at')
      .eq('org_id', orgId)
      .maybeSingle()

    if (error) {
      console.error('[credits/balance] DB error:', error.message)
      return NextResponse.json({ error: 'DB error' }, { status: 500 })
    }

    if (!data) {
      // Org has never purchased or received credits
      return NextResponse.json({
        balance: 0,
        has_balance: false,
        lifetime_spent: 0,
        lifetime_earned: 0,
        credits_per_search: 100,
      })
    }

    return NextResponse.json({
      balance: data.balance,
      reserved: data.reserved,
      has_balance: data.balance > 0,
      lifetime_spent: data.lifetime_spent,
      lifetime_earned: data.lifetime_earned,
      last_updated: data.updated_at,
      credits_per_search: 100,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[credits/balance]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
