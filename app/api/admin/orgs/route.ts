/**
 * GET /api/admin/orgs
 *
 * Org search for wizard pickers — returns id + name + org_tier.
 * Query params:
 *   ?q=<text>   — fuzzy name search (ilike)
 *   ?tier=<tier> — filter by org_tier (can repeat: ?tier=master_agent&tier=master_dealer)
 *   ?limit=<n>  — default 20
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const caller = await getCurrentUser()
  if (!caller.isCorporate && !caller.isMasterAgent && !caller.isMasterDealer) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const q                = searchParams.get('q')
  const tiers            = searchParams.getAll('tier')
  const limit            = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100)
  const includeCorporate = searchParams.get('include_corporate') === 'true'

  let query = supabase
    .from('organizations')
    .select('id, name, org_tier, tier_label, is_active')
    .order('name', { ascending: true })
    .limit(limit)

  // Exclude corporate by default — wizard pickers should never assign to corporate.
  // Pass ?include_corporate=true to include it (e.g. credits admin page).
  if (!includeCorporate) {
    query = query.not('org_tier', 'eq', 'corporate')
  }

  if (q) {
    query = query.ilike('name', `%${q}%`)
  }

  if (tiers.length > 0) {
    query = query.in('org_tier', tiers)
  }

  // Scope: master agents only see their own subtree
  if (!caller.isCorporate && caller.org_id) {
    query = query.eq('parent_org_id', caller.org_id)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ orgs: data ?? [] })
}
