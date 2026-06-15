/**
 * GET /api/nexus/internal/assignable-orgs
 *
 * Orgs the caller may add/move users into, scoped to the hierarchy:
 *   corporate → all active orgs
 *   others    → their own org + downward subtree (resolveOrgScope ids)
 *
 * Feeds the Add Person company picker and the Move-User picker. Only admins
 * (or corporate) get a non-empty list — non-admins can't invite anyone.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope } from '@/lib/org-scope'
import { normalizeRole } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TIER_LABELS: Record<string, string> = {
  corporate: 'Corporate',
  master_agent: 'Master Agent',
  master_dealer: 'Master Dealer',
  full_dealer: 'Full Dealer',
  service_dealer: 'Service Dealer',
  install_contractor: 'Install Contractor',
  sales_partner: 'Sales Partner',
  client: 'Client',
}

export async function GET() {
  try {
    const caller = await getCurrentUser()
    // Only admins (or corporate) can assign users into orgs.
    if (!caller.isCorporate && normalizeRole(caller.role) !== 'admin') {
      return NextResponse.json({ orgs: [] })
    }

    const scope = await resolveOrgScope(caller)

    let q = supabase
      .from('organizations')
      .select('id,name,org_tier,is_active')
      .order('name')
    if (!scope.all) {
      const ids = scope.ids.length ? scope.ids : ['00000000-0000-0000-0000-000000000000']
      q = q.in('id', ids)
    }
    const { data, error } = await q
    if (error) {
      return NextResponse.json({ orgs: [], error: error.message }, { status: 500 })
    }

    const orgs = (data ?? [])
      .filter((o) => o.is_active !== false)
      .map((o) => ({
        id: o.id,
        name: o.name,
        org_tier: o.org_tier as string | null,
        tier_label: TIER_LABELS[o.org_tier as string] ?? (o.org_tier ?? 'Org'),
        is_own: o.id === caller.org_id,
      }))

    return NextResponse.json({ orgs, own_org_id: caller.org_id ?? null })
  } catch (e) {
    return NextResponse.json({ orgs: [], error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
}
