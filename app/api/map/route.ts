import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, applyOrgScope } from '@/lib/org-scope'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

export async function GET() {
  const user  = await getCurrentUser()
  const scope = await resolveOrgScope(user)

  // Fetch sites with org name join
  let query = supabase
    .from('sites')
    .select(`
      id, name, address, city, state, zip,
      status, units, property_type,
      master_dealer_id,
      org_id,
      organizations!sites_master_dealer_id_fkey (name)
    `)
    .order('name', { ascending: true })

  // Apply org isolation using the 3-FK site pattern
  query = applyOrgScope(query, scope, 'site')

  const { data: sites, error } = await query
  if (error) {
    console.error('[api/map] sites query error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Map status to health for the UI
  const mapHealth = (status: string): 'healthy' | 'attention' | 'at-risk' => {
    if (status === 'active')   return 'healthy'
    if (status === 'inactive') return 'attention'
    if (status === 'churned')  return 'at-risk'
    return 'attention'
  }

  const mapped = (sites ?? []).map((s: any) => ({
    id:             s.id,
    name:           s.name,
    address:        s.address ?? '',
    city:           s.city ?? '',
    state:          s.state ?? '',
    zip:            s.zip ?? '',
    status:         s.status ?? 'active',
    health:         mapHealth(s.status ?? 'active'),
    units:          s.units ?? 0,
    property_type:  s.property_type ?? 'Multifamily',
    org_id:         s.org_id,
    master_dealer_id: s.master_dealer_id,
    dealer_name:    s.organizations?.name ?? null,
  }))

  return NextResponse.json({ sites: mapped })
}
