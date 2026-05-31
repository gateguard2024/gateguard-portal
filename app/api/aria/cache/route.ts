/**
 * GET /api/aria/cache?query=...
 *
 * Fast cache lookup against aria_properties (<200ms).
 * Returns an existing Prospect-shaped record if one exists and
 * was last enriched within the 14-day freshness TTL.
 *
 * Used by the ARIA page SWR fast-path:
 *   - Cache hit  → show result instantly, fire background re-enrichment
 *   - Cache miss → fall through to full deep route (normal flow)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const FRESHNESS_DAYS = 14

// Same fuzzy-match logic as lookupExistingProperty in the deep route
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function findCachedProperty(query: string): Promise<Record<string, any> | null> {
  const COMMON_MGMT_WORDS = new Set([
    'investment','corporation','corp','inc','llc','management','property',
    'properties','residential','realty','greystar','northland','cortland',
    'lincoln','bozzuto','camden',
  ])
  const words = query.trim().split(/\s+/)
  const lastTwo = words.slice(-2).join(' ')
  const skipFirst = COMMON_MGMT_WORDS.has(words[0]?.toLowerCase()) ? words.slice(1).join(' ') : query
  const fullNorm = query.replace(/,?\s+(atlanta|austin|dallas|houston|chicago|phoenix|denver|nashville|miami|charlotte|raleigh|seattle|boston|NYC|new york|los angeles|san francisco|[A-Z]{2})$/i, '').trim()
  const patterns = [...new Set([lastTwo, skipFirst, fullNorm].filter(p => p.length >= 3))]

  const cols = [
    'id','property_name','address','units','year_built','property_type','class',
    'management_company','owner_entity','owner_type','acquisition_year','capex_signal',
    'isp_providers','video_providers','bulk_agreements','fcc_verified',
    'gate_operators','access_control','intercoms','cameras','smart_locks',
    'resident_apps','package_solutions','tech_generation','sara_signals',
    'replacement_window','displacement_targets',
    'buy_score','urgency','primary_concern','current_vendor','contract_window',
    'contract_expiry_year','communication_style','behavioral_profile','pitch_strategy',
    'pain_signals','dm_name','dm_title','dm_company','dm_email','dm_phone',
    'dm_linkedin_slug','dm_chain','scout_brief',
    'roe_detected','roe_providers','roe_expiry_year',
    'times_researched','last_researched_at','aria_confidence',
    'sales_stage','sales_notes','assigned_rep',
  ].join(',')

  for (const pattern of patterns) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await supabase
      .from('aria_properties')
      .select(cols)
      .ilike('property_name', `%${pattern}%`)
      .limit(1)
      .maybeSingle() as { data: Record<string, any> | null; error: unknown }
    if (data) return data
  }
  return null
}

// Map aria_properties DB row → Prospect shape (mirrors deep route's prospectPayload)
function dbRowToProspect(row: Record<string, any>) {
  const proptech = {
    gate_operators:      row.gate_operators      ?? [],
    access_control:      row.access_control      ?? [],
    intercoms:           row.intercoms           ?? [],
    cameras:             row.cameras             ?? [],
    smart_locks:         row.smart_locks         ?? [],
    resident_apps:       row.resident_apps       ?? [],
    package_solutions:   row.package_solutions   ?? [],
    tech_generation:     row.tech_generation     ?? 'legacy',
    sara_signals:        row.sara_signals        ?? false,
    replacement_window:  row.replacement_window  ?? null,
    displacement_targets: row.displacement_targets ?? [],
  }

  const dmChain: any[] = Array.isArray(row.dm_chain) ? row.dm_chain : []

  const bestDm = dmChain.find((c: any) => c.role_type === 'property_manager')
    || dmChain.find((c: any) => c.role_type === 'regional_manager')
    || dmChain[0]

  return {
    property: {
      name:               row.property_name,
      address:            row.address,
      city:               null,   // not stored in top-level columns
      state:              null,
      units:              row.units             ?? null,
      year_built:         row.year_built        ?? null,
      property_type:      row.property_type     ?? 'multifamily',
      class:              row.class             ?? null,
      occupancy:          null,
      management_company: row.management_company ?? null,
      owner_entity:       row.owner_entity      ?? null,
      phone:              row.dm_phone          ?? null,   // best we have in DB
      isp_providers:      row.isp_providers     ?? [],
      video_providers:    row.video_providers   ?? [],
      bulk_agreements:    row.bulk_agreements   ?? [],
      roe_detected:       row.roe_detected      ?? false,
      roe_providers:      row.roe_providers     ?? [],
      roe_expiry_year:    row.roe_expiry_year   ?? null,
      proptech,
      _fcc_verified:      row.fcc_verified      ?? false,
    },
    decision_maker: {
      name:             row.dm_name          ?? null,
      title:            row.dm_title         ?? null,
      company:          row.dm_company       ?? row.management_company ?? '',
      email:            row.dm_email         ?? '',
      phone:            row.dm_phone         ?? '',
      phone_source:     row.dm_phone ? 'direct' : null,
      gatekeeper_tip:   null,
      tenure_years:     0,
      top_email_format: bestDm?.top_email_format ?? '',
      linkedin_slug:    row.dm_linkedin_slug ?? '',
    },
    decision_maker_chain: dmChain,
    ownership: {
      owner_entity:    row.owner_entity     ?? null,
      owner_type:      row.owner_type       ?? null,
      acquisition_year: row.acquisition_year ? String(row.acquisition_year) : null,
      capex_signal:    row.capex_signal     ?? null,
    },
    pain_signals: Array.isArray(row.pain_signals) ? row.pain_signals : [],
    profile: {
      buy_score:           row.buy_score        ?? 5,
      urgency:             row.urgency          ?? 'medium',
      primary_concern:     row.primary_concern  ?? null,
      current_vendor:      row.current_vendor   ?? null,
      contract_window:     row.contract_window  ?? null,
      communication_style: row.communication_style ?? 'Email',
    },
    behavioral_profile: row.behavioral_profile ?? null,
    pitch_strategy:     row.pitch_strategy     ?? null,
    freshness_score:    row.buy_score          ?? 5,
    scout_brief:        row.scout_brief        ?? null,
  }
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ hit: false, reason: 'unauthenticated' }, { status: 401 })

    const query = req.nextUrl.searchParams.get('query')?.trim()
    if (!query) return NextResponse.json({ hit: false, reason: 'no_query' })

    const row = await findCachedProperty(query)
    if (!row) return NextResponse.json({ hit: false, reason: 'not_found' })

    // Check freshness TTL
    const lastResearched = row.last_researched_at ? new Date(row.last_researched_at) : null
    const ageMs = lastResearched ? Date.now() - lastResearched.getTime() : Infinity
    const ageHours = Math.floor(ageMs / (1000 * 60 * 60))
    const ageDays = ageHours / 24

    // Always return the data — client decides freshness.
    // is_stale=true means the client should fire background re-enrichment via Inngest.
    const isStale = ageDays > FRESHNESS_DAYS
    const prospect = dbRowToProspect(row)

    return NextResponse.json({
      hit: true,
      is_stale: isStale,
      property_id: row.id,
      property_name: row.property_name,
      cache_age_hours: ageHours,
      times_researched: row.times_researched ?? 1,
      last_researched_at: row.last_researched_at,
      // Full Prospect-shaped payload
      prospects: [prospect],
      // Mirror the shape deep route returns
      mode: 'deep',
      engine_version: 'cache',
      webIntelligence: true,
      fccVerified: row.fcc_verified ?? false,
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Cache lookup failed'
    console.error('[aria/cache]', msg)
    return NextResponse.json({ hit: false, reason: 'error', error: msg })
  }
}
