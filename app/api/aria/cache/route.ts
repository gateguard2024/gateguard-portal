/**
 * GET /api/aria/cache?query=...
 *
 * ARIA v9 — Fast cache lookup against aria_properties (<200ms target).
 *
 * Lookup order:
 *   1. isProspectingQuery() guard — returns {hit:false} immediately for market/criteria queries
 *      that should never cache-match a specific property.
 *   2. Vector search (primary) — embeds the query and finds nearest property by cosine
 *      similarity (threshold 0.88). 1.5s AbortSignal prevents latency spikes.
 *   3. ILIKE fuzzy match (fallback) — 3-pattern ILIKE across property_name if vector
 *      search returns no result or embedding fails.
 *
 * Returns:
 *   Cache hit  → { hit: true, is_stale: boolean, prospect, ... }
 *   Cache miss → { hit: false, reason: '...' }
 *
 * Used by the ARIA page SWR fast-path. is_stale=true triggers Inngest re-enrichment.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { embedBatch } from '@/lib/vectorize'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const FRESHNESS_DAYS = 14
const VECTOR_SIMILARITY_THRESHOLD = 0.88
const VECTOR_TIMEOUT_MS = 1500

// ─── Prospecting query guard ──────────────────────────────────────────────────
// Returns true for queries that describe a MARKET or CRITERIA, not a specific property.
// These MUST go through the full pipeline — never cache-match a specific property.
const PROSPECTING_PATTERNS = [
  /\bproperties\s+in\b/i,
  /\bmultifamily\s+in\b/i,
  /\bapartments?\s+in\b/i,
  /\bcomplexes?\s+in\b/i,
  /\bmarket\b.*(in|near|around)\b/i,
  /\bexpiring\s+(roe|bulk|contract|agreement)/i,
  /\bROE\s+expir/i,
  /\bMDU\b.*\b(in|near|with)\b/i,
  /\bbulk\s+agreement/i,
  /\b\d{3,}\+?\s+units?\b/i,        // "200+ units"
  /\bwith\s+(gate|gated|access|internet|wifi|fiber)\b/i,
  /\b(gate|internet|isp)\s+complaints?\b/i,
  /\b(city|area|market|region)\s+of\b/i,
  /\b(find|show|list|search)\b.*(properties|apartments|complexes)/i,
]

function isProspectingQuery(query: string): boolean {
  return PROSPECTING_PATTERNS.some(p => p.test(query))
}

// ─── Column list for cache queries ───────────────────────────────────────────
const CACHE_COLS = [
  'id','property_name','address','city','state','units','year_built','property_type','class',
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

// ─── Vector search (primary path) ────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function findByVector(query: string): Promise<Record<string, any> | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), VECTOR_TIMEOUT_MS)

    const embedPromise = embedBatch([query])
    const embedding = await Promise.race([
      embedPromise,
      new Promise<never>((_, reject) =>
        controller.signal.addEventListener('abort', () => reject(new Error('vector_timeout')))
      ),
    ]).finally(() => clearTimeout(timer))

    if (!embedding?.[0]) return null

    const { data, error } = await supabase.rpc('find_aria_property_by_embedding', {
      p_embedding: embedding[0],
      p_threshold: VECTOR_SIMILARITY_THRESHOLD,
    })

    if (error || !data?.length) return null
    return data[0] as Record<string, any>
  } catch (err) {
    // Vector path failed (timeout, embedding error, RPC error) → caller falls back to ILIKE
    const msg = err instanceof Error ? err.message : 'vector_error'
    console.warn('[aria/cache] vector search skipped:', msg)
    return null
  }
}

// ─── ILIKE fuzzy match (fallback) ────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function findByIlike(query: string): Promise<Record<string, any> | null> {
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

  for (const pattern of patterns) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await supabase
      .from('aria_properties')
      .select(CACHE_COLS)
      .ilike('property_name', `%${pattern}%`)
      .limit(1)
      .maybeSingle() as { data: Record<string, any> | null; error: unknown }
    if (data) return data
  }
  return null
}

// ─── Main lookup ─────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function findCachedProperty(query: string): Promise<Record<string, any> | null> {
  // Try vector first, fall back to ILIKE
  const vectorResult = await findByVector(query)
  if (vectorResult) return vectorResult
  return findByIlike(query)
}

// ─── DB row → Prospect shape ──────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dmChain: any[] = Array.isArray(row.dm_chain) ? row.dm_chain : []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bestDm = dmChain.find((c: any) => c.role_type === 'property_manager')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    || dmChain.find((c: any) => c.role_type === 'regional_manager')
    || dmChain[0]

  return {
    property: {
      name:               row.property_name,
      address:            row.address,
      city:               row.city ?? null,
      state:              row.state ?? null,
      units:              row.units             ?? null,
      year_built:         row.year_built        ?? null,
      property_type:      row.property_type     ?? 'multifamily',
      class:              row.class             ?? null,
      occupancy:          null,
      management_company: row.management_company ?? null,
      owner_entity:       row.owner_entity      ?? null,
      phone:              row.dm_phone          ?? null,
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

// ─── GET handler ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ hit: false, reason: 'unauthenticated' }, { status: 401 })

    const query = req.nextUrl.searchParams.get('query')?.trim()
    if (!query) return NextResponse.json({ hit: false, reason: 'no_query' })

    // ── Catch 1: Prospecting query guard ─────────────────────────────────────
    // Must run BEFORE any embedding call or DB query.
    // Prospecting queries describe a market, not a property — never cache-match.
    if (isProspectingQuery(query)) {
      return NextResponse.json({ hit: false, reason: 'prospecting_query' })
    }

    const row = await findCachedProperty(query)
    if (!row) return NextResponse.json({ hit: false, reason: 'not_found' })

    // Freshness check
    const lastResearched = row.last_researched_at ? new Date(row.last_researched_at) : null
    const ageMs = lastResearched ? Date.now() - lastResearched.getTime() : Infinity
    const ageHours = Math.floor(ageMs / (1000 * 60 * 60))
    const ageDays = ageHours / 24

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
