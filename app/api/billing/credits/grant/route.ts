/**
 * POST /api/billing/credits/grant
 *
 * Corporate-admin endpoint to grant ARIA credits to any org.
 * Supports trial, demo, plan_included, bonus, and adjustment grant types.
 *
 * Requires: corporate or admin role. Dealers cannot call this.
 *
 * Body:
 *   {
 *     org_id: string           — target org UUID
 *     amount: number           — credits to grant (positive integer)
 *     transaction_type: 'trial' | 'demo' | 'plan_included' | 'bonus' | 'adjustment'
 *     note?: string            — reason for grant (shown in audit log)
 *     expires_at?: string      — ISO timestamp; null = never expires
 *   }
 *
 * Response:
 *   { success: true, balance_after: number, granted_to_org: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'

const ALLOWED_GRANT_TYPES = ['trial', 'demo', 'plan_included', 'bonus', 'adjustment'] as const
type GrantType = typeof ALLOWED_GRANT_TYPES[number]

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Corporate-only endpoint
    if (!user.isCorporate) {
      return NextResponse.json({ error: 'Forbidden — corporate admin required' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const {
      org_id,
      amount,
      transaction_type,
      note,
      expires_at,
    } = body as {
      org_id?: string
      amount?: number
      transaction_type?: string
      note?: string
      expires_at?: string | null
    }

    // Validate
    if (!org_id || typeof org_id !== 'string') {
      return NextResponse.json({ error: 'org_id is required' }, { status: 400 })
    }
    if (!amount || typeof amount !== 'number' || amount <= 0 || !Number.isInteger(amount)) {
      return NextResponse.json({ error: 'amount must be a positive integer' }, { status: 400 })
    }
    if (!transaction_type || !ALLOWED_GRANT_TYPES.includes(transaction_type as GrantType)) {
      return NextResponse.json({
        error: `transaction_type must be one of: ${ALLOWED_GRANT_TYPES.join(', ')}`,
      }, { status: 400 })
    }

    // Verify target org exists
    const { data: targetOrg, error: orgError } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('id', org_id)
      .maybeSingle()

    if (orgError || !targetOrg) {
      return NextResponse.json({ error: 'Target org not found' }, { status: 404 })
    }

    // Call grant RPC
    const { data: result, error: grantError } = await supabase.rpc('grant_aria_credits', {
      p_org_id: org_id,
      p_user_id: null,          // org-level grant, not attributed to a specific user
      p_amount: amount,
      p_transaction_type: transaction_type,
      p_note: note ?? null,
      p_granted_by: user.id,
      p_granted_by_name: user.name,
      p_expires_at: expires_at ?? null,
      p_stripe_session_id: null,
      p_credit_package_id: null,
      p_price_paid_cents: 0,
    })

    if (grantError) {
      console.error('[credits/grant] RPC error:', grantError.message)
      return NextResponse.json({ error: 'Failed to grant credits' }, { status: 500 })
    }

    const grantResult = result as { success: boolean; balance_after: number }

    return NextResponse.json({
      success: true,
      balance_after: grantResult.balance_after,
      granted_to_org: org_id,
      granted_to_org_name: targetOrg.name,
      amount,
      transaction_type,
      note: note ?? null,
      expires_at: expires_at ?? null,
      granted_by: user.name,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[credits/grant]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
