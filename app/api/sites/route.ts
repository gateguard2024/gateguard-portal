import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, applyOrgScope, hasOrgContext } from '@/lib/org-scope'
import { stripForList } from '@/lib/sensitive-fields'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

// GET /api/sites — list all sites visible to the authenticated org
export async function GET(req: NextRequest) {
  const user  = await getCurrentUser()
  const scope = await resolveOrgScope(user)

  const { searchParams } = new URL(req.url)
  const q      = searchParams.get('q')
  const status = searchParams.get('status')
  const state  = searchParams.get('state')
  const limit  = parseInt(searchParams.get('limit') ?? '50')
  const offset = parseInt(searchParams.get('offset') ?? '0')

  // Sensitive fields are NEVER returned in list — strip them at select time
  let query = supabase
    .from('sites')
    .select(`
      id, name, address, city, state, zip,
      property_type, units, status,
      primary_contact_name, primary_contact_email,
      pm_name, pm_email,
      org_id, master_dealer_id, install_dealer_id, service_dealer_id,
      created_at, updated_at
    `)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  // ── Org isolation ──────────────────────────────────────────────────
  query = applyOrgScope(query, scope, 'site')

  if (status) query = query.eq('status', status)
  if (state)  query = query.eq('state', state)
  if (q)      query = query.or(`name.ilike.%${q}%,address.ilike.%${q}%,city.ilike.%${q}%`)

  const { data: sites, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enrich with asset counts
  const siteIds = (sites ?? []).map(s => s.id)
  let assetCounts: Record<string, number> = {}
  if (siteIds.length > 0) {
    const { data: counts } = await supabase
      .from('site_assets')
      .select('site_id')
      .in('site_id', siteIds)
      .eq('status', 'active')
    if (counts) {
      counts.forEach(row => {
        assetCounts[row.site_id] = (assetCounts[row.site_id] ?? 0) + 1
      })
    }
  }

  // Enrich with latest event per site
  let latestEvents: Record<string, { event_type: string; summary: string; created_at: string }> = {}
  if (siteIds.length > 0) {
    for (const siteId of siteIds) {
      const { data: ev } = await supabase
        .from('site_events')
        .select('event_type, summary, created_at')
        .eq('site_id', siteId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      if (ev) latestEvents[siteId] = ev
    }
  }

  const enriched = (sites ?? []).map(site => ({
    ...stripForList(site as Record<string, unknown>),
    asset_count:  assetCounts[site.id] ?? 0,
    latest_event: latestEvents[site.id] ?? null,
  }))

  return NextResponse.json({ sites: enriched, total: enriched.length })
}

// POST /api/sites — create a new site (stamped with the caller's org_id)
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()

  // Only dealers and above can create sites (not clients or reps)
  if (user.isClient) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const body = await req.json()
  const {
    name, address, city, state, zip,
    property_type, units, status,
    master_dealer_id, install_dealer_id, service_dealer_id,
    primary_contact_name, primary_contact_email, primary_contact_phone,
    pm_name, pm_email, pm_phone,
    gate_code, parking_notes, access_notes, notes,
    crm_customer_id, crm_opp_id,
  } = body

  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  // Auto-stamp org_id from the authenticated user unless corporate is specifying it
  const org_id = user.isCorporate
    ? (body.org_id ?? null)
    : (user.org_id ?? null)

  const { data, error } = await supabase
    .from('sites')
    .insert({
      name, address, city, state, zip,
      property_type: property_type ?? 'Multifamily',
      units: units ?? null,
      status: status ?? 'active',
      org_id,
      master_dealer_id: master_dealer_id ?? org_id,
      install_dealer_id: install_dealer_id ?? null,
      service_dealer_id: service_dealer_id ?? null,
      primary_contact_name: primary_contact_name ?? null,
      primary_contact_email: primary_contact_email ?? null,
      primary_contact_phone: primary_contact_phone ?? null,
      pm_name: pm_name ?? null,
      pm_email: pm_email ?? null,
      pm_phone: pm_phone ?? null,
      gate_code: gate_code ?? null,
      parking_notes: parking_notes ?? null,
      access_notes: access_notes ?? null,
      notes: notes ?? null,
      crm_customer_id: crm_customer_id ?? null,
      crm_opp_id: crm_opp_id ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ site: data }, { status: 201 })
}
