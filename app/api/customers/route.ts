import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope } from '@/lib/org-scope'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

// Tier display labels — maps DB org_tier to UI display
const TIER_LABELS: Record<string, string> = {
  corporate:          'Corporate',
  master_agent:       'Master Agent',
  master_dealer:      'MSO — Master System Operator',
  full_dealer:        'Dealer',
  service_dealer:     'Service Partner',
  install_contractor: 'Install Partner',
  sales_partner:      'Sales Partner',
  client:             'Client',
}

export async function GET(req: NextRequest) {
  try {
    const user  = await getCurrentUser()
    const scope = await resolveOrgScope(user)
    const { searchParams } = new URL(req.url)
    const tier   = searchParams.get('tier')
    const search = searchParams.get('q')

    let query = supabase
      .from('organizations')
      .select(`
        id, name, org_tier, is_active,
        primary_contact_name, primary_contact_email, primary_contact_phone,
        city, state,
        parent_org_id, master_dealer_id, master_agent_id,
        onboarded_at, created_at
      `)
      .eq('is_active', true)
      .order('name', { ascending: true })

    // Org scope filter
    if (!scope.all && scope.ids.length > 0) {
      query = query.in('id', scope.ids)
    }
    // scope.all → corporate sees everything, no filter

    if (tier)   query = query.eq('org_tier', tier)
    if (search) query = query.ilike('name', `%${search}%`)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Enrich with parent name lookups (batch fetch parent names)
    const parentIds = [...new Set(
      (data ?? []).flatMap(o => [o.parent_org_id, o.master_dealer_id, o.master_agent_id].filter(Boolean))
    )] as string[]

    const parentMap: Record<string, string> = {}
    if (parentIds.length > 0) {
      const { data: parents } = await supabase
        .from('organizations')
        .select('id, name')
        .in('id', parentIds)
      ;(parents ?? []).forEach(p => { parentMap[p.id] = p.name })
    }

    // Fetch site counts per org
    const orgIds = (data ?? []).map(o => o.id)
    const siteCountMap: Record<string, number> = {}
    if (orgIds.length > 0) {
      const { data: siteCounts } = await supabase
        .from('sites')
        .select('org_id')
        .in('org_id', orgIds)
      ;(siteCounts ?? []).forEach(s => {
        siteCountMap[s.org_id] = (siteCountMap[s.org_id] ?? 0) + 1
      })
    }

    const enriched = (data ?? []).map(org => ({
      ...org,
      tier_label:   TIER_LABELS[org.org_tier] ?? org.org_tier,
      parent_name:  parentMap[org.parent_org_id ?? ''] ?? parentMap[org.master_dealer_id ?? ''] ?? null,
      site_count:   siteCountMap[org.id] ?? 0,
    }))

    return NextResponse.json({ records: enriched, total: enriched.length })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    const body = await req.json()
    const { name, org_tier, parent_org_id, primary_contact_name, primary_contact_email, primary_contact_phone, city, state } = body

    if (!name || !org_tier) {
      return NextResponse.json({ error: 'name and org_tier are required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('organizations')
      .insert({
        name,
        org_tier,
        parent_org_id: parent_org_id ?? null,
        primary_contact_name:  primary_contact_name ?? null,
        primary_contact_email: primary_contact_email ?? null,
        primary_contact_phone: primary_contact_phone ?? null,
        city:       city ?? null,
        state:      state ?? 'GA',
        is_active:  true,
        onboarded_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
